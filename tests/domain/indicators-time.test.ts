import { describe, expect, it } from 'vitest'
import {
  clearedTodayCount,
  documentaryLeadTime,
  leadTimeByGroup,
} from '../../src/domain/indicators.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/** Todos os criterios de aceite de H-13 partem deste dia. */
const HOJE = civil('2026-08-03')

interface Fields {
  registration?: string | null
  docsSent?: string | null
  statusCategory?: StatusCategory
  statusRaw?: string
  clientKey?: string
  clientRaw?: string
}

let nextRow = 2

function process({
  registration = null,
  docsSent = null,
  statusCategory = 'em_andamento',
  statusRaw = '',
  clientKey = '',
  clientRaw = '',
}: Fields): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: `FT${String(row).padStart(3, '0')}.26`,
    clientRaw,
    importerRaw: '',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: '',
    statusRaw,
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: null,
    registrationDate: registration === null ? null : civil(registration),
    docsSentDate: docsSent === null ? null : civil(docsSent),
    clientKey,
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory,
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
  }
}

describe('clearedTodayCount — IND-16', () => {
  it('conta RG igual a hoje em processo desembaracado', () => {
    const concluido = process({ registration: '2026-08-03', statusCategory: 'desembaracado' })

    expect(clearedTodayCount([concluido], HOJE)).toBe(1)
  })

  /**
   * O caso da linha amarela da foto 2 (A-05): RG preenchido em processo que nao
   * concluiu. Sem o cruzamento com a categoria — acrescentado por A-29 — o
   * indicador contaria um desembaraco que nao aconteceu.
   */
  it('nao conta RG de hoje em processo em andamento', () => {
    const emAndamento = process({
      registration: '2026-08-03',
      statusCategory: 'em_andamento',
      statusRaw: 'DUIMP: 26BR0001247418-6 - CANAL AMARELO',
    })

    expect(clearedTodayCount([emAndamento], HOJE)).toBe(0)
  })

  it('nao conta as demais categorias nao concluidas', () => {
    const conjunto = [
      process({ registration: '2026-08-03', statusCategory: 'em_desembaraco' }),
      process({ registration: '2026-08-03', statusCategory: 'fechado_aguardando_draft' }),
    ]

    expect(clearedTodayCount(conjunto, HOJE)).toBe(0)
  })

  it('nao conta RG de ontem nem de amanha', () => {
    const conjunto = [
      process({ registration: '2026-08-02', statusCategory: 'desembaracado' }),
      process({ registration: '2026-08-04', statusCategory: 'desembaracado' }),
    ]

    expect(clearedTodayCount(conjunto, HOJE)).toBe(0)
  })

  // A-20: data ausente nunca satisfaz condicao de calendario.
  it('nao conta RG nulo, mesmo em processo desembaracado', () => {
    const semRegistro = process({ registration: null, statusCategory: 'desembaracado' })

    expect(clearedTodayCount([semRegistro], HOJE)).toBe(0)
  })

  it('conta apenas os que satisfazem as duas condicoes num conjunto misto', () => {
    const conjunto = [
      process({ registration: '2026-08-03', statusCategory: 'desembaracado' }),
      process({ registration: '2026-08-03', statusCategory: 'desembaracado' }),
      process({ registration: '2026-08-03', statusCategory: 'em_andamento' }),
      process({ registration: '2026-08-02', statusCategory: 'desembaracado' }),
      process({ registration: null, statusCategory: 'desembaracado' }),
    ]

    expect(clearedTodayCount(conjunto, HOJE)).toBe(2)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(clearedTodayCount([], HOJE)).toBe(0)
  })
})

