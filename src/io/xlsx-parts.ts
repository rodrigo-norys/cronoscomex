import type { RawCell, RawRow } from '../domain/types.ts'
import { extractStyleKey, NO_FILL } from './style-extractor.ts'

/**
 * Interpretacao das partes XML de um .xlsx: pool de texto, estilos e sheetData.
 *
 * Modulo PURO — recebe string, devolve dado. Nao abre arquivo, nao descompacta
 * zip e nao conhece caminho. E isso que permite exercitar com XML literal os
 * casos que nenhuma das 9 fixtures cobre — richText, inlineStr, t="b", t="e":
 * `tools/build_fixtures.py` reescreve o sharedStrings do zero, e RNF-37 proibe
 * apontar teste para a planilha real.
 *
 * A interpretacao reproduz celula a celula a do ExcelJS 4.4.0, que ocupou este
 * lugar ate H-33 — a troca precisava ser transparente para H-03 a H-07. Onde a
 * paridade nao era obvia, o comentario diz qual era o comportamento antigo.
 */

/** Coluna cuja cor representa a linha inteira. Medido: P-05 confirmada. */
export const ANCHOR_COLUMN = 'A'

export interface StyleIndex {
  /** Chave de estilo literal do preenchimento de um styleId. Ver TD-05. */
  styleKeyOf(styleId: number | null): string
  /** Se o formato numerico do styleId faz o Excel exibir o numero como data. */
  isDateFormat(styleId: number | null): boolean
}

export interface SheetParseOptions {
  sharedStrings: string[]
  styles: StyleIndex
  /** Linhas anteriores a esta sao cabecalho e nao viram RawRow. */
  firstDataRow: number
  date1904: boolean
}

const CELL_XFS_SECTION = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/
const FILLS_SECTION = /<fills count="\d+">([\s\S]*?)<\/fills>/
// Mesma forma usada pela StyleTable de src/io/xlsx-surgeon.ts: um <xf> pode ser
// auto-fechado ou carregar <alignment>, e casar so a primeira forma
// desalinharia todos os indices seguintes.
const XF_ENTRY = /<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g
const FILL_ENTRY = /<fill>[\s\S]*?<\/fill>|<fill\/>/g
const NUM_FMT_DECLARATION = /<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g

const PATTERN_FILL = /<patternFill([^>]*?)(?:\/>|>([\s\S]*?)<\/patternFill>)/
const FG_COLOR = /<fgColor([^>]*)\/>/

const SHEET_DATA = /<sheetData(?:\s[^>]*)?>([\s\S]*?)<\/sheetData>/
const ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
const CELL_VALUE = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/
const INLINE_STRING = /<is>([\s\S]*?)<\/is>/
const SHARED_STRING_ITEM = /<si>([\s\S]*?)<\/si>|<si\s*\/>/g
const PHONETIC_RUN = /<rPh[\s\S]*?<\/rPh>/g
const TEXT_NODE = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g

const ATTR_REFERENCE = /\br="([^"]*)"/
const ATTR_STYLE = /\bs="([^"]*)"/
const ATTR_TYPE = /\bt="([^"]*)"/
const ATTR_FILL_ID = /\bfillId="(\d+)"/
const ATTR_NUM_FMT_ID = /\bnumFmtId="(\d+)"/
const ATTR_PATTERN_TYPE = /\bpatternType="([^"]*)"/
const ATTR_RGB = /\brgb="([^"]*)"/
const ATTR_THEME = /\btheme="(\d+)"/
const ATTR_TINT = /\btint="([^"]*)"/
const ATTR_INDEXED = /\bindexed="(\d+)"/

/**
 * Os 12 formatos embutidos que o Excel exibe como data ou hora.
 *
 * Nao e lista escolhida a mao: sao exatamente os numFmtId cujo codigo padrao
 * casa DATE_FORMAT_TOKEN — de 14 (`mm-dd-yy`) a 22, mais 45 a 47, os tempos
 * decorridos. Os demais embutidos sao moeda, percentual e cientifico, e
 * qualquer id a partir de 164 vem declarado em <numFmts> no proprio arquivo.
 */
