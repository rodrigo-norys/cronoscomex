import { useEffect, useRef } from 'react'
import type { FilterOptionsResponse } from '../api-client.ts'
import {
  type Filters,
  MULTI_FILTER_LABELS,
  type MultiFilterKey,
  type OutsideRjSelection,
} from '../hooks/useFilters.ts'
import { type FilterOption, MultiSelect } from './MultiSelect.tsx'

/**
 * Os quatorze filtros globais em coluna, num dialogo modal sobreposto (`H-82`,
 * `D-30`).
 *
 * Substitui a forma de `H-60` — treze chips, cada um com popover proprio. O que
 * mudou nao foi defeito daquela: foi o criterio, depois de quatro formas
 * desenhadas e comparadas na tela inteira.
 *
 * **Ele nao filtra nada.** A URL segue sendo o unico estado (`useFilters.ts`), e
 * o recorte acontece no servidor, antes do calculo (regra inviolavel 6).
 *
 * **Modal de verdade, e nao um popover grande** — a quarta determinacao de
 * `D-30`. Foco preso, `Esc` fecha, o resto da tela e inerte, e o foco volta para
 * o gatilho. **Este e o primeiro modal do conjunto com teste**: o
 * `ConflictDialog` so abre com a planilha alterada durante a sessao, e por isso
 * a gestao de foco dele segue parada em `PD-07`.
 *
 * **O veu cobre a regiao de CONTEUDO, nao a tela** (terceira determinacao). Por
 * isso ele e `absolute` num contexto que a casca cria, e nao `fixed inset-0`
 * como o `ConflictDialog`: cobrir a barra de topo esconderia `Aplicar
 * alteracoes`, que e a acao que grava no arquivo do operador.
 *
 * **Alterar aqui nao fecha.** Filtrar e observar o efeito, e o efeito acontece
 * atras do painel — na contagem da barra e nos numeros da pagina.
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
 *
 * **Exportado porque a barra resume o que este painel controla**, e duas listas
 * divergiriam no primeiro filtro acrescentado.
 */
export const MULTI_CONTROLS: readonly MultiControl[] = [
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

export const OUTSIDE_RJ_LABELS: Readonly<Record<Exclude<OutsideRjSelection, ''>, string>> = {
  true: 'Sim',
  false: 'Não',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FilterPanelProps {
  filters: Filters
  options: FilterOptionsResponse | null
  optionsError: string | null
  onClose: () => void
}

export function FilterPanel({ filters, options, optionsError, onClose }: FilterPanelProps) {
  const { selection } = filters
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  /**
   * O foco entra no TITULO, e nao no primeiro controle. Entrar num campo faz o
   * leitor de tela anunciar o campo sem dizer onde ele esta; o titulo e o nome
   * acessivel do dialogo, e ele responde as duas coisas. `tabIndex={-1}` nao
   * acrescenta parada de tabulacao.
   */
  useEffect(() => {
    heading.current?.focus()
  }, [])

  /**
   * `Esc` fecha, e `Tab` circula DENTRO do painel.
   *
   * A prisao e manual porque `inert` no restante nao basta sozinho: ele tira os
   * irmaos da ordem de tabulacao, mas a barra de endereco e a interface do
   * navegador continuam depois do ultimo elemento — e o operador que passa
   * daquele ponto perde o painel de vista sem que nada o traga de volta.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const alvos = panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!alvos || alvos.length === 0) return

      const primeiro = alvos[0]
      const ultimo = alvos[alvos.length - 1]
      if (primeiro === undefined || ultimo === undefined) return

      // O titulo tem `tabIndex={-1}` e nao entra na lista: com o foco nele,
      // `Tab` sem esta guarda sairia do painel na primeira tecla.
      if (!event.shiftKey && (document.activeElement === ultimo || panel.current === null)) {
        event.preventDefault()
        primeiro.focus()
        return
      }
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
        return
      }
      if (document.activeElement === heading.current) {
        event.preventDefault()
        ;(event.shiftKey ? ultimo : primeiro).focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      {/*
        `absolute`, e nao `fixed`: o veu cobre a regiao de conteudo que a casca
        delimita (terceira determinacao de `D-30`). Sob `forced-colors: active` o
        `overlay-scrim` some — cor de autor e descartada —, e o que separa o
        painel do fundo passa a ser a borda dele, pelo mesmo argumento que
        `border-modal` resolveu em `H-62`.
      */}
      <div
        className="absolute inset-0 z-40 bg-overlay-scrim"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filtros-titulo"
        /*
          `w-full` com teto de 20rem: a 320 px o painel ocupa a largura util e a
          pagina nao rola na horizontal (`SC 1.4.10`, `VN-1`) — o defeito que
          `H-65` mediu nos popovers de largura fixa, onde 6 dos 13 empurravam a
          pagina para fora.
        */
        className="motion-surface absolute top-0 right-0 bottom-0 z-50 flex w-full max-w-80 flex-col border-l border-border-modal bg-surface-raised"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2
            id="filtros-titulo"
            ref={heading}
            tabIndex={-1}
            className="text-base font-semibold text-text-primary"
          >
            Filtros
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control px-2 py-1 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            Fechar
          </button>
        </div>

        {/* A regiao existe desde a montagem (`H-43`). Vazia, e `sr-only`: o
            criterio nao e ausencia do no, e ausencia de caixa vazia na tela. */}
        <p
          role="alert"
          className={
            optionsError === null
              ? 'sr-only'
              : 'mx-4 mt-3 rounded-container border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg'
          }
        >
          {optionsError !== null &&
            `Não foi possível carregar as opções de filtro: ${optionsError}`}
        </p>

        {/* A rolagem e do CORPO, nao do painel inteiro: o titulo e o rodape com
            "Limpar" ficam alcancaveis com a lista longa aberta. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
          {MULTI_CONTROLS.map((control) => {
            const disponiveis = (options?.[control.source] ?? []) as readonly FilterOption[]
            return (
              <section key={control.key} aria-label={MULTI_FILTER_LABELS[control.key]}>
                <h3 className="mb-1 text-xs font-medium text-text-secondary">
                  {MULTI_FILTER_LABELS[control.key]}
                </h3>
                {/* `max-h` por controle, e nao no painel: sao 509 clientes
                    medidos em 07/08/2026, e sem teto proprio a lista de um
                    filtro empurraria os outros treze para fora do alcance. */}
                <div className="max-h-56 overflow-y-auto rounded-container border border-border-subtle p-2">
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
                </div>
              </section>
            )
          })}

          {/* Periodo e UM filtro que ocupa dois parametros. `etaFrom` posterior a
              `etaTo` produz conjunto vazio, sem erro: o intervalo simplesmente
              nao contem nada, e recusar exigiria adivinhar qual o operador quis. */}
          <section aria-label="Período (ETA2)">
            <h3 className="mb-1 text-xs font-medium text-text-secondary">Período (ETA2)</h3>
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
          </section>

          {/* Tres estados, nao uma caixa de marcar: "Não" inclui apenas `false`,
              nunca `null`. Cor nao reconhecida nao e o mesmo que "dentro do RJ",
              e uma caixa de dois estados nao teria como dizer isso. */}
          <section aria-label="Importador fora do RJ">
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
          </section>
        </div>
      </div>
    </>
  )
}
