import { UNASSIGNED_RESPONSIBLE_LABEL } from './filters.ts'
import { normKey } from './normalizer.ts'

/**
 * Atribuicao do processo a uma pessoa da equipe, pelo IMPORTADOR — e por nada
 * mais.
 *
 * Funcao PURA: recebe o mapa ja carregado (ADR-0006).
 *
 * **A COR NAO PARTICIPA, desde `H-93`.** Ela desempatava o que a lista de
 * importadores nao alcancava, e `D-40` a tirou: com a tela de `H-91`
 * existindo, quem nao tem importador declarado passa a ter onde declara-lo, e o
 * argumento que sustentava o desempate deixa de valer por merito. O que a cor
 * diz continua visivel, em `colorResponsible` — campo proprio, que este modulo
 * nao le.
 *
 * **A regra inviolavel 4 nao e tocada, e agora vale mais forte:** a cor nunca
 * inferiu status, e passou a nao inferir nada.
 *
 * **Nao atribuir e resultado legitimo, e passou a ser o caso comum.** Medido em
 * 10/09/2026 sobre as 649 linhas: 559 processos tem responsavel pelo
 * importador e **90** ficam sem — 48 a mais que antes, e os 48 sao todos
 * ativos. Empurra-los para alguem produziria um numero plausivel e errado
 * (regra inviolavel 3); "Sem responsavel" e destino, e nao ausencia.
 */

export interface TeamMember {
  /**
   * Chave impessoal do membro. Nome de pessoa vive no `label`, que sai de
   * arquivo nao versionado — regra inviolavel 8, a mesma que mantem nome de
   * cliente fora do log e que ja fez `Responsible` nascer impessoal.
   */
  key: string
  label: string
  /**
   * Chaves de importador desta pessoa, ja normalizadas na carga.
   *
   * **E o unico criterio desde `H-93`.** Vazia e legitima: alguem entrou na
   * equipe e ainda nao recebeu importador.
   */
  importers: readonly string[]
}

/**
 * `'cor'` saiu em `H-93`, junto com o desempate que o produzia.
 *
 * O campo sobrevive com dois valores porque continua dizendo algo que a chave
 * sozinha nao diz: `'nenhum'` e a resolucao que NAO atribuiu, e distingue-la de
 * uma atribuicao e o que permite a tela falar de "Sem responsavel" como destino.
 */
export type TeamSource = 'importador' | 'nenhum'

export interface TeamResolution {
  /** Vazia quando nao ha atribuicao. Chave vazia e valor de dominio, nao ausencia. */
  key: string
  label: string
  source: TeamSource
}

const UNASSIGNED: TeamResolution = { key: '', label: '', source: 'nenhum' }

/**
 * Casa o importador com uma entrada da lista, tolerando sufixo de filial.
 *
 * Medido: tres importadores aparecem tambem com sufixo apos ` - `
 * (docs/uso/RESULTADO.md §3). A filial e o mesmo importador para efeito de
 * responsavel, e exigir que o operador liste as duas grafias transformaria uma
 * filial nova num processo sem dono, em silencio.
 *
 * O separador e literal, nao heuristico: `startsWith(valor)` sozinho casaria
 * `SUR` com `SURLA`, que sao importadores diferentes na planilha real.
 */
function ownsImporter(member: TeamMember, importerKey: string): boolean {
  return member.importers.some(
    (owned) => importerKey === owned || importerKey.startsWith(`${owned} - `),
  )
}

