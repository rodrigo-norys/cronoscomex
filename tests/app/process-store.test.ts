import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { Logger, LogInput } from '../../src/app/logger.ts'
import {
  finishWriting,
  getState,
  initStore,
  markWriting,
  reconfigureWorkbook,
  reload,
  settle,
} from '../../src/app/process-store.ts'
import { normalizeClientMap } from '../../src/domain/client-mapper.ts'
import type { ColorMapEntry } from '../../src/domain/color-mapper.ts'
import type { RawRow } from '../../src/domain/types.ts'
import type { ReadResult } from '../../src/io/xlsx-reader.ts'

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

let dir: string
let workbookPath: string
let quarantinePath: string
let historyPath: string

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    workbookPath,
    sheetName: '2026',
    headerRow: 1,
    firstDataRow: 2,
    port: 5173,
    stalledDaysThreshold: 15,
    topN: 10,
    timezone: 'America/Sao_Paulo',
    ...overrides,
  }
}

function start(overrides: Partial<Parameters<typeof initStore>[0]> = {}): void {
  initStore({
    config: config(),
    colorMap: COLOR_MAP,
    statusAliases: ['DESEMBARACADA', 'DESEMBARCADA'],
    quarantinePath,
    historyPath,
    ...overrides,
  })
}

/** Logger espiao: guarda as entradas em memoria, sem tocar disco. */
function spyLogger(): Logger & { entries: LogInput[] } {
  const entries: LogInput[] = []
  return {
    entries,
    log: (entry) => {
      entries.push(entry)
    },
    purgeExpired: () => [],
    currentFile: () => '',
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-store-'))
  workbookPath = join(dir, 'planilha.xlsx')
  quarantinePath = join(dir, 'quarantine.json')
  historyPath = join(dir, 'history.jsonl')
  copyFileSync('tests/fixtures/basico.xlsx', workbookPath)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('process-store — partida', () => {
  it('comeca em partindo, sem processos e sem hash', () => {
    start()
    const state = getState()

    expect(state.state).toBe('partindo')
    expect(state.processes).toEqual([])
    expect(state.fileHash).toBeNull()
    expect(state.lastReadAt).toBeNull()
    expect(state.lastReadOk).toBe(false)
    expect(state.rowsRead).toBe(0)
  })

  // Modulo recarregado do zero: e a unica forma de observar o estado anterior
  // a qualquer initStore, ja que o store e singleton por desenho.
  it('exige initStore antes de reload', async () => {
    vi.resetModules()
    const fresh = await import('../../src/app/process-store.ts')

    await expect(fresh.reload()).rejects.toThrow(fresh.StoreNotInitializedError)
  })
})

describe('process-store — leitura bem-sucedida', () => {
  it('passa a pronto e preenche o estado', async () => {
    start()
    await reload()
    const state = getState()

    expect(state.state).toBe('pronto')
    expect(state.lastReadOk).toBe(true)
    expect(state.degradedReason).toBeNull()
    expect(state.sheetName).toBe('2026')
    expect(state.fileHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(state.lastReadAt).toBeInstanceOf(Date)
    expect(state.processes).toHaveLength(3)
    expect(state.rowsRead).toBe(3)
    expect(state.rowsAccepted).toBe(3)
  })

  it('grava o relatorio de quarentena da leitura', async () => {
    start()
    await reload()

    expect(existsSync(quarantinePath)).toBe(true)
  })

  it('getState devolve copia: mutar o retorno nao altera o store', async () => {
    start()
    await reload()

    const copia = getState()
    copia.state = 'degradado'

    expect(getState().state).toBe('pronto')
  })
})

describe('process-store — salvar sem editar', () => {
  // Caso-limite de H-08: o evento chega, a leitura ocorre, mas o conteudo e o
  // mesmo. Nada a recompor e nada a regravar.
  it('encerra cedo quando o hash nao mudou, sem regravar o relatorio', async () => {
    start()
    await reload()
    const primeira = getState()

    rmSync(quarantinePath)
    await reload()
    const segunda = getState()

    expect(existsSync(quarantinePath)).toBe(false)
    expect(segunda.state).toBe('pronto')
    expect(segunda.fileHash).toBe(primeira.fileHash)
    expect(segunda.processes).toBe(primeira.processes)
    expect(segunda.lastReadAt?.getTime()).toBeGreaterThanOrEqual(
      primeira.lastReadAt?.getTime() ?? 0,
    )
  })

  it('recompoe quando o conteudo muda de verdade', async () => {
    start()
    await reload()
    const primeira = getState()

    copyFileSync('tests/fixtures/cores.xlsx', workbookPath)
    await reload()
    const segunda = getState()

    expect(segunda.fileHash).not.toBe(primeira.fileHash)
    expect(segunda.processes).not.toBe(primeira.processes)
  })
})

describe('process-store — degradacao', () => {
  it('vira degradado quando o arquivo some, preservando a ultima leitura', async () => {
    start()
    await reload()
    const boa = getState()

    rmSync(workbookPath)
    await reload()
    const state = getState()

    expect(state.state).toBe('degradado')
    expect(state.lastReadOk).toBe(false)
    expect(state.degradedReason).toContain('nao foi encontrada')
    // O painel nunca exibe zero em lugar de "sem dado".
    expect(state.processes).toHaveLength(3)
    expect(state.fileHash).toBe(boa.fileHash)
    expect(state.lastReadAt).toEqual(boa.lastReadAt)
  })

  /**
   * H-35, medido na primeira execucao em Windows. Sem caminho configurado a
   * leitura falha com ENOENT como qualquer outra, e a frase saia truncada —
   * "nao foi encontrada em ." —, afirmando que havia um caminho que sumiu.
   * Ausencia de configuracao nao e arquivo ausente (regra inviolavel 3).
   */
  it('sem caminho configurado, a razao fala de configuracao e nao de arquivo', async () => {
    start({ config: config({ workbookPath: '' }) })
    await reload()
    const state = getState()

    expect(state.state).toBe('degradado')
    expect(state.degradedReason).toBe('Nenhuma planilha configurada ainda.')
    expect(state.degradedReason).not.toContain('nao foi encontrada')
  })

  it('vira degradado quando o arquivo e ilegivel, preservando a ultima leitura', async () => {
    start()
    await reload()

    writeFileSync(workbookPath, 'isto nao e um zip')
    await reload()
    const state = getState()

    expect(state.state).toBe('degradado')
    expect(state.degradedReason).not.toBe('')
    expect(state.processes).toHaveLength(3)
  })

  it('volta a pronto quando o arquivo reaparece', async () => {
    start()
    await reload()

    rmSync(workbookPath)
    await reload()
    expect(getState().state).toBe('degradado')

    copyFileSync('tests/fixtures/basico.xlsx', workbookPath)
    await reload()
    const state = getState()

    expect(state.state).toBe('pronto')
    expect(state.lastReadOk).toBe(true)
    expect(state.degradedReason).toBeNull()
  })

  it('degrada na primeira leitura sem inventar processos', async () => {
    rmSync(workbookPath)
    start()
    await reload()
    const state = getState()

    expect(state.state).toBe('degradado')
    expect(state.processes).toEqual([])
    expect(state.rowsRead).toBe(0)
  })
})

describe('process-store — concorrencia', () => {
  it('coalesce releituras simultaneas numa unica leitura', async () => {
    let reads = 0
    let liberar = (): void => undefined
    const bloqueio = new Promise<void>((resolve) => {
      liberar = resolve
    })

    const readWorkbookFn = async (): Promise<ReadResult> => {
      reads++
      await bloqueio
      return {
        rows: [],
        fileHash: `sha256:${'a'.repeat(64)}`,
        readAt: new Date('2026-08-03T12:00:00Z'),
        sheetName: '2026',
        sheetPath: 'xl/worksheets/sheet1.xml',
      }
    }

    start({ readWorkbookFn })

    const primeira = reload()
    const segunda = reload()
    expect(getState().state).toBe('lendo')

    liberar()
    await Promise.all([primeira, segunda])

    expect(reads).toBe(1)
    expect(getState().state).toBe('pronto')
  })

  it('aceita nova releitura depois que a anterior termina', async () => {
    let reads = 0
    const readWorkbookFn = async (): Promise<ReadResult> => {
      reads++
      return {
        rows: [],
        fileHash: `sha256:${String(reads).repeat(64).slice(0, 64)}`,
        readAt: new Date('2026-08-03T12:00:00Z'),
        sheetName: '2026',
        sheetPath: 'xl/worksheets/sheet1.xml',
      }
    }

    start({ readWorkbookFn })

    await reload()
    await reload()

    expect(reads).toBe(2)
  })

  it('nunca rejeita, mesmo com leitor que lanca', async () => {
    start({
      readWorkbookFn: async () => {
        throw new Error('falha simulada')
      },
    })

    await expect(reload()).resolves.toBeUndefined()
    expect(getState().state).toBe('degradado')
    expect(getState().degradedReason).toBe('falha simulada')
  })
})

describe('process-store — eventos de log (H-31)', () => {
  it('emite read.start e read.done com os contadores da leitura', async () => {
    const logger = spyLogger()
    start({ logger })
    await reload()

    const eventos = logger.entries.map((e) => e.event)
    expect(eventos).toContain('read.start')
    expect(eventos).toContain('read.done')

    // O color-map deste teste tem so 'none', entao as 3 linhas coloridas da
    // fixture entram como aceitas E como pendencia de cor (A-17).
    const done = logger.entries.find((e) => e.event === 'read.done')
    expect(done).toMatchObject({
      level: 'info',
      rowsRead: 3,
      rowsAccepted: 3,
      rowsQuarantined: 3,
    })
    expect(done?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('preenche lastReadDurationMs no estado', async () => {
    start()
    await reload()

    expect(getState().lastReadDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('emite quarantine.reported com a taxa', async () => {
    const logger = spyLogger()
    start({ logger })
    await reload()

    const reportado = logger.entries.find((e) => e.event === 'quarantine.reported')
    expect(reportado).toMatchObject({ rowsQuarantined: 3, quarantineRate: 1 })
  })

  it('emite read.done tambem quando o hash nao mudou, sem novo quarantine.reported', async () => {
    const logger = spyLogger()
    start({ logger })
    await reload()
    logger.entries.length = 0

    await reload()

    expect(logger.entries.map((e) => e.event)).toEqual(['read.start', 'read.done'])
  })

  it('classifica falha de leitura do arquivo como ARQUIVO_INDISPONIVEL', async () => {
    const logger = spyLogger()
    rmSync(workbookPath)
    start({ logger })
    await reload()

    expect(logger.entries.find((e) => e.event === 'read.failed')).toEqual({
      level: 'error',
      event: 'read.failed',
      errorCode: 'ARQUIVO_INDISPONIVEL',
    })
  })

  // Ler deu certo; quebrou na composicao. E defeito nosso, nao do arquivo.
  it('classifica falha de composicao como ERRO_INTERNO', async () => {
    const logger = spyLogger()
    start({
      logger,
      readWorkbookFn: async () => ({
        rows: [{ sourceRow: 2 } as unknown as RawRow],
        fileHash: `sha256:${'b'.repeat(64)}`,
        readAt: new Date('2026-08-04T12:00:00Z'),
        sheetName: '2026',
        sheetPath: 'xl/worksheets/sheet1.xml',
      }),
    })
    await reload()

    expect(getState().state).toBe('degradado')
    expect(logger.entries.find((e) => e.event === 'read.failed')?.errorCode).toBe('ERRO_INTERNO')
  })

  // RNF-33: o motivo legivel vai para a interface; o log leva so o codigo.
  it('nao registra a mensagem de falha, que carrega o caminho do arquivo', async () => {
    const logger = spyLogger()
    rmSync(workbookPath)
    start({ logger })
    await reload()

    const registrado = JSON.stringify(logger.entries)
    expect(getState().degradedReason).toContain(workbookPath)
    expect(registrado).not.toContain(workbookPath)
  })
})

/**
 * O estado que o write-guard produz. Ate H-25 ele era inalcancavel, e a guarda
 * de 409 ESCRITA_EM_ANDAMENTO em `POST /api/reload` era codigo morto.
 */
describe('escrita em curso', () => {
  it('marca escrevendo e volta para pronto quando a ultima leitura deu certo', async () => {
    start()
    await reload()

    markWriting()
    expect(getState().state).toBe('escrevendo')

    finishWriting()
    expect(getState().state).toBe('pronto')
  })

  // Escrever nao conserta leitura quebrada: voltar a 'pronto' aqui faria o
  // painel afirmar que o dado exibido esta em dia.
  it('volta para degradado quando a ultima leitura falhou', async () => {
    rmSync(workbookPath)
    start()
    await reload()

    markWriting()
    finishWriting()

    expect(getState().state).toBe('degradado')
  })

  it('ignora finishWriting fora de uma escrita', async () => {
    start()
    await reload()

    finishWriting()

    expect(getState().state).toBe('pronto')
  })
})

/**
 * O write-guard aguarda isto antes de ler o arquivo. Os testes dele injetam um
 * dublê, entao a ligacao com `inFlight` precisa ser provada aqui — e junto com
 * ela a de `settled`, que mantem o estado 'escrevendo' quando a releitura em
 * voo termina.
 */
describe('settle', () => {
  it('resolve na hora quando nao ha releitura em voo', async () => {
    start()
    await reload()

    await expect(settle()).resolves.toBeUndefined()
  })

  it('so resolve depois que a releitura em voo termina', async () => {
    let liberar = (): void => undefined
    const bloqueio = new Promise<void>((resolve) => {
      liberar = resolve
    })
    let resolvido = false

    start({
      readWorkbookFn: async () => {
        await bloqueio
        return {
          rows: [],
          fileHash: `sha256:${'c'.repeat(64)}`,
          readAt: new Date('2026-08-14T12:00:00Z'),
          sheetName: '2026',
          sheetPath: 'xl/worksheets/sheet1.xml',
        }
      },
    })

    const releitura = reload()
    const espera = settle().then(() => {
      resolvido = true
    })

    await Promise.resolve()
    expect(resolvido).toBe(false)

    liberar()
    await Promise.all([releitura, espera])
    expect(resolvido).toBe(true)
  })

  // Sem isto, `finishWriting` sairia pelo early-return e POST /api/reload
  // deixaria de recusar no meio da gravacao.
  it('a releitura que termina durante a escrita nao apaga o estado escrevendo', async () => {
    let liberar = (): void => undefined
    const bloqueio = new Promise<void>((resolve) => {
      liberar = resolve
    })

    start({
      readWorkbookFn: async () => {
        await bloqueio
        return {
          rows: [],
          fileHash: `sha256:${'d'.repeat(64)}`,
          readAt: new Date('2026-08-14T12:00:00Z'),
          sheetName: '2026',
          sheetPath: 'xl/worksheets/sheet1.xml',
        }
      },
    })

    const releitura = reload()
    markWriting()

    liberar()
    await releitura
    await settle()

    expect(getState().state).toBe('escrevendo')
  })
})

describe('process-store — reconfiguracao do caminho (H-34)', () => {
  it('passa a ler a planilha nova sem reiniciar o processo', async () => {
    const outra = join(dir, 'outra.xlsx')
    copyFileSync('tests/fixtures/cores.xlsx', outra)
    start()
    await reload()
    expect(getState().rowsRead).toBe(3)

    await reconfigureWorkbook(outra)

    expect(getState().state).toBe('pronto')
    expect(getState().rowsRead).toBe(10)
  })

  /**
   * O MESMO objeto `AppConfig` foi passado ao store, ao write-guard e a cada
   * registrador de rota. Trocar o objeto em vez de muta-lo deixaria a rota de
   * saude respondendo o caminho velho enquanto a leitura usa o novo.
   */
  it('muta o config compartilhado, para os demais consumidores enxergarem', async () => {
    const compartilhado = config()
    const outra = join(dir, 'outra.xlsx')
    copyFileSync('tests/fixtures/cores.xlsx', outra)
    start({ config: compartilhado })

    await reconfigureWorkbook(outra)

    expect(compartilhado.workbookPath).toBe(outra)
  })

  it('volta lastReadAt a null quando a planilha nova nao pode ser lida', async () => {
    start()
    await reload()
    expect(getState().lastReadAt).not.toBeNull()

    await reconfigureWorkbook(join(dir, 'nao-existe.xlsx'))

    // E o gatilho da tela de configuracao: 'degradado' MAIS lastReadAt nulo. O
    // painel nao pode seguir exibindo o dado do arquivo anterior.
    expect(getState().state).toBe('degradado')
    expect(getState().lastReadAt).toBeNull()
    expect(getState().processes).toEqual([])
  })

  it('nao reconfigura no meio de uma leitura em voo', async () => {
    const outra = join(dir, 'outra.xlsx')
    copyFileSync('tests/fixtures/cores.xlsx', outra)

    let liberar = (): void => {}
    const presa = new Promise<void>((resolve) => {
      liberar = resolve
    })
    const lidos: string[] = []
    start({
      readWorkbookFn: async (cfg): Promise<ReadResult> => {
        lidos.push(cfg.workbookPath)
        if (lidos.length === 1) await presa
        return {
          rows: [] as RawRow[],
          fileHash: 'sha256:x',
          readAt: new Date(),
          sheetName: '2026',
          sheetPath: 'xl/worksheets/sheet1.xml',
        }
      },
    })

    const emVoo = reload()
    const trocando = reconfigureWorkbook(outra)
    // A primeira leitura ainda esta presa: a troca nao pode ter acontecido.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(lidos).toEqual([workbookPath])

    liberar()
    await emVoo
    await trocando

    expect(lidos).toEqual([workbookPath, outra])
  })

  it('serializa reconfiguracoes concorrentes, na ordem de chegada', async () => {
    const primeira = join(dir, 'primeira.xlsx')
    const segunda = join(dir, 'segunda.xlsx')
    copyFileSync('tests/fixtures/cores.xlsx', primeira)
    copyFileSync('tests/fixtures/vazio.xlsx', segunda)

    const lidos: string[] = []
    let simultaneas = 0
    start({
      readWorkbookFn: async (cfg): Promise<ReadResult> => {
        simultaneas++
        expect(simultaneas).toBe(1)
        await new Promise((resolve) => setTimeout(resolve, 5))
        lidos.push(cfg.workbookPath)
        simultaneas--
        return {
          rows: [] as RawRow[],
          fileHash: 'sha256:x',
          readAt: new Date(),
          sheetName: '2026',
          sheetPath: 'xl/worksheets/sheet1.xml',
        }
      },
    })

    await Promise.all([reconfigureWorkbook(primeira), reconfigureWorkbook(segunda)])

    expect(lidos).toEqual([primeira, segunda])
  })

  it('exige initStore antes de reconfigurar', async () => {
    vi.resetModules()
    const fresh = await import('../../src/app/process-store.ts')

    await expect(fresh.reconfigureWorkbook('/x.xlsx')).rejects.toThrow(
      fresh.StoreNotInitializedError,
    )
  })
})

/**
 * `H-49`. O mapa de `H-48` chega ao dominio pelo store, e e ele que decide se
 * `clientKey` responde "quem e o cliente" ou "qual o processo dele".
 */
describe('initStore — o mapa de clientes chega a composicao', () => {
  const linha = (client: string): RawRow => ({
    sourceRow: 2,
    cells: {
      A: { value: 'FT002.26', type: 'string' },
      B: { value: client, type: 'string' },
    },
    styleKey: 'none',
  })

  const lerUmaLinha = async (): Promise<ReadResult> => ({
    rows: [linha('ACM-29')],
    fileHash: `sha256:${'c'.repeat(64)}`,
    readAt: new Date('2026-08-31T12:00:00Z'),
    sheetName: '2026',
    sheetPath: 'xl/worksheets/sheet1.xml',
  })

  it('consolida o cliente quando o mapa esta presente', async () => {
    start({
      readWorkbookFn: lerUmaLinha,
      clientMap: normalizeClientMap([
        { key: 'ACME', label: 'Acme Comércio', rules: [{ match: 'prefix', value: 'ACM' }] },
      ]),
    })
    await reload()

    const [process] = getState().processes
    expect(process?.clientKey).toBe('ACME')
    expect(process?.clientLabel).toBe('Acme Comércio')
    expect(process?.clientProcessKey).toBe('ACM-29')
  })

  // Mapa ausente e o caso do operador que ainda nao declarou regra nenhuma:
  // a aplicacao se comporta como antes de `H-49`, e nao como se nao houvesse
  // cliente.
  it('sem mapa, o cliente vale o que a celula diz', async () => {
    start({ readWorkbookFn: lerUmaLinha })
    await reload()

    const [process] = getState().processes
    expect(process?.clientKey).toBe('ACM-29')
    expect(process?.clientLabel).toBe('ACM-29')
  })
})
