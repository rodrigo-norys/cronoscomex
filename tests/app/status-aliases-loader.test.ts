import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadStatusAliases, StatusAliasesError } from '../../src/app/status-aliases-loader.ts'

let dir: string

function escrever(conteudo: unknown): string {
  const path = join(dir, 'status-aliases.json')
  writeFileSync(path, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-alias-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadStatusAliases', () => {
  it('carrega o dicionario real do projeto com as duas grafias medidas', () => {
    const aliases = loadStatusAliases('config/status-aliases.json')

    expect(aliases).toContain('DESEMBARACADA')
    expect(aliases).toContain('DESEMBARCADA')
  })

  it('devolve as formas ja normalizadas', () => {
    const aliases = loadStatusAliases(escrever({ desembaracado: ['  Desembaraçada  '] }))

    expect(aliases).toEqual(['DESEMBARACADA'])
  })

  it('remove duplicatas que colapsam apos a normalizacao', () => {
    const path = escrever({ desembaracado: ['DESEMBARAÇADA', 'desembaracada', 'DESEMBARACADA'] })

    expect(loadStatusAliases(path)).toEqual(['DESEMBARACADA'])
  })

  // Caso-limite de H-06: sem dicionario, nenhum processo seria concluido.
  // Falhar na partida e preferivel a mostrar zero desembaracados como normal.
  it('falha quando a chave desembaracado esta ausente', () => {
    const path = escrever({ outra: ['X'] })

    expect(() => loadStatusAliases(path)).toThrow(StatusAliasesError)
    expect(() => loadStatusAliases(path)).toThrow(/nenhum processo seria classificado/)
  })

  it('falha quando a lista esta vazia', () => {
    expect(() => loadStatusAliases(escrever({ desembaracado: [] }))).toThrow(/ao menos uma grafia/)
  })

  it('falha quando uma grafia nao e texto', () => {
    expect(() => loadStatusAliases(escrever({ desembaracado: [123] }))).toThrow(
      /desembaracado\[0\]/,
    )
  })

  it('falha quando uma grafia e vazia', () => {
    expect(() => loadStatusAliases(escrever({ desembaracado: ['   '] }))).toThrow(/texto nao vazio/)
  })

  it('falha quando o arquivo nao existe', () => {
    expect(() => loadStatusAliases(join(dir, 'ausente.json'))).toThrow(/nao encontrado/)
  })

  it('falha quando o JSON e invalido', () => {
    expect(() => loadStatusAliases(escrever('{ nao e json'))).toThrow(/JSON valido/)
  })
})
