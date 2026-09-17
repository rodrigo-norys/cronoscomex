import { useEffect, useState } from 'react'
import { getTeamMap, NoReadYetError, type TeamResponse } from '../api-client.ts'

/**
 * O mapa de equipe, como a rota o serve (`H-91`).
 *
 * **Os mesmos quatro estados de `useClientKeys`, e pelo mesmo motivo:** `503`
 * significa que nunca houve leitura, e uma carteira vazia ali afirmaria que
 * nenhum importador precisa de dono — indistinguivel do caso em que de fato
 * nenhum precisa (regra inviolavel 3).
 *
 * **Sem `queryString`**, como o hook de clientes: o que ele carrega e estado de
 * configuracao, nao recorte (`D-32`, determinacao 2).
 */
export type TeamMapState =
  | { status: 'carregando' }
  | { status: 'pronto'; team: TeamResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

export function useTeamMap(dataVersion: number): TeamMapState {
  const [state, setState] = useState<TeamMapState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useClientKeys`. Sem
  // ele o painel congela na primeira leitura, e um responsavel criado agora so
  // apareceria na proxima abertura da aplicacao.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela a equipe na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getTeamMap(controller.signal)
      .then((team) => setState({ status: 'pronto', team }))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        if (cause instanceof NoReadYetError) {
          setState({ status: 'semLeitura' })
          return
        }
        setState({ status: 'erro', message: cause.message })
      })

    return () => controller.abort()
  }, [dataVersion])

  return state
}
