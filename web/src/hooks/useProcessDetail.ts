import { useCallback, useEffect, useState } from 'react'
import {
  getProcessDetail,
  NoReadYetError,
  type ProcessDetailResponse,
  ProcessNotFoundError,
} from '../api-client.ts'

/**
 * O detalhe de um processo — os quatro estados de `useIndicators`, mais um.
 *
 * `naoEncontrado` existe porque `404` é resposta legítima do servidor, e não
 * falha: a REF pode ter sumido entre a leitura que montou o link e a atual, ou
 * ter sido digitada na barra de endereço. Tratá-lo como erro genérico daria uma
 * tela de "algo deu errado" onde a resposta certa é "esta REF não existe" —
 * mesma família da distinção que `NoReadYetError` faz.
 */
export type ProcessDetailState =
  | { status: 'carregando' }
  | { status: 'pronto'; detail: ProcessDetailResponse }
  | { status: 'naoEncontrado' }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

export interface ProcessDetailAccess {
  state: ProcessDetailState
  /**
   * Refaz a requisicao sem esperar releitura da planilha.
   *
   * Enfileirar ou descartar uma edicao muda o que a rota devolve — a projecao e
   * aplicada a cada `getState` —, e nada nisso dispara o watcher. Sem este
   * gatilho a tela so mostraria a edicao no proximo `dataVersion`.
   */
  refresh: () => void
}

export function useProcessDetail(ref: string, dataVersion: number): ProcessDetailAccess {
  const [state, setState] = useState<ProcessDetailState>({ status: 'carregando' })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((current) => current + 1), [])

  // `dataVersion` e gatilho, nao valor lido — igual as demais paginas. Sem ele o
  // detalhe congela na primeira leitura, e uma releitura da planilha deixaria de
  // aparecer aqui.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `dataVersion` e `nonce` sao gatilhos deliberados; remove-los congela o detalhe
  useEffect(() => {
    const controller = new AbortController()

    getProcessDetail(ref, controller.signal)
      .then((detail) => setState({ status: 'pronto', detail }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        if (cause instanceof ProcessNotFoundError) {
          setState({ status: 'naoEncontrado' })
          return
        }
        if (cause instanceof NoReadYetError) {
          setState({ status: 'semLeitura' })
          return
        }
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [ref, dataVersion, nonce])

  return { state, refresh }
}
