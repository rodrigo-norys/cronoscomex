import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

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
 */

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
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const active = summary !== null

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
        <span aria-hidden="true" className="shrink-0 text-xs text-text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="motion-surface absolute z-20 mt-1 max-h-72 w-64 overflow-auto rounded-container border border-border-subtle bg-surface-raised p-2"
        >
          {children}
        </div>
      )}
    </div>
  )
}
