import { describe, expect, it } from 'vitest'
import {
  addDays,
  diffDays,
  isoWeekEnd,
  isWithin,
  today,
  toIsoDay,
} from '../../src/domain/date-window.ts'

const SP = 'America/Sao_Paulo'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

describe('today — o fuso entra em um unico ponto', () => {
  it('devolve o dia civil ancorado em UTC', () => {
    const resultado = today(SP, new Date('2026-08-03T15:00:00Z'))

    expect(toIsoDay(resultado)).toBe('2026-08-03')
    expect(resultado.getTime()).toBe(civil('2026-08-03').getTime())
  })

  // 23h30 em Sao Paulo ja e 02h30 do dia seguinte em UTC. Sem a conversao, toda
  // consulta feita a noite compararia contra o dia errado.
  it('usa o dia de Sao Paulo, nao o de UTC, na virada da noite', () => {
    expect(toIsoDay(today(SP, new Date('2026-08-04T02:30:00Z')))).toBe('2026-08-03')
  })

  it('nao antecipa o dia de madrugada', () => {
    expect(toIsoDay(today(SP, new Date('2026-08-04T03:00:00Z')))).toBe('2026-08-04')
  })

  it('respeita o fuso informado', () => {
    const instante = new Date('2026-08-04T02:30:00Z')

    expect(toIsoDay(today('UTC', instante))).toBe('2026-08-04')
    expect(toIsoDay(today(SP, instante))).toBe('2026-08-03')
  })
})

describe('isoWeekEnd — semana ISO, segunda a domingo (A-07)', () => {
  const casos: [string, string, string][] = [
    ['segunda', '2026-08-03', '2026-08-09'],
    ['terca', '2026-08-04', '2026-08-09'],
    ['quarta', '2026-08-05', '2026-08-09'],
    ['quinta', '2026-08-06', '2026-08-09'],
    ['sexta', '2026-08-07', '2026-08-09'],
    ['sabado', '2026-08-08', '2026-08-09'],
    ['domingo', '2026-08-09', '2026-08-09'],
  ]

  for (const [dia, entrada, esperado] of casos) {
    it(`${dia} ${entrada} encerra em ${esperado}`, () => {
      expect(toIsoDay(isoWeekEnd(civil(entrada)))).toBe(esperado)
    })
  }

  // O domingo e o SETIMO dia da semana ISO, nao o primeiro.
  it('no domingo devolve o proprio dia, nao o domingo seguinte', () => {
    expect(toIsoDay(isoWeekEnd(civil('2026-08-09')))).toBe('2026-08-09')
  })

  it('atravessa a virada de mes', () => {
    expect(toIsoDay(isoWeekEnd(civil('2026-08-31')))).toBe('2026-09-06')
  })

  it('atravessa a virada de ano', () => {
    expect(toIsoDay(isoWeekEnd(civil('2026-12-31')))).toBe('2027-01-03')
  })
})

describe('addDays', () => {
  it('soma mantendo a ancora UTC', () => {
    expect(toIsoDay(addDays(civil('2026-08-03'), 15))).toBe('2026-08-18')
  })

  it('subtrai com valor negativo', () => {
    expect(toIsoDay(addDays(civil('2026-08-03'), -3))).toBe('2026-07-31')
  })

  it('atravessa fevereiro de ano bissexto', () => {
    expect(toIsoDay(addDays(civil('2028-02-28'), 1))).toBe('2028-02-29')
  })

  it('devolve nova instancia, sem mutar a original', () => {
    const origem = civil('2026-08-03')

    addDays(origem, 10)

    expect(toIsoDay(origem)).toBe('2026-08-03')
  })
})

describe('diffDays', () => {
  it('conta os dias inteiros entre duas ancoras', () => {
    expect(diffDays(civil('2026-07-20'), civil('2026-07-30'))).toBe(10)
  })

  it('devolve zero para a mesma data', () => {
    expect(diffDays(civil('2026-07-20'), civil('2026-07-20'))).toBe(0)
  })

  it('devolve negativo quando a ordem se inverte', () => {
    expect(diffDays(civil('2026-07-30'), civil('2026-07-20'))).toBe(-10)
  })

  it('atravessa fevereiro de ano bissexto', () => {
    expect(diffDays(civil('2028-02-28'), civil('2028-03-01'))).toBe(2)
  })

  // O horario de verao nao existe para data civil ancorada em UTC (TD-03).
  it('nao perde nem ganha dia na virada de outubro', () => {
    expect(diffDays(civil('2026-10-01'), civil('2026-11-01'))).toBe(31)
  })

  it('e o inverso de addDays', () => {
    const origem = civil('2026-08-03')

    expect(diffDays(origem, addDays(origem, 15))).toBe(15)
  })
})

describe('isWithin — extremos inclusivos (A-35)', () => {
  const de = civil('2026-08-03')
  const ate = civil('2026-08-18')

  it('inclui o extremo inicial', () => {
    expect(isWithin(civil('2026-08-03'), de, ate)).toBe(true)
  })

  it('inclui o extremo final', () => {
    expect(isWithin(civil('2026-08-18'), de, ate)).toBe(true)
  })

  it('exclui o dia seguinte ao extremo final', () => {
    expect(isWithin(civil('2026-08-19'), de, ate)).toBe(false)
  })

  it('exclui o dia anterior ao extremo inicial', () => {
    expect(isWithin(civil('2026-08-02'), de, ate)).toBe(false)
  })

  // A-20: data ausente nunca satisfaz condicao de calendario.
  it('devolve false para null', () => {
    expect(isWithin(null, de, ate)).toBe(false)
  })
})
