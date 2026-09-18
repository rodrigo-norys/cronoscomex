import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_HORIZON_DAYS,
  arrivalCalendar,
  arrivingIn15Days,
  arrivingTodayWhite,
  expectedVessels,
} from '../../src/domain/indicators.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/** Segunda-feira. Todos os casos de aceite partem daqui. */
const HOJE = civil('2026-08-03')

interface Fields {
  eta2?: string | null
  vessel?: string
  statusCategory?: StatusCategory
  styleKey?: string
}

/** A chave branca do arquivo real — `<fgColor theme="0"/>`, sem tint (TD-05). */
const BRANCO = 'theme:0|tint:0.0000'
const BRANCAS: ReadonlySet<string> = new Set([BRANCO])

let nextRow = 2

function process({
  eta2 = null,
  vessel = '',
  statusCategory = 'em_andamento',
  styleKey = BRANCO,
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
    vesselRaw: vessel,
    portRaw: '',
    goodsRaw: '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: eta2 === null ? null : civil(eta2),
    registrationDate: null,
    docsSentDate: null,
    clientKey: '',
    clientProcessKey: '',
    clientLabel: '',
    clientGroupKey: '',
    importerKey: '',
    agentKey: '',
    vesselKey: vessel.trim().toUpperCase(),
    portKey: '',
    goodsKey: '',
    statusCategory,
    responsible: 'indefinido',
    responsibleLabel: 'Indefinido',
    colorResponsible: 'indefinido',
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey,
    cellStyleKeys: {},
    fills: {},
    anomalies: [],
  }
}

describe('indicadores de calendario — os dois cartoes', () => {
  it('eta2 igual a hoje conta nos dois, com a linha branca', () => {
    const processes = [process({ eta2: '2026-08-03' })]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(1)
    expect(arrivingIn15Days(processes, HOJE)).toBe(1)
  })

  // `D-49`: a cor entrou no cartao, e e a da celula-ancora.
  it('linha NAO branca nao conta em chegandoHoje, mesmo com eta2 de hoje', () => {
    const processes = [process({ eta2: '2026-08-03', styleKey: 'argb:FF00FF00' })]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(0)
    expect(arrivingIn15Days(processes, HOJE)).toBe(1)
  })

  // Regra inviolavel 3: ausencia de cor declarada nao e branco.
  it('linha sem preenchimento nao conta como branca', () => {
    expect(
      arrivingTodayWhite([process({ eta2: '2026-08-03', styleKey: 'none' })], HOJE, BRANCAS),
    ).toBe(0)
  })

  it('conjunto de chaves brancas vazio zera o cartao', () => {
    expect(arrivingTodayWhite([process({ eta2: '2026-08-03' })], HOJE, new Set())).toBe(0)
  })

  it('branca com eta2 de outro dia nao conta', () => {
    expect(arrivingTodayWhite([process({ eta2: '2026-08-04' })], HOJE, BRANCAS)).toBe(0)
  })

  it('hoje + 15 conta em chegando15Dias — extremo inclusivo (A-35)', () => {
    expect(arrivingIn15Days([process({ eta2: '2026-08-18' })], HOJE)).toBe(1)
  })

  it('hoje + 16 nao conta', () => {
    expect(arrivingIn15Days([process({ eta2: '2026-08-19' })], HOJE)).toBe(0)
  })

  // A-20: data ausente nunca satisfaz condicao de calendario.
  it('eta2 nulo nao conta em nenhum dos dois', () => {
    const processes = [process({ eta2: null })]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(0)
    expect(arrivingIn15Days(processes, HOJE)).toBe(0)
  })

  it('eta2 no passado nao conta em nenhum dos dois', () => {
    const processes = [process({ eta2: '2026-08-02' })]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(0)
    expect(arrivingIn15Days(processes, HOJE)).toBe(0)
  })

  it('conta varios processos na mesma janela', () => {
    const processes = [
      process({ eta2: '2026-08-03' }),
      process({ eta2: '2026-08-03', styleKey: 'argb:FF00FF00' }),
      process({ eta2: '2026-08-05' }),
      process({ eta2: '2026-08-10' }),
    ]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(1)
    expect(arrivingIn15Days(processes, HOJE)).toBe(4)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(arrivingTodayWhite([], HOJE, BRANCAS)).toBe(0)
    expect(arrivingIn15Days([], HOJE)).toBe(0)
  })

  it('a categoria de status nao influencia os indicadores de calendario', () => {
    const processes = [
      process({ eta2: '2026-08-03', statusCategory: 'desembaracado' }),
      process({ eta2: '2026-08-03', statusCategory: 'fechado_aguardando_draft' }),
    ]

    expect(arrivingTodayWhite(processes, HOJE, BRANCAS)).toBe(2)
  })
})

