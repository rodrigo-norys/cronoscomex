import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { today as currentDay, isoWeekEnd, toIsoDay } from '../../domain/date-window.ts'
import {
  agentRanking,
  arrivingIn15Days,
  arrivingThisWeek,
  arrivingToday,
  bazarShare,
  type CategoryCounts,
  clearedTodayCount,
  countByCategory,
  documentaryLeadTime,
  type ExpectedVessel,
  expectedVessels,
  type GroupCount,
  groupCount,
  type LeadTime,
  overdueCount,
  pendingDocsCount,
  redChannelCount,
  responsibleRanking,
} from '../../domain/indicators.ts'
import { apiError } from '../errors.ts'
import { filteredProcesses } from '../filter-request.ts'

/**
 * GET /api/indicators — contrato em docs/05-contratos-api.md.
 *
 * A rota foi construida por H-09 a H-13 e nasceu parcial: cada historia
 * acrescentou os seus blocos, e nenhuma preencheu com zero o que ainda nao
 * calculava — zero em campo nao implementado seria indistinguivel de zero
 * medido. Com H-13 o contrato esta **completo**: os 21 indicadores em escopo.
 */
export interface IndicatorsCounts extends CategoryCounts {
  chegandoHoje: number
  chegandoSemana: number
  chegando15Dias: number
  canalVermelho: number
  documentosPendentes: number
  atrasados: number
  desembaracadosHoje: number
}

export interface IndicatorsRankings {
  clients: GroupCount[]
  importers: GroupCount[]
  agents: GroupCount[]
  goods: GroupCount[]
  responsible: GroupCount[]
}

export interface IndicatorsMeta {
  today: string
  timezone: string
  weekEnd: string
  topN: number
  /** `null` quando nenhum processo tem mercadoria preenchida (A-34). */
  bazarShare: number | null
}

export interface IndicatorsResponse {
  counts: IndicatorsCounts
  rankings: IndicatorsRankings
  expectedVessels: ExpectedVessel[]
  documentaryLeadTime: LeadTime
  meta: IndicatorsMeta
}

export function registerIndicatorsRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
): void {
  app.get('/api/indicators', (request, reply) => {
    const state = store.getState()

    // 503 apenas quando NUNCA houve leitura: nao ha o que apresentar. Com uma
    // leitura anterior em memoria, o estado 'degradado' responde 200 com o dado
    // congelado, e a casca exibe a faixa de aviso (A-57, 04-arquitetura.md §5).
    // Devolver 503 aqui apagaria o painel a cada sincronizacao do OneDrive.
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

    // O fuso e resolvido AQUI, uma unica vez. Daqui para baixo tudo e data
    // civil ancorada em UTC, como as datas vindas da planilha (TD-03).
    const day = currentDay(config.timezone)

    // Os filtros recortam o conjunto ANTES de qualquer calculo: todo indicador
    // desta rota responde sobre o conjunto filtrado (RF-18).
    const processes = filteredProcesses(request, reply, state.processes)
    if (processes === null) return reply

    const body: IndicatorsResponse = {
      counts: {
        ...countByCategory(processes),
        chegandoHoje: arrivingToday(processes, day),
        chegandoSemana: arrivingThisWeek(processes, day),
        chegando15Dias: arrivingIn15Days(processes, day),
        canalVermelho: redChannelCount(processes),
        documentosPendentes: pendingDocsCount(processes, day),
        atrasados: overdueCount(processes, day),
        desembaracadosHoje: clearedTodayCount(processes, day),
      },
      rankings: {
        clients: groupCount(
          processes,
          (p) => p.clientKey,
          (p) => p.clientRaw,
          config.topN,
        ),
        importers: groupCount(
          processes,
          (p) => p.importerKey,
          (p) => p.importerRaw,
          config.topN,
        ),
        agents: agentRanking(processes, day, config.topN),
        goods: groupCount(
          processes,
          (p) => p.goodsKey,
          (p) => p.goodsRaw,
          config.topN,
        ),
        responsible: responsibleRanking(processes),
      },
      expectedVessels: expectedVessels(processes, day),
      documentaryLeadTime: documentaryLeadTime(processes),
      meta: {
        today: toIsoDay(day),
        timezone: config.timezone,
        weekEnd: toIsoDay(isoWeekEnd(day)),
        topN: config.topN,
        bazarShare: bazarShare(processes),
      },
    }
    return reply.code(200).send(body)
  })
}
