import { normKey } from './normalizer.ts'

/**
 * Consolidacao do campo CLT no cliente que ele representa.
 *
 * Funcao PURA: recebe o mapa ja carregado. O I/O fica em
 * src/app/client-map-loader.ts, porque src/domain/ nao faz I/O (ADR-0006) — a
 * mesma divisao de color-mapper.ts e color-map-loader.ts.
 *
 * **A celula guarda o processo do cliente, nao o cliente.** Medido em
 * 31/08/2026: 649 processos produzem 509 valores distintos em CLT, porque o
 * mesmo cliente aparece com sufixo crescente (docs/uso/RESULTADO.md §2). Sem
 * esta traducao, o ranking de clientes (IND-10) conta processos e chama o
 * resultado de cliente.
 *
 * **A regra e do negocio, e por isso e configuracao.** Ela nao e derivavel do
 * dado: dois prefixos distintos podem ser o mesmo cliente, e um mesmo prefixo
 * pode ser varios — medido, um prefixo de 62 processos cobre TRES clientes,
 * distinguiveis apenas pelo importador. Heuristica aqui adivinharia (regra
 * inviolavel 3).
 *
 * **Chave sem regra permanece como esta.** Nao consolidar e resultado legitimo,
 * e o unico honesto para os 121 processos cujo cliente ainda nao foi declarado.
 */

/** Como o valor da celula e comparado com `value`. Ambos ja normalizados. */
export type ClientMatch = 'prefix' | 'contains' | 'exact'

export interface ClientRule {
  match: ClientMatch
  /** Ja normalizado por `normKey` na carga, para nao normalizar por linha. */
  value: string
  /**
   * Qualifica a regra pelo importador, tambem normalizado. Ausente, a regra
   * vale para qualquer importador.
   *
   * Existe pelo prefixo de 62 processos que cobre tres clientes: sem qualificar,
   * ou a regra casa demais, ou o grupo inteiro fica sem consolidacao.
   */
  importer?: string
}

export interface ClientMapEntry {
  /** Chave de agrupamento do cliente consolidado. Ja normalizada. */
  key: string
  /** Rotulo exibido, com acento e caixa como o operador escreveu. */
  label: string
  rules: readonly ClientRule[]
}

export interface ClientResolution {
  key: string
  label: string
  /** `false` quando nenhuma regra casou — a chave e a da propria celula. */
  mapped: boolean
}

function matches(rule: ClientRule, clientKey: string, importerKey: string): boolean {
  if (rule.importer !== undefined && rule.importer !== importerKey) return false

  switch (rule.match) {
    case 'prefix':
      return clientKey.startsWith(rule.value)
    case 'contains':
      return clientKey.includes(rule.value)
    case 'exact':
      return clientKey === rule.value
  }
}

/**
 * O cliente consolidado de uma celula CLT ja normalizada.
 *
 * **A PRIMEIRA entrada que casa vence**, na ordem do arquivo, e dentro dela a
 * primeira regra. Exigir correspondencia unica recusaria o mapa real: o mesmo
 * cliente aparece por prefixo e por texto contido — `X` como prefixo e `X`
 * dentro de `NOR-77 - X` sao duas regras do mesmo destino. A ordem e a
 * ferramenta de desempate do operador, e por isso ela e documentada no proprio
 * JSON em vez de ser um detalhe de implementacao.
 *
 * Celula vazia nunca casa regra alguma: `''` como prefixo casaria tudo, e a
 * carga ja recusa valor vazio — mas a guarda aqui e barata e local.
 */
export function resolveClient(
  clientKey: string,
  importerKey: string,
  map: readonly ClientMapEntry[],
): ClientResolution {
  if (clientKey === '') return { key: '', label: '', mapped: false }

  for (const entry of map) {
    for (const rule of entry.rules) {
      if (matches(rule, clientKey, importerKey)) {
        return { key: entry.key, label: entry.label, mapped: true }
      }
    }
  }
  return { key: clientKey, label: clientKey, mapped: false }
}

/**
 * Um agrupamento de clientes, exibido como um nivel de arvore no filtro
 * (`H-55`).
 *
 * **O grupo vale so no filtro.** Ranking, tempo documental e cartoes continuam
 * contando cada cliente separado — decisao do operador em 31/08/2026, e o
 * motivo de o grupo NAO virar `clientKey`: fundir as chaves mudaria o valor de
 * IND-10, IND-18 e IND-22 sem ninguem ter pedido.
 *
 * O membro aponta para uma entrada de `clients` que ja existe, pela chave. Mover
 * regra de um lugar para o outro reescreveria o mapa do operador para entregar
 * uma arvore de apresentacao.
 */
export interface ClientGroupMember {
  /** Chave de um cliente declarado em `clients`. */
  client: string
  /**
   * Rotulo do membro DENTRO do grupo. Ausente, vale o rotulo do cliente.
   *
   * Existe porque o cliente que da nome ao grupo precisa de um nome proprio
   * embaixo dele: "Vivi > Vivi" nao diz nada, "Vivi > AV" diz.
   */
  label?: string
}

export interface ClientGroup {
  key: string
  label: string
  members: readonly ClientGroupMember[]
}

/** O grupo de cada cliente, indexado pela chave dele. Um cliente, um grupo. */
export type ClientGroupIndex = ReadonlyMap<string, string>

export function indexClientGroups(groups: readonly ClientGroup[]): ClientGroupIndex {
  const index = new Map<string, string>()
  for (const group of groups) {
    for (const member of group.members) index.set(member.client, group.key)
  }
  return index
}

/**
 * O grupo de um cliente, ou `''` quando ele nao esta em nenhum.
 *
 * Vazio e o caso comum — a maioria dos clientes nao pertence a grupo —, e e
 * chave legitima no filtro, como a celula em branco (TD-04).
 */
export function resolveClientGroup(clientKey: string, index: ClientGroupIndex): string {
  return index.get(clientKey) ?? ''
}

export function normalizeClientGroups(groups: readonly ClientGroup[]): ClientGroup[] {
  return groups.map((group) => ({
    key: normKey(group.key),
    label: group.label,
    members: group.members.map((member) => ({
      client: normKey(member.client),
      ...(member.label === undefined ? {} : { label: member.label }),
    })),
  }))
}

/**
 * Normaliza os textos do mapa UMA vez, na carga.
 *
 * O caminho quente e a ingestao: 649 linhas contra dezenas de regras. Normalizar
 * por comparacao repetiria `normKey` milhares de vezes sobre valores que nao
 * mudam. O `label` NAO passa por aqui — ele e apresentacao, e o acento que o
 * operador escreveu e o que a tela deve mostrar.
 */
export function normalizeClientMap(entries: readonly ClientMapEntry[]): ClientMapEntry[] {
  return entries.map((entry) => ({
    key: normKey(entry.key),
    label: entry.label,
    rules: entry.rules.map((rule) => ({
      match: rule.match,
      value: normKey(rule.value),
      ...(rule.importer === undefined ? {} : { importer: normKey(rule.importer) }),
    })),
  }))
}
