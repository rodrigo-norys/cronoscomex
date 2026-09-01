import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import type { ClientGroup } from '../../domain/client-mapper.ts'
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  COLOR_RESPONSIBLE_LABELS,
  COLOR_RESPONSIBLES,
  CUSTOMS_CHANNELS,
  type FilterOption,
  fixedOptions,
  labelledOptions,
  optionsOf,
  STATUS_CATEGORIES,
} from '../../domain/filters.ts'
import { knownResponsibles, type TeamMember } from '../../domain/team-mapper.ts'
import type { Process } from '../../domain/types.ts'
import { apiError } from '../errors.ts'

/**
 * GET /api/filters/options — contrato em docs/05-contratos-api.md.
 *
 * Os valores vem dos dados carregados, **nunca de lista fixa** (RF-19, A-36).
 * A planilha real trouxe um porto `RO` que a especificacao nao documentava:
 * dominio fechado o teria escondido do operador.
 *
 * Os tres campos de dominio FECHADO sao a excecao, e por bom motivo: as chaves
 * aparecem todas, inclusive zeradas, para que o operador saiba que a opcao
 * existe. Mesma razao de IND-20 exibir a chave de responsavel sem processo.
 *
 * `responsible` e o caso do meio, desde `H-50`: o dominio e fechado, mas so em
 * execucao — quem o define e `team-map.json`. Por isso ele passa por
 * `labelledOptions`, e nao por `fixedOptions` nem por `optionsOf`.
 */
/**
 * Um grupo de clientes e seus membros (`H-55`), para o filtro exibir um nivel
 * de arvore.
 *
 * `count` do grupo e a soma dos membros; o de cada membro e o dele. Os membros
 * continuam aparecendo em `clients` — o grupo e camada de apresentacao do
 * filtro, e nenhum indicador agrupa por ele.
 */
export interface ClientGroupOption extends FilterOption {
  members: FilterOption[]
}

export interface FilterOptionsResponse {
  /** Clientes CONSOLIDADOS (`H-49`), rotulados pelo `label` do mapa. */
  clients: FilterOption[]
  /** Grupos de clientes (`H-55`). Lista vazia quando o mapa nao declara nenhum. */
  clientGroups: ClientGroupOption[]
  /**
   * Os valores da celula CLT, com a contagem propria. Sao a unica forma de
   * achar um processo especifico na Pagina Operacional, e por isso o campo
   * antigo continua servido — com o nome que diz o que ele guarda.
   */
  clientProcesses: FilterOption[]
  importers: FilterOption[]
  vessels: FilterOption[]
  agents: FilterOption[]
  goods: FilterOption[]
  ports: FilterOption[]
  categories: FilterOption[]
  /**
   * As pessoas do mapa de equipe (`H-50`), mais a chave vazia — os processos
   * sem responsavel. Pessoa sem processo algum aparece com zero (A-28).
   *
   * Sem mapa de equipe sao as quatro chaves de cor, e nao ha diferenca visivel
   * em relacao a `colorResponsible`: e o estado de `D-23`.
   */
  responsible: FilterOption[]
  /** O que a cor da linha diz (`H-50`). Dominio fechado, quatro chaves. */
  colorResponsible: FilterOption[]
  channels: FilterOption[]
}

/**
 * A arvore de grupos, com a contagem de cada nivel.
 *
 * O `count` do grupo vem de `clientGroupKey`, e nao da soma dos membros: os dois
 * batem hoje, e derivar da soma esconderia o dia em que nao baterem — membro
 * declarado no mapa e sem processo algum, por exemplo.
 *
 * Grupo sem nenhum processo **aparece**, com zero, pela mesma razao de A-28: a
 * chave existe no mapa do operador, e escondê-la faria o filtro parecer completo
 * quando nao esta.
 */
function clientGroupOptions(
  processes: readonly Process[],
  groups: readonly ClientGroup[],
): ClientGroupOption[] {
  if (groups.length === 0) return []

  const byClient = optionsOf(
    processes,
    (p) => p.clientKey,
    (p) => p.clientLabel,
  )
  const clientCounts = new Map(byClient.map((option) => [option.key, option]))

  const groupCounts = new Map<string, number>()
  for (const process of processes) {
    if (process.clientGroupKey === '') continue
    groupCounts.set(process.clientGroupKey, (groupCounts.get(process.clientGroupKey) ?? 0) + 1)
  }

  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    count: groupCounts.get(group.key) ?? 0,
    members: group.members.map((member) => {
      const client = clientCounts.get(member.client)
      return {
        key: member.client,
        // O rotulo do membro vence o do cliente: e o que distingue o cliente
        // que da nome ao grupo do grupo em si — "Vivi > AV", nao "Vivi > Vivi".
        label: member.label ?? client?.label ?? member.client,
        count: client?.count ?? 0,
      }
    }),
  }))
}

export function registerFilterOptionsRoute(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  clientGroups: readonly ClientGroup[] = [],
  teamMap: readonly TeamMember[] = [],
): void {
  const responsibles = knownResponsibles(teamMap)
  app.get('/api/filters/options', (_request, reply) => {
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

    const { processes } = state
    const body: FilterOptionsResponse = {
      clients: optionsOf(
        processes,
        (p) => p.clientKey,
        (p) => p.clientLabel,
      ),
      clientGroups: clientGroupOptions(processes, clientGroups),
      clientProcesses: optionsOf(
        processes,
        (p) => p.clientProcessKey,
        (p) => p.clientRaw,
      ),
      importers: optionsOf(
        processes,
        (p) => p.importerKey,
        (p) => p.importerRaw,
      ),
      vessels: optionsOf(
        processes,
        (p) => p.vesselKey,
        (p) => p.vesselRaw,
      ),
      agents: optionsOf(
        processes,
        (p) => p.agentKey,
        (p) => p.agentRaw,
      ),
      goods: optionsOf(
        processes,
        (p) => p.goodsKey,
        (p) => p.goodsRaw,
      ),
      ports: optionsOf(
        processes,
        (p) => p.portKey,
        (p) => p.portRaw,
      ),
      categories: fixedOptions(
        processes,
        STATUS_CATEGORIES,
        CATEGORY_LABELS,
        (p) => p.statusCategory,
      ),
      responsible: labelledOptions(processes, responsibles, (p) => p.responsible),
      colorResponsible: fixedOptions(
        processes,
        COLOR_RESPONSIBLES,
        COLOR_RESPONSIBLE_LABELS,
        (p) => p.colorResponsible,
      ),
      channels: fixedOptions(processes, CUSTOMS_CHANNELS, CHANNEL_LABELS, (p) => p.customsChannel),
    }
    return reply.code(200).send(body)
  })
}
