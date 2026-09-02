import {
  type ClientGroup,
  type ClientGroupIndex,
  type ClientMapEntry,
  indexClientGroups,
} from '../domain/client-mapper.ts'
import { type ColorMapEntry, indexColorMap, resolveFillTarget } from '../domain/color-mapper.ts'
import {
  type BuildResult,
  buildProcesses,
  quarantineRate,
  toRawRow,
} from '../domain/process-builder.ts'
import { applyEdits, type ProjectedEdit } from '../domain/process-projection.ts'
import type { TeamMember } from '../domain/team-mapper.ts'
import type { Process, RawRow } from '../domain/types.ts'
import {
  consolidated,
  DEFAULT_QUEUE_PATH,
  isColorEdit,
  isRowInsert,
  type PendingEdit,
} from '../io/edit-queue.ts'
import { DEFAULT_HISTORY_PATH, recordChanges } from '../io/history-store.ts'
import { detectInterference } from '../io/interference-detector.ts'
import { buildReport, DEFAULT_QUARANTINE_PATH, writeReport } from '../io/quarantine-reporter.ts'
import { type ReadResult, readWorkbook } from '../io/xlsx-reader.ts'
import { type AppConfig, WORKBOOK_UNSET } from './config.ts'
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
  /**
   * Mapa de clientes de `H-48`, consumido por `H-49`. **Opcional, e vazio e
   * legitimo**: sem ele o cliente vale o que a celula diz, que e o
   * comportamento anterior a `H-49`.
   */
  clientMap?: readonly ClientMapEntry[]
  /**
   * Grupos de clientes de `H-55`. Indexados uma vez em `initStore`, como o mapa
   * de cores — a alternativa varreria a lista de grupos por linha lida.
   */
  clientGroups?: readonly ClientGroup[]
  /** Mapa de equipe de `H-48`. Vazio faz a atribuicao cair na cor (`H-50`). */
  teamMap?: readonly TeamMember[]
  quarantinePath?: string
  /** Ponto de injecao para teste; em producao, `data/history.jsonl`. */
  historyPath?: string
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
let clientGroupIndex: ClientGroupIndex = new Map()
let current: StoreState = emptyState()
let inFlight: Promise<void> | null = null