describe('expectedVessels — IND-12', () => {
  it('inclui hoje e o futuro, ordenado por data e depois por navio', () => {
    const lista = expectedVessels(
      [
        process({ eta2: '2026-08-10', vessel: 'NAVIO BETA' }),
        process({ eta2: '2026-08-03', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO GAMA' }),
      ],
      HOJE,
    )

    expect(lista.map((v) => v.eta2)).toEqual(['2026-08-03', '2026-08-05', '2026-08-10'])
    expect(lista[0]?.vesselKey).toBe('NAVIO ALFA')
  })

  it('exclui chegadas passadas', () => {
    const lista = expectedVessels([process({ eta2: '2026-08-02', vessel: 'NAVIO ALFA' })], HOJE)

    expect(lista).toEqual([])
  })

  it('agrupa pelo par navio e data, somando processCount', () => {
    const lista = expectedVessels(
      [
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'navio alfa' }),
        process({ eta2: '2026-08-06', vessel: 'NAVIO ALFA' }),
      ],
      HOJE,
    )

    expect(lista).toHaveLength(2)
    expect(lista[0]).toMatchObject({ eta2: '2026-08-05', processCount: 2 })
    expect(lista[1]).toMatchObject({ eta2: '2026-08-06', processCount: 1 })
  })

  it('preserva a primeira grafia encontrada em vesselLabel', () => {
    const lista = expectedVessels(
      [
        process({ eta2: '2026-08-05', vessel: 'Navio Alfa' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
      ],
      HOJE,
    )

    expect(lista[0]?.vesselKey).toBe('NAVIO ALFA')
    expect(lista[0]?.vesselLabel).toBe('Navio Alfa')
  })

  it('desempata pelo nome do navio quando a data e a mesma', () => {
    const lista = expectedVessels(
      [
        process({ eta2: '2026-08-05', vessel: 'NAVIO GAMA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO BETA' }),
      ],
      HOJE,
    )

    expect(lista.map((v) => v.vesselKey)).toEqual(['NAVIO ALFA', 'NAVIO BETA', 'NAVIO GAMA'])
  })

  // A lista responde "que navios chegam"; uma linha sem nome nao responde nada.
  it('exclui processo sem navio', () => {
    const lista = expectedVessels(
      [process({ eta2: '2026-08-05', vessel: '' }), process({ eta2: '2026-08-05', vessel: '   ' })],
      HOJE,
    )

    expect(lista).toEqual([])
  })

  it('exclui processo sem eta2, mesmo com navio preenchido', () => {
    expect(expectedVessels([process({ eta2: null, vessel: 'NAVIO ALFA' })], HOJE)).toEqual([])
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(expectedVessels([], HOJE)).toEqual([])
  })
})

/**
 * `H-17`. O calendario da Pagina Operacional: as chegadas de hoje ate hoje+15,
 * agrupadas por dia e, dentro do dia, por navio.
 *
 * Reaproveita `expectedVessels` (IND-12) em vez de mexer nele: aquele nao tem
 * teto por definicao (A-24) e esta entregue desde `H-10`. O teto e desta
 * apresentacao.
 */
describe('arrivalCalendar — o calendario de chegadas', () => {
  it('agrupa por dia, e dentro do dia por navio', () => {
    const dias = arrivalCalendar(
      [
        process({ eta2: '2026-08-05', vessel: 'NAVIO BETA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-06', vessel: 'NAVIO GAMA' }),
      ],
      HOJE,
    )

    expect(dias.map((d) => d.eta2)).toEqual(['2026-08-05', '2026-08-06'])
    expect(dias[0]?.vessels.map((v) => v.vesselKey)).toEqual(['NAVIO ALFA', 'NAVIO BETA'])
    expect(dias[0]?.vessels[0]?.processCount).toBe(2)
  })

  // A interface nao soma: a regra inviolavel 6 vale para adicao tambem.
  it('traz o total do dia somado', () => {
    const dias = arrivalCalendar(
      [
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-05', vessel: 'NAVIO BETA' }),
      ],
      HOJE,
    )

    expect(dias[0]?.processCount).toBe(3)
  })

  it('inclui hoje e o decimo quinto dia, e exclui o decimo sexto', () => {
    const dias = arrivalCalendar(
      [
        process({ eta2: '2026-08-03', vessel: 'HOJE' }),
        process({ eta2: '2026-08-18', vessel: 'DIA 15' }),
        process({ eta2: '2026-08-19', vessel: 'DIA 16' }),
      ],
      HOJE,
    )

    expect(dias.map((d) => d.eta2)).toEqual(['2026-08-03', '2026-08-18'])
  })

  it('exclui o passado, herdado de expectedVessels', () => {
    const dias = arrivalCalendar([process({ eta2: '2026-08-02', vessel: 'ONTEM' })], HOJE)

    expect(dias).toEqual([])
  })

  // Dia sem chegada nao vira linha vazia: o calendario lista o que chega, e o
  // vazio so afastaria as datas que importam.
  it('omite os dias sem chegada, sem buraco', () => {
    const dias = arrivalCalendar(
      [
        process({ eta2: '2026-08-03', vessel: 'NAVIO ALFA' }),
        process({ eta2: '2026-08-10', vessel: 'NAVIO BETA' }),
      ],
      HOJE,
    )

    expect(dias).toHaveLength(2)
    expect(dias.map((d) => d.eta2)).toEqual(['2026-08-03', '2026-08-10'])
  })

  it('aceita horizonte diferente do padrao', () => {
    const processos = [
      process({ eta2: '2026-08-05', vessel: 'DENTRO' }),
      process({ eta2: '2026-08-11', vessel: 'FORA' }),
    ]

    expect(arrivalCalendar(processos, HOJE, 7).map((d) => d.eta2)).toEqual(['2026-08-05'])
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(arrivalCalendar([], HOJE)).toEqual([])
  })

  it('o horizonte padrao e 15, o mesmo de IND-09 (A-35)', () => {
    expect(ARRIVAL_HORIZON_DAYS).toBe(15)
  })
})
