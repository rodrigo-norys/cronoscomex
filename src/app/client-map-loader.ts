import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import {
  type ClientGroup,
  type ClientGroupMember,
  type ClientMapEntry,
  type ClientMatch,
  type ClientRule,
  type ClientRulePlan,
  normalizeClientGroups,
  normalizeClientMap,
} from '../domain/client-mapper.ts'
import { normKey } from '../domain/normalizer.ts'

/**
 * Carrega e valida `client-map.json`. O I/O vive aqui, e nao em src/domain/,
 * pela regra de fronteira do ADR-0006.
 *
 * O caminho aparece sem o prefixo `config/` de proposito: o arquivo esta no
 * `.gitignore`, e a guarda de ancora morta cobra existencia em disco — citar o
 * caminho completo reprovaria o CI num checkout limpo. Convencao ja fixada em
 * `H-34` para o `app.json`.
 *
 * **Arquivo AUSENTE nao e erro**, e e aqui que este loader diverge de
 * `loadColorMap`. Sem mapa de cores toda linha cai em quarentena e o painel
 * fica inutil, entao aquele falha alto; sem mapa de clientes a aplicacao se
 * comporta exatamente como antes de H-49, com o cliente valendo o que a celula
 * diz. Matar a partida por um arquivo que o repositorio nem versiona repetiria
 * o circulo que H-34 desfez: o processo morreria antes de servir a tela.
 *
 * **JSON malformado, por outro lado, mata a partida.** Ausente e "ainda nao
 * configurei"; escrito errado e engano que nenhuma tela conserta, e seguir com
 * o mapa vazio faria a consolidacao sumir sem ninguem saber por que.
 */

export const DEFAULT_CLIENT_MAP_PATH = 'config/client-map.json'

export class ClientMapError extends Error {
  override readonly name = 'ClientMapError'
}

const MATCHES: readonly ClientMatch[] = ['prefix', 'contains', 'exact']

export interface ClientMapFile {
  version: number
  clients: ClientMapEntry[]
  /** Opcional: sem ela, nenhum cliente tem grupo (`H-55`). */
  groups?: ClientGroup[]
}

/** O que o loader devolve: as duas listas ja normalizadas e conferidas entre si. */
export interface ClientMap {
  clients: ClientMapEntry[]
  groups: ClientGroup[]
}

function validateRule(raw: unknown, where: string): ClientRule {
  if (!raw || typeof raw !== 'object') {
    throw new ClientMapError(`${where} deve ser um objeto.`)
  }
  const rule = raw as Record<string, unknown>

  const match = rule.match as ClientMatch
  if (!MATCHES.includes(match)) {
    throw new ClientMapError(
      `${where}.match invalido: ${String(match)}. Valores: ${MATCHES.join(', ')}.`,
    )
  }

  const value = rule.value
  // Valor vazio casaria TODA linha em `prefix` e em `contains`, e a primeira
  // regra vence — uma unica regra assim engoliria o mapa inteiro em silencio.
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ClientMapError(`${where}.value e obrigatorio e nao pode ser vazio.`)
  }

  const importer = rule.importer
  if (importer !== undefined && (typeof importer !== 'string' || importer.trim() === '')) {
    throw new ClientMapError(
      `${where}.importer, quando presente, deve ser um texto nao vazio.\n` +
        'Omita o campo para a regra valer para qualquer importador.',
    )
  }

  return {
    match,
    value,
    ...(importer === undefined ? {} : { importer: importer as string }),
  }
}

function validateEntry(raw: unknown, position: number): ClientMapEntry {
  const where = `clients[${position}]`
  if (!raw || typeof raw !== 'object') {
    throw new ClientMapError(`${where} deve ser um objeto.`)
  }
  const entry = raw as Record<string, unknown>

  const key = entry.key
  if (typeof key !== 'string' || key.trim() === '') {
    throw new ClientMapError(`${where}.key e obrigatorio.`)
  }
  if (!Array.isArray(entry.rules)) {
    throw new ClientMapError(`${where}.rules precisa ser uma lista.`)
  }
  // Lista vazia nao e erro de sintaxe, mas e um cliente que nunca casa: o
  // operador escreveu a intencao e esqueceu a regra, e o sintoma seria o
  // cliente simplesmente nao aparecer.
  if (entry.rules.length === 0) {
    throw new ClientMapError(`${where}.rules esta vazia — o cliente "${key}" nunca casaria.`)
  }

  return {
    key,
    label: typeof entry.label === 'string' && entry.label.trim() !== '' ? entry.label : key,
    rules: entry.rules.map((rule, index) => validateRule(rule, `${where}.rules[${index}]`)),
  }
}

