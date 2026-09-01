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

    await screen.findByRole('table')
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
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText(/Buscar por REF, BL ou CNTR/), {
      target: { value: 'NBSC260' },
    })

    expect(window.location.search).toContain('search=NBSC260')
    await waitFor(() => expect(lastProcessCall()).toContain('search=NBSC260'))
  })

  it('limpar a busca remove o parametro, em vez de mandar vazio', async () => {
    window.history.replaceState(null, '', '/operacional?search=NBSC')
    renderPage()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText(/Buscar por REF, BL ou CNTR/), { target: { value: '' } })

    expect(window.location.search).not.toContain('search=')
  })
})

describe('activeOnly — A-16', () => {
  /** O padrao da PAGINA e `true`; o da ROTA e `false`, porque ela serve tambem
   * `H-22`, que precisa achar qualquer processo pela REF. */
  it('parte de activeOnly=true, sem parametro na URL', async () => {
    renderPage()

    await waitFor(() => expect(lastProcessCall()).toContain('activeOnly=true'))
    expect(window.location.search).not.toContain('activeOnly')
  })

  it('marcar "incluir desembaracados" manda false', async () => {
    renderPage()
    await screen.findByRole('table')

    fireEvent.click(screen.getByLabelText('Incluir desembaraçados'))

    await waitFor(() => expect(lastProcessCall()).toContain('activeOnly=false'))
    expect(window.location.search).toContain('activeOnly=false')
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

  it('clicar na mesma coluna alterna a direcao', async () => {
    renderPage()
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('button', { name: /ETA2/ }))
    await waitFor(() => expect(lastProcessCall()).toContain('order=desc'))

    fireEvent.click(screen.getByRole('button', { name: /ETA2/ }))
    await waitFor(() => expect(lastProcessCall()).toContain('order=asc'))
  })

  it('clicar em outra coluna comeca em ascendente', async () => {
    window.history.replaceState(null, '', '/operacional?sort=eta2&order=desc')
    renderPage()
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('button', { name: /REF/ }))

    await waitFor(() => {
      expect(lastProcessCall()).toContain('sort=ref')
      expect(lastProcessCall()).toContain('order=asc')
    })
  })

  it('marca a coluna ordenada para o leitor de tela', async () => {
    renderPage()
    await screen.findByRole('table')

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

  it('mostra a faixa e o total do conjunto filtrado inteiro', async () => {
    const items = Array.from({ length: 200 }, (_, index) =>
      processFixture({ ref: `FT${index}.26` }),
    )
    api.serveProcesses(processesFixture(items, { total: 649 }))
    renderPage()

    expect(await screen.findByText('1–200 de 649')).toBeTruthy()
  })

  it('avanca e volta a pagina', async () => {
    const items = Array.from({ length: 200 }, (_, index) =>
      processFixture({ ref: `FT${index}.26` }),
    )
    api.serveProcesses(processesFixture(items, { total: 649 }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(lastProcessCall()).toContain('offset=200'))

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(window.location.search).not.toContain('offset'))
  })

  it('desabilita Anterior na primeira pagina', async () => {
    const items = Array.from({ length: 200 }, (_, index) =>
      processFixture({ ref: `FT${index}.26` }),
    )
    api.serveProcesses(processesFixture(items, { total: 649 }))
    renderPage()

    expect((await screen.findByRole('button', { name: 'Anterior' })).hasAttribute('disabled')).toBe(
      true,
    )
  })

  /** Manter o offset mostraria a pagina 4 de um conjunto que agora tem duas. */
  it('mudar a busca volta para a primeira pagina', async () => {
    window.history.replaceState(null, '', '/operacional?offset=400')
    renderPage()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText(/Buscar por REF, BL ou CNTR/), {
      target: { value: 'X' },
    })

    expect(window.location.search).not.toContain('offset')
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

    await screen.findByRole('table')
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
