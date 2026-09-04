import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndicatorsResponse } from '../src/api-client.ts'
import { Performance } from '../src/pages/Performance.tsx'
import { type ApiStub, indicatorsFixture, stubApi } from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * A Pagina Performance (RF-12). Nada e calculado aqui: media, amostra, exclusoes
 * e o corte em `topN` chegam prontos do servidor.
 */

let api: ApiStub

beforeEach(() => {
  mountLiveRegions()
  window.history.replaceState(null, '', '/performance')
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

type Breakdowns = IndicatorsResponse['leadTimeByGroup']
type LeadTimeGroup = Breakdowns['clients'][number]

function group(overrides: Partial<LeadTimeGroup> = {}): LeadTimeGroup {
  return {
    key: 'ACME',
    label: 'Acme Log',
    count: 10,
    averageDays: 12.5,
    sampleSize: 4,
    excludedNegative: 0,
    excludedIncomplete: 6,
    ...overrides,
  }
}

function serve(breakdowns: Partial<Breakdowns>, rest: Partial<IndicatorsResponse> = {}): void {
  const base = indicatorsFixture()
  api.serveIndicators({
    ...base,
    ...rest,
    leadTimeByGroup: { ...base.leadTimeByGroup, ...breakdowns },
  })
}

function renderPage(queryString = '') {
  return render(<Performance queryString={queryString} dataVersion={0} />)
}

function section(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name })
}

describe('as quatro quebras', () => {
  it('exibe cliente, agente, navio e responsavel', async () => {
    serve({ clients: [group()] })
    renderPage()

    expect(await section('Tempo documental por cliente')).toBeTruthy()
    expect(await section('Tempo documental por agente')).toBeTruthy()
    expect(await section('Tempo documental por navio')).toBeTruthy()
    expect(await section('Tempo documental por responsável')).toBeTruthy()
  })

  // A-42: o numero sozinho convida a conclusao errada. Medido: uma media de
  // grupo pode vir de uma unica medicao.
  it('exibe a media com a amostra ao lado', async () => {
    serve({ clients: [group({ averageDays: 12.5, sampleSize: 4, count: 10 })] })
    renderPage()

    const linha = within(await section('Tempo documental por cliente')).getByRole('row', {
      name: /Acme Log/,
    })

    expect(within(linha).getByText('12,5 d')).toBeTruthy()
    expect(within(linha).getByText('4')).toBeTruthy()
    expect(within(linha).getByText('10')).toBeTruthy()
  })

  it('exibe traco, e nao zero, no grupo sem nenhum par completo', async () => {
    serve({
      clients: [
        group({ label: 'Sem par', averageDays: null, sampleSize: 0, excludedIncomplete: 10 }),
      ],
    })
    renderPage()

    const linha = within(await section('Tempo documental por cliente')).getByRole('row', {
      name: /Sem par/,
    })

    expect(within(linha).getByText('—')).toBeTruthy()
    expect(within(linha).queryByText('0 d')).toBeNull()
  })

  it('exibe media com amostra 1, sem corte minimo (A-42)', async () => {
    serve({ clients: [group({ label: 'Unico', averageDays: 7, sampleSize: 1, count: 1 })] })
    renderPage()

    const linha = within(await section('Tempo documental por cliente')).getByRole('row', {
      name: /Unico/,
    })

    expect(within(linha).getByText('7 d')).toBeTruthy()
  })

  it('rotula o grupo de chave vazia como (sem valor)', async () => {
    serve({ vessels: [group({ key: '', label: '' })] })
    renderPage()

    expect(
      within(await section('Tempo documental por navio')).getByText('(sem valor)'),
    ).toBeTruthy()
  })

  it('diz que a quebra esta vazia, em vez de tabela em branco', async () => {
    serve({ clients: [] })
    renderPage()

    expect(
      within(await section('Tempo documental por cliente')).getByText(/Nenhum cliente/),
    ).toBeTruthy()
  })

  /**
   * Regra inviolavel 2. Medido: 509 grupos de cliente, e a tela mostra 10 —
   * sem o rodape, o recorte seria descarte silencioso.
   */
  it('anuncia quantos grupos o teto deixou de fora', async () => {
    serve({
      clients: [group()],
      groupTotals: { clients: 509, agents: 35, vessels: 70, responsible: 4 },
    })
    renderPage()

    expect(
      within(await section('Tempo documental por cliente')).getByText(/Exibindo 1 de 509 grupos/),
    ).toBeTruthy()
  })

  it('omite o rodape quando nada foi cortado', async () => {
    serve({
      clients: [group()],
      groupTotals: { clients: 1, agents: 35, vessels: 70, responsible: 4 },
    })
    renderPage()

    expect(within(await section('Tempo documental por cliente')).queryByText(/Exibindo/)).toBeNull()
  })
})

