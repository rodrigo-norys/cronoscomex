import { enqueueEdit, type ProcessDto } from '../api-client.ts'
import { type GridNavigation, useGridNavigation } from '../hooks/useGridNavigation.ts'
import type { SortField, SortOrder } from '../hooks/useProcessQuery.ts'
import { navigate } from '../router.ts'
import { EditableCell } from './EditableCell.tsx'

/**
 * A tabela de processos. Nao ordena nem pagina: o servidor ja entregou a pagina
 * pronta, e reordenar aqui daria um resultado diferente do que `total` conta.
 *
 * **As 16 colunas da aba, mais a Categoria** (`H-95`, `D-43`). Eram nove, das
 * quais sete da planilha e duas derivadas.
 *
 * **O rotulo e o texto LITERAL da linha 1**, que chega em `headerLabels`. A
 * coluna `H` se chama `ETA` e guarda PORTO; `M` e `P` se chamam `Coluna 13` e
 * `Coluna1`, que o Excel gerou sozinho. A tabela mostra o que o arquivo diz —
 * corrigir aqui criaria uma segunda verdade (regra inviolavel 1).
 *
 * **A coluna derivada Cliente SAIU**, e com ela o unico consumidor de `PUT
 * /api/processes/:ref/client` (`RF-35`, revogado). Declarar cliente passa a ser
 * so pelo painel da Pagina Clientes. A consolidacao fica inteira: filtro,
 * ranking e pagina seguem intactos.
 *
 * **A Categoria FICA**, e a diferenca e que ela nao tem coluna equivalente no
 * arquivo: `TD-01` a calcula de `STATUS` e do preenchimento das demais, em
 * cinco regras das quais so uma le a celula L (`A-22`).
 *
 * **Seis colunas se editam onde estao**, as mesmas de antes — as celulas de
 * planilha que `POST /api/edits` enfileira. Expor as outras nove e decisao a
 * parte, fora desta historia.
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

export interface Column {
  /** Chave na URL de colunas escondidas. Letra da planilha, ou `CATEGORIA`. */
  readonly key: string
  /** Ausente quando a coluna nao e ordenavel pela rota. */
  readonly sortBy?: SortField
  /** Ausente so na Categoria, que e derivada e nao tem celula. */
  readonly sheetColumn?: string
  /** Rotulo de reserva, quando a linha 1 nao nomeia a coluna. */
  readonly fallback: string
  /** O campo do DTO que a celula mostra; ausente na Categoria. */
  readonly field?: keyof ProcessDto
  readonly kind?: 'text' | 'date'
  /** Como `POST /api/edits` chama o campo. Ausente: a coluna nao se edita. */
  readonly editField?: string
  readonly className?: string
}

/**
 * As 17 colunas: as 16 da aba, na ordem do arquivo, mais a Categoria no fim.
 *
 * **A ordem e a da planilha**, e nao uma escolha de tela: o operador percorre a
 * tabela com o arquivo na cabeca, e reordenar aqui custaria a ele traduzir.
 *
 * Seis trazem `editField` — as mesmas que ja se editavam. As nove que passam a
 * aparecer entram como leitura: o dominio declara quinze editaveis, e expor
 * cada uma e decisao a parte (fora de `H-95`).
 */
