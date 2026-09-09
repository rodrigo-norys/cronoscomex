import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  type ClientMap,
  DEFAULT_CLIENT_MAP_PATH,
  loadClientMap,
  removeClientGroup,
  saveClientRule,
} from '../../app/client-map-loader.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  type ClientGroup,
  type ClientKeyEntry,
  type ClientMapEntry,
  type ClientMatch,
  type ClientName,
  clientKeys,
  clientNames,
  type DeclaredClient,
  declaredClients,
  planClientRule,
  planGroupRemoval,
  type RuleReach,
  ruleReach,
} from '../../domain/client-mapper.ts'
import { apiError } from '../errors.ts'
import { refuseDuringWrite } from './edits.ts'

/**
 * As rotas do mapa de clientes — contrato em `docs/05-contratos-api.md`.
 *
 * **Nenhuma delas e marcada [F], e essa e a determinacao 2 de `D-32`.** Sao as
 * unicas rotas de leitura da aplicacao que ignoram os quatorze filtros globais,
 * de proposito: o que elas servem e divida de CONFIGURACAO, nao recorte.
 * Seguindo o filtro, filtrar por um cliente faria a divida sumir da tela, e o
 * operador concluiria que declarou tudo.
 *
 * As rotas so serializam. Quem decide o que e pendencia, o que uma regra
 * alcanca e onde ela entra no arquivo e o dominio (regra inviolavel 6).
 *
 * **A gravacao nao passa pelo `Aplicar alteracoes`**, pelo mesmo motivo de
 * `process-client.ts`: nao ha o que escrever na planilha, e a fila existe para
 * adiar a escrita no arquivo da empresa. O mapa e local e reversivel.
 */
export interface ClientKeysResponse {
  items: ClientKeyEntry[]
  /**
   * Os clientes JA declarados, com o peso de cada um.
   *
   * Lista separada porque a tela as separa: uma tabela e o que falta declarar, a
   * outra e o que ja foi — e a segunda e onde o operador desfaz.
   */
  declared: DeclaredClient[]
  /** Quantas grafias a coluna tem ao todo. */
  total: number
  /**
   * Os nomes que o campo de declaracao oferece.
   *
   * Viajam JUNTO da lista, e nao em rota propria: as duas respondem a mesma
   * pergunta — o estado do mapa — e separa-las faria a tela pintar a lista antes
   * de saber o que sugerir.
   */
  names: ClientName[]
}

export type RuleReachResponse = RuleReach

export interface ClientRuleCreatedResponse {
  /** `grupo-criado` e `membro-acrescentado` sao os dois kinds de pai (`H-88`). */
  outcome:
    | 'entrada-nova'
    | 'regra-acrescentada'
    | 'sem-efeito'
    | 'grupo-criado'
    | 'membro-acrescentado'
  key: string
  label: string
  value: string
  match: ClientMatch
}

export interface ClientGroupRemovedResponse {
  outcome: 'membro-removido' | 'grupo-desfeito'
  key: string
  /** Quem saiu, ou `null` quando o pai inteiro foi desfeito. */
  client: string | null
  /**
   * As declaracoes apagadas junto — as grafias delas voltam a "sem cliente".
   *
   * Desagrupar e desdeclarar sao uma operacao so desde 08/09/2026, por escolha
   * do usuario.
   */
  removed: string[]
  /**
   * `true` quando o pai deixou de existir — por ter sido desfeito, ou por ter
   * ficado com um filho so. Arvore de um galho e ruido (determinacao 9).
   */
  dissolved: boolean
}

const MATCHES: readonly ClientMatch[] = ['prefix', 'contains', 'exact']

const REMOVAL_REJECTIONS: Record<string, string> = {
  GRUPO_INEXISTENTE: 'Esse agrupamento nao existe mais.',
  MEMBRO_INEXISTENTE: 'Esse cliente nao esta nesse agrupamento.',
}

const REJECTIONS: Record<string, string> = {
  ROTULO_VAZIO: 'Informe o nome do cliente.',
  CELULA_VAZIA: 'Informe o valor que a regra deve casar.',
  NOME_E_FILHO:
    'Esse nome ja esta dentro de outro. Declare no nome de cima, ou tire-o de la primeiro.',
}

function parseMatch(raw: unknown): ClientMatch | null {
  return typeof raw === 'string' && (MATCHES as readonly string[]).includes(raw)
    ? (raw as ClientMatch)
    : null
}

