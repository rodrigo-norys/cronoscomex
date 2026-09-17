import { useCallback, useMemo } from 'react'
import { MAX_LIMIT } from '../../../src/domain/process-query.ts'
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
  | 'sourceRow'
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

/**
 * O nome de cada ordem na tela. Mora aqui, e nao em `ProcessTable`, pelo motivo
 * que `MULTI_FILTER_LABELS` ja registra em `useFilters`: dois mapas de rotulo
 * divergem no primeiro renomeado. `COLUMNS` consome este, e o `Record` completo
 * faz de rotulo faltando um erro de tipo.
 *
 * `sourceRow` e o unico sem coluna na tabela — ele nomeia a ordem do arquivo.
 */
export const SORT_LABELS: Readonly<Record<SortField, string>> = {
  sourceRow: 'Ordem da planilha',
  ref: 'REF',
  client: 'Cliente',
  clientProcess: 'Processo do cliente',
  importer: 'Importador',
  vessel: 'Navio',
  eta2: 'ETA2',
  registrationDate: 'Registro (RG)',
  billOfLading: 'BL',
  container: 'CNTR',
  status: 'Categoria',
}

/** Espelha `SORT_FIELDS` de `src/domain/process-query.ts`: valor fora da lista
    cai no padrao em vez de chegar a rota e voltar 400. */
const SORT_FIELDS: readonly SortField[] = [
  'sourceRow',
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
export const PAGE_SIZES = [50, 100, 200, 500, MAX_LIMIT] as const
export const DEFAULT_PAGE_SIZE = 200

/**
 * O nome de cada tamanho na tela (`H-100`).
 *
 * **`MAX_LIMIT` se chama "Todas", e a opcao existe por ordem do usuario em
 * 16/09/2026.** `D-31` fixara o oposto — "500 e teto, e nao todas" —, para a
 * paginacao nunca desaparecer e o pior caso de renderizacao ficar previsivel;
 * ele pediu a opcao mesmo assim, e a emenda fica registrada.
 *
 * **Ela nao mente por construcao**, e e por isso que o valor e `MAX_LIMIT` e
 * nao um sentinela: passando de 1000 processos, o rodape volta a paginar e diz
 * de quantos, em vez de cortar em silencio (regra inviolavel 2). Medido em
 * `H-84`: 500 linhas montam em 213 ms, e as 650 de hoje cabem numa pagina so.
 */
export const pageSizeLabel = (size: number): string => (size === MAX_LIMIT ? 'Todas' : String(size))

/**
 * Os parametros que sao DESTA pagina, e nao da casca (`H-99`).
 *
 * O cabecalho deste arquivo ja declarava a separacao desde `H-84`; o que
 * faltava era alguem cumpri-la. `navigate` preserva a query inteira — certo
 * para os quatorze filtros globais, porque trocar de pagina nao limpa o recorte
 * —, e com isso `?limit=500` viajava para as outras seis telas, onde nao
 * significa nada. **Quem os apaga e a casca, ao SAIR daqui**, e nao o roteador:
 * ver o efeito em `web/src/App.tsx`.
 */
export const PAGE_PARAMS = [
  'search',
  'activeOnly',
  'sort',
  'order',
  'limit',
  'offset',
  'hidden',
] as const

/**
 * As colunas que o operador ESCONDEU, por chave (`H-95`).
 *
 * **O padrao e mostrar todas**, e a determinacao 4 de `D-43` e explicita: o que
 * a escolha do operador faz e TIRAR. Guardar as escondidas, e nao as visiveis,
 * e o que faz a coluna nova da planilha aparecer sozinha em vez de precisar ser
 * autorizada — e o que mantem a URL curta no caso comum, que e nenhuma.
 *
 * Token invalido e IGNORADO, nao recusado: mesma tolerancia de `readSort` e do
 * `offset`. A tabela descarta o que nao reconhece.
 */
const COLUNA = /^[A-Z0-9]{1,12}$/

function readHidden(raw: string | null): readonly string[] {
  if (raw === null) return []
  const vistas = new Set<string>()
  for (const parte of raw.split(',')) {
    const chave = parte.trim().toUpperCase()
    if (COLUNA.test(chave)) vistas.add(chave)
  }
  return [...vistas]
}

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
  /**
   * As colunas escondidas (`H-95`). Vazio significa que a tabela mostra todas.
   *
   * **Nao vai para a requisicao:** esconder coluna e apresentacao, e o servidor
   * ja serve as 16 no DTO. Anexa-la faria a tela pedir de novo a cada clique.
   */
  readonly hidden: readonly string[]
  /** O que a pagina anexa a requisicao: os quatorze filtros **mais** estes. */
  readonly requestQuery: string
  setSearch(value: string): void
  setActiveOnly(value: boolean): void
  /** Alterna a direcao quando e a mesma coluna; comeca em `asc` numa nova. */
  toggleSort(field: SortField): void
  /** Descarta a ordenacao e devolve a tela a ordem da planilha (`H-89`). */
  clearSort(): void
  setLimit(value: number): void
  setOffset(value: number): void
  /** Esconde a coluna, ou a traz de volta se ja estiver escondida. */
  toggleColumn(key: string): void
  /** Devolve a tabela ao padrao: todas as colunas a vista. */
  showAllColumns(): void
}

function readSort(raw: string | null): SortField {
  return raw !== null && (SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as SortField)
    : 'sourceRow'
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
  const hidden = readHidden(query.get('hidden'))

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams(query)
    // Apresentacao nao viaja: o servidor serve as 16 colunas de qualquer jeito,
    // e mandar `hidden` faria a tela refazer a busca a cada coluna escondida.
    params.delete('hidden')
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

  /**
   * APAGA `sort` e `order` em vez de escrever `sort=sourceRow`: a URL guarda so
   * o que difere do padrao, como `setLimit` e `setActiveOnly` ja fazem, e
   * `readSort` devolve `sourceRow` na ausencia. Apagar `order` junto e
   * obrigatorio — `order=desc` orfao daria a planilha de tras para a frente.
   *
   * Isso NAO contradiz a determinacao 1 de `H-89`: la `sourceRow` e valor de
   * `sort` para o dominio e para a rota, onde ele precisa ser pedivel. Aqui e
   * so codificacao de URL.
   */
  const clearSort = useCallback((): void => {
    write((draft) => {
      draft.delete('sort')
      draft.delete('order')
      draft.delete('offset')
    })
  }, [write])

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

  /**
   * Esconder coluna NAO volta para a primeira pagina, ao contrario dos demais
   * controles: o conjunto nao muda, so o que dele se ve. Zerar o `offset` aqui
   * tiraria o operador da pagina em que ele estava por um gesto de layout.
   */
  const toggleColumn = useCallback(
    (key: string): void => {
      write((draft) => {
        const chave = key.toUpperCase()
        const proximas = hidden.includes(chave)
          ? hidden.filter((uma) => uma !== chave)
          : [...hidden, chave]
        if (proximas.length === 0) draft.delete('hidden')
        else draft.set('hidden', proximas.join(','))
      })
    },
    [write, hidden],
  )

  const showAllColumns = useCallback((): void => {
    write((draft) => draft.delete('hidden'))
  }, [write])

  return {
    search,
    activeOnly,
    sort,
    order,
    limit,
    offset,
    hidden,
    requestQuery,
    setSearch,
    setActiveOnly,
    toggleSort,
    clearSort,
    setLimit,
    setOffset,
    toggleColumn,
    showAllColumns,
  }
}
