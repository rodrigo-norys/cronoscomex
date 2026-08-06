import { describe, expect, it } from 'vitest'
import { clearedTodayCount, documentaryLeadTime } from '../../src/domain/indicators.ts'
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
}

let nextRow = 2

function process({
  registration = null,
  docsSent = null,
  statusCategory = 'em_andamento',
  statusRaw = '',
}: Fields): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: `FT${String(row).padStart(3, '0')}.26`,
    clientRaw: '',
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
    clientKey: '',
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
