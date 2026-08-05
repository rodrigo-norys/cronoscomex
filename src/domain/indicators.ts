import { addDays, isoWeekEnd, isWithin, toIsoDay } from './date-window.ts'
import type { Process, Responsible } from './types.ts'

/**
 * Indicadores calculados sobre o conjunto ja filtrado. Funcoes puras: nao leem
 * arquivo, nao consultam relogio e nao conhecem HTTP.
 */

/** Bloco `counts` de GET /api/indicators — IND-01 a IND-05. */
export interface CategoryCounts {
  /** IND-01. Inclui `fechado_aguardando_draft`, por exigencia explicita. */
  total: number
  emAndamento: number
  emDesembaraco: number
  desembaracados: number
  fechadoAguardandoDraft: number
}

/**
 * Conta os processos por categoria.
 *
 * As quatro categorias sao mutuamente exclusivas (secao 2.1), entao a soma
 * delas iguala `total`. `em_desembaraco` e `fechado_aguardando_draft` sao
 * categorias DISTINTAS e nunca somadas — a segunda precede a primeira na
 * avaliacao de TD-01, e confundi-las esconderia 34 processos na planilha real.
 */
export function countByCategory(processes: readonly Process[]): CategoryCounts {
  const counts: CategoryCounts = {
    total: processes.length,
    emAndamento: 0,
    emDesembaraco: 0,
    desembaracados: 0,
    fechadoAguardandoDraft: 0,
  }

  for (const process of processes) {
    switch (process.statusCategory) {
      case 'em_andamento':
        counts.emAndamento++
        break
      case 'em_desembaraco':
        counts.emDesembaraco++
        break
      case 'desembaracado':
        counts.desembaracados++
        break
      case 'fechado_aguardando_draft':
        counts.fechadoAguardandoDraft++
        break
    }
  }

  return counts
}

/** IND-07. `eta2` exatamente hoje. */
export function arrivingToday(processes: readonly Process[], today: Date): number {
  return processes.filter((p) => isWithin(p.eta2, today, today)).length
}

/**
 * IND-08. De hoje ate o domingo que encerra a semana ISO, extremos inclusivos.
 *
 * Comeca em HOJE, nao na segunda: um container que chegou terca nao esta
 * "chegando" na quinta. A janela encolhe conforme a semana avanca, e no domingo
 * equivale a IND-07.
 */
export function arrivingThisWeek(processes: readonly Process[], today: Date): number {
  const weekEnd = isoWeekEnd(today)
  return processes.filter((p) => isWithin(p.eta2, today, weekEnd)).length
}

/** IND-09. De hoje ate hoje+15, extremos inclusivos (A-35). */
export function arrivingIn15Days(processes: readonly Process[], today: Date): number {
  return processes.filter((p) => isWithin(p.eta2, today, addDays(today, 15))).length
}

/** IND-12. Uma chegada prevista: um navio numa data. */
export interface ExpectedVessel {
  vesselKey: string
  /** Primeira grafia encontrada, como nos rankings (TD-04). */
  vesselLabel: string
  /** `AAAA-MM-DD`. */
  eta2: string
  processCount: number
}

/**
 * IND-12. Navios previstos de hoje em diante, hoje inclusive (A-24).
 *
 * Agrupa pelo par (navio, data): o mesmo navio em duas datas sao duas chegadas
 * distintas. Processo sem navio fica de fora — a lista responde "que navios
 * chegam", e uma linha sem nome nao responde nada. Ele continua contando nos
 * indicadores de container, que perguntam outra coisa.
 */
export function expectedVessels(processes: readonly Process[], today: Date): ExpectedVessel[] {
  const byVesselAndDate = new Map<string, ExpectedVessel>()

  for (const process of processes) {
    if (process.eta2 === null || process.vesselKey === '') continue
    if (process.eta2.getTime() < today.getTime()) continue

    const eta2 = toIsoDay(process.eta2)
    const groupKey = `${process.vesselKey}|${eta2}`
    const existing = byVesselAndDate.get(groupKey)

    if (existing) {
      existing.processCount++
      continue
    }
    byVesselAndDate.set(groupKey, {
      vesselKey: process.vesselKey,
      vesselLabel: process.vesselRaw.trim(),
      eta2,
      processCount: 1,
    })
  }

  return [...byVesselAndDate.values()].sort(
    (a, b) => a.eta2.localeCompare(b.eta2) || a.vesselKey.localeCompare(b.vesselKey),
  )
}

/**
 * Predicado de atraso — IND-15 e ALE-01, a mesma regra em duas apresentacoes
 * (A-19). Vive aqui, e nao em `overdueCount` (H-12), porque o ranking de
 * agentes ja precisa dele: duas implementacoes da mesma regra divergiriam.
 *
 * `eta2 = null` NUNCA satisfaz (A-20). Data ausente nao e data vencida.
 */
