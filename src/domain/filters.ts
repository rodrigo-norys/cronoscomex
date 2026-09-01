import type { ColorResponsible, CustomsChannel, Process, StatusCategory } from './types.ts'

/**
 * Os quatorze filtros globais (RF-17), aplicados a toda rota marcada [F].
 *
 * Eram onze ate `H-49`, que separou o cliente consolidado do processo do
 * cliente: `client` recorta a carteira, `clientProcess` acha um processo
 * especifico pelo que a celula CLT diz. `H-50` acrescentou o decimo quarto,
 * pela mesma razao: `responsible` diz quem responde, `colorResponsible` diz o
 * que o operador pintou.
 *
 * **OU dentro do parametro, E entre parametros distintos.** `client=A&client=B`
 * seleciona quem for A ou B; acrescentar `category=em_andamento` restringe esse
 * conjunto. Parametro ausente nao filtra nada — nunca significa "nenhum".
 */
export interface FilterSet {
  /** Periodo sobre ETA2, extremos inclusivos. Ocupa dois parametros. */
  etaFrom: Date | null
  etaTo: Date | null
  /** Chave do cliente CONSOLIDADO (`H-49`). */
  client: readonly string[]
  /** Chave da celula CLT, que guarda o processo daquele cliente. */
  clientProcess: readonly string[]
  /** Grupo de clientes (`H-55`). Seleciona todos os membros de uma vez. */
  clientGroup: readonly string[]
  importer: readonly string[]
  vessel: readonly string[]
  agent: readonly string[]
  goods: readonly string[]
  category: readonly StatusCategory[]
  /** Chave da pessoa responsavel (`H-50`). Dominio ABERTO: vem do mapa de equipe. */
  responsible: readonly string[]
  /** O que a cor da linha diz (`H-50`). Dominio fechado, e leva a agregacao de A-18. */
  colorResponsible: readonly ColorResponsible[]
  channel: readonly CustomsChannel[]
  port: readonly string[]
  importerOutsideRj: boolean | null
}

export const STATUS_CATEGORIES: readonly StatusCategory[] = [
  'em_andamento',
  'em_desembaraco',
  'desembaracado',
  'fechado_aguardando_draft',
]

export const COLOR_RESPONSIBLES: readonly ColorResponsible[] = [
  'colaborador1',
  'colaborador2',
  'colaborador1_outros_clientes',
  'indefinido',
]

export const CUSTOMS_CHANNELS: readonly CustomsChannel[] = ['verde', 'vermelho', 'indefinido']

export function emptyFilterSet(): FilterSet {
  return {
    etaFrom: null,
    etaTo: null,
    client: [],
    clientProcess: [],
    clientGroup: [],
    importer: [],
    vessel: [],
    agent: [],
    goods: [],
    category: [],
    responsible: [],
    colorResponsible: [],
    channel: [],
    port: [],
    importerOutsideRj: null,
  }
}

/**
 * `colaborador1` seleciona TAMBEM `colaborador1_outros_clientes` (A-18).
 *
 * **A regra migrou com o campo em `H-50`**, e nao desapareceu: ela sempre foi
 * sobre a COR — as duas chaves sao dois tons que o operador pinta para a mesma
 * pessoa. O filtro de `responsible` nao precisa dela, porque as duas cores
 * resolvem para o mesmo membro do mapa.
 *
 * O ranking de IND-20 faz o oposto e exibe as duas separadas: sao perguntas
 * diferentes. O ranking mostra a distribuicao; o filtro recorta o trabalho de
 * uma pessoa, e os clientes dela continuam sendo dela.
 */
function matchesColorResponsible(process: Process, selected: readonly ColorResponsible[]): boolean {
  if (selected.length === 0) return true
  if (selected.includes(process.colorResponsible)) return true
  return (
    selected.includes('colaborador1') && process.colorResponsible === 'colaborador1_outros_clientes'
  )
}

/** Lista vazia nao filtra. Chave vazia e valor legitimo, e casa com `''`. */
function matchesKey(value: string, selected: readonly string[]): boolean {
  return selected.length === 0 || selected.includes(value)
}

