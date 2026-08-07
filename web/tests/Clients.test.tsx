import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndicatorsResponse } from '../src/api-client.ts'
import { Clients } from '../src/pages/Clients.tsx'
import { type ApiStub, indicatorsFixture, stubApi } from './support/api-stub.ts'

/**
 * A Pagina Clientes (RF-11). Os tres rankings chegam prontos do servidor —
 * ordenados, desempatados e cortados em `meta.topN` —, entao o que se testa
 * aqui e apresentacao e navegacao, nunca calculo.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/clientes')
  api = stubApi()
})

afterEach(() => {
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
        { key: 'YRD', label: 'Yrd', count: 5 },
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

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/não significa nenhum processo/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Clientes' })).toBeNull()
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failIndicators()
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Não foi possível carregar os rankings/)).toBeTruthy()
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
