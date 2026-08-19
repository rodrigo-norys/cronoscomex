import { useCallback, useEffect, useState } from 'react'
import type { WorkbookConfigResponse } from '../../../src/http/routes/config.ts'
import { getWorkbookConfig, setWorkbookPath } from '../api-client.ts'

/**
 * Tres estados, e nao os quatro das paginas de dado.
 *
 * `semLeitura` nao existe aqui de proposito: `GET /api/config/workbook` e a
 * unica rota de leitura que **nunca** responde `503`, porque ela existe
 * justamente para o estado em que nao houve leitura nenhuma. Um quarto estado
 * que a rota nao produz seria ramo morto.
 */
export type WorkbookConfigState =
  | { status: 'carregando' }
  | { status: 'pronto'; config: WorkbookConfigResponse }
  | { status: 'erro'; message: string }

export interface WorkbookConfigAccess {
  state: WorkbookConfigState
  /** `null` quando gravou; a frase do servidor quando recusou. */
  save(path: string): Promise<string | null>
  saving: boolean
}

/**
 * O caminho configurado, e o comando que o troca.
 *
 * `dataVersion` e gatilho, como nas paginas de dado: depois de uma releitura o
 * `exists`/`readable` pode ter mudado sem que ninguem tenha salvado nada — a
 * pasta do OneDrive dessincronizou, por exemplo.
 */
export function useWorkbookConfig(dataVersion: number): WorkbookConfigAccess {
  const [state, setState] = useState<WorkbookConfigState>({ status: 'carregando' })
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela o caminho exibido na primeira carga
  useEffect(() => {
    const controller = new AbortController()

    getWorkbookConfig(controller.signal)
      .then((config) => setState({ status: 'pronto', config }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [dataVersion, reloadToken])

  const save = useCallback(async (path: string): Promise<string | null> => {
    setSaving(true)
    try {
      await setWorkbookPath(path)
      // Recarrega o proprio recorte: o `exists`/`readable` do caminho novo vem
      // do servidor, e derivar do sucesso da gravacao afirmaria legibilidade
      // que ninguem conferiu depois da releitura.
      setReloadToken((token) => token + 1)
      return null
    } catch (cause) {
      return (cause as Error).message
    } finally {
      setSaving(false)
    }
  }, [])

  return { state, save, saving }
}
