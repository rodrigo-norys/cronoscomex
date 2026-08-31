import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndicatorsResponse } from '../src/api-client.ts'
import { Performance } from '../src/pages/Performance.tsx'
import { type ApiStub, indicatorsFixture, stubApi } from './support/api-stub.ts'

/**
 * A Pagina Performance (RF-12). Nada e calculado aqui: media, amostra, exclusoes
 * e o corte em `topN` chegam prontos do servidor.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/performance')
  api = stubApi()
})

afterEach(() => {
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
   * A-18 faz o filtro `colaborador1` selecionar tambem os outros clientes dele,
   * enquanto o ranking os exibe separados. Clicar numa linha de 120 e cair numa
   * tela de 129 faria o operador desconfiar do numero certo.
   */
  it('nao torna a linha clicavel, e diz por que', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        responsible: [{ key: 'indefinido', label: 'Indefinido', count: 484 }],
      },
    })
    renderPage()

    const responsaveis = await section('Responsáveis')

    expect(within(responsaveis).queryByRole('button')).toBeNull()
    expect(within(responsaveis).getByText(/não são clicáveis/)).toBeTruthy()
    expect(within(responsaveis).getByText(/A-31/)).toBeTruthy()
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

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/traço aqui não significa zero dia/)).toBeTruthy()
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failIndicators()
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Não foi possível carregar a performance/)).toBeTruthy()
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
