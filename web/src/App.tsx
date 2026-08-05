import { useEffect, useState } from 'react'

interface Health {
  state: string
  workbookPath: string
  sheetName: string | null
  lastReadAt: string | null
  rowsRead: number
}

/**
 * Esqueleto da interface (H-02). A casca real, com navegacao e os 11 filtros
 * globais, e H-15. Aqui so provamos que a SPA sobe e conversa com a API.
 */
export function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">CronosComex</h1>
      <p className="mt-1 text-sm text-gray-500">Painel operacional de desembaraço aduaneiro</p>

      {error && <p className="mt-6 text-red-600">Falha ao consultar a API: {error}</p>}

      {health && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Estado</dt>
          <dd>{health.state}</dd>
          <dt className="text-gray-500">Aba</dt>
          <dd>{health.sheetName ?? '—'}</dd>
          <dt className="text-gray-500">Última leitura</dt>
          <dd>{health.lastReadAt ?? 'ainda não houve'}</dd>
        </dl>
      )}
    </main>
  )
}
