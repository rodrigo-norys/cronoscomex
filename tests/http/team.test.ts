import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { normalizeTeamMap, type TeamMember } from '../../src/domain/team-mapper.ts'
import type { Process } from '../../src/domain/types.ts'
import { registerTeamRoutes } from '../../src/http/routes/team.ts'

/**
 * As quatro rotas do mapa de equipe (`H-91`) — contrato em
 * `docs/05-contratos-api.md`.
 *
 * **Nenhuma respeita os filtros globais**, pela mesma razao de `GET
 * /api/clients` (`D-32`, determinacao 2): o que elas servem e estado de
 * configuracao, e nao recorte.
 *
 * Os nomes sao ficticios — regra inviolavel 8.
 */

function process(overrides: Partial<Process> = {}): Process {
  return {
    sourceRow: 483,
    ref: 'FT533.26',
    clientRaw: 'AV-480',
    importerRaw: 'IMPORTADORA UM',
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
    importerKey: 'IMPORTADORA UM',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory: 'em_andamento',
    responsible: 'membro1',
    responsibleLabel: 'Primeiro',
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
    lastReadAt: new Date('2026-09-16T12:00:00.000Z'),
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

/**
 * O caminho do mapa e SEMPRE injetado: `saveTeamMember` recusa o padrao sob
 * `NODE_ENV=test`, e sem a injecao o teste reescreveria a equipe do operador
 * (regra inviolavel 7, medida em `H-28` e `H-34`).
 */
let directory: string
let mapPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-equipe-'))
  mapPath = join(directory, 'team-map.json')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

const equipe = (): TeamMember[] =>
  normalizeTeamMap([
    {
      key: 'membro1',
      label: 'Primeiro',
      importers: ['importadora um'],
    },
    {
      key: 'membro2',
      label: 'Segundo',
      importers: ['importadora quatro'],
    },
  ])

/** Grava o arquivo com a mesma equipe que a rota recebe em memoria. */
function comArquivo(members: TeamMember[] = equipe()): void {
  writeFileSync(
    mapPath,
    JSON.stringify({
      _origem: 'Fixture de teste.',
      version: 1,
      members: members.map((member) => ({
        key: member.key,
        label: member.label,
        importers: [...member.importers],
      })),
    }),
  )
}

function buildApp(
  initial: StoreState = state(),
  map: readonly TeamMember[] = equipe(),
  applyTeamMap?: (members: readonly TeamMember[]) => Promise<void>,
) {
  const store: StoreAccess = { getState: () => initial, reload: async () => undefined }
  const app = Fastify({ logger: false })
  registerTeamRoutes(app, store, map, mapPath, applyTeamMap)
  return app
}

describe('GET /api/team', () => {
  it('devolve carteiras, sem dono, proxima chave e as linhas sem importador', async () => {
    const app = buildApp(
      state({
        processes: [
          process({ ref: 'FT001.26' }),
          process({ ref: 'FT002.26', importerKey: 'MPA', responsible: '' }),
          process({ ref: 'FT003.26', importerKey: '', responsible: '' }),
        ],
      }),
    )

    const resposta = await app.inject({ method: 'GET', url: '/api/team' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({
      members: [
        { key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'], count: 1 },
        { key: 'membro2', label: 'Segundo', importers: ['IMPORTADORA QUATRO'], count: 0 },
      ],
      unassigned: [{ key: 'MPA', count: 1 }],
      nextKey: 'membro3',
      blankImporters: 1,
    })
  })

  it('recusa com 503 enquanto NUNCA houve leitura', async () => {
    // Carteira vazia aqui afirmaria que ninguem precisa de dono, que e o oposto
    // de "ainda nao se sabe" (regra inviolavel 3).
    const app = buildApp(state({ lastReadAt: null, processes: [] }))

    const resposta = await app.inject({ method: 'GET', url: '/api/team' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
  })

  it('NAO segue os filtros globais', async () => {
    // `D-32`, determinacao 2: seguindo o filtro, filtrar por um responsavel
    // faria os importadores sem dono sumirem da tela.
    const app = buildApp(state({ processes: [process({ importerKey: 'MPA', responsible: '' })] }))

    const resposta = await app.inject({ method: 'GET', url: '/api/team?responsible=membro1' })

    expect(resposta.json().unassigned).toEqual([{ key: 'MPA', count: 1 }])
  })
})

describe('PUT /api/team/:key', () => {
  it('cria o responsavel novo com 201, e grava no arquivo', async () => {
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro', importers: ['mpa'] },
    })

    expect(resposta.statusCode).toBe(201)
    expect(resposta.json()).toEqual({
      outcome: 'membro-criado',
      key: 'membro3',
      label: 'Terceiro',
      importers: ['MPA'],
    })

    const raw = JSON.parse(readFileSync(mapPath, 'utf-8')) as {
      members: { key: string; importers: string[] }[]
    }
    expect(raw.members.at(-1)).toMatchObject({ key: 'membro3', importers: ['MPA'] })
  })

  it('redefine o existente com 200, e a carteira vai INTEIRA', async () => {
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro1',
      payload: { label: 'Primeiro', importers: ['importadora um', 'mpa'] },
    })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toMatchObject({
      outcome: 'membro-redefinido',
      importers: ['IMPORTADORA UM', 'MPA'],
    })
  })

  it('aceita carteira vazia — `importers` ausente e legitimo', async () => {
    // Alguem entrou na equipe e ainda nao recebeu importador.
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro' },
    })

    expect(resposta.statusCode).toBe(201)
    expect(resposta.json().importers).toEqual([])
  })

  it('preserva `_origem` e os campos que a historia nao conhece', async () => {
    comArquivo()
    const app = buildApp()

    await app.inject({
      method: 'PUT',
      url: '/api/team/membro1',
      payload: { label: 'Primeiro', importers: ['mpa'] },
    })

    const raw = JSON.parse(readFileSync(mapPath, 'utf-8')) as Record<string, unknown>
    expect(raw._origem).toBe('Fixture de teste.')
  })

  it('recusa importador que ja esta em outra carteira, NOMEANDO o dono', async () => {
    // IND-20 conta por pessoa, e a soma deixaria de fechar com o total.
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro2',
      payload: { label: 'Segundo', importers: ['importadora um'] },
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('CORPO_INVALIDO')
    expect(resposta.json().error.message).toContain('Primeiro')
  })

  it('recusa a FILIAL de um importador que outro ja tem', async () => {
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro2',
      payload: { label: 'Segundo', importers: ['importadora um - sc'] },
    })

    expect(resposta.statusCode).toBe(400)
  })

  it('recusa `label` ausente', async () => {
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { importers: [] },
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.message).toContain('label')
  })

  it('recusa `importers` que nao e lista', async () => {
    const app = buildApp()

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro', importers: 'mpa' },
    })

    expect(resposta.statusCode).toBe(400)
  })

  it('recusa com 503 enquanto NUNCA houve leitura', async () => {
    const app = buildApp(state({ lastReadAt: null, processes: [] }))

    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro' },
    })

    expect(resposta.statusCode).toBe(503)
  })

  it('REPROJETA com a equipe nova, e nao so grava', async () => {
    // Sem isto a gravacao acontece e o campo Responsavel segue mostrando a
    // atribuicao antiga ate o reinicio — o defeito que `H-91` mediu no mapa de
    // clientes em 02/09/2026.
    comArquivo()
    // A assinatura e DECLARADA: sem ela `mock.calls` e uma tupla vazia, e o
    // `expect` sobre o primeiro argumento nao compila.
    const aplicado = vi.fn<(members: readonly TeamMember[]) => Promise<void>>(async () => undefined)
    const app = buildApp(state(), equipe(), aplicado)

    await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro', importers: ['mpa'] },
    })

    expect(aplicado).toHaveBeenCalledTimes(1)
    expect(aplicado.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'membro3' })]),
    )
  })

  it('planeja contra a carteira da gravacao ANTERIOR, e nao contra a da partida', async () => {
    // O parametro e um instantaneo: sem reatribuir `map`, a segunda edicao
    // seguida deixaria de enxergar o que a primeira gravou, e a sobreposicao
    // passaria despercebida.
    comArquivo()
    const app = buildApp()

    await app.inject({
      method: 'PUT',
      url: '/api/team/membro3',
      payload: { label: 'Terceiro', importers: ['mpa'] },
    })
    const segunda = await app.inject({
      method: 'PUT',
      url: '/api/team/membro2',
      payload: { label: 'Segundo', importers: ['mpa'] },
    })

    expect(segunda.statusCode).toBe(400)
    expect(segunda.json().error.message).toContain('Terceiro')
  })
})

