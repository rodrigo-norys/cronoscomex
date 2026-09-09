import { useEffect, useState } from 'react'
import {
  type ClientKeysResponse,
  type ClientMatch,
  getClientKeys,
  getRuleReach,
  NoReadYetError,
  type RuleReachResponse,
} from '../api-client.ts'

/**
 * Toda a coluna CLT, com o dono de cada grafia (`H-88`).
 *
 * **Os mesmos quatro estados de `useIndicators`, e pelo mesmo motivo:** `503`
 * significa que nunca houve leitura, e uma lista vazia ali afirmaria que nao
 * falta declarar nada — indistinguivel do caso em que de fato nao falta (regra
 * inviolavel 3).
 *
 * **Sem `queryString`**, ao contrario de todos os outros hooks de pagina: a
 * divida e de configuracao, nao recorte (`D-32`, determinacao 2).
 */
export type ClientKeysState =
  | { status: 'carregando' }
  | { status: 'pronto'; keys: ClientKeysResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

export function useClientKeys(dataVersion: number): ClientKeysState {
  const [state, setState] = useState<ClientKeysState>({ status: 'carregando' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useIndicators`. Sem
  // ele a lista congela na primeira leitura, e uma regra declarada agora so
  // sumiria da tela na proxima abertura do painel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela a divida na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getClientKeys(controller.signal)
      .then((keys) => setState({ status: 'pronto', keys }))
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

/**
 * O alcance da regra que o operador esta digitando (`H-88`).
 *
 * **Ele existe para a determinacao 5 de `D-35`:** nenhuma regra e gravada sem o
 * operador ver o que ela captura. `Y` e `YT` sao prefixos distintos na planilha
 * real, e `Y` casa `YT-769` — sem a previsao, declarar `Y` supondo quatro
 * grafias alcanca sessenta e duas.
 *
 * **`ocioso` quando nao ha o que prever**, e nao `carregando`: valor vazio nao
 * vira requisicao, e um indicador que nunca resolve seria pior que nenhum.
 */
export type RuleReachState =
  | { status: 'ocioso' }
  | { status: 'carregando' }
  | { status: 'pronto'; reach: RuleReachResponse }
  | { status: 'erro'; message: string }

/** O intervalo entre a tecla e a requisicao — digitar "YT-7" dispararia quatro. */
const ESPERA_MS = 180

export function useRuleReach(
  match: ClientMatch,
  value: string,
  dataVersion: number,
): RuleReachState {
  const [state, setState] = useState<RuleReachState>({ status: 'ocioso' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `usePendingClients`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; sem ele a previsao usa o mapa da leitura anterior
  useEffect(() => {
    const limpo = value.trim()
    if (limpo === '') {
      setState({ status: 'ocioso' })
      return
    }

    const controller = new AbortController()
    // O atraso vive DENTRO do efeito, e o `clearTimeout` na limpeza: cada tecla
    // cancela a requisicao anterior antes de ela sair. Mesma forma de
    // `useCommandSearch`.
    const agendado = setTimeout(() => {
      setState({ status: 'carregando' })
      getRuleReach(match, limpo, controller.signal)
        .then((reach) => setState({ status: 'pronto', reach }))
        .catch((cause: Error) => {
          if (cause.name === 'AbortError') return
          setState({ status: 'erro', message: cause.message })
        })
    }, ESPERA_MS)

    return () => {
      clearTimeout(agendado)
      controller.abort()
    }
  }, [match, value, dataVersion])

  return state
}
