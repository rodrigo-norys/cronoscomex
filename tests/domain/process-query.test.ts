import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIMIT,
  isActive,
  MAX_LIMIT,
  matchesSearch,
  paginate,
  sortProcesses,
} from '../../src/domain/process-query.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

/**
 * Busca, ordenacao e paginacao da Pagina Operacional (`H-17`).
 *
 * As tres sao regra de negocio: o que casa numa busca, onde um nulo cai numa
 * ordenacao e o que a contagem significa nao sao traducao de HTTP.
 *
 * A fabrica e local, como nas demais suites de dominio. Extrair um
 * `tests/support/process-factory.ts` e melhoria real — a mesma fabrica esta
 * repetida em varios arquivos —, mas refatorar as existentes nao cabe nesta
 * fatia, e um helper usado por um teste so criaria duas formas convivendo.
 */

interface Fields {
  sourceRow?: number
  ref?: string
  billOfLading?: string
  container?: string
  clientRaw?: string
  /** Separado de `clientRaw` em `H-90`: a busca casa a CELULA e nao o
      consolidado, e espelhar os dois tornaria a exclusao de `D-34` inexprimivel. */
  clientLabel?: string
  importerRaw?: string
  vesselRaw?: string
  clientKey?: string
  importerKey?: string
  clientGroupKey?: string
  goodsRaw?: string
  vesselKey?: string
  eta2?: Date | null
  registrationDate?: Date | null
  statusCategory?: StatusCategory
}

let nextRow = 2

function makeProcess(fields: Fields = {}): Process {
  const row = fields.sourceRow ?? nextRow++
  return {
    sourceRow: row,
    ref: fields.ref ?? `FT${String(row).padStart(3, '0')}.26`,
    clientRaw: fields.clientRaw ?? '',
    importerRaw: fields.importerRaw ?? '',
    billOfLading: fields.billOfLading ?? '',
    agentRaw: '',
    container: fields.container ?? '',
    vesselRaw: fields.vesselRaw ?? '',
    portRaw: '',
    goodsRaw: fields.goodsRaw ?? '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: fields.eta2 ?? null,
    registrationDate: fields.registrationDate ?? null,
    docsSentDate: null,
    clientKey: fields.clientKey ?? '',
    clientProcessKey: fields.clientKey ?? '',
    clientLabel: fields.clientLabel ?? fields.clientRaw ?? '',
    clientGroupKey: fields.clientGroupKey ?? '',
    importerKey: fields.importerKey ?? '',
    agentKey: '',
    vesselKey: fields.vesselKey ?? '',
    portKey: '',
    goodsKey: '',
    statusCategory: fields.statusCategory ?? 'em_andamento',
    responsible: 'indefinido',
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
  }
}

