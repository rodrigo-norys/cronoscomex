import { describe, expect, it } from 'vitest'
import {
  aggregateMonthly,
  daysInCategory,
  diffEvents,
  type LastSeen,
  monthOf,
  nextSeen,
  type StatusEvent,
} from '../../src/domain/history.ts'
import type { CustomsChannel, Process, StatusCategory } from '../../src/domain/types.ts'

/**
 * As funcoes puras do historico (`H-28`).
 *
 * O que estes testes protegem, e que nenhuma outra camada consegue proteger:
 * que um evento **so de canal** nao reinicie a contagem de dias parados, e que
 * a serie mensal seja o estado ao FIM de cada mes, nao a contagem de eventos
 * dele. Os dois erros produzem numeros plausiveis e silenciosamente falsos.
 */

const SP = 'America/Sao_Paulo'

function process(
  sourceRow: number,
  statusCategory: StatusCategory,
  customsChannel: CustomsChannel = 'indefinido',
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
    customsChannel,
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
  }
}

function event(
  ref: string,
  ts: string,
  to: StatusCategory,
  from: StatusCategory | null = null,
  channel: CustomsChannel = 'indefinido',
): StatusEvent {
  return { ts, ref, from, to, channel, sourceRow: 10 }
}

function seen(
  category: StatusCategory,
  categoryChangedAt: string,
  channel: CustomsChannel = 'indefinido',
): LastSeen {
  return { category, channel, categoryChangedAt }
}

describe('diffEvents', () => {
  it('gera um evento com from nulo para cada processo na primeira leitura', () => {
    const events = diffEvents(new Map(), [process(10, 'em_andamento')], '2026-08-17T12:00:00.000Z')

    expect(events).toEqual([
      {
        ts: '2026-08-17T12:00:00.000Z',
        ref: 'FT010.26',
        from: null,
        to: 'em_andamento',
        channel: 'indefinido',
        sourceRow: 10,
      },
    ])
  })

  it('nao gera evento algum quando nada mudou', () => {
    const previous = new Map([['FT010.26', seen('em_andamento', '2026-08-01T12:00:00.000Z')]])

    expect(diffEvents(previous, [process(10, 'em_andamento')], '2026-08-17T12:00:00.000Z')).toEqual(
      [],
    )
  })

  it('registra from e to na mudanca de em_andamento para desembaracado', () => {
    const previous = new Map([['FT010.26', seen('em_andamento', '2026-08-01T12:00:00.000Z')]])

    const [evento] = diffEvents(
      previous,
      [process(10, 'desembaracado')],
      '2026-08-17T12:00:00.000Z',
    )

    expect(evento?.from).toBe('em_andamento')
    expect(evento?.to).toBe('desembaracado')
  })

  /**
   * Sem isto a serie mensal de Canal Vermelho seria inderivavel: o canal vem da
   * cor (IND-06) e nunca aparece em `StatusCategory`.
   */
  it('gera evento quando so o canal mudou, com from igual a to', () => {
    const previous = new Map([['FT010.26', seen('em_andamento', '2026-08-01T12:00:00.000Z')]])

    const [evento] = diffEvents(
      previous,
      [process(10, 'em_andamento', 'vermelho')],
      '2026-08-17T12:00:00.000Z',
    )

    expect(evento?.from).toBe('em_andamento')
    expect(evento?.to).toBe('em_andamento')
    expect(evento?.channel).toBe('vermelho')
  })

  it('nao gera evento por REF que sumiu da planilha', () => {
    const previous = new Map([
      ['FT010.26', seen('em_andamento', '2026-08-01T12:00:00.000Z')],
      ['FT011.26', seen('em_andamento', '2026-08-01T12:00:00.000Z')],
    ])

    expect(diffEvents(previous, [process(10, 'em_andamento')], '2026-08-17T12:00:00.000Z')).toEqual(
      [],
    )
  })
})

describe('nextSeen', () => {
  it('marca a mudanca de categoria com o ts do evento', () => {
    const antes = seen('em_andamento', '2026-08-01T12:00:00.000Z')
    const depois = nextSeen(antes, event('FT010.26', '2026-08-17T12:00:00.000Z', 'desembaracado'))

    expect(depois.categoryChangedAt).toBe('2026-08-17T12:00:00.000Z')
  })

  /** O ponto do desenho: trocar a cor nao pode apagar o alerta de parado. */
  it('preserva a data da categoria quando so o canal mudou', () => {
    const antes = seen('em_andamento', '2026-08-01T12:00:00.000Z')
    const depois = nextSeen(
      antes,
      event('FT010.26', '2026-08-17T12:00:00.000Z', 'em_andamento', 'em_andamento', 'vermelho'),
    )

    expect(depois.categoryChangedAt).toBe('2026-08-01T12:00:00.000Z')
    expect(depois.channel).toBe('vermelho')
  })
})

