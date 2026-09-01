import { NAV_PAGES, navigate, type Route } from '../router.ts'

/**
 * A navegacao lateral (`H-59`, `D-22`).
 *
 * **Ela escala alem de sete itens; aba horizontal nao.** E o argumento
 * estrutural do redesenho, e vale independentemente da estetica: o menu tem
 * sete destinos hoje, e `E10` fechou sem propor mais nenhum — mas o custo de
 * cada destino novo numa faixa horizontal e uma quebra de linha, e numa coluna
 * e uma linha.
 *
 * **O roteamento nao muda, e `D-16` nao e reaberta.** Os destinos continuam
 * sendo `<a href>` reais, com `pushState` no clique simples e o navegador
 * cuidando de modificador e botao do meio. `router.ts` nao ganhou uma linha
 * nesta historia: a separacao entre destino principal e rodape e apresentacao,
 * e mantê-la aqui deixou o arquivo nas 97 linhas de codigo que `D-16` mede.
 *
 * **Configuracao vive no rodape e NAO some.** `H-38` fechou justamente a tela
 * inalcancavel — o unico acesso era digitar o endereco, e depois de apontar a
 * planilha uma vez o operador a perdia.
 *
 * **Sem contagem ao lado do item**, e isso e deliberado: o mockup mostra "649" e
 * "6", e o unico numero que a casca tem servido e `rowsAccepted`, que ignora o
 * recorte — exibi-lo ao lado de Operacional afirmaria 649 com o filtro em 12.
 * Contagem por pagina exigiria campo novo na API, que o epico proibe. O
 * caso-limite da historia manda o item aparecer **sem** contagem, nunca com
 * zero.
 */

const FOOTER_PAGE_ID = 'workbookSetup'

const ITEM_BASE = 'block rounded-control border-l-2 px-3 py-2 text-sm font-medium'

/**
 * O item corrente, e o unico lugar do conjunto onde o acento pinta fundo.
 *
 * **A ESPESSURA e o canal que sobrevive a `forced-colors: active`** (`H-72`,
 * `VN-5`): sob o modo forcado o agente de usuario pinta `border-transparent`
 * como pinta qualquer outra borda, e os sete itens ficariam com a mesma
 * assinatura — restaria so o `aria-current`, que serve o leitor de tela e nao
 * serve quem enxerga. O canal migrou da borda INFERIOR das abas para a
 * ESQUERDA da lateral, e vale pelo mesmo motivo. O `pl` compensa os 2 px a
 * mais para o texto nao se mexer, e viaja na MESMA variante.
 */
const ITEM_CURRENT =
  'border-action-bg bg-action-soft text-text-primary forced-colors:border-l-4 forced-colors:pl-2.5'
const ITEM_REST =
  'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'

function NavItem({ page, current }: { page: (typeof NAV_PAGES)[number]; current: boolean }) {
  return (
    <a
      href={page.path}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        // Clique simples navega pelo History API; modificador e botao do meio
        // continuam sendo do navegador — abrir em outra aba e um gesto legitimo.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        // `keepFocus`: a UNICA navegacao que nao move o foco (`H-70`). Quem
        // clicou no link ja esta com o foco nele.
        navigate(page.path, { keepFocus: true })
      }}
      className={`${ITEM_BASE} ${current ? ITEM_CURRENT : ITEM_REST}`}
    >
      {page.label}
    </a>
  )
}

export function AppSidebar({ route }: { route: Route }) {
  const principais = NAV_PAGES.filter((page) => page.id !== FOOTER_PAGE_ID)
  const rodape = NAV_PAGES.filter((page) => page.id === FOOTER_PAGE_ID)

  return (
    <nav
      aria-label="Páginas"
      className="flex shrink-0 flex-col gap-1 border-b border-border-subtle bg-surface-raised p-3 sm:w-54 sm:border-r sm:border-b-0"
    >
      <p className="px-3 pt-1 pb-2">
        <span className="block text-sm font-semibold text-text-primary">CronosComex</span>
        <span className="block text-xs text-text-muted">Desembaraço aduaneiro</span>
      </p>

      {principais.map((page) => (
        <NavItem key={page.id} page={page} current={page.id === route.pageId} />
      ))}

      {/* `mt-auto` empurra o rodape para baixo na coluna, e nao faz nada na
          faixa horizontal do celular — que e o comportamento certo nos dois. */}
      <div className="mt-auto border-border-subtle pt-2 sm:border-t">
        {rodape.map((page) => (
          <NavItem key={page.id} page={page} current={page.id === route.pageId} />
        ))}
      </div>
    </nav>
  )
}
