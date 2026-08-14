import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { LogInput } from '../../src/app/logger.ts'
import type { StoreState } from '../../src/app/process-store.ts'
import {
  applyPendingEdits,
  initWriteGuard,
  type WriteGuardStore,
} from '../../src/app/write-guard.ts'
import { type ColorMapEntry, indexColorMap } from '../../src/domain/color-mapper.ts'
import { buildProcesses } from '../../src/domain/process-builder.ts'
import { enqueue } from '../../src/io/edit-queue.ts'
import { hashFile, type ReadResult, readWorkbook } from '../../src/io/xlsx-reader.ts'

/**
 * As seis defesas. Cada teste opera sobre uma COPIA de `tests/fixtures/`, numa
 * pasta temporaria — nenhum toca a planilha real (RNF-38), e a fixture
 * versionada precisa sobreviver a uma suite que escreve de proposito.
 *
 * `basico.xlsx`: linha 2 = FT001.26 (B='CLIENTE A', I=2026-08-01), linha 3 =
 * FT002.26 (B='CLIENTE B'), linha 4 = FT003.26.
 */

const FIXTURE = 'basico.xlsx'
const REF = 'FT001.26'
const SOURCE_ROW = 2
const HASH_FALSO = `sha256:${'0'.repeat(64)}`

