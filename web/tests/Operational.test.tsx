import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Operational } from '../src/pages/Operational.tsx'
import {
  type ApiStub,
  indicatorsFixture,
  processesFixture,
  processFixture,
  stubApi,
} from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * A Pagina Operacional (RF-10). Nada e ordenado, filtrado ou somado aqui — o
 * servidor entrega a pagina pronta, e reordenar no cliente daria um resultado
 * diferente do que `total` conta.
 */

let api: ApiStub

beforeEach(() => {
  mountLiveRegions()
  window.history.replaceState(null, '', '/operacional')
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function renderPage(queryString = '') {
  return render(<Operational queryString={queryString} dataVersion={0} />)
}

function lastProcessCall(): string {
  return api.calls.filter((call) => call.startsWith('GET /api/processes')).at(-1) ?? ''
}

describe('tabela', () => {
  it('exibe as linhas que o servidor devolveu', async () => {
    api.serveProcesses(
      processesFixture([
        processFixture({ ref: 'FT501.26', client: 'ACME LOG' }),
        processFixture({ ref: 'FT502.26', client: 'BETA' }),
      ]),
    )
    renderPage()

    // `H-75`, `ACHADO 7`: o nome acessível é o mesmo de `AlertRow` para a
    // mesma ação, e CONTÉM o texto visível — a REF —, como `SC 2.5.3` exige.
    expect(await screen.findByRole('link', { name: 'Abrir o detalhe de FT501.26' })).toBeTruthy()
    expect(screen.getByText('BETA')).toBeTruthy()
  })

  it('exibe traco para campo vazio e para eta2 nulo', async () => {
    api.serveProcesses(
      processesFixture([processFixture({ eta2: null, client: '', billOfLading: '' })]),
    )
    renderPage()

    await screen.findByRole('grid')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('formata a data em pt-BR', async () => {
    api.serveProcesses(processesFixture([processFixture({ eta2: '2026-08-20' })]))
    renderPage()

    expect(await screen.findByText('20/08/2026')).toBeTruthy()
  })

  /** `fechado_aguardando_draft` tem todas as colunas vazias por definicao — a
   * categoria e o unico dado que ele carrega, e precisa aparecer. */
  it('mostra o processo fechado-aguardando-draft com a categoria explicita', async () => {
    api.serveProcesses(
      processesFixture([
        processFixture({
          ref: 'FT900.26',
          statusCategory: 'fechado_aguardando_draft',
          client: '',
          importer: '',
          vessel: '',
          eta2: null,
          billOfLading: '',
          container: '',
        }),
      ]),
    )
    renderPage()

    expect(await screen.findByText('Fechado — draft')).toBeTruthy()
  })

  it('destaca o Canal Vermelho', async () => {
    api.serveProcesses(processesFixture([processFixture({ customsChannel: 'vermelho' })]))
    renderPage()

    expect(await screen.findByText('Canal Vermelho')).toBeTruthy()
  })

  it('conjunto vazio diz que nada corresponde, sem tabela em branco', async () => {
    api.serveProcesses(processesFixture([]))
    renderPage()

    expect(await screen.findByText(/Nenhum processo corresponde/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a REF leva ao detalhe do processo', async () => {
    api.serveProcesses(processesFixture([processFixture({ ref: 'FT501.26' })]))
    renderPage()

    fireEvent.click(await screen.findByRole('link', { name: 'Abrir o detalhe de FT501.26' }))

    expect(window.location.pathname).toBe('/processo/FT501.26')
  })
})

describe('busca — A-39', () => {
  it('escreve o termo na URL e o envia ao servidor', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(screen.getByLabelText(/Buscar em qualquer campo de texto/), {
      target: { value: 'NBSC260' },
    })

    expect(window.location.search).toContain('search=NBSC260')
    await waitFor(() => expect(lastProcessCall()).toContain('search=NBSC260'))
  })

  it('limpar a busca remove o parametro, em vez de mandar vazio', async () => {
    window.history.replaceState(null, '', '/operacional?search=NBSC')
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(screen.getByLabelText(/Buscar em qualquer campo de texto/), {
      target: { value: '' },
    })

    expect(window.location.search).not.toContain('search=')
  })
})

describe('activeOnly — A-16 e D-33', () => {
  /** `D-33` inverteu o recorte padrao da TELA: ela abre com todos, e o padrao
   * da pagina passou a ser o mesmo da rota. `A-16` nao muda — "ativo" continua
   * sendo `categoria != desembaracado`. */
  it('parte de activeOnly=false, sem parametro na URL', async () => {
    renderPage()

    await waitFor(() => expect(lastProcessCall()).toContain('activeOnly=false'))
    expect(window.location.search).not.toContain('activeOnly')
  })

  it('abre com o controle desmarcado', async () => {
    renderPage()
    await screen.findByRole('grid')

    const controle = screen.getByLabelText('Ocultar desembaraçados') as HTMLInputElement
    expect(controle.checked).toBe(false)
  })

  it('marcar "ocultar desembaracados" manda true', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(screen.getByLabelText('Ocultar desembaraçados'))

    await waitFor(() => expect(lastProcessCall()).toContain('activeOnly=true'))
    expect(window.location.search).toContain('activeOnly=true')
  })
})

describe('ordenacao', () => {
  it('parte de eta2 ascendente', async () => {
    renderPage()

    await waitFor(() => {
      expect(lastProcessCall()).toContain('sort=eta2')
      expect(lastProcessCall()).toContain('order=asc')
    })
  })

  /**
   * **Escopado ao cabecalho de proposito.** Desde que as celulas se editam onde
   * estao, "ETA2" tambem e nome acessivel de 200 botoes de celula — um seletor
   * pela pagina inteira casaria os 201.
   */
  function cabecalho(nome: RegExp): HTMLElement {
    const coluna = screen.getAllByRole('columnheader').find((th) => nome.test(th.textContent ?? ''))
    if (coluna === undefined) throw new Error(`coluna ${nome} nao encontrada`)
    return within(coluna).getByRole('button')
  }

  it('clicar na mesma coluna alterna a direcao', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(cabecalho(/ETA2/))
    await waitFor(() => expect(lastProcessCall()).toContain('order=desc'))

    fireEvent.click(cabecalho(/ETA2/))
    await waitFor(() => expect(lastProcessCall()).toContain('order=asc'))
  })

  it('clicar em outra coluna comeca em ascendente', async () => {
    window.history.replaceState(null, '', '/operacional?sort=eta2&order=desc')
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(cabecalho(/REF/))

    await waitFor(() => {
      expect(lastProcessCall()).toContain('sort=ref')
      expect(lastProcessCall()).toContain('order=asc')
    })
  })

  it('marca a coluna ordenada para o leitor de tela', async () => {
    renderPage()
    await screen.findByRole('grid')

    const eta2 = screen.getAllByRole('columnheader').find((th) => th.textContent?.includes('ETA2'))
    expect(eta2?.getAttribute('aria-sort')).toBe('ascending')
  })
})

describe('paginacao', () => {
  it('nao pagina quando o total cabe numa pagina', async () => {
    api.serveProcesses(processesFixture([processFixture()], { total: 1 }))
    renderPage()

    expect(await screen.findByText('1 processo')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).toBeNull()
  })

  /**
   * **Uma pagina de 50, e nao de 200** (`H-84`). O tamanho virou estado de URL,
   * e estes casos pedem o menor que ainda pagina: o que eles exercitam e a
   * navegacao, nunca a montagem.
   *
   * Medido em 04/09/2026, com `PAGE_SIZE` ainda fixo em 200: os tres custavam
   * 494 ms, 366 ms e 177 ms com a maquina livre, e 2.542 ms, 900 ms e 1.359 ms
   * sob carga — 5,1x, 2,5x e 7,7x. Era montagem, e nao espera: `desabilita
   * Anterior` nao navega nem aguarda nada, e era justamente o que mais
   * degradava. `PD-10` no `CLAUDE.md`.
   */
  function paginaPequena() {
    window.history.replaceState(null, '', '/operacional?limit=50')
    const items = Array.from({ length: 50 }, (_, index) => processFixture({ ref: `FT${index}.26` }))
    api.serveProcesses(processesFixture(items, { total: 649 }))
    renderPage()
  }

  /** Escopada a navegacao: consulta por papel na pagina inteira calcula o nome
      acessivel de cada botao de celula antes de achar "Próxima". */
  async function paginacao() {
    return within(await screen.findByRole('navigation', { name: 'Paginação' }))
  }

  it('mostra a faixa e o total do conjunto filtrado inteiro', async () => {
    paginaPequena()

    expect(await screen.findByText('1–50 de 649')).toBeTruthy()
  })

  it('avanca e volta a pagina', async () => {
    paginaPequena()

    fireEvent.click((await paginacao()).getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(lastProcessCall()).toContain('offset=50'))

    fireEvent.click((await paginacao()).getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(window.location.search).not.toContain('offset'))
  })

  it('desabilita Anterior na primeira pagina', async () => {
    paginaPequena()

    const anterior = (await paginacao()).getByRole('button', { name: 'Anterior' })

    expect(anterior.hasAttribute('disabled')).toBe(true)
  })

  /** Manter o offset mostraria a pagina 4 de um conjunto que agora tem duas. */
  it('mudar a busca volta para a primeira pagina', async () => {
    window.history.replaceState(null, '', '/operacional?offset=400')
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(screen.getByLabelText(/Buscar em qualquer campo de texto/), {
      target: { value: 'X' },
    })

    expect(window.location.search).not.toContain('offset')
  })
})

describe('tamanho de pagina — H-84', () => {
  const seletor = () => screen.getByLabelText('Linhas por página') as HTMLSelectElement

  it('oferece os quatro tamanhos, com 200 marcado por padrao', async () => {
    renderPage()
    await screen.findByRole('grid')

    const rotulos = within(seletor())
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)

    expect(rotulos).toEqual(['50', '100', '200', '500'])
    expect(seletor().value).toBe('200')
  })

  it('escolher um tamanho grava na URL e envia a rota', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(seletor(), { target: { value: '50' } })

    await waitFor(() => expect(lastProcessCall()).toContain('limit=50'))
    expect(window.location.search).toContain('limit=50')
  })

  /** Sair da pagina 9 de 50 para 500 por pagina apontaria para um lugar que
      nao existe mais. */
  it('trocar o tamanho volta para a primeira pagina', async () => {
    window.history.replaceState(null, '', '/operacional?limit=50&offset=400')
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(seletor(), { target: { value: '100' } })

    await waitFor(() => expect(lastProcessCall()).toContain('offset=0'))
    expect(window.location.search).not.toContain('offset')
  })

  /**
   * Mesma tolerancia de `sort` e de `offset`: valor ruim vira o padrao, e nao
   * erro. **`300` entra na lista de proposito** — a rota o aceitaria, porque
   * `MAX_LIMIT` e 1000, e quem o recusa e o seletor, que tem quatro valores e
   * precisa conseguir desenhar o que a URL pede.
   */
  it.each(['0', '-1', 'abc', '1001', '300'])('limit=%s cai no padrao', async (cru) => {
    window.history.replaceState(null, '', `/operacional?limit=${cru}`)
    renderPage()

    await waitFor(() => expect(lastProcessCall()).toContain('limit=200'))
    expect(seletor().value).toBe('200')
  })

  /** A fila e do SERVIDOR, e a tabela so reapresenta: trocar o tamanho e uma
      consulta, e nenhuma consulta escreve. */
  it('trocar o tamanho nao mexe na fila de edicoes', async () => {
    api.serveProcesses(processesFixture([processFixture({ hasPendingEdits: true })], { total: 1 }))
    renderPage()
    await screen.findByRole('grid')

    fireEvent.change(seletor(), { target: { value: '50' } })

    await waitFor(() => expect(lastProcessCall()).toContain('limit=50'))
    expect(api.calls.filter((chamada) => !chamada.startsWith('GET '))).toEqual([])
    expect(screen.getByTitle('Tem edições pendentes de aplicação')).toBeTruthy()
  })
})

describe('calendario de chegadas', () => {
  it('agrupa por dia e por navio, com o total do dia vindo do servidor', async () => {
    api.serveIndicators({
      ...indicatorsFixture(),
      arrivalCalendar: [
        {
          eta2: '2026-08-13',
          processCount: 7,
          vessels: [
            {
              vesselKey: 'CMA CGM COBALT',
              vesselLabel: 'CMA CGM COBALT',
              eta2: '2026-08-13',
              processCount: 2,
            },
            {
              vesselKey: 'EVER LEADER',
              vesselLabel: 'EVER LEADER',
              eta2: '2026-08-13',
              processCount: 4,
            },
            {
              vesselKey: 'EVER UTILE',
              vesselLabel: 'EVER UTILE',
              eta2: '2026-08-13',
              processCount: 1,
            },
          ],
        },
      ],
    })
    renderPage()

    const calendario = await screen.findByRole('region', { name: 'Calendário de chegadas' })
    expect(within(calendario).getByText('13/08/2026')).toBeTruthy()
    // Idem: a contagem ganhou `<span>` próprio para o mono (`H-61`).
    expect(calendario.textContent).toContain('7 processos')
    expect(within(calendario).getByText('EVER LEADER')).toBeTruthy()
  })

  it('sem chegada prevista, explica em vez de mostrar caixa vazia', async () => {
    renderPage()

    const calendario = await screen.findByRole('region', { name: 'Calendário de chegadas' })
    expect(within(calendario).getByText(/Nenhuma chegada prevista/)).toBeTruthy()
  })
})

describe('estados que nao sao lista vazia', () => {
  it('sem leitura concluida, explica que vazio nao e zero processos', async () => {
    api.processesWithoutRead()
    renderPage()

    // `H-44`: o bloco visível é `aria-hidden`, e quem anuncia é a região viva
    // da casca — um nó que já existia, que é o que o leitor de tela compara.
    expect((await findLiveRegion('status')).textContent).toMatch(
      /vazio aqui não significa nenhum processo/,
    )
    expect(screen.getAllByText(/vazio aqui não significa nenhum processo/)).toHaveLength(2)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('falha da rota vira aviso, nao tabela vazia', async () => {
    api.failProcesses()
    renderPage()

    const alerta = await findLiveRegion('alert')
    expect(alerta.textContent).toMatch(/Não foi possível carregar os processos/)
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('filtros globais', () => {
  it('a lista carrega os onze filtros junto dos parametros da pagina', async () => {
    window.history.replaceState(null, '', '/operacional?client=ACME&category=em_andamento')
    renderPage('?client=ACME&category=em_andamento')

    await waitFor(() => {
      expect(lastProcessCall()).toContain('client=ACME')
      expect(lastProcessCall()).toContain('category=em_andamento')
      expect(lastProcessCall()).toContain('limit=200')
    })
  })

  it('o calendario recebe os filtros globais, nao os da pagina', async () => {
    renderPage('?client=ACME')

    await waitFor(() => expect(api.calls).toContain('GET /api/indicators?client=ACME'))
  })
})

/**
 * `H-49`. A coluna Cliente responde "quem e o cliente"; a do lado guarda o
 * valor da celula CLT, que continua sendo como se acha um processo aqui.
 */
describe('cliente consolidado e processo do cliente', () => {
  it('exibe as duas colunas, com o valor de cada uma', async () => {
    api.serveProcesses(
      processesFixture([
        processFixture({ ref: 'FT501.26', client: 'Acme Comércio', clientProcess: 'ACM-29' }),
      ]),
    )
    renderPage()

    await screen.findByRole('grid')
    const colunas = screen.getAllByRole('columnheader').map((th) => th.textContent)

    expect(colunas.some((texto) => texto?.includes('Cliente'))).toBe(true)
    expect(colunas.some((texto) => texto?.includes('Processo do cliente'))).toBe(true)
    expect(screen.getByText('Acme Comércio')).toBeTruthy()
    expect(screen.getByText('ACM-29')).toBeTruthy()
  })
})

/**
 * `H-61`, `D-22`. Densidade e número na tabela de processos.
 *
 * A linha tinha altura por consequência do `py-2` — ela crescia com o conteúdo
 * mais alto, e a tabela perdia o ritmo vertical. Passou a ter altura declarada
 * em unidade **relativa**, que é o que a faz acompanhar quem amplia (`SC 1.4.4`).
 */
describe('densidade e número na tabela (H-61)', () => {
  it('declara a altura da linha em unidade relativa, e não em pixel', async () => {
    api.serveProcesses(processesFixture())
    renderPage()

    const linhas = await screen.findAllByRole('row')
    const corpo = linhas.filter((linha) => linha.closest('tbody') !== null)

    expect(corpo.length).toBeGreaterThan(0)
    // `h-10` são 2.5rem — 40 px na fonte-base padrão, e relativo a ela.
    for (const linha of corpo) expect(linha.className).toContain('h-10')
  })

  /**
   * **Sem faixa alternada.** Já era verdade quando `H-61` começou, e a asserção
   * existe para que não volte: o realce da linha é o cursor, não a paridade.
   */
  it('não usa faixa alternada em nenhuma linha', async () => {
    api.serveProcesses(processesFixture())
    renderPage()

    const linhas = await screen.findAllByRole('row')

    for (const linha of linhas) {
      expect(linha.className).not.toMatch(/\b(odd|even):/)
      expect(linha.className).not.toMatch(/\bnth-/)
    }
  })

  /**
   * REF e data em mono com `tabular-nums`: sem largura fixa de dígito, as datas
   * de linhas vizinhas não se alinham e a coluna deixa de ser comparável.
   */
  it('serve REF e data em mono, com dígito de largura fixa', async () => {
    api.serveProcesses(processesFixture())
    renderPage()

    const primeira = (await screen.findAllByRole('row')).find(
      (linha) => linha.closest('tbody') !== null,
    ) as HTMLElement
    const celulas = [...primeira.querySelectorAll('td')]

    // A primeira célula é a REF; a de ETA2 é a que traz `tabular-nums`.
    expect(celulas[0]?.className).toContain('font-mono')
    const data = celulas.find((celula) => celula.className.includes('tabular-nums'))
    expect(data?.className).toContain('font-mono')
  })

  /**
   * **`H-61` fixou a família e nunca fixou o corpo**, e o conjunto divergiu por
   * isso: as cinco colunas de código nasceram `text-xs` e as quatro de texto
   * livre ficaram nos `text-sm` da tabela — 12 px contra 14 px na mesma linha,
   * desalinhando opticamente a REF e o importador na mesma linha. Achado do usuário em
   * 04/09/2026, olhando a tela, em duas passadas: a primeira pegou a REF, que
   * era uma terceira combinação (mono em 14 px), e a segunda o degrau restante.
   *
   * **A asserção é a regra inteira, e por isso mira a ausência:** nenhuma
   * célula declara tamanho, todas herdam os 14 px da `<table>`, e o que separa
   * código de texto livre é só a forma da letra. Cobrar um valor deixaria
   * passar a próxima coluna que nascesse com outro; cobrar a ausência não.
   *
   * Vale para o `<td>`, e não para os filhos: o chip de canal, o marcador de
   * edição pendente e a seta de ordenação são adornos, e `text-xs` neles é
   * deliberado.
   */
  it('nenhuma célula declara tamanho de fonte — todas herdam da tabela', async () => {
    api.serveProcesses(processesFixture())
    renderPage()

    const primeira = (await screen.findAllByRole('row')).find(
      (linha) => linha.closest('tbody') !== null,
    ) as HTMLElement
    const celulas = [...primeira.querySelectorAll('td')]
    const comTamanho = celulas.filter((celula) =>
      /\btext-(xs|sm|base|lg|xl|\[)/.test(celula.className),
    )

    expect(celulas.length).toBe(9)
    expect(comTamanho.map((celula) => celula.className)).toEqual([])
  })

  /**
   * O caso-limite da história: **a linha não cresce nem corta em silêncio.**
   * Medido em Chrome 151 antes da correção: a célula de Categoria quebrava em
   * seis retângulos de texto — o rótulo mais o chip de canal não cabiam juntos —
   * e esticava a linha de 40 para **57 px**. Texto livre passou a truncar com o
   * valor completo no `title`; valor curto usa `nowrap` e alarga a coluna, que a
   * tabela já sabe rolar (`R01`).
   */
  it('trunca o texto livre guardando o valor completo, e não quebra o curto', async () => {
    const base = processesFixture()
    const longo = 'IMPORTADORA COM RAZAO SOCIAL DEMASIADAMENTE EXTENSA LTDA ME'
    api.serveProcesses({
      ...base,
      items: [{ ...(base.items[0] as (typeof base.items)[number]), importer: longo }],
    })
    renderPage()

    const celula = await screen.findByTitle(longo)

    expect(celula.className).toContain('truncate')
    expect(celula.className).toMatch(/max-w-/)
    // A categoria e o chip ficam na mesma linha, custe largura à coluna.
    const categoria = (await screen.findAllByRole('row'))
      .filter((linha) => linha.closest('tbody') !== null)
      .flatMap((linha) => [...linha.querySelectorAll('td')])
      .at(-1)
    expect(categoria?.className).toContain('whitespace-nowrap')
  })

  /**
   * O chip de canal é **pílula preenchida com rótulo escrito**, e essa é a
   * única exceção aos dois raios. A forma o separa da severidade sem depender
   * de matiz — regra inviolável 4: canal é dado, severidade é gravidade.
   */
  it('serve o canal como pílula com rótulo escrito, não só como cor', async () => {
    const base = processesFixture()
    api.serveProcesses({
      ...base,
      items: [{ ...(base.items[0] as (typeof base.items)[number]), customsChannel: 'vermelho' }],
    })
    renderPage()

    const chip = await screen.findByText('Canal Vermelho')

    expect(chip.className).toContain('rounded-full')
    expect(chip.className).toContain('bg-channel-red-bg')
  })

  /**
   * `H-76`, `ACHADO 12`. O teto da celula de texto livre, e o que ele resolve.
   *
   * Medido contra a planilha real: dos **3591** valores das seis colunas
   * servidas por `<Text>`, **81 eram cortados** com o teto de `max-w-48` — 168
   * px de orcamento —, e **80 estavam em Navio**, cujo maior valor mede 196 px.
   * Com `max-w-56` sao 200 px de orcamento, e o corte vai a **zero**.
   *
   * **`truncate` fica.** Ele traz `white-space: nowrap`, e e ele que segura os
   * 40 px de `H-61`: trocar por `break-words` deixaria a linha crescer.
   */
  it('dá teto à célula de texto livre sem soltar o truncamento', async () => {
    renderPage()

    const linhas = await screen.findAllByRole('row')
    const celulas = linhas
      .filter((linha) => linha.closest('tbody') !== null)
      .flatMap((linha) => [...linha.querySelectorAll('td')])
      .filter((celula) => celula.className.includes('max-w-'))

    expect(celulas.length).toBeGreaterThan(0)
    for (const celula of celulas) {
      expect(celula.className).toContain('max-w-56')
      expect(celula.className).toContain('truncate')
    }
    // O valor que ainda nao couber continua inteiro em `title`.
    const comValor = celulas.filter((celula) => (celula.textContent ?? '') !== '—')
    expect(comValor.length).toBeGreaterThan(0)
    for (const celula of comValor) expect(celula.getAttribute('title')).toBe(celula.textContent)
  })

  /**
   * `H-75`, `ACHADO 7`, falha `F31`. Abrir o detalhe e a MESMA acao na tabela e
   * na fila de alertas, e os dois nomes acessiveis eram diferentes — a REF
   * sozinha aqui, "Abrir o detalhe de REF" la. O nome novo CONTEM o texto
   * visivel, que e o que `SC 2.5.3` exige.
   */
  it('nomeia a ação de abrir o detalhe como a fila de alertas', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Abrir o detalhe de FT501.26' })

    expect(link.textContent).toBe('FT501.26')
    expect(link.getAttribute('aria-label')).toContain(link.textContent)
  })

  /**
   * `H-64`. A linha e o unico realce sob cursor da pagina, e o papel de
   * movimento acompanha o `hover:` que ja existia. O que a duracao vale, e que
   * ela cai sob reducao, e do CSS — `tests/repo/estilo.test.ts` cobra la.
   */
  it('a linha nomeia o papel de movimento junto do realce', async () => {
    renderPage()

    const linhas = await screen.findAllByRole('row')
    const corpo = linhas.filter((linha) => linha.closest('tbody') !== null)

    expect(corpo.length).toBeGreaterThan(0)
    for (const linha of corpo) {
      expect(linha.className).toContain('hover:bg-surface-hover')
      expect(linha.className).toContain('motion-tint')
    }
  })
})

/**
 * A edição na própria célula, sem abrir o detalhe (02/09/2026).
 *
 * **Nada aqui grava no `.xlsx`.** A célula enfileira pela porta de `H-23`, e o
 * valor volta à tela pela projeção do servidor — a mesma que a tabela já lia.
 * O que estes casos protegem é o par campo/valor que chega à rota: errar o
 * campo grava numa coluna que o operador não estava olhando.
 */
describe('edição na célula', () => {
  function celula(nome: RegExp): HTMLElement {
    return screen.getByRole('button', { name: nome })
  }

  it('abre o campo com o valor atual da célula', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar BL de FT501\.26/))

    expect(
      (screen.getByRole('textbox', { name: 'BL de FT501.26' }) as HTMLInputElement).value,
    ).toBe('NBSC260812')
  })

  it('Enter enfileira o CAMPO da coluna, e não o rótulo dela', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar Navio de FT501\.26/))
    const campo = screen.getByRole('textbox', { name: 'Navio de FT501.26' })
    fireEvent.change(campo, { target: { value: 'KOTA ELOK' } })
    fireEvent.keyDown(campo, { key: 'Enter' })

    await waitFor(() => expect(api.calls).toContain('POST /api/edits'))
    expect(api.editBodies).toEqual([{ ref: 'FT501.26', field: 'vesselRaw', value: 'KOTA ELOK' }])
  })

  /** O cancelamento tira o foco, e tirar o foco grava. Sem a marca de
      cancelamento, Escape enfileiraria o que acabou de ser desfeito. */
  it('Escape sai sem enfileirar, mesmo com o blur que ele provoca', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar Importador de FT501\.26/))
    const campo = screen.getByRole('textbox', { name: 'Importador de FT501.26' })
    fireEvent.change(campo, { target: { value: 'OUTRO' } })
    fireEvent.keyDown(campo, { key: 'Escape' })
    fireEvent.blur(campo)

    expect(api.editBodies).toEqual([])
    expect(screen.getByRole('button', { name: /^Editar Importador de FT501\.26/ })).toBeTruthy()
  })

  it('não enfileira quando o valor não mudou', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar BL de FT501\.26/))
    fireEvent.blur(screen.getByRole('textbox', { name: 'BL de FT501.26' }))

    expect(api.editBodies).toEqual([])
  })

  /** Data vazia é **célula vazia**, e não "não mexer": é assim que o operador
      limpa uma data (`H-23`). */
  it('data esvaziada vai como null, e não como string vazia', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar ETA2 de FT501\.26/))
    const campo = screen.getByLabelText('ETA2 de FT501.26')
    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.keyDown(campo, { key: 'Enter' })

    await waitFor(() =>
      expect(api.editBodies).toEqual([{ ref: 'FT501.26', field: 'eta2', value: null }]),
    )
  })

  /** Quem valida é `src/domain/editable-fields.ts`, e a mensagem que aparece é
      a dele: uma segunda tabela de regras no cliente divergiria da primeira. */
  it('mostra na própria célula a recusa do servidor, e continua em edição', async () => {
    api.failEnqueueEdit('Valor acima do limite da coluna.')
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar CNTR de FT501\.26/))
    const campo = screen.getByRole('textbox', { name: 'CNTR de FT501.26' })
    fireEvent.change(campo, { target: { value: 'X'.repeat(300) } })
    fireEvent.keyDown(campo, { key: 'Enter' })

    expect(await screen.findByText('Valor acima do limite da coluna.')).toBeTruthy()
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect((await findLiveRegion('alert')).textContent).toContain('Valor acima do limite')
  })

  /**
   * As duas colunas que não têm porta. Categoria sai de cinco regras das quais
   * só uma lê a célula L (`A-22`), e REF é a chave natural — abrir edição em
   * qualquer uma gravaria numa célula que não está à vista.
   */
  it('não oferece edição em Categoria nem REF', async () => {
    renderPage()
    await screen.findByRole('grid')

    for (const rotulo of [/^Editar Categoria de/, /^Editar REF de/]) {
      expect(screen.queryByRole('button', { name: rotulo })).toBeNull()
    }
    // E o valor derivado continua na tela, só que sem porta de edição.
    expect(screen.getByText('Em andamento')).toBeTruthy()
  })

  /**
   * Cliente **é** editável, e por outra porta: ela não é célula da planilha, e
   * sim a regra de consolidação de `client-map.json` — a mesma de onde a coluna
   * já lia (`H-49`). Enfileirar seria gravar na célula B, que é o que a coluna
   * ao lado faz.
   */
  it('Cliente vai para a rota do client-map, e não para a fila', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.click(celula(/^Editar Cliente de FT501\.26/))
    const campo = screen.getByRole('textbox', { name: 'Cliente de FT501.26' })
    fireEvent.change(campo, { target: { value: 'Acme Comércio' } })
    fireEvent.keyDown(campo, { key: 'Enter' })

    await waitFor(() => expect(api.calls).toContain('PUT /api/processes/FT501.26/client'))
    expect(api.editBodies).toEqual([])
  })
})

