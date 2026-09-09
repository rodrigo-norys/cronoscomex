import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type { ClientGroup, ClientMapEntry } from '../../src/domain/client-mapper.ts'
import type { Process } from '../../src/domain/types.ts'
import { registerClientsRoutes } from '../../src/http/routes/clients.ts'

/**
 * `GET /api/clients/pending` — contrato em `docs/05-contratos-api.md`.
 *
 * **A unica rota de leitura que NAO respeita os filtros globais** (`D-32`,
 * determinacao 2): divida de configuracao nao e recorte, e seguir o filtro faria
 * a divida sumir da tela.
 */

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
    lastReadAt: new Date('2026-09-08T12:00:00.000Z'),
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
 * O caminho do mapa e SEMPRE injetado: `saveClientRule` recusa o padrao sob
 * `NODE_ENV=test`, e sem a injecao o teste reescreveria o arquivo do operador
 * (regra inviolavel 7, medido em `H-34`).
 */
let directory: string
let mapPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-clientes-'))
  mapPath = join(directory, 'client-map.json')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function buildApp(
  initial: StoreState = state(),
  map: readonly ClientMapEntry[] = [],
  groups: readonly ClientGroup[] = [],
) {
  const store: StoreAccess = { getState: () => initial, reload: async () => undefined }
  const app = Fastify({ logger: false })
  registerClientsRoutes(app, store, map, groups, mapPath)
  return app
}

