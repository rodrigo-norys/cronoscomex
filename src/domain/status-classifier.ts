import { levenshtein, normKey } from './normalizer.ts'
import type { AnomalyCode, RawRow, StatusCategory } from './types.ts'

/**
 * Classificacao da categoria de status — TD-01 e TD-02.
 *
 * A ORDEM de avaliacao e obrigatoria: a regra de "Fechado — aguardando draft"
 * (secao 2.2 da especificacao) PRECEDE a regra de STATUS (secao 2.1). Sem
 * isso, uma linha so com REF cairia em `em_desembaraco`, porque seu STATUS
 * tambem esta vazio — as duas regras colidem na mesma linha (achado A-22).
 */

/** Coluna que carrega a referencia do processo. */
export const REF_COLUMN = 'A'

/** Coluna de STATUS. */
export const STATUS_COLUMN = 'L'

/** Todas as colunas lidas, A..P. Medido em H-01: o arquivo real tem 16. */
export const ALL_COLUMNS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
] as const

/**
 * Distancia maxima para sinalizar variante proxima de uma forma catalogada.
 * Acima disso o valor nem gera anomalia: `DESEMBARACADA 03/02` esta a 6 e
 * ficaria de fora de proposito (achado A-53).
 */
export const VARIANT_DISTANCE_THRESHOLD = 3

/** Canais aduaneiros detectados no TEXTO, apenas para relatorio (A-06). */
const CHANNEL_WORDS = ['VERDE', 'AMARELO', 'VERMELHO', 'CINZA']

export interface Classification {
  category: StatusCategory
  anomalies: AnomalyCode[]
}

function cellText(row: RawRow, column: string): string {
  const value = row.cells[column]?.value
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

/**
 * Uma celula conta como vazia quando, apos trim, tem comprimento zero.
 * "Demais colunas" inclui as fora de escopo — Coluna 13 e R$ ENVIADO —,
 * conforme a resolucao do achado A-23.
 */
function onlyRefFilled(row: RawRow): boolean {
  return ALL_COLUMNS.every((column) => column === REF_COLUMN || cellText(row, column) === '')
}

/**
 * Detecta mencao textual a canal de fiscalizacao.
 *
 * NAO classifica: a cor e a unica fonte do canal (A-06). Isto existe para que
 * a ocorrencia apareca no relatorio de divergencias e alguem decida.
 */
function mentionsChannel(normalized: string): boolean {
  if (!normalized.includes('CANAL')) return false
  return CHANNEL_WORDS.some((word) => normalized.includes(word))
}

/** Um valor proximo de alguma forma catalogada, sem ser uma delas. */
function isCloseVariant(normalized: string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => levenshtein(normalized, alias) <= VARIANT_DISTANCE_THRESHOLD)
}

/**
 * Aplica TD-01. A primeira regra que casar decide; as demais nem sao
 * avaliadas.
 *
 * `aliases` sao as formas JA normalizadas de config/status-aliases.json.
 */
export function classify(row: RawRow, aliases: readonly string[]): Classification {
  const anomalies: AnomalyCode[] = []
  const statusRaw = cellText(row, STATUS_COLUMN)
  const normalized = normKey(statusRaw)

  if (mentionsChannel(normalized)) anomalies.push('CANAL_EM_TEXTO_STATUS')

  // Regra 1: sem REF, a linha nao e um processo. O destino (ignorar ou
  // quarentena) e decidido em H-07, nao aqui.
  if (cellText(row, REF_COLUMN) === '') {
    return { category: 'em_desembaraco', anomalies }
  }

  // Regra 2: so REF preenchido. PRECEDE a regra 4 (achado A-22).
  if (onlyRefFilled(row)) {
    return { category: 'fechado_aguardando_draft', anomalies }
  }

  // Regra 3: forma catalogada de "desembaracada".
  if (aliases.includes(normalized)) {
    return { category: 'desembaracado', anomalies }
  }

  // Regra 4: STATUS vazio.
  if (normalized === '') {
    return { category: 'em_desembaraco', anomalies }
  }

  // Regra 5: qualquer outro texto. Se for PROXIMO de uma forma catalogada,
  // sinaliza para revisao humana — mas NAO reclassifica por adivinhacao.
  if (isCloseVariant(normalized, aliases)) {
    anomalies.push('VARIANTE_STATUS_PROXIMA')
  }
  return { category: 'em_andamento', anomalies }
}