export function registerClientsRoutes(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  /**
   * O mapa em memoria — o MESMO que o store recebeu, pelo motivo de
   * `process-client.ts`: lido de novo aqui, a lista discordaria da coluna
   * Cliente que a tabela mostra.
   */
  clientMap: readonly ClientMapEntry[] = [],
  /** Os grupos do mesmo arquivo — quem tem pai, e qual. */
  clientGroups: readonly ClientGroup[] = [],
  /** Ponto de injecao para teste. `saveClientRule` recusa o padrao sob `NODE_ENV=test`. */
  clientMapPath: string = DEFAULT_CLIENT_MAP_PATH,
  /** Reprojeta com o mapa novo. Em producao `main` passa `refreshClientMap`. */
  applyClientMap?: (map: ClientMap) => Promise<void>,
): void {
  /**
   * O mapa CORRENTE. Reatribuido depois de cada gravacao pelo mesmo motivo de
   * `process-client.ts`: o parametro e um instantaneo da partida, e a segunda
   * declaracao seguida planejaria contra a ordem anterior a primeira.
   */
  let map = clientMap
  let groups = clientGroups

  /** 503 apenas quando NUNCA houve leitura: lista vazia aqui afirmaria que nao
      falta declarar nada, que e o oposto de "ainda nao se sabe" (regra 3). */
  const semLeitura = (reply: FastifyReply): boolean => {
    const state = store.getState()
    if (state.lastReadAt !== null) return false

    reply
      .code(503)
      .send(
        apiError('ARQUIVO_INDISPONIVEL', state.degradedReason ?? 'A planilha ainda nao foi lida.'),
      )
    return true
  }

  app.get('/api/clients', (_request, reply) => {
    if (semLeitura(reply)) return reply

    const state = store.getState()
    const items = clientKeys(state.processes, map, groups)
    const body: ClientKeysResponse = {
      items,
      declared: declaredClients(state.processes, map, groups),
      total: items.length,
      names: clientNames(map, groups),
    }
    return reply.send(body)
  })

  app.get('/api/clients/preview', (request, reply) => {
    if (semLeitura(reply)) return reply

    const query = request.query as { match?: unknown; value?: unknown }
    const match = parseMatch(query.match)
    if (match === null) {
      return reply
        .code(400)
        .send(apiError('FILTRO_INVALIDO', `"match" deve ser um de: ${MATCHES.join(', ')}.`))
    }
    if (typeof query.value !== 'string') {
      return reply.code(400).send(apiError('FILTRO_INVALIDO', 'Informe "value" como texto.'))
    }

    const body: RuleReachResponse = ruleReach(store.getState().processes, map, match, query.value)
    return reply.send(body)
  })

  app.post('/api/clients/rules', async (request, reply) => {
    if (refuseDuringWrite(store, reply)) return reply
    if (semLeitura(reply)) return reply

    const body = (request.body ?? {}) as { match?: unknown; value?: unknown; label?: unknown }
    const match = parseMatch(body.match)
    if (match === null) {
      return reply
        .code(400)
        .send(apiError('CORPO_INVALIDO', `"match" deve ser um de: ${MATCHES.join(', ')}.`))
    }
    if (typeof body.value !== 'string' || typeof body.label !== 'string') {
      return reply
        .code(400)
        .send(apiError('CORPO_INVALIDO', 'Informe `value` e `label` como texto.'))
    }

    /**
     * O importador entra VAZIO, e nao e descuido: a regra desta rota vale para
     * a grafia, nao para uma linha. `planClientRule` so usa o importador para
     * saber quem ja casa a chave, e qualificar por ele aqui recusaria a
     * declaracao de um grupo cujas linhas tem importadores diferentes — que e o
     * caso normal do prefixo.
     */
    const plan = planClientRule(body.value, '', body.label, map, match, groups)
    if (typeof plan === 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', REJECTIONS[plan] ?? plan))
    }

    if (plan.kind !== 'sem-efeito') {
      saveClientRule(plan, clientMapPath)
      const next = loadClientMap(clientMapPath)
      map = next.clients
      groups = next.groups
      if (applyClientMap) await applyClientMap(next)
    }

    const answer: ClientRuleCreatedResponse = {
      outcome: plan.kind,
      key: plan.key,
      label: plan.label,
      value: plan.value,
      match: plan.match,
    }
    return reply.code(plan.kind === 'sem-efeito' ? 200 : 201).send(answer)
  })

  /**
   * As duas remocoes (`H-88`, determinacao 9).
   *
   * **Nenhuma apaga cliente.** Sai o vinculo com o pai, e nao a regra: o cliente
   * volta ao ranking com a contagem que sempre teve. Foi o que o usuario
   * escolheu — desfazer alcanca o que envolve grupo, e regra de cliente se
   * corrige no arquivo enquanto nao houver historia.
   */
  const desfazer = async (
    reply: FastifyReply,
    groupKey: string,
    clientKey: string | null,
  ): Promise<unknown> => {
    if (refuseDuringWrite(store, reply)) return reply
    if (semLeitura(reply)) return reply

    const plan = planGroupRemoval(groupKey, clientKey, groups)
    if (typeof plan === 'string') {
      return reply.code(404).send(apiError(plan, REMOVAL_REJECTIONS[plan] ?? 'Nao encontrado.'))
    }

    removeClientGroup(plan, clientMapPath)
    const next = loadClientMap(clientMapPath)
    map = next.clients
    groups = next.groups
    if (applyClientMap) await applyClientMap(next)

    const answer: ClientGroupRemovedResponse = {
      outcome: plan.kind,
      key: plan.key,
      client: plan.client ?? null,
      removed: plan.removes,
      dissolved: plan.dissolves,
    }
    return reply.send(answer)
  }

  app.delete('/api/clients/groups/:key/members/:client', async (request, reply) => {
    const { key, client } = request.params as { key: string; client: string }
    return desfazer(reply, key, client)
  })

  app.delete('/api/clients/groups/:key', async (request, reply) => {
    const { key } = request.params as { key: string }
    return desfazer(reply, key, null)
  })
}