/** As cinco grafias do exemplo do prefixo: dois `Y`, dois `YT` e um `D`. */
function frota(): Process[] {
  return [
    process({ ref: 'FT001.26', clientProcessKey: 'Y2601', clientRaw: 'Y2601' }),
    process({ ref: 'FT002.26', clientProcessKey: 'Y2602', clientRaw: 'Y2602' }),
    process({ ref: 'FT003.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
    process({ ref: 'FT004.26', clientProcessKey: 'YT-777', clientRaw: 'YT-777' }),
    process({ ref: 'FT005.26', clientProcessKey: 'D2530', clientRaw: 'D2530' }),
  ]
}

describe('GET /api/clients', () => {
  it('devolve as grafias sem regra, com grafia, contagem e REF de exemplo', async () => {
    const app = buildApp(
      state({
        processes: [
          process({ ref: 'FT001.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
          process({ ref: 'FT002.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
        ],
      }),
    )

    const resposta = await app.inject({ method: 'GET', url: '/api/clients' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({
      items: [
        {
          key: 'YT-769',
          label: 'YT-769',
          count: 2,
          samples: ['FT001.26', 'FT002.26'],
          client: null,
          parent: null,
        },
      ],
      total: 1,
      declared: [],
      names: [],
    })
  })

  /** A lista traz o declarado tambem: sem isso, agrupar `AV` seria impossivel
      pela tela, porque ele some da relacao de pendentes. */
  it('traz tambem a grafia que o mapa ja casa, dizendo de quem ela e', async () => {
    const mapa: ClientMapEntry[] = [
      { key: 'ALFA', label: 'Alfa', rules: [{ match: 'exact', value: 'AV-480' }] },
    ]
    const app = buildApp(state(), mapa)

    const corpo = (await app.inject({ method: 'GET', url: '/api/clients' })).json()

    expect(corpo.total).toBe(1)
    expect(corpo.items[0].client).toEqual({ key: 'ALFA', label: 'Alfa' })
  })

  it('diz qual e o pai, quando o cliente da grafia esta num grupo', async () => {
    const mapa: ClientMapEntry[] = [
      { key: 'ALFA', label: 'Alfa', rules: [{ match: 'exact', value: 'AV-480' }] },
    ]
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'ALFA' }] },
    ]
    const app = buildApp(state(), mapa, grupos)

    const corpo = (await app.inject({ method: 'GET', url: '/api/clients' })).json()

    expect(corpo.items[0].parent).toEqual({ key: 'VIVI-GRUPO', label: 'Vivi' })
  })

  /**
   * O campo de declaracao oferece os nomes existentes — e foi a falta disso que
   * criou um cliente `VIVI` ao lado do pai `Vivi` em 08/09/2026.
   */
  it('serve os nomes que o campo sugere, com o pai marcado', async () => {
    const mapa: ClientMapEntry[] = [
      { key: 'ALFA', label: 'Alfa', rules: [{ match: 'exact', value: 'AV-480' }] },
      { key: 'DENNIS', label: 'Dennis', rules: [{ match: 'contains', value: 'DENNIS' }] },
    ]
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'ALFA' }] },
    ]
    const app = buildApp(state(), mapa, grupos)

    const corpo = (await app.inject({ method: 'GET', url: '/api/clients' })).json()

    expect(corpo.names).toEqual([
      { key: 'DENNIS', label: 'Dennis', isParent: false, children: 0 },
      { key: 'VIVI-GRUPO', label: 'Vivi', isParent: true, children: 1 },
    ])
  })

  /**
   * `D-32`, determinacao 2. A query e ignorada de proposito — e a unica rota de
   * leitura da aplicacao em que isso vale.
   */
  it('ignora os filtros globais: a divida nao e recorte', async () => {
    const app = buildApp(
      state({
        processes: [
          process({ ref: 'FT001.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
          process({
            ref: 'FT002.26',
            clientProcessKey: 'D2530',
            clientRaw: 'D2530',
            goodsKey: 'BAZAR',
          }),
        ],
      }),
    )

    const semFiltro = await app.inject({ method: 'GET', url: '/api/clients' })
    const comFiltro = await app.inject({
      method: 'GET',
      url: '/api/clients?goods=BAZAR&client=NAO-EXISTE',
    })

    expect(comFiltro.json()).toEqual(semFiltro.json())
    expect(comFiltro.json().total).toBe(2)
  })

  it('nao conta processo sem CLT', async () => {
    const app = buildApp(state({ processes: [process({ clientProcessKey: '', clientRaw: '' })] }))

    expect((await app.inject({ method: 'GET', url: '/api/clients' })).json()).toEqual({
      items: [],
      total: 0,
      declared: [],
      names: [],
    })
  })

  /** Lista vazia afirmaria que nao falta declarar nada (regra inviolavel 3). */
  it('responde 503 enquanto nunca houve leitura', async () => {
    const app = buildApp(state({ lastReadAt: null, degradedReason: 'A planilha sumiu.' }))

    const resposta = await app.inject({ method: 'GET', url: '/api/clients' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
  })
})

describe('GET /api/clients/preview', () => {
  it('conta o que o prefixo passaria a consolidar', async () => {
    const app = buildApp(state({ processes: frota() }))

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/clients/preview?match=prefix&value=Y',
    })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toMatchObject({
      match: 'prefix',
      value: 'Y',
      keys: 4,
      processes: 4,
      alreadyMapped: [],
    })
  })

  /** `Y` casa `YT-769`, e `YT` ja tem dono: elas aparecem, e nao entram na conta. */
  it('separa as grafias que ja tem dono', async () => {
    const mapa: ClientMapEntry[] = [
      { key: 'BETA', label: 'Beta', rules: [{ match: 'prefix', value: 'YT' }] },
    ]
    const app = buildApp(state({ processes: frota() }), mapa)

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/clients/preview?match=prefix&value=Y',
    })

    expect(resposta.json().keys).toBe(2)
    expect(resposta.json().alreadyMapped.map((item: { key: string }) => item.key)).toEqual([
      'YT-769',
      'YT-777',
    ])
  })

  it('recusa match fora da lista e value ausente', async () => {
    const app = buildApp()

    const semMatch = await app.inject({
      method: 'GET',
      url: '/api/clients/preview?match=regex&value=Y',
    })
    const semValor = await app.inject({ method: 'GET', url: '/api/clients/preview?match=prefix' })

    expect(semMatch.statusCode).toBe(400)
    expect(semMatch.json().error.code).toBe('FILTRO_INVALIDO')
    expect(semValor.statusCode).toBe(400)
  })
})

