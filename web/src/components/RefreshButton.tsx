interface RefreshButtonProps {
  onRefresh: () => Promise<void>
  busy: boolean
}

/**
 * A terceira frente de A-62, e a saida explicita para o que os dois gatilhos
 * automaticos nao cobrem. O `onRefresh` chama `POST /api/reload` antes de
 * refazer as requisicoes — a ordem importa, e vive em `useAppData`.
 */
export function RefreshButton({ onRefresh, busy }: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={busy}
      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-progress disabled:opacity-60"
    >
      {busy ? 'Atualizando…' : 'Atualizar'}
    </button>
  )
}
