import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { normalizeClientGroups } from '../../src/domain/client-mapper.ts'
import { today } from '../../src/domain/date-window.ts'
import { normalizeTeamMap } from '../../src/domain/team-mapper.ts'
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
    processes: [
      process(2, 'desembaracado'),
      process(3, 'desembaracado'),
      process(4, 'em_andamento'),
      process(5, 'fechado_aguardando_draft'),
    ],
    fileHash: 'sha256:abc',
    sheetName: '2026',
    lastReadAt: new Date('2026-08-04T14:22:31.004Z'),
    lastReadOk: true,
    degradedReason: null,
    lastReadDurationMs: 120,
    rowsRead: 4,
    rowsAccepted: 4,
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

describe('GET /api/indicators', () => {
  it('devolve o bloco counts com as contagens por categoria', async () => {
    const app = buildServer(config, fakeStore(state()))

    const response = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(response.statusCode).toBe(200)
    expect(response.json().counts).toMatchObject({
      total: 4,
      desembaracados: 2,
      emAndamento: 1,
      emDesembaraco: 0,
      fechadoAguardandoDraft: 1,
    })

    await app.close()
  })

  /**
   * A rota nasceu parcial em H-09 e fecha aqui. Ate H-12 este teste afirmava a
   * AUSENCIA dos dois ultimos campos — zero em campo nao calculado seria
   * indistinguivel de zero medido. Com H-13 nao ha mais bloco pendente.
   */
  it('devolve o contrato completo, sem bloco pendente', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(Object.keys(body).sort()).toEqual([
      // `arrivalCalendar` entrou em `H-17`: recorte de `expectedVessels` com o
      // teto de 15 dias, que precisa vir do servidor para nao virar regra no
      // cliente. `expectedVessels` (IND-12) segue intacto, sem teto (A-24).
      'arrivalCalendar',
      // `channelDistribution` entrou em `H-51`: bloco proprio, e nao um campo
      // em `counts` — aquele e a lista dos indicadores do catalogo, e
      // `counts.canalVermelho` (IND-06) continua la com o mesmo valor.
      'channelDistribution',
      'counts',
      'documentaryLeadTime',
      'expectedVessels',
      // `leadTimeByGroup` entrou em `H-19`: as quebras de IND-22 por cliente,
      // agente, navio e responsavel. O agregado acima segue intacto — sao o
      // mesmo indicador em granularidades diferentes.
      'leadTimeByGroup',
      'meta',
      'rankings',
    ])
    expect(Object.keys(body.counts).sort()).toEqual([
      'atrasados',
      'canalVermelho',
      'chegando15Dias',
      'chegandoHoje',
      'chegandoSemana',
      'desembaracados',
      'desembaracadosHoje',
      // `H-52`. Adicional a `desembaracados`, contado pela data de registro.
      'desembaracadosNoPeriodo',
      'documentosPendentes',
      'emAndamento',
      'emDesembaraco',
      'fechadoAguardandoDraft',
      'total',
    ])

    await app.close()
  })

  it('devolve os cinco rankings, com responsible sempre completo', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(Object.keys(body.rankings).sort()).toEqual([
      'agents',
      'clients',
      'goods',
      'importers',
      'responsible',
    ])
    // As quatro chaves de responsavel aparecem mesmo com os campos em branco.
    expect(body.rankings.responsible).toHaveLength(4)
    expect(body.meta.topN).toBe(10)

    await app.close()
  })

  /**
   * O rotulo do ranking por responsavel e o legivel, nao a chave.
   *
   * Ate `H-19` a rota devolvia `label: 'colaborador1'`, e nenhuma pagina o
   * consumia — o defeito so apareceria na primeira tela a exibi-lo. Traduzir no
   * cliente escreveria a mesma tabela duas vezes (A-28).
   */
  it('devolve o rotulo legivel do responsavel, nao a chave', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
    const indefinido = body.rankings.responsible.find(
      (group: { key: string }) => group.key === 'indefinido',
    )

    expect(indefinido.label).toBe('Indefinido')

    await app.close()
  })

  /**
   * `H-50`. Com mapa de equipe, IND-20 conta PESSOAS — e exibe a que nao tem
   * processo algum, pela mesma razao de A-28.
   */
  describe('IND-20 com o mapa de equipe (H-50)', () => {
    const equipe = normalizeTeamMap([
      { key: 'membro1', label: 'Primeiro', importers: ['importadora um'], colorResponsible: [] },
      { key: 'membro2', label: 'Segundo', importers: ['importadora dois'], colorResponsible: [] },
    ])
    const comEquipe = (processes: Process[]) =>
      buildServer(
        config,
        fakeStore(state({ processes })),
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

    it('conta por pessoa e exibe a pessoa sem processo com zero', async () => {
      const app = comEquipe([
        process(2, 'em_andamento', { responsible: 'membro1', responsibleLabel: 'Primeiro' }),
        process(3, 'em_andamento', { responsible: '', responsibleLabel: '' }),
      ])

      const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

      expect(body.rankings.responsible).toContainEqual({
        key: 'membro1',
        label: 'Primeiro',
        count: 1,
      })
      expect(body.rankings.responsible).toContainEqual({
        key: 'membro2',
        label: 'Segundo',
        count: 0,
      })
      expect(body.rankings.responsible).toContainEqual({
        key: '',
        label: 'Sem responsável',
        count: 1,
      })

      await app.close()
    })

    // IND-22 por responsavel deixa de ser dominado por uma unica chave, por
    // efeito do campo — sem trabalho de tela.
    it('quebra IND-22 pela pessoa, com o rotulo legivel', async () => {
      const app = comEquipe([
        process(2, 'desembaracado', {
          responsible: 'membro1',
          responsibleLabel: 'Primeiro',
          docsSentDate: new Date('2026-01-01T00:00:00Z'),
          registrationDate: new Date('2026-01-11T00:00:00Z'),
        }),
      ])

      const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
      const grupo = body.leadTimeByGroup.responsible.find(
        (g: { key: string }) => g.key === 'membro1',
      )

      expect(grupo).toMatchObject({ label: 'Primeiro', averageDays: 10, sampleSize: 1 })

      await app.close()
    })
  })
})

