import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import type { Logger } from '../app/logger.ts'
import {
  aggregateMonthly,
  daysInCategory,
  diffEvents,
  type LastSeen,
  type MonthlySeries,
  nextSeen,
  type StatusEvent,
} from '../domain/history.ts'
import type { CustomsChannel, Process, StatusCategory } from '../domain/types.ts'

/**
 * Persistencia do historico de mudancas, em `data/history.jsonl` (ADR-0005).
 *
 * **Append-only, e sem retroatividade.** A serie comeca na primeira execucao da
 * aplicacao; o que aconteceu antes nao existe e nao e inventado (A-43). Apagar
 * o arquivo zera a serie e nada mais — nenhum dado de negocio vive aqui, so a
 * observacao da aplicacao sobre a planilha.
 *
 * **O indice em memoria guarda um registro por REF, nao um por evento.** O
 * arquivo cresce por mudanca e nunca e reescrito, entao ele e a unica estrutura
 * cujo tamanho acompanha o uso ao longo dos anos; a leitura e incremental por
 * blocos justamente para que 100 mil linhas nao virem 100 mil objetos vivos.
 *
 * Linha corrompida e ignorada e contada, nunca fatal: o arquivo e append-only e
 * uma linha truncada por queda de energia nao pode custar todo o historico.
 */

export const DEFAULT_HISTORY_PATH = 'data/history.jsonl'

const READ_CHUNK_BYTES = 64 * 1024

export interface HistoryOptions {
  /** Ponto de injecao para teste. Nenhum teste escreve em `data/` real. */
  path?: string | undefined
  logger?: Logger | undefined
}

/**
 * Resolve o caminho. **Sob teste, o padrao nunca e `data/`.**
 *
 * Este e o unico artefato que a aplicacao escreve sem comando do operador — o
 * `process-store` o alimenta a cada leitura —, entao um teste que esqueca de
 * injetar `path` gravaria no arquivo real e passaria a depender do que sobrou
 * de execucoes anteriores. Aconteceu na primeira execucao da suite desta
 * historia. `tests/setup.ts` aponta a variavel para um diretorio temporario por
 * arquivo de teste; sem ela, falha alto em vez de escrever em `data/`.
 *
 * Fora de teste a variavel nao e sequer consultada: nao existe caminho pelo
 * qual ambiente altere onde o historico do operador e gravado.
 */
function resolvePath(path: string | undefined): string {
  if (path !== undefined) return path
  if (process.env.NODE_ENV !== 'test') return DEFAULT_HISTORY_PATH

  const sandbox = process.env.CRONOS_TEST_HISTORY_PATH
  if (sandbox === undefined) {
    throw new Error(
      'history-store: sob teste, injete `path` ou carregue tests/setup.ts — o padrao aponta para data/history.jsonl real.',
    )
  }
  return sandbox
}

export interface RecordOptions extends HistoryOptions {
  /** Instante do evento. Injetavel para o teste fixar `ts`. */
  now?: Date
}

interface HistoryIndex {
  lastByRef: Map<string, LastSeen>
  startedAt: string | null
  skippedLines: number
  /** Tamanho do arquivo quando o indice foi montado. Ver `loadIndex`. */
  bytes: number
}

let cachedPath: string | null = null
let cachedIndex: HistoryIndex | null = null

function emptyIndex(): HistoryIndex {
  return { lastByRef: new Map(), startedAt: null, skippedLines: 0, bytes: 0 }
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return -1
  }
}

/**
 * Percorre o arquivo em blocos, sem materializar a lista de linhas.
 *
 * Generator, e nao callback, para que quem agrega possa consumir linha a linha:
 * um callback obrigaria a acumular os eventos numa lista antes de agregar, que
 * e exatamente o que o caso-limite das 100 mil linhas proibe. O `finally` fecha
 * o descritor mesmo quando o consumidor abandona a iteracao no meio.
 */
function* eachLine(path: string): Generator<string> {
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES)
    // O decoder segura os bytes de um caractere partido na fronteira do bloco.
    const decoder = new StringDecoder('utf-8')
    let rest = ''
    let read = readSync(fd, buffer, 0, READ_CHUNK_BYTES, null)

    while (read > 0) {
      const lines = (rest + decoder.write(buffer.subarray(0, read))).split('\n')
      rest = lines.pop() ?? ''
      yield* lines
      read = readSync(fd, buffer, 0, READ_CHUNK_BYTES, null)
    }

    const tail = rest + decoder.end()
    if (tail !== '') yield tail
  } finally {
    closeSync(fd)
  }
}