/**
 * Periodo sobre ETA2. `eta2 = null` NUNCA satisfaz quando ha limite (A-20):
 * data ausente nao esta dentro nem fora, e incluir seria afirmar que esta.
 *
 * `etaFrom` posterior a `etaTo` produz conjunto vazio, sem erro — o intervalo
 * simplesmente nao contem nada, e recusar exigiria decidir qual dos dois o
 * usuario quis dizer.
 */
function matchesPeriod(process: Process, from: Date | null, to: Date | null): boolean {
  if (from === null && to === null) return true
  if (process.eta2 === null) return false

  const time = process.eta2.getTime()
  if (from !== null && time < from.getTime()) return false
  if (to !== null && time > to.getTime()) return false
  return true
}

/**
 * `false` inclui apenas `false`, nunca `null`.
 *
 * `null` significa cor nao reconhecida — nao saber onde o importador esta e
 * diferente de saber que ele esta no RJ. Mesma regra da cor que nao vira canal.
 */
function matchesOutsideRj(process: Process, selected: boolean | null): boolean {
  return selected === null || process.importerOutsideRj === selected
}

export function applyFilters(processes: readonly Process[], filters: FilterSet): Process[] {
  return processes.filter(
    (process) =>
      matchesPeriod(process, filters.etaFrom, filters.etaTo) &&
      matchesKey(process.clientKey, filters.client) &&
      matchesKey(process.clientProcessKey, filters.clientProcess) &&
      matchesKey(process.clientGroupKey, filters.clientGroup) &&
      matchesKey(process.importerKey, filters.importer) &&
      matchesKey(process.vesselKey, filters.vessel) &&
      matchesKey(process.agentKey, filters.agent) &&
      matchesKey(process.goodsKey, filters.goods) &&
      matchesKey(process.portKey, filters.port) &&
      (filters.category.length === 0 || filters.category.includes(process.statusCategory)) &&
      matchesKey(process.responsible, filters.responsible) &&
      matchesColorResponsible(process, filters.colorResponsible) &&
      (filters.channel.length === 0 || filters.channel.includes(process.customsChannel)) &&
      matchesOutsideRj(process, filters.importerOutsideRj),
  )
}

/**
 * Valor fora do dominio fechado de um filtro. A rota traduz para
 * `400 FILTRO_INVALIDO`; a regra de o que e valido vive aqui.
 */
export class FilterParseError extends Error {
  override readonly name = 'FilterParseError'
  readonly field: string
  readonly value: string

  // Atribuicao explicita, nunca parameter property: o projeto roda com
  // `node --experimental-strip-types`, que apenas REMOVE tipos e recusa
  // sintaxe que gere codigo. `tsc --noEmit` e o Vitest nao pegam isso.
  constructor(field: string, value: string) {
    super(`Valor invalido para o filtro "${field}": "${value}".`)
    this.field = field
    this.value = value
  }
}

/** Query string entrega string, lista ou nada. Normaliza para lista. */
function asList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return []
  return (Array.isArray(raw) ? raw : [raw]).map(String).filter((value) => value !== '')
}

/**
 * Como `asList`, mas a string vazia **sobrevive** — ela e chave legitima nos
 * filtros de dominio aberto (TD-04), nao ausencia de valor.
 *
 * A distincao esta na presenca do parametro, e nao no seu conteudo: `?goods=`
 * chega como `''` e significa "mercadoria em branco"; parametro ausente chega
 * como `undefined` e nao filtra nada. `asList` colapsa os dois casos, e por
 * isso nao serve aqui.
 *
 * Sem esta funcao, `optionsOf` oferecia a chave vazia — de proposito, para
 * tornar o buraco investigavel — e `applyFilters` a casava corretamente, mas
 * ela morria no meio do caminho: a selecao virava um recorte que nao recortava
 * nada, e a tela mostrava a base inteira como se fossem os processos em branco.
 * Descarte silencioso do lado errado da regra inviolavel 3.
 */
function asKeyList(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []
  return (Array.isArray(raw) ? raw : [raw]).map(String)
}

function asSingle(raw: unknown): string | null {
  const list = asList(raw)
  return list.at(-1) ?? null
}

/** Aceita apenas os valores catalogados; qualquer outro e erro, nunca descarte. */
function parseEnum<T extends string>(raw: unknown, field: string, domain: readonly T[]): T[] {
  return asList(raw).map((value) => {
    if (!(domain as readonly string[]).includes(value)) {
      throw new FilterParseError(field, value)
    }
    return value as T
  })
}

