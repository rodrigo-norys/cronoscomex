import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { normalizeClientGroups } from '../../src/domain/client-mapper.ts'
import { normalizeTeamMap } from '../../src/domain/team-mapper.ts'
import type {
  ColorResponsible,
  CustomsChannel,
  Process,
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
  clientProcessKey?: string
  clientLabel?: string
  clientGroupKey?: string
  clientRaw?: string
  goodsKey?: string
  goodsRaw?: string
  portKey?: string
  portRaw?: string
  statusCategory?: StatusCategory
  responsible?: string
  responsibleLabel?: string
  colorResponsible?: ColorResponsible
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
    goodsRaw: fields.goodsRaw ?? '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: fields.eta2 ?? null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: fields.clientKey ?? '',
    clientProcessKey: fields.clientProcessKey ?? fields.clientKey ?? '',
    clientLabel: fields.clientLabel ?? fields.clientRaw ?? '',
    clientGroupKey: fields.clientGroupKey ?? '',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: fields.portKey ?? '',
    goodsKey: fields.goodsKey ?? '',
    statusCategory: fields.statusCategory ?? 'em_andamento',
    responsible: fields.responsible ?? 'indefinido',
    responsibleLabel: fields.responsibleLabel ?? 'Indefinido',
    colorResponsible: fields.colorResponsible ?? 'indefinido',
    customsChannel: fields.customsChannel ?? 'indefinido',
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
    pendingEdits: [],
  }
}

const fakeStore = (initial: StoreState): StoreAccess => ({
  getState: () => initial,
  reload: async () => undefined,
})

