import type { RefObject } from 'react'
import type { FilterOptionsResponse } from '../api-client.ts'
import { type Filters, MULTI_FILTER_LABELS, type MultiFilterKey } from '../hooks/useFilters.ts'
import { MULTI_CONTROLS, OUTSIDE_RJ_LABELS } from './FilterPanel.tsx'
import type { FilterOption } from './MultiSelect.tsx'

/**
 * UMA linha que **descreve** o recorte, com o gatilho do painel (`H-82`, `D-30`).
 *
 * Ate `H-60` ela era treze chips, cada um dizendo o proprio recorte; agora diz o
 * recorte inteiro numa frase e delega os controles ao `FilterPanel`. O que se
 * ganha e a linha: treze chips ocupavam de uma a tres, conforme a largura.
 *
 * **Ela nao filtra nada** — nem antes filtrava. A URL e o unico estado
 * (`useFilters.ts`), e o recorte acontece no servidor (regra inviolavel 6).
 *
 * **O resumo nao pode divergir de `activeCount`.** Sao QUATORZE filtros, e nao
 * treze: `clientGroup` (`H-55`) conta como filtro e nao tem controle proprio —
 * ele vive dentro do de Cliente, como primeiro nivel da arvore. Uma frase que o
 * ignorasse mostraria "2 filtros" no botao e nomearia um.
 */

/** Acima disto a frase nao cabe em 1280 px: os demais viram contagem. */
const RESUMO_MAXIMO = 2

/**
 * O que um filtro de multipla escolha diz na frase.
 *
 * Um valor vira o ROTULO dele, e nao a chave: a chave e normalizada, e um resumo
 * dizendo `ACME LOG` quando a celula diz `Acme Logística` faria o operador
 * duvidar do recorte. Chave sem opcao correspondente cai na propria chave —
 * acontece quando o endereco e digitado a mao.
 *
 * De dois valores em diante vira contagem: listar quatro clientes ocuparia a
 * linha que esta fatia existe para liberar.
 */
function summaryOfMulti(
  selected: readonly string[],
  options: readonly FilterOption[],
): string | null {
  if (selected.length === 0) return null
  if (selected.length > 1) return `${selected.length} valores`

  const only = selected[0] ?? ''
  const label = options.find((candidate) => candidate.key === only)?.label ?? only
  return label === '' ? '(em branco)' : label
}

/** Periodo e UM filtro que ocupa dois parametros, e o resumo mostra o intervalo. */
function summaryOfPeriod(from: string, to: string): string | null {
  if (from === '' && to === '') return null
  if (from !== '' && to !== '') return `${formatDay(from)} a ${formatDay(to)}`
  return from !== '' ? `desde ${formatDay(from)}` : `até ${formatDay(to)}`
}

function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Cada filtro ativo como "Rotulo: valor", na ordem do painel.
 *
 * O comprimento desta lista e o que a frase resume, e ele precisa bater com
 * `activeCount` — por isso `clientGroup` entra logo depois de Cliente, apesar de
 * nao ter controle proprio.
 */
function activeDescriptions(
  filters: Filters,
  options: FilterOptionsResponse | null,
): readonly string[] {
  const { selection } = filters
  const descricoes: string[] = []

  const push = (key: MultiFilterKey, disponiveis: readonly FilterOption[]): void => {
    const resumo = summaryOfMulti(selection.multi[key], disponiveis)
    if (resumo !== null) descricoes.push(`${MULTI_FILTER_LABELS[key]}: ${resumo}`)
  }

  for (const control of MULTI_CONTROLS) {
    push(control.key, (options?.[control.source] ?? []) as readonly FilterOption[])
    if (control.key === 'client') push('clientGroup', options?.clientGroups ?? [])
  }

  const periodo = summaryOfPeriod(selection.etaFrom, selection.etaTo)
  if (periodo !== null) descricoes.push(`Período (ETA2): ${periodo}`)

  if (selection.importerOutsideRj !== '') {
    descricoes.push(`Importador fora do RJ: ${OUTSIDE_RJ_LABELS[selection.importerOutsideRj]}`)
  }

  return descricoes
}

/**
 * A frase inteira, ja com o teto aplicado.
 *
 * O corte e por FILTRO, nunca por caractere: truncar no meio de um valor diria
 * "Cliente: Acme Log…" e deixaria o operador sem saber se ha mais de um Acme.
 */
function summarySentence(descricoes: readonly string[]): string {
  if (descricoes.length === 0) return 'Todos os processos, sem recorte'

  const primeiros = descricoes.slice(0, RESUMO_MAXIMO).join(' · ')
  const restantes = descricoes.length - RESUMO_MAXIMO
  return restantes > 0 ? `${primeiros} · e mais ${restantes}` : primeiros
}

interface FilterBarProps {
  filters: Filters
  options: FilterOptionsResponse | null
  panelOpen: boolean
  /** A casca detem o gatilho para devolver o foco a ele ao fechar (`SC 2.4.3`). */
  triggerRef: RefObject<HTMLButtonElement | null>
  onOpenPanel: () => void
}

export function FilterBar({
  filters,
  options,
  panelOpen,
  triggerRef,
  onOpenPanel,
}: FilterBarProps) {
  const { activeCount } = filters
  const descricoes = activeDescriptions(filters, options)

  return (
    <section
      aria-label="Filtros"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle bg-surface-sunken px-6 py-2"
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpenPanel}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        /*
          Nome acessivel EXPLICITO, e nao o texto concatenado dos filhos: o `gap`
          do flex e espaco visual, nao textual, e sem isto o leitor de tela
          anuncia "Filtros14". Medido no chip de `H-60`, pelo mesmo motivo.
        */
        aria-label={
          activeCount === 0
            ? 'Filtros'
            : `Filtros, ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`
        }
        className={`motion-tint flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1 text-sm ${
          activeCount > 0
            ? 'border-action-bg bg-action-soft text-text-primary forced-colors:border-2'
            : 'border-border-control bg-surface-raised text-text-secondary hover:bg-surface-hover'
        }`}
      >
        <span>Filtros</span>
        {activeCount > 0 && (
          <span className="rounded-control bg-action-bg px-1.5 text-xs text-action-fg">
            {activeCount}
          </span>
        )}
      </button>

      {/* `truncate` com `min-w-0`: a frase ja vem com teto por filtro, e isto
          cobre o caso do valor unico muito longo — o nome inteiro continua no
          `title`, entao nada e cortado em silencio. */}
      <p
        title={descricoes.length > 0 ? descricoes.join(' · ') : undefined}
        className="min-w-0 flex-1 truncate text-sm text-text-secondary"
      >
        {summarySentence(descricoes)}
      </p>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={filters.clearAll}
          className="shrink-0 rounded-control px-2 py-1 text-sm text-text-secondary underline hover:text-text-primary"
        >
          Limpar {activeCount}
        </button>
      )}
    </section>
  )
}
