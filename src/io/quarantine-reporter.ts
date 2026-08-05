import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AnomalyItem, BuildResult, QuarantineItem } from '../domain/process-builder.ts'
import { quarantineRate } from '../domain/process-builder.ts'

/**
 * Persistencia do relatorio de quarentena e divergencias.
 *
 * O arquivo e sobrescrito a cada leitura: retrata o estado da leitura
 * corrente, nao um historico. O historico de mudancas de status e outro
 * artefato (H-28).
 */

export const DEFAULT_QUARANTINE_PATH = 'data/quarantine.json'

export interface QuarantineReport {
  generatedAt: string
  sourceFileHash: string
  totalDataRows: number
  acceptedRows: number
  quarantinedRows: number
  quarantineRate: number
  items: QuarantineItem[]
  anomalies: AnomalyItem[]
}

export function buildReport(
  result: BuildResult,
  sourceFileHash: string,
  generatedAt: Date,
): QuarantineReport {
  return {
    generatedAt: generatedAt.toISOString(),
    sourceFileHash,
    totalDataRows: result.totalDataRows,
    acceptedRows: result.processes.length,
    quarantinedRows: result.quarantine.length,
    quarantineRate: quarantineRate(result),
    items: result.quarantine,
    anomalies: result.anomalies,
  }
}

/**
 * Grava o relatorio. Falha aqui NAO derruba a leitura: perder o relatorio
 * degrada a auditoria, mas nao o painel. O chamador registra o erro em log.
 */
export function writeReport(
  report: QuarantineReport,
  path: string = DEFAULT_QUARANTINE_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
}

/** Le o ultimo relatorio gravado. `null` quando ainda nao houve leitura. */
export function readReport(path: string = DEFAULT_QUARANTINE_PATH): QuarantineReport | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as QuarantineReport
  } catch {
    return null
  }
}
