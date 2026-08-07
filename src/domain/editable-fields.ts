import type { Process } from './types.ts'

/**
 * Quais campos o operador pode editar, e o que vale em cada um (§3 de
 * `05-contratos-api.md`).
 *
 * Vive no dominio, e nao na rota, porque e regra de negocio: a lista sai da
 * especificacao, o limite de tamanho protege a celula da planilha, e o que
 * **nao** e editavel decorre de ser derivado. A rota so traduz o resultado em
 * codigo HTTP (regra inviolavel 6).
 */

/** Os 15 campos editaveis, na ordem das colunas B a P. */
export const EDITABLE_FIELDS = {
  clientRaw: { column: 'B', kind: 'text', maxLength: 255 },
  importerRaw: { column: 'C', kind: 'text', maxLength: 255 },
  billOfLading: { column: 'D', kind: 'text', maxLength: 255 },
  agentRaw: { column: 'E', kind: 'text', maxLength: 255 },
  container: { column: 'F', kind: 'text', maxLength: 255 },
  vesselRaw: { column: 'G', kind: 'text', maxLength: 255 },
  portRaw: { column: 'H', kind: 'text', maxLength: 255 },
  eta2: { column: 'I', kind: 'date' },
  goodsRaw: { column: 'J', kind: 'text', maxLength: 1000 },
  registrationDate: { column: 'K', kind: 'date' },
  statusRaw: { column: 'L', kind: 'text', maxLength: 1000 },
  boletoRaw: { column: 'M', kind: 'text', maxLength: 255 },
  paymentRaw: { column: 'N', kind: 'text', maxLength: 255 },
  docsSentDate: { column: 'O', kind: 'date' },
  columnPRaw: { column: 'P', kind: 'text', maxLength: 255 },
} as const satisfies Record<string, { column: string; kind: 'text' | 'date'; maxLength?: number }>

export type EditableField = keyof typeof EDITABLE_FIELDS

const FIELD_NAMES = Object.keys(EDITABLE_FIELDS) as EditableField[]

export function isEditableField(field: string): field is EditableField {
  return (FIELD_NAMES as string[]).includes(field)
}

/** Por que uma edicao foi recusada. A rota mapeia para 400. */
export type EditRejection = 'CAMPO_NAO_EDITAVEL' | 'CORPO_INVALIDO'

/**
 * Valida o par (campo, valor). `null` e **celula vazia**, nunca cancelamento.
 *
 * O cancelamento tem rota propria (`DELETE /api/edits/:id`), e por isso `null`
 * ficou livre para significar o que o operador precisa: esvaziar a celula. Com
 * `null` valendo cancelamento — como `03-modelo-dados.md` dizia ate `H-23` — ele
 * ficaria **sem meio** de limpar uma data.
 */
export function validateEdit(field: string, value: string | null): EditRejection | null {
  if (!isEditableField(field)) return 'CAMPO_NAO_EDITAVEL'

  const spec = EDITABLE_FIELDS[field]
  if (value === null) return null

  if (spec.kind === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'CORPO_INVALIDO'
    const parsed = new Date(`${value}T00:00:00Z`)
    // `2026-02-31` casa a regex e nao existe: o `Date` normaliza para marco, e
    // a volta a texto denuncia. Sem isto, uma data impossivel entraria na fila.
    if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(value)) {
      return 'CORPO_INVALIDO'
    }
    return null
  }

  return value.length > spec.maxLength ? 'CORPO_INVALIDO' : null
}

/**
 * O valor atual do campo, em texto — o `previous` que a fila registra.
 *
 * Data vira `AAAA-MM-DD` e ausencia vira string vazia, para `previous` ter
 * sempre o mesmo formato do `value` que a substitui.
 */
export function currentValue(process: Process, field: EditableField): string {
  const value = process[field]
  if (value === null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}
