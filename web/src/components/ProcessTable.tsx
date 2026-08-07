import type { ProcessDto } from '../api-client.ts'
import type { SortField, SortOrder } from '../hooks/useProcessQuery.ts'
import { navigate } from '../router.ts'

/**
 * A tabela de processos. Nao ordena nem pagina: o servidor ja entregou a pagina
 * pronta, e reordenar aqui daria um resultado diferente do que `total` conta.
 */

interface Column {
  readonly key: string
  readonly label: string
  /** Ausente na coluna que o servidor nao sabe ordenar. */
  readonly sortBy?: SortField
}

const COLUMNS: readonly Column[] = [
  { key: 'ref', label: 'REF', sortBy: 'ref' },
  { key: 'client', label: 'Cliente', sortBy: 'client' },
  { key: 'importer', label: 'Importador' },
  { key: 'vessel', label: 'Navio', sortBy: 'vessel' },
  { key: 'eta2', label: 'ETA2', sortBy: 'eta2' },
  { key: 'billOfLading', label: 'BL' },
  { key: 'container', label: 'CNTR' },
  { key: 'status', label: 'Categoria' },
]

const CATEGORY_LABELS: Record<ProcessDto['statusCategory'], string> = {
  em_andamento: 'Em andamento',
  em_desembaraco: 'Em desembaraço',
  desembaracado: 'Desembaraçado',
  fechado_aguardando_draft: 'Fechado — draft',
}

interface ProcessTableProps {
  items: readonly ProcessDto[]
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
}

export function ProcessTable({ items, sort, order, onSort }: ProcessTableProps) {
  if (items.length === 0) {
    return (
      <p className="rounded border border-slate-300 bg-white p-6 text-sm text-slate-600">
        Nenhum processo corresponde ao recorte atual.
      </p>
    )
  }

  return (
    // A tabela e larga; o scroll fica NELA, para a pagina nunca rolar na
    // horizontal e levar o cabecalho junto.
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Processos</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {COLUMNS.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                order={order}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.ref}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              <td className="px-3 py-2 font-mono">
                <a
                  href={`/processo/${encodeURIComponent(item.ref)}`}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    navigate(`/processo/${encodeURIComponent(item.ref)}`)
                  }}
                  className="text-slate-800 underline hover:text-slate-950"
                >
                  {item.ref}
                </a>
                {/* Sempre ausente ate `H-23`, que cria a fila de edicoes. */}
                {item.hasPendingEdits && (
                  <span
                    title="Tem edições pendentes de aplicação"
                    className="ml-1 rounded bg-amber-200 px-1 text-xs text-amber-900"
                  >
                    ●
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{item.client || '—'}</td>
              <td className="px-3 py-2">{item.importer || '—'}</td>
              <td className="px-3 py-2">{item.vessel || '—'}</td>
              <td className="px-3 py-2 tabular-nums">{formatDay(item.eta2)}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.billOfLading || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.container || '—'}</td>
              <td className="px-3 py-2">
                <span className="whitespace-nowrap">{CATEGORY_LABELS[item.statusCategory]}</span>
                {item.customsChannel === 'vermelho' && (
                  <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-900">
                    Canal Vermelho
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HeaderCell({
  column,
  sort,
  order,
  onSort,
}: {
  column: Column
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
}) {
  const active = column.sortBy !== undefined && column.sortBy === sort
  const ariaSort = active ? (order === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <th
      scope="col"
      {...(ariaSort ? { 'aria-sort': ariaSort } : {})}
      className="px-3 py-2 text-left font-medium text-slate-600"
    >
      {column.sortBy === undefined ? (
        column.label
      ) : (
        <button
          type="button"
          onClick={() => onSort(column.sortBy as SortField)}
          className="flex items-center gap-1 hover:text-slate-900"
        >
          {column.label}
          <span aria-hidden="true" className="text-xs">
            {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      )}
    </th>
  )
}

/** Traco, e nao vazio: a celula em branco pareceria falha de renderizacao. */
function formatDay(isoDay: string | null): string {
  if (isoDay === null) return '—'
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
