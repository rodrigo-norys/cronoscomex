import { type ColorMapEntry, indexColorMap } from '../domain/color-mapper.ts'
import { type BuildResult, buildProcesses, quarantineRate } from '../domain/process-builder.ts'
import { applyEdits } from '../domain/process-projection.ts'
import type { Process } from '../domain/types.ts'
import { consolidated, DEFAULT_QUEUE_PATH, type PendingEdit } from '../io/edit-queue.ts'
import { detectInterference } from '../io/interference-detector.ts'
import { buildReport, DEFAULT_QUARANTINE_PATH, writeReport } from '../io/quarantine-reporter.ts'
import { type ReadResult, readWorkbook } from '../io/xlsx-reader.ts'
import type { AppConfig } from './config.ts'
import { type Logger, NULL_LOGGER, type ReadErrorCode } from './logger.ts'

/**
 * Estado unico da aplicacao: a planilha lida, ja normalizada, mais o resultado
 * da ultima leitura.
 *
 * Regra que rege este modulo: uma leitura que falha NUNCA descarta a leitura
 * anterior. Um indicador em zero e indistinguivel de um indicador sem dado, e
 * essa confusao e exatamente o que o painel existe para eliminar
 * (04-arquitetura.md secao 5).
 */

/** Ciclo de vida de 04-arquitetura.md secao 5. */
export type AppState = 'partindo' | 'lendo' | 'pronto' | 'escrevendo' | 'degradado'

export interface StoreState {
  state: AppState
  processes: Process[]
  fileHash: string | null
  /** Nome real da aba lida. Difere da config quando ela traz `null`. */
  sheetName: string | null
  lastReadAt: Date | null
  lastReadOk: boolean
  degradedReason: string | null
  /** Duracao da ultima leitura concluida, em ms. Metrica de RF-16. */
  lastReadDurationMs: number | null
  /** Linhas com ao menos uma celula preenchida. */
  rowsRead: number
  rowsAccepted: number
  rowsQuarantined: number
  /**
   * Alguem tem a planilha aberta no Excel. **Sinal, nunca acao** (A-58): a
   * leitura acontece igual. Quem reage e a faixa de `H-15` e a escrita de
   * `H-25`.
   */
  externalLock: boolean
  /** Arquivos de conflito do OneDrive, so o nome. Vazio quando nao ha. */
  conflictFiles: string[]
  /**
   * `H-23`. As edicoes que esperam para ser gravadas, ja consolidadas.
   *
   * `processes` ja vem **projetado**: o que o painel inteiro mostra e o arquivo
   * mais o que ainda nao foi gravado. Esta lista existe para a tela poder dizer
   * que o valor e pendente, em vez de exibi-lo como se estivesse na planilha —
   * e serve as tres apresentacoes: a contagem no health, a marca por linha na
   * tabela, e o painel do detalhe.
   */
  pendingEdits: PendingEdit[]
}

export interface StoreAccess {
  getState(): StoreState
  reload(): Promise<void>
}

export interface StoreOptions {
  config: AppConfig
  colorMap: readonly ColorMapEntry[]
  statusAliases: readonly string[]
  quarantinePath?: string
  /** Ponto de injecao para teste; em producao, `data/pending-edits.jsonl`. */
  queuePath?: string
  /** Ausente, nada e registrado — util em teste e no uso do store como biblioteca. */
  logger?: Logger
  /** Ponto de injecao para teste. Nenhum teste toca a planilha real (RNF-38). */
  readWorkbookFn?: (config: AppConfig) => Promise<ReadResult>
}

export class StoreNotInitializedError extends Error {
  override readonly name = 'StoreNotInitializedError'
}

function emptyState(): StoreState {
  return {
    state: 'partindo',
    processes: [],
    fileHash: null,
    sheetName: null,
    lastReadAt: null,
    lastReadOk: false,
    degradedReason: null,
    lastReadDurationMs: null,
    rowsRead: 0,
    rowsAccepted: 0,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    pendingEdits: [],
  }
}

let options: StoreOptions | null = null
let colorMapIndex: ReadonlyMap<string, ColorMapEntry> = new Map()
let current: StoreState = emptyState()
let inFlight: Promise<void> | null = null

/** Prepara o store e zera o estado. Nao le a planilha — quem le e `reload()`. */
export function initStore(next: StoreOptions): void {
  options = next
  colorMapIndex = indexColorMap(next.colorMap)
  current = emptyState()
  inFlight = null
}

/**
 * O estado com a fila de edicoes **ja projetada** sobre os processos lidos.
 *
 * A fila e lida a cada chamada, de proposito: ela muda sem releitura do arquivo
 * — um `POST /api/edits` nao dispara o watcher —, e cache aqui precisaria de
 * invalidacao vinda das rotas. O arquivo tem no maximo alguns KB, e a
 * alternativa custa um modo de falha em que a tela mostra edicao que nao existe
 * mais.
 *
 * Sem `initStore`, a projecao e pulada: nao ha `statusAliases` nem mapa de cor
 * para re-derivar, e devolver o estado vazio e o comportamento correto.
 */
export function getState(): StoreState {
  if (options === null || current.processes.length === 0) return { ...current }

  const edits = consolidated(options.queuePath ?? DEFAULT_QUEUE_PATH)
  if (edits.length === 0) return { ...current }

  const { processes } = applyEdits(current.processes, edits, {
    colorMap: colorMapIndex,
    statusAliases: options.statusAliases,
  })

  return { ...current, processes, pendingEdits: edits }
}

