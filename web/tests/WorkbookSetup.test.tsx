import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkbookSetup } from '../src/pages/WorkbookSetup.tsx'
import { type ApiStub, stubApi } from './support/api-stub.ts'

/**
 * A tela de configuracao do caminho (`H-34`), a saida de `PD-01`.
 *
 * Ela nao valida o caminho: quem recusa e o servidor, e o que a tela precisa
 * provar e que a frase da recusa chega ao operador sem traducao — ele nao e
 * tecnico, e e ele quem vai consertar o caminho.
 *
 * As assercoes usam `toBeTruthy`/`toBeNull` e leitura de atributo, e nao o
 * vocabulario do `jest-dom`: ele nao e dependencia do projeto, e o plano nao o
 * preve.
 */

let api: ApiStub

/** Espera a carga inicial resolver, para nao asserir sobre o estado 'carregando'. */
async function campoDoCaminho(): Promise<HTMLInputElement> {
  return (await screen.findByLabelText(/caminho completo/i)) as HTMLInputElement
}

beforeEach(() => {
  api = stubApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WorkbookSetup', () => {
  it('parte do caminho ja configurado, em vez de campo vazio', async () => {
    api.serveWorkbookConfig({
      workbookPath: 'C:/OneDrive/Empresa/planilha-de-2026',
      exists: true,
      readable: true,
    })

    render(<WorkbookSetup dataVersion={1} firstRun={false} />)
    await campoDoCaminho()

    // O campo aparece com a resposta e e preenchido pelo efeito seguinte:
    // assertir na primeira leitura pega o intervalo entre os dois.
    await waitFor(() =>
      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
        'C:/OneDrive/Empresa/planilha-de-2026',
      ),
    )
  })

  it('grava o caminho digitado, e a recusa fica vazia', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun={false} />)
    const campo = await campoDoCaminho()

    await act(async () => {
      fireEvent.change(campo, { target: { value: 'D:/planilha-nova' } })
      fireEvent.click(screen.getByRole('button', { name: /carregar esta planilha/i }))
    })

    await waitFor(() => expect(api.calls).toContain('PUT /api/config/workbook'))
    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it('mostra a frase que o servidor escreveu, e nao o codigo do erro', async () => {
    api.failSaveWorkbookPath(
      'Nao ha nenhum arquivo nesse caminho. Confira se a pasta do OneDrive esta sincronizada.',
    )
    render(<WorkbookSetup dataVersion={1} firstRun={false} />)
    const campo = await campoDoCaminho()

    await act(async () => {
      fireEvent.change(campo, { target: { value: 'D:/sumiu' } })
      fireEvent.click(screen.getByRole('button', { name: /carregar esta planilha/i }))
    })

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/pasta do OneDrive/i))
    expect(screen.getByRole('alert').textContent).not.toMatch(/CAMINHO_INVALIDO/)
  })

  /**
   * A regiao de alerta existe desde a montagem, e so o texto dentro dela muda:
   * um no com `role="alert"` que nasce ja populado nao e anunciado pelo leitor
   * de tela, porque nao ha mudanca a comparar.
   */
  it('mantem a regiao de alerta no DOM desde a montagem', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun={false} />)

    const regiao = screen.getByRole('alert')
    await campoDoCaminho()

    expect(screen.getByRole('alert')).toBe(regiao)
  })

  it('avisa que o caminho salvo nao aponta para arquivo nenhum', async () => {
    api.serveWorkbookConfig({ workbookPath: 'C:/OneDrive/sumiu', exists: false, readable: false })

    render(<WorkbookSetup dataVersion={1} firstRun={false} />)

    expect(await screen.findByText(/não aponta para nenhum arquivo/i)).toBeTruthy()
  })

  it('avisa quando o arquivo existe e nao pode ser lido', async () => {
    api.serveWorkbookConfig({
      workbookPath: 'C:/OneDrive/sem-permissao',
      exists: true,
      readable: false,
    })

    render(<WorkbookSetup dataVersion={1} firstRun={false} />)

    expect(await screen.findByText(/não consegue lê-lo/i)).toBeTruthy()
  })

  it('nao deixa gravar caminho vazio', async () => {
    api.serveWorkbookConfig({ workbookPath: '', exists: false, readable: false })

    render(<WorkbookSetup dataVersion={1} firstRun />)
    await campoDoCaminho()

    const botao = screen.getByRole('button', { name: /carregar esta planilha/i })
    expect(botao.hasAttribute('disabled')).toBe(true)
  })

  it('fala em primeira execucao quando nunca houve leitura', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun />)
    await campoDoCaminho()

    expect(screen.getByRole('heading', { name: /aponte a planilha para começar/i })).toBeTruthy()
    expect(screen.getByText(/é pedido/i)).toBeTruthy()
  })

  it('fala em troca de arquivo quando ja houve leitura', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun={false} />)
    await campoDoCaminho()

    expect(screen.getByRole('heading', { name: /caminho da planilha/i })).toBeTruthy()
    expect(screen.getByText(/sem reiniciar/i)).toBeTruthy()
  })
})
