import { describe, expect, it } from 'vitest'
import {
  channelDistribution,
  hasPendingDocs,
  isOverdue,
  overdueWithoutDuimpCount,
  PENDING_DOCS_HORIZON_DAYS,
  redChannelCount,
} from '../../src/domain/indicators.ts'
import type { CustomsChannel, Process, StatusCategory } from '../../src/domain/types.ts'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/** Todos os criterios de aceite de H-12 partem deste dia. */
const HOJE = civil('2026-08-03')

interface Fields {
  eta2?: string | null
  docsSent?: string | null
  statusCategory?: StatusCategory
  customsChannel?: CustomsChannel
  statusRaw?: string
  anomalies?: Process['anomalies']
}

let nextRow = 2

function process({
  eta2 = null,
  docsSent = null,
  statusCategory = 'em_andamento',
  customsChannel = 'indefinido',
  statusRaw = '',
  anomalies = [],
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
    eta2: eta2 === null ? null : civil(eta2),
    registrationDate: null,
    docsSentDate: docsSent === null ? null : civil(docsSent),
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
    cellStyleKeys: {},
    fills: {},
    anomalies,
  }
}

describe('redChannelCount — IND-06', () => {
  it('conta processo com canal vermelho', () => {
    expect(redChannelCount([process({ customsChannel: 'vermelho' })])).toBe(1)
  })

  // A-06: so a cor e fonte. Texto em STATUS nao promove nada a canal.
  it('nao conta STATUS com CANAL VERMELHO quando a cor nao e vermelha', () => {
    const azul = process({
      customsChannel: 'indefinido',
      statusRaw: 'DUIMP 1 - CANAL VERMELHO CONFERIDO',
      anomalies: ['CANAL_EM_TEXTO_STATUS'],
    })

    expect(redChannelCount([azul])).toBe(0)
    // A ocorrencia nao some: ela ja e registrada como anomalia desde H-07.
    expect(azul.anomalies).toContain('CANAL_EM_TEXTO_STATUS')
  })

  // Nao saber a cor nao e o mesmo que saber que ela nao e vermelha.
  it('nao conta canal indefinido, de cor nao mapeada', () => {
    expect(redChannelCount([process({ customsChannel: 'indefinido' })])).toBe(0)
  })

  it('conta apenas os vermelhos num conjunto misto', () => {
    const conjunto = [
      process({ customsChannel: 'vermelho' }),
      process({ customsChannel: 'vermelho' }),
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'indefinido' }),
    ]

    expect(redChannelCount(conjunto)).toBe(2)
  })

  // `H-51` acrescentou o verde, e IND-06 NAO foi redefinido: o criterio de
  // aceite exige que o valor dele nao mude.
  it('nao conta canal verde', () => {
    expect(redChannelCount([process({ customsChannel: 'verde' })])).toBe(0)
  })

  it('a categoria de status nao influencia IND-06', () => {
    const conjunto = [
      process({ customsChannel: 'vermelho', statusCategory: 'desembaracado' }),
      process({ customsChannel: 'vermelho', statusCategory: 'em_andamento' }),
    ]

    expect(redChannelCount(conjunto)).toBe(2)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(redChannelCount([])).toBe(0)
  })
})

