import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FilterOptionsResponse } from '../api-client.ts'

/** Derivado da resposta da rota, para nao importar de `src/domain/` (D-18). */
export type FilterOption = FilterOptionsResponse['clients'][number]

interface MultiSelectProps {
  label: string
  options: readonly FilterOption[]
  selected: readonly string[]
  onToggle: (value: string) => void
}

/**
 * Acima disto, rolar a lista custa mais que digitar.
 *
 * Medido na planilha real em 07/08/2026: **509** clientes, 217 mercadorias, 70
 * navios, 35 agentes, 26 importadores — contra 6 portos, 4 categorias, 4
 * responsaveis e 3 canais. O limiar separa exatamente os dois grupos, e nenhum
 * valor real fica na fronteira.
 */
const SEARCH_THRESHOLD = 12

function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Um dos nove filtros de multipla escolha. Cada valor marcado entra em **OU**
 * com os demais do mesmo filtro, e o conjunto entra em **E** com os outros
 * filtros — a combinacao acontece no servidor, aqui so se marca.
 *
 * A contagem ao lado de cada valor vem da rota e e sobre o **conjunto
 * completo**, nao sobre o ja filtrado: ela responde "quantos existem", nao
 * "quantos sobrariam". Recalcular por selecao exigiria uma requisicao por
 * clique, e a pergunta que o operador faz ao abrir a lista e a primeira.
 */
export function MultiSelect({ label, options, selected, onToggle }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const visible = useMemo(() => {
    if (search === '') return options
    const needle = foldForSearch(search)
    return options.filter((option) => foldForSearch(option.label).includes(needle))
  }, [options, search])

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-sm ${
          selected.length > 0
            ? 'border-action-bg bg-action-bg text-action-fg'
            : 'border-border-control bg-surface-raised text-text-secondary hover:border-border-strong'
        }`}
      >
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs opacity-80">
          {selected.length > 0 ? selected.length : '▾'}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute z-10 mt-1 max-h-72 w-64 overflow-auto rounded border border-border-subtle bg-surface-raised p-2 shadow-lg"
        >
          {options.length > SEARCH_THRESHOLD && (
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar em ${label.toLowerCase()}`}
              aria-label={`Buscar em ${label}`}
              className="mb-2 w-full rounded border border-border-control px-2 py-1 text-sm"
            />
          )}

          {visible.length === 0 ? (
            <p className="px-1 py-2 text-sm text-text-muted">Nenhum valor corresponde.</p>
          ) : (
            <ul>
              {visible.map((option) => (
                <li key={option.key}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-base">
                    <input
                      type="checkbox"
                      checked={selected.includes(option.key)}
                      onChange={() => onToggle(option.key)}
                    />
                    {/* Chave vazia e valor legitimo do dominio — celula em
                        branco na planilha —, e precisa de rotulo proprio para
                        nao virar uma linha invisivel na lista. */}
                    <span className="grow truncate">
                      {option.label === '' ? '(em branco)' : option.label}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">{option.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
