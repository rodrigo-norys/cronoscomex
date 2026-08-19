import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { NAV_PAGES } from '../src/router.ts'
import { type ApiStub, healthFixture, stubApi } from './support/api-stub.ts'

/**
 * A casca de `H-15`: navegacao entre as sete paginas, a faixa de estado que
 * A-57 exige em todas elas, e o botao de A-62.
 *
 * As paginas em si chegaram de `H-16` a `H-22`; aqui o que se verifica e que a
 * casca hospeda cada uma na rota certa, e nao o conteudo delas.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  api = stubApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function nav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Páginas' })
}

describe('casca', () => {
  /**
   * A contagem sai de `NAV_PAGES`, e nao de um numero escrito aqui: o menu
   * passou de seis para sete itens em `H-38`, e um literal so avisaria disso
   * reprovando — sem dizer se a pagina nova entrou ou se outra sumiu.
   */
  it('monta o cabecalho e todas as paginas do menu', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'CronosComex' })).toBeTruthy()
    expect(within(nav()).getAllByRole('link')).toHaveLength(NAV_PAGES.length)
    expect(await screen.findByText('07/08/2026')).toBeTruthy()
  })

  /**
   * H-38. A tela de `H-34` existia desde 18/08/2026 e nao havia como chegar
   * nela: nenhuma linha de `web/src/` apontava para `/configuracao`, e o unico
   * acesso era digitar o endereco. Depois de apontar a planilha uma vez, o
   * operador PERDIA a tela — e a troca, que ja funcionava, ficava inalcancavel.
   */
  describe('os tres caminhos ate a configuracao', () => {
    it('leva a configuracao pelo menu', async () => {
      render(<App />)

      const item = within(nav()).getByRole('link', { name: 'Configuração' })
      fireEvent.click(item)

      expect(await screen.findByRole('region', { name: /Configuração da planilha/i })).toBeTruthy()
    })

    it('marca a pagina corrente tambem no item novo', async () => {
      window.history.replaceState(null, '', '/configuracao')
      render(<App />)

      expect(within(nav()).getByRole('link', { current: 'page' }).textContent).toBe('Configuração')
    })

    it('leva a configuracao pelo painel de saude', async () => {
      render(<App />)

      const link = await screen.findByRole('link', { name: /a planilha configurada/i })
      fireEvent.click(link)

      expect(await screen.findByRole('region', { name: /Configuração da planilha/i })).toBeTruthy()
    })

    /**
     * O momento em que o caminho mais importa: a planilha nao pode ser lida, e o
     * conserto quase sempre e apontar o arquivo certo.
     */
    it('leva a configuracao pela faixa de estado degradado', async () => {
      api.serve(
        healthFixture({
          state: 'degradado',
          degradedReason: 'A planilha nao pode ser lida.',
          lastReadAt: '2026-08-07T10:00:00.000Z',
        }),
      )
      render(<App />)

      const botao = await screen.findByRole('button', { name: /conferir a planilha configurada/i })
      fireEvent.click(botao)

      expect(await screen.findByRole('region', { name: /Configuração da planilha/i })).toBeTruthy()
    })

    /** Nao e uma visao do dado: um recorte ali nao teria sobre o que incidir. */
    it('nao mostra a barra de filtros na configuracao', async () => {
      window.history.replaceState(null, '', '/configuracao')
      render(<App />)
      await screen.findByRole('region', { name: /Configuração da planilha/i })

      expect(screen.queryByRole('region', { name: /filtros/i })).toBeNull()
    })

    /** Na primeira execucao o menu segue escondido: seriam seis paginas vazias. */
    it('nao mostra o menu na primeira execucao', async () => {
      api.serve(healthFixture({ state: 'degradado', lastReadAt: null, workbookPath: '' }))
      render(<App />)
      await screen.findByRole('region', { name: /Configuração da planilha/i })

      expect(screen.queryByRole('navigation', { name: 'Páginas' })).toBeNull()
    })
  })

  it('marca a pagina corrente para o leitor de tela', () => {
    render(<App />)

    expect(within(nav()).getByRole('link', { current: 'page' }).textContent).toBe('Início')
  })

  it('hospeda a Pagina Inicial, entregue por H-16', async () => {
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Cartões-resumo' })).toBeTruthy()
  })

  /**
   * `H-21` fechou a ultima pagina do menu, e nao sobrou marcador nenhum para
   * esta assercao usar de exemplo. Quem cobre o caminho do `PendingPage` a
   * partir daqui e `paginas-montadas.test.tsx`, cruzando o backlog com o
   * `story:` de cada rota — sem lista fixa, e sem depender de haver pendente.
   *
   * **E o unico ponto da suite que paga o import dinamico.** A Pagina Historico
   * e a unica carregada com `lazy`, desde que o pacote foi dividido para tirar o
   * Recharts do carregamento inicial; os outros dois `findByRole` da mesma
   * regiao, em `navegacao`, encontram o modulo ja resolvido por este — e por
   * isso seguem no timeout padrao.
   *
   * Os 1000 ms padrao ficaram na fronteira: medido em 1103-1150 ms com a
   * maquina sob carga, contra ~200 ms sem. Descoberto ao percorrer os commits
   * de `H-30` com o portao em sequencia — tres reprovaram aqui, e nenhum deles
   * tocava `web/`.
   */
  it('hospeda a Pagina Historico, entregue por H-21', async () => {
    window.history.replaceState(null, '', '/historico')
    render(<App />)

    const secao = await screen.findByRole('region', { name: 'Evolução mensal' }, { timeout: 5000 })

    expect(secao).toBeTruthy()
  })

  it('hospeda a Pagina Operacional, entregue por H-17', async () => {
    window.history.replaceState(null, '', '/operacional')
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Calendário de chegadas' })).toBeTruthy()
  })

  it('hospeda a Pagina Clientes, entregue por H-18', async () => {
    window.history.replaceState(null, '', '/clientes')
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Mercadorias' })).toBeTruthy()
  })
})

