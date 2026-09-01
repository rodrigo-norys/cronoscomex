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

/**
 * Severidade como FORMA, e não só matiz (`H-61`, `D-22`).
 *
 * O chip de canal é pílula preenchida com rótulo escrito; a severidade é faixa
 * lateral mais ícone. Os dois sistemas deixam de se distinguir pela cor, que é
 * o que a **regra inviolável 4** protege: canal é dado aduaneiro (IND-06),
 * severidade é gravidade, e nenhum dos dois infere o outro.
 *
 * **O prefixo textual de `H-45` fica.** Ele é o canal que `SC 1.4.1` exige, e o
 * ícone se SOMA a ele — trocar um pelo outro devolveria o achado `ACHADO 18`,
 * com a informação de urgência dependendo de enxergar um desenho.
 *
 * SVG inline, e não biblioteca de ícones: o plano não prevê a dependência.
 * `currentColor` faz o traço sobreviver a `forced-colors: active`, onde o UA
 * substitui a paleta do autor.
 */
function SeverityIcon({ urgent }: { urgent: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {urgent ? (
        // Triangulo de atencao: contorno fechado, legivel a 16 px.
        <>
          <path d="M8 2.5 14.5 13.5h-13z" strokeLinejoin="round" />
          <path d="M8 6.5v3.5" />
          <circle cx="8" cy="11.75" r="0.6" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5.5v3.5" />
          <circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  )
}

export function AlertRow({ group }: { group: AlertGroup }) {
  const mostSevere = group.alerts[0]
  if (mostSevere === undefined) return null

  const href = `/processo/${encodeURIComponent(group.ref)}`
  const urgent = mostSevere.severity <= URGENT_SEVERITY

  return (
    /*
      A faixa lateral carrega a severidade do grupo — a do alerta MAIS severo,
      que e o primeiro da lista (o servidor ja ordenou). `forced-colors:border-l-4`
      engrossa sob o modo forcado, onde a cor da faixa e substituida pelo UA e so
      a espessura sobrevive — mesma tecnica de `H-72` e `H-59`.

      **A variante estava sem efeito, e `H-65` mediu:** ela repetia o valor da
      base, entao as DEZ linhas de `/alertas` mediam `4px` sob
      `forced-colors: active`, urgentes e nao urgentes. Quem engrossa nao pode
      ser o ramo urgente — ele ja e o maximo —, e sim o outro, que some. O `pl`
      devolve os 4 px do desenho e viaja na MESMA variante, como em `H-59`.

      A informacao nunca esteve so aqui: o prefixo "Pede acao · " de `H-45`
      sobrevive ao modo forcado por ser texto. Esta correcao devolve o canal
      REDUNDANTE que o comentario prometia, e nao repara perda de informacao.
    */
    <li
      data-urgent={urgent}
      className={`border-b border-l-4 border-b-border-subtle last:border-b-0 ${
        urgent
          ? 'border-l-state-warning-border'
          : 'border-l-transparent forced-colors:border-l-0 forced-colors:pl-1'
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
          <SeverityIcon urgent={urgent} />
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
