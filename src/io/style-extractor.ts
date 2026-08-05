/**
 * Extracao da chave de estilo — TD-05 e ADR-0003.
 *
 * A chave e LITERAL: a forma devolvida pela biblioteca e serializada como
 * esta, sem nunca converter para RGB. Isso neutraliza o defeito #1690 do
 * ExcelJS, que devolve `{theme, tint}` em vez de `argb` para cores de tema.
 * Uma chave `theme:4|tint:-0.2500` e tao mapeavel quanto `argb:FF00B050`,
 * desde que esteja em config/color-map.json.
 *
 * NAO ha tolerancia nem aproximacao por proximidade de cor. Medido em H-01:
 * o arquivo real tem dois verdes (FF00FF00 e FF00FF0D) e dois roxos
 * indistinguiveis a olho. Um limiar os unificaria sozinho — e unificaria
 * tambem qualquer cor nova com outro significado.
 */

export const NO_FILL = 'none'

/** Forma minima do `cell.fill` do ExcelJS que nos interessa. */
interface PatternFillLike {
  type?: string
  pattern?: string
  fgColor?: { argb?: string; theme?: number; tint?: number; indexed?: number }
}

interface CellLike {
  style?: { fill?: unknown }
  fill?: unknown
}

function asPatternFill(fill: unknown): PatternFillLike | null {
  if (!fill || typeof fill !== 'object') return null
  const candidate = fill as PatternFillLike
  if (candidate.type !== 'pattern') return null
  if (!candidate.pattern || candidate.pattern === 'none') return null
  return candidate
}

/**
 * Arredonda o tint a 4 casas para que a chave seja estavel entre leituras.
 * `tint` ausente vale ZERO: o ExcelJS omite o campo quando e zero, mas o
 * perfilador o escreve explicitamente. Sem esta normalizacao, a linha branca
 * do arquivo real (theme 0, sem tint) cairia em COR_NAO_MAPEADA.
 */
function formatTint(tint: number | undefined): string {
  return (tint ?? 0).toFixed(4)
}

/** Converte o preenchimento de uma celula na chave de estilo literal (TD-05). */
export function extractStyleKey(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return NO_FILL

  const candidate = cell as CellLike
  const fill = asPatternFill(candidate.style?.fill ?? candidate.fill)
  if (!fill) return NO_FILL

  const fg = fill.fgColor
  if (!fg) return NO_FILL

  if (typeof fg.argb === 'string' && fg.argb !== '') {
    return `argb:${fg.argb.toUpperCase()}`
  }
  if (typeof fg.theme === 'number') {
    return `theme:${fg.theme}|tint:${formatTint(fg.tint)}`
  }
  if (typeof fg.indexed === 'number') {
    return `indexed:${fg.indexed}`
  }
  return NO_FILL
}
