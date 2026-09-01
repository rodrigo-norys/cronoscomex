import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type { Process } from '../../src/domain/types.ts'
import { registerEditsRoutes } from '../../src/http/routes/edits.ts'
import { buildServer } from '../../src/http/server.ts'
import { DEFAULT_QUEUE_PATH } from '../../src/io/edit-queue.ts'

/**
 * As quatro rotas de edicao. **Nenhuma toca o `.xlsx`** — e o teste prova, ao
 * apontar a fila para um arquivo temporario e nao carregar planilha nenhuma.
 *
 * Monta a instancia sem `buildServer` pelo mesmo motivo do teste da quarentena:
 * o registrador da rota e o menor pedaco que responde pelo comportamento, e
 * montar o servidor inteiro traria store, mapa de cor e rota estatica para um
 * teste que so quer a fila.
 *
 * **Ate 01/09/2026 este bloco dizia outra coisa** — que so sem `buildServer` era
 * possivel passar o caminho da fila. Era verdade, e era um defeito: a assinatura
 * nao expunha `queuePath`, entao quem montava o servidor inteiro escrevia em
 * `data/pending-edits.jsonl` da raiz. O ultimo `describe` deste arquivo e a
 * guarda que impede a regressao.
 */

let directory: string
let queuePath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-edits-'))
  queuePath = join(directory, 'pending-edits.jsonl')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function process(overrides: Partial<Process> = {}): Process {
  return {
    sourceRow: 483,
    ref: 'FT533.26',
    clientRaw: 'ACME LOG',
    importerRaw: '',
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
    eta2: new Date('2026-08-04T00:00:00Z'),
    registrationDate: null,
    docsSentDate: null,
    clientKey: 'ACME LOG',
    clientProcessKey: 'ACME LOG',
    clientLabel: 'ACME LOG',
    clientGroupKey: '',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory: 'em_andamento',
    responsible: 'indefinido',
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey: 'none',
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
    lastReadAt: new Date('2026-08-07T12:00:00.000Z'),
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

function buildApp(initial: StoreState = state()) {
  const store: StoreAccess = { getState: () => initial, reload: async () => undefined }
  const app = Fastify({ logger: false })
  registerEditsRoutes(app, store, queuePath)
  return app
}

const EDICAO = { ref: 'FT533.26', field: 'eta2', value: '2026-08-06' }

describe('POST /api/edits', () => {
  it('enfileira e devolve 201 com o contrato', async () => {
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })

    expect(response.statusCode).toBe(201)
    expect(Object.keys(response.json()).sort()).toEqual([
      'field',
      'id',
      'pendingEditsCount',
      'previous',
      'ref',
      'sourceRow',
      'ts',
      'value',
    ])
    expect(response.json().pendingEditsCount).toBe(1)

    await app.close()
  })

  /**
   * O criterio central da historia: a fila registra a intencao, e o arquivo da
   * planilha nao e tocado. Aqui nao ha planilha alguma carregada — o que existe
   * e o `.jsonl` no temporario.
   */
  it('grava no jsonl e em mais lugar nenhum', async () => {
    const app = buildApp()

    await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })

    expect(readFileSync(queuePath, 'utf-8')).toContain('FT533.26')

    await app.close()
  })

  // `previous` sai do processo lido, e nao do corpo: quem edita informa o valor
  // NOVO, e o anterior e responsabilidade do servidor.
  it('preenche previous e sourceRow a partir do processo', async () => {
    const app = buildApp()

    const body = (await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })).json()

    expect(body.previous).toBe('2026-08-04')
    expect(body.sourceRow).toBe(483)

    await app.close()
  })

  // O caminho mais banal do painel: digitar, notar o engano, corrigir. Sem a
  // heranca, a segunda edicao gravaria como `previous` o valor da primeira —
  // que nunca esteve na planilha —, e a defesa de H-25 recusaria a fila inteira
  // para sempre. Achado do revisor-xml em H-25.
  it('mantem previous do arquivo ao editar o mesmo campo duas vezes', async () => {
    const app = buildApp()

    await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })
    const segunda = (
      await app.inject({
        method: 'POST',
        url: '/api/edits',
        payload: { ...EDICAO, value: '2026-08-07' },
      })
    ).json()

    expect(segunda.previous).toBe('2026-08-04')
    expect(segunda.value).toBe('2026-08-07')

    await app.close()
  })

  it('devolve vazio em previous quando a celula estava vazia', async () => {
    const app = buildApp()

    const body = (
      await app.inject({
        method: 'POST',
        url: '/api/edits',
        payload: { ref: 'FT533.26', field: 'boletoRaw', value: 'BOL-1' },
      })
    ).json()

    expect(body.previous).toBe('')

    await app.close()
  })

  it('resolve a REF pela chave normalizada', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ...EDICAO, ref: 'ft533.26' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().ref).toBe('FT533.26')

    await app.close()
  })

  it('devolve 404 para processo inexistente', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ...EDICAO, ref: 'FT999.99' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('PROCESSO_NAO_ENCONTRADO')

    await app.close()
  })

  it('devolve 503 quando nunca houve leitura', async () => {
    const app = buildApp(state({ lastReadAt: null, lastReadOk: false }))

    const response = await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })

    expect(response.statusCode).toBe(503)

    await app.close()
  })
})

