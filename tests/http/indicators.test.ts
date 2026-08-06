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
    processes: [
      process(2, 'desembaracado'),
      process(3, 'desembaracado'),
      process(4, 'em_andamento'),
      process(5, 'fechado_aguardando_draft'),
    ],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-04T14:22:31.004Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 4,
    rowsAccepted: 4,
    rowsQuarantined: 0,
    ...overrides,
  }
}

function fakeStore(initial: StoreState): StoreAccess {
  return { getState: () => initial, reload: async () => undefined }
}

describe('GET /api/indicators', () => {
  it('devolve o bloco counts com as contagens por categoria', async () => {
    const app = buildServer(config, fakeStore(state()))

    const response = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(response.statusCode).toBe(200)
    expect(response.json().counts).toMatchObject({
      total: 4,
      desembaracados: 2,
      emAndamento: 1,
      emDesembaraco: 0,
      fechadoAguardandoDraft: 1,
    })

    await app.close()
  })

  // Zero em campo nao calculado seria indistinguivel de zero medido.
  it('nao devolve os blocos das historias seguintes', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(Object.keys(body).sort()).toEqual(['counts', 'expectedVessels', 'meta', 'rankings'])
    // `desembaracadosHoje` e `documentaryLeadTime` chegam em H-13.
    expect(body.counts).not.toHaveProperty('desembaracadosHoje')
    expect(body).not.toHaveProperty('documentaryLeadTime')

    await app.close()
  })

  it('devolve os cinco rankings, com responsible sempre completo', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(Object.keys(body.rankings).sort()).toEqual([
      'agents',
      'clients',
      'goods',
      'importers',
      'responsible',
    ])
    // As quatro chaves de responsavel aparecem mesmo com os campos em branco.
    expect(body.rankings.responsible).toHaveLength(4)
    expect(body.meta.topN).toBe(10)

    await app.close()
  })

  it('resolve as fronteiras de data no fuso configurado', async () => {
    const app = buildServer(config, fakeStore(state()))

    const meta = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().meta

    expect(meta.timezone).toBe('America/Sao_Paulo')
    expect(meta.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(meta.weekEnd >= meta.today).toBe(true)
    // O fim da semana ISO cai no maximo seis dias depois de hoje.
    expect(new Date(`${meta.weekEnd}T00:00:00Z`).getUTCDay()).toBe(0)

    await app.close()
  })

  it('devolve 200 com todas as contagens zeradas quando nao ha processos', async () => {
    const app = buildServer(
      config,
      fakeStore(state({ processes: [], rowsRead: 0, rowsAccepted: 0 })),
    )

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().counts.total).toBe(0)

    await app.close()
  })
})

describe('GET /api/indicators — indicadores de risco (H-12)', () => {
  /**
   * A rota resolve `hoje` pelo relogio real, entao os casos usam datas
   * inequivocamente no passado e no futuro. As fronteiras exatas de cada regra
   * sao exercidas em `indicators-risk.test.ts`, com `hoje` fixo.
   */
  const PASSADO = new Date('2020-01-01T00:00:00Z')
  const FUTURO_DISTANTE = new Date('2099-01-01T00:00:00Z')

  it('devolve canalVermelho, documentosPendentes e atrasados', async () => {
    const processes = [
      process(2, 'em_andamento', { customsChannel: 'vermelho', eta2: PASSADO }),
      process(3, 'em_desembaraco', { eta2: PASSADO }),
      process(4, 'desembaracado', { eta2: PASSADO }),
      process(5, 'em_andamento', { eta2: FUTURO_DISTANTE }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts

    expect(counts.canalVermelho).toBe(1)
    // Os dois do passado nao concluidos; o desembaracado e o futuro ficam fora.
    expect(counts.atrasados).toBe(2)
    expect(counts.documentosPendentes).toBe(2)

    await app.close()
  })

  it('devolve os tres zerados quando nao ha processo de risco', async () => {
    const app = buildServer(config, fakeStore(state()))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts

    expect(counts.canalVermelho).toBe(0)
    expect(counts.atrasados).toBe(0)
    expect(counts.documentosPendentes).toBe(0)

    await app.close()
  })
})

describe('GET /api/indicators — estado degradado (A-57)', () => {
  // 04-arquitetura.md secao 5: o dado congelado continua visivel, com aviso.
  it('devolve 200 com a ultima leitura quando degradado apos ler ao menos uma vez', async () => {
    const degradado = state({
      state: 'degradado',
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
    })
    const app = buildServer(config, fakeStore(degradado))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().counts.total).toBe(4)

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura bem-sucedida', async () => {
    const semLeitura = state({
      state: 'degradado',
      processes: [],
      lastReadAt: null,
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
      rowsRead: 0,
      rowsAccepted: 0,
    })
    const app = buildServer(config, fakeStore(semLeitura))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')

    await app.close()
  })

  it('devolve 503 na partida, antes da primeira leitura', async () => {
    const partindo = state({
      state: 'partindo',
      processes: [],
      lastReadAt: null,
      lastReadOk: false,
    })
    const app = buildServer(config, fakeStore(partindo))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.message).toContain('ainda nao foi lida')

    await app.close()
  })
})
