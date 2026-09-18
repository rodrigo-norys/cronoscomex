import { describe, expect, it } from 'vitest'
import {
  categoryCheck,
  countByCategory,
  inClearanceCount,
  mentionsDuimp,
} from '../../src/domain/indicators.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

function process(
  sourceRow: number,
  statusCategory: StatusCategory,
  { styleKey = 'none', statusRaw = '' }: { styleKey?: string; statusRaw?: string } = {},
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
    statusRaw,
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
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey,
    cellStyleKeys: {},
    fills: {},
    anomalies: [],
  }
}

function conjunto(distribuicao: Partial<Record<StatusCategory, number>>): Process[] {
  const processes: Process[] = []
  let row = 2
  for (const [category, quantity] of Object.entries(distribuicao)) {
    for (let i = 0; i < (quantity ?? 0); i++) {
      processes.push(process(row++, category as StatusCategory))
    }
  }
  return processes
}

describe('countByCategory — IND-01 a IND-05', () => {
  it('conta as quatro categorias e o total', () => {
    const counts = countByCategory(
      conjunto({
        desembaracado: 4,
        em_andamento: 3,
        em_desembaraco: 2,
        fechado_aguardando_draft: 1,
      }),
    )

    expect(counts).toEqual({
      total: 10,
      desembaracados: 4,
      emAndamento: 3,
      emDesembaraco: 2,
      fechadoAguardandoDraft: 1,
    })
  })

  it('a soma das quatro categorias iguala o total, por serem exclusivas', () => {
    const counts = countByCategory(
      conjunto({
        desembaracado: 4,
        em_andamento: 3,
        em_desembaraco: 2,
        fechado_aguardando_draft: 1,
      }),
    )

    expect(
      counts.emAndamento +
        counts.emDesembaraco +
        counts.desembaracados +
        counts.fechadoAguardandoDraft,
    ).toBe(counts.total)
  })

  it('inclui fechado_aguardando_draft no total, como IND-01 exige', () => {
    const counts = countByCategory(conjunto({ fechado_aguardando_draft: 3 }))

    expect(counts.total).toBe(3)
    expect(counts.fechadoAguardandoDraft).toBe(3)
  })

  it('devolve tudo zerado para conjunto vazio', () => {
    expect(countByCategory([])).toEqual({
      total: 0,
      emAndamento: 0,
      emDesembaraco: 0,
      desembaracados: 0,
      fechadoAguardandoDraft: 0,
    })
  })
})

describe('countByCategory — casos-limite', () => {
  // Somar as duas categorias esconderia 34 processos na planilha real.
  it('nunca soma fechado_aguardando_draft com em_desembaraco', () => {
    const counts = countByCategory(conjunto({ fechado_aguardando_draft: 1 }))

    expect(counts.total).toBe(1)
    expect(counts.emDesembaraco).toBe(0)
    expect(counts.fechadoAguardandoDraft).toBe(1)
  })

  it('conta corretamente quando so existe uma categoria', () => {
    const counts = countByCategory(conjunto({ em_andamento: 7 }))

    expect(counts).toEqual({
      total: 7,
      emAndamento: 7,
      emDesembaraco: 0,
      desembaracados: 0,
      fechadoAguardandoDraft: 0,
    })
  })

  // Valores medidos sobre as 649 linhas reais em H-07.
  it('reproduz a distribuicao medida na planilha real', () => {
    const counts = countByCategory(
      conjunto({
        desembaracado: 480,
        em_andamento: 103,
        fechado_aguardando_draft: 34,
        em_desembaraco: 32,
      }),
    )

    expect(counts.total).toBe(649)
    expect(counts.desembaracados).toBe(480)
    expect(counts.emAndamento).toBe(103)
    expect(counts.fechadoAguardandoDraft).toBe(34)
    expect(counts.emDesembaraco).toBe(32)
  })

  it('nao muta o conjunto recebido', () => {
    const processes = conjunto({ em_andamento: 2 })
    const copia = [...processes]

    countByCategory(processes)

    expect(processes).toEqual(copia)
  })
})

/**
 * IND-23 — o cartao "Em desembaraco" desde `D-49`.
 *
 * As chaves aqui sao as do arquivo real (`config/color-map.json`): o azul e o
 * bege tem uma chave cada, e o roxo tem DUAS que compartilham o mesmo
 * `display`. E por isso que a fronteira traduz cor em chaves antes de chamar —
 * "ou similar" e a cor de exibicao, nunca um limiar (ADR-0003).
 */
