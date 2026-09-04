import { useEffect } from 'react'

/**
 * Se esta pagina ainda NAO mostrou dado nesta sessao.
 *
 * **Existe por causa do `key={dataVersion}`**, e nao apesar dele. As sete
 * paginas sao montadas com essa `key` em `App.tsx`: quando o watcher rele a
 * planilha, o React DESTROI a pagina e cria outra, o estado volta a
 * `carregando`, e um esqueleto de altura cheia trocaria conteudo bom por forma
 * — com a tela inteira piscando sem o operador ter pedido nada, justamente
 * depois de ele aplicar edicoes. E o caso-limite que `H-85` proibe.
 *
 * `useProcesses` e as irmas ja fazem a coisa certa sozinhas: mudar
 * `requestQuery` ou `dataVersion` dispara a requisicao **sem** voltar o estado
 * para `carregando`, entao ordenar e paginar nunca mostram carregamento. Quem
 * quebra e a `key`, que mata o componente antes que isso importe.
 *
 * Por isso a marca vive **fora** de qualquer componente: dentro dela seria
 * destruida junto. Modulo e o unico escopo que a `key` nao alcanca.
 *
 * O preco e estado global, e ele se paga com `resetLoadedPages` no
 * `web/tests/setup.ts`: sem o reset, a segunda montagem de uma pagina em
 * QUALQUER teste do arquivo ja a encontraria marcada, e a assercao do esqueleto
 * passaria a depender da ordem dos casos.
 */
const loaded = new Set<string>()

/** Chamado entre testes. Em producao ninguem chama: a sessao e a vida da aba. */
export function resetLoadedPages(): void {
  loaded.clear()
}

/**
 * @param pageId identidade da pagina, estavel entre remontagens
 * @param ready se o dado ja chegou neste render
 */
export function useFirstLoad(pageId: string, ready: boolean): boolean {
  const first = !loaded.has(pageId)

  // A marca vai no efeito, e nao no render: marcar durante o render tornaria
  // `first` falso no MESMO render que ainda mostra o esqueleto.
  useEffect(() => {
    if (ready) loaded.add(pageId)
  }, [pageId, ready])

  return first
}