describe('POST /api/edits — validacao', () => {
  // `statusCategory` e derivado: editavel seria mentir sobre o que a planilha
  // diz, e a categoria voltaria ao valor classificado na releitura seguinte.
  it('recusa campo derivado com 400 CAMPO_NAO_EDITAVEL', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'statusCategory', value: 'desembaracado' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('CAMPO_NAO_EDITAVEL')

    await app.close()
  })

  it('recusa ref, que e a chave natural', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'ref', value: 'FT999.99' },
    })

    expect(response.json().error.code).toBe('CAMPO_NAO_EDITAVEL')

    await app.close()
  })

  it('recusa statusRaw com 1001 caracteres', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'statusRaw', value: 'x'.repeat(1001) },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('CORPO_INVALIDO')

    await app.close()
  })

  it('aceita statusRaw com exatamente 1000', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'statusRaw', value: 'x'.repeat(1000) },
    })

    expect(response.statusCode).toBe(201)

    await app.close()
  })

  it('recusa data em formato diferente e data inexistente', async () => {
    const app = buildApp()

    const formato = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'eta2', value: '06/08/2026' },
    })
    const inexistente = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'eta2', value: '2026-02-31' },
    })

    expect(formato.json().error.code).toBe('CORPO_INVALIDO')
    expect(inexistente.json().error.code).toBe('CORPO_INVALIDO')

    await app.close()
  })

  it('recusa value que nao seja texto nem null', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'clientRaw', value: 42 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('CORPO_INVALIDO')

    await app.close()
  })

  /**
   * `null` e celula vazia, e nao cancelamento — este tem rota propria. Sem isso
   * o operador ficaria sem meio de limpar uma data.
   */
  it('aceita null para limpar a data', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'eta2', value: null },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().value).toBeNull()

    await app.close()
  })

  // A decisao de nao gravar nada e do xlsx-surgeon, nao da fila.
  it('aceita edicao para o mesmo valor atual', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'eta2', value: '2026-08-04' },
    })

    expect(response.statusCode).toBe(201)

    await app.close()
  })
})

describe('GET /api/edits', () => {
  it('devolve a fila consolidada e a contagem', async () => {
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })
    await app.inject({ method: 'POST', url: '/api/edits', payload: { ...EDICAO, value: null } })

    const body = (await app.inject({ method: 'GET', url: '/api/edits' })).json()

    expect(body.count).toBe(1)
    expect(body.items[0].value).toBeNull()

    await app.close()
  })

  it('devolve fila vazia sem erro', async () => {
    const app = buildApp()

    const body = (await app.inject({ method: 'GET', url: '/api/edits' })).json()

    expect(body).toEqual({ items: [], count: 0 })

    await app.close()
  })
})

describe('DELETE /api/edits/:id', () => {
  it('descarta e devolve 204', async () => {
    const app = buildApp()
    const { id } = (await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })).json()

    const response = await app.inject({ method: 'DELETE', url: `/api/edits/${id}` })

    expect(response.statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: '/api/edits' })).json().count).toBe(0)

    await app.close()
  })

  it('devolve 404 EDICAO_NAO_ENCONTRADA para id inexistente', async () => {
    const app = buildApp()

    const response = await app.inject({ method: 'DELETE', url: '/api/edits/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('EDICAO_NAO_ENCONTRADA')

    await app.close()
  })
})

describe('DELETE /api/edits', () => {
  it('esvazia a fila e informa quantas descartou', async () => {
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })
    await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'clientRaw', value: 'OUTRO' },
    })

    const response = await app.inject({ method: 'DELETE', url: '/api/edits' })

    expect(response.json()).toEqual({ discarded: 2 })
    expect((await app.inject({ method: 'GET', url: '/api/edits' })).json().count).toBe(0)

    await app.close()
  })

  it('devolve zero com a fila ja vazia', async () => {
    const app = buildApp()

    expect((await app.inject({ method: 'DELETE', url: '/api/edits' })).json()).toEqual({
      discarded: 0,
    })

    await app.close()
  })
})

/**
 * Mexer na fila durante a aplicacao a faz sumir sem ser gravada: o write-guard
 * tira o instantaneo do que vai gravar no inicio e arquiva o arquivo INTEIRO no
 * fim. O que entra no meio seria arquivado sem ter chegado ao `.xlsx`, e o
 * painel passaria a mostrar zero pendencias. Achado do revisor-xml em H-26.
 */
