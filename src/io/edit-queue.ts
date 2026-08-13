import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { EditableField } from '../domain/editable-fields.ts'

/**
 * A fila de edicoes ainda nao aplicadas — `data/pending-edits.jsonl`.
 *
 * **Append-only, e sem estado em memoria.** Cada operacao le o arquivo: a fila
 * e pequena, e cache aqui trocaria um problema inexistente de desempenho por um
 * de invalidacao. O disco e a verdade, e e o que faz a fila sobreviver ao
 * reinicio do servidor.
 *
 * Por isso ela e relida a cada `getState`, de proposito: a fila muda **sem**
 * releitura do arquivo — `POST /api/edits` nao dispara o watcher —, entao um
 * cache aqui precisaria de invalidacao vinda das rotas.
 *
 * **Nada e escrito no `.xlsx`.** Esta camada so registra a intencao; quem toca
 * no arquivo e `H-24` a `H-26`, atras das defesas de `write-guard`.
 */

export interface EditCommand {
  ref: string
  sourceRow: number
  field: EditableField
  /** `null` e **celula vazia**, nunca cancelamento — este tem rota propria. */
  value: string | null
  /** O valor que estava la, em texto. Vazio quando a celula estava vazia. */
  previous: string
}

export interface PendingEdit extends EditCommand {
  id: string
  /** ISO 8601 UTC. */
  ts: string
}

/**
 * O descarte precisa de registro proprio porque `value: null` deixou de
 * significa-lo.
 *
 * O desenho original de `03-modelo-dados.md` usava `value: null` como lapide, e
 * por isso o documento dizia que ele "cancela a edicao anterior". `H-23` deu a
 * `null` o sentido de celula vazia — o operador precisa poder limpar uma data —,
 * e o cancelamento ganhou rota dedicada. A lapide preserva o append-only: nada
 * e reescrito, e o arquivo continua sendo o relato do que aconteceu.
 */
interface DiscardRecord {
  ts: string
  /** `id` da edicao descartada, ou `'*'` para o esvaziamento inteiro. */
  discarded: string
}

type QueueRecord = PendingEdit | DiscardRecord

export const DEFAULT_QUEUE_PATH = 'data/pending-edits.jsonl'

function isDiscard(record: QueueRecord): record is DiscardRecord {
  return 'discarded' in record
}

function readRecords(path: string): QueueRecord[] {
  if (!existsSync(path)) return []

  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as QueueRecord]
      } catch {
        // Linha ilegivel nao derruba a fila inteira: as demais continuam
        // valendo, e o operador nao perde o que enfileirou por causa de uma
        // gravacao interrompida.
        return []
      }
    })
}

function append(path: string, record: QueueRecord): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf-8')
}

export function enqueue(command: EditCommand, path: string = DEFAULT_QUEUE_PATH): PendingEdit {
  const edit: PendingEdit = { ...command, id: randomUUID(), ts: new Date().toISOString() }
  append(path, edit)
  return edit
}

/**
 * A projecao corrente: a **ultima** entrada por par `(ref, field)`, descontadas
 * as lapides.
 *
 * A ordem de saida e a da primeira aparicao do par, nao a do arquivo: reordenar
 * pela ultima edicao faria a lista dancar sob o operador a cada tecla.
 */
export function consolidated(path: string = DEFAULT_QUEUE_PATH): PendingEdit[] {
  const byPair = new Map<string, PendingEdit>()

  for (const record of readRecords(path)) {
    if (isDiscard(record)) {
      if (record.discarded === '*') byPair.clear()
      else {
        for (const [pair, edit] of byPair) {
          if (edit.id === record.discarded) byPair.delete(pair)
        }
      }
      continue
    }

    // `Map.set` sobre chave existente atualiza o valor e **mantem** a posicao
    // de insercao, entao a ordem de primeira aparicao sai de graca.
    byPair.set(`${record.ref}|${record.field}`, record)
  }

  return [...byPair.values()]
}

/** `true` quando havia o que descartar. */
export function discard(id: string, path: string = DEFAULT_QUEUE_PATH): boolean {
  if (!consolidated(path).some((edit) => edit.id === id)) return false

  append(path, { ts: new Date().toISOString(), discarded: id })
  return true
}

/** Quantas edicoes o esvaziamento descartou. */
export function discardAll(path: string = DEFAULT_QUEUE_PATH): number {
  const count = consolidated(path).length
  if (count === 0) return 0

  append(path, { ts: new Date().toISOString(), discarded: '*' })
  return count
}
