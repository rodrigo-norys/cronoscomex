import type { ReactNode } from 'react'
import type { IndicatorsResponse } from '../api-client.ts'

type RankingEntry = IndicatorsResponse['rankings']['clients'][number]

interface RankingBarProps {
  title: string
  entries: readonly RankingEntry[]
  /** Recebe a **chave normalizada**, que e o que os filtros casam (TD-04). */
  onSelect: (key: string) => void
  /** Fica sob o titulo, antes da lista: ressalva lida depois nao ressalva nada. */
  caveat?: ReactNode
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
export function RankingBar({ title, entries, onSelect, caveat, emptyMessage }: RankingBarProps) {
  const largest = entries.reduce((greatest, entry) => Math.max(greatest, entry.count), 0)

  return (
    <section aria-label={title} className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {caveat}

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.key}>
              <RankingRow entry={entry} largest={largest} onSelect={onSelect} />
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
}: {
  entry: RankingEntry
  largest: number
  onSelect: (key: string) => void
}) {
  const label = displayLabel(entry)
  const share = largest === 0 ? 0 : (entry.count / largest) * 100

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      title={`Filtrar por ${label} e abrir na Página Operacional`}
      className="group flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-slate-50"
    >
      <span className="w-40 shrink-0 truncate text-sm text-slate-700 group-hover:text-slate-900">
        {label}
      </span>
      <span className="h-4 grow rounded-sm bg-slate-100">
        <span
          className="block h-full rounded-sm bg-slate-400 group-hover:bg-slate-600"
          style={{ width: `${share}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-600">
        {entry.count.toLocaleString('pt-BR')}
      </span>
    </button>
  )
}