/**
 * `AAAA-MM-DD` ancorado em UTC, como toda data do dominio (TD-03). Formato
 * diferente e erro: aceitar `new Date('qualquer coisa')` produziria `Invalid
 * Date` e um filtro que nao casa com nada, silenciosamente.
 */
function parseIsoDay(raw: unknown, field: string): Date | null {
  const value = asSingle(raw)
  if (value === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FilterParseError(field, value)

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new FilterParseError(field, value)
  return date
}

function parseBoolean(raw: unknown, field: string): boolean | null {
  const value = asSingle(raw)
  if (value === null) return null
  if (value !== 'true' && value !== 'false') throw new FilterParseError(field, value)
  return value === 'true'
}

/**
 * Converte a query em `FilterSet`. Lanca `FilterParseError` no primeiro valor
 * fora de dominio — os quatro filtros de dominio fechado sao validados; os de
 * dominio aberto (cliente, navio, porto...) aceitam qualquer texto, porque a
 * lista vem dos dados e nao de catalogo (A-36). Valor inexistente ali produz
 * resultado vazio com `200`, que e resposta legitima.
 *
 * Os nove de dominio aberto usam `asKeyList`, que preserva a chave vazia; os
 * demais seguem com `asList`, onde `''` e ausencia mesmo — `?category=` nao e
 * "categoria em branco", porque categoria em branco nao existe.
 *
 * **`responsible` mudou de lado em `H-50`**: era fechado, com quatro chaves
 * validadas, e passou a aberto — `?responsible=xyz` deixa de dar
 * `400 FILTRO_INVALIDO` e devolve conjunto vazio com `200`. A chave sai do mapa
 * de equipe, que nao e versionado, entao nao ha catalogo contra o que validar
 * (mesmo argumento de A-36 para cliente e porto). E `''` e chave legitima: sao
 * os 42 processos sem responsavel.
 */
export function parseFilters(query: Record<string, unknown>): FilterSet {
  return {
    etaFrom: parseIsoDay(query.etaFrom, 'etaFrom'),
    etaTo: parseIsoDay(query.etaTo, 'etaTo'),
    client: asKeyList(query.client),
    clientProcess: asKeyList(query.clientProcess),
    clientGroup: asKeyList(query.clientGroup),
    importer: asKeyList(query.importer),
    vessel: asKeyList(query.vessel),
    agent: asKeyList(query.agent),
    goods: asKeyList(query.goods),
    category: parseEnum(query.category, 'category', STATUS_CATEGORIES),
    responsible: asKeyList(query.responsible),
    colorResponsible: parseEnum(query.colorResponsible, 'colorResponsible', COLOR_RESPONSIBLES),
    channel: parseEnum(query.channel, 'channel', CUSTOMS_CHANNELS),
    port: asKeyList(query.port),
    importerOutsideRj: parseBoolean(query.importerOutsideRj, 'importerOutsideRj'),
  }
}

/**
 * Se algum dos quatorze filtros esta ativo.
 *
 * A serie mensal de `H-28` precisa distinguir "sem filtro" de "filtro que casa
 * tudo": sem filtro ela sai inteira do arquivo, e com filtro e restrita aos REF
 * que casam hoje. Tratar os dois casos igual faria uma linha removida da
 * planilha apagar o passado dela da serie.
 */
export function hasAnyFilter(filters: FilterSet): boolean {
  return (
    filters.etaFrom !== null ||
    filters.etaTo !== null ||
    filters.importerOutsideRj !== null ||
    filters.client.length > 0 ||
    filters.clientProcess.length > 0 ||
    filters.clientGroup.length > 0 ||
    filters.importer.length > 0 ||
    filters.vessel.length > 0 ||
    filters.agent.length > 0 ||
    filters.goods.length > 0 ||
    filters.category.length > 0 ||
    filters.responsible.length > 0 ||
    filters.colorResponsible.length > 0 ||
    filters.channel.length > 0 ||
    filters.port.length > 0
  )
}

/** Um valor disponivel num filtro, com a grafia de origem e quantos o usam. */
export interface FilterOption {
  key: string
  /** Primeira grafia encontrada, na ordem da planilha (A-26). */
  label: string
  /** Quantos processos carregam este valor no conjunto atual. */
  count: number
}

/**
 * Rotulos em pt-br dos dominios fechados, para o usuario final — que e
 * brasileiro e nao e tecnico. A chave continua sendo o valor canonico.
 *
 * O vocabulario das categorias e o corrigido por A-01: "Aguardando desembaraco"
 * foi descartado como termo orfao, e "Em andamento" — que a especificacao
 * omitia — esta presente.
 */
export const CATEGORY_LABELS: Readonly<Record<StatusCategory, string>> = {
  em_andamento: 'Em andamento',
  em_desembaraco: 'Em desembaraço',
  desembaracado: 'Desembaraçado',
  fechado_aguardando_draft: 'Fechado — aguardando draft',
}

export const COLOR_RESPONSIBLE_LABELS: Readonly<Record<ColorResponsible, string>> = {
  colaborador1: 'Colaborador 1',
  colaborador2: 'Colaborador 2',
  colaborador1_outros_clientes: 'Colaborador 1 — outros clientes',
  indefinido: 'Indefinido',
}

/** Rotulo de `responsible` vazio. A ausencia tem nome, e ela aparece (A-28). */
export const UNASSIGNED_RESPONSIBLE_LABEL = 'Sem responsável'

export const CHANNEL_LABELS: Readonly<Record<CustomsChannel, string>> = {
  verde: 'Canal Verde',
  vermelho: 'Canal Vermelho',
  indefinido: 'Indefinido',
}

/**
 * Opcoes de um dominio FECHADO: as chaves aparecem todas, inclusive as zeradas.
 *
 * Mesma razao de IND-20 exibir as quatro chaves de responsavel — esconder a que
 * tem zero faria o filtro parecer completo quando nao e, e o operador nao
 * saberia que a opcao existe.
 */
export function fixedOptions<T extends string>(
  processes: readonly Process[],
  domain: readonly T[],
  labels: Readonly<Record<T, string>>,
  keyOf: (process: Process) => T,
): FilterOption[] {
  return labelledOptions(
    processes,
    domain.map((key) => ({ key, label: labels[key] })),
    keyOf,
  )
}

/**
 * Como `fixedOptions`, mas o dominio chega ja rotulado — para o que so e
 * fechado em execucao.
 *
 * `H-50` precisa disto: as chaves de responsavel vem de `config/team-map.json`,
 * entao nenhuma tabela escrita no codigo as traduz, e mesmo assim as zeradas
 * precisam aparecer — pessoa declarada no mapa e sem processo algum e o caso que
 * A-28 manda exibir, e escondê-la faria o filtro parecer completo quando nao esta.
 *
 * A contagem ignora chave fora do dominio: com mapa de equipe, toda chave de
 * processo e um membro ou a vazia, e as duas estao la.
 */
export function labelledOptions(
  processes: readonly Process[],
  domain: readonly { key: string; label: string }[],
  keyOf: (process: Process) => string,
): FilterOption[] {
  const counts = new Map<string, number>(domain.map(({ key }) => [key, 0]))
  for (const process of processes) {
    const key = keyOf(process)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return domain.map(({ key, label }) => ({ key, label, count: counts.get(key) ?? 0 }))
}

/**
 * Valores disponiveis num campo, derivados dos dados carregados — nunca de
 * lista fixa (A-36). A planilha real trouxe um porto `RO` que a especificacao
 * nao documentava; dominio fechado o teria escondido.
 *
 * A chave vazia entra: um cliente em branco e informacao sobre o preenchimento
 * da planilha, e permitir filtrar por ele e o que torna o buraco investigavel.
 */
export function optionsOf(
  processes: readonly Process[],
  key: (process: Process) => string,
  label: (process: Process) => string,
): FilterOption[] {
  const seen = new Map<string, { label: string; count: number }>()

  for (const process of processes) {
    const optionKey = key(process)
    const existing = seen.get(optionKey)
    if (existing) {
      existing.count++
      continue
    }
    seen.set(optionKey, { label: label(process).trim(), count: 1 })
  }

  return [...seen.entries()]
    .map(([optionKey, { label: optionLabel, count }]) => ({
      key: optionKey,
      label: optionLabel,
      count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}