export function isOverdue(process: Process, today: Date): boolean {
  if (process.eta2 === null) return false
  return process.eta2.getTime() < today.getTime() && process.statusCategory !== 'desembaracado'
}

/** Uma linha de ranking. Formato de `05-contratos-api.md §1.3`. */
export interface GroupCount {
  /** Chave normalizada (TD-04). Vazia quando o campo de origem esta vazio. */
  key: string
  /**
   * Primeira grafia encontrada, na ordem da planilha (A-26). Fica vazio quando
   * a chave e vazia: o rotulo "(sem valor)" e apresentacao, decidida em H-18.
   */
  label: string
  count: number
  /** Presente apenas no ranking de agentes (A-27). */
  overdueCount?: number
}

/**
 * Agrupa e ordena por contagem decrescente, com desempate alfabetico pela
 * chave (A-25). `topN` corta o excedente; se houver menos grupos que `topN`,
 * devolve todos, sem preenchimento.
 *
 * Chave vazia NAO e descartada: um cliente em branco e informacao sobre o
 * preenchimento da planilha, e some-la em silencio esconderia o buraco.
 */
export function groupCount(
  processes: readonly Process[],
  key: (process: Process) => string,
  label: (process: Process) => string,
  topN: number,
): GroupCount[] {
  const groups = new Map<string, GroupCount>()

  for (const process of processes) {
    const groupKey = key(process)
    const existing = groups.get(groupKey)

    if (existing) {
      existing.count++
      continue
    }
    groups.set(groupKey, { key: groupKey, label: label(process).trim(), count: 1 })
  }

  return sortRanking([...groups.values()]).slice(0, topN)
}

function sortRanking(entries: GroupCount[]): GroupCount[] {
  return entries.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * IND-17. Ranking de agentes com `overdueCount`.
 *
 * A contagem de atrasados existe porque o objetivo declarado do indicador e
 * avaliar desempenho, e volume sozinho nao avalia nada (A-27).
 */
export function agentRanking(
  processes: readonly Process[],
  today: Date,
  topN: number,
): GroupCount[] {
  const overdueByKey = new Map<string, number>()
  for (const process of processes) {
    if (!isOverdue(process, today)) continue
    overdueByKey.set(process.agentKey, (overdueByKey.get(process.agentKey) ?? 0) + 1)
  }

  return groupCount(
    processes,
    (process) => process.agentKey,
    (process) => process.agentRaw,
    topN,
  ).map((entry) => ({ ...entry, overdueCount: overdueByKey.get(entry.key) ?? 0 }))
}

/** As quatro chaves de `Responsible`, sempre presentes (A-28). */
const RESPONSIBLE_KEYS: readonly Responsible[] = [
  'samira',
  'hugo',
  'samira_outros_clientes',
  'indefinido',
]

/**
 * IND-20. Ranking por responsavel, com as quatro chaves — inclusive as zeradas.
 *
 * `indefinido` visivel e o ponto: ele mede quanto da planilha nao tem
 * responsavel identificavel pela cor (A-17, A-28). Escondê-lo faria o ranking
 * parecer completo quando nao e.
 *
 * `samira` e `samira_outros_clientes` aparecem SEPARADAS aqui. O filtro faz o
 * oposto — `responsible=samira` seleciona ambas (A-18) —, porque sao perguntas
 * diferentes: o ranking mostra a distribuicao, o filtro recorta o trabalho.
 */
export function responsibleRanking(processes: readonly Process[]): GroupCount[] {
  const counts = new Map<string, number>(RESPONSIBLE_KEYS.map((key) => [key, 0]))

  for (const process of processes) {
    counts.set(process.responsible, (counts.get(process.responsible) ?? 0) + 1)
  }

  return sortRanking([...counts.entries()].map(([key, count]) => ({ key, label: key, count })))
}

/** Chave normalizada da mercadoria que domina a base (A-34). */
export const BAZAR_KEY = 'BAZAR'

/**
 * IND-13, parte declarativa. Fracao de `BAZAR` entre os processos **com
 * mercadoria preenchida**.
 *
 * A base exclui os processos sem mercadoria de proposito: a distorcao que A-34
 * denuncia e da composicao da lista de mercadorias, e dilui-la com linhas em
 * branco a mascararia justamente onde ela importa.
 *
 * `null` quando nenhum processo tem mercadoria — fracao de conjunto vazio nao e
 * zero, mesmo principio de A-42.
 */
export function bazarShare(processes: readonly Process[]): number | null {
  const withGoods = processes.filter((process) => process.goodsKey !== '')
  if (withGoods.length === 0) return null

  const bazar = withGoods.filter((process) => process.goodsKey === BAZAR_KEY).length
  return Number((bazar / withGoods.length).toFixed(4))
}
