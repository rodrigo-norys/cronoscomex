import { vi } from 'vitest'
import type { FilterOptionsResponse } from '../../../src/http/routes/filter-options.ts'
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

/** Enxuto de proposito: os nove blocos existem, com valores que cabem no
 * assert. A rota real e testada em `tests/http/`, sobre a fixture. */
export function filterOptionsFixture(
  overrides: Partial<FilterOptionsResponse> = {},
): FilterOptionsResponse {
  return {
    clients: [
      { key: 'ACME', label: 'ACME', count: 12 },
      { key: 'YRD', label: 'YRD', count: 5 },
    ],
    importers: [{ key: 'IMP', label: 'IMP', count: 3 }],
    vessels: [{ key: 'EVER FAIR', label: 'EVER FAIR', count: 2 }],
    agents: [{ key: 'AG', label: 'AG', count: 4 }],
    goods: [{ key: 'BAZAR', label: 'BAZAR', count: 9 }],
    ports: [
      { key: 'RJ', label: 'RJ', count: 40 },
      { key: 'RO', label: 'RO', count: 2 },
    ],
    categories: [
      { key: 'em_andamento', label: 'Em andamento', count: 103 },
      { key: 'desembaracado', label: 'Desembaraçado', count: 480 },
    ],
    responsible: [{ key: 'colaborador1', label: 'Colaborador 1', count: 20 }],
    channels: [{ key: 'vermelho', label: 'Canal Vermelho', count: 5 }],
    ...overrides,
  }
}

export interface ApiStub {
  /** `METODO /caminho`, na ordem em que foram chamados. Prova a ordem de A-62. */
  readonly calls: string[]
  serve(health: HealthResponse): void
  serveOptions(options: FilterOptionsResponse): void
  failNextHealth(message: string): void
  failOptions(): void
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
  let options = filterOptionsFixture()
  let optionsFails = false

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

      if (url === '/api/filters/options') {
        return Promise.resolve({
          ok: !optionsFails,
          status: optionsFails ? 503 : 200,
          json: () => Promise.resolve(options),
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
    serveOptions: (next) => {
      options = next
    },
    failNextHealth: (message) => {
      healthFailure = message
    },
    failOptions: () => {
      optionsFails = true
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
