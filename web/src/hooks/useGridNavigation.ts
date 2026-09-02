import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

/**
 * Navegacao por setas numa tabela editavel, no padrao `grid` da WAI-ARIA.
 *
 * **O que ela conserta e uma medicao, nao um gosto** (02/09/2026). A tabela da
 * Pagina Operacional tem um link por linha desde `H-17` e ganhou seis celulas
 * editaveis; medido num Chrome real, sao **7 paradas de tabulacao por linha**, e
 * a paginacao vem DEPOIS da tabela no DOM. Numa pagina cheia de 200 linhas, quem
 * usa teclado atravessa ~1.400 paradas para chegar ao botao "Próxima". O salto
 * de `H-70` nao alcanca: ele leva para DENTRO do conteudo, e a tabela vem
 * depois dele.
 *
 * Com a grade, a tabela inteira e **uma** parada: Tab entra, as setas percorrem,
 * Tab sai. Mesmo principio que a regra `N08` do corpus ja aceitou para os
 * graficos — *"tabbing to a container, and arrowing between items"*.
 *
 * **A linha 0 e o cabecalho.** Incluir a linha de cabecalho na grade tira os
 * nove botoes de ordenacao da ordem de tabulacao, e a ordenacao continua
 * alcancavel por teclado: setas ate o cabecalho, Enter ordena. Deixa-los
 * tabulaveis seria o meio-termo que a APG nao admite — Tab entraria na grade
 * dez vezes.
 *
 * A troca que ela impoe, e que nao e ganho puro: `role="grid"` poe NVDA e JAWS
 * em modo de foco, e o operador perde a leitura em modo de navegacao, que hoje
 * percorre a tabela sem tecla nenhuma.
 */

export interface GridPosition {
  /** 0 e a linha de cabecalho; 1 em diante sao os dados. */
  row: number
  column: number
}

/** O que cada `<th>`/`<td>` da grade recebe. Um objeto so, para o `<td>` que a
    celula editavel renderiza chegar com as mesmas quatro coisas. */
export interface GridCellProps {
  'data-grid-row': number
  'data-grid-column': number
  tabIndex: 0 | -1
  onFocus: () => void
}

export interface GridNavigation {
  active: GridPosition
  /** `0` na celula corrente, `-1` nas demais — o roving tabindex. */
  tabIndexOf(row: number, column: number): 0 | -1
  onKeyDown(event: KeyboardEvent<HTMLElement>): void
  /** As quatro props de uma celula, na posicao dada. */
  cellProps(row: number, column: number): GridCellProps
  /** Vai no elemento que contem as celulas — a `<table>`. */
  ref: React.RefObject<HTMLTableElement | null>
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max)

export function useGridNavigation(rows: number, columns: number): GridNavigation {
  const [active, setActive] = useState<GridPosition>({ row: 0, column: 0 })
  const ref = useRef<HTMLTableElement>(null)
  /**
   * So a navegacao por TECLADO move o foco. Sem esta marca, o efeito roubaria o
   * foco na montagem da pagina e a cada releitura da lista — o operador estaria
   * digitando na busca e o foco pularia para a tabela.
   */
  const moving = useRef(false)

  const lastRow = rows
  const lastColumn = columns - 1

  // A lista troca de tamanho ao ordenar, filtrar e paginar. Sem o corte, a
  // celula corrente ficaria alem do fim e nenhuma seta a traria de volta.
  useEffect(() => {
    setActive((current) =>
      current.row <= lastRow && current.column <= lastColumn
        ? current
        : { row: clamp(current.row, lastRow), column: clamp(current.column, lastColumn) },
    )
  }, [lastRow, lastColumn])

  useEffect(() => {
    if (!moving.current) return
    moving.current = false
    ref.current
      ?.querySelector<HTMLElement>(
        `[data-grid-row="${active.row}"][data-grid-column="${active.column}"]`,
      )
      ?.focus()
  }, [active.row, active.column])

  const go = useCallback(
    (row: number, column: number): void => {
      moving.current = true
      setActive({ row: clamp(row, lastRow), column: clamp(column, lastColumn) })
    },
    [lastRow, lastColumn],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      // Dentro de um campo em edicao as setas pertencem ao TEXTO: mover a celula
      // ali tiraria o cursor do meio da palavra que o operador esta corrigindo.
      if (event.target instanceof HTMLInputElement) return

      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-grid-row]')
      if (cell === null || ref.current === null || !ref.current.contains(cell)) return

      const row = Number(cell.dataset.gridRow)
      const column = Number(cell.dataset.gridColumn)

      switch (event.key) {
        case 'ArrowRight':
          go(row, column + 1)
          break
        case 'ArrowLeft':
          go(row, column - 1)
          break
        case 'ArrowDown':
          go(row + 1, column)
          break
        case 'ArrowUp':
          go(row - 1, column)
          break
        case 'Home':
          go(event.ctrlKey ? 0 : row, 0)
          break
        case 'End':
          go(event.ctrlKey ? lastRow : row, lastColumn)
          break
        case 'Enter':
        case 'F2': {
          /*
            A celula NAO e o controle: dentro dela ha o link da REF, o botao de
            edicao, ou nada. Acionar o que existe mantem um teclado so para os
            tres casos, e preserva o nome acessivel que `H-75` fixou — trocar o
            `<a>` por um `onKeyDown` na celula o perderia.
          */
          const control = cell.querySelector<HTMLElement>('button, a')
          if (control === null) return
          control.click()
          break
        }
        default:
          return
      }
      // So o que a grade consumiu: `preventDefault` no `default` mataria a
      // digitacao e as teclas do navegador.
      event.preventDefault()
    },
    [go, lastRow, lastColumn],
  )

  /**
   * Devolve o MESMO estado quando a posicao nao mudou. O efeito acima poe o foco
   * na celula, o foco dispara `onFocus`, e sem esta saida cada movimento
   * renderizaria a tabela duas vezes.
   */
  const focusCell = useCallback((position: GridPosition): void => {
    setActive((current) =>
      current.row === position.row && current.column === position.column ? current : position,
    )
  }, [])

  const tabIndexOf = useCallback(
    (row: number, column: number): 0 | -1 =>
      row === active.row && column === active.column ? 0 : -1,
    [active.row, active.column],
  )

  const cellProps = useCallback(
    (row: number, column: number): GridCellProps => ({
      'data-grid-row': row,
      'data-grid-column': column,
      tabIndex: tabIndexOf(row, column),
      onFocus: () => focusCell({ row, column }),
    }),
    [tabIndexOf, focusCell],
  )

  return { active, tabIndexOf, onKeyDown, cellProps, ref }
}
