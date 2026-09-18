/**
 * Cartao-resumo da Pagina Inicial.
 *
 * Duas variantes, e a distincao e criterio de aceite (A-40): **volume** conta o
 * que existe, **urgencia** conta o que exige acao. A especificacao original
 * omitia Atrasados e Documentos pendentes da tela de entrada — a tela nao
 * mostrava o que pede trabalho.
 *
 * **Rotulo e numero, e nada mais** (`D-49`). O cartao tinha duas linhas abaixo
 * do contador: a janela contada, de `H-52`, e o `hint` "Pede acao", de `H-45`.
 * As duas sairam por ordem do usuario, para despoluir a tela.
 *
 * **O que isso custa esta medido e foi aceito:** o `hint` era o que distinguia
 * a variante de urgencia em TEXTO (`ACHADO 18`, `SC 1.4.1`), e sem ele a
 * distincao volta a ser so o par de cores — a situacao anterior a `H-45`.
 */

export type StatVariant = 'volume' | 'urgencia'

interface StatCardProps {
  label: string
  /** `null` enquanto nao ha leitura. Nunca renderizado como `0`. */
  value: number | null
  variant?: StatVariant
}

const VARIANT_STYLE: Record<StatVariant, string> = {
  volume: 'border-border-subtle bg-surface-raised',
  urgencia: 'border-state-warning-border bg-state-warning-bg',
}

const VALUE_STYLE: Record<StatVariant, string> = {
  volume: 'text-text-primary',
  urgencia: 'text-state-warning-fg',
}

/*
  **Divergencia conhecida, e fora do predicado de `C04`** — que so alcanca
  `rounded`/`border`/`shadow`. O cartao de contagem daqui usa `font-mono
  text-3xl`; o de `Alerts.tsx` usa `text-2xl`, sem mono. Levantado pela revisao
  de estilo de 01/09/2026 e nao executado: unificar e decisao de desenho, nao
  correcao. Registrado aqui em 18/09/2026 (`D-48`), ao remover o documento que
  o guardava.
*/
export function StatCard({ label, value, variant = 'volume' }: StatCardProps) {
  const loading = value === null

  return (
    <article
      className={`rounded-container border p-4 ${VARIANT_STYLE[variant]}`}
      data-variant={variant}
      aria-busy={loading}
    >
      {/* `h2`, e nao `h3` (`H-74`, `ACHADO 1`): a secao dos cartoes nao tem
          titulo proprio, entao o `h1` da `TopBar` desceria direto para `h3` —
          falha `F43` de `SC 1.3.1`. O tamanho e do `text-xs`, nao do nivel. */}
      <h2 className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</h2>
      {loading ? (
        // Um traco, e nao `0`: zero medido e zero por falta de leitura sao
        // coisas diferentes, e o cartao e o unico lugar que pode dizer qual.
        <p className="mt-1 font-mono text-3xl font-semibold text-text-muted">—</p>
      ) : (
        <p className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${VALUE_STYLE[variant]}`}>
          {value.toLocaleString('pt-BR')}
        </p>
      )}
    </article>
  )
}
