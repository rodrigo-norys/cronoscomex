import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { today as currentDay } from '../../domain/date-window.ts'
import type { MonthlyPoint } from '../../domain/history.ts'
import { historyStartedAt, monthlySeries } from '../../io/history-store.ts'
import { apiError } from '../errors.ts'
import { filteredRefs } from '../filter-request.ts'

/**
 * GET /api/history/monthly — contrato em docs/05-contratos-api.md.
 *
 * A rota so serializa: a agregacao vive em `src/domain/history.ts` e a leitura
 * do arquivo em `src/io/history-store.ts`.
 *
 * **Limite do recorte por filtro.** A rota e marcada **[F]**, mas o evento
 * gravado carrega apenas `ref` — cliente, navio, agente e ETA vivem na planilha,
 * nao no historico. Filtrar por eles resolve os REF contra a leitura ATUAL,
 * entao a serie recortada mostra o passado dos processos que casam **hoje**; um
 * processo cujo navio mudou aparece sob o navio de agora, e um que sumiu da
 * planilha nao aparece sob filtro algum. Sem filtro a serie sai inteira do
 * arquivo, e essa e a unica forma em que ela e estavel no tempo.
 *
 * Gravar os campos de filtro em cada evento resolveria, ao custo de multiplicar
 * o arquivo e de congelar no historico valores que a planilha corrige — nao foi
 * o que ADR-0005 decidiu.
 */

const DEFAULT_MONTHS = 12
const MIN_MONTHS = 1
const MAX_MONTHS = 60

export interface MonthlyHistoryResponse {
  series: MonthlyPoint[]
  /**
   * Instante do primeiro evento gravado. `null` enquanto nao houver historico —
   * e `null` e o que faz a Pagina Historico dizer que nao ha dado anterior,
   * em vez de exibir uma serie que parece completa (A-43).
   */
  historyStartedAt: string | null
  truncated: boolean
}

export function registerHistoryRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
  historyPath?: string,
): void {
  app.get('/api/history/monthly', (request, reply) => {
    const query = request.query as Record<string, unknown>
    const months = parseMonths(query.months)
    if (months === null) {
      return reply
        .code(400)
        .send(
          apiError(
            'FILTRO_INVALIDO',
            `"months" deve ser inteiro entre ${MIN_MONTHS} e ${MAX_MONTHS}.`,
          ),
        )
    }

    const state = store.getState()

    // Sem NENHUMA leitura o painel nao sabe quais REF existem, e o recorte por
    // filtro seria vazio por ignorancia. Mesma regra de /api/alerts (A-57): so
    // 503 quando nunca houve leitura; degradado responde com o dado congelado.
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

    const selection = filteredRefs(request, reply, state.processes)
    if (selection === null) return reply

    const { series, truncated } = monthlySeries(
      months,
      currentDay(config.timezone),
      config.timezone,
      { path: historyPath, refs: selection.refs },
    )

    const body: MonthlyHistoryResponse = {
      series,
      historyStartedAt: historyStartedAt({ path: historyPath }),
      truncated,
    }
    return reply.code(200).send(body)
  })
}

/** `null` sinaliza invalido — `undefined` e ausencia, que vale o padrao. */
function parseMonths(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_MONTHS

  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_MONTHS || value > MAX_MONTHS) return null
  return value
}