describe('GET /api/indicators — quebras de IND-22 (H-19)', () => {
  it('devolve as quatro quebras e os totais de grupo', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(Object.keys(body.leadTimeByGroup).sort()).toEqual([
      'agents',
      'clients',
      'groupTotals',
      'responsible',
      'vessels',
    ])

    await app.close()
  })

  /**
   * O teto vale para tres quebras e **nao** para a de responsavel: sao quatro
   * chaves fixas, e A-28 exige as quatro. Sujeita-la ao `topN` deixaria uma
   * mudanca de configuracao quebrar um criterio de aceite sem teste acusando.
   */
  it('corta as tres quebras abertas em topN, e nao a de responsavel', async () => {
    const conjunto = Array.from({ length: 14 }, (_, index) =>
      process(index + 2, 'em_andamento', {
        clientKey: `CLIENTE${index}`,
        clientRaw: `Cliente ${index}`,
      }),
    )
    const app = buildServer({ ...config, topN: 3 }, fakeStore(state({ processes: conjunto })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.leadTimeByGroup.clients).toHaveLength(3)
    expect(body.leadTimeByGroup.groupTotals.clients).toBe(14)
    expect(body.leadTimeByGroup.responsible).toHaveLength(1)

    await app.close()
  })

  // Regra inviolavel 2: o que o teto deixou de fora precisa ser contavel. Sem
  // `groupTotals` a tela diria "os 10 maiores" sem dizer de quantos.
  it('informa o total de grupos antes do corte', async () => {
    const conjunto = [
      process(2, 'em_andamento', { clientKey: 'A', clientRaw: 'A' }),
      process(3, 'em_andamento', { clientKey: 'B', clientRaw: 'B' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes: conjunto })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.leadTimeByGroup.groupTotals.clients).toBe(2)
    expect(body.leadTimeByGroup.clients).toHaveLength(2)

    await app.close()
  })

  it('respeita os filtros globais, como todo bloco da rota', async () => {
    const conjunto = [
      process(2, 'em_andamento', { clientKey: 'ACME', clientRaw: 'Acme' }),
      process(3, 'em_andamento', { clientKey: 'BETA', clientRaw: 'Beta' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes: conjunto })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators?client=ACME' })).json()

    expect(body.leadTimeByGroup.groupTotals.clients).toBe(1)

    await app.close()
  })

  it('resolve as fronteiras de data no fuso configurado', async () => {
    const app = buildServer(config, fakeStore(state()))

    const meta = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().meta

    expect(meta.timezone).toBe('America/Sao_Paulo')
    expect(meta.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(meta.weekEnd >= meta.today).toBe(true)
    // O fim da semana ISO cai no maximo seis dias depois de hoje.
    expect(new Date(`${meta.weekEnd}T00:00:00Z`).getUTCDay()).toBe(0)

    await app.close()
  })

  it('devolve 200 com todas as contagens zeradas quando nao ha processos', async () => {
    const app = buildServer(
      config,
      fakeStore(state({ processes: [], rowsRead: 0, rowsAccepted: 0 })),
    )

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().counts.total).toBe(0)

    await app.close()
  })
})

describe('GET /api/indicators — indicadores de risco (H-12)', () => {
  /**
   * A rota resolve `hoje` pelo relogio real, entao os casos usam datas
   * inequivocamente no passado e no futuro. As fronteiras exatas de cada regra
   * sao exercidas em `indicators-risk.test.ts`, com `hoje` fixo.
   */
  const PASSADO = new Date('2020-01-01T00:00:00Z')
  const FUTURO_DISTANTE = new Date('2099-01-01T00:00:00Z')

  it('devolve canalVermelho, documentosPendentes e atrasados', async () => {
    const processes = [
      process(2, 'em_andamento', { customsChannel: 'vermelho', eta2: PASSADO }),
      process(3, 'em_desembaraco', { eta2: PASSADO }),
      process(4, 'desembaracado', { eta2: PASSADO }),
      process(5, 'em_andamento', { eta2: FUTURO_DISTANTE }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts

    expect(counts.canalVermelho).toBe(1)
    // Os dois do passado nao concluidos; o desembaracado e o futuro ficam fora.
    expect(counts.atrasados).toBe(2)
    expect(counts.documentosPendentes).toBe(2)

    await app.close()
  })

  it('devolve os tres zerados quando nao ha processo de risco', async () => {
    const app = buildServer(config, fakeStore(state()))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts

    expect(counts.canalVermelho).toBe(0)
    expect(counts.atrasados).toBe(0)
    expect(counts.documentosPendentes).toBe(0)

    await app.close()
  })
})

describe('GET /api/indicators — indicadores de tempo (H-13)', () => {
  /**
   * IND-16 pergunta "RG = hoje", entao o fixture precisa do MESMO dia que a
   * rota resolve. Nao ha como usar data inequivoca aqui, como faz o bloco de
   * risco: `today` e a unica fonte desse dia, e a rota chama exatamente ela.
   */
  const HOJE = today(config.timezone)

  it('devolve desembaracadosHoje cruzando RG com a categoria (A-29)', async () => {
    const processes = [
      process(2, 'desembaracado', { registrationDate: HOJE }),
      process(3, 'desembaracado', { registrationDate: HOJE }),
      // A linha amarela de A-05: RG de hoje em processo que nao concluiu.
      process(4, 'em_andamento', { registrationDate: HOJE }),
      process(5, 'desembaracado', { registrationDate: new Date('2020-01-01T00:00:00Z') }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts

    expect(counts.desembaracadosHoje).toBe(2)

    await app.close()
  })

  it('devolve documentaryLeadTime com a media e as duas exclusoes (A-30)', async () => {
    const processes = [
      process(2, 'desembaracado', {
        docsSentDate: new Date('2026-07-20T00:00:00Z'),
        registrationDate: new Date('2026-07-30T00:00:00Z'),
      }),
      process(3, 'desembaracado', {
        docsSentDate: new Date('2026-07-30T00:00:00Z'),
        registrationDate: new Date('2026-07-20T00:00:00Z'),
      }),
      process(4, 'em_andamento', { registrationDate: new Date('2026-07-30T00:00:00Z') }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.documentaryLeadTime).toEqual({
      averageDays: 10,
      sampleSize: 1,
      excludedNegative: 1,
      excludedIncomplete: 1,
    })

    await app.close()
  })

  // A-42: media de conjunto vazio nao e zero. O JSON precisa carregar o `null`.
  it('serializa averageDays como null quando nao ha par valido', async () => {
    const app = buildServer(config, fakeStore(state()))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.documentaryLeadTime.averageDays).toBeNull()
    expect(body.documentaryLeadTime.sampleSize).toBe(0)
    expect(body.documentaryLeadTime.excludedIncomplete).toBe(4)
    expect(body.counts.desembaracadosHoje).toBe(0)

    await app.close()
  })
})

describe('GET /api/indicators — estado degradado (A-57)', () => {
  // 04-arquitetura.md secao 5: o dado congelado continua visivel, com aviso.
  it('devolve 200 com a ultima leitura quando degradado apos ler ao menos uma vez', async () => {
    const degradado = state({
      state: 'degradado',
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
    })
    const app = buildServer(config, fakeStore(degradado))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.json().counts.total).toBe(4)

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura bem-sucedida', async () => {
    const semLeitura = state({
      state: 'degradado',
      processes: [],
      lastReadAt: null,
      lastReadOk: false,
      degradedReason: 'A planilha nao foi encontrada.',
      rowsRead: 0,
      rowsAccepted: 0,
    })
    const app = buildServer(config, fakeStore(semLeitura))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.code).toBe('ARQUIVO_INDISPONIVEL')

    await app.close()
  })

  it('devolve 503 na partida, antes da primeira leitura', async () => {
    const partindo = state({
      state: 'partindo',
      processes: [],
      lastReadAt: null,
      lastReadOk: false,
    })
    const app = buildServer(config, fakeStore(partindo))

    const resposta = await app.inject({ method: 'GET', url: '/api/indicators' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.json().error.message).toContain('ainda nao foi lida')

    await app.close()
  })
})

/**
 * `H-49`. IND-10 e IND-22 agrupavam pela celula CLT e chamavam o resultado de
 * cliente: medido, 649 processos produzem 509 valores distintos
 * (`docs/uso/RESULTADO.md` §2).
 */
describe('GET /api/indicators — os rankings de cliente falam do cliente', () => {
  const conjunto = [
    process(2, 'em_andamento', {
      clientKey: 'ACME',
      clientLabel: 'Acme Comércio',
      clientProcessKey: 'ACM-29',
      clientRaw: 'ACM-29',
    }),
    process(3, 'em_andamento', {
      clientKey: 'ACME',
      clientLabel: 'Acme Comércio',
      clientProcessKey: 'ACM-30',
      clientRaw: 'ACM-30',
    }),
    process(4, 'em_andamento', {
      clientKey: 'BETA',
      clientLabel: 'Beta Ltda',
      clientProcessKey: 'BET-01',
      clientRaw: 'BET-01',
    }),
  ]

  it('conta clientes, e nao processos do cliente, com o rotulo do mapa', async () => {
    const app = buildServer(config, fakeStore(state({ processes: conjunto })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.rankings.clients).toEqual([
      { key: 'ACME', label: 'Acme Comércio', count: 2 },
      { key: 'BETA', label: 'Beta Ltda', count: 1 },
    ])

    await app.close()
  })

  it('a quebra de tempo documental usa o mesmo agrupamento', async () => {
    const app = buildServer(config, fakeStore(state({ processes: conjunto })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.leadTimeByGroup.groupTotals.clients).toBe(2)
    expect(body.leadTimeByGroup.clients.map((group: { label: string }) => group.label)).toEqual([
      'Acme Comércio',
      'Beta Ltda',
    ])

    await app.close()
  })
})

/**
 * `H-55` criou o grupo sem tocar em indicador; **`H-56` reviu essa decisao para
 * o ranking de clientes**, e so para ele: o grupo entra NO LUGAR dos membros,
 * com a composicao em `segments`. IND-22 segue por cliente.
 */
describe('GET /api/indicators — o grupo de clientes no ranking', () => {
  const conjunto = [
    process(2, 'em_andamento', {
      clientKey: 'ACME',
      clientLabel: 'Acme Comércio',
      clientGroupKey: 'GRUPO-UM',
    }),
    process(3, 'em_andamento', {
      clientKey: 'BETA',
      clientLabel: 'Beta Ltda',
      clientGroupKey: 'GRUPO-UM',
    }),
  ]

  const GRUPOS = normalizeClientGroups([
    { key: 'grupo-um', label: 'Grupo Um', members: [{ client: 'ACME' }, { client: 'BETA' }] },
  ])

  const servir = () =>
    buildServer(
      config,
      fakeStore(state({ processes: conjunto })),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      GRUPOS,
    )

  it('colapsa os membros numa entrada de grupo, com a composicao em segments', async () => {
    const app = servir()

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.rankings.clients).toEqual([
      {
        key: 'GRUPO-UM',
        label: 'Grupo Um',
        count: 2,
        segments: [
          { key: 'ACME', label: 'Acme Comércio', count: 1 },
          { key: 'BETA', label: 'Beta Ltda', count: 1 },
        ],
      },
    ])

    await app.close()
  })

  // A soma das barras continua batendo com o total: exibir grupo E membros
  // contaria os mesmos processos duas vezes.
  it('nao repete os membros como linhas proprias', async () => {
    const app = servir()

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.rankings.clients).toHaveLength(1)
    expect(
      body.rankings.clients.reduce((soma: number, item: { count: number }) => soma + item.count, 0),
    ).toBe(body.counts.total)

    await app.close()
  })

  // IND-22 nao entrou na revisao: la a pergunta e sobre prazo de documento, e o
  // agrupamento por carteira nao ajuda a responde-la.
  it('a quebra de tempo documental segue por cliente', async () => {
    const app = servir()

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.leadTimeByGroup.groupTotals.clients).toBe(2)

    await app.close()
  })

  it('e aceita o grupo como recorte, porque continua sendo filtro global', async () => {
    const app = servir()

    const body = (
      await app.inject({ method: 'GET', url: '/api/indicators?clientGroup=GRUPO-UM' })
    ).json()

    expect(body.counts.total).toBe(2)

    await app.close()
  })
})

/**
 * `H-51`. A rota nao calcula — serializa o que `channelDistribution` devolveu.
 * O que se verifica aqui e a fiacao, que foi esquecida cinco vezes seguidas de
 * `H-09` a `H-13`, e a coexistencia com IND-06.
 */
describe('GET /api/indicators — distribuicao de canal (H-51)', () => {
  it('serializa a distribuicao ao lado de counts.canalVermelho', async () => {
    const processes = [
      process(2, 'desembaracado', { customsChannel: 'verde' }),
      process(3, 'desembaracado', { customsChannel: 'verde' }),
      process(4, 'em_andamento', { customsChannel: 'vermelho' }),
      process(5, 'em_andamento', { customsChannel: 'indefinido' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()

    expect(body.channelDistribution).toEqual({
      verde: 2,
      vermelho: 1,
      indefinido: 1,
      known: 3,
      verdeShare: 2 / 3,
      vermelhoShare: 1 / 3,
    })
    // IND-06 nao foi redefinido pela historia.
    expect(body.counts.canalVermelho).toBe(1)

    await app.close()
  })

  // RF-18: todo indicador desta rota responde sobre o conjunto FILTRADO, e a
  // distribuicao nao e excecao — inclusive o denominador.
  it('recorta a distribuicao pelos filtros globais', async () => {
    const processes = [
      process(2, 'desembaracado', { customsChannel: 'verde', clientKey: 'ACME' }),
      process(3, 'em_andamento', { customsChannel: 'vermelho', clientKey: 'OUTRO' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const body = (await app.inject({ method: 'GET', url: '/api/indicators?client=ACME' })).json()

    expect(body.channelDistribution.verde).toBe(1)
    expect(body.channelDistribution.vermelho).toBe(0)
    expect(body.channelDistribution.known).toBe(1)
    expect(body.channelDistribution.verdeShare).toBe(1)

    await app.close()
  })

  // O caso-limite do backlog: filtro salvo antes de `H-51`. O valor saiu do
  // dominio, e recusar e o comportamento correto — servir a lista inteira
  // fingiria que o recorte foi aplicado.
  it('recusa o canal `nenhum`, que saiu do dominio, com 400 FILTRO_INVALIDO', async () => {
    const app = buildServer(config, fakeStore(state()))

    const response = await app.inject({ method: 'GET', url: '/api/indicators?channel=nenhum' })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('FILTRO_INVALIDO')
    expect(response.json().error.message).toContain('nenhum')

    await app.close()
  })

  it('aceita o canal `verde` no filtro', async () => {
    const processes = [
      process(2, 'desembaracado', { customsChannel: 'verde' }),
      process(3, 'em_andamento', { customsChannel: 'indefinido' }),
    ]
    const app = buildServer(config, fakeStore(state({ processes })))

    const response = await app.inject({ method: 'GET', url: '/api/indicators?channel=verde' })

    expect(response.statusCode).toBe(200)
    expect(response.json().counts.total).toBe(1)

    await app.close()
  })
})

/**
 * `H-52`. A rota nao calcula — serializa. O que se verifica e a fiacao dos tres
 * campos novos e o eco da janela que ela de fato aplicou.
 */
describe('GET /api/indicators — periodo declarado (H-52)', () => {
  const comDatas = () => [
    process(2, 'desembaracado', {
      eta2: new Date('2026-02-10T00:00:00Z'),
      registrationDate: new Date('2026-02-15T00:00:00Z'),
    }),
    process(3, 'desembaracado', {
      eta2: new Date('2026-05-20T00:00:00Z'),
      registrationDate: new Date('2026-06-01T00:00:00Z'),
    }),
    process(4, 'em_andamento', { eta2: new Date('2026-03-01T00:00:00Z') }),
  ]

  it('serializa a faixa real das duas datas, com os ausentes contados', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const meta = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().meta

    expect(meta.dataRange.eta2).toEqual({ from: '2026-02-10', to: '2026-05-20', missing: 0 })
    expect(meta.dataRange.registration).toEqual({
      from: '2026-02-15',
      to: '2026-06-01',
      missing: 1,
    })

    await app.close()
  })

  // Sem filtro de periodo a janela e nula, e e nesse estado que o criterio de
  // aceite manda o cartao declarar a faixa REAL dos dados.
  it('devolve janela nula quando nao ha filtro de periodo', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const meta = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().meta

    expect(meta.period).toEqual({ from: null, to: null })

    await app.close()
  })

  it('ecoa a janela que aplicou, e recorta a faixa junto', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const meta = (
      await app.inject({
        method: 'GET',
        url: '/api/indicators?etaFrom=2026-01-01&etaTo=2026-03-31',
      })
    ).json().meta

    expect(meta.period).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    // A faixa acompanha o recorte: o de maio saiu, e com ele o `to` de ETA2.
    expect(meta.dataRange.eta2.to).toBe('2026-03-01')

    await app.close()
  })

  it('conta desembaracadosNoPeriodo pela data de registro dentro da janela', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const counts = (
      await app.inject({
        method: 'GET',
        url: '/api/indicators?etaFrom=2026-01-01&etaTo=2026-03-31',
      })
    ).json().counts

    // Sobra o de fevereiro: o de maio saiu pelo recorte de ETA2, e o terceiro
    // nao esta desembaracado.
    expect(counts.desembaracadosNoPeriodo).toBe(1)

    await app.close()
  })

  // A-12: o cartao novo e adicional, nunca substituto. A soma das quatro
  // categorias tem de continuar fechando com o total.
  it('nao altera a soma das quatro categorias', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const counts = (await app.inject({ method: 'GET', url: '/api/indicators' })).json().counts
    const soma =
      counts.emAndamento +
      counts.emDesembaraco +
      counts.desembaracados +
      counts.fechadoAguardandoDraft

    expect(soma).toBe(counts.total)

    await app.close()
  })

  // O caso-limite do backlog: intervalo invertido produz conjunto vazio sem
  // erro, e o eco da janela mostra exatamente o que foi pedido.
  it('aceita janela invertida, devolvendo conjunto vazio sem erro', async () => {
    const app = buildServer(config, fakeStore(state({ processes: comDatas() })))

    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/indicators?etaFrom=2026-06-01&etaTo=2026-01-01',
      })
    ).json()

    expect(body.counts.total).toBe(0)
    expect(body.counts.desembaracadosNoPeriodo).toBe(0)
    expect(body.meta.period).toEqual({ from: '2026-06-01', to: '2026-01-01' })
    expect(body.meta.dataRange.eta2).toEqual({ from: null, to: null, missing: 0 })

    await app.close()
  })
})
