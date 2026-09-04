import type { PageId } from '../router.ts'

/**
 * Os sete icones da lateral (`H-86`, `D-29`).
 *
 * **O icone se soma ao rotulo, nunca o substitui.** Ele e `aria-hidden`, e quem
 * nomeia o link continua sendo o texto ao lado — o desenho existe para o
 * reconhecimento nao depender so da leitura, e nao para carregar informacao que
 * so ele tenha. Mesmo principio de `SeverityIcon`, e a mesma norma: `SC 1.4.1`.
 *
 * **`currentColor`, e nenhuma cor nova** (determinacao 1 de `D-29`). Duas
 * consequencias: o icone acompanha o item — `text-primary` no corrente,
 * `text-secondary` no repouso — sem que o conjunto ganhe token, e o traco
 * sobrevive a `forced-colors: active`, onde o agente de usuario descarta a
 * paleta do autor. **`D-29` dizia `text-muted` para o repouso, e o item usa
 * `text-secondary`** — a frase dela se contradizia, porque herdar a cor do
 * texto e pintar de outro token sao coisas diferentes. Herdar venceu, que e o
 * que ela decide na primeira metade.
 *
 * **O icone NAO e o canal que distingue o item corrente.** Quem distingue e a
 * espessura da borda esquerda, medida em `H-72`: sob o modo forcado a cor da
 * borda e substituida, a largura nao. Sete desenhos distintos com a mesma
 * espessura deixariam o corrente indistinguivel.
 *
 * SVG inline, e nao biblioteca — o plano nao preve a dependencia, e o padrao e
 * o de `SeverityMark.tsx`: `viewBox` de 16, traco de 1.5, sem preenchimento.
 */

/** O desenho de cada destino, na ordem de `NAV_PAGES`. */
const PATHS: Readonly<Record<PageId, React.ReactNode>> = {
  // Casa: telhado e porta.
  home: (
    <>
      <path d="M2.5 7.5 8 3l5.5 4.5" strokeLinejoin="round" />
      <path d="M4 7v6.5h8V7" strokeLinejoin="round" />
      <path d="M6.75 13.5v-3h2.5v3" />
    </>
  ),
  // Contentor: caixa com as tres cintas verticais.
  operational: (
    <>
      <rect x="2" y="4.5" width="12" height="7" rx="0.5" />
      <path d="M5.5 4.5v7M8 4.5v7M10.5 4.5v7" />
    </>
  ),
  // Duas pessoas: quem sao os clientes.
  clients: (
    <>
      <circle cx="6" cy="5.5" r="2" />
      <path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13" strokeLinejoin="round" />
      <path d="M10.5 4.2a2 2 0 0 1 0 3.6M11 9.8c1.5.4 2.5 1.7 2.5 3.2" strokeLinejoin="round" />
    </>
  ),
  // Barras crescentes: desempenho ao longo de alguma coisa.
  performance: (
    <>
      <path d="M2 13.5h12" />
      <path d="M4.5 13.5V10M8 13.5V6.5M11.5 13.5V3.5" />
    </>
  ),
  // Sino: o que reclama atencao.
  alerts: (
    <>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11Z" strokeLinejoin="round" />
      <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  // Relogio com a seta de volta: o tempo que ja passou.
  history: (
    <>
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5v3l2 1.5" strokeLinejoin="round" />
    </>
  ),
  // Engrenagem simplificada: quatro dentes bastam a 16 px.
  workbookSetup: (
    <>
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.75v2M8 12.25v2M14.25 8h-2M3.75 8h-2M12.4 3.6l-1.4 1.4M5 11l-1.4 1.4M12.4 12.4 11 11M5 5 3.6 3.6" />
    </>
  ),
  // Os dois que nao sao destino do menu, e por isso nao tem desenho: chega-se ao
  // detalhe por um processo, e a `notFound` por endereco que nao existe.
  processDetail: null,
  notFound: null,
}

export function NavIcon({ page }: { page: PageId }) {
  const path = PATHS[page]
  if (path === null) return null

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {path}
    </svg>
  )
}
