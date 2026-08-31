import { today as civilDay, diffDays } from './date-window.ts'
import type { CustomsChannel, Process, StatusCategory } from './types.ts'

/**
 * Historico de mudancas observadas, e a serie mensal que ele sustenta.
 *
 * Funcoes puras sobre eventos. Quem le e grava `data/history.jsonl` e
 * `src/io/history-store.ts`; aqui nao ha I/O.
 *
 * **Um evento e emitido quando a categoria OU o canal mudam.** O canal vem da
 * cor da linha (IND-06), nunca do STATUS, e por isso nao aparece em
 * `StatusCategory` — sem grava-lo, a serie mensal de Canal Vermelho que RF-14
 * pede (A-43) seria inderivavel do arquivo. O historico e append-only e sem
 * retroatividade (ADR-0005): mes que passa sem registro nao se recupera depois.
 *
 * **`daysInCategory` conta so as mudancas de CATEGORIA.** Um evento so de canal
 * nao reinicia a contagem: se reiniciasse, trocar a cor de uma linha apagaria o
 * alerta de processo parado (ALE-06) — falha na direcao de deixar de alertar.
 */

export interface StatusEvent {
  ts: string
  ref: string
  from: StatusCategory | null
  to: StatusCategory
  channel: CustomsChannel
  sourceRow: number
}

/** Um ponto da serie da Pagina Historico. Contrato em 05-contratos-api.md. */
export interface MonthlyPoint {
  /** `AAAA-MM`. */
  month: string
  total: number
  desembaracados: number
  canalVermelho: number
}

/**
 * O que o historico sabe sobre um REF depois do ultimo evento dele.
 *
 * `categoryChangedAt` e separado do `ts` do ultimo evento justamente porque o
 * ultimo evento pode ter sido de canal.
 */
export interface LastSeen {
  category: StatusCategory
  channel: CustomsChannel
  categoryChangedAt: string
}

export interface MonthlySeries {
  series: MonthlyPoint[]
  /** A janela pedida comeca antes do primeiro evento gravado. */
  truncated: boolean
}

/**
 * Os eventos que esta leitura produz: um por processo cuja categoria ou canal
 * diferem do ultimo estado conhecido.
 *
 * REF ausente de `processes` nao gera evento algum — sumir da planilha nao e
 * mudanca de categoria (ADR-0005), e trata-lo como tal encheria o arquivo de
 * eventos falsos a cada linha removida.
 */
export function diffEvents(
  previous: ReadonlyMap<string, LastSeen>,
  processes: readonly Process[],
  ts: string,
): StatusEvent[] {
  const events: StatusEvent[] = []

  for (const process of processes) {
    const seen = previous.get(process.ref)

    if (seen === undefined) {
      events.push({
        ts,
        ref: process.ref,
        from: null,
        to: process.statusCategory,
        channel: process.customsChannel,
        sourceRow: process.sourceRow,
      })
      continue
    }

    if (seen.category === process.statusCategory && seen.channel === process.customsChannel) {
      continue
    }

    events.push({
      ts,
      ref: process.ref,
      from: seen.category,
      to: process.statusCategory,
      channel: process.customsChannel,
      sourceRow: process.sourceRow,
    })
  }

  return events
}

/** O estado do REF depois de aplicar o evento. */
export function nextSeen(previous: LastSeen | undefined, event: StatusEvent): LastSeen {
  const categoryChanged = previous === undefined || previous.category !== event.to

  return {
    category: event.to,
    channel: event.channel,
    categoryChangedAt: categoryChanged ? event.ts : previous.categoryChangedAt,
  }
}

/**
 * Dias corridos desde um instante do historico. `null` quando nao ha instante,
 * ou quando ele nao e uma data valida — contagem sem base nao vira numero.
 *
 * Os dois lados sao reduzidos ao dia civil no fuso da aplicacao antes de
 * subtrair. O `ts` e um instante UTC, e comparar instante com dia civil erraria
 * por um dia toda leitura feita depois das 21h em Sao Paulo.
 */
export function daysSince(instant: string | null, today: Date, timezone: string): number | null {
  if (instant === null) return null

  const moment = new Date(instant)
  if (Number.isNaN(moment.getTime())) return null

  return Math.max(0, Math.round(diffDays(civilDay(timezone, moment), today)))
}

/**
 * Dias corridos desde a ultima mudanca de categoria. `null` quando o REF nunca
 * foi visto — contagem sem base nao vira alerta (ADR-0005).
 */
export function daysInCategory(
  seen: LastSeen | undefined,
  today: Date,
  timezone: string,
): number | null {
  return daysSince(seen?.categoryChangedAt ?? null, today, timezone)
}

/** `AAAA-MM` do instante, no fuso da aplicacao. */
export function monthOf(instant: Date, timezone: string): string {
  return civilDay(timezone, instant).toISOString().slice(0, 7)
}