describe('matchesSearch — A-39 e D-34', () => {
  const processo = makeProcess({
    ref: 'FT501.26',
    billOfLading: 'NBSC260812',
    container: 'TCLU1234567',
  })

  it('casa em REF', () => {
    expect(matchesSearch(processo, 'FT501')).toBe(true)
  })

  it('casa em BL', () => {
    expect(matchesSearch(processo, 'NBSC260')).toBe(true)
  })

  it('casa em CNTR', () => {
    expect(matchesSearch(processo, 'TCLU123')).toBe(true)
  })

  it('e substring, nao prefixo: casa no meio do valor', () => {
    expect(matchesSearch(processo, 'SC2608')).toBe(true)
  })

  it('ignora a caixa', () => {
    expect(matchesSearch(processo, 'nbsc260')).toBe(true)
  })

  it('ignora o acento dos dois lados', () => {
    const comAcento = makeProcess({ ref: 'MERCADORÍA-01' })

    expect(matchesSearch(comAcento, 'mercadoria')).toBe(true)
    expect(matchesSearch(makeProcess({ ref: 'MERCADORIA-01' }), 'mercadoría')).toBe(true)
  })

  it('termo vazio NAO filtra — e o estado inicial do campo', () => {
    expect(matchesSearch(processo, '')).toBe(true)
    expect(matchesSearch(processo, '   ')).toBe(true)
  })

  it('casa no processo do cliente — a CELULA CLT', () => {
    expect(matchesSearch(makeProcess({ clientRaw: 'ABC25004' }), 'ABC250')).toBe(true)
  })

  it('casa no importador', () => {
    expect(matchesSearch(makeProcess({ importerRaw: 'IMPORTACOES DELTA' }), 'IMPORTACOES')).toBe(
      true,
    )
  })

  it('casa no navio', () => {
    expect(matchesSearch(makeProcess({ vesselRaw: 'NAVIO ALFA BRAVO' }), 'BRAVO')).toBe(true)
  })

  /**
   * **A exclusao de `D-34`, e ela precisa de teste proprio.** `clientLabel` e o
   * nome consolidado de `client-map.json`, e nao uma celula: um acerto ali nao
   * seria explicavel pela planilha. `goodsRaw` fica fora por nao ser coluna da
   * tabela. Sem esta assercao a exclusao vira acidente.
   */
  it('nao casa no cliente CONSOLIDADO nem na mercadoria', () => {
    const outro = makeProcess({ ref: 'X', clientLabel: 'ACME LOG', goodsRaw: 'BAZAR' })

    expect(matchesSearch(outro, 'ACME')).toBe(false)
    expect(matchesSearch(outro, 'BAZAR')).toBe(false)
  })

  /** A celula e o consolidado sao campos distintos desde `H-49`, e `D-34`
      escolheu entre eles: um casa, o outro nao. */
  it('separa a celula do consolidado quando os dois diferem', () => {
    const processo = makeProcess({ clientRaw: 'ABC25004', clientLabel: 'GRUPO ACME' })

    expect(matchesSearch(processo, 'ABC')).toBe(true)
    expect(matchesSearch(processo, 'GRUPO ACME')).toBe(false)
  })

  /**
   * **O acento chega a busca por este campo.** REF, BL e CNTR nao tem acento —
   * `fold` sempre o removeu, e ate `D-34` nenhum campo buscavel o exercia.
   */
  it('ignora acento no importador, nos dois sentidos', () => {
    expect(
      matchesSearch(makeProcess({ importerRaw: 'IMPORTAÇÕES DELTA' }), 'importacoes delta'),
    ).toBe(true)
    expect(
      matchesSearch(makeProcess({ importerRaw: 'IMPORTACOES DELTA' }), 'importações delta'),
    ).toBe(true)
  })

  /** Nome de navio tem espaco, e ate `D-34` nenhum campo buscavel tinha: o que
      `fold` preserva deixa de ser detalhe teorico. */
  it('preserva o espaco interno do nome de navio', () => {
    const navio = makeProcess({ vesselRaw: 'NAVIO ALFA BRAVO' })

    expect(matchesSearch(navio, 'NAVIO ALFA')).toBe(true)
    expect(matchesSearch(navio, 'NAVIO  ALFA')).toBe(false)
  })

  /** Termo curto passa a casar muito mais, e a busca NAO ordena por relevancia
      — `H-90` declarou isso fora de escopo. */
  it('termo curto casa em mais de um campo, sem relevancia', () => {
    expect(matchesSearch(makeProcess({ importerRaw: 'K2' }), 'K2')).toBe(true)
    expect(matchesSearch(makeProcess({ container: 'TEMU7887K2' }), 'K2')).toBe(true)
  })

  /** `normKey` colapsa espaco interno porque agrupa; a busca nao pode, senao
   * muda o que casa em relacao ao que o operador ve na tela. */
  it('preserva espaco interno, ao contrario de normKey', () => {
    const comEspacos = makeProcess({ ref: 'AB  CD' })

    expect(matchesSearch(comEspacos, 'AB  CD')).toBe(true)
    expect(matchesSearch(comEspacos, 'AB CD')).toBe(false)
  })
})