describe('o agregado de IND-22', () => {
  it('exibe media, amostra e as duas exclusoes de A-30', async () => {
    serve(
      {},
      {
        documentaryLeadTime: {
          averageDays: 12.5,
          sampleSize: 101,
          excludedNegative: 1,
          excludedIncomplete: 547,
        },
      },
    )
    renderPage()

    const agregado = await section('Tempo médio de envio documental')

    expect(within(agregado).getByText('12,5 d')).toBeTruthy()
    expect(within(agregado).getByText(/101 processos medidos/)).toBeTruthy()
    expect(within(agregado).getByText('547')).toBeTruthy()
    expect(within(agregado).getByText('1')).toBeTruthy()
  })

  it('exibe traco na media de amostra vazia', async () => {
    serve(
      {},
      {
        documentaryLeadTime: {
          averageDays: null,
          sampleSize: 0,
          excludedNegative: 0,
          excludedIncomplete: 649,
        },
      },
    )
    renderPage()

    expect(within(await section('Tempo médio de envio documental')).getByText('—')).toBeTruthy()
  })
})

describe('ranking de agentes — IND-17 com overdueCount (A-27)', () => {
  it('exibe a contagem e os atrasados lado a lado', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        agents: [{ key: 'BM', label: 'B&M', count: 246, overdueCount: 7 }],
      },
    })
    renderPage()

    const agentes = await section('Agentes')

    expect(within(agentes).getByText('246')).toBeTruthy()
    expect(within(agentes).getByText('7 atrasados')).toBeTruthy()
  })

  // Zero atraso e resultado, nao falta de dado: coluna em branco pareceria a
  // segunda coisa.
  it('exibe zero atrasados, sem omitir a coluna', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        agents: [{ key: 'LIMPO', label: 'Limpo', count: 12, overdueCount: 0 }],
      },
    })
    renderPage()

    expect(within(await section('Agentes')).getByText('0 atrasados')).toBeTruthy()
  })

  it('aplica o filtro de agente e abre a Operacional', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        agents: [{ key: 'BM', label: 'B&M', count: 246, overdueCount: 7 }],
      },
    })
    renderPage()

    fireEvent.click(await within(await section('Agentes')).findByRole('button', { name: /B&M/ }))

    expect(window.location.pathname).toBe('/operacional')
    expect(window.location.search).toBe('?agent=BM')
  })
})

/**
 * `H-67`. Com `secondary` a linha do ranking tem QUATRO slots de largura fixa —
 * `w-40` do rótulo, `w-12` da contagem, `w-24` do secundário e três `gap-3` —,
 * somando 348 px antes da barra. A 320 px CSS a página rolava até **385**
 * (`VN-1/A`), porque `shrink-0` proíbe o colapso.
 *
 * A correção empilha, e **só onde há `secondary`**: `Performance.tsx` é a única
 * das sete páginas que o passa. As outras seis usam o mesmo componente e já
 * passavam a 320 — alcançá-las mudaria seis telas sem defeito, que é o que o
 * segundo critério de aceite proíbe. **jsdom não faz layout**: o que se afirma
 * aqui é qual ramo cada linha recebe. Medido em Chrome 151 ao fechar a
 * história: 385 → 305 a 320 px, e a 1280 px a linha continua única, com o
 * rótulo em 160 px — idêntica ao que era.
 */
describe('a linha do ranking a 320 px', () => {
  function comAgente(overdueCount: number) {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        agents: [{ key: 'BM', label: 'B&M', count: 246, overdueCount }],
      },
    })
    renderPage()
  }

  it('deixa o rótulo tomar a linha inteira quando há secundário', async () => {
    comAgente(7)

    const rotulo = within(await section('Agentes')).getByText('B&M')

    expect(rotulo.className).toContain('w-full')
    expect(rotulo.className).toContain('sm:w-40')
  })

  it('permite a quebra só na linha que tem secundário', async () => {
    comAgente(7)

    const linha = within(await section('Agentes')).getByText('B&M').parentElement

    expect(linha?.className).toContain('flex-wrap')
  })

  /**
   * O segundo critério de aceite, e é ele que justifica a correção estar no
   * ramo condicional em vez de na linha. O ranking por responsável não passa
   * `secondary`, como as outras seis páginas — e nenhum recebe a quebra.
   */
  it('não alcança o ranking sem secundário, que já cabia', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        responsible: [{ key: 'colaborador1', label: 'Colaborador 1', count: 120 }],
      },
    })
    renderPage()

    const rotulo = within(await section('Responsáveis')).getByText('Colaborador 1')

    expect(rotulo.className).toContain('w-40')
    expect(rotulo.className).not.toContain('w-full')
    expect(rotulo.parentElement?.className).not.toContain('flex-wrap')
  })

  /**
   * O caso-limite da história: `43 atrasados` é o texto mais longo medido, e é
   * ele que produz os 96 px do slot. Medido no navegador ao fechar: 76,0 px de
   * 96 — cabe, e mesmo `9.999 atrasados` cabe, em 93,1. Empilhar não custou o
   * número, que é o que o terceiro critério de aceite exige.
   */
  it('mantém o secundário mais longo na tela, em vez de escondê-lo', async () => {
    comAgente(43)

    expect(within(await section('Agentes')).getByText('43 atrasados')).toBeTruthy()
  })
})

