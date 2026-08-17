import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

function process(sourceRow: number, extra: Partial<Process> = {}): Process {
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
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory: 'em_andamento' as StatusCategory,
    responsible: 'indefinido',
    customsChannel: 'nenhum',
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
    lastReadAt: new Date('2026-08-07T14:22:31.004Z'),
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

async function get(url: string, processes: Process[] = []) {
  const app = buildServer(config, fakeStore(state({ processes })))
  const response = await app.inject({ method: 'GET', url })
  await app.close()
  return response
}

describe('GET /api/processes — envelope', () => {
  it('devolve o contrato completo', async () => {
    const body = (await get('/api/processes')).json()

    expect(Object.keys(body).sort()).toEqual(['items', 'limit', 'offset', 'total'])
    expect(body.limit).toBe(200)
    expect(body.offset).toBe(0)
  })

  it('fixa a lista completa de campos do ProcessDto', async () => {
    const body = (await get('/api/processes', [process(2)])).json()

    expect(Object.keys(body.items[0]).sort()).toEqual([
      'agent',
      'anomalies',
      'billOfLading',
      'boletoRaw',
      'client',
      'columnPRaw',
      'container',
      'customsChannel',
      'docsSentDate',
      'eta2',
      'goods',
      'hasPendingEdits',
      'importer',
      'importerOutsideRj',
      'paymentRaw',
      'port',
      'ref',
      'registrationDate',
      'responsible',
      'sourceRow',
      'statusCategory',
      'statusRaw',
      'vessel',
    ])
  })

  it('serializa datas como AAAA-MM-DD, e ausencia como null', async () => {
    const body = (
      await get('/api/processes', [
        process(2, { eta2: civil('2026-08-20'), registrationDate: civil('2026-07-31') }),
      ])
    ).json()

    expect(body.items[0].eta2).toBe('2026-08-20')
    expect(body.items[0].registrationDate).toBe('2026-07-31')
    expect(body.items[0].docsSentDate).toBeNull()
  })

  /** A fila de edicoes so existe em `H-23`. `false` aqui significa "nao ha
   * edicao pendente", nao "a informacao falta" — como `pendingEditsCount`. */
  it('hasPendingEdits e false ate H-23', async () => {
    const body = (await get('/api/processes', [process(2)])).json()

    expect(body.items[0].hasPendingEdits).toBe(false)
  })
})

describe('busca — A-39', () => {
  const processos = [
    process(2, { ref: 'FT501.26', billOfLading: 'NBSC260812', container: 'TCLU1234567' }),
    process(3, { ref: 'FT502.26', billOfLading: 'OUTRO', container: 'ZZZZ0000000' }),
  ]

  it('casa em REF, BL ou CNTR', async () => {
    for (const termo of ['FT501', 'NBSC260', 'TCLU123']) {
      const body = (await get(`/api/processes?search=${termo}`, processos)).json()
      expect(body.total).toBe(1)
      expect(body.items[0].ref).toBe('FT501.26')
    }
  })

  it('ignora caixa e acento', async () => {
    const body = (await get('/api/processes?search=nbsc260', processos)).json()

    expect(body.total).toBe(1)
  })

  it('busca vazia nao filtra', async () => {
    const body = (await get('/api/processes?search=', processos)).json()

    expect(body.total).toBe(2)
  })
})

describe('activeOnly — A-16', () => {
  const processos = [
    process(2, { statusCategory: 'em_andamento' }),
    process(3, { statusCategory: 'desembaracado' }),
    process(4, { statusCategory: 'fechado_aguardando_draft' }),
  ]

  /** O PADRAO da rota e `false`; e a Pagina Operacional que pede `true`. */
  it('sem o parametro, inclui os desembaracados', async () => {
    expect((await get('/api/processes', processos)).json().total).toBe(3)
  })

  it('com true, exclui apenas os desembaracados', async () => {
    const body = (await get('/api/processes?activeOnly=true', processos)).json()

    expect(body.total).toBe(2)
    expect(body.items.map((p: { sourceRow: number }) => p.sourceRow).sort()).toEqual([2, 4])
  })
})

describe('ordenacao', () => {
  const processos = [
    process(2, { ref: 'B', eta2: civil('2026-08-10') }),
    process(3, { ref: 'C', eta2: null }),
    process(4, { ref: 'A', eta2: civil('2026-08-01') }),
  ]

  it('o padrao e eta2 ascendente', async () => {
    const body = (await get('/api/processes', processos)).json()

    expect(body.items.map((p: { ref: string }) => p.ref)).toEqual(['A', 'B', 'C'])
  })

  it('nulo fica por ultimo TAMBEM em desc', async () => {
    const body = (await get('/api/processes?sort=eta2&order=desc', processos)).json()

    expect(body.items.map((p: { ref: string }) => p.ref)).toEqual(['B', 'A', 'C'])
  })
})

describe('paginacao', () => {
  const processos = Array.from({ length: 649 }, (_, index) => process(index + 2))

  it('total e do conjunto filtrado inteiro, nao da pagina', async () => {
    const body = (await get('/api/processes?limit=10', processos)).json()

    expect(body.items).toHaveLength(10)
    expect(body.total).toBe(649)
  })

  it('a ultima pagina traz o resto', async () => {
    const body = (await get('/api/processes?limit=200&offset=600', processos)).json()

    expect(body.items).toHaveLength(49)
    expect(body.total).toBe(649)
  })

  it('offset alem do fim devolve lista vazia, com 200', async () => {
    const response = await get('/api/processes?offset=1000', processos)

    expect(response.statusCode).toBe(200)
    expect(response.json().items).toEqual([])
    expect(response.json().total).toBe(649)
  })
})

describe('parametro invalido — 400 FILTRO_INVALIDO', () => {
  const invalidos = [
    'sort=inventado',
    'order=aleatorio',
    'activeOnly=talvez',
    'limit=0',
    'limit=1001',
    'limit=abc',
    'offset=-1',
    // Os onze filtros globais valem aqui, e recusam do mesmo jeito.
    'category=inventada',
  ]

  for (const query of invalidos) {
    it(`recusa ${query}`, async () => {
      const response = await get(`/api/processes?${query}`)

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('FILTRO_INVALIDO')
    })
  }
})

describe('filtros globais e estado', () => {
  it('aplica os onze filtros ANTES da busca e da contagem', async () => {
    const processos = [
      process(2, { ref: 'X', clientKey: 'ACME', statusCategory: 'em_andamento' }),
      process(3, { ref: 'Y', clientKey: 'OUTRO', statusCategory: 'em_andamento' }),
    ]

    const body = (await get('/api/processes?client=ACME', processos)).json()

    expect(body.total).toBe(1)
    expect(body.items[0].ref).toBe('X')
  })

  it('503 apenas quando NUNCA houve leitura', async () => {
    const app = buildServer(
      config,
      fakeStore(state({ lastReadAt: null, state: 'degradado', degradedReason: 'Sem arquivo.' })),
    )

    const response = await app.inject({ method: 'GET', url: '/api/processes' })

    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
    await app.close()
  })

  /** Em `degradado` COM leitura anterior a lista congelada continua servindo —
   * a mesma regra das demais rotas de dado (A-57). */
  it('200 em degradado quando ja houve leitura', async () => {
    const app = buildServer(
      config,
      fakeStore(
        state({ state: 'degradado', degradedReason: 'Arquivo em uso.', processes: [process(2)] }),
      ),
    )

    const response = await app.inject({ method: 'GET', url: '/api/processes' })

    expect(response.statusCode).toBe(200)
    expect(response.json().total).toBe(1)
    await app.close()
  })
})

/**
 * `GET /api/processes/:ref` — o detalhe (`H-22`).
 *
 * A rota estava documentada em `docs/05-contratos-api.md` desde o plano e
 * **nunca fora implementada**: a lista de arquivos de `H-22` trazia apenas a
 * pagina. O protocolo de fatia pegou.
 */
/**
 * `H-23`. A projecao chega pronta do store: a rota so distingue, por REF, quais
 * linhas tem edicao esperando gravacao.
 */
describe('edicoes pendentes na tabela e no detalhe', () => {
  const edicao = {
    id: 'edit-1',
    ts: '2026-08-07T12:00:00.000Z',
    ref: 'FT002.26',
    sourceRow: 2,
    field: 'eta2' as const,
    value: '2026-09-01',
    previous: '',
  }
  const comEdicao = () => state({ processes: [process(2), process(3)], pendingEdits: [edicao] })

  it('marca so a linha com edicao pendente', async () => {
    const app = buildServer(config, fakeStore(comEdicao()))

    const body = (await app.inject({ method: 'GET', url: '/api/processes' })).json()
    const marcadas = body.items.filter((item: { hasPendingEdits: boolean }) => item.hasPendingEdits)

    expect(body.items).toHaveLength(2)
    expect(marcadas).toHaveLength(1)
    expect(marcadas[0].ref).toBe('FT002.26')

    await app.close()
  })

  it('devolve as edicoes daquele processo no detalhe', async () => {
    const app = buildServer(config, fakeStore(comEdicao()))

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })).json()

    expect(body.pendingEdits).toHaveLength(1)
    expect(body.pendingEdits[0].field).toBe('eta2')
    expect(body.process.hasPendingEdits).toBe(true)

    await app.close()
  })

  // O painel do detalhe e daquele REF: mostrar a fila inteira ali confundiria
  // pendencia deste processo com pendencia de outro.
  it('nao mistura edicao de outro processo no detalhe', async () => {
    const app = buildServer(config, fakeStore(comEdicao()))

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT003.26' })).json()

    expect(body.pendingEdits).toEqual([])
    expect(body.process.hasPendingEdits).toBe(false)

    await app.close()
  })
})