/**
 * A tabela como **grade** (02/09/2026), no padrão `grid` da WAI-ARIA.
 *
 * O que estes casos protegem é a contagem de paradas de tabulação. Medido num
 * Chrome real antes da grade: 7 por linha — o link da REF mais as seis células
 * editáveis —, e a paginação vem depois da tabela no DOM. Numa página cheia de
 * 200 linhas eram ~1.400 paradas até o botão "Próxima".
 */
describe('navegação por grade', () => {
  function celulas(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[data-grid-row]')]
  }

  function celulaEm(row: number, column: number): HTMLElement {
    const alvo = celulas().find(
      (no) => no.dataset.gridRow === String(row) && no.dataset.gridColumn === String(column),
    )
    if (alvo === undefined) throw new Error(`célula ${row},${column} não existe`)
    return alvo
  }

  it('deixa UMA parada de tabulação na tabela inteira', async () => {
    api.serveProcesses(
      processesFixture([processFixture(), processFixture({ ref: 'FT502.26' })], { total: 2 }),
    )
    renderPage()
    await screen.findByRole('grid')

    const tabulaveis = celulas().filter((no) => no.getAttribute('tabindex') === '0')
    expect(tabulaveis).toHaveLength(1)
    // 2 linhas × 9 colunas + o cabeçalho: 27 células, 26 fora da ordem.
    expect(celulas().filter((no) => no.getAttribute('tabindex') === '-1')).toHaveLength(26)
  })

  /** Os controles DENTRO das células saem da ordem: quem tabula é a grade. */
  it('tira da tabulação o link da REF, os botões de edição e os de ordenação', async () => {
    renderPage()
    await screen.findByRole('grid')

    const internos = [
      ...document.querySelectorAll<HTMLElement>('[data-grid-row] button, [data-grid-row] a'),
    ]
    expect(internos.length).toBeGreaterThan(9)
    for (const controle of internos) expect(controle.getAttribute('tabindex')).toBe('-1')
  })

  it('as setas movem a célula corrente', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.keyDown(celulaEm(0, 0), { key: 'ArrowRight' })
    expect(celulaEm(0, 1).getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(celulaEm(0, 1), { key: 'ArrowDown' })
    expect(celulaEm(1, 1).getAttribute('tabindex')).toBe('0')

    // O canto não escapa: seta para cima na linha 0 fica na linha 0.
    fireEvent.keyDown(celulaEm(1, 1), { key: 'ArrowUp' })
    fireEvent.keyDown(celulaEm(0, 1), { key: 'ArrowUp' })
    expect(celulaEm(0, 1).getAttribute('tabindex')).toBe('0')
  })

  it('Ctrl+End vai para a última célula, e Ctrl+Home volta para a primeira', async () => {
    api.serveProcesses(
      processesFixture([processFixture(), processFixture({ ref: 'FT502.26' })], { total: 2 }),
    )
    renderPage()
    await screen.findByRole('grid')

    fireEvent.keyDown(celulaEm(0, 0), { key: 'End', ctrlKey: true })
    expect(celulaEm(2, 8).getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(celulaEm(2, 8), { key: 'Home', ctrlKey: true })
    expect(celulaEm(0, 0).getAttribute('tabindex')).toBe('0')
  })

  /** A ordenação continua alcançável por teclado, agora pela grade. */
  it('Enter sobre a célula do cabeçalho ordena', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.keyDown(celulaEm(0, 0), { key: 'Enter' })

    await waitFor(() => expect(lastProcessCall()).toContain('sort=ref'))
  })

  it('Enter sobre a célula editável abre o campo', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.keyDown(celulaEm(1, 6), { key: 'Enter' })

    expect(screen.getByRole('textbox', { name: 'BL de FT501.26' })).toBeTruthy()
  })

  /**
   * O campo desmonta ao sair da edição, e sem devolver o foco ele cairia no
   * `<body>` — a falha `SC 2.4.3` que `VN-4` mediu na outra ponta. Numa grade o
   * efeito é pior: o operador perde a posição e recomeça do cabeçalho.
   */
  it('devolve o foco à célula ao cancelar a edição', async () => {
    renderPage()
    await screen.findByRole('grid')

    fireEvent.keyDown(celulaEm(1, 6), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'BL de FT501.26' }), { key: 'Escape' })

    await waitFor(() => expect(document.activeElement).toBe(celulaEm(1, 6)))
  })

  /** Dentro do campo as setas pertencem ao TEXTO, não à grade. */
  it('não move a célula enquanto o campo está aberto', async () => {
    renderPage()
    await screen.findByRole('grid')

    // O foco é o que torna a célula a corrente — no navegador ele chega pelo
    // clique ou pela seta; `fireEvent.keyDown` sozinho não foca nada.
    celulaEm(1, 6).focus()
    fireEvent.keyDown(celulaEm(1, 6), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'BL de FT501.26' }), {
      key: 'ArrowRight',
    })

    expect(celulaEm(1, 6).getAttribute('tabindex')).toBe('0')
  })
})
