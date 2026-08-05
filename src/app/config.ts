import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Configuracao da aplicacao. Ver docs/03-modelo-dados.md secao 3.5. */
export interface AppConfig {
  /** Caminho absoluto do .xlsx na pasta sincronizada do OneDrive. */
  workbookPath: string
  /** Aba a ler. Medido em H-01: apenas '2026' esta em escopo (A-46, D-10). */
  sheetName: string | null
  headerRow: number
  firstDataRow: number
  port: number
  /** Limiar do alerta ALE-06, em dias. Premissa, nao regra declarada (A-32). */
  stalledDaysThreshold: number
  /** Top N dos rankings (A-25). */
  topN: number
  timezone: string
}

export const CONFIG_EXAMPLE_PATH = 'config/app.json.exemplo'
const DEFAULT_CONFIG_PATH = 'config/app.json'

export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

const DEFAULTS = {
  sheetName: '2026',
  headerRow: 1,
  firstDataRow: 2,
  port: 5173,
  stalledDaysThreshold: 15,
  topN: 10,
  timezone: 'America/Sao_Paulo',
} as const

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`"${key}" e obrigatorio e deve ser um texto nao vazio.`)
  }
  return value
}

function optionalNumber(raw: Record<string, unknown>, key: string, fallback: number): number {
  const value = raw[key]
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ConfigError(`"${key}" deve ser um numero inteiro nao negativo.`)
  }
  return value
}

/**
 * Carrega e valida a configuracao. Lanca ConfigError na partida, nunca em
 * tempo de requisicao: um caminho invalido deve impedir o servidor de subir,
 * e nao produzir erro quando o operador ja estiver usando o painel.
 */
export function loadConfig(path: string = DEFAULT_CONFIG_PATH): AppConfig {
  if (!existsSync(path)) {
    throw new ConfigError(
      `Arquivo de configuracao nao encontrado: ${path}\n` +
        `Copie ${CONFIG_EXAMPLE_PATH} para ${path} e ajuste o caminho da planilha.`,
    )
  }

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch (cause) {
    throw new ConfigError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const workbookPath = resolve(requireString(raw, 'workbookPath'))
  if (!existsSync(workbookPath)) {
    throw new ConfigError(
      `A planilha nao existe no caminho configurado:\n  ${workbookPath}\n` +
        'Confira "workbookPath" e se a pasta do OneDrive esta sincronizada.',
    )
  }

  const sheetName =
    raw.sheetName === null ? null : ((raw.sheetName as string) ?? DEFAULTS.sheetName)
  if (sheetName !== null && (typeof sheetName !== 'string' || sheetName.trim() === '')) {
    throw new ConfigError('"sheetName" deve ser um texto nao vazio ou null.')
  }

  const timezone = (raw.timezone as string) ?? DEFAULTS.timezone
  if (typeof timezone !== 'string' || timezone.trim() === '') {
    throw new ConfigError('"timezone" deve ser um texto nao vazio.')
  }

  const headerRow = optionalNumber(raw, 'headerRow', DEFAULTS.headerRow)
  const firstDataRow = optionalNumber(raw, 'firstDataRow', DEFAULTS.firstDataRow)
  if (firstDataRow <= headerRow) {
    throw new ConfigError('"firstDataRow" deve ser maior que "headerRow".')
  }

  const port = optionalNumber(raw, 'port', DEFAULTS.port)
  if (port < 1 || port > 65535) {
    throw new ConfigError('"port" deve estar entre 1 e 65535.')
  }

  return {
    workbookPath,
    sheetName,
    headerRow,
    firstDataRow,
    port,
    stalledDaysThreshold: optionalNumber(
      raw,
      'stalledDaysThreshold',
      DEFAULTS.stalledDaysThreshold,
    ),
    topN: optionalNumber(raw, 'topN', DEFAULTS.topN),
    timezone,
  }
}
