import { existsSync, readFileSync } from 'node:fs'
import type { ColorMapEntry } from '../domain/color-mapper.ts'
import type { CustomsChannel, Responsible } from '../domain/types.ts'

/**
 * Carrega e valida config/color-map.json. O I/O vive aqui, e nao em
 * src/domain/, pela regra de fronteira do ADR-0006.
 */

export const DEFAULT_COLOR_MAP_PATH = 'config/color-map.json'

export class ColorMapError extends Error {
  override readonly name = 'ColorMapError'
}

const RESPONSIBLE: readonly Responsible[] = [
  'colaborador1',
  'colaborador2',
  'colaborador1_outros_clientes',
  'indefinido',
]
const CHANNEL: readonly CustomsChannel[] = ['verde', 'vermelho', 'indefinido']

export interface ColorMapFile {
  version: number
  sheetName?: string
  anchorColumn: string
  styledColumns: string[]
  entries: ColorMapEntry[]
}

function validateEntry(raw: unknown, position: number): ColorMapEntry {
  const where = `entries[${position}]`
  if (!raw || typeof raw !== 'object') {
    throw new ColorMapError(`${where} deve ser um objeto.`)
  }
  const entry = raw as Record<string, unknown>

  const styleKey = entry.styleKey
  if (typeof styleKey !== 'string' || styleKey.trim() === '') {
    throw new ColorMapError(`${where}.styleKey e obrigatorio.`)
  }
  const fillId = entry.fillId
  if (typeof fillId !== 'number' || !Number.isInteger(fillId) || fillId < 0) {
    throw new ColorMapError(
      `${where}.fillId e obrigatorio e deve ser inteiro nao negativo.\n` +
        'O valor real vem do relatorio de H-01 (tools/profile_workbook.py).',
    )
  }
  const responsible = entry.responsible as Responsible
  if (!RESPONSIBLE.includes(responsible)) {
    throw new ColorMapError(
      `${where}.responsible invalido: ${String(responsible)}. Valores: ${RESPONSIBLE.join(', ')}.`,
    )
  }
  const customsChannel = entry.customsChannel as CustomsChannel
  if (!CHANNEL.includes(customsChannel)) {
    throw new ColorMapError(
      `${where}.customsChannel invalido: ${String(customsChannel)}. Valores: ${CHANNEL.join(', ')}.`,
    )
  }
  if (typeof entry.importerOutsideRj !== 'boolean') {
    throw new ColorMapError(`${where}.importerOutsideRj deve ser true ou false.`)
  }

  return {
    styleKey,
    fillId,
    label: typeof entry.label === 'string' ? entry.label : styleKey,
    responsible,
    customsChannel,
    importerOutsideRj: entry.importerOutsideRj,
  }
}

/**
 * Le o mapa de cores. Falha ALTO na partida em caso de defeito: um mapa
 * invalido faria toda linha cair em quarentena, e falhar cedo com mensagem
 * clara e melhor que servir um painel vazio.
 *
 * Mapa VAZIO nao e erro: o servico sobe e o relatorio de quarentena mostra
 * 100% de linhas nao mapeadas, que e o comportamento previsto em H-04.
 */
export function loadColorMap(path: string = DEFAULT_COLOR_MAP_PATH): ColorMapEntry[] {
  if (!existsSync(path)) {
    throw new ColorMapError(
      `Mapa de cores nao encontrado: ${path}\n` +
        'Gere-o a partir do relatorio de H-01 (docs/assets/color-map.exemplo.json e o esqueleto).',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (cause) {
    throw new ColorMapError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const file = parsed as Partial<ColorMapFile>
  if (!Array.isArray(file.entries)) {
    throw new ColorMapError(`${path} precisa ter a lista "entries".`)
  }

  const entries = file.entries.map(validateEntry)

  const seen = new Map<string, number>()
  for (const [position, entry] of entries.entries()) {
    const first = seen.get(entry.styleKey)
    if (first !== undefined) {
      throw new ColorMapError(
        `styleKey repetida em ${path}: "${entry.styleKey}"\n` +
          `Aparece em entries[${first}] e entries[${position}]. Cada chave deve ser unica.`,
      )
    }
    seen.set(entry.styleKey, position)
  }

  return entries
}
