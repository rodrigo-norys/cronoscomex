import type { ReactNode } from 'react'
import type { IndicatorsResponse } from '../api-client.ts'

type RankingEntry = IndicatorsResponse['rankings']['clients'][number]

interface RankingBarProps {
  title: string
  entries: readonly RankingEntry[]
  /**
   * Recebe a **chave normalizada**, que e o que os filtros casam (TD-04).
   *
   * Ausente torna a linha inerte, e isso e usado de proposito no ranking por
   * responsavel de `H-19`: A-18 faz o filtro `colaborador1` selecionar **junto**
   * `colaborador1_outros_clientes`, enquanto o ranking os exibe separados, por
   * serem perguntas diferentes. Clicar numa linha de 120 e cair numa tela de 129
   * faria o operador desconfiar do numero certo.
   */
  onSelect?: (key: string) => void
  /** Fica sob o titulo, antes da lista: ressalva lida depois nao ressalva nada. */
  caveat?: ReactNode
  /** Metrica ao lado da contagem — o `overdueCount` de A-27 em `H-19`. */
  secondary?: (entry: RankingEntry) => ReactNode
  emptyMessage: string
}

/**
 * Um ranking em barras horizontais, cada linha levando ao recorte que ela conta.
 *
 * Nada e ordenado nem cortado aqui: a lista chega decrescente, com desempate
 * alfabetico pela chave (A-25) e ja limitada a `meta.topN` pelo servidor. A
 * unica aritmetica e a largura da barra — proporcao de pixel, nao indicador
 * derivado, do mesmo estatuto da soma exibida na Pagina Inicial.
 */
export function RankingBar({
  title,
  entries,
  onSelect,
  caveat,
  secondary,
  emptyMessage,
}: RankingBarProps) {
  const largest = entries.reduce((greatest, entry) => Math.max(greatest, entry.count), 0)

  return (
    <section
      aria-label={title}
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
      {caveat}

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.key}>
              <RankingRow
                entry={entry}
                largest={largest}
                {...(onSelect ? { onSelect } : {})}
                {...(secondary ? { secondary } : {})}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** A-26: a grafia de origem, nunca a chave normalizada. */
function displayLabel(entry: RankingEntry): string {
  return entry.label === '' ? '(sem valor)' : entry.label
}

function RankingRow({
  entry,
  largest,
  onSelect,
  secondary,
}: {
  entry: RankingEntry
  largest: number
  onSelect?: (key: string) => void
  secondary?: (entry: RankingEntry) => ReactNode
}) {
  const label = displayLabel(entry)
  const share = largest === 0 ? 0 : (entry.count / largest) * 100

  const content = (
    <>
      <span className="w-40 shrink-0 truncate text-sm text-text-secondary group-hover:text-text-primary">
        {label}
      </span>
      <span className="h-4 grow rounded-sm bg-meter-track">
        <span
          className="block h-full rounded-sm bg-meter-fill group-hover:bg-meter-fill-hover"
          style={{ width: `${share}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-text-secondary">
        {entry.count.toLocaleString('pt-BR')}
      </span>
      {secondary && <span className="w-24 shrink-0 text-right text-xs">{secondary(entry)}</span>}
    </>
  )

  const shared = 'group flex w-full items-center gap-3 rounded px-1 py-1 text-left'

  if (onSelect === undefined) return <span className={shared}>{content}</span>

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      title={`Filtrar por ${label} e abrir na Página Operacional`}
      className={`${shared} hover:bg-surface-sunken`}
    >
      {content}
    </button>
  )
}
