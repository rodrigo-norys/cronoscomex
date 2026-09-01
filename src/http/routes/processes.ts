import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { today as currentDay, toIsoDay } from '../../domain/date-window.ts'
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
  ColorResponsible,
  CustomsChannel,
  Process,
  Responsible,
  StatusCategory,
} from '../../domain/types.ts'
import type { PendingEdit } from '../../io/edit-queue.ts'
import { daysInCurrentCategory, eventsOf } from '../../io/history-store.ts'
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
  /** O cliente CONSOLIDADO (`H-49`) — quem e o cliente. */
  client: string
  /**
   * O valor da celula CLT — qual o processo daquele cliente. Os dois viajam
   * juntos: derivar um do outro no cliente seria regra de negocio fora do
   * dominio (regra inviolavel 6).
   */
  clientProcess: string
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
  /**
   * A chave da pessoa responsavel (`H-50`). `''` quando ninguem responde pelo
   * processo, e ela e chave legitima no filtro.
   *
   * **Dominio aberto:** vem de `team-map.json`, que nao e versionado. A
   * interface NAO a traduz — o nome vem em `responsibleLabel`, resolvido no
   * servidor, porque nenhuma tabela escrita no cliente conhece a equipe.
   */
  responsible: Responsible
  /** O nome legivel de `responsible`. `''` quando nao ha responsavel. */
  responsibleLabel: string
  /**
   * O que a COR da linha diz sobre responsavel (`H-50`).
   *
   * **Nao e redundante com `responsible`:** e o valor que o formulario de cor
   * do detalhe precisa para dizer que cor a linha tem hoje. Sem ele, `H-50`
   * passaria a chave da pessoa como se fosse cor, e o menu marcaria a opcao
   * errada — defeito que o `typecheck` pegou ao fechar a fatia.
   */
  colorResponsible: ColorResponsible
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

/**
 * Uma mudanca de categoria, para o detalhe (`H-28`).
 *
 * `from` nao e anulavel de proposito, e por isso o detalhe **descarta** a
 * primeira aparicao do REF — que no arquivo tem `from: null`. Ela e o marco
 * inicial da serie, nao uma transicao; exibi-la escreveria "— para Em
 * andamento" nos 649 processos no primeiro dia de uso.
 */
export interface StatusChangeDto {
  ts: string
  from: StatusCategory
  to: StatusCategory
}

export interface ProcessDetailResponse {
  process: ProcessDto
  anomalies: AnomalyDetail[]
  pendingEdits: PendingEdit[]
  statusHistory: StatusChangeDto[]
  /**
   * `null` quando o REF ainda nao tem evento algum.
   *
   * O contrato documentado trazia `0`, e zero aqui **afirma** que a categoria
   * mudou hoje — indistinguivel de "nao ha como saber". Mesmo argumento de
   * `averageDays` em IND-22 e do traco de ALE-06.
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

function toDto(process: Process, hasPendingEdits = false): ProcessDto {
  return {
    ref: process.ref,
    sourceRow: process.sourceRow,
    client: process.clientLabel,
    clientProcess: process.clientRaw,
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
    responsibleLabel: process.responsibleLabel,
    colorResponsible: process.colorResponsible,
    customsChannel: process.customsChannel,
    importerOutsideRj: process.importerOutsideRj,
    boletoRaw: process.boletoRaw,
    paymentRaw: process.paymentRaw,
    columnPRaw: process.columnPRaw,
    anomalies: [...process.anomalies],
    hasPendingEdits,
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
 * Marcada **[F]**: os treze filtros globais valem aqui, e sao aplicados **antes**
 * da busca, da ordenacao e da paginacao. A ordem importa — `total` precisa ser
 * do conjunto filtrado inteiro, e paginar antes de contar daria o tamanho da
 * pagina.
 *
 * Nenhuma regra vive aqui: `matchesSearch`, `isActive` e `sortProcesses` estao
 * em `src/domain/process-query.ts`. Isto e traducao de HTTP.
 */
export function registerProcessesRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
  historyPath?: string,
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

    const pendingForRef = state.pendingEdits.filter((edit) => edit.ref === process.ref)

    const body: ProcessDetailResponse = {
      process: toDto(process, pendingForRef.length > 0),
      // O texto vem do dominio, onde nasce: traduzir codigo em frase no cliente
      // escreveria a mesma tabela num segundo lugar (mesmo motivo de A-28).
      anomalies: process.anomalies.map((code) => ({
        code,
        detail: describeAnomaly(code, process),
      })),
      pendingEdits: pendingForRef,
      // So as mudancas de CATEGORIA: a primeira aparicao do REF (`from: null`)
      // nao e mudanca, e o evento so de canal tem `from` igual a `to`. Ambos
      // existem no arquivo e sao insumo da serie; nenhum dos dois e uma linha
      // de "mudou de X para Y" que o operador possa ler.
      statusHistory: eventsOf(process.ref, { path: historyPath })
        .filter((event) => event.from !== null && event.from !== event.to)
        .map((event) => ({ ts: event.ts, from: event.from as StatusCategory, to: event.to })),
      daysInCurrentCategory: daysInCurrentCategory(
        process.ref,
        currentDay(config.timezone),
        config.timezone,
        { path: historyPath },
      ),
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

    const editedRefs = new Set(state.pendingEdits.map((edit) => edit.ref))
    const search = query.search ?? ''
    const matching = filtered.filter(
      (process) => (!activeOnly || isActive(process)) && matchesSearch(process, search),
    )

    const body: ProcessesResponse = {
      items: paginate(sortProcesses(matching, sort, order), limit, offset).map((item) =>
        toDto(item, editedRefs.has(item.ref)),
      ),
      total: matching.length,
      limit,
      offset,
    }
    return reply.code(200).send(body)
  })
}
