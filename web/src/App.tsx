import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ApplyRefusal, HealthResponse } from './api-client.ts'
import { AppSidebar } from './components/AppSidebar.tsx'
import { ConflictDialog } from './components/ConflictDialog.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { FilterPanel } from './components/FilterPanel.tsx'
import {
  LiveAnnouncement,
  PAGE_LIVE_REGION_ID,
  PAGE_LIVE_STATUS_ID,
} from './components/PageAlert.tsx'
import { StatusBanner } from './components/StatusBanner.tsx'
import { TopBar } from './components/TopBar.tsx'
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
import { consumePendingPageFocus, pageOf, type Route, useRoute } from './router.ts'

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
 * **todas** elas, concentra as tres frentes de A-62, e monta os quatorze filtros
 * globais. Nao calcula nada: os 21 indicadores e os cinco alertas vem prontos
 * do servidor, ja recortados (regra inviolavel 6).
 *
 * **O eixo e lateral desde `H-59`** (`D-22`). Eram quatro faixas horizontais
 * antes do primeiro dado — titulo com acoes, navegacao, filtros e faixa de
 * estado —, e passou a ser uma coluna de navegacao mais UMA faixa acima do
 * conteudo. A faixa de estado e o `healthError` continuam existindo em todas as
 * paginas (A-57): mudaram de lugar, nao de existencia.
 *
 * **As regioes vivas existem desde a montagem** (`H-43`). A MDN e explicita:
 * *"Do not try to dynamically add/generate an element with `role='alert'` that
 * is already populated"* — o no nasce com o texto dentro, o leitor de tela nao
 * tem o que comparar, e a mensagem nao e anunciada. O padrao aqui e o que
 * `H-34` ja usava em `WorkbookSetup`: o no fica sempre no DOM, e so o texto
 * dentro dele muda. Vazio, ele e `sr-only` — sem borda, fundo nem espacamento.
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
  const mainRef = useRef<HTMLElement>(null)

  /**
   * O painel de filtros e modal, e por isso o estado dele vive na CASCA (`H-82`,
   * `D-30`): quem fica inerte enquanto ele esta aberto e a lateral, a barra de
   * topo e a regiao de conteudo — tres nos que a barra de filtros nao alcanca.
   *
   * O gatilho tambem e da casca, pelo mesmo motivo do foco: `Esc` fecha e o foco
   * volta para o botao, e quem fecha e o painel. Sem a devolucao o foco cai no
   * `<body>` e a tabulacao recomeca do topo — `SC 2.4.3`, o defeito que `VN-4`
   * mediu.
   */
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)

  /**
   * O foco so se move quando a navegacao PEDIU (`H-70`). O sinal e consumido
   * aqui, uma vez por troca de rota: o botao "voltar" emite o mesmo `popstate`
   * e nao o seta, entao ele nao move o foco — e o link da casca declara
   * `keepFocus`, porque ali o foco ja esta onde o usuario o pos.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; a rota nao e lida aqui, e sem ela o efeito nunca reagiria a troca de pagina
  useEffect(() => {
    if (consumePendingPageFocus()) mainRef.current?.focus()
  }, [route])

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

  /**
   * Pagina sem barra nao pode deixar o painel aberto: ele desapareceria com o
   * foco dentro, e a tabulacao recomecaria do `<body>`. Fecha antes de pintar,
   * porque `useEffect` deixaria um quadro com o painel sobre a pagina nova.
   */
  const panelOpen = filtersOpen && showFilters

  const closeFilters = (): void => {
    setFiltersOpen(false)
    filterTriggerRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-surface-base font-sans text-text-primary sm:flex">
      {/*
        `SC 2.4.1 Bypass Blocks`. A lateral, o topo e a barra de filtros vem
        ANTES do conteudo no DOM e se repetem nas sete telas — 20 paradas de
        tabulacao para chegar ao primeiro dado, medidas em 01/09/2026. O salto
        e o unico jeito de o operador de teclado passar por elas.
        **Ele ja faltava antes de `H-59`**, com as sete abas horizontais; a
        historia o pede porque e aqui que a ordem de foco e redesenhada.

        Visivel so ao receber foco: quem usa o mouse nunca o ve, e quem tabula o
        encontra primeiro. Esconde-lo com `hidden` o tiraria da ordem.
      */}
      <a
        href="#conteudo"
        className="sr-only rounded-control bg-action-bg px-3 py-2 text-sm text-action-fg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
      >
        Ir para o conteúdo
      </a>

      {/* A lateral nao aparece na primeira execucao, pelo mesmo motivo de antes:
          nao ha dado a navegar, e o operador precisa apontar a planilha. */}
      {!firstRun && <AppSidebar route={route} inert={panelOpen} />}

      {/* `min-w-0` e obrigatorio: sem ele o filho flex assume `min-width: auto`
          e uma tabela larga empurra a coluna para fora, que e o defeito que
          `SC 1.4.10` cobra e `R01` ja tratou dentro de cada pagina. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          A barra de topo fica FORA do contexto de posicionamento do veu, e isso
          e a terceira determinacao de `D-30`: "Dados de 03/09/2026", `Aplicar
          alteracoes` e `Atualizar` permanecem a vista com o painel aberto.
          Cobrir a acao que grava no arquivo do operador seria esconder o que ele
          precisa saber que existe. Inerte, sim; invisivel, nao.
        */}
        <div inert={panelOpen}>
          <TopBar
            title={pageOf(route)?.label ?? 'CronosComex'}
            health={health}
            refreshing={refreshing}
            onRefresh={refresh}
            onRefused={setRefusal}
          />
        </div>

        {/* O contexto de posicionamento do veu: ele e `absolute` aqui dentro, e
            por isso cobre a regiao de conteudo sem alcancar a barra de topo. */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div inert={panelOpen} className="flex min-w-0 flex-1 flex-col">
            {showFilters && (
              <FilterBar
                filters={filters}
                options={options}
                panelOpen={panelOpen}
                triggerRef={filterTriggerRef}
                onOpenPanel={() => setFiltersOpen(true)}
              />
            )}

            <StatusBanner health={health} />

            {/* O no e o MESMO antes e depois de `healthError` ganhar valor: so o
            conteudo muda. Envolver isto num condicional era o `ACHADO 11`. */}
            <p
              role="alert"
              className={
                healthError === null
                  ? 'sr-only'
                  : 'border-y border-state-error-border bg-state-error-bg px-6 py-3 text-sm text-state-error-fg'
              }
            >
              {healthError !== null && (
                <>
                  <strong className="font-semibold">Sem contato com o servidor.</strong>{' '}
                  {healthError}
                </>
              )}
            </p>

            {/*
          `H-70`. `VN-4` mediu o foco caindo no `<body>` depois de abrir um
          recorte pelo ranking — 196 paradas de tabulacao pela frente em
          `/operacional`, e `SC 2.4.3`. O alvo e a landmark da casca, e nao um no
          da pagina: ela existe mesmo enquanto o `Suspense` mostra o fallback, o
          que resolve por construcao o caso-limite da rota `lazy` que ainda nao
          montou. O `aria-label` acompanha a pagina, e e ele que o leitor de tela
          anuncia ao receber o foco — mover o foco em silencio trocaria um
          defeito por outro. `tabIndex={-1}` nao acrescenta parada.
        */}
            <main
              id="conteudo"
              ref={mainRef}
              tabIndex={-1}
              aria-label={pageOf(route)?.label}
              className="px-6 py-6"
            >
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
          </div>

          {/* Montado DEPOIS do conteudo inerte, e irmao dele: dentro, herdaria a
              inercia; fora do contexto relativo, o veu cobriria a tela inteira. */}
          {panelOpen && (
            <FilterPanel
              filters={filters}
              options={options}
              optionsError={optionsError}
              onClose={closeFilters}
            />
          )}
        </div>
      </div>

      {/*
        A regiao persistente das PAGINAS (`H-44`).

        Ela vive aqui, e nao dentro de cada pagina, porque as sete fazem `return`
        antecipado no estado de erro: uma regiao declarada dentro delas
        desmontaria junto com o resto da arvore, e o leitor de tela nao teria o
        que comparar — o mesmo `ACHADO 11`, uma camada acima.

        **A casca nao conhece pagina nenhuma.** Ela expoe um endereco estavel no
        DOM; quem escreve nele e a pagina, por portal.

        **`sr-only`, e nao `hidden`.** O texto do portal duplica o que o bloco
        visivel da pagina ja mostra — sem esconde-lo, ele aparecia na tela como
        uma terceira coluna do flex da raiz, fora do painel. `hidden` ou
        `display: none` resolveriam a tela e matariam o anuncio: no de regiao
        viva removido da arvore de acessibilidade nao e lido.
      */}
      <div id={PAGE_LIVE_REGION_ID} role="alert" className="sr-only" />
      <div id={PAGE_LIVE_STATUS_ID} role="status" className="sr-only" />

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
    <>
      {/*
        **Sem `role="status"` aqui** (`H-74`, `ACHADO 10`). Este no e o
        `fallback` do `<Suspense>`: ele NASCE com a mensagem dentro, e regiao
        viva que ja chega populada nao e anunciada — e o mesmo `ACHADO 11` que
        criou as duas regioes persistentes da casca, uma camada abaixo.

        Quem anuncia e `PAGE_LIVE_STATUS_ID`, que esta montado desde o primeiro
        render e recebe o texto por portal. O bloco visivel fica `aria-hidden`
        para o leitor nao ouvir a mesma coisa duas vezes — mesmo par de
        `WorkbookSetup`, e por isso os dois textos diferem.
      */}
      <p aria-hidden="true" className="panel-loading">
        Carregando página…
      </p>
      <LiveAnnouncement text="Carregando a página." tone="status" />
    </>
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