describe('GET /api/processes/:ref — detalhe', () => {
  const umProcesso = () => state({ processes: [process(2)] })
  it('devolve o contrato completo', async () => {
    const app = buildServer(config, fakeStore(umProcesso()))

    const response = await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json()).sort()).toEqual([
      'anomalies',
      'daysInCurrentCategory',
      'pendingEdits',
      'process',
      'statusHistory',
    ])

    await app.close()
  })

  it('devolve 404 PROCESSO_NAO_ENCONTRADO para REF inexistente', async () => {
    const app = buildServer(config, fakeStore(umProcesso()))

    const response = await app.inject({ method: 'GET', url: '/api/processes/NAO-EXISTE' })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('PROCESSO_NAO_ENCONTRADO')

    await app.close()
  })

  /**
   * TD-06 define a identidade de REF por `normKey`, e e por ela que a ingestao
   * detecta duplicata. Igualdade literal daria `404` num processo que o dominio
   * considera existente.
   */
  it('resolve a REF pela chave normalizada, nao por igualdade literal', async () => {
    const app = buildServer(config, fakeStore(umProcesso()))

    const minuscula = await app.inject({ method: 'GET', url: '/api/processes/ft002.26' })
    const comEspaco = await app.inject({ method: 'GET', url: '/api/processes/%20FT002.26%20' })

    expect(minuscula.statusCode).toBe(200)
    expect(minuscula.json().process.ref).toBe('FT002.26')
    expect(comEspaco.statusCode).toBe(200)

    await app.close()
  })

  // O detalhe e sobre UM processo achado pela REF: recortar o conjunto nao muda
  // o que ele mostra, e a casca ja esconde a barra de filtros nesta rota.
  it('ignora os filtros globais', async () => {
    const app = buildServer(config, fakeStore(umProcesso()))

    const response = await app.inject({
      method: 'GET',
      url: '/api/processes/FT002.26?client=NAO-EXISTE',
    })

    expect(response.statusCode).toBe(200)

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura', async () => {
    const semLeitura = state({ processes: [process(2)], lastReadAt: null, lastReadOk: false })
    const app = buildServer(config, fakeStore(semLeitura))

    const response = await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })

    expect(response.statusCode).toBe(503)

    await app.close()
  })

  /**
   * O texto da anomalia vem do dominio, onde nasce. Traduzir codigo em frase no
   * cliente escreveria a mesma tabela num segundo lugar (mesmo motivo de A-28).
   */
  it('acompanha cada anomalia da explicacao correspondente', async () => {
    const comAnomalia = process(9, {
      ref: 'FT009.26',
      statusCategory: 'em_andamento',
      anomalies: ['RG_SEM_DESEMBARACO'],
      registrationDate: new Date('2026-07-30T00:00:00Z'),
    })
    const app = buildServer(config, fakeStore(state({ processes: [comAnomalia] })))

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT009.26' })).json()

    expect(body.anomalies).toHaveLength(1)
    expect(body.anomalies[0].code).toBe('RG_SEM_DESEMBARACO')
    expect(body.anomalies[0].detail).toContain('em_andamento')

    await app.close()
  })

  it('nao acrescenta o texto ao ProcessDto, que segue so com os codigos', async () => {
    const comAnomalia = process(9, {
      ref: 'FT009.26',
      anomalies: ['CANAL_EM_TEXTO_STATUS'],
    })
    const app = buildServer(config, fakeStore(state({ processes: [comAnomalia] })))

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT009.26' })).json()

    expect(body.process.anomalies).toEqual(['CANAL_EM_TEXTO_STATUS'])

    await app.close()
  })

  /**
   * Vazio de verdade, nunca preenchido com valor de espera — e
   * `daysInCurrentCategory` e `null`, nao `0`: zero afirmaria que a categoria
   * mudou hoje, indistinguivel de "nao ha como saber".
   */
  /**
   * Sem evento algum para a REF os tres campos saem vazios — e `null` em vez de
   * zero, porque zero afirmaria que a categoria mudou hoje.
   */
  it('devolve historico e edicoes vazios quando nao ha evento, e dias nulo', async () => {
    const app = buildServer(config, fakeStore(umProcesso()))

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })).json()

    expect(body.pendingEdits).toEqual([])
    expect(body.statusHistory).toEqual([])
    expect(body.daysInCurrentCategory).toBeNull()

    await app.close()
  })
})

