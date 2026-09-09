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
 * e o unico honesto para os processos cujo cliente ainda nao foi declarado —
 * **140 deles, em 111 grafias**, medidos em 08/09/2026 sobre 12 entradas de
 * mapa (`H-88`). O numero que estava aqui, 121, foi medido em `H-49` e
 * envelheceu com o mapa; `clientKeys` e quem os conta agora.
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
 * O que a lista de dividas precisa saber de cada processo (`H-88`).
 *
 * Tipo estrutural, e nao `Process`: a agregacao le quatro campos, e depender do
 * tipo inteiro acoplaria este modulo a `types.ts` sem ganho — `Process` o
 * satisfaz por construcao, e o teste monta o minimo.
 */
export interface PendingClientSource {
  readonly ref: string
  readonly clientProcessKey: string
  /** A grafia da celula, que a tela exibe. Pode diferir da chave (`TD-04`). */
  readonly clientRaw: string
  readonly importerKey: string
}

export interface ClientKeyOwner {
  key: string
  label: string
}

export interface ClientKeyEntry {
  /** A chave normalizada — e ela que casa a regra. */
  key: string
  /** A grafia da celula, como o operador a ve na planilha. */
  label: string
  count: number
  /** Algumas REF, para o operador reconhecer a grafia. */
  samples: string[]
  /** O cliente a que ela pertence hoje, ou `null` quando nenhuma regra casa. */
  client: ClientKeyOwner | null
  /** O pai do cliente, quando ele e membro de um grupo. `null` se nao for. */
  parent: ClientKeyOwner | null
}

/** Um nome que o campo de declaracao oferece, para nao nascer um homonimo. */
export interface ClientName {
  key: string
  label: string
  /** `true` quando o nome ja e um pai — declarar nele acrescenta um filho. */
  isParent: boolean
  /**
   * Quantos clientes ele ja reune. Zero quando nao e pai.
   *
   * A tela mostra o NUMERO, e nao a palavra "agrupa": "Vivi · 4 clientes" diz o
   * que "Vivi agrupa" so insinuava, e ainda informa o tamanho do que o operador
   * esta prestes a engrossar (09/09/2026).
   */
  children: number
}

/** Quantas REF acompanham cada chave. Tres cabem na linha e bastam para reconhecer. */
const SAMPLES_PER_KEY = 3

/**
 * TODA a coluna CLT, com o dono de cada grafia (`H-88`).
 *
 * **Ela mostra o declarado tambem, e isso mudou em 08/09/2026.** A primeira
 * versao trazia so o que faltava declarar, e com isso tornava impossivel pela
 * tela o caso que o usuario descreveu: agrupar `AV` sob `Vivi` exige ver `AV`,
 * que ja e cliente e por isso sumia da lista.
 *
 * **Pertencer se decide por `resolveClient(...).mapped`, e nao pela igualdade
 * entre a chave resolvida e a da celula.** `planClientRule` usa `normKey(label)`
 * como chave da entrada, entao uma grafia declarada com o proprio valor como
 * nome do cliente resolveria para si mesma e a igualdade a chamaria de pendente.
 * Medido na planilha real em 08/09/2026: a igualdade acusa 118 grafias contra as
 * 111 que de fato faltam.
 *
 * **Celula vazia nao entra**: e ausencia de dado, nao cliente por declarar.
 * Medido: 38 das 650 linhas.
 *
 * **A ordem e `count` desc, depois `key` asc.** O desempate nao e enfeite: 83
 * das 111 grafias pendentes valem UM processo cada, e sem ele a lista sai na
 * ordem de insercao — que muda quando alguem insere linha na planilha, e a tela
 * mostraria um conjunto diferente a cada leitura.
 */
