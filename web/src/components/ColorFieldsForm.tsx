import { useEffect, useState } from 'react'
import { type ColorOption, type ColorTarget, enqueueColor, getColorOptions } from '../api-client.ts'

/**
 * Os três campos que só existem como cor — responsável, canal e localização do
 * importador (`H-27`).
 *
 * **Nada aqui grava no `.xlsx`.** O envio enfileira, como o formulário de
 * campos, e a cor nova aparece no painel pela projeção do servidor.
 *
 * O menu vem de `GET /api/color-options`, e não de uma lista escrita aqui: a
 * fonte é `config/color-map.json`, e uma segunda cópia divergiria dele — a tela
 * ofereceria uma cor que a escrita não grava. Por isso também não há um seletor
 * por campo: nem toda combinação dos três é representável (A-31).
 */

function keyOf(option: ColorOption): string {
  return `${option.responsible}|${option.customsChannel}|${option.importerOutsideRj}`
}

const RESPONSIBLE_LABELS: Readonly<Record<string, string>> = {
  colaborador1: 'Colaborador 1',
  colaborador2: 'Colaborador 2',
  colaborador1_outros_clientes: 'Colaborador 1, outros clientes',
  indefinido: 'sem responsável',
}

const CHANNEL_LABELS: Readonly<Record<string, string>> = {
  verde: 'Canal Verde',
  vermelho: 'Canal Vermelho',
  indefinido: 'canal indefinido',
}

/**
 * O que a cor escolhida grava nos três campos.
 *
 * Sem isto o menu diria só "Amarelo forte", e escolhê-la numa linha de
 * Colaborador 1 reverteria o responsável para indefinido sem que o operador
 * tivesse pedido — os três andam juntos, e a tela precisa dizer os três.
 */
function describe(target: ColorTarget): string {
  const partes = [
    RESPONSIBLE_LABELS[target.responsible] ?? target.responsible,
    CHANNEL_LABELS[target.customsChannel] ?? target.customsChannel,
  ]
  if (target.importerOutsideRj) partes.push('importador fora do RJ')
  return partes.join(' · ')
}

export function ColorFieldsForm({
  processRef,
  current,
  onEnqueued,
}: {
  processRef: string
  /**
   * O que a cor da linha diz hoje, para o operador comparar antes de trocar.
   * `null` quando a cor não foi reconhecida pelo mapa — e aí o texto diz isso,
   * em vez de descrever uma combinação que ninguém leu (regra inviolável 3).
   */
  current: ColorTarget | null
  onEnqueued: () => void
}) {
  const [options, setOptions] = useState<ColorOption[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getColorOptions(controller.signal)
      .then((response) => setOptions(response.options))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const option = options?.find((candidate) => keyOf(candidate) === chosen)
    if (option === undefined) return

    setBusy(true)
    setError(null)
    try {
      await enqueueColor(processRef, {
        responsible: option.responsible,
        customsChannel: option.customsChannel,
        importerOutsideRj: option.importerOutsideRj,
      })
      setChosen('')
      onEnqueued()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Alterar cor da linha"
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Responsável, canal e importador</h2>
      <p className="mt-1 text-xs text-text-secondary">
        Os três são gravados juntos, como a <strong>cor da linha</strong> — é assim que a planilha
        os registra, então escolher uma cor <strong>substitui os três</strong>. A alteração entra na
        fila; <strong>a planilha não é modificada</strong>.
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        Hoje esta linha diz:{' '}
        <strong>{current === null ? 'cor não reconhecida' : describe(current)}</strong>
      </p>

      {/* Os DOIS `role="alert"` deste formulario existem desde a montagem
          (`H-43`) — este e o da recusa, mais abaixo. */}
      <p role="alert" className={failed ? 'mt-2 text-sm text-text-secondary' : 'sr-only'}>
        {failed && 'Não foi possível carregar as cores configuradas.'}
      </p>

      {options !== null && options.length === 0 && (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhuma cor configurada em <code>config/color-map.json</code>.
        </p>
      )}

      {options !== null && options.length > 0 && (
        <>
          <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex grow flex-col gap-1 text-xs text-text-secondary sm:max-w-sm">
              Cor da linha
              <select
                value={chosen}
                onChange={(event) => {
                  setChosen(event.target.value)
                  setError(null)
                }}
                className="rounded border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
              >
                <option value="">Selecione…</option>
                {options.map((option) => (
                  <option key={keyOf(option)} value={keyOf(option)}>
                    {option.label} — {describe(option)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={busy || chosen === ''}
              className="rounded border border-action-bg bg-action-bg px-3 py-1.5 text-sm font-medium text-action-fg disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
            >
              {busy ? 'Enfileirando…' : 'Enfileirar'}
            </button>
          </form>

          {/* A planilha tem tons distintos da mesma cor (A-48), e a gravação
              unifica no tom principal. Sem este aviso, o operador veria a linha
              mudar de tom sem ter pedido. */}
          <p className="mt-2 text-xs text-text-secondary">
            A planilha tem tons diferentes da mesma cor. A gravação usa sempre o tom principal de
            cada uma, então uma linha pode mudar de tom sem mudar de significado.
          </p>
        </>
      )}

      <p
        role="alert"
        className={
          error === null
            ? 'sr-only'
            : 'mt-2 rounded border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg'
        }
      >
        {error}
      </p>
    </section>
  )
}