export const COLUMNS: readonly Column[] = [
  {
    key: 'A',
    sheetColumn: 'A',
    fallback: 'REF',
    sortBy: 'ref',
    field: 'ref',
    className: 'font-mono whitespace-nowrap',
  },
  {
    key: 'B',
    sheetColumn: 'B',
    fallback: 'CLT',
    sortBy: 'clientProcess',
    field: 'clientProcess',
    kind: 'text',
    editField: 'clientRaw',
    className: 'font-mono',
  },
  {
    key: 'C',
    sheetColumn: 'C',
    fallback: 'IMPORTADOR',
    sortBy: 'importer',
    field: 'importer',
    kind: 'text',
    editField: 'importerRaw',
  },
  {
    key: 'D',
    sheetColumn: 'D',
    fallback: 'BL',
    sortBy: 'billOfLading',
    field: 'billOfLading',
    kind: 'text',
    editField: 'billOfLading',
    className: 'font-mono',
  },
  { key: 'E', sheetColumn: 'E', fallback: 'AGENTE', field: 'agent' },
  {
    key: 'F',
    sheetColumn: 'F',
    fallback: 'CNTR',
    sortBy: 'container',
    field: 'container',
    kind: 'text',
    editField: 'container',
    className: 'font-mono',
  },
  {
    key: 'G',
    sheetColumn: 'G',
    fallback: 'NAVIO',
    sortBy: 'vessel',
    field: 'vessel',
    kind: 'text',
    editField: 'vesselRaw',
  },
  // O cabecalho diz `ETA` e a celula guarda PORTO — `RIO`, `MULTIRIO`, `SC`.
  // A tabela mostra o que o arquivo diz (regra inviolavel 1).
  { key: 'H', sheetColumn: 'H', fallback: 'ETA', field: 'port' },
  {
    key: 'I',
    sheetColumn: 'I',
    fallback: 'ETA2',
    sortBy: 'eta2',
    field: 'eta2',
    kind: 'date',
    editField: 'eta2',
    className: 'font-mono whitespace-nowrap tabular-nums',
  },
  { key: 'J', sheetColumn: 'J', fallback: 'MERCADORIA', field: 'goods' },
  {
    key: 'K',
    sheetColumn: 'K',
    fallback: 'RG',
    sortBy: 'registrationDate',
    field: 'registrationDate',
    kind: 'date',
    className: 'font-mono whitespace-nowrap tabular-nums',
  },
  { key: 'L', sheetColumn: 'L', fallback: 'STATUS', field: 'statusRaw' },
  { key: 'M', sheetColumn: 'M', fallback: 'Coluna 13', field: 'boletoRaw' },
  { key: 'N', sheetColumn: 'N', fallback: 'R$ ENVIADO', field: 'paymentRaw' },
  {
    key: 'O',
    sheetColumn: 'O',
    fallback: 'DOCS ENVIADOS',
    field: 'docsSentDate',
    kind: 'date',
    className: 'font-mono whitespace-nowrap tabular-nums',
  },
  { key: 'P', sheetColumn: 'P', fallback: 'Coluna1', field: 'columnPRaw' },
  // Derivada, e sem coluna equivalente no arquivo: fica por `D-43`.
  { key: 'CATEGORIA', fallback: 'Categoria', sortBy: 'status', className: 'whitespace-nowrap' },
]

/** O rotulo do arquivo quando ha; o de reserva quando a linha 1 nao nomeia. */
export const labelOf = (column: Column, headerLabels: Record<string, string>): string =>
  (column.sheetColumn === undefined ? undefined : headerLabels[column.sheetColumn]) ??
  column.fallback

/** A cor de fundo daquela coluna, ou `undefined` quando nao ha (`H-94`). */
const fillOf = (item: ProcessDto, column: Column): string | undefined =>
  column.sheetColumn === undefined ? undefined : item.fills[column.sheetColumn]

/** O texto exibido, ja formatado. Datas em pt-BR; vazio vira travessao. */
function displayOf(item: ProcessDto, column: Column): string {
  if (column.field === undefined) return ''
  const value = item[column.field]
  if (column.kind === 'date') return formatDay((value ?? null) as string | null)
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

/** O valor cru que a edicao recebe. Data vazia entra como texto vazio. */
function rawValueOf(item: ProcessDto, column: Column): string {
  if (column.field === undefined) return ''
  const value = item[column.field]
  return value === null || value === undefined ? '' : String(value)
}

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
  /** O nome de cada coluna, como a linha 1 da planilha o escreve (`H-95`). */
  headerLabels: Record<string, string>
  /** As colunas que o operador escondeu. Vazio mostra as 17. */
  hidden: readonly string[]
}