describe('isActive — A-16', () => {
  it('desembaracado NAO e ativo', () => {
    expect(isActive(makeProcess({ statusCategory: 'desembaracado' }))).toBe(false)
  })

  it('as outras tres categorias sao ativas, inclusive fechado_aguardando_draft', () => {
    for (const categoria of [
      'em_andamento',
      'em_desembaraco',
      'fechado_aguardando_draft',
    ] as const) {
      expect(isActive(makeProcess({ statusCategory: categoria }))).toBe(true)
    }
  })
})

describe('sortProcesses — nulos sempre por ultimo', () => {
  const comData = makeProcess({ sourceRow: 2, ref: 'B', eta2: new Date(Date.UTC(2026, 7, 10)) })
  const semData = makeProcess({ sourceRow: 3, ref: 'C', eta2: null })
  const anterior = makeProcess({ sourceRow: 4, ref: 'A', eta2: new Date(Date.UTC(2026, 7, 1)) })

  it('ordena por eta2 ascendente', () => {
    const ordenado = sortProcesses([comData, semData, anterior], 'eta2', 'asc')

    expect(ordenado.map((p) => p.ref)).toEqual(['A', 'B', 'C'])
  })

  /**
   * O caso que a implementacao ingenua erra: inverter o comparador inteiro
   * jogaria o nulo para o topo, e o operador que clica para inverter ETA2 veria
   * uma tela de tracos. Nulo e ausencia de valor, nao valor extremo.
   */
  it('mantem o nulo por ultimo TAMBEM em descendente', () => {
    const ordenado = sortProcesses([comData, semData, anterior], 'eta2', 'desc')

    expect(ordenado.map((p) => p.ref)).toEqual(['B', 'A', 'C'])
  })

  it('trata texto vazio como ausencia, nao como menor valor', () => {
    const semCliente = makeProcess({ sourceRow: 9, ref: 'Z', clientKey: '' })
    const comCliente = makeProcess({ sourceRow: 8, ref: 'Y', clientKey: 'ACME' })

    expect(sortProcesses([semCliente, comCliente], 'client', 'asc').map((p) => p.ref)).toEqual([
      'Y',
      'Z',
    ])
    expect(sortProcesses([semCliente, comCliente], 'client', 'desc').map((p) => p.ref)).toEqual([
      'Y',
      'Z',
    ])
  })

  it('desempata por sourceRow, que e unico — sem isso a ordem variaria entre paginas', () => {
    const mesmaData = new Date(Date.UTC(2026, 7, 10))
    const terceiro = makeProcess({ sourceRow: 30, ref: 'C', eta2: mesmaData })
    const primeiro = makeProcess({ sourceRow: 10, ref: 'A', eta2: mesmaData })
    const segundo = makeProcess({ sourceRow: 20, ref: 'B', eta2: mesmaData })

    expect(sortProcesses([terceiro, primeiro, segundo], 'eta2', 'asc').map((p) => p.ref)).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('nao muta a entrada', () => {
    const entrada: readonly Process[] = [comData, anterior]

    sortProcesses(entrada, 'eta2', 'asc')

    expect(entrada.map((p) => p.ref)).toEqual(['B', 'A'])
  })

  it('ordena por ref, registrationDate e vessel', () => {
    const alfa = makeProcess({ sourceRow: 1, ref: 'AAA', vesselKey: 'ZEBRA' })
    const beta = makeProcess({ sourceRow: 2, ref: 'ZZZ', vesselKey: 'ALFA' })

    expect(sortProcesses([beta, alfa], 'ref', 'asc').map((p) => p.ref)).toEqual(['AAA', 'ZZZ'])
    expect(sortProcesses([alfa, beta], 'vessel', 'asc').map((p) => p.ref)).toEqual(['ZZZ', 'AAA'])
  })
})

/**
 * As cinco ordens que 02/09/2026 acrescentou, uma por coluna que a tabela
 * mostrava sem cabecalho clicavel.
 */
describe('sortProcesses — as colunas que nao tinham ordem', () => {
  it('ordena por importador, BL e CNTR, com o vazio por ultimo nos dois sentidos', () => {
    const vazio = makeProcess({ sourceRow: 9, ref: 'Z', importerKey: '', billOfLading: '' })
    const cheio = makeProcess({ sourceRow: 8, ref: 'Y', importerKey: 'ACME', billOfLading: 'BL1' })

    for (const campo of ['importer', 'billOfLading'] as const) {
      expect(sortProcesses([vazio, cheio], campo, 'asc').map((p) => p.ref)).toEqual(['Y', 'Z'])
      expect(sortProcesses([vazio, cheio], campo, 'desc').map((p) => p.ref)).toEqual(['Y', 'Z'])
    }
  })

  /**
   * O caso que justifica as DUAS colunas existirem: `AV-480` e `AV-397` sao o
   * mesmo cliente consolidado e processos diferentes daquele cliente (`H-49`).
   * Ordenar por um nao ordena pelo outro.
   */
  it('separa a ordem do cliente consolidado da ordem da celula CLT', () => {
    const primeiro = makeProcess({ sourceRow: 1, ref: 'A', clientKey: 'ZETA', clientRaw: 'AV-397' })
    const segundo = makeProcess({ sourceRow: 2, ref: 'B', clientKey: 'ALFA', clientRaw: 'AV-480' })

    expect(sortProcesses([primeiro, segundo], 'client', 'asc').map((p) => p.ref)).toEqual([
      'B',
      'A',
    ])
    expect(sortProcesses([primeiro, segundo], 'clientProcess', 'asc').map((p) => p.ref)).toEqual([
      'A',
      'B',
    ])
  })

  it('nao deixa caixa nem acento decidirem a ordem', () => {
    const comAcento = makeProcess({ sourceRow: 1, ref: 'A', container: 'ábaco' })
    const maiuscula = makeProcess({ sourceRow: 2, ref: 'B', container: 'ABACO' })
    const depois = makeProcess({ sourceRow: 3, ref: 'C', container: 'BXYZ' })

    // Os dois primeiros empatam na chave dobrada, e o desempate e `sourceRow`.
    expect(
      sortProcesses([depois, maiuscula, comAcento], 'container', 'asc').map((p) => p.ref),
    ).toEqual(['A', 'B', 'C'])
  })

  /**
   * A ordem e a do FLUXO, e nao a do alfabeto — alfabetica poria
   * "Desembaracado" antes de "Em andamento", invertendo o trabalho.
   */
  it('ordena categoria pelo fluxo declarado em STATUS_CATEGORIES', () => {
    const desembaracado = makeProcess({ sourceRow: 1, ref: 'A', statusCategory: 'desembaracado' })
    const andamento = makeProcess({ sourceRow: 2, ref: 'B', statusCategory: 'em_andamento' })
    const draft = makeProcess({
      sourceRow: 3,
      ref: 'C',
      statusCategory: 'fechado_aguardando_draft',
    })
    const desembaraco = makeProcess({ sourceRow: 4, ref: 'D', statusCategory: 'em_desembaraco' })
    const todos = [desembaracado, andamento, draft, desembaraco]

    expect(sortProcesses(todos, 'status', 'asc').map((p) => p.ref)).toEqual(['B', 'D', 'A', 'C'])
    // Toda linha tem uma das quatro (TD-01): nao ha balde de nulos preso no fim,
    // entao descendente inverte as quatro inteiras.
    expect(sortProcesses(todos, 'status', 'desc').map((p) => p.ref)).toEqual(['C', 'A', 'D', 'B'])
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 649 }, (_, index) => index)

  it('recorta a pagina pedida', () => {
    expect(paginate(items, 200, 0)).toHaveLength(200)
    expect(paginate(items, 200, 200)[0]).toBe(200)
  })

  it('a ultima pagina traz o resto, nao um bloco cheio', () => {
    expect(paginate(items, 200, 600)).toHaveLength(49)
  })

  it('offset alem do fim devolve vazio, nao a ultima pagina', () => {
    expect(paginate(items, 200, 1000)).toEqual([])
  })

  it('os limites do contrato sao 200 e 1000', () => {
    expect(DEFAULT_LIMIT).toBe(200)
    expect(MAX_LIMIT).toBe(1000)
  })
})
