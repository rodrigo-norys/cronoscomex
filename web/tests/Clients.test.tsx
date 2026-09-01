import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndicatorsResponse } from '../src/api-client.ts'
import { Clients } from '../src/pages/Clients.tsx'
import { type ApiStub, indicatorsFixture, stubApi } from './support/api-stub.ts'
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

    expect((await findLiveRegion('status')).textContent).not.toBe('')
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
  it('o rótulo do ranking guarda o valor inteiro, porque trunca', async () => {
    comGrupo()
    renderPage()

    const clientes = within(await ranking('Clientes'))

    expect(clientes.getByTitle('Grupo Um').textContent).toBe('Grupo Um')
    expect(clientes.getByTitle('Beta').textContent).toBe('Beta')
  })
})