describe('ranking por responsavel — IND-20', () => {
  it('exibe as quatro chaves, inclusive a zerada (A-17, A-28)', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        responsible: [
          { key: 'indefinido', label: 'Indefinido', count: 484 },
          { key: 'colaborador1', label: 'Colaborador 1', count: 120 },
          { key: 'colaborador2', label: 'Colaborador 2', count: 0 },
          {
            key: 'colaborador1_outros_clientes',
            label: 'Colaborador 1 — outros clientes',
            count: 9,
          },
        ],
      },
    })
    renderPage()

    const responsaveis = await section('Responsáveis')

    expect(within(responsaveis).getAllByRole('listitem')).toHaveLength(4)
    expect(within(responsaveis).getByText('Colaborador 2')).toBeTruthy()
    expect(within(responsaveis).getByText('0')).toBeTruthy()
  })

  /**
   * A linha segue sem virar botao: `H-50` removeu o impedimento de A-18, mas
   * torna-la clicavel e funcionalidade nova, e nenhum criterio a pede.
   *
   * **`H-66` reescreveu o texto**, que ate entao dizia que o responsavel vinha
   * da cor — verdade ate `H-50`, falsa depois dela. E o quinto criterio de
   * `H-53`, que ficou nao-incidente ate o campo novo existir.
   */
  it('nao torna a linha clicavel, e diz de onde vem o responsavel', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        responsible: [{ key: '', label: 'Sem responsável', count: 42 }],
      },
    })
    renderPage()

    const responsaveis = await section('Responsáveis')

    const texto = responsaveis.textContent ?? ''

    expect(within(responsaveis).queryByRole('button')).toBeNull()
    expect(texto).toContain('vem do importador')
    expect(texto).toContain('Cor do responsável')
    // A-31 continua valendo — para a COR, que agora e o outro filtro.
    expect(texto).toContain('A-31')
  })

  // O texto anterior afirmava o contrario, e afirma-lo depois de `H-50` seria a
  // tela mentindo sobre a regra que o servidor aplica.
  it('nao diz mais que o responsavel vem da cor da linha', async () => {
    renderPage()

    const responsaveis = await section('Responsáveis')

    const texto = responsaveis.textContent ?? ''

    expect(texto).not.toContain('vem da cor da linha')
    expect(texto).not.toContain('costuma liderar')
  })
})

/**
 * `H-69`. `VN-2` mediu o truncamento da tabela de tempo documental **crescendo**
 * com a ampliação — 7 células a 100%, 8 a 200% e 14 com a fonte do navegador em
 * "Muito grande" —, e nenhuma das 34 tinha `title`: o texto cortado não tinha
 * recurso nenhum. `SC 1.4.4` cobra que ampliar até 200% não custe conteúdo, e
 * ali o conteúdo perdido dobrava.
 *
 * A correção é o rótulo quebrar em linhas em vez de ser cortado, e a coluna
 * tomar o espaço que as três numéricas não usam. **jsdom não faz layout**: o
 * que se afirma aqui é que a célula não declara corte e não ganhou adorno.
 * Medido em Chrome 151 nos quatro cenários de ampliação, com 68 células:
 * **zero cortadas**, contra 31 a 100% e 41 a 640 px com fonte 24.
 */
