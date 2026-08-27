import { lazy, Suspense, useState } from 'react'
import type { ApplyRefusal, HealthResponse } from './api-client.ts'
import { ApplyChangesButton } from './components/ApplyChangesButton.tsx'
import { ConflictDialog } from './components/ConflictDialog.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { RefreshButton } from './components/RefreshButton.tsx'
import { StatusBanner } from './components/StatusBanner.tsx'
import { useAppData } from './hooks/useAppData.ts'
import { useFilterOptions } from './hooks/useFilterOptions.ts'
import { useFilters } from './hooks/useFilters.ts'
import { Alerts } from './pages/Alerts.tsx'
import { Clients } from './pages/Clients.tsx'
import { Home } from './pages/Home.tsx'
import { Operational } from './pages/Operational.tsx'
import { Performance } from './pages/Performance.tsx'
import { NotFoundPage, PendingPage } from './pages/Placeholders.tsx'
import { ProcessDetail } from './pages/ProcessDetail.tsx'
import { WorkbookSetup } from './pages/WorkbookSetup.tsx'
import { NAV_PAGES, navigate, pageOf, type Route, useRoute } from './router.ts'

/**
 * A Pagina Historico e a unica que importa o Recharts, e ele responde por 374
 * dos 634 kB do pacote — medido em 17/08/2026, comparando a build com e sem
 * ela. Carregada sob demanda, sai do caminho das outras seis paginas.
 *
 * `lazy` exige `default`, e as paginas deste projeto sao exportacoes nomeadas.
 */
const History = lazy(() =>
  import('./pages/History.tsx').then((modulo) => ({ default: modulo.History })),
)

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
  const { health, healthError, dataVersion, refreshing, refresh, applyHealth } = useAppData()
  const filters = useFilters()
  const { options, error: optionsError } = useFilterOptions(dataVersion)
  // A recusa vive na casca, e nao no botao: o dialogo cobre a tela inteira, e
  // fecha-lo nao pode depender de qual pagina estava aberta quando o operador
  // aplicou.
  const [refusal, setRefusal] = useState<ApplyRefusal | null>(null)

  /**
   * Primeira execucao: 'degradado' MAIS `lastReadAt` nulo, que e exatamente
   * "nunca houve leitura" (`H-34`). A distincao vem de `H-08` e nao inventa
   * estado: 'degradado' com `lastReadAt` preenchido e dado congelado — o painel
   * segue util —, e sem ele e ausencia de dado, onde um painel de zeros
   * afirmaria que a planilha tem zero processos (regra inviolavel 3).
   *
   * A casca desvia em vez de a pagina se anunciar: o operador nao tem como
   * saber que existe uma tela de configuracao se o que ele ve e um painel vazio.
   */
  const firstRun = health !== null && health.state === 'degradado' && health.lastReadAt === null

  // O detalhe de um processo e sobre UM processo, achado pela REF: recortar o
  // conjunto nao muda o que ele mostra. Endereco desconhecido nao tem dado
  // nenhum a filtrar. E sem leitura nenhuma nao ha o que recortar.
  // `workbookSetup` entrou no menu em `H-38`, e a barra nao a alcanca: ela nao e
  // uma visao do dado, e um recorte ali nao teria sobre o que incidir.
  const showFilters =
    !firstRun &&
    route.pageId !== 'processDetail' &&
    route.pageId !== 'workbookSetup' &&
    route.pageId !== 'notFound'

  return (
    <div className="min-h-screen bg-surface-base font-sans text-text-primary">
      <header className="border-b border-border-subtle bg-surface-raised">
        <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h1 className="text-xl font-semibold">CronosComex</h1>
            <p className="text-sm text-text-muted">Painel operacional de desembaraço aduaneiro</p>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <span className="text-sm text-text-muted">
                Dados de <time dateTime={health.today}>{formatDay(health.today)}</time>
              </span>
            )}
            <ApplyChangesButton
              pendingCount={health?.pendingEditsCount ?? 0}
              onApplied={refresh}
              onRefused={setRefusal}
            />
            <RefreshButton onRefresh={refresh} busy={refreshing} />
          </div>
        </div>
        {!firstRun && <MainNav route={route} />}
        {showFilters && (
          <FilterBar filters={filters} options={options} optionsError={optionsError} />
        )}
      </header>

      <StatusBanner health={health} />

      {healthError && (
        <p
          role="alert"
          className="border-y border-state-error-border bg-state-error-bg px-6 py-3 text-sm text-state-error-fg"
        >
          <strong className="font-semibold">Sem contato com o servidor.</strong> {healthError}
        </p>
      )}

      <main className="px-6 py-6">
        <Suspense fallback={<PageLoading />}>
          {firstRun ? (
            <WorkbookSetup dataVersion={dataVersion} firstRun onSaved={applyHealth} />
          ) : (
            <PageOutlet
              route={route}
              dataVersion={dataVersion}
              health={health}
              queryString={filters.queryString}
              onWorkbookSaved={applyHealth}
            />
          )}
        </Suspense>
      </main>

      <ConflictDialog refusal={refusal} onClose={() => setRefusal(null)} />
    </div>
  )
}

