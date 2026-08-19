import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { buildServer } from '../../src/http/server.ts'

/**
 * H-34. Nenhum teste toca `config/app.json` real nem a planilha real: o caminho
 * do arquivo de configuracao e injetado, e a planilha e um temporario.
 */

let dir: string
let workbook: string
let configPath: string

function config(): AppConfig {
  return {
    workbookPath: workbook,
    sheetName: '2026',
    headerRow: 1,
    firstDataRow: 2,
    port: 0,
    stalledDaysThreshold: 15,
    topN: 10,
    timezone: 'America/Sao_Paulo',
  }
}

function state(overrides: Partial<StoreState> = {}): StoreState {
  return {
    state: 'pronto',
    processes: [],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-18T12:00:00.000Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 649,
    rowsAccepted: 649,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    pendingEdits: [],
    ...overrides,
  }
}

function storeOf(next: StoreState): StoreAccess {
  return { getState: () => next, reload: async () => {} }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-http-cfg-'))
  workbook = join(dir, 'planilha.xlsx')
  configPath = join(dir, 'app.json')
  writeFileSync(workbook, 'conteudo irrelevante')
  writeFileSync(configPath, JSON.stringify({ workbookPath: workbook, port: 5173 }))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** O servidor com a rota de configuracao ja injetada. */
function serverWith(applied: string[], current: AppConfig = config()) {
  const app = buildServer(current, storeOf(state()), [], undefined, async (path) => {
    applied.push(path)
    current.workbookPath = path
  })
  return app
}

describe('GET /api/config/workbook', () => {
  it('responde o caminho configurado com exists e readable', async () => {
    const app = serverWith([])

    const response = await app.inject({ method: 'GET', url: '/api/config/workbook' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ workbookPath: workbook, exists: true, readable: true })
    await app.close()
  })

  it('responde exists false quando o caminho configurado sumiu', async () => {
    const semPlanilha = { ...config(), workbookPath: join(dir, 'sumiu.xlsx') }
    const app = serverWith([], semPlanilha)

    expect((await app.inject({ method: 'GET', url: '/api/config/workbook' })).json()).toMatchObject(
      {
        exists: false,
        readable: false,
      },
    )
    await app.close()
  })

  it('responde caminho vazio na primeira execucao', async () => {
    const app = serverWith([], { ...config(), workbookPath: '' })

    expect((await app.inject({ method: 'GET', url: '/api/config/workbook' })).json()).toEqual({
      workbookPath: '',
      exists: false,
      readable: false,
    })
    await app.close()
  })
})

describe('PUT /api/config/workbook', () => {
  it('grava, aplica e responde o corpo do health', async () => {
    const nova = join(dir, 'outra.xlsx')
    writeFileSync(nova, 'x')
    const applied: string[] = []
    const app = buildServer(
      config(),
      storeOf(state()),
      [],
      undefined,
      async (path) => {
        applied.push(path)
      },
      configPath,
    )

    const response = await app.inject({
      method: 'PUT',
      url: '/api/config/workbook',
      payload: { path: nova },
    })

    expect(response.statusCode).toBe(200)
    // O contrato: o corpo de GET /api/health, e nao um envelope proprio.
    expect(response.json()).toMatchObject({
      state: 'pronto',
      rowsAccepted: 649,
      today: expect.any(String),
    })
    expect(applied).toEqual([nova])
    expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toMatchObject({
      workbookPath: nova,
      port: 5173,
    })
    await app.close()
  })

  it('recusa caminho inexistente com CAMINHO_INVALIDO, sem tocar o arquivo', async () => {
    const applied: string[] = []
    const app = buildServer(
      config(),
      storeOf(state()),
      [],
      undefined,
      async (path) => {
        applied.push(path)
      },
      configPath,
    )

    const response = await app.inject({
      method: 'PUT',
      url: '/api/config/workbook',
      payload: { path: join(dir, 'sumiu.xlsx') },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('CAMINHO_INVALIDO')
    expect(response.json().error.message).toMatch(/OneDrive/)
    // O criterio de aceite: o caminho anterior continua valendo.
    expect(applied).toEqual([])
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).workbookPath).toBe(workbook)
    await app.close()
  })

  it('recusa quem nao e .xlsx', async () => {
    const outro = join(dir, 'planilha.xls')
    writeFileSync(outro, 'x')
    const app = serverWith([])

    const response = await app.inject({
      method: 'PUT',
      url: '/api/config/workbook',
      payload: { path: outro },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.message).toMatch(/\.xlsx/)
    await app.close()
  })

  it('recusa corpo sem `path` como texto', async () => {
    const app = serverWith([])

    for (const payload of [{}, { path: 42 }, { path: null }]) {
      const response = await app.inject({ method: 'PUT', url: '/api/config/workbook', payload })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('CAMINHO_INVALIDO')
    }
    await app.close()
  })

  /**
   * O caso-limite do backlog: planilha valida, mas sem a aba em escopo. O
   * caminho E salvo e a aplicacao entra em 'degradado' com a razao — recusar
   * aqui esconderia do operador o motivo real.
   */
  it('salva mesmo quando a leitura seguinte falha', async () => {
    const nova = join(dir, 'sem-aba.xlsx')
    writeFileSync(nova, 'x')
    const degradado = storeOf(
      state({ state: 'degradado', lastReadOk: false, degradedReason: 'Aba "2026" nao existe.' }),
    )
    const app = buildServer(config(), degradado, [], undefined, async () => {}, configPath)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/config/workbook',
      payload: { path: nova },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      state: 'degradado',
      degradedReason: expect.any(String),
    })
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).workbookPath).toBe(nova)
    await app.close()
  })

  /**
   * A rota nao serializa — quem serializa e `reconfigureWorkbook`, no store,
   * onde a garantia importa: e la que uma reconfiguracao no meio de uma leitura
   * gravaria o estado do arquivo antigo por cima do novo. O teste dessa
   * exclusao esta em `tests/app/process-store.test.ts`. Aqui basta que as duas
   * requisicoes concluam e que a ordem de aplicacao siga a de chegada, para que
   * o arquivo gravado e o estado do store nao possam divergir.
   */
  it('aplica duas requisicoes concorrentes na ordem de chegada', async () => {
    const primeira = join(dir, 'primeira.xlsx')
    const segunda = join(dir, 'segunda.xlsx')
    writeFileSync(primeira, 'x')
    writeFileSync(segunda, 'x')

    const ordem: string[] = []
    const app = buildServer(
      config(),
      storeOf(state()),
      [],
      undefined,
      async (path) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        ordem.push(path)
      },
      configPath,
    )

    const respostas = await Promise.all([
      app.inject({ method: 'PUT', url: '/api/config/workbook', payload: { path: primeira } }),
      app.inject({ method: 'PUT', url: '/api/config/workbook', payload: { path: segunda } }),
    ])

    expect(respostas.map((r) => r.statusCode)).toEqual([200, 200])
    expect(ordem).toEqual([primeira, segunda])
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).workbookPath).toBe(segunda)
    await app.close()
  })
})