const CATEGORIES: readonly string[] = [
  'em_andamento',
  'em_desembaraco',
  'desembaracado',
  'fechado_aguardando_draft',
]
const CHANNELS: readonly string[] = ['verde', 'vermelho', 'indefinido']

/**
 * O canal que `H-51` aposentou, aceito **so na leitura** do arquivo ja gravado.
 *
 * O historico e append-only e sem retroatividade (ADR-0005, A-43): as linhas
 * escritas antes de 31/08/2026 dizem `nenhum` e nenhuma delas pode ser
 * reescrita. Recusa-las como valor fora do dominio esvaziaria o indice, e cada
 * REF voltaria a ser "visto pela primeira vez" — o que reiniciaria
 * `categoryChangedAt` em todos, e com ele ALE-06, o alerta de processos
 * parados, que passaria a nao acusar nenhum.
 *
 * Traduzir preserva a comparacao: linha azul gravada como `nenhum` casa com a
 * leitura de hoje, `indefinido`, e nao gera evento nenhum. As verdes geram um
 * evento com `from` igual a `to` — que a serie mensal ignora, porque cada ponto
 * dela e o estado ao fim do mes, e que a tela de detalhe ja filtra.
 *
 * **Nada e gravado com este valor.** Ele nao esta em `CustomsChannel` nem em
 * `CUSTOMS_CHANNELS`, e a rota de filtros recusa quem o pedir.
 */
const LEGACY_CHANNEL = 'nenhum'

/**
 * Le uma linha e devolve o evento, ou `null` se ela nao for interpretavel.
 *
 * Valida os campos em vez de confiar no `JSON.parse`: o arquivo e editavel a
 * mao, e uma categoria desconhecida silenciosamente aceita contaminaria a serie
 * mensal inteira, que e agregacao cega desses valores.
 */
function parseEvent(line: string): StatusEvent | null {
  if (line.trim() === '') return null

  let raw: unknown
  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }

  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>

  const { ts, ref, from, to, channel, sourceRow } = candidate
  if (typeof ts !== 'string' || Number.isNaN(new Date(ts).getTime())) return null
  if (typeof ref !== 'string' || ref === '') return null
  if (typeof to !== 'string' || !CATEGORIES.includes(to)) return null
  if (from !== null && (typeof from !== 'string' || !CATEGORIES.includes(from))) return null
  if (typeof channel !== 'string' || !(CHANNELS.includes(channel) || channel === LEGACY_CHANNEL)) {
    return null
  }
  if (typeof sourceRow !== 'number' || !Number.isInteger(sourceRow)) return null

  return {
    ts,
    ref,
    from: from as StatusCategory | null,
    to: to as StatusCategory,
    channel: (channel === LEGACY_CHANNEL ? 'indefinido' : channel) as CustomsChannel,
    sourceRow,
  }
}

/**
 * O indice do arquivo, remontado quando o tamanho dele muda por fora.
 *
 * Comparar o tamanho e o que faz o arquivo apagado voltar a ser tratado como
 * historico inexistente, em vez de servir para sempre o indice que sobrou em
 * memoria — o criterio de aceite pede que a proxima leitura o recrie e trate
 * todos os processos como vistos pela primeira vez.
 */
function loadIndex(path: string, logger?: Logger): HistoryIndex {
  const bytes = sizeOf(path)
  if (cachedPath === path && cachedIndex !== null && cachedIndex.bytes === bytes) {
    return cachedIndex
  }

  const index = emptyIndex()
  index.bytes = bytes

  if (bytes >= 0) {
    for (const line of eachLine(path)) {
      const event = parseEvent(line)
      if (event === null) {
        if (line.trim() !== '') index.skippedLines += 1
        continue
      }
      index.startedAt ??= event.ts
      index.lastByRef.set(event.ref, nextSeen(index.lastByRef.get(event.ref), event))
    }
  }

  if (index.skippedLines > 0) {
    logger?.log({
      level: 'warn',
      event: 'history.appended',
      errorCode: 'LINHA_INVALIDA',
      skippedLines: index.skippedLines,
    })
  }

  cachedPath = path
  cachedIndex = index
  return index
}

/** Ordem das chaves conforme 03-modelo-dados.md secao 3.1, mais `channel`. */
function serialize(event: StatusEvent): string {
  return JSON.stringify({
    ts: event.ts,
    ref: event.ref,
    from: event.from,
    to: event.to,
    channel: event.channel,
    sourceRow: event.sourceRow,
  })
}

