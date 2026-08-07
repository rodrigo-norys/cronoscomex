import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { currentValue, type EditableField, validateEdit } from '../../domain/editable-fields.ts'
import { normKey } from '../../domain/normalizer.ts'
import {
  consolidated,
  DEFAULT_QUEUE_PATH,
  discard,
  discardAll,
  enqueue,
  type PendingEdit,
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

export interface EnqueuedEditResponse extends PendingEdit {
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

export function registerEditsRoutes(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  queuePath: string = DEFAULT_QUEUE_PATH,
): void {
  app.post('/api/edits', (request, reply) => {
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
    const edit = enqueue(
      {
        ref: process.ref,
        sourceRow: process.sourceRow,
        field,
        value: body.value,
        previous: currentValue(process, field),
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
    const { id } = request.params as { id: string }

    if (!discard(id, queuePath)) {
      return reply
        .code(404)
        .send(apiError('EDICAO_NAO_ENCONTRADA', `Nenhuma edicao enfileirada com o id "${id}".`))
    }
    return reply.code(204).send()
  })

  app.delete('/api/edits', (_request, reply) => {
    const body: DiscardAllResponse = { discarded: discardAll(queuePath) }
    return reply.code(200).send(body)
  })
}
