import { describe, expect, it } from 'vitest'
import { extractStyleKey, NO_FILL } from '../../src/io/style-extractor.ts'

const pattern = (fgColor: unknown) => ({
  style: { fill: { type: 'pattern', pattern: 'solid', fgColor } },
})

describe('extractStyleKey — TD-05', () => {
  it('devolve argb em maiusculas', () => {
    expect(extractStyleKey(pattern({ argb: 'FF00B050' }))).toBe('argb:FF00B050')
    expect(extractStyleKey(pattern({ argb: 'ff00b050' }))).toBe('argb:FF00B050')
  })

  it('devolve theme com tint arredondado a 4 casas', () => {
    expect(extractStyleKey(pattern({ theme: 4, tint: -0.249977111117893 }))).toBe(
      'theme:4|tint:-0.2500',
    )
  })

  // O Excel OMITE o atributo tint quando vale zero — a linha branca do arquivo
  // real e <fgColor theme="0"/> —, e o perfilador o escreve. Sem esta
  // normalizacao as duas formas dariam chaves diferentes, e a linha branca
  // cairia em quarentena.
  it('normaliza tint ausente para 0.0000', () => {
    expect(extractStyleKey(pattern({ theme: 0 }))).toBe('theme:0|tint:0.0000')
    expect(extractStyleKey(pattern({ theme: 0, tint: 0 }))).toBe('theme:0|tint:0.0000')
  })

  it('devolve indexed', () => {
    expect(extractStyleKey(pattern({ indexed: 43 }))).toBe('indexed:43')
  })

  it('devolve "none" para celula sem preenchimento', () => {
    expect(extractStyleKey({ style: {} })).toBe(NO_FILL)
    expect(extractStyleKey({})).toBe(NO_FILL)
    expect(extractStyleKey(null)).toBe(NO_FILL)
    expect(extractStyleKey(undefined)).toBe(NO_FILL)
  })

  it('devolve "none" para pattern "none"', () => {
    expect(extractStyleKey({ style: { fill: { type: 'pattern', pattern: 'none' } } })).toBe(NO_FILL)
  })

  // O dicionario de cores da especificacao so contempla preenchimento solido.
  it('devolve "none" para preenchimento em gradiente', () => {
    const gradient = { style: { fill: { type: 'gradient', gradient: 'angle', stops: [] } } }

    expect(extractStyleKey(gradient)).toBe(NO_FILL)
  })

  it('devolve "none" quando fgColor esta ausente', () => {
    expect(extractStyleKey({ style: { fill: { type: 'pattern', pattern: 'solid' } } })).toBe(
      NO_FILL,
    )
  })

  it('aceita fill na raiz da celula, alem de style.fill', () => {
    const raiz = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } } }

    expect(extractStyleKey(raiz)).toBe('argb:FFFF0000')
  })

  it('produz chave estavel: a mesma entrada gera sempre a mesma saida', () => {
    const cell = pattern({ theme: 9, tint: 0.39997558519241921 })

    expect(extractStyleKey(cell)).toBe(extractStyleKey(cell))
    expect(extractStyleKey(cell)).toBe('theme:9|tint:0.4000')
  })
})