/**
 * Grava os eventos desta leitura e devolve o que foi gravado.
 *
 * Nada e gravado quando nada mudou: o arquivo cresce por mudanca, nunca por
 * leitura. REF que sumiu da planilha nao gera evento — ver `diffEvents`.
 */
export function recordChanges(
  processes: readonly Process[],
  options: RecordOptions = {},
): StatusEvent[] {
  const path = resolvePath(options.path)
  const index = loadIndex(path, options.logger)
  const ts = (options.now ?? new Date()).toISOString()

  const events = diffEvents(index.lastByRef, processes, ts)
  if (events.length === 0) return []

  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${events.map(serialize).join('\n')}\n`, 'utf-8')

  for (const event of events) {
    index.lastByRef.set(event.ref, nextSeen(index.lastByRef.get(event.ref), event))
  }
  index.startedAt ??= ts
  index.bytes = sizeOf(path)

  options.logger?.log({ level: 'info', event: 'history.appended', events: events.length })
  return events
}

/**
 * Dias desde a ultima mudanca de CATEGORIA do REF. `null` quando ele nunca foi
 * visto — e `null` nao vira alerta de parado (ADR-0005).
 */
export function daysInCurrentCategory(
  ref: string,
  today: Date,
  timezone: string,
  options: HistoryOptions = {},
): number | null {
  const index = loadIndex(resolvePath(options.path), options.logger)
  return daysInCategory(index.lastByRef.get(ref), today, timezone)
}

/**
 * O mapa que ALE-06 consome. REF sem evento fica **fora** do mapa, e nao com
 * zero: `buildAlerts` trata ausencia como "sem base para contar", e zero como
 * "mudou hoje".
 */
export function stalledDaysByRef(
  processes: readonly Process[],
  today: Date,
  timezone: string,
  options: HistoryOptions = {},
): ReadonlyMap<string, number> {
  const index = loadIndex(resolvePath(options.path), options.logger)
  const stalled = new Map<string, number>()

  for (const process of processes) {
    const days = daysInCategory(index.lastByRef.get(process.ref), today, timezone)
    if (days !== null) stalled.set(process.ref, days)
  }

  return stalled
}

/** Instante do primeiro evento gravado. `null` enquanto nao houver historico. */
export function historyStartedAt(options: HistoryOptions = {}): string | null {
  return loadIndex(resolvePath(options.path), options.logger).startedAt
}

/**
 * Os eventos do REF, em ordem. Alimenta o detalhe do processo (`H-22`), que
 * mostra so as mudancas de categoria — a filtragem e de quem apresenta.
 *
 * Le o arquivo inteiro: o indice guarda apenas o ultimo estado por REF, e o
 * detalhe e uma tela por vez, nao um laco sobre 649 processos.
 */
export function eventsOf(ref: string, options: HistoryOptions = {}): StatusEvent[] {
  const path = resolvePath(options.path)
  if (!existsSync(path)) return []

  const events: StatusEvent[] = []
  for (const line of eachLine(path)) {
    const event = parseEvent(line)
    if (event !== null && event.ref === ref) events.push(event)
  }

  return events
}

export interface SeriesOptions extends HistoryOptions {
  /**
   * Recorta a serie a estes REF. `null` ou ausente traz o arquivo inteiro, e e
   * assim que a rota distingue "nenhum filtro ativo" de "filtro que nao casou
   * com nada" — os dois recortariam coisas diferentes.
   *
   * O recorte usa o REF porque e o unico campo que o evento carrega: cliente,
   * navio e agente vivem so na planilha. Quem filtra por eles resolve os REF
   * contra a leitura ATUAL — o que significa que a serie recortada descreve o
   * passado dos processos que casam **hoje**. Ver o cabecalho da rota.
   */
  refs?: ReadonlySet<string> | null
}

/**
 * A serie mensal da Pagina Historico. Percorre o arquivo em blocos e agrega em
 * uma passada — nenhuma lista de eventos e materializada.
 */
export function monthlySeries(
  months: number,
  today: Date,
  timezone: string,
  options: SeriesOptions = {},
): MonthlySeries {
  const path = resolvePath(options.path)
  if (!existsSync(path)) return { series: [], truncated: false }

  const refs = options.refs ?? null
  function* read(): Generator<StatusEvent> {
    for (const line of eachLine(path)) {
      const event = parseEvent(line)
      if (event !== null && (refs === null || refs.has(event.ref))) yield event
    }
  }

  return aggregateMonthly(read(), months, today, timezone)
}
