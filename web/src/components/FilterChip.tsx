import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

/**
 * Um filtro como chip, com o conteudo dele num popover (`H-60`, `D-22`).
 *
 * A barra ocupava uma faixa de treze controles sempre abertos; agora ocupa uma
 * linha, e o recorte ativo continua visivel **sem abrir nada** — o `summary` e
 * o que o chip diz quando ha selecao.
 *
 * **A URL continua sendo o unico estado** (`useFilters.ts`). O chip e
 * apresentacao do que ja esta la: recarregar a pagina reconstroi o mesmo
 * recorte, e e isso que separa esta fatia de uma reescrita do filtro.
 *
 * **Ele nao sabe o que ha dentro.** O conteudo chega por `children` — lista de
 * multipla escolha, dois campos de data ou um seletor de tres estados —, e por
 * isso o comportamento de abrir, fechar e devolver o foco existe uma vez so.
 * Era duplicado em `MultiSelect` e ausente nos outros dois.
 *
 * **O painel se recolhe para dentro da tela, e isso e medido** (`H-65`,
 * `VN-1`): ele tem 16 rem e nasce ancorado no `left` do chip, entao um chip no
 * meio de uma linha do `flex-wrap` o lancava para fora. A 320 px, **6 dos 13**
 * faziam a pagina rolar — 135 px no pior caso, quase metade da largura util —,
 * e isso reprova `SC 1.4.10`. Nao ha solucao so de CSS: posicionamento por
 * ancora ainda e do Chrome, e clamp de elemento absoluto o navegador nao faz.
 */

/** Folga minima entre o painel e a borda da tela. */
const MARGEM_DA_TELA = 8

export function FilterChip({
  label,
  summary,
  children,
}: {
  label: string
  /** O recorte ativo, ja legivel. `null` quando o filtro nao recorta nada. */
  summary: string | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const active = summary !== null

  /**
   * `useLayoutEffect` e nao `useEffect`: medir depois da pintura mostraria o
   * painel fora da tela por um quadro, que e o defeito que se corrige.
   *
   * `margin-left` e nao `transform`: a animacao de `motion-surface` escreve
   * `transform`, e a origem de cascata dela vence a do estilo em linha —
   * durante os 170 ms o deslocamento sumiria.
   */
  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const caixa = panel.current?.getBoundingClientRect()
    // Em jsdom todo retangulo e zero; sem isto o calculo deslocaria por nada.
    if (!caixa || caixa.width === 0) return

    // O painel mais largo que a tela nao tem posicao boa: o limite direito cai
    // abaixo do esquerdo, e o `max` faz o esquerdo vencer.
    const tela = document.documentElement.clientWidth
    const limiteDireito = Math.max(MARGEM_DA_TELA, tela - MARGEM_DA_TELA - caixa.width)
    const desejado = Math.min(Math.max(caixa.left, MARGEM_DA_TELA), limiteDireito)

    setShift(desejado - caixa.left)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    /**
     * `Esc` fecha **e devolve o foco ao chip**. Sem a devolucao o foco cai no
     * `<body>`, e o operador de teclado recomeca a tabulacao do topo da pagina
     * — o mesmo defeito que `VN-4` mediu na navegacao (`SC 2.4.3`).
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        /*
          Nome acessivel EXPLICITO, e nao o texto concatenado dos filhos: sem
          ele o leitor de tela anuncia "ClienteACME", porque o `gap` do flex e
          espaco visual e nao textual. Medido ao escrever o teste de resumo.

          O `title` cobre o outro lado do mesmo caso-limite: nome de cliente
          real estoura a linha, e `truncate` sem o valor completo em algum lugar
          cortaria o recorte em silencio.
        */
        aria-label={active ? `${label}: ${summary}` : label}
        title={active ? `${label}: ${summary}` : undefined}
        className={`motion-tint flex max-w-64 items-center gap-1.5 rounded-control border px-2.5 py-1 text-sm ${
          active
            ? 'border-action-bg bg-action-soft text-text-primary forced-colors:border-2'
            : 'border-border-control bg-surface-raised text-text-secondary hover:bg-surface-hover'
        }`}
      >
        <span className="shrink-0">{label}</span>
        {active && <span className="truncate text-text-secondary">{summary}</span>}
        {/* `text-secondary` e nao `muted`: sobre `action-soft`, que e o fundo do
            ramo ativo, o `muted` mede 4,38:1 no claro contra o piso de 4,5:1 de
            `SC 1.4.3` — medido em `H-65`. `text-xs` sao 12 px, entao nao ha
            isencao de texto grande. */}
        <span aria-hidden="true" className="shrink-0 text-xs text-text-secondary">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          style={shift === 0 ? undefined : { marginLeft: `${shift}px` }}
          className="motion-surface absolute z-20 mt-1 max-h-72 w-64 overflow-auto rounded-container border border-border-subtle bg-surface-raised p-2"
        >
          {children}
        </div>
      )}
    </div>
  )
}
