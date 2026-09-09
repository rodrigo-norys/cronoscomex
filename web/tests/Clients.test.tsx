import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndicatorsResponse } from '../src/api-client.ts'
import { Clients } from '../src/pages/Clients.tsx'
import {
  type ApiStub,
  clientKeysFixture,
  indicatorsFixture,
  ruleReachFixture,
  stubApi,
} from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * A Pagina Clientes (RF-11). Os tres rankings chegam prontos do servidor —
 * ordenados, desempatados e cortados em `meta.topN` —, entao o que se testa
 * aqui e apresentacao e navegacao, nunca calculo.
 */

let api: ApiStub

beforeEach(() => {
  mountLiveRegions()
  window.history.replaceState(null, '', '/clientes')
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

type Rankings = IndicatorsResponse['rankings']

function serveRankings(rankings: Partial<Rankings>, bazarShare: number | null = 0.3547): void {
  const base = indicatorsFixture()
  api.serveIndicators({
    ...base,
    rankings: { ...base.rankings, ...rankings },
    meta: { ...base.meta, bazarShare },
  })
}

function renderPage(queryString = '') {
  return render(<Clients queryString={queryString} dataVersion={0} />)
}

/** Assincrono de proposito: o ranking so existe depois da requisicao resolver. */
function ranking(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name })
}

describe('os tres rankings', () => {
  it('exibe as tres dimensoes, a de mercadoria inclusive (A-65)', async () => {
    serveRankings({
      clients: [{ key: 'ACME', label: 'Acme Log', count: 12 }],
      importers: [{ key: 'IMP', label: 'Importadora X', count: 8 }],
      goods: [{ key: 'BAZAR', label: 'BAZAR', count: 210 }],
    })
    renderPage()

    expect(await screen.findByRole('region', { name: 'Clientes' })).toBeTruthy()
    expect(await ranking('Importadores')).toBeTruthy()
    expect(await ranking('Mercadorias')).toBeTruthy()
  })

  // A-26: a chave normalizada agrupa, a grafia de origem e o que se le.
  it('exibe a primeira grafia encontrada, nunca a chave normalizada', async () => {
    serveRankings({ clients: [{ key: 'ACME LOG', label: 'Acme Log', count: 12 }] })
    renderPage()

    expect(await within(await ranking('Clientes')).findByText('Acme Log')).toBeTruthy()
    expect(within(await ranking('Clientes')).queryByText('ACME LOG')).toBeNull()
  })

  /**
   * A ordem vem do servidor, com desempate alfabetico pela chave (A-25).
   * Reordenar aqui produziria uma lista diferente da que `topN` cortou.
   */
  it('preserva a ordem recebida, sem reordenar empate', async () => {
    serveRankings({
      clients: [
        { key: 'ALFA', label: 'Alfa', count: 7 },
        { key: 'BETA', label: 'Beta', count: 7 },
        { key: 'CHARLIE', label: 'Charlie', count: 7 },
      ],
    })
    renderPage()

    const itens = await within(await ranking('Clientes')).findAllByRole('listitem')
    expect(itens.map((item) => item.textContent?.replace(/\d+$/, ''))).toEqual([
      'Alfa',
      'Beta',
      'Charlie',
    ])
  })

  it('anuncia quantos maiores exibe, conforme meta.topN', async () => {
    serveRankings({ clients: [{ key: 'ACME', label: 'Acme', count: 1 }] })
    renderPage()

    expect(await screen.findByText(/Os 10 maiores de cada dimensão/)).toBeTruthy()
  })
})

