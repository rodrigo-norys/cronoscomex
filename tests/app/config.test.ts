import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig, WORKBOOK_UNSET } from '../../src/app/config.ts'

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

  /**
   * As tres assercoes abaixo foram INVERTIDAS em H-34, e a inversao e a
   * historia. Ate ela, cada uma destas condicoes matava a partida — e isso
   * criava um circulo: `config/app.json` nao e versionado, entao numa
   * instalacao nova o processo morria antes de servir a tela de configuracao
   * que existe para consertar o caminho.
   */
  it('sobe sem app.json, com o caminho nao configurado', () => {
    const config = loadConfig(join(dir, 'nao-existe.json'))

    expect(config.workbookPath).toBe(WORKBOOK_UNSET)
    expect(config.port).toBe(5173)
  })

  // O caminho declarado e PRESERVADO mesmo inexistente: a tela mostra para onde
  // a aplicacao estava apontando, e o store entra em 'degradado' com a razao.
  it('sobe com a planilha inexistente, preservando o caminho configurado', () => {
    const sumiu = join(dir, 'sumiu.xlsx')

    expect(loadConfig(writeConfig({ workbookPath: sumiu })).workbookPath).toBe(sumiu)
  })

  it('trata workbookPath ausente ou so com espacos como nao configurado', () => {
    expect(loadConfig(writeConfig({})).workbookPath).toBe(WORKBOOK_UNSET)
    expect(loadConfig(writeConfig({ workbookPath: '   ' })).workbookPath).toBe(WORKBOOK_UNSET)
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
