import { describe, expect, it } from 'vitest'
import {
  categoryCheck,
  colorCount,
  countByCategory,
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
 * IND-26 e IND-27 — os dois cartoes de COR, desde `D-54`.
 *
 * O usuario trocou os dois criterios na mesma tarde: "Desembaracados" deixou de
 * contar a categoria de TD-01 e passou a contar a linha VERDE ou VERMELHA, e
 * "Em desembaraco" deixou de ser cor-ou-DUIMP e passou a ser a linha BRANCA.
 *
 * As chaves sao as do arquivo real: o verde tem DUAS que compartilham o
 * `display`, e e por isso que a fronteira traduz cor em chaves antes de chamar.
 */
const VERDE_E_VERMELHA: ReadonlySet<string> = new Set([
  'argb:FF00FF00',
  'argb:FF00FF0D',
  'argb:FFFF0000',
])
const BRANCAS: ReadonlySet<string> = new Set(['theme:0|tint:0.0000'])

describe('colorCount — IND-26 e IND-27', () => {
  it('conta as duas cores de desembaracado, unificando os tons de verde', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'argb:FF00FF00' }),
      process(3, 'em_andamento', { styleKey: 'argb:FF00FF0D' }),
      process(4, 'em_andamento', { styleKey: 'argb:FFFF0000' }),
    ]

    expect(colorCount(processes, VERDE_E_VERMELHA)).toBe(3)
  })

  // A categoria de STATUS deixou de participar: quem responde e a cor.
  it('nao olha a categoria de status', () => {
    const processes = [
      process(2, 'desembaracado', { styleKey: 'argb:FF5B9BD5', statusRaw: 'DESEMBARAÇADA' }),
      process(3, 'em_andamento', { styleKey: 'argb:FF00FF00' }),
    ]

    expect(colorCount(processes, VERDE_E_VERMELHA)).toBe(1)
  })

  it('conta a linha branca, e so ela', () => {
    const processes = [
      process(2, 'em_andamento', { styleKey: 'theme:0|tint:0.0000' }),
      process(3, 'em_andamento', { styleKey: 'argb:FF00FF00' }),
      process(4, 'em_andamento', { styleKey: 'argb:FF5B9BD5' }),
    ]

    expect(colorCount(processes, BRANCAS)).toBe(1)
  })

  /**
   * As duas cores nao se cruzam: uma linha nao e verde e branca ao mesmo tempo,
   * entao os dois cartoes nunca contam a mesma linha.
   */
  it('os dois conjuntos sao disjuntos sobre o mesmo processo', () => {
    const branca = [process(2, 'em_andamento', { styleKey: 'theme:0|tint:0.0000' })]

    expect(colorCount(branca, BRANCAS)).toBe(1)
    expect(colorCount(branca, VERDE_E_VERMELHA)).toBe(0)
  })

  // Regra inviolavel 3: cor que o mapa nao declara nao vira cor proxima.
  it('linha sem preenchimento nao conta em nenhum dos dois', () => {
    const sem = [process(2, 'em_andamento', { styleKey: 'none' })]

    expect(colorCount(sem, VERDE_E_VERMELHA)).toBe(0)
    expect(colorCount(sem, BRANCAS)).toBe(0)
  })

  it('conjunto de chaves vazio zera a contagem', () => {
    expect(colorCount([process(2, 'em_andamento', { styleKey: 'argb:FF00FF00' })], new Set())).toBe(
      0,
    )
  })

  it('devolve zero para conjunto vazio', () => {
    expect(colorCount([], VERDE_E_VERMELHA)).toBe(0)
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
