import { useState } from 'react'
import { ArrivalCalendar } from '../components/ArrivalCalendar.tsx'
import { NewRowButton } from '../components/NewRowButton.tsx'
import { PageAlert } from '../components/PageAlert.tsx'
import { ProcessTable } from '../components/ProcessTable.tsx'
import { Skeleton } from '../components/Skeleton.tsx'
import { useFirstLoad } from '../hooks/useFirstLoad.ts'
import { useIndicators } from '../hooks/useIndicators.ts'
import { useProcesses } from '../hooks/useProcesses.ts'
import { PAGE_SIZES, useProcessQuery } from '../hooks/useProcessQuery.ts'

/**
 * Pagina Operacional (RF-10): tabela de processos, busca sobre os seis campos
 * de texto da planilha (`A-39`, `D-34`), e o calendario de chegadas por navio.
 *
 * Duas requisicoes: `GET /api/processes` para a lista, e `GET /api/indicators`
 * para `arrivalCalendar`. A segunda ja e feita pela Pagina Inicial, entao o
 * padrao e conhecido — nenhum numero e derivado aqui.
 */

interface OperationalProps {
  queryString: string
  dataVersion: number
}

export function Operational({ queryString, dataVersion }: OperationalProps) {
  const query = useProcessQuery()
  /**
   * A edicao em linha nao muda `dataVersion` — ele e o relogio da CASCA, e sobe
   * quando a planilha e relida. Somar um contador local e o que faz a lista
   * voltar a buscar depois de enfileirar: a projecao do servidor ja inclui o que
   * esta na fila, entao o valor novo chega pela mesma rota de sempre.
   */
  const [editVersion, setEditVersion] = useState(0)
  const processes = useProcesses(query.requestQuery, dataVersion + editVersion)
  const indicators = useIndicators(queryString, dataVersion)
  const firstLoad = useFirstLoad('operacional', processes.status === 'pronto')

  const calendar =
    indicators.status === 'pronto' ? indicators.indicators.arrivalCalendar : undefined

  return (
    <div className="flex flex-col gap-4">
      <Controls query={query} onEdited={() => setEditVersion((version) => version + 1)} />

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
        `minmax(0,1fr)`, e nao `1fr`: `1fr` e `minmax(auto,1fr)`, e o `auto`
        minimo e a largura INTRINSECA da tabela — o grid entao recusa encolher e
        empurra o conteudo para fora da tela (`SC 1.4.10`). Medido em
        01/09/2026: com `1fr` o documento estourava entre 1024 px, onde `lg:`
        liga, e ~1240 px; `H-59` estreitou a coluna em 216 px e levou o estouro
        ate 1440. O `overflow-x-auto` de `R01` esta na tabela e nao alcanca
        isto: quem se recusa a encolher e a TRILHA do grid, acima dele.
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3">
          {processes.status === 'pronto' ? (
            <>
              <ProcessTable
                items={processes.page.items}
                sort={query.sort}
                order={query.order}
                onSort={query.toggleSort}
                onEdited={() => setEditVersion((version) => version + 1)}
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

        {calendar !== undefined && <ArrivalCalendar days={calendar} />}
      </div>
    </div>
  )
}

function Controls({
  query,
  onEdited,
}: {
  query: ReturnType<typeof useProcessQuery>
  onEdited: () => void
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
                {size}
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