describe('o texto da tabela de tempo documental', () => {
  const LONGO = 'AGENCIA MARITIMA INTERNACIONAL DO BRASIL'

  it('não corta o rótulo, deixa-o quebrar', async () => {
    serve({ clients: [group({ key: 'longo', label: LONGO })] })
    renderPage()

    const celula = (await screen.findByText(LONGO)).closest('td')

    expect(celula?.className).toContain('break-words')
    expect(celula?.className).not.toContain('truncate')
    expect(celula?.className).not.toContain('max-w-0')
  })

  /**
   * O terceiro critério de aceite. `title` seria o reflexo, e ele **não basta**:
   * o Chrome não o revela por teclado. Aqui não há o que revelar — o texto
   * inteiro está na tela —, então acrescentá-lo poluiria toda célula que já
   * cabia, e uma parada de tabulação por linha poluiria a ordem que `H-47`
   * aprovou em 467 de 467.
   */
  it('não acrescenta title nem parada de tabulação a célula nenhuma', async () => {
    serve({ clients: [group({ key: 'longo', label: LONGO })] })
    renderPage()
    await screen.findByText(LONGO)

    const celulas = document.querySelectorAll('table tbody tr > td:first-child')

    expect(celulas.length).toBeGreaterThan(0)
    for (const celula of celulas) {
      expect(celula.hasAttribute('title')).toBe(false)
      expect((celula as HTMLElement).tabIndex).toBeLessThan(0)
    }
  })

  /**
   * Caso-limite: rótulo vazio já vira o literal `(sem valor)`, e não pode ganhar
   * rótulo de "texto completo" para conteúdo que não existe.
   */
  it('não promete texto completo onde não há texto', async () => {
    serve({ clients: [group({ key: 'vazio', label: '' })] })
    renderPage()

    const celula = (await screen.findByText('(sem valor)')).closest('td')

    expect(celula?.hasAttribute('title')).toBe(false)
    expect(celula?.getAttribute('aria-label')).toBeNull()
  })
})

describe('IND-21 fora de escopo', () => {
  it('declara a ausencia em vez de omiti-la', async () => {
    serve({})
    renderPage()

    const nota = await section('Fora de escopo')

    expect(within(nota).getByText(/Tempo médio até desembaraço não é exibido/)).toBeTruthy()
    expect(within(nota).getByText(/presença de carga/)).toBeTruthy()
  })
})

describe('estados que nao sao zero', () => {
  it('distingue ausencia de leitura de conjunto vazio', async () => {
    api.indicatorsWithoutRead()
    renderPage()

    expect((await findLiveRegion('status', /Nenhuma leitura/)).textContent).toMatch(
      /traço aqui não significa zero dia/,
    )
    expect(screen.getAllByText(/traço aqui não significa zero dia/)).toHaveLength(2)
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failIndicators()
    renderPage()

    // A região viva primeiro: o portal monta num efeito, e esperar por "existe
    // algum alert" resolveria na região vazia, antes de a mensagem chegar.
    expect((await findLiveRegion('alert')).textContent).toMatch(
      /Não foi possível carregar a performance/,
    )
    expect(screen.getAllByText(/Não foi possível carregar a performance/)).toHaveLength(2)
  })
})

describe('filtros globais', () => {
  it('anexa o recorte a propria requisicao', async () => {
    serve({ clients: [group()] })
    renderPage('?category=em_andamento')

    await section('Tempo documental por cliente')
    expect(api.calls).toContain('GET /api/indicators?category=em_andamento')
  })
})

/**
 * `H-53`. A página passa a dizer o que mede e sobre o que mede.
 *
 * Nenhum dos dois era defeito de cálculo: a métrica está correta desde IND-22, e
 * o filtro funciona desde `H-15`. O que faltava era a tela dizer.
 */
