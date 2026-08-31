import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IngestionHealth } from '../src/components/IngestionHealth.tsx'
import { healthFixture, quarantineFixture } from './support/api-stub.ts'

/**
 * O painel de saude da ingestao (RF-16) e **outra coisa** que a faixa de estado
 * da casca: a faixa avisa que o dado esta congelado — frescor —, este painel
 * mede a leitura em si. O aviso de `degradado` continua sendo da casca (A-57),
 * e por isso nao aparece aqui.
 */

describe('metricas da leitura', () => {
  it('nao renderiza nada antes da primeira resposta de health', () => {
    const { container } = render(<IngestionHealth health={null} quarantine={null} />)

    expect(container.innerHTML).toBe('')
  })

  it('exibe as linhas lidas, aceitas e em quarentena', () => {
    render(<IngestionHealth health={healthFixture()} quarantine={quarantineFixture()} />)

    const painel = screen.getByRole('region', { name: 'Saúde da ingestão' })
    expect(painel.textContent).toMatch(/Linhas lidas/)
    expect(painel.textContent).toMatch(/649/)
    expect(painel.textContent).toMatch(/0%/)
  })

  it('sobrevive sem o relatorio: a taxa vira traco e os cartoes seguem de pe', () => {
    render(<IngestionHealth health={healthFixture()} quarantine={null} />)

    expect(screen.getByRole('region', { name: 'Saúde da ingestão' })).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})

describe('o limite de RNF-24', () => {
  it('destaca a taxa acima de 2%', () => {
    render(
      <IngestionHealth
        health={healthFixture({ rowsRead: 649, rowsAccepted: 629, rowsQuarantined: 20 })}
        quarantine={quarantineFixture({ quarantinedRows: 20, quarantineRate: 0.031 })}
      />,
    )

    expect(screen.getByText('3,1%')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Acima do limite de 2%/)
  })

  /** O limite e `≤ 2%`, entao 2% exatos NAO reprovam. Um `>=` aqui reprovaria
   * uma carga que RNF-24 aceita. */
  it('nao destaca exatamente 2%, que e o limite e nao a violacao', () => {
    render(
      <IngestionHealth
        health={healthFixture({ rowsQuarantined: 13 })}
        quarantine={quarantineFixture({ quarantinedRows: 13, quarantineRate: 0.02 })}
      />,
    )

    expect(screen.getByText('2%')).toBeTruthy()
    expect(screen.queryByText(/Acima do limite/)).toBeNull()
  })
})

describe('ligacao para o relatorio', () => {
  it('liga para o relatorio quando ha linha em quarentena', () => {
    render(
      <IngestionHealth
        health={healthFixture({ rowsQuarantined: 3 })}
        quarantine={quarantineFixture({ quarantinedRows: 3, quarantineRate: 0.0046 })}
      />,
    )

    const link = screen.getByRole('link', { name: /relatório de quarentena/ })
    expect(link.getAttribute('href')).toBe('/api/quarantine')
    expect(screen.getByText(/3 linhas não interpretadas/)).toBeTruthy()
  })

  it('nao oferece o relatorio com quarentena zerada — nao ha o que ver', () => {
    render(<IngestionHealth health={healthFixture()} quarantine={quarantineFixture()} />)

    expect(screen.queryByRole('link', { name: /relatório de quarentena/ })).toBeNull()
  })

  it('concorda o singular quando ha uma linha so', () => {
    render(
      <IngestionHealth
        health={healthFixture({ rowsQuarantined: 1 })}
        quarantine={quarantineFixture({ quarantinedRows: 1, quarantineRate: 0.0015 })}
      />,
    )

    expect(screen.getByText(/1 linha não interpretada/)).toBeTruthy()
  })
})

/**
 * `H-43`. A região do aviso de quarentena existe desde a montagem, e só o texto
 * dentro dela muda.
 */
describe('a região viva do limite de quarentena', () => {
  it('monta a região vazia, sem caixa na tela, dentro do limite', () => {
    const { container } = render(
      <IngestionHealth
        health={healthFixture({ rowsRead: 649, rowsAccepted: 649, rowsQuarantined: 0 })}
        quarantine={quarantineFixture({ quarantinedRows: 0, quarantineRate: 0 })}
      />,
    )

    const regiao = screen.getByRole('alert')
    expect(regiao.textContent).toBe('')
    expect(container.querySelector('.bg-state-error-bg')).toBeNull()
  })

  // RNF-24: o limite é 2%. Acima dele a mesma região recebe o texto.
  it('escreve no mesmo nó quando a taxa passa do limite', () => {
    const { rerender } = render(
      <IngestionHealth
        health={healthFixture({ rowsRead: 649, rowsAccepted: 649, rowsQuarantined: 0 })}
        quarantine={quarantineFixture({ quarantinedRows: 0, quarantineRate: 0 })}
      />,
    )
    const antes = screen.getByRole('alert')

    rerender(
      <IngestionHealth
        health={healthFixture({ rowsRead: 649, rowsAccepted: 629, rowsQuarantined: 20 })}
        quarantine={quarantineFixture({ quarantinedRows: 20, quarantineRate: 0.031 })}
      />,
    )

    expect(screen.getByRole('alert')).toBe(antes)
    expect(antes.textContent).toContain('Acima do limite de 2%')
  })
})
