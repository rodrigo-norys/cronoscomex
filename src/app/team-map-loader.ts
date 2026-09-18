import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { normKey } from '../domain/normalizer.ts'
import {
  normalizeTeamMap,
  overlaps,
  type TeamMember,
  type TeamMemberSave,
  type TeamRemoval,
} from '../domain/team-mapper.ts'
import { readJsonConfig } from './json-config.ts'

/**
 * Carrega e valida `team-map.json`. O I/O vive aqui (ADR-0006).
 *
 * Sem o prefixo `config/` pela mesma razao de `client-map-loader.ts`: o arquivo
 * nao e versionado, e a guarda de ancora morta cobra existencia em disco.
 *
 * **Arquivo ausente devolve lista vazia**, pelo mesmo motivo de
 * `loadClientMap`: sem mapa de equipe a aplicacao volta a atribuir responsavel
 * so pela cor, que e o comportamento anterior a H-50 e continua correto.
 *
 * **Nome de pessoa vive neste arquivo, e ele nao e versionado.** Regra
 * inviolavel 8 — a mesma que mantem nome de cliente fora do log. O `key` e
 * impessoal e viaja pelo dominio; o `label` fica na apresentacao.
 */

export const DEFAULT_TEAM_MAP_PATH = 'config/team-map.json'

export class TeamMapError extends Error {
  override readonly name = 'TeamMapError'
}

export interface TeamMapFile {
  version: number
  members: TeamMember[]
}

function validateStringList(raw: unknown, where: string): string[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new TeamMapError(`${where} precisa ser uma lista.`)
  }
  return raw.map((value, index) => {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TeamMapError(`${where}[${index}] deve ser um texto nao vazio.`)
    }
    return value
  })
}

function validateMember(raw: unknown, position: number): TeamMember {
  const where = `members[${position}]`
  if (!raw || typeof raw !== 'object') {
    throw new TeamMapError(`${where} deve ser um objeto.`)
  }
  const member = raw as Record<string, unknown>

  const key = member.key
  if (typeof key !== 'string' || key.trim() === '') {
    throw new TeamMapError(
      `${where}.key e obrigatorio. Use chave impessoal — o nome vai em "label".`,
    )
  }
  const importers = validateStringList(member.importers, `${where}.importers`)

  /*
    **Carteira vazia e LEGITIMA desde `H-91`**, e a validacao afrouxou para
    exigir so a chave.

    Ate aqui um membro sem importador, sem cor e sem `fallback` matava a partida
    com `process.exit(1)`, pelo argumento de que ele nunca receberia processo —
    o mesmo defeito de `rules` vazia no mapa de clientes. O argumento caiu
    quando a tela passou a criar membro: alguem entra na equipe e ainda nao
    recebeu importador, e recusar o arquivo transformaria um estado normal do
    painel em painel nenhum. A pessoa aparece com zero, que e o que `A-28` ja
    manda fazer para quem nao tem processo.
  */

  return {
    key,
    label: typeof member.label === 'string' && member.label.trim() !== '' ? member.label : key,
    importers,
  }
}

/**
 * Le o mapa de equipe. Lista vazia quando o arquivo nao existe.
 *
 * **A unicidade conferida e a da CHAVE**, e ela e a que produz comportamento
 * silenciosamente errado: duas entradas com a mesma chave fariam a segunda
 * parecer uma pessoa sem processos em vez de um erro de configuracao.
 *
 * A checagem de `fallback` duplicado saiu em `H-93`, com o proprio `fallback`
 * (`D-40`). Os campos que sobrarem em arquivos antigos sao **ignorados**, nao
 * recusados: o mapa do operador foi escrito quando eles valiam, e matar a
 * partida por um campo obsoleto o deixaria sem painel.
 */
