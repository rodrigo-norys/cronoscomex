import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEALTH_POLL_MS, useAppData } from '../src/hooks/useAppData.ts'
import {
  type ApiStub,
  healthFixture,
  restoreDocumentHidden,
  setDocumentHidden,
  stubApi,
} from './support/api-stub.ts'

/**
 * As tres frentes de A-62, e o intervalo que estende RNF-14 ate a tela.
 *
 * `waitFor` nao aparece aqui de proposito: com relogio falso ele disputa o
 * proprio `setTimeout` interno. `advanceTimersByTimeAsync` dentro de `act`
 * avanca o tempo e drena as promessas no mesmo passo, sem essa disputa.
 */

let api: ApiStub

beforeEach(() => {
  vi.useFakeTimers()
  api = stubApi()
})

afterEach(() => {
  vi.useRealTimers()
  restoreDocumentHidden()
  vi.unstubAllGlobals()
})

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useAppData', () => {
  it('consulta o health assim que monta', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()

    expect(result.current.health?.today).toBe('2026-08-07')
    expect(api.calls).toEqual(['GET /api/health'])
  })

  it('mantem o intervalo enquanto a aba esta visivel', async () => {
    renderHook(() => useAppData())
    await flush()
    await flush(HEALTH_POLL_MS * 2)

    expect(api.calls).toHaveLength(3)
  })

  it('para o intervalo com a aba oculta e verifica na hora ao voltar', async () => {
    renderHook(() => useAppData())
    await flush()

    act(() => setDocumentHidden(true))
    await flush(HEALTH_POLL_MS * 3)
    expect(api.calls).toHaveLength(1)

    act(() => setDocumentHidden(false))
    await flush()
    expect(api.calls).toHaveLength(2)
  })

  it('avanca dataVersion quando o dia do servidor vira', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()
    expect(result.current.dataVersion).toBe(0)

    api.serve(healthFixture({ today: '2026-08-08' }))
    await flush(HEALTH_POLL_MS)

    expect(result.current.dataVersion).toBe(1)
  })

  it('avanca dataVersion quando a planilha e relida — dado novo, nao dia novo', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()

    api.serve(healthFixture({ lastReadAt: '2026-08-07T15:30:00.000Z' }))
    await flush(HEALTH_POLL_MS)

    expect(result.current.dataVersion).toBe(1)
  })

  it('nao avanca dataVersion quando nada mudou dos dois lados', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()
    await flush(HEALTH_POLL_MS * 4)

    expect(api.calls.length).toBeGreaterThan(4)
    expect(result.current.dataVersion).toBe(0)
  })

  it('o botao chama POST /api/reload ANTES de refazer as requisicoes', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()

    await act(async () => {
      await result.current.refresh()
    })

    expect(api.calls).toEqual(['GET /api/health', 'POST /api/reload', 'GET /api/health'])
  })

  it('o botao revalida mesmo sem nada ter mudado — e a saida explicita', async () => {
    const { result } = renderHook(() => useAppData())
    await flush()

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.dataVersion).toBe(1)
  })

  it('falha de rede vira aviso, nao derruba a casca', async () => {
    api.failNextHealth('conexao recusada')
    const { result } = renderHook(() => useAppData())
    await flush()

    expect(result.current.healthError).toMatch(/conexao recusada/)
    expect(result.current.health).toBeNull()
  })

  it('a falha se limpa na consulta seguinte que der certo', async () => {
    api.failNextHealth('conexao recusada')
    const { result } = renderHook(() => useAppData())
    await flush()

    await flush(HEALTH_POLL_MS)

    expect(result.current.healthError).toBeNull()
    expect(result.current.health).not.toBeNull()
  })

  it('desmontar encerra o intervalo', async () => {
    const { unmount } = renderHook(() => useAppData())
    await flush()

    unmount()
    await flush(HEALTH_POLL_MS * 3)

    expect(api.calls).toHaveLength(1)
  })
})
