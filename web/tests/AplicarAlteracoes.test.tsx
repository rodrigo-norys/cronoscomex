import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { type ApiStub, healthFixture, stubApi } from './support/api-stub.ts'

/**
 * Os seis criterios de aceite de `H-26`, do lado da tela.
 *
 * O comando vive no cabecalho da casca, e nao numa pagina, porque a fila e
 * **global**: ela atravessa processos e paginas, e um botao por tela faria o
 * operador procurar onde aplicar o que digitou em outro lugar.
 */

let api: ApiStub

beforeEach(() => {
  api = stubApi(healthFixture({ pendingEditsCount: 3 }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const botao = (): HTMLElement => screen.getByRole('button', { name: /Aplicar/ })

/**
 * O que o leitor de tela anuncia ao abrir o dialogo: o elemento apontado por
 * `aria-labelledby`. Consultar por `heading` nao serve — a casca tem outros.
 */
function nomeAcessivelDo(dialogo: HTMLElement): string {
  const id = dialogo.getAttribute('aria-labelledby')
  return (id === null ? null : document.getElementById(id))?.textContent ?? ''
}

describe('o comando de aplicacao', () => {
  it('mostra a contagem de pendencias no rotulo', async () => {
    render(<App />)

    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))
    expect(botao().textContent).toContain('Aplicar 3 alterações')
  })

  // Criterio de aceite: "Dado fila vazia, entao o botao fica desabilitado".
  it('fica desabilitado com a fila vazia', async () => {
    api.serve(healthFixture({ pendingEditsCount: 0 }))
    render(<App />)

    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Aplicar/ }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    )
  })

  it('grava e informa quantas celulas foram para a planilha', async () => {
    api.serveApply({ applied: 3, cellsWritten: 3 })
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(botao())

    expect((await screen.findByRole('status')).textContent).toContain(
      '3 células gravadas na planilha',
    )
    expect(api.calls).toContain('POST /api/edits/apply')
  })

  // Criterio de aceite: "Dado a escrita concluida, entao o watcher retoma e uma
  // releitura ocorre, deixando o painel coerente com o arquivo". Do lado da
  // tela, o equivalente e o painel se refazer.
  it('rele o painel depois de aplicar', async () => {
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))
    const antes = api.calls.filter((call) => call.startsWith('GET /api/health')).length

    fireEvent.click(botao())

    await waitFor(() => {
      const depois = api.calls.filter((call) => call.startsWith('GET /api/health')).length
      expect(depois).toBeGreaterThan(antes)
    })
  })

  // A fila ficou para tras: sem o aviso, o operador aplicaria de novo e
  // receberia uma recusa que nao tem como explicar.
  it('avisa quando a fila nao foi arquivada', async () => {
    api.serveApply({ archivedQueuePath: null })
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(botao())

    expect((await screen.findByRole('status')).textContent).toContain('não foi arquivada')
  })
})