export function clientKeys(
  processes: readonly PendingClientSource[],
  map: readonly ClientMapEntry[],
  groups: readonly ClientGroup[] = [],
): ClientKeyEntry[] {
  const index = indexClientGroups(groups)
  const byGroupKey = new Map(groups.map((group) => [group.key, group]))
  const keys = new Map<string, ClientKeyEntry>()

  for (const process of processes) {
    const key = process.clientProcessKey
    if (key === '') continue

    const current = keys.get(key)
    if (current !== undefined) {
      current.count += 1
      if (current.samples.length < SAMPLES_PER_KEY) current.samples.push(process.ref)
      continue
    }

    const owner = resolveClient(key, process.importerKey, map)
    const parentKey = owner.mapped ? resolveClientGroup(owner.key, index) : ''
    const parent = parentKey === '' ? undefined : byGroupKey.get(parentKey)

    keys.set(key, {
      key,
      label: process.clientRaw,
      count: 1,
      samples: [process.ref],
      client: owner.mapped ? { key: owner.key, label: owner.label } : null,
      parent: parent ? { key: parent.key, label: parent.label } : null,
    })
  }

  return [...keys.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * O que muda no arquivo ao desfazer (`H-88`, determinacao 9).
 *
 * **Desfazer NAO apaga cliente nenhum.** `groups[]` e camada de exibicao sobre
 * `clients[]`: tirar um filho devolve o cliente ao ranking com a contagem que
 * sempre teve, e desfazer o pai devolve todos. Nenhuma regra e tocada.
 */
export interface ClientGroupRemoval {
  kind: 'membro-removido' | 'grupo-desfeito'
  /** O pai afetado. */
  key: string
  /** Quem sai, em `membro-removido`. */
  client?: string
  /**
   * `true` quando a remocao deixa o pai com UM filho so, e por isso o desfaz.
   *
   * Arvore de um galho e ruido: o ranking mostraria o mesmo numero duas vezes,
   * indentado uma nele.
   */
  dissolves: boolean
  /**
   * As entradas de `clients[]` que saem JUNTO — escolha do usuario em
   * 08/09/2026, e a segunda metade do que os botoes fazem.
   *
   * **Desagrupar e desdeclarar viraram uma operacao so.** Antes o vinculo saia e
   * a regra ficava, e desfazer uma declaracao errada exigia editar o JSON. O
   * usuario preferiu o botao que desfaz de verdade, ciente de que perde a
   * operacao intermediaria — tirar um cliente do pai mantendo-o solto deixou de
   * existir.
   *
   * **O filho que SOBRA quando o pai se dissolve nao entra aqui:** ele nao foi
   * pedido, e some do grupo por consequencia, nao por escolha.
   */
  removes: string[]
}

export type ClientGroupRejection = 'GRUPO_INEXISTENTE' | 'MEMBRO_INEXISTENTE'

export function planGroupRemoval(
  groupKey: string,
  clientKey: string | null,
  groups: readonly ClientGroup[],
): ClientGroupRemoval | ClientGroupRejection {
  const key = normKey(groupKey)
  const group = groups.find((candidate) => normKey(candidate.key) === key)
  if (group === undefined) return 'GRUPO_INEXISTENTE'

  if (clientKey === null) {
    return {
      kind: 'grupo-desfeito',
      key: group.key,
      dissolves: true,
      removes: group.members.map((member) => normKey(member.client)),
    }
  }

  const client = normKey(clientKey)
  if (!group.members.some((member) => normKey(member.client) === client)) {
    return 'MEMBRO_INEXISTENTE'
  }

  return {
    kind: 'membro-removido',
    key: group.key,
    client,
    dissolves: group.members.length <= 2,
    removes: [client],
  }
}

export interface DeclaredClient {
  key: string
  label: string
  /** O pai, quando ele for filho de um. `null` quando esta solto. */
  parent: ClientKeyOwner | null
  /** Quantas grafias da coluna CLT ele consolida. */
  keys: number
  /** Quantos processos essas grafias somam. */
  count: number
}

/**
 * Os clientes JA declarados, com o peso de cada um (`H-88`).
 *
 * **Ela lista CLIENTES, e nao grafias**, e a diferenca e o que torna a tabela
 * util: `AV` consolida 304 grafias que diriam todas "Vivi > AV", e desfazer age
 * sobre o cliente — nao sobre cada celula.
 *
 * **Cliente sem grafia nenhuma aparece com zero**, e nao some: uma regra que
 * nao casa nada e um erro de declaracao que o operador precisa ver para
 * corrigir. Some-la seria descarte silencioso (regra inviolavel 2).
 */
export function declaredClients(
  processes: readonly PendingClientSource[],
  map: readonly ClientMapEntry[],
  groups: readonly ClientGroup[] = [],
): DeclaredClient[] {
  const index = indexClientGroups(groups)
  const byGroupKey = new Map(groups.map((group) => [group.key, group]))
  const declared = new Map<string, DeclaredClient>()

  for (const entry of map) {
    const parentKey = resolveClientGroup(entry.key, index)
    const parent = parentKey === '' ? undefined : byGroupKey.get(parentKey)
    declared.set(entry.key, {
      key: entry.key,
      label: entry.label,
      parent: parent ? { key: parent.key, label: parent.label } : null,
      keys: 0,
      count: 0,
    })
  }

  const seen = new Set<string>()
  for (const process of processes) {
    const key = process.clientProcessKey
    if (key === '') continue

    const owner = resolveClient(key, process.importerKey, map)
    if (!owner.mapped) continue

    const target = declared.get(owner.key)
    if (target === undefined) continue
    target.count += 1
    if (!seen.has(`${owner.key}\u0000${key}`)) {
      seen.add(`${owner.key}\u0000${key}`)
      target.keys += 1
    }
  }

  // Os filhos de um mesmo pai ficam juntos, e o mais pesado primeiro — a tabela
  // e de manutencao, e o que pesa e o que o operador confere antes.
  return [...declared.values()].sort(
    (a, b) =>
      (a.parent?.label ?? '').localeCompare(b.parent?.label ?? '') ||
      b.count - a.count ||
      a.label.localeCompare(b.label),
  )
}

/**
 * Os nomes que o campo de declaracao oferece (`H-88`).
 *
 * **Existe por um defeito observado:** declarando "Vivi" a mao, o operador criou
 * um cliente `VIVI` ao lado do pai `Vivi` que ja existia, e o ranking passou a
 * mostrar os dois — 326 e 58 — como se fossem clientes diferentes. Oferecer os
 * nomes existentes e o que impede o homonimo.
 *
 * O pai aparece com `isParent`, porque declarar nele tem efeito diferente:
 * acrescenta um filho em vez de somar regra.
 */
export function clientNames(
  map: readonly ClientMapEntry[],
  groups: readonly ClientGroup[] = [],
): ClientName[] {
  const names = groups.map((group) => ({
    key: group.key,
    label: group.label,
    isParent: true,
    children: group.members.length,
  }))
  const inGroup = new Set(groups.flatMap((group) => group.members.map((member) => member.client)))

  for (const entry of map) {
    // O filho nao se oferece: quem recebe conjunto e o PAI dele. Ofereces-lo
    // faria o operador acrescentar regra a um membro sem perceber que a barra
    // que ele ve no grafico e a do pai.
    if (inGroup.has(entry.key)) continue
    names.push({ key: entry.key, label: entry.label, isParent: false, children: 0 })
  }

  return names.sort((a, b) => a.label.localeCompare(b.label))
}

/** Uma grafia que a regra candidata alcanca, mas que ja tem dono. */
export interface ReachedKey {
  key: string
  /** O cliente a que ela ja pertence. */
  label: string
  count: number
}

export interface RuleReach {
  match: ClientMatch
  /** O valor da regra, ja normalizado. */
  value: string
  /** Quantas grafias a regra passaria a consolidar. */
  keys: number
  /** Quantos processos essas grafias somam. */
  processes: number
  /** Algumas das grafias alcancadas, para o operador reconhecer o que declarou. */
  samples: string[]
  /**
   * As grafias que a regra CASA e nao leva, porque ja tem dono.
   *
   * Elas nao entram em `keys` nem em `processes`: a regra nova entra no fim do
   * mapa, e a primeira entrada que casa vence. Isto e informacao — "estas
   * continuam com quem ja tem" —, e nao perda.
   */
  alreadyMapped: ReachedKey[]
}

/** Quantas grafias acompanham a previsao. Tres bastam para reconhecer o grupo. */
const REACH_SAMPLES = 3

/**
 * O que uma regra candidata capturaria, ANTES de ela ser gravada (`H-88`).
 *
 * **Existe porque prefixo captura mais do que parece, e isso esta medido nos
 * dados do operador:** `Y` e `YT` sao prefixos distintos na planilha, e `Y`
 * casa `YT-769` — sem ver o alcance, o operador declara `Y` supondo quatro
 * grafias e alcanca sessenta e duas. O cabecalho deste modulo registra o caso
 * irmao: um prefixo de 62 processos que cobre TRES clientes.
 *
 * **Nao sugere nada** (regra inviolavel 3, e determinacao 4 de `D-32`): quem
 * digita o valor e o operador, e esta funcao so conta o que ele digitou.
 */
export function ruleReach(
  processes: readonly PendingClientSource[],
  map: readonly ClientMapEntry[],
  match: ClientMatch,
  rawValue: string,
): RuleReach {
  const value = normKey(rawValue)
  const reach: RuleReach = {
    match,
    value,
    keys: 0,
    processes: 0,
    samples: [],
    alreadyMapped: [],
  }
  // Valor vazio casaria tudo como prefixo e nada como exact: em vez de devolver
  // um alcance que a gravacao recusaria, devolve zero — a tela nao mostra numero
  // ate haver o que contar.
  if (value === '') return reach

  const candidate: ClientRule = { match, value }
  const free = new Map<string, number>()
  const taken = new Map<string, ReachedKey>()

  for (const process of processes) {
    const key = process.clientProcessKey
    if (key === '') continue
    if (!matches(candidate, key, process.importerKey)) continue

    const owner = resolveClient(key, process.importerKey, map)
    if (owner.mapped) {
      const current = taken.get(key)
      if (current === undefined) taken.set(key, { key, label: owner.label, count: 1 })
      else current.count += 1
      continue
    }
    free.set(key, (free.get(key) ?? 0) + 1)
  }

  reach.keys = free.size
  reach.processes = [...free.values()].reduce((total, count) => total + count, 0)
  reach.samples = [...free.keys()].sort().slice(0, REACH_SAMPLES)
  reach.alreadyMapped = [...taken.values()].sort((a, b) => a.key.localeCompare(b.key))
  return reach
}

/**
 * O que precisa mudar no mapa para que uma celula CLT passe a pertencer a um
 * cliente — a volta do caminho que `resolveClient` faz na ida (02/09/2026).
 *
 * **Aqui so se PLANEJA.** Quem escreve o arquivo e `src/app/client-map-loader.ts`,
 * e escreve no JSON CRU: o mapa em memoria vem normalizado, e serializa-lo de
 * volta apagaria a grafia do operador e as chaves `_comentario_*`, que a
 * convencao do repositorio manda preservar.
 */
export interface ClientRulePlan {
  /**
   * **Os dois ultimos nasceram em 08/09/2026**, quando o usuario descreveu o
   * comportamento que quer: para ele nao ha dois conceitos — ha um nome que
   * recebe conjuntos da coluna CLT, e o PAI e o que acontece quando o segundo
   * conjunto chega ao mesmo nome.
   */
  kind:
    | 'entrada-nova'
    | 'regra-acrescentada'
    | 'sem-efeito'
    | 'grupo-criado'
    | 'membro-acrescentado'
  /** Chave normalizada da entrada alvo — o cliente, ou o PAI nos dois ultimos. */
  key: string
  /** Como a regra compara — `exact` sobre uma grafia, `prefix` sobre um grupo. */
  match: ClientMatch
  /** O rotulo como o operador escreveu — so a entrada nova o usa. */
  label: string
  /** A regra `exact` a acrescentar, com o valor da celula ja normalizado. */
  value: string
  /**
   * Onde a entrada alvo precisa ficar. Na entrada NOVA, `null` e o fim da lista;
   * na que ja existe, `null` e "fica onde esta".
   *
   * **E o mecanismo, e nao um detalhe de ordenacao.** A primeira entrada que
   * casa vence: uma regra `exact` acrescentada DEPOIS da entrada de prefixo que
   * ja casa a celula nunca seria alcancada, e a edicao viraria um no-op
   * silencioso (regra inviolavel 2).
   */
  beforeKey: string | null
  /**
   * O filho que esta declaracao cria, nomeado pelo VALOR da regra.
   *
   * Presente so nos dois kinds de pai. O nome sai do valor porque e o que a
   * PROPRIA coluna CLT explica — "Vivi > Vivi" nao diz nada, "Vivi > YT" diz.
   */
  child?: ClientKeyOwner
  /**
   * O cliente que existia e vira filho quando o pai nasce (`grupo-criado`).
   *
   * Ele leva o valor da PRIMEIRA regra dele por nome: com uma regra so o nome e
   * obvio, e com varias — `Rikko` tem cinco — a primeira e a que vence o
   * casamento, entao e a que descreve o conjunto.
   */
  demoted?: ClientKeyOwner
}

/** Por que o mapa nao pode receber a regra. A rota traduz para 400. */
export type ClientRuleRejection = 'ROTULO_VAZIO' | 'CELULA_VAZIA' | 'NOME_E_FILHO'

/**
 * Planeja a regra que faz `clientKey` resolver para o cliente `label`.
 *
 * **O alcance e UMA linha, por construcao.** A regra e `exact` sobre o valor da
 * celula, entao declarar o cliente de `AV-480` nao move `AV-397` nem as outras
 * 60 do mesmo prefixo. Consolidar um grupo inteiro continua sendo trabalho de
 * quem edita o arquivo — inferir o prefixo a partir de uma linha seria adivinhar
 * (regra inviolavel 3), e a planilha real tem um prefixo que cobre TRES
 * clientes.
 */
export function planClientRule(
  clientKey: string,
  importerKey: string,
  label: string,
  map: readonly ClientMapEntry[],
  match: ClientMatch = 'exact',
  groups: readonly ClientGroup[] = [],
): ClientRulePlan | ClientRuleRejection {
  const key = normKey(label)
  if (key === '') return 'ROTULO_VAZIO'

  /**
   * **O valor entra NORMALIZADO, e isso nao era verdade ate `H-88`.**
   *
   * Vindo de `process-client.ts` ele ja era — `clientProcessKey` e normalizado
   * na carga —, e a rota nova o recebe DIGITADO. Um `yt` escrito a mao ia para o
   * arquivo em minuscula, e `saveClientRule` compara `normKey(rule.value)` com
   * `plan.value`: a segunda declaracao do mesmo valor nao reconhecia a primeira
   * e acrescentava uma regra duplicada. Medido em 08/09/2026, sobre uma regra
   * `contains` gravada como `yt` entre outras doze em maiuscula.
   */
  const value = normKey(clientKey)
  // Celula vazia nunca casa regra alguma, e `''` como valor de regra e recusado
  // na carga: nao ha o que declarar enquanto a celula B nao tiver conteudo.
  if (value === '') return 'CELULA_VAZIA'

  /**
   * **Regra ABRANGENTE nunca disputa lugar, e a `exact` sim.**
   *
   * `exact` e cirurgica: o operador aponta UMA grafia e a quer naquele cliente,
   * mesmo que um prefixo ja a pegue — por isso ela precisa vencer, e `beforeKey`
   * a poe na frente. `prefix` e `contains` sao o oposto: o operador nao enumera
   * o que capturam, e move-las para a frente roubaria grafias que ja tem dono,
   * em silencio. Elas entram no FIM, e a primeira entrada que casa continua
   * vencendo — e o que `ruleReach` reporta em `alreadyMapped`.
   */
  const disputesPlace = match === 'exact'

  /**
   * **A chave normaliza; o ROTULO preserva a grafia digitada.**
   *
   * E a mesma divisao de `clientKey` e `clientLabel` em `Process`: a chave casa
   * a regra (`TD-04`), e o rotulo e o que a tela mostra. Ate 09/09/2026 os dois
   * saiam de `normKey`, e quem digitava "Kelly" via "KELLY" declarado — o
   * operador escreve o nome, nao a chave.
   */
  const child: ClientKeyOwner = { key: value, label: clientKey.trim() }

  // O PAI vem antes do cliente na busca pelo alvo: com os dois existindo sob
  // nomes parecidos — `Vivi` e `VIVI`, que foi o defeito de 08/09/2026 —, quem
  // recebe conjunto e o pai.
  const parent = groups.find((group) => normKey(group.label) === key || group.key === key)
  if (parent !== undefined) {
    const already = parent.members.some((member) => member.client === child.key)
    return {
      kind: already ? 'sem-efeito' : 'membro-acrescentado',
      key: parent.key,
      match,
      label,
      value,
      beforeKey: null,
      child,
    }
  }

  /**
   * **Nome que ja e FILHO nao recebe conjunto** — recusado, e nao contornado.
   *
   * Declarar em `AV`, que esta dentro de `Vivi`, faria nascer um pai `AV` com o
   * filho `AV` — pai dentro de pai, que `ClientGroupIndex` nao representa: ele e
   * um mapa cliente → grupo, com UM grupo por cliente. O ranking desenharia a
   * arvore errada, ou nao a desenharia.
   *
   * A tela ja nao oferece o filho na lista de nomes; isto e a defesa para quem
   * digita. Achado em 08/09/2026, simulando as declaracoes contra o mapa real.
   */
  const isChild = groups.some((group) =>
    group.members.some((member) => normKey(member.client) === key),
  )
  if (isChild) return 'NOME_E_FILHO'

  const current = resolveClient(value, importerKey, map)
  const matchIndex =
    disputesPlace && current.mapped ? map.findIndex((entry) => entry.key === current.key) : -1
  const beforeKey = matchIndex === -1 ? null : (map[matchIndex]?.key ?? null)

  /**
   * O alvo se acha pelo NOME, e nao pela chave. O operador digita "Alfa
   * Comercio"; a chave daquela entrada pode ser `ALFA`, escolhida por quem
   * escreveu o arquivo. Comparar so com a chave criaria uma segunda entrada para
   * um cliente que ja existe, e a tela passaria a mostrar dois.
   */
  const targetIndex = map.findIndex((entry) => normKey(entry.label) === key || entry.key === key)
  const target = targetIndex === -1 ? null : map[targetIndex]

  if (disputesPlace && current.mapped && targetIndex !== -1 && current.key === target?.key) {
    return { kind: 'sem-efeito', key: current.key, match, label, value, beforeKey: null }
  }

  if (target === undefined || target === null) {
    return { kind: 'entrada-nova', key, match, label, value, beforeKey }
  }

  /**
   * **O nome ja existe como cliente, e este e o SEGUNDO conjunto: nasce o pai.**
   *
   * O cliente que existia vira filho, nomeado pelo valor da primeira regra dele,
   * e o conjunto novo entra como irmao. E a determinacao 8 de `H-88`, e o que a
   * imagem do ranking mostra: uma barra somada, com os dois indentados.
   */
  const firstRule = target.rules[0]
  if (firstRule !== undefined && normKey(firstRule.value) !== child.key) {
    const demotedKey = normKey(firstRule.value)
    return {
      kind: 'grupo-criado',
      key: target.key,
      match,
      label,
      value,
      beforeKey: null,
      child,
      demoted: { key: demotedKey, label: demotedKey },
    }
  }

  // A entrada alvo ja existe. Ela so precisa MUDAR DE LUGAR quando esta depois
  // da que casa hoje; a frente dela, a regra nova ja vence onde esta.
  return {
    kind: 'regra-acrescentada',
    key: target.key,
    match,
    label,
    value,
    beforeKey: matchIndex !== -1 && targetIndex > matchIndex ? beforeKey : null,
  }
}

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