const BUILT_IN_DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/**
 * Token de data num codigo de formato, ja removidos os trechos entre colchetes
 * — o seletor de locale, `[$-416]`, cujo 4 seria falso positivo — e entre
 * aspas, que e texto literal.
 *
 * NAO e o mesmo criterio de `collectDateFormatIds`, em src/io/xlsx-surgeon.ts,
 * e a diferenca e deliberada: la o conjunto serve para ESCOLHER um formato ao
 * gravar uma data, e aceitar `h:mm` como data faria a escrita eleger um formato
 * de hora para uma celula de data. Aqui ele serve para CLASSIFICAR o que ja
 * esta no arquivo, e uma celula formatada como hora tem de virar Date — era o
 * que acontecia ate H-33. Unificar os dois trocaria um criterio correto por
 * outro correto, no lugar errado.
 */
const DATE_FORMAT_TOKEN = /[ymdhMsb]+/

/** Serial 25569 e 1970-01-01; o epoch de 1904 fica 1462 dias adiante. */
const UNIX_EPOCH_SERIAL = 25569
const DAYS_BETWEEN_EPOCHS = 1462
const MS_PER_DAY = 86_400_000

const XML_ENTITY = /&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/g
const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

const decoder = new TextDecoder()

/** Decodifica uma entrada do zip como UTF-8; ausente vale string vazia. */
export function decodePart(bytes: Uint8Array | undefined): string {
  return bytes === undefined ? '' : decoder.decode(bytes)
}

function unescapeXml(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(XML_ENTITY, (entity, decimal?: string, hexadecimal?: string) => {
    if (decimal !== undefined) return String.fromCodePoint(Number(decimal))
    if (hexadecimal !== undefined) return String.fromCodePoint(Number.parseInt(hexadecimal, 16))
    return NAMED_ENTITIES[entity] ?? entity
  })
}

/**
 * Concatena os fragmentos de texto de um <si> ou de um <is>.
 *
 * richText vem como varios <r><t>, e o valor e a juncao deles — TD-04 agrupa
 * pelo texto inteiro, nao pelo primeiro pedaco. <rPh> e leitura fonetica
 * japonesa: texto paralelo, nunca parte do valor.
 */
function textOf(xml: string): string {
  let text = ''
  for (const node of xml.replace(PHONETIC_RUN, '').matchAll(TEXT_NODE)) {
    text += unescapeXml(node[1] ?? '')
  }
  return text
}

function isDateFormatCode(code: string): boolean {
  return DATE_FORMAT_TOKEN.test(code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''))
}

function parseColor(attributes: string): {
  argb?: string
  theme?: number
  tint?: number
  indexed?: number
} {
  const color: { argb?: string; theme?: number; tint?: number; indexed?: number } = {}
  const rgb = ATTR_RGB.exec(attributes)?.[1]
  const theme = ATTR_THEME.exec(attributes)?.[1]
  const tint = ATTR_TINT.exec(attributes)?.[1]
  const indexed = ATTR_INDEXED.exec(attributes)?.[1]

  if (rgb !== undefined) color.argb = rgb
  if (theme !== undefined) color.theme = Number(theme)
  if (tint !== undefined) color.tint = Number(tint)
  if (indexed !== undefined) color.indexed = Number(indexed)
  return color
}

/**
 * Devolve o preenchimento na forma que `extractStyleKey` consome. Gradiente e
 * qualquer outra forma viram null, que TD-05 traduz em `none`: o dicionario de
 * cores so contempla preenchimento solido.
 */
function parseFill(xml: string): unknown {
  const pattern = PATTERN_FILL.exec(xml)
  if (!pattern) return null

  const patternType = ATTR_PATTERN_TYPE.exec(pattern[1] ?? '')?.[1]
  const color = FG_COLOR.exec(pattern[2] ?? '')

  return {
    type: 'pattern',
    pattern: patternType,
    fgColor: color === null ? undefined : parseColor(color[1] ?? ''),
  }
}