/** Minimo para compor: cor fora do mapa nao manda a linha para quarentena. */
const COLOR_MAP: ColorMapEntry[] = [
  {
    styleKey: 'none',
    fillId: 0,
    label: 'Branco',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
]
const STATUS_ALIASES = ['DESEMBARACADA', 'DESEMBARCADA']

let directory: string
let workbook: string
let backupDir: string
let queuePath: string
let originalBytes: Buffer
let watcher: { pause: Mock<() => void>; resume: Mock<() => void> }
let events: string[]
let state: StoreState
let store: WriteGuardStore

function emptyState(): StoreState {
  return {
    state: 'pronto',
    processes: [],
    fileHash: null,
    sheetName: '2026',
    lastReadAt: new Date('2026-08-13T12:00:00Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 3,
    rowsAccepted: 3,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    pendingEdits: [],
  }
}

function config(): AppConfig {
  return {
    workbookPath: workbook,
    sheetName: '2026',
    headerRow: 1,
    firstDataRow: 2,
    port: 5173,
    stalledDaysThreshold: 15,
    topN: 10,
    timezone: 'America/Sao_Paulo',
  }
}

async function setup(overrides: Partial<Parameters<typeof initWriteGuard>[0]> = {}): Promise<void> {
  state.fileHash = await hashFile(workbook)
  initWriteGuard({
    config: config(),
    watcher,
    store,
    queuePath,
    backupDir,
    appliedDir: join(directory, 'aplicadas'),
    ...overrides,
  })
}

/**
 * A leitura canonica acontece antes de gravar; a validacao rele depois, e
 * repete uma vez. Este ajudante deixa a primeira passar e substitui as
 * seguintes, que e o que isola a defesa de validacao das demais.
 */
function readThenFail(replacement: () => Promise<ReadResult>): () => Promise<ReadResult> {
  let calls = 0
  return async () => {
    calls += 1
    return calls === 1 ? await readWorkbook(config()) : await replacement()
  }
}

function queueTextEdit(previous = 'CLIENTE A', sourceRow = SOURCE_ROW): void {
  enqueue(
    { ref: REF, sourceRow, field: 'clientRaw', value: 'CLIENTE ALTERADO', previous },
    queuePath,
  )
}

function queueDateEdit(): void {
  enqueue(
    { ref: REF, sourceRow: SOURCE_ROW, field: 'eta2', value: '2026-08-29', previous: '2026-08-01' },
    queuePath,
  )
}

async function cellsOf(row: number): Promise<Record<string, unknown>> {
  const read = await readWorkbook(config())
  const found = read.rows.find((candidate) => candidate.sourceRow === row)
  if (!found) throw new Error(`linha ${row} ausente do arquivo`)
  return Object.fromEntries(Object.entries(found.cells).map(([key, cell]) => [key, cell.value]))
}

function backupNames(): string[] {
  return existsSync(backupDir) ? readdirSync(backupDir) : []
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-guard-'))
  workbook = join(directory, 'planilha.xlsx')
  backupDir = join(directory, 'backups')
  queuePath = join(directory, 'pending-edits.jsonl')
  copyFileSync(`tests/fixtures/${FIXTURE}`, workbook)
  originalBytes = readFileSync(workbook)

  events = []
  watcher = {
    pause: vi.fn<() => void>(() => {
      events.push('pause')
    }),
    resume: vi.fn<() => void>(() => {
      events.push('resume')
    }),
  }

  state = emptyState()
  store = {
    getState: () => state,
    // O mesmo caminho da producao: `rebuildProcesses` do process-store compoe
    // com o mapa de cor e os aliases da leitura corrente.
    rebuild: (rows) =>
      buildProcesses(rows, { colorMap: indexColorMap(COLOR_MAP), statusAliases: STATUS_ALIASES })
        .processes,
    settle: async () => {
      events.push('settle')
    },
    markWriting: () => {
      state.state = 'escrevendo'
      events.push('escrevendo')
    },
    finishWriting: () => {
      state.state = 'pronto'
      events.push('pronto')
    },
  }
})

afterEach(() => {
  if (existsSync(workbook)) chmodSync(workbook, 0o644)
  rmSync(directory, { recursive: true, force: true })
})

describe('escrita bem-sucedida', () => {
  it('grava texto e data, e devolve o resumo', async () => {
    queueTextEdit()
    queueDateEdit()
    await setup()

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect(result.refusal).toBeNull()
    expect(result.applied).toBe(2)
    expect(result.cellsWritten).toBe(2)
    expect(result.restored).toBe(false)
    expect(result.conflicts).toEqual([])

    const cells = await cellsOf(SOURCE_ROW)
    expect(cells.B).toBe('CLIENTE ALTERADO')
    expect((cells.I as Date).toISOString().slice(0, 10)).toBe('2026-08-29')
  })

  // A copia precisa refletir o estado ANTERIOR: backup gravado depois da
  // cirurgia nao restauraria coisa alguma.
  it('grava o backup antes de qualquer modificacao', async () => {
    queueTextEdit()
    await setup()

    const result = await applyPendingEdits()

    expect(result.backupPath).not.toBeNull()
    expect(readFileSync(result.backupPath as string)).toEqual(originalBytes)
    expect(readFileSync(workbook)).not.toEqual(originalBytes)
  })

  it('pausa o watcher antes de escrever e o retoma ao final', async () => {
    queueTextEdit()
    await setup()

    await applyPendingEdits()

    expect(events).toEqual(['escrevendo', 'pause', 'settle', 'resume', 'pronto'])
  })

  // `pause` cancela o agendamento, não a leitura já iniciada: sem esperar, a
  // leitura canônica competiria com uma releitura em curso, e o hash conferido
  // poderia ser o de um estado que ninguém mais tem. Caso-limite de `H-26`.
  it('aguarda a releitura em voo antes de ler o arquivo', async () => {
    queueTextEdit()
    let liberar = (): void => undefined
    const releitura = new Promise<void>((resolve) => {
      liberar = resolve
    })

    await setup({
      store: {
        ...store,
        settle: async () => {
          events.push('settle')
          await releitura
        },
      },
    })

    const escrita = applyPendingEdits()
    await Promise.resolve()
    expect(events).toEqual(['escrevendo', 'pause', 'settle'])

    liberar()
    const result = await escrita

    expect(result.ok).toBe(true)
  })

  // A renomeacao e o que torna a gravacao atomica; o temporario e transitorio
  // e nao pode sobreviver a escrita, nem sincronizar para o OneDrive.
  it('nao deixa o temporario da gravacao para tras', async () => {
    queueTextEdit()
    await setup()

    await applyPendingEdits()

    expect(readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  // A fila nunca é perdida: na recusa fica intacta, no sucesso é arquivada.
  it('arquiva a fila em data/applied e a deixa vazia', async () => {
    queueTextEdit()
    await setup()
    const antes = readFileSync(queuePath, 'utf-8')

    const result = await applyPendingEdits()

    expect(result.archivedQueuePath).toMatch(/pending-edits-\d{8}-\d{6}\.jsonl$/)
    expect(readFileSync(result.archivedQueuePath as string, 'utf-8')).toBe(antes)
    expect(readFileSync(queuePath, 'utf-8')).toBe('')
  })

  // O .xlsx já está correto e validado em disco: devolver ESCRITA_INVALIDA
  // mandaria o operador procurar um backup obsoleto. `archivedQueuePath: null`
  // é o que diz à interface que a fila precisa ser descartada à mão.
  it('nao invalida a escrita quando o arquivamento da fila falha', async () => {
    queueTextEdit()
    const appliedDir = join(directory, 'applied')
    writeFileSync(appliedDir, 'nao sou uma pasta', 'utf-8')
    await setup({ appliedDir })

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect(result.archivedQueuePath).toBeNull()
    expect((await cellsOf(SOURCE_ROW)).B).toBe('CLIENTE ALTERADO')
  })

  // `write.done` significa "a planilha foi gravada e validada", e tem campos
  // fixados em `08-qualidade-operacao.md` §3.1. Reusá-lo para a falha do
  // arquivamento fazia uma aplicação bem-sucedida emitir DUAS linhas
  // `write.done`, uma delas parecendo erro de escrita. Achado do `revisor-xml`.
  it('registra o arquivamento em evento proprio, sem duplicar write.done', async () => {
    queueTextEdit()
    const entries: LogInput[] = []
    await setup({
      logger: {
        log: (entry) => {
          entries.push(entry)
        },
        purgeExpired: () => [],
        currentFile: () => '',
      },
    })

    await applyPendingEdits()

    expect(entries.filter((entry) => entry.event === 'write.done')).toHaveLength(1)
    const arquivamento = entries.find((entry) => entry.event === 'queue.archived')
    expect(arquivamento?.level).toBe('info')
    expect(arquivamento?.archivedQueuePath).toMatch(/pending-edits-\d{8}-\d{6}\.jsonl$/)
  })

  // `rotate` devolve null SEM lançar quando o arquivo de fila já não está lá.
  // Nada se perdeu — a gravação já aconteceu —, mas o silêncio faria resposta e
  // log dizerem que a fila continua no lugar, e ela não está.
  it('registra quando nao havia fila para arquivar', async () => {
    queueTextEdit()
    const entries: LogInput[] = []
    let leituras = 0
    await setup({
      // A validação é o último passo antes do arquivamento: apagar a fila aqui
      // reproduz alguém removendo o `.jsonl` por fora durante a escrita.
      readWorkbookFn: async (cfg) => {
        const read = await readWorkbook(cfg)
        leituras += 1
        if (leituras === 2) rmSync(queuePath)
        return read
      },
      logger: {
        log: (entry) => {
          entries.push(entry)
        },
        purgeExpired: () => [],
        currentFile: () => '',
      },
    })

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect(result.archivedQueuePath).toBeNull()
    expect(entries.find((entry) => entry.event === 'queue.archived')).toMatchObject({
      level: 'warn',
      errorCode: 'FILA_AUSENTE',
    })
  })

  it('registra a falha do arquivamento como erro, e nao como write.done', async () => {
    queueTextEdit()
    const appliedDir = join(directory, 'applied')
    writeFileSync(appliedDir, 'nao sou uma pasta', 'utf-8')
    const entries: LogInput[] = []
    await setup({
      appliedDir,
      logger: {
        log: (entry) => {
          entries.push(entry)
        },
        purgeExpired: () => [],
        currentFile: () => '',
      },
    })

    await applyPendingEdits()

    expect(entries.filter((entry) => entry.event === 'write.done')).toHaveLength(1)
    expect(entries.find((entry) => entry.event === 'queue.archived')).toMatchObject({
      level: 'error',
      errorCode: 'ERRO_INTERNO',
    })
  })
})

/**
 * O defeito que o revisor-xml reproduziu na primeira invocacao. O `sourceRow`
 * da fila e congelado quando o operador edita; uma linha removida no Excel o
 * desloca, o watcher rele, e o hash guardado passa a ser o NOVO — a defesa de
 * hash aprova e a gravacao vai para a linha de outro processo.
 */
describe('endereco da celula', () => {
  it('grava na linha da REF, nao na linha congelada na fila', async () => {
    // FT001.26 esta na linha 2; a fila diz 3, onde vive FT002.26.
    queueTextEdit('CLIENTE A', 3)
    await setup()

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect((await cellsOf(2)).B).toBe('CLIENTE ALTERADO')
    expect((await cellsOf(3)).B).toBe('CLIENTE B')
  })

  // Segundo caminho do mesmo defeito: alteracao de terceiro seguida de
  // releitura deixa o hash conferindo, e a gravacao passaria por cima dela.
  it('recusa quando o valor atual difere do de quando se editou, com o hash conferindo', async () => {
    queueTextEdit('CLIENTE DE QUANDO EDITEI')
    await setup()

    const result = await applyPendingEdits()

    // Nao e `ARQUIVO_MUDOU`: os dois hashes conferem, e mandar o operador reler
    // a planilha nao mudaria nada.
    expect(result.refusal).toBe('EDICAO_OBSOLETA')
    expect(result.expectedHash).toBe(result.actualHash)
    expect(result.conflicts).toEqual([
      {
        ref: REF,
        field: 'clientRaw',
        valueWhenEdited: 'CLIENTE DE QUANDO EDITEI',
        valueNow: 'CLIENTE A',
        yourValue: 'CLIENTE ALTERADO',
      },
    ])
    expect(readFileSync(workbook)).toEqual(originalBytes)
    expect(backupNames()).toEqual([])
  })

  // Tudo ou nada: aplicar so as edicoes limpas deixaria a fila num estado que
  // o operador nao consegue ler — parte gravada, parte nao, e nada dizendo qual.
  it('recusa a fila inteira quando uma unica edicao conflita', async () => {
    queueTextEdit('CLIENTE DE QUANDO EDITEI')
    queueDateEdit()
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('EDICAO_OBSOLETA')
    expect(result.conflicts).toHaveLength(1)
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // Os dois lados do conflito passam por `currentValue`, do dominio — a mesma
  // funcao com que a rota grava `previous`. Com um formatador proprio sobre a
  // celula crua, data-como-texto produzia `2026-07-29` contra `29/07/2026` para
  // o mesmo dia, recusando a fila inteira para sempre.
  it('nao inventa conflito em data que veio como texto na planilha', async () => {
    copyFileSync('tests/fixtures/datas.xlsx', workbook)
    originalBytes = readFileSync(workbook)
    enqueue(
      { ref: 'FT203.26', sourceRow: 4, field: 'eta2', value: '2026-09-10', previous: '2026-07-29' },
      queuePath,
    )
    await setup()

    const result = await applyPendingEdits()

    expect(result.conflicts).toEqual([])
    expect(result.ok).toBe(true)
  })
})

describe('EXCEL_ABERTO', () => {
  it('recusa e nao toca no arquivo quando existe ~$planilha.xlsx', async () => {
    queueTextEdit()
    await setup()
    writeFileSync(join(directory, `~$${basename(workbook)}`), '', 'utf-8')

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('EXCEL_ABERTO')
    expect(result.ok).toBe(false)
    expect(readFileSync(workbook)).toEqual(originalBytes)
    expect(backupNames()).toEqual([])
  })

  it('preserva a fila na recusa', async () => {
    queueTextEdit()
    await setup()
    writeFileSync(join(directory, `~$${basename(workbook)}`), '', 'utf-8')
    const before = readFileSync(queuePath, 'utf-8')

    await applyPendingEdits()

    expect(readFileSync(queuePath, 'utf-8')).toBe(before)
  })
})

describe('ARQUIVO_MUDOU e EDICAO_OBSOLETA', () => {
  it('recusa quando o hash difere do da ultima leitura, com os dois hashes', async () => {
    queueTextEdit()
    await setup()
    const conhecido = state.fileHash
    state.fileHash = HASH_FALSO

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ARQUIVO_MUDOU')
    expect(result.expectedHash).toBe(HASH_FALSO)
    expect(result.actualHash).toBe(conhecido)
    expect(readFileSync(workbook)).toEqual(originalBytes)
    expect(backupNames()).toEqual([])
  })

  it('nao lista campo cujo valor atual continua o de quando se editou', async () => {
    queueTextEdit()
    await setup()
    state.fileHash = HASH_FALSO

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ARQUIVO_MUDOU')
    expect(result.conflicts).toEqual([])
  })

  // `valueNow: ''` sozinho diria "a celula esta vazia", que e falso quando a
  // linha inteira sumiu do arquivo. Regra inviolavel 3.
  it('marca refMissing quando a REF nao esta mais no arquivo', async () => {
    enqueue(
      { ref: 'FT999.26', sourceRow: 99, field: 'clientRaw', value: 'NOVO', previous: 'ANTIGO' },
      queuePath,
    )
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('EDICAO_OBSOLETA')
    expect(result.conflicts).toEqual([
      {
        ref: 'FT999.26',
        field: 'clientRaw',
        valueWhenEdited: 'ANTIGO',
        valueNow: '',
        yourValue: 'NOVO',
        refMissing: true,
      },
    ])
  })

  // Nenhuma leitura bem-sucedida significa que nao ha contra o que comparar:
  // afirmar que o arquivo e o mesmo seria adivinhar.
  it('recusa tambem quando nunca houve leitura bem-sucedida', async () => {
    queueTextEdit()
    await setup()
    state.fileHash = null

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ARQUIVO_MUDOU')
    expect(result.expectedHash).toBeNull()
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })
})

describe('ARQUIVO_INDISPONIVEL', () => {
  // A invariante do modulo e nao rejeitar: quem chama e uma rota, que precisa
  // do motivo. E a mensagem da excecao carrega `workbookPath` (RNF-33).
  it('recusa em vez de rejeitar quando o arquivo some antes da leitura', async () => {
    queueTextEdit()
    await setup()
    rmSync(workbook)

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ARQUIVO_INDISPONIVEL')
    expect(result.ok).toBe(false)
    expect(backupNames()).toEqual([])
  })
})

describe('ESCRITA_INVALIDA', () => {
  it('restaura o backup quando a validacao pos-escrita falha', async () => {
    queueTextEdit()
    await setup({
      readWorkbookFn: readThenFail(() => Promise.reject(new Error('arquivo ilegivel'))),
    })

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.restored).toBe(true)
    expect(result.backupPath).not.toBeNull()
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  /**
   * O desfecho mais grave: gravou, a validação reprovou, e o backup NÃO pôde ser
   * reposto. `restored` continua `false`, mas o arquivo em disco é o gravado —
   * e é a única situação em que o operador precisa do caminho do backup. A rota
   * não tem como inferir isso de `restored`; por isso `fileState` existe.
   */
  it('marca o arquivo como incerto quando a restauracao tambem falha', async () => {
    queueTextEdit()
    let leituras = 0
    await setup({
      readWorkbookFn: async (cfg) => {
        leituras += 1
        if (leituras === 1) return await readWorkbook(cfg)
        // A validação roda ANTES da restauração: sumir com o backup aqui é o
        // que `restore` encontra quando o arquivo está segurado por outro
        // processo no Windows.
        rmSync(backupDir, { recursive: true, force: true })
        throw new Error('arquivo ilegivel')
      },
    })

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.restored).toBe(false)
    expect(result.fileState).toBe('incerto')
    expect(result.backupPath).not.toBeNull()
    // O arquivo gravado ficou no lugar do original — é o que torna o caminho
    // do backup a única saída, e o que a rota precisa dizer.
    expect(readFileSync(workbook)).not.toEqual(originalBytes)
  })

  it('marca o arquivo como restaurado quando o backup volta', async () => {
    queueTextEdit()
    await setup({
      readWorkbookFn: readThenFail(() => Promise.reject(new Error('arquivo ilegivel'))),
    })

    const result = await applyPendingEdits()

    expect(result.restored).toBe(true)
    expect(result.fileState).toBe('restaurado')
  })

  // Recusa que nunca chegou a gravar: o arquivo está intacto, e o backup não é
  // caminho de recuperação nenhum.
  it('marca o arquivo como intacto na recusa que nao gravou', async () => {
    queueTextEdit()
    await setup()
    writeFileSync(join(directory, `~$${basename(workbook)}`), '', 'utf-8')

    const result = await applyPendingEdits()

    expect(result.fileState).toBe('intacto')
  })

  it('restaura tambem quando a celula gravada nao guarda o valor pretendido', async () => {
    queueTextEdit()
    await setup({
      readWorkbookFn: readThenFail(async () => ({
        rows: [
          {
            sourceRow: SOURCE_ROW,
            cells: { B: { value: 'OUTRA COISA', type: 'string' } },
            styleKey: '',
          },
        ],
        fileHash: HASH_FALSO,
        readAt: new Date(),
        sheetName: '2026',
        sheetPath: 'xl/worksheets/sheet1.xml',
      })),
    })

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.restored).toBe(true)
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // Falha de leitura transitoria — OneDrive ou antivirus tocando o arquivo
  // recem-renomeado — nao pode condenar uma escrita correta.
  it('repete a validacao uma vez antes de condenar', async () => {
    queueTextEdit()
    let calls = 0
    await setup({
      readWorkbookFn: async () => {
        calls += 1
        if (calls === 2) throw new Error('EBUSY transitorio')
        return await readWorkbook(config())
      },
    })

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect(result.restored).toBe(false)
  })

  // Falha de disco no meio da gravacao do temporario: a renomeacao nao chega a
  // ocorrer, e o original permanece intacto.
  it('deixa o original intacto quando a gravacao do temporario falha', async () => {
    queueTextEdit()
    await setup()
    mkdirSync(`${workbook}.cronos.tmp`)

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.restored).toBe(false)
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  it('aborta antes de tocar no original quando o backup falha', async () => {
    queueTextEdit()
    writeFileSync(backupDir, 'nao sou uma pasta', 'utf-8')
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.backupPath).toBeNull()
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // `root` ignora o bit de escrita, e ai a defesa nao e exercivel. Pular e
  // honesto; passar por acidente seria pior.
  it.skipIf(process.getuid?.() === 0)(
    'recusa arquivo somente-leitura antes do backup',
    async () => {
      queueTextEdit()
      await setup()
      chmodSync(workbook, 0o444)

      const result = await applyPendingEdits()

      expect(result.refusal).toBe('ESCRITA_INVALIDA')
      expect(result.backupPath).toBeNull()
      expect(backupNames()).toEqual([])
      expect(readFileSync(workbook)).toEqual(originalBytes)
    },
  )

  // `validateEdit` aceita `''` nos 12 campos de texto, entao a rota enfileira.
  // Gravar a string vazia criaria um `<si><t></t></si>` que a releitura devolve
  // como `null` — e a validacao condenaria a propria escrita, restaurando o
  // backup e dizendo ao operador que o arquivo foi corrompido.
  it('trata texto vazio como celula vazia, sem condenar a propria escrita', async () => {
    enqueue(
      { ref: REF, sourceRow: SOURCE_ROW, field: 'clientRaw', value: '', previous: 'CLIENTE A' },
      queuePath,
    )
    await setup()

    const result = await applyPendingEdits()

    expect(result.ok).toBe(true)
    expect(result.restored).toBe(false)
    expect((await cellsOf(SOURCE_ROW)).B).toBeNull()
  })

  // Composicao vazia sobre arquivo com linhas e store sem `initStore`, nao
  // "nenhum processo". Seguir daqui faria toda edicao voltar com
  // `refMissing: true`, afirmando que a REF sumiu do arquivo.
  it('recusa quando a composicao devolve vazio sobre arquivo com linhas', async () => {
    queueTextEdit()
    await setup({ store: { ...store, rebuild: () => [] } })

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(result.conflicts).toEqual([])
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // Fila editada a mao, ou sobrada de outra versao. Antes da conferencia subir
  // para o inicio, isto derrubava `resolve` com TypeError e a rota de H-26
  // devolveria 500 generico.
  it('recusa campo que nao existe em EDITABLE_FIELDS, sem rejeitar', async () => {
    enqueue(
      {
        ref: REF,
        sourceRow: SOURCE_ROW,
        field: 'customsChannel' as 'clientRaw',
        value: 'verde',
        previous: '',
      },
      queuePath,
    )
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(readFileSync(workbook)).toEqual(originalBytes)
    expect(backupNames()).toEqual([])
  })

  // A fila e append-only em disco: uma data impossivel escrita a mao viraria
  // serial NaN na celula.
  it('recusa edicao que nao passa na validacao de campo', async () => {
    enqueue(
      {
        ref: REF,
        sourceRow: SOURCE_ROW,
        field: 'eta2',
        value: '2026-02-31',
        previous: '2026-08-01',
      },
      queuePath,
    )
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(backupNames()).toEqual([])
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // Ultimo ponto de controle da regra inviolavel 10: com `sheetName: null` na
  // config (P-04) a resolucao e posicional, e uma aba inserida antes da `2026`
  // mudaria o alvo da escrita sem mudar a configuracao.
  it('recusa quando a aba resolvida nao e a que foi lida', async () => {
    queueTextEdit()
    await setup()
    state.sheetName = '2025'

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('ESCRITA_INVALIDA')
    expect(readFileSync(workbook)).toEqual(originalBytes)
    expect(backupNames()).toEqual([])
  })
})

describe('NADA_A_APLICAR', () => {
  it('recusa fila vazia sem backup e sem tocar no arquivo', async () => {
    await setup()

    const result = await applyPendingEdits()

    expect(result.refusal).toBe('NADA_A_APLICAR')
    expect(result.backupPath).toBeNull()
    expect(backupNames()).toEqual([])
    expect(readFileSync(workbook)).toEqual(originalBytes)
  })

  // Fila vazia nao justifica interromper a releitura.
  it('nao pausa o watcher', async () => {
    await setup()

    await applyPendingEdits()

    expect(watcher.pause).not.toHaveBeenCalled()
  })
})

describe('ESCRITA_EM_ANDAMENTO', () => {
  it('recusa a segunda de duas chamadas simultaneas', async () => {
    queueTextEdit()
    await setup()

    const primeira = applyPendingEdits()
    const segunda = await applyPendingEdits()

    expect(segunda.refusal).toBe('ESCRITA_EM_ANDAMENTO')
    expect((await primeira).ok).toBe(true)
  })

  it('libera a proxima chamada depois de concluir', async () => {
    queueTextEdit()
    await setup()

    await applyPendingEdits()
    const depois = await applyPendingEdits()

    expect(depois.refusal).not.toBe('ESCRITA_EM_ANDAMENTO')
  })
})
