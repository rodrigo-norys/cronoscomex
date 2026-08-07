import type { HealthResponse } from './api-client.ts'
import { FilterBar } from './components/FilterBar.tsx'
import { RefreshButton } from './components/RefreshButton.tsx'
import { StatusBanner } from './components/StatusBanner.tsx'
import { useAppData } from './hooks/useAppData.ts'
import { useFilterOptions } from './hooks/useFilterOptions.ts'
import { useFilters } from './hooks/useFilters.ts'
import { Home } from './pages/Home.tsx'
import { Operational } from './pages/Operational.tsx'
import { NotFoundPage, PendingPage } from './pages/Placeholders.tsx'
import { NAV_PAGES, navigate, pageOf, type Route, useRoute } from './router.ts'

/**
 * A casca da aplicacao (`H-15`).
 *
 * Ela hospeda as sete paginas, carrega a faixa de estado que A-57 exige em
 * **todas** elas, concentra as tres frentes de A-62, e monta os onze filtros
 * globais. Nao calcula nada: os 21 indicadores e os cinco alertas vem prontos
 * do servidor, ja recortados (regra inviolavel 6).
 */
export function App() {
  const route = useRoute()
  const { health, healthError, dataVersion, refreshing, refresh } = useAppData()
  const filters = useFilters()
  const { options, error: optionsError } = useFilterOptions(dataVersion)

  // O detalhe de um processo e sobre UM processo, achado pela REF: recortar o
  // conjunto nao muda o que ele mostra. Endereco desconhecido nao tem dado
  // nenhum a filtrar.
  const showFilters = route.pageId !== 'processDetail' && route.pageId !== 'notFound'

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h1 className="text-xl font-semibold">CronosComex</h1>
            <p className="text-sm text-slate-500">Painel operacional de desembaraço aduaneiro</p>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <span className="text-sm text-slate-500">
                Dados de <time dateTime={health.today}>{formatDay(health.today)}</time>
              </span>
            )}
            <RefreshButton onRefresh={refresh} busy={refreshing} />
          </div>
        </div>
        <MainNav route={route} />
        {showFilters && (
          <FilterBar filters={filters} options={options} optionsError={optionsError} />
        )}
      </header>

      <StatusBanner health={health} />

      {healthError && (
        <p
          role="alert"
          className="border-y border-red-300 bg-red-50 px-6 py-3 text-sm text-red-900"
        >
          <strong className="font-semibold">Sem contato com o servidor.</strong> {healthError}
        </p>
      )}

      <main className="px-6 py-6">
        <PageOutlet
          route={route}
          dataVersion={dataVersion}
          health={health}
          queryString={filters.queryString}
        />
      </main>
    </div>
  )
}

function MainNav({ route }: { route: Route }) {
  return (
    <nav aria-label="Páginas" className="flex flex-wrap gap-1 px-4">
      {NAV_PAGES.map((page) => {
        const current = page.id === route.pageId
        return (
          <a
            key={page.id}
            href={page.path}
            aria-current={current ? 'page' : undefined}
            onClick={(event) => {
              // Clique simples navega pelo History API; modificador e botao do
              // meio continuam sendo do navegador — abrir em outra aba e um
              // gesto legitimo, e sequestra-lo seria pior que nao rotear.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              navigate(page.path)
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              current
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {page.label}
          </a>
        )
      })}
    </nav>
  )
}

interface PageOutletProps {
  route: Route
  dataVersion: number
  health: HealthResponse | null
  queryString: string
}

/**
 * `dataVersion` chega como `key`: quando o dia vira ou a planilha muda, a
 * pagina inteira remonta e refaz as proprias requisicoes, sem que a casca
 * precise conhecer nenhuma delas. As paginas de `H-18` a `H-22` entram aqui.
 *
 * A casca repassa `queryString` em vez de os filtros inteiros: a pagina precisa
 * anexar o recorte as requisicoes, nunca interpreta-lo.
 */
function PageOutlet({ route, dataVersion, health, queryString }: PageOutletProps) {
  const page = pageOf(route)
  if (page === null) return <NotFoundPage />

  if (route.pageId === 'home') {
    return (
      <Home key={dataVersion} health={health} queryString={queryString} dataVersion={dataVersion} />
    )
  }

  if (route.pageId === 'operational') {
    return <Operational key={dataVersion} queryString={queryString} dataVersion={dataVersion} />
  }

  return <PendingPage key={dataVersion} page={page} processRef={route.ref} />
}

/**
 * Campo ausente vira travessao, nunca excecao.
 *
 * O tipo diz `string`, mas ele descreve o contrato, nao a resposta que chegou:
 * dado de rede nao e verificado em execucao. Um servidor de versao anterior —
 * medido, com o `--watch` servindo codigo velho — devolvia o corpo **sem**
 * `today`, e `undefined.split` derrubava a casca inteira, com a faixa de estado
 * e a navegacao junto. Tela branca e o pior dos buracos invisiveis (regra 3).
 */
function formatDay(isoDay: string | undefined): string {
  const parts = isoDay?.split('-')
  if (parts === undefined || parts.length !== 3) return '—'

  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}
