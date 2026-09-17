import { useState } from 'react'
import { NewRowButton } from '../components/NewRowButton.tsx'
import { PageAlert } from '../components/PageAlert.tsx'
import { COLUMNS, labelOf, ProcessTable } from '../components/ProcessTable.tsx'
import { Skeleton } from '../components/Skeleton.tsx'
import { useFirstLoad } from '../hooks/useFirstLoad.ts'
import { useProcesses } from '../hooks/useProcesses.ts'
import {
  PAGE_SIZES,
  pageSizeLabel,
  SORT_LABELS,
  useProcessQuery,
} from '../hooks/useProcessQuery.ts'

/**
 * Pagina Operacional (RF-10): tabela de processos e busca sobre os seis campos
 * de texto da planilha (`A-39`, `D-34`).
 *
 * **Uma requisicao so, e o calendario de chegadas saiu daqui** (`H-98`). Ele foi
 * para a Pagina Inicial, que ja pedia `GET /api/indicators` — nenhuma requisicao
 * nova nasce da mudanca, e `IND-12` continua apresentado, que era a condicao.
 * Com ele foi embora a coluna lateral de 20rem: a tabela de `H-95` tem 17
 * colunas e mede cerca de 3.000 px, e disputava largura com um painel que nao e
 * dela.
 *
 * **`queryString` saiu junto, e a ausencia dela e o ponto:** os quatorze filtros
 * globais chegam a rota por `useProcessQuery`, que os le da URL. A pagina nao
 * precisa deles em prop nenhuma.
 */

interface OperationalProps {
  dataVersion: number
}

export function Operational({ dataVersion }: OperationalProps) {
  const query = useProcessQuery()
  /**
   * A edicao em linha nao muda `dataVersion` — ele e o relogio da CASCA, e sobe
   * quando a planilha e relida. Somar um contador local e o que faz a lista
   * voltar a buscar depois de enfileirar: a projecao do servidor ja inclui o que
   * esta na fila, entao o valor novo chega pela mesma rota de sempre.
   */
  const [editVersion, setEditVersion] = useState(0)
  const processes = useProcesses(query.requestQuery, dataVersion + editVersion)
  const firstLoad = useFirstLoad('operacional', processes.status === 'pronto')

  return (
    <div className="flex flex-col gap-4">
      <Controls
        query={query}
        onEdited={() => setEditVersion((version) => version + 1)}
        headerLabels={processes.status === 'pronto' ? processes.page.headerLabels : {}}
      />

      {processes.status === 'semLeitura' && (
        <PageAlert
          tone="status"
          className="panel-no-read"
          announcement="Nenhuma leitura da planilha foi concluída ainda. A tabela aparece assim que a primeira terminar — vazio aqui não significa nenhum processo."
        >
          Nenhuma leitura da planilha foi concluída ainda. A tabela aparece assim que a primeira
          terminar — vazio aqui não significa nenhum processo.
        </PageAlert>
      )}

      {processes.status === 'erro' && (
        <PageAlert
          className="panel-error"
          announcement={`Não foi possível carregar os processos. ${processes.message}`}
        >
          <strong className="font-semibold">Não foi possível carregar os processos.</strong>{' '}
          {processes.message}
        </PageAlert>
      )}

      {/*
        **Uma trilha so, desde `H-98`.** Era um grid de duas, com 20rem fixos
        para o calendario de chegadas; ele foi para a Pagina Inicial e a tabela
        ficou com a largura inteira.

        O `minmax(0,1fr)` que vivia aqui existia porque `1fr` e
        `minmax(auto,1fr)`, e o `auto` minimo e a largura INTRINSECA da tabela —
        o grid entao recusava encolher e empurrava o conteudo para fora da tela
        (`SC 1.4.10`, medido em 01/09/2026). **Sem a segunda trilha nao ha o que
        negociar**, e quem contem a rolagem passa a ser o `overflow-x-auto` de
        `R01`, na propria tabela.
      */}
      <div className="flex flex-col gap-3">
        {processes.status === 'pronto' ? (
          <>
            <ProcessTable
              items={processes.page.items}
              sort={query.sort}
              order={query.order}
              onSort={query.toggleSort}
              onEdited={() => setEditVersion((version) => version + 1)}
              headerLabels={processes.page.headerLabels}
              hidden={query.hidden}
            />
            {/* O rodape vem DEPOIS da grade no DOM, e e por isso que a grade
                  existe: sem ela, chegar aqui pelo teclado custaria uma parada
                  por celula editavel (`H-80`). */}
            <TableFooter
              total={processes.page.total}
              offset={query.offset}
              limit={query.limit}
              shown={processes.page.items.length}
              onOffset={query.setOffset}
              onLimit={query.setLimit}
            />
          </>
        ) : (
          processes.status === 'carregando' &&
          (firstLoad ? (
            <Skeleton announcement="Carregando processos." />
          ) : (
            <p className="panel-loading">Carregando processos…</p>
          ))
        )}
      </div>
    </div>
  )
}

