import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'

/**
 * Prova que o ambiente de teste da interface funciona ponta a ponta: `jsdom`
 * como DOM, o plugin do React transformando o JSX, a Testing Library
 * renderizando e consultando, e `fetch` substituivel.
 *
 * A cobertura de verdade da casca chega com `H-15`. Aqui o alvo e o setup.
 */

function mockFetch(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ json: () => Promise.resolve(body) } as Response)),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ambiente de teste da interface', () => {
  it('renderiza um componente React em jsdom', () => {
    mockFetch({})

    render(<App />)

    expect(screen.getByRole('heading', { name: 'CronosComex' })).toBeTruthy()
  })

  it('exibe o estado devolvido pela API', async () => {
    mockFetch({ state: 'pronto', sheetName: '2026', lastReadAt: null, rowsRead: 0 })

    render(<App />)

    expect(await screen.findByText('pronto')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
  })

  it('exibe a falha quando a API nao responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('conexao recusada'))),
    )

    render(<App />)

    expect(await screen.findByText(/conexao recusada/)).toBeTruthy()
  })

  // O setup desmonta entre testes; sem isso, este encontraria dois titulos.
  it('nao vaza a arvore renderizada entre testes', () => {
    mockFetch({})

    render(<App />)

    expect(screen.getAllByRole('heading', { name: 'CronosComex' })).toHaveLength(1)
  })
})
