import { enqueueEdit, type ProcessDto, setProcessClient } from '../api-client.ts'
import { type GridNavigation, useGridNavigation } from '../hooks/useGridNavigation.ts'
import type { SortField, SortOrder } from '../hooks/useProcessQuery.ts'
import { navigate } from '../router.ts'
import { EditableCell } from './EditableCell.tsx'

/**
 * A tabela de processos. Nao ordena nem pagina: o servidor ja entregou a pagina
 * pronta, e reordenar aqui daria um resultado diferente do que `total` conta.
 *
 * **Sete das nove colunas se editam onde estao** (02/09/2026), por DUAS portas.
 * As seis que sao celula da planilha enfileiram em `POST /api/edits`, como o
 * detalhe faz desde `H-23`. Cliente vai por `PUT /api/processes/:ref/client`,
 * porque nao e celula: e a regra de consolidacao de `client-map.json`, e
 * declara-la ali e o caminho de volta do que a coluna ja lia.
 *
 * As duas que sobram nao tem porta: REF e a chave natural, e Categoria sai de
 * cinco regras das quais so uma le a celula L (`A-22`) — editar o rotulo
 * gravaria numa celula que nao esta a vista.
 *
 * **Nenhuma celula declara tamanho de fonte**, e isso e invariante desde
 * 04/09/2026. `H-61` decidiu a FAMILIA — mono onde ha codigo ou numero, porque
 * monoespacada alinha os digitos entre linhas vizinhas e torna a coluna
 * comparavel — e nunca decidiu o corpo. As cinco colunas de codigo nasceram
 * `text-xs` e as quatro de texto livre ficaram nos `text-sm` da tabela, e o
 * degrau de 12 contra 14 px desalinhava opticamente a mesma linha. Achado do
 * usuario ao usar a tela. Agora todas herdam os 14 px da `<table>`, e o que
 * separa codigo de texto e so a FORMA da letra. Medido: unificar custa **zero**
 * numa janela de 1920 px, onde a tabela ja cabe, e **+42 px** em 1400 e 1280,
 * onde ela ja rolava; a linha continua com os 40 px de `H-61`.
 */

interface Column {
  readonly key: string
  readonly label: string
  readonly sortBy: SortField
}

/**
 * As nove colunas, **todas** ordenaveis desde 02/09/2026.
 *
 * Quatro nao eram, e a tela nao dizia por que: quem clicava em BL nao recebia
 * nem ordem nem recusa. `client` e `clientProcess` tem ordens proprias e
 * distintas — o cliente consolidado e o valor da celula CLT sao coisas
 * diferentes (`H-49`), e e por isso que sao duas colunas.
 */
const COLUMNS: readonly Column[] = [
  { key: 'ref', label: 'REF', sortBy: 'ref' },
  { key: 'client', label: 'Cliente', sortBy: 'client' },
  { key: 'clientProcess', label: 'Processo do cliente', sortBy: 'clientProcess' },
  { key: 'importer', label: 'Importador', sortBy: 'importer' },
  { key: 'vessel', label: 'Navio', sortBy: 'vessel' },
  { key: 'eta2', label: 'ETA2', sortBy: 'eta2' },
  { key: 'billOfLading', label: 'BL', sortBy: 'billOfLading' },
  { key: 'container', label: 'CNTR', sortBy: 'container' },
  { key: 'status', label: 'Categoria', sortBy: 'status' },
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
  /** Recarrega a lista depois de uma edicao enfileirada. */
  onEdited: () => void
}