describe('as recusas', () => {
  async function aplicarERecusar(
    status: number,
    code: string,
    message: string,
    detail?: unknown,
  ): Promise<void> {
    api.refuseApply(status, code, message, detail)
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(botao())
  }

  // Criterio: "Dado EXCEL_ABERTO, entao a interface instrui a fechar o Excel, e
  // as edicoes continuam enfileiradas".
  it('instrui a fechar o Excel em EXCEL_ABERTO, sem tabela de conflito', async () => {
    await aplicarERecusar(
      409,
      'EXCEL_ABERTO',
      'A planilha esta aberta no Excel. Feche-a e aplique de novo.',
    )

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toContain('Feche-a e aplique de novo')
    expect(dialogo.textContent).toContain('continuam na fila')
    expect(screen.queryByRole('table')).toBeNull()
  })

  // Criterio: "Dado ARQUIVO_MUDOU, entao a interface exibe o dialogo de conflito
  // com os tres valores por campo, e nada e gravado".
  it('exibe os tres valores por campo em ARQUIVO_MUDOU', async () => {
    await aplicarERecusar(409, 'ARQUIVO_MUDOU', 'A planilha mudou desde a ultima leitura.', {
      expectedHash: 'sha256:9f2c',
      actualHash: 'sha256:1ab7',
      conflicts: [
        {
          ref: 'FT533.26',
          field: 'eta2',
          valueWhenEdited: '2026-08-04',
          valueNow: '2026-08-05',
          yourValue: '2026-08-06',
        },
      ],
    })

    const linha = (await screen.findByRole('table')).querySelectorAll('tbody td')
    // `ETA2`, e nao `eta2`: o operador procura a coluna pelo cabecalho que ele
    // ve no Excel, nao pelo identificador de `EDITABLE_FIELDS`.
    expect([...linha].map((celula) => celula.textContent)).toEqual([
      'FT533.26',
      'ETA2',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ])
  })

  /**
   * O desfecho mais grave: gravou, a conferencia reprovou, e o backup NAO pode
   * ser reposto. `restored` continua `false`, e a primeira versao desta tela
   * dizia "nenhuma celula foi gravada" — falso — e omitia o caminho do backup,
   * que e a unica saida. Achado do `revisor-xml`.
   */
  it('alerta e da o caminho do backup quando a planilha nao pode ser restaurada', async () => {
    await aplicarERecusar(
      500,
      'ESCRITA_INVALIDA',
      'A gravacao falhou e a planilha NAO pode ser restaurada.',
      {
        restored: false,
        backupPath: 'data/backups/planilha-20260814-143512.xlsx',
      },
    )

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toContain('não pôde ser restaurada')
    expect(dialogo.textContent).toContain('data/backups/planilha-20260814-143512.xlsx')
    expect(dialogo.textContent).not.toContain('Nenhuma célula foi gravada')
    // O titulo e o `aria-labelledby`: e o que o leitor de tela anuncia, e
    // dizer "Nada foi gravado" ali seria a afirmacao falsa em primeiro lugar.
    expect(nomeAcessivelDo(dialogo)).toBe('A planilha pode estar inválida')
  })

  // `NADA_A_APLICAR` parte de fila vazia: dizer que as alteracoes continuam
  // nela seria afirmar que existe o que nao existe.
  it('nao afirma que ha alteracoes na fila em NADA_A_APLICAR', async () => {
    await aplicarERecusar(409, 'NADA_A_APLICAR', 'Nao ha alteracoes pendentes para aplicar.')

    expect((await screen.findByRole('alertdialog')).textContent).not.toContain('continuam na fila')
  })

  /**
   * O caso mais comum de `ARQUIVO_MUDOU`: alguem salvou a planilha entre a
   * leitura e a aplicacao, sem tocar nas celulas da fila. A tela decide por
   * `conflicts.length` — abrir a tabela sem linhas deixaria o operador com um
   * quadro em branco no lugar da explicacao. Achado do `revisor-xml`.
   */
  it('nao abre a tabela quando ARQUIVO_MUDOU vem sem conflitos', async () => {
    await aplicarERecusar(409, 'ARQUIVO_MUDOU', 'A planilha mudou desde a ultima leitura.', {
      expectedHash: 'sha256:9f2c',
      actualHash: 'sha256:1ab7',
    })

    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      'mudou desde a ultima leitura',
    )
    expect(screen.queryByRole('table')).toBeNull()
  })

  // `valueNow: ''` sozinho diria "a celula esta vazia", que e falso quando a
  // linha inteira sumiu (regra inviolavel 3). A decisao e por `refMissing`,
  // nunca pelo codigo — a linha removida chega pelos dois codigos de hash.
  it('diz que a linha sumiu, em vez de mostrar celula vazia', async () => {
    await aplicarERecusar(409, 'EDICAO_OBSOLETA', 'O que voce editou mudou na planilha.', {
      conflicts: [
        {
          ref: 'FT999.26',
          field: 'clientRaw',
          valueWhenEdited: 'ACME',
          valueNow: '',
          yourValue: 'ACME LOG',
          refMissing: true,
        },
      ],
    })

    expect((await screen.findByRole('table')).textContent).toContain(
      'Esta linha não está mais na planilha',
    )
  })

  // Criterio: "Dado ESCRITA_INVALIDA, entao a interface informa que o arquivo foi
  // restaurado do backup, com o caminho do backup".
  it('informa a restauracao e o caminho do backup em ESCRITA_INVALIDA', async () => {
    await aplicarERecusar(500, 'ESCRITA_INVALIDA', 'A gravacao nao pode ser concluida.', {
      restored: true,
      backupPath: 'data/backups/planilha-20260814-143512.xlsx',
    })

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toContain('restaurada automaticamente')
    expect(dialogo.textContent).toContain('data/backups/planilha-20260814-143512.xlsx')
  })

  it('fecha o dialogo no comando do operador', async () => {
    await aplicarERecusar(409, 'NADA_A_APLICAR', 'Nao ha alteracoes pendentes.')
    await screen.findByRole('alertdialog')

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // Corpo sem codigo nem mensagem: o cliente traduz para ERRO_INTERNO com o
  // proprio texto, em vez de deixar `undefined` chegar a tela.
  it('trata corpo malformado como erro interno', async () => {
    api.refuseApply(500, '', '')
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(botao())

    expect((await screen.findByRole('alertdialog')).textContent).toContain('A aplicacao falhou')
  })

  /**
   * Falha de rede e outra coisa: o `fetch` rejeitou, e o cliente **nao sabe** se
   * a requisicao chegou — a gravacao pode ter acontecido do outro lado. Afirmar
   * "nada foi gravado" seria inventar o que nao se mediu (regra inviolavel 3).
   */
  it('nao afirma que nada foi gravado quando o servidor nao respondeu', async () => {
    api.failApplyNetwork()
    render(<App />)
    await waitFor(() => expect((botao() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(botao())

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toContain('não dá para saber se a gravação chegou a acontecer')
    expect(dialogo.textContent).not.toContain('Nenhuma célula foi gravada')
    expect(nomeAcessivelDo(dialogo)).toBe('Não foi possível concluir')
  })
})