describe('clique aplica o filtro e abre a Operacional', () => {
  it('leva a chave normalizada para o filtro correspondente', async () => {
    serveRankings({ clients: [{ key: 'ACME LOG', label: 'Acme Log', count: 12 }] })
    renderPage()

    fireEvent.click(
      await within(await ranking('Clientes')).findByRole('button', { name: /Acme Log/ }),
    )

    expect(window.location.pathname).toBe('/operacional')
    expect(window.location.search).toBe('?client=ACME+LOG')
  })

  it('usa o parametro de cada dimensao', async () => {
    serveRankings({ goods: [{ key: 'BAZAR', label: 'BAZAR', count: 210 }] })
    renderPage()

    fireEvent.click(
      await within(await ranking('Mercadorias')).findByRole('button', { name: /BAZAR/ }),
    )

    expect(window.location.search).toBe('?goods=BAZAR')
  })

  /**
   * Aplicar, e nao alternar: `toggle` puro desmarcaria o valor ja selecionado, e
   * o operador chegaria a Operacional com o filtro que o clique acabou de tirar.
   */
  it('mantem o filtro quando o valor ja estava selecionado', async () => {
    window.history.replaceState(null, '', '/clientes?client=ACME')
    serveRankings({ clients: [{ key: 'ACME', label: 'Acme', count: 12 }] })
    renderPage('?client=ACME')

    fireEvent.click(await within(await ranking('Clientes')).findByRole('button', { name: /Acme/ }))

    expect(window.location.pathname).toBe('/operacional')
    expect(window.location.search).toBe('?client=ACME')
  })

  it('preserva o recorte que ja existia ao acrescentar outro valor', async () => {
    window.history.replaceState(null, '', '/clientes?category=em_andamento')
    serveRankings({ clients: [{ key: 'ACME', label: 'Acme', count: 12 }] })
    renderPage('?category=em_andamento')

    fireEvent.click(await within(await ranking('Clientes')).findByRole('button', { name: /Acme/ }))

    expect(window.location.search).toBe('?category=em_andamento&client=ACME')
  })
})

describe('bazarShare, exibido junto do ranking que qualifica (A-34, A-65)', () => {
  it('fica dentro do ranking de mercadoria, e nao em separado', async () => {
    serveRankings({ goods: [{ key: 'BAZAR', label: 'BAZAR', count: 210 }] }, 0.3547)
    renderPage()

    const mercadorias = await screen.findByRole('region', { name: 'Mercadorias' })
    expect(within(mercadorias).getByText(/35,47%/)).toBeTruthy()
    expect(within(await ranking('Clientes')).queryByText(/35,47%/)).toBeNull()
  })

  // `null` e ausencia de base, nao zero: exibir a ressalva afirmaria uma
  // distorcao que nao foi medida.
  it('omite a ressalva quando bazarShare e null', async () => {
    serveRankings({ goods: [] }, null)
    renderPage()

    await screen.findByRole('region', { name: 'Mercadorias' })
    expect(screen.queryByText(/BAZAR concentra/)).toBeNull()
  })
})

describe('casos-limite', () => {
  it('exibe os grupos existentes quando ha menos que topN', async () => {
    serveRankings({
      clients: [
        { key: 'ACME', label: 'Acme', count: 12 },
        { key: 'BETA', label: 'Beta', count: 5 },
      ],
    })
    renderPage()

    expect(await within(await ranking('Clientes')).findAllByRole('listitem')).toHaveLength(2)
  })

  /**
   * Medido na planilha real: o grupo em branco e o **segundo** maior de
   * mercadoria, com 57 processos. Rotula-lo com a chave vazia daria uma linha
   * invisivel, e some-lo esconderia o buraco de preenchimento.
   */
  it('rotula o grupo de chave vazia como (sem valor)', async () => {
    serveRankings({
      goods: [
        { key: 'BAZAR', label: 'BAZAR', count: 210 },
        { key: '', label: '', count: 57 },
      ],
    })
    renderPage()

    expect(await within(await ranking('Mercadorias')).findByText('(sem valor)')).toBeTruthy()
  })

  it('filtra pela chave vazia, que a rota preserva desde H-18', async () => {
    serveRankings({ goods: [{ key: '', label: '', count: 57 }] })
    renderPage()

    fireEvent.click(
      await within(await ranking('Mercadorias')).findByRole('button', { name: /\(sem valor\)/ }),
    )

    expect(window.location.pathname).toBe('/operacional')
    expect(window.location.search).toBe('?goods=')
  })

  it('diz que o conjunto esta vazio, em vez de desenhar grafico em branco', async () => {
    serveRankings({ clients: [], importers: [], goods: [] })
    renderPage()

    expect(
      await within(await ranking('Clientes')).findByText(/Nenhum cliente no recorte atual/),
    ).toBeTruthy()
    expect(within(await ranking('Importadores')).getByText(/Nenhum importador/)).toBeTruthy()
    expect(within(await ranking('Mercadorias')).getByText(/Nenhuma mercadoria/)).toBeTruthy()
  })
})