/**
 * A pessoa responsavel pelo processo.
 *
 * Ordem de avaliacao, e ela tem UM nivel desde `H-93`:
 *
 * 1. Importador declarado na lista de alguem.
 * 2. Nada.
 *
 * **Eram quatro, e `D-40` derrubou dois.** O nivel 0 devolvia a propria chave
 * de cor quando o mapa estava vazio (`D-23`); o nivel 3 usava a cor para
 * desempatar o que a lista nao alcancava; e o `fallback` varria "todo o resto"
 * para um membro. Os tres caem pelo mesmo motivo, dito pelo usuario em
 * 10/09/2026: *"o fallback deve cair no Sem responsavel, que ai o usuario ja
 * sabe que tem que definir um"*. E a regra inviolavel 3 aplicada ao proprio
 * mapa — cobertura total trocada por enxergar o que nao se sabe.
 *
 * **Mapa vazio devolve `UNASSIGNED` nas 649 linhas, e isso agora e o desejado.**
 * Era exatamente o que `D-23` existia para evitar, quando nao havia tela para
 * declarar a equipe; com `H-91` entregue, ha.
 *
 * O parametro da cor saiu junto: sem os niveis 0 e 3 ele nao tinha leitor.
 */
export function resolveTeam(importerKey: string, map: readonly TeamMember[]): TeamResolution {
  const byImporter = map.find((member) => ownsImporter(member, importerKey))
  if (byImporter) {
    return { key: byImporter.key, label: byImporter.label, source: 'importador' }
  }
  return UNASSIGNED
}

/**
 * Todas as chaves que `resolveTeam` pode devolver, com o rotulo de cada uma.
 *
 * Existe para o ranking de IND-20 e para a rota de opcoes exibirem a chave
 * ZERADA: pessoa declarada no mapa e sem processo algum aparece, pela mesma
 * razao de A-28. Derivar as chaves dos processos carregados faria essa pessoa
 * sumir da tela, e o operador leria a ausencia como "nao existe" em vez de
 * "nao tem processo".
 *
 * **Sem mapa, sobra so a chave vazia**, e e o certo desde `H-93`: sem equipe
 * declarada nenhum processo tem responsavel, e oferecer as quatro chaves de cor
 * — o que `D-23` fazia — anunciaria um dominio que `resolveTeam` nao produz
 * mais. O filtro ficaria com quatro opcoes zeradas e nenhuma util.
 */
export function knownResponsibles(map: readonly TeamMember[]): { key: string; label: string }[] {
  return [
    ...map.map((member) => ({ key: member.key, label: member.label })),
    { key: '', label: UNASSIGNED_RESPONSIBLE_LABEL },
  ]
}

/** Normaliza as chaves de importador UMA vez, na carga. O `label` nao passa. */
export function normalizeTeamMap(members: readonly TeamMember[]): TeamMember[] {
  return members.map((member) => ({
    key: member.key,
    label: member.label,
    importers: member.importers.map(normKey),
  }))
}

/**
 * O que o painel de `H-91` precisa de cada processo.
 *
 * Estrutural, e nao `Process`: a fatia de uma pagina nao deveria obrigar cada
 * teste de dominio a montar as 40 colunas de um processo inteiro. Mesma escolha
 * de `PendingClientSource` em `client-mapper.ts`.
 */
export interface TeamProcessSource {
  importerKey: string
  responsible: string
}

export interface TeamMemberPlan {
  key: string
  label: string
  importers: readonly string[]
  /** Processos atribuidos a esta pessoa — o mesmo numero que IND-20 mostra. */
  count: number
}

export interface UnassignedImporter {
  key: string
  count: number
}

export interface TeamPlan {
  members: TeamMemberPlan[]
  unassigned: UnassignedImporter[]
  /**
   * A chave IMPESSOAL do proximo responsavel, gerada AQUI e nunca derivada do
   * nome digitado.
   *
   * **E a regra inviolavel 8 aplicada ao proprio mapa.** A chave viaja pelo
   * dominio inteiro, entra no ranking de IND-20 e vira parametro de URL no
   * filtro Responsavel; derivada do `label`, como `H-88` faz com o cliente, ela
   * levaria o nome da pessoa para todos esses lugares. O nome fica no `label`,
   * que so a tela le.
   */
  nextKey: string
  /**
   * Linhas com IMPORTADOR em branco — 35 na planilha real, medidas em
   * 08/09/2026 e reconfirmadas em 10/09.
   *
   * Contadas e exibidas, nunca oferecidas: nenhuma carteira as alcanca por
   * construcao, e some-las do painel seria descarte silencioso (regra
   * inviolavel 2). O conserto delas e preencher a coluna C, editavel desde
   * `H-80`.
   */
  blankImporters: number
}

