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
 * **Desde `H-92` o recorte e uma lista de FICHAS, e nao uma frase.** Cada valor
 * marcado e uma ficha com `x`, que o descarta sem abrir o painel, e o numero do
 * gatilho conta VALORES — dois clientes sao dois. O operador confere o numero
 * contando o que ve.
 *
 * **As fichas nao sao os chips que `D-30` removeu, e a diferenca e o verbo.**
 * La cada chip era o GATILHO de um filtro e abria um popover: eram treze fixos,
 * `H-60` mediu 1437 px contra 1064 disponiveis, e `H-65` mediu seis popovers
 * empurrando a pagina para fora a 320 px (`VN-1`). Aqui a ficha nao abre nada —
 * `x` descarta —, e o teto abaixo impede a multiplicidade que matou aquela.
 *
 * **Nenhuma ficha ignora `clientGroup`** (`H-55`): ele conta como filtro, nao
 * tem controle proprio — vive dentro do de Cliente — e produz ficha como os
 * demais.
 */

/** Acima disto as fichas nao cabem em uma linha a 1280 px: o resto vira uma
    ficha de contagem que abre o painel. */
const FICHAS_MAXIMO = 4

/**
 * O rotulo de um valor marcado.
 *
 * Vem da OPCAO, e nao da chave: a chave e normalizada, e uma ficha dizendo
 * `ACME LOG` quando a celula diz `Acme Logística` faria o operador duvidar do
 * recorte. Chave sem opcao correspondente cai na propria chave — acontece
 * quando o endereco e digitado a mao.
 */
function labelOfValue(value: string, options: readonly FilterOption[]): string {
  const label = options.find((candidate) => candidate.key === value)?.label ?? value
  return label === '' ? '(em branco)' : label
}

/** Periodo e UM filtro que ocupa dois parametros, e a ficha mostra o intervalo. */
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
 * Uma ficha por VALOR marcado, na ordem do painel.
 *
 * `clientGroup` entra logo depois de Cliente, apesar de nao ter controle
 * proprio: ele conta como filtro (`H-55`), e uma lista que o ignorasse mostraria
 * no gatilho um numero maior que a quantidade de fichas.
 *
 * `remove` fecha sobre a acao que ja existia — `toggle` tira UM valor e preserva
 * os outros do mesmo filtro, que e exatamente o que o `x` promete.
 */
interface ActiveChip {
  readonly id: string
  readonly label: string
  readonly filterLabel: string
  readonly remove: () => void
}

function activeChips(
  filters: Filters,
  options: FilterOptionsResponse | null,
): readonly ActiveChip[] {
  const { selection } = filters
  const fichas: ActiveChip[] = []

  const push = (key: MultiFilterKey, disponiveis: readonly FilterOption[]): void => {
    for (const value of selection.multi[key]) {
      fichas.push({
        id: `${key}:${value}`,
        label: labelOfValue(value, disponiveis),
        filterLabel: MULTI_FILTER_LABELS[key],
        remove: () => filters.toggle(key, value),
      })
    }
  }

  for (const control of MULTI_CONTROLS) {
    push(control.key, (options?.[control.source] ?? []) as readonly FilterOption[])
    if (control.key === 'client') push('clientGroup', options?.clientGroups ?? [])
  }

  const periodo = summaryOfPeriod(selection.etaFrom, selection.etaTo)
  if (periodo !== null) {
    fichas.push({
      id: 'period',
      label: periodo,
      filterLabel: 'Período (ETA2)',
      remove: () => filters.setPeriod('', ''),
    })
  }

  if (selection.importerOutsideRj !== '') {
    fichas.push({
      id: 'outsideRj',
      label: OUTSIDE_RJ_LABELS[selection.importerOutsideRj],
      filterLabel: 'Importador fora do RJ',
      remove: () => filters.setImporterOutsideRj(''),
    })
  }

  return fichas
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
  const { activeValueCount } = filters
  const fichas = activeChips(filters, options)
  const visiveis = fichas.slice(0, FICHAS_MAXIMO)
  const excedente = fichas.length - visiveis.length

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
          activeValueCount === 0
            ? 'Filtros'
            : `Filtros, ${activeValueCount} ${activeValueCount === 1 ? 'ativo' : 'ativos'}`
        }
        className={`motion-tint flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1 text-sm ${
          activeValueCount > 0
            ? 'border-action-bg bg-action-soft text-text-primary forced-colors:border-2'
            : 'border-border-control bg-surface-raised text-text-secondary hover:bg-surface-hover'
        }`}
      >
        <span>Filtros</span>
        {activeValueCount > 0 && (
          <span className="rounded-control bg-action-bg px-1.5 text-xs text-action-fg">
            {activeValueCount}
          </span>
        )}
      </button>

      {/* `min-w-0 flex-1` mantem o `Limpar N` encostado a direita mesmo sem
          ficha nenhuma, e faz o nome longo ceder no `truncate` da ficha em vez
          de estourar a linha — o valor inteiro continua no `title`. */}
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {visiveis.map((ficha) => (
          <li key={ficha.id}>
            <button
              type="button"
              onClick={ficha.remove}
              title={`${ficha.filterLabel}: ${ficha.label}`}
              /* Nome acessivel EXPLICITO, pelo mesmo motivo do gatilho: o `gap`
                 e espaco visual, nao textual, e o `x` e decorativo. Sem isto o
                 leitor anuncia "AV×" e nao diz o que o clique faz. */
              aria-label={`Remover filtro ${ficha.filterLabel}: ${ficha.label}`}
              className="motion-tint flex max-w-56 items-center gap-1 rounded-control border border-action-bg bg-action-soft px-2 py-0.5 text-sm text-text-primary forced-colors:border-2"
            >
              <span className="truncate">{ficha.label}</span>
              <span aria-hidden="true" className="text-text-secondary">
                ×
              </span>
            </button>
          </li>
        ))}

        {excedente > 0 && (
          <li>
            <button
              type="button"
              onClick={onOpenPanel}
              aria-label={`e mais ${excedente} — abrir o painel de filtros`}
              className="motion-tint rounded-control border border-border-control bg-surface-raised px-2 py-0.5 text-sm text-text-secondary hover:bg-surface-hover"
            >
              e mais {excedente}
            </button>
          </li>
        )}
      </ul>

      {activeValueCount > 0 && (
        <button
          type="button"
          onClick={filters.clearAll}
          /* Pele de CONTROLE, e nao de link. Sublinhado sem borda lia como link,
             e o que ele faz e descartar o recorte inteiro — a mesma pele do
             gatilho em repouso, porque o papel e o mesmo: acao secundaria da
             barra. O icone se soma ao rotulo e nunca o substitui (`SC 1.4.1`),
             como em `NavIcon`. */
          className="motion-tint flex shrink-0 items-center gap-1.5 rounded-control border border-border-control bg-surface-raised px-2.5 py-1 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            {/* Borracha inclinada sobre a linha que ela limpa. */}
            <path
              d="M9.1 3.1 3.1 9.1a1.5 1.5 0 0 0 0 2.1l1.7 1.7a1.5 1.5 0 0 0 2.1 0l6-6a1.5 1.5 0 0 0 0-2.1l-1.7-1.7a1.5 1.5 0 0 0-2.1 0Z"
              strokeLinejoin="round"
            />
            <path d="m6.1 6.1 3.8 3.8" />
            <path d="M7.5 13.5h6" />
          </svg>
          Limpar {activeValueCount}
        </button>
      )}
    </section>
  )
}
