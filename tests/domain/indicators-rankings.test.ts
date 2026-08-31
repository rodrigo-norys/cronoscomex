import { describe, expect, it } from 'vitest'
import {
  agentRanking,
  bazarShare,
  groupCount,
  groupCountWithGroups,
  isOverdue,
  responsibleRanking,
} from '../../src/domain/indicators.ts'
import { normKey } from '../../src/domain/normalizer.ts'
import type { Process, Responsible, StatusCategory } from '../../src/domain/types.ts'

/** Data civil ancorada em UTC, como as vindas da planilha (TD-03). */
const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const HOJE = civil('2026-08-03')

interface Fields {
  client?: string
  importer?: string
  agent?: string
  goods?: string
  clientGroup?: string
  eta2?: string | null
  responsible?: Responsible
  statusCategory?: StatusCategory
}

let nextRow = 2

function process({
  client = '',
  clientGroup = '',
  importer = '',
  agent = '',
  goods = '',
  eta2 = null,
  responsible = 'indefinido',
  statusCategory = 'em_andamento',
}: Fields): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: `FT${String(row).padStart(3, '0')}.26`,
    clientRaw: client,
    importerRaw: importer,
    billOfLading: '',
    agentRaw: agent,
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: goods,
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: eta2 === null ? null : civil(eta2),
    registrationDate: null,
    docsSentDate: null,
    clientKey: normKey(client),
    clientProcessKey: normKey(client),
    clientLabel: client,
    clientGroupKey: clientGroup,
    importerKey: normKey(importer),
    agentKey: normKey(agent),
    vesselKey: '',
    portKey: '',
    goodsKey: normKey(goods),
    statusCategory,
    responsible,
    customsChannel: 'indefinido',
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
  }
}

const byClient = (processes: Process[], topN = 10): ReturnType<typeof groupCount> =>
  groupCount(
    processes,
    (p) => p.clientKey,
    (p) => p.clientRaw,
    topN,
  )

describe('groupCount — agrupamento e normalizacao (A-26)', () => {
  it('unifica grafias que diferem por caixa e espaco', () => {
    const lista = byClient([
      process({ client: 'ACME LOG' }),
      process({ client: 'acme log' }),
      process({ client: '  ACME LOG  ' }),
    ])

    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ key: 'ACME LOG', count: 3 })
  })

  it('usa a primeira grafia encontrada como label', () => {
    const lista = byClient([process({ client: 'Acme Log' }), process({ client: 'ACME LOG' })])

    expect(lista[0]?.label).toBe('Acme Log')
    expect(lista[0]?.key).toBe('ACME LOG')
  })

  it('ordena por contagem decrescente', () => {
    const lista = byClient([
      process({ client: 'BETA' }),
      process({ client: 'ACME LOG' }),
      process({ client: 'ACME LOG' }),
    ])

    expect(lista.map((g) => g.key)).toEqual(['ACME LOG', 'BETA'])
  })

  it('desempata alfabeticamente pela chave (A-25)', () => {
    const lista = byClient([
      process({ client: 'ZETA' }),
      process({ client: 'ALFA' }),
      process({ client: 'MEIO' }),
    ])

    expect(lista.map((g) => g.key)).toEqual(['ALFA', 'MEIO', 'ZETA'])
  })

  it('corta em topN', () => {
    const lista = byClient(
      [
        process({ client: 'A' }),
        process({ client: 'B' }),
        process({ client: 'C' }),
        process({ client: 'D' }),
      ],
      2,
    )

    expect(lista).toHaveLength(2)
  })

  it('devolve todos quando topN excede o numero de grupos, sem preenchimento', () => {
    expect(byClient([process({ client: 'A' })], 10)).toHaveLength(1)
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(byClient([])).toEqual([])
  })
})

describe('groupCount — casos-limite de TD-04', () => {
  // Chave vazia nao e descartada: um cliente em branco e informacao sobre o
  // preenchimento da planilha. O rotulo "(sem valor)" e apresentacao (H-18).
  it('agrupa cliente vazio sob a chave vazia, com label vazio', () => {
    const lista = byClient([process({ client: '' }), process({ client: '   ' })])

    expect(lista).toHaveLength(1)
    expect(lista[0]).toEqual({ key: '', label: '', count: 2 })
  })

  it('nao unifica nomes parecidos', () => {
    const lista = groupCount(
      [process({ client: 'NAVIO ALFA' }), process({ client: 'NAVIO ALFHA' })],
      (p) => p.clientKey,
      (p) => p.clientRaw,
      10,
    )

    expect(lista).toHaveLength(2)
  })

  it('nao unifica ACME com ACME - SC', () => {
    expect(byClient([process({ client: 'ACME' }), process({ client: 'ACME - SC' })])).toHaveLength(
      2,
    )
  })

  it('unifica grafias que diferem por acento', () => {
    const lista = byClient([process({ client: 'MERCADORIA' }), process({ client: 'MERCADÓRIA' })])

    expect(lista).toHaveLength(1)
    expect(lista[0]?.count).toBe(2)
  })
})

