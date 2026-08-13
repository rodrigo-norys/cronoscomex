import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Cirurgia no XML do .xlsx: altera apenas os nos <c> alvo e recompacta, sem
 * reserializar o workbook (ADR-0004). Tudo que a aplicacao nao entende, ela
 * nao toca.
 *
 * "Byte a byte identicas" vale sobre o CONTEUDO DESCOMPRIMIDO de cada entrada
 * do zip, nao sobre os bytes comprimidos: recompactar reproduz o conteudo, nao
 * o fluxo deflate do Excel. E o conteudo que carrega formatacao condicional,
 * validacao e comentario — os elementos que ADR-0004 existe para preservar.
 *
 * Quatro entradas do zip podem mudar, e so estas: a aba alvo, sempre;
 * xl/sharedStrings.xml, ao gravar texto; xl/styles.xml, quando o passo 5b de
 * TD-05.1 dispara — de forma estritamente aditiva, nenhum xf existente e
 * alterado, entao nenhuma celula fora da edicao muda de aparencia; e
 * xl/calcChain.xml, ao remover formula, para nao deixar entrada orfa apontando
 * para celula que nao calcula mais.
 */

export interface CellEdit {
  sourceRow: number
  column: string
  value: string | number | Date | null
}

export interface SurgeryResult {
  buffer: Uint8Array
  cellsWritten: number
  entriesPreserved: number
}

const SHARED_STRINGS_PATH = 'xl/sharedStrings.xml'
const STYLES_PATH = 'xl/styles.xml'
const CALC_CHAIN_PATH = 'xl/calcChain.xml'

const MS_PER_DAY = 86_400_000
// O Excel conta a partir de 1899-12-30 por causa do ano bissexto ficticio de
// 1900, que ele mantem por compatibilidade com o Lotus 1-2-3.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

// `d-mmm` embutido, usado so quando o arquivo nao declara formato de data
// proprio. Preferir o do arquivo mantem a celula nova igual as vizinhas.
const FALLBACK_DATE_NUM_FMT_ID = 16
const BUILT_IN_DATE_FMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

export function applyCellEdits(
  original: Uint8Array,
  edits: CellEdit[],
  sheetPath: string,
): SurgeryResult {
  const entries = unzipSync(original)

  if (edits.length === 0) {
    return { buffer: original, cellsWritten: 0, entriesPreserved: Object.keys(entries).length }
  }

  const sheetEntry = entries[sheetPath]
  if (!sheetEntry) throw new Error(`aba nao encontrada no zip: ${sheetPath}`)

  const sharedStringsEntry = entries[SHARED_STRINGS_PATH]
  const stylesEntry = entries[STYLES_PATH]
  const sharedStrings = new SharedStringPool(
    sharedStringsEntry ? strFromU8(sharedStringsEntry) : null,
  )
  const styles = new StyleTable(stylesEntry ? strFromU8(stylesEntry) : null)

  let sheetXml = strFromU8(sheetEntry)
  let cellsWritten = 0
  const clearedFormulas: string[] = []

  for (const edit of edits) {
    sheetXml = writeCell(sheetXml, edit, sharedStrings, styles, clearedFormulas)
    cellsWritten += 1
  }

  const rebuilt: Record<string, Uint8Array> = { ...entries }
  rebuilt[sheetPath] = strToU8(sheetXml)
  if (sharedStrings.changed) rebuilt[SHARED_STRINGS_PATH] = strToU8(sharedStrings.serialize())
  if (styles.changed) rebuilt[STYLES_PATH] = strToU8(styles.serialize())

  const calcChainEntry = entries[CALC_CHAIN_PATH]
  if (calcChainEntry && clearedFormulas.length > 0) {
    let calcChain = strFromU8(calcChainEntry)
    for (const reference of clearedFormulas) calcChain = removeFromCalcChain(calcChain, reference)
    rebuilt[CALC_CHAIN_PATH] = strToU8(calcChain)
  }

  let entriesPreserved = 0
  for (const [path, content] of Object.entries(rebuilt)) {
    if (sameBytes(content, entries[path])) entriesPreserved += 1
  }

  return { buffer: zipSync(rebuilt), cellsWritten, entriesPreserved }
}

