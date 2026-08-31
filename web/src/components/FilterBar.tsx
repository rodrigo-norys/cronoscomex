import type { FilterOptionsResponse } from '../api-client.ts'
import type { Filters, MultiFilterKey } from '../hooks/useFilters.ts'
import { MultiSelect } from './MultiSelect.tsx'

/**
 * Os treze filtros globais, em uma barra que vive na casca e vale para todas as
 * paginas de dado (RF-17, RF-18).
 *
 * Sao doze controles: `clientGroup` (`H-55`) nao tem caixa propria — ele vive
 * DENTRO do controle de Cliente, como o primeiro nivel da arvore.
 *
 * Ela **nao filtra nada**: escreve a selecao na URL, e as paginas anexam a
 * query as proprias requisicoes. O recorte acontece no servidor, antes do
 * calculo — nenhum indicador e recalculado no cliente (regra inviolavel 6).
 */

interface MultiControl {
  readonly key: MultiFilterKey
  readonly label: string
  readonly source: keyof FilterOptionsResponse
}

/**
 * Os dez de multipla escolha. Ordem: quem o operador usa mais, primeiro.
 *
 * "Cliente" e "Processo do cliente" sao controles distintos porque sao
 * perguntas distintas (`H-49`): um recorta a carteira, o outro acha um processo
 * especifico pelo valor da celula CLT.
 */
const MULTI_CONTROLS: readonly MultiControl[] = [
  { key: 'category', label: 'Categoria', source: 'categories' },
  { key: 'client', label: 'Cliente', source: 'clients' },
  { key: 'clientProcess', label: 'Processo do cliente', source: 'clientProcesses' },
  { key: 'importer', label: 'Importador', source: 'importers' },
  { key: 'responsible', label: 'Responsável', source: 'responsible' },
  { key: 'channel', label: 'Canal', source: 'channels' },
  { key: 'vessel', label: 'Navio', source: 'vessels' },
  { key: 'agent', label: 'Agente', source: 'agents' },
  { key: 'port', label: 'Porto', source: 'ports' },
  { key: 'goods', label: 'Mercadoria', source: 'goods' },
]

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
      className="border-t border-border-subtle bg-surface-sunken px-6 py-3"
    >
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Filtros</h2>
        {activeCount > 0 && (
          <>
            <span className="rounded-full bg-action-bg px-2 py-0.5 text-xs text-action-fg">
              {activeCount} {activeCount === 1 ? 'ativo' : 'ativos'}
            </span>
            <button
              type="button"
              onClick={filters.clearAll}
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              Limpar
            </button>
          </>
        )}
      </div>

      {optionsError && (
        <p
          role="alert"
          className="mb-2 rounded border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg"
        >
          Não foi possível carregar as opções de filtro: {optionsError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MULTI_CONTROLS.map((control) => (
          <MultiSelect
            key={control.key}
            label={control.label}
            options={options?.[control.source] ?? []}
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
        ))}

        {/* Periodo e UM filtro que ocupa dois parametros. `etaFrom` posterior a
            `etaTo` produz conjunto vazio, sem erro: o intervalo simplesmente
            nao contem nada, e recusar exigiria adivinhar qual o operador quis. */}
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          ETA2 de
          <input
            type="date"
            value={selection.etaFrom}
            onChange={(event) => filters.setRange('etaFrom', event.target.value)}
            className="rounded border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          ETA2 até
          <input
            type="date"
            value={selection.etaTo}
            onChange={(event) => filters.setRange('etaTo', event.target.value)}
            className="rounded border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
          />
        </label>

        {/* Tres estados, nao uma caixa de marcar: "Não" inclui apenas `false`,
            nunca `null`. Cor nao reconhecida nao e o mesmo que "dentro do RJ", e
            uma caixa de dois estados nao teria como dizer isso. */}
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Importador fora do RJ
          <select
            value={selection.importerOutsideRj}
            onChange={(event) =>
              filters.setImporterOutsideRj(event.target.value as typeof selection.importerOutsideRj)
            }
            className="rounded border border-border-control bg-surface-raised px-2 py-1 text-sm text-text-primary"
          >
            <option value="">Indiferente</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </label>
      </div>
    </section>
  )
}
