import { describe, expect, it } from 'vitest'
import {
  overdueCount,
  PENDING_DOCS_HORIZON_DAYS,
  pendingDocsCount,
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
  customsChannel = 'nenhum',
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
      customsChannel: 'nenhum',
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
      process({ customsChannel: 'nenhum' }),
      process({ customsChannel: 'indefinido' }),
    ]

    expect(redChannelCount(conjunto)).toBe(2)
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

describe('pendingDocsCount — IND-14', () => {
  it('fixa o horizonte em 10 dias (A-08)', () => {
    expect(PENDING_DOCS_HORIZON_DAYS).toBe(10)
  })

  it('conta no limite exato: eta2 = hoje + 10', () => {
    expect(pendingDocsCount([process({ eta2: '2026-08-13' })], HOJE)).toBe(1)
  })

  it('nao conta um dia alem do limite: eta2 = hoje + 11', () => {
    expect(pendingDocsCount([process({ eta2: '2026-08-14' })], HOJE)).toBe(0)
  })

  // A-08: processo concluido nao tem documentacao pendente.
  it('nao conta processo desembaracado, mesmo sem DOCS ENVIADOS', () => {
    const concluido = process({ eta2: '2026-08-13', statusCategory: 'desembaracado' })

    expect(pendingDocsCount([concluido], HOJE)).toBe(0)
  })

  it('nao conta quando DOCS ENVIADOS esta preenchido', () => {
    const comDocumento = process({ eta2: '2026-08-13', docsSent: '2026-08-01' })

    expect(pendingDocsCount([comDocumento], HOJE)).toBe(0)
  })

  // A-20: data ausente nunca satisfaz condicao de calendario.
  it('nao conta eta2 nulo', () => {
    expect(pendingDocsCount([process({ eta2: null })], HOJE)).toBe(0)
  })

  /**
   * A janela tem TETO e nao tem PISO. Um intervalo fechado excluiria a carga
   * que ja chegou sem documento — exatamente o caso mais grave.
   */
  it('conta eta2 muito no passado', () => {
    expect(pendingDocsCount([process({ eta2: '2025-01-01' })], HOJE)).toBe(1)
  })

  it('conta eta2 igual a hoje', () => {
    expect(pendingDocsCount([process({ eta2: '2026-08-03' })], HOJE)).toBe(1)
  })

  it('conta as demais categorias nao concluidas', () => {
    const conjunto = [
      process({ eta2: '2026-08-05', statusCategory: 'em_andamento' }),
      process({ eta2: '2026-08-05', statusCategory: 'em_desembaraco' }),
      process({ eta2: '2026-08-05', statusCategory: 'fechado_aguardando_draft' }),
    ]

    expect(pendingDocsCount(conjunto, HOJE)).toBe(3)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(pendingDocsCount([], HOJE)).toBe(0)
  })
})

describe('overdueCount — IND-15', () => {
  it('conta eta2 no passado com categoria nao concluida', () => {
    const atrasado = process({ eta2: '2026-08-02', statusCategory: 'em_desembaraco' })

    expect(overdueCount([atrasado], HOJE)).toBe(1)
  })

  it('nao conta eta2 igual a hoje — hoje ainda nao venceu', () => {
    expect(overdueCount([process({ eta2: '2026-08-03' })], HOJE)).toBe(0)
  })

  it('nao conta eta2 no futuro', () => {
    expect(overdueCount([process({ eta2: '2026-08-04' })], HOJE)).toBe(0)
  })

  it('nao conta processo desembaracado, mesmo com eta2 vencida', () => {
    const concluido = process({ eta2: '2026-08-02', statusCategory: 'desembaracado' })

    expect(overdueCount([concluido], HOJE)).toBe(0)
  })

  // A-20: data ausente nao e data vencida.
  it('nao conta eta2 nulo', () => {
    expect(overdueCount([process({ eta2: null })], HOJE)).toBe(0)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(overdueCount([], HOJE)).toBe(0)
  })
})

describe('IND-14 e IND-15 — sobreposicao intencional', () => {
  /**
   * Os dois indicadores respondem perguntas diferentes sobre a mesma linha:
   * "a carga chegou e nao foi liberada" e "o documento nao foi enviado".
   * Uma carga parada ha meses sem documento e as duas coisas.
   */
  it('a mesma linha conta nos dois quando ja chegou e nao tem documento', () => {
    const conjunto = [process({ eta2: '2025-01-01', statusCategory: 'em_andamento' })]

    expect(overdueCount(conjunto, HOJE)).toBe(1)
    expect(pendingDocsCount(conjunto, HOJE)).toBe(1)
  })

  it('conta so em IND-14 quando a chegada ainda esta por vir', () => {
    const conjunto = [process({ eta2: '2026-08-10' })]

    expect(pendingDocsCount(conjunto, HOJE)).toBe(1)
    expect(overdueCount(conjunto, HOJE)).toBe(0)
  })

  it('conta so em IND-15 quando o documento ja foi enviado', () => {
    const conjunto = [process({ eta2: '2026-08-02', docsSent: '2026-07-20' })]

    expect(overdueCount(conjunto, HOJE)).toBe(1)
    expect(pendingDocsCount(conjunto, HOJE)).toBe(0)
  })

  // `fechado_aguardando_draft` tem REF e nada mais, logo eta2 e null.
  it('processo fechado aguardando draft fica ausente dos dois', () => {
    const conjunto = [process({ eta2: null, statusCategory: 'fechado_aguardando_draft' })]

    expect(overdueCount(conjunto, HOJE)).toBe(0)
    expect(pendingDocsCount(conjunto, HOJE)).toBe(0)
  })
})