/**
 * O detalhe consumindo o historico de `H-28`, com o arquivo sob controle.
 *
 * Os dois casos que o resto da suite nao alcanca: a primeira aparicao do REF
 * (`from: null`) e o evento so de canal (`from === to`) existem no arquivo,
 * sao insumo da serie mensal, e **nao** sao linhas de mudanca que o operador
 * possa ler — nenhum dos dois aparece aqui.
 */
describe('GET /api/processes/:ref — historico no detalhe', () => {
  let dir: string
  let historyPath: string

  function event(ts: string, to: StatusCategory, from: StatusCategory | null, channel = 'nenhum') {
    return JSON.stringify({ ts, ref: 'FT002.26', from, to, channel, sourceRow: 2 })
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cronos-detalhe-historico-'))
    historyPath = join(dir, 'history.jsonl')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function server() {
    return buildServer(
      config,
      fakeStore(state({ processes: [process(2)] })),
      loadColorMap(),
      historyPath,
    )
  }

  it('serializa as mudancas de categoria, descartando a primeira aparicao', async () => {
    writeFileSync(
      historyPath,
      `${[
        event('2026-08-01T12:00:00.000Z', 'em_andamento', null),
        event('2026-08-10T12:00:00.000Z', 'desembaracado', 'em_andamento'),
      ].join('\n')}\n`,
      'utf-8',
    )
    const app = server()

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })).json()

    expect(body.statusHistory).toEqual([
      { ts: '2026-08-10T12:00:00.000Z', from: 'em_andamento', to: 'desembaracado' },
    ])

    await app.close()
  })

  it('nao mostra o evento que so trocou o canal como mudanca de categoria', async () => {
    writeFileSync(
      historyPath,
      `${[
        event('2026-08-01T12:00:00.000Z', 'em_andamento', null),
        event('2026-08-10T12:00:00.000Z', 'em_andamento', 'em_andamento', 'vermelho'),
      ].join('\n')}\n`,
      'utf-8',
    )
    const app = server()

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })).json()

    expect(body.statusHistory).toEqual([])

    await app.close()
  })

  it('devolve daysInCurrentCategory contado desde a ultima mudanca de categoria', async () => {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    writeFileSync(historyPath, `${event(umDiaAtras, 'em_andamento', null)}\n`, 'utf-8')
    const app = server()

    const body = (await app.inject({ method: 'GET', url: '/api/processes/FT002.26' })).json()

    expect(body.daysInCurrentCategory).toBe(1)

    await app.close()
  })
})