describe('navegacao', () => {
  it('troca de pagina sem recarregar, preservando os filtros da query', async () => {
    window.history.replaceState(null, '', '/?client=ACME')
    render(<App />)

    fireEvent.click(within(nav()).getByRole('link', { name: 'Histórico' }))

    expect(window.location.pathname).toBe('/historico')
    expect(window.location.search).toBe('?client=ACME')
    expect(await screen.findByRole('region', { name: 'Evolução mensal' })).toBeTruthy()
  })

  it('responde ao botao voltar do navegador', async () => {
    render(<App />)
    fireEvent.click(within(nav()).getByRole('link', { name: 'Histórico' }))
    expect(await screen.findByRole('region', { name: 'Evolução mensal' })).toBeTruthy()

    window.history.back()

    await waitFor(() => expect(screen.getByRole('region', { name: 'Cartões-resumo' })).toBeTruthy())
  })

  it('hospeda o detalhe do processo, rota fora do menu (H-22)', async () => {
    window.history.replaceState(null, '', '/processo/CRO-2026-001')
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Identificação' })).toBeTruthy()
  })

  /**
   * O criterio de aceite de `H-34`: sem leitura nenhuma, a casca abre na tela de
   * configuracao — e nao num painel de zeros, que afirmaria que a planilha tem
   * zero processos (regra inviolavel 3). O gatilho e 'degradado' MAIS
   * `lastReadAt` nulo, a distincao que `H-08` ja fazia entre dado congelado e
   * ausencia de dado.
   */
  it('desvia para a configuracao quando nunca houve leitura', async () => {
    api.serve(healthFixture({ state: 'degradado', lastReadAt: null, workbookPath: '' }))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /aponte a planilha para começar/i }),
    ).toBeTruthy()
    // Sem dado nao ha o que recortar nem para onde navegar.
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('nao desvia quando o dado esta apenas congelado', async () => {
    api.serve(
      healthFixture({
        state: 'degradado',
        lastReadAt: '2026-08-18T09:00:00.000Z',
        degradedReason: 'A planilha esta em uso por outro programa.',
      }),
    )

    render(<App />)

    await screen.findByRole('navigation')
    expect(screen.queryByRole('heading', { name: /aponte a planilha para começar/i })).toBeNull()
  })

  it('nao inventa pagina para endereco desconhecido', () => {
    window.history.replaceState(null, '', '/relatorios')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy()
  })
})

