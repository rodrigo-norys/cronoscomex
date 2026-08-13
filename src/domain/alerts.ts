import { addDays, diffDays, isWithin, toIsoDay } from './date-window.ts'
import { hasPendingDocs, isOverdue } from './indicators.ts'
import type { Process } from './types.ts'

/**
 * Alertas derivados do estado atual. Funcoes puras, como os indicadores.
 *
 * A pagina de alertas e **fila de trabalho**, nao panorama: cada entrada existe
 * para pedir uma acao, e por isso processo `desembaracado` fica de fora dos
 * CINCO tipos (A-59) — a especificacao so era explicita em ALE-01 e ALE-02.
 * Medido na planilha real: sao **480 de 649** processos ja desembaracados, e
 * sem o filtro 5 de 14 alertas seriam sobre processos ja encerrados — em Canal
 * Vermelho, a maioria.
 */

export type AlertType =
  | 'eta_vencida'
  | 'documentacao_pendente'
  | 'canal_vermelho'
  | 'chegadas_hoje'
  | 'chegadas_7_dias'
  | 'processos_parados'

export interface Alert {
  type: AlertType
  severity: number
  /** Identificacao unica do processo. Nunca nome de cliente (regra 8). */
  ref: string
  sourceRow: number
  /** `AAAA-MM-DD`, ou `null` quando o processo nao tem ETA2. */
  eta2: string | null
  /** Preenchido apenas em `eta_vencida` e `processos_parados`. */
  daysOverdue: number | null
  message: string
}

/** Horizonte de ALE-05, em dias. Distinto dos 15 de IND-09 e dos 10 de IND-14. */
export const ARRIVAL_HORIZON_DAYS = 7

/**
 * Severidade fixa por tipo (A-41). Nao e configuravel: a ordem da fila e a
 * propria definicao de prioridade, e deixa-la editavel abriria caminho para
 * esconder o que incomoda.
 */
export const ALERT_SEVERITY: Readonly<Record<AlertType, number>> = {
  eta_vencida: 1,
  canal_vermelho: 2,
  documentacao_pendente: 3,
  processos_parados: 4,
  chegadas_hoje: 5,
  chegadas_7_dias: 6,
}

/** As seis chaves, sempre presentes — inclusive as zeradas. */
export type AlertCounts = Record<AlertType, number>

const ALERT_TYPES = Object.keys(ALERT_SEVERITY) as AlertType[]

export function emptyAlertCounts(): AlertCounts {
  return Object.fromEntries(ALERT_TYPES.map((type) => [type, 0])) as AlertCounts
}

export function countByType(alerts: readonly Alert[]): AlertCounts {
  const counts = emptyAlertCounts()
  for (const alert of alerts) counts[alert.type]++
  return counts
}

function makeAlert(
  process: Process,
  type: AlertType,
  message: string,
  daysOverdue: number | null = null,
): Alert {
  return {
    type,
    severity: ALERT_SEVERITY[type],
    ref: process.ref,
    sourceRow: process.sourceRow,
    eta2: process.eta2 === null ? null : toIsoDay(process.eta2),
    daysOverdue,
    message,
  }
}

/** Processo concluido nao pede acao, e por isso nao entra na fila (A-59). */
function isActionable(process: Process): boolean {
  return process.statusCategory !== 'desembaracado'
}

/**
 * "1 dia", nao "1 dias". O destinatario e o operador, nao o desenvolvedor —
 * texto de interface em pt-br, como manda a convencao. Sem acento, para
 * acompanhar as demais mensagens do projeto.
 */
function days(count: number): string {
  return count === 1 ? '1 dia' : `${count} dias`
}

/**
 * Constroi a fila completa, ordenada.
 *
 * Um processo aparece uma vez POR TIPO que satisfaz — sao pendencias distintas,
 * e ALE-04 esta contido em ALE-05 por construcao. O achatamento e do contrato,
 * que precisa dele para contar por tipo; a Pagina Alertas agrupa por processo na
 * exibicao (A-60). Medido no arquivo real: 40 linhas para 25 processos.
 *
 * `stalledDays` e `threshold` alimentam ALE-06, entregue em `H-29`. Com o mapa
 * vazio nenhum alerta desse tipo e gerado, e a chave fica em zero — que e
 * diferente de ausente: a contagem existe desde ja, so nao tem o que contar.
 */
export function buildAlerts(
  processes: readonly Process[],
  today: Date,
  stalledDays: ReadonlyMap<string, number>,
  threshold: number,
): Alert[] {
  const alerts: Alert[] = []

  for (const process of processes) {
    if (!isActionable(process)) continue

    if (isOverdue(process, today)) {
      // eta2 nunca e null aqui: isOverdue ja o exige.
      const overdueDays = diffDays(process.eta2 as Date, today)
      alerts.push(
        makeAlert(process, 'eta_vencida', `ETA vencida ha ${days(overdueDays)}`, overdueDays),
      )
    }

    if (process.customsChannel === 'vermelho') {
      alerts.push(makeAlert(process, 'canal_vermelho', 'Canal Vermelho'))
    }

    if (hasPendingDocs(process, today)) {
      alerts.push(
        makeAlert(
          process,
          'documentacao_pendente',
          describePendingDocs(diffDays(today, process.eta2 as Date)),
        ),
      )
    }

    const stalled = stalledDays.get(process.ref)
    if (stalled !== undefined && stalled >= threshold) {
      alerts.push(makeAlert(process, 'processos_parados', `Parado ha ${days(stalled)}`, stalled))
    }

    if (isWithin(process.eta2, today, today)) {
      alerts.push(makeAlert(process, 'chegadas_hoje', 'Chegada prevista para hoje'))
    }

    if (isWithin(process.eta2, today, addDays(today, ARRIVAL_HORIZON_DAYS))) {
      alerts.push(
        makeAlert(
          process,
          'chegadas_7_dias',
          describeArrival(diffDays(today, process.eta2 as Date)),
        ),
      )
    }
  }

  return sortAlerts(alerts)
}

/**
 * A janela de IND-14 nao tem piso, entao `days` e negativo quando a carga ja
 * chegou — e esse e o caso grave, que merece texto proprio em vez de
 * "documentacao pendente ha -3 dias".
 */
function describePendingDocs(untilArrival: number): string {
  if (untilArrival < 0) return `Documentacao pendente, carga chegou ha ${days(-untilArrival)}`
  if (untilArrival === 0) return 'Documentacao pendente, chegada hoje'
  return `Documentacao pendente, ETA em ${days(untilArrival)}`
}

function describeArrival(untilArrival: number): string {
  if (untilArrival === 0) return 'Chegada prevista para hoje'
  if (untilArrival === 1) return 'Chegada prevista para amanha'
  return `Chegada prevista em ${days(untilArrival)}`
}

/**
 * Severidade ascendente, depois `eta2` ascendente com NULOS POR ULTIMO.
 *
 * `localeCompare` sobre a data ISO basta: `AAAA-MM-DD` ordena igual como texto e
 * como data. O desempate final por `sourceRow` existe para a ordem ser
 * deterministica — sem ele, dois alertas iguais em tipo e data trocariam de
 * lugar entre execucoes, e o teste ficaria intermitente.
 */
function sortAlerts(alerts: Alert[]): Alert[] {
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity
    if (a.eta2 === null) return b.eta2 === null ? a.sourceRow - b.sourceRow : 1
    if (b.eta2 === null) return -1
    return a.eta2.localeCompare(b.eta2) || a.sourceRow - b.sourceRow
  })
}
