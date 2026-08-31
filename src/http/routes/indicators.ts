import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import type { ClientGroup } from '../../domain/client-mapper.ts'
import { today as currentDay, isoWeekEnd, toIsoDay } from '../../domain/date-window.ts'
import { RESPONSIBLE_LABELS } from '../../domain/filters.ts'
import {
  type ArrivalDay,
  agentRanking,
  arrivalCalendar,
  arrivingIn15Days,
  arrivingThisWeek,
  arrivingToday,
  bazarShare,
  type CategoryCounts,
  type ChannelDistribution,
  channelDistribution,
  clearedInPeriodCount,
  clearedTodayCount,
  countByCategory,
  type DataRanges,
  dataRanges,
  documentaryLeadTime,
  type ExpectedVessel,
  expectedVessels,
  type GroupCount,
  groupCount,
  groupCountWithGroups,
  type LeadTime,
  type LeadTimeGroup,
  leadTimeByGroup,
  overdueCount,
  pendingDocsCount,
  redChannelCount,
  responsibleRanking,
} from '../../domain/indicators.ts'
import { apiError } from '../errors.ts'
import { filteredWithPeriod } from '../filter-request.ts'

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
  /**
   * `H-52`. Adicional a `desembaracados`, nunca substituto: aquele conta
   * categoria sobre o recorte de `ETA2`, este conta a data de REGISTRO dentro da
   * janela. A soma das quatro categorias continua fechando com o total (A-12), e
   * a linha de conferencia da Pagina Inicial segue valida.
   */
  desembaracadosNoPeriodo: number
}

export interface IndicatorsRankings {
  clients: GroupCount[]
  importers: GroupCount[]
  agents: GroupCount[]
  goods: GroupCount[]
  responsible: GroupCount[]
}

/**
 * `H-19`. IND-22 quebrado nas quatro dimensoes da Pagina Performance.
 *
 * As tres primeiras vem cortadas em `meta.topN`; `responsible` vem inteira. Sao
 * quatro chaves fixas, e A-28 exige as quatro — passa-la pelo teto deixaria uma
 * mudanca de configuracao quebrar um criterio de aceite em silencio. E o mesmo
 * tratamento que `rankings.responsible` ja recebe.
 */
export interface LeadTimeBreakdowns {
  clients: LeadTimeGroup[]
  agents: LeadTimeGroup[]
  vessels: LeadTimeGroup[]
  responsible: LeadTimeGroup[]
  /**
   * Quantos grupos existem em cada quebra **antes** do corte. Sem isto o
   * recorte seria descarte silencioso: medido, a quebra por cliente tem 509
   * grupos e a tela mostra 10 (regra inviolavel 2).
   */
  groupTotals: Record<'clients' | 'agents' | 'vessels' | 'responsible', number>
}

export interface IndicatorsMeta {
  today: string
  timezone: string
  weekEnd: string
  topN: number
  /** `null` quando nenhum processo tem mercadoria preenchida (A-34). */
  bazarShare: number | null
  /**
   * `H-52`. A janela que o servidor de fato aplicou, ecoada. A tela a exibe em
   * cada cartao em vez de reler a URL: quem recortou foi o servidor, e um
   * cartao que declarasse a janela por conta propria poderia divergir do numero
   * que exibe.
   */
  period: { from: string | null; to: string | null }
  /**
   * `H-52`. A faixa real das duas datas no conjunto FILTRADO, com quantos
   * processos nao tem cada uma. Sem ela, cartao zerado por recorte e cartao
   * zerado por ausencia de dado sao indistinguiveis, e derivar a faixa no
   * cliente seria calculo na tela (regra inviolavel 6).
   */
  dataRange: DataRanges
}

