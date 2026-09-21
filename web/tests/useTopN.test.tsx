import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { MAX_TOP_N, topNLabel } from '../src/hooks/useTopN.ts'
import { Clients } from '../src/pages/Clients.tsx'
import { type ApiStub, indicatorsFixture, stubApi } from './support/api-stub.ts'
import { mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * O tamanho dos rankings, escolhido pelo operador (21/09/2026).
 *
 * O que se prova aqui e a fronteira: o seletor escreve na URL, e a frase da
 * tela le o ECO do servidor. Com os dois divergindo — a URL pedindo um valor
 * que a rota recusou —, a frase precisa dizer o que foi aplicado, e nao o que
 * foi pedido.
 */

let api: ApiStub

beforeEach(() => {
  mountLiveRegions()
  api = stubApi()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  unmountLiveRegions()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

const seletor = async (): Promise<HTMLSelectElement> =>
  (await screen.findByLabelText('Itens por dimensão')) as HTMLSelectElement

describe('o seletor de itens por dimensão', () => {
  it('escreve o valor escolhido na URL', async () => {
    render(<Clients queryString="" dataVersion={1} />)

    fireEvent.change(await seletor(), { target: { value: '20' } })

    expect(window.location.search).toContain('topN=20')
  })

  /** `MAX_TOP_N` se chama "Todos", como o "Todas" de `H-100`. */
  it('oferece "Todos" como o maior valor', async () => {
    render(<Clients queryString="" dataVersion={1} />)
    const opcoes = within(await seletor()).getAllByRole('option')

    expect(topNLabel(MAX_TOP_N)).toBe('Todos')
    expect(opcoes[opcoes.length - 1]?.textContent).toBe('Todos')
  })

  it('abre no valor que o servidor aplicou quando a URL nao pede nada', async () => {
    api.serveIndicators(indicatorsFixture({}, {}, { topN: 10 }))
    render(<Clients queryString="" dataVersion={1} />)

    expect((await seletor()).value).toBe('10')
  })

  /**
   * A frase vem do ECO, e nao do seletor: a rota recusa valor fora da faixa e
   * volta ao padrao, e dizer "Os 99999 maiores" seria afirmar um corte que nao
   * aconteceu (regra inviolavel 2).
   */
  it('a frase diz o que o servidor aplicou, e nao o que a URL pediu', async () => {
    window.history.replaceState(null, '', '/?topN=99999')
    api.serveIndicators(indicatorsFixture({}, {}, { topN: 10 }))
    render(<Clients queryString="?topN=99999" dataVersion={1} />)

    await waitFor(() => expect(screen.getByText(/maiores de cada dimensão/)).toBeTruthy())
    expect(screen.getByText(/Os 10 maiores de cada dimensão/)).toBeTruthy()
  })
})

/**
 * O `topN` some ao sair da Pagina Clientes (21/09/2026).
 *
 * **Emenda `D-55`**, que o declarara global: o argumento de la — Clientes e
 * Performance consomem os mesmos rankings — continua verdadeiro e deixou de ser
 * decisivo. O usuario viu `?topN=50` sobreviver a troca de pagina e decidiu o
 * contrario.
 *
 * Quem apaga e a casca, pela tabela `PARAMS_POR_PAGINA`, e nao o roteador:
 * saber a que pagina um parametro pertence e conhecimento de PAGINA, como
 * `H-99` ja fixara para os da Operacional.
 */
describe('o topN é da página, e não da casca', () => {
  it('sobrevive enquanto a rota é Clientes', async () => {
    window.history.replaceState(null, '', '/clientes')
    render(<App />)

    const seletor = (await screen.findByLabelText('Itens por dimensão')) as HTMLSelectElement
    fireEvent.change(seletor, { target: { value: '50' } })

    expect(window.location.search).toContain('topN=50')
  })

  it('some ao trocar de página', async () => {
    window.history.replaceState(null, '', '/clientes?topN=50')
    render(<App />)

    await screen.findByLabelText('Itens por dimensão')
    fireEvent.click(await screen.findByRole('link', { name: /performance/i }))

    await waitFor(() => expect(window.location.pathname).toBe('/performance'))
    expect(window.location.search).not.toContain('topN')
  })

  /** Os filtros globais NÃO somem: trocar de página nunca limpa o recorte. */
  it('não leva os filtros globais junto', async () => {
    window.history.replaceState(null, '', '/clientes?topN=50&client=ALFA')
    render(<App />)

    await screen.findByLabelText('Itens por dimensão')
    fireEvent.click(await screen.findByRole('link', { name: /performance/i }))

    await waitFor(() => expect(window.location.search).not.toContain('topN'))
    expect(window.location.search).toContain('client=ALFA')
  })
})
