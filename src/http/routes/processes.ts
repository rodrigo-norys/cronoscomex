import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { toIsoDay } from '../../domain/date-window.ts'
import {
  DEFAULT_LIMIT,
  isActive,
  MAX_LIMIT,
  matchesSearch,
  paginate,
  SORT_FIELDS,
  type SortField,
  type SortOrder,
  sortProcesses,
} from '../../domain/process-query.ts'
import type {
  AnomalyCode,
  CustomsChannel,
  Process,
  Responsible,
  StatusCategory,
} from '../../domain/types.ts'
import { apiError } from '../errors.ts'
import { filteredProcesses } from '../filter-request.ts'

/**
 * O processo como a interface o ve — contrato em `docs/05-contratos-api.md`.
 *
 * Diferencas deliberadas em relacao a `Process` do dominio: datas viram
 * `AAAA-MM-DD` em texto, as chaves de agrupamento **nao** saem (sao internas),
 * e os campos `*Raw` fora de escopo saem como texto puro, para exibicao no
 * detalhe e em lugar nenhum mais (§2.1).
 */
export interface ProcessDto {
  ref: string
  sourceRow: number
  client: string
  importer: string
  billOfLading: string
  agent: string
  container: string
  vessel: string
  port: string
  goods: string
  eta2: string | null
  registrationDate: string | null
  docsSentDate: string | null
  statusRaw: string
  statusCategory: StatusCategory
  responsible: Responsible
  customsChannel: CustomsChannel
  importerOutsideRj: boolean | null
  boletoRaw: string
  paymentRaw: string
  columnPRaw: string
  anomalies: AnomalyCode[]
  /**
   * A fila de edicoes so existe em `H-23`, entao hoje e sempre `false` — como
   * `pendingEditsCount` no health. O campo entra no contrato desde ja para a
   * interface nao precisar mudar depois, e vale `false` porque **nao ha edicao
   * pendente**, nao porque a informacao falta.
   */
  hasPendingEdits: boolean
}

export interface ProcessesResponse {
  items: ProcessDto[]
  /** O conjunto filtrado INTEIRO, nao a pagina: e o denominador da paginacao. */
  total: number
  limit: number
  offset: number
}

function toDto(process: Process): ProcessDto {
  return {
    ref: process.ref,
    sourceRow: process.sourceRow,
    client: process.clientRaw,
    importer: process.importerRaw,
    billOfLading: process.billOfLading,
    agent: process.agentRaw,
    container: process.container,
    vessel: process.vesselRaw,
    port: process.portRaw,
    goods: process.goodsRaw,
    eta2: process.eta2 === null ? null : toIsoDay(process.eta2),
    registrationDate: process.registrationDate === null ? null : toIsoDay(process.registrationDate),
    docsSentDate: process.docsSentDate === null ? null : toIsoDay(process.docsSentDate),
    statusRaw: process.statusRaw,
    statusCategory: process.statusCategory,
    responsible: process.responsible,
    customsChannel: process.customsChannel,
    importerOutsideRj: process.importerOutsideRj,
    boletoRaw: process.boletoRaw,
    paymentRaw: process.paymentRaw,
    columnPRaw: process.columnPRaw,
    anomalies: [...process.anomalies],
    hasPendingEdits: false,
  }
}

interface ProcessesQuery {
  search?: string
  activeOnly?: string
  sort?: string
  order?: string
  limit?: string
  offset?: string
}

class QueryError extends Error {}

function parseSort(raw: string | undefined): SortField {
  if (raw === undefined) return 'eta2'
  if ((SORT_FIELDS as readonly string[]).includes(raw)) return raw as SortField
  throw new QueryError(`"sort" deve ser um de: ${SORT_FIELDS.join(', ')}.`)
}

function parseOrder(raw: string | undefined): SortOrder {
  if (raw === undefined) return 'asc'
  if (raw === 'asc' || raw === 'desc') return raw
  throw new QueryError('"order" deve ser "asc" ou "desc".')
}

function parseBoolean(raw: string | undefined, field: string): boolean {
  if (raw === undefined) return false
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new QueryError(`"${field}" deve ser "true" ou "false".`)
}

function parseInteger(raw: string | undefined, field: string, min: number, max: number): number {
  if (raw === undefined) return field === 'limit' ? DEFAULT_LIMIT : 0

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new QueryError(`"${field}" deve ser inteiro entre ${min} e ${max}.`)
  }
  return value
}

/**
 * GET /api/processes — contrato em `docs/05-contratos-api.md`.
 *
 * Marcada **[F]**: os onze filtros globais valem aqui, e sao aplicados **antes**
 * da busca, da ordenacao e da paginacao. A ordem importa — `total` precisa ser
 * do conjunto filtrado inteiro, e paginar antes de contar daria o tamanho da
 * pagina.
 *
 * Nenhuma regra vive aqui: `matchesSearch`, `isActive` e `sortProcesses` estao
 * em `src/domain/process-query.ts`. Isto e traducao de HTTP.
 */
export function registerProcessesRoute(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
): void {
  app.get('/api/processes', (request, reply) => {
    const state = store.getState()

    // 503 apenas quando NUNCA houve leitura, como nas demais rotas de dado:
    // em `degradado` com leitura anterior, a lista congelada continua servindo.
    if (state.lastReadAt === null) {
      return reply
        .code(503)
        .send(
          apiError(
            'ARQUIVO_INDISPONIVEL',
            state.degradedReason ?? 'A planilha ainda nao foi lida.',
          ),
        )
    }

    const filtered = filteredProcesses(request, reply, state.processes)
    if (filtered === null) return undefined

    const query = request.query as ProcessesQuery
    let sort: SortField
    let order: SortOrder
    let activeOnly: boolean
    let limit: number
    let offset: number
    try {
      sort = parseSort(query.sort)
      order = parseOrder(query.order)
      activeOnly = parseBoolean(query.activeOnly, 'activeOnly')
      limit = parseInteger(query.limit, 'limit', 1, MAX_LIMIT)
      offset = parseInteger(query.offset, 'offset', 0, Number.MAX_SAFE_INTEGER)
    } catch (error) {
      if (error instanceof QueryError) {
        return reply.code(400).send(apiError('FILTRO_INVALIDO', error.message))
      }
      throw error
    }

    const search = query.search ?? ''
    const matching = filtered.filter(
      (process) => (!activeOnly || isActive(process)) && matchesSearch(process, search),
    )

    const body: ProcessesResponse = {
      items: paginate(sortProcesses(matching, sort, order), limit, offset).map(toDto),
      total: matching.length,
      limit,
      offset,
    }
    return reply.code(200).send(body)
  })
}
