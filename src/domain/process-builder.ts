import { type ColorMapEntry, resolveColorIndexed } from './color-mapper.ts'
import { normKey, parseCellDate } from './normalizer.ts'
import { classify } from './status-classifier.ts'
import type { AnomalyCode, Process, QuarantineReason, RawRow } from './types.ts'

/**
 * Composicao do `Process` e do relatorio de quarentena.
 *
 * Principio que rege este modulo: NADA e descartado em silencio. Toda linha
 * que nao vira processo aparece no relatorio com motivo estruturado, e toda
 * linha aceita com ressalva aparece em `anomalies`.
 */

export interface QuarantineItem {
  sourceRow: number
  ref: string
  reason: QuarantineReason
  detail: string
}

export interface AnomalyItem {
  sourceRow: number
  ref: string
  code: AnomalyCode
  detail: string
}

export interface BuildResult {
  processes: Process[]
  quarantine: QuarantineItem[]
  anomalies: AnomalyItem[]
  /** Linhas com ao menos uma celula preenchida. Linha vazia nao conta. */
  totalDataRows: number
}

export interface BuildDeps {
  /** Mapa de cores ja indexado por `indexColorMap`. */
  colorMap: ReadonlyMap<string, ColorMapEntry>
  /** Grafias de "desembaracada" ja normalizadas. */
  statusAliases: readonly string[]
}

/** Mapeamento coluna -> campo. Ver docs/03-modelo-dados.md secao 1.2. */
const COLUMN = {
  ref: 'A',
  client: 'B',
  importer: 'C',
  billOfLading: 'D',
  agent: 'E',
  container: 'F',
  vessel: 'G',
  port: 'H',
  eta2: 'I',
  goods: 'J',
  registrationDate: 'K',
  status: 'L',
  boleto: 'M',
  payment: 'N',
  docsSent: 'O',
  columnP: 'P',
} as const

