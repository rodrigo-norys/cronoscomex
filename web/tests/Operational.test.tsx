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

/**
 * A Pagina Operacional (RF-10). Nada e ordenado, filtrado ou somado aqui — o
 * servidor entrega a pagina pronta, e reordenar no cliente daria um resultado
 * diferente do que `total` conta.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/operacional')
  api = stubApi()
})

afterEach(() => {
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
        processFixture({ ref: 'FT502.26', client: 'YRD' }),
      ]),
    )
    renderPage()

    expect(await screen.findByRole('link', { name: 'FT501.26' })).toBeTruthy()
    expect(screen.getByText('YRD')).toBeTruthy()
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

    fireEvent.click(await screen.findByRole('link', { name: 'FT501.26' }))

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
    expect(within(calendario).getByText('7 processos')).toBeTruthy()
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

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/vazio aqui não significa nenhum processo/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('falha da rota vira aviso, nao tabela vazia', async () => {
    api.failProcesses()
    renderPage()

    const alerta = await screen.findByRole('alert')
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
