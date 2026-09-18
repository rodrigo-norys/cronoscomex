import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../../app/config.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import type { ClientGroup } from '../../domain/client-mapper.ts'
import { type ColorMapEntry, styleKeysByDisplay } from '../../domain/color-mapper.ts'
import { today as currentDay, isoWeekEnd, toIsoDay } from '../../domain/date-window.ts'
import {
  type ArrivalDay,
  agentRanking,
  arrivalCalendar,
  arrivingIn15Days,
  arrivingTodayWhite,
  bazarShare,
  type CategoryCheck,
  type ChannelDistribution,
  CLEARANCE_DISPLAYS,
  categoryCheck,
  channelDistribution,
  countByCategory,
  documentaryLeadTime,
  type ExpectedVessel,
  expectedVessels,
  type GroupCount,
  groupCount,
  groupCountWithGroups,
  inClearanceCount,
  type LeadTime,
  type LeadTimeGroup,
  leadTimeByGroup,
  overdueWithoutDuimpCount,
  redChannelCount,
  responsibleRanking,
  WHITE_DISPLAYS,
} from '../../domain/indicators.ts'
import { knownResponsibles, type TeamMember } from '../../domain/team-mapper.ts'
import { apiError } from '../errors.ts'
import { filteredWithPeriod } from '../filter-request.ts'

/**
 * GET /api/indicators — contrato em docs/05-contratos-api.md.
 *
 * A rota foi construida por H-09 a H-13 e nasceu parcial: cada historia
 * acrescentou os seus blocos, e nenhuma preencheu com zero o que ainda nao
 * calculava — zero em campo nao implementado seria indistinguivel de zero
 * medido. Com H-13 o contrato esta **completo**: os 21 indicadores em escopo.
 *
 * **`D-49` reduziu `counts` aos nove cartoes que a Pagina Inicial exibe.**
 * Sairam IND-08, IND-14, IND-16 e a contagem por data de registro de `H-52`: a
 * ordem do usuario foi tirar os cartoes, e indicador servido sem tela e o
 * defeito que A-65 varreu.
 */
export interface IndicatorsCounts {
  /** IND-01. Inclui `fechado_aguardando_draft`, por exigencia explicita. */
  total: number
  /** IND-02, sob o rotulo "Processos ativos" desde `D-49`. */
  emAndamento: number
  /**
   * IND-23, e **nao mais a categoria** `em_desembaraco` (IND-03, aposentado):
   * cor de desembaraco OU DUIMP no STATUS.
   *
   * Nao e exclusivo com os outros campos, e por isso a conferencia de A-12
   * deixou de somar cartoes — ela vive em `categoryCheck`.
   */
  emDesembaraco: number
  /** IND-04. */
  desembaracados: number
  /** IND-05, sob o rotulo "Aguardando draft" desde `D-49`. */
  fechadoAguardandoDraft: number
  /** IND-24: linha branca E `eta2` de hoje. Substitui IND-07. */
  chegandoHoje: number
  /** IND-09. */
  chegando15Dias: number
  /** IND-06. */
  canalVermelho: number
  /** IND-25: `eta2` ate hoje+10, sem DUIMP e nao desembaracado. Substitui IND-15. */
  atrasados: number
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
}

export interface IndicatorsResponse {
  counts: IndicatorsCounts
  /**
   * `D-49`. A conferencia de A-12, calculada no servidor.
   *
   * Ate aqui a Pagina Inicial somava os quatro cartoes de categoria. Com IND-23
   * no lugar de IND-03 os cartoes deixaram de ser as quatro categorias, e a
   * soma passou a nao fechar por desenho — somar no cliente diria "nao
   * conferem" todo dia. A invariante continua valendo por dentro, e quem a
   * confere e quem a calcula.
   */
  categoryCheck: CategoryCheck
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
  /**
   * Mapa de equipe de `H-48`, para IND-20 exibir a pessoa sem processo algum
   * (`H-50`). Padrao vazio pelo mesmo motivo de `clientGroups`.
   */
  teamMap: readonly TeamMember[] = [],
  /**
   * Mapa de cor, para IND-23 e IND-24 (`D-49`). Padrao vazio pelo mesmo motivo
   * dos dois acima — e, vazio, os dois cartoes contam so o que nao depende de
   * cor, que e o certo: chave sem `display` nao vira cor proxima (`D-41`).
   */
  colorMap: readonly ColorMapEntry[] = [],
): void {
  /*
    Resolvidos UMA vez, no registro: o mapa de cor nao muda em execucao — quem
    muda e o de equipe, e `knownResponsibles` e derivado por requisicao por
    causa disso (`H-91`). Resolver por requisicao varreria as nove entradas em
    toda chamada para produzir o mesmo par de conjuntos.
  */
  const clearanceKeys = styleKeysByDisplay(colorMap, CLEARANCE_DISPLAYS)
  const whiteKeys = styleKeysByDisplay(colorMap, WHITE_DISPLAYS)

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

    /*
      Derivado por REQUISICAO, e nao uma vez no registro (`H-91`).

      O painel de equipe grava em `team-map.json` com o processo no ar, e
      `refreshTeamMap` reescreve ESTE array no lugar — um `const` resolvido no
      registro serviria a equipe anterior ate alguem reiniciar a aplicacao, e o
      operador veria a pessoa que acabou de criar sumir do ranking.
    */
    const responsibles = knownResponsibles(teamMap)

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
        (p) => p.responsibleLabel,
      ),
    }

    // As categorias de TD-01 continuam sendo contadas, mesmo com IND-03
    // aposentado: tres cartoes saem daqui, e `categoryCheck` guarda A-12.
    const categories = countByCategory(processes)

    const body: IndicatorsResponse = {
      counts: {
        total: categories.total,
        emAndamento: categories.emAndamento,
        emDesembaraco: inClearanceCount(processes, clearanceKeys),
        desembaracados: categories.desembaracados,
        fechadoAguardandoDraft: categories.fechadoAguardandoDraft,
        chegandoHoje: arrivingTodayWhite(processes, day, whiteKeys),
        chegando15Dias: arrivingIn15Days(processes, day),
        canalVermelho: redChannelCount(processes),
        atrasados: overdueWithoutDuimpCount(processes, day),
      },
      categoryCheck: categoryCheck(categories),
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
        responsible: responsibleRanking(processes, responsibles),
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
      },
    }
    return reply.code(200).send(body)
  })
}
