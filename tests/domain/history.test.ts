import { describe, expect, it } from 'vitest'
import {
  aggregateMonthly,
  daysInCategory,
  diffEvents,
  type LastSeen,
  monthOf,
  nextSeen,
  reconstructMonthly,
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
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
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

/**
 * `H-54`. A serie reconstruida das DATAS da planilha, ao lado da observada.
 *
 * As duas medidas sao ESTOQUE ao fim do mes, a mesma grandeza de
 * `aggregateMonthly` — so assim as series sao comparaveis no mesmo eixo.
 */
describe('reconstructMonthly — H-54', () => {
  const HOJE = new Date('2026-08-15T00:00:00Z')

  /** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
  const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

  function datado(row: number, eta2: string | null, registration: string | null): Process {
    return {
      ...process(row, 'em_andamento'),
      eta2: eta2 === null ? null : civil(eta2),
      registrationDate: registration === null ? null : civil(registration),
    }
  }

  it('acumula as duas medidas mes a mes', () => {
    const conjunto = [
      datado(2, '2026-01-10', '2026-02-05'),
      datado(3, '2026-02-20', '2026-03-01'),
      datado(4, '2026-03-15', null),
    ]

    const { points } = reconstructMonthly(conjunto, HOJE, SP)

    expect(points.map((p) => [p.month, p.chegados, p.desembaracados])).toEqual([
      ['2026-01', 1, 0],
      ['2026-02', 2, 1],
      ['2026-03', 3, 2],
    ])
  })

  // O criterio de aceite: nenhum mes do intervalo fica ausente. Mes sem
  // processo repete o acumulado, e nao abre buraco — buraco no eixo sugere dado
  // faltando onde ha dado medido.
  it('nao deixa buraco entre a primeira e a ultima data', () => {
    const conjunto = [datado(2, '2026-01-10', null), datado(3, '2026-05-10', null)]

    const { points } = reconstructMonthly(conjunto, HOJE, SP)

    expect(points.map((p) => p.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ])
    expect(points.map((p) => p.chegados)).toEqual([1, 1, 1, 1, 2])
  })

  // A virada de ano, que a planilha real atravessa: `ETA2` comeca em dez/2025.
  it('atravessa a virada de ano', () => {
    const conjunto = [datado(2, '2025-12-30', null), datado(3, '2026-02-01', null)]

    const { points } = reconstructMonthly(conjunto, HOJE, SP)

    expect(points.map((p) => p.month)).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  // Regra inviolavel 2: quem nao tem data nao pertence a mes nenhum (A-20), e
  // sumir sem contagem seria descarte silencioso.
  it('conta separadamente quem nao tem cada data', () => {
    const conjunto = [
      datado(2, '2026-01-10', '2026-01-20'),
      datado(3, null, '2026-02-10'),
      datado(4, '2026-03-10', null),
      datado(5, null, null),
    ]

    const resultado = reconstructMonthly(conjunto, HOJE, SP)

    expect(resultado.missingEta2).toBe(2)
    expect(resultado.missingRegistration).toBe(2)
    // O sem ETA2 nao entra em `chegados`, mas o RG dele entra em
    // `desembaracados`: sao duas medidas independentes.
    expect(resultado.points.at(-1)?.chegados).toBe(2)
    expect(resultado.points.at(-1)?.desembaracados).toBe(2)
  })

  // O caso-limite do backlog: 18 processos com ETA2 em set/2026, medido em
  // 31/08/2026. A serie vai ate o ultimo mes datado, e o trecho futuro e
  // marcado como previsao — nao omitido.
  it('marca como previsao o mes posterior ao corrente, sem corta-lo', () => {
    const conjunto = [datado(2, '2026-08-01', null), datado(3, '2026-09-05', null)]

    const { points } = reconstructMonthly(conjunto, HOJE, SP)

    expect(points.map((p) => [p.month, p.forecast])).toEqual([
      ['2026-08', false],
      ['2026-09', true],
    ])
  })

  it('nao marca previsao no proprio mes corrente', () => {
    const { points } = reconstructMonthly([datado(2, '2026-08-31', null)], HOJE, SP)

    expect(points[0]?.forecast).toBe(false)
  })

  // Regra inviolavel 3: sem data nenhuma nao ha serie, e nao uma serie de zeros
  // que pareceria medida.
  it('devolve serie vazia quando nenhum processo tem data, com os ausentes contados', () => {
    const resultado = reconstructMonthly([datado(2, null, null)], HOJE, SP)

    expect(resultado.points).toEqual([])
    expect(resultado.missingEta2).toBe(1)
    expect(resultado.missingRegistration).toBe(1)
  })

  it('devolve tudo vazio para conjunto vazio', () => {
    expect(reconstructMonthly([], HOJE, SP)).toEqual({
      points: [],
      missingEta2: 0,
      missingRegistration: 0,
    })
  })

  // A reconstrucao nao olha para a categoria: ela conta DATAS. Quem cruza data
  // com categoria e IND-16 e `clearedInPeriodCount` (`H-52`).
  it('conta a data de registro independentemente da categoria', () => {
    const conjunto = [
      { ...datado(2, '2026-01-10', '2026-01-20'), statusCategory: 'em_andamento' as const },
    ]

    expect(reconstructMonthly(conjunto, HOJE, SP).points[0]?.desembaracados).toBe(1)
  })
})
