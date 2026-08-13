import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Log estruturado de ingestao e escrita — JSON por linha, um arquivo por dia.
 *
 * A defesa de RNF-33 esta no TIPO, nao num filtro de texto: `LogEntry` nao tem
 * campo de texto livre. Sem `message` e sem `detail`, nao ha por onde vazar
 * nome de cliente, conteudo de celula ou texto de STATUS. `errorCode` e codigo,
 * nao frase. A serializacao ainda copia apenas as chaves conhecidas, para que
 * um chamador que force um campo extra por cast nao consiga grava-lo.
 */

export const DEFAULT_LOG_DIR = 'data/logs'
export const RETENTION_DAYS = 30

export type LogLevel = 'info' | 'warn' | 'error'

/** Catalogo fechado de 06-backlog.md, H-31. */
export type LogEvent =
  | 'read.start'
  | 'read.done'
  | 'read.failed'
  | 'write.start'
  | 'write.refused'
  | 'write.done'
  | 'write.restored'
  | 'history.appended'
  | 'quarantine.reported'

/** Codigos de `read.failed`, reaproveitados de 05-contratos-api.md secao 1.2. */
export type ReadErrorCode = 'ARQUIVO_INDISPONIVEL' | 'ERRO_INTERNO'

export interface LogEntry {
  ts: string
  level: LogLevel
  event: LogEvent
  durationMs?: number
  rowsRead?: number
  rowsAccepted?: number
  rowsQuarantined?: number
  /**
   * Exigido por 08-qualidade-operacao.md secao 3.1 para `quarantine.reported`,
   * mas ausente do `LogEntry` de H-31. Acrescentado — sem ele o evento nao
   * carrega o numero que dispara o alerta de RNF-24.
   */
  quarantineRate?: number
  cellsWritten?: number
  /**
   * Quantas edicoes a escrita vai tentar aplicar. Exigido por
   * 08-qualidade-operacao.md secao 3.1 para `write.start`, e nomeado assim
   * porque naquele instante nada foi aplicado ainda.
   */
  edits?: number
  /**
   * Caminho da copia de seguranca, em `write.done` e `write.restored`
   * (08-qualidade-operacao.md secao 3.1). E relativo e fica dentro de
   * `data/backups/`: nao carrega nome de cliente nem de arquivo de producao,
   * porque `backup-manager` grava com o prefixo literal `planilha`.
   */
  backupPath?: string
  ref?: string
  sourceRow?: number
  errorCode?: string
}

export type LogInput = Omit<LogEntry, 'ts'>

/**
 * Unicas chaves que chegam ao arquivo. Acrescentar campo aqui e decisao de
 * privacidade, nao de conveniencia — ver 08-qualidade-operacao.md secao 4.4.
 */
const SERIALIZED_FIELDS: readonly (keyof LogEntry)[] = [
  'ts',
  'level',
  'event',
  'durationMs',
  'rowsRead',
  'rowsAccepted',
  'rowsQuarantined',
  'quarantineRate',
  'cellsWritten',
  'edits',
  'backupPath',
  'ref',
  'sourceRow',
  'errorCode',
]

export interface Logger {
  log(entry: LogInput): void
  /** Remove os arquivos vencidos e devolve os caminhos removidos. */
  purgeExpired(): string[]
  /** Caminho do arquivo do dia corrente. */
  currentFile(): string
}

export interface LoggerOptions {
  directory?: string
  /** RNF-30. O nome do arquivo segue o dia civil do operador, nao o UTC. */
  timezone?: string
  now?: () => Date
}

const FILE_PATTERN = /^app-(\d{4})(\d{2})(\d{2})\.jsonl$/
const DAY_MS = 86_400_000

function dayStamp(date: Date, timezone: string): string {
  // 'en-CA' formata como AAAA-MM-DD, o que torna o recorte trivial.
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return formatted.replaceAll('-', '')
}

function stampToUtcDay(year: string, month: string, day: string): number {
  return Date.UTC(Number(year), Number(month) - 1, Number(day))
}

function serialize(entry: LogEntry): string {
  const clean: Record<string, unknown> = {}
  for (const field of SERIALIZED_FIELDS) {
    const value = entry[field]
    if (value !== undefined) clean[field] = value
  }
  return `${JSON.stringify(clean)}\n`
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const directory = options.directory ?? DEFAULT_LOG_DIR
  const timezone = options.timezone ?? 'America/Sao_Paulo'
  const now = options.now ?? ((): Date => new Date())
  let warned = false

  function fileFor(date: Date): string {
    return join(directory, `app-${dayStamp(date, timezone)}.jsonl`)
  }

  return {
    log(entry: LogInput): void {
      const moment = now()
      try {
        mkdirSync(directory, { recursive: true })
        appendFileSync(fileFor(moment), serialize({ ...entry, ts: moment.toISOString() }), 'utf-8')
      } catch {
        // Log nao e critico: perde-se o diagnostico, nao a operacao. O aviso
        // sai uma unica vez para nao inundar o terminal do operador.
        if (!warned && process.env.NODE_ENV !== 'test') {
          warned = true
          process.stderr.write(
            `Aviso: nao foi possivel gravar em ${directory}. A aplicacao continua.\n`,
          )
        }
      }
    },

    purgeExpired(): string[] {
      let names: string[]
      try {
        names = readdirSync(directory)
      } catch {
        return []
      }

      const today = dayStamp(now(), timezone)
      const todayUtc = stampToUtcDay(today.slice(0, 4), today.slice(4, 6), today.slice(6, 8))
      const removed: string[] = []

      for (const name of names) {
        const match = FILE_PATTERN.exec(name)
        if (!match?.[1] || !match[2] || !match[3]) continue

        const ageDays = (todayUtc - stampToUtcDay(match[1], match[2], match[3])) / DAY_MS
        if (ageDays <= RETENTION_DAYS) continue

        const path = join(directory, name)
        try {
          rmSync(path)
          removed.push(path)
        } catch {
          // Arquivo em uso ou sem permissao: fica para a proxima partida.
        }
      }
      return removed
    },

    currentFile(): string {
      return fileFor(now())
    },
  }
}

/** Logger inerte, para quando nenhum destino de log foi configurado. */
export const NULL_LOGGER: Logger = {
  log: () => undefined,
  purgeExpired: () => [],
  currentFile: () => '',
}