describe('estados que nao sao zero', () => {
  it('distingue ausencia de leitura de conjunto vazio', async () => {
    api.indicatorsWithoutRead()
    renderPage()

    expect((await findLiveRegion('status', /Nenhuma leitura/)).textContent).not.toBe('')
    expect(screen.getAllByText(/não significa nenhum processo/)).toHaveLength(2)
    expect(screen.queryByRole('region', { name: 'Clientes' })).toBeNull()
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failIndicators()
    renderPage()

    // O texto aparece duas vezes de propósito: o bloco visível é `aria-hidden`,
    // e a região viva carrega o conteúdo acessível. Uma leitura só para quem
    // ouve, e o mesmo texto para quem vê.
    expect((await findLiveRegion('alert')).textContent).toMatch(
      /Não foi possível carregar os rankings/,
    )
    expect(screen.getAllByText(/Não foi possível carregar os rankings/)).toHaveLength(2)
  })
})

describe('filtros globais', () => {
  it('anexa o recorte a propria requisicao', async () => {
    serveRankings({ clients: [{ key: 'ACME', label: 'Acme', count: 12 }] })
    renderPage('?category=em_andamento')

    await screen.findByRole('region', { name: 'Clientes' })
    expect(api.calls).toContain('GET /api/indicators?category=em_andamento')
  })
})

/**
 * `H-56`. A barra do grupo: uma linha, com os componentes nomeados acima dela e
 * a largura dividida entre eles.
 */
