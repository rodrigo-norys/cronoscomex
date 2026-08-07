import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MULTI_FILTERS, useFilters } from '../src/hooks/useFilters.ts'

/**
 * A URL e o unico estado dos onze filtros. Nao ha copia em `useState`, entao
 * cada teste aqui le e escreve `window.location` de verdade — e o que a
 * aplicacao faz.
 */

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

function search(): string {
  return window.location.search
}

describe('leitura da URL', () => {
  it('parte de nenhum filtro ativo', () => {
    const { result } = renderHook(() => useFilters())

    expect(result.current.activeCount).toBe(0)
    for (const key of MULTI_FILTERS) expect(result.current.selection.multi[key]).toEqual([])
  })

  it('le valores repetidos do mesmo parametro — o OU de RF-17', () => {
    window.history.replaceState(null, '', '/?client=ACME&client=YRD')

    const { result } = renderHook(() => useFilters())

    expect(result.current.selection.multi.client).toEqual(['ACME', 'YRD'])
    expect(result.current.activeCount).toBe(1)
  })

  it('conta o periodo UMA vez, tendo um extremo ou os dois', () => {
    window.history.replaceState(null, '', '/?etaFrom=2026-08-01&etaTo=2026-08-31')

    const { result } = renderHook(() => useFilters())

    expect(result.current.activeCount).toBe(1)
  })

  it('recusa valor de importerOutsideRj fora do dominio, sem quebrar', () => {
    window.history.replaceState(null, '', '/?importerOutsideRj=talvez')

    const { result } = renderHook(() => useFilters())

    expect(result.current.selection.importerOutsideRj).toBe('')
    expect(result.current.activeCount).toBe(0)
  })

  it('preserva o recorte ao recarregar — a URL e a fonte', () => {
    window.history.replaceState(null, '', '/?category=em_andamento&port=RO')

    const { result } = renderHook(() => useFilters())

    expect(result.current.selection.multi.category).toEqual(['em_andamento'])
    expect(result.current.selection.multi.port).toEqual(['RO'])
    expect(result.current.activeCount).toBe(2)
  })
})

describe('escrita na URL', () => {
  it('marca e desmarca o mesmo valor', () => {
    const { result } = renderHook(() => useFilters())

    act(() => result.current.toggle('client', 'ACME'))
    expect(search()).toBe('?client=ACME')

    act(() => result.current.toggle('client', 'ACME'))
    expect(search()).toBe('')
  })

  it('acumula valores do mesmo filtro em vez de substituir', () => {
    const { result } = renderHook(() => useFilters())

    act(() => result.current.toggle('client', 'ACME'))
    act(() => result.current.toggle('client', 'YRD'))

    expect(new URLSearchParams(search()).getAll('client')).toEqual(['ACME', 'YRD'])
  })

  it('desmarca so o valor pedido, mantendo os demais do mesmo filtro', () => {
    window.history.replaceState(null, '', '/?client=A&client=B&client=C')
    const { result } = renderHook(() => useFilters())

    act(() => result.current.toggle('client', 'B'))

    expect(new URLSearchParams(search()).getAll('client')).toEqual(['A', 'C'])
  })

  it('apaga o parametro em vez de deixar vazio — `?etaFrom=` seria outro filtro', () => {
    window.history.replaceState(null, '', '/?etaFrom=2026-08-01')
    const { result } = renderHook(() => useFilters())

    act(() => result.current.setRange('etaFrom', ''))

    expect(search()).toBe('')
  })

  it('nao empilha historico: filtro e visualizacao, nao navegacao', () => {
    const { result } = renderHook(() => useFilters())
    const before = window.history.length

    act(() => result.current.toggle('client', 'ACME'))
    act(() => result.current.toggle('client', 'YRD'))
    act(() => result.current.toggle('category', 'em_andamento'))

    expect(window.history.length).toBe(before)
  })

  it('limpa os onze e preserva o que nao e filtro', () => {
    window.history.replaceState(null, '', '/?client=ACME&etaFrom=2026-08-01&search=CRO&sort=eta2')
    const { result } = renderHook(() => useFilters())

    act(() => result.current.clearAll())

    const remaining = new URLSearchParams(search())
    expect(remaining.get('client')).toBeNull()
    expect(remaining.get('etaFrom')).toBeNull()
    expect(remaining.get('search')).toBe('CRO')
    expect(remaining.get('sort')).toBe('eta2')
  })

  it('expoe a query inteira para as paginas anexarem as requisicoes', () => {
    window.history.replaceState(null, '', '/?client=ACME&category=em_andamento')
    const { result } = renderHook(() => useFilters())

    expect(result.current.queryString).toBe('?client=ACME&category=em_andamento')
  })
})
