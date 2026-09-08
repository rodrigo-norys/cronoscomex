import { useEffect, useMemo, useState } from 'react'
import { getAlerts, getProcesses } from '../api-client.ts'
import { groupByProcess } from '../components/AlertRow.tsx'
import { useProcessQuery } from './useProcessQuery.ts'

/**
 * As contagens que a lateral exibe ao lado de Operacional e de Alertas
 * (`H-87`, `D-29`).
 *
 * **Nenhum contrato novo:** `GET /api/processes` ja devolve `total` respeitando
 * os filtros e `activeOnly`, e `GET /api/alerts` ja respeita os filtros por
 * `RF-18`. O que faltava era a casca buscar o que o servidor ja serve. Nada e
 * contado, somado ou filtrado aqui (regra inviolavel 6).
 *
 * **O recorte NAO e fixado aqui.** Ele vem de `useProcessQuery`, o mesmo hook
 * que a Pagina Operacional usa, e `navigate` preserva a query ao trocar de
 * pagina — entao o numero da lateral e literalmente o que a tabela mostra ao
 * ser aberta. Uma versao anterior desta historia mandava fixar `activeOnly=true`;
 * `D-33` inverteu o padrao em 04/09/2026, e a lateral diria 170 com a tabela em
 * 650. Espelhar o hook faz o numero acompanhar sem esta historia ser reaberta.
 *
 * **`null` e ausencia de contagem, e nunca `0`.** Zero e uma afirmacao — filtro
 * que nao casa nada —, e exibi-lo enquanto a resposta nao chegou, ou depois de
 * uma falha, afirmaria vazio onde o que se sabe e nada (regra inviolavel 3).
 */
export interface NavCounts {
  readonly processes: number | null
  readonly alerts: number | null
}

const VAZIO: NavCounts = { processes: null, alerts: null }

export function useNavCounts(
  queryString: string,
  dataVersion: number,
  enabled: boolean,
): NavCounts {
  const { requestQuery } = useProcessQuery()
  const [processes, setProcesses] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<number | null>(null)

  /**
   * `limit=1` e deliberado: sem ele a casca traria 200 processos a cada troca
   * de filtro para exibir um numero. Ordenacao e pagina saem porque nao mudam
   * `total` — mantidas, clicar numa coluna refaria a contagem a toa.
   */
  const countQuery = useMemo(() => {
    const params = new URLSearchParams(requestQuery)
    params.set('limit', '1')
    params.delete('offset')
    params.delete('sort')
    params.delete('order')
    return `?${params.toString()}`
  }, [requestQuery])

  // `dataVersion` e gatilho, nao valor lido — mesmo caso de `useProcesses`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; sem ele o numero congela na primeira leitura
  useEffect(() => {
    if (!enabled) {
      setProcesses(null)
      return
    }

    // O recorte mudou, e o numero anterior passou a descrever outro conjunto.
    // Mante-lo ate a resposta chegar mostraria um total que a tabela nao tem.
    setProcesses(null)

    const controller = new AbortController()
    getProcesses(countQuery, controller.signal)
      .then((page) => setProcesses(page.total))
      .catch((cause: Error) => {
        // `AbortError` e a resposta ANTIGA sendo descartada: zerar aqui faria a
        // troca rapida de filtro apagar o numero que ja chegou pelo pedido novo.
        if (cause.name === 'AbortError') return
        // A navegacao nao pode quebrar por um numero: sem contagem, sem erro na
        // tela. Quem reporta falha de leitura e a faixa de estado (A-57).
        setProcesses(null)
      })

    return () => controller.abort()
  }, [countQuery, dataVersion, enabled])

  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho deliberado; a fila muda pela passagem do dia sem a planilha mudar (A-62)
  useEffect(() => {
    if (!enabled) {
      setAlerts(null)
      return
    }

    setAlerts(null)

    const controller = new AbortController()
    getAlerts(queryString, controller.signal)
      // O MESMO agrupamento da Pagina Alertas, pela mesma funcao: ela mostra
      // "N processos pedem acao" no cabecalho da fila, e dois numeros
      // divergentes na mesma tela e o defeito que `D-29` existe para evitar.
      .then((response) => setAlerts(groupByProcess(response.items).length))
      .catch((cause: Error) => {
        if (cause.name === 'AbortError') return
        setAlerts(null)
      })

    return () => controller.abort()
  }, [queryString, dataVersion, enabled])

  return enabled ? { processes, alerts } : VAZIO
}
