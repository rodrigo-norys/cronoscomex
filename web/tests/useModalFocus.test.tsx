import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useModalFocus } from '../src/hooks/useModalFocus.ts'

/**
 * O mecanismo que `H-82` criou dentro do `FilterPanel` e `H-83` extraiu.
 *
 * **Ele e testado aqui, e nao em cada consumidor.** O criterio de aceite de
 * `H-83` exige "o mesmo mecanismo, e nao uma segunda implementacao"; um teste
 * proprio e o que torna isso verificavel — os testes do painel e da busca
 * afirmam o que CADA UM faz, e nao repetem a prisao de foco.
 */

function Sobreposicao({ onClose }: { onClose: () => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLHeadingElement>(null)

  useModalFocus({ container: caixa, initialFocus: entrada, onClose })

  return (
    <div ref={caixa}>
      <h2 ref={entrada} tabIndex={-1}>
        Título
      </h2>
      <button type="button">primeiro</button>
      <input aria-label="meio" />
      <button type="button">ultimo</button>
    </div>
  )
}

function renderSobreposicao() {
  const onClose = vi.fn()
  const result = render(<Sobreposicao onClose={onClose} />)
  return { ...result, onClose }
}

describe('o foco de entrada', () => {
  it('vai para o no declarado, e nao para o primeiro focavel', () => {
    renderSobreposicao()

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Título' }))
  })
})

describe('Esc', () => {
  it('fecha', () => {
    const { onClose } = renderSobreposicao()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('outra tecla nao fecha', () => {
    const { onClose } = renderSobreposicao()

    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })

    expect(onClose).not.toHaveBeenCalled()
  })
})

/**
 * A prisao e manual porque `inert` no restante nao basta: ele tira os irmaos da
 * ordem de tabulacao, mas a interface do navegador continua depois do ultimo
 * elemento focavel.
 */
describe('a prisao de Tab', () => {
  it('do ultimo volta para o primeiro', () => {
    renderSobreposicao()
    screen.getByRole('button', { name: 'ultimo' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'primeiro' }))
  })

  it('Shift+Tab do primeiro vai para o ultimo', () => {
    renderSobreposicao()
    screen.getByRole('button', { name: 'primeiro' }).focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ultimo' }))
  })

  /**
   * O no de entrada tem `tabIndex={-1}` e nao entra na lista de focaveis: com o
   * foco nele — que e onde a sobreposicao abre —, `Tab` sem guarda sairia na
   * primeira tecla, e o operador de teclado perderia a caixa imediatamente.
   */
  it('a partir do no de entrada, entra na sobreposicao', () => {
    renderSobreposicao()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Título' }))

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'primeiro' }))
  })

  it('Shift+Tab a partir do no de entrada vai para o ultimo', () => {
    renderSobreposicao()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ultimo' }))
  })

  /** No meio da lista o navegador cuida: interferir ali quebraria a ordem natural. */
  it('no meio, nao interfere', () => {
    renderSobreposicao()
    const meio = screen.getByLabelText('meio')
    meio.focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(meio)
  })
})
