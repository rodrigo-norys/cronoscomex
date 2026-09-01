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
  // O valor da celula CLT, sem ordenacao propria: `sort=client` ordena pelo
  // cliente consolidado, e oferecer as duas ordens confundiria as colunas.
  { key: 'clientProcess', label: 'Processo do cliente' },
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
      <p className="rounded-container border border-border-subtle bg-surface-raised p-6 text-sm text-text-secondary">
        Nenhum processo corresponde ao recorte atual.
      </p>
    )
  }

  return (
    // A tabela e larga; o scroll fica NELA, para a pagina nunca rolar na
    // horizontal e levar o cabecalho junto.
    <div className="overflow-x-auto rounded-container border border-border-subtle bg-surface-raised">
      <table className="w-full text-sm">
        <caption className="sr-only">Processos</caption>
        <thead className="border-b border-border-subtle bg-surface-sunken">
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
            /*
              `h-10` sao 2.5rem — 40 px na fonte-base padrao, e **relativo**, entao
              a linha acompanha o operador que amplia (`SC 1.4.4`). Altura
              declarada, e nao consequencia do `py-2`: sem ela a linha crescia com
              o conteudo mais alto, e a tabela perdia o ritmo vertical.

              **Sem faixa alternada**, e isso ja era verdade: o realce e o cursor,
              nao a paridade da linha. A assercao existe para nao voltar.
            */
            <tr
              key={item.ref}
              className="motion-tint h-10 border-b border-border-subtle last:border-0 hover:bg-surface-hover"
            >
              <td className="px-3 whitespace-nowrap font-mono">
                <a
                  href={`/processo/${encodeURIComponent(item.ref)}`}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    navigate(`/processo/${encodeURIComponent(item.ref)}`)
                  }}
                  // O nome ACESSIVEL e o mesmo de `AlertRow` para a mesma acao
                  // (`H-75`, `ACHADO 7`, falha `F31`). Ele CONTEM o texto
                  // visivel — a REF —, que e o que `SC 2.5.3` exige.
                  aria-label={`Abrir o detalhe de ${item.ref}`}
                  className="motion-tint text-text-secondary underline hover:text-text-primary"
                >
                  {item.ref}
                </a>
                {/* Sempre ausente ate `H-23`, que cria a fila de edicoes. */}
                {item.hasPendingEdits && (
                  <span
                    title="Tem edições pendentes de aplicação"
                    className="ml-1 rounded-control bg-state-warning-bg px-1 text-xs text-state-warning-fg"
                  >
                    ●
                  </span>
                )}
              </td>
              {/*
                **A linha de 40 px nao cresce, e nao corta dado em silencio.**
                Texto livre trunca com o valor completo no `title`; valor curto
                — REF, data, categoria — usa `nowrap` e alarga a coluna, que a
                tabela ja sabe rolar (`R01`). Medido em 01/09/2026: a celula de
                Categoria quebrava em SEIS retangulos de texto e esticava a linha
                para 57 px, porque o rotulo e o chip de canal nao cabiam juntos.
              */}
              <Text value={item.client} />
              <Text value={item.clientProcess} mono />
              <Text value={item.importer} />
              <Text value={item.vessel} />
              <td className="px-3 font-mono text-xs whitespace-nowrap tabular-nums">
                {formatDay(item.eta2)}
              </td>
              <Text value={item.billOfLading} mono />
              <Text value={item.container} mono />
              <td className="px-3 whitespace-nowrap">
                <span className="whitespace-nowrap">{CATEGORY_LABELS[item.statusCategory]}</span>
                {/*
                  **A unica excecao aos dois raios, e ela e declarada.** O chip de
                  canal e pilula — `rounded-full` —, porque a forma o separa da
                  severidade: canal e DADO aduaneiro (IND-06), severidade e
                  gravidade, e a regra inviolavel 4 nao deixa a cor decidir qual e
                  qual. Chip preenchido com rotulo ESCRITO, nunca so matiz.
                */}
                {item.customsChannel === 'vermelho' && (
                  <span className="ml-1 rounded-full bg-channel-red-bg px-2 py-0.5 text-xs text-channel-red-fg">
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
      className="h-10 px-3 text-left font-medium text-text-secondary"
    >
      {column.sortBy === undefined ? (
        column.label
      ) : (
        <button
          type="button"
          onClick={() => onSort(column.sortBy as SortField)}
          className="motion-tint flex items-center gap-1 hover:text-text-primary"
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

/**
 * Celula de texto livre: trunca por CSS e guarda o valor inteiro no `title`.
 *
 * `max-w` e obrigatorio — `truncate` sozinho nao tem sobre o que incidir numa
 * celula que o algoritmo de tabela dimensiona pelo conteudo.
 */
function Text({ value, mono = false }: { value: string; mono?: boolean }) {
  const cheio = value !== ''
  return (
    <td
      className={`max-w-48 truncate px-3 ${mono ? 'font-mono text-xs' : ''}`}
      {...(cheio ? { title: value } : {})}
    >
      {value || '—'}
    </td>
  )
}

/** Traco, e nao vazio: a celula em branco pareceria falha de renderizacao. */
function formatDay(isoDay: string | null): string {
  if (isoDay === null) return '—'
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