describe('o que a página declara sobre si', () => {
  it('escreve a fórmula junto do agregado, e não em nota de rodapé', async () => {
    renderPage()

    const agregado = await screen.findByRole('region', { name: 'Tempo médio de envio documental' })

    // A ordem das duas datas é a de A-02: a invertida daria valor negativo.
    expect(within(agregado).getByText(/RG − DOCS ENVIADOS/)).toBeTruthy()
    expect(within(agregado).getByText(/dias inteiros/)).toBeTruthy()
  })

  it('explica o que cada uma das duas exclusões de A-30 significa', async () => {
    renderPage()

    const agregado = await screen.findByRole('region', { name: 'Tempo médio de envio documental' })
    const texto = agregado.textContent ?? ''

    expect(texto).toContain('sem uma das duas datas')
    expect(texto).toContain('com intervalo negativo')
    // O que cada uma significa, e não só o número.
    expect(texto).toMatch(/registro está datado antes do envio/)
    expect(texto).toMatch(/descartar em silêncio/)
  })

  // A funcionalidade existia e era invisível: o operador perguntou se dava para
  // filtrar por cliente e importador, e dava desde `H-15`.
  it('sem filtro, diz que os números cobrem a base inteira e oferece o caminho', async () => {
    window.history.replaceState(null, '', '/')
    renderPage()

    const recorte = await screen.findByRole('region', { name: 'Recorte ativo' })
    const texto = recorte.textContent ?? ''

    expect(texto).toContain('Sem filtro ativo')
    expect(texto).toContain('base inteira')
    expect(texto).toMatch(/barra de filtros/)
  })

  it('com filtro ativo, nomeia quais estão recortando os números', async () => {
    window.history.replaceState(null, '', '/?client=ACME&agent=B%26M')
    renderPage('?client=ACME&agent=B%26M')

    const recorte = await screen.findByRole('region', { name: 'Recorte ativo' })
    const texto = recorte.textContent ?? ''

    expect(texto).toContain('2 filtros ativos')
    expect(texto).toContain('Cliente: ACME')
    expect(texto).toContain('Agente: B&M')
    window.history.replaceState(null, '', '/')
  })

  it('resume o filtro com muitos valores pela contagem, em vez de listar todos', async () => {
    window.history.replaceState(null, '', '/?client=ACME&client=BETA&client=GAMA')
    renderPage('?client=ACME&client=BETA&client=GAMA')

    const recorte = await screen.findByRole('region', { name: 'Recorte ativo' })

    expect(recorte.textContent).toContain('Cliente: 3 valores')
    window.history.replaceState(null, '', '/')
  })

  /**
   * `H-66`. Os dois filtros de responsável são independentes: um recorta por
   * quem responde, o outro por o que a linha está pintada. O painel nomeia os
   * dois separadamente, e é `MULTI_FILTER_LABELS` que os distingue.
   */
  it('nomeia responsável e cor do responsável como filtros distintos', async () => {
    window.history.replaceState(null, '', '/?responsible=membro1&colorResponsible=colaborador2')
    renderPage('?responsible=membro1&colorResponsible=colaborador2')

    const recorte = await screen.findByRole('region', { name: 'Recorte ativo' })
    const texto = recorte.textContent ?? ''

    expect(texto).toContain('2 filtros ativos')
    expect(texto).toContain('Responsável: membro1')
    expect(texto).toContain('Cor do responsável: colaborador2')
    window.history.replaceState(null, '', '/')
  })

  // O período ocupa dois parâmetros e conta como UM filtro — a mesma regra de
  // `activeCount` em `useFilters`.
  it('declara o período como um filtro só, com os dois extremos', async () => {
    window.history.replaceState(null, '', '/?etaFrom=2026-02-01&etaTo=2026-02-28')
    renderPage('?etaFrom=2026-02-01&etaTo=2026-02-28')

    const recorte = await screen.findByRole('region', { name: 'Recorte ativo' })
    const texto = recorte.textContent ?? ''

    expect(texto).toContain('1 filtro ativo')
    expect(texto).toContain('01/02/2026 a 28/02/2026')
    window.history.replaceState(null, '', '/')
  })

  // A-42: o denominador não sai do lado da média, e explicar a métrica não
  // afrouxa isso. Amostra de 1 continua exibida com a amostra ao lado.
  it('amostra de tamanho 1 continua com o denominador ao lado', async () => {
    const comUmSo = indicatorsFixture()
    comUmSo.documentaryLeadTime = {
      averageDays: 9,
      sampleSize: 1,
      excludedNegative: 0,
      excludedIncomplete: 648,
    }
    api.serveIndicators(comUmSo)
    renderPage()

    const agregado = await screen.findByRole('region', { name: 'Tempo médio de envio documental' })

    expect(within(agregado).getByText('9 d')).toBeTruthy()
    expect(within(agregado).getByText(/1 processo medido/)).toBeTruthy()
  })

  // O caso-limite do backlog: traço, nunca zero dia, E a página diz por quê —
  // senão o traço parece falha de carregamento.
  it('amostra zerada exibe traço e diz que o recorte não tem par completo', async () => {
    const zerado = indicatorsFixture()
    zerado.documentaryLeadTime = {
      averageDays: null,
      sampleSize: 0,
      excludedNegative: 0,
      excludedIncomplete: 12,
    }
    api.serveIndicators(zerado)
    renderPage()

    const agregado = await screen.findByRole('region', { name: 'Tempo médio de envio documental' })
    const texto = agregado.textContent ?? ''

    expect(within(agregado).getByText('—')).toBeTruthy()
    expect(texto).toContain('nenhum processo do recorte')
    expect(texto).toContain('não que o tempo seja zero')
  })
})