describe('documentaryLeadTime — IND-22', () => {
  // A-02: RG e a extremidade FINAL do intervalo. A ordem inversa da
  // especificacao produziria negativo em todo par valido.
  it('mede RG menos DOCS ENVIADOS, positivo', () => {
    const par = process({ docsSent: '2026-07-20', registration: '2026-07-30' })

    expect(documentaryLeadTime([par])).toEqual({
      averageDays: 10,
      sampleSize: 1,
      excludedNegative: 0,
      excludedIncomplete: 0,
    })
  })

  it('inclui o intervalo zero, quando as duas datas coincidem', () => {
    const mesmoDia = process({ docsSent: '2026-07-20', registration: '2026-07-20' })

    expect(documentaryLeadTime([mesmoDia])).toMatchObject({ averageDays: 0, sampleSize: 1 })
  })

  it('exclui e conta o intervalo negativo (A-30)', () => {
    const invertido = process({ docsSent: '2026-07-30', registration: '2026-07-20' })

    expect(documentaryLeadTime([invertido])).toEqual({
      averageDays: null,
      sampleSize: 0,
      excludedNegative: 1,
      excludedIncomplete: 0,
    })
  })

  it('exclui e conta o par incompleto com DOCS ENVIADOS nulo', () => {
    const semDocumento = process({ docsSent: null, registration: '2026-07-30' })

    expect(documentaryLeadTime([semDocumento])).toMatchObject({
      sampleSize: 0,
      excludedIncomplete: 1,
      excludedNegative: 0,
    })
  })

  it('exclui e conta o par incompleto com RG nulo', () => {
    const semRegistro = process({ docsSent: '2026-07-20', registration: null })

    expect(documentaryLeadTime([semRegistro])).toMatchObject({
      sampleSize: 0,
      excludedIncomplete: 1,
    })
  })

  it('conta como incompleto quando ambas as datas sao nulas', () => {
    expect(documentaryLeadTime([process({})])).toMatchObject({
      sampleSize: 0,
      excludedIncomplete: 1,
    })
  })

  // `fechado_aguardando_draft` tem REF e nada mais: as duas datas sao nulas.
  it('conta o processo fechado aguardando draft como incompleto', () => {
    const semDado = process({ statusCategory: 'fechado_aguardando_draft' })

    expect(documentaryLeadTime([semDado])).toMatchObject({
      sampleSize: 0,
      excludedIncomplete: 1,
    })
  })

  it('devolve a media com uma casa decimal', () => {
    const conjunto = [
      process({ docsSent: '2026-07-20', registration: '2026-07-30' }),
      process({ docsSent: '2026-07-20', registration: '2026-07-31' }),
    ]

    expect(documentaryLeadTime(conjunto).averageDays).toBe(10.5)
  })

  it('arredonda a media na primeira casa', () => {
    const conjunto = [
      process({ docsSent: '2026-07-20', registration: '2026-07-30' }),
      process({ docsSent: '2026-07-20', registration: '2026-07-30' }),
      process({ docsSent: '2026-07-20', registration: '2026-07-31' }),
    ]

    expect(documentaryLeadTime(conjunto).averageDays).toBe(10.3)
  })

  /**
   * Media de conjunto vazio NAO e zero (A-42). Zero dias significaria documento
   * enviado no mesmo dia do registro — afirmacao forte sobre dado que nao existe.
   */
  it('devolve averageDays nulo quando nenhum par e valido', () => {
    const conjunto = [
      process({ docsSent: '2026-07-30', registration: '2026-07-20' }),
      process({ docsSent: null, registration: '2026-07-30' }),
      process({}),
    ]

    expect(documentaryLeadTime(conjunto)).toEqual({
      averageDays: null,
      sampleSize: 0,
      excludedNegative: 1,
      excludedIncomplete: 2,
    })
  })

  it('devolve o bloco zerado para conjunto vazio, com averageDays nulo', () => {
    expect(documentaryLeadTime([])).toEqual({
      averageDays: null,
      sampleSize: 0,
      excludedNegative: 0,
      excludedIncomplete: 0,
    })
  })

  it('separa incluidos e excluidos num conjunto misto', () => {
    const conjunto = [
      process({ docsSent: '2026-07-20', registration: '2026-07-30' }),
      process({ docsSent: '2026-07-25', registration: '2026-07-31' }),
      process({ docsSent: '2026-07-30', registration: '2026-07-20' }),
      process({ docsSent: null, registration: '2026-07-30' }),
      process({ docsSent: '2026-07-20', registration: null }),
    ]

    expect(documentaryLeadTime(conjunto)).toEqual({
      averageDays: 8,
      sampleSize: 2,
      excludedNegative: 1,
      excludedIncomplete: 2,
    })
  })
})

