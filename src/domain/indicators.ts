import { addDays, diffDays, isoWeekEnd, isWithin, toIsoDay } from './date-window.ts'
import type { Process } from './types.ts'

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

export interface ArrivalDay {
  /** `AAAA-MM-DD`. */
  eta2: string
  vessels: ExpectedVessel[]
  /** Soma do dia. Existe para a interface nao somar — regra inviolavel 6. */
  processCount: number
}

/** O horizonte do calendario da Pagina Operacional, em dias. Mesmo valor de
 * IND-09 (A-35), e pelo mesmo motivo: e o alcance que o operador planeja. */
export const ARRIVAL_HORIZON_DAYS = 15

/**
 * As chegadas de hoje ate hoje+`horizonDays`, agrupadas por dia e, dentro do
 * dia, por navio.
 *
 * **Nao mexe em `expectedVessels` (IND-12), e reaproveita.** Aquele nao tem
 * teto por definicao — A-24 fixa "de hoje em diante" — e esta entregue e
 * testado desde `H-10`; acrescentar limite la mudaria o indicador para todos os
 * consumidores. O teto e desta apresentacao, entao vive aqui.
 *
 * O corte importa na pratica: medido na planilha real em 07/08/2026, sao 16
 * grupos (navio, dia) no total e **8** dentro de 15 dias — o mais distante cai
 * em 09/09. Cortar no cliente seria regra fora do dominio.
 *
 * **Dia sem chegada nao aparece.** O calendario lista o que chega, e uma linha
 * vazia por dia so afastaria as que importam.
 */
