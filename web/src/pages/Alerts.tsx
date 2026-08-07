import type { AlertsResponse } from '../api-client.ts'
import { ALERT_LABELS, AlertRow, groupByProcess } from '../components/AlertRow.tsx'
import { useAlerts } from '../hooks/useAlerts.ts'

/**
 * Página Alertas (RF-13). **É fila de trabalho, não panorama** (A-59).
 *
 * Nada é ordenado, contado ou agrupado por regra aqui: a ordem de severidade
 * (A-41) e as contagens por tipo vêm prontas do servidor. O agrupamento por
 * processo é apresentação, e herda a ordem recebida.
 */

type AlertType = keyof AlertsResponse['countsByType']

interface AlertsProps {
  queryString: string
  dataVersion: number
}

/** Na ordem de severidade de A-41, que é a mesma da lista. */
const TYPES_IN_SEVERITY_ORDER: readonly AlertType[] = [
  'eta_vencida',
  'canal_vermelho',
  'documentacao_pendente',
  'processos_parados',
  'chegadas_hoje',
  'chegadas_7_dias',
]

export function Alerts({ queryString, dataVersion }: AlertsProps) {
  const state = useAlerts(queryString, dataVersion)

  if (state.status === 'erro') {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <strong className="font-semibold">Não foi possível carregar os alertas.</strong>{' '}
        {state.message}
      </p>
    )
  }

  /**
   * Lista vazia aqui afirmaria "nenhuma pendência", que é o oposto de "ainda não
   * se sabe". Numa fila de trabalho essa confusão é a mais cara da aplicação.
   */
  if (state.status === 'semLeitura') {
    return (
      <p role="status" className="rounded border border-slate-300 bg-white p-4 text-sm">
        Nenhuma leitura da planilha foi concluída ainda. A fila aparece assim que a primeira
        terminar — vazio aqui não significa ausência de pendências.
      </p>
    )
  }

  if (state.status === 'carregando') {
    return (
      <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando alertas…
      </p>
    )
  }

  const { items, countsByType, stalledThresholdDays, historyStartedAt } = state.alerts
  const groups = groupByProcess(items)

  return (
    <div className="flex flex-col gap-4">
      <TypeCounts counts={countsByType} />

      <section
        aria-label="Fila de alertas"
        className="rounded border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-slate-700">
          {groups.length === 0
            ? 'Fila de alertas'
            : `${groups.length} ${groups.length === 1 ? 'processo pede' : 'processos pedem'} ação`}
        </h2>

        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-700">
            Nenhum processo ativo com pendência no recorte atual. A leitura foi concluída e a fila
            está de fato vazia.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col">
            {groups.map((group) => (
              <AlertRow key={group.ref} group={group} />
            ))}
          </ol>
        )}
      </section>

      <StalledNote thresholdDays={stalledThresholdDays} historyStartedAt={historyStartedAt} />
    </div>
  )
}

/**
 * As seis contagens, sempre visíveis — inclusive as zeradas.
 *
 * `processos_parados` é o caso especial: o zero dele não é medido, e sim
 * impossível de medir enquanto `H-28` não gravar histórico. Exibi-lo como `0`
 * ao lado de um zero medido diria que nada está parado, quando o que se sabe é
 * que ainda não dá para saber (regra inviolável 3).
 */
function TypeCounts({ counts }: { counts: AlertsResponse['countsByType'] }) {
  return (
    <section
      aria-label="Alertas por tipo"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {TYPES_IN_SEVERITY_ORDER.map((type) => {
        const measurable = type !== 'processos_parados'
        return (
          <article
            key={type}
            aria-label={ALERT_LABELS[type]}
            className="rounded border border-slate-200 bg-white p-3"
          >
            <h3 className="text-xs font-medium text-slate-500">{ALERT_LABELS[type]}</h3>
            {measurable ? (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[type]}</p>
            ) : (
              <p className="mt-1 text-2xl font-semibold text-slate-300" title="Sem histórico ainda">
                —
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}

/**
 * A ressalva de ALE-06, com o limiar declarado como premissa (A-32) e a data de
 * início do histórico (A-43, A-61).
 *
 * `historyStartedAt = null` é o estado corrente e permanece até `H-28`. Exibir
 * uma data vazia sugeriria histórico existente; não exibir nada deixaria o
 * traço da contagem sem explicação.
 */
function StalledNote({
  thresholdDays,
  historyStartedAt,
}: {
  thresholdDays: number
  historyStartedAt: string | null
}) {
  return (
    <section
      aria-label="Processos parados"
      className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600"
    >
      <p>
        <strong className="font-semibold text-slate-700">Processos parados não é medido.</strong> O
        alerta compara a data do último evento de mudança com hoje, e o histórico de leituras só
        passa a ser gravado em <strong>H-28</strong>. O traço acima significa isso — não que nenhum
        processo esteja parado.
      </p>
      <p className="mt-2">
        Limiar em uso: <strong className="tabular-nums">{thresholdDays} dias</strong> sem mudança.{' '}
        <em>É premissa</em> — a especificação não define o valor, e ele é configurável (A-32).
      </p>
      <p className="mt-2">
        {historyStartedAt === null ? (
          <>
            O histórico ainda não começou. Quando começar, não haverá retroatividade: nada anterior
            à primeira execução pode ser reconstruído (A-43).
          </>
        ) : (
          <>
            Histórico desde <strong>{formatDay(historyStartedAt)}</strong>. Nada anterior a essa
            data entra na conta — não há retroatividade (A-43).
          </>
        )}
      </p>
    </section>
  )
}

function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