describe('isOverdue — regra unica de IND-15 e ALE-01', () => {
  it('eta2 no passado e processo nao desembaracado esta atrasado', () => {
    expect(isOverdue(process({ eta2: '2026-08-02' }), HOJE)).toBe(true)
  })

  it('eta2 hoje nao esta atrasado', () => {
    expect(isOverdue(process({ eta2: '2026-08-03' }), HOJE)).toBe(false)
  })

  it('processo desembaracado nunca esta atrasado', () => {
    expect(isOverdue(process({ eta2: '2026-08-02', statusCategory: 'desembaracado' }), HOJE)).toBe(
      false,
    )
  })

  // A-20: data ausente nao e data vencida.
  it('eta2 nulo nunca esta atrasado', () => {
    expect(isOverdue(process({ eta2: null }), HOJE)).toBe(false)
  })
})

describe('agentRanking — IND-17 com overdueCount (A-27)', () => {
  it('traz o numero de atrasados de cada agente', () => {
    const lista = agentRanking(
      [
        process({ agent: 'AGENTE UM', eta2: '2026-08-02' }),
        process({ agent: 'AGENTE UM', eta2: '2026-08-01' }),
        process({ agent: 'AGENTE UM', eta2: '2026-08-20' }),
        process({ agent: 'AGENTE DOIS', eta2: '2026-08-20' }),
      ],
      HOJE,
      10,
    )

    expect(lista[0]).toMatchObject({ key: 'AGENTE UM', count: 3, overdueCount: 2 })
    expect(lista[1]).toMatchObject({ key: 'AGENTE DOIS', count: 1, overdueCount: 0 })
  })

  it('devolve overdueCount zero, nao ausente, quando nao ha atraso', () => {
    const lista = agentRanking([process({ agent: 'AGENTE UM', eta2: '2026-08-20' })], HOJE, 10)

    expect(lista[0]?.overdueCount).toBe(0)
  })

  it('nao conta como atraso o processo ja desembaracado', () => {
    const lista = agentRanking(
      [process({ agent: 'AGENTE UM', eta2: '2026-08-01', statusCategory: 'desembaracado' })],
      HOJE,
      10,
    )

    expect(lista[0]?.overdueCount).toBe(0)
  })
})

describe('responsibleRanking — IND-20 com as quatro chaves (A-28)', () => {
  it('devolve as quatro chaves, inclusive as zeradas', () => {
    const lista = responsibleRanking([process({ responsible: 'colaborador1' })])

    expect(lista.map((g) => g.key).sort()).toEqual([
      'colaborador1',
      'colaborador1_outros_clientes',
      'colaborador2',
      'indefinido',
    ])
    expect(lista.find((g) => g.key === 'colaborador2')?.count).toBe(0)
  })

  // O peso de 'indefinido' mede quanto da planilha nao tem responsavel
  // identificavel pela cor. Escondê-lo faria o ranking parecer completo.
  it('mantem indefinido visivel e ordenado por contagem', () => {
    const lista = responsibleRanking([
      process({ responsible: 'indefinido' }),
      process({ responsible: 'indefinido' }),
      process({ responsible: 'colaborador1' }),
    ])

    expect(lista[0]).toMatchObject({ key: 'indefinido', count: 2 })
    expect(lista[1]).toMatchObject({ key: 'colaborador1', count: 1 })
  })

  // O filtro faz o oposto (A-18); o ranking mostra a distribuicao real.
  it('mantem colaborador1 e colaborador1_outros_clientes separadas', () => {
    const lista = responsibleRanking([
      process({ responsible: 'colaborador1' }),
      process({ responsible: 'colaborador1_outros_clientes' }),
    ])

    expect(lista.find((g) => g.key === 'colaborador1')?.count).toBe(1)
    expect(lista.find((g) => g.key === 'colaborador1_outros_clientes')?.count).toBe(1)
  })

  it('devolve as quatro chaves zeradas para conjunto vazio', () => {
    const lista = responsibleRanking([])

    expect(lista).toHaveLength(4)
    expect(lista.every((g) => g.count === 0)).toBe(true)
  })
})

