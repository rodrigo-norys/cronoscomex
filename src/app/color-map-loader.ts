import { existsSync, readFileSync } from 'node:fs'
import type { CellFill, ColorMapEntry } from '../domain/color-mapper.ts'
import type { ColorResponsible, CustomsChannel } from '../domain/types.ts'

/**
 * Carrega e valida config/color-map.json. O I/O vive aqui, e nao em
 * src/domain/, pela regra de fronteira do ADR-0006.
 */

export const DEFAULT_COLOR_MAP_PATH = 'config/color-map.json'

export class ColorMapError extends Error {
  override readonly name = 'ColorMapError'
}

const RESPONSIBLE: readonly ColorResponsible[] = [
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
  /** `H-94`. Cores que so pintam — nunca alvo de escrita. */
  cellFills?: CellFill[]
}

/** `#RRGGBB`, e nada mais: o campo e declaracao de aparencia, nao expressao. */
const DISPLAY = /^#[0-9A-Fa-f]{6}$/

/**
 * Valida a cor de exibicao de `H-94`.
 *
 * **Ausente e legitimo** (determinacao 3 de `D-41`): chave sem `display` nao
 * recebe cor inventada, e a celula fica sem fundo. PRESENTE e malformado e
 * outra coisa — e engano de quem editou o arquivo, e passa a valer silencio
 * onde havia intencao de cor.
 */
function validateDisplay(raw: unknown, where: string): string | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !DISPLAY.test(raw)) {
    throw new ColorMapError(
      `${where}.display invalido: ${String(raw)}. Use "#RRGGBB" — seis digitos hexadecimais.`,
    )
  }
  return raw
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
  const responsible = entry.responsible as ColorResponsible
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

  const display = validateDisplay(entry.display, where)

  return {
    styleKey,
    fillId,
    label: typeof entry.label === 'string' ? entry.label : styleKey,
    responsible,
    customsChannel,
    importerOutsideRj: entry.importerOutsideRj,
    ...(display === undefined ? {} : { display }),
  }
}

function validateCellFill(raw: unknown, position: number): CellFill {
  const where = `cellFills[${position}]`
  if (!raw || typeof raw !== 'object') {
    throw new ColorMapError(`${where} deve ser um objeto.`)
  }
  const fill = raw as Record<string, unknown>

  const styleKey = fill.styleKey
  if (typeof styleKey !== 'string' || styleKey.trim() === '') {
    throw new ColorMapError(`${where}.styleKey e obrigatorio.`)
  }

  // Aqui `display` e OBRIGATORIO, ao contrario de `entries`: uma entrada de
  // `cellFills` existe SO para pintar, e sem a cor ela nao tem conteudo nenhum.
  const display = validateDisplay(fill.display, where)
  if (display === undefined) {
    throw new ColorMapError(
      `${where}.display e obrigatorio: uma entrada de "cellFills" existe so para pintar.`,
    )
  }

  return {
    styleKey,
    display,
    label: typeof fill.label === 'string' && fill.label.trim() !== '' ? fill.label : styleKey,
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

/**
 * As cores que so pintam (`H-94`). Lista ausente devolve vazio.
 *
 * **Leitura separada, e nao um segundo campo no retorno de `loadColorMap`.**
 * Aquele devolve `ColorMapEntry[]` e e chamado em nove lugares — store, guard,
 * servidor, medicao e as fabricas de teste; alargar o retorno alcancaria os
 * nove para servir uma tela. O arquivo e lido duas vezes na partida, e as duas
 * leituras nao podem divergir: nada escreve neste arquivo em execucao.
 *
 * Um defeito no formato MATA a partida, como em `loadColorMap`: `cellFills`
 * escrito errado deixaria a tabela sem a pintura que a historia existe para
 * dar, e falhar cedo com mensagem clara e melhor que uma tabela cinza sem
 * explicacao.
 */
export function loadCellFills(path: string = DEFAULT_COLOR_MAP_PATH): CellFill[] {
  if (!existsSync(path)) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (cause) {
    throw new ColorMapError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
  }

  const file = parsed as Partial<ColorMapFile>
  if (file.cellFills === undefined) return []
  if (!Array.isArray(file.cellFills)) {
    throw new ColorMapError(`${path}: "cellFills", quando presente, precisa ser uma lista.`)
  }

  const fills = file.cellFills.map(validateCellFill)

  const seen = new Map<string, number>()
  for (const [position, fill] of fills.entries()) {
    const first = seen.get(fill.styleKey)
    if (first !== undefined) {
      throw new ColorMapError(
        `styleKey repetida em "cellFills" de ${path}: "${fill.styleKey}"\n` +
          `Aparece em cellFills[${first}] e cellFills[${position}].`,
      )
    }
    seen.set(fill.styleKey, position)
  }

  return fills
}
