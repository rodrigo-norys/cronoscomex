import { afterEach, describe, expect, it } from 'vitest'
import { NAV_PAGES, navigate, pageOf, parseRoute } from '../src/router.ts'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('parseRoute', () => {
  it('reconhece as seis paginas do menu', () => {
    for (const page of NAV_PAGES) {
      expect(parseRoute(page.path)).toEqual({ pageId: page.id, ref: null })
    }
  })

  it('ignora a barra final, que o navegador acrescenta sozinho', () => {
    expect(parseRoute('/alertas/')).toEqual({ pageId: 'alerts', ref: null })
    expect(parseRoute('/')).toEqual({ pageId: 'home', ref: null })
  })

  it('extrai a REF do detalhe do processo', () => {
    expect(parseRoute('/processo/CRO-2026-001')).toEqual({
      pageId: 'processDetail',
      ref: 'CRO-2026-001',
    })
  })

  it('decodifica a REF, que pode conter caractere reservado de URL', () => {
    expect(parseRoute('/processo/A%2FB')).toEqual({ pageId: 'processDetail', ref: 'A/B' })
  })

  it('trata detalhe sem REF como endereco desconhecido, nao como pagina vazia', () => {
    expect(parseRoute('/processo/')).toEqual({ pageId: 'notFound', ref: null })
  })

  it('devolve notFound para endereco fora do mapa', () => {
    expect(parseRoute('/relatorios')).toEqual({ pageId: 'notFound', ref: null })
  })
})

describe('pageOf', () => {
  it('resolve a definicao do detalhe, que nao esta no menu', () => {
    expect(pageOf({ pageId: 'processDetail', ref: 'X' })?.story).toBe('H-22')
  })

  it('devolve null para notFound, que nao e pagina', () => {
    expect(pageOf({ pageId: 'notFound', ref: null })).toBeNull()
  })
})

describe('navigate', () => {
  it('preserva a query ao trocar de pagina — e onde os onze filtros vivem', () => {
    window.history.replaceState(null, '', '/?client=ACME&category=em_andamento')

    navigate('/alertas')

    expect(window.location.pathname).toBe('/alertas')
    expect(window.location.search).toBe('?client=ACME&category=em_andamento')
  })

  it('emite popstate, que pushState sozinho nao faz', () => {
    let notified = 0
    const listener = (): void => {
      notified += 1
    }
    window.addEventListener('popstate', listener)

    navigate('/clientes')
    window.removeEventListener('popstate', listener)

    expect(notified).toBe(1)
  })

  it('nao empilha entrada quando o destino ja e o endereco atual', () => {
    window.history.replaceState(null, '', '/performance')
    let notified = 0
    const listener = (): void => {
      notified += 1
    }
    window.addEventListener('popstate', listener)

    navigate('/performance')
    window.removeEventListener('popstate', listener)

    expect(notified).toBe(0)
  })
})