export interface IndicatorsResponse {
  counts: IndicatorsCounts
  /**
   * `H-51`. Bloco proprio, e nao mais um campo em `counts`: aquele e a lista
   * dos indicadores do catalogo, e `counts.canalVermelho` — IND-06 — continua
   * la, com o mesmo valor. Esta distribuicao acompanha o indicador, nao o
   * substitui.
   */
  channelDistribution: ChannelDistribution
  rankings: IndicatorsRankings
  expectedVessels: ExpectedVessel[]
  /**
   * `H-17`. As chegadas de hoje ate hoje+15, agrupadas por dia e por navio.
   *
   * E um recorte de `expectedVessels`, nao um indicador novo: aquele nao tem
   * teto por definicao (A-24, IND-12) e continua intacto. O teto vive aqui
   * porque e da apresentacao — e precisa vir do servidor, senao cortar em
   * `hoje+15` seria regra de negocio no cliente. Medido em 07/08/2026: dos 16
   * grupos (navio, dia) da planilha real, **8** caem dentro do horizonte.
   */
  arrivalCalendar: ArrivalDay[]
  documentaryLeadTime: LeadTime
  /** `H-19`. As quebras de IND-22 — o agregado acima segue intacto. */
  leadTimeByGroup: LeadTimeBreakdowns
  meta: IndicatorsMeta
}

export function registerIndicatorsRoute(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
  /**
   * Grupos de `H-55`, para o ranking de clientes colapsar os membros (`H-56`).
   * Padrao vazio pelo mesmo motivo de `buildServer`: teste nao le o mapa real.
   */
  clientGroups: readonly ClientGroup[] = [],
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
    const groupLabels = new Map(clientGroups.map((group) => [group.key, group.label]))

    // Os filtros recortam o conjunto ANTES de qualquer calculo: todo indicador
    // desta rota responde sobre o conjunto filtrado (RF-18). A janela vem junto
    // porque `H-52` precisa dizer ao operador qual periodo cada cartao conta.
    const recorte = filteredWithPeriod(request, reply, state.processes)
    if (recorte === null) return reply
    const { processes } = recorte

    // Uma chamada por dimensao, sem teto: o corte acontece abaixo, depois de o
    // total de grupos ser conhecido. Cortar dentro do dominio apagaria o numero
    // que a tela precisa exibir.
    const leadTime = {
      clients: leadTimeByGroup(
        processes,
        (p) => p.clientKey,
        (p) => p.clientLabel,
      ),
      agents: leadTimeByGroup(
        processes,
        (p) => p.agentKey,
        (p) => p.agentRaw,
      ),
      vessels: leadTimeByGroup(
        processes,
        (p) => p.vesselKey,
        (p) => p.vesselRaw,
      ),
      responsible: leadTimeByGroup(
        processes,
        (p) => p.responsible,
        (p) => RESPONSIBLE_LABELS[p.responsible],
      ),
    }

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
        // `H-52`. Adicional, nunca substituto: os quatro de categoria seguem
        // intactos, e a soma deles continua fechando com o total (A-12).
        desembaracadosNoPeriodo: clearedInPeriodCount(processes, recorte.from, recorte.to),
      },
      channelDistribution: channelDistribution(processes),
      rankings: {
        // `H-56`: o grupo entra NO LUGAR dos membros, com a composicao em
        // `segments`. Os demais rankings seguem com `groupCount` — grupo e
        // conceito do cliente, e nao existe para importador nem mercadoria.
        clients: groupCountWithGroups(
          processes,
          (p) => p.clientKey,
          (p) => p.clientLabel,
          (p) => p.clientGroupKey,
          groupLabels,
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
      arrivalCalendar: arrivalCalendar(processes, day),
      documentaryLeadTime: documentaryLeadTime(processes),
      leadTimeByGroup: {
        clients: leadTime.clients.slice(0, config.topN),
        agents: leadTime.agents.slice(0, config.topN),
        vessels: leadTime.vessels.slice(0, config.topN),
        responsible: leadTime.responsible,
        groupTotals: {
          clients: leadTime.clients.length,
          agents: leadTime.agents.length,
          vessels: leadTime.vessels.length,
          responsible: leadTime.responsible.length,
        },
      },
      meta: {
        today: toIsoDay(day),
        timezone: config.timezone,
        weekEnd: toIsoDay(isoWeekEnd(day)),
        topN: config.topN,
        bazarShare: bazarShare(processes),
        period: {
          from: recorte.from === null ? null : toIsoDay(recorte.from),
          to: recorte.to === null ? null : toIsoDay(recorte.to),
        },
        dataRange: dataRanges(processes),
      },
    }
    return reply.code(200).send(body)
  })
}
