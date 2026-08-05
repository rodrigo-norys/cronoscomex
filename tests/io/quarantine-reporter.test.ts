import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexColorMap } from '../../src/domain/color-mapper.ts'
import { type BuildResult, buildProcesses } from '../../src/domain/process-builder.ts'
import { ALL_COLUMNS } from '../../src/domain/status-classifier.ts'
import type { RawCell, RawRow } from '../../src/domain/types.ts'
import { buildReport, readReport, writeReport } from '../../src/io/quarantine-reporter.ts'

let dir: string
const deps = { colorMap: indexColorMap([]), statusAliases: ['DESEMBARACADA'] }

function linha(sourceRow: number, ref: string | null): RawRow {
  const cells: Record<string, RawCell> = {}
  for (const c of ALL_COLUMNS)
    cells[c] = { value: c === 'A' ? ref : null, type: ref ? 'string' : 'null' }
  return { sourceRow, cells, styleKey: 'none' }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-quar-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('quarantine-reporter', () => {
  const resultado = (): BuildResult =>
    buildProcesses([linha(2, 'FT001.26'), linha(3, 'FT002.26')], deps)

  it('monta o relatorio com os contadores e a taxa', () => {
    const report = buildReport(resultado(), 'sha256:abc', new Date('2026-08-03T14:00:00Z'))

    expect(report.generatedAt).toBe('2026-08-03T14:00:00.000Z')
    expect(report.sourceFileHash).toBe('sha256:abc')
    expect(report.totalDataRows).toBe(2)
    expect(report.acceptedRows).toBe(2)
    // sem color-map, as duas linhas ficam com COR_NAO_MAPEADA
    expect(report.quarantinedRows).toBe(2)
    expect(report.quarantineRate).toBe(1)
  })

  it('grava e rele o relatorio, criando o diretorio se preciso', () => {
    const path = join(dir, 'sub', 'quarantine.json')
    const report = buildReport(resultado(), 'sha256:abc', new Date('2026-08-03T14:00:00Z'))

    writeReport(report, path)

    expect(readReport(path)).toEqual(report)
  })

  it('devolve null quando ainda nao houve leitura', () => {
    expect(readReport(join(dir, 'ausente.json'))).toBeNull()
  })

  it('devolve null em vez de lancar quando o arquivo esta corrompido', () => {
    const path = join(dir, 'quebrado.json')
    writeReport(buildReport(resultado(), 'x', new Date()), path)
    rmSync(path)
    require('node:fs').writeFileSync(path, '{ corrompido')

    expect(readReport(path)).toBeNull()
  })
})
