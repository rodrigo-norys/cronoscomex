import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
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
    })

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