describe('grupo de clientes no ranking', () => {
  const comGrupo = () =>
    serveRankings({
      clients: [
        {
          key: 'GRUPO-UM',
          label: 'Grupo Um',
          count: 321,
          segments: [
            { key: 'ALFA', label: 'Alfa', count: 304 },
            { key: 'BETA', label: 'Beta', count: 15 },
            { key: 'GAMA', label: 'Gama', count: 2 },
          ],
        },
        { key: 'ZETA', label: 'Zeta', count: 40 },
      ],
    })

  /**
   * Cada componente e uma linha, e nao um rotulo dentro da barra: medido, o
   * menor deles ocupa 0,6% da largura, e nenhum texto cabe la.
   */
  it('da uma linha propria a cada componente, com nome e contagem', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))

    expect(await clientes.findByText('Grupo Um')).toBeTruthy()
    // O nome acessivel sai sem espaco entre rotulo e contagem — os dois sao
    // spans irmaos, e isso vale para toda linha de ranking desde `H-18`.
    expect(clientes.getByRole('button', { name: /Alfa\s*304/ })).toBeTruthy()
    expect(clientes.getByRole('button', { name: /Beta\s*15/ })).toBeTruthy()
    expect(clientes.getByRole('button', { name: /Gama\s*2/ })).toBeTruthy()
  })

  // A hierarquia e estrutural, nao so visual: a sublista e o que o leitor de
  // tela usa para dizer que Beta esta DENTRO de Grupo Um.
  it('aninha os componentes numa sublista sob o grupo', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))
    const listas = clientes.getAllByRole('list')

    expect(listas.length).toBeGreaterThan(1)
    expect(within(listas[1] as HTMLElement).getAllByRole('listitem')).toHaveLength(3)
  })

  // Uma barra por grupo: os membros nao viram linhas proprias, senao a soma das
  // barras contaria os mesmos processos duas vezes.
  it('nao repete os componentes como linhas do ranking', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))

    expect(clientes.getAllByRole('listitem')).toHaveLength(5)
    expect(clientes.queryByTitle(/Filtrar por Alfa e abrir/)).toBeTruthy()
  })

  it('clicar na barra do grupo filtra por clientGroup', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))
    fireEvent.click(clientes.getByTitle(/Filtrar por Grupo Um/))

    expect(window.location.search).toContain('clientGroup=GRUPO-UM')
    expect(window.location.pathname).toBe('/operacional')
  })

  it('clicar num componente filtra o cliente dele', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))
    fireEvent.click(clientes.getByTitle(/Filtrar por Beta/))

    expect(window.location.search).toContain('client=BETA')
    expect(window.location.search).not.toContain('clientGroup')
  })

  /**
   * `H-65`, `VN-2`. O rotulo tem `w-40` e trunca: medido em Chrome 151 a
   * 1280 px, **160 px visiveis para 200 necessarios** no tamanho padrao e 240
   * para 300 em "Muito grande". Sem o `title` o nome consolidado some sem
   * aviso, e o operador nao tem como saber que ha mais texto.
   */
  /**
   * `H-74`, `ACHADO 9`, `SC 2.5.8`. Com `py-0.5` sobre `text-xs` a caixa media
   * **20 px**, e o `<ul>` nao tem `gap`: dois membros vizinhos ficavam a 20 px
   * de centro a centro, e circulos de 24 px centrados em cada um se
   * intersectam — a excecao Spacing nao se satisfaz. `min-h-6` sao
   * `calc(0.25rem * 6)` = 24 px, e **relativo**, entao acompanha a ampliacao.
   *
   * Em jsdom todo retangulo e zero: o que se afirma e a classe. A geometria da
   * linha de TOPO — 28 px, que ja passava — foi medida em Chrome 151.
   */
  it('dá 24px ao alvo da linha aninhada, e não mexe na de topo', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))
    const grupo = clientes.getByTitle(/Filtrar por Grupo Um/)
    const membro = clientes.getByTitle(/Filtrar por Beta/)

    expect(membro.className).toContain('min-h-6')
    expect(membro.className).toContain('py-0.5')
    expect(grupo.className).not.toContain('min-h-6')
    expect(grupo.className).toContain('py-1')
  })

  it('o rótulo do ranking guarda o valor inteiro, porque trunca', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))

    expect(clientes.getByTitle('Grupo Um').textContent).toBe('Grupo Um')
    expect(clientes.getByTitle('Beta').textContent).toBe('Beta')
  })
})

/**
 * O painel do mapa de clientes, que `D-36` mudou para esta pagina em
 * 09/09/2026 — ele nasceu na Pagina Configuracao, e a determinacao 1 de `D-32`
 * foi revertida depois de o usuario USAR a tela.
 */
async function secao(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Clientes por declarar' })
}

/**
 * **A faixa nasce recolhida** (`D-37`), e o corpo so existe depois do clique.
 *
 * Medido a 1920x1080: expandido, o painel consome 710 px de uma janela de 1080,
 * e os tres rankings caiam abaixo da dobra numa pagina de 1752 px.
 */
async function abrirPainel(): Promise<HTMLElement> {
  const painel = await secao()
  const botao = await within(painel).findByRole('button', { name: 'Declarar clientes' })
  fireEvent.click(botao)
  return painel
}

/** As linhas da lista da ESQUERDA — as grafias sem cliente. */
async function itens(): Promise<HTMLElement[]> {
  const painel = await abrirPainel()
  const lista = await within(painel).findByRole('list', {
    name: 'Grafias sem cliente declarado',
  })
  return within(lista).findAllByRole('listitem')
}