describe('GET /api/filters/options', () => {
  it('devolve os doze blocos do contrato', async () => {
    const app = buildServer(config, fakeStore(state()))

    const resposta = await app.inject({ method: 'GET', url: '/api/filters/options' })

    expect(resposta.statusCode).toBe(200)
    expect(Object.keys(resposta.json()).sort()).toEqual([
      'agents',
      'categories',
      'channels',
      'clientGroups',
      'clientProcesses',
      'clients',
      'colorResponsible',
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
      process({ clientKey: 'BETA', clientRaw: 'Beta' }),
    ]
    const app = buildServer(config, fakeStore(state(processes)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clients).toEqual([
      { key: 'ACME', label: 'Acme', count: 2 },
      { key: 'BETA', label: 'Beta', count: 1 },
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

  // Sem mapa de equipe o dominio de `responsible` e o das cores — `D-23`.
  it('devolve os quatro responsaveis e os tres canais, com rotulo em pt-br', async () => {
    const app = buildServer(
      config,
      fakeStore(
        state([process({ responsible: 'colaborador1', colorResponsible: 'colaborador1' })]),
      ),
    )

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

  /**
   * `H-50`. Com mapa de equipe as opcoes sao as PESSOAS, mais a chave vazia —
   * e a cor ganha bloco proprio, que continua fechado nas quatro chaves.
   */
  describe('responsavel e cor do responsavel (H-50)', () => {
    const equipe = normalizeTeamMap([
      { key: 'membro1', label: 'Primeiro', importers: ['importadora um'], colorResponsible: [] },
      { key: 'membro2', label: 'Segundo', importers: ['importadora dois'], colorResponsible: [] },
    ])
    const comEquipe = (processes: Process[]) =>
      buildServer(
        config,
        fakeStore(state(processes)),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        equipe,
      )

    it('oferece as pessoas do mapa e a chave sem responsavel', async () => {
      const app = comEquipe([
        process({ responsible: 'membro1', responsibleLabel: 'Primeiro' }),
        process({ responsible: '', responsibleLabel: '' }),
      ])

      const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

      expect(body.responsible).toEqual([
        { key: 'membro1', label: 'Primeiro', count: 1 },
        // O caso-limite de `H-50`: pessoa do mapa sem processo algum aparece
        // com zero, pela mesma razao de A-28.
        { key: 'membro2', label: 'Segundo', count: 0 },
        { key: '', label: 'Sem responsável', count: 1 },
      ])

      await app.close()
    })

    it('serve a cor do responsavel em bloco proprio, com as quatro chaves', async () => {
      const app = comEquipe([process({ responsible: 'membro1', colorResponsible: 'colaborador2' })])

      const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

      expect(body.colorResponsible).toHaveLength(4)
      expect(body.colorResponsible).toContainEqual({
        key: 'colaborador2',
        label: 'Colaborador 2',
        count: 1,
      })

      await app.close()
    })

    // Os dois filtros sao independentes: E entre parametros distintos.
    it('recorta por pessoa e por cor sem que um implique o outro', async () => {
      const app = comEquipe([
        process({ responsible: 'membro1', colorResponsible: 'colaborador1' }),
        process({ responsible: 'membro2', colorResponsible: 'colaborador1' }),
      ])

      const porPessoa = (
        await app.inject({ method: 'GET', url: '/api/indicators?responsible=membro1' })
      ).json()
      const porCor = (
        await app.inject({ method: 'GET', url: '/api/indicators?colorResponsible=colaborador1' })
      ).json()

      expect(porPessoa.counts.total).toBe(1)
      expect(porCor.counts.total).toBe(2)

      await app.close()
    })

    // `H-50` abriu o dominio: chave desconhecida devolve conjunto vazio com
    // 200, e nao mais `400 FILTRO_INVALIDO`.
    it('aceita chave de responsavel desconhecida com 200 e conjunto vazio', async () => {
      const app = comEquipe([process({ responsible: 'membro1' })])

      const resposta = await app.inject({
        method: 'GET',
        url: '/api/indicators?responsible=ninguem',
      })

      expect(resposta.statusCode).toBe(200)
      expect(resposta.json().counts.total).toBe(0)

      await app.close()
    })

    it('recusa cor de responsavel fora do dominio', async () => {
      const app = comEquipe([process({})])

      const resposta = await app.inject({
        method: 'GET',
        url: '/api/indicators?colorResponsible=roxo',
      })

      expect(resposta.statusCode).toBe(400)

      await app.close()
    })
  })

  /**
   * `H-51` trocou o dominio: `nenhum` saiu e `verde` entrou. A opcao que a barra
   * de filtros deixou de oferecer nao pode reaparecer aqui — e por `fixedOptions`
   * derivar de `CUSTOMS_CHANNELS`, uma so mudanca de dominio move os dois lados.
   */
  it('oferece verde e nao oferece mais o canal `nenhum` (H-51)', async () => {
    const app = buildServer(config, fakeStore(state([process({ customsChannel: 'verde' })])))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()
    const chaves = body.channels.map((o: { key: string }) => o.key)

    expect(chaves).toEqual(['verde', 'vermelho', 'indefinido'])
    expect(chaves).not.toContain('nenhum')
  })

  // A-28: chave zerada nao se esconde. Sem processo verde, a opcao continua na
  // lista com zero — esconde-la faria o filtro parecer completo quando nao e.
  it('mantem o canal verde na lista mesmo sem nenhum processo verde', async () => {
    const app = buildServer(config, fakeStore(state([process({ customsChannel: 'indefinido' })])))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()
    const verde = body.channels.find((o: { key: string }) => o.key === 'verde')

    expect(verde).toEqual({ key: 'verde', label: 'Canal Verde', count: 0 })
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
    process({ clientKey: 'BETA', statusCategory: 'em_andamento' }),
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
      await app.inject({ method: 'GET', url: '/api/indicators?client=ACME&client=BETA' })
    ).json()

    expect(body.counts.total).toBe(3)

    await app.close()
  })

  // RF-18: todo alerta respeita os filtros ativos, como os indicadores.
  it('GET /api/alerts respeita os filtros', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const semFiltro = (await app.inject({ method: 'GET', url: '/api/alerts' })).json()
    const comFiltro = (await app.inject({ method: 'GET', url: '/api/alerts?client=BETA' })).json()

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

  /**
   * A chave vazia e o unico valor que `optionsOf` oferece e a query precisava
   * carregar de volta. Ate `H-18` ela era descartada aqui, entre a URL e o
   * `applyFilters`: o operador marcava "(em branco)" e recebia a base inteira,
   * sem erro nem aviso. Este e o teste da ponta a ponta — o do dominio prova a
   * regra, este prova que a rota nao a desfaz.
   */
  it('filtra pela chave vazia, que e valor e nao ausencia', async () => {
    const comEsemMercadoria = [
      process({ goodsKey: 'BAZAR', goodsRaw: 'BAZAR' }),
      process({ goodsKey: '' }),
      process({ goodsKey: '' }),
    ]
    const app = buildServer(config, fakeStore(state(comEsemMercadoria)))

    const semFiltro = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
    const emBranco = (await app.inject({ method: 'GET', url: '/api/indicators?goods=' })).json()

    expect(semFiltro.counts.total).toBe(3)
    expect(emBranco.counts.total).toBe(2)

    await app.close()
  })

  it('nao confunde parametro vazio com parametro ausente', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const ausente = (await app.inject({ method: 'GET', url: '/api/processes' })).json()
    const vazio = (await app.inject({ method: 'GET', url: '/api/processes?client=' })).json()

    expect(ausente.total).toBe(3)
    expect(vazio.total).toBe(0)

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

/**
 * `H-49`. Os dois blocos respondem perguntas distintas: `clients` diz de quem e
 * a carteira, `clientProcesses` diz qual processo daquele cliente e este.
 */
describe('GET /api/filters/options — cliente consolidado e processo do cliente', () => {
  const consolidados = [
    process({
      clientKey: 'ACME',
      clientLabel: 'Acme Comércio',
      clientProcessKey: 'ACM-29',
      clientRaw: 'ACM-29',
    }),
    process({
      clientKey: 'ACME',
      clientLabel: 'Acme Comércio',
      clientProcessKey: 'ACM-30',
      clientRaw: 'ACM-30',
    }),
    process({
      clientKey: 'ZETA',
      clientLabel: 'zeta comércio',
      clientProcessKey: 'ZETA',
      clientRaw: 'zeta comércio',
    }),
  ]

  it('agrupa os clientes pela chave consolidada, com o rotulo do mapa', async () => {
    const app = buildServer(config, fakeStore(state(consolidados)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clients).toEqual([
      { key: 'ACME', label: 'Acme Comércio', count: 2 },
      // Sem regra no mapa, o rotulo e a primeira grafia da celula (A-26).
      { key: 'ZETA', label: 'zeta comércio', count: 1 },
    ])

    await app.close()
  })

  it('serve os valores de celula com a contagem propria', async () => {
    const app = buildServer(config, fakeStore(state(consolidados)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clientProcesses).toEqual([
      { key: 'ACM-29', label: 'ACM-29', count: 1 },
      { key: 'ACM-30', label: 'ACM-30', count: 1 },
      { key: 'ZETA', label: 'zeta comércio', count: 1 },
    ])

    await app.close()
  })
})

/**
 * `H-55`. A arvore do filtro Cliente: o grupo com a soma, cada membro com a
 * contagem propria.
 */
describe('GET /api/filters/options — grupos de clientes', () => {
  const GRUPOS = normalizeClientGroups([
    {
      key: 'grupo-um',
      label: 'Grupo Um',
      members: [
        { client: 'ACME', label: 'Matriz' },
        { client: 'BETA' },
        { client: 'SEM-PROCESSO' },
      ],
    },
  ])

  const conjunto = [
    process({ clientKey: 'ACME', clientLabel: 'Acme Comércio', clientGroupKey: 'GRUPO-UM' }),
    process({ clientKey: 'ACME', clientLabel: 'Acme Comércio', clientGroupKey: 'GRUPO-UM' }),
    process({ clientKey: 'BETA', clientLabel: 'Beta Ltda', clientGroupKey: 'GRUPO-UM' }),
    process({ clientKey: 'ZETA', clientLabel: 'Zeta', clientGroupKey: '' }),
  ]

  const servir = () =>
    buildServer(
      config,
      fakeStore(state(conjunto)),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      GRUPOS,
    )

  it('serve o grupo com a soma dos membros e cada membro com a contagem propria', async () => {
    const app = servir()

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clientGroups).toEqual([
      {
        key: 'GRUPO-UM',
        label: 'Grupo Um',
        count: 3,
        members: [
          // O `label` do membro vence o do cliente: e o que distingue o cliente
          // que da nome ao grupo do grupo em si.
          { key: 'ACME', label: 'Matriz', count: 2 },
          { key: 'BETA', label: 'Beta Ltda', count: 1 },
          // Declarado no mapa e sem processo nenhum: aparece com zero (A-28).
          { key: 'SEM-PROCESSO', label: 'SEM-PROCESSO', count: 0 },
        ],
      },
    ])

    await app.close()
  })

  it('mantem os membros tambem na lista de clientes, que e o dominio do filtro', async () => {
    const app = servir()

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clients.map((option: { key: string }) => option.key)).toEqual([
      'ACME',
      'BETA',
      'ZETA',
    ])

    await app.close()
  })

  it('sem grupos declarados, a lista vem vazia', async () => {
    const app = buildServer(config, fakeStore(state(conjunto)))

    const body = (await app.inject({ method: 'GET', url: '/api/filters/options' })).json()

    expect(body.clientGroups).toEqual([])

    await app.close()
  })
})
