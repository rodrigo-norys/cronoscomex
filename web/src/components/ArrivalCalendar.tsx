import type { IndicatorsResponse } from '../api-client.ts'

type ArrivalDay = IndicatorsResponse['arrivalCalendar'][number]

/**
 * O calendario de chegadas: os proximos 15 dias, por dia e por navio.
 *
 * Nada e calculado aqui — nem a soma do dia, que vem em `processCount`. O
 * recorte de 15 dias tambem vem do servidor: cortar no cliente seria regra de
 * negocio fora de `src/domain/`.
 *
 * **Dia sem chegada nao aparece**, e isso vem do dominio. O calendario lista o
 * que chega, e uma linha vazia por dia so afastaria as datas que importam.
 */
export function ArrivalCalendar({ days }: { days: readonly ArrivalDay[] }) {
  return (
    <section
      aria-label="Calendário de chegadas"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Chegadas nos próximos 15 dias</h2>

      {days.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          Nenhuma chegada prevista no período, dentro do recorte atual.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {days.map((day) => (
            <li key={day.eta2} className="border-l-2 border-border-subtle pl-3">
              <div className="flex items-baseline gap-2">
                <time dateTime={day.eta2} className="font-mono font-medium tabular-nums">
                  {formatDay(day.eta2)}
                </time>
                <span className="text-xs text-text-muted">
                  <span className="font-mono tabular-nums">{day.processCount}</span>{' '}
                  {day.processCount === 1 ? 'processo' : 'processos'}
                </span>
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {day.vessels.map((vessel) => (
                  <li key={vessel.vesselKey} className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{vessel.vesselLabel}</span>
                    <span className="shrink-0 text-right font-mono tabular-nums text-text-muted">
                      {vessel.processCount}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
