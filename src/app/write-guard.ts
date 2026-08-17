import { constants } from 'node:fs'
import { access, open, readFile, rename, rm } from 'node:fs/promises'
import {
  type ColorMapEntry,
  resolveColor,
  resolveFillTarget,
  STYLED_COLUMNS,
} from '../domain/color-mapper.ts'
import {
  currentValue,
  EDITABLE_FIELDS,
  type EditableField,
  isEditableField,
  validateEdit,
} from '../domain/editable-fields.ts'
import { normKey } from '../domain/normalizer.ts'
import type { Process, RawCell, RawRow } from '../domain/types.ts'
import {
  backupFrom,
  DEFAULT_BACKUP_DIR,
  DEFAULT_KEEP_COUNT,
  DEFAULT_KEEP_DAYS,
  prune,
  restore,
} from '../io/backup-manager.ts'
import {
  consolidated,
  DEFAULT_APPLIED_DIR,
  DEFAULT_QUEUE_PATH,
  isColorEdit,
  type PendingEdit,
  rotate,
} from '../io/edit-queue.ts'
import { detectInterference } from '../io/interference-detector.ts'
import type { Watcher } from '../io/watcher.ts'
import { hashBytes, type ReadResult, readWorkbook } from '../io/xlsx-reader.ts'
import {
  applyCellEdits,
  applyRowFill,
  type CellEdit,
  type RowFillEdit,
} from '../io/xlsx-surgeon.ts'
import type { AppConfig } from './config.ts'
import { type Logger, NULL_LOGGER } from './logger.ts'
import {
  finishWriting,
  getState,
  markWriting,
  rebuildProcesses,
  type StoreState,
  settle,
} from './process-store.ts'

/**
 * As seis defesas de integridade, na ordem de 04-arquitetura.md secao 3.2:
 * pausar watcher, ESPERAR a releitura em voo, verificar lock, conferir hash,
 * **cirurgia, backup**, gravacao atomica, validacao, arquivar a fila, retomar
 * watcher. A espera nao esta no diagrama: `pause` cancela o agendamento, nao a
 * leitura ja iniciada, e sem ela a leitura canonica competiria com uma
 * releitura em curso.
 *
 * **A cirurgia vem antes do backup desde H-27**, invertendo o diagrama — que
 * traz a emenda de 17/08/2026 registrando a troca. Ela e pura: opera sobre o
 * buffer em memoria e nao toca o disco, entao adia-la nao muda o que o backup
 * guarda. O que a inversao compra e nao gastar backup, nem reescrever o
 * arquivo, quando a fila resolve para o que a planilha ja tem. A invariante
 * segue de pe: o backup sai do MESMO buffer conferido por hash, e nada e
 * gravado antes dele.
 *
 * A invariante que rege o modulo: **ao primeiro sinal de risco a escrita e
 * recusada, e a fila nunca e perdida**. Em qualquer recusa ela fica intacta; no
 * sucesso ela e ARQUIVADA em `data/applied/`, nunca apagada.
 *
 * O arquivamento acontece aqui, e nao na rota de H-26, por causa da janela:
 * `finishWriting` devolve o estado a 'pronto' e `POST /api/edits` volta a
 * aceitar. Rotacionar depois disso arquivaria — fazendo sumir — a edicao que o
 * operador digitou durante a escrita, sem que ela tivesse sido gravada. As
 * rotas de escrita da fila recusam enquanto o estado for 'escrevendo', e e a
 * combinacao das duas coisas que fecha a janela.
 *
 * **A celula alvo e resolvida pela REF, nunca pelo `sourceRow` da fila.** O
 * numero de linha e congelado no momento em que o operador edita, e uma linha
 * inserida ou removida no Excel o desloca. O hash sozinho nao cobre isso: o
 * watcher rele o arquivo alterado e o hash guardado passa a ser o NOVO, entao a
 * conferencia aprova e a gravacao vai para a linha de outro processo — com
 * `ok: true`. O revisor-xml reproduziu, e e o defeito que a historia existe
 * para impedir. Por isso a linha vem da leitura do arquivo, casada por REF, e
 * o `previous` de cada edicao e conferido contra o valor atual SEMPRE, e nao
 * apenas quando o hash diverge.
 *
 * **A fila tem dois tipos de edicao** desde H-27, e as duas percorrem as mesmas
 * defesas: campo, que grava valor de celula, e cor, que troca o `fillId` das
 * colunas A a L. Uma so cirurgia por aplicacao seria mais simples, mas o
 * contrato de H-27 fixa `applyRowFill` a parte — entao as duas sao encadeadas
 * sobre o mesmo buffer, dentro do mesmo backup e da mesma validacao.
 *
 * O ponto sem volta e a renomeacao. Tudo antes dela pode falhar deixando o
 * original intacto; da validacao em diante, a unica saida e restaurar o backup.
 * Por isso o backup e gravado antes de qualquer modificacao, a partir do MESMO
 * buffer que a cirurgia recebe.
 *
 * O mutex e uma variavel deste modulo, e nao o estado 'escrevendo' do store:
 * amarrar a exclusao mutua a um singleton alheio faria ESCRITA_EM_ANDAMENTO
 * depender de `initStore`, que o teste do guard nao precisa chamar.
 */