describe('faixa de estado', () => {
  it('avisa de dado congelado em pagina que nao a inicial (A-57)', async () => {
    api.serve(healthFixture({ state: 'degradado', degradedReason: 'Arquivo em uso.' }))
    window.history.replaceState(null, '', '/performance')
    render(<App />)

    expect(await screen.findByText(/Arquivo em uso/)).toBeTruthy()
  })

  it('nao exibe faixa nenhuma com o estado pronto', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('avisa quando o servidor nao responde', async () => {
    api.failNextHealth('Failed to fetch')
    render(<App />)

    expect(await screen.findByText(/Sem contato com o servidor/)).toBeTruthy()
  })
})

describe('filtros globais na casca', () => {
  it('a barra vale para as paginas de dado', () => {
    window.history.replaceState(null, '', '/alertas')
    render(<App />)

    expect(screen.getByRole('region', { name: 'Filtros' })).toBeTruthy()
  })

  it('nao aparece no detalhe do processo, que e sobre UM processo', () => {
    window.history.replaceState(null, '', '/processo/CRO-2026-001')
    render(<App />)

    expect(screen.queryByRole('region', { name: 'Filtros' })).toBeNull()
  })

  it('nao aparece em endereco desconhecido, que nao tem dado a filtrar', () => {
    window.history.replaceState(null, '', '/relatorios')
    render(<App />)

    expect(screen.queryByRole('region', { name: 'Filtros' })).toBeNull()
  })

  it('marcar um filtro reflete na URL', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Cliente/ })

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /ACME/ }))

    expect(window.location.search).toBe('?client=ACME')
  })

  it('trocar de pagina preserva o recorte montado', async () => {
    window.history.replaceState(null, '', '/?client=ACME&category=em_andamento')
    render(<App />)

    fireEvent.click(within(nav()).getByRole('link', { name: 'Performance' }))

    expect(window.location.pathname).toBe('/performance')
    expect(window.location.search).toBe('?client=ACME&category=em_andamento')
    expect(await screen.findByText('2 ativos')).toBeTruthy()
  })

  it('limpar zera os filtros sem sair da pagina', async () => {
    window.history.replaceState(null, '', '/alertas?client=ACME')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Limpar' }))

    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/alertas')
  })
})

/**
 * Regressao de um defeito medido: um servidor de versao anterior devolveu o
 * health **sem** `today`, e `undefined.split` derrubou a casca inteira — faixa
 * de estado e navegacao junto. O tipo descreve o contrato, nao a resposta que
 * chegou.
 */
describe('resposta fora do contrato', () => {
  it('campo de dia ausente vira traco, nao tela branca', async () => {
    const { today: _omitido, ...semDia } = healthFixture()
    api.serve(semDia as ReturnType<typeof healthFixture>)
    render(<App />)

    expect(await screen.findByText('—')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'CronosComex' })).toBeTruthy()
    expect(nav()).toBeTruthy()
  })
})

describe('botao de atualizacao (A-62)', () => {
  /**
   * Propriedades, e nao a lista literal: com a Pagina Inicial montada, quatro
   * rotas participam, e a ordem entre elas depende de efeito de filho correr
   * antes do de pai — detalhe do React, nao contrato desta historia. O que a
   * historia garante e o `reload` **preceder** o refazer, e o refazer alcancar
   * as opcoes de filtro e os indicadores: os tres derivam dos dados (A-36), e
   * um cliente novo na planilha precisa aparecer sem recarregar a pagina.
   */
  it('chama POST /api/reload antes de refazer as requisicoes', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await waitFor(() => expect(contar('GET /api/health')).toBe(2))

    const reload = api.calls.indexOf('POST /api/reload')
    expect(reload).toBeGreaterThan(-1)
    expect(api.calls.lastIndexOf('GET /api/health')).toBeGreaterThan(reload)

    await waitFor(() => {
      expect(contar('GET /api/filters/options')).toBe(2)
      expect(contar('GET /api/indicators')).toBe(2)
      expect(contar('GET /api/quarantine')).toBe(2)
    })
    expect(contar('POST /api/reload')).toBe(1)
  })
})

function contar(call: string): number {
  return api.calls.filter((made) => made === call).length
}