/**
 * O intervalo entre o clique e o modulo da pagina chegar. Nao e o estado
 * `carregando` de nenhuma pagina — aquele espera a resposta da API, este espera
 * o codigo. Distintos de proposito: um traco aqui nao significa dado ausente.
 */
function PageLoading() {
  return (
    <p role="status" className="panel-loading">
      Carregando página…
    </p>
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
                ? 'border-border-strong text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
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
  onWorkbookSaved: (health: HealthResponse) => void
}

/**
 * `dataVersion` chega como `key`: quando o dia vira ou a planilha muda, a
 * pagina inteira remonta e refaz as proprias requisicoes, sem que a casca
 * precise conhecer nenhuma delas. Com `H-21` as sete estao montadas, e o
 * `PendingPage` do fim vira rede de seguranca: `PageId` novo sem ramo aqui cai
 * nele, e a guarda de `web/tests/paginas-montadas.test.tsx` reprova.
 *
 * **`WorkbookSetup` e a unica sem a `key`**, e nao por descuido: ela nao exibe
 * dado da planilha, e sim o formulario que a aponta. Remontar apagaria o
 * caminho que o operador esta digitando e a frase que acabou de aparecer sobre
 * o clique anterior — justamente quando o dado muda, que e o que um clique bem
 * sucedido provoca.
 *
 * A casca repassa `queryString` em vez de os filtros inteiros: a pagina precisa
 * anexar o recorte as requisicoes, nunca interpreta-lo.
 */
function PageOutlet({ route, dataVersion, health, queryString, onWorkbookSaved }: PageOutletProps) {
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

  if (route.pageId === 'clients') {
    return <Clients key={dataVersion} queryString={queryString} dataVersion={dataVersion} />
  }

  if (route.pageId === 'performance') {
    return <Performance key={dataVersion} queryString={queryString} dataVersion={dataVersion} />
  }

  if (route.pageId === 'alerts') {
    return <Alerts key={dataVersion} queryString={queryString} dataVersion={dataVersion} />
  }

  if (route.pageId === 'history') {
    return <History key={dataVersion} queryString={queryString} dataVersion={dataVersion} />
  }

  // Sem `queryString`: o detalhe e sobre UM processo achado pela REF, e o
  // recorte nao muda o que ele mostra — a casca ja esconde a barra aqui.
  if (route.pageId === 'processDetail' && route.ref !== null) {
    return <ProcessDetail key={dataVersion} processRef={route.ref} dataVersion={dataVersion} />
  }

  // Alcancavel pelo endereco depois que ja houve leitura — trocar de planilha na
  // virada de ano, por exemplo. O desvio automatico da primeira execucao nem
  // chega aqui: ele acontece na casca, antes do outlet.
  if (route.pageId === 'workbookSetup') {
    return <WorkbookSetup dataVersion={dataVersion} firstRun={false} onSaved={onWorkbookSaved} />
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
