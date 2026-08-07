import { useEffect, useState } from 'react'
import { type AlertsResponse, getAlerts, NoReadYetError } from '../api-client.ts'

/**
 * Os alertas da tela, recortados pelos filtros — mesmos quatro estados de
 * `useIndicators`, e pelo mesmo motivo.
 *
 * `semLeitura` não é lista vazia. A Página Alertas é fila de trabalho (A-59), e
 * "nenhuma pendência" é uma afirmação forte: dizê-la quando a planilha ainda
 * não foi lida seria o pior tipo de erro nesta tela.
 */
export type AlertsState =
  | { status: 'carregando' }
  | { status: 'pronto'; alerts: AlertsResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

export function useAlerts(queryString: string, dataVersion: number): AlertsState {
  const [state, setState] = useState<AlertsState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — igual a `useIndicators`. A fila
  // muda pela passagem do dia sem a planilha mudar (A-62), entao remove-lo
  // congelaria os alertas de calendario no dia da primeira leitura.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela a fila na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getAlerts(queryString, controller.signal)
      .then((alerts) => setState({ status: 'pronto', alerts }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        if (cause instanceof NoReadYetError) {
          setState({ status: 'semLeitura' })
          return
        }
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [queryString, dataVersion])

  return state
}
