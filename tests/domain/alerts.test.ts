import { describe, expect, it } from 'vitest'
import {
  ALERT_SEVERITY,
  type Alert,
  ARRIVAL_HORIZON_DAYS,
  buildAlerts,
  countByType,
  emptyAlertCounts,
} from '../../src/domain/alerts.ts'
import type { CustomsChannel, Process, StatusCategory } from '../../src/domain/types.ts'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/** Todos os criterios de aceite de H-14 partem deste dia. */
const HOJE = civil('2026-08-03')

const SEM_PARADOS = new Map<string, number>()
const LIMIAR = 15

interface Fields {
  eta2?: string | null
  docsSent?: string | null
  statusCategory?: StatusCategory
  customsChannel?: CustomsChannel
  ref?: string
}

let nextRow = 2

function process({
  eta2 = null,
  docsSent = null,
  statusCategory = 'em_andamento',
  customsChannel = 'nenhum',
  ref,
}: Fields): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: ref ?? `FT${String(row).padStart(3, '0')}.26`,
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
    eta2: eta2 === null ? null : civil(eta2),
    registrationDate: null,
    docsSentDate: docsSent === null ? null : civil(docsSent),
    clientKey: '',
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

const build = (processes: readonly Process[], today = HOJE): Alert[] =>
  buildAlerts(processes, today, SEM_PARADOS, LIMIAR)

const types = (alerts: readonly Alert[]): string[] => alerts.map((a) => a.type)

describe('ALERT_SEVERITY — severidade fixa (A-41)', () => {
  it('fixa os seis valores', () => {
    expect(ALERT_SEVERITY).toEqual({
      eta_vencida: 1,
      canal_vermelho: 2,
      documentacao_pendente: 3,
      processos_parados: 4,
      chegadas_hoje: 5,
      chegadas_7_dias: 6,
    })
  })

  it('fixa o horizonte de ALE-05 em 7 dias', () => {
    expect(ARRIVAL_HORIZON_DAYS).toBe(7)
  })
})

describe('buildAlerts — um processo pode gerar varios alertas', () => {
  it('gera dois alertas distintos para ETA vencida e Canal Vermelho', () => {
    const critico = process({
      eta2: '2026-07-20',
      customsChannel: 'vermelho',
      docsSent: '2026-07-01',
    })

    expect(types(build([critico]))).toEqual(['eta_vencida', 'canal_vermelho'])
  })

  it('gera chegadas_hoje E chegadas_7_dias para eta2 igual a hoje', () => {
    const chegando = process({ eta2: '2026-08-03', docsSent: '2026-07-01' })

    const resultado = types(build([chegando]))

    expect(resultado).toContain('chegadas_hoje')
    expect(resultado).toContain('chegadas_7_dias')
    // A condicao de ALE-01 e `< hoje`, estrita: hoje ainda nao venceu.
    expect(resultado).not.toContain('eta_vencida')
  })
})

describe('buildAlerts — ordenacao', () => {
  it('ordena por severidade ascendente', () => {
    const conjunto = [
      process({ eta2: '2026-08-03', docsSent: '2026-07-01' }),
      process({ eta2: '2026-07-20', docsSent: '2026-07-01' }),
      process({ customsChannel: 'vermelho' }),
    ]

    expect(types(build(conjunto))).toEqual([
      'eta_vencida',
      'canal_vermelho',
      'chegadas_hoje',
      'chegadas_7_dias',
    ])
  })

  it('dentro do mesmo tipo, eta2 menor vem primeiro', () => {
    const conjunto = [
      process({ eta2: '2026-07-30', docsSent: '2026-07-01' }),
      process({ eta2: '2026-07-10', docsSent: '2026-07-01' }),
      process({ eta2: '2026-07-20', docsSent: '2026-07-01' }),
    ]

    expect(build(conjunto).map((a) => a.eta2)).toEqual(['2026-07-10', '2026-07-20', '2026-07-30'])
  })

  it('eta2 nulo vem por ultimo dentro do seu grupo', () => {
    const conjunto = [
      process({ customsChannel: 'vermelho', eta2: null }),
      process({ customsChannel: 'vermelho', eta2: '2026-09-01' }),
    ]

    expect(build(conjunto).map((a) => a.eta2)).toEqual(['2026-09-01', null])
  })
})

describe('buildAlerts — daysOverdue', () => {
  it('conta a diferenca em dias corridos entre hoje e eta2', () => {
    const vencido = process({ eta2: '2026-07-20', docsSent: '2026-07-01' })

    expect(build([vencido])[0]?.daysOverdue).toBe(14)
  })

  it('devolve 1 para processo vencido ontem', () => {
    const ontem = process({ eta2: '2026-08-02', docsSent: '2026-07-01' })

    const alerta = build([ontem])[0]

    expect(alerta?.daysOverdue).toBe(1)
    expect(alerta?.message).toBe('ETA vencida ha 1 dia')
  })

  it('fica nulo nos tipos que nao medem atraso', () => {
    const vermelho = process({ customsChannel: 'vermelho' })

    expect(build([vermelho])[0]?.daysOverdue).toBeNull()
  })
})

