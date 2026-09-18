import { describe, expect, it } from 'vitest'
import {
  arrivingIn15Days,
  arrivingTodayWhite,
  countByCategory,
  inClearanceCount,
  overdueWithoutDuimpCount,
  redChannelCount,
} from '../../src/domain/indicators.ts'
import type { Process, StatusCategory } from '../../src/domain/types.ts'

/**
 * O criterio de aceite dos nove cartoes, pedido pelo usuario em 18/09/2026:
 * **acrescentar uma linha que satisfaz a regra soma 1, e tira-la subtrai 1**.
 *
 * E o que um contador precisa provar e nenhum teste de valor prova: `overdue`
 * medindo 62 nao diz se ele mede a regra certa — so que mede alguma coisa
 * estavel. O par testemunha/contra-testemunha responde as duas metades:
 *
 * - a **testemunha** satisfaz a regra do cartao, e o contador tem de subir 1;
 * - a **contra-testemunha** e a mesma linha com UM atributo trocado — o que a
 *   regra exige —, e o contador NAO pode se mexer.
 *
 * Sem a segunda, uma regra frouxa passa: um cartao que contasse tudo somaria 1
 * com qualquer testemunha. A contra-testemunha e o que distingue "conta esta
 * linha" de "conta qualquer linha".
 *
 * A base e um conjunto pequeno e conhecido — quem exerce a planilha real e a
 * conferencia manual, com o mesmo par.
 */

const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)
const HOJE = civil('2026-09-18')

/** As chaves do arquivo real, como a rota as resolve pela cor de exibicao. */
const DESEMBARACO: ReadonlySet<string> = new Set([
  'argb:FFFFE599',
  'argb:FF5B9BD5',
  'argb:FFA74F7B',
  'argb:FFA64D79',
])
const BRANCAS: ReadonlySet<string> = new Set(['theme:0|tint:0.0000'])
const VERDE = 'argb:FF00FF00'

let nextRow = 2

interface Fields {
  statusCategory?: StatusCategory
  statusRaw?: string
  styleKey?: string
  eta2?: string | null
  customsChannel?: Process['customsChannel']
}

function process({
  statusCategory = 'em_andamento',
  statusRaw = 'AG BL ORIGINAL',
  styleKey = VERDE,
  eta2 = null,
  customsChannel = 'indefinido',
}: Fields = {}): Process {
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
    styleKey: styleKey,
    cellStyleKeys: {},
    fills: {},
    anomalies: [],
  }
}

/** A base: uma linha de cada categoria, nenhuma satisfazendo os cartoes de data. */
const BASE: readonly Process[] = [
  process({ statusCategory: 'desembaracado', statusRaw: 'DESEMBARAÇADA', eta2: '2020-01-01' }),
  process({ statusCategory: 'em_andamento', eta2: '2099-01-01' }),
  process({ statusCategory: 'em_desembaraco', statusRaw: '', eta2: '2099-01-01' }),
  process({ statusCategory: 'fechado_aguardando_draft', statusRaw: '', eta2: null }),
]

interface CardCase {
  readonly cartao: string
  readonly indicador: string
  readonly contar: (processes: readonly Process[]) => number
  readonly testemunha: () => Process
  /** A mesma linha com o atributo que a regra exige trocado. */
  readonly contraTestemunha: () => Process
  readonly oQueMuda: string
}

