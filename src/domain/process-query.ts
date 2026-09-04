import { STATUS_CATEGORIES } from './filters.ts'
import type { Process } from './types.ts'

/**
 * Consulta da Pagina Operacional: busca textual, ordenacao e paginacao.
 *
 * Vive no dominio, e nao na rota, porque as tres sao **regra**, nao traducao de
 * HTTP: o que casa numa busca, onde um nulo cai numa ordenacao e o que a
 * contagem total significa sao decisoes de negocio. A rota so le a query e
 * serializa (regra inviolavel 6, e o Biome quebra a build se for violada).
 */

/**
 * Os SEIS campos de texto da planilha (`D-34`).
 *
 * Eram tres ate 04/09/2026 — os de consulta declarados em §2 da especificacao
 * (`A-39`), que a busca resolveu. O operador pediu "qualquer coluna", e o
 * recorte que sobrou tem criterio: **procedencia do dado**. Estes seis sao
 * texto de celula, e casam sem inventar formatacao.
 *
 * **Tres colunas da tabela ficam de fora, cada uma por um motivo diferente.**
 * `clientLabel` e o nome CONSOLIDADO de `client-map.json` e nao uma celula —
 * um acerto ali nao seria explicavel pela planilha. `eta2` e data, e casar
 * `30/12/2025` seria buscar sobre o texto formatado, que e apresentacao. E
 * `statusCategory` e rotulo derivado de cinco regras, cujo recorte o filtro
 * global ja oferece.
 *
 * **A distincao entre `clientRaw` e `clientLabel` e o que `D-29` adiava**: ele
 * fechou a busca em tres campos justamente para nao escolher entre os dois, e
 * `D-34` escolhe. Entra a celula, fica fora o consolidado.
 */
const SEARCHABLE = [
  'ref',
  'clientRaw',
  'importerRaw',
  'vesselRaw',
  'billOfLading',
  'container',
] as const

/**
 * As dez ordens que a Pagina Operacional oferece — uma por coluna da tabela.
 *
 * Eram cinco ate 02/09/2026, e a tabela mostrava nove colunas: quatro
 * cabecalhos nao eram clicaveis, sem que a tela dissesse por que. `client` e
 * `clientProcess` sao ordens DIFERENTES de proposito, e nao duas grafias da
 * mesma: uma ordena pelo cliente consolidado, a outra pelo valor da celula CLT
 * — que sao coisas distintas desde `H-49`, quando 649 processos revelaram 509
 * valores distintos em CLT.
 */
export const SORT_FIELDS = [
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
] as const
export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = 'asc' | 'desc'

export const DEFAULT_LIMIT = 200
export const MAX_LIMIT = 1000

/**
 * Dobra texto para comparacao: sem caixa, sem acento.
 *
 * Nao reaproveita `normKey` de proposito. Aquele existe para **agrupar** —
 * colapsa espaco interno, porque `EVER  FAIR` e `EVER FAIR` sao o mesmo navio.
 * Aqui o espaco importa: quem digita um trecho de container espera casamento
 * literal do que ve, e colapsar mudaria o que casa.
 */
