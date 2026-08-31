import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ColorMapError, loadColorMap } from '../../src/app/color-map-loader.ts'
import { STYLED_COLUMNS } from '../../src/domain/color-mapper.ts'

let dir: string

const entradaValida = {
  styleKey: 'argb:FF5B9BD5',
  fillId: 8,
  label: 'Azul',
  responsible: 'colaborador1',
  customsChannel: 'indefinido',
  importerOutsideRj: false,
}

function escrever(conteudo: unknown): string {
  const path = join(dir, 'color-map.json')
  writeFileSync(path, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-map-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadColorMap', () => {
  it('carrega o mapa real do projeto com as 9 entradas medidas', () => {
    const entries = loadColorMap('config/color-map.json')

    expect(entries).toHaveLength(9)
    expect(entries.map((e) => e.styleKey)).toContain('argb:FF5B9BD5')
    expect(entries.map((e) => e.styleKey)).toContain('theme:0|tint:0.0000')
  })

  it('todas as entradas reais tem fillId, exigido pela escrita de cor (A-49)', () => {
    for (const entry of loadColorMap('config/color-map.json')) {
      expect(Number.isInteger(entry.fillId), `${entry.styleKey} sem fillId`).toBe(true)
    }
  })

  it('usa a styleKey como label quando o rotulo esta ausente', () => {
    const { label } = entradaValida
    void label
    const semLabel = { ...entradaValida, label: undefined }

    const [entry] = loadColorMap(escrever({ entries: [semLabel] }))

    expect(entry?.label).toBe('argb:FF5B9BD5')
  })

  // Caso-limite de H-04: mapa vazio nao e erro.
  it('aceita mapa vazio: o servico sobe e tudo cai em quarentena', () => {
    expect(loadColorMap(escrever({ entries: [] }))).toEqual([])
  })

  // Caso-limite de H-04: chave repetida falha na partida.
  it('falha indicando as duas posicoes quando ha styleKey repetida', () => {
    const path = escrever({ entries: [entradaValida, { ...entradaValida, fillId: 99 }] })

    expect(() => loadColorMap(path)).toThrow(ColorMapError)
    expect(() => loadColorMap(path)).toThrow(/entries\[0\] e entries\[1\]/)
  })

  it('falha quando o arquivo nao existe', () => {
    expect(() => loadColorMap(join(dir, 'ausente.json'))).toThrow(/nao encontrado/)
  })

  it('falha quando o JSON e invalido', () => {
    expect(() => loadColorMap(escrever('{ nao e json'))).toThrow(/JSON valido/)
  })

  it('falha quando "entries" nao e uma lista', () => {
    expect(() => loadColorMap(escrever({ entries: 'nada' }))).toThrow(/lista "entries"/)
  })

  it('falha quando fillId esta ausente, citando a origem do valor', () => {
    const semFill = { ...entradaValida, fillId: undefined }

    expect(() => loadColorMap(escrever({ entries: [semFill] }))).toThrow(/fillId/)
    expect(() => loadColorMap(escrever({ entries: [semFill] }))).toThrow(/H-01/)
  })

  it('falha quando responsible esta fora do dominio', () => {
    const invalido = { ...entradaValida, responsible: 'joao' }

    expect(() => loadColorMap(escrever({ entries: [invalido] }))).toThrow(/responsible invalido/)
  })

  it('falha quando customsChannel esta fora do dominio', () => {
    const invalido = { ...entradaValida, customsChannel: 'amarelo' }

    expect(() => loadColorMap(escrever({ entries: [invalido] }))).toThrow(/customsChannel invalido/)
  })

  it('falha quando importerOutsideRj nao e booleano', () => {
    const invalido = { ...entradaValida, importerOutsideRj: 'sim' }

    expect(() => loadColorMap(escrever({ entries: [invalido] }))).toThrow(/true ou false/)
  })
})

/**
 * `STYLED_COLUMNS` vive no dominio e `styledColumns` vive no arquivo, e as duas
 * precisam dizer a mesma coisa. `loadColorMap` devolve so as entradas — alargar
 * a assinatura dele alcancaria `process-store` e as fabricas de estado dos
 * testes —, entao quem impede a divergencia e esta assercao.
 *
 * Se ela reprovar, a escolha e uma so: alinhar os dois. Nao ha "qual vence".
 */
describe('as colunas repintadas por H-27', () => {
  it('batem com styledColumns de config/color-map.json', () => {
    const arquivo = JSON.parse(readFileSync('config/color-map.json', 'utf-8')) as {
      styledColumns: string[]
    }

    expect(arquivo.styledColumns).toEqual([...STYLED_COLUMNS])
  })

  it('cobrem A a L, e nenhuma das que tem preenchimento proprio (A-44)', () => {
    expect(STYLED_COLUMNS).toHaveLength(12)
    expect(STYLED_COLUMNS).not.toContain('M')
    expect(STYLED_COLUMNS).not.toContain('P')
  })
})
