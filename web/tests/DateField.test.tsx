import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { brToIso, DateField, isoToBr } from '../src/components/DateField.tsx'

/**
 * O campo de data em `dd/mm/aaaa` (18/09/2026).
 *
 * O que se prova aqui e a fronteira: a tela escreve e le no formato brasileiro,
 * e o que atravessa para a URL e para a API continua sendo `AAAA-MM-DD`. Num
 * painel aduaneiro `03/09` e `09/03` sao datas diferentes e igualmente
 * plausiveis — trocar as duas nao produz erro, produz numero errado.
 */

function campo(value = '', onValue = vi.fn()) {
  render(<DateField label="ETA2 de" value={value} onValue={onValue} />)
  return { entrada: screen.getByLabelText('ETA2 de') as HTMLInputElement, onValue }
}

describe('isoToBr e brToIso — a traducao', () => {
  it('leva ISO para brasileiro e de volta', () => {
    expect(isoToBr('2026-02-01')).toBe('01/02/2026')
    expect(brToIso('01/02/2026')).toBe('2026-02-01')
  })

  it('vazio continua vazio nos dois sentidos', () => {
    expect(isoToBr('')).toBe('')
    expect(brToIso('')).toBe('')
  })

  it('texto incompleto nao vira data', () => {
    expect(brToIso('01/02')).toBe('')
    expect(brToIso('1/2/2026')).toBe('')
  })

  /**
   * Regra inviolavel 3: `new Date(2026, 1, 31)` normaliza para 03/03 em
   * silencio. O campo prefere o buraco visivel.
   */
  it('recusa data que nao existe, em vez de normalizar', () => {
    expect(brToIso('31/02/2026')).toBe('')
    expect(brToIso('30/02/2024')).toBe('')
    expect(brToIso('00/01/2026')).toBe('')
    expect(brToIso('01/13/2026')).toBe('')
  })

  it('aceita 29 de fevereiro em ano bissexto, e recusa fora dele', () => {
    expect(brToIso('29/02/2024')).toBe('2024-02-29')
    expect(brToIso('29/02/2026')).toBe('')
  })
})

describe('DateField', () => {
  it('exibe o valor recebido em ISO no formato brasileiro', () => {
    const { entrada } = campo('2026-09-09')

    expect(entrada.value).toBe('09/09/2026')
  })

  it('emite ISO quando a data digitada fica completa', () => {
    const { entrada, onValue } = campo()

    fireEvent.change(entrada, { target: { value: '09/09/2026' } })

    expect(onValue).toHaveBeenCalledWith('2026-09-09')
  })

  /** A barra entra sozinha: o operador digita oito digitos e nada mais. */
  it('mascara enquanto digita, sem exigir as barras', () => {
    const { entrada, onValue } = campo()

    fireEvent.change(entrada, { target: { value: '09092026' } })

    expect(entrada.value).toBe('09/09/2026')
    expect(onValue).toHaveBeenCalledWith('2026-09-09')
  })

  it('descarta o que nao e digito, e para em oito', () => {
    const { entrada } = campo()

    fireEvent.change(entrada, { target: { value: 'a0b9/09-2026999' } })

    expect(entrada.value).toBe('09/09/2026')
  })

  /** Sem isto, cada tecla limparia o filtro e a tela recarregaria a base. */
  it('nao emite nada enquanto a data esta incompleta', () => {
    const { entrada, onValue } = campo()

    fireEvent.change(entrada, { target: { value: '09/09' } })

    expect(onValue).not.toHaveBeenCalled()
  })

  it('emite vazio quando o campo e limpo', () => {
    const { entrada, onValue } = campo('2026-09-09')

    fireEvent.change(entrada, { target: { value: '' } })

    expect(onValue).toHaveBeenCalledWith('')
  })

  it('marca como invalido a data que nao existe, e nao a emite', () => {
    const { entrada, onValue } = campo()

    fireEvent.change(entrada, { target: { value: '31/02/2026' } })

    expect(entrada.getAttribute('aria-invalid')).toBe('true')
    expect(onValue).not.toHaveBeenCalled()
    expect(screen.getByText(/Data incompleta ou inexistente/)).toBeTruthy()
  })

  /** O calendario nativo continua ali, e o botao que o abre e nomeado. */
  it('oferece o calendario por um botao com nome acessivel', () => {
    campo()

    expect(screen.getByRole('button', { name: 'Abrir o calendário — ETA2 de' })).toBeTruthy()
  })

  it('o campo nativo fica fora da ordem de tabulacao e da leitura', () => {
    const { container } = render(<DateField label="ETA2 de" value="" onValue={vi.fn()} />)
    const nativo = container.querySelector('input[type="date"]')

    expect(nativo?.getAttribute('tabindex')).toBe('-1')
    expect(nativo?.getAttribute('aria-hidden')).toBe('true')
  })
})