/** As linhas da lista da DIREITA — os clientes ja declarados. */
async function declarados(): Promise<HTMLElement[]> {
  const painel = await abrirPainel()
  const lista = await within(painel).findByRole('list', { name: 'Clientes declarados' })
  return within(lista).findAllByRole('listitem')
}

describe('clientes por declarar', () => {
  /**
   * As duas tabelas separam o que falta do que já foi (08/09/2026): a fixture
   * traz uma grafia livre e uma dentro de um pai, e cada uma vai para um lado.
   */
  it('poe a grafia sem cliente a esquerda, com contagem e REF de exemplo', async () => {
    render(<Clients queryString="" dataVersion={1} />)

    const lista = await itens()

    expect(lista).toHaveLength(1)
    expect(lista[0]?.textContent).toContain('YT-769')
    expect(lista[0]?.textContent).toContain('3 processos')
    expect(lista[0]?.textContent).toContain('FT498.26 · FT471.26')
  })

  /** A tabela da direita lista CLIENTES, e nao grafias: `AV` consolida 304
      celulas que diriam todas "Vivi > AV". */
  it('poe os clientes declarados a direita, com o pai e o peso deles', async () => {
    render(<Clients queryString="" dataVersion={1} />)

    const lista = await declarados()

    expect(lista).toHaveLength(2)
    expect(lista[0]?.textContent).toContain('Vivi')
    expect(lista[0]?.textContent).toContain('AV')
    expect(lista[0]?.textContent).toContain('304 processos')
    expect(lista[0]?.textContent).toContain('304 grafias')
  })

  /** A frase evita o jargao "grafia" na abertura, e diz o EFEITO (09/09/2026). */
  /**
   * **A faixa e o estado de repouso** (`D-37`): recolhida, ela custa uma linha
   * em vez dos 710 px medidos a 1920x1080, e a divida continua a vista.
   */
  it('nasce recolhida, com o corpo fora de alcance', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const painel = await secao()

    const botao = await within(painel).findByRole('button', { name: 'Declarar clientes' })
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    expect(within(painel).queryByRole('list', { name: 'Grafias sem cliente declarado' })).toBeNull()
  })

  it('abre e recolhe no lugar, sem trocar de pagina', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const painel = await abrirPainel()

    const botao = within(painel).getByRole('button', { name: 'Recolher' })
    expect(botao.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(botao)
    expect(within(painel).queryByRole('list', { name: 'Grafias sem cliente declarado' })).toBeNull()
  })

  /** O resumo vive FORA do contentor recolhivel: e o unico lugar onde a divida
      aparece sem o operador pedir. */
  it('diz quantos valores a coluna tem mesmo com o painel recolhido', async () => {
    api.serveClientKeys(clientKeysFixture({ total: 509 }))
    render(<Clients queryString="" dataVersion={1} />)

    const painel = await secao()
    await within(painel).findByRole('button', { name: 'Declarar clientes' })

    expect(painel.textContent).toContain('A coluna CLT tem')
    expect(painel.textContent).toContain('509')
    // A fixture traz uma livre e uma declarada dentro de um pai.
    expect(painel.textContent).toMatch(/Em\s*1\s*deles o cliente ainda não foi declarado/)
  })

  /**
   * A grafia livre diz "sem cliente" na propria linha — o texto e o que separa
   * "ainda nao declarei" de "declarei e o dono e este".
   */
  it('marca a grafia livre como sem cliente', async () => {
    render(<Clients queryString="" dataVersion={1} />)

    const lista = await itens()

    expect(lista[0]?.textContent).toContain('sem cliente')
  })

  /**
   * **A rolagem e do QUADRO, e nao da pagina.** As 111 estao todas no DOM: quem
   * corta e o `max-height`, e o operador rola dentro da lista em vez de expandir
   * de 20 em 20 e empurrar as etapas da partida para fora da tela. Mesma escolha
   * de `H-84` na Operacional e de `FilterPanel` para os 509 clientes.
   */
  it('poe as 111 grafias no quadro, sem paginar', async () => {
    const items = Array.from({ length: 111 }, (_, i) => ({
      key: `K${String(i).padStart(3, '0')}`,
      label: `K${String(i).padStart(3, '0')}`,
      count: 1,
      samples: ['FT001.26'],
      client: null,
      parent: null,
    }))
    api.serveClientKeys(clientKeysFixture({ items, total: 111 }))
    render(<Clients queryString="" dataVersion={1} />)

    expect(await itens()).toHaveLength(111)

    const painel = await secao()
    expect(within(painel).queryByRole('button', { name: /mostrar mais/i })).toBeNull()
  })

  /** `SC 2.1.1`: regiao rolavel que nao recebe foco nao se percorre do teclado. */
  it('a lista e uma parada de tabulacao nomeada, para rolar sem apontador', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    await itens()

    const lista = await screen.findByRole('list', { name: 'Grafias sem cliente declarado' })

    expect(lista.getAttribute('tabindex')).toBe('0')
    expect(lista.className).toContain('overflow-y-auto')
    expect(lista.className).toContain('pending-viewport')
  })

  /** Zero aqui e uma afirmacao forte, e so vale depois de uma leitura. */
  it('coluna sem grafia nenhuma afirma isso, e diz que a leitura terminou', async () => {
    api.serveClientKeys(clientKeysFixture({ items: [], total: 0, names: [] }))
    render(<Clients queryString="" dataVersion={1} />)

    const painel = await secao()
    expect(await within(painel).findByText(/A leitura foi concluída, e não há/)).toBeTruthy()
  })

  it('sem leitura, diz que vazio NAO significa tudo declarado', async () => {
    api.clientKeysWithoutRead()
    render(<Clients queryString="" dataVersion={1} />)

    const painel = await secao()
    expect(await within(painel).findByText(/não significa que está tudo declarado/)).toBeTruthy()
  })

  it('falha da rota vira alerta, e nao lista vazia', async () => {
    api.failClientKeys()
    render(<Clients queryString="" dataVersion={1} />)

    const painel = await secao()
    const aviso = await within(painel).findByRole('alert')

    expect(aviso.textContent).toMatch(/Não foi possível carregar/)
    expect(within(painel).queryAllByRole('listitem')).toEqual([])
  })

  /** `D-32`, determinacao 2: divida de configuracao nao e recorte. */
  it('nao anexa filtro global nenhum a requisicao', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    await itens()

    expect(api.calls).toContain('GET /api/clients')
    expect(api.calls.some((call) => call.startsWith('GET /api/clients?'))).toBe(false)
  })
})