export function arrivalCalendar(
  processes: readonly Process[],
  today: Date,
  horizonDays: number = ARRIVAL_HORIZON_DAYS,
): ArrivalDay[] {
  const lastDay = toIsoDay(addDays(today, horizonDays))
  const byDay = new Map<string, ArrivalDay>()

  for (const vessel of expectedVessels(processes, today)) {
    if (vessel.eta2 > lastDay) continue

    const day = byDay.get(vessel.eta2)
    if (day) {
      day.vessels.push(vessel)
      day.processCount += vessel.processCount
      continue
    }
    byDay.set(vessel.eta2, {
      eta2: vessel.eta2,
      vessels: [vessel],
      processCount: vessel.processCount,
    })
  }

  // `expectedVessels` ja devolve ordenado por (data, navio), e `Map` preserva a
  // ordem de insercao — a ordem do calendario vem de graca.
  return [...byDay.values()]
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

/**
 * IND-06. **Apenas a cor e fonte** (A-06).
 *
 * STATUS mencionando canal nao conta: o classificador ja registra isso como
 * anomalia `CANAL_EM_TEXTO_STATUS`, e transformar texto em canal seria
 * adivinhar. `indefinido` (cor nao mapeada) tambem nao conta — nao saber a cor
 * nao e o mesmo que saber que ela nao e vermelha.
 */
export function redChannelCount(processes: readonly Process[]): number {
  return processes.filter((process) => process.customsChannel === 'vermelho').length
}

/**
 * A distribuicao de canal (`H-51`), ao lado de IND-06 e sem redefini-lo.
 *
 * `known` e o denominador do percentual, e vem separado das contagens de
 * proposito: as linhas em `indefinido` sao contadas e ficam FORA da fracao. Uma
 * cor que diz responsavel nao diz canal, e diluir 167 linhas num percentual
 * afirmaria que o canal delas e conhecido e nao verde.
 *
 * As fracoes vem do servidor ja resolvidas porque `null` quando `known` e zero
 * e regra de dado, nao formatacao: fracao de conjunto vazio nao e zero (A-42), e
 * deixar a tela dividir produziria `NaN` ou `0%` no primeiro recorte vazio.
 */
export interface ChannelDistribution {
  readonly verde: number
  readonly vermelho: number
  readonly indefinido: number
  /** `verde + vermelho` — os processos cujo canal a cor de fato classifica. */
  readonly known: number
  readonly verdeShare: number | null
  readonly vermelhoShare: number | null
}

export function channelDistribution(processes: readonly Process[]): ChannelDistribution {
  let verde = 0
  let vermelho = 0
  let indefinido = 0
  for (const process of processes) {
    if (process.customsChannel === 'verde') verde += 1
    else if (process.customsChannel === 'vermelho') vermelho += 1
    else indefinido += 1
  }

  const known = verde + vermelho
  return {
    verde,
    vermelho,
    indefinido,
    known,
    verdeShare: known === 0 ? null : verde / known,
    vermelhoShare: known === 0 ? null : vermelho / known,
  }
}

/** Prazo de antecedencia da documentacao, em dias (A-08). */
export const PENDING_DOCS_HORIZON_DAYS = 10

/**
 * Predicado de documentacao pendente — IND-14 e ALE-02, a mesma regra em duas
 * apresentacoes (A-08). Vive aqui pelo mesmo motivo de `isOverdue`: duas
 * implementacoes da mesma condicao divergem no primeiro ajuste.
 *
 * A janela tem TETO e nao tem PISO: `eta2 <= hoje+10`, nunca
 * `hoje <= eta2 <= hoje+10`. Um intervalo fechado — o reflexo natural, ja que
 * `isWithin` existe desde H-10 — excluiria todo processo cuja carga ja chegou
 * sem documento, que sao exatamente os mais graves.
 */
export function hasPendingDocs(process: Process, today: Date): boolean {
  if (process.docsSentDate !== null || process.eta2 === null) return false
  const horizon = addDays(today, PENDING_DOCS_HORIZON_DAYS).getTime()

  return process.eta2.getTime() <= horizon && process.statusCategory !== 'desembaracado'
}

/** IND-14. Apresentacao de `hasPendingDocs` — a regra vive la, nunca aqui. */
export function pendingDocsCount(processes: readonly Process[], today: Date): number {
  return processes.filter((process) => hasPendingDocs(process, today)).length
}

/** IND-15. Apresentacao de `isOverdue` — a regra vive la, nunca aqui. */
export function overdueCount(processes: readonly Process[], today: Date): number {
  return processes.filter((process) => isOverdue(process, today)).length
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
  /**
   * A composicao de um grupo de clientes (`H-56`), ordenada como o ranking.
   *
   * Presente **so** em entrada de grupo, e so no ranking de clientes: quem tem
   * `segments` conta os membros somados, e nenhum deles aparece como linha
   * propria — a soma das barras continua batendo com o total.
   */
  segments?: GroupCount[]
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

/**
 * IND-10 e IND-18 com os grupos de `H-55` colapsados numa entrada so (`H-56`).
 *
 * O grupo entra no ranking **no lugar** dos membros, com a contagem somada e a
 * composicao em `segments`. Exibir os dois niveis contaria os mesmos processos
 * duas vezes, e a soma das barras deixaria de bater com o total.
 *
 * A ordenacao e a mesma de `groupCount` nos dois niveis — decrescente, com
 * desempate alfabetico pela chave (A-25) —, e o corte de `topN` passa a valer
 * sobre as entradas **depois** do colapso: um grupo ocupa uma posicao, nao tres.
 *
 * `groupLabels` traz o rotulo de cada grupo, que vive no mapa e nao no
 * `Process`: carregar nome de grupo em campo de dominio para servir uma tela
 * repetiria o que `clientLabel` ja resolve para o cliente.
 */
export function groupCountWithGroups(
  processes: readonly Process[],
  key: (process: Process) => string,
  label: (process: Process) => string,
  groupOf: (process: Process) => string,
  groupLabels: ReadonlyMap<string, string>,
  topN: number,
): GroupCount[] {
  const members = new Map<string, GroupCount>()
  const groupOfMember = new Map<string, string>()

  for (const process of processes) {
    const memberKey = key(process)
    const existing = members.get(memberKey)

    if (existing) {
      existing.count++
      continue
    }
    members.set(memberKey, { key: memberKey, label: label(process).trim(), count: 1 })
    groupOfMember.set(memberKey, groupOf(process))
  }

  const grouped = new Map<string, GroupCount>()
  const loose: GroupCount[] = []

  for (const member of members.values()) {
    const groupKey = groupOfMember.get(member.key) ?? ''
    if (groupKey === '') {
      loose.push(member)
      continue
    }

    const group = grouped.get(groupKey)
    if (group === undefined) {
      grouped.set(groupKey, {
        key: groupKey,
        label: groupLabels.get(groupKey) ?? groupKey,
        count: member.count,
        segments: [member],
      })
      continue
    }
    group.count += member.count
    group.segments?.push(member)
  }

  for (const group of grouped.values()) {
    if (group.segments) group.segments = sortRanking(group.segments)
  }

  return sortRanking([...loose, ...grouped.values()]).slice(0, topN)
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

/**
 * IND-20. Ranking por responsavel, com todas as chaves conhecidas — inclusive
 * as zeradas.
 *
 * `known` vem de `knownResponsibles`, e nao dos processos: pessoa declarada no
 * mapa de equipe e sem processo algum aparece com zero, e a chave vazia — os
 * processos sem responsavel — aparece sempre (A-28). Escondê-las faria o
 * ranking parecer completo quando nao e; a chave vazia e o que mede quanto da
 * planilha nao tem dono, papel que `indefinido` tinha ate `H-50`.
 *
 * O rotulo sai de `known`, e nao de tabela escrita aqui: desde `H-50` a chave
 * de responsavel vem de `config/team-map.json`, que nao e versionado.
 * `process.responsibleLabel` cobre a chave que o mapa nao declara — o mapa
 * mudou entre a leitura e agora, e o rotulo do processo e o unico que sobrou.
 */
export function responsibleRanking(
  processes: readonly Process[],
  known: readonly { key: string; label: string }[],
): GroupCount[] {
  const counts = new Map<string, number>(known.map(({ key }) => [key, 0]))
  const labels = new Map<string, string>(known.map(({ key, label }) => [key, label]))

  for (const process of processes) {
    counts.set(process.responsible, (counts.get(process.responsible) ?? 0) + 1)
    if (!labels.has(process.responsible)) labels.set(process.responsible, process.responsibleLabel)
  }

  return sortRanking(
    [...counts.entries()].map(([key, count]) => ({
      key,
      label: labels.get(key) ?? key,
      count,
    })),
  )
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

/**
 * IND-16. Desembaracados **hoje**, cruzando data de registro E categoria.
 *
 * O cruzamento nao esta na especificacao: foi acrescentado por A-29, depois que
 * A-05 mostrou uma linha com RG preenchido e STATUS de canal amarelo — categoria
 * `em_andamento`. Sem a segunda condicao, o indicador contaria como concluido um
 * processo que nao concluiu.
 */
export function clearedTodayCount(processes: readonly Process[], today: Date): number {
  return processes.filter(
    (process) =>
      process.statusCategory === 'desembaracado' &&
      isWithin(process.registrationDate, today, today),
  ).length
}

/**
 * `H-52`. Desembaracados dentro da janela, contados pela data de REGISTRO.
 *
 * Mesma regra de IND-16 — categoria E data de registro (A-29) —, com a janela
 * no lugar do dia. Existe porque `desembaracados` responde "quantos dos que
 * chegaram na janela ja concluiram" e e lido como "quantos concluimos na
 * janela": duas perguntas, duas datas (`docs/uso/RESULTADO.md` secao 5).
 *
 * **A janela incide sobre o conjunto ja filtrado, e nao sobre a base.** RF-18
 * manda todo indicador desta rota responder sobre o recorte ativo, e um cartao
 * que ignorasse o filtro de periodo visivel na barra afirmaria um numero que a
 * tela nao explica. Sem filtro de periodo — o caso do criterio de aceite — os
 * dois conjuntos coincidem.
 *
 * Janela aberta dos dois lados conta todo processo desembaracado com RG: e o
 * mesmo `desembaracados` menos os que nao tem data de registro.
 */
export function clearedInPeriodCount(
  processes: readonly Process[],
  from: Date | null,
  to: Date | null,
): number {
  return processes.filter((process) => {
    if (process.statusCategory !== 'desembaracado') return false
    if (process.registrationDate === null) return false

    const time = process.registrationDate.getTime()
    if (from !== null && time < from.getTime()) return false
    if (to !== null && time > to.getTime()) return false
    return true
  }).length
}

/**
 * `H-52`. A faixa real de uma data no conjunto, para o cartao distinguir zero
 * por recorte de zero por ausencia de dado.
 *
 * `missing` nao e detalhe: data ausente nao esta dentro nem fora de janela
 * nenhuma (A-20), entao esses processos somem de qualquer recorte por periodo —
 * e sumir sem contagem seria descarte silencioso (regra inviolavel 2). Medido
 * em 31/08/2026: 64 dos 649 processos nao tem `ETA2` e 166 nao tem `RG`
 * (`docs/uso/RESULTADO.md` secao 5).
 */
export interface DateFieldRange {
  /** `AAAA-MM-DD`, ou `null` quando nenhum processo do conjunto tem a data. */
  readonly from: string | null
  readonly to: string | null
  readonly missing: number
}

export interface DataRanges {
  readonly eta2: DateFieldRange
  readonly registration: DateFieldRange
}

function rangeOf(processes: readonly Process[], pick: (p: Process) => Date | null): DateFieldRange {
  let earliest: Date | null = null
  let latest: Date | null = null
  let missing = 0

  for (const process of processes) {
    const date = pick(process)
    if (date === null) {
      missing += 1
      continue
    }
    if (earliest === null || date.getTime() < earliest.getTime()) earliest = date
    if (latest === null || date.getTime() > latest.getTime()) latest = date
  }

  return {
    from: earliest === null ? null : toIsoDay(earliest),
    to: latest === null ? null : toIsoDay(latest),
    missing,
  }
}

export function dataRanges(processes: readonly Process[]): DataRanges {
  return {
    eta2: rangeOf(processes, (process) => process.eta2),
    registration: rangeOf(processes, (process) => process.registrationDate),
  }
}

/** IND-22. Bloco `documentaryLeadTime` de GET /api/indicators. */
export interface LeadTime {
  /** `null` quando `sampleSize` e zero — media de conjunto vazio nao e zero. */
  averageDays: number | null
  sampleSize: number
  excludedNegative: number
  excludedIncomplete: number
}

/**
 * IND-22. Media de `registrationDate − docsSentDate`, em dias.
 *
 * A ordem da subtracao vem de A-02: a especificacao a descrevia invertida numa
 * secao e correta em outra, e RG e a extremidade FINAL do intervalo.
 *
 * As duas exclusoes de A-30 sao **contadas, nunca silenciadas**: par incompleto
 * e intervalo negativo saem da media, mas aparecem no resultado. Um numero
 * calculado sobre 12 de 649 linhas precisa dizer isso — e o mesmo motivo de
 * `sampleSize` existir (A-42, A-52).
 */
export function documentaryLeadTime(processes: readonly Process[]): LeadTime {
  let totalDays = 0
  const result: LeadTime = {
    averageDays: null,
    sampleSize: 0,
    excludedNegative: 0,
    excludedIncomplete: 0,
  }

  for (const { registrationDate, docsSentDate } of processes) {
    if (registrationDate === null || docsSentDate === null) {
      result.excludedIncomplete++
      continue
    }

    const days = diffDays(docsSentDate, registrationDate)
    if (days < 0) {
      result.excludedNegative++
      continue
    }

    totalDays += days
    result.sampleSize++
  }

  if (result.sampleSize > 0) {
    result.averageDays = Number((totalDays / result.sampleSize).toFixed(1))
  }
  return result
}

/** Uma linha de quebra de IND-22: o grupo, o volume e o tempo daquele grupo. */
export type LeadTimeGroup = GroupCount & LeadTime

/**
 * IND-22 quebrado por grupo — cliente, agente, navio ou responsavel (`H-19`).
 *
 * **Ordena por `sampleSize` decrescente, nao por `count`.** Os outros rankings
 * ordenam por volume porque respondem "quem tem mais"; este responde "onde da
 * para comparar", e as duas perguntas divergem na pratica: apenas 101 dos 649
 * processos tem as duas datas, e dos 509 grupos de cliente **425 nao tem
 * nenhuma**. Por volume, o topo da tabela seriam os maiores clientes, todos com
 * traco — a informacao ficaria fora do corte, embaixo. O desempate segue por
 * `count` e depois pela chave, para a ordem nao mudar entre chamadas.
 *
 * **Nao corta.** Quem corta nao pode ser quem conta: a rota precisa do total de
 * grupos para dizer quantos ficaram de fora, e um `topN` aqui apagaria esse
 * numero antes de alguem poder informa-lo (regra inviolavel 2).
 *
 * Grupo sem nenhum par completo entra com `averageDays: null` e `sampleSize: 0`
 * — some-lo esconderia que o campo nao e preenchido para aquele grupo, que e
 * informacao sobre a planilha, nao ausencia de informacao.
 */
export function leadTimeByGroup(
  processes: readonly Process[],
  key: (process: Process) => string,
  label: (process: Process) => string,
): LeadTimeGroup[] {
  const groups = new Map<string, LeadTimeGroup & { totalDays: number }>()

  for (const process of processes) {
    const groupKey = key(process)
    let group = groups.get(groupKey)

    if (group === undefined) {
      group = {
        key: groupKey,
        label: label(process).trim(),
        count: 0,
        averageDays: null,
        sampleSize: 0,
        excludedNegative: 0,
        excludedIncomplete: 0,
        totalDays: 0,
      }
      groups.set(groupKey, group)
    }
    group.count++

    const { registrationDate, docsSentDate } = process
    if (registrationDate === null || docsSentDate === null) {
      group.excludedIncomplete++
      continue
    }

    const days = diffDays(docsSentDate, registrationDate)
    if (days < 0) {
      group.excludedNegative++
      continue
    }

    group.totalDays += days
    group.sampleSize++
  }

  return [...groups.values()]
    .map(({ totalDays, ...group }) => ({
      ...group,
      averageDays: group.sampleSize > 0 ? Number((totalDays / group.sampleSize).toFixed(1)) : null,
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize || b.count - a.count || a.key.localeCompare(b.key))
}
