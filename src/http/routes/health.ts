import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { type AppState, store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { today as currentDay, toIsoDay } from '../../domain/date-window.ts'

export type { AppState }

export interface HealthResponse {
  state: AppState
  workbookPath: string
  sheetName: string | null
  lastReadAt: string | null
  lastReadOk: boolean
  /** Metrica de RF-16: quanto demorou a ultima leitura concluida. */
  lastReadDurationMs: number | null
  sourceFileHash: string | null
  rowsRead: number
  rowsAccepted: number
  rowsQuarantined: number
  pendingEditsCount: number
  degradedReason: string | null
  /** `H-32`. Alguem tem a planilha aberta no Excel. Sinal, nunca acao (A-58). */
  externalLock: boolean
  /** `H-32`. Arquivos de conflito do OneDrive, so o nome. */
  conflictFiles: string[]
  /**
   * `H-15`. O dia civil do servidor, em `AAAA-MM-DD`, resolvido a cada
   * requisicao pela mesma `today(tz)` dos indicadores.
   *
   * Existe por A-62: indicadores de calendario e alertas dependem do dia
   * corrente, e nenhum arquivo muda a meia-noite — o watcher nao dispara, e uma
   * tela aberta atravessa a virada exibindo a fila de ontem. A casca compara
   * este campo com o dia sob o qual renderizou e revalida quando diferem.
   * `GET /api/indicators` ja expunha o dia em `meta.today`, mas a casca nao o
   * consome: ela consome este health, e o dia precisa vir de uma fonte so.
   */
  today: string
}

/**
 * GET /api/health — contrato em docs/05-contratos-api.md.
 * Nunca falha enquanto o servidor responder; devolve 200 inclusive em
 * estado 'degradado', porque a interface precisa distinguir "sem dado" de
 * "zero processos".
 */
export function registerHealthRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
): void {
  app.get('/api/health', (): HealthResponse => {
    const state = store.getState()

    return {
      state: state.state,
      workbookPath: config.workbookPath,
      // A aba lida so e conhecida apos a primeira leitura; ate la vale a
      // configurada, que pode ser `null` (primeira aba do arquivo).
      sheetName: state.sheetName ?? config.sheetName,
      lastReadAt: state.lastReadAt?.toISOString() ?? null,
      lastReadOk: state.lastReadOk,
      lastReadDurationMs: state.lastReadDurationMs,
      sourceFileHash: state.fileHash,
      rowsRead: state.rowsRead,
      rowsAccepted: state.rowsAccepted,
      rowsQuarantined: state.rowsQuarantined,
      // Fila de edicoes chega em H-23.
      pendingEditsCount: 0,
      degradedReason: state.degradedReason,
      externalLock: state.externalLock,
      conflictFiles: state.conflictFiles,
      today: toIsoDay(currentDay(config.timezone)),
    }
  })
}
