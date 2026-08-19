import { useCallback, useEffect, useState } from 'react'
import type { WorkbookConfigResponse } from '../../../src/http/routes/config.ts'
import {
  browseWorkbookPath,
  getWorkbookConfig,
  type HealthResponse,
  setWorkbookPath,
} from '../api-client.ts'

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

/**
 * O desfecho de um clique em "Carregar esta planilha".
 *
 * Carrega o health que o `PUT` devolve, e nao so "deu certo": **gravar o
 * caminho e ler a planilha sao coisas diferentes**, e o caso em que o caminho e
 * aceito e a leitura falha — planilha sem a aba `2026` — responde 200. Sem o
 * corpo, a tela teria de escolher entre chamar isso de sucesso ou de erro, e as
 * duas escolhas mentem.
 */
export type SaveOutcome =
  | { saved: true; health: HealthResponse }
  | { saved: false; message: string }

/**
 * O desfecho de um clique em "Escolher arquivo".
 *
 * **Cancelar tem desfecho proprio** — `chosen: false` com `message` nula. E o
 * caso mais comum depois do acerto, e o unico em que nao ha nada a dizer: uma
 * mensagem ali acusaria problema onde o operador so mudou de ideia.
 */
export type BrowseOutcome =
  | { chosen: true; path: string }
  | { chosen: false; message: string | null }

export interface WorkbookConfigAccess {
  state: WorkbookConfigState
  save(path: string): Promise<SaveOutcome>
  saving: boolean
  browse(): Promise<BrowseOutcome>
  browsing: boolean
  /**
   * Reconfere o estado sem reiniciar nada (H-36).
   *
   * **E o MESMO caminho que `save` usa** — o `reloadToken` —, e nao uma segunda
   * regra: o operador que sincroniza o OneDrive no Explorer e reconfere ali
   * mesmo precisa ver exatamente o que veria depois de gravar.
   */
  reload(): void
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
  const [browsing, setBrowsing] = useState(false)
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

  const save = useCallback(async (path: string): Promise<SaveOutcome> => {
    setSaving(true)
    try {
      const health = await setWorkbookPath(path)
      // Recarrega o proprio recorte: o `exists`/`readable` do caminho novo vem
      // do servidor, e derivar do sucesso da gravacao afirmaria legibilidade
      // que ninguem conferiu depois da releitura.
      setReloadToken((token) => token + 1)
      return { saved: true, health }
    } catch (cause) {
      return { saved: false, message: (cause as Error).message }
    } finally {
      setSaving(false)
    }
  }, [])

  const browse = useCallback(async (): Promise<BrowseOutcome> => {
    setBrowsing(true)
    try {
      const path = await browseWorkbookPath()
      return path === null ? { chosen: false, message: null } : { chosen: true, path }
    } catch (cause) {
      return { chosen: false, message: (cause as Error).message }
    } finally {
      setBrowsing(false)
    }
  }, [])

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1)
  }, [])

  return { state, save, saving, browse, browsing, reload }
}
