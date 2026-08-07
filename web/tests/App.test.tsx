import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { type ApiStub, healthFixture, stubApi } from './support/api-stub.ts'

/**
 * A casca de `H-15`: navegacao entre as sete paginas, a faixa de estado que
 * A-57 exige em todas elas, e o botao de A-62.
 *
 * As paginas em si chegam de `H-16` a `H-22`; aqui elas sao marcadores
 * explicitos, e e isso que os testes de conteudo verificam.
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
  it('monta o cabecalho e as seis paginas do menu', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'CronosComex' })).toBeTruthy()
    expect(within(nav()).getAllByRole('link')).toHaveLength(6)
    expect(await screen.findByText('07/08/2026')).toBeTruthy()
  })

  it('marca a pagina corrente para o leitor de tela', () => {
    render(<App />)

    expect(within(nav()).getByRole('link', { current: 'page' }).textContent).toBe('Início')
  })

  it('hospeda a pagina pendente dizendo qual historia a entrega', () => {
    render(<App />)

    expect(screen.getByText(/Página ainda não implementada/)).toBeTruthy()
    expect(screen.getByText('H-16')).toBeTruthy()
  })
})

describe('navegacao', () => {
  it('troca de pagina sem recarregar, preservando os filtros da query', () => {
    window.history.replaceState(null, '', '/?client=ACME')
    render(<App />)

    fireEvent.click(within(nav()).getByRole('link', { name: 'Alertas' }))

    expect(window.location.pathname).toBe('/alertas')
    expect(window.location.search).toBe('?client=ACME')
    expect(screen.getByText('H-20')).toBeTruthy()
  })

  it('responde ao botao voltar do navegador', async () => {
    render(<App />)
    fireEvent.click(within(nav()).getByRole('link', { name: 'Clientes' }))
    expect(screen.getByText('H-18')).toBeTruthy()

    window.history.back()

    await waitFor(() => expect(screen.getByText('H-16')).toBeTruthy())
  })

  it('exibe a REF no detalhe do processo, rota fora do menu', () => {
    window.history.replaceState(null, '', '/processo/CRO-2026-001')
    render(<App />)

    expect(screen.getByText(/CRO-2026-001/)).toBeTruthy()
    expect(screen.getByText('H-22')).toBeTruthy()
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

describe('botao de atualizacao (A-62)', () => {
  it('chama POST /api/reload antes de refazer as requisicoes', async () => {
    render(<App />)
    await screen.findByText('07/08/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await waitFor(() =>
      expect(api.calls).toEqual(['GET /api/health', 'POST /api/reload', 'GET /api/health']),
    )
  })
})