const CARTOES: readonly CardCase[] = [
  {
    cartao: 'Total',
    indicador: 'IND-01',
    contar: (p) => countByCategory(p).total,
    testemunha: () => process(),
    // IND-01 conta toda linha com REF: nao HA contra-testemunha, e a ausencia e
    // o proprio significado do cartao. O que se prova e que a base nao muda.
    contraTestemunha: () => process(),
    oQueMuda: 'nada — o total conta toda linha',
  },
  {
    cartao: 'Desembaraçados',
    indicador: 'IND-04',
    contar: (p) => countByCategory(p).desembaracados,
    testemunha: () => process({ statusCategory: 'desembaracado', statusRaw: 'DESEMBARAÇADA' }),
    contraTestemunha: () => process({ statusCategory: 'em_andamento' }),
    oQueMuda: 'a categoria de STATUS',
  },
  {
    cartao: 'Processos ativos',
    indicador: 'IND-02',
    contar: (p) => countByCategory(p).emAndamento,
    testemunha: () => process({ statusCategory: 'em_andamento' }),
    contraTestemunha: () => process({ statusCategory: 'desembaracado' }),
    oQueMuda: 'a categoria de STATUS',
  },
  {
    cartao: 'Em desembaraço · pela cor',
    indicador: 'IND-23',
    contar: (p) => inClearanceCount(p, DESEMBARACO),
    testemunha: () => process({ styleKey: 'argb:FF5B9BD5' }),
    contraTestemunha: () => process({ styleKey: VERDE }),
    oQueMuda: 'a cor da célula-âncora',
  },
  {
    cartao: 'Em desembaraço · pelo DUIMP',
    indicador: 'IND-23',
    contar: (p) => inClearanceCount(p, DESEMBARACO),
    testemunha: () => process({ styleKey: VERDE, statusRaw: 'DUIMP: 26BR0001 - CONFERIDO' }),
    contraTestemunha: () => process({ styleKey: VERDE, statusRaw: 'AG BL ORIGINAL' }),
    oQueMuda: 'a palavra DUIMP no STATUS',
  },
  {
    cartao: 'Aguardando draft',
    indicador: 'IND-05',
    contar: (p) => countByCategory(p).fechadoAguardandoDraft,
    testemunha: () => process({ statusCategory: 'fechado_aguardando_draft' }),
    contraTestemunha: () => process({ statusCategory: 'em_desembaraco' }),
    oQueMuda: 'a categoria de STATUS',
  },
  {
    cartao: 'Canal Vermelho',
    indicador: 'IND-06',
    contar: redChannelCount,
    testemunha: () => process({ customsChannel: 'vermelho' }),
    contraTestemunha: () => process({ customsChannel: 'verde' }),
    oQueMuda: 'o canal, que vem da cor',
  },
  {
    cartao: 'Chegando hoje',
    indicador: 'IND-24',
    contar: (p) => arrivingTodayWhite(p, HOJE, BRANCAS),
    testemunha: () => process({ styleKey: 'theme:0|tint:0.0000', eta2: '2026-09-18' }),
    // Mesma data, cor diferente: e a metade da regra que `D-49` acrescentou.
    contraTestemunha: () => process({ styleKey: VERDE, eta2: '2026-09-18' }),
    oQueMuda: 'a cor da linha, com o ETA2 igual',
  },
  {
    cartao: 'Chegando em 15 dias',
    indicador: 'IND-09',
    contar: (p) => arrivingIn15Days(p, HOJE),
    testemunha: () => process({ eta2: '2026-10-03' }),
    // Um dia alem do teto (A-35: extremos inclusivos).
    contraTestemunha: () => process({ eta2: '2026-10-04' }),
    oQueMuda: 'um dia no ETA2',
  },
  {
    cartao: 'Atrasados',
    indicador: 'IND-25',
    contar: (p) => overdueWithoutDuimpCount(p, HOJE),
    testemunha: () => process({ eta2: '2026-09-28', statusRaw: 'AG BL ORIGINAL' }),
    // Um dia alem do horizonte de 10 dias.
    contraTestemunha: () => process({ eta2: '2026-09-29', statusRaw: 'AG BL ORIGINAL' }),
    oQueMuda: 'um dia no ETA2',
  },
]

describe('o critério de aceite dos nove cartões: +1 e −1', () => {
  for (const caso of CARTOES) {
    describe(`${caso.cartao} (${caso.indicador})`, () => {
      it('acrescentar a linha que satisfaz a regra soma exatamente 1', () => {
        const antes = caso.contar(BASE)

        const depois = caso.contar([...BASE, caso.testemunha()])

        expect(depois).toBe(antes + 1)
      })

      it('tirar a mesma linha subtrai exatamente 1, e devolve o valor', () => {
        const antes = caso.contar(BASE)
        const testemunha = caso.testemunha()
        const comTestemunha = [...BASE, testemunha]

        const depois = caso.contar(comTestemunha)
        const semTestemunha = comTestemunha.filter((p) => p !== testemunha)

        expect(depois).toBe(antes + 1)
        expect(caso.contar(semTestemunha)).toBe(depois - 1)
        expect(caso.contar(semTestemunha)).toBe(antes)
      })
    })
  }

  /**
   * A outra metade: sem ela, um cartao que contasse TUDO passaria nos dois
   * testes acima. `Total` fica de fora por definicao — contar toda linha e o
   * que ele faz —, e por isso a lista e filtrada em vez de completa.
   */
  for (const caso of CARTOES.filter((c) => c.cartao !== 'Total')) {
    it(`${caso.cartao}: trocar ${caso.oQueMuda} deixa o contador parado`, () => {
      const antes = caso.contar(BASE)

      expect(caso.contar([...BASE, caso.contraTestemunha()])).toBe(antes)
    })
  }
})