describe('overdueWithoutDuimpCount — IND-25', () => {
  it('fixa o horizonte em 10 dias (A-08)', () => {
    expect(PENDING_DOCS_HORIZON_DAYS).toBe(10)
  })

  it('conta no limite exato: eta2 = hoje + 10', () => {
    expect(overdueWithoutDuimpCount([process({ eta2: '2026-08-13' })], HOJE)).toBe(1)
  })

  it('nao conta um dia alem do limite: eta2 = hoje + 11', () => {
    expect(overdueWithoutDuimpCount([process({ eta2: '2026-08-14' })], HOJE)).toBe(0)
  })

  // `D-49`: sem esta condicao o cartao mediria 542 das 650 linhas reais.
  it('nao conta processo desembaracado, cujo STATUS tambem nao tem DUIMP', () => {
    const concluido = process({
      eta2: '2026-08-13',
      statusCategory: 'desembaracado',
      statusRaw: 'DESEMBARAÇADA',
    })

    expect(overdueWithoutDuimpCount([concluido], HOJE)).toBe(0)
  })

  it('nao conta quando o STATUS menciona DUIMP', () => {
    const comDuimp = process({ eta2: '2026-08-13', statusRaw: 'DUIMP: 26BR0001 - CONFERIDO' })

    expect(overdueWithoutDuimpCount([comDuimp], HOJE)).toBe(0)
  })

  // A-20: data ausente nunca satisfaz condicao de calendario.
  it('nao conta eta2 nulo', () => {
    expect(overdueWithoutDuimpCount([process({ eta2: null })], HOJE)).toBe(0)
  })

  /**
   * A janela tem TETO e nao tem PISO, decidido em `D-49` e herdado de A-08: um
   * intervalo fechado excluiria a carga que ja chegou sem declaracao, que e
   * exatamente o caso mais grave.
   */
  it('conta eta2 muito no passado', () => {
    expect(overdueWithoutDuimpCount([process({ eta2: '2025-01-01' })], HOJE)).toBe(1)
  })

  it('conta eta2 igual a hoje', () => {
    expect(overdueWithoutDuimpCount([process({ eta2: '2026-08-03' })], HOJE)).toBe(1)
  })

  // DOCS ENVIADOS deixou de ser criterio em `D-49`: quem responde e o STATUS.
  it('conta mesmo com DOCS ENVIADOS preenchido', () => {
    expect(
      overdueWithoutDuimpCount([process({ eta2: '2026-08-05', docsSent: '2026-08-01' })], HOJE),
    ).toBe(1)
  })

  it('conta as demais categorias nao concluidas', () => {
    const conjunto = [
      process({ eta2: '2026-08-05', statusCategory: 'em_andamento' }),
      process({ eta2: '2026-08-05', statusCategory: 'em_desembaraco' }),
      process({ eta2: '2026-08-05', statusCategory: 'fechado_aguardando_draft' }),
    ]

    expect(overdueWithoutDuimpCount(conjunto, HOJE)).toBe(3)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(overdueWithoutDuimpCount([], HOJE)).toBe(0)
  })
})

/**
 * Os dois predicados que `D-49` NAO tocou.
 *
 * Eles perderam os cartoes — IND-14 e IND-15 sairam da Pagina Inicial — e
 * seguem servindo ALE-02, ALE-01 e o `overdueCount` do ranking de agentes. Sem
 * este bloco, a regra dos dois alertas ficaria sem teste de unidade.
 */
describe('hasPendingDocs e isOverdue — os alertas', () => {
  it('hasPendingDocs exige DOCS ENVIADOS vazio, e nao o STATUS', () => {
    expect(hasPendingDocs(process({ eta2: '2026-08-13' }), HOJE)).toBe(true)
    expect(hasPendingDocs(process({ eta2: '2026-08-13', docsSent: '2026-08-01' }), HOJE)).toBe(
      false,
    )
  })

  it('hasPendingDocs ignora processo desembaracado e eta2 nulo', () => {
    expect(
      hasPendingDocs(process({ eta2: '2026-08-13', statusCategory: 'desembaracado' }), HOJE),
    ).toBe(false)
    expect(hasPendingDocs(process({ eta2: null }), HOJE)).toBe(false)
  })

  it('isOverdue exige eta2 ESTRITAMENTE no passado — hoje ainda nao venceu', () => {
    expect(isOverdue(process({ eta2: '2026-08-02' }), HOJE)).toBe(true)
    expect(isOverdue(process({ eta2: '2026-08-03' }), HOJE)).toBe(false)
    expect(isOverdue(process({ eta2: '2026-08-04' }), HOJE)).toBe(false)
  })

  it('isOverdue ignora processo desembaracado e eta2 nulo (A-20)', () => {
    expect(isOverdue(process({ eta2: '2026-08-02', statusCategory: 'desembaracado' }), HOJE)).toBe(
      false,
    )
    expect(isOverdue(process({ eta2: null }), HOJE)).toBe(false)
  })

  // A pergunta de cada um e diferente, e `D-49` nao as aproximou.
  it('a carga que chegou sem documento satisfaz os dois', () => {
    const parado = process({ eta2: '2025-01-01', statusCategory: 'em_andamento' })

    expect(isOverdue(parado, HOJE)).toBe(true)
    expect(hasPendingDocs(parado, HOJE)).toBe(true)
  })
})