function Controls({
  query,
  onEdited,
  headerLabels,
}: {
  query: ReturnType<typeof useProcessQuery>
  onEdited: () => void
  headerLabels: Record<string, string>
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex grow flex-col gap-1 text-xs text-text-secondary sm:max-w-md">
        Buscar em qualquer campo de texto
        <input
          type="search"
          value={query.search}
          onChange={(event) => query.setSearch(event.target.value)}
          placeholder="ex.: NBSC260"
          className="rounded-control border border-border-control bg-surface-raised px-3 py-1.5 text-sm text-text-primary"
        />
      </label>

      {/* `D-33`: a tela abre com TODOS os processos, e o operador reduz aos
          ativos por aqui. A definicao de `A-16` nao muda — "ativo" continua
          sendo `categoria != desembaracado`; o que inverteu foi o recorte
          padrao da tela, e com ele o rotulo do controle. */}
      <label className="flex items-center gap-2 pb-1.5 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={query.activeOnly}
          onChange={(event) => query.setActiveOnly(event.target.checked)}
        />
        Ocultar desembaraçados
      </label>

      {/* A criacao fica ao lado da busca, e nao dentro da tabela: a tabela e
          grade, e um controle solto nela seria uma celula que nao e celula. */}
      <div className="pb-0.5">
        <NewRowButton onCreated={onEdited} />
      </div>

      <ColumnPicker query={query} headerLabels={headerLabels} />

      <SortState query={query} />
    </div>
  )
}

/**
 * Quais colunas a tabela mostra (`H-95`, `RF-43`).
 *
 * **As 17 aparecem por padrao, e o que o operador faz e TIRAR** — determinacao 4
 * de `D-43`. Por isso o controle guarda as ESCONDIDAS: coluna que a planilha
 * ganhar aparece sozinha, em vez de precisar ser autorizada.
 *
 * **Caixa de marcacao, e nao seletor multiplo:** o operador precisa ver de uma
 * vez o que esta dentro e o que esta fora, e um `<select multiple>` esconde o
 * estado atras de rolagem. O rotulo e o do ARQUIVO — `CLT`, `ETA`, `Coluna 13`
 * —, o mesmo que o cabecalho mostra; nomear diferente aqui obrigaria o operador
 * a traduzir.
 *
 * `<details>` nativo: ele nao e modal, nao prende foco e fecha com Escape sem
 * codigo nenhum. Um painel proprio teria de reimplementar os tres.
 */
function ColumnPicker({
  query,
  headerLabels,
}: {
  query: ReturnType<typeof useProcessQuery>
  headerLabels: Record<string, string>
}) {
  const escondidas = query.hidden.length

  return (
    <details className="relative pb-1">
      <summary className="motion-tint cursor-pointer list-none rounded-control border border-border-control bg-surface-raised px-2.5 py-1 text-sm text-text-secondary hover:text-text-primary">
        Colunas
        {escondidas > 0 && (
          <span className="ml-1 font-mono tabular-nums">({escondidas} ocultas)</span>
        )}
      </summary>

      {/*
        `border-border-subtle` e SEM sombra, e os dois sao guarda: `C04` cobra a
        borda sutil de todo papel de secao que nao seja o painel modal, e `D-22`
        bane sombra do conjunto inteiro. A elevacao aqui vem da borda e do fundo
        `raised`, como nos demais paineis.
      */}
      <div className="absolute right-0 z-20 mt-1 flex max-h-96 w-64 flex-col gap-1 overflow-y-auto rounded-container border border-border-subtle bg-surface-raised p-3 text-sm">
        {COLUMNS.map((column) => (
          <label key={column.key} className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={!query.hidden.includes(column.key)}
              onChange={() => query.toggleColumn(column.key)}
            />
            <span className="truncate" title={labelOf(column, headerLabels)}>
              {labelOf(column, headerLabels)}
            </span>
          </label>
        ))}

        <button
          type="button"
          onClick={query.showAllColumns}
          disabled={escondidas === 0}
          className="mt-1 rounded-control border border-border-control px-2 py-1 text-xs text-text-secondary hover:bg-surface-base disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
        >
          Mostrar todas
        </button>
      </div>
    </details>
  )
}