/**
 * Indexa xl/styles.xml por styleId.
 *
 * A chave de estilo deriva do `fillId` do cellXf, nunca do styleId: uma mesma
 * cor vem de varios styleId, que diferem em borda (A-49). O `applyFill` e
 * ignorado de proposito — era o que o ExcelJS fazia, e o Excel tambem pinta a
 * celula sem ele.
 */
export function parseStyles(stylesXml: string): StyleIndex {
  const declaredFormats = new Map<number, boolean>()
  for (const declaration of stylesXml.matchAll(NUM_FMT_DECLARATION)) {
    // O ExcelJS desfazia o escape de barra invertida antes de classificar, e
    // `[$-416]d\-mmm;@` — o unico formato declarado nas fixtures — depende
    // disso para nao virar outra coisa.
    const code = (declaration[2] ?? '').replace(/\\(.)/g, '$1')
    declaredFormats.set(Number(declaration[1]), isDateFormatCode(code))
  }

  const fills = (FILLS_SECTION.exec(stylesXml)?.[1] ?? '').match(FILL_ENTRY) ?? []
  const parsedFills = fills.map(parseFill)

  const entries = (CELL_XFS_SECTION.exec(stylesXml)?.[1] ?? '').match(XF_ENTRY) ?? []
  const fillIds = entries.map((xf) => Number(ATTR_FILL_ID.exec(xf)?.[1] ?? '0'))
  const numberFormatIds = entries.map((xf) => Number(ATTR_NUM_FMT_ID.exec(xf)?.[1] ?? '0'))

  return {
    styleKeyOf(styleId) {
      if (styleId === null) return NO_FILL
      const fillId = fillIds[styleId]
      if (fillId === undefined) return NO_FILL
      return extractStyleKey({ fill: parsedFills[fillId] })
    },

    isDateFormat(styleId) {
      if (styleId === null) return false
      const numberFormatId = numberFormatIds[styleId]
      if (numberFormatId === undefined) return false
      return declaredFormats.get(numberFormatId) ?? BUILT_IN_DATE_FORMAT_IDS.has(numberFormatId)
    },
  }
}

/** Le xl/sharedStrings.xml — o pool e global ao arquivo, limitacao do OOXML. */
export function parseSharedStrings(sharedStringsXml: string): string[] {
  const items: string[] = []
  for (const item of sharedStringsXml.matchAll(SHARED_STRING_ITEM)) {
    items.push(textOf(item[1] ?? ''))
  }
  return items
}

