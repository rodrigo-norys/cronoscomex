import type { FastifyInstance } from 'fastify'
import {
  type ClientMap,
  DEFAULT_CLIENT_MAP_PATH,
  loadClientMap,
  saveClientRule,
} from '../../app/client-map-loader.ts'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { type ClientMapEntry, planClientRule } from '../../domain/client-mapper.ts'
import { normKey } from '../../domain/normalizer.ts'
import { apiError } from '../errors.ts'
import { refuseDuringWrite } from './edits.ts'

/**
 * `PUT /api/processes/:ref/client` — contrato em `docs/05-contratos-api.md §3`.
 *
 * **A unica rota de edicao que NAO enfileira, e nao toca o `.xlsx`.** As outras
 * escrevem numa celula; esta declara a que cliente uma celula pertence, e isso
 * e regra de negocio do operador — mora em `client-map.json`, que a coluna
 * Cliente ja lê desde `H-49`. O caminho de volta e este.
 *
 * **O caminho aparece sem o prefixo `config/` de proposito**, como
 * `client-map-loader.ts` ja fazia: o arquivo esta no `.gitignore`, e a guarda de
 * ancora morta cobra existencia em disco — citar o caminho completo reprova o CI
 * num checkout limpo, onde ele nao existe. Convencao fixada em `H-34` para o
 * `app.json`, e o CI a cobrou de novo em 02/09/2026.
 *
 * Por isso ela tambem nao passa pelo `Aplicar alteracoes`: nao ha o que gravar
 * na planilha, e a fila existe para adiar a escrita no arquivo da empresa. A
 * mudanca vale na hora, e o `client-map.json` e local e reversivel.
 *
 * **A rota nao decide a regra.** `planClientRule` vive no dominio: onde a
 * entrada precisa ficar para vencer, e se ha efeito, sao decisoes de negocio
 * (regra inviolavel 6). Aqui so ha traducao para HTTP.
 */

export interface ClientRuleResponse {
  /** O que aconteceu com o arquivo — `sem-efeito` quando ja resolvia assim. */
  outcome: 'entrada-nova' | 'regra-acrescentada' | 'sem-efeito'
  /** A chave do cliente, normalizada. */
  key: string
  label: string
  /** O valor da celula CLT que a regra passou a casar. */
  value: string
}

interface ClientRequestBody {
  label?: unknown
}

const REJECTIONS: Record<string, string> = {
  ROTULO_VAZIO: 'Informe o nome do cliente.',
  CELULA_VAZIA:
    'A celula "Processo do cliente" esta vazia, e a regra casa o valor dela. Preencha-a primeiro.',
}

export function registerProcessClientRoute(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  /**
   * O mapa em memoria — o MESMO que o store recebeu. Lido de novo aqui faria a
   * rota planejar contra uma ordem diferente da que resolve a coluna.
   */
  clientMap: readonly ClientMapEntry[] = [],
  /** Ponto de injecao para teste. `saveClientRule` recusa o padrao sob teste. */
  clientMapPath: string = DEFAULT_CLIENT_MAP_PATH,
  /**
   * Reprojeta com o mapa novo. Ausente, a gravacao acontece e o estado em
   * memoria segue o antigo — que e o certo em teste, onde nao ha planilha para
   * reler (regra inviolavel 7). Em producao `main` passa `refreshClientMap`.
   */
  applyClientMap?: (map: ClientMap) => Promise<void>,
): void {
  /**
   * O mapa CORRENTE. Reatribuido depois de cada gravacao porque o parametro e
   * um instantaneo da partida: sem isto, a segunda declaracao seguida planejaria
   * contra a ordem anterior a primeira, e `beforeKey` apontaria para o lugar
   * errado.
   */
  let map = clientMap

  app.put('/api/processes/:ref/client', async (request, reply) => {
    if (refuseDuringWrite(store, reply)) return reply

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

    const body = (request.body ?? {}) as ClientRequestBody
    if (typeof body.label !== 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', 'Informe `label` como texto.'))
    }

    const { ref } = request.params as { ref: string }
    const wanted = normKey(ref)
    const process = state.processes.find((candidate) => normKey(candidate.ref) === wanted)
    if (process === undefined) {
      return reply
        .code(404)
        .send(apiError('PROCESSO_NAO_ENCONTRADO', `Nenhum processo com a REF "${ref}".`))
    }

    // `clientProcessKey` e a celula B normalizada, e nao `clientKey` — este ja e
    // o resultado da consolidacao, e planejar sobre ele criaria regra sobre o
    // proprio nome do cliente em vez de sobre o que a planilha guarda.
    const plan = planClientRule(process.clientProcessKey, process.importerKey, body.label, map)

    if (typeof plan === 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', REJECTIONS[plan] ?? plan))
    }

    if (plan.kind !== 'sem-efeito') {
      saveClientRule(plan, clientMapPath)
      const next = loadClientMap(clientMapPath)
      map = next.clients
      if (applyClientMap) await applyClientMap(next)
    }

    const answer: ClientRuleResponse = {
      outcome: plan.kind,
      key: plan.key,
      label: plan.label,
      value: plan.value,
    }
    return reply.code(200).send(answer)
  })
}
