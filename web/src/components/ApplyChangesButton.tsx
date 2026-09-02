import { useState } from 'react'
import {
  type ApplyRefusal,
  ApplyRefusedError,
  type ApplyResponse,
  applyEdits,
} from '../api-client.ts'

interface ApplyChangesButtonProps {
  pendingCount: number
  /** Chamado depois de uma aplicacao bem-sucedida, para o painel reler. */
  onApplied: () => Promise<void>
  onRefused: (refusal: ApplyRefusal) => void
}

/**
 * O comando explicito de RF-21, e o **unico** ponto da interface que dispara
 * escrita no `.xlsx`.
 *
 * Fica no cabecalho, ao lado do `RefreshButton`, porque a fila e global: ela
 * atravessa processos e paginas, e um botao por tela faria o operador procurar
 * onde aplicar o que digitou em outro lugar.
 *
 * Desabilitado com fila vazia — o criterio de aceite —, e tambem enquanto a
 * aplicacao corre. A contagem no rotulo existe para o clique nunca ser as
 * cegas: o que vai para a planilha e sempre um numero que ele viu antes.
 */
/**
 * As duas grandezas ficam separadas porque uma troca de cor toca 12 celulas
 * (A-44) sem gravar valor algum: soma-las diria ao operador que ele gravou doze
 * coisas quando ele mudou a cor de uma linha.
 *
 * Zero em ambas E um desfecho valido, e nao o inesperado: a fila resolvia para
 * o que a planilha ja tinha — o operador reconfirmou a cor corrente —, e o
 * guard nao gravou byte algum. Dizer "gravadas" ali afirmaria uma escrita que
 * nao aconteceu. Achado do revisor-xml.
 */
/**
 * **A linha nova conta aqui, e a ausência dela era uma afirmação falsa.** Uma
 * fila só de inserção não grava célula por `applyCellEdits` nem repinta nada:
 * sem `inseridas`, a tela anunciava *"a planilha já estava assim — nada precisou
 * ser gravado"* ao operador que acabou de criar um processo no arquivo. Achado
 * do revisor-xml, e é o caso mais comum da funcionalidade.
 */
function describeWritten(cells: number, rows: number, inseridas: number): string {
  const parts: string[] = []
  if (inseridas > 0) {
    parts.push(inseridas === 1 ? '1 linha nova' : `${inseridas} linhas novas`)
  }
  if (cells > 0) parts.push(cells === 1 ? '1 célula gravada' : `${cells} células gravadas`)
  if (rows > 0) parts.push(rows === 1 ? '1 linha repintada' : `${rows} linhas repintadas`)

  if (parts.length === 0) return 'A planilha já estava assim — nada precisou ser gravado'
  return `${parts.join(' · ')} na planilha`
}

export function ApplyChangesButton({
  pendingCount,
  onApplied,
  onRefused,
}: ApplyChangesButtonProps) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<ApplyResponse | null>(null)

  const apply = async (): Promise<void> => {
    setBusy(true)
    setDone(null)
    try {
      const response = await applyEdits()
      setDone(response)
      await onApplied()
    } catch (error) {
      if (error instanceof ApplyRefusedError) onRefused(error.refusal)
      else {
        // NAO se afirma "nada foi gravado": quando o `fetch` rejeita, o cliente
        // nao sabe se a requisicao chegou, e a gravacao pode ter acontecido do
        // outro lado. Buraco visivel e melhor que valor errado invisivel
        // (regra inviolavel 3). Achado do revisor-xml.
        onRefused({
          code: 'ERRO_INTERNO',
          message:
            'Não foi possível falar com o servidor, e não dá para saber se a gravação chegou a acontecer. Atualize o painel antes de tentar de novo.',
          conflicts: [],
          expectedHash: null,
          actualHash: null,
          restored: false,
          backupPath: null,
          fileAtRisk: false,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* A regiao existe desde a montagem (`H-43`): montar o `role="status"` ja
          com o texto dentro nao produz anuncio nenhum, porque nao ha mudanca a
          comparar. Vazia, ela e `sr-only` — sem caixa na tela. */}
      <span role="status" className={done === null ? 'sr-only' : 'text-sm text-state-success-fg'}>
        {done !== null && (
          <>
            {describeWritten(done.cellsWritten, done.rowsRepainted, done.rowsInserted)}
            {/* A fila ficou para tras: sem isto o operador aplicaria de novo e
                receberia uma recusa que ele nao tem como explicar. */}
            {done.archivedQueuePath === null && ' — confira a fila, ela não foi arquivada'}
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => void apply()}
        disabled={busy || pendingCount === 0}
        className="button-primary px-3 py-1.5"
      >
        {busy
          ? 'Aplicando…'
          : pendingCount === 0
            ? 'Aplicar alterações'
            : `Aplicar ${pendingCount} alteraç${pendingCount === 1 ? 'ão' : 'ões'}`}
      </button>
    </div>
  )
}
