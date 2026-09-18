import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApplyRefusal } from '../src/api-client.ts'
import { ConflictDialog } from '../src/components/ConflictDialog.tsx'

/**
 * O segundo modal do conjunto a ganhar teste.
 *
 * **Ele estava sem gestao de foco, e o motivo era a dificuldade de o abrir:** o
 * cabecalho do `FilterPanel` registrava que "o `ConflictDialog` so abre com a
 * planilha alterada durante a sessao, e por isso a gestao de foco dele segue
 * parada em `PD-07`". O ensaio de 17/09/2026 produziu o conflito num navegador
 * real — enfileirar, alterar a planilha por fora, esperar o watcher, aplicar —
 * e mediu o que faltava: o dialogo abria com `document.activeElement` ainda no
 * `<body>`.
 *
 * **A premissa da pendencia era falsa**: o conflito nao precisa de uma fixture
 * que nenhuma das nove produz, e sim de uma SEQUENCIA. Aqui, onde o componente
 * recebe a recusa pronta, nem isso e preciso.
 */

function recusa(overrides: Partial<ApplyRefusal> = {}): ApplyRefusal {
  return {
    code: 'ARQUIVO_MUDOU',
    message: 'A planilha mudou desde a ultima leitura.',
    conflicts: [
      {
        ref: 'FT051.26',
        field: 'statusRaw',
        valueWhenEdited: 'DESEMBARACADA',
        yourValue: 'EDITADO',
        valueNow: 'MUDOU POR FORA',
      },
    ],
    expectedHash: 'sha256:antes',
    actualHash: 'sha256:depois',
    restored: false,
    backupPath: null,
    fileAtRisk: false,
    schemaDivergence: null,
    ...overrides,
  }
}

describe('ConflictDialog', () => {
  it('nao monta nada quando nao ha recusa', () => {
    render(<ConflictDialog refusal={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  /**
   * O foco entra no TITULO, e nao no botao: e o que `useModalFocus` estabelece
   * para todo modal do conjunto — entrar num controle faz o leitor de tela
   * anunciar o controle sem dizer onde ele esta.
   */
  it('recebe o foco no titulo ao abrir', () => {
    render(<ConflictDialog refusal={recusa()} onClose={vi.fn()} />)

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'As alterações não foram gravadas' }),
    )
  })

  it('o foco fica DENTRO do dialogo', () => {
    render(<ConflictDialog refusal={recusa()} onClose={vi.fn()} />)

    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true)
  })

  it('Escape fecha', () => {
    const fechar = vi.fn()
    render(<ConflictDialog refusal={recusa()} onClose={fechar} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(fechar).toHaveBeenCalledOnce()
  })

  /**
   * A prisao de `Tab`: com um unico controle focavel, `Tab` volta para ele. O
   * titulo tem `tabIndex={-1}` e nao entra na lista, para que a primeira `Tab`
   * avance em vez de voltar ao ponto de entrada.
   */
  it('Tab no ultimo focavel volta para o primeiro', () => {
    render(<ConflictDialog refusal={recusa()} onClose={vi.fn()} />)
    const botao = screen.getByRole('button', { name: 'Entendi' })
    botao.focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(botao)
  })

  it('o botao fecha', () => {
    const fechar = vi.fn()
    render(<ConflictDialog refusal={recusa()} onClose={fechar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(fechar).toHaveBeenCalledOnce()
  })
})
