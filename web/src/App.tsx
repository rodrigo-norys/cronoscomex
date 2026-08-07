import { RefreshButton } from './components/RefreshButton.tsx'
import { StatusBanner } from './components/StatusBanner.tsx'
import { useAppData } from './hooks/useAppData.ts'
import { NotFoundPage, PendingPage } from './pages/Placeholders.tsx'
import { NAV_PAGES, navigate, pageOf, type Route, useRoute } from './router.ts'

/**
 * A casca da aplicacao (`H-15`, segunda entrega).
 *
 * Ela hospeda as sete paginas, carrega a faixa de estado que A-57 exige em
 * **todas** elas, e concentra as tres frentes de A-62. Nao calcula nada: os 21
 * indicadores e os cinco alertas vem prontos do servidor (regra inviolavel 6).
 *
 * Os onze filtros globais e a `FilterBar` sao a terceira entrega. O roteador ja
 * preserva a query, entao a barra encaixa sem mexer aqui.
 */
export function App() {
  const route = useRoute()
  const { health, healthError, dataVersion, refreshing, refresh } = useAppData()

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
        <PageOutlet route={route} dataVersion={dataVersion} />
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

/**
 * `dataVersion` chega como `key`: quando o dia vira ou a planilha muda, a
 * pagina inteira remonta e refaz as proprias requisicoes, sem que a casca
 * precise conhecer nenhuma delas. As paginas de `H-16` a `H-22` entram aqui.
 */
function PageOutlet({ route, dataVersion }: { route: Route; dataVersion: number }) {
  const page = pageOf(route)
  if (page === null) return <NotFoundPage />

  return <PendingPage key={dataVersion} page={page} processRef={route.ref} />
}

function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}
