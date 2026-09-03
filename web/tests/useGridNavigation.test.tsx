import { fireEvent, render, screen } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useGridNavigation } from '../src/hooks/useGridNavigation.ts'

/**
 * A grade de `H-80`, exercitada FORA da Página Operacional.
 *
 * O que estes dois casos protegem é o acoplamento entre a marca "foi tecla que
 * moveu" e o commit a que ela pertence. Enquanto a marca era um `useRef`
 * booleano, ela era global no tempo: o efeito de foco da MONTAGEM — ainda
 * pendente na fila do Scheduler quando a tecla chega — a consumia com o
 * `active` velho, focava a célula (0,0), e o `onFocus` desfazia o movimento.
 * Era a origem da falha intermitente de `web/tests/Operational.test.tsx`, no
 * bloco `navegação por grade`.
 */
function Grade({ rows, columns }: { rows: number; columns: number }) {
  const grid = useGridNavigation(rows, columns)
  const linhas = Array.from({ length: rows + 1 }, (_, posicao) => posicao)
  const colunas = Array.from({ length: columns }, (_, posicao) => posicao)
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: mesma grade de `web/src/components/ProcessTable.tsx`, e em ARIA `grid` e SUBCLASSE de `table`
    <table ref={grid.ref} role="grid" onKeyDown={grid.onKeyDown}>
      <tbody>
        {linhas.map((row) => (
          <tr key={`linha-${row}`}>
            {colunas.map((column) => (
              <td key={`celula-${row}-${column}`} {...grid.cellProps(row, column)} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function celulaEm(raiz: ParentNode, row: number, column: number): HTMLElement {
  const alvo = raiz.querySelector<HTMLElement>(
    `[data-grid-row="${row}"][data-grid-column="${column}"]`,
  )
  if (alvo === null) throw new Error(`célula ${row},${column} não existe`)
  return alvo
}

/** Um turno de macrotarefa, para parar ENTRE o commit e os efeitos passivos. */
function proximaMacrotarefa(): Promise<void> {
  return new Promise((resolve) => {
    const canal = new MessageChannel()
    canal.port1.onmessage = () => resolve()
    canal.port2.postMessage(null)
  })
}

describe('useGridNavigation', () => {
  it('a seta move a célula com os efeitos da montagem ainda pendentes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const ambienteAnterior = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT
    // A montagem tem de acontecer FORA de `act`, como acontece na página: a
    // tabela so existe quando `GET /api/processes` resolve, e o `asyncWrapper`
    // da Testing Library desliga o ambiente de act durante o `findBy*`.
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = false
    const root = createRoot(container)
    try {
      root.render(<Grade rows={1} columns={9} />)
      // Para no PRIMEIRO turno em que a grade existe no DOM — os efeitos
      // passivos do commit que a criou ainda estao na fila.
      let voltas = 0
      while (container.querySelector('[data-grid-row]') === null && voltas < 50) {
        voltas += 1
        await proximaMacrotarefa()
      }
      ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

      fireEvent.keyDown(celulaEm(container, 0, 0), { key: 'ArrowRight' })

      expect(celulaEm(container, 0, 1).getAttribute('tabindex')).toBe('0')
    } finally {
      ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = ambienteAnterior
      container.remove()
    }
  })

  it('não rouba o foco de quem digita depois de uma seta na borda', () => {
    const { rerender } = render(
      <>
        <input aria-label="busca" />
        <Grade rows={2} columns={9} />
      </>,
    )

    fireEvent.keyDown(celulaEm(document, 0, 0), { key: 'End', ctrlKey: true })
    expect(celulaEm(document, 2, 8).getAttribute('tabindex')).toBe('0')
    // Seta na borda: `go` corta para a MESMA célula, e o efeito de foco nao
    // rodava — a marca ficava presa ate a proxima mudanca de `active`.
    fireEvent.keyDown(celulaEm(document, 2, 8), { key: 'ArrowDown' })

    const busca = screen.getByLabelText('busca')
    busca.focus()

    // A lista encolhe (buscar, filtrar, paginar): o corte move `active`, e com a
    // marca presa o efeito arrastava o foco para a tabela.
    rerender(
      <>
        <input aria-label="busca" />
        <Grade rows={1} columns={9} />
      </>,
    )

    expect(document.activeElement).toBe(busca)
  })
})
