import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreState } from '../../src/app/process-store.ts'
import { buildServer, LOOPBACK } from '../../src/http/server.ts'

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

describe('GET /api/health', () => {
  it('responde 200 com o contrato de 05-contratos-api.md', async () => {
    const app = buildServer(config)

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      state: 'partindo',
      sheetName: '2026',
      lastReadAt: null,
      lastReadOk: false,
      rowsRead: 0,
      rowsAccepted: 0,
      rowsQuarantined: 0,
      pendingEditsCount: 0,
      degradedReason: null,
      externalLock: false,
      conflictFiles: [],
    })

    await app.close()
  })

  // `H-23`: o campo era zero fixo ate a fila existir.
  it('reflete a contagem de edicoes pendentes', async () => {
    const comEdicao: StoreState = {
      state: 'pronto',
      processes: [],
      fileHash: 'sha256:abc',
      sheetName: '2026',
      lastReadAt: new Date('2026-08-07T12:00:00.000Z'),
      lastReadOk: true,
      degradedReason: null,
      lastReadDurationMs: 120,
      rowsRead: 0,
      rowsAccepted: 0,
      rowsQuarantined: 0,
      externalLock: false,
      conflictFiles: [],
      pendingEdits: [
        {
          id: 'a',
          ts: '2026-08-07T12:00:00.000Z',
          ref: 'FT001.26',
          sourceRow: 2,
          field: 'eta2' as const,
          value: '2026-09-01',
          previous: '',
        },
      ],
    }
    const app = buildServer(config, { getState: () => comEdicao, reload: async () => undefined })

    const body = (await app.inject({ method: 'GET', url: '/api/health' })).json()

    expect(body.pendingEditsCount).toBe(1)

    await app.close()
  })

  it('fixa a lista completa de campos do contrato', async () => {
    const app = buildServer(config)

    const body = (await app.inject({ method: 'GET', url: '/api/health' })).json()

    expect(Object.keys(body).sort()).toEqual([
      'conflictFiles',
      'degradedReason',
      'externalLock',
      'lastReadAt',
      'lastReadDurationMs',
      'lastReadOk',
      'pendingEditsCount',
      'rowsAccepted',
      'rowsQuarantined',
      'rowsRead',
      'sheetName',
      'sourceFileHash',
      'state',
      'today',
      'workbookPath',
    ])

    await app.close()
  })

  /**
   * H-15, A-62. A casca compara este dia com aquele sob o qual renderizou: e
   * assim que uma tela aberta atravessando a meia-noite descobre que a fila
   * mudou sem nenhum arquivo ter mudado.
   *
   * O fuso e resolvido aqui, uma vez, pela mesma `today(tz)` dos indicadores.
   * As 22h em Sao Paulo o instante corrente ja e o dia seguinte em UTC, e
   * devolver isso adiantaria a virada em duas horas todas as noites.
   */
  it('devolve o dia civil do servidor no fuso configurado', async () => {
    const app = buildServer(config)

    const body = (await app.inject({ method: 'GET', url: '/api/health' })).json()

    const noFusoDaConfiguracao = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    expect(body.today).toBe(noFusoDaConfiguracao)

    await app.close()
  })

  /**
   * H-32. Os dois campos sao SINAL, nunca acao (A-58): a rota continua
   * respondendo 200 e servindo o dado, com ou sem interferencia.
   */
  it('serializa os sinais de interferencia externa', async () => {
    const comInterferencia: StoreState = {
      state: 'pronto',
      processes: [],
      fileHash: 'sha256:abc',
      sheetName: '2026',
      lastReadAt: new Date('2026-08-06T14:22:31.004Z'),
      lastReadOk: true,
      degradedReason: null,
      lastReadDurationMs: 120,
      rowsRead: 0,
      rowsAccepted: 0,
      rowsQuarantined: 0,
      externalLock: true,
      conflictFiles: ['planilha-Cópia em conflito de PC-01.xlsx'],
      pendingEdits: [],
    }
    const app = buildServer(config, {
      getState: () => comInterferencia,
      reload: async () => undefined,
    })

    const resposta = await app.inject({ method: 'GET', url: '/api/health' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().externalLock).toBe(true)
    expect(resposta.json().conflictFiles).toEqual(['planilha-Cópia em conflito de PC-01.xlsx'])

    await app.close()
  })

  it('escuta exclusivamente em loopback (RNF-29)', () => {
    expect(LOOPBACK).toBe('127.0.0.1')
  })

  it('devolve 404 em rota inexistente', async () => {
    const app = buildServer(config)

    const response = await app.inject({ method: 'GET', url: '/api/inexistente' })

    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