/**
 * A declaracao pela tela (`H-88`, ponto verde 2).
 *
 * O caso que move tudo esta medido na planilha real: as 111 grafias caem em
 * tres prefixos que cobrem 98 delas, e `Y` casa `YT-769` — sem ver o alcance, o
 * operador declara supondo quatro e alcanca sessenta e duas.
 */
describe('declarar um cliente', () => {
  async function formulario(): Promise<HTMLElement> {
    await abrirPainel()
    return screen.findByRole('button', { name: /^declarar$/i })
  }

  function preencher(valor: string, nome: string): void {
    fireEvent.change(screen.getByLabelText(/valor na coluna clt/i), { target: { value: valor } })
    fireEvent.change(screen.getByLabelText(/nome do cliente/i), { target: { value: nome } })
  }

  it('mostra o alcance da regra antes de gravar', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    await formulario()

    preencher('Y', 'Vivi')

    expect(await screen.findByText(/passa a consolidar/i)).toBeTruthy()
    const previsao = screen.getByText(/passa a consolidar/i)
    expect(previsao.textContent).toContain('4')
    expect(previsao.textContent).toContain('Y2601, Y2602, YT-769')
  })

  /**
   * `Y` casa `YT-769`, que ja tem dono. A previsao precisa dizer que elas
   * continuam como estao — a regra nova entra no fim, e a primeira que casa
   * vence (determinacao 6 de `D-35`).
   */
  it('avisa quais grafias ja tem dono e nao mudam', async () => {
    api.serveRuleReach(
      ruleReachFixture({
        keys: 2,
        processes: 2,
        alreadyMapped: [
          { key: 'YT-769', label: 'Beta', count: 1 },
          { key: 'YT-777', label: 'Beta', count: 1 },
        ],
      }),
    )
    render(<Clients queryString="" dataVersion={1} />)
    await formulario()

    preencher('Y', 'Vivi')

    // `findByText` devolve o `<strong>`; quem tem a frase inteira e o paragrafo.
    const marca = await screen.findByText(/continuam como estão/i)
    const previsao = marca.closest('p')

    expect(previsao?.textContent).toContain('YT-769, YT-777')
    expect(previsao?.textContent).toContain('2 grafias')
  })

  /** Determinacao 5 de `D-35`: nenhuma regra e gravada sem o alcance a vista. */
  it('mantem o botao fora de alcance ate a previsao chegar', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const botao = await formulario()

    expect(botao.hasAttribute('disabled')).toBe(true)

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)

    expect(botao.hasAttribute('disabled')).toBe(false)
  })

  it('nao deixa declarar o que nao alcanca nada', async () => {
    api.serveRuleReach(ruleReachFixture({ keys: 0, processes: 0, samples: [] }))
    render(<Clients queryString="" dataVersion={1} />)
    const botao = await formulario()

    preencher('ZZZ', 'Vivi')
    await screen.findByText(/passa a consolidar/i)

    expect(botao.hasAttribute('disabled')).toBe(true)
  })

  it('envia o match escolhido junto do valor e do nome', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const botao = await formulario()

    fireEvent.change(screen.getByLabelText(/como comparar/i), { target: { value: 'prefix' } })
    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    await waitFor(() => expect(api.ruleBodies).toHaveLength(1))
    expect(api.ruleBodies[0]).toEqual({ match: 'prefix', value: 'Y', label: 'Vivi' })
  })

  /** Clicar na grafia poupa digitar o que a lista ja mostra. */
  it('clicar numa grafia da lista a leva para o formulario, como regra exata', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    await itens()

    fireEvent.click(screen.getByRole('button', { name: 'YT-769' }))

    expect((screen.getByLabelText(/valor na coluna clt/i) as HTMLInputElement).value).toBe('YT-769')
    expect((screen.getByLabelText(/como comparar/i) as HTMLSelectElement).value).toBe('exact')
  })

  it('a recusa do servidor chega ao operador sem traducao', async () => {
    api.failCreateClientRule('Informe o nome do cliente.')
    render(<Clients queryString="" dataVersion={1} />)
    const botao = await formulario()

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    expect(await screen.findByText('Informe o nome do cliente.')).toBeTruthy()
  })

  it('declarado com sucesso, limpa o formulario e refaz a lista', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const botao = await formulario()
    const antes = api.calls.filter((call) => call === 'GET /api/clients').length

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    expect(await screen.findByText(/Declarado: Vivi\./)).toBeTruthy()
    expect((screen.getByLabelText(/valor na coluna clt/i) as HTMLInputElement).value).toBe('')
    await waitFor(() =>
      expect(api.calls.filter((call) => call === 'GET /api/clients').length).toBeGreaterThan(antes),
    )
  })
})

