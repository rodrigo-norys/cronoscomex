import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { toIsoDay } from '../../domain/date-window.ts'
import { normKey } from '../../domain/normalizer.ts'
import { describeAnomaly } from '../../domain/process-builder.ts'
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

/**
 * `H-22`. Uma anomalia da linha, com o texto que a explica.
 *
 * `ProcessDto.anomalies` continua sendo so os codigos: a tabela da Pagina
 * Operacional nao precisa do texto, e engorda-la para servir uma tela custaria
 * em todas as outras.
 */
export interface AnomalyDetail {
  code: AnomalyCode
  detail: string
}

/** Vazio ate `H-23`, que e quem enfileira edicao. A forma vem do contrato. */
export interface PendingEditDto {
  id: string
  field: string
  value: string
  previous: string
  ts: string
}

/** Vazio ate `H-28`, que e quem grava historico. A forma vem do contrato. */
export interface StatusChangeDto {
  ts: string
  from: StatusCategory
  to: StatusCategory
}

export interface ProcessDetailResponse {
  process: ProcessDto
  anomalies: AnomalyDetail[]
  pendingEdits: PendingEditDto[]
  statusHistory: StatusChangeDto[]
  /**
   * `null` enquanto nao ha historico gravado (`H-28`).
   *
   * O contrato documentado trazia `0`, e zero aqui **afirma** que a categoria
   * mudou hoje — indistinguivel de "nao ha como saber". Sem historico seria
   * sempre zero, mentindo em 649 processos. Mesmo argumento de `averageDays`
   * em IND-22 e do traco de ALE-06.
   */
  daysInCurrentCategory: number | null
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
  /**
   * `GET /api/processes/:ref` — o detalhe de UM processo (`H-22`).
   *
   * **Nao e marcada [F].** O detalhe e sobre um processo achado pela REF, e
   * recortar o conjunto nao muda o que ele mostra — a casca ja assume isso e
   * esconde a barra de filtros nesta rota.
   *
   * A busca usa `normKey`, e nao igualdade literal: TD-06 define a identidade
   * de REF assim, e e por essa chave que a ingestao detecta duplicata. Igualdade
   * literal daria `404` para uma URL digitada em caixa diferente, num processo
   * que o dominio considera existente. A unicidade esta garantida na origem —
   * REF repetida vai para quarentena e nunca chega a `state.processes`.
   */
  app.get('/api/processes/:ref', (request, reply) => {
    const state = store.getState()

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

    const { ref } = request.params as { ref: string }
    const wanted = normKey(ref)
    const process = state.processes.find((candidate) => normKey(candidate.ref) === wanted)

    if (process === undefined) {
      return reply
        .code(404)
        .send(apiError('PROCESSO_NAO_ENCONTRADO', `Nenhum processo com a REF "${ref}".`))
    }

    const body: ProcessDetailResponse = {
      process: toDto(process),
      // O texto vem do dominio, onde nasce: traduzir codigo em frase no cliente
      // escreveria a mesma tabela num segundo lugar (mesmo motivo de A-28).
      anomalies: process.anomalies.map((code) => ({
        code,
        detail: describeAnomaly(code, process),
      })),
      // Os tres campos abaixo ficam vazios ate H-23 e H-28. Vazio de verdade,
      // nunca preenchido com placeholder: a tela precisa poder dizer que o
      // historico ainda nao comecou, e nao que o processo nunca mudou.
      pendingEdits: [],
      statusHistory: [],
      daysInCurrentCategory: null,
    }
    return reply.code(200).send(body)
  })

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
