import { useEffect, useState } from 'react'
import { getMonthlyHistory, type MonthlyHistoryResponse, NoReadYetError } from '../api-client.ts'

/**
 * A serie mensal da Pagina Historico — os mesmos quatro estados de
 * `useIndicators`, e pelo mesmo motivo.
 *
 * **Serie vazia nao e `semLeitura`, e a distincao e a regra inteira aqui.** A
 * rota responde `503` enquanto a planilha nunca foi lida; `series: []` com
 * `historyStartedAt: null` e outra coisa: a planilha foi lida e o arquivo de
 * historico esta vazio ou foi apagado. A primeira e "ainda nao se sabe", a
 * segunda e "nao ha passado registrado" (A-43) — dois textos diferentes na
 * tela, e nenhum deles um grafico zerado.
 */
export type HistoryState =
  | { status: 'carregando' }
  | { status: 'pronto'; history: MonthlyHistoryResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

/**
 * `months` entra nas dependencias como valor: e o seletor de janela da propria
 * pagina, e trocar de janela e uma requisicao nova.
 */
export function useHistory(queryString: string, months: number, dataVersion: number): HistoryState {
  const [state, setState] = useState<HistoryState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — igual a `useIndicators`. Cada
  // releitura da planilha grava eventos novos (`H-28`), entao remove-lo
  // congelaria a serie no estado da primeira leitura da sessao.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela a serie na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getMonthlyHistory(queryString, months, controller.signal)
      .then((history) => setState({ status: 'pronto', history }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        if (cause instanceof NoReadYetError) {
          setState({ status: 'semLeitura' })
          return
        }
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [queryString, months, dataVersion])

  return state
}