describe('DELETE /api/team/:key', () => {
  it('desfaz o responsavel, apaga a entrada e diz o que foi liberado', async () => {
    comArquivo()
    const app = buildApp()

    const resposta = await app.inject({ method: 'DELETE', url: '/api/team/membro1' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({
      outcome: 'membro-desfeito',
      key: 'membro1',
      importer: null,
      released: ['IMPORTADORA UM'],
    })

    const raw = JSON.parse(readFileSync(mapPath, 'utf-8')) as { members: { key: string }[] }
    expect(raw.members.map((member) => member.key)).toEqual(['membro2'])
  })

  it('recusa com 404 responsavel inexistente', async () => {
    const app = buildApp()

    const resposta = await app.inject({ method: 'DELETE', url: '/api/team/membro9' })

    expect(resposta.statusCode).toBe(404)
    expect(resposta.json().error.code).toBe('MEMBRO_INEXISTENTE')
  })
})

describe('DELETE /api/team/:key/importers/:importer', () => {
  it('tira SO o importador pedido', async () => {
    comArquivo(
      normalizeTeamMap([
        {
          key: 'membro1',
          label: 'Primeiro',
          importers: ['importadora um', 'mpa'],
        },
      ]),
    )
    const app = buildApp(
      state(),
      normalizeTeamMap([
        {
          key: 'membro1',
          label: 'Primeiro',
          importers: ['importadora um', 'mpa'],
        },
      ]),
    )

    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/team/membro1/importers/MPA',
    })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({
      outcome: 'importador-removido',
      key: 'membro1',
      importer: 'MPA',
      released: ['MPA'],
    })

    const raw = JSON.parse(readFileSync(mapPath, 'utf-8')) as {
      members: { importers: string[] }[]
    }
    expect(raw.members[0]?.importers).toEqual(['IMPORTADORA UM'])
  })

  it('recusa com 404 importador fora daquela carteira', async () => {
    const app = buildApp()

    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/team/membro1/importers/MPA',
    })

    expect(resposta.statusCode).toBe(404)
    expect(resposta.json().error.code).toBe('IMPORTADOR_INEXISTENTE')
  })

  it('nao cria arquivo quando ele nao existe', async () => {
    // O `DELETE` sobre mapa que so existe em memoria e no-op no disco: criar o
    // arquivo aqui gravaria uma equipe que o operador nunca declarou.
    const app = buildApp()

    await app.inject({ method: 'DELETE', url: '/api/team/membro1' })

    expect(existsSync(mapPath)).toBe(false)
  })
})
