import { useCallback, useMemo } from 'react'
import { replaceQuery, useQuery } from '../router.ts'

/**
 * Os parametros **da Pagina Operacional**: busca, recorte, ordenacao, tamanho
 * de pagina e pagina.
 *
 * Vivem na URL pelo mesmo motivo dos quatorze filtros globais — recarregar
 * preserva, e um endereco descreve o que a tela mostra. Sao separados dos
 * filtros de proposito: `useFilters().clearAll` apaga so os onze, porque
 * limpar filtro nao e limpar a busca nem voltar para a primeira pagina.
 */

export type SortField =
  | 'ref'
  | 'client'
  | 'clientProcess'
  | 'importer'
  | 'vessel'
  | 'eta2'
  | 'registrationDate'
  | 'billOfLading'
  | 'container'
  | 'status'
export type SortOrder = 'asc' | 'desc'

/** Espelha `SORT_FIELDS` de `src/domain/process-query.ts`: valor fora da lista
    cai no padrao em vez de chegar a rota e voltar 400. */
const SORT_FIELDS: readonly SortField[] = [
  'ref',
  'client',
  'clientProcess',
  'importer',
  'vessel',
  'eta2',
  'registrationDate',
  'billOfLading',
  'container',
  'status',
]

/**
 * Os quatro tamanhos que o seletor oferece (`D-31`).
 *
 * **`500` e teto, e nao "todas"**: com 649 processos a paginacao nunca
 * desaparece, o rodape tem uma forma so, e o pior caso de renderizacao fica
 * previsivel. `25` foi descartado — com a linha de 40 px de `H-61` ele nao
 * enche uma tela de 1080 px. O teto da ROTA e outro: `MAX_LIMIT` e 1000 em
 * `src/domain/process-query.ts`, entao `500` nunca esbarra nele.
 */
export const PAGE_SIZES = [50, 100, 200, 500] as const
export const DEFAULT_PAGE_SIZE = 200

export interface ProcessQuery {
  readonly search: string
  /**
   * **`false` por padrao desde `D-33`**, o mesmo da rota. A tela abria com os
   * ativos e passou a abrir com todos; `A-16` nao muda — "ativo" continua
   * sendo `categoria != desembaracado`, e o que inverteu foi o recorte padrao
   * da tela, nao a definicao.
   */
  readonly activeOnly: boolean
  readonly sort: SortField
  readonly order: SortOrder
  readonly limit: number
  readonly offset: number
  /** O que a pagina anexa a requisicao: os quatorze filtros **mais** estes. */
  readonly requestQuery: string
  setSearch(value: string): void
  setActiveOnly(value: boolean): void
  /** Alterna a direcao quando e a mesma coluna; comeca em `asc` numa nova. */
  toggleSort(field: SortField): void
  setLimit(value: number): void
  setOffset(value: number): void
}

function readSort(raw: string | null): SortField {
  return raw !== null && (SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as SortField)
    : 'eta2'
}

/**
 * Fora da lista do seletor cai no padrao — **inclusive valor que a rota
 * aceitaria**, como `300`. O seletor tem quatro valores, e o que a tela precisa
 * e conseguir desenhar o que a URL pede. Mesma tolerancia de `readSort` e do
 * `offset`: valor ruim nao vira erro, vira o padrao.
 */
function readLimit(raw: string | null): number {
  const value = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(value) ? value : DEFAULT_PAGE_SIZE
}

export function useProcessQuery(): ProcessQuery {
  const query = useQuery()

  const search = query.get('search') ?? ''
  const activeOnly = query.get('activeOnly') === 'true'
  const sort = readSort(query.get('sort'))
  const order: SortOrder = query.get('order') === 'desc' ? 'desc' : 'asc'
  const limit = readLimit(query.get('limit'))
  const offsetRaw = Number(query.get('offset') ?? '0')
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams(query)
    // Explicito porque a URL guarda so o que difere do padrao: sem escrever o
    // valor, `limit` e `activeOnly` chegariam a rota com o padrao DELA.
    params.set('activeOnly', String(activeOnly))
    params.set('sort', sort)
    params.set('order', order)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    if (search === '') params.delete('search')

    return `?${params.toString()}`
  }, [query, search, activeOnly, sort, order, limit, offset])

  const write = useCallback(
    (mutate: (draft: URLSearchParams) => void): void => {
      const draft = new URLSearchParams(query)
      mutate(draft)
      const text = draft.toString()
      replaceQuery(text === '' ? '' : `?${text}`)
    },
    [query],
  )

  // Mudar busca, recorte, ordenacao ou tamanho volta para a primeira pagina:
  // manter o `offset` mostraria a pagina 4 de um conjunto que agora tem duas.
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
        if (value) draft.set('activeOnly', 'true')
        else draft.delete('activeOnly')
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

  const setLimit = useCallback(
    (value: number): void => {
      write((draft) => {
        if (value === DEFAULT_PAGE_SIZE) draft.delete('limit')
        else draft.set('limit', String(value))
        draft.delete('offset')
      })
    },
    [write],
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
    limit,
    offset,
    requestQuery,
    setSearch,
    setActiveOnly,
    toggleSort,
    setLimit,
    setOffset,
  }
}
