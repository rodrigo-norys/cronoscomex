import type { FilterOptionsResponse } from '../api-client.ts'
import {
  type Filters,
  MULTI_FILTER_LABELS,
  type MultiFilterKey,
  type OutsideRjSelection,
} from '../hooks/useFilters.ts'
import { FilterChip } from './FilterChip.tsx'
import { type FilterOption, MultiSelect } from './MultiSelect.tsx'

/**
 * Os quatorze filtros globais, em UMA linha de chips (`H-60`, `D-22`).
 *
 * Eram treze controles sempre abertos, numa faixa de duas a seis colunas; agora
 * cada filtro e um chip que diz o proprio recorte e abre o resto em popover. O
 * recorte ativo continua visivel **sem abrir nada** — e o que separa esta forma
 * de simplesmente esconder o filtro.
 *
 * Sao treze chips: `clientGroup` (`H-55`) nao tem chip proprio — ele vive DENTRO
 * do de Cliente, como o primeiro nivel da arvore.
 *
 * Ela **nao filtra nada**: escreve a selecao na URL, e as paginas anexam a
 * query as proprias requisicoes. O recorte acontece no servidor, antes do
 * calculo — nenhum indicador e recalculado no cliente (regra inviolavel 6).
 */

interface MultiControl {
  readonly key: MultiFilterKey
  readonly source: keyof FilterOptionsResponse
}

/**
 * Os onze de multipla escolha. Ordem: quem o operador usa mais, primeiro.
 *
 * "Cliente" e "Processo do cliente" sao controles distintos porque sao
 * perguntas distintas (`H-49`): um recorta a carteira, o outro acha um processo
 * especifico pelo valor da celula CLT. "Responsavel" e "Cor do responsavel"
 * tambem (`H-50`): um diz quem responde, o outro o que a linha esta pintada.
 */
const MULTI_CONTROLS: readonly MultiControl[] = [
  { key: 'category', source: 'categories' },
  { key: 'client', source: 'clients' },
  { key: 'clientProcess', source: 'clientProcesses' },
  { key: 'importer', source: 'importers' },
  { key: 'responsible', source: 'responsible' },
  { key: 'colorResponsible', source: 'colorResponsible' },
  { key: 'channel', source: 'channels' },
  { key: 'vessel', source: 'vessels' },
  { key: 'agent', source: 'agents' },
  { key: 'port', source: 'ports' },
  { key: 'goods', source: 'goods' },
]

const OUTSIDE_RJ_LABELS: Readonly<Record<Exclude<OutsideRjSelection, ''>, string>> = {
  true: 'Sim',
  false: 'Não',
}

/**
 * O que o chip diz sem ser aberto.
 *
 * Um valor vira o ROTULO dele, e nao a chave: a chave e normalizada, e um chip
 * dizendo `ACME LOG` quando a celula diz `Acme Logística` faria o operador
 * duvidar do recorte. Chave sem opcao correspondente cai na propria chave —
 * acontece quando o endereco e digitado a mao.
 *
 * De dois valores em diante vira contagem: listar quatro clientes num chip
 * ocuparia a linha que esta fatia inteira existe para liberar.
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

interface FilterBarProps {
  filters: Filters
  options: FilterOptionsResponse | null
  optionsError: string | null
}

export function FilterBar({ filters, options, optionsError }: FilterBarProps) {
  const { selection, activeCount } = filters

  return (
    <section
      aria-label="Filtros"
      className="border-b border-border-subtle bg-surface-sunken px-6 py-2"
    >
      {/* A regiao existe desde a montagem (`H-43`). Vazia, e `sr-only`: o
          criterio nao e ausencia do no, e ausencia de caixa vazia na tela. */}
      <p
        role="alert"
        className={
          optionsError === null
            ? 'sr-only'
            : 'mb-2 rounded-container border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg'
        }
      >
        {optionsError !== null && `Não foi possível carregar as opções de filtro: ${optionsError}`}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {MULTI_CONTROLS.map((control) => {
          const disponiveis = (options?.[control.source] ?? []) as readonly FilterOption[]
          return (
            <FilterChip
              key={control.key}
              label={MULTI_FILTER_LABELS[control.key]}
              summary={summaryOfMulti(selection.multi[control.key], disponiveis)}
            >
              <MultiSelect
                label={MULTI_FILTER_LABELS[control.key]}
                options={disponiveis}
                selected={selection.multi[control.key]}
                onToggle={(value) => filters.toggle(control.key, value)}
                {...(control.key === 'client'
                  ? {
                      groups: options?.clientGroups ?? [],
                      selectedGroups: selection.multi.clientGroup,
                      onToggleGroup: (value: string) => filters.toggle('clientGroup', value),
                    }
                  : {})}
              />
            </FilterChip>
          )
        })}

        {/* Periodo e UM filtro que ocupa dois parametros. `etaFrom` posterior a
            `etaTo` produz conjunto vazio, sem erro: o intervalo simplesmente
            nao contem nada, e recusar exigiria adivinhar qual o operador quis. */}
        <FilterChip
          label="Período (ETA2)"
          summary={summaryOfPeriod(selection.etaFrom, selection.etaTo)}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              ETA2 de
              <input
                type="date"
                value={selection.etaFrom}
                onChange={(event) => filters.setRange('etaFrom', event.target.value)}
                className="rounded-control border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              ETA2 até
              <input
                type="date"
                value={selection.etaTo}
                onChange={(event) => filters.setRange('etaTo', event.target.value)}
                className="rounded-control border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
              />
            </label>
          </div>
        </FilterChip>

        {/* Tres estados, nao uma caixa de marcar: "Não" inclui apenas `false`,
            nunca `null`. Cor nao reconhecida nao e o mesmo que "dentro do RJ", e
            uma caixa de dois estados nao teria como dizer isso — nem o chip, que
            por isso exibe o ROTULO do estado, e nao um sinal de marcado. */}
        <FilterChip
          label="Importador fora do RJ"
          summary={
            selection.importerOutsideRj === ''
              ? null
              : OUTSIDE_RJ_LABELS[selection.importerOutsideRj]
          }
        >
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Importador fora do RJ
            <select
              value={selection.importerOutsideRj}
              onChange={(event) =>
                filters.setImporterOutsideRj(event.target.value as OutsideRjSelection)
              }
              className="rounded-control border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
            >
              <option value="">Indiferente</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </label>
        </FilterChip>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={filters.clearAll}
            className="ml-1 rounded-control px-2 py-1 text-sm text-text-secondary underline hover:text-text-primary"
          >
            Limpar {activeCount}
          </button>
        )}
      </div>
    </section>
  )
}
