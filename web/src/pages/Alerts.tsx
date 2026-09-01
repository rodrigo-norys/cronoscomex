import type { AlertsResponse } from '../api-client.ts'
import { ALERT_LABELS, AlertRow, groupByProcess } from '../components/AlertRow.tsx'
import { PageAlert } from '../components/PageAlert.tsx'
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
      <PageAlert
        className="panel-error"
        announcement={`Não foi possível carregar os alertas. ${state.message}`}
      >
        <strong className="font-semibold">Não foi possível carregar os alertas.</strong>{' '}
        {state.message}
      </PageAlert>
    )
  }

  /**
   * Lista vazia aqui afirmaria "nenhuma pendência", que é o oposto de "ainda não
   * se sabe". Numa fila de trabalho essa confusão é a mais cara da aplicação.
   */
  if (state.status === 'semLeitura') {
    return (
      <PageAlert
        tone="status"
        className="panel-no-read"
        announcement="Nenhuma leitura da planilha foi concluída ainda. A fila aparece assim que a primeira terminar — vazio aqui não significa ausência de pendências."
      >
        Nenhuma leitura da planilha foi concluída ainda. A fila aparece assim que a primeira
        terminar — vazio aqui não significa ausência de pendências.
      </PageAlert>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando alertas…</p>
  }

  const {
    items,
    countsByType,
    stalledThresholdDays,
    historyStartedAt,
    stalledCoverageDays,
    stalledMeasurable,
  } = state.alerts
  const groups = groupByProcess(items)

  return (
    <div className="flex flex-col gap-4">
      <TypeCounts counts={countsByType} stalledMeasurable={stalledMeasurable} />

      <section
        aria-label="Fila de alertas"
        className="rounded-container border border-border-subtle bg-surface-raised p-4"
      >
        <h2 className="text-sm font-semibold text-text-secondary">
          {groups.length === 0
            ? 'Fila de alertas'
            : `${groups.length} ${groups.length === 1 ? 'processo pede' : 'processos pedem'} ação`}
        </h2>

        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
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

      <StalledNote
        thresholdDays={stalledThresholdDays}
        historyStartedAt={historyStartedAt}
        coverageDays={stalledCoverageDays}
        measurable={stalledMeasurable}
      />
    </div>
  )
}

/**
 * As seis contagens, sempre visíveis — inclusive as zeradas.
 *
 * `processos_parados` é o caso especial: o zero dele só é medido depois que o
 * histórico ficar mais velho que o limiar. Antes disso, exibi-lo como `0` ao
 * lado de um zero medido diria que nada está parado, quando o que se sabe é que
 * ainda não dá para saber (regra inviolável 3). **Quem decide é o servidor**,
 * em `stalledMeasurable` — aqui não se recalcula a comparação (regra 6).
 */
function TypeCounts({
  counts,
  stalledMeasurable,
}: {
  counts: AlertsResponse['countsByType']
  stalledMeasurable: boolean
}) {
  return (
    <section
      aria-label="Alertas por tipo"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {TYPES_IN_SEVERITY_ORDER.map((type) => {
        const measurable = type !== 'processos_parados' || stalledMeasurable
        return (
          <article
            key={type}
            aria-label={ALERT_LABELS[type]}
            className="rounded-container border border-border-subtle bg-surface-raised p-3"
          >
            <h3 className="text-xs font-medium text-text-muted">{ALERT_LABELS[type]}</h3>
            {measurable ? (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[type]}</p>
            ) : (
              <p
                className="mt-1 text-2xl font-semibold text-text-muted"
                title="O histórico ainda não cobre o limiar"
              >
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
 * São três estados, e a diferença entre os dois primeiros é o que A-43 pede que
 * a tela diga: sem histórico nenhum, histórico mais novo que o limiar — em que
 * o zero é inevitável e não significa ausência de processo parado — e histórico
 * já suficiente, em que a contagem passa a valer.
 */
function StalledNote({
  thresholdDays,
  historyStartedAt,
  coverageDays,
  measurable,
}: {
  thresholdDays: number
  historyStartedAt: string | null
  coverageDays: number | null
  measurable: boolean
}) {
  return (
    <section
      aria-label="Processos parados"
      className="rounded border border-dashed border-border-subtle bg-surface-sunken p-4 text-xs text-text-secondary"
    >
      {measurable ? (
        <p>
          <strong className="font-semibold text-text-secondary">
            Processos parados está medido.
          </strong>{' '}
          O alerta compara a data do último evento de mudança de categoria com hoje. Trocar apenas a
          cor de uma linha não reinicia a contagem.
        </p>
      ) : (
        <p>
          <strong className="font-semibold text-text-secondary">
            Processos parados não é medido.
          </strong>{' '}
          {coverageDays === null
            ? 'O alerta compara a data do último evento de mudança com hoje, e nenhuma leitura foi registrada ainda.'
            : `O histórico tem ${describeDays(coverageDays)} e o limiar é de ${thresholdDays} dias — nenhum processo teve tempo de atingi-lo.`}{' '}
          O traço acima significa isso — não que nenhum processo esteja parado.
        </p>
      )}
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

function describeDays(count: number): string {
  return count === 1 ? '1 dia' : `${count} dias`
}

/**
 * `historyStartedAt` é **instante ISO completo**, não `AAAA-MM-DD`: o campo
 * carrega o `ts` do primeiro evento. Fatiar o texto pelos hifens rendia
 * `17T12:00:00.000Z/08/2026` na tela — defeito desde `H-28`, invisível porque o
 * stub do teste servia data pura. A aplicação é local, então o fuso da máquina
 * é o do operador, e o formatador do navegador dá o dia certo.
 */
function formatDay(instant: string): string {
  return new Date(instant).toLocaleDateString('pt-BR')
}
