import { useEffect, useState } from 'react'
import { type FilterOptionsResponse, getFilterOptions } from '../api-client.ts'

export interface FilterOptionsState {
  options: FilterOptionsResponse | null
  error: string | null
}

/**
 * As opcoes vem dos dados carregados, entao mudam quando a planilha muda — por
 * isso `dataVersion` e dependencia, e nao uma busca unica na montagem. Um porto
 * novo aparecendo na planilha aparece na barra sem recarregar a pagina.
 *
 * `null` enquanto nao chegou, e `null` tambem quando a rota falha: barra sem
 * opcao e melhor que barra com catalogo inventado (A-36). O erro fica visivel
 * em vez de virar lista vazia silenciosa.
 */
export function useFilterOptions(dataVersion: number): FilterOptionsState {
  const [options, setOptions] = useState<FilterOptionsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // `dataVersion` e gatilho, nao valor lido: o efeito nao o usa, so precisa
  // correr de novo quando ele muda. A correcao automatica do lint — remover a
  // dependencia — congelaria as opcoes na primeira leitura, e um cliente novo
  // na planilha nunca apareceria na barra.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; remover congela as opcoes na primeira leitura
  useEffect(() => {
    const controller = new AbortController()

    getFilterOptions(controller.signal)
      .then((next) => {
        setOptions(next)
        setError(null)
      })
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        setError(cause.message)
      })

    return () => controller.abort()
  }, [dataVersion])

  return { options, error }
}