export type WriteRefusal =
  | 'EXCEL_ABERTO'
  | 'ARQUIVO_MUDOU'
  | 'NADA_A_APLICAR'
  | 'ESCRITA_EM_ANDAMENTO'
  | 'ESCRITA_INVALIDA'
  /**
   * Fora dos cinco do backlog, e exigido por 05-contratos-api.md secao 3, que
   * cataloga `503 ARQUIVO_INDISPONIVEL` para `POST /api/edits/apply`. Sem ele o
   * arquivo sumido viraria 500 generico, e a excecao levaria `workbookPath`
   * junto — o caminho que 08-qualidade-operacao.md secao 5.3 mantem fora do log.
   */
  | 'ARQUIVO_INDISPONIVEL'
  /**
   * O arquivo NAO mudou desde a ultima leitura — os dois hashes conferem —, mas
   * o valor que a edicao ia sobrescrever ja nao e o que estava la quando o
   * operador editou. Codigo proprio porque a instrucao ao operador e outra:
   * `ARQUIVO_MUDOU` manda reler a planilha, e aqui reler nao muda nada. Sem a
   * separacao, o corpo do 409 sairia com `expectedHash === actualHash`,
   * dizendo que a planilha mudou e provando o contrario na mesma resposta.
   */
  | 'EDICAO_OBSOLETA'

/** As cinco chaves de 05-contratos-api.md secao 3, mais a sexta de H-25. */
export interface Conflict {
  ref: string
  /**
   * `'cor'` para a troca de estilo de H-27. Os tres valores abaixo passam a ser
   * o ROTULO da cor — "Verde (tom A)" —, porque a troca nao altera valor nenhum
   * e descreve-la como valor mentiria sobre o que mudou.
   */
  field: EditableField | 'cor'
  /** O valor que estava na celula quando o operador editou. */
  valueWhenEdited: string
  /** O valor que esta na celula agora. Vazio tambem quando a linha sumiu. */
  valueNow: string
  /** O que a edicao pretendia gravar. Vazio quando ela limpa a celula. */
  yourValue: string
  /**
   * A REF nao esta mais no arquivo. Sem isto, `valueNow: ''` diria "a celula
   * esta vazia", que e falso — a linha nao existe. Regra inviolavel 3.
   */
  refMissing?: true
}

export interface WriteResult {
  ok: boolean
  refusal: WriteRefusal | null
  /** Edicoes da fila aplicadas — campos e cores, uma cada. */
  applied: number
  /** Celulas que receberam VALOR. Nao conta as repintadas. */
  cellsWritten: number
  /**
   * Linhas repintadas (`H-27`). Separado de `cellsWritten` porque uma troca de
   * cor toca 12 celulas (A-44) sem gravar valor algum: soma-las diria ao
   * operador que ele gravou doze coisas quando ele mudou uma.
   */
  rowsRepainted: number
  backupPath: string | null
  conflicts: Conflict[]
  restored: boolean
  durationMs: number
  /**
   * Os dois hashes do corpo do 409. Preenchidos em `ARQUIVO_MUDOU`, onde
   * diferem, e tambem em `EDICAO_OBSOLETA`, onde sao **iguais** — e e a
   * igualdade que prova ao operador que ninguem mexeu no arquivo. `null` nas
   * demais recusas e no sucesso.
   */
  expectedHash: string | null
  actualHash: string | null
  /**
   * O que aconteceu com o `.xlsx` em disco. **A rota nao tem como inferir isto
   * de `restored`**, e tentar seria decidir sobre o arquivo fora do guard
   * (regra inviolavel 6): `restored: false` sai tanto de uma recusa que nunca
   * gravou quanto de uma validacao que reprovou E cuja restauracao tambem
   * falhou — a segunda deixa o arquivo possivelmente invalido, e o backup e a
   * unica saida. Achado do revisor-xml.
   *
   * - `intacto`: nada foi gravado, ou a gravacao falhou antes da renomeacao.
   * - `gravado`: gravou e a validacao aprovou. So no sucesso.
   * - `restaurado`: gravou, a validacao reprovou, o backup foi reposto.
   * - `incerto`: gravou, a validacao reprovou, e a restauracao falhou. O
   *   arquivo em disco pode estar invalido; `backupPath` e o caminho de volta.
   */
  fileState: 'intacto' | 'gravado' | 'restaurado' | 'incerto'
  /**
   * Caminho da fila arquivada em `data/applied/`. `null` em toda recusa e, no
   * sucesso, nos dois casos em que ela nao foi arquivada: a rotacao falhou — e
   * ai a fila continua no lugar, precisando ser descartada a mao — ou o arquivo
   * de fila ja nao existia. O log distingue os dois em `queue.archived`; a
   * resposta nao, e por isso a mensagem ao operador cobre os dois.
   */
  archivedQueuePath: string | null
}

