import { useEffect, useRef, useState } from 'react'
import { enqueueRow } from '../api-client.ts'
import { LiveAnnouncement } from './PageAlert.tsx'

/**
 * A linha nova da Pagina Operacional (02/09/2026).
 *
 * **Pede a REF, e so ela.** A REF e a chave natural — sem ela a linha nao e um
 * processo, e nasceria na quarentena por `REF_AUSENTE`. O resto se preenche na
 * propria tabela: a linha aparece assim que e enfileirada, pela projecao do
 * servidor, e as celulas dela se editam como as das demais.
 *
 * **Nada aqui grava no `.xlsx`.** A linha entra na fila e vai para a planilha no
 * `Aplicar alteracoes`, atras das seis defesas de `H-25` — mais uma que so ela
 * tem: a REF nao pode ja existir no arquivo no momento da escrita.
 *
 * Quem recusa REF repetida e o servidor, com `409`: conferir aqui criaria uma
 * segunda regra ao lado da dele, e ela divergiria assim que a planilha mudasse
 * sob a tela (regra inviolavel 6).
 */
export function NewRowButton({ onCreated }: { onCreated: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [ref, setRef] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) campo.current?.focus()
  }, [aberto])

  function fechar(): void {
    setAberto(false)
    setRef('')
    setErro(null)
  }

  async function criar(): Promise<void> {
    if (ref.trim() === '') return
    setOcupado(true)
    setErro(null)
    try {
      await enqueueRow(ref.trim())
      fechar()
      onCreated()
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setOcupado(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="button-primary motion-tint px-3 py-1.5"
      >
        Nova linha
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        REF do processo novo
        <input
          ref={campo}
          value={ref}
          disabled={ocupado}
          aria-invalid={erro !== null}
          onChange={(event) => setRef(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void criar()
            if (event.key === 'Escape') fechar()
          }}
          placeholder="ex.: FT900.26"
          className="rounded-control border border-border-control bg-surface-raised px-3 py-1.5 text-sm text-text-primary"
        />
      </label>

      <button
        type="button"
        onClick={() => void criar()}
        disabled={ocupado || ref.trim() === ''}
        className="button-primary motion-tint px-3 py-1.5"
      >
        Enfileirar
      </button>
      <button
        type="button"
        onClick={fechar}
        disabled={ocupado}
        className="motion-tint rounded-control border border-border-control px-3 py-1.5 text-sm text-text-secondary hover:border-border-strong"
      >
        Cancelar
      </button>

      {erro !== null && (
        <>
          <p className="w-full text-xs text-state-error-fg">{erro}</p>
          <LiveAnnouncement text={`Linha nova recusada. ${erro}`} />
        </>
      )}
    </div>
  )
}
