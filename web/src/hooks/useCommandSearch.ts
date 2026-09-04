import { useEffect, useState } from 'react'
import { getProcesses, NoReadYetError, type ProcessDto } from '../api-client.ts'

/**
 * A consulta da busca por atalho (`H-83`).
 *
 * **Nenhum contrato novo:** usa `GET /api/processes` com o `search` que `H-17`
 * ja serve, sobre os seis campos de texto da planilha (`A-39`, `D-34`). O
 * casamento acontece no servidor, por
 * `matchesSearch`, que vive no dominio — filtrar a lista aqui poria regra de
 * negocio no cliente (regra inviolavel 6).
 *
 * **`activeOnly=false` de proposito.** A Pagina Operacional recorta a fila de
 * trabalho; esta busca acha UM processo pela referencia, e o desembaracado e
 * justamente o que se procura por REF depois de fechado. O padrao da rota ja e
 * este — declarado aqui para nao depender dele.
 *
 * **Os mesmos quatro estados dos outros hooks de consulta**, mais `ocioso`:
 * termo curto demais nao vira requisicao, e `carregando` ali acenderia um
 * indicador que nunca resolve.
 */

export type CommandSearchState =
  | { status: 'ocioso' }
  | { status: 'carregando' }
  | { status: 'pronto'; items: readonly ProcessDto[]; total: number }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }

/**
 * Abaixo disto a busca devolveria quase tudo, e a lista deixaria de ajudar.
 * Uma letra casa centenas de REFs — medido na planilha real: 650 processos, e o
 * prefixo `FT` cobre todos eles.
 */
const TERMO_MINIMO = 2

/** Teto da lista. O operador procura UM processo; rolar dez ja e sinal de que o termo esta curto. */
const LIMITE = 10

/** O intervalo entre a tecla e a requisicao. Digitar "FT057" dispararia cinco. */
const ESPERA_MS = 180

export function useCommandSearch(termo: string, dataVersion: number): CommandSearchState {
  const [state, setState] = useState<CommandSearchState>({ status: 'ocioso' })

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useProcesses`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; sem ele a busca serve dado da leitura anterior
  useEffect(() => {
    const limpo = termo.trim()
    if (limpo.length < TERMO_MINIMO) {
      setState({ status: 'ocioso' })
      return
    }

    const controller = new AbortController()
    // O atraso vive DENTRO do efeito, e o `clearTimeout` na limpeza: assim cada
    // tecla cancela a requisicao anterior antes de ela sair.
    const agendado = setTimeout(() => {
      setState({ status: 'carregando' })
      const busca = `?search=${encodeURIComponent(limpo)}&activeOnly=false&limit=${LIMITE}`

      getProcesses(busca, controller.signal)
        .then((page) => setState({ status: 'pronto', items: page.items, total: page.total }))
        .catch((cause: Error) => {
          if (cause.name === 'AbortError') return
          if (cause instanceof NoReadYetError) {
            setState({ status: 'semLeitura' })
            return
          }
          setState({ status: 'erro', message: cause.message })
        })
    }, ESPERA_MS)

    return () => {
      clearTimeout(agendado)
      controller.abort()
    }
  }, [termo, dataVersion])

  return state
}
