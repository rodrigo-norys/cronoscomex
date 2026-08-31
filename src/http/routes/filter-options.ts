import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  CUSTOMS_CHANNELS,
  type FilterOption,
  fixedOptions,
  optionsOf,
  RESPONSIBLE_LABELS,
  RESPONSIBLES,
  STATUS_CATEGORIES,
} from '../../domain/filters.ts'
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
 * existe. Mesma razao de IND-20 exibir os quatro responsaveis.
 */
export interface FilterOptionsResponse {
  /** Clientes CONSOLIDADOS (`H-49`), rotulados pelo `label` do mapa. */
  clients: FilterOption[]
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
  responsible: FilterOption[]
  channels: FilterOption[]
}

export function registerFilterOptionsRoute(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
): void {
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
      responsible: fixedOptions(processes, RESPONSIBLES, RESPONSIBLE_LABELS, (p) => p.responsible),
      channels: fixedOptions(processes, CUSTOMS_CHANNELS, CHANNEL_LABELS, (p) => p.customsChannel),
    }
    return reply.code(200).send(body)
  })
}