const MEMBER_KEY_PREFIX = 'membro'

/**
 * Sobreposicao entre duas chaves de importador, nos DOIS sentidos.
 *
 * `ownsImporter` pergunta se um membro alcanca um importador; aqui a pergunta e
 * se duas declaracoes brigam, e ela e simetrica: listar `ACME` numa carteira e
 * `ACME - SC` noutra e a mesma sobreposicao, porque o sufixo de filial casa —
 * e qual das duas grafias foi digitada primeiro nao muda isso.
 */
function overlaps(one: string, other: string): boolean {
  return one === other || one.startsWith(`${other} - `) || other.startsWith(`${one} - `)
}

/**
 * A primeira chave `membro<N>` livre.
 *
 * **Livre, e nao "a seguinte":** desfazer o `membro2` de uma equipe de tres
 * devolve `membro2` ao proximo que entrar, em vez de abrir buraco e crescer
 * para sempre. A comparacao ignora caixa porque a chave nao passa por
 * `normalizeTeamMap` — so os importadores passam.
 */
export function nextMemberKey(map: readonly TeamMember[]): string {
  const taken = new Set(map.map((member) => member.key.toLowerCase()))
  // Com `map.length` chaves tomadas, um dos `map.length + 1` primeiros ordinais
  // esta livre — casa dos pombos. O retorno final e alcancavel so por tipo.
  for (let ordinal = 1; ordinal <= map.length + 1; ordinal++) {
    const candidate = `${MEMBER_KEY_PREFIX}${ordinal}`
    if (!taken.has(candidate)) return candidate
  }
  return `${MEMBER_KEY_PREFIX}${map.length + 1}`
}

/**
 * O estado do mapa de equipe para o painel de `H-91`: as carteiras, o que
 * ninguem reivindica, e a chave do proximo.
 *
 * **Os membros saem na ordem do ARQUIVO**, e nao por contagem: e a equipe do
 * operador, e uma lista que se reordena a cada leitura faz o botao de desfazer
 * mudar de lugar entre uma conferida e outra. Os nao-atribuidos saem por
 * `count` desc e `key` asc, como o painel de clientes — ali a ordem e
 * prioridade de trabalho, e o desempate impede que inserir linha na planilha
 * embaralhe a lista.
 *
 * Nada aqui decide quem e responsavel: quem decide e `resolveTeam`, e este
 * modulo so conta o que ela ja resolveu.
 */
