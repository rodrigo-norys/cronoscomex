import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'
import { buildServer } from '../../src/http/server.ts'

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

/**
 * A rota resolve `hoje` pelo relogio real, entao os casos usam datas
 * inequivocamente no passado e no futuro. As fronteiras exatas de cada regra
 * sao exercidas em `alerts.test.ts`, com `hoje` fixo.
 */
const PASSADO = new Date('2020-01-01T00:00:00Z')
const FUTURO_DISTANTE = new Date('2099-01-01T00:00:00Z')

function process(
  sourceRow: number,
  statusCategory: StatusCategory,
  extra: Partial<Process> = {},
): Process {
  return {
    sourceRow,
    ref: `FT${String(sourceRow).padStart(3, '0')}.26`,
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

describe('GET /api/alerts', () => {
  it('devolve o contrato completo, com os quatro campos', async () => {
    const app = buildServer(config, fakeStore(state()))

    const resposta = await app.inject({ method: 'GET', url: '/api/alerts' })
    const body = resposta.json()

    expect(resposta.statusCode).toBe(200)
    expect(Object.keys(body).sort()).toEqual([
      'countsByType',
      'historyStartedAt',
      'items',
      'stalledThresholdDays',
    ])

    await app.close()
  })

  it('devolve as seis chaves de countsByType, mesmo sem alerta algum', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(Object.keys(body.countsByType).sort()).toEqual([
      'canal_vermelho',
      'chegadas_7_dias',
      'chegadas_hoje',
      'documentacao_pendente',
      'eta_vencida',
      'processos_parados',
    ])
    expect(body.items).toEqual([])

    await app.close()
  })

  it('serializa os alertas ordenados por severidade', async () => {
    const processes = [
      process(2, 'em_andamento', { eta2: PASSADO, docsSentDate: PASSADO }),
      process(3, 'em_desembaraco', { customsChannel: 'vermelho' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.items.map((a: { type: string }) => a.type)).toEqual([
      'eta_vencida',
      'canal_vermelho',
    ])
    expect(body.countsByType.eta_vencida).toBe(1)
    expect(body.countsByType.canal_vermelho).toBe(1)

    await app.close()
  })

  // A-59: a pagina e fila de trabalho, e processo concluido nao pede acao.
  it('nao devolve alerta de processo desembaracado', async () => {
    const processes = [process(2, 'desembaracado', { eta2: PASSADO, customsChannel: 'vermelho' })]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.items).toEqual([])

    await app.close()
  })

  it('nao devolve alerta para processo sem risco', async () => {
    const processes = [process(2, 'em_andamento', { eta2: FUTURO_DISTANTE, docsSentDate: PASSADO })]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.items).toEqual([])

    await app.close()
  })

  it('expoe o limiar de ALE-06 vindo da configuracao', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.stalledThresholdDays).toBe(15)

    await app.close()
  })

  /**
   * A-61: nao ha historico antes de `H-28`, e inventar a data afirmaria
   * retroatividade inexistente — exatamente o que A-43 quer evitar.
   */
  it('devolve historyStartedAt nulo ate H-28', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.historyStartedAt).toBeNull()
    expect(body.countsByType.processos_parados).toBe(0)

    await app.close()
  })
})

describe('GET /api/alerts — estado degradado (A-57)', () => {
  it('devolve 200 com a ultima leitura quando degradado', async () => {
    const processes = [process(2, 'em_andamento', { customsChannel: 'vermelho' })]
    const degradado = state({
      processes,
      state: 'degradado',
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
    })
    const app = buildServer(config, fakeStore(degradado))

    const resposta = await app.inject({ method: 'GET', url: '/api/alerts' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().items).toHaveLength(1)

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura bem-sucedida', async () => {
    const semLeitura = state({
      state: 'degradado',
      lastReadAt: null,
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
    })
    const app = buildServer(config, fakeStore(semLeitura))

    const resposta = await app.inject({ method: 'GET', url: '/api/alerts' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')

    await app.close()
  })
})
