import type { AlertsResponse } from '../api-client.ts'
import { navigate } from '../router.ts'
import { SeverityIcon, severityBand } from './SeverityMark.tsx'

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

  const href = `/processo/${encodeURIComponent(group.ref)}`
  const urgent = mostSevere.severity <= URGENT_SEVERITY

  return (
    /*
      A faixa lateral carrega a severidade do grupo — a do alerta MAIS severo,
      que e o primeiro da lista (o servidor ja ordenou).

      **A cor da faixa vem de `severityBand`, e nao mais de um token proprio**
      (`H-73`, `ACHADO 2`): `state-warning-border` media **1,60:1** no claro e
      **1,94:1** no escuro contra a superficie, sob o piso de 3:1 de
      `SC 1.4.11`. `state-warning-fg`, que e o que a faixa compartilhada usa,
      mede 5,92 e 8,93.

      **Quem engrossa sob o modo forcado e o ramo NAO urgente, que some** — o
      urgente ja esta no maximo. `H-65` mediu a variante antiga sem efeito: ela
      repetia o valor da base, e as DEZ linhas de `/alertas` mediam `4px`
      urgentes e nao urgentes. O `pl` devolve os 4 px e viaja na MESMA variante,
      como em `H-59`.

      A informacao nunca esteve so aqui: o prefixo "Pede acao · " de `H-45`
      sobrevive ao modo forcado por ser texto. A faixa e canal REDUNDANTE.
    */
    <li
      data-urgent={urgent}
      className={`border-b border-b-border-subtle last:border-b-0 ${
        urgent
          ? severityBand('warning')
          : 'border-l-4 border-l-transparent forced-colors:border-l-0 forced-colors:pl-1'
      }`}
    >
      {/*
        `ACHADO 16`. Abrir o detalhe e a MESMA acao que a tabela ja oferece, e
        aqui ela tinha outro papel — `<button>` contra `<a href>` — e outro nome
        acessivel. `SC 3.2.4` incide porque as sete telas tem URIs distintas
        (determinacao `Z1`), entao a consistencia deixa de ser preferencia.

        O interceptador e o de `ProcessTable`: modificador pressionado abre em
        aba nova, como qualquer link, e o clique simples navega sem recarregar.

        **O `aria-label` e explicito** porque sem ele o nome acessivel seria o
        bloco inteiro concatenado — REF, linha, ETA2, os rotulos de tipo e a
        mensagem —, contra `"NBSC260"` na tabela. Dois nomes para a mesma acao e
        exatamente o que `SC 3.2.4` proibe.
      */}
      <a
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          navigate(href)
        }}
        aria-label={`Abrir o detalhe de ${group.ref}`}
        className="flex w-full flex-col gap-1 px-1 py-2 text-left hover:bg-surface-sunken"
      >
        <span className="flex flex-wrap items-baseline gap-2">
          {/*
            **O glifo segue o tom, e o tom do urgente e `error`** (`H-73`). A
            correcao do revisor mandava `tone="warning"` nos dois — a faixa E o
            icone —, e isso colapsaria os dois glifos: urgente e nao urgente
            passariam a mostrar o mesmo circulo, perdendo um canal em vez de
            ganhar consistencia. O triangulo e o que distingue, e ele fica.
          */}
          <SeverityIcon tone={urgent ? 'error' : 'warning'} />
          <span className="font-mono text-sm font-medium text-text-primary">{group.ref}</span>
          <span className="text-xs text-text-muted">
            linha <span className="font-mono tabular-nums">{group.sourceRow}</span>
          </span>
          <span className="text-xs text-text-muted">
            ETA2{' '}
            <span className="font-mono tabular-nums">
              {group.eta2 === null ? '—' : formatDay(group.eta2)}
            </span>
          </span>
        </span>

        <span className="flex flex-wrap gap-1">
          {group.alerts.map((alert) => (
            <TypeBadge key={alert.type} alert={alert} />
          ))}
        </span>

        <span className="text-xs text-text-secondary">{mostSevere.message}</span>
      </a>
    </li>
  )
}

/**
 * `ACHADO 18`, `SC 1.4.1`. O urgente traz **prefixo textual**, e nao so o par
 * de cores: `data-severity` nao e exposto ao usuario e nao conta como canal.
 */
function TypeBadge({ alert }: { alert: Alert }) {
  const urgent = alert.severity <= URGENT_SEVERITY

  return (
    <span
      data-severity={alert.severity}
      className={`rounded-control px-2 py-0.5 text-xs ${
        urgent ? 'bg-state-warning-bg text-state-warning-fg' : 'bg-surface-base text-text-secondary'
      }`}
    >
      {urgent && <span className="font-semibold">Pede ação · </span>}
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
