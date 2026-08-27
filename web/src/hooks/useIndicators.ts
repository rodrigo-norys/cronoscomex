import { useEffect, useState } from 'react'
import {
  getIndicators,
  getQuarantine,
  type IndicatorsResponse,
  NoReadYetError,
  type QuarantineResponse,
} from '../api-client.ts'

/**
 * Quatro estados, e nenhum deles e "zero".
 *
 * `semLeitura` existe porque a rota responde `503` enquanto `lastReadAt` e
 * `null`, e um painel de zeros ali afirmaria que a planilha tem zero processos
 * — indistinguivel do caso em que ela realmente tem. Buraco visivel e melhor
 * que valor errado invisivel (regra inviolavel 3).
 */
export type IndicatorsState =
  | { status: 'carregando' }
  | { status: 'pronto'; indicators: IndicatorsResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

/**
 * Os indicadores da tela, recortados pelos filtros.
 *
 * Refaz a requisicao quando o recorte muda (`queryString`) **ou** quando o dado
 * do servidor muda (`dataVersion` — dia virado ou planilha relida). A casca
 * fornece os dois e nao sabe o que esta pagina faz com eles.
 */
export function useIndicators(queryString: string, dataVersion: number): IndicatorsState {
  const [state, setState] = useState<IndicatorsState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useFilterOptions`.
  // Remover a dependencia congelaria os numeros na primeira leitura, e a virada
  // do dia (A-62) deixaria de mexer nos indicadores de calendario.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela os numeros na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getIndicators(queryString, controller.signal)
      .then((indicators) => setState({ status: 'pronto', indicators }))
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

/**
 * O relatorio da ultima leitura, para o painel de saude da ingestao.
 *
 * Nao depende dos filtros: a quarentena e sobre a **leitura do arquivo**, e
 * recortar o conjunto nao muda quantas linhas deixaram de ser interpretadas.
 */
export function useQuarantine(dataVersion: number): QuarantineResponse | null {
  const [report, setReport] = useState<QuarantineResponse | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela o relatorio na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getQuarantine(controller.signal)
      .then(setReport)
      .catch(() => {
        // O painel de saude e complementar: sem relatorio ele some, e os onze
        // cartoes continuam de pe. Derrubar a pagina por causa dele seria pior.
      })

    return () => controller.abort()
  }, [dataVersion])

  return report
}
