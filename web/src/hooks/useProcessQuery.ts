import { useCallback, useMemo } from 'react'
import { replaceQuery, useQuery } from '../router.ts'

/**
 * Os parametros **da Pagina Operacional**: busca, ativos, ordenacao e pagina.
 *
 * Vivem na URL pelo mesmo motivo dos treze filtros globais — recarregar
 * preserva, e um endereco descreve o que a tela mostra. Sao separados dos
 * filtros de proposito: `useFilters().clearAll` apaga so os onze, porque
 * limpar filtro nao e limpar a busca nem voltar para a primeira pagina.
 */

export type SortField = 'ref' | 'eta2' | 'registrationDate' | 'client' | 'vessel'
export type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: readonly SortField[] = ['ref', 'eta2', 'registrationDate', 'client', 'vessel']

export const PAGE_SIZE = 200

export interface ProcessQuery {
  readonly search: string
  /**
   * **`true` por padrao aqui**, ao contrario da rota, onde o padrao e `false`.
   * A Pagina Operacional lista "processos ativos" (A-16); a rota serve tambem
   * `H-22`, que precisa achar qualquer processo pela REF.
   */
  readonly activeOnly: boolean
  readonly sort: SortField
  readonly order: SortOrder
  readonly offset: number
  /** O que a pagina anexa a requisicao: os treze filtros **mais** estes. */
  readonly requestQuery: string
  setSearch(value: string): void
  setActiveOnly(value: boolean): void
  /** Alterna a direcao quando e a mesma coluna; comeca em `asc` numa nova. */
  toggleSort(field: SortField): void
  setOffset(value: number): void
}

function readSort(raw: string | null): SortField {
  return raw !== null && (SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as SortField)
    : 'eta2'
}

export function useProcessQuery(): ProcessQuery {
  const query = useQuery()

  const search = query.get('search') ?? ''
  const activeOnly = query.get('activeOnly') !== 'false'
  const sort = readSort(query.get('sort'))
  const order: SortOrder = query.get('order') === 'desc' ? 'desc' : 'asc'
  const offsetRaw = Number(query.get('offset') ?? '0')
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams(query)
    // O padrao da PAGINA e `true`, e o da ROTA e `false`: sem escrever o valor
    // explicitamente, uma URL sem o parametro traria os desembaracados.
    params.set('activeOnly', String(activeOnly))
    params.set('sort', sort)
    params.set('order', order)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    if (search === '') params.delete('search')

    return `?${params.toString()}`
  }, [query, search, activeOnly, sort, order, offset])

  const write = useCallback(
    (mutate: (draft: URLSearchParams) => void): void => {
      const draft = new URLSearchParams(query)
      mutate(draft)
      const text = draft.toString()
      replaceQuery(text === '' ? '' : `?${text}`)
    },
    [query],
  )

  // Mudar busca, recorte ou ordenacao volta para a primeira pagina: manter o
  // `offset` mostraria a pagina 4 de um conjunto que agora tem duas.
  const setSearch = useCallback(
    (value: string): void => {
      write((draft) => {
        if (value === '') draft.delete('search')
        else draft.set('search', value)
        draft.delete('offset')
      })
    },
    [write],
  )

  const setActiveOnly = useCallback(
    (value: boolean): void => {
      write((draft) => {
        if (value) draft.delete('activeOnly')
        else draft.set('activeOnly', 'false')
        draft.delete('offset')
      })
    },
    [write],
  )

  const toggleSort = useCallback(
    (field: SortField): void => {
      write((draft) => {
        const sameColumn = field === sort
        draft.set('sort', field)
        draft.set('order', sameColumn && order === 'asc' ? 'desc' : 'asc')
        draft.delete('offset')
      })
    },
    [write, sort, order],
  )

  const setOffset = useCallback(
    (value: number): void => {
      write((draft) => {
        if (value <= 0) draft.delete('offset')
        else draft.set('offset', String(value))
      })
    },
    [write],
  )

  return {
    search,
    activeOnly,
    sort,
    order,
    offset,
    requestQuery,
    setSearch,
    setActiveOnly,
    toggleSort,
    setOffset,
  }
}
