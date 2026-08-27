import type { AlertsResponse } from '../api-client.ts'
import { navigate } from '../router.ts'

type Alert = AlertsResponse['items'][number]
type AlertType = Alert['type']

/**
 * Um processo da fila, com **todos** os tipos que ele satisfaz.
 *
 * O contrato da rota é achatado — um item por (processo, tipo) —, porque é
 * disso que a contagem por tipo precisa. O agrupamento é de apresentação
 * (A-60): medido na planilha real, são 40 linhas para 25 processos, e 13 deles
 * apareceriam repetidos. Repetir a mesma REF empurraria os outros para fora da
 * tela sem acrescentar pendência nenhuma.
 *
 * Identificado só por `ref` e `sourceRow` — nunca nome de cliente (regra 8).
 */

export interface AlertGroup {
  ref: string
  sourceRow: number
  eta2: string | null
  /** Na ordem que o servidor devolveu: severidade crescente. */
  alerts: Alert[]
}

export const ALERT_LABELS: Readonly<Record<AlertType, string>> = {
  eta_vencida: 'ETA vencida',
  canal_vermelho: 'Canal Vermelho',
  documentacao_pendente: 'Documentação pendente',
  processos_parados: 'Processo parado',
  chegadas_hoje: 'Chegada hoje',
  chegadas_7_dias: 'Chegada em 7 dias',
}

/** Severidade 1–3 pede ação; 4–6 é aviso. A escala vem de A-41 e é fixa. */
const URGENT_SEVERITY = 3

export function AlertRow({ group }: { group: AlertGroup }) {
  const mostSevere = group.alerts[0]
  if (mostSevere === undefined) return null

  return (
    <li className="border-b border-border-subtle last:border-0">
      <button
        type="button"
        onClick={() => navigate(`/processo/${encodeURIComponent(group.ref)}`)}
        title={`Abrir o detalhe de ${group.ref}`}
        className="flex w-full flex-col gap-1 px-1 py-2 text-left hover:bg-surface-sunken"
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-sm font-medium text-text-primary">{group.ref}</span>
          <span className="text-xs text-text-muted">linha {group.sourceRow}</span>
          <span className="text-xs text-text-muted">
            ETA2 {group.eta2 === null ? '—' : formatDay(group.eta2)}
          </span>
        </span>

        <span className="flex flex-wrap gap-1">
          {group.alerts.map((alert) => (
            <TypeBadge key={alert.type} alert={alert} />
          ))}
        </span>

        <span className="text-xs text-text-secondary">{mostSevere.message}</span>
      </button>
    </li>
  )
}

function TypeBadge({ alert }: { alert: Alert }) {
  const urgent = alert.severity <= URGENT_SEVERITY

  return (
    <span
      data-severity={alert.severity}
      className={`rounded px-2 py-0.5 text-xs ${
        urgent ? 'bg-state-warning-bg text-state-warning-fg' : 'bg-surface-base text-text-secondary'
      }`}
    >
      {ALERT_LABELS[alert.type]}
      {alert.daysOverdue !== null && (
        <span className="ml-1 tabular-nums">
          · {alert.daysOverdue} {alert.daysOverdue === 1 ? 'dia' : 'dias'}
        </span>
      )}
    </span>
  )
}

/**
 * Agrupa preservando a **ordem de primeira aparição**.
 *
 * A lista chega ordenada por severidade, depois `eta2` com nulos por último, e
 * `sourceRow` no desempate. Como o primeiro alerta de um processo é o mais
 * severo dele, a posição de primeira aparição já é a posição correta do grupo —
 * a ordenação do servidor é herdada inteira, sem reordenar nada aqui (regra
 * inviolável 6). `Map` preserva a ordem de inserção, então isto é uma passada.
 */
export function groupByProcess(alerts: readonly Alert[]): AlertGroup[] {
  const groups = new Map<string, AlertGroup>()

  for (const alert of alerts) {
    const existing = groups.get(alert.ref)
    if (existing) {
      existing.alerts.push(alert)
      continue
    }
    groups.set(alert.ref, {
      ref: alert.ref,
      sourceRow: alert.sourceRow,
      eta2: alert.eta2,
      alerts: [alert],
    })
  }

  return [...groups.values()]
}

function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
