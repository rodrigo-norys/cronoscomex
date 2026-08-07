import { vi } from 'vitest'
import type { HealthResponse } from '../../../src/http/routes/health.ts'

export function healthFixture(overrides: Partial<HealthResponse> = {}): HealthResponse {
  return {
    state: 'pronto',
    workbookPath: 'planilha.xlsx',
    sheetName: '2026',
    lastReadAt: '2026-08-07T12:00:00.000Z',
    lastReadOk: true,
    lastReadDurationMs: 120,
    sourceFileHash: 'sha256:0000',
    rowsRead: 649,
    rowsAccepted: 649,
    rowsQuarantined: 0,
    pendingEditsCount: 0,
    degradedReason: null,
    externalLock: false,
    conflictFiles: [],
    today: '2026-08-07',
    ...overrides,
  }
}

export interface ApiStub {
  /** `METODO /caminho`, na ordem em que foram chamados. Prova a ordem de A-62. */
  readonly calls: string[]
  serve(health: HealthResponse): void
  failNextHealth(message: string): void
}

/**
 * Substitui `fetch` pelas duas rotas que a casca conhece. Rota nao prevista
 * rejeita em vez de devolver vazio: teste que bate em endereco errado precisa
 * falhar apontando para o endereco, nao para o `undefined` tres passos adiante.
 */
export function stubApi(initial: HealthResponse = healthFixture()): ApiStub {
  const calls: string[] = []
  let health = initial
  let healthFailure: string | null = null

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? 'GET'} ${url}`)

      if (url === '/api/health') {
        if (healthFailure !== null) {
          const message = healthFailure
          healthFailure = null
          return Promise.reject(new Error(message))
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(health),
        } as Response)
      }

      if (url === '/api/reload') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ reloaded: true }),
        } as Response)
      }

      return Promise.reject(new Error(`rota nao prevista pelo stub: ${url}`))
    }),
  )

  return {
    calls,
    serve: (next) => {
      health = next
    },
    failNextHealth: (message) => {
      healthFailure = message
    },
  }
}

/** `document.hidden` e getter do prototipo; sobrescrever no proprio documento
 * e o caminho que o `jsdom` permite desfazer. */
export function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

export function restoreDocumentHidden(): void {
  Reflect.deleteProperty(document, 'hidden')
}
