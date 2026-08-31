import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import type { ColorMapEntry } from '../../src/domain/color-mapper.ts'
import type { Process } from '../../src/domain/types.ts'
import { registerProcessColorRoute } from '../../src/http/routes/process-color.ts'
import { consolidated, isColorEdit, type PendingColorEdit } from '../../src/io/edit-queue.ts'

/**
 * `GET /api/color-options` e `PATCH /api/processes/:ref/color` — contrato em
 * `docs/05-contratos-api.md §3`.
 *
 * **Nenhuma toca o `.xlsx`**: a fila aponta para um arquivo temporario e
 * planilha nenhuma e carregada. Monta a instancia sem `buildServer` pelo mesmo
 * motivo do teste das edicoes — e o que permite passar o caminho da fila.
 */

let directory: string
let queuePath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-cor-'))
  queuePath = join(directory, 'pending-edits.jsonl')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

/**
 * Os dois verdes e os dois roxos entram porque e a ambiguidade que a rota
 * precisa resolver: quatro entradas, duas combinacoes (A-48).
 */
const COLOR_MAP: ColorMapEntry[] = [
  {
    styleKey: 'argb:FF00FF00',
    fillId: 2,
    label: 'Verde (tom A)',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FF00FF0D',
    fillId: 12,
    label: 'Verde (tom B)',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFA74F7B',
    fillId: 27,
    label: 'Roxo (tom A)',
    responsible: 'colaborador2',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFA64D79',
    fillId: 11,
    label: 'Roxo (tom B)',
    responsible: 'colaborador2',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
]

const ROXO = { responsible: 'colaborador2', customsChannel: 'nenhum', importerOutsideRj: false }

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
    eta2: null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: 'ACME LOG',
    clientProcessKey: 'ACME LOG',
    clientLabel: 'ACME LOG',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory: 'em_andamento',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
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
    lastReadAt: new Date('2026-08-17T12:00:00.000Z'),
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

function buildApp(initial: StoreState = state(), colorMap: ColorMapEntry[] = COLOR_MAP) {
  const store: StoreAccess = { getState: () => initial, reload: async () => undefined }
  const app = Fastify({ logger: false })
  registerProcessColorRoute(app, store, colorMap, queuePath)
  return app
}

async function patch(
  app: ReturnType<typeof buildApp>,
  payload: Record<string, unknown>,
  ref = 'FT533.26',
) {
  return await app.inject({ method: 'PATCH', url: `/api/processes/${ref}/color`, payload })
}

function queuedColor(): PendingColorEdit {
  const edit = consolidated(queuePath).find(isColorEdit)
  if (edit === undefined) throw new Error('nenhuma edicao de cor na fila')
  return edit
}

describe('GET /api/color-options', () => {
  it('devolve uma opcao por combinacao distinta, na ordem do mapa', async () => {
    const response = await buildApp().inject({ method: 'GET', url: '/api/color-options' })

    expect(response.statusCode).toBe(200)
    expect(response.json().options).toEqual([
      {
        label: 'Verde (tom A)',
        responsible: 'indefinido',
        customsChannel: 'nenhum',
        importerOutsideRj: false,
      },
      {
        label: 'Roxo (tom A)',
        responsible: 'colaborador2',
        customsChannel: 'nenhum',
        importerOutsideRj: false,
      },
    ])
  })

  it('devolve lista vazia com mapa vazio, e nao um erro', async () => {
    const response = await buildApp(state(), []).inject({
      method: 'GET',
      url: '/api/color-options',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().options).toEqual([])
  })
})

describe('PATCH /api/processes/:ref/color', () => {
  it('enfileira e devolve 201 com o contrato', async () => {
    const response = await patch(buildApp(), ROXO)

    expect(response.statusCode).toBe(201)
    expect(Object.keys(response.json()).sort()).toEqual([
      'id',
      'kind',
      'label',
      'pendingEditsCount',
      'previousLabel',
      'previousStyleKey',
      'ref',
      'sourceRow',
      'target',
      'ts',
    ])
  })

  // A rota nao grava `fillId`: o mapa e a fonte, e congelar o alvo na fila faria
  // uma edicao enfileirada antes de um ajuste no mapa gravar a cor antiga.
  it('guarda a combinacao e o rotulo do tom canonico', async () => {
    await patch(buildApp(), ROXO)

    const edit = queuedColor()
    expect(edit.target).toEqual(ROXO)
    expect(edit.label).toBe('Roxo (tom A)')
    expect(edit).not.toHaveProperty('fillId')
  })

  it('registra a cor que esta na planilha como anterior', async () => {
    await patch(buildApp(), ROXO)

    expect(queuedColor().previousStyleKey).toBe('argb:FF00FF00')
    expect(queuedColor().previousLabel).toBe('Verde (tom A)')
  })

  /**
   * `state.processes` vem projetado com a fila: sem herdar o anterior, a segunda
   * troca gravaria como anterior a cor da primeira, que nunca esteve no arquivo,
   * e a defesa de `H-25` recusaria a fila inteira para sempre. Mesmo cuidado que
   * `POST /api/edits` tem com `previous`.
   */
  it('herda o anterior da propria fila na segunda troca do mesmo processo', async () => {
    const app = buildApp()
    await patch(app, ROXO)

    // A segunda chega com o painel ja mostrando roxo, porque o store projeta.
    const projetado = state({ processes: [process({ styleKey: 'argb:FFA74F7B' })] })
    await patch(buildApp(projetado), {
      responsible: 'indefinido',
      customsChannel: 'nenhum',
      importerOutsideRj: false,
    })

    expect(queuedColor().previousStyleKey).toBe('argb:FF00FF00')
    expect(queuedColor().label).toBe('Verde (tom A)')
  })

  it('resolve a REF por normKey, como TD-06 define a identidade', async () => {
    const response = await patch(buildApp(), ROXO, 'ft533.26')

    expect(response.statusCode).toBe(201)
    expect(queuedColor().ref).toBe('FT533.26')
  })

  it('404 para REF que nao existe', async () => {
    const response = await patch(buildApp(), ROXO, 'FT000.00')

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('PROCESSO_NAO_ENCONTRADO')
    expect(consolidated(queuePath)).toEqual([])
  })

  /**
   * A cor codifica dimensoes concorrentes (A-31): nem toda combinacao dos tres
   * campos existe na planilha, e inventar a mais proxima e o que a regra
   * inviolavel 3 proibe.
   */
  it('400 para combinacao sem cor correspondente, com a lista das validas', async () => {
    const response = await patch(buildApp(), {
      responsible: 'colaborador2',
      customsChannel: 'vermelho',
      importerOutsideRj: true,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('CORPO_INVALIDO')
    expect(response.json().error.detail.representable).toHaveLength(2)
    expect(consolidated(queuePath)).toEqual([])
  })

  it('400 quando o corpo nao tem os tres campos com os tipos certos', async () => {
    const app = buildApp()

    for (const payload of [
      {},
      { responsible: 'colaborador2', customsChannel: 'nenhum' },
      { responsible: 'colaborador2', customsChannel: 'nenhum', importerOutsideRj: 'nao' },
      { responsible: 42, customsChannel: 'nenhum', importerOutsideRj: false },
    ]) {
      const response = await patch(app, payload)
      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('CORPO_INVALIDO')
    }
    expect(consolidated(queuePath)).toEqual([])
  })

  /**
   * Mexer na fila durante a aplicacao a faz sumir sem ser gravada: o guard tira
   * o instantaneo no inicio e arquiva o arquivo inteiro no fim. Achado do
   * revisor-xml em `H-26`, e vale para a quarta rota que escreve na fila.
   */
  it('409 enquanto uma aplicacao esta em curso', async () => {
    const response = await patch(buildApp(state({ state: 'escrevendo' })), ROXO)

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('ESCRITA_EM_ANDAMENTO')
    expect(consolidated(queuePath)).toEqual([])
  })

  it('503 quando nunca houve leitura', async () => {
    const response = await patch(
      buildApp(
        state({ lastReadAt: null, processes: [], degradedReason: 'Arquivo nao encontrado' }),
      ),
      ROXO,
    )

    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe('ARQUIVO_INDISPONIVEL')
  })

  it('a segunda troca substitui a primeira na fila', async () => {
    const app = buildApp()

    await patch(app, ROXO)
    const response = await patch(app, {
      responsible: 'indefinido',
      customsChannel: 'nenhum',
      importerOutsideRj: false,
    })

    expect(response.json().pendingEditsCount).toBe(1)
    expect(consolidated(queuePath)).toHaveLength(1)
  })
})
