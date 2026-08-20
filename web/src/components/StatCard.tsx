/**
 * Cartao-resumo da Pagina Inicial.
 *
 * Duas variantes, e a distincao e criterio de aceite (A-40): **volume** conta o
 * que existe, **urgencia** conta o que exige acao. A especificacao original
 * omitia Atrasados e Documentos pendentes da tela de entrada — a tela nao
 * mostrava o que pede trabalho.
 */

export type StatVariant = 'volume' | 'urgencia'

interface StatCardProps {
  label: string
  /** `null` enquanto nao ha leitura. Nunca renderizado como `0`. */
  value: number | null
  variant?: StatVariant
  hint?: string
}

const VARIANT_STYLE: Record<StatVariant, string> = {
  volume: 'border-border-subtle bg-surface-raised',
  urgencia: 'border-state-warning-border bg-state-warning-bg',
}

const VALUE_STYLE: Record<StatVariant, string> = {
  volume: 'text-text-primary',
  urgencia: 'text-state-warning-fg',
}

export function StatCard({ label, value, variant = 'volume', hint }: StatCardProps) {
  const loading = value === null

  return (
    <article
      className={`rounded border p-4 ${VARIANT_STYLE[variant]}`}
      data-variant={variant}
      aria-busy={loading}
    >
      <h3 className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</h3>
      {loading ? (
        // Um traco, e nao `0`: zero medido e zero por falta de leitura sao
        // coisas diferentes, e o cartao e o unico lugar que pode dizer qual.
        <p className="mt-1 text-3xl font-semibold text-text-muted">—</p>
      ) : (
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${VALUE_STYLE[variant]}`}>
          {value.toLocaleString('pt-BR')}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </article>
  )
}
