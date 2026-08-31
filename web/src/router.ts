import { useMemo, useSyncExternalStore } from 'react'

/**
 * Roteamento a mao (D-16): `History API`, `popstate` e `URLSearchParams`.
 *
 * Sao sete paginas planas numa aplicacao local, e o `react-router` seria uma
 * dependencia de execucao que o plano nao preve. A decisao registra os gatilhos
 * de reavaliacao — mais de ~10 paginas, rotas aninhadas, carregamento por rota,
 * ou este arquivo passando de ~100 linhas.
 */

export type PageId =
  | 'home'
  | 'operational'
  | 'clients'
  | 'performance'
  | 'alerts'
  | 'history'
  | 'processDetail'
  | 'workbookSetup'
  | 'notFound'

export interface PageDefinition {
  readonly id: PageId
  readonly path: string
  readonly label: string
  /** A historia que substitui o marcador de pagina pendente por conteudo. */
  readonly story: string
}

export const NAV_PAGES: readonly PageDefinition[] = [
  { id: 'home', path: '/', label: 'Início', story: 'H-16' },
  { id: 'operational', path: '/operacional', label: 'Operacional', story: 'H-17' },
  { id: 'clients', path: '/clientes', label: 'Clientes', story: 'H-18' },
  { id: 'performance', path: '/performance', label: 'Performance', story: 'H-19' },
  { id: 'alerts', path: '/alertas', label: 'Alertas', story: 'H-20' },
  { id: 'history', path: '/historico', label: 'Histórico', story: 'H-21' },
  { id: 'workbookSetup', path: '/configuracao', label: 'Configuração', story: 'H-34' },
]

/** Fora do menu: so se chega nela a partir de um processo (`H-17` → `H-22`). */
export const PROCESS_DETAIL_PAGE: PageDefinition = {
  id: 'processDetail',
  path: '/processo',
  label: 'Detalhe do processo',
  story: 'H-22',
}

/**
 * A mesma pagina de `NAV_PAGES`, alcancavel tambem sem passar pelo menu.
 *
 * **Ate `H-38` ela estava so aqui, e este bloco afirmava que se chegava nela
 * pelo painel de saude — nao se chegava.** Nenhuma linha de `web/src/` apontava
 * para `/configuracao`: o unico acesso era digitar o endereco, e depois de
 * apontar a planilha uma vez o operador perdia a tela. O comentario descrevia um
 * caminho que ninguem construiu, que e o modo de falha de `PD-06`.
 *
 * Continua exportada porque a casca desvia para ca na primeira execucao, quando
 * o menu ainda nao existe — e `pageOf` precisa resolve-la nesse estado.
 */
export const WORKBOOK_SETUP_PAGE: PageDefinition = NAV_PAGES.find(
  (page) => page.id === 'workbookSetup',
) ?? {
  id: 'workbookSetup',
  path: '/configuracao',
  label: 'Configuração',
  story: 'H-34',
}

const PROCESS_DETAIL_PREFIX = `${PROCESS_DETAIL_PAGE.path}/`

export interface Route {
  readonly pageId: PageId
  /** Preenchido apenas em `processDetail`. */
  readonly ref: string | null
}

const NOT_FOUND: Route = { pageId: 'notFound', ref: null }

export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  if (path.startsWith(PROCESS_DETAIL_PREFIX)) {
    const ref = decodeURIComponent(path.slice(PROCESS_DETAIL_PREFIX.length))
    return ref === '' ? NOT_FOUND : { pageId: 'processDetail', ref }
  }

  const page = NAV_PAGES.find((candidate) => candidate.path === path)
  return page ? { pageId: page.id, ref: null } : NOT_FOUND
}

export function pageOf(route: Route): PageDefinition | null {
  if (route.pageId === 'processDetail') return PROCESS_DETAIL_PAGE
  if (route.pageId === 'workbookSetup') return WORKBOOK_SETUP_PAGE
  return NAV_PAGES.find((candidate) => candidate.id === route.pageId) ?? null
}

/**
 * Troca de pagina **preservando a query**, que e onde os doze filtros globais
 * vivem — trocar de pagina nunca limpa o recorte que o operador montou.
 *
 * `pushState` nao emite evento nenhum, entao o `popstate` sintetico e o que faz
 * o assinante saber. Ele deixa navegacao programatica e botao "voltar" no mesmo
 * caminho de atualizacao, em vez de dois.
 */
export function navigate(path: string): void {
  const target = `${path}${window.location.search}`
  if (target === `${window.location.pathname}${window.location.search}`) return

  window.history.pushState(null, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Reescreve a query **sem empilhar historico**, ao contrario de `navigate`.
 *
 * Filtro e estado de visualizacao, nao navegacao: marcar cinco clientes
 * empilharia cinco entradas, e o botao "voltar" viraria "desmarcar o ultimo" —
 * o operador que quisesse sair da pagina teria de clicar seis vezes. Com
 * `replaceState`, voltar sai da pagina, que e o que o gesto significa.
 */
export function replaceQuery(search: string): void {
  const normalized = search === '' || search === '?' ? '' : search
  if (normalized === window.location.search) return

  window.history.replaceState(null, '', `${window.location.pathname}${normalized}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function currentPath(): string {
  return window.location.pathname
}

function currentSearch(): string {
  return window.location.search
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, currentPath, currentPath)
  return useMemo(() => parseRoute(pathname), [pathname])
}

/**
 * Dois `useSyncExternalStore` sobre o mesmo `popstate`, e nao um sobre a URL
 * inteira: assim mudar filtro nao invalida a rota, nem trocar de pagina
 * reconstroi os parametros.
 */
export function useQuery(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, currentSearch, currentSearch)
  return useMemo(() => new URLSearchParams(search), [search])
}