function fold(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Busca por substring nos seis campos de `SEARCHABLE` (`A-39`, `D-34`).
 *
 * Termo vazio ou so espaco NAO filtra: e o estado inicial do campo, e tratar
 * como "nada casa" esvaziaria a tela sem o operador ter pedido.
 *
 * **Nao ordena por relevancia, e isso passa a se notar.** Com seis campos, um
 * termo curto casa muito mais: um importador de DUAS letras e uma linha inteira, e
 * aparece como substring em contentor e BL. A lista sai na ordem da consulta,
 * como sempre saiu.
 */
export function matchesSearch(process: Process, term: string): boolean {
  const needle = fold(term.trim())
  if (needle === '') return true

  return SEARCHABLE.some((field) => fold(process[field]).includes(needle))
}

/** A-16. "Processo ativo" e o que ainda pede trabalho. */
export function isActive(process: Process): boolean {
  return process.statusCategory !== 'desembaracado'
}

/**
 * Chave de ordenacao. `null` para o que nao tem valor — datas ausentes e
 * tambem texto vazio, que numa coluna de nome significa a mesma coisa: nada a
 * ordenar.
 */
function sortKey(process: Process, field: SortField): string | number | null {
  switch (field) {
    case 'ref':
      return process.ref === '' ? null : process.ref
    case 'eta2':
      return process.eta2?.getTime() ?? null
    case 'registrationDate':
      return process.registrationDate?.getTime() ?? null
    case 'client':
      return process.clientKey === '' ? null : process.clientKey
    case 'vessel':
      return process.vesselKey === '' ? null : process.vesselKey
    // As chaves ja normalizadas ordenam onde existem — `importerKey` agrupa, e
    // agrupar e comparar sem caixa nem acento e a mesma pergunta. Onde nao ha
    // chave, `fold` faz o mesmo sobre o texto cru.
    case 'importer':
      return process.importerKey === '' ? null : process.importerKey
    case 'clientProcess':
      return process.clientRaw === '' ? null : fold(process.clientRaw)
    case 'billOfLading':
      return process.billOfLading === '' ? null : fold(process.billOfLading)
    case 'container':
      return process.container === '' ? null : fold(process.container)
    /*
      **A categoria ordena pelo FLUXO, e nao pelo alfabeto**, e nunca e nula.

      Alfabetica poria "Desembaracado" antes de "Em andamento", que e a ordem
      inversa do trabalho. A ordem vem de `STATUS_CATEGORIES`, que ja existe e
      ja e a declarada — uma segunda lista aqui divergiria da primeira no
      primeiro ajuste.

      Toda linha tem exatamente uma das quatro (TD-01), entao nao ha o balde de
      nulos que as outras colunas tem: a ordem descendente inverte as quatro
      inteiras, sem nada preso no fim.
    */
    case 'status':
      return STATUS_CATEGORIES.indexOf(process.statusCategory)
  }
}

/**
 * Ordena **sem mutar** a entrada, com os nulos sempre por ultimo.
 *
 * "Sempre" inclui a ordem descendente, e e ai que a implementacao ingenua erra:
 * inverter o comparador inteiro jogaria os nulos para o topo em `desc`, e o
 * operador que inverte a coluna de ETA2 veria uma tela de tracos — medido, a
 * planilha tem **64 processos sem ETA2**. O nulo nao participa da inversao —
 * ele e ausencia de valor, nao um valor extremo.
 *
 * Empate desempata por `sourceRow`, que e unico **entre as linhas do arquivo**:
 * sem isso a ordem entre iguais dependeria do algoritmo de `sort` e mudaria
 * entre paginas.
 *
 * **Linha ainda nao gravada e a excecao, e ela e conhecida.** A projecao marca
 * `sourceRow: 0` (`UNWRITTEN_ROW`), entao duas insercoes pendentes empatam entre
 * si e ordenam ANTES de qualquer linha real. Deliberado: elas sao o que o
 * operador acabou de digitar, e o `sort` estavel preserva a ordem de chegada
 * entre elas. Achado do revisor-xml, registrado em vez de corrigido — inventar
 * um numero para ordenar reintroduziria o endereco falso que `UNWRITTEN_ROW`
 * existe para evitar.
 */
export function sortProcesses(
  processes: readonly Process[],
  field: SortField,
  order: SortOrder,
): Process[] {
  const direction = order === 'asc' ? 1 : -1

  return [...processes].sort((left, right) => {
    const leftKey = sortKey(left, field)
    const rightKey = sortKey(right, field)

    if (leftKey === null && rightKey === null) return left.sourceRow - right.sourceRow
    if (leftKey === null) return 1
    if (rightKey === null) return -1

    if (leftKey < rightKey) return -direction
    if (leftKey > rightKey) return direction
    return left.sourceRow - right.sourceRow
  })
}

/** Recorte da pagina. `offset` alem do fim devolve lista vazia, nunca a ultima
 * pagina: paginar para o vazio e resposta legitima, e reinterpretar o pedido
 * esconderia do cliente que ele passou do fim. */
export function paginate<T>(items: readonly T[], limit: number, offset: number): T[] {
  return items.slice(offset, offset + limit)
}