describe('a fila e imutavel enquanto a escrita acontece', () => {
  const escrevendo = state({ state: 'escrevendo' })

  it('recusa POST com 409 ESCRITA_EM_ANDAMENTO, sem enfileirar', async () => {
    const app = buildApp(escrevendo)

    const resposta = await app.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })

    expect(resposta.statusCode).toBe(409)
    expect(resposta.json().error.code).toBe('ESCRITA_EM_ANDAMENTO')
    expect(existsSync(queuePath)).toBe(false)

    await app.close()
  })

  // A lapide seria arquivada como se tivesse sido honrada, e a edicao gravada
  // assim mesmo — o operador veria o descarte aceito e o valor na planilha.
  it('recusa DELETE de uma edicao, sem gravar a lapide', async () => {
    const pronto = buildApp()
    const { id } = (
      await pronto.inject({ method: 'POST', url: '/api/edits', payload: EDICAO })
    ).json()
    await pronto.close()
    const antes = readFileSync(queuePath, 'utf-8')

    const app = buildApp(escrevendo)
    const resposta = await app.inject({ method: 'DELETE', url: `/api/edits/${id}` })

    expect(resposta.statusCode).toBe(409)
    expect(readFileSync(queuePath, 'utf-8')).toBe(antes)

    await app.close()
  })

  it('recusa o esvaziamento da fila', async () => {
    const app = buildApp(escrevendo)

    const resposta = await app.inject({ method: 'DELETE', url: '/api/edits' })

    expect(resposta.statusCode).toBe(409)

    await app.close()
  })

  // Ler nao mexe na fila, entao continua servindo durante a escrita.
  it('continua servindo GET', async () => {
    const app = buildApp(escrevendo)

    expect((await app.inject({ method: 'GET', url: '/api/edits' })).statusCode).toBe(200)

    await app.close()
  })
})

/**
 * A fila e injetavel **tambem por `buildServer`**, e nao so pelo registrador da
 * rota.
 *
 * Custou um acidente: em 01/09/2026 um harness de medicao montou o servidor
 * inteiro para exercer a Pagina Detalhe, e `POST /api/edits` gravou quatro
 * edicoes e um descarte total na fila do OPERADOR — `data/pending-edits.jsonl`
 * da raiz, porque o default e relativo ao cwd. A fila foi restaurada byte a
 * byte e nada se perdeu, mas o ponto de injecao existia em
 * `registerEditsRoutes` desde `H-27` e a assinatura de `buildServer` nao o
 * repassava.
 *
 * E o mesmo modo de falha da regra inviolavel 7 que `history-store` (`H-28`) e
 * `saveWorkbookPath` (`H-34`) ja pagaram. Os outros dois se defendem
 * **recusando** o default sob `NODE_ENV=test`; este nao pode — a fila e escrita
 * legitima em producao, e recusa-la mataria a aplicacao. A defesa possivel e a
 * que esta aqui: provar que o caminho chega.
 */
describe('buildServer repassa o caminho da fila', () => {
  function servidor(caminho?: string) {
    return buildServer(
      {
        workbookPath: join(directory, 'nao-existe.xlsx'),
        sheetName: '2026',
        headerRow: 1,
        firstDataRow: 2,
        port: 0,
        stalledDaysThreshold: 15,
        topN: 10,
        timezone: 'America/Sao_Paulo',
      },
      { getState: () => state(), reload: async () => undefined },
      [],
      join(directory, 'history.jsonl'),
      undefined,
      join(directory, 'app.json'),
      undefined,
      join(directory, 'sem-interface'),
      [],
      caminho,
    )
  }

  it('escreve no arquivo injetado, e nao no default da raiz', async () => {
    const app = servidor(queuePath)

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'container', value: 'MSKU7654321' },
    })

    expect(resposta.statusCode).toBe(201)
    expect(readFileSync(queuePath, 'utf-8')).toContain('MSKU7654321')
    await app.close()
  })

  /**
   * A leitura tem de enxergar o mesmo arquivo que a escrita. Repassar o caminho
   * a uma rota e nao as outras deixaria a tela mostrando fila vazia enquanto o
   * arquivo enche — que foi exatamente o sintoma no harness, antes do conserto.
   */
  it('serve a mesma fila que acabou de escrever', async () => {
    const app = servidor(queuePath)
    await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'container', value: 'MSKU7654321' },
    })

    const resposta = await app.inject({ method: 'GET', url: '/api/edits' })

    expect(JSON.parse(resposta.body).count).toBe(1)
    await app.close()
  })

  /**
   * **A asserção que morde de verdade.** Sem o repasse, o `POST` cai no default
   * relativo ao cwd — `data/pending-edits.jsonl` da raiz do projeto, o arquivo
   * do operador. O teste roda a partir da raiz, entao e literalmente aquele
   * arquivo que estaria em risco.
   */
  it('nao cria nada em data/ ao escrever na fila injetada', async () => {
    const antes = existsSync(DEFAULT_QUEUE_PATH) ? readFileSync(DEFAULT_QUEUE_PATH, 'utf-8') : null
    const app = servidor(queuePath)

    await app.inject({
      method: 'POST',
      url: '/api/edits',
      payload: { ref: 'FT533.26', field: 'container', value: 'MSKU7654321' },
    })

    const depois = existsSync(DEFAULT_QUEUE_PATH) ? readFileSync(DEFAULT_QUEUE_PATH, 'utf-8') : null
    expect(depois).toBe(antes)
    await app.close()
  })
})
