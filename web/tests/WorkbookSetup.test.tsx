import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { HealthResponse } from '../src/api-client.ts'
import { WorkbookSetup } from '../src/pages/WorkbookSetup.tsx'
import { type ApiStub, healthFixture, stubApi, workbookConfigFixture } from './support/api-stub.ts'

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
let onSaved: Mock<(health: HealthResponse) => void>

/** Espera a carga inicial resolver, para nao asserir sobre o estado 'carregando'. */
async function campoDoCaminho(): Promise<HTMLInputElement> {
  return (await screen.findByLabelText(/caminho completo/i)) as HTMLInputElement
}

beforeEach(() => {
  api = stubApi()
  onSaved = vi.fn()
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

    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
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
    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
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
    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
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
    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

    const regiao = screen.getByRole('alert')
    await campoDoCaminho()

    expect(screen.getByRole('alert')).toBe(regiao)
  })

  it('avisa que o caminho salvo nao aponta para arquivo nenhum', async () => {
    api.serveWorkbookConfig({ workbookPath: 'C:/OneDrive/sumiu', exists: false, readable: false })

    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

    expect(await screen.findByText(/não aponta para nenhum arquivo/i)).toBeTruthy()
  })

  it('avisa quando o arquivo existe e nao pode ser lido', async () => {
    api.serveWorkbookConfig({
      workbookPath: 'C:/OneDrive/sem-permissao',
      exists: true,
      readable: false,
    })

    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

    expect(await screen.findByText(/não consegue lê-lo/i)).toBeTruthy()
  })

  it('nao deixa gravar caminho vazio', async () => {
    api.serveWorkbookConfig({ workbookPath: '', exists: false, readable: false })

    render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
    await campoDoCaminho()

    const botao = screen.getByRole('button', { name: /carregar esta planilha/i })
    expect(botao.hasAttribute('disabled')).toBe(true)
  })

  it('fala em primeira execucao quando nunca houve leitura', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
    await campoDoCaminho()

    expect(screen.getByRole('heading', { name: /aponte a planilha para começar/i })).toBeTruthy()
    expect(screen.getByText(/é pedido/i)).toBeTruthy()
  })

  it('fala em troca de arquivo quando ja houve leitura', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
    await campoDoCaminho()

    expect(screen.getByRole('heading', { name: /caminho da planilha/i })).toBeTruthy()
    expect(screen.getByText(/sem reiniciar/i)).toBeTruthy()
  })

  /**
   * O clique responde onde o clique aconteceu.
   *
   * O defeito que estes casos guardam foi relatado como "o botao nao esta
   * funcionando", e o servidor estava certo o tempo todo: a resposta existia,
   * fora da area visivel ou fora da tela inteira. Medido na primeira instalacao
   * em Windows (H-35, PD-06).
   */
  describe('a resposta ao clique', () => {
    async function clicar(valor: string): Promise<void> {
      const campo = await campoDoCaminho()
      await act(async () => {
        fireEvent.change(campo, { target: { value: valor } })
        fireEvent.click(screen.getByRole('button', { name: /carregar esta planilha/i }))
      })
    }

    it('confirma a leitura com o numero que o servidor contou', async () => {
      api.serve(healthFixture({ lastReadOk: true, rowsAccepted: 649 }))
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await clicar('D:/planilha.xlsx')

      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toMatch(/649 processos lidos/),
      )
    })

    it('concorda o plural com um processo so', async () => {
      api.serve(healthFixture({ lastReadOk: true, rowsAccepted: 1 }))
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await clicar('D:/planilha.xlsx')

      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/1 processo lido/))
    })

    /**
     * Gravar o caminho e ler a planilha sao coisas diferentes, e as duas cabem
     * num 200: uma planilha sem a aba `2026` tem o caminho aceito de proposito
     * (H-34). Chamar isso de sucesso esconderia o motivo real do operador.
     */
    it('distingue caminho salvo de planilha lida', async () => {
      api.serve(
        healthFixture({
          state: 'degradado',
          lastReadOk: false,
          lastReadAt: null,
          degradedReason: 'A aba 2026 nao existe nesse arquivo.',
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await clicar('D:/sem-a-aba.xlsx')

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(/caminho foi salvo/i),
      )
      expect(screen.getByRole('alert').textContent).toMatch(/A aba 2026 nao existe/)
      expect(screen.getByRole('status').textContent).toBe('')
    })

    /**
     * Sem isto o painel so aparece no poll seguinte, e a tela fica IDENTICA por
     * ate 5 s depois de um clique que deu certo — que e o intervalo em que o
     * operador conclui que o botao nao funciona e clica de novo.
     */
    it('entrega a casca o health que o PUT devolveu', async () => {
      api.serve(healthFixture({ workbookPath: 'D:/nova.xlsx', lastReadOk: true }))
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await clicar('D:/nova.xlsx')

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(onSaved.mock.calls[0]?.[0].workbookPath).toBe('D:/nova.xlsx')
    })

    it('nao avisa a casca quando o servidor recusou', async () => {
      api.failSaveWorkbookPath('O arquivo precisa ser uma planilha .xlsx.')
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await clicar('D:/documento.docx')

      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/\.xlsx/))
      expect(onSaved).not.toHaveBeenCalled()
    })

    /**
     * A posicao E o defeito: a recusa vinha depois do inventario inteiro — uma
     * tabela de oito linhas —, e nascia fora da area visivel.
     */
    it('coloca a resposta antes do inventario, e nao no fim da pagina', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })

      const posicao = screen.getByRole('alert').compareDocumentPosition(inventario)

      expect(posicao & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('troca a confirmacao anterior pela recusa, em vez de exibir as duas', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

      await clicar('D:/planilha.xlsx')
      await waitFor(() => expect(screen.getByRole('status').textContent).not.toBe(''))

      api.failSaveWorkbookPath('Nao ha nenhum arquivo nesse caminho.')
      await clicar('D:/sumiu.xlsx')

      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/nenhum arquivo/))
      expect(screen.getByRole('status').textContent).toBe('')
    })

    /**
     * O efeito que preenche o campo reagia a TODA resposta do servidor, e o
     * recorte e refeito a cada `dataVersion`: uma releitura no meio da digitacao
     * apagava o que o operador tinha escrito, deixando o botao desabilitado sem
     * nada explicando por que.
     */
    it('nao apaga o que o operador digitou quando a planilha e relida', async () => {
      const { rerender } = render(
        <WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />,
      )
      const campo = await campoDoCaminho()
      // O campo aparece no commit, e o efeito que o preenche roda DEPOIS dele:
      // digitar no intervalo entre os dois deixa o teste a merce da ordem, e foi
      // o que o fez falhar uma vez em 19/08/2026.
      await waitFor(() => expect(campo.value).not.toBe(''))

      fireEvent.change(campo, { target: { value: 'D:/ainda-digitando' } })
      await act(async () => {
        rerender(<WorkbookSetup dataVersion={2} firstRun={false} onSaved={onSaved} />)
      })

      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
        'D:/ainda-digitando',
      )
    })
  })

  /**
   * H-37. O navegador nao entrega caminho — `<input type="file">` devolve
   * `C:\\fakepath\\<nome>` —, e a aplicacao precisa do caminho no disco porque
   * grava cirurgicamente naquele arquivo. Quem abre o seletor e o servidor, na
   * maquina do operador.
   */
  describe('o seletor de arquivos', () => {
    async function escolher(): Promise<void> {
      await campoDoCaminho()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /escolher arquivo/i }))
      })
    }

    it('poe no campo o caminho que o operador escolheu', async () => {
      api.serveBrowse('C:/OneDrive/Comércio Exterior/CONTROLE DOS EMBARQUE.xlsx')
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await escolher()

      await waitFor(() =>
        expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
          'C:/OneDrive/Comércio Exterior/CONTROLE DOS EMBARQUE.xlsx',
        ),
      )
    })

    /** Escolher nao e aplicar: o `PUT` continua sendo a unica porta de gravacao. */
    it('nao grava nada ao escolher', async () => {
      api.serveBrowse('C:/OneDrive/nova.xlsx')
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await escolher()

      await waitFor(() => expect(api.calls).toContain('POST /api/config/workbook/browse'))
      expect(api.calls).not.toContain('PUT /api/config/workbook')
      expect(onSaved).not.toHaveBeenCalled()
    })

    /**
     * Cancelar e uma escolha, e nao uma falha. O campo tinha o caminho salvo, e
     * apaga-lo ao cancelar puniria quem so mudou de ideia.
     */
    it('deixa o campo intacto quando o operador cancela', async () => {
      api.serveWorkbookConfig({ workbookPath: 'C:/OneDrive/atual.xlsx' })
      api.cancelBrowse()
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
      await waitFor(() =>
        expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
          'C:/OneDrive/atual.xlsx',
        ),
      )

      await escolher()

      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
        'C:/OneDrive/atual.xlsx',
      )
      expect(screen.getByRole('alert').textContent).toBe('')
    })

    /**
     * Esta maquina de desenvolvimento e este caso, e um Windows sem PowerShell
     * tambem: o campo de texto continua sendo a via, e escondê-lo trocaria um
     * caminho a menos por caminho nenhum.
     */
    it('diz o que fazer quando a maquina nao abre o seletor', async () => {
      api.failBrowse(
        501,
        'SELETOR_INDISPONIVEL',
        'Esta maquina nao abre o seletor de arquivos. Digite o caminho da planilha.',
      )
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      await escolher()

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(/Digite o caminho da planilha/),
      )
      expect(screen.getByRole('alert').textContent).not.toMatch(/SELETOR_INDISPONIVEL/)
      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).disabled).toBe(false)
    })

    it('limpa a recusa anterior quando a escolha seguinte da certo', async () => {
      api.failBrowse(501, 'SELETOR_INDISPONIVEL', 'Esta maquina nao abre o seletor.')
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
      await escolher()
      await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''))

      api.serveBrowse('C:/OneDrive/enfim.xlsx')
      await escolher()

      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(''))
    })
  })

  /**
   * H-36. O painel diz onde a partida parou. As tres primeiras etapas aparecem
   * sempre cumpridas porque sao pre-condicao de a pagina existir — quem reporta
   * a falha delas e `scripts/iniciar.cmd`, e nao ha outra camada.
   */
  describe('as etapas da partida', () => {
    async function checklist(): Promise<HTMLElement> {
      return await screen.findByRole('region', { name: /etapas da partida/i })
    }

    it('mostra a versao real do Node ao lado da etapa dele', async () => {
      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: true } })
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      expect((await checklist()).textContent).toMatch(/Node\.js instalado.*versão 22\.23\.2/)
    })

    it('lista as etapas na ordem em que o atalho as percorre', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      const itens = [...(await checklist()).querySelectorAll('li')].map((item) =>
        item.textContent?.replace(/\s+/g, ' ').trim(),
      )

      expect(itens).toHaveLength(5)
      expect(itens[0]).toMatch(/Node\.js instalado/)
      expect(itens[1]).toMatch(/Node\.js 22 ou superior/)
      expect(itens[2]).toMatch(/Painel respondendo/)
      expect(itens[3]).toMatch(/Interface compilada/)
      expect(itens[4]).toMatch(/Arquivo de configuração/)
    })

    /**
     * O caso-limite do backlog: a SPA carregada em memoria nao prova que o
     * arquivo continua no disco.
     */
    it('mostra a interface como pendente quando dist/web sumiu', async () => {
      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: false } })
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

      const item = [...(await checklist()).querySelectorAll('li')].find((linha) =>
        /Interface compilada/.test(linha.textContent ?? ''),
      )

      expect(item?.textContent).toMatch(/pendente/)
      expect(item?.textContent).toMatch(/falta gerar dist\/web/)
    })

    it('mostra o arquivo de configuracao como pendente antes de ele nascer', async () => {
      api.serveWorkbookConfig({
        configFile: { path: 'config/app.json', present: false, parseable: true },
      })
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      const item = [...(await checklist()).querySelectorAll('li')].find((linha) =>
        /Arquivo de configuração/.test(linha.textContent ?? ''),
      )

      expect(item?.textContent).toMatch(/pendente/)
      expect(item?.textContent).toMatch(/nasce ao salvar/)
    })

    /**
     * Etapa pendente e informacao de estado, nao falha: um painel vermelho na
     * primeira execucao afirmaria problema onde ha so ausencia (regra 3).
     */
    it('nao trata etapa pendente como erro', async () => {
      api.serveWorkbookConfig({
        runtime: { nodeVersion: '22.23.2', webBuilt: false },
        configFile: { path: 'config/app.json', present: false, parseable: true },
      })
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
      const regiao = await checklist()

      expect(regiao.querySelector('[role="alert"]')).toBeNull()
      expect(regiao.className).not.toMatch(/state-error/)
      expect(regiao.innerHTML).not.toMatch(/text-state-error|bg-state-error/)
    })

    /**
     * O texto do estado nao pode viver so no simbolo: informacao que existe
     * apenas na forma ou na cor nao chega a quem usa leitor de tela.
     */
    it('diz cumprida ou pendente em texto, e nao so no simbolo', async () => {
      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: false } })

      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
      const regiao = await checklist()

      expect(regiao.textContent).toMatch(/cumprida/)
      expect(regiao.textContent).toMatch(/pendente/)
    })

    it('reconfere sem recarregar a pagina nem reexecutar o atalho', async () => {
      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: false } })
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)
      await checklist()

      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: true } })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /atualizar/i }))
      })

      await waitFor(async () =>
        expect((await checklist()).textContent).toMatch(/Interface compilada.*cumprida/),
      )
    })

    it('anuncia que tudo esta pronto quando nada falta', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

      expect((await checklist()).textContent).toMatch(/Tudo pronto/)
    })
  })

  /**
   * H-35. A tela mostra o que ESTA configurado, e nao so o que falta: e o que
   * separa "instalei e nao sei o que ele esta usando" de um inventario.
   */
  describe('o inventario da configuracao', () => {
    it('lista os oito campos com o valor em uso', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)
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
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun onSaved={onSaved} />)

      expect(await screen.findByText(/ainda não existe/i)).toBeTruthy()
    })

    it('diz que a origem é desconhecida quando o arquivo não pôde ser lido', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          configFile: { path: 'config/app.json', present: true, parseable: false },
          fields: [{ key: 'port', value: 5173, source: 'desconhecida', restartPending: false }],
        }),
      )
      render(<WorkbookSetup dataVersion={1} firstRun={false} onSaved={onSaved} />)

      expect(await screen.findByText(/não pôde ser lido/i)).toBeTruthy()
      expect(await screen.findByText(/não foi possível ler/i)).toBeTruthy()
    })
  })
})
