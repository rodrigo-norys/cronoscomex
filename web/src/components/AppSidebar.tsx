import type { NavCounts } from '../hooks/useNavCounts.ts'
import { NAV_PAGES, navigate, type PageId, type Route } from '../router.ts'
import { NavIcon } from './NavIcon.tsx'

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
 * **O icone se soma ao rotulo e nao o substitui** (`H-86`). Ele e
 * `aria-hidden`, usa `currentColor` e nao traz cor nova; quem distingue o item
 * corrente continua sendo a ESPESSURA da borda, pelo motivo de `H-72` logo
 * abaixo. Um desenho por destino nao serve como canal: os sete teriam a mesma
 * espessura, e sob `forced-colors` o corrente sumiria no conjunto.
 *
 * **Operacional e Alertas trazem contagem** (`H-87`), e a premissa que a
 * recusava caiu em vez de ser contornada: ela dizia que o unico numero servido
 * era `rowsAccepted`, que ignora o recorte, e que contagem por pagina exigiria
 * campo novo na API. Nenhuma das duas vale — `GET /api/processes` ja devolve
 * `total` recortado, e `GET /api/alerts` respeita os filtros por `RF-18`. Quem
 * busca e `useNavCounts`; aqui so se apresenta, e contagem ausente chega como
 * `null` para nao virar zero, que seria uma afirmacao.
 */

const FOOTER_PAGE_ID = 'workbookSetup'

const ITEM_BASE =
  'motion-tint flex items-center gap-2 rounded-control border-l-2 px-3 py-2 text-sm font-medium'

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

/**
 * Alertas pinta o numero de `state-error-fg`, porque a fila e trabalho
 * pendente: 6,36:1 e 5,51:1 no claro, 7,53:1 e 6,45:1 no escuro, medidos nos
 * DOIS fundos que o item pode ter (`H-87`).
 *
 * **Operacional herda a cor do item, como o icone de `H-86`.** `text-muted`
 * estava aqui e foi medido reprovando — 4,38:1 no claro e 4,32:1 no escuro
 * sobre `action-soft`, o fundo do item corrente, contra o piso de 4,5:1. O
 * token foi calibrado contra `surface-raised` (`H-39`), e o item corrente e o
 * unico lugar do conjunto que pinta fundo; herdar resolve nos dois estados sem
 * cor nova (`D-29`).
 */
const COUNT_TONE: Partial<Record<PageId, string>> = {
  alerts: 'text-state-error-fg',
}

/**
 * O nome acessivel do item que tem contagem.
 *
 * **`aria-label`, e nao um `sr-only` ao lado do numero**, e a razao foi medida:
 * o calculo do nome concatena os nos filhos SEM separador e apara o espaco de
 * cada um, entao o texto de apoio saia grudado — "Operacional650 processos".
 * O rotulo visivel abre o label, como `SC 2.5.3` exige.
 *
 * O de Alertas e o MESMO texto do cabecalho da fila, porque e o mesmo numero.
 */
function countedLabel(page: PageId, label: string, count: number): string {
  if (page === 'alerts') {
    const fila = count === 1 ? '1 processo pede ação' : `${count} processos pedem ação`
    return `${label}, ${fila}`
  }
  return `${label}, ${count} ${count === 1 ? 'processo' : 'processos'}`
}

function NavItem({
  page,
  current,
  count,
}: {
  page: (typeof NAV_PAGES)[number]
  current: boolean
  count: number | null
}) {
  return (
    <a
      href={page.path}
      aria-current={current ? 'page' : undefined}
      aria-label={count === null ? undefined : countedLabel(page.id, page.label, count)}
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
      <NavIcon page={page.id} />
      {page.label}
      {/* Mono e tabular como toda contagem do conjunto: a largura do digito nao
          muda, e o numero nao se mexe ao trocar de filtro. */}
      {count !== null && (
        <span className={`ml-auto font-mono text-xs tabular-nums ${COUNT_TONE[page.id] ?? ''}`}>
          {count}
        </span>
      )}
    </a>
  )
}

/**
 * `inert` chega por propriedade, e nao por um `<div>` em volta (`H-82`): a
 * lateral e item do flex da raiz, com `shrink-0` e largura propria, e um
 * involucro trocaria a inercia por um defeito de layout.
 */
export function AppSidebar({
  route,
  counts,
  inert = false,
}: {
  route: Route
  counts: NavCounts
  inert?: boolean
}) {
  const principais = NAV_PAGES.filter((page) => page.id !== FOOTER_PAGE_ID)
  const rodape = NAV_PAGES.filter((page) => page.id === FOOTER_PAGE_ID)

  // Os outros cinco destinos nao tem numero que signifique recorte: Inicio,
  // Clientes, Performance, Historico e Configuracao mostram outra coisa.
  const countOf = (page: PageId): number | null => {
    if (page === 'operational') return counts.processes
    if (page === 'alerts') return counts.alerts
    return null
  }

  return (
    <nav
      inert={inert}
      aria-label="Páginas"
      className="flex shrink-0 flex-col gap-1 border-b border-border-subtle bg-surface-raised p-3 sm:w-54 sm:border-r sm:border-b-0"
    >
      <p className="px-3 pt-1 pb-2">
        <span className="block text-sm font-semibold text-text-primary">CronosComex</span>
        <span className="block text-xs text-text-muted">Desembaraço aduaneiro</span>
      </p>

      {principais.map((page) => (
        <NavItem
          key={page.id}
          page={page}
          current={page.id === route.pageId}
          count={countOf(page.id)}
        />
      ))}

      {/* `mt-auto` empurra o rodape para baixo na coluna, e nao faz nada na
          faixa horizontal do celular — que e o comportamento certo nos dois. */}
      <div className="mt-auto border-border-subtle pt-2 sm:border-t">
        {rodape.map((page) => (
          <NavItem key={page.id} page={page} current={page.id === route.pageId} count={null} />
        ))}
      </div>
    </nav>
  )
}
