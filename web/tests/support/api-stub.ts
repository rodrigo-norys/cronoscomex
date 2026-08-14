import { vi } from 'vitest'
import type { AlertsResponse } from '../../../src/http/routes/alerts.ts'
import type { ApplyResponse } from '../../../src/http/routes/apply.ts'
import type { FilterOptionsResponse } from '../../../src/http/routes/filter-options.ts'
import type { HealthResponse } from '../../../src/http/routes/health.ts'
import type { IndicatorsResponse } from '../../../src/http/routes/indicators.ts'
import type {
  ProcessDetailResponse,
  ProcessDto,
  ProcessesResponse,
} from '../../../src/http/routes/processes.ts'
import type { QuarantineResponse } from '../../../src/http/routes/quarantine.ts'

/**
 * Os valores medidos na planilha real em 07/08/2026, e nao numeros inventados:
 * a soma das quatro categorias fecha com o total por construcao, entao um teste
 * que quebre essa invariante quebra por escolha explicita, nao por descuido na
 * fixture.
 */
export function indicatorsFixture(
  countsOverrides: Partial<IndicatorsResponse['counts']> = {},
): IndicatorsResponse {
  return {
    counts: {
      total: 649,
      emAndamento: 103,
      emDesembaraco: 32,
      desembaracados: 480,
      fechadoAguardandoDraft: 34,
      canalVermelho: 5,
      chegandoHoje: 0,
      chegandoSemana: 2,
      chegando15Dias: 60,
      atrasados: 17,
      documentosPendentes: 14,
      // IND-16. Zero MEDIDO, nao ausencia: o RG mais recente da planilha e
      // 31/07, e passando esse dia a funcao devolve 3.
      desembaracadosHoje: 0,
      ...countsOverrides,
    },
    rankings: { clients: [], importers: [], agents: [], goods: [], responsible: [] },
    expectedVessels: [],
    arrivalCalendar: [],
    documentaryLeadTime: {
      averageDays: 12.5,
      sampleSize: 101,
      excludedNegative: 1,
      excludedIncomplete: 547,
    },
    // `H-19`. Os totais sao os medidos na planilha real: 509 grupos de cliente,
    // 35 de agente, 70 de navio e as 4 chaves fixas de responsavel. As listas
    // ficam vazias de proposito — cada teste serve o recorte que exercita.
    leadTimeByGroup: {
      clients: [],
      agents: [],
      vessels: [],
      responsible: [],
      groupTotals: { clients: 509, agents: 35, vessels: 70, responsible: 4 },
    },
    meta: {
      topN: 10,
      today: '2026-08-07',
      timezone: 'America/Sao_Paulo',
      weekEnd: '2026-08-09',
      bazarShare: 0.3547,
    },
  }
}

/**
 * Os valores medidos na planilha real em 07/08/2026: 40 linhas achatadas para
 * 25 processos distintos. `items` fica vazio de proposito — cada teste serve o
 * recorte que exercita.
 *
 * `processos_parados` e zero por motivo ESTRUTURAL: a rota passa um historico
 * vazio ate `H-28`. `chegadas_hoje` e zero MEDIDO. Os dois numeros sao iguais e
 * significam coisas opostas, e a pagina precisa distingui-los.
 */
export function alertsFixture(overrides: Partial<AlertsResponse> = {}): AlertsResponse {
  return {
    items: [],
    countsByType: {
      eta_vencida: 17,
      canal_vermelho: 2,
      documentacao_pendente: 14,
      processos_parados: 0,
      chegadas_hoje: 0,
      chegadas_7_dias: 7,
    },
    stalledThresholdDays: 15,
    historyStartedAt: null,
    ...overrides,
  }
}

export function processFixture(overrides: Partial<ProcessDto> = {}): ProcessDto {
  return {
    ref: 'FT501.26',
    sourceRow: 502,
    client: 'ACME LOG',
    importer: 'IMPORTADORA X',
    billOfLading: 'NBSC260812',
    agent: 'B&M',
    container: 'TCLU1234567',
    vessel: 'EVER FAIR',
    port: 'RJ',
    goods: 'BAZAR',
    eta2: '2026-08-20',
    registrationDate: null,
    docsSentDate: null,
    statusRaw: 'EM ANDAMENTO',
    statusCategory: 'em_andamento',
    responsible: 'colaborador1',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    anomalies: [],
    hasPendingEdits: false,
    ...overrides,
  }
}

export function processesFixture(
  items: ProcessDto[] = [processFixture()],
  overrides: Partial<ProcessesResponse> = {},
): ProcessesResponse {
  return { items, total: items.length, limit: 200, offset: 0, ...overrides }
}

/**
 * O detalhe. `anomalies` traz o texto que vem do dominio, e os tres campos
 * seguintes ficam vazios ate `H-23` e `H-28` — `daysInCurrentCategory` e `null`,
 * nunca `0`: zero afirmaria que a categoria mudou hoje.
 */
export function processDetailFixture(
  overrides: Partial<ProcessDetailResponse> = {},
): ProcessDetailResponse {
  return {
    process: processFixture(),
    anomalies: [],
    pendingEdits: [],
    statusHistory: [],
    daysInCurrentCategory: null,
    ...overrides,
  }
}