/**
 * `H-51`. A distribuicao acompanha IND-06 e nao o redefine — o teste acima
 * garante que o valor dele nao mudou.
 *
 * O que se mede aqui e a separacao entre o que a cor classifica e o que ela nao
 * classifica: `known` e o denominador, `indefinido` fica de fora dele, e as
 * fracoes sao `null` quando nao ha denominador (A-42).
 */
describe('channelDistribution — H-51', () => {
  it('separa os tres canais e usa so os conhecidos como denominador', () => {
    const conjunto = [
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'vermelho' }),
      process({ customsChannel: 'indefinido' }),
      process({ customsChannel: 'indefinido' }),
    ]

    const d = channelDistribution(conjunto)

    expect(d.verde).toBe(3)
    expect(d.vermelho).toBe(1)
    expect(d.indefinido).toBe(2)
    expect(d.known).toBe(4)
    expect(d.verdeShare).toBe(3 / 4)
    expect(d.vermelhoShare).toBe(1 / 4)
  })

  // A soma das tres chaves e o total, sempre: nenhuma linha fica fora da conta
  // (regra inviolavel 2).
  it('as tres contagens somam o conjunto inteiro', () => {
    const conjunto = [
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'vermelho' }),
      process({ customsChannel: 'indefinido' }),
    ]

    const d = channelDistribution(conjunto)

    expect(d.verde + d.vermelho + d.indefinido).toBe(conjunto.length)
  })

  // A-42: fracao de conjunto vazio nao e zero. Sem denominador, nao ha
  // percentual — e `0%` afirmaria que nenhum processo e verde.
  it('devolve fracao nula quando nenhum processo tem canal conhecido', () => {
    const d = channelDistribution([
      process({ customsChannel: 'indefinido' }),
      process({ customsChannel: 'indefinido' }),
    ])

    expect(d.known).toBe(0)
    expect(d.verdeShare).toBeNull()
    expect(d.vermelhoShare).toBeNull()
    expect(d.indefinido).toBe(2)
  })

  it('devolve tudo zerado e sem fracao para conjunto vazio', () => {
    const d = channelDistribution([])

    expect(d.verde).toBe(0)
    expect(d.vermelho).toBe(0)
    expect(d.indefinido).toBe(0)
    expect(d.known).toBe(0)
    expect(d.verdeShare).toBeNull()
  })

  // Um so canal conhecido leva a fracao a 1, e a outra a zero MEDIDO — que e
  // diferente de nulo: aqui ha denominador.
  it('distingue fracao zero de fracao ausente', () => {
    const d = channelDistribution([
      process({ customsChannel: 'verde' }),
      process({ customsChannel: 'indefinido' }),
    ])

    expect(d.verdeShare).toBe(1)
    expect(d.vermelhoShare).toBe(0)
  })

  // Regra inviolavel 4: a cor nunca infere status, e o inverso tambem vale — a
  // categoria nao entra na distribuicao de canal.
  it('a categoria de status nao influencia a distribuicao', () => {
    const d = channelDistribution([
      process({ customsChannel: 'verde', statusCategory: 'em_andamento' }),
      process({ customsChannel: 'verde', statusCategory: 'desembaracado' }),
    ])

    expect(d.verde).toBe(2)
  })
})
