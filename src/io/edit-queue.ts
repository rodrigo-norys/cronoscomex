import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { ColorTarget } from '../domain/color-mapper.ts'
import type { EditableField } from '../domain/editable-fields.ts'
import { normKey } from '../domain/normalizer.ts'

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

export interface FieldEditCommand {
  /**
   * Ausente vale `'field'`: a fila e append-only em disco e sobrevive ao
   * reinicio, entao os registros gravados antes de H-27 seguem validos sem
   * migracao.
   */
  kind?: 'field'
  ref: string
  sourceRow: number
  field: EditableField
  /** `null` e **celula vazia**, nunca cancelamento — este tem rota propria. */
  value: string | null
  /** O valor que estava la, em texto. Vazio quando a celula estava vazia. */
  previous: string
}

/**
 * A troca de cor da linha (`H-27`). Nao tem `field` nem `value`: os tres campos
 * codificados em cor nao tem coluna, e o que muda e o estilo, nao o valor.
 *
 * Guarda a COMBINACAO, e nao o `fillId` ja resolvido: o mapa e a fonte, e
 * congelar o alvo aqui faria uma fila enfileirada antes de um ajuste em
 * `config/color-map.json` gravar a cor antiga.
 */
export interface ColorEditCommand {
  kind: 'color'
  ref: string
  sourceRow: number
  target: ColorTarget
  /** Rotulo da entrada alvo, para a tela e o conflito falarem em cor. */
  label: string
  /** A cor que a linha tinha quando o operador escolheu — o `previous` da cor. */
  previousStyleKey: string
  previousLabel: string
}

export type EditCommand = FieldEditCommand | ColorEditCommand

interface Identity {
  id: string
  /** ISO 8601 UTC. */
  ts: string
}

export type PendingFieldEdit = FieldEditCommand & Identity
export type PendingColorEdit = ColorEditCommand & Identity
export type PendingEdit = PendingFieldEdit | PendingColorEdit

/**
 * Generica para estreitar tanto `EditCommand` quanto `PendingEdit`: uma
 * assinatura fixa em `ColorEditCommand` faria quem tem `PendingEdit` perder o
 * `id` e o `ts` no estreitamento, e voltar a precisar de `as`.
 */
export function isColorEdit<T extends { kind?: 'field' | 'color' }>(
  edit: T,
): edit is T & ColorEditCommand {
  return edit.kind === 'color'
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

/**
 * Generica para devolver o MESMO ramo que recebeu: com `PendingEdit` fixo, quem
 * enfileira uma cor recebe a uniao de volta e precisa de `as` para ler o que
 * acabou de escrever.
 */
export function enqueue<T extends EditCommand>(
  command: T,
  path: string = DEFAULT_QUEUE_PATH,
): T & Identity {
  const edit = { ...command, id: randomUUID(), ts: new Date().toISOString() }
  append(path, edit)
  return edit
}

/**
 * A cor e consolidada por REF, e nao por `(ref, campo)`: a linha tem uma cor so,
 * entao a ultima escolha vence. O sufixo nao colide com nome de campo — nenhum
 * `EditableField` se chama assim.
 */
const COLOR_PAIR = 'cor'

function pairOf(edit: PendingEdit): string {
  return `${normKey(edit.ref)}|${isColorEdit(edit) ? COLOR_PAIR : edit.field}`
}

/**
 * A projecao corrente: a **ultima** entrada por par `(ref, campo)`, descontadas
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
    //
    // A chave usa `normKey`, como TD-06 define a identidade do processo. Com a
    // REF crua, duas entradas que diferem so na caixa sobrevivem a consolidacao
    // e resolvem para a MESMA celula: a cirurgia grava as duas, a segunda por
    // cima da primeira, e a validacao pos-escrita condena a escrita — o
    // operador ouve "arquivo corrompido, backup restaurado" por uma fila que a
    // aplicacao aceitou. Achado do revisor-xml em H-25.
    byPair.set(pairOf(record), record)
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

export const DEFAULT_APPLIED_DIR = 'data/applied'

/** Colisao so acontece com duas rotacoes no mesmo segundo; o teto evita laco. */
const MAX_COLLISION_SUFFIX = 100

/**
 * Horario local, como em `backup-manager` e pelo mesmo motivo (RNF-30): quem le
 * esta pasta para achar uma aplicacao e o operador, e o relogio dele e o do
 * Windows. Os campos `ts` DENTRO do arquivo seguem em ISO UTC, entao nome e
 * conteudo divergem no fuso — e o nome que existe para ser lido por gente.
 */
function stamp(moment: Date): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  const day = `${moment.getFullYear()}${pad(moment.getMonth() + 1)}${pad(moment.getDate())}`
  const time = `${pad(moment.getHours())}${pad(moment.getMinutes())}${pad(moment.getSeconds())}`
  return `${day}-${time}`
}

/**
 * Arquiva a fila em `data/applied/pending-edits-<AAAAMMDD-HHmmss>.jsonl` e a
 * recria vazia. Devolve o caminho do arquivo arquivado, ou `null` quando nao
 * havia fila.
 *
 * **A fila nunca e apagada sem registro** (03-modelo-dados.md secao 3.2): o que
 * foi gravado no `.xlsx` tem de continuar auditavel, e mover preserva ate as
 * lapides de descarte, que contam o que o operador desistiu de aplicar.
 *
 * Por renomeacao, e nao por copia mais truncamento: o arquivo sai inteiro do
 * lugar de uma vez, entao nao existe instante em que a fila esteja pela metade
 * para quem a le em paralelo.
 *
 * Chamada por H-26 **depois** de a escrita ter sido validada. Antes disso a
 * fila precisa sobreviver a qualquer recusa — e o que garante que o operador
 * nao perca o que digitou.
 */
export function rotate(
  path: string = DEFAULT_QUEUE_PATH,
  appliedDir: string = DEFAULT_APPLIED_DIR,
  now: Date = new Date(),
): string | null {
  if (!existsSync(path)) return null

  mkdirSync(appliedDir, { recursive: true })

  const stem = basename(path).replace(/\.jsonl$/, '')
  const base = `${stem}-${stamp(now)}`
  for (let suffix = 0; suffix < MAX_COLLISION_SUFFIX; suffix += 1) {
    const target = join(appliedDir, `${base}${suffix === 0 ? '' : `-${suffix}`}.jsonl`)
    if (existsSync(target)) continue

    renameSync(path, target)
    // Recriada vazia, e nao deixada ausente: `POST /api/edits` a recria sozinho,
    // mas o operador que abrir a pasta precisa ver que o lugar dela e aqui.
    writeFileSync(path, '', 'utf-8')
    return target
  }

  throw new Error(`nao foi possivel arquivar a fila em ${appliedDir}: nomes esgotados`)
}