export function ProcessTable({ items, sort, order, onSort, onEdited }: ProcessTableProps) {
  const grid = useGridNavigation(items.length, COLUMNS.length)

  if (items.length === 0) {
    return (
      <p className="rounded-container border border-border-subtle bg-surface-raised p-6 text-sm text-text-secondary">
        Nenhum processo corresponde ao recorte atual.
      </p>
    )
  }

  /*
    `role="grid"`, e nao `table`: a tabela e editavel, e sem a grade cada linha
    custa sete paradas de tabulacao — ~1.400 numa pagina cheia, com a paginacao
    DEPOIS dela no DOM. O porque completo, e a troca que ela impoe ao leitor de
    tela, estao no cabecalho de `useGridNavigation`.

    **O invólucro fica na linha de cima, e isso e exigencia de guarda:**
    `tests/repo/estilo.test.ts` procura `overflow-x-auto` nas TRES linhas acima
    de cada `<table>` (`R01`). Comentario longo aqui empurra o involucro para
    fora da janela e reprova a suite — por isso este bloco vive aqui.
  */
  return (
    // O quadro rola nos DOIS eixos, e a pagina em nenhum: `R01` ja exigia o
    // horizontal, e `D-31` trouxe o vertical para ca. A altura mora em
    // `table-viewport`, no CSS, porque e `calc()` com piso.
    <div className="table-viewport overflow-x-auto overflow-y-auto rounded-container border border-border-subtle bg-surface-raised">
      <table
        ref={grid.ref}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: em ARIA `grid` e SUBCLASSE de `table`, e a APG constroi a grade assim; a regra existe contra `<div role="button">`
        role="grid"
        onKeyDown={grid.onKeyDown}
        className="table-rules w-full border-separate border-spacing-0 text-sm"
      >
        <caption className="sr-only">
          Processos. Use as setas para percorrer as células, Enter para abrir a edição.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column, index) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                order={order}
                onSort={onSort}
                cell={grid.cellProps(0, index)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            /*
              `h-10` sao 2.5rem — 40 px na fonte-base padrao, e **relativo**, entao
              a linha acompanha o operador que amplia (`SC 1.4.4`). Altura
              declarada, e nao consequencia do `py-2`: sem ela a linha crescia com
              o conteudo mais alto, e a tabela perdia o ritmo vertical.

              **Sem faixa alternada**, e isso ja era verdade: o realce e o cursor,
              nao a paridade da linha. A assercao existe para nao voltar.
            */
            <tr key={item.ref} className="motion-tint h-10 hover:bg-surface-hover">
              <td {...grid.cellProps(index + 1, 0)} className="px-3 font-mono whitespace-nowrap">
                <a
                  href={`/processo/${encodeURIComponent(item.ref)}`}
                  // Fora da ordem de tabulacao: quem tabula e a grade.
                  tabIndex={-1}
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
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 1)}
                label="Cliente"
                kind="text"
                value={item.client}
                display={item.client || '—'}
                onCommit={(value) => setProcessClient(item.ref, value ?? '')}
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 2)}
                label="Processo do cliente"
                kind="text"
                value={item.clientProcess}
                display={item.clientProcess || '—'}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'clientRaw', value })}
                className="font-mono"
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 3)}
                label="Importador"
                kind="text"
                value={item.importer}
                display={item.importer || '—'}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'importerRaw', value })}
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 4)}
                label="Navio"
                kind="text"
                value={item.vessel}
                display={item.vessel || '—'}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'vesselRaw', value })}
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 5)}
                label="ETA2"
                kind="date"
                value={item.eta2 ?? ''}
                display={formatDay(item.eta2)}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'eta2', value })}
                className="font-mono whitespace-nowrap tabular-nums"
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 6)}
                label="BL"
                kind="text"
                value={item.billOfLading}
                display={item.billOfLading || '—'}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'billOfLading', value })}
                className="font-mono"
                onEdited={onEdited}
              />
              <EditableCell
                processRef={item.ref}
                cell={grid.cellProps(index + 1, 7)}
                label="CNTR"
                kind="text"
                value={item.container}
                display={item.container || '—'}
                onCommit={(value) => enqueueEdit({ ref: item.ref, field: 'container', value })}
                className="font-mono"
                onEdited={onEdited}
              />
              <td {...grid.cellProps(index + 1, 8)} className="px-3 whitespace-nowrap">
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
  cell,
}: {
  column: Column
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
  cell: ReturnType<GridNavigation['cellProps']>
}) {
  const active = column.sortBy === sort
  const ariaSort = active ? (order === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <th
      scope="col"
      {...cell}
      {...(ariaSort ? { 'aria-sort': ariaSort } : {})}
      className="sticky top-0 z-10 h-10 border-b border-border-subtle bg-surface-sunken px-3 text-left font-medium text-text-secondary"
    >
      <button
        type="button"
        onClick={() => onSort(column.sortBy)}
        // Fora da ordem de tabulacao: a linha 0 da grade E o cabecalho, e Enter
        // sobre a celula ordena.
        tabIndex={-1}
        className="motion-tint flex items-center gap-1 hover:text-text-primary"
      >
        {column.label}
        <span aria-hidden="true" className="text-xs">
          {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

/** Traco, e nao vazio: a celula em branco pareceria falha de renderizacao. */
function formatDay(isoDay: string | null): string {
  if (isoDay === null) return '—'
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