export function quarantineFixture(overrides: Partial<QuarantineResponse> = {}): QuarantineResponse {
  return {
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceFileHash: 'sha256:0000',
    totalDataRows: 649,
    acceptedRows: 649,
    quarantinedRows: 0,
    quarantineRate: 0,
    items: [],
    anomalies: [],
    ...overrides,
  }
}

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
  serveIndicators(indicators: IndicatorsResponse): void
  serveAlerts(alerts: AlertsResponse): void
  alertsWithoutRead(): void
  failAlerts(): void
  serveProcesses(page: ProcessesResponse): void
  serveProcessDetail(detail: ProcessDetailResponse): void
  /** `POST /api/edits` passa a recusar com esta mensagem. */
  failEnqueueEdit(message: string): void
  /** `POST /api/edits/apply` passa a responder 200 com este corpo. */
  serveApply(response: Partial<ApplyResponse>): void
  /** `POST /api/edits/apply` passa a recusar, com o corpo do envelope de erro. */
  refuseApply(status: number, code: string, message: string, detail?: unknown): void
  /** O `fetch` de `POST /api/edits/apply` passa a REJEITAR, como falha de rede. */
  failApplyNetwork(): void
  processDetailNotFound(): void
  processDetailWithoutRead(): void
  failProcessDetail(): void
  processesWithoutRead(): void
  failProcesses(): void
  serveQuarantine(report: QuarantineResponse): void
  /** `503 ARQUIVO_INDISPONIVEL`: nunca houve leitura. Nao e falha de rede. */
  indicatorsWithoutRead(): void
  failIndicators(): void
}

/**
 * Substitui `fetch` pelas rotas que a interface conhece. Rota nao prevista
 * rejeita em vez de devolver vazio: teste que bate em endereco errado precisa
 * falhar apontando para o endereco, nao para o `undefined` tres passos adiante.
 */
export function stubApi(initial: HealthResponse = healthFixture()): ApiStub {
  const calls: string[] = []
  let health = initial
  let healthFailure: string | null = null
  let options = filterOptionsFixture()
  let optionsFails = false
  let indicators = indicatorsFixture()
  let indicatorsStatus = 200
  let alerts = alertsFixture()
  let alertsStatus = 200
  let quarantine = quarantineFixture()
  let processes = processesFixture()
  let processesStatus = 200
  let detail = processDetailFixture()
  let detailStatus = 200
  let enqueueFailure: string | null = null
  let apply: ApplyResponse = {
    applied: 1,
    cellsWritten: 1,
    backupPath: 'data/backups/planilha-20260814-143512.xlsx',
    archivedQueuePath: 'data/applied/pending-edits-20260814-143512.jsonl',
    durationMs: 210,
    validated: true,
  }
  let applyRefusal: { status: number; body: unknown } | null = null
  let applyNetworkFails = false

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? 'GET'} ${url}`)

      // A query dos filtros vem anexada; o roteamento do stub e por caminho.
      const [path = url] = url.split('?')

      if (path === '/api/indicators') {
        return Promise.resolve({
          ok: indicatorsStatus === 200,
          status: indicatorsStatus,
          json: () => Promise.resolve(indicators),
        } as Response)
      }

      if (path === '/api/alerts') {
        return Promise.resolve({
          ok: alertsStatus === 200,
          status: alertsStatus,
          json: () => Promise.resolve(alerts),
        } as Response)
      }

      // As rotas de edicao de `H-23`. O stub nao mantem fila: cada teste serve
      // o detalhe que quer ver, e o que se verifica aqui e a chamada.
      if (path === '/api/edits') {
        if (init?.method === 'POST' && enqueueFailure !== null) {
          const message = enqueueFailure
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: { code: 'CORPO_INVALIDO', message } }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: init?.method === 'POST' ? 201 : 200,
          json: () => Promise.resolve({ items: [], count: 0, discarded: 0 }),
        } as Response)
      }

      // Antes do `startsWith` abaixo, que devolveria 204 para esta rota.
      if (path === '/api/edits/apply') {
        if (applyNetworkFails) return Promise.reject(new Error('Failed to fetch'))
        if (applyRefusal !== null) {
          const { status, body } = applyRefusal
          return Promise.resolve({
            ok: false,
            status,
            json: () => Promise.resolve(body),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(apply),
        } as Response)
      }

      if (path.startsWith('/api/edits/')) {
        return Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve({}),
        } as Response)
      }

      if (path.startsWith('/api/processes/')) {
        return Promise.resolve({
          ok: detailStatus === 200,
          status: detailStatus,
          json: () => Promise.resolve(detail),
        } as Response)
      }

      if (path === '/api/processes') {
        return Promise.resolve({
          ok: processesStatus === 200,
          status: processesStatus,
          json: () => Promise.resolve(processes),
        } as Response)
      }

      if (path === '/api/quarantine') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(quarantine),
        } as Response)
      }

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
    serveIndicators: (next) => {
      indicators = next
    },
    serveQuarantine: (next) => {
      quarantine = next
    },
    indicatorsWithoutRead: () => {
      indicatorsStatus = 503
    },
    failIndicators: () => {
      indicatorsStatus = 500
    },
    serveAlerts: (next) => {
      alerts = next
    },
    alertsWithoutRead: () => {
      alertsStatus = 503
    },
    failAlerts: () => {
      alertsStatus = 500
    },
    serveProcesses: (next) => {
      processes = next
    },
    serveProcessDetail: (next) => {
      detail = next
    },
    serveApply: (next) => {
      apply = { ...apply, ...next }
      applyRefusal = null
    },
    refuseApply: (status, code, message, detail) => {
      applyRefusal = { status, body: { error: { code, message, detail } } }
    },
    failApplyNetwork: () => {
      applyNetworkFails = true
    },
    failEnqueueEdit: (message) => {
      enqueueFailure = message
    },
    processDetailNotFound: () => {
      detailStatus = 404
    },
    processDetailWithoutRead: () => {
      detailStatus = 503
    },
    failProcessDetail: () => {
      detailStatus = 500
    },
    processesWithoutRead: () => {
      processesStatus = 503
    },
    failProcesses: () => {
      processesStatus = 500
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