function addMonth(month: string): string {
  const [year = 0, index = 1] = month.split('-').map(Number)
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`
}

/**
 * A serie mensal, reconstituida evento a evento.
 *
 * Cada ponto e o **estado ao fim do mes**, nao a contagem de eventos dele: um
 * mes sem evento algum repete o ponto anterior, porque ausencia de mudanca nao
 * e ausencia de processos (criterio de aceite de `H-21`).
 *
 * A ordem cronologica vem do arquivo ser append-only; nao ha reordenacao aqui.
 */
export function aggregateMonthly(
  events: Iterable<StatusEvent>,
  months: number,
  today: Date,
  timezone: string,
): MonthlySeries {
  const state = new Map<string, { category: StatusCategory; channel: CustomsChannel }>()
  const series: MonthlyPoint[] = []
  let openMonth: string | null = null

  const snapshot = (month: string): MonthlyPoint => {
    let desembaracados = 0
    let canalVermelho = 0
    for (const entry of state.values()) {
      if (entry.category === 'desembaracado') desembaracados += 1
      if (entry.channel === 'vermelho') canalVermelho += 1
    }
    return { month, total: state.size, desembaracados, canalVermelho }
  }

  for (const event of events) {
    const month = monthOf(new Date(event.ts), timezone)
    openMonth ??= month

    // Evento anterior ao mes aberto so aparece se o relogio recuou entre
    // leituras. Ele entra no mes corrente em vez de reabrir um ponto ja
    // fechado: a serie e append-only como o arquivo que a origina.
    while (openMonth < month) {
      series.push(snapshot(openMonth))
      openMonth = addMonth(openMonth)
    }

    state.set(event.ref, { category: event.to, channel: event.channel })
  }

  if (openMonth === null) return { series: [], truncated: false }

  // O mes aberto e fechado mesmo quando esta adiante de `today` — relogio
  // recuado depois de uma leitura. Sem isto a serie sairia vazia tendo evento.
  const lastMonth = monthOf(today, timezone)
  const end = openMonth > lastMonth ? openMonth : lastMonth
  for (; openMonth <= end; openMonth = addMonth(openMonth)) {
    series.push(snapshot(openMonth))
  }

  return { series: series.slice(-months), truncated: series.length < months }
}

/**
 * `H-54`. Um ponto da serie RECONSTRUIDA, derivada das datas da planilha.
 *
 * As duas medidas sao **estoque ao fim do mes**, a mesma grandeza de
 * `MonthlyPoint` — sem isso as series nao seriam comparaveis no mesmo eixo. Um
 * processo com `ETA2` em fevereiro conta em fevereiro e em todo mes seguinte.
 *
 * **Nao ha `canalVermelho` aqui, e a ausencia e deliberada.** A cor e o estado
 * de HOJE e nao carrega data: projeta-la para tras afirmaria que a linha ja era
 * vermelha naquele mes, que e exatamente o que a regra inviolavel 3 proibe.
 */
export interface ReconstructedPoint {
  /** `AAAA-MM`. */
  month: string
  /** Processos com `ETA2` ate o fim do mes. */
  chegados: number
  /** Processos com data de registro ate o fim do mes. */
  desembaracados: number
  /** Mes posterior ao mes corrente — o dado existe, o mes ainda nao aconteceu. */
  forecast: boolean
}

export interface ReconstructedSeries {
  points: ReconstructedPoint[]
  /** Sem `ETA2`: fora de `chegados` em todos os meses (regra inviolavel 2). */
  missingEta2: number
  /** Sem data de registro: fora de `desembaracados` em todos os meses. */
  missingRegistration: number
}

/** `AAAA-MM` de uma data CIVIL da planilha, que ja vem ancorada em UTC (TD-03). */
function monthOfCivil(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/**
 * A serie reconstruida a partir das datas que a planilha carrega (`H-54`).
 *
 * **Nao revoga A-43.** O que A-43 proibe e apresentar reconstrucao como
 * historico observado; ela nao inventa o estado de cada mes, e a rota a entrega
 * num bloco separado justamente para as duas nunca serem emendadas numa linha
 * so. Quem diz qual e qual e a tela.
 *
 * Cobre **todo** mes entre a primeira e a ultima data presente, inclusive os
 * vazios: mes sem processo e ponto em zero, nao buraco — buraco no eixo sugere
 * dado faltando onde ha dado medido.
 *
 * O intervalo vem das datas, e nao da janela da pagina: a planilha tem passado
 * datado, e cortar pela janela esconderia justamente o que a historia existe
 * para mostrar. Medido em 31/08/2026: `registrationDate` cobre sete meses de
 * 2026 e `ETA2` cobre dez a partir de dez/2025 (`docs/uso/RESULTADO.md` secao 6).
 */
export function reconstructMonthly(
  processes: readonly Process[],
  today: Date,
  timezone: string,
): ReconstructedSeries {
  const arrivals: string[] = []
  const clearances: string[] = []
  let missingEta2 = 0
  let missingRegistration = 0

  for (const process of processes) {
    if (process.eta2 === null) missingEta2 += 1
    else arrivals.push(monthOfCivil(process.eta2))

    if (process.registrationDate === null) missingRegistration += 1
    else clearances.push(monthOfCivil(process.registrationDate))
  }

  const all = [...arrivals, ...clearances].sort()
  const first = all[0]
  const last = all[all.length - 1]
  if (first === undefined || last === undefined) {
    return { points: [], missingEta2, missingRegistration }
  }

  const arrivalsByMonth = countByMonth(arrivals)
  const clearancesByMonth = countByMonth(clearances)
  const currentMonth = monthOf(today, timezone)

  const points: ReconstructedPoint[] = []
  let chegados = 0
  let desembaracados = 0
  for (let month = first; month <= last; month = addMonth(month)) {
    chegados += arrivalsByMonth.get(month) ?? 0
    desembaracados += clearancesByMonth.get(month) ?? 0
    points.push({ month, chegados, desembaracados, forecast: month > currentMonth })
  }

  return { points, missingEta2, missingRegistration }
}

function countByMonth(months: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const month of months) counts.set(month, (counts.get(month) ?? 0) + 1)
  return counts
}
