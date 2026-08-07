import { useState } from 'react'
import { enqueueEdit } from '../api-client.ts'

/**
 * O formulário de edição de um processo (`H-23`).
 *
 * **Nada aqui grava no `.xlsx`.** O envio enfileira, e o valor passa a aparecer
 * em toda a aplicação pela projeção do servidor — tabela, indicadores, alertas.
 * A gravação é de `H-26`, atrás das defesas de `write-guard`.
 *
 * A lista de campos e os limites vivem em `src/domain/editable-fields.ts`; aqui
 * só há rótulo e tipo de entrada. Validar de novo no cliente criaria uma segunda
 * tabela de regras que diverge da primeira no ajuste seguinte — o servidor
 * recusa com `400` e a mensagem dele é o que aparece.
 */

interface FieldDefinition {
  readonly field: string
  readonly label: string
  readonly kind: 'text' | 'date'
}

/** Na ordem das colunas B a P, como o operador vê na planilha. */
const FIELDS: readonly FieldDefinition[] = [
  { field: 'clientRaw', label: 'Cliente', kind: 'text' },
  { field: 'importerRaw', label: 'Importador', kind: 'text' },
  { field: 'billOfLading', label: 'BL', kind: 'text' },
  { field: 'agentRaw', label: 'Agente', kind: 'text' },
  { field: 'container', label: 'Container', kind: 'text' },
  { field: 'vesselRaw', label: 'Navio', kind: 'text' },
  { field: 'portRaw', label: 'Porto', kind: 'text' },
  { field: 'eta2', label: 'ETA2', kind: 'date' },
  { field: 'goodsRaw', label: 'Mercadoria', kind: 'text' },
  { field: 'registrationDate', label: 'Registro (RG)', kind: 'date' },
  { field: 'statusRaw', label: 'STATUS (texto original)', kind: 'text' },
  { field: 'boletoRaw', label: 'Coluna 13 (boleto)', kind: 'text' },
  { field: 'paymentRaw', label: 'R$ enviado', kind: 'text' },
  { field: 'docsSentDate', label: 'Docs enviados', kind: 'date' },
  { field: 'columnPRaw', label: 'Coluna P', kind: 'text' },
]

export function EditProcessForm({
  processRef,
  onEnqueued,
}: {
  processRef: string
  onEnqueued: () => void
}) {
  const [field, setField] = useState<string>(FIELDS[0]?.field ?? 'clientRaw')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const definition = FIELDS.find((candidate) => candidate.field === field)
  const isDate = definition?.kind === 'date'

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      // Campo de data vazio é **célula vazia**, e não "não mexer": é assim que o
      // operador limpa uma data. Em campo de texto, string vazia é o mesmo.
      await enqueueEdit({ ref: processRef, field, value: isDate && value === '' ? null : value })
      setValue('')
      onEnqueued()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Editar processo" className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Editar</h2>
      <p className="mt-1 text-xs text-slate-600">
        A alteração entra numa fila e aparece imediatamente no painel.{' '}
        <strong>A planilha não é modificada</strong> — gravar é um passo separado.
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Campo
          <select
            value={field}
            onChange={(event) => {
              setField(event.target.value)
              setValue('')
              setError(null)
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          >
            {FIELDS.map((option) => (
              <option key={option.field} value={option.field}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex grow flex-col gap-1 text-xs text-slate-600 sm:max-w-sm">
          Valor novo
          <input
            type={isDate ? 'date' : 'text'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={isDate ? '' : 'deixe vazio para esvaziar a célula'}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Enfileirando…' : 'Enfileirar'}
        </button>
      </form>

      {error !== null && (
        <p
          role="alert"
          className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </p>
      )}
    </section>
  )
}