/** Prepara o store e zera o estado. Nao le a planilha — quem le e `reload()`. */
export function initStore(next: StoreOptions): void {
  options = next
  colorMapIndex = indexColorMap(next.colorMap)
  clientGroupIndex = indexClientGroups(next.clientGroups ?? [])
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
 *
 * O mapa de clientes viaja junto (`H-49`): a projecao refaz o processo inteiro,
 * e sem ele uma edicao qualquer tiraria o processo do cliente consolidado.
 */
export function getState(): StoreState {
  /*
    **A saida por lista vazia caiu em 02/09/2026**, e ela era um atalho que
    deixou de valer quando a fila passou a CRIAR processo. Numa aba sem nenhum
    — a `2027` recem-criada, que e o cenario que o piso de `firstDataRow` existe
    para atender — a linha nova era enfileirada, nao aparecia na tabela, e toda
    tentativa de preencher uma celula dela voltava `404` sobre a REF que a
    propria aplicacao acabara de aceitar. Achado do revisor-xml.

    Sem `initStore` a projecao continua pulada, e por outro motivo: nao ha
    `statusAliases` nem mapa de cor para re-derivar.
  */
  if (options === null) return { ...current }

  const edits = consolidated(options.queuePath ?? DEFAULT_QUEUE_PATH)
  if (edits.length === 0) return { ...current }

  const { processes } = applyEdits(current.processes, toProjected(edits, options.colorMap), {
    colorMap: colorMapIndex,
    statusAliases: options.statusAliases,
    clientMap: options.clientMap ?? [],
    clientGroups: clientGroupIndex,
    teamMap: options.teamMap ?? [],
  })

  return { ...current, processes, pendingEdits: edits }
}

/**
 * Resolve a combinacao de cada edicao de cor contra o mapa, porque a projecao
 * recebe a chave de estilo alvo.
 *
 * Combinacao sem entrada e DESCARTADA da projecao: a rota so enfileira o que o
 * mapa representa, entao isto so acontece se `config/color-map.json` tiver
 * mudado depois do enfileiramento. Projetar o que a escrita nao sabe gravar
 * mostraria ao operador uma cor que a aplicacao nao produz — e o `write-guard`
 * recusa a mesma fila com `ESCRITA_INVALIDA`.
 */
function toProjected(edits: PendingEdit[], colorMap: readonly ColorMapEntry[]): ProjectedEdit[] {
  return edits.flatMap<ProjectedEdit>((edit) => {
    // A insercao atravessa inteira: ela nao resolve nada contra mapa nenhum.
    if (isRowInsert(edit)) return [{ kind: 'insert', ref: edit.ref, values: edit.values }]
    if (!isColorEdit(edit)) return [edit]

    const entry = resolveFillTarget(edit.target, colorMap)
    return entry === null ? [] : [{ kind: 'color', ref: edit.ref, styleKey: entry.styleKey }]
  })
}

function describeFailure(error: unknown, workbookPath: string): string {
  // ANTES de interpretar o errno: sem caminho configurado a leitura falha com
  // ENOENT, e a frase saia como "nao foi encontrada em ." — truncada, e
  // afirmando que havia um caminho que sumiu. Ausencia de configuracao e
  // arquivo ausente sao coisas diferentes (regra inviolavel 3), e e a primeira
  // que o operador ve na primeira execucao. Medido em Windows, H-35.
  if (workbookPath === WORKBOOK_UNSET) {
    return 'Nenhuma planilha configurada ainda.'
  }

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

/**
 * Grava as mudancas de categoria e de canal desta leitura (`H-28`).
 *
 * Recebe `result.processes` — o que a planilha diz —, nunca o estado projetado
 * de `getState`: projetar a fila aqui registraria como observado o valor que o
 * operador ainda nao aplicou, e o historico deixaria de descrever o arquivo.
 *
 * Falhar degrada a serie e ALE-06, nao o painel: a leitura ja foi bem-sucedida
 * e o estado permanece 'pronto'. Mesma politica do relatorio de quarentena.
 */
function persistHistory(
  processes: readonly Process[],
  readAt: Date,
  path: string,
  logger: Logger,
): void {
  try {
    recordChanges(processes, { path, now: readAt, logger })
  } catch {
    // Perder o evento custa a serie, nao a operacao.
  }
}

/**
 * Uma releitura ja em voo nao pode apagar o estado 'escrevendo'. O watcher e
 * pausado pelo write-guard, mas a pausa cancela o agendamento — nao uma leitura
 * que ja comecou. Sem isto, `finishWriting` sairia pelo early-return e
 * `POST /api/reload` deixaria de recusar no meio da gravacao.
 */
function settled(next: AppState): AppState {
  return current.state === 'escrevendo' ? 'escrevendo' : next
}

async function runReload(deps: StoreOptions): Promise<void> {
  const logger = deps.logger ?? NULL_LOGGER
  current = { ...current, state: settled('lendo') }
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
        state: settled('pronto'),
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
      clientMap: deps.clientMap ?? [],
      clientGroups: clientGroupIndex,
      teamMap: deps.teamMap ?? [],
    })

    const durationMs = Math.round(performance.now() - startedAt)
    current = {
      state: settled('pronto'),
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

    persistHistory(result.processes, read.readAt, deps.historyPath ?? DEFAULT_HISTORY_PATH, logger)
  } catch (error) {
    current = {
      ...current,
      state: settled('degradado'),
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

/**
 * Troca o mapa de clientes com o processo no ar, e reprojeta (02/09/2026).
 *
 * Existe porque o mapa deixou de ser so configuracao de partida: declarar o
 * cliente de uma linha na Pagina Operacional grava em `client-map.json`, e sem
 * este passo a coluna Cliente continuaria mostrando a resolucao antiga ate o
 * proximo reinicio.
 *
 * **Muta `options.clientMap` em vez de trocar o objeto de opcoes**, pelo mesmo
 * motivo de `reconfigureWorkbook`: as rotas e o write-guard capturaram o mesmo
 * objeto por referencia na partida.
 *
 * **Re-deriva em memoria, e NAO chama `reload`** — medido em 02/09/2026, com a
 * regra gravada e a tela mostrando a consolidacao antiga. `runReload` sai antes
 * de recompor quando o hash do arquivo nao mudou, que e a otimizacao de `H-28`
 * contra o "salvar sem editar" do OneDrive; aqui quem mudou foi o MAPA, e o
 * arquivo esta igual de proposito — a guarda acerta o caso dela e erra este.
 *
 * A volta pelas linhas cruas e o mesmo caminho que a projecao da fila usa desde
 * `H-23`: `toRawRow` reconstroi a linha e `buildProcesses` refaz o processo
 * inteiro, porque consolidar entra na CONSTRUCAO — reescrever so o rotulo
 * deixaria `clientKey` e o grupo apontando para o cliente anterior.
 */
export async function refreshClientMap(
  clients: readonly ClientMapEntry[],
  groups: readonly ClientGroup[],
): Promise<void> {
  const deps = options
  if (!deps) {
    throw new StoreNotInitializedError('initStore precisa ser chamado antes de refreshClientMap.')
  }

  // Uma leitura em voo terminaria DEPOIS, gravando processos derivados do mapa
  // antigo por cima destes.
  await settle()
  deps.clientMap = clients
  deps.clientGroups = groups
  clientGroupIndex = indexClientGroups(groups)
  current = { ...current, processes: rebuildProcesses(current.processes.map(toRawRow)) }
}

let reconfiguring: Promise<void> | null = null

/**
 * Aponta a aplicacao para outra planilha, com o processo no ar (H-34).
 *
 * **Muta `options.config` em vez de trocar o objeto**, e isso e deliberado: o
 * MESMO `AppConfig` foi passado a `initStore`, a `initWriteGuard` e a cada
 * registrador de rota, que o capturaram por referencia. Trocar o objeto aqui
 * deixaria todos eles apontando para o caminho velho — a rota de saude
 * responderia o antigo enquanto a leitura usaria o novo, que e a forma mais
 * silenciosa possivel de errar. O unico consumidor que guarda uma COPIA do
 * caminho e o watcher, criado em `src/http/server.ts`, e por isso ele e
 * recriado la, e nao aqui: o store nao o conhece.
 *
 * **Serializa por construcao.** Duas requisicoes concorrentes entram na mesma
 * fila, e cada uma so comeca depois que a anterior terminou — falhando ou nao.
 * E `settle()` garante que nenhuma reconfiguracao comeca no meio de uma
 * leitura: trocar o caminho ali deixaria a leitura em voo gravando o estado do
 * arquivo ANTIGO por cima do novo.
 *
 * O estado volta a vazio antes da releitura, de proposito: se a planilha nova
 * nao puder ser lida, `lastReadAt` fica em null e a tela de configuracao
 * reaparece, em vez de o painel seguir exibindo o dado do arquivo anterior.
 */
export async function reconfigureWorkbook(workbookPath: string): Promise<void> {
  const deps = options
  if (!deps) {
    throw new StoreNotInitializedError(
      'initStore precisa ser chamado antes de reconfigureWorkbook.',
    )
  }

  const run = async (): Promise<void> => {
    await settle()
    deps.config.workbookPath = workbookPath
    current = emptyState()
    await reload()
  }

  const mine = (reconfiguring ?? Promise.resolve()).catch(() => {}).then(run)
  reconfiguring = mine
  try {
    await mine
  } finally {
    if (reconfiguring === mine) reconfiguring = null
  }
}

/**
 * Espera a releitura em voo terminar. Resolve na hora quando nao ha nenhuma.
 *
 * `watcher.pause()` cancela o AGENDAMENTO, nao uma leitura ja iniciada — o
 * write-guard precisa disto para nao gravar sob os pes de quem esta lendo. E o
 * caso-limite de H-26: "aplicacao disparada durante uma releitura aguarda a
 * releitura terminar".
 *
 * **Nao tem timeout, e propaga o que `inFlight` rejeitar.** `reload` transforma
 * falha de LEITURA em estado 'degradado', mas uma rejeicao vinda do `finally`
 * ou do logger escaparia por aqui; quem chama e o write-guard, que a contem no
 * proprio `catch`. Leitura que nunca resolve — caminho de rede, placeholder do
 * OneDrive — prende a escrita ate reiniciar, limite que a leitura canonica ja
 * tinha e que este passo herda.
 */
export async function settle(): Promise<void> {
  if (inFlight) await inFlight
}

/**
 * Recompoe processos a partir de linhas cruas, com os MESMOS mapas de cor e de
 * cliente e os mesmos aliases da leitura corrente.
 *
 * H-25 usa para descrever o arquivo em disco no momento da escrita, sem passar
 * por `getState` — que devolve os processos ja **projetados** com a fila, e por
 * isso responderia o valor pretendido no lugar do valor gravado.
 *
 * Sem `initStore`, devolve lista vazia: sem mapa de cor nao ha o que compor, e
 * lancar aqui faria o write-guard rejeitar, contra a invariante dele.
 */
export function rebuildProcesses(rows: RawRow[]): Process[] {
  if (options === null) return []
  return buildProcesses(rows, {
    colorMap: colorMapIndex,
    statusAliases: options.statusAliases,
    clientMap: options.clientMap ?? [],
    clientGroups: clientGroupIndex,
    teamMap: options.teamMap ?? [],
  }).processes
}

/**
 * Marca a escrita em curso. O write-guard de H-25 e o unico chamador.
 *
 * `POST /api/reload` recusa com 409 ESCRITA_EM_ANDAMENTO enquanto o estado for
 * 'escrevendo'; sem este par de funcoes aquela guarda seria inalcancavel, como
 * foi de H-08 ate aqui.
 */
export function markWriting(): void {
  current = { ...current, state: 'escrevendo' }
}

/**
 * Encerra a escrita. O estado de volta e DERIVADO de `lastReadOk`, nao guardado
 * na entrada: um campo com o estado anterior poderia dessincronizar do estado
 * corrente, e nao ha o que ele saiba que `lastReadOk` ja nao diga.
 */
export function finishWriting(): void {
  if (current.state !== 'escrevendo') return
  current = { ...current, state: current.lastReadOk ? 'pronto' : 'degradado' }
}

/** Acesso injetavel nas rotas. Ver src/http/routes/health.ts. */
export const store: StoreAccess = { getState, reload }