export function loadTeamMap(path: string = DEFAULT_TEAM_MAP_PATH): TeamMember[] {
  if (!existsSync(path)) return []

  let parsed: unknown
  try {
    parsed = readJsonConfig(path)
  } catch (cause) {
    throw new TeamMapError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const file = parsed as Partial<TeamMapFile>
  if (!Array.isArray(file.members)) {
    throw new TeamMapError(
      `${path} precisa ter a lista "members".\n` +
        `Veja o formato em ${DEFAULT_TEAM_MAP_PATH}.exemplo.`,
    )
  }

  const members = file.members.map(validateMember)

  const seen = new Map<string, number>()
  for (const [position, member] of members.entries()) {
    const first = seen.get(member.key)
    if (first !== undefined) {
      throw new TeamMapError(
        `Membro repetido em ${path}: "${member.key}"\n` +
          `Aparece em members[${first}] e members[${position}].`,
      )
    }
    seen.set(member.key, position)
  }

  const normalized = normalizeTeamMap(members)

  /*
    **Um importador pertence a UM responsavel so**, e a carga passa a cobrar
    isso como a tela ja cobrava.

    `IND-20` conta por pessoa: com o mesmo importador em dois membros, o mesmo
    processo entra nas duas carteiras e a soma deixa de fechar com o total. A
    tela recusa desde `H-91`, por `planTeamMember`; o arquivo editado a mao
    passava — medido pelo ensaio em 17/09/2026.

    A comparacao usa `overlaps`, e nao igualdade: listar "ACME" ja casa
    "ACME - SC", entao dois membros com essas duas grafias disputam os mesmos
    processos sem que nenhuma string se repita.
  */
  const owners = new Map<string, { key: string; position: number }>()
  for (const [position, member] of normalized.entries()) {
    for (const importer of member.importers) {
      for (const [taken, owner] of owners) {
        // O mesmo importador repetido DENTRO de um membro nao e conflito: a
        // carteira e dele nas duas vezes, e recusar isso mataria a partida por
        // uma linha duplicada que nao muda nada. O conflito e entre PESSOAS.
        if (owner.position === position) continue
        if (!overlaps(importer, taken)) continue
        throw new TeamMapError(
          `Importador em mais de um responsavel em ${path}: "${importer}"\n` +
            `Ja esta com "${owner.key}" em members[${owner.position}], e reaparece em ` +
            `members[${position}] ("${member.key}").\n` +
            'Um importador pertence a um responsavel so — IND-20 conta por pessoa.',
        )
      }
      owners.set(importer, { key: member.key, position })
    }
  }

  return normalized
}

/**
 * RECUSA o padrao sob `NODE_ENV=test`, como `history-store` desde `H-28`,
 * `saveWorkbookPath` desde `H-34` e `saveClientRule` desde `E13`.
 *
 * **E o quarto caminho de escrita do projeto, e o ultimo dos dois mapas.** O
 * arquivo esta no `.gitignore` e e do OPERADOR: um ponto de injecao esquecido
 * aqui reescreveria a equipe dele a cada execucao da suite, e o sintoma
 * apareceria semanas depois como responsavel que parou de aparecer. `H-34`
 * mediu exatamente esse engano com o `app.json`, e `H-28` gravou 649 eventos
 * no historico dele.
 */
function resolveTeamMapPath(path: string | undefined): string {
  if (path !== undefined) return path
  if (process.env.NODE_ENV !== 'test') return DEFAULT_TEAM_MAP_PATH

  throw new TeamMapError(
    'team-map: sob teste, injete o caminho — o padrao aponta para o mapa real do operador.',
  )
}

interface RawMember {
  key?: unknown
  label?: unknown
  importers?: unknown
}

/**
 * A gravacao do arquivo, atomica por `rename` — mesma forma de `writeRawMap` no
 * mapa de clientes.
 *
 * O temporario ao lado do alvo, e nao em `/tmp`: `rename` entre sistemas de
 * arquivos diferentes nao e atomico, e o mapa vive na pasta do operador.
 * Truncado no meio, o arquivo mataria a partida seguinte — `TeamMapError` esta
 * em `STARTUP_ERRORS` — e a mensagem apontaria para JSON invalido num arquivo
 * que ninguem editou a mao.
 */
function writeRawTeamMap(raw: Record<string, unknown>, target: string): void {
  const temporary = `${target}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(raw, null, 2)}\n`, 'utf-8')
    renameSync(temporary, target)
  } catch (cause) {
    throw new TeamMapError(
      `Nao foi possivel gravar ${target}: ${(cause as Error).message}\n` +
        'Confira se o arquivo nao esta somente-leitura.',
    )
  }
}

