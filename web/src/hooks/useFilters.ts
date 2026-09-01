import { useCallback, useMemo } from 'react'
import { replaceQuery, useQuery } from '../router.ts'

/**
 * Os quatorze filtros globais (RF-17), com a URL como **unico** estado.
 *
 * Nao ha copia em `useState`: o parametro na URL e a verdade, e o componente
 * deriva dela. Duas fontes divergiriam no primeiro `popstate` — e a URL precisa
 * ser a fonte de qualquer forma, porque um criterio de aceite exige que
 * recarregar a pagina preserve o recorte.
 *
 * O dominio de cada valor e validado **no servidor** (`400 FILTRO_INVALIDO`),
 * nunca aqui: regra de negocio no cliente e o que a regra inviolavel 6 proibe.
 * A barra oferece as opcoes que `GET /api/filters/options` devolveu, entao um
 * valor invalido so aparece se alguem digitar na barra de endereco — e nesse
 * caso o erro do servidor e a resposta correta.
 */

/** Ocupam um parametro cada, com valores repetidos em OU. */
export const MULTI_FILTERS = [
  'client',
  'clientProcess',
  'clientGroup',
  'importer',
  'vessel',
  'agent',
  'goods',
  'category',
  'responsible',
  'colorResponsible',
  'channel',
  'port',
] as const

export type MultiFilterKey = (typeof MULTI_FILTERS)[number]

/**
 * O nome de cada filtro na tela, numa fonte so (`H-53`).
 *
 * Vive aqui, e nao em `FilterBar.tsx`, porque a Pagina Performance passou a
 * declarar **quais** filtros estao recortando os numeros dela — e dois mapas de
 * rotulo divergem no primeiro filtro renomeado. `clientGroup` nao tem caixa
 * propria na barra, mas tem nome, e sem ele o recorte por grupo apareceria sem
 * dizer o que e.
 */
export const MULTI_FILTER_LABELS: Readonly<Record<MultiFilterKey, string>> = {
  category: 'Categoria',
  client: 'Cliente',
  clientProcess: 'Processo do cliente',
  clientGroup: 'Grupo de clientes',
  importer: 'Importador',
  responsible: 'Responsável',
  colorResponsible: 'Cor do responsável',
  channel: 'Canal',
  vessel: 'Navio',
  agent: 'Agente',
  port: 'Porto',
  goods: 'Mercadoria',
}

export type OutsideRjSelection = '' | 'true' | 'false'

export interface FilterSelection {
  /** `AAAA-MM-DD`, vazio quando ausente. Os dois formam UM filtro de periodo. */
  readonly etaFrom: string
  readonly etaTo: string
  readonly importerOutsideRj: OutsideRjSelection
  readonly multi: Readonly<Record<MultiFilterKey, readonly string[]>>
}

export interface Filters {
  readonly selection: FilterSelection
  /** Quantos dos quatorze estao ativos. O periodo conta uma vez, tendo um
   * extremo ou os dois — e um filtro, ainda que ocupe dois parametros. */
  readonly activeCount: number
  /** O que as paginas de `H-16` a `H-22` anexam as proprias requisicoes. */
  readonly queryString: string
  toggle(key: MultiFilterKey, value: string): void
  setRange(field: 'etaFrom' | 'etaTo', value: string): void
  /**
   * Os dois extremos numa escrita so (`H-52`).
   *
   * O seletor da Pagina Inicial escreve os MESMOS parametros que a barra de
   * filtros — um estado so, nunca dois periodos que divergem. Dois `setRange`
   * seguidos escreveriam sobre a mesma leitura de `query` e o segundo perderia o
   * primeiro, porque `write` deriva o rascunho da query capturada no `useMemo`.
   */
  setPeriod(from: string, to: string): void
  setImporterOutsideRj(value: OutsideRjSelection): void
  clearAll(): void
}

function readSelection(query: URLSearchParams): FilterSelection {
  const multi = {} as Record<MultiFilterKey, readonly string[]>
  for (const key of MULTI_FILTERS) multi[key] = query.getAll(key)

  const outsideRj = query.get('importerOutsideRj')
  return {
    etaFrom: query.get('etaFrom') ?? '',
    etaTo: query.get('etaTo') ?? '',
    importerOutsideRj: outsideRj === 'true' || outsideRj === 'false' ? outsideRj : '',
    multi,
  }
}

function countActive(selection: FilterSelection): number {
  const multiActive = MULTI_FILTERS.filter((key) => selection.multi[key].length > 0).length
  const periodActive = selection.etaFrom !== '' || selection.etaTo !== '' ? 1 : 0
  const outsideRjActive = selection.importerOutsideRj !== '' ? 1 : 0
  return multiActive + periodActive + outsideRjActive
}

/** Parametro vazio nunca chega a URL: `?client=` seria "clientes cujo nome e a
 * string vazia", que e chave legitima no dominio, e nao "sem filtro". */
function toSearch(params: URLSearchParams): string {
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

export function useFilters(): Filters {
  const query = useQuery()
  const selection = useMemo(() => readSelection(query), [query])

  const write = useCallback(
    (mutate: (draft: URLSearchParams) => void): void => {
      const draft = new URLSearchParams(query)
      mutate(draft)
      replaceQuery(toSearch(draft))
    },
    [query],
  )

  const toggle = useCallback(
    (key: MultiFilterKey, value: string): void => {
      write((draft) => {
        const current = draft.getAll(key)
        const next = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value]

        draft.delete(key)
        for (const item of next) draft.append(key, item)
      })
    },
    [write],
  )

  const setRange = useCallback(
    (field: 'etaFrom' | 'etaTo', value: string): void => {
      write((draft) => {
        if (value === '') draft.delete(field)
        else draft.set(field, value)
      })
    },
    [write],
  )

  const setPeriod = useCallback(
    (from: string, to: string): void => {
      write((draft) => {
        for (const [field, value] of [
          ['etaFrom', from],
          ['etaTo', to],
        ] as const) {
          if (value === '') draft.delete(field)
          else draft.set(field, value)
        }
      })
    },
    [write],
  )

  const setImporterOutsideRj = useCallback(
    (value: OutsideRjSelection): void => {
      write((draft) => {
        if (value === '') draft.delete('importerOutsideRj')
        else draft.set('importerOutsideRj', value)
      })
    },
    [write],
  )

  // Apaga so os onze: um parametro que nao seja filtro — busca, ordenacao,
  // pagina — pertence a pagina, e limpar filtro nao e limpar a tela dela.
  const clearAll = useCallback((): void => {
    write((draft) => {
      for (const key of MULTI_FILTERS) draft.delete(key)
      draft.delete('etaFrom')
      draft.delete('etaTo')
      draft.delete('importerOutsideRj')
    })
  }, [write])

  return {
    selection,
    activeCount: countActive(selection),
    queryString: toSearch(query),
    toggle,
    setRange,
    setPeriod,
    setImporterOutsideRj,
    clearAll,
  }
}
