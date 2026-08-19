import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkbookSetup } from '../src/pages/WorkbookSetup.tsx'
import { type ApiStub, stubApi, workbookConfigFixture } from './support/api-stub.ts'

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

  /**
   * H-44. A tela mostra o que ESTA configurado, e nao so o que falta: e o que
   * separa "instalei e nao sei o que ele esta usando" de um inventario.
   */
  describe('o inventario da configuracao', () => {
    it('lista os oito campos com o valor em uso', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun={false} />)
      await campoDoCaminho()

      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })
      const linhas = inventario.querySelectorAll('tbody tr')

      expect(linhas).toHaveLength(8)
      expect(inventario.textContent).toMatch(/Porta do painel/)
      expect(inventario.textContent).toMatch(/5173/)
    })

    /**
     * O motivo de o inventario existir. As duas situacoes mostram `5173` e
     * significam coisas diferentes — regra inviolavel 3.
     */
    it('distingue "padrão aplicado" de "definido no arquivo"', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          fields: [
            ...workbookConfigFixture().fields.slice(0, 4),
            { key: 'port', value: 5173, source: 'arquivo', restartPending: false },
            ...workbookConfigFixture().fields.slice(5),
          ],
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun={false} />)

      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })

      expect(inventario.textContent).toMatch(/definido no arquivo/)
      expect(inventario.textContent).toMatch(/padrão aplicado/)
    })

    it('avisa quando o arquivo declara valor diferente do que está em uso', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          fields: [{ key: 'port', value: 5173, source: 'arquivo', restartPending: true }],
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun={false} />)

      expect(await screen.findByText(/passa a valer no próximo início/i)).toBeTruthy()
    })

    /**
     * Os quatro fatos do caminho sao quatro respostas. Agrupa-los em "ok / nao
     * ok" perderia a informacao que diz o que fazer em seguida.
     */
    it('responde separadamente definido, existe, legível e aba', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          workbookPath: 'C:/OneDrive/Empresa/sumiu.xlsx',
          defined: true,
          exists: false,
          readable: false,
          sheetPresent: null,
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun={false} />)

      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })

      // O caminho aparece E o fato de ele nao existir: os dois sao informacao.
      expect(inventario.textContent).toMatch(/C:\/OneDrive\/Empresa\/sumiu\.xlsx/)
      expect(inventario.textContent).toMatch(/Existe no disco:\s*Não/)
      expect(inventario.textContent).toMatch(/Ainda não lida/)
    })

    /**
     * Sem caminho informado, "existe no disco" nao tem resposta — e "Não"
     * afirmaria que se procurou.
     */
    it('sem caminho informado, os outros três fatos ficam em traço', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          workbookPath: '',
          defined: false,
          exists: false,
          readable: false,
          sheetPresent: null,
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun />)

      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })

      expect(inventario.textContent).toMatch(/Nenhum caminho informado ainda/)
      expect(inventario.textContent).not.toMatch(/Existe no disco:\s*Não/)
    })

    it('diz que config/app.json ainda não existe, sem tratar isso como erro', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          configFile: { path: 'config/app.json', present: false, parseable: true },
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun />)

      expect(await screen.findByText(/ainda não existe/i)).toBeTruthy()
    })

    it('diz que a origem é desconhecida quando o arquivo não pôde ser lido', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          configFile: { path: 'config/app.json', present: true, parseable: false },
          fields: [{ key: 'port', value: 5173, source: 'desconhecida', restartPending: false }],
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun={false} />)

      expect(await screen.findByText(/não pôde ser lido/i)).toBeTruthy()
      expect(await screen.findByText(/não foi possível ler/i)).toBeTruthy()
    })
  })
})
