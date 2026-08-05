/**
 * Fronteiras de data dos indicadores de calendario.
 *
 * TODA data aqui e **civil, ancorada em UTC** — a mesma convencao das datas
 * lidas da planilha (TD-03). O Excel nao armazena fuso: `01/ago` e 01/ago em
 * qualquer lugar do mundo. Converter para `America/Sao_Paulo` empurraria a data
 * para o dia anterior.
 *
 * O fuso entra em UM unico ponto: decidir que dia e "hoje". Depois disso, toda
 * comparacao acontece entre ancoras UTC, e nenhuma funcao deste modulo precisa
 * saber de fuso novamente.
 */

const DAY_MS = 86_400_000

/**
 * O dia civil corrente no fuso informado, ancorado em UTC.
 *
 * Sem esta conversao, uma consulta feita as 22h em Sao Paulo veria o dia
 * seguinte — `new Date()` as 22h de 03/08 e `2026-08-04T01:00:00Z`, e comparar
 * isso com um `eta2` da planilha erraria por um dia todas as noites.
 */
export function today(timezone: string, now: Date = new Date()): Date {
  // 'en-CA' formata como AAAA-MM-DD, o que torna o recorte trivial.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number)

  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

/** Soma dias mantendo a ancora UTC. `n` negativo subtrai. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/**
 * O domingo que encerra a semana ISO de `ref` — segunda a domingo (A-07).
 *
 * Nao recebe fuso: `ref` ja e data civil ancorada em UTC, entao o dia da semana
 * sai de `getUTCDay()`. Aceitar um fuso aqui so abriria caminho para a
 * conversao que TD-03 proibe.
 */
export function isoWeekEnd(ref: Date): Date {
  // getUTCDay(): 0 = domingo. Na semana ISO o domingo e o setimo dia, nao o
  // primeiro, entao ele ja e o proprio fim de semana.
  const weekday = ref.getUTCDay()
  const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday
  return addDays(ref, daysUntilSunday)
}

/** Intervalo fechado nos dois extremos (A-35). `null` nunca satisfaz (A-20). */
export function isWithin(date: Date | null, from: Date, to: Date): boolean {
  if (date === null) return false
  const time = date.getTime()
  return time >= from.getTime() && time <= to.getTime()
}

/** Formata como `AAAA-MM-DD`, sem tocar em fuso. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}
