import { useEffect, useState } from 'react'
import { getProcesses, NoReadYetError, type ProcessesResponse } from '../api-client.ts'

/**
 * Os mesmos quatro estados de `useIndicators`, e pelo mesmo motivo: `503`
 * significa que nunca houve leitura, e uma tabela vazia ali afirmaria que a
 * planilha nao tem processo nenhum (regra inviolavel 3).
 */
export type ProcessesState =
  | { status: 'carregando' }
  | { status: 'pronto'; page: ProcessesResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

export function useProcesses(requestQuery: string, dataVersion: number): ProcessesState {
  const [state, setState] = useState<ProcessesState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useIndicators`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela a lista na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getProcesses(requestQuery, controller.signal)
      .then((page) => setState({ status: 'pronto', page }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        if (cause instanceof NoReadYetError) {
          setState({ status: 'semLeitura' })
          return
        }
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [requestQuery, dataVersion])

  return state
}