/**
 * O nome escolhido, e o que ele FAZ (`H-88`, determinacoes 8 e 9).
 *
 * O caso vem do mapa real: `Vivi` ja e pai de AV, Chun e Kelly, e declarar nele
 * acrescenta um filho — enquanto um nome novo cria cliente.
 */
describe('escolher o nome do cliente', () => {
  async function campoNome(): Promise<HTMLInputElement> {
    await abrirPainel()
    return (await screen.findByLabelText(/nome do cliente/i)) as HTMLInputElement
  }

  /**
   * Os nomes sao BOTOES, e nao `datalist`: o dropdown nativo nao aceita a
   * paleta do conjunto, e o operador precisava abri-lo para saber que havia
   * sugestao.
   */
  /**
   * **Escopado no painel** (09/09/2026): o ranking de Clientes tambem tem um
   * botao "Vivi" — a barra clicavel do grafico —, e desde `D-36` os dois vivem
   * na mesma pagina. Buscar no documento inteiro acha o do grafico.
   */
  it('mostra os nomes que existem como botoes, com o pai marcado', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const painel = await secao()
    await campoNome()

    expect(within(painel).getByRole('button', { name: /^Vivi/ }).textContent).toContain(
      '4 clientes',
    )
    expect(within(painel).getByRole('button', { name: 'Dennis' })).toBeTruthy()
  })

  it('clicar num nome existente preenche o campo', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const campo = await campoNome()

    const painel = await secao()
    fireEvent.click(within(painel).getByRole('button', { name: /^Vivi/ }))

    expect(campo.value).toBe('Vivi')
  })

  it('diz que um nome novo vira cliente novo', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Cliente Novo' } })

    expect(await screen.findByText(/ainda não existe: será criado como cliente novo/)).toBeTruthy()
  })

  /** O pai ja existe: o conjunto entra como mais um filho. */
  it('diz que um nome que ja agrupa recebe mais um conjunto', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Vivi' } })

    expect(await screen.findByText(/entra como mais um dentro dele/)).toBeTruthy()
  })

  /** O nome tem UM conjunto: este e o segundo, e o pai nasce. */
  it('diz que um nome com um conjunto so passa a agrupar os dois', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Dennis' } })

    expect(await screen.findByText(/passa a agrupar os dois/)).toBeTruthy()
  })

  it('reconhece o nome existente sem exigir a mesma caixa', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'vivi' } })

    expect(await screen.findByText(/entra como mais um dentro dele/)).toBeTruthy()
  })
})