/** O JSON cru do alvo, ou o esqueleto de um arquivo que ainda nao existe. */
function readRawTeamMap(target: string): Record<string, unknown> {
  if (!existsSync(target)) return { version: 1, members: [] }

  try {
    return readJsonConfig(target) as Record<string, unknown>
  } catch (cause) {
    throw new TeamMapError(`${target} nao e um JSON valido: ${(cause as Error).message}`)
  }
}

/**
 * Grava um responsavel no JSON **cru**, preservando tudo o que nao e dele.
 *
 * **Nao serializa o mapa em memoria**, pela mesma razao de `saveClientRule`: o
 * arquivo carrega `_origem`, `_comentario_*` e `_nota`, que a convencao do
 * repositorio manda preservar — sao a documentacao do formato, lidas por quem
 * abre o arquivo.
 *
 * **Os campos que a aplicacao nao le mais sobrevivem na entrada.**
 * `colorResponsible` e `fallback` deixaram de valer em `H-93` (`D-40`), e a
 * gravacao nao os apaga: o arquivo e do operador, e reescrever nele o que esta
 * historia nao pediu e exatamente o que a gravacao crua existe para evitar. A
 * carga os ignora.
 *
 * **Arquivo ausente e criado**, e nao e caso de erro: e o estado da maquina do
 * operador (`PD-08`), onde a distribuicao leva so o `.exemplo`.
 */
export function saveTeamMember(save: TeamMemberSave, path?: string): void {
  const target = resolveTeamMapPath(path)
  const raw = readRawTeamMap(target)
  const members = Array.isArray(raw.members) ? [...(raw.members as RawMember[])] : []

  const at = members.findIndex(
    (member) =>
      typeof member.key === 'string' && member.key.toLowerCase() === save.key.toLowerCase(),
  )

  if (at === -1) {
    members.push({ key: save.key, label: save.label, importers: save.importers })
  } else {
    const entry = members[at] as RawMember
    entry.key = save.key
    entry.label = save.label
    entry.importers = save.importers
  }

  raw.members = members
  writeRawTeamMap(raw, target)
}

/**
 * Aplica o que `planTeamRemoval` decidiu (`H-91`).
 *
 * **Desfazer um responsavel apaga a entrada dele**, e aqui o mapa de equipe
 * diverge do de clientes: la o cliente sobrevive a saida do grupo porque a
 * regra dele continua valendo sozinha; aqui a entrada E a regra, e uma pessoa
 * sem carteira que permanecesse no arquivo voltaria ao painel como membro
 * ativo com zero — indistinguivel de quem acabou de entrar na equipe.
 *
 * Os processos nao ficam sem grupo: eles caem em "Sem responsavel", que ja
 * existe em `knownResponsibles` e ja aparece no filtro e em IND-20.
 */
export function removeTeamMember(removal: TeamRemoval, path?: string): void {
  const target = resolveTeamMapPath(path)
  if (!existsSync(target)) return

  const raw = readRawTeamMap(target)
  const members = Array.isArray(raw.members) ? [...(raw.members as RawMember[])] : []

  const at = members.findIndex(
    (member) =>
      typeof member.key === 'string' && member.key.toLowerCase() === removal.key.toLowerCase(),
  )
  if (at === -1) return

  if (removal.kind === 'membro-desfeito') {
    members.splice(at, 1)
  } else {
    const entry = members[at] as RawMember
    const importers = Array.isArray(entry.importers) ? (entry.importers as string[]) : []
    entry.importers = importers.filter(
      (importer) => normKey(importer) !== normKey(removal.importer ?? ''),
    )
  }

  raw.members = members
  writeRawTeamMap(raw, target)
}