function writeCell(
  sheetXml: string,
  edit: CellEdit,
  sharedStrings: SharedStringPool,
  styles: StyleTable,
  clearedFormulas: string[],
): string {
  const reference = `${edit.column}${edit.sourceRow}`
  const expanded = expandSelfClosingRow(sheetXml, edit.sourceRow)
  const row = findRow(expanded, edit.sourceRow)
  if (!row) throw new Error(`linha ${edit.sourceRow} nao encontrada na aba`)

  const existing = findCell(row.inner, reference)
  if (existing) {
    assertNotSharedFormulaMaster(existing.text, reference)
    if (existing.text.includes('<f')) clearedFormulas.push(reference)
  }

  // Celula ausente nao tem `s=` para preservar, e emitir <c> sem estilo a joga
  // em cellXfs[0] (Geral): data viraria o serial cru na tela, que e o defeito
  // de A-56 no caso mais provavel — coluna O, 79,3% vazia no arquivo real.
  // A herança segue a do proprio Excel: celula, depois linha, depois coluna.
  const inheritedStyle =
    (existing ? readAttribute(existing.text, 's') : null) ??
    rowStyleOf(row.openTag) ??
    columnStyleOf(expanded, edit.column)

  const resolvedStyle =
    edit.value instanceof Date ? styles.ensureDateFormat(inheritedStyle) : inheritedStyle

  sharedStrings.adjustReferences(
    (typeof edit.value === 'string' ? 1 : 0) -
      (existing && readAttribute(existing.text, 't') === 's' ? 1 : 0),
  )

  const cellXml = renderCell(reference, resolvedStyle, edit.value, sharedStrings)

  const nextInner = existing
    ? row.inner.slice(0, existing.start) + cellXml + row.inner.slice(existing.end)
    : insertCellInColumnOrder(row.inner, reference, cellXml)

  return expanded.slice(0, row.innerStart) + nextInner + expanded.slice(row.innerEnd)
}

function renderCell(
  reference: string,
  styleId: string | null,
  value: CellEdit['value'],
  sharedStrings: SharedStringPool,
): string {
  const style = styleId === null ? '' : ` s="${styleId}"`

  if (value === null) return `<c r="${reference}"${style}/>`

  if (value instanceof Date) {
    return `<c r="${reference}"${style}><v>${toExcelSerial(value)}</v></c>`
  }

  if (typeof value === 'number') {
    return `<c r="${reference}"${style}><v>${value}</v></c>`
  }

  return `<c r="${reference}"${style} t="s"><v>${sharedStrings.indexOf(value)}</v></c>`
}

// O no <f> some junto com o valor: formula orfa apontando para valor fixo faz o
// Excel recalcular por cima do que o operador acabou de gravar.
function findCell(
  rowInner: string,
  reference: string,
): { text: string; start: number; end: number } | null {
  // As duas formas sao alternativas SEPARADAS, e nao um sufixo opcional: com
  // `(?:\s[^>]*)?(?:/>|>...</c>)` o grupo de atributos engole a barra de uma
  // celula vazia, `/>` deixa de casar, e a varredura ate `</c>` atravessa a
  // celula seguinte — e ate a linha seguinte.
  const pattern = new RegExp(
    `<c r="${reference}"(?:\\s[^>]*?)?/>|<c r="${reference}"(?:\\s[^>]*?)?>[\\s\\S]*?</c>`,
  )
  const match = pattern.exec(rowInner)
  if (!match) return null
  return { text: match[0], start: match.index, end: match.index + match[0].length }
}

// Uma formula compartilhada mestre — <f t="shared" ref="..." si="N"> — carrega
// a definicao que as dependentes daquele si apenas referenciam. Sobrescreve-la
// deixaria as outras celulas sem definicao, e reescrever a formula noutra
// ancora exigiria traduzi-la: adivinhacao, que a regra inviolavel 3 proibe.
// A dependente nao tem `ref` e so afeta a si mesma, entao e permitida.
function assertNotSharedFormulaMaster(cell: string, reference: string): void {
  const formula = /<f\s[^>]*>/.exec(cell)?.[0]
  if (!formula) return
  if (readAttribute(formula, 't') === 'shared' && readAttribute(formula, 'ref') !== null) {
    throw new Error(
      `${reference} e a celula mestre de uma formula compartilhada; sobrescreve-la invalidaria as dependentes`,
    )
  }
}

// A entrada da cadeia de calculo herda `i` — o indice da aba — da anterior.
// Remover quem o declara sem repassa-lo mudaria a aba das entradas seguintes,
// e o Excel abriria pedindo reparo.
function removeFromCalcChain(calcChainXml: string, reference: string): string {
  const match = new RegExp(`<c r="${reference}"(?:\\s[^>]*?)?/>`).exec(calcChainXml)
  if (!match) return calcChainXml

  const inheritedIndex = readAttribute(match[0], 'i')
  const rest = calcChainXml.slice(match.index + match[0].length)
  const patched =
    inheritedIndex !== null && /^<c r="[^"]*"\/>/.test(rest)
      ? rest.replace(/^<c r="([^"]*)"\/>/, `<c r="$1" i="${inheritedIndex}"/>`)
      : rest

  return calcChainXml.slice(0, match.index) + patched
}

