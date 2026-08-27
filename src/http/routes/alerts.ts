import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  type Alert,
  type AlertCounts,
  buildAlerts,
  countByType,
  stalledCoverage,
} from '../../domain/alerts.ts'
import { today as currentDay } from '../../domain/date-window.ts'
import { historyStartedAt, stalledDaysByRef } from '../../io/history-store.ts'
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
   * Instante da primeira leitura registrada (A-61). Continua `null` enquanto o
   * historico estiver vazio: inventar a data afirmaria historico inexistente,
   * o oposto do que A-43 pede.
   */
  historyStartedAt: string | null
  /** Dias corridos de historico acumulado. `null` enquanto ele estiver vazio. */
  stalledCoverageDays: number | null
  /**
   * O zero de `countsByType.processos_parados` e conclusivo. Falso enquanto o
   * historico for mais novo que o limiar — a interface escolhe o texto por
   * este campo, e nao recalcula a comparacao (regra inviolavel 6).
   */
  stalledMeasurable: boolean
}

export function registerAlertsRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
  historyPath?: string,
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

    // O mapa e montado sobre o conjunto JA filtrado: `stalledDaysByRef` so
    // consulta o indice, e resolve-lo para 649 REF quando a tela pede 12 seria
    // trabalho jogado fora.
    const stalled = stalledDaysByRef(processes, day, config.timezone, { path: historyPath })
    const items = buildAlerts(processes, day, stalled, config.stalledDaysThreshold)

    const startedAt = historyStartedAt({ path: historyPath })
    const coverage = stalledCoverage(startedAt, day, config.timezone, config.stalledDaysThreshold)

    const body: AlertsResponse = {
      items,
      countsByType: countByType(items),
      stalledThresholdDays: config.stalledDaysThreshold,
      historyStartedAt: startedAt,
      stalledCoverageDays: coverage.days,
      stalledMeasurable: coverage.measurable,
    }
    return reply.code(200).send(body)
  })
}
