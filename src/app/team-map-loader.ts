import { existsSync, readFileSync } from 'node:fs'
import { normalizeTeamMap, type TeamMember } from '../domain/team-mapper.ts'
import type { Responsible } from '../domain/types.ts'

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

const COLOR_RESPONSIBLE: readonly Responsible[] = [
  'colaborador1',
  'colaborador2',
  'colaborador1_outros_clientes',
  'indefinido',
]

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

function validateColorResponsible(raw: unknown, where: string): Responsible[] {
  return validateStringList(raw, where).map((value, index) => {
    if (!(COLOR_RESPONSIBLE as readonly string[]).includes(value)) {
      throw new TeamMapError(
        `${where}[${index}] invalido: ${value}. Valores: ${COLOR_RESPONSIBLE.join(', ')}.`,
      )
    }
    return value as Responsible
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
  if (member.fallback !== undefined && typeof member.fallback !== 'boolean') {
    throw new TeamMapError(`${where}.fallback deve ser true ou false.`)
  }

  const importers = validateStringList(member.importers, `${where}.importers`)
  const colorResponsible = validateColorResponsible(
    member.colorResponsible,
    `${where}.colorResponsible`,
  )

  // Membro que nao casa importador, nem cor, nem e o resto, nunca recebe
  // processo. E o mesmo defeito de `rules` vazia no mapa de clientes: intencao
  // escrita, regra esquecida, e o sintoma e a pessoa sumir do ranking.
  if (importers.length === 0 && colorResponsible.length === 0 && member.fallback !== true) {
    throw new TeamMapError(
      `${where} nao tem "importers", nem "colorResponsible", nem "fallback": ` +
        `o membro "${key}" nunca receberia processo algum.`,
    )
  }

  return {
    key,
    label: typeof member.label === 'string' && member.label.trim() !== '' ? member.label : key,
    importers,
    colorResponsible,
    ...(member.fallback === undefined ? {} : { fallback: member.fallback }),
  }
}

/**
 * Le o mapa de equipe. Lista vazia quando o arquivo nao existe.
 *
 * As duas unicidades conferidas — chave repetida e `fallback` duplicado — sao
 * as que produzem comportamento silenciosamente errado. Duas pessoas
 * reivindicando "todo o resto" seriam uma ordem de avaliacao disfarcada de
 * conjunto: a primeira levaria tudo, e a segunda pareceria uma pessoa sem
 * processos em vez de um erro de configuracao.
 */
export function loadTeamMap(path: string = DEFAULT_TEAM_MAP_PATH): TeamMember[] {
  if (!existsSync(path)) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
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

  const fallbacks = members.filter((member) => member.fallback === true)
  if (fallbacks.length > 1) {
    throw new TeamMapError(
      `${path} tem ${fallbacks.length} membros com "fallback": ` +
        `${fallbacks.map((member) => `"${member.key}"`).join(', ')}.\n` +
        'No maximo um pode receber os importadores que ninguem reivindica.',
    )
  }

  return normalizeTeamMap(members)
}
