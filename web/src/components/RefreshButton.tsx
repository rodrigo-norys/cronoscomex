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
      className="rounded-control border border-border-control px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-base disabled:cursor-progress disabled:border-control-disabled-bg disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
    >
      {busy ? 'Atualizando…' : 'Atualizar'}
    </button>
  )
}