// O Excel emite <row .../> para linha formatada sem nenhuma celula. Inserir
// dentro dela exige abri-la ANTES de calcular posicoes: mexer nos indices sem
// reescrever o XML faz o ponto de insercao cair entre a `/` e o `>`, e o
// arquivo deixa de ser bem-formado.
function expandSelfClosingRow(sheetXml: string, rowNumber: number): string {
  const match = new RegExp(`<row r="${rowNumber}"(?:\\s[^>]*?)?/>`).exec(sheetXml)
  if (!match) return sheetXml

  const opened = `${match[0].slice(0, -2)}></row>`
  return sheetXml.slice(0, match.index) + opened + sheetXml.slice(match.index + match[0].length)
}

function findRow(
  sheetXml: string,
  rowNumber: number,
): { openTag: string; inner: string; innerStart: number; innerEnd: number } | null {
  const match = new RegExp(`<row r="${rowNumber}"(?:\\s[^>]*?)?>`).exec(sheetXml)
  if (!match) return null

  const innerStart = match.index + match[0].length
  const innerEnd = sheetXml.indexOf('</row>', innerStart)
  if (innerEnd === -1) return null
  return { openTag: match[0], inner: sheetXml.slice(innerStart, innerEnd), innerStart, innerEnd }
}

function insertCellInColumnOrder(rowInner: string, reference: string, cellXml: string): string {
  const target = columnIndex(columnOf(reference))

  // Basta a abertura de cada <c>: a posicao de insercao e o inicio da primeira
  // celula de coluna maior, e casar o fechamento so reintroduziria o risco de
  // varrer alem da celula.
  for (const cell of rowInner.matchAll(/<c r="([A-Z]+)\d+"/g)) {
    if (columnIndex(cell[1] ?? '') > target) {
      return rowInner.slice(0, cell.index) + cellXml + rowInner.slice(cell.index)
    }
  }
  return rowInner + cellXml
}

// `s=` da <row> so vale quando customFormat="1"; sem isso o atributo existe mas
// o Excel o ignora.
function rowStyleOf(openTag: string): string | null {
  return readAttribute(openTag, 'customFormat') === '1' ? readAttribute(openTag, 's') : null
}

function columnStyleOf(sheetXml: string, column: string): string | null {
  const index = columnIndex(column)
  for (const col of sheetXml.matchAll(/<col [^>]*\/>/g)) {
    const min = Number(readAttribute(col[0], 'min') ?? '0')
    const max = Number(readAttribute(col[0], 'max') ?? '0')
    if (index >= min && index <= max) return readAttribute(col[0], 'style')
  }
  return null
}

class SharedStringPool {
  changed = false
  private readonly header: string
  private readonly items: string[]
  private readonly originalCount: number
  private referenceDelta = 0

  constructor(xml: string | null) {
    this.header =
      xml?.slice(0, xml.indexOf('<sst')) ??
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    this.items = xml?.match(/<si>[\s\S]*?<\/si>/g) ?? []
    this.originalCount = Number(/<sst[^>]*\scount="(\d+)"/.exec(xml ?? '')?.[1] ?? '0')
  }

  indexOf(value: string): number {
    const rendered = renderSharedString(value)
    const found = this.items.indexOf(rendered)
    if (found !== -1) return found

    this.items.push(rendered)
    this.changed = true
    return this.items.length - 1
  }

  // `count` conta REFERENCIAS na pasta de trabalho, nao entradas: sobrescrever
  // uma celula que ja era `t="s"` por outra string deixa o total intacto.
  // Igualar count a uniqueCount escreveria um numero errado por construcao.
  adjustReferences(delta: number): void {
    if (delta === 0) return
    this.referenceDelta += delta
    this.changed = true
  }

  serialize(): string {
    const count = Math.max(0, this.originalCount + this.referenceDelta)
    return `${this.header}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${this.items.length}">${this.items.join('')}</sst>`
  }
}

// A tabela casa pelo ELEMENTO inteiro, nao pela tupla de quatro campos de
// TD-05.1: dois xf podem ter (numFmt, font, fill, border) iguais e diferir em
// <alignment>, e escolher o errado mudaria a aparencia da celula — exatamente
// o que a regra existe para impedir.
class StyleTable {
  changed = false
  private readonly xml: string
  private readonly entries: string[]
  private readonly dateFormatIds: Set<number>
  private readonly dateNumFmtId: number
  private readonly sectionStart: number
  private readonly sectionEnd: number