describe('bazarShare — a distorcao declarada de A-34', () => {
  it('mede a fracao entre os processos COM mercadoria preenchida', () => {
    const share = bazarShare([
      process({ goods: 'BAZAR' }),
      process({ goods: 'BAZAR' }),
      process({ goods: 'ELETRONICOS' }),
      process({ goods: '' }),
    ])

    // 2 de 3 com mercadoria; a linha em branco nao dilui.
    expect(share).toBe(0.6667)
  })

  it('normaliza a grafia antes de comparar', () => {
    expect(bazarShare([process({ goods: 'bazar' }), process({ goods: '  Bazar ' })])).toBe(1)
  })

  it('devolve zero quando ha mercadoria mas nenhuma e BAZAR', () => {
    expect(bazarShare([process({ goods: 'ELETRONICOS' })])).toBe(0)
  })

  // Fracao de conjunto vazio nao e zero — mesmo principio de A-42.
  it('devolve null quando nenhum processo tem mercadoria', () => {
    expect(bazarShare([process({ goods: '' })])).toBeNull()
    expect(bazarShare([])).toBeNull()
  })
})

/**
 * `H-56`. O grupo de `H-55` entra no ranking NO LUGAR dos membros. Exibir os
 * dois niveis contaria os mesmos processos duas vezes, e a soma das barras
 * deixaria de bater com o total.
 */
describe('groupCountWithGroups — o grupo colapsa os membros', () => {
  const ROTULOS = new Map([['GRUPO-UM', 'Grupo Um']])

  const ranking = (processes: Process[], topN = 10) =>
    groupCountWithGroups(
      processes,
      (p) => p.clientKey,
      (p) => p.clientRaw,
      (p) => p.clientGroupKey,
      ROTULOS,
      topN,
    )

  it('soma os membros numa entrada so, com a composicao em segments', () => {
    const lista = ranking([
      process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
      process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
      process({ client: 'BETA', clientGroup: 'GRUPO-UM' }),
    ])

    expect(lista).toEqual([
      {
        key: 'GRUPO-UM',
        label: 'Grupo Um',
        count: 3,
        segments: [
          { key: 'ACME', label: 'ACME', count: 2 },
          { key: 'BETA', label: 'BETA', count: 1 },
        ],
      },
    ])
  })

  it('quem nao tem grupo continua como linha propria, sem segments', () => {
    const lista = ranking([
      process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
      process({ client: 'ZETA' }),
    ])

    expect(lista.map((entrada) => entrada.key)).toEqual(['GRUPO-UM', 'ZETA'])
    expect(lista[1]).not.toHaveProperty('segments')
  })

  // A ordenacao de A-25 vale nos DOIS niveis, com desempate alfabetico.
  it('ordena grupos e segmentos por contagem, decrescente', () => {
    const lista = ranking([
      process({ client: 'BETA', clientGroup: 'GRUPO-UM' }),
      process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
      process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
      process({ client: 'ZETA' }),
      process({ client: 'ZETA' }),
      process({ client: 'ZETA' }),
      process({ client: 'ZETA' }),
    ])

    expect(lista.map((entrada) => entrada.count)).toEqual([4, 3])
    expect(lista[1]?.segments?.map((s) => s.key)).toEqual(['ACME', 'BETA'])
  })

  // Um grupo ocupa UMA posicao: e o que faz o corte mostrar mais clientes.
  it('o corte de topN conta o grupo como uma entrada', () => {
    const lista = ranking(
      [
        process({ client: 'ACME', clientGroup: 'GRUPO-UM' }),
        process({ client: 'BETA', clientGroup: 'GRUPO-UM' }),
        process({ client: 'ZETA' }),
      ],
      1,
    )

    expect(lista).toHaveLength(1)
    expect(lista[0]?.key).toBe('GRUPO-UM')
  })

  it('grupo sem rotulo no mapa usa a propria chave', () => {
    const lista = ranking([process({ client: 'ACME', clientGroup: 'DESCONHECIDO' })])

    expect(lista[0]?.label).toBe('DESCONHECIDO')
  })

  it('sem grupo nenhum, o resultado e o de groupCount', () => {
    const processes = [process({ client: 'ACME' }), process({ client: 'ACME' })]

    expect(ranking(processes)).toEqual(
      groupCount(
        processes,
        (p) => p.clientKey,
        (p) => p.clientRaw,
        10,
      ),
    )
  })
})
