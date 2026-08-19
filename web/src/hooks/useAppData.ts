import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, type HealthResponse, requestReload } from '../api-client.ts'

/**
 * Alinhado a RNF-14, que mede 2092 ms entre o Excel salvar e o servidor
 * refletir. O intervalo e o que estende essa medida ate a tela: sem ele, o
 * numero e verdadeiro no servidor e velho no navegador.
 */
export const HEALTH_POLL_MS = 5_000

export interface AppData {
  health: HealthResponse | null
  healthError: string | null
  /**
   * Muda quando o dado do servidor mudou ou o dia virou. As paginas de `H-16` a
   * `H-22` observam isto para refazer as proprias requisicoes — a casca nao
   * conhece nenhuma delas, e nao deve conhecer.
   */
  dataVersion: number
  refreshing: boolean
  refresh: () => Promise<void>
  /**
   * Aplica um health que quem chamou JA tem em maos, sem ir a rede.
   *
   * Existe por `PUT /api/config/workbook`, que responde o proprio corpo do
   * health ja com a leitura nova: sem isto a casca so descobre o caminho novo
   * no poll seguinte, e a tela de configuracao fica identica por ate
   * `HEALTH_POLL_MS` depois de um clique que deu certo.
   */
  applyHealth: (health: HealthResponse) => void
}

interface SeenState {
  today: string
  lastReadAt: string | null
}

/**
 * A fonte unica de estado da casca, e as tres frentes de A-62.
 *
 * O problema: indicadores de calendario e alertas dependem do **dia corrente**,
 * e nenhum arquivo muda a meia-noite — o watcher nao dispara, e uma tela aberta
 * atravessa a virada exibindo a fila de ontem.
 *
 * 1. **`visibilitychange`** — a aba voltar ao foco verifica na hora, e o
 *    intervalo so corre com a aba visivel. Um timer agendado para a meia-noite
 *    **nao** serve: maquina suspensa nao executa `setTimeout`, e acordaria de
 *    manha ainda no dia anterior, que e exatamente a falha a evitar.
 * 2. **Comparacao do dia** — cada resposta traz o dia civil do servidor. Se ele
 *    difere daquele sob o qual a tela renderizou, o dia virou e `dataVersion`
 *    avanca. E a rede do painel que nunca perde o foco. `lastReadAt` entra na
 *    mesma comparacao porque significa a outra metade: dado novo, nao dia novo.
 * 3. **`refresh`** — o botao manual, que chama `POST /api/reload` **antes** de
 *    refazer as requisicoes; quem clica acabou de mexer na planilha.
 *
 * A comparacao decide, o evento so provoca: revalidar incondicionalmente ao
 * voltar o foco custaria uma rodada de requisicoes toda vez que o operador
 * troca de janela, sem nada ter mudado dos dois lados.
 */
export function useAppData(): AppData {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const seen = useRef<SeenState | null>(null)

  const applyHealth = useCallback((next: HealthResponse): void => {
    const previous = seen.current
    seen.current = { today: next.today, lastReadAt: next.lastReadAt }

    setHealth(next)
    setHealthError(null)

    const changed =
      previous !== null &&
      (previous.today !== next.today || previous.lastReadAt !== next.lastReadAt)
    if (changed) setDataVersion((version) => version + 1)
  }, [])

  const checkHealth = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        applyHealth(await getHealth(signal))
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setHealthError(error instanceof Error ? error.message : String(error))
      }
    },
    [applyHealth],
  )

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setInterval> | null = null

    const stopPolling = (): void => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }

    const startPolling = (): void => {
      stopPolling()
      timer = setInterval(() => void checkHealth(controller.signal), HEALTH_POLL_MS)
    }

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        stopPolling()
        return
      }
      void checkHealth(controller.signal)
      startPolling()
    }

    void checkHealth(controller.signal)
    if (!document.hidden) startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopPolling()
      controller.abort()
    }
  }, [checkHealth])

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      await requestReload()
      await checkHealth()
      // Incondicional, ao contrario da comparacao: quem clicou pediu o refazer,
      // e o botao e a saida explicita para o que os dois gatilhos nao cobrem.
      setDataVersion((version) => version + 1)
    } finally {
      setRefreshing(false)
    }
  }, [checkHealth])

  return { health, healthError, dataVersion, refreshing, refresh, applyHealth }
}
