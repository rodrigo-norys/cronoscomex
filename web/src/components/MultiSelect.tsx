import { useMemo, useState } from 'react'
import type { FilterOptionsResponse } from '../api-client.ts'

/** Derivado da resposta da rota, para nao importar de `src/domain/` (D-18). */
export type FilterOption = FilterOptionsResponse['clients'][number]

/** Um grupo e seus membros (`H-55`), como a rota os entrega. */
export type OptionGroup = FilterOptionsResponse['clientGroups'][number]

interface MultiSelectProps {
  label: string
  options: readonly FilterOption[]
  selected: readonly string[]
  onToggle: (value: string) => void
  /**
   * Grupos exibidos ACIMA das opcoes soltas (`H-55`). Ausente ou vazio, a lista
   * e plana como sempre foi.
   *
   * Grupo e membro vao para parametros DIFERENTES — `clientGroup` e `client` —,
   * e por isso cada nivel tem sua selecao e seu manipulador. Marcar o pai nao
   * marca os filhos na URL: o servidor e que sabe quem sao os membros, e
   * expandir aqui poria a regra no cliente (regra inviolavel 6).
   */
  groups?: readonly OptionGroup[]
  selectedGroups?: readonly string[]
  onToggleGroup?: (value: string) => void
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

function matches(option: FilterOption, needle: string): boolean {
  return needle === '' || foldForSearch(option.label).includes(needle)
}

function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * A LISTA de um filtro de multipla escolha. Cada valor marcado entra em **OU**
 * com os demais do mesmo filtro, e o conjunto entra em **E** com os outros
 * filtros — a combinacao acontece no servidor, aqui so se marca.
 *
 * **Ela nao tem gatilho nem caixa proprios.** Ate `H-82` quem abria, fechava e
 * devolvia o foco era o chip de `H-60`; agora ela e uma secao entre catorze
 * dentro do `FilterPanel`, e abrir e fechar acontece uma vez so, para o painel
 * inteiro. O comportamento ja vivera aqui antes de `H-60`, e faltava nos outros
 * dois controles — os campos de data e o seletor de tres estados.
 *
 * A contagem ao lado de cada valor vem da rota e e sobre o **conjunto
 * completo**, nao sobre o ja filtrado: ela responde "quantos existem", nao
 * "quantos sobrariam". Recalcular por selecao exigiria uma requisicao por
 * clique, e a pergunta que o operador faz ao abrir a lista e a primeira.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  groups = [],
  selectedGroups = [],
  onToggleGroup,
}: MultiSelectProps) {
  const [search, setSearch] = useState('')

  // Quem esta num grupo aparece SO embaixo dele: a mesma chave nos dois lugares
  // daria duas caixas para o mesmo cliente, com a mesma contagem.
  const grouped = useMemo(
    () => new Set(groups.flatMap((group) => group.members.map((member) => member.key))),
    [groups],
  )

  const needle = search === '' ? '' : foldForSearch(search)

  const visible = useMemo(
    () => options.filter((option) => !grouped.has(option.key) && matches(option, needle)),
    [options, grouped, needle],
  )

  /** O grupo aparece inteiro quando o rotulo dele casa; senao, so os membros que casam. */
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) =>
          matches(group, needle)
            ? group
            : { ...group, members: group.members.filter((member) => matches(member, needle)) },
        )
        .filter((group) => matches(group, needle) || group.members.length > 0),
    [groups, needle],
  )

  return (
    <>
      {options.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Buscar em ${label.toLowerCase()}`}
          aria-label={`Buscar em ${label}`}
          className="mb-2 w-full rounded-control border border-border-control px-2 py-1 text-sm"
        />
      )}

      {visibleGroups.length > 0 && (
        <ul className="mb-1 border-b border-border-subtle pb-1">
          {visibleGroups.map((group) => (
            <li key={`grupo:${group.key}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded-control px-1 py-1 text-sm font-medium hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.key)}
                  onChange={() => onToggleGroup?.(group.key)}
                />
                <span className="grow truncate">{group.label}</span>
                <span className="shrink-0 text-xs text-text-muted">{group.count}</span>
              </label>
              <ul className="ml-4 border-l border-border-subtle pl-2">
                {group.members.map((member) => (
                  <li key={member.key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-control px-1 py-1 text-sm hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={selected.includes(member.key)}
                        onChange={() => onToggle(member.key)}
                      />
                      <span className="grow truncate">
                        {member.label === '' ? '(em branco)' : member.label}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted">{member.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 && visibleGroups.length === 0 ? (
        <p className="px-1 py-2 text-sm text-text-muted">Nenhum valor corresponde.</p>
      ) : (
        <ul>
          {visible.map((option) => (
            <li key={option.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-control px-1 py-1 text-sm hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={selected.includes(option.key)}
                  onChange={() => onToggle(option.key)}
                />
                {/* Chave vazia e valor legitimo do dominio — celula em branco na
                    planilha —, e precisa de rotulo proprio para nao virar uma
                    linha invisivel na lista. */}
                <span className="grow truncate">
                  {option.label === '' ? '(em branco)' : option.label}
                </span>
                <span className="shrink-0 text-xs text-text-muted">{option.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
