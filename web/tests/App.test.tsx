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

  it('hospeda a Pagina Inicial, entregue por H-16', async () => {
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Cartões-resumo' })).toBeTruthy()
  })

  // As restantes chegam de `H-20` a `H-22`; ate la o marcador diz qual.
  it('hospeda o marcador nas paginas ainda nao implementadas', () => {
    window.history.replaceState(null, '', '/alertas')
    render(<App />)

    expect(screen.getByText(/Página ainda não implementada/)).toBeTruthy()
    expect(screen.getByText('H-20')).toBeTruthy()
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
    fireEvent.click(within(nav()).getByRole('link', { name: 'Alertas' }))
    expect(screen.getByText('H-20')).toBeTruthy()

    window.history.back()

    await waitFor(() => expect(screen.getByRole('region', { name: 'Cartões-resumo' })).toBeTruthy())
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