/**
 * Desfazer o agrupamento (`H-88`, determinacao 9).
 *
 * **Nenhum cliente e apagado**: sai o vinculo com o pai, e o cliente volta ao
 * ranking com a contagem que sempre teve.
 */
describe('desfazer o agrupamento', () => {
  it('oferece tirar do pai e desfazer o pai, so em quem tem pai', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const lista = await declarados()

    // `AV` esta dentro de Vivi; `Dennis` esta solto.
    expect(
      within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }),
    ).toBeTruthy()
    expect(
      within(lista[0] as HTMLElement).getByRole('button', { name: /desfazer vivi/i }),
    ).toBeTruthy()
    expect(within(lista[1] as HTMLElement).queryAllByRole('button')).toEqual([])
  })

  it('tirar do pai chama a rota do membro, e apaga a declaracao', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    await waitFor(() => expect(api.removals).toHaveLength(1))
    expect(api.removals[0]).toBe('/api/clients/groups/VIVI-GRUPO/members/AV')
    expect(await screen.findByText(/A declaração foi apagada/)).toBeTruthy()
  })

  it('desfazer o pai apaga as declaracoes dos filhos', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /desfazer vivi/i }))

    await waitFor(() => expect(api.removals).toHaveLength(1))
    expect(api.removals[0]).toBe('/api/clients/groups/VIVI-GRUPO')
    expect(await screen.findByText(/3 declarações foram apagadas/)).toBeTruthy()
  })

  it('refaz a lista depois de desfazer', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const lista = await declarados()
    const antes = api.calls.filter((call) => call === 'GET /api/clients').length

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    await waitFor(() =>
      expect(api.calls.filter((call) => call === 'GET /api/clients').length).toBeGreaterThan(antes),
    )
  })

  it('a recusa do servidor chega ao operador sem traducao', async () => {
    api.failRemoveGroup('Esse agrupamento nao existe mais.')
    render(<Clients queryString="" dataVersion={1} />)
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    expect(await screen.findByText('Esse agrupamento nao existe mais.')).toBeTruthy()
  })
})
