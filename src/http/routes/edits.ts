import type { FastifyInstance, FastifyReply } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  currentValue,
  type EditableField,
  type EditRejection,
  hasForbiddenXmlChar,
  validateEdit,
} from '../../domain/editable-fields.ts'
import { normKey } from '../../domain/normalizer.ts'
import { UNWRITTEN_ROW } from '../../domain/process-projection.ts'
import { writeBlock } from '../../domain/sheet-schema.ts'
import {
  consolidated,
  DEFAULT_QUEUE_PATH,
  discard,
  discardAll,
  enqueue,
  isColorEdit,
  isRowInsert,
  type PendingEdit,
  type PendingFieldEdit,
  type PendingRowInsert,
} from '../../io/edit-queue.ts'
import { apiError, queueBlockedError } from '../errors.ts'

/**
 * As CINCO rotas de edicao — contrato em `docs/05-contratos-api.md §3`. A quinta
 * e `POST /api/edits/row`, de 02/09/2026.
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
 * Exportada porque `PATCH /api/processes/:ref/color` (`H-27`) tambem escreve na
 * fila, e desde 02/09/2026 sao CINCO as rotas que escrevem: uma segunda copia da
 * regra divergiria da primeira.
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

    // `D-65`. Com o cabecalho bloqueando, o `apply` recusa a fila INTEIRA:
    // enfileirar neste estado e enfileirar para nada, e o operador so
    // descobriria ao clicar em Aplicar, com o trabalho ja acumulado.
    //
    // **Vem antes da validacao de corpo, junto das outras duas recusas de
    // ESTADO** — `recusaDuranteEscrita` e `ARQUIVO_INDISPONIVEL` —, e a
    // consequencia fica declarada: com o cabecalho quebrado, requisicao
    // malformada recebe `409` no lugar de `400`. Nao ha caminho de escrita
    // antes dela, e o operador nao produz corpo malformado — quem produz e o
    // cliente, e ai o `409` e a informacao certa. Descer a guarda para depois
    // da validacao poria esta recusa de estado num lugar diferente das duas
    // irmas, sem ganhar nada. Achado do revisor-xml.
    const block = writeBlock(state.schemaDivergences)
    if (block !== null) return reply.code(409).send(queueBlockedError(block))

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

    /*
      **A validacao vem ANTES do 404, e portanto antes do desvio.** Nao e ordem
      arbitraria: o desvio devolve `201` e retorna, entao validar depois dele
      deixa a linha ainda nao gravada como o UNICO caminho de escrita na fila sem
      conferencia de campo e valor.

      Medido pelo revisor-xml quando uma reconstrucao do arquivo inverteu os
      dois: `eta2: "06/08/2026"` — formato errado, que a rota aceitava — entrava
      na fila, e a projecao lancava `RangeError: Invalid time value`. Como
      `getState()` projeta e TODA rota o chama, o painel inteiro passava a
      responder `500`, inclusive o `DELETE /api/edits` que esvazia a fila. A fila
      e append-only em disco e sobrevive ao reinicio: a saida seria apagar
      `data/pending-edits.jsonl` a mao.
    */
    const rejection = validateEdit(body.field, body.value)
    if (rejection !== null) {
      return reply.code(400).send(apiError(rejection, rejectionMessage(rejection, body.field)))
    }

    const process = state.processes.find((candidate) => normKey(candidate.ref) === wanted)
    if (process === undefined) {
      return reply
        .code(404)
        .send(apiError('PROCESSO_NAO_ENCONTRADO', `Nenhum processo com a REF "${body.ref}".`))
    }

    /*
      **A celula de uma linha ainda nao gravada atualiza a INSERCAO, e nao vira
      edicao de campo.** A linha pendente aparece na tabela pela projecao, e as
      celulas dela sao editaveis como as demais — mas enfileirar um
      `PendingFieldEdit` para ela criaria uma edicao cujo alvo o `write-guard`
      resolve pela REF, e a REF nao esta no arquivo: a aplicacao inteira voltaria
      com `refMissing`. A fila consolida a insercao por REF, entao regravar a
      insercao com o campo novo e o que faz a correcao substituir a anterior.

      **O criterio e o PROCESSO PROJETADO, e nao a fila.** Uma primeira versao
      procurava a insercao na fila antes de achar o processo, e o revisor-xml
      mediu o buraco: se a REF passasse a existir no arquivo — alguem a digitou
      no Excel —, a projecao deixava de mostrar a linha pendente, mas a fila
      ainda a tinha, e a edicao da linha REAL era desviada para o registro
      invisivel. O operador recebia `201`, a celula visivel nao mudava, e nada
      indicava o desvio. Com `UNWRITTEN_ROW` no criterio, a linha do arquivo
      sempre vence.
    */
    if (process.sourceRow === UNWRITTEN_ROW) {
      const insercao = consolidated(queuePath).find(
        (candidate): candidate is PendingRowInsert =>
          isRowInsert(candidate) && normKey(candidate.ref) === wanted,
      )
      if (insercao !== undefined) {
        const atualizada = enqueue(
          {
            kind: 'insert',
            ref: insercao.ref,
            values: { ...insercao.values, [body.field]: body.value },
          },
          queuePath,
        )
        const resposta: EnqueuedEditResponse = {
          ...atualizada,
          pendingEditsCount: consolidated(queuePath).length,
        }
        return reply.code(201).send(resposta)
      }
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
        !isColorEdit(candidate) &&
        !isRowInsert(candidate) &&
        candidate.ref === process.ref &&
        candidate.field === field,
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

  /**
   * `POST /api/edits/row` — a linha NOVA (02/09/2026).
   *
   * **Enfileira, e nao grava.** A linha aparece na tabela pela projecao e vai
   * para a planilha no `Aplicar alteracoes`, com as mesmas defesas das demais
   * edicoes. O numero da linha NAO e decidido aqui: quem o resolve e o
   * `write-guard`, contra a leitura do momento da escrita.
   */
  app.post('/api/edits/row', (request, reply) => {
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

    // `D-65`. Com o cabecalho bloqueando, o `apply` recusa a fila INTEIRA:
    // enfileirar neste estado e enfileirar para nada, e o operador so
    // descobriria ao clicar em Aplicar, com o trabalho ja acumulado.
    // **Vem antes da validacao de corpo, junto das outras duas recusas de
    // ESTADO** — ver a justificativa inteira em `POST /api/edits`, onde ela
    // esta escrita uma vez so: o argumento vale igual nas tres. Achado do
    // revisor-xml.
    const block = writeBlock(state.schemaDivergences)
    if (block !== null) return reply.code(409).send(queueBlockedError(block))

    const body = (request.body ?? {}) as { ref?: unknown; values?: unknown }
    if (typeof body.ref !== 'string' || body.ref.trim() === '') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', 'Informe `ref` como texto nao vazio.'))
    }
    // A REF nao passa por `validateEdit` — vai direto para a coluna A — e por
    // isso precisa da mesma recusa por conta propria (`D-61`).
    if (hasForbiddenXmlChar(body.ref)) {
      return reply
        .code(400)
        .send(
          apiError(
            'CARACTERE_INVALIDO',
            'A REF tem um caractere que a planilha nao aceita — costuma vir de texto colado de outro sistema.',
          ),
        )
    }

    const wanted = normKey(body.ref)
    /*
      `state.processes` vem PROJETADO, entao a REF pode estar so na fila. As duas
      recusas sao legitimas — em nenhum dos casos cabe uma segunda linha com a
      mesma chave —, mas dizer "ja existe na planilha" sobre algo que so esta na
      fila mandaria o operador procurar no Excel o que esta na tela dele.
    */
    const naFila = consolidated(queuePath).some(
      (candidate) => isRowInsert(candidate) && normKey(candidate.ref) === wanted,
    )
    if (state.processes.some((candidate) => normKey(candidate.ref) === wanted) || naFila) {
      return reply
        .code(409)
        .send(
          apiError(
            'REF_DUPLICADA',
            naFila
              ? `A REF "${body.ref}" ja esta na fila, como linha nova ainda nao gravada.`
              : `Ja existe um processo com a REF "${body.ref}".`,
          ),
        )
    }

    const values: Record<string, string | null> = {}
    for (const [field, value] of Object.entries((body.values ?? {}) as Record<string, unknown>)) {
      if (value !== null && typeof value !== 'string') {
        return reply
          .code(400)
          .send(apiError('CORPO_INVALIDO', `O valor de "${field}" precisa ser texto ou null.`))
      }
      const rejection = validateEdit(field, value)
      if (rejection !== null) {
        return reply.code(400).send(apiError(rejection, rejectionMessage(rejection, field)))
      }
      values[field] = value
    }

    const insercao = enqueue({ kind: 'insert', ref: body.ref.trim(), values }, queuePath)
    const response: EnqueuedEditResponse = {
      ...insercao,
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

/** A frase de cada recusa de `validateEdit`, a mesma nas duas rotas que a usam. */
function rejectionMessage(rejection: EditRejection, field: string): string {
  if (rejection === 'CAMPO_NAO_EDITAVEL') return `O campo "${field}" nao e editavel.`
  if (rejection === 'CARACTERE_INVALIDO') {
    return `O texto de "${field}" tem um caractere que a planilha nao aceita — costuma vir de texto colado de outro sistema.`
  }
  return `Valor invalido para "${field}".`
}
