import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../../src/app/config.ts'

let dir: string
let workbook: string

function writeConfig(content: unknown): string {
  const path = join(dir, 'app.json')
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-'))
  workbook = join(dir, 'planilha.xlsx')
  writeFileSync(workbook, 'conteudo irrelevante para este teste')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('carrega uma configuracao valida e aplica os defaults', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook }))

    expect(config.workbookPath).toBe(workbook)
    expect(config.sheetName).toBe('2026')
    expect(config.headerRow).toBe(1)
    expect(config.firstDataRow).toBe(2)
    expect(config.port).toBe(5173)
    expect(config.stalledDaysThreshold).toBe(15)
    expect(config.topN).toBe(10)
    expect(config.timezone).toBe('America/Sao_Paulo')
  })

  it('preserva valores explicitos sobre os defaults', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook, port: 8080, topN: 25 }))

    expect(config.port).toBe(8080)
    expect(config.topN).toBe(25)
  })

  // Caso-limite de H-02: arquivo de configuracao ausente
  it('falha citando o arquivo de exemplo quando app.json nao existe', () => {
    const ausente = join(dir, 'nao-existe.json')

    expect(() => loadConfig(ausente)).toThrow(ConfigError)
    expect(() => loadConfig(ausente)).toThrow(/app\.json\.exemplo/)
  })

  // Caso-limite de H-02: workbookPath apontando para caminho inexistente.
  // O erro precisa ocorrer NA PARTIDA, nao em tempo de requisicao.
  it('falha quando a planilha nao existe no caminho configurado', () => {
    const path = writeConfig({ workbookPath: join(dir, 'sumiu.xlsx') })

    expect(() => loadConfig(path)).toThrow(ConfigError)
    expect(() => loadConfig(path)).toThrow(/planilha nao existe/i)
  })

  it('falha quando workbookPath esta ausente ou vazio', () => {
    expect(() => loadConfig(writeConfig({}))).toThrow(/workbookPath/)
    expect(() => loadConfig(writeConfig({ workbookPath: '   ' }))).toThrow(/workbookPath/)
  })

  it('falha quando o JSON e invalido', () => {
    expect(() => loadConfig(writeConfig('{ nao e json'))).toThrow(/JSON valido/)
  })

  it('rejeita porta fora da faixa', () => {
    expect(() => loadConfig(writeConfig({ workbookPath: workbook, port: 70000 }))).toThrow(
      /entre 1 e 65535/,
    )
  })

  it('rejeita firstDataRow menor ou igual a headerRow', () => {
    const path = writeConfig({ workbookPath: workbook, headerRow: 3, firstDataRow: 3 })

    expect(() => loadConfig(path)).toThrow(/maior que "headerRow"/)
  })

  it('aceita sheetName null, que significa primeira aba', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook, sheetName: null }))

    expect(config.sheetName).toBeNull()
  })
})