export function ProcessTable({
  items,
  sort,
  order,
  onSort,
  onEdited,
  headerLabels,
  hidden,
}: ProcessTableProps) {
  /*
    **Esconder e a escolha; mostrar e o padrao** (determinacao 4 de `D-43`).
    Chave desconhecida na URL nao esconde nada — mesma tolerancia de `readSort`.
  */
  const visible = COLUMNS.filter((column) => !hidden.includes(column.key))
  const grid = useGridNavigation(items.length, visible.length)

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
    <div className="table-viewport overflow-x-auto overflow-y-auto rounded-container border border-border-subtle bg-surface-table">
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
            {visible.map((column, index) => (
              <HeaderCell
                key={column.key}
                column={column}
                label={labelOf(column, headerLabels)}
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
            <tr key={item.ref} className="h-10">
              {visible.map((column, columnIndex) => {
                const cell = grid.cellProps(index + 1, columnIndex)
                const fill = fillOf(item, column)

                // A REF e link para o detalhe, e a unica celula que nao e texto
                // nem edicao — por isso ela nao passa por `EditableCell`.
                if (column.key === 'A') {
                  return (
                    <td
                      key={column.key}
                      {...cell}
                      style={{ backgroundColor: fill }}
                      className={`px-3 ${column.className ?? ''}`}
                    >
                      <a
                        href={`/processo/${encodeURIComponent(item.ref)}`}
                        // Fora da ordem de tabulacao: quem tabula e a grade.
                        tabIndex={-1}
                        onClick={(event) => {
                          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                            return
                          event.preventDefault()
                          navigate(`/processo/${encodeURIComponent(item.ref)}`)
                        }}
                        // O nome ACESSIVEL e o mesmo de `AlertRow` para a mesma
                        // acao (`H-75`, `ACHADO 7`). Ele CONTEM o texto visivel
                        // — a REF —, que e o que `SC 2.5.3` exige.
                        aria-label={`Abrir o detalhe de ${item.ref}`}
                        className="motion-tint text-text-secondary underline hover:text-text-primary"
                      >
                        {item.ref}
                      </a>
                      {item.hasPendingEdits && (
                        <span
                          title="Tem edições pendentes de aplicação"
                          className="ml-1 rounded-control bg-state-warning-bg px-1 text-xs text-state-warning-fg"
                        >
                          ●
                        </span>
                      )}
                    </td>
                  )
                }

                // A Categoria e derivada e nao tem celula na planilha: `TD-01` a
                // calcula, e o chip de canal a acompanha.
                if (column.key === 'CATEGORIA') {
                  return (
                    <td key={column.key} {...cell} className="px-3 whitespace-nowrap">
                      <span className="whitespace-nowrap">
                        {CATEGORY_LABELS[item.statusCategory]}
                      </span>
                      {/*
                        **A unica excecao aos dois raios, e ela e declarada.** O
                        chip de canal e pilula — `rounded-full` —, porque a forma
                        o separa da severidade: canal e DADO aduaneiro (IND-06),
                        severidade e gravidade, e a regra inviolavel 4 nao deixa
                        a cor decidir qual e qual.
                      */}
                      {item.customsChannel === 'vermelho' && (
                        <span className="ml-1 rounded-full bg-channel-red-bg px-2 py-0.5 text-xs text-channel-red-fg">
                          Canal Vermelho
                        </span>
                      )}
                    </td>
                  )
                }

                if (column.editField !== undefined) {
                  const editField = column.editField
                  return (
                    <EditableCell
                      key={column.key}
                      processRef={item.ref}
                      cell={cell}
                      fill={fill}
                      label={labelOf(column, headerLabels)}
                      kind={column.kind ?? 'text'}
                      value={rawValueOf(item, column)}
                      display={displayOf(item, column)}
                      onCommit={(value) => enqueueEdit({ ref: item.ref, field: editField, value })}
                      {...(column.className ? { className: column.className } : {})}
                      onEdited={onEdited}
                    />
                  )
                }

                /*
                  As nove que passam a aparecer entram como LEITURA. O dominio
                  declara quinze editaveis; expor cada uma e decisao a parte, e
                  `H-95` a deixa fora de proposito.

                  `truncate` com o valor inteiro no `title`, como `EditableCell`
                  faz: a linha de 40 px nao cresce, e nada e cortado em silencio.
                */
                const texto = displayOf(item, column)
                return (
                  <td
                    key={column.key}
                    {...cell}
                    style={{ backgroundColor: fill }}
                    className={`max-w-56 truncate px-3 ${column.className ?? ''}`}
                    {...(texto !== '—' ? { title: texto } : {})}
                  >
                    {texto}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HeaderCell({
  column,
  label,
  sort,
  order,
  onSort,
  cell,
}: {
  column: Column
  /** Ja resolvido: o texto da linha 1, ou o de reserva. */
  label: string
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
  cell: ReturnType<GridNavigation['cellProps']>
}) {
  const sortBy = column.sortBy
  const active = sortBy !== undefined && sortBy === sort
  const ariaSort = active ? (order === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <th
      scope="col"
      {...cell}
      {...(ariaSort ? { 'aria-sort': ariaSort } : {})}
      className="sticky top-0 z-10 h-10 border-b border-border-subtle bg-surface-sunken px-3 text-left font-medium text-text-secondary"
    >
      {/*
        **Coluna sem ordem na rota nao vira botao.** Nove das dezessete nao sao
        ordenaveis, e um botao que nao faz nada e pior que texto: ele promete.
      */}
      {sortBy === undefined ? (
        label
      ) : (
        <button
          type="button"
          onClick={() => onSort(sortBy)}
          // Fora da ordem de tabulacao: a linha 0 da grade E o cabecalho, e
          // Enter sobre a celula ordena.
          tabIndex={-1}
          className="motion-tint flex items-center gap-1 hover:text-text-primary"
        >
          {label}
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
