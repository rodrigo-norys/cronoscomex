import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type {
  CustomsChannel,
  Process,
  Responsible,
  StatusCategory,
} from '../../src/domain/types.ts'
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

interface Fields {
  clientKey?: string
  clientRaw?: string
  portKey?: string
  portRaw?: string
  statusCategory?: StatusCategory
  responsible?: Responsible
  customsChannel?: CustomsChannel
  eta2?: Date | null
  importerOutsideRj?: boolean | null
}

let nextRow = 2

function process(fields: Fields = {}): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: `FT${String(row).padStart(3, '0')}.26`,
    clientRaw: fields.clientRaw ?? '',
    importerRaw: '',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: fields.portRaw ?? '',
    goodsRaw: '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: fields.eta2 ?? null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: fields.clientKey ?? '',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: fields.portKey ?? '',
    goodsKey: '',
    statusCategory: fields.statusCategory ?? 'em_andamento',
    responsible: fields.responsible ?? 'indefinido',
    customsChannel: fields.customsChannel ?? 'nenhum',
    importerOutsideRj: fields.importerOutsideRj ?? null,
    styleKey: 'none',
    anomalies: [],
  }
}

function state(processes: Process[] = []): StoreState {
  return {
    state: 'pronto',
    processes,
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-06T14:22:31.004Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: processes.length,
    rowsAccepted: processes.length,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
  }
}

const fakeStore = (initial: StoreState): StoreAccess => ({
  getState: () => initial,
  reload: async () => undefined,
})

describe('GET /api/filters/options', () => {
  it('devolve os nove blocos do contrato', async () => {
    const app = buildServer(config, fakeStore(state()))

    const resposta = await app.inject({ method: 'GET', url: '/api/filters/options' })

    expect(resposta.statusCode).toBe(200)
    expect(Object.keys(resposta.json()).sort()).toEqual([
      'agents',
      'categories',
      'channels',
      'clients',
      'goods',
      'importers',
      'ports',
      'responsible',
      'vessels',
    ])

    await app.close()
  })

  /**
   * A-36: o dominio vem dos dados, nunca de lista fixa. A planilha real trouxe
   * um porto `RO` que a especificacao nao documentava.
   */
  it('deriva os portos dos dados carregados', async () => {
    const processes = [
      process({ portKey: 'RIO', portRaw: 'Rio' }),
      process({ portKey: 'RO', portRaw: 'RO' }),
      process({ portKey: 'RIO', portRaw: 'RIO' }),
    ]
    const app = buildServer(config, fakeStore(state(processes)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.ports).toEqual([
      { key: 'RIO', label: 'Rio', count: 2 },
      { key: 'RO', label: 'RO', count: 1 },
    ])

    await app.close()
  })

  it('conta quantos processos usam cada valor', async () => {
    const processes = [
      process({ clientKey: 'ACME', clientRaw: 'Acme' }),
      process({ clientKey: 'ACME', clientRaw: 'ACME' }),
      process({ clientKey: 'YRD', clientRaw: 'Yrd' }),
    ]
    const app = buildServer(config, fakeStore(state(processes)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clients).toEqual([
      { key: 'ACME', label: 'Acme', count: 2 },
      { key: 'YRD', label: 'Yrd', count: 1 },
    ])

    await app.close()
  })

  /**
   * Dominio FECHADO: as chaves aparecem todas, inclusive zeradas. Esconder a de
   * contagem zero faria o filtro parecer completo quando nao e, e o operador
   * nao saberia que a opcao existe.
   */
  it('devolve as quatro categorias mesmo sem processo algum', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.categories).toHaveLength(4)
    expect(body.categories.every((o: { count: number }) => o.count === 0)).toBe(true)
    // A-01: "Aguardando desembaraço" foi descartado; "Em andamento" esta presente.
    expect(body.categories.map((o: { label: string }) => o.label)).toContain('Em andamento')

    await app.close()
  })

  it('devolve os quatro responsaveis e os tres canais, com rotulo em pt-br', async () => {
    const app = buildServer(config, fakeStore(state([process({ responsible: 'colaborador1' })])))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.responsible).toHaveLength(4)
    expect(body.channels).toHaveLength(3)
    expect(body.responsible[0]).toEqual({
      key: 'colaborador1',
      label: 'Colaborador 1',
      count: 1,
    })
    expect(body.channels.map((o: { label: string }) => o.label)).toContain('Canal Vermelho')

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura', async () => {
    const semLeitura = { ...state(), lastReadAt: null, lastReadOk: false }
    const app = buildServer(config, fakeStore(semLeitura))

    const resposta = await app.inject({ method: 'GET', url: '/api/filters/options' })

    expect(resposta.statusCode).toBe(503)

    await app.close()
  })
})

describe('filtros nas rotas [F]', () => {
  const conjunto = [
    process({ clientKey: 'ACME', statusCategory: 'em_andamento', eta2: new Date('2020-01-01') }),
    process({ clientKey: 'ACME', statusCategory: 'desembaracado' }),
    process({ clientKey: 'YRD', statusCategory: 'em_andamento' }),
  ]

  it('GET /api/indicators recorta o conjunto antes de calcular', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const semFiltro = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
    const comFiltro = (
      await app.inject({ method: 'GET', url: '/api/indicators?client=ACME' })
    ).json()

    expect(semFiltro.counts.total).toBe(3)
    expect(comFiltro.counts.total).toBe(2)

    await app.close()
  })

  it('combina dois parametros em E', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/indicators?client=ACME&category=em_andamento',
      })
    ).json()

    expect(body.counts.total).toBe(1)

    await app.close()
  })

  it('combina valores repetidos do mesmo parametro em OU', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const body = (
      await app.inject({ method: 'GET', url: '/api/indicators?client=ACME&client=YRD' })
    ).json()

    expect(body.counts.total).toBe(3)

    await app.close()
  })

  // RF-18: todo alerta respeita os filtros ativos, como os indicadores.
  it('GET /api/alerts respeita os filtros', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const semFiltro = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()
    const comFiltro = (await app.inject({ method: 'GET', url: '/api/alerts?client=YRD' })).json()

    expect(semFiltro.items.length).toBeGreaterThan(0)
    expect(comFiltro.items).toEqual([])

    await app.close()
  })

  it('devolve 400 FILTRO_INVALIDO para valor fora do dominio', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators?category=inventada' })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('FILTRO_INVALIDO')

    await app.close()
  })

  it('devolve 400 tambem em /api/alerts', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const resposta = await app.inject({ method: 'GET', url: '/api/alerts?channel=roxo' })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('FILTRO_INVALIDO')

    await app.close()
  })

  // Dominio aberto: valor inexistente e resposta legitima, nao erro.
  it('devolve 200 e conjunto vazio para cliente inexistente', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators?client=NAO+EXISTE' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().counts.total).toBe(0)

    await app.close()
  })
})