describe('buildAlerts — processo concluido nao entra na fila (A-59)', () => {
  // A pagina e fila de trabalho: processo desembaracado nao pede acao alguma.
  it('nao gera alerta para desembaracado com eta2 no passado', () => {
    const concluido = process({ eta2: '2026-07-20', statusCategory: 'desembaracado' })

    expect(build([concluido])).toEqual([])
  })

  /**
   * A especificacao so era explicita em ALE-01 e ALE-02. Medido: sem este
   * filtro, 3 dos 5 alertas de Canal Vermelho seriam sobre processos ja
   * encerrados.
   */
  it('nao gera canal_vermelho para processo desembaracado', () => {
    const concluido = process({ customsChannel: 'vermelho', statusCategory: 'desembaracado' })

    expect(build([concluido])).toEqual([])
  })

  it('nao gera alerta de chegada para processo desembaracado', () => {
    const concluido = process({ eta2: '2026-08-03', statusCategory: 'desembaracado' })

    expect(build([concluido])).toEqual([])
  })

  it('mantem as demais categorias nao concluidas', () => {
    const conjunto = [
      process({ eta2: '2026-07-20', docsSent: '2026-07-01', statusCategory: 'em_andamento' }),
      process({ eta2: '2026-07-20', docsSent: '2026-07-01', statusCategory: 'em_desembaraco' }),
    ]

    expect(build(conjunto)).toHaveLength(2)
  })
})

describe('buildAlerts — documentacao pendente', () => {
  it('gera o alerta no limite de 10 dias', () => {
    const pendente = process({ eta2: '2026-08-13' })

    expect(types(build([pendente]))).toContain('documentacao_pendente')
  })

  it('nao gera um dia alem do limite', () => {
    const fora = process({ eta2: '2026-08-14' })

    expect(types(build([fora]))).not.toContain('documentacao_pendente')
  })

  // A janela nao tem piso: carga que ja chegou sem documento e o caso grave.
  it('descreve a carga que ja chegou sem inverter o sinal', () => {
    const chegou = process({ eta2: '2026-07-31' })

    const alerta = build([chegou]).find((a) => a.type === 'documentacao_pendente')

    expect(alerta?.message).toBe('Documentacao pendente, carga chegou ha 3 dias')
  })

  it('descreve a chegada futura em dias', () => {
    const futuro = process({ eta2: '2026-08-08' })

    const alerta = build([futuro]).find((a) => a.type === 'documentacao_pendente')

    expect(alerta?.message).toBe('Documentacao pendente, ETA em 5 dias')
  })
})

describe('buildAlerts — chegadas nos proximos 7 dias', () => {
  it('inclui o limite exato de hoje+7', () => {
    const limite = process({ eta2: '2026-08-10', docsSent: '2026-07-01' })

    expect(types(build([limite]))).toContain('chegadas_7_dias')
  })

  it('exclui hoje+8', () => {
    const fora = process({ eta2: '2026-08-11', docsSent: '2026-07-01' })

    expect(types(build([fora]))).not.toContain('chegadas_7_dias')
  })

  it('descreve amanha no singular', () => {
    const amanha = process({ eta2: '2026-08-04', docsSent: '2026-07-01' })

    const alerta = build([amanha]).find((a) => a.type === 'chegadas_7_dias')

    expect(alerta?.message).toBe('Chegada prevista para amanha')
  })
})

describe('buildAlerts — ALE-06 fica zerado ate H-29', () => {
  it('nao gera processos_parados com o mapa vazio', () => {
    const conjunto = [process({ eta2: '2026-07-20', docsSent: '2026-07-01' })]

    expect(types(build(conjunto))).not.toContain('processos_parados')
  })

  // O parametro ja existe e funciona; o que falta e o historico que o alimenta.
  it('gera processos_parados quando o mapa traz o processo no limiar', () => {
    const parado = process({ ref: 'FT999.26' })
    const parados = new Map([['FT999.26', 15]])

    const alertas = buildAlerts([parado], HOJE, parados, LIMIAR)

    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.type).toBe('processos_parados')
    expect(alertas[0]?.daysOverdue).toBe(15)
    expect(alertas[0]?.message).toBe('Parado ha 15 dias')
  })

  it('nao gera abaixo do limiar', () => {
    const parado = process({ ref: 'FT998.26' })

    expect(buildAlerts([parado], HOJE, new Map([['FT998.26', 14]]), LIMIAR)).toEqual([])
  })
})

describe('countByType — as seis chaves, sempre', () => {
  it('devolve as seis zeradas para lista vazia', () => {
    expect(countByType([])).toEqual({
      eta_vencida: 0,
      documentacao_pendente: 0,
      canal_vermelho: 0,
      chegadas_hoje: 0,
      chegadas_7_dias: 0,
      processos_parados: 0,
    })
  })

  it('emptyAlertCounts traz as seis chaves', () => {
    expect(Object.keys(emptyAlertCounts()).sort()).toEqual([
      'canal_vermelho',
      'chegadas_7_dias',
      'chegadas_hoje',
      'documentacao_pendente',
      'eta_vencida',
      'processos_parados',
    ])
  })

  it('conta cada tipo separadamente', () => {
    const conjunto = [
      process({ eta2: '2026-07-20', docsSent: '2026-07-01' }),
      process({ eta2: '2026-07-21', docsSent: '2026-07-01' }),
      process({ customsChannel: 'vermelho' }),
    ]

    expect(countByType(build(conjunto))).toMatchObject({
      eta_vencida: 2,
      canal_vermelho: 1,
      processos_parados: 0,
    })
  })
})

describe('buildAlerts — conjunto sem risco', () => {
  it('devolve lista vazia quando nenhum processo satisfaz', () => {
    const tranquilo = process({ eta2: '2026-12-31', docsSent: '2026-07-01' })

    expect(build([tranquilo])).toEqual([])
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(build([])).toEqual([])
  })
})