describe('daysInCategory', () => {
  it('devolve null para REF sem evento algum', () => {
    expect(daysInCategory(undefined, new Date('2026-08-17T00:00:00.000Z'), SP)).toBeNull()
  })

  it('conta 16 dias corridos entre 01/08 e 17/08', () => {
    const dias = daysInCategory(
      seen('em_andamento', '2026-08-01T15:00:00.000Z'),
      new Date('2026-08-17T00:00:00.000Z'),
      SP,
    )

    expect(dias).toBe(16)
  })

  /**
   * 23h em Sao Paulo e o dia seguinte em UTC. Comparar o instante cru com o dia
   * civil daria 1, e ALE-06 erraria por um dia em toda leitura noturna.
   */
  it('reduz o instante ao dia civil do fuso antes de subtrair', () => {
    const dias = daysInCategory(
      seen('em_andamento', '2026-08-18T02:00:00.000Z'),
      new Date('2026-08-17T00:00:00.000Z'),
      SP,
    )

    expect(dias).toBe(0)
  })

  it('devolve null quando o ts gravado nao e uma data', () => {
    expect(daysInCategory(seen('em_andamento', 'nao-e-data'), new Date(), SP)).toBeNull()
  })
})

describe('monthOf', () => {
  it('usa o mes civil do fuso, nao o de UTC', () => {
    expect(monthOf(new Date('2026-09-01T02:00:00.000Z'), SP)).toBe('2026-08')
  })
})

describe('aggregateMonthly', () => {
  const hoje = new Date('2026-10-15T00:00:00.000Z')

  it('devolve serie vazia sem evento algum', () => {
    expect(aggregateMonthly([], 12, hoje, SP)).toEqual({ series: [], truncated: false })
  })

  it('conta o estado ao fim de cada mes, nao os eventos dele', () => {
    const { series } = aggregateMonthly(
      [
        event('A', '2026-08-10T12:00:00.000Z', 'em_andamento'),
        event('B', '2026-08-11T12:00:00.000Z', 'em_andamento'),
        event('A', '2026-09-05T12:00:00.000Z', 'desembaracado', 'em_andamento'),
      ],
      12,
      hoje,
      SP,
    )

    expect(series).toEqual([
      { month: '2026-08', total: 2, desembaracados: 0, canalVermelho: 0 },
      { month: '2026-09', total: 2, desembaracados: 1, canalVermelho: 0 },
      { month: '2026-10', total: 2, desembaracados: 1, canalVermelho: 0 },
    ])
  })

  /** Ausencia de mudanca nao e ausencia de processos — criterio de `H-21`. */
  it('repete o ponto anterior num mes sem evento algum', () => {
    const { series } = aggregateMonthly(
      [
        event('A', '2026-08-10T12:00:00.000Z', 'em_andamento'),
        event('A', '2026-10-05T12:00:00.000Z', 'desembaracado', 'em_andamento'),
      ],
      12,
      hoje,
      SP,
    )

    expect(series.map((ponto) => ponto.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(series[1]).toEqual({
      month: '2026-09',
      total: 1,
      desembaracados: 0,
      canalVermelho: 0,
    })
  })

  it('conta canal vermelho a partir do canal gravado no evento', () => {
    const { series } = aggregateMonthly(
      [
        event('A', '2026-10-01T12:00:00.000Z', 'em_andamento', null, 'vermelho'),
        event('B', '2026-10-02T12:00:00.000Z', 'em_andamento', null, 'indefinido'),
      ],
      1,
      hoje,
      SP,
    )

    expect(series).toEqual([{ month: '2026-10', total: 2, desembaracados: 0, canalVermelho: 1 }])
  })

  it('deixa de contar canal vermelho quando a cor da linha saiu', () => {
    const { series } = aggregateMonthly(
      [
        event('A', '2026-09-01T12:00:00.000Z', 'em_andamento', null, 'vermelho'),
        event('A', '2026-10-01T12:00:00.000Z', 'em_andamento', 'em_andamento', 'indefinido'),
      ],
      2,
      hoje,
      SP,
    )

    expect(series.map((ponto) => ponto.canalVermelho)).toEqual([1, 0])
  })

  it('marca truncated quando a janela pedida excede o historico', () => {
    const events = [event('A', '2026-10-01T12:00:00.000Z', 'em_andamento')]

    expect(aggregateMonthly(events, 12, hoje, SP).truncated).toBe(true)
    expect(aggregateMonthly(events, 1, hoje, SP).truncated).toBe(false)
  })

  it('corta a serie na janela pedida, mantendo os meses mais recentes', () => {
    const { series } = aggregateMonthly(
      [
        event('A', '2026-07-01T12:00:00.000Z', 'em_andamento'),
        event('B', '2026-10-01T12:00:00.000Z', 'em_andamento'),
      ],
      2,
      hoje,
      SP,
    )

    expect(series.map((ponto) => ponto.month)).toEqual(['2026-09', '2026-10'])
  })

  it('atravessa a virada de ano', () => {
    const { series } = aggregateMonthly(
      [event('A', '2026-11-01T12:00:00.000Z', 'em_andamento')],
      12,
      new Date('2027-01-15T00:00:00.000Z'),
      SP,
    )

    expect(series.map((ponto) => ponto.month)).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})