/**
 * A ordem vigente, nomeada, e o botao que a descarta (`H-89`).
 *
 * **Mora na faixa da PAGINA, e nao na barra de filtros**, que e da casca e vale
 * para seis paginas — `sort` so existe nesta. Aqui ele fica ao lado dos irmaos
 * dele no mesmo hook, a busca e o recorte, e a 17 px do cabecalho que produziu
 * a ordenacao, contra ~1474 px do canto direito da faixa de cima em 1920.
 *
 * **`ml-auto` nao e enfeite:** ele absorve a entrada e a saida do bloco, entao
 * aparecer e sumir nao desloca o `Nova linha`.
 *
 * **O foco vai para o cabecalho da coluna que estava ordenada** antes de o
 * bloco se desmontar. Sem isso o foco cai no `<body>` e a tabulacao recomeca do
 * topo — `SC 2.4.3`, o mesmo defeito que `VN-4` mediu na navegacao.
 */
function SortState({ query }: { query: ReturnType<typeof useProcessQuery> }) {
  if (query.sort === 'sourceRow' && query.order === 'asc') return null

  const direcao = query.order === 'asc' ? 'crescente' : 'decrescente'
  const nome =
    query.sort === 'sourceRow'
      ? 'Ordem da planilha, invertida'
      : `${SORT_LABELS[query.sort]}, ${direcao}`

  return (
    <div className="ml-auto flex items-center gap-2.5 pb-1">
      <p className="text-sm text-text-secondary">
        Ordenado por <span className="font-medium text-text-primary">{nome}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          const cabecalho = document.querySelector<HTMLElement>('th[aria-sort] button')
          query.clearSort()
          cabecalho?.focus()
        }}
        className="motion-tint shrink-0 rounded-control border border-border-control bg-surface-raised px-2.5 py-1 text-sm text-text-secondary hover:text-text-primary"
      >
        Limpar ordenação
      </button>
    </div>
  )
}

/**
 * A faixa a esquerda, o tamanho de pagina e a navegacao a direita.
 *
 * **O seletor aparece sempre, e a navegacao so quando ha o que navegar.** Sao
 * perguntas diferentes: quantas linhas o operador quer ver nao depende de
 * quantas existem, e um `<select>` que some ao filtrar seria controle que
 * pisca.
 */
function TableFooter({
  total,
  offset,
  limit,
  shown,
  onOffset,
  onLimit,
}: {
  total: number
  offset: number
  limit: number
  shown: number
  onOffset: (value: number) => void
  onLimit: (value: number) => void
}) {
  const paginated = total > limit
  const first = total === 0 ? 0 : offset + 1
  const last = offset + shown

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-text-secondary tabular-nums">
        {paginated ? (
          `${first}–${last} de ${total}`
        ) : (
          <>
            {total} {total === 1 ? 'processo' : 'processos'}
          </>
        )}
      </span>

      <span className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Linhas por página
          <select
            value={limit}
            onChange={(event) => onLimit(Number(event.target.value))}
            className="rounded-control border border-border-control bg-surface-raised px-2 py-1 text-xs text-text-primary"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {pageSizeLabel(size)}
              </option>
            ))}
          </select>
        </label>

        {paginated && (
          <nav aria-label="Paginação" className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => onOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-control border border-border-control px-2 py-1 text-xs disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => onOffset(offset + limit)}
              disabled={last >= total}
              className="rounded-control border border-border-control px-2 py-1 text-xs disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
            >
              Próxima
            </button>
          </nav>
        )}
      </span>
    </div>
  )
}