  constructor(xml: string | null) {
    this.xml = xml ?? ''
    const section = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(this.xml)
    this.entries = section?.[1]?.match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g) ?? []
    this.sectionStart = section?.index ?? -1
    this.sectionEnd = section ? section.index + section[0].length : -1
    this.dateFormatIds = collectDateFormatIds(this.xml)
    this.dateNumFmtId = prevailingDateNumFmtId(this.entries, this.dateFormatIds)
  }

  ensureDateFormat(styleId: string | null): string | null {
    if (this.sectionStart === -1 || this.entries.length === 0) return styleId

    // Sem estilo herdado, a base e cellXfs[0]: precisa existir um xf de partida
    // sobre o qual trocar o numFmtId, senao a data sai sem formato.
    const base = (styleId === null ? this.entries[0] : this.entries[Number(styleId)]) ?? null
    if (!base) return styleId

    const current = Number(readAttribute(base, 'numFmtId') ?? '0')
    if (styleId !== null && this.dateFormatIds.has(current)) return styleId

    const target = withDateNumberFormat(base, this.dateNumFmtId)
    const existing = this.entries.findIndex((xf) => canonicalXf(xf) === canonicalXf(target))
    if (existing !== -1) return String(existing)

    this.entries.push(target)
    this.changed = true
    return String(this.entries.length - 1)
  }

  serialize(): string {
    const section = `<cellXfs count="${this.entries.length}">${this.entries.join('')}</cellXfs>`
    return this.xml.slice(0, this.sectionStart) + section + this.xml.slice(this.sectionEnd)
  }
}

function collectDateFormatIds(stylesXml: string): Set<number> {
  const ids = new Set(BUILT_IN_DATE_FMT_IDS)
  for (const match of stylesXml.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)) {
    // O seletor de locale — [$-416] — nao e token de data e sairia como falso
    // positivo pelo 4 de 416.
    const code = (match[2] ?? '').replace(/\[[^\]]*\]/g, '')
    if (/[dy]/i.test(code)) ids.add(Number(match[1]))
  }
  return ids
}

// O formato de data mais usado no proprio arquivo, para que a celula nova saia
// igual as vizinhas em vez de trazer um embutido de aparencia diferente.
function prevailingDateNumFmtId(entries: string[], dateFormatIds: Set<number>): number {
  const tally = new Map<number, number>()
  for (const xf of entries) {
    const id = Number(readAttribute(xf, 'numFmtId') ?? '0')
    if (dateFormatIds.has(id)) tally.set(id, (tally.get(id) ?? 0) + 1)
  }

  let chosen = FALLBACK_DATE_NUM_FMT_ID
  let best = 0
  for (const [id, count] of tally) {
    if (count > best) {
      chosen = id
      best = count
    }
  }
  return chosen
}

function withDateNumberFormat(xf: string, numFmtId: number): string {
  const withFormat = xf.replace(/numFmtId="\d+"/, `numFmtId="${numFmtId}"`)
  // TD-05.1 passo 3 fala em trocar so o campo em questao, mas sem
  // applyNumberFormat="1" o Excel ignora o numFmt e a troca nao surte efeito.
  if (withFormat.includes('applyNumberFormat="1"')) return withFormat
  if (withFormat.includes('applyNumberFormat="0"')) {
    return withFormat.replace('applyNumberFormat="0"', 'applyNumberFormat="1"')
  }
  return withFormat.replace(/^<xf /, '<xf applyNumberFormat="1" ')
}

function canonicalXf(xf: string): string {
  const attributes = [...xf.matchAll(/([\w:]+)="([^"]*)"/g)]
    .map((match) => `${match[1]}=${match[2]}`)
    .sort()
    .join(' ')
  const inner = /<xf [^>]*>([\s\S]*)<\/xf>/.exec(xf)?.[1] ?? ''
  return `${attributes}|${inner}`
}

function renderSharedString(value: string): string {
  const needsPreserve = value !== value.trim() || value.includes('\n')
  const space = needsPreserve ? ' xml:space="preserve"' : ''
  return `<si><t${space}>${escapeXml(value)}</t></si>`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Trunca no dia em UTC, nunca arredonda: com Math.round um horario a partir de
// meio-dia viraria o dia seguinte na planilha.
function toExcelSerial(value: Date): number {
  const midnight = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  return (midnight - EXCEL_EPOCH_MS) / MS_PER_DAY
}

function readAttribute(element: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(element)?.[1] ?? null
}

function columnOf(reference: string): string {
  return /^[A-Z]+/.exec(reference)?.[0] ?? ''
}

function columnIndex(column: string): number {
  let index = 0
  for (const letter of column) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index
}

function sameBytes(left: Uint8Array, right: Uint8Array | undefined): boolean {
  if (!right || left.length !== right.length) return false
  return left.every((byte, position) => byte === right[position])
}