/** O que o guard usa do store. `StoreAccess` nao serve: nao tem as transicoes. */
export interface WriteGuardStore {
  getState(): StoreState
  /**
   * Os processos do arquivo em disco, **sem** a projecao da fila. `getState`
   * projeta, e responderia o valor pretendido no lugar do valor gravado.
   */
  rebuild(rows: RawRow[]): readonly Process[]
  /** Espera a releitura em voo. `pause` cancela o agendamento, nao a leitura. */
  settle(): Promise<void>
  markWriting(): void
  finishWriting(): void
}

export interface WriteGuardOptions {
  config: AppConfig
  /**
   * O mesmo mapa que o store recebe. O guard precisa dele para resolver a
   * combinacao de cada edicao de cor no `fillId` que a cirurgia grava, e para
   * nomear a cor nos conflitos — o `Process` carrega a `styleKey`, nao o rotulo.
   */
  colorMap: readonly ColorMapEntry[]
  /**
   * `Pick` em vez de `Watcher`: o guard pausa e retoma, nunca para nem inicia.
   * Derrubar o observador aqui deixaria o painel congelado ate o operador
   * reiniciar a aplicacao.
   */
  watcher: Pick<Watcher, 'pause' | 'resume'>
  store?: WriteGuardStore
  logger?: Logger
  queuePath?: string
  backupDir?: string
  appliedDir?: string
  /** Ponto de injecao para teste. Nenhum teste toca a planilha real (RNF-38). */
  readWorkbookFn?: (config: AppConfig) => Promise<ReadResult>
}

export class WriteGuardNotInitializedError extends Error {
  override readonly name = 'WriteGuardNotInitializedError'
}

interface ResolvedOptions {
  config: AppConfig
  colorMap: readonly ColorMapEntry[]
  watcher: Pick<Watcher, 'pause' | 'resume'>
  store: WriteGuardStore
  logger: Logger
  queuePath: string
  backupDir: string
  appliedDir: string
  readWorkbookFn: (config: AppConfig) => Promise<ReadResult>
}

const DEFAULT_STORE: WriteGuardStore = {
  getState,
  rebuild: rebuildProcesses,
  settle,
  markWriting,
  finishWriting,
}

let options: ResolvedOptions | null = null
let writing = false

export function initWriteGuard(next: WriteGuardOptions): void {
  options = {
    config: next.config,
    colorMap: next.colorMap,
    watcher: next.watcher,
    store: next.store ?? DEFAULT_STORE,
    logger: next.logger ?? NULL_LOGGER,
    queuePath: next.queuePath ?? DEFAULT_QUEUE_PATH,
    backupDir: next.backupDir ?? DEFAULT_BACKUP_DIR,
    appliedDir: next.appliedDir ?? DEFAULT_APPLIED_DIR,
    readWorkbookFn: next.readWorkbookFn ?? readWorkbook,
  }
  writing = false
}

function refuse(
  refusal: WriteRefusal,
  startedAt: number,
  extra: Partial<WriteResult> = {},
): WriteResult {
  return {
    ok: false,
    refusal,
    applied: 0,
    cellsWritten: 0,
    rowsRepainted: 0,
    backupPath: null,
    conflicts: [],
    restored: false,
    durationMs: Math.round(performance.now() - startedAt),
    expectedHash: null,
    actualHash: null,
    fileState: 'intacto',
    archivedQueuePath: null,
    ...extra,
  }
}

interface Resolution {
  targets: CellEdit[]
  fills: RowFillEdit[]
  conflicts: Conflict[]
}

/**
 * Traduz o valor da fila para o que a cirurgia grava.
 *
 * Texto vazio vira **celula vazia**, e nao um `<si><t></t></si>` novo no pool de
 * strings: `classify` do leitor ja trata `''` como ausencia, entao gravar a
 * string vazia produziria uma celula que a releitura devolve como `null` — e a
 * validacao pos-escrita condenaria a propria escrita, restaurando o backup e
 * dizendo ao operador que o arquivo foi corrompido. Achado do revisor-xml.
 */