function text(row: RawRow, column: string): string {
  const value = row.cells[column]?.value
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function isEmptyRow(row: RawRow): boolean {
  return Object.values(row.cells).every((cell) => {
    const { value } = cell
    if (value === null || value === undefined) return true
    return String(value).trim() === ''
  })
}

function filledColumns(row: RawRow): string[] {
  return Object.entries(row.cells)
    .filter(([, cell]) => cell.value !== null && String(cell.value).trim() !== '')
    .map(([column]) => column)
}

const DAY_MS = 86_400_000

/**
 * Divergencias que nao impedem o aceite da linha, mas exigem revisao humana.
 *
 * `RG_SEM_DESEMBARACO` decorre do achado A-05: a planilha tem RG preenchido em
 * processo nao concluido, o que contradiz a semantica declarada em 2.1.1.
 */
function detectAnomalies(process: Process): AnomalyCode[] {
  const found: AnomalyCode[] = []

  if (process.registrationDate !== null && process.statusCategory !== 'desembaracado') {
    found.push('RG_SEM_DESEMBARACO')
  }
  if (
    process.registrationDate !== null &&
    process.docsSentDate !== null &&
    process.registrationDate.getTime() < process.docsSentDate.getTime()
  ) {
    found.push('INTERVALO_DOCUMENTAL_NEGATIVO')
  }
  return found
}

function buildOne(row: RawRow, deps: BuildDeps): { process: Process; unmappedColor: boolean } {
  const color = resolveColorIndexed(row.styleKey, deps.colorMap)
  const classification = classify(row, deps.statusAliases)

  const eta2 = parseCellDate(row.cells[COLUMN.eta2] ?? { value: null, type: 'null' })
  const registrationDate = parseCellDate(
    row.cells[COLUMN.registrationDate] ?? { value: null, type: 'null' },
  )
  const docsSentDate = parseCellDate(row.cells[COLUMN.docsSent] ?? { value: null, type: 'null' })

  const anomalies = new Set<AnomalyCode>(classification.anomalies)
  for (const parse of [eta2, registrationDate, docsSentDate]) {
    if (parse.anomaly) anomalies.add(parse.anomaly)
  }
  if (!color.mapped) anomalies.add('COR_NAO_MAPEADA')

  const clientRaw = text(row, COLUMN.client)
  const importerRaw = text(row, COLUMN.importer)
  const agentRaw = text(row, COLUMN.agent)
  const vesselRaw = text(row, COLUMN.vessel)
  const portRaw = text(row, COLUMN.port)
  const goodsRaw = text(row, COLUMN.goods)

  const base: Process = {
    sourceRow: row.sourceRow,
    ref: text(row, COLUMN.ref),
    clientRaw,
    importerRaw,
    billOfLading: text(row, COLUMN.billOfLading),
    agentRaw,
    container: text(row, COLUMN.container),
    vesselRaw,
    portRaw,
    goodsRaw,
    statusRaw: text(row, COLUMN.status),
    boletoRaw: text(row, COLUMN.boleto),
    paymentRaw: text(row, COLUMN.payment),
    columnPRaw: text(row, COLUMN.columnP),
    eta2: eta2.date,
    registrationDate: registrationDate.date,
    docsSentDate: docsSentDate.date,
    clientKey: normKey(clientRaw),
    importerKey: normKey(importerRaw),
    agentKey: normKey(agentRaw),
    vesselKey: normKey(vesselRaw),
    portKey: normKey(portRaw),
    goodsKey: normKey(goodsRaw),
    statusCategory: classification.category,
    responsible: color.responsible,
    customsChannel: color.customsChannel,
    importerOutsideRj: color.importerOutsideRj,
    styleKey: row.styleKey,
    anomalies: [],
  }

  for (const code of detectAnomalies(base)) anomalies.add(code)

  return { process: { ...base, anomalies: [...anomalies] }, unmappedColor: !color.mapped }
}

/**
 * Compoe os processos aceitos e o relatorio.
 *
 * Regras de aceite, conforme TD-06:
 *  - linha inteiramente vazia: ignorada, sem contar em `totalDataRows`;
 *  - REF ausente com outras colunas preenchidas: SO quarentena;
 *  - REF repetida: a de menor `sourceRow` vence, as demais vao para quarentena;
 *  - cor nao mapeada: entra em AMBOS — o processo conta nos indicadores de
 *    volume com `indefinido`, e a pendencia fica visivel (achado A-17).
 */
export function buildProcesses(rows: readonly RawRow[], deps: BuildDeps): BuildResult {
  const processes: Process[] = []
  const quarantine: QuarantineItem[] = []
  const anomalies: AnomalyItem[] = []
  const seenRefs = new Map<string, number>()
  let totalDataRows = 0

  for (const row of rows) {
    if (isEmptyRow(row)) continue
    totalDataRows++

    const ref = text(row, COLUMN.ref)
    if (ref === '') {
      quarantine.push({
        sourceRow: row.sourceRow,
        ref: '',
        reason: 'REF_AUSENTE',
        detail: `colunas preenchidas: ${filledColumns(row).join(', ')}`,
      })
      continue
    }

    // A comparacao de REF usa a chave normalizada: "FT498.26" e "ft498.26 "
    // sao o MESMO processo (TD-06).
    const refKey = normKey(ref)
    const firstRow = seenRefs.get(refKey)
    if (firstRow !== undefined) {
      quarantine.push({
        sourceRow: row.sourceRow,
        ref,
        reason: 'REF_DUPLICADA',
        detail: `primeira ocorrencia na linha ${firstRow}`,
      })
      continue
    }
    seenRefs.set(refKey, row.sourceRow)

    const { process, unmappedColor } = buildOne(row, deps)
    processes.push(process)

    if (unmappedColor) {
      quarantine.push({
        sourceRow: row.sourceRow,
        ref,
        reason: 'COR_NAO_MAPEADA',
        detail: `styleKey=${row.styleKey}`,
      })
    }
    for (const code of process.anomalies) {
      anomalies.push({
        sourceRow: row.sourceRow,
        ref,
        code,
        detail: describeAnomaly(code, process),
      })
    }
  }

  return { processes, quarantine, anomalies, totalDataRows }
}

function describeAnomaly(code: AnomalyCode, process: Process): string {
  switch (code) {
    case 'RG_SEM_DESEMBARACO':
      return `RG preenchido com categoria ${process.statusCategory}`
    case 'INTERVALO_DOCUMENTAL_NEGATIVO': {
      const dias = Math.round(
        ((process.registrationDate?.getTime() ?? 0) - (process.docsSentDate?.getTime() ?? 0)) /
          DAY_MS,
      )
      return `RG anterior a DOCS ENVIADOS em ${Math.abs(dias)} dias`
    }
    case 'CANAL_EM_TEXTO_STATUS':
      return 'STATUS menciona canal de fiscalizacao; a cor continua sendo a fonte'
    case 'DATA_SEM_ANO':
      return 'celula de data sem ano; o ano NAO foi inferido'
    case 'COR_NAO_MAPEADA':
      return `styleKey=${process.styleKey}`
    case 'VARIANTE_STATUS_PROXIMA':
      return `STATUS proximo de uma grafia catalogada: "${process.statusRaw}"`
  }
}

/** Fracao de linhas com pendencia, com 4 casas. Zero linhas nao divide por zero. */
export function quarantineRate(result: BuildResult): number {
  if (result.totalDataRows === 0) return 0
  return Number((result.quarantine.length / result.totalDataRows).toFixed(4))
}