function describeFailure(error: unknown, workbookPath: string): string {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') {
    return `A planilha nao foi encontrada em ${workbookPath}. Confira se a pasta do OneDrive esta sincronizada.`
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return `Sem permissao para ler ${workbookPath}.`
  }
  if (code === 'EBUSY') {
    return `A planilha esta em uso por outro programa: ${workbookPath}.`
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Grava o relatorio de quarentena. Falhar aqui degrada a auditoria, nao o
 * painel: a leitura ja foi bem-sucedida e o estado permanece 'pronto'.
 */
function persistReport(
  result: BuildResult,
  fileHash: string,
  readAt: Date,
  path: string,
  logger: Logger,
): void {
  try {
    writeReport(buildReport(result, fileHash, readAt), path)
    logger.log({
      level: 'info',
      event: 'quarantine.reported',
      rowsQuarantined: result.quarantine.length,
      quarantineRate: quarantineRate(result),
    })
  } catch {
    // Perder o relatorio custa auditoria, nao operacao.
  }
}

async function runReload(deps: StoreOptions): Promise<void> {
  const logger = deps.logger ?? NULL_LOGGER
  current = { ...current, state: 'lendo' }
  logger.log({ level: 'info', event: 'read.start' })

  const startedAt = performance.now()
  // Distingue falha do arquivo de defeito da propria composicao: e a unica
  // informacao acionavel que `read.failed` pode carregar sem texto livre.
  let stage: ReadErrorCode = 'ARQUIVO_INDISPONIVEL'

  try {
    const read = await (deps.readWorkbookFn ?? readWorkbook)(deps.config)
    stage = 'ERRO_INTERNO'

    // Salvar sem editar produz evento de sistema de arquivos com conteudo
    // identico. A leitura ocorreu — `lastReadAt` avanca —, mas recompor os
    // processos e regravar o relatorio produziria exatamente o mesmo
    // resultado, e em H-28 geraria evento de historico sem mudanca alguma.
    if (read.fileHash === current.fileHash) {
      const durationMs = Math.round(performance.now() - startedAt)
      current = {
        ...current,
        state: 'pronto',
        lastReadAt: read.readAt,
        lastReadOk: true,
        degradedReason: null,
        lastReadDurationMs: durationMs,
      }
      logger.log({
        level: 'info',
        event: 'read.done',
        durationMs,
        rowsRead: current.rowsRead,
        rowsAccepted: current.rowsAccepted,
        rowsQuarantined: current.rowsQuarantined,
      })
      return
    }

    const result = buildProcesses(read.rows, {
      colorMap: colorMapIndex,
      statusAliases: deps.statusAliases,
    })

    const durationMs = Math.round(performance.now() - startedAt)
    current = {
      state: 'pronto',
      processes: result.processes,
      fileHash: read.fileHash,
      sheetName: read.sheetName,
      lastReadAt: read.readAt,
      lastReadOk: true,
      degradedReason: null,
      lastReadDurationMs: durationMs,
      rowsRead: result.totalDataRows,
      rowsAccepted: result.processes.length,
      rowsQuarantined: result.quarantine.length,
      externalLock: current.externalLock,
      conflictFiles: current.conflictFiles,
      // A releitura nao mexe na fila: uma edicao enfileirada continua pendente
      // depois de o arquivo mudar. Quem projeta e `getState`, a cada chamada.
      pendingEdits: current.pendingEdits,
    }

    logger.log({
      level: 'info',
      event: 'read.done',
      durationMs,
      rowsRead: result.totalDataRows,
      rowsAccepted: result.processes.length,
      rowsQuarantined: result.quarantine.length,
    })

    persistReport(
      result,
      read.fileHash,
      read.readAt,
      deps.quarantinePath ?? DEFAULT_QUARANTINE_PATH,
      logger,
    )
  } catch (error) {
    current = {
      ...current,
      state: 'degradado',
      lastReadOk: false,
      degradedReason: describeFailure(error, deps.config.workbookPath),
    }
    // A mensagem completa vai para a interface, nunca para o log: ela carrega
    // o caminho do arquivo e pode carregar conteudo vindo da biblioteca.
    logger.log({ level: 'error', event: 'read.failed', errorCode: stage })
  } finally {
    // Roda SEMPRE, inclusive quando a leitura falha — e justamente com arquivo
    // de conflito na pasta, ou com o Excel segurando o arquivo, que a leitura
    // tende a falhar. Suprimir o sinal no erro o esconderia exatamente quando
    // ele mais importa. `detectInterference` nunca lanca.
    current = { ...current, ...detectInterference(deps.config.workbookPath) }
  }
}

/**
 * Rele a planilha e recompoe o estado. Nunca rejeita: uma falha de leitura vira
 * estado 'degradado', que a interface exibe com o horario da ultima leitura boa.
 *
 * Chamadas concorrentes sao coalescidas na mesma leitura. Duas leituras
 * simultaneas do mesmo arquivo produziriam o mesmo resultado ao custo de dois
 * parses, e a ordem de conclusao decidiria qual estado sobrevive.
 */
export async function reload(): Promise<void> {
  const deps = options
  if (!deps) {
    throw new StoreNotInitializedError('initStore precisa ser chamado antes de reload.')
  }
  if (inFlight) return inFlight

  inFlight = runReload(deps).finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Acesso injetavel nas rotas. Ver src/http/routes/health.ts. */
export const store: StoreAccess = { getState, reload }
