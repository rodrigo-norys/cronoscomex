import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createLogger,
  type LogEntry,
  type Logger,
  NULL_LOGGER,
  RETENTION_DAYS,
} from '../../src/app/logger.ts'

const TIMEZONE = 'America/Sao_Paulo'

let dir: string

function loggerAt(instant: string, directory = dir): Logger {
  return createLogger({ directory, timezone: TIMEZONE, now: () => new Date(instant) })
}

function linesOf(file: string): LogEntry[] {
  return readFileSync(file, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as LogEntry)
}

function existingLogFile(stamp: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `app-${stamp}.jsonl`), '')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-log-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('logger — gravacao', () => {
  it('grava uma linha JSON por evento, com ts em ISO', () => {
    const logger = loggerAt('2026-08-04T12:00:00Z')

    logger.log({ level: 'info', event: 'read.start' })
    logger.log({
      level: 'info',
      event: 'read.done',
      durationMs: 120,
      rowsRead: 649,
      rowsAccepted: 649,
      rowsQuarantined: 0,
    })

    const entries = linesOf(logger.currentFile())

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ts: '2026-08-04T12:00:00.000Z',
      level: 'info',
      event: 'read.start',
    })
    expect(entries[1]).toMatchObject({
      event: 'read.done',
      durationMs: 120,
      rowsRead: 649,
      rowsAccepted: 649,
      rowsQuarantined: 0,
    })
  })

  it('cria o diretorio de logs quando ele nao existe', () => {
    const logger = createLogger({
      directory: join(dir, 'fundo', 'logs'),
      timezone: TIMEZONE,
      now: () => new Date('2026-08-04T12:00:00Z'),
    })

    logger.log({ level: 'info', event: 'read.start' })

    expect(existsSync(logger.currentFile())).toBe(true)
  })

  // 23h30 em Sao Paulo ja e o dia seguinte em UTC. O operador procura o log
  // pelo dia que viveu, nao pelo dia do meridiano de Greenwich.
  it('nomeia o arquivo pelo dia civil do operador, nao pelo UTC', () => {
    const logger = loggerAt('2026-08-05T02:30:00Z')

    logger.log({ level: 'info', event: 'read.start' })

    expect(logger.currentFile()).toBe(join(dir, 'app-20260804.jsonl'))
  })

  it('acumula eventos do mesmo dia no mesmo arquivo', () => {
    loggerAt('2026-08-04T08:00:00Z').log({ level: 'info', event: 'read.start' })
    const segundo = loggerAt('2026-08-04T20:00:00Z')
    segundo.log({ level: 'info', event: 'read.done', durationMs: 90 })

    expect(readdirSync(dir)).toEqual(['app-20260804.jsonl'])
    expect(linesOf(segundo.currentFile())).toHaveLength(2)
  })

  it('separa dias diferentes em arquivos diferentes', () => {
    loggerAt('2026-08-04T12:00:00Z').log({ level: 'info', event: 'read.start' })
    loggerAt('2026-08-05T12:00:00Z').log({ level: 'info', event: 'read.start' })

    expect(readdirSync(dir).sort()).toEqual(['app-20260804.jsonl', 'app-20260805.jsonl'])
  })

  it('omite campos ausentes em vez de gravar null', () => {
    const logger = loggerAt('2026-08-04T12:00:00Z')

    logger.log({ level: 'error', event: 'read.failed', errorCode: 'ARQUIVO_INDISPONIVEL' })

    expect(Object.keys(linesOf(logger.currentFile())[0] ?? {})).toEqual([
      'ts',
      'level',
      'event',
      'errorCode',
    ])
  })

  // Log nao e critico: perde-se o diagnostico, nao a operacao.
  it('nao lanca quando o destino nao pode ser criado', () => {
    const obstaculo = join(dir, 'obstaculo')
    writeFileSync(obstaculo, 'sou arquivo, nao diretorio')
    const logger = createLogger({
      directory: join(obstaculo, 'logs'),
      timezone: TIMEZONE,
      now: () => new Date('2026-08-04T12:00:00Z'),
    })

    expect(() => logger.log({ level: 'info', event: 'read.start' })).not.toThrow()
  })
})

describe('logger — RNF-33, nenhum dado pessoal', () => {
  it('descarta campos fora do contrato, mesmo forcados por cast', () => {
    const logger = loggerAt('2026-08-04T12:00:00Z')
    const vazamento = {
      level: 'error',
      event: 'read.failed',
      errorCode: 'ARQUIVO_INDISPONIVEL',
      sourceRow: 484,
      ref: 'FT481.26',
      message: 'falha na celula L484: "DUIMP 1 - CANAL AMARELO"',
      client: 'ACME LOG',
      detail: { vessel: 'NAVIO ALFA' },
    } as unknown as Parameters<Logger['log']>[0]

    logger.log(vazamento)

    const bruto = readFileSync(logger.currentFile(), 'utf-8')

    expect(bruto).not.toContain('ACME LOG')
    expect(bruto).not.toContain('NAVIO ALFA')
    expect(bruto).not.toContain('CANAL AMARELO')
    expect(bruto).not.toContain('message')
    // Sobra a coordenada, que e o que permite achar a linha na planilha.
    expect(linesOf(logger.currentFile())[0]).toEqual({
      ts: '2026-08-04T12:00:00.000Z',
      level: 'error',
      event: 'read.failed',
      ref: 'FT481.26',
      sourceRow: 484,
      errorCode: 'ARQUIVO_INDISPONIVEL',
    })
  })
})

describe('logger — retencao de 30 dias', () => {
  it('mantem o arquivo de exatamente 30 dias e remove o de 31', () => {
    existingLogFile('20260705') // 30 dias antes de 2026-08-04
    existingLogFile('20260704') // 31 dias
    existingLogFile('20260804') // hoje

    const removidos = loggerAt('2026-08-04T12:00:00Z').purgeExpired()

    expect(removidos).toHaveLength(1)
    expect(removidos[0]).toContain('app-20260704.jsonl')
    expect(readdirSync(dir).sort()).toEqual(['app-20260705.jsonl', 'app-20260804.jsonl'])
  })

  it('fixa a retencao em 30 dias', () => {
    expect(RETENTION_DAYS).toBe(30)
  })

  it('ignora arquivos que nao seguem o padrao de nome', () => {
    existingLogFile('20260101')
    writeFileSync(join(dir, 'anotacoes.txt'), 'nao mexer')
    writeFileSync(join(dir, 'app-2026.jsonl'), '')

    loggerAt('2026-08-04T12:00:00Z').purgeExpired()

    expect(readdirSync(dir).sort()).toEqual(['anotacoes.txt', 'app-2026.jsonl'])
  })

  it('nao falha quando o diretorio ainda nao existe', () => {
    const logger = createLogger({
      directory: join(dir, 'inexistente'),
      timezone: TIMEZONE,
      now: () => new Date('2026-08-04T12:00:00Z'),
    })

    expect(logger.purgeExpired()).toEqual([])
  })
})

describe('NULL_LOGGER', () => {
  it('nao grava nada e nao falha', () => {
    expect(() => NULL_LOGGER.log({ level: 'info', event: 'read.start' })).not.toThrow()
    expect(NULL_LOGGER.purgeExpired()).toEqual([])
    expect(readdirSync(dir)).toEqual([])
  })
})
