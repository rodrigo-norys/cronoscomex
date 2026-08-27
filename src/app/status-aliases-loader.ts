import { existsSync, readFileSync } from 'node:fs'
import { normKey } from '../domain/normalizer.ts'

/**
 * Carrega config/status-aliases.json — o dicionario de grafias que significam
 * processo concluido (TD-02). O I/O vive aqui, fora de src/domain/.
 */

export const DEFAULT_STATUS_ALIASES_PATH = 'config/status-aliases.json'

export class StatusAliasesError extends Error {
  override readonly name = 'StatusAliasesError'
}

/**
 * Le o dicionario e devolve as formas ja normalizadas.
 *
 * Falha ALTO quando a chave `desembaracado` esta ausente ou vazia: sem
 * dicionario, NENHUM processo seria classificado como concluido, e o painel
 * mostraria zero desembaracados com ar de normalidade. Falhar na partida e
 * preferivel a contar errado em silencio.
 */
export function loadStatusAliases(path: string = DEFAULT_STATUS_ALIASES_PATH): string[] {
  if (!existsSync(path)) {
    throw new StatusAliasesError(
      `Dicionario de grafias nao encontrado: ${path}\n` +
        'Ele define quais textos de STATUS significam processo concluido (TD-02).',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (cause) {
    throw new StatusAliasesError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const file = parsed as Record<string, unknown>
  const raw = file.desembaracado

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new StatusAliasesError(
      `${path} precisa da chave "desembaracado" com ao menos uma grafia.\n` +
        'Sem ela nenhum processo seria classificado como concluido.',
    )
  }

  const aliases: string[] = []
  for (const [position, value] of raw.entries()) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new StatusAliasesError(
        `desembaracado[${position}] deve ser um texto nao vazio em ${path}.`,
      )
    }
    const normalized = normKey(value)
    if (!aliases.includes(normalized)) aliases.push(normalized)
  }

  return aliases
}
