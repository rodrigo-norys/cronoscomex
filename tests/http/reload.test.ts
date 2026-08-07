import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
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

function state(overrides: Partial<StoreState> = {}): StoreState {
  return {
    state: 'pronto',
    processes: [],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-03T14:22:31.004Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 649,
    rowsAccepted: 649,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    ...overrides,
  }
}

/** Store falso: a rota e testada sem tocar arquivo algum. */
function fakeStore(initial: StoreState, afterReload = initial): StoreAccess & { calls: number } {
  let current = initial
  const store = {
    calls: 0,
    getState: () => current,
    reload: async (): Promise<void> => {
      store.calls++
      current = afterReload
    },
  }
  return store
}

describe('POST /api/reload', () => {
  it('devolve 200 com o resumo da releitura', async () => {
    const store = fakeStore(state())
    const app = buildServer(config, store)

    const response = await app.inject({ method: 'POST', url: '/api/reload' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      reloaded: true,
      lastReadAt: '2026-08-03T14:22:31.004Z',
      rowsRead: 649,
      rowsQuarantined: 0,
    })
    expect(store.calls).toBe(1)

    await app.close()
  })

  it('recusa com 409 enquanto uma escrita esta em andamento', async () => {
    const store = fakeStore(state({ state: 'escrevendo' }))
    const app = buildServer(config, store)

    const response = await app.inject({ method: 'POST', url: '/api/reload' })

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('ESCRITA_EM_ANDAMENTO')
    // Nao releu: uma leitura durante a escrita propria leria o arquivo pela metade.
    expect(store.calls).toBe(0)

    await app.close()
  })

  it('devolve 503 quando a releitura deixa a aplicacao degradada', async () => {
    const degradado = state({
      state: 'degradado',
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
    })
    const store = fakeStore(state(), degradado)
    const app = buildServer(config, store)

    const response = await app.inject({ method: 'POST', url: '/api/reload' })

    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
    expect(response.json().error.message).toContain('nao foi encontrada')
    expect(store.calls).toBe(1)

    await app.close()
  })

  it('devolve lastReadAt nulo enquanto nao houve leitura', async () => {
    const store = fakeStore(state({ lastReadAt: null, rowsRead: 0 }))
    const app = buildServer(config, store)

    const response = await app.inject({ method: 'POST', url: '/api/reload' })

    expect(response.json().lastReadAt).toBeNull()

    await app.close()
  })
})

describe('GET /api/health — estado vindo do store', () => {
  it('reflete a leitura bem-sucedida', async () => {
    const app = buildServer(config, fakeStore(state()))

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.json()).toMatchObject({
      state: 'pronto',
      sheetName: '2026',
      lastReadAt: '2026-08-03T14:22:31.004Z',
      lastReadOk: true,
      lastReadDurationMs: 120,
      sourceFileHash: 'sha256:abc',
      rowsRead: 649,
      rowsAccepted: 649,
      rowsQuarantined: 0,
      degradedReason: null,
    })

    await app.close()
  })

  it('responde 200 em estado degradado, com o motivo e a ultima leitura boa', async () => {
    const store = fakeStore(
      state({
        state: 'degradado',
        lastReadOk: false,
        degradedReason: 'A planilha esta em uso por outro programa.',
      }),
    )
    const app = buildServer(config, store)

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json().state).toBe('degradado')
    expect(response.json().degradedReason).toContain('em uso')
    // A ultima leitura valida continua visivel: "sem dado" nao vira zero.
    expect(response.json().lastReadAt).toBe('2026-08-03T14:22:31.004Z')

    await app.close()
  })
})
