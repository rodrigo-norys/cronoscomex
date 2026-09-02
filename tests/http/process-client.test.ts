import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type ClientMap, loadClientMap } from '../../src/app/client-map-loader.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { type ClientMapEntry, normalizeClientMap } from '../../src/domain/client-mapper.ts'
import type { Process } from '../../src/domain/types.ts'
import { registerProcessClientRoute } from '../../src/http/routes/process-client.ts'

/**
 * `PUT /api/processes/:ref/client` — contrato em `docs/05-contratos-api.md §3`.
 *
 * **A unica rota de edicao que nao enfileira.** Ela grava a regra de
 * consolidacao em `client-map.json`, que e de onde a coluna Cliente ja lia — e
 * por isso o efeito e imediato e nao passa pelo `Aplicar alteracoes`.
 *
 * O caminho do mapa e sempre injetado: `saveClientRule` RECUSA o padrao sob
 * `NODE_ENV=test`, e sem a injecao o teste reescreveria o arquivo do operador
 * (regra inviolavel 7, medido em `H-34`).
 */

let directory: string
let mapPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-cliente-'))
  mapPath = join(directory, 'client-map.json')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function process(overrides: Partial<Process> = {}): Process {
  return {
    sourceRow: 483,
    ref: 'FT533.26',
    clientRaw: 'AV-480',
    importerRaw: 'JLX',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: '',
    statusRaw: 'EM ANDAMENTO',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: 'AV-480',
    clientProcessKey: 'AV-480',
    clientLabel: 'AV-480',
    clientGroupKey: '',
    importerKey: 'JLX',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory: 'em_andamento',
    responsible: 'indefinido',
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
    customsChannel: 'indefinido',
    importerOutsideRj: false,
    styleKey: 'argb:FF00FF00',
    anomalies: [],
    ...overrides,
  }
}

function state(overrides: Partial<StoreState> = {}): StoreState {
  return {
    state: 'pronto',
    processes: [process()],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-09-02T12:00:00.000Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 1,
    rowsAccepted: 1,
    rowsQuarantined: 0,
    externalLock: false,
    conflictFiles: [],
    pendingEdits: [],
    ...overrides,
  }
}

const aplicados: ClientMap[] = []

function buildApp(initial: StoreState = state(), map: readonly ClientMapEntry[] = []) {
  const store: StoreAccess = { getState: () => initial, reload: async () => undefined }
  const app = Fastify({ logger: false })
  registerProcessClientRoute(app, store, map, mapPath, async (next) => {
    aplicados.push(next)
  })
  return app
}

async function declarar(
  app: ReturnType<typeof buildApp>,
  payload: Record<string, unknown>,
  ref = 'FT533.26',
) {
  return await app.inject({ method: 'PUT', url: `/api/processes/${ref}/client`, payload })
}

beforeEach(() => {
  aplicados.length = 0
})

describe('PUT /api/processes/:ref/client', () => {
  it('cria a entrada e grava a regra que casa a celula', async () => {
    const response = await declarar(buildApp(), { label: 'Aventura' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      outcome: 'entrada-nova',
      key: 'AVENTURA',
      label: 'Aventura',
      value: 'AV-480',
    })
    expect(loadClientMap(mapPath).clients).toEqual([
      { key: 'AVENTURA', label: 'Aventura', rules: [{ match: 'exact', value: 'AV-480' }] },
    ])
  })

  /**
   * O alcance e UMA linha, por construcao: a regra e `exact` sobre o valor da
   * celula. Inferir o prefixo a partir de uma linha seria adivinhar, e a
   * planilha real tem um prefixo que cobre TRES clientes (regra inviolavel 3).
   */
  it('nao alcanca as outras linhas do mesmo prefixo', async () => {
    await declarar(buildApp(), { label: 'Aventura' })

    const regras = loadClientMap(mapPath).clients[0]?.rules ?? []
    expect(regras.every((regra) => regra.match === 'exact')).toBe(true)
    expect(regras.map((regra) => regra.value)).toEqual(['AV-480'])
  })

  it('reprojeta com o mapa novo, e nao so grava', async () => {
    await declarar(buildApp(), { label: 'Aventura' })

    expect(aplicados).toHaveLength(1)
    expect(aplicados[0]?.clients.map((entry) => entry.key)).toEqual(['AVENTURA'])
  })

  /** Declarar de novo o cliente que a celula ja resolve nao mexe no arquivo. */
  it('responde sem-efeito e nao grava quando ja resolvia assim', async () => {
    const map = normalizeClientMap([
      { key: 'aventura', label: 'Aventura', rules: [{ match: 'prefix', value: 'av-' }] },
    ])

    const response = await declarar(buildApp(state(), map), { label: 'Aventura' })

    expect(response.json().outcome).toBe('sem-efeito')
    expect(existsSync(mapPath)).toBe(false)
    expect(aplicados).toHaveLength(0)
  })

  /**
   * A entrada nova precisa ser consultada ANTES da que casa hoje: a primeira que
   * casa vence, e uma regra atras dela nunca seria alcancada — a edicao viraria
   * um no-op silencioso (regra inviolavel 2).
   */
  it('poe a entrada nova antes da que ja casava a celula', async () => {
    const map = normalizeClientMap([
      { key: 'grupo av', label: 'Grupo AV', rules: [{ match: 'prefix', value: 'av-' }] },
    ])
    writeFileSync(
      mapPath,
      JSON.stringify({
        version: 1,
        clients: [
          { key: 'grupo av', label: 'Grupo AV', rules: [{ match: 'prefix', value: 'av-' }] },
        ],
      }),
    )

    await declarar(buildApp(state(), map), { label: 'Aventura' })

    expect(loadClientMap(mapPath).clients.map((entry) => entry.key)).toEqual([
      'AVENTURA',
      'GRUPO AV',
    ])
  })

  it('recusa rotulo vazio e celula CLT vazia, com mensagens distintas', async () => {
    const vazio = await declarar(buildApp(), { label: '   ' })
    const semCelula = await declarar(
      buildApp(state({ processes: [process({ clientProcessKey: '', clientRaw: '' })] })),
      { label: 'Aventura' },
    )

    expect(vazio.statusCode).toBe(400)
    expect(vazio.json().error.message).toContain('nome do cliente')
    expect(semCelula.statusCode).toBe(400)
    expect(semCelula.json().error.message).toContain('Processo do cliente')
  })

  it('recusa corpo sem label e REF inexistente', async () => {
    expect((await declarar(buildApp(), {})).statusCode).toBe(400)
    expect((await declarar(buildApp(), { label: 'X' }, 'FT999.26')).statusCode).toBe(404)
  })

  it('responde 503 quando nunca houve leitura', async () => {
    const app = buildApp(state({ lastReadAt: null, processes: [] }))

    const response = await declarar(app, { label: 'Aventura' })

    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
  })

  /** As chaves de comentario do arquivo do operador sobrevivem a gravacao. */
  it('preserva o que o arquivo ja tinha', async () => {
    writeFileSync(
      mapPath,
      JSON.stringify({ version: 1, _origem: 'escrito a mao', clients: [], groups: [] }),
    )

    await declarar(buildApp(), { label: 'Aventura' })

    expect(JSON.parse(readFileSync(mapPath, 'utf-8'))._origem).toBe('escrito a mao')
  })
})