function columnIndex(reference: string): number {
  let index = 0
  for (const character of reference) {
    const code = character.charCodeAt(0)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index
}

function columnLetter(index: number): string {
  let remaining = index
  let letters = ''
  while (remaining > 0) {
    const rest = (remaining - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    remaining = Math.floor((remaining - 1) / 26)
  }
  return letters
}

function emptyCell(): RawCell {
  return { value: null, type: 'null' }
}

/**
 * Texto vazio e ausencia, nao valor. Era o que a classificacao fazia com '' ate
 * H-33, e o que H-06 espera para nao contar como preenchida uma coluna que so
 * tem string vazia.
 */
function stringCell(text: string): RawCell {
  return text === '' ? emptyCell() : { value: text, type: 'string' }
}

function serialToDateTime(serial: number, date1904: boolean): Date {
  const days = serial - UNIX_EPOCH_SERIAL + (date1904 ? DAYS_BETWEEN_EPOCHS : 0)
  return new Date(Math.round(days * MS_PER_DAY))
}

function numberCell(raw: string, styleId: number | null, options: SheetParseOptions): RawCell {
  const value = Number(raw)
  // Numero que nao e numero vira buraco visivel, e nao NaN circulando pelo
  // dominio tipado como number: TD-03 ja trata ausencia, nao trata NaN.
  if (!Number.isFinite(value)) return emptyCell()
  if (options.styles.isDateFormat(styleId)) {
    return { value: serialToDateTime(value, options.date1904), type: 'date' }
  }
  return { value, type: 'number' }
}

/**
 * Uma celula. Formula vale o RESULTADO, nunca a expressao — o <v> ao lado do
 * <f> ja e o resultado calculado pelo Excel, entao nao ha ramo especial.
 */
function readCell(
  attributes: string,
  inner: string,
  styleId: number | null,
  options: SheetParseOptions,
): RawCell {
  const type = ATTR_TYPE.exec(attributes)?.[1] ?? 'n'

  if (type === 'inlineStr') return stringCell(textOf(INLINE_STRING.exec(inner)?.[1] ?? ''))

  const raw = CELL_VALUE.exec(inner)?.[1]
  if (raw === undefined) return emptyCell()

  switch (type) {
    case 's':
      return stringCell(options.sharedStrings[Number(raw)] ?? '')
    case 'str':
      return stringCell(unescapeXml(raw))
    // Booleano e erro nao viram valor, como ate H-33: o ExcelJS entregava
    // `true` e `{error:'#REF!'}`, e nenhum dos dois sobrevivia a classificacao.
    case 'b':
    case 'e':
      return emptyCell()
    default:
      return numberCell(raw, styleId, options)
  }
}

function buildRow(rowNumber: number, inner: string, options: SheetParseOptions): RawRow {
  const anchorIndex = columnIndex(ANCHOR_COLUMN)
  const values = new Map<number, RawCell>()
  let anchorStyleId: number | null = null
  let lastColumn = 0
  let previousColumn = 0

  for (const cell of inner.matchAll(CELL)) {
    const attributes = cell[1] ?? ''
    const reference = ATTR_REFERENCE.exec(attributes)?.[1]
    // O `r` da celula e opcional no schema; sem ele, a celula e a proxima coluna.
    const column = reference === undefined ? previousColumn + 1 : columnIndex(reference)
    const declaredStyle = ATTR_STYLE.exec(attributes)?.[1]
    const styleId = declaredStyle === undefined ? null : Number(declaredStyle)

    previousColumn = column
    lastColumn = Math.max(lastColumn, column)
    if (column === anchorIndex) anchorStyleId = styleId

    values.set(column, readCell(attributes, cell[2] ?? '', styleId, options))
  }

  // Buraco no meio da linha vira celula nula, e nao chave ausente: e o que
  // `eachCell({includeEmpty:true})` entregava ate H-33, e H-06 distingue vazia
  // de inexistente pelo tipo. Depois da ultima celula presente nao ha nada —
  // linha que termina em H nao ganha I..P.
  const cells: Record<string, RawCell> = {}
  for (let column = 1; column <= lastColumn; column++) {
    cells[columnLetter(column)] = values.get(column) ?? emptyCell()
  }

  return { sourceRow: rowNumber, cells, styleKey: options.styles.styleKeyOf(anchorStyleId) }
}

/** Le o sheetData de UMA aba — a que esta em escopo. Ver regra inviolavel 10. */
export function parseSheetRows(sheetXml: string, options: SheetParseOptions): RawRow[] {
  const sheetData = SHEET_DATA.exec(sheetXml)?.[1] ?? ''
  const rows: RawRow[] = []
  let previousRowNumber = 0

  for (const row of sheetData.matchAll(ROW)) {
    const declared = ATTR_REFERENCE.exec(row[1] ?? '')?.[1]
    // O `r` da linha tambem e opcional; sem ele, a linha e a seguinte.
    const rowNumber = declared === undefined ? previousRowNumber + 1 : Number(declared)
    previousRowNumber = rowNumber

    if (rowNumber < options.firstDataRow) continue
    rows.push(buildRow(rowNumber, row[2] ?? '', options))
  }

  return rows
}
