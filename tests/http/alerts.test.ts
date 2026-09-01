import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadColorMap } from '../../src/app/color-map-loader.ts'
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
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
    customsChannel: 'indefinido',
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

const DAY_MS = 86_400_000

/**
 * Instante ancorado no relogio real, e nao numa data fixa: `hoje` da rota vem
 * do relogio, entao so a distancia relativa e estavel.
 */
function diasAtras(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function evento(ts: string, ref: string, to: StatusCategory = 'em_andamento'): string {
  return JSON.stringify({ ts, ref, from: null, to, channel: 'indefinido', sourceRow: 2 })
}

/**
 * Arquivo de historico proprio do caso, escrito a mao.
 *
 * O sandbox de `tests/setup.ts` e um so para o arquivo inteiro, e os casos
 * acima afirmam historico VAZIO — gravar nele contaminaria os vizinhos pela
 * ordem de execucao.
 */
function comHistorico(events: readonly string[]): { path: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'cronos-alertas-'))
  const path = join(dir, 'history.jsonl')
  writeFileSync(path, `${events.join('\n')}\n`, 'utf-8')

  return { path, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('GET /api/alerts', () => {
  it('devolve o contrato completo, com os seis campos', async () => {
    const app = buildServer(config, fakeStore(state()))

    const resposta = await app.inject({ method: 'GET', url: '/api/alerts' })
    const body = resposta.json()

    expect(resposta.statusCode).toBe(200)
    expect(Object.keys(body).sort()).toEqual([
      'countsByType',
      'historyStartedAt',
      'items',
      'stalledCoverageDays',
      'stalledMeasurable',
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
   * Sem historico gravado nao ha data a informar (A-61), e o zero de ALE-06 nao
   * e conclusivo: `stalledMeasurable` falso e o que faz a tela exibir traco em
   * vez de `0` (regra inviolavel 3). Os casos COM historico vivem em
   * `history-store.test.ts`, que controla o arquivo; aqui se fixa o contrato.
   */
  it('devolve historyStartedAt nulo enquanto o historico esta vazio', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.historyStartedAt).toBeNull()
    expect(body.countsByType.processos_parados).toBe(0)
    expect(body.stalledCoverageDays).toBeNull()
    expect(body.stalledMeasurable).toBe(false)

    await app.close()
  })

  /**
   * O criterio de aceite de `H-29`: historico de 3 dias contra limiar de 15. O
   * zero de ALE-06 e inevitavel, e `stalledMeasurable` falso e o que impede a
   * tela de exibi-lo como ausencia de processo parado (A-43).
   */
  it('nao considera mensuravel o historico mais novo que o limiar', async () => {
    const inicio = diasAtras(3)
    const historia = comHistorico([evento(inicio, 'FT002.26')])
    const processes = [process(2, 'em_andamento')]
    const app = buildServer(config, fakeStore(state({ processes })), loadColorMap(), historia.path)

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.historyStartedAt).toBe(inicio)
    expect(body.stalledCoverageDays).toBe(3)
    expect(body.stalledMeasurable).toBe(false)
    expect(body.countsByType.processos_parados).toBe(0)

    await app.close()
    historia.dispose()
  })

  /**
   * A cadeia inteira de ALE-06: evento no arquivo, mapa montado pelo
   * `history-store`, alerta gerado pelo dominio, contagem no corpo. Os limites
   * exatos da comparacao vivem em `alerts.test.ts`; aqui prova-se que a fiacao
   * existe — foi o que faltou de `H-14` ate `H-29`.
   */
  it('dispara o alerta de parado quando o historico ja cobre o limiar', async () => {
    const historia = comHistorico([evento(diasAtras(20), 'FT002.26')])
    const processes = [process(2, 'em_andamento')]
    const app = buildServer(config, fakeStore(state({ processes })), loadColorMap(), historia.path)

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.stalledCoverageDays).toBe(20)
    expect(body.stalledMeasurable).toBe(true)
    expect(body.countsByType.processos_parados).toBe(1)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      type: 'processos_parados',
      severity: 4,
      ref: 'FT002.26',
      daysOverdue: 20,
    })

    await app.close()
    historia.dispose()
  })

  // A-59: processo concluido nao esta parado, esta pronto.
  it('nao devolve alerta de parado para processo desembaracado', async () => {
    const historia = comHistorico([evento(diasAtras(40), 'FT002.26', 'desembaracado')])
    const processes = [process(2, 'desembaracado')]
    const app = buildServer(config, fakeStore(state({ processes })), loadColorMap(), historia.path)

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.items).toEqual([])
    expect(body.countsByType.processos_parados).toBe(0)
    expect(body.stalledMeasurable).toBe(true)

    await app.close()
    historia.dispose()
  })

  // A-32: o limiar e configuracao, e a rota nao carrega valor proprio.
  it('responde ao limiar configurado, sem recompilar', async () => {
    const historia = comHistorico([evento(diasAtras(8), 'FT002.26')])
    const processes = [process(2, 'em_andamento')]
    const frouxo: AppConfig = { ...config, stalledDaysThreshold: 7 }
    const app = buildServer(frouxo, fakeStore(state({ processes })), loadColorMap(), historia.path)

    const body = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()

    expect(body.stalledThresholdDays).toBe(7)
    expect(body.countsByType.processos_parados).toBe(1)

    await app.close()
    historia.dispose()
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
