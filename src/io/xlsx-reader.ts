import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import type { AppConfig } from '../app/config.ts'
import type { RawRow } from '../domain/types.ts'
import {
  decodePart,
  parseHeaderLabels,
  parseSharedStrings,
  parseSheetRows,
  parseStyles,
} from './xlsx-parts.ts'

export type { RawCell, RawCellType, RawRow } from '../domain/types.ts'
export { ANCHOR_COLUMN } from './xlsx-parts.ts'

export interface ReadResult {
  rows: RawRow[]
  /**
   * Os rotulos da linha de cabecalho, por letra de coluna (`H-95`).
   *
   * E o que a tabela mostra por nome de coluna, e sai LITERAL do arquivo: `H`
   * se chama `ETA` e guarda porto, `M` e `P` se chamam `Coluna 13` e `Coluna1`.
   * Coluna sem nome nao entra — ausencia de rotulo nao vira rotulo vazio.
   */
  headerLabels: Record<string, string>
  /** sha256:<hex> do conteudo binario. Base da defesa de hash em H-25. */
  fileHash: string
  readAt: Date
  sheetName: string
  /** Caminho da aba dentro do zip, ex.: 'xl/worksheets/sheet1.xml'. Consumido por H-24. */
  sheetPath: string
}

export class WorkbookReadError extends Error {
  override readonly name = 'WorkbookReadError'
}

/**
 * A assinatura de um container OLE2 — `D0 CF 11 E0 A1 B1 1A E1`.
 *
 * E o que o Excel grava quando a pasta e protegida por SENHA: o `.xlsx` deixa
 * de ser um zip e passa a ser um container cifrado, com a mesma extensao. Sem
 * esta conferencia o `fflate` falha em `invalid zip data`, que nao diz ao
 * operador o que houve nem o que fazer — medido em 17/09/2026, sobre um arquivo
 * cifrado pelo Excel de verdade.
 *
 * `P-12` afirma que o arquivo real NAO e protegido, e o perfilamento a
 * confirmou. Isto e a mensagem para o dia em que alguem proteger.
 */
const OLE2_SIGNATURE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

function isEncryptedWorkbook(buffer: Uint8Array): boolean {
  if (buffer.length < OLE2_SIGNATURE.length) return false
  return OLE2_SIGNATURE.every((byte, index) => buffer[index] === byte)
}

const WORKBOOK_PATH = 'xl/workbook.xml'
const WORKBOOK_RELS_PATH = 'xl/_rels/workbook.xml.rels'
const SHARED_STRINGS_PATH = 'xl/sharedStrings.xml'
const STYLES_PATH = 'xl/styles.xml'

/**
 * Resolve o caminho da aba dentro do zip cruzando xl/workbook.xml com
 * xl/_rels/workbook.xml.rels. Nunca presumir 'sheet1.xml': o nome do arquivo
 * interno nao acompanha a ordem das abas.
 *
 * Traz junto o epoch do arquivo, que sai do mesmo XML: o Excel para Mac antigo
 * conta os seriais a partir de 1904, e ler a data pelo epoch errado erraria
 * todas por 4 anos e 1 dia. Nao ha adivinhacao — o arquivo declara qual usa.
 */
function resolveWorkbook(
  buffer: Uint8Array,
  sheetName: string | null,
): {
  sheetName: string
  sheetPath: string
  date1904: boolean
} {
  const zip = unzipSync(buffer, {
    filter: (file) => file.name === WORKBOOK_PATH || file.name === WORKBOOK_RELS_PATH,
  })
  const workbookXml = decodePart(zip[WORKBOOK_PATH])
  const relsXml = decodePart(zip[WORKBOOK_RELS_PATH])

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

  return {
    sheetName: chosen.name,
    sheetPath: chosen.path,
    date1904: /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(workbookXml),
  }
}

/**
 * SHA-256 do arquivo inteiro, prefixado com `sha256:`. E o valor que
 * `StoreState.fileHash` guarda, e o que a defesa de ARQUIVO_MUDOU de H-25
 * compara — texto com texto.
 */
export async function hashFile(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(`sha256:${hash.digest('hex')}`))
  })
}

/**
 * O mesmo hash, sobre bytes ja em memoria. H-25 confere o buffer que a cirurgia
 * vai operar contra o hash da leitura: sao duas aberturas do arquivo, e sem
 * isto a janela entre elas ficaria sem defesa.
 */
export function hashBytes(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/**
 * Le a aba em escopo e devolve as linhas cruas.
 *
 * O filtro do unzip e nominal: das entradas do zip so sao descomprimidas o
 * workbook, os rels, o pool de texto, os estilos e a UNICA aba em escopo. As
 * abas de fora nao sao lidas, nem materializadas, nem tocam o disco — a regra
 * inviolavel 10 vale por construcao, e nao por convencao. Ate H-33 o leitor
 * despejava cada aba num arquivo temporario em /tmp antes de decidir pula-la.
 *
 * O pool xl/sharedStrings.xml e global ao arquivo e por isso vem inteiro —
 * limitacao do formato OOXML —, mas seus valores nunca sao processados,
 * indexados, expostos nem registrados.
 *
 * O hash sai do MESMO buffer que foi interpretado. Ler o arquivo duas vezes
 * deixaria uma janela entre a interpretacao e o hash, e e esse hash que H-25
 * usa para recusar a escrita quando o arquivo mudou.
 */
export async function readWorkbook(config: AppConfig): Promise<ReadResult> {
  const buffer = await readFile(config.workbookPath)

  // Antes de qualquer descompactacao: o erro do `fflate` nomeia o formato, e o
  // operador precisa do motivo.
  if (isEncryptedWorkbook(buffer)) {
    throw new WorkbookReadError(
      'A planilha esta protegida por senha e nao pode ser lida (P-12).\n' +
        'Abra-a no Excel, remova a protecao em Arquivo > Informacoes > Proteger ' +
        'Pasta de Trabalho > Criptografar com Senha, salve, e tente de novo.',
    )
  }

  const { sheetName, sheetPath, date1904 } = resolveWorkbook(buffer, config.sheetName)

  const parts = unzipSync(buffer, {
    filter: (file) =>
      file.name === sheetPath || file.name === SHARED_STRINGS_PATH || file.name === STYLES_PATH,
  })

  const sheetXml = parts[sheetPath]
  if (sheetXml === undefined) {
    throw new WorkbookReadError(
      `A aba "${sheetName}" aponta para ${sheetPath}, que nao existe dentro do arquivo.`,
    )
  }

  const sheet = decodePart(sheetXml)
  // Uma composicao so, usada pelas duas varreduras: montar duas faria o pool de
  // strings e a tabela de estilos serem interpretados duas vezes por leitura.
  const parseOptions = {
    sharedStrings: parseSharedStrings(decodePart(parts[SHARED_STRINGS_PATH])),
    styles: parseStyles(decodePart(parts[STYLES_PATH])),
    firstDataRow: config.firstDataRow,
    date1904,
  }

  const rows = parseSheetRows(sheet, parseOptions)
  const headerLabels = parseHeaderLabels(sheet, parseOptions, config.headerRow)

  return {
    rows,
    headerLabels,
    fileHash: hashBytes(buffer),
    readAt: new Date(),
    sheetName,
    sheetPath,
  }
}