/**
 * Le o mapa de clientes. Devolve lista vazia quando o arquivo nao existe.
 *
 * As chaves e os valores das regras saem daqui **ja normalizados** por
 * `normalizeClientMap`: o caminho quente e a ingestao, e normalizar por
 * comparacao repetiria `normKey` milhares de vezes sobre texto que nao muda.
 */
export function loadClientMap(path: string = DEFAULT_CLIENT_MAP_PATH): ClientMap {
  if (!existsSync(path)) return { clients: [], groups: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (cause) {
    throw new ClientMapError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const file = parsed as Partial<ClientMapFile>
  if (!Array.isArray(file.clients)) {
    throw new ClientMapError(
      `${path} precisa ter a lista "clients".\n` +
        `Veja o formato em ${DEFAULT_CLIENT_MAP_PATH}.exemplo.`,
    )
  }

  const entries = file.clients.map(validateEntry)

  const seen = new Map<string, number>()
  for (const [position, entry] of entries.entries()) {
    const first = seen.get(entry.key)
    if (first !== undefined) {
      throw new ClientMapError(
        `Cliente repetido em ${path}: "${entry.key}"\n` +
          `Aparece em clients[${first}] e clients[${position}]. ` +
          'Junte as regras dos dois numa entrada so — a ordem delas e o desempate.',
      )
    }
    seen.set(entry.key, position)
  }

  return {
    clients: normalizeClientMap(entries),
    groups: validateGroups(file.groups, entries, path),
  }
}

/**
 * Confere os grupos CONTRA a lista de clientes, e por isso vive na mesma
 * leitura: membro que aponta para cliente inexistente e o erro provavel — o
 * operador renomeia a chave de um cliente e o grupo fica apontando para o nada,
 * sem sintoma nenhum na tela.
 */
function validateGroups(
  raw: unknown,
  clients: readonly ClientMapEntry[],
  path: string,
): ClientGroup[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new ClientMapError(`${path}: "groups", quando presente, precisa ser uma lista.`)
  }

  const known = new Set(clients.map((entry) => normKey(entry.key)))
  const groupKeys = new Map<string, number>()
  const memberOf = new Map<string, string>()

  const groups = raw.map((item, position) => {
    const where = `groups[${position}]`
    if (!item || typeof item !== 'object') {
      throw new ClientMapError(`${where} deve ser um objeto.`)
    }
    const group = item as Record<string, unknown>

    const key = group.key
    if (typeof key !== 'string' || key.trim() === '') {
      throw new ClientMapError(`${where}.key e obrigatorio.`)
    }
    const normalizedKey = normKey(key)
    const first = groupKeys.get(normalizedKey)
    if (first !== undefined) {
      throw new ClientMapError(
        `Grupo repetido em ${path}: "${key}"\n` +
          `Aparece em groups[${first}] e ${where}. Junte os membros numa entrada so.`,
      )
    }
    groupKeys.set(normalizedKey, position)

    if (!Array.isArray(group.members) || group.members.length === 0) {
      throw new ClientMapError(`${where}.members precisa ser uma lista com ao menos um cliente.`)
    }

    const members = group.members.map((entry, index) => {
      const memberWhere = `${where}.members[${index}]`
      if (!entry || typeof entry !== 'object') {
        throw new ClientMapError(`${memberWhere} deve ser um objeto com "client".`)
      }
      const member = entry as Record<string, unknown>

      const client = member.client
      if (typeof client !== 'string' || client.trim() === '') {
        throw new ClientMapError(`${memberWhere}.client e obrigatorio.`)
      }
      const normalizedClient = normKey(client)
      if (!known.has(normalizedClient)) {
        throw new ClientMapError(
          `${memberWhere} aponta para "${client}", que nao esta em "clients".\n` +
            'Um grupo so reune clientes ja declarados — ele nao cria cliente novo.',
        )
      }
      // Cliente em dois grupos deixaria a arvore do filtro ambigua: o operador
      // marcaria um pai e veria a contagem do outro mudar.
      const already = memberOf.get(normalizedClient)
      if (already !== undefined) {
        throw new ClientMapError(
          `Cliente em mais de um grupo em ${path}: "${client}"\n` +
            `Ja e membro de "${already}". Um cliente pertence a no maximo um grupo.`,
        )
      }
      memberOf.set(normalizedClient, normalizedKey)

      const label = member.label
      if (label !== undefined && (typeof label !== 'string' || label.trim() === '')) {
        throw new ClientMapError(
          `${memberWhere}.label, quando presente, deve ser um texto nao vazio.`,
        )
      }

      return {
        client,
        ...(label === undefined ? {} : { label: label as string }),
      } satisfies ClientGroupMember
    })

    return {
      key,
      label: typeof group.label === 'string' && group.label.trim() !== '' ? group.label : key,
      members,
    } satisfies ClientGroup
  })

  return normalizeClientGroups(groups)
}

/**
 * RECUSA o padrao sob `NODE_ENV=test`, como `history-store` desde `H-28` e
 * `saveWorkbookPath` desde `H-34`.
 *
 * O arquivo esta no `.gitignore` e e do OPERADOR: um ponto de injecao esquecido
 * aqui reescreveria o mapa de clientes dele a cada execucao da suite, e o
 * sintoma apareceria semanas depois, como consolidacao que parou de funcionar.
 * `H-34` mediu exatamente esse engano com o `app.json`.
 */
function resolveClientMapPath(path: string | undefined): string {
  if (path !== undefined) return path
  if (process.env.NODE_ENV !== 'test') return DEFAULT_CLIENT_MAP_PATH

  throw new ClientMapError(
    'client-map: sob teste, injete o caminho — o padrao aponta para o mapa real do operador.',
  )
}

interface RawEntry {
  key?: unknown
  label?: unknown
  rules?: unknown
}

/**
 * Grava a regra planejada no JSON **cru**, preservando tudo o que nao e dela.
 *
 * **Nao serializa o mapa em memoria**, e a razao e dupla: as chaves e os valores
 * de la vem normalizados por `normalizeClientMap`, entao a volta apagaria a
 * grafia do operador; e o arquivo carrega `_origem`, `_comentario_*` e `_nota`,
 * que a convencao do repositorio manda preservar — sao a documentacao do
 * formato, lidas por quem abre o arquivo.
 *
 * **Arquivo ausente e criado**, e nao e caso de erro: e o estado da maquina do
 * operador (`PD-08`), onde a distribuicao leva so o `.exemplo`. Declarar o
 * cliente de uma linha na tela e o que faz o mapa nascer.
 *
 * Gravacao atomica pelo mesmo motivo de `saveWorkbookPath`: truncado no meio, o
 * arquivo mataria a partida seguinte, e a mensagem apontaria para JSON invalido
 * num arquivo que ninguem editou a mao.
 */
export function saveClientRule(plan: ClientRulePlan, path?: string): void {
  if (plan.kind === 'sem-efeito') return

  const target = resolveClientMapPath(path)
  let raw: Record<string, unknown> = { version: 1, clients: [] }
  if (existsSync(target)) {
    try {
      raw = JSON.parse(readFileSync(target, 'utf-8')) as Record<string, unknown>
    } catch (cause) {
      throw new ClientMapError(`${target} nao e um JSON valido: ${(cause as Error).message}`)
    }
  }

  const clients = Array.isArray(raw.clients) ? [...(raw.clients as RawEntry[])] : []
  const at = clients.findIndex(
    (entry) => typeof entry.key === 'string' && normKey(entry.key) === plan.key,
  )

  const entry: RawEntry =
    at === -1 ? { key: plan.key, label: plan.label, rules: [] } : (clients[at] as RawEntry)

  const rules = Array.isArray(entry.rules) ? [...(entry.rules as ClientRule[])] : []
  const already = rules.some(
    (rule) =>
      rule.match === 'exact' && normKey(rule.value) === plan.value && rule.importer === undefined,
  )
  if (!already) rules.push({ match: 'exact', value: plan.value })
  entry.rules = rules

  if (at !== -1) clients.splice(at, 1)
  const before =
    plan.beforeKey === null
      ? -1
      : clients.findIndex(
          (candidate) =>
            typeof candidate.key === 'string' && normKey(candidate.key) === plan.beforeKey,
        )
  if (before === -1) {
    // Entrada nova sem alvo vai para o FIM; entrada que ja existia e nao precisa
    // mudar de lugar volta ao indice de onde saiu.
    if (at === -1) clients.push(entry)
    else clients.splice(at, 0, entry)
  } else {
    clients.splice(before, 0, entry)
  }

  raw.clients = clients
  const temporary = `${target}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(raw, null, 2)}\n`, 'utf-8')
    renameSync(temporary, target)
  } catch (cause) {
    throw new ClientMapError(
      `Nao foi possivel gravar ${target}: ${(cause as Error).message}\n` +
        'Confira se o arquivo nao esta somente-leitura.',
    )
  }
}