describe('POST /api/clients/rules', () => {
  it('grava a regra de prefixo e devolve o que foi feito', async () => {
    const app = buildApp(state({ processes: frota() }))

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'prefix', value: 'D', label: 'Cliente D' },
    })

    expect(resposta.statusCode).toBe(201)
    expect(resposta.json()).toEqual({
      outcome: 'entrada-nova',
      key: 'CLIENTE D',
      label: 'Cliente D',
      value: 'D',
      match: 'prefix',
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.clients[0].rules).toEqual([{ match: 'prefix', value: 'D' }])
  })

  /**
   * O `match` era `exact` fixo na gravacao ate `H-88`: declarar um prefixo
   * gravava uma regra que casa UMA grafia, silenciosamente inutil para quem
   * acabou de ver a previsao de quatro.
   */
  it('grava o match que o operador escolheu, e nao `exact` fixo', async () => {
    const app = buildApp(state({ processes: frota() }))

    await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'contains', value: '26', label: 'Cliente' },
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.clients[0].rules[0].match).toBe('contains')
  })

  it('recusa rotulo vazio e valor vazio com mensagem do operador', async () => {
    const app = buildApp()

    const semRotulo = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'prefix', value: 'D', label: '   ' },
    })
    const semValor = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'prefix', value: '', label: 'Cliente' },
    })

    expect(semRotulo.statusCode).toBe(400)
    expect(semRotulo.json().error.message).toBe('Informe o nome do cliente.')
    expect(semValor.statusCode).toBe(400)
    expect(semValor.json().error.message).toMatch(/valor que a regra deve casar/)
  })

  it('recusa declarar num nome que ja e filho, com a saida no texto', async () => {
    const mapa: ClientMapEntry[] = [
      { key: 'AV', label: 'AV', rules: [{ match: 'prefix', value: 'AV' }] },
    ]
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }] },
    ]
    const app = buildApp(state({ processes: frota() }), mapa, grupos)

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'prefix', value: 'D', label: 'AV' },
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.message).toMatch(/Declare no nome de cima/)
  })

  it('recusa match fora da lista', async () => {
    const app = buildApp()

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'regex', value: 'D', label: 'Cliente' },
    })

    expect(resposta.statusCode).toBe(400)
    expect(resposta.json().error.code).toBe('CORPO_INVALIDO')
  })

  /**
   * **O SEGUNDO conjunto no mesmo nome faz nascer o pai** (determinacao 8).
   *
   * Ate 08/09/2026 isto somava a regra ao cliente. O usuario descreveu outro
   * comportamento ao usar a tela, e este teste e o que o fixa: o cliente que
   * existia vira filho com o nome do valor dele, e o novo entra como irmao.
   */
  it('o segundo conjunto no mesmo nome cria o pai, com os dois por filhos', async () => {
    const app = buildApp(state({ processes: frota() }))

    await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'exact', value: 'Y2601', label: 'Vivi' },
    })
    const segunda = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'exact', value: 'Y2602', label: 'Vivi' },
    })

    expect(segunda.json().outcome).toBe('grupo-criado')

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.clients).toEqual([
      { key: 'Y2601', label: 'Y2601', rules: [{ match: 'exact', value: 'Y2601' }] },
      { key: 'Y2602', label: 'Y2602', rules: [{ match: 'exact', value: 'Y2602' }] },
    ])
    expect(gravado.groups).toEqual([
      { key: 'VIVI', label: 'Vivi', members: [{ client: 'Y2601' }, { client: 'Y2602' }] },
    ])
  })

  /** O TERCEIRO entra no pai que ja existe, sem converter nada de novo. */
  it('o terceiro conjunto entra como mais um filho', async () => {
    const app = buildApp(state({ processes: frota() }))

    for (const value of ['Y2601', 'Y2602', 'D2530']) {
      await app.inject({
        method: 'POST',
        url: '/api/clients/rules',
        payload: { match: 'exact', value, label: 'Vivi' },
      })
    }

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.groups[0].members).toEqual([
      { client: 'Y2601' },
      { client: 'Y2602' },
      { client: 'D2530' },
    ])
  })

  /**
   * A REGRA normaliza, o ROTULO nao: quem digita "Kelly" ve "Kelly" declarado.
   * Medido no mapa real em 09/09/2026, onde a entrada trocou de `label: 'Kelly'`
   * para `label: 'KELLY'` ao ser redeclarada.
   */
  it('grava a grafia digitada como rotulo do cliente', async () => {
    const app = buildApp(state({ processes: frota() }))

    await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'contains', value: 'Kelly', label: 'Kelly' },
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.clients[0]).toMatchObject({
      key: 'KELLY',
      label: 'Kelly',
      rules: [{ match: 'contains', value: 'KELLY' }],
    })
  })

  /** O valor digitado entra normalizado: `yt` e `YT` sao a mesma regra. */
  it('grava o valor normalizado, em qualquer caixa que o operador digite', async () => {
    const app = buildApp(state({ processes: frota() }))

    await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'contains', value: '  yt  ', label: 'Vivi' },
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.clients[0].rules[0].value).toBe('YT')
  })

  it('responde 503 enquanto nunca houve leitura', async () => {
    const app = buildApp(state({ lastReadAt: null, degradedReason: 'A planilha sumiu.' }))

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/clients/rules',
      payload: { match: 'prefix', value: 'D', label: 'Cliente' },
    })

    expect(resposta.statusCode).toBe(503)
  })
})