function toCellValue(field: EditableField, value: string | null): CellEdit['value'] {
  if (value === null || value === '') return null
  // Meia-noite UTC: o serial do Excel e calculado a partir de uma epoca UTC
  // (xlsx-surgeon), e a hora local do servidor mudaria o dia gravado.
  return EDITABLE_FIELDS[field].kind === 'date' ? new Date(`${value}T00:00:00Z`) : value
}

/**
 * Cruza a fila com os processos do arquivo: devolve as celulas a gravar, ja no
 * endereco REAL de agora, e os conflitos de tudo que mudou desde a edicao.
 *
 * Os dois lados da comparacao passam por `currentValue`, do dominio — a **mesma**
 * funcao com que a rota gravou `previous` (src/http/routes/edits.ts). Comparar
 * `previous` com um formatador proprio, montado sobre a celula crua, produzia
 * conflito falso e permanente em data-como-texto: `2026-07-29` contra
 * `29/07/2026` para o mesmo dia, recusando a fila inteira a cada tentativa.
 * Achado do revisor-xml.
 *
 * Conferir `previous` **sempre** — e nao so quando o hash diverge — e o que
 * fecha o segundo caminho do defeito de endereco: alteracao de terceiro seguida
 * de releitura deixa o hash conferindo, e a gravacao passaria por cima dela.
 */
function resolve(
  pending: PendingEdit[],
  processes: readonly Process[],
  colorMap: readonly ColorMapEntry[],
): Resolution {
  const targets: CellEdit[] = []
  const fills: RowFillEdit[] = []
  const conflicts: Conflict[] = []

  for (const edit of pending) {
    const base = isColorEdit(edit)
      ? {
          ref: edit.ref,
          field: 'cor' as const,
          valueWhenEdited: edit.previousLabel,
          yourValue: edit.label,
        }
      : {
          ref: edit.ref,
          field: edit.field,
          valueWhenEdited: edit.previous,
          yourValue: edit.value ?? '',
        }

    // `normKey`, como TD-06 define a identidade e como a rota resolve a REF:
    // trocar a caixa da REF no Excel nao pode virar "esta linha sumiu".
    const wanted = normKey(edit.ref)
    const process = processes.find((candidate) => normKey(candidate.ref) === wanted)
    if (!process) {
      conflicts.push({ ...base, valueNow: '', refMissing: true })
      continue
    }

    if (isColorEdit(edit)) {
      // A cor envelhece pelo mesmo motivo que o valor: alguem repintou a linha
      // no Excel desde a escolha do operador. Repintar por cima apagaria uma
      // decisao que ele nao viu.
      if (process.styleKey !== edit.previousStyleKey) {
        conflicts.push({ ...base, valueNow: resolveColor(process.styleKey, colorMap).label })
        continue
      }

      // `null` nao chega aqui: a admissibilidade recusa a fila inteira antes.
      // O `continue` existe para o tipo, nao para um caso possivel.
      const entry = resolveFillTarget(edit.target, colorMap)
      if (entry === null) continue

      fills.push({
        sourceRow: process.sourceRow,
        fillId: entry.fillId,
        columns: [...STYLED_COLUMNS],
      })
      continue
    }

    const valueNow = currentValue(process, edit.field)
    if (valueNow !== edit.previous) {
      conflicts.push({ ...base, valueNow })
      continue
    }

    targets.push({
      sourceRow: process.sourceRow,
      column: EDITABLE_FIELDS[edit.field].column,
      value: toCellValue(edit.field, edit.value),
    })
  }

  return { targets, fills, conflicts }
}

/** Comparacao exata: espaco nas pontas e diferenca, e a cirurgia o preserva. */
function wrote(cell: RawCell | undefined, expected: CellEdit['value']): boolean {
  const actual = cell?.value ?? null
  if (expected === null) return actual === null
  if (expected instanceof Date) {
    return actual instanceof Date && actual.getTime() === expected.getTime()
  }
  return actual === expected
}

/**
 * Confere que o arquivo continua legivel, que as celulas alteradas guardam o
 * valor pretendido E que as linhas repintadas tem a cor pedida. So estas
 * coisas: uma validacao mais ampla reprovaria escrita correta, e o preco de
 * reprovar e restaurar o backup, jogando fora um trabalho valido do operador.
 *
 * A repintura precisa de conferencia PROPRIA porque nao muda valor nenhum: sem
 * ela, uma aplicacao so de cores passaria por uma validacao vazia e diria
 * "gravado e validado" tendo conferido nada.
 *
 * Uma repeticao pelo mesmo motivo: no Windows, o OneDrive e o antivirus tocam o
 * arquivo recem-renomeado, e uma falha de leitura transitoria condenaria uma
 * escrita correta. A espera entre as duas nao e cerimonia — repetir no mesmo
 * instante cobriria pouco mais que a primeira tentativa.
 */
