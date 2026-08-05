import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { unzipSync } from 'fflate'
import type { AppConfig } from '../app/config.ts'
import type { RawCell, RawRow } from '../domain/types.ts'
import { extractStyleKey } from './style-extractor.ts'

export type { RawCell, RawCellType, RawRow } from '../domain/types.ts'

export interface ReadResult {
  rows: RawRow[]
  /** sha256:<hex> do conteudo binario. Base da defesa de hash em H-25. */
  fileHash: string
  readAt: Date
  sheetName: string
  /** Caminho da aba dentro do zip, ex.: 'xl/worksheets/sheet1.xml'. Consumido por H-24. */
  sheetPath: string
}

/** Coluna cuja cor representa a linha inteira. Medido: P-05 confirmada. */
export const ANCHOR_COLUMN = 'A'

export class WorkbookReadError extends Error {
  override readonly name = 'WorkbookReadError'
}

function columnLetter(index: number): string {
  let n = index
  let letters = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

function classify(value: unknown): RawCell {
  if (value === null || value === undefined || value === '') {
    return { value: null, type: 'null' }
  }
  if (value instanceof Date) return { value, type: 'date' }
  if (typeof value === 'number') return { value, type: 'number' }
  if (typeof value === 'string') return { value, type: 'string' }

  if (typeof value === 'object') {
    const rich = value as { result?: unknown; formula?: string; richText?: { text: string }[] }
    // Formula: interessa o resultado, nao a expressao.
    if ('formula' in rich) {
      const inner = classify(rich.result)
      return { value: inner.value, type: inner.value === null ? 'null' : inner.type }
    }
    if (Array.isArray(rich.richText)) {
      return { value: rich.richText.map((part) => part.text).join(''), type: 'string' }
    }
  }
  return { value: null, type: 'null' }
}

/**
 * Resolve o caminho da aba dentro do zip cruzando xl/workbook.xml com
 * xl/_rels/workbook.xml.rels. Nunca presumir 'sheet1.xml': o nome do arquivo
 * interno nao acompanha a ordem das abas.
 */
function resolveSheetPath(
  buffer: Uint8Array,
  sheetName: string | null,
): {
  sheetName: string
  sheetPath: string
  available: string[]
} {
  const zip = unzipSync(buffer, {
    filter: (f) => f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels',
  })
  const workbookXml = new TextDecoder().decode(zip['xl/workbook.xml'] ?? new Uint8Array())
  const relsXml = new TextDecoder().decode(zip['xl/_rels/workbook.xml.rels'] ?? new Uint8Array())

  const rels = new Map<string, string>()
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /Id="([^"]+)"/.exec(match[0])?.[1]
    const target = /Target="([^"]+)"/.exec(match[0])?.[1]
    if (id && target) rels.set(id, target)
  }

  const sheets: { name: string; path: string }[] = []
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = /name="([^"]+)"/.exec(match[0])?.[1]
    const rid = /r:id="([^"]+)"/.exec(match[0])?.[1]
    if (!name || !rid) continue
    let target = rels.get(rid) ?? ''
    target = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    sheets.push({ name, path: target.replace(/^xl\/\.\.\//, '') })
  }

  const available = sheets.map((s) => s.name)
  const chosen = sheetName === null ? sheets[0] : sheets.find((s) => s.name === sheetName)
  if (!chosen) {
    throw new WorkbookReadError(
      `Aba "${sheetName}" nao existe na planilha.\nAbas disponiveis: ${available.join(', ')}`,
    )
  }
  return { sheetName: chosen.name, sheetPath: chosen.path, available }
}

async function hashFile(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(`sha256:${hash.digest('hex')}`))
  })
}

/**
 * Le a aba em escopo e devolve as linhas cruas.
 *
 * Usa leitura em FLUXO e pula as demais abas sem consumir suas linhas
 * (regra inviolavel 10): nenhuma celula fora de escopo vira RawRow. O pool
 * xl/sharedStrings.xml e global ao arquivo e por isso e carregado inteiro —
 * limitacao do formato OOXML —, mas seus valores nunca sao processados,
 * indexados, expostos nem registrados.
 */
export async function readWorkbook(config: AppConfig): Promise<ReadResult> {
  const buffer = await readFile(config.workbookPath)
  const { sheetName, sheetPath } = resolveSheetPath(buffer, config.sheetName)
  const fileHash = await hashFile(config.workbookPath)

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(config.workbookPath, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'cache',
    entries: 'emit',
  })

  const rows: RawRow[] = []

  for await (const worksheet of reader) {
    // Os tipos do ExcelJS 4.4.0 nao declaram `name` em WorksheetReader, embora
    // a propriedade exista em runtime. Lacuna de tipagem da biblioteca, que
    // esta sem release relevante desde out/2023 (risco R-09).
    const name = (worksheet as { name?: string }).name

    // Pula sem iterar as linhas: as celulas nunca sao materializadas.
    if (name !== sheetName) continue

    for await (const row of worksheet) {
      if (row.number < config.firstDataRow) continue

      const cells: Record<string, RawCell> = {}
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[columnLetter(colNumber)] = classify(cell.value)
      })

      rows.push({
        sourceRow: row.number,
        cells,
        styleKey: extractStyleKey(row.getCell(1)),
      })
    }
  }

  return { rows, fileHash, readAt: new Date(), sheetName, sheetPath }
}
