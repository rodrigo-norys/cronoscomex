import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { PAGE_LIVE_REGION_ID } from '../src/components/PageAlert.tsx'
import { NAV_PAGES, WORKBOOK_SETUP_PAGE } from '../src/router.ts'
import { type ApiStub, healthFixture, indicatorsFixture, stubApi } from './support/api-stub.ts'

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

/**
 * Os TRES acessos a `/configuracao` tem o mesmo nome desde `H-75` — e e o
 * ponto do `ACHADO 6`. O que os distingue passou a ser o contexto no DOM, e
 * `findAllByRole` sozinho voltaria com o da lateral, que monta primeiro: os
 * outros dois dependem da resposta de `/api/health`.
 */
async function acessoAConfiguracao(onde: 'lateral' | 'painel' | 'faixa'): Promise<HTMLElement> {
  const dentroDe = (link: HTMLElement): boolean => {
    if (onde === 'lateral') return link.closest('nav') !== null
    if (onde === 'faixa') return link.closest('[role="alert"]') !== null
    return link.closest('nav') === null && link.closest('[role="alert"]') === null
  }

  return waitFor(() => {
    const achado = screen.getAllByRole('link', { name: 'Configuração' }).find(dentroDe)
    if (achado === undefined) throw new Error(`nenhum acesso a configuracao em ${onde}`)
    return achado
  })
}

describe('casca', () => {
  /**
   * A contagem sai de `NAV_PAGES`, e nao de um numero escrito aqui: o menu
   * passou de seis para sete itens em `H-38`, e um literal so avisaria disso
   * reprovando — sem dizer se a pagina nova entrou ou se outra sumiu.
   */
  /**
   * `H-59` trocou o que o `h1` diz. Ele era o nome do PRODUTO, repetido nas
   * sete telas, e passou a ser o nome da PAGINA — que e o que `SC 2.4.6` pede
   * de um cabecalho: descrever o topico. O produto continua visivel, na
   * lateral, onde nao compete com o conteudo por hierarquia.
   */
  it('monta o cabecalho da pagina e todas as paginas do menu', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Início' })).toBeTruthy()
    expect(within(nav()).getByText('CronosComex')).toBeTruthy()
    expect(within(nav()).getAllByRole('link')).toHaveLength(NAV_PAGES.length)
    expect(await screen.findByText('07/08/2026')).toBeTruthy()
  })

  /**
   * `H-64`. Os SETE itens, e nao um: o papel de movimento vive em `ITEM_BASE`,
   * que e o unico trecho comum aos dois ramos — corrente e em repouso. Assertar
   * um item so deixaria passar a regressao de mover a classe para um dos ramos.
   */
  /**
   * `H-74`, `ACHADO 10`, `SC 4.1.3`. O `fallback` do `<Suspense>` NASCE com a
   * mensagem dentro, e regiao viva ja populada nao e anunciada — a MDN e
   * explicita. O `role` saiu do no; quem anuncia e a regiao da casca, montada
   * desde o primeiro render.
   *
   * Os dois textos diferem de proposito: o visivel e rotulo, o anunciado e
   * frase. Mesmo par de `WorkbookSetup`, e o que evita o leitor ouvir duas
   * vezes.
   */
  it('não anuncia a carga da página por região que nasce populada', () => {
    // `/historico` e a UNICA rota carregada sob demanda — o Recharts responde
    // por 374 dos 634 kB do pacote. Nas outras o `fallback` nunca aparece.
    window.history.replaceState(null, '', '/historico')
    render(<App />)

    const bloco = screen.getByText('Carregando página…')

    expect(bloco.getAttribute('role')).toBeNull()
    expect(bloco.getAttribute('aria-hidden')).toBe('true')
    expect(bloco.closest('[role="status"]')).toBeNull()
  })

  it('todo item da lateral nomeia o papel de movimento', () => {
    render(<App />)

    const itens = within(nav()).getAllByRole('link')

    expect(itens).toHaveLength(NAV_PAGES.length)
    for (const item of itens) expect(item.className).toContain('motion-tint')
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

      // `H-75`, `ACHADO 6`: os TRÊS acessos dizem "Configuração", o rótulo
      // canônico de `router.ts` — então o que os distingue é o CONTEXTO, e não
      // mais o nome. `findAll` sozinho voltaria com o da lateral, que monta
      // primeiro; o painel de saúde depende da resposta de `/api/health`.
      const link = await acessoAConfiguracao('painel')
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

      // **Link, e não botão** (`H-75`, `ACHADO 6`): navegar é navegar, e era o
      // único dos três acessos com outro papel. Como `<button>`, `Ctrl`+clique
      // não abria em outra aba nem mostrava o endereço.
      const acesso = await acessoAConfiguracao('faixa')
      fireEvent.click(acesso)

      expect(await screen.findByRole('region', { name: /Configuração da planilha/i })).toBeTruthy()
    })

    /**
     * `H-75`, `ACHADO 6`, falha `F31` de `SC 3.2.4`. Os TRÊS acessos à mesma
     * página são `<a href>` e dizem "Configuração" — o rótulo canônico de
     * `router.ts`. Antes, um deles era `<button>` e os três tinham nomes
     * diferentes.
     */
    it('os três acessos à configuração são link, e têm o mesmo nome', async () => {
      api.serve(
        healthFixture({
          state: 'degradado',
          degradedReason: 'A planilha nao pode ser lida.',
          lastReadAt: '2026-08-07T10:00:00.000Z',
        }),
      )
      render(<App />)

      await acessoAConfiguracao('painel')
      const acessos = screen.getAllByRole('link', { name: 'Configuração' })

      expect(acessos).toHaveLength(3)
      for (const acesso of acessos) {
        expect(acesso.tagName).toBe('A')
        expect(acesso.getAttribute('href')).toBe(WORKBOOK_SETUP_PAGE.path)
      }
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

    expect(corrente?.className).toContain('forced-colors:border-l-4')
  })

  /**
   * O canal só distingue se for exclusivo da corrente. As outras seis ficam nos
   * 2 px que o UA já pinta — é a diferença entre as duas espessuras que carrega
   * a informação.
   */
  it('não dá a espessura a nenhuma das outras seis', () => {
    const outras = abas().filter((aba) => aba.getAttribute('aria-current') !== 'page')

    expect(outras).toHaveLength(NAV_PAGES.length - 1)
    for (const aba of outras) expect(aba.className).not.toContain('forced-colors:border-l-4')
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

    expect(corrente?.className).toContain('forced-colors:pl-2.5')
    expect(corrente?.className).toContain('px-3')
    expect(corrente?.className).not.toMatch(/(^|\s)pl-2\.5/)
  })
})

