import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { PAGE_LIVE_REGION_ID } from '../src/components/PageAlert.tsx'
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

/**
 * `H-72`. Sob `forced-colors: active` o agente de usuário pinta
 * `border-transparent` como pinta qualquer outra borda, e `VN-5` mediu as
 * **sete** abas com uma assinatura só — `2px solid rgb(255,255,0)` em todas.
 * Restava o `aria-current`, que serve o leitor de tela e não serve quem
 * enxerga.
 *
 * O canal novo é a **espessura**, a mesma técnica que `H-44` usou no botão de
 * janela e que `VN-5` mediu sobrevivendo. **jsdom não emula `forced-colors`**:
 * o que se afirma aqui é a variante declarada. Medido em Chrome 151 ao fechar:
 * sob o modo forçado a corrente fica em 4 px contra 2 px das outras seis, com
 * a linha de base do texto igual dentro de cada linha do wrap, e o modo normal
 * fica byte a byte como era.
 */
describe('a aba corrente sob alto contraste', () => {
  function abas() {
    render(<App />)
    return within(nav()).getAllByRole('link')
  }

  it('dá à aba corrente uma espessura que a substituição de paleta não apaga', () => {
    const corrente = abas().find((aba) => aba.getAttribute('aria-current') === 'page')

    expect(corrente?.className).toContain('forced-colors:border-b-4')
  })

  /**
   * O canal só distingue se for exclusivo da corrente. As outras seis ficam nos
   * 2 px que o UA já pinta — é a diferença entre as duas espessuras que carrega
   * a informação.
   */
  it('não dá a espessura a nenhuma das outras seis', () => {
    const outras = abas().filter((aba) => aba.getAttribute('aria-current') !== 'page')

    expect(outras).toHaveLength(NAV_PAGES.length - 1)
    for (const aba of outras) expect(aba.className).not.toContain('forced-colors:border-b-4')
  })

  /**
   * O terceiro critério de aceite: o canal novo **se soma** ao eixo programático,
   * nunca o substitui. Uma aba corrente, e só uma, entre as sete de `NAV_PAGES`
   * — `Configuração` nasceu em `H-38` e conta.
   */
  it('mantém o aria-current, em exatamente uma das sete', () => {
    const correntes = abas().filter((aba) => aba.getAttribute('aria-current') === 'page')

    expect(correntes).toHaveLength(1)
    expect(NAV_PAGES).toHaveLength(7)
  })

  /**
   * O segundo critério: a barra não regride no modo normal. A compensação de
   * `padding` viaja na MESMA variante da borda, então nada dela incide fora do
   * modo forçado — sem isso a linha de base do texto se mexeria sempre.
   */
  it('não mexe no modo normal: a compensação é condicionada junto com a borda', () => {
    const corrente = abas().find((aba) => aba.getAttribute('aria-current') === 'page')

    expect(corrente?.className).toContain('forced-colors:pb-1.5')
    expect(corrente?.className).toContain('py-2')
    expect(corrente?.className).not.toMatch(/(^|\s)pb-1\.5/)
  })
})

describe('faixa de estado', () => {
  it('avisa de dado congelado em pagina que nao a inicial (A-57)', async () => {
    api.serve(healthFixture({ state: 'degradado', degradedReason: 'Arquivo em uso.' }))
    window.history.replaceState(null, '', '/performance')
    render(<App />)

    expect(await screen.findByText(/Arquivo em uso/)).toBeTruthy()
  })

  /**
   * `H-43` trocou a forma sem trocar o que se defende: as regiões vivas existem
   * desde a montagem — sem isso o leitor de tela não anuncia nada —, e o que não
   * pode aparecer é **texto** de faixa, não o nó.
   */
  it('nao exibe faixa nenhuma com o estado pronto', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    for (const regiao of [...screen.queryAllByRole('alert'), ...screen.queryAllByRole('status')]) {
      expect(regiao.textContent).toBe('')
    }
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

/**
 * `H-43`. As regiões vivas existem no DOM antes de receberem mensagem.
 *
 * A MDN é explícita: *"Do not try to dynamically add/generate an element with
 * `role='alert'` that is already populated"*. O nó nasce com o texto dentro, o
 * leitor de tela não tem o que comparar, e a mensagem **não é anunciada** — era
 * o mesmo padrão repetido em 23 pontos da aplicação (`ACHADO 11`).
 */
describe('as regiões vivas da casca', () => {
  it('escreve no MESMO nó que já estava no DOM quando healthError aparece', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    // Todas as regiões vivas, vazias, antes de qualquer falha.
    const antes = screen.getAllByRole('alert')
    expect(antes.length).toBeGreaterThan(0)
    for (const regiao of antes) expect(regiao.textContent).toBe('')

    api.failNextHealth('Failed to fetch')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const texto = await screen.findByText(/Sem contato com o servidor/)

    // O nó que recebeu o texto é UM DOS QUE JÁ ESTAVAM no DOM — mesma
    // referência de objeto. É isso que o leitor de tela compara; um nó novo,
    // nascido já populado, não produz anúncio nenhum.
    const regiaoDoTexto = texto.closest('[role="alert"]')
    expect(antes).toContain(regiaoDoTexto)
  })

  // O caso-limite do backlog: a região montada permanentemente não pode deixar
  // caixa vazia na tela. O critério é ausência de caixa, não ausência do nó.
  it('não deixa borda, fundo nem espaçamento visíveis na região vazia', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    for (const regiao of screen.getAllByRole('alert')) {
      if ((regiao.textContent ?? '').trim() !== '') continue
      const classe = regiao.className
      expect(classe).not.toMatch(/border-y|bg-state|px-6|py-3/)
    }
  })

  /**
   * A região persistente que as sete páginas de `H-44` vão usar.
   *
   * Ela vive na casca porque as páginas fazem `return` antecipado no estado de
   * erro: declarada dentro delas, desmontaria junto com o resto da árvore.
   */
  it('monta a região persistente das páginas, sem conhecer página nenhuma', async () => {
    const { container } = render(<App />)
    await screen.findByText('07/08/2026')

    expect(container.querySelector(`#${PAGE_LIVE_REGION_ID}`)).toBeTruthy()
  })
})