export function teamPlan(
  processes: readonly TeamProcessSource[],
  map: readonly TeamMember[],
): TeamPlan {
  const byResponsible = new Map<string, number>()
  const orphans = new Map<string, number>()
  let blankImporters = 0

  for (const process of processes) {
    byResponsible.set(process.responsible, (byResponsible.get(process.responsible) ?? 0) + 1)

    if (process.importerKey === '') {
      blankImporters++
      continue
    }
    if (map.some((member) => ownsImporter(member, process.importerKey))) continue
    orphans.set(process.importerKey, (orphans.get(process.importerKey) ?? 0) + 1)
  }

  return {
    members: map.map((member) => ({
      key: member.key,
      label: member.label,
      importers: member.importers,
      count: byResponsible.get(member.key) ?? 0,
    })),
    unassigned: [...orphans.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((one, other) => other.count - one.count || one.key.localeCompare(other.key)),
    nextKey: nextMemberKey(map),
    blankImporters,
  }
}

export interface TeamMemberSave {
  kind: 'membro-criado' | 'membro-redefinido'
  key: string
  label: string
  /** Ja normalizadas, e sem repeticao. */
  importers: string[]
}

export type TeamRejection =
  | { code: 'CHAVE_VAZIA' }
  | { code: 'ROTULO_VAZIO' }
  | { code: 'IMPORTADOR_VAZIO'; at: number }
  | { code: 'IMPORTADOR_EM_DUAS_CARTEIRAS'; importer: string; owner: string; ownerLabel: string }

/**
 * Cria ou redefine um responsavel (`H-91`).
 *
 * **Carteira vazia e legitima**, e foi a emenda de 11/09/2026: alguem entra na
 * equipe e ainda nao recebeu importador. Ate aqui `validateMember` recusava esse
 * arquivo e matava a partida — a operacao que o painel oferece e DESFAZER, nao
 * esvaziar, e um membro sem carteira apenas aparece com zero.
 *
 * **Importador em duas carteiras e recusado, e nao desempatado.** IND-20 conta
 * por pessoa, e a soma deixaria de fechar com o total; escolher uma das duas
 * por ordem de arquivo produziria um numero plausivel e errado (regra
 * inviolavel 3). A recusa nomeia o outro dono, porque e ele que o operador
 * precisa abrir para corrigir.
 */
export function planTeamMember(
  key: string,
  label: string,
  importers: readonly string[],
  map: readonly TeamMember[],
): TeamMemberSave | TeamRejection {
  const memberKey = key.trim()
  if (memberKey === '') return { code: 'CHAVE_VAZIA' }

  const memberLabel = label.trim()
  if (memberLabel === '') return { code: 'ROTULO_VAZIO' }

  const wanted: string[] = []
  for (const [at, raw] of importers.entries()) {
    const importer = normKey(raw)
    if (importer === '') return { code: 'IMPORTADOR_VAZIO', at }
    if (!wanted.includes(importer)) wanted.push(importer)
  }

  const mine = memberKey.toLowerCase()
  for (const importer of wanted) {
    const owner = map.find(
      (member) =>
        member.key.toLowerCase() !== mine &&
        member.importers.some((owned) => overlaps(importer, owned)),
    )
    if (owner !== undefined) {
      return {
        code: 'IMPORTADOR_EM_DUAS_CARTEIRAS',
        importer,
        owner: owner.key,
        ownerLabel: owner.label,
      }
    }
  }

  return {
    kind: map.some((member) => member.key.toLowerCase() === mine)
      ? 'membro-redefinido'
      : 'membro-criado',
    key: memberKey,
    label: memberLabel,
    importers: wanted,
  }
}

export interface TeamRemoval {
  kind: 'membro-desfeito' | 'importador-removido'
  key: string
  /** `null` quando o membro inteiro saiu. */
  importer: string | null
  /** Os importadores que voltam para "Sem responsavel". */
  releases: string[]
}

export type TeamRemovalRejection =
  | { code: 'MEMBRO_INEXISTENTE' }
  | { code: 'IMPORTADOR_INEXISTENTE' }

/**
 * Desfaz um responsavel, ou tira um importador da carteira dele (`H-91`).
 *
 * **Nenhum processo fica sem grupo.** O que sai e o vinculo importador →
 * pessoa; os processos caem em "Sem responsavel", que ja existe em
 * `knownResponsibles` e ja aparece no filtro e em IND-20 — a historia o
 * alimenta, nao o cria.
 *
 * `releases` diz o que volta a nao ter dono, e e o que a tela mostra ao operador
 * depois da operacao: desfazer sem dizer quantos importadores mudaram de mao
 * esconderia o efeito real do clique.
 */
export function planTeamRemoval(
  key: string,
  importer: string | null,
  map: readonly TeamMember[],
): TeamRemoval | TeamRemovalRejection {
  const wanted = key.trim().toLowerCase()
  const member = map.find((candidate) => candidate.key.toLowerCase() === wanted)
  if (member === undefined) return { code: 'MEMBRO_INEXISTENTE' }

  if (importer === null) {
    return {
      kind: 'membro-desfeito',
      key: member.key,
      importer: null,
      releases: [...member.importers],
    }
  }

  const target = normKey(importer)
  if (!member.importers.includes(target)) return { code: 'IMPORTADOR_INEXISTENTE' }

  return {
    kind: 'importador-removido',
    key: member.key,
    importer: target,
    releases: [target],
  }
}
