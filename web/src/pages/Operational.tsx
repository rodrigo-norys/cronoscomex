import { ArrivalCalendar } from '../components/ArrivalCalendar.tsx'
import { PageAlert } from '../components/PageAlert.tsx'
import { ProcessTable } from '../components/ProcessTable.tsx'
import { useIndicators } from '../hooks/useIndicators.ts'
import { useProcesses } from '../hooks/useProcesses.ts'
import { PAGE_SIZE, useProcessQuery } from '../hooks/useProcessQuery.ts'

/**
 * Pagina Operacional (RF-10): tabela de processos ativos, busca por REF, BL e
 * CNTR (A-39), e o calendario de chegadas por navio.
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
  const processes = useProcesses(query.requestQuery, dataVersion)
  const indicators = useIndicators(queryString, dataVersion)

  const calendar =
    indicators.status === 'pronto' ? indicators.indicators.arrivalCalendar : undefined

  return (
    <div className="flex flex-col gap-4">
      <Controls query={query} />

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
              />
              <Pagination
                total={processes.page.total}
                offset={query.offset}
                shown={processes.page.items.length}
                onOffset={query.setOffset}
              />
            </>
          ) : (
            processes.status === 'carregando' && (
              <p className="panel-loading">Carregando processos…</p>
            )
          )}
        </div>

        {calendar !== undefined && <ArrivalCalendar days={calendar} />}
      </div>
    </div>
  )
}

function Controls({ query }: { query: ReturnType<typeof useProcessQuery> }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex grow flex-col gap-1 text-xs text-text-secondary sm:max-w-md">
        Buscar por REF, BL ou CNTR
        <input
          type="search"
          value={query.search}
          onChange={(event) => query.setSearch(event.target.value)}
          placeholder="ex.: NBSC260"
          className="rounded-control border border-border-control bg-surface-raised px-3 py-1.5 text-sm text-text-primary"
        />
      </label>

      {/* A-16. O padrao da PAGINA e mostrar so os ativos; a rota tem o padrao
          oposto, porque serve tambem quem procura um processo especifico. */}
      <label className="flex items-center gap-2 pb-1.5 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={!query.activeOnly}
          onChange={(event) => query.setActiveOnly(!event.target.checked)}
        />
        Incluir desembaraçados
      </label>
    </div>
  )
}

function Pagination({
  total,
  offset,
  shown,
  onOffset,
}: {
  total: number
  offset: number
  shown: number
  onOffset: (value: number) => void
}) {
  if (total <= PAGE_SIZE) {
    return (
      <p className="text-xs text-text-secondary">
        {total} {total === 1 ? 'processo' : 'processos'}
      </p>
    )
  }

  const first = total === 0 ? 0 : offset + 1
  const last = offset + shown

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-text-secondary tabular-nums">
        {first}–{last} de {total}
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          className="rounded-control border border-border-control px-2 py-1 text-xs disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onOffset(offset + PAGE_SIZE)}
          disabled={last >= total}
          className="rounded-control border border-border-control px-2 py-1 text-xs disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
        >
          Próxima
        </button>
      </span>
    </nav>
  )
}
