import { describe, expect, it } from 'vitest'
import { countByCategory } from '../../src/domain/indicators.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

function process(sourceRow: number, statusCategory: StatusCategory): Process {
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
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey: 'none',
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