/**
 * `H-70`. `VN-4` mediu o foco caindo no `<body>` depois de abrir um recorte
 * pelo ranking: a rota trocava e o operador de teclado recomeçava do zero, com
 * as **196** paradas de tabulação de `/operacional` pela frente — `SC 2.4.3`.
 *
 * O alvo é a landmark da casca, e não um nó da página: ela existe mesmo
 * enquanto o `Suspense` mostra o fallback, o que resolve por construção o
 * caso-limite da rota `lazy` que ainda não montou. Aqui jsdom **mede o foco de
 * verdade** — `document.activeElement` é real —, então estes testes não são
 * asserção de classe. Medido também em Chrome 151: `main` com
 * `aria-label="Operacional"`, `outline auto 1px` casando `:focus-visible`, e
 * zero paradas de tabulação novas nas oito rotas.
 */
describe('o foco depois da troca de rota', () => {
  it('vai para a landmark da página nova, e não para o body', async () => {
    const base = indicatorsFixture()
    api.serveIndicators({
      ...base,
      rankings: {
        ...base.rankings,
        clients: [{ key: 'ACME', label: 'Acme Log', count: 42 }],
      },
    })
    window.history.replaceState(null, '', '/clientes')
    render(<App />)

    const linha = await within(await screen.findByRole('region', { name: 'Clientes' })).findByRole(
      'button',
      { name: /Acme Log/ },
    )
    linha.focus()
    fireEvent.click(linha)

    await waitFor(() => expect(window.location.pathname).toBe('/operacional'))
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('main'))
    })
    expect(document.activeElement).not.toBe(document.body)
  })

  /**
   * O terceiro critério de aceite: mover o foco em silêncio trocaria um defeito
   * por outro. Quem anuncia é o rótulo da landmark, lido quando ela recebe o
   * foco — e não um segundo texto na região viva, que faria o leitor de tela
   * dizer a mesma coisa duas vezes (`H-43`).
   */
  it('dá à landmark o nome da página, que é o que o leitor de tela anuncia', async () => {
    window.history.replaceState(null, '', '/alertas')
    render(<App />)

    const main = screen.getByRole('main')

    expect(main.getAttribute('aria-label')).toBe('Alertas')
    expect(main.tabIndex).toBe(-1)
  })

  /**
   * O segundo critério. `keepFocus` é declarado só aqui, e é a única navegação
   * que não move o foco: quem clicou no link já está com o foco nele.
   */
  it('não mexe no foco quando a navegação é pelo link da casca', async () => {
    render(<App />)

    const link = within(nav()).getByRole('link', { name: 'Histórico' })
    link.focus()
    fireEvent.click(link)

    await waitFor(() => expect(window.location.pathname).toBe('/historico'))
    expect(document.activeElement).toBe(link)
  })

  /**
   * Caso-limite: o botão "voltar" emite o **mesmo** `popstate` que a navegação
   * programática, e sem consumir o sinal ele herdaria a intenção do salto
   * anterior. O critério não incide em `popstate`, e o teste prova que não
   * passou a incidir.
   */
  it('deixa o foco onde está quando o gesto é o voltar do navegador', async () => {
    render(<App />)
    fireEvent.click(within(nav()).getByRole('link', { name: 'Histórico' }))
    await waitFor(() => expect(window.location.pathname).toBe('/historico'))

    const link = within(nav()).getByRole('link', { name: 'Clientes' })
    link.focus()
    window.history.back()

    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(document.activeElement).toBe(link)
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

  it('marcar um filtro no painel reflete na URL', async () => {
    render(<App />)

    // `H-82`: os controles vivem no painel, e nao mais em treze chips na barra.
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    const cliente = within(await screen.findByRole('dialog', { name: 'Filtros' })).getByRole(
      'region',
      { name: 'Cliente' },
    )
    fireEvent.click(within(cliente).getByRole('checkbox', { name: /^ACME/ }))

    expect(window.location.search).toBe('?client=ACME')
    // Filtrar e observar o efeito: o painel continua aberto (`D-30`).
    expect(screen.getByRole('dialog', { name: 'Filtros' })).toBeTruthy()
  })

  /**
   * `H-82`. O padrao de foco modal nasce aqui, e e o consumidor mais exigente do
   * conjunto: `Esc` fecha E devolve o foco ao gatilho. Sem a devolucao o foco
   * cai no `<body>` e a tabulacao recomeca do topo (`SC 2.4.3`, `VN-4`).
   */
  it('Esc fecha o painel e devolve o foco ao gatilho', async () => {
    render(<App />)
    const gatilho = await screen.findByRole('button', { name: 'Filtros' })

    fireEvent.click(gatilho)
    expect(await screen.findByRole('dialog', { name: 'Filtros' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Filtros' })).toBeNull()
    expect(document.activeElement).toBe(gatilho)
  })

  /**
   * Terceira determinacao de `D-30`: o veu cobre a regiao de conteudo, e a barra
   * de topo continua a vista. Cobrir `Aplicar alteracoes` esconderia a acao que
   * grava no arquivo do operador.
   */
  it('com o painel aberto, a barra de topo segue visivel e o resto fica inerte', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    await screen.findByRole('dialog', { name: 'Filtros' })

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(nav().hasAttribute('inert')).toBe(true)
    expect(screen.getByRole('main').closest('[inert]')).not.toBeNull()
  })

  it('fechado, nada fica inerte', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Filtros' })

    expect(nav().hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('main').closest('[inert]')).toBeNull()
  })

  /** Reabrir nao pode empilhar dois paineis — o de baixo prenderia o foco. */
  it('reabrir o painel nao empilha dois', async () => {
    render(<App />)
    const gatilho = await screen.findByRole('button', { name: 'Filtros' })

    fireEvent.click(gatilho)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(gatilho)

    expect(screen.getAllByRole('dialog', { name: 'Filtros' })).toHaveLength(1)
  })

  /**
   * A pagina sem barra nao pode deixar o painel aberto: ele desapareceria com o
   * foco dentro, e a tabulacao recomecaria do `<body>` (`SC 2.4.3`).
   */
  it('navegar para pagina sem filtros fecha o painel', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    await screen.findByRole('dialog', { name: 'Filtros' })

    fireEvent.click(within(nav()).getByRole('link', { name: 'Configuração' }))

    expect(screen.queryByRole('dialog', { name: 'Filtros' })).toBeNull()
    expect(nav().hasAttribute('inert')).toBe(false)
  })

  it('trocar de pagina preserva o recorte montado', async () => {
    window.history.replaceState(null, '', '/?client=ACME&category=em_andamento')
    render(<App />)

    fireEvent.click(within(nav()).getByRole('link', { name: 'Performance' }))

    expect(window.location.pathname).toBe('/performance')
    expect(window.location.search).toBe('?client=ACME&category=em_andamento')
    // `H-82`: o recorte ativo continua visivel SEM abrir nada — a linha de
    // resumo o descreve, e o botao de limpar diz quantos filtros recortam.
    expect(await screen.findByRole('button', { name: 'Limpar 2' })).toBeTruthy()
  })

  it('limpar zera os filtros sem sair da pagina', async () => {
    window.history.replaceState(null, '', '/alertas?client=ACME')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Limpar 1' }))

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
    expect(screen.getByRole('heading', { name: 'Início' })).toBeTruthy()
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

/**
 * `H-59`, `D-22`. O eixo passa a ser lateral, e o topo guarda UMA linha.
 *
 * A casca empilhava quatro faixas antes do primeiro dado — título com ações,
 * navegação, filtros e faixa de estado. Medido em Chrome 151 ao fechar: **um**
 * `<header>` acima do conteúdo nas sete rotas, e zero estouro horizontal em 320,
 * 360, 768, 1024, 1280 e 1440 px — 42 medições.
 */
describe('a casca de eixo lateral', () => {
  it('serve a navegação numa coluna, e um único header acima do conteúdo', () => {
    const { container } = render(<App />)

    expect(container.querySelectorAll('header')).toHaveLength(1)
    expect(nav()).toBeTruthy()
    expect(within(nav()).getAllByRole('link')).toHaveLength(NAV_PAGES.length)
  })

  /**
   * `H-38` fechou a tela inalcançável: o único acesso a `/configuracao` era
   * digitar o endereço, e depois de apontar a planilha o operador a perdia. Ela
   * mudou de lugar aqui, e mudar de lugar não pode ser deixar de existir.
   */
  it('mantém Configuração na lateral, separada dos seis destinos de dado', () => {
    render(<App />)
    const barra = nav()

    // A separação é ESTRUTURAL, e não de ordem: os seis destinos de dado são
    // filhos diretos, e Configuração vive no rodapé. Testar só a posição
    // passaria com os sete numa lista corrida, que é o que a história desfaz.
    const principais = [...barra.querySelectorAll(':scope > a')]
    const rodape = [...barra.querySelectorAll(':scope > div > a')]

    expect(principais).toHaveLength(NAV_PAGES.length - 1)
    expect(principais.map((link) => link.textContent)).not.toContain('Configuração')
    expect(rodape.map((link) => link.textContent)).toEqual(['Configuração'])
  })

  /**
   * `SC 2.4.1 Bypass Blocks`. A lateral, o topo e os filtros vêm antes do
   * conteúdo e se repetem nas sete telas — 20 paradas de tabulação até o
   * primeiro dado. Medido no navegador: o salto é a **primeira** parada, mede
   * 122×20 px ao receber foco, e leva ao `main` com o rótulo da página.
   */
  it('oferece salto para o conteúdo, apontando para a landmark da página', () => {
    const { container } = render(<App />)
    const salto = screen.getByRole('link', { name: 'Ir para o conteúdo' })

    expect(salto.getAttribute('href')).toBe('#conteudo')
    expect(container.querySelector('main')?.id).toBe('conteudo')
    // `sr-only` sem `focus:not-sr-only` seria um salto que ninguém consegue ver.
    expect(salto.className).toContain('focus:not-sr-only')
  })

  /**
   * A faixa de estado e o `healthError` continuam existindo em **todas** as
   * páginas (A-57): mudaram de lugar, não de existência. É o caso-limite que a
   * história nomeia, e o modo de falha de uma reorganização de casca.
   */
  it('mantém a região de erro do servidor viva desde a montagem', () => {
    const { container } = render(<App />)
    const alertas = [...container.querySelectorAll('[role="alert"]')]

    expect(alertas.some((no) => no.className.includes('sr-only'))).toBe(true)
  })

  /**
   * As duas regiões de `H-44` nasceram sem classe, e o portal escreve nelas o
   * MESMO texto que o bloco visível da página já mostra: em `/historico` com a
   * janela de 12 meses o aviso de recorte apareceu na tela, fora do painel,
   * como terceira coluna do flex da raiz. Elas carregam texto para o leitor de
   * tela, nunca para o olho.
   */
  it('mantém as duas regiões vivas das páginas fora da tela', () => {
    const { container } = render(<App />)

    for (const id of ['regiao-viva-da-pagina', 'regiao-viva-da-pagina-status']) {
      const regiao = container.querySelector(`#${id}`)

      expect(regiao).toBeTruthy()
      // `hidden` esconderia igual e mataria o anúncio — a asserção é sobre a
      // classe exata, e não sobre "estar escondido de algum jeito".
      expect(regiao?.className).toBe('sr-only')
    }
  })
})