const VALIDATION_RETRY_MS = 250

async function validate(
  deps: ResolvedOptions,
  edits: CellEdit[],
  fills: RowFillEdit[],
): Promise<boolean> {
  // A chave de estilo que cada `fillId` deve produzir na releitura. O leitor
  // devolve `styleKey`, nao `fillId`, e as duas sao a mesma entrada do mapa.
  const expectedKeys = new Map(
    fills.map((fill) => [
      fill.sourceRow,
      deps.colorMap.find((entry) => entry.fillId === fill.fillId)?.styleKey ?? null,
    ]),
  )

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { rows } = await deps.readWorkbookFn(deps.config)
      const values = edits.every((edit) => {
        const row = rows.find((candidate) => candidate.sourceRow === edit.sourceRow)
        return row !== undefined && wrote(row.cells[edit.column], edit.value)
      })
      if (!values) return false

      return [...expectedKeys].every(([sourceRow, styleKey]) => {
        const row = rows.find((candidate) => candidate.sourceRow === sourceRow)
        return styleKey !== null && row?.styleKey === styleKey
      })
    } catch {
      if (attempt === 1) return false
      await new Promise((resolve) => setTimeout(resolve, VALIDATION_RETRY_MS))
    }
  }
  return false
}

/**
 * Grava o buffer por temporario e renomeacao, no MESMO diretorio do original —
 * a renomeacao so e atomica dentro do mesmo volume. Falha antes da renomeacao
 * deixa o original intacto, que e o caso-limite da falha de disco.
 *
 * `sync()` antes de fechar: sem ele a renomeacao pode ser persistida antes dos
 * blocos de dados, e uma queda de energia deixaria um .xlsx truncado no lugar
 * do original. E o temporario e removido tambem quando a RENOMEACAO falha —
 * senao uma copia integral da planilha ficaria na pasta sincronizada, invisivel
 * para o watcher e para `detectInterference`, que filtram por nome.
 */
