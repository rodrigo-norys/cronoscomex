import type { FastifyInstance, FastifyReply } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { currentValue, type EditableField, validateEdit } from '../../domain/editable-fields.ts'
import { normKey } from '../../domain/normalizer.ts'
import {
  consolidated,
  DEFAULT_QUEUE_PATH,
  discard,
  discardAll,
  enqueue,
  isColorEdit,
  type PendingEdit,
  type PendingFieldEdit,
} from '../../io/edit-queue.ts'
import { apiError } from '../errors.ts'

/**
 * As quatro rotas de edicao — contrato em `docs/05-contratos-api.md §3`.
 *
 * **Nenhuma toca o `.xlsx`.** Elas registram intencao numa fila em disco; a
 * escrita e de `H-24` a `H-26`, atras das defesas de `write-guard`.
 *
 * A rota so traduz HTTP: a lista de campos editaveis e a validacao de cada um
 * vivem em `src/domain/editable-fields.ts`, e a fila em `src/io/edit-queue.ts`
 * (regra inviolavel 6).
 */

/** Interseccao, e nao `extends`: `PendingEdit` e uma uniao desde `H-27`. */
export type EnqueuedEditResponse = PendingEdit & {
  /** Quantas edicoes ficaram na fila depois desta. */
  pendingEditsCount: number
}

export interface EditsListResponse {
  items: PendingEdit[]
  count: number
}

export interface DiscardAllResponse {
  discarded: number
}

interface EditRequestBody {
  ref?: unknown
  field?: unknown
  value?: unknown
}

/**
 * Mexer na fila durante a aplicacao a faz sumir sem ser gravada: o
 * `write-guard` tira o instantaneo do que vai gravar no inicio e arquiva o
 * arquivo INTEIRO no fim, entao o que entra no meio e arquivado sem ter
 * chegado ao `.xlsx` — e o painel passa a mostrar zero pendencias. Vale
 * tambem para o descarte: a lapide seria arquivada como se tivesse sido
 * honrada, com a edicao gravada assim mesmo. Achado do revisor-xml em H-26.
 *
 * A janela sao as centenas de milissegundos de uma aplicacao. Recusar e o
 * mesmo que `POST /api/reload` ja faz, e devolve ao operador um erro que ele
 * resolve tentando de novo — em vez de perder o que digitou.
 *
 * Exportada porque `PATCH /api/processes/:ref/color` (`H-27`) e a quarta rota
 * que escreve na fila: uma segunda copia da regra divergiria da primeira.
 */
export function refuseDuringWrite(store: StoreAccess, reply: FastifyReply): boolean {
  if (store.getState().state !== 'escrevendo') return false

  reply
    .code(409)
    .send(
      apiError(
        'ESCRITA_EM_ANDAMENTO',
        'As alteracoes estao sendo gravadas na planilha. Tente de novo em instantes.',
      ),
    )
  return true
}

export function registerEditsRoutes(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  queuePath: string = DEFAULT_QUEUE_PATH,
): void {
  const recusaDuranteEscrita = (reply: FastifyReply): boolean => refuseDuringWrite(store, reply)

  app.post('/api/edits', (request, reply) => {
    if (recusaDuranteEscrita(reply)) return reply

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

    const body = (request.body ?? {}) as EditRequestBody
    if (typeof body.ref !== 'string' || typeof body.field !== 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', 'Informe `ref` e `field` como texto.'))
    }
    // `value` aceita texto ou `null`, e **nada mais**: `undefined` seria campo
    // ausente, e numero ou objeto entrariam na celula como texto acidental.
    if (body.value !== null && typeof body.value !== 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', '`value` precisa ser texto ou null.'))
    }

    // A REF e resolvida por `normKey`, como TD-06 define a identidade e como a
    // rota de detalhe ja faz.
    const wanted = normKey(body.ref)
    const process = state.processes.find((candidate) => normKey(candidate.ref) === wanted)
    if (process === undefined) {
      return reply
        .code(404)
        .send(apiError('PROCESSO_NAO_ENCONTRADO', `Nenhum processo com a REF "${body.ref}".`))
    }

    const rejection = validateEdit(body.field, body.value)
    if (rejection !== null) {
      return reply
        .code(400)
        .send(
          apiError(
            rejection,
            rejection === 'CAMPO_NAO_EDITAVEL'
              ? `O campo "${body.field}" nao e editavel.`
              : `Valor invalido para "${body.field}".`,
          ),
        )
    }

    const field = body.field as EditableField
    // `previous` e o valor que esta na PLANILHA, nunca o que a tela mostrava.
    // `state.processes` vem projetado com a fila, entao editar o mesmo campo
    // duas vezes — digitar, notar o engano, corrigir — gravaria como `previous`
    // o valor da edicao anterior, que nunca esteve no arquivo. A defesa de
    // integridade de H-25 compara `previous` com a celula e recusaria a fila
    // inteira, para sempre. A primeira edicao do par (ref, field) e a unica
    // calculada sobre o arquivo; as seguintes herdam o valor dela.
    // Achado do revisor-xml em H-25.
    const pending = consolidated(queuePath).find(
      (candidate) =>
        !isColorEdit(candidate) && candidate.ref === process.ref && candidate.field === field,
    ) as PendingFieldEdit | undefined

    const edit = enqueue(
      {
        ref: process.ref,
        sourceRow: process.sourceRow,
        field,
        value: body.value,
        previous: pending?.previous ?? currentValue(process, field),
      },
      queuePath,
    )

    const response: EnqueuedEditResponse = {
      ...edit,
      pendingEditsCount: consolidated(queuePath).length,
    }
    return reply.code(201).send(response)
  })

  app.get('/api/edits', (_request, reply) => {
    const items = consolidated(queuePath)
    const body: EditsListResponse = { items, count: items.length }
    return reply.code(200).send(body)
  })

  app.delete('/api/edits/:id', (request, reply) => {
    if (recusaDuranteEscrita(reply)) return reply

    const { id } = request.params as { id: string }

    if (!discard(id, queuePath)) {
      return reply
        .code(404)
        .send(apiError('EDICAO_NAO_ENCONTRADA', `Nenhuma edicao enfileirada com o id "${id}".`))
    }
    return reply.code(204).send()
  })

  app.delete('/api/edits', (_request, reply) => {
    if (recusaDuranteEscrita(reply)) return reply

    const body: DiscardAllResponse = { discarded: discardAll(queuePath) }
    return reply.code(200).send(body)
  })
}
