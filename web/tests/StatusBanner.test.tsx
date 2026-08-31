import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { bannerSignals, StatusBanner } from '../src/components/StatusBanner.tsx'
import { healthFixture } from './support/api-stub.ts'

describe('bannerSignals', () => {
  it('nao produz sinal nenhum em estado pronto — a faixa some sozinha', () => {
    expect(bannerSignals(healthFixture())).toEqual([])
  })

  it('ordena por severidade: conflito, degradado, arquivo aberto', () => {
    const signals = bannerSignals(
      healthFixture({
        state: 'degradado',
        degradedReason: 'Arquivo em uso.',
        externalLock: true,
        conflictFiles: ['CONTROLE - Cópia em conflito de MAQUINA 2026-08-07.xlsx'],
      }),
    )

    expect(signals.map((signal) => signal.key)).toEqual(['conflito', 'degradado', 'arquivoAberto'])
  })
})

describe('StatusBanner', () => {
  /**
   * `H-43` inverteu a forma, e não o que se defende: as duas regiões vivas
   * existem desde a montagem — um `role="alert"` que nasce populado não é
   * anunciado —, e o que não pode aparecer é **caixa** na tela.
   *
   * O estilo mora no filho; sem sinal, os dois contêineres são nós vazios.
   */
  it('monta as duas regiões vivas vazias antes da primeira resposta de health', () => {
    const { container } = render(<StatusBanner health={null} />)

    expect(screen.getByRole('alert').textContent).toBe('')
    expect(screen.getByRole('status').textContent).toBe('')
    // Nenhuma caixa: os contêineres não têm borda, fundo nem espaçamento.
    expect(container.querySelector('.border-y')).toBeNull()
  })

  // A região que recebe o texto é o MESMO nó que já estava no DOM — é o que
  // permite ao leitor de tela comparar e anunciar.
  it('escreve na mesma região que já estava montada, sem trocar o nó', () => {
    const { rerender } = render(<StatusBanner health={null} />)
    const antes = screen.getByRole('alert')

    rerender(
      <StatusBanner
        health={healthFixture({ state: 'degradado', degradedReason: 'Leitura falhou.' })}
      />,
    )

    expect(screen.getByRole('alert')).toBe(antes)
    expect(antes.textContent).toContain('Leitura falhou.')
  })

  it('informa o motivo e o horario da ultima leitura boa em estado degradado', () => {
    render(
      <StatusBanner
        health={healthFixture({
          state: 'degradado',
          degradedReason: 'A planilha está corrompida.',
          lastReadAt: '2026-08-07T12:00:00.000Z',
        })}
      />,
    )

    expect(screen.getByText(/A planilha está corrompida/)).toBeTruthy()
    expect(screen.getByText(/Última leitura bem-sucedida/)).toBeTruthy()
  })

  it('distingue degradado sem leitura nenhuma de degradado com dado congelado', () => {
    render(
      <StatusBanner
        health={healthFixture({
          state: 'degradado',
          degradedReason: 'Arquivo não encontrado.',
          lastReadAt: null,
        })}
      />,
    )

    expect(screen.getByText(/Ainda não houve nenhuma leitura bem-sucedida/)).toBeTruthy()
  })

  /**
   * H-35, medido na primeira execucao em Windows. "Dado congelado" pressupoe
   * dado a congelar, e na primeira execucao nao ha nenhum — o titulo
   * contradizia o detalhe logo abaixo, que ja dizia que nunca houve leitura.
   */
  it('na primeira execucao nao fala em dado congelado — nao ha dado a congelar', () => {
    render(
      <StatusBanner
        health={healthFixture({
          state: 'degradado',
          degradedReason: 'Nenhuma planilha configurada ainda.',
          lastReadAt: null,
          workbookPath: '',
        })}
      />,
    )

    expect(screen.getByText('Nenhuma planilha configurada')).toBeTruthy()
    expect(screen.queryByText(/Dado congelado/)).toBeNull()
    // O detalhe acrescenta, e nao repete o titulo nem a razao do servidor.
    expect(screen.getByText(/assim que você informar o caminho/)).toBeTruthy()
    expect(screen.queryByText(/Ainda não houve nenhuma leitura/)).toBeNull()
  })

  it('avisa que alguem esta com a planilha aberta, sem dizer que ha problema', () => {
    render(<StatusBanner health={healthFixture({ externalLock: true })} />)

    expect(screen.getByRole('status').textContent).toMatch(/planilha aberta no Excel/)
    expect(screen.getByText(/A leitura continua normal/)).toBeTruthy()
  })

  it('lista os nomes dos arquivos de conflito, que e o criterio de aceite', () => {
    render(
      <StatusBanner
        health={healthFixture({
          conflictFiles: [
            'CONTROLE - Cópia em conflito 1.xlsx',
            'CONTROLE - Cópia em conflito 2.xlsx',
          ],
        })}
      />,
    )

    expect(screen.getByText('CONTROLE - Cópia em conflito 1.xlsx')).toBeTruthy()
    expect(screen.getByText('CONTROLE - Cópia em conflito 2.xlsx')).toBeTruthy()
  })

  it('exibe os tres sinais simultaneos — nenhum encobre o outro', () => {
    render(
      <StatusBanner
        health={healthFixture({
          state: 'degradado',
          degradedReason: 'Leitura falhou.',
          externalLock: true,
          conflictFiles: ['conflito.xlsx'],
        })}
      />,
    )

    // Uma região por papel, com os sinais dentro: o que se defende é que
    // nenhum encobre o outro, e os três textos continuam na tela.
    const alertas = screen.getByRole('alert')
    expect(alertas.textContent).toContain('Leitura falhou.')
    expect(alertas.textContent).toContain('conflito.xlsx')
    expect(screen.getByRole('status').textContent).toContain('aberta no Excel')
  })
})