async function writeAtomic(filePath: string, buffer: Uint8Array): Promise<void> {
  const temporary = `${filePath}.cronos.tmp`
  try {
    const handle = await open(temporary, 'w')
    try {
      await handle.writeFile(buffer)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, filePath)
  } catch (error) {
    // A limpeza nao pode mascarar a causa: quem decide a recusa e o erro da
    // gravacao, nao o de apagar o temporario que ela deixou.
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * Aplica a fila consolidada no .xlsx. Nunca rejeita: toda falha vira uma recusa
 * com motivo, porque quem chama e uma rota HTTP que precisa traduzir o motivo
 * em codigo, e nao um `catch` generico.
 */
export async function applyPendingEdits(): Promise<WriteResult> {
  const deps = options
  if (!deps) {
    throw new WriteGuardNotInitializedError('initWriteGuard precisa ser chamado antes de aplicar.')
  }

  const startedAt = performance.now()
  const refused = (refusal: WriteRefusal, extra: Partial<WriteResult> = {}): WriteResult => {
    deps.logger.log({ level: 'warn', event: 'write.refused', errorCode: refusal })
    return refuse(refusal, startedAt, extra)
  }

  // Sincrono ate a marcacao: em JavaScript nada intercala aqui, e e isso que
  // faz a segunda chamada simultanea encontrar `writing` ja verdadeiro.
  if (writing) return refused('ESCRITA_EM_ANDAMENTO')

  // Antes de pausar o observador: fila vazia nao justifica interromper a
  // releitura, e o criterio de aceite exige que o arquivo nao seja tocado.
  const pending = consolidated(deps.queuePath)
  if (pending.length === 0) return refused('NADA_A_APLICAR')

  writing = true

  try {
    deps.logger.log({ level: 'info', event: 'write.start', edits: pending.length })
    return await guardedWrite(deps, pending, startedAt, refused)
  } finally {
    writing = false
  }
}

type Refused = (refusal: WriteRefusal, extra?: Partial<WriteResult>) => WriteResult

async function guardedWrite(
  deps: ResolvedOptions,
  pending: PendingEdit[],
  startedAt: number,
  refused: Refused,
): Promise<WriteResult> {
  const { config, logger, watcher, store } = deps
  const filePath = config.workbookPath

  try {
    store.markWriting()
    watcher.pause()

    // `pause` cancela o agendamento, nao a leitura ja iniciada. Sem esperar, a
    // leitura canonica competiria com uma releitura em curso e o hash conferido
    // poderia ser o de um estado que ninguem mais tem. Depois de `markWriting`,
    // para que `settled` mantenha o estado 'escrevendo' quando ela terminar.
    await store.settle()

    // O lock primeiro, na ordem de 04-arquitetura.md secao 3.2: com o Excel
    // aberto E a fila inadmissivel, o motivo que o operador precisa ouvir e o
    // que ele consegue resolver.
    if (detectInterference(filePath).externalLock) return refused('EXCEL_ABERTO')

    // Antes de tudo que le o arquivo, e antes de `resolve`: a fila e append-only
    // em disco e pode ter sido editada a mao, ou sobrado de outra versao. Campo
    // fora de `EDITABLE_FIELDS` derrubaria `resolve` com TypeError, e data
    // impossivel viraria serial NaN na celula — a regra inviolavel 3 proibe
    // adivinhar o que o operador queria. Achado do revisor-xml.
    //
    // Para a cor, o inadmissivel e a combinacao que o mapa nao representa. Ela
    // passa pela rota, entao so chega aqui se `config/color-map.json` mudou
    // depois do enfileiramento — e gravar a cor "mais proxima" e exatamente o
    // que a regra inviolavel 3 proibe.
    const inadmissible = pending.some((edit) =>
      isColorEdit(edit)
        ? resolveFillTarget(edit.target, deps.colorMap) === null
        : !isEditableField(edit.field) || validateEdit(edit.field, edit.value) !== null,
    )
    if (inadmissible) return refused('ESCRITA_INVALIDA')

    // Leitura canonica: dela saem o hash, o caminho da aba dentro do zip, o
    // endereco real de cada linha e o valor atual de cada campo. Uma leitura so,
    // para que as quatro coisas descrevam o MESMO estado do arquivo.
    let read: ReadResult
    try {
      read = await deps.readWorkbookFn(config)
    } catch {
      // A mensagem carrega `workbookPath`; so o codigo vai para o log (RNF-33).
      return refused('ARQUIVO_INDISPONIVEL')
    }

    // Composicao vazia sobre arquivo com linhas nao e "nenhum processo": e o
    // store sem `initStore`, ou o mapa de cor fora do ar. Seguir daqui faria
    // TODA edicao voltar com `refMissing: true` — afirmando que a REF sumiu do
    // arquivo, pelo campo que existe justamente para nao afirmar coisa falsa
    // (regra inviolavel 3). Achado do revisor-xml.
    const fromFile = store.rebuild(read.rows)
    if (fromFile.length === 0 && read.rows.length > 0) return refused('ESCRITA_INVALIDA')

    // Hash ausente significa que nenhuma leitura bem-sucedida aconteceu, entao
    // nao ha contra o que comparar. Recusar e a leitura honesta: nao se pode
    // afirmar que o arquivo e o que se leu.
    const knownHash = store.getState().fileHash
    if (knownHash === null || read.fileHash !== knownHash) {
      return refused('ARQUIVO_MUDOU', {
        conflicts: resolve(pending, fromFile, deps.colorMap).conflicts,
        expectedHash: knownHash,
        actualHash: read.fileHash,
      })
    }

    // Ultimo ponto de controle antes de gravar bytes: a aba que a cirurgia vai
    // abrir e a mesma que a leitura processou (regra inviolavel 10). Com
    // `sheetName: null` na config (P-04) a resolucao e posicional, e uma aba
    // inserida antes da `2026` mudaria o alvo sem mudar a configuracao.
    if (read.sheetName !== store.getState().sheetName) return refused('ESCRITA_INVALIDA')

    const { targets, fills, conflicts } = resolve(pending, fromFile, deps.colorMap)
    if (conflicts.length > 0) {
      return refused('EDICAO_OBSOLETA', {
        conflicts,
        expectedHash: knownHash,
        actualHash: read.fileHash,
      })
    }

    try {
      await access(filePath, constants.W_OK)
    } catch {
      return refused('ESCRITA_INVALIDA')
    }

    let original: Uint8Array
    try {
      original = await readFile(filePath)
    } catch {
      return refused('ARQUIVO_INDISPONIVEL')
    }

    // A leitura canonica e esta sao duas aberturas do arquivo. Sem esta
    // conferencia, alteracao entre elas faria a cirurgia operar sobre bytes que
    // nunca passaram pela defesa de hash.
    const actualHash = hashBytes(original)
    if (actualHash !== read.fileHash) {
      return refused('ARQUIVO_MUDOU', { expectedHash: knownHash, actualHash })
    }

    /**
     * A cirurgia acontece ANTES do backup porque ela e pura — opera sobre o
     * buffer em memoria e nao toca o disco. So depois de saber se algum byte
     * mudaria e que se decide gravar. A invariante de H-25 fica de pe: o backup
     * continua saindo do MESMO buffer que a cirurgia recebeu, e continua sendo
     * gravado antes de qualquer modificacao do arquivo.
     *
     * Com o backup antes, uma aplicacao que nao muda nada — o operador
     * reconfirma a cor que a linha ja tem — consumia um slot de
     * `DEFAULT_KEEP_COUNT`, e uma cirurgia que lanca deixava backup de rastro
     * sem nunca ter gravado. Achado do revisor-xml.
     */
    let cellsWritten: number
    let rowsRepainted: number
    let buffer: Uint8Array
    try {
      // Valores primeiro, cor depois: a repintura precisa enxergar as celulas
      // que a primeira cirurgia acabou de criar, senao uma coluna recem-
      // preenchida ficaria sem pintar. A ordem inversa tambem funcionaria, mas
      // esta e a que nao depende de `applyCellEdits` preservar cor — ela
      // preserva, e nao ha por que apostar nisso.
      //
      // CONSEQUENCIA da ordem, anotada porque nao e obvia: gravar valor numa
      // celula de A a L que nao existia no XML a cria herdando o estilo da
      // COLUNA, sem borda, e a repintura seguinte lhe da a cor — celula
      // colorida sem a borda das irmas. Nasce da criacao de celula de H-24, nao
      // da repintura, que nao cria nenhuma. Inalcancavel pelo arquivo real:
      // H-25 mediu A a N nunca ausentes, e H-27 remediu A a L em 744 linhas,
      // zero ausencias. Achado do revisor-xml.
      const written = applyCellEdits(original, targets, read.sheetPath)
      const painted = applyRowFill(written.buffer, fills, read.sheetPath)
      cellsWritten = written.cellsWritten
      // O que a cirurgia MEDIU, e nao `fills.length`: uma linha que ja estivesse
      // na cor pedida nao muda byte algum, e anuncia-la como repintada diria ao
      // operador que houve gravacao onde nao houve. Achado do revisor-xml.
      rowsRepainted = painted.rowsPainted
      buffer = painted.buffer
    } catch {
      // Nada foi gravado: o original esta intacto, e nao ha backup a indicar
      // porque nao houve o que desfazer.
      return refused('ESCRITA_INVALIDA')
    }

    /**
     * NADA MUDOU: a fila resolvia para o que o arquivo ja tem. Gravar aqui
     * substituiria a planilha por uma copia recomprimida — mesmo XML, hash e
     * mtime novos —, forcando o OneDrive a reenviar o arquivo e o observador a
     * reler, por uma alteracao que nao altera. Achado do revisor-xml.
     *
     * E sucesso, e nao recusa: o operador pediu um estado, e o estado e esse. A
     * fila e arquivada como em qualquer aplicacao bem-sucedida — deixa-la para
     * tras faria a proxima tentativa repetir o mesmo nada.
     */
    if (cellsWritten === 0 && rowsRepainted === 0) {
      const archived = archiveQueue(deps)
      const durationMs = Math.round(performance.now() - startedAt)
      logger.log({ level: 'info', event: 'write.done', durationMs, cellsWritten: 0 })

      return {
        ok: true,
        refusal: null,
        applied: targets.length + fills.length,
        cellsWritten: 0,
        rowsRepainted: 0,
        backupPath: null,
        conflicts: [],
        restored: false,
        durationMs,
        expectedHash: null,
        actualHash: null,
        fileState: 'intacto',
        archivedQueuePath: archived,
      }
    }

    let backupPath: string
    try {
      backupPath = await backupFrom(original, deps.backupDir)
    } catch {
      return refused('ESCRITA_INVALIDA')
    }

    try {
      await writeAtomic(filePath, buffer)
    } catch {
      // Nada foi renomeado sobre o original: a recusa nao restaura porque nao
      // ha o que desfazer, e o backup fica como testemunha do estado de antes.
      return refused('ESCRITA_INVALIDA', { backupPath })
    }

    if (!(await validate(deps, targets, fills))) {
      const restored = await restoreQuietly(backupPath, filePath, logger)
      return refused('ESCRITA_INVALIDA', {
        backupPath,
        restored,
        // Restauracao que falha deixa o arquivo gravado — e reprovado — no
        // lugar do original. E o unico desfecho em que o operador PRECISA do
        // caminho do backup.
        fileState: restored ? 'restaurado' : 'incerto',
      })
    }

    const archivedQueuePath = archiveQueue(deps)

    const durationMs = Math.round(performance.now() - startedAt)
    logger.log({ level: 'info', event: 'write.done', durationMs, cellsWritten, backupPath })
    await pruneQuietly(deps)

    return {
      ok: true,
      refusal: null,
      applied: targets.length + fills.length,
      cellsWritten,
      rowsRepainted,
      backupPath,
      conflicts: [],
      restored: false,
      durationMs,
      expectedHash: null,
      actualHash: null,
      fileState: 'gravado',
      archivedQueuePath,
    }
  } catch {
    // Rede de seguranca da invariante do modulo: nao rejeitar. Todo caminho
    // previsto tem recusa propria acima; o que chega aqui e defeito nosso, e
    // uma rota nao tem como traduzir uma excecao em instrucao ao operador. Se o
    // original ficou pela metade, o backup esta em `data/backups/`.
    //
    // Registrado como ERRO_INTERNO, e nao como a recusa devolvida: no log, o
    // programa que quebrou nao pode parecer arquivo que recusou. Sem isto, as
    // duas coisas saem como `warn`/`ESCRITA_INVALIDA`, indistinguiveis.
    logger.log({ level: 'error', event: 'write.refused', errorCode: 'ERRO_INTERNO' })
    return refuse('ESCRITA_INVALIDA', startedAt)
  } finally {
    // Cada um por si, e `resume` primeiro: uma excecao vinda do store nao pode
    // deixar o observador pausado para sempre, que congelaria o painel ate o
    // operador reiniciar a aplicacao. `resume` reagenda a releitura perdida
    // durante a pausa, e fecha a sequencia de 04-arquitetura.md secao 3.2.
    try {
      watcher.resume()
    } finally {
      store.finishWriting()
    }
  }
}

/**
 * Arquiva a fila em `data/applied/` — AQUI, e nao na rota, por causa da janela:
 * `finishWriting` no `finally` devolve o estado a 'pronto' e `POST /api/edits`
 * volta a aceitar. Rotacionar depois disso arquivaria — e faria sumir — a
 * edicao que o operador digitou nesse intervalo, sem que ela tivesse sido
 * gravada. Achado do revisor-xml, reproduzido.
 *
 * Falhar aqui NAO invalida a escrita: o .xlsx ja esta correto e validado em
 * disco, e devolver ESCRITA_INVALIDA mandaria o operador procurar um backup
 * obsoleto. `null` cobre os DOIS desfechos sem arquivamento — a rotacao falhou,
 * e ai a fila ficou para tras, ou o arquivo de fila ja nao existia. Quem os
 * distingue e o log.
 */
function archiveQueue(deps: ResolvedOptions): string | null {
  try {
    const archivedQueuePath = rotate(deps.queuePath, deps.appliedDir)
    deps.logger.log(
      archivedQueuePath === null
        ? // `rotate` devolve null SEM lancar quando o arquivo de fila ja nao
          // esta la — alguem o apagou por fora durante a escrita. Nada se
          // perdeu, ja gravamos; mas o silencio faria a resposta e o log
          // dizerem que a fila continua no lugar, e ela nao esta.
          { level: 'warn', event: 'queue.archived', errorCode: 'FILA_AUSENTE' }
        : { level: 'info', event: 'queue.archived', archivedQueuePath },
    )
    return archivedQueuePath
  } catch {
    // Evento proprio, e nao `write.done`: a planilha FOI gravada e validada, e
    // emitir o evento de escrita como erro faria uma aplicacao bem-sucedida
    // contar duas vezes no log e parecer falha de escrita.
    deps.logger.log({ level: 'error', event: 'queue.archived', errorCode: 'ERRO_INTERNO' })
    return null
  }
}

async function restoreQuietly(
  backupPath: string,
  filePath: string,
  logger: Logger,
): Promise<boolean> {
  try {
    await restore(backupPath, filePath)
    logger.log({ level: 'error', event: 'write.restored', backupPath })
    return true
  } catch {
    // Restauracao falha deixa o arquivo gravado — e reprovado — no lugar do
    // original. Quem carrega isso para a rota e `fileState: 'incerto'`:
    // `restored: false` sozinho nao serve, porque sai tambem de recusa que
    // nunca gravou.
    return false
  }
}

async function pruneQuietly(deps: ResolvedOptions): Promise<void> {
  try {
    await prune(DEFAULT_KEEP_COUNT, DEFAULT_KEEP_DAYS, deps.backupDir)
  } catch {
    // Expurgo e higiene, nao operacao: a escrita ja terminou com sucesso.
  }
}
