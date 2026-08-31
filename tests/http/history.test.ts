import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadColorMap } from '../../src/app/color-map-loader.ts'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'
import { buildServer } from '../../src/http/server.ts'

/**
 * GET /api/history/monthly (`H-28`).
 *
 * A serie vem do arquivo, e o recorte por filtro vem da leitura ATUAL — as duas
 * fontes sao distintas de proposito, e os testes de filtro abaixo sao o que
 * fixa essa fronteira.
 */

const config: AppConfig = {
  workbookPath: '/caminho/ficticio/planilha.xlsx',
  sheetName: '2026',
  headerRow: 1,
  firstDataRow: 2,
  port: 0,
  stalledDaysThreshold: 15,
  topN: 10,
  timezone: 'America/Sao_Paulo',
}

let dir: string
let path: string

function process(
  ref: string,
  statusCategory: StatusCategory,
  extra: Partial<Process> = {},
): Process {
  return {
    sourceRow: 10,
    ref,
    clientRaw: '',
    importerRaw: '',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: '',
    clientProcessKey: '',
    clientLabel: '',
    clientGroupKey: '',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory,
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
    ...extra,
  }
}

function state(overrides: Partial<StoreState> = {}): StoreState {
  return {
    state: 'pronto',
    processes: [],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-04T14:22:31.004Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 0,
    rowsAccepted: 0,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    pendingEdits: [],
    ...overrides,
  }
}

function fakeStore(initial: StoreState): StoreAccess {
  return { getState: () => initial, reload: async () => undefined }
}

function server(initial: StoreState = state()) {
  return buildServer(config, fakeStore(initial), loadColorMap(), path)
}

/** Grava eventos crus: a serie precisa de meses passados, que `recordChanges` nao produz. */
function writeEvents(...events: string[]): void {
  writeFileSync(path, `${events.join('\n')}\n`, 'utf-8')
}

function event(ref: string, ts: string, to: StatusCategory, channel = 'nenhum'): string {
  return JSON.stringify({ ts, ref, from: null, to, channel, sourceRow: 10 })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-history-rota-'))
  path = join(dir, 'history.jsonl')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('GET /api/history/monthly', () => {
  it('devolve as tres chaves do contrato', async () => {
    writeEvents(event('A', '2026-08-01T12:00:00.000Z', 'em_andamento'))

    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly' })

    expect(resposta.statusCode).toBe(200)
    expect(Object.keys(resposta.json()).sort()).toEqual(['historyStartedAt', 'series', 'truncated'])
  })

  it('serializa cada ponto com month, total, desembaracados e canalVermelho', async () => {
    writeEvents(
      event('A', '2026-08-01T12:00:00.000Z', 'desembaracado'),
      event('B', '2026-08-02T12:00:00.000Z', 'em_andamento', 'vermelho'),
    )

    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly?months=1' })
    const [ponto] = resposta.json().series

    expect(Object.keys(ponto).sort()).toEqual(['canalVermelho', 'desembaracados', 'month', 'total'])
    expect(ponto).toMatchObject({ total: 2, desembaracados: 1, canalVermelho: 1 })
  })

  it('devolve historyStartedAt com o instante do primeiro evento', async () => {
    writeEvents(event('A', '2026-08-01T12:00:00.000Z', 'em_andamento'))

    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly' })

    expect(resposta.json().historyStartedAt).toBe('2026-08-01T12:00:00.000Z')
  })

  /** Primeiro dia de uso: serie vazia e `null`, nunca um zero que parece medido. */
  it('devolve serie vazia e historyStartedAt nulo sem historico algum', async () => {
    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly' })

    expect(resposta.json()).toEqual({ series: [], historyStartedAt: null, truncated: false })
  })

  it('usa 12 meses quando months e omitido', async () => {
    writeEvents(event('A', '2020-01-01T12:00:00.000Z', 'em_andamento'))

    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly' })

    expect(resposta.json().series).toHaveLength(12)
  })

  it('marca truncated quando a janela pedida excede o historico', async () => {
    writeEvents(event('A', '2026-08-01T12:00:00.000Z', 'em_andamento'))

    const resposta = await server().inject({ method: 'GET', url: '/api/history/monthly?months=60' })

    expect(resposta.json().truncated).toBe(true)
  })
})

describe('GET /api/history/monthly — validacao', () => {
  it.each(['0', '61', '-1', 'doze', '1.5'])('recusa months=%s com 400', async (valor) => {
    const resposta = await server().inject({
      method: 'GET',
      url: `/api/history/monthly?months=${valor}`,
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('FILTRO_INVALIDO')
  })

  it('aceita os extremos 1 e 60', async () => {
    writeEvents(event('A', '2026-08-01T12:00:00.000Z', 'em_andamento'))

    for (const valor of ['1', '60']) {
      const resposta = await server().inject({
        method: 'GET',
        url: `/api/history/monthly?months=${valor}`,
      })
      expect(resposta.statusCode).toBe(200)
    }
  })

  it('recusa filtro invalido com 400 FILTRO_INVALIDO', async () => {
    const resposta = await server().inject({
      method: 'GET',
      url: '/api/history/monthly?category=inexistente',
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('FILTRO_INVALIDO')
  })

  it('responde 503 quando nunca houve leitura', async () => {
    const semLeitura = state({ state: 'partindo', lastReadAt: null, lastReadOk: false })

    const resposta = await server(semLeitura).inject({
      method: 'GET',
      url: '/api/history/monthly',
    })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
  })
})

describe('GET /api/history/monthly — recorte por filtro', () => {
  const processes = [
    process('A', 'em_andamento', { clientKey: 'ACME' }),
    process('B', 'em_andamento', { clientKey: 'OUTRO' }),
  ]

  beforeEach(() => {
    writeEvents(
      event('A', '2026-08-01T12:00:00.000Z', 'em_andamento'),
      event('B', '2026-08-02T12:00:00.000Z', 'em_andamento'),
    )
  })

  it('recorta a serie aos processos que o filtro seleciona', async () => {
    const resposta = await server(state({ processes })).inject({
      method: 'GET',
      url: '/api/history/monthly?months=1&client=ACME',
    })

    expect(resposta.json().series[0].total).toBe(1)
  })

  /**
   * A diferenca que justifica `hasAnyFilter`: sem filtro a serie sai inteira do
   * arquivo, entao um REF removido da planilha nao apaga o proprio passado.
   */
  it('traz o arquivo inteiro quando nenhum filtro esta ativo, inclusive REF fora da leitura atual', async () => {
    const resposta = await server(state({ processes: [processes[0] as Process] })).inject({
      method: 'GET',
      url: '/api/history/monthly?months=1',
    })

    expect(resposta.json().series[0].total).toBe(2)
  })

  it('devolve serie zerada quando o filtro nao casa com processo algum', async () => {
    const resposta = await server(state({ processes })).inject({
      method: 'GET',
      url: '/api/history/monthly?months=1&client=NINGUEM',
    })

    expect(resposta.json().series).toEqual([])
  })
})