/**
 * `leadTimeByGroup` — IND-22 por dimensao (`H-19`).
 *
 * O agregado de `documentaryLeadTime` continua sendo a referencia: estas
 * assercoes fixam o que a quebra acrescenta — a ordem, o grupo sem amostra e a
 * ausencia de teto.
 */
const porCliente = (processes: Process[]) =>
  leadTimeByGroup(
    processes,
    (p) => p.clientKey,
    (p) => p.clientRaw,
  )

describe('leadTimeByGroup — a quebra de IND-22 (H-19)', () => {
  it('calcula a media dentro de cada grupo, nao entre grupos', () => {
    const grupos = porCliente([
      process({
        clientKey: 'A',
        clientRaw: 'A',
        docsSent: '2026-07-01',
        registration: '2026-07-11',
      }),
      process({
        clientKey: 'A',
        clientRaw: 'A',
        docsSent: '2026-07-01',
        registration: '2026-07-21',
      }),
      process({
        clientKey: 'B',
        clientRaw: 'B',
        docsSent: '2026-07-01',
        registration: '2026-07-03',
      }),
    ])

    expect(grupos.find((g) => g.key === 'A')?.averageDays).toBe(15)
    expect(grupos.find((g) => g.key === 'B')?.averageDays).toBe(2)
  })

  /**
   * A ordem e o que faz a tabela servir. Por volume, o topo seriam os maiores
   * grupos — que na planilha real quase nao tem par completo: dos 509 grupos de
   * cliente, 425 nao tem nenhum. A media ficaria fora do corte.
   */
  it('ordena por tamanho da amostra, nao por volume', () => {
    const volumosoSemAmostra = Array.from({ length: 5 }, () =>
      process({ clientKey: 'GRANDE', clientRaw: 'Grande' }),
    )
    const pequenoComAmostra = [
      process({
        clientKey: 'PEQUENO',
        clientRaw: 'Pequeno',
        docsSent: '2026-07-01',
        registration: '2026-07-06',
      }),
    ]

    const grupos = porCliente([...volumosoSemAmostra, ...pequenoComAmostra])

    expect(grupos.map((g) => g.key)).toEqual(['PEQUENO', 'GRANDE'])
    expect(grupos[0]?.count).toBe(1)
    expect(grupos[1]?.count).toBe(5)
  })

  it('desempata por volume e depois pela chave, para a ordem nao oscilar', () => {
    const semAmostra = (key: string, quantos: number) =>
      Array.from({ length: quantos }, () => process({ clientKey: key, clientRaw: key }))

    const grupos = porCliente([
      ...semAmostra('ZULU', 2),
      ...semAmostra('ALFA', 2),
      ...semAmostra('BRAVO', 3),
    ])

    expect(grupos.map((g) => g.key)).toEqual(['BRAVO', 'ALFA', 'ZULU'])
  })

  // Grupo sem par completo permanece na lista: sumir com ele esconderia que o
  // campo nao e preenchido para aquele grupo (regra inviolavel 3).
  it('mantem o grupo sem nenhum par completo, com media nula', () => {
    const grupos = porCliente([process({ clientKey: 'VAZIO', clientRaw: 'Vazio' })])

    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.averageDays).toBeNull()
    expect(grupos[0]?.sampleSize).toBe(0)
    expect(grupos[0]?.excludedIncomplete).toBe(1)
  })

  it('exibe media com amostra 1, sem corte minimo (A-42)', () => {
    const grupos = porCliente([
      process({
        clientKey: 'UNICO',
        clientRaw: 'Unico',
        docsSent: '2026-07-01',
        registration: '2026-07-08',
      }),
    ])

    expect(grupos[0]?.averageDays).toBe(7)
    expect(grupos[0]?.sampleSize).toBe(1)
  })

  it('devolve uma casa decimal na media fracionaria', () => {
    const grupos = porCliente([
      process({
        clientKey: 'X',
        clientRaw: 'X',
        docsSent: '2026-07-01',
        registration: '2026-07-03',
      }),
      process({
        clientKey: 'X',
        clientRaw: 'X',
        docsSent: '2026-07-01',
        registration: '2026-07-04',
      }),
      process({
        clientKey: 'X',
        clientRaw: 'X',
        docsSent: '2026-07-01',
        registration: '2026-07-04',
      }),
    ])

    expect(grupos[0]?.averageDays).toBe(2.7)
  })

  // As duas exclusoes de A-30 sao contadas dentro do grupo, como no agregado.
  it('conta o intervalo negativo no grupo, sem silencia-lo', () => {
    const grupos = porCliente([
      process({
        clientKey: 'N',
        clientRaw: 'N',
        docsSent: '2026-07-10',
        registration: '2026-07-01',
      }),
    ])

    expect(grupos[0]?.excludedNegative).toBe(1)
    expect(grupos[0]?.sampleSize).toBe(0)
    expect(grupos[0]?.averageDays).toBeNull()
  })

  it('todos os pares incompletos deixam todas as medias em traco', () => {
    const grupos = porCliente([
      process({ clientKey: 'A', clientRaw: 'A' }),
      process({ clientKey: 'B', clientRaw: 'B', docsSent: '2026-07-01' }),
      process({ clientKey: 'C', clientRaw: 'C', registration: '2026-07-01' }),
    ])

    expect(grupos.every((g) => g.averageDays === null)).toBe(true)
    expect(grupos.every((g) => g.excludedIncomplete === 1)).toBe(true)
  })

  /**
   * Quem corta nao pode ser quem conta: a rota precisa do total de grupos para
   * informar quantos ficaram de fora, e um teto aqui apagaria esse numero antes
   * de alguem poder exibi-lo (regra inviolavel 2).
   */
  it('nao aplica teto — devolve todos os grupos', () => {
    const muitos = Array.from({ length: 30 }, (_, index) =>
      process({ clientKey: `C${index}`, clientRaw: `C${index}` }),
    )

    expect(porCliente(muitos)).toHaveLength(30)
  })

  it('agrupa a chave vazia como as demais, sem descartar', () => {
    const grupos = porCliente([process({ clientKey: '', clientRaw: '' })])

    expect(grupos.map((g) => g.key)).toEqual([''])
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(porCliente([])).toEqual([])
  })

  /**
   * A soma das quebras reproduz o agregado. Se divergirem, uma das duas esta
   * errada — e a quebra e a nova.
   */
  it('reproduz o agregado quando somada', () => {
    const conjunto = [
      process({
        clientKey: 'A',
        clientRaw: 'A',
        docsSent: '2026-07-01',
        registration: '2026-07-11',
      }),
      process({
        clientKey: 'B',
        clientRaw: 'B',
        docsSent: '2026-07-01',
        registration: '2026-07-03',
      }),
      process({ clientKey: 'B', clientRaw: 'B' }),
      process({
        clientKey: 'C',
        clientRaw: 'C',
        docsSent: '2026-07-10',
        registration: '2026-07-01',
      }),
    ]
    const agregado = documentaryLeadTime(conjunto)
    const grupos = porCliente(conjunto)

    const soma = (campo: 'sampleSize' | 'excludedNegative' | 'excludedIncomplete') =>
      grupos.reduce((total, grupo) => total + grupo[campo], 0)

    expect(soma('sampleSize')).toBe(agregado.sampleSize)
    expect(soma('excludedNegative')).toBe(agregado.excludedNegative)
    expect(soma('excludedIncomplete')).toBe(agregado.excludedIncomplete)
  })
})
