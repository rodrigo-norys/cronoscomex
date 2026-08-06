import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { type Alert, type AlertCounts, buildAlerts, countByType } from '../../domain/alerts.ts'
import { today as currentDay } from '../../domain/date-window.ts'
import { apiError } from '../errors.ts'
import { filteredProcesses } from '../filter-request.ts'

/**
 * GET /api/alerts — contrato em docs/05-contratos-api.md.
 *
 * A rota so serializa. A regra de cada alerta, a severidade e a ordenacao vivem
 * em `src/domain/alerts.ts`.
 */
export interface AlertsResponse {
  items: Alert[]
  countsByType: AlertCounts
  stalledThresholdDays: number
  /**
   * `null` ate `H-28` gravar a primeira leitura (A-61). Nao ha data a informar
   * antes disso, e inventa-la afirmaria historico inexistente — o oposto do que
   * A-43 pede.
   */
  historyStartedAt: string | null
}

/** Vazio ate `H-28`. ALE-06 fica em zero, que e diferente de ausente. */
const NO_HISTORY: ReadonlyMap<string, number> = new Map()

export function registerAlertsRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
): void {
  app.get('/api/alerts', (request, reply) => {
    const state = store.getState()

    // 503 apenas quando NUNCA houve leitura, como em /api/indicators: com uma
    // leitura anterior em memoria o estado 'degradado' responde 200 com o dado
    // congelado, e a casca exibe a faixa de aviso (A-57).
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

    const day = currentDay(config.timezone)

    // RF-18: todo alerta respeita os filtros ativos, como os indicadores.
    const processes = filteredProcesses(request, reply, state.processes)
    if (processes === null) return reply

    const items = buildAlerts(processes, day, NO_HISTORY, config.stalledDaysThreshold)

    const body: AlertsResponse = {
      items,
      countsByType: countByType(items),
      stalledThresholdDays: config.stalledDaysThreshold,
      historyStartedAt: null,
    }
    return reply.code(200).send(body)
  })
}