/**
 * As duas remocoes (`H-88`, determinacao 9).
 *
 * **Nenhuma apaga cliente**: sai o vinculo com o pai, e as regras ficam. O
 * cliente volta ao ranking com a contagem que sempre teve.
 */
describe('DELETE /api/clients/groups', () => {
  const MAPA: ClientMapEntry[] = [
    { key: 'AV', label: 'AV', rules: [{ match: 'prefix', value: 'AV' }] },
    { key: 'CHUN', label: 'Chun', rules: [{ match: 'prefix', value: 'CHUN' }] },
    { key: 'KELLY', label: 'Kelly', rules: [{ match: 'prefix', value: 'KELLY' }] },
  ]

  function comGrupo(membros: string[]): ClientGroup[] {
    return [{ key: 'VIVI-GRUPO', label: 'Vivi', members: membros.map((client) => ({ client })) }]
  }

  function escreverMapa(membros: string[]): void {
    writeFileSync(
      mapPath,
      JSON.stringify({
        version: 1,
        clients: MAPA,
        groups: [
          { key: 'VIVI-GRUPO', label: 'Vivi', members: membros.map((client) => ({ client })) },
        ],
      }),
    )
  }

  it('tira o filho do pai e apaga a declaracao dele', async () => {
    escreverMapa(['AV', 'CHUN', 'KELLY'])
    const app = buildApp(state(), MAPA, comGrupo(['AV', 'CHUN', 'KELLY']))

    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/clients/groups/VIVI-GRUPO/members/KELLY',
    })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({
      outcome: 'membro-removido',
      key: 'VIVI-GRUPO',
      client: 'KELLY',
      removed: ['KELLY'],
      dissolved: false,
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.groups[0].members).toEqual([{ client: 'AV' }, { client: 'CHUN' }])
    // A declaracao sai JUNTO desde 08/09/2026: as grafias de `KELLY` voltam a
    // ficar sem cliente, e a lista da esquerda as recebe de volta.
    expect(gravado.clients.map((entry: { key: string }) => entry.key)).toEqual(['AV', 'CHUN'])
  })

  /**
   * Arvore de um galho e ruido: o ranking mostraria o mesmo numero duas vezes,
   * indentado uma nele. Tirando o penultimo, o pai deixa de existir.
   */
  it('desfaz o pai quando a saida o deixaria com um filho so', async () => {
    escreverMapa(['AV', 'CHUN'])
    const app = buildApp(state(), MAPA, comGrupo(['AV', 'CHUN']))

    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/clients/groups/VIVI-GRUPO/members/CHUN',
    })

    expect(resposta.json().dissolved).toBe(true)

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.groups).toEqual([])
    // `CHUN` sai; `AV` sobra — quem sobra nao foi pedido, e nao e apagado.
    expect(gravado.clients.map((entry: { key: string }) => entry.key)).toEqual(['AV', 'KELLY'])
  })

  it('desfaz o pai inteiro e apaga as declaracoes dos filhos', async () => {
    escreverMapa(['AV', 'CHUN', 'KELLY'])
    const app = buildApp(state(), MAPA, comGrupo(['AV', 'CHUN', 'KELLY']))

    const resposta = await app.inject({ method: 'DELETE', url: '/api/clients/groups/VIVI-GRUPO' })

    expect(resposta.json()).toEqual({
      outcome: 'grupo-desfeito',
      key: 'VIVI-GRUPO',
      client: null,
      removed: ['AV', 'CHUN', 'KELLY'],
      dissolved: true,
    })

    const gravado = JSON.parse(readFileSync(mapPath, 'utf-8'))
    expect(gravado.groups).toEqual([])
    // As tres declaracoes vao junto: 380 grafias voltam para a esquerda.
    expect(gravado.clients).toEqual([])
  })

  it('recusa agrupamento e membro que nao existem', async () => {
    escreverMapa(['AV', 'CHUN', 'KELLY'])
    const app = buildApp(state(), MAPA, comGrupo(['AV', 'CHUN', 'KELLY']))

    const semGrupo = await app.inject({ method: 'DELETE', url: '/api/clients/groups/NAO-EXISTE' })
    const semMembro = await app.inject({
      method: 'DELETE',
      url: '/api/clients/groups/VIVI-GRUPO/members/NAO-EXISTE',
    })

    expect(semGrupo.statusCode).toBe(404)
    expect(semGrupo.json().error.code).toBe('GRUPO_INEXISTENTE')
    expect(semMembro.statusCode).toBe(404)
    expect(semMembro.json().error.code).toBe('MEMBRO_INEXISTENTE')
  })
})
