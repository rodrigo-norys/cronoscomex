import { useState } from 'react'
import { discardAllEdits, discardEdit, type ProcessDetailResponse } from '../api-client.ts'

type PendingEdit = ProcessDetailResponse['pendingEdits'][number]

/**
 * As edições que esperam gravação **deste** processo (`H-23`).
 *
 * Mostra só as do REF aberto: a fila inteira aqui confundiria pendência deste
 * processo com pendência de outro. O esvaziamento global existe porque é
 * critério de aceite, e o rótulo declara o alcance: descartar sem saber que
 * atinge todos os processos seria o pior botão da aplicação.
 */

const FIELD_LABELS: Readonly<Record<string, string>> = {
  clientRaw: 'Cliente',
  importerRaw: 'Importador',
  billOfLading: 'BL',
  agentRaw: 'Agente',
  container: 'Container',
  vesselRaw: 'Navio',
  portRaw: 'Porto',
  eta2: 'ETA2',
  goodsRaw: 'Mercadoria',
  registrationDate: 'Registro (RG)',
  statusRaw: 'STATUS',
  boletoRaw: 'Coluna 13',
  paymentRaw: 'R$ enviado',
  docsSentDate: 'Docs enviados',
  columnPRaw: 'Coluna P',
}

/**
 * Nem a troca de cor nem a linha nova tem campo e valor: numa muda o estilo, na
 * outra nao ha estado anterior nenhum. As tres funcoes abaixo lhes dao a mesma
 * forma "de → para" das demais, sem inventar valor de celula que nao existe.
 */
function labelOf(edit: PendingEdit): string {
  if (edit.kind === 'color') return 'Cor da linha'
  if (edit.kind === 'insert') return 'Linha nova'
  return FIELD_LABELS[edit.field] ?? edit.field
}

function previousOf(edit: PendingEdit): string {
  if (edit.kind === 'color') return edit.previousLabel
  // **"(não existe)", e não "(vazio)"**: a linha ainda não está na planilha, e
  // dizer que ela está vazia afirmaria uma célula que não há (regra 3).
  if (edit.kind === 'insert') return '(não existe)'
  return edit.previous === '' ? '(vazio)' : edit.previous
}

function nextOf(edit: PendingEdit): string {
  if (edit.kind === 'color') return edit.label
  if (edit.kind === 'insert') {
    const preenchidos = Object.values(edit.values).filter(
      (value) => value !== null && value !== '',
    ).length
    return `${edit.ref} — ${preenchidos} ${preenchidos === 1 ? 'campo' : 'campos'}`
  }
  return edit.value === null || edit.value === '' ? '(vazio)' : edit.value
}

export function PendingEditsPanel({
  edits,
  onChanged,
}: {
  edits: readonly PendingEdit[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    try {
      await action()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Edições pendentes"
      className="rounded-container border border-state-warning-border bg-state-warning-bg p-4"
    >
      <h2 className="text-sm font-semibold text-state-warning-fg">
        Edições pendentes deste processo
      </h2>

      {edits.length === 0 ? (
        <p className="mt-2 text-sm text-state-warning-fg">
          Nenhuma. Os valores exibidos são os da planilha.
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-2">
            {edits.map((edit) => (
              <li key={edit.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <strong className="text-state-warning-fg">{labelOf(edit)}</strong>
                <span className="text-state-warning-fg">
                  {/* Sem `opacity`: o valor anterior e o que o operador confere
                      antes de gravar, e a 60% ele media 3.23:1 sobre o painel
                      de aviso, contra o limiar de 4.5 que `text-sm` exige
                      (`VN-6`, `H-71`). Solido mede 8.73:1. O que separa
                      anterior de novo passa a ser so o par risco/negrito, e
                      nenhum dos dois e cor — que e o que `ACHADO 18` pede. */}
                  <span className="line-through">{previousOf(edit)}</span> →{' '}
                  <strong>{nextOf(edit)}</strong>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => discardEdit(edit.id))}
                  className="rounded-control border border-state-warning-fg px-2 py-0.5 text-xs text-state-warning-fg disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
                >
                  Descartar
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-state-warning-fg">
            Nada foi gravado na planilha. Gravar é um passo separado, pelo botão{' '}
            <strong>Aplicar alterações</strong>.
          </p>
        </>
      )}

      {edits.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(discardAllEdits)}
          className="mt-3 rounded-control border border-state-warning-fg px-3 py-1 text-xs font-medium text-state-warning-fg disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
        >
          Esvaziar a fila inteira — de <strong>todos</strong> os processos
        </button>
      )}
    </section>
  )
}