const CHAVES_DESEMBARACO: ReadonlySet<string> = new Set([
  'argb:FFFFE599',
  'argb:FF5B9BD5',
  'argb:FFA74F7B',
  'argb:FFA64D79',
])

describe('inClearanceCount — IND-23', () => {
  it('conta pela cor, sem olhar o STATUS', () => {
    const processes = [
      process(2, 'desembaracado', { styleKey: 'argb:FF5B9BD5' }),
      process(3, 'em_andamento', { styleKey: 'argb:FFFFE599' }),
    ]

    expect(inClearanceCount(processes, CHAVES_DESEMBARACO)).toBe(2)
  })

  // `D-42`: os dois tons de roxo sao a mesma cor para o operador.
  it('conta os dois tons de roxo', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'argb:FFA74F7B' }),
      process(3, 'em_andamento', { styleKey: 'argb:FFA64D79' }),
    ]

    expect(inClearanceCount(processes, CHAVES_DESEMBARACO)).toBe(2)
  })

  it('conta pelo DUIMP no STATUS, sem olhar a cor', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'argb:FF00FF00', statusRaw: 'DUIMP: 26BR0001 - OK' }),
    ]

    expect(inClearanceCount(processes, CHAVES_DESEMBARACO)).toBe(1)
  })

  // UNIAO, nao intersecao: a linha que tem as duas coisas conta UMA vez.
  it('nao conta em dobro a linha que tem cor e DUIMP', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'argb:FF5B9BD5', statusRaw: 'DUIMP 1' }),
    ]

    expect(inClearanceCount(processes, CHAVES_DESEMBARACO)).toBe(1)
  })

  it('nao conta cor fora do conjunto e sem DUIMP', () => {
    const processes = [process(2, 'em_desembaraco', { styleKey: 'argb:FF00FF00' })]

    expect(inClearanceCount(processes, CHAVES_DESEMBARACO)).toBe(0)
  })

  it('conjunto de chaves vazio deixa so o criterio de texto', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'argb:FF5B9BD5' }),
      process(3, 'em_andamento', { statusRaw: 'DUIMP 1' }),
    ]

    expect(inClearanceCount(processes, new Set())).toBe(1)
  })

  it('devolve zero para conjunto vazio', () => {
    expect(inClearanceCount([], CHAVES_DESEMBARACO)).toBe(0)
  })
})

describe('mentionsDuimp', () => {
  it('casa em qualquer posicao do texto, normalizado', () => {
    expect(mentionsDuimp(process(2, 'em_andamento', { statusRaw: 'duimp: 26BR0001' }))).toBe(true)
    expect(mentionsDuimp(process(3, 'em_andamento', { statusRaw: '  DUIMP  ' }))).toBe(true)
  })

  /**
   * Consequencia medida e ACEITA (`D-49`): as 8 linhas com este texto na
   * planilha real contam como tendo DUIMP, embora a declaracao ainda esteja por
   * fazer. Foi a regra que o usuario pediu — continencia, nao prefixo.
   */
  it('casa tambem "AG CONFECCAO DE DUIMP", onde a declaracao ainda nao existe', () => {
    const linha = process(2, 'em_andamento', {
      statusRaw: 'DOCS APROVADOS  - AG CONFECÇÃO DE DUIMP',
    })

    expect(mentionsDuimp(linha)).toBe(true)
  })

  it('nao casa STATUS vazio nem texto sem a palavra', () => {
    expect(mentionsDuimp(process(2, 'em_desembaraco'))).toBe(false)
    expect(mentionsDuimp(process(3, 'em_andamento', { statusRaw: 'AG BL ORIGINAL' }))).toBe(false)
  })
})

describe('categoryCheck — a conferencia de A-12', () => {
  it('confere quando as quatro categorias somam o total', () => {
    const counts = countByCategory(
      conjunto({
        desembaracado: 480,
        em_andamento: 103,
        fechado_aguardando_draft: 34,
        em_desembaraco: 33,
      }),
    )

    expect(categoryCheck(counts)).toEqual({ sum: 650, total: 650, matches: true })
  })

  it('reprova quando o total nao bate com a soma', () => {
    const counts = countByCategory(conjunto({ em_andamento: 2 }))

    expect(categoryCheck({ ...counts, total: 3 })).toEqual({ sum: 2, total: 3, matches: false })
  })

  it('confere para conjunto vazio', () => {
    expect(categoryCheck(countByCategory([]))).toEqual({ sum: 0, total: 0, matches: true })
  })
})
