import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { HealthResponse } from '../src/api-client.ts'
import { WorkbookSetup } from '../src/pages/WorkbookSetup.tsx'
import {
  type ApiStub,
  clientKeysFixture,
  healthFixture,
  ruleReachFixture,
  stubApi,
  teamFixture,
  workbookConfigFixture,
} from './support/api-stub.ts'

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

/**
 * A regiao viva do CAMINHO da planilha.
 *
 * **A tela passou a ter DUAS** em `H-88`: esta e a da declaracao de cliente, que
 * vive dentro da secao "Clientes por declarar". Ambas existem desde a montagem,
 * vazias, porque regiao viva que nasce populada nao e anunciada (`ACHADO 11`) —
 * entao `getByRole('alert')` acha duas e falha. A do caminho e a PRIMEIRA no
 * DOM por construcao: a secao de clientes e montada depois dela.
 */
function avisoDoCaminho(): HTMLElement {
  const [primeiro] = screen.getAllByRole('alert')
  if (primeiro === undefined) throw new Error('nenhuma regiao viva na tela')
  return primeiro
}

/** A confirmacao do CAMINHO, pelo mesmo motivo de `avisoDoCaminho`. */
function confirmacaoDoCaminho(): HTMLElement {
  const [primeiro] = screen.getAllByRole('status')
  if (primeiro === undefined) throw new Error('nenhuma regiao de status na tela')
  return primeiro
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

    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
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
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoDoCaminho()

    await act(async () => {
      fireEvent.change(campo, { target: { value: 'D:/planilha-nova' } })
      fireEvent.click(screen.getByRole('button', { name: /carregar esta planilha/i }))
    })

    await waitFor(() => expect(api.calls).toContain('PUT /api/config/workbook'))
    expect(avisoDoCaminho().textContent).toBe('')
  })

  it('mostra a frase que o servidor escreveu, e nao o codigo do erro', async () => {
    api.failSaveWorkbookPath(
      'Nao ha nenhum arquivo nesse caminho. Confira se a pasta do OneDrive esta sincronizada.',
    )
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoDoCaminho()

    await act(async () => {
      fireEvent.change(campo, { target: { value: 'D:/sumiu' } })
      fireEvent.click(screen.getByRole('button', { name: /carregar esta planilha/i }))
    })

    await waitFor(() => expect(avisoDoCaminho().textContent).toMatch(/pasta do OneDrive/i))
    expect(avisoDoCaminho().textContent).not.toMatch(/CAMINHO_INVALIDO/)
  })

  /**
   * A regiao de alerta existe desde a montagem, e so o texto dentro dela muda:
   * um no com `role="alert"` que nasce ja populado nao e anunciado pelo leitor
   * de tela, porque nao ha mudanca a comparar.
   */
  it('mantem a regiao de alerta no DOM desde a montagem', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const regiao = avisoDoCaminho()
    await campoDoCaminho()

    expect(avisoDoCaminho()).toBe(regiao)
  })

  it('avisa que o caminho salvo nao aponta para arquivo nenhum', async () => {
    api.serveWorkbookConfig({ workbookPath: 'C:/OneDrive/sumiu', exists: false, readable: false })

    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    expect(await screen.findByText(/não aponta para nenhum arquivo/i)).toBeTruthy()
  })

  it('avisa quando o arquivo existe e nao pode ser lido', async () => {
    api.serveWorkbookConfig({
      workbookPath: 'C:/OneDrive/sem-permissao',
      exists: true,
      readable: false,
    })

    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    expect(await screen.findByText(/não consegue lê-lo/i)).toBeTruthy()
  })

  it('nao deixa gravar caminho vazio', async () => {
    api.serveWorkbookConfig({ workbookPath: '', exists: false, readable: false })

    render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
    await campoDoCaminho()

    const botao = screen.getByRole('button', { name: /carregar esta planilha/i })
    expect(botao.hasAttribute('disabled')).toBe(true)
  })

  it('fala em primeira execucao quando nunca houve leitura', async () => {
    render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
    await campoDoCaminho()

    expect(screen.getByRole('heading', { name: /aponte a planilha para começar/i })).toBeTruthy()
    expect(screen.getByText(/é pedido/i)).toBeTruthy()
  })

  it('fala em troca de arquivo quando ja houve leitura', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await clicar('D:/planilha.xlsx')

      await waitFor(() => expect(confirmacaoDoCaminho().textContent).toMatch(/649 processos lidos/))
    })

    it('concorda o plural com um processo so', async () => {
      api.serve(healthFixture({ lastReadOk: true, rowsAccepted: 1 }))
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await clicar('D:/planilha.xlsx')

      await waitFor(() => expect(confirmacaoDoCaminho().textContent).toMatch(/1 processo lido/))
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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await clicar('D:/sem-a-aba.xlsx')

      await waitFor(() => expect(avisoDoCaminho().textContent).toMatch(/caminho foi salvo/i))
      expect(avisoDoCaminho().textContent).toMatch(/A aba 2026 nao existe/)
      expect(confirmacaoDoCaminho().textContent).toBe('')
    })

    /**
     * Sem isto o painel so aparece no poll seguinte, e a tela fica IDENTICA por
     * ate 5 s depois de um clique que deu certo — que e o intervalo em que o
     * operador conclui que o botao nao funciona e clica de novo.
     */
    it('entrega a casca o health que o PUT devolveu', async () => {
      api.serve(healthFixture({ workbookPath: 'D:/nova.xlsx', lastReadOk: true }))
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await clicar('D:/nova.xlsx')

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(onSaved.mock.calls[0]?.[0].workbookPath).toBe('D:/nova.xlsx')
    })

    it('nao avisa a casca quando o servidor recusou', async () => {
      api.failSaveWorkbookPath('O arquivo precisa ser uma planilha .xlsx.')
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await clicar('D:/documento.docx')

      await waitFor(() => expect(avisoDoCaminho().textContent).toMatch(/\.xlsx/))
      expect(onSaved).not.toHaveBeenCalled()
    })

    /**
     * A posicao E o defeito: a recusa vinha depois do inventario inteiro — uma
     * tabela de oito linhas —, e nascia fora da area visivel.
     */
    it('coloca a resposta antes do inventario, e nao no fim da pagina', async () => {
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )
      const inventario = await screen.findByRole('region', { name: /o que está configurado/i })

      const posicao = avisoDoCaminho().compareDocumentPosition(inventario)

      expect(posicao & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('troca a confirmacao anterior pela recusa, em vez de exibir as duas', async () => {
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

      await clicar('D:/planilha.xlsx')
      await waitFor(() => expect(confirmacaoDoCaminho().textContent).not.toBe(''))

      api.failSaveWorkbookPath('Nao ha nenhum arquivo nesse caminho.')
      await clicar('D:/sumiu.xlsx')

      await waitFor(() => expect(avisoDoCaminho().textContent).toMatch(/nenhum arquivo/))
      expect(confirmacaoDoCaminho().textContent).toBe('')
    })

    /**
     * O efeito que preenche o campo reagia a TODA resposta do servidor, e o
     * recorte e refeito a cada `dataVersion`: uma releitura no meio da digitacao
     * apagava o que o operador tinha escrito, deixando o botao desabilitado sem
     * nada explicando por que.
     */
    it('nao apaga o que o operador digitou quando a planilha e relida', async () => {
      const { rerender } = render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )
      const campo = await campoDoCaminho()
      // O campo aparece no commit, e o efeito que o preenche roda DEPOIS dele:
      // digitar no intervalo entre os dois deixa o teste a merce da ordem, e foi
      // o que o fez falhar uma vez em 19/08/2026.
      await waitFor(() => expect(campo.value).not.toBe(''))

      fireEvent.change(campo, { target: { value: 'D:/ainda-digitando' } })
      await act(async () => {
        rerender(
          <WorkbookSetup
            dataVersion={2}
            firstRun={false}
            schemaDivergences={[]}
            onSaved={onSaved}
          />,
        )
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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )
      await waitFor(() =>
        expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
          'C:/OneDrive/atual.xlsx',
        ),
      )

      await escolher()

      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).value).toBe(
        'C:/OneDrive/atual.xlsx',
      )
      expect(avisoDoCaminho().textContent).toBe('')
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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      await escolher()

      await waitFor(() =>
        expect(avisoDoCaminho().textContent).toMatch(/Digite o caminho da planilha/),
      )
      expect(avisoDoCaminho().textContent).not.toMatch(/SELETOR_INDISPONIVEL/)
      expect((screen.getByLabelText(/caminho completo/i) as HTMLInputElement).disabled).toBe(false)
    })

    it('limpa a recusa anterior quando a escolha seguinte da certo', async () => {
      api.failBrowse(501, 'SELETOR_INDISPONIVEL', 'Esta maquina nao abre o seletor.')
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
      await escolher()
      await waitFor(() => expect(avisoDoCaminho().textContent).not.toBe(''))

      api.serveBrowse('C:/OneDrive/enfim.xlsx')
      await escolher()

      await waitFor(() => expect(avisoDoCaminho().textContent).toBe(''))
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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      expect((await checklist()).textContent).toMatch(/Node\.js instalado.*versão 22\.23\.2/)
    })

    it('lista as etapas na ordem em que o atalho as percorre', async () => {
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
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

      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
      const regiao = await checklist()

      expect(regiao.textContent).toMatch(/cumprida/)
      expect(regiao.textContent).toMatch(/pendente/)
    })

    it('reconfere sem recarregar a pagina nem reexecutar o atalho', async () => {
      api.serveWorkbookConfig({ runtime: { nodeVersion: '22.23.2', webBuilt: false } })
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)
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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

      expect((await checklist()).textContent).toMatch(/Tudo pronto/)
    })
  })

  /**
   * H-35. A tela mostra o que ESTA configurado, e nao so o que falta: e o que
   * separa "instalei e nao sei o que ele esta usando" de um inventario.
   */
  describe('o inventario da configuracao', () => {
    it('lista os oito campos com o valor em uso', async () => {
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )
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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

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
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

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
      render(<WorkbookSetup dataVersion={1} firstRun schemaDivergences={[]} onSaved={onSaved} />)

      expect(await screen.findByText(/ainda não existe/i)).toBeTruthy()
    })

    it('diz que a origem é desconhecida quando o arquivo não pôde ser lido', async () => {
      api.serveWorkbookConfig(
        workbookConfigFixture({
          configFile: { path: 'config/app.json', present: true, parseable: false },
          fields: [{ key: 'port', value: 5173, source: 'desconhecida', restartPending: false }],
        }),
      )
      render(
        <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
      )

      expect(await screen.findByText(/não pôde ser lido/i)).toBeTruthy()
      expect(await screen.findByText(/não foi possível ler/i)).toBeTruthy()
    })
  })
})

/**
 * A divida de declaracao do mapa de clientes (`H-88`).
 *
 * Os numeros vem da planilha real, medidos em 08/09/2026: **111 grafias** sem
 * cliente declarado, **140 processos**, e **83 delas valendo um processo cada** —
 * e e isso que faz o teto e a ordem estavel importarem.
 */

/**
 * O painel de equipe (`H-91`), hospedado nesta pagina.
 *
 * **Ele e componente, e nao secao da pagina** (`D-36`): o painel de clientes
 * nasceu escrito dentro desta tela e precisou mudar de casa depois do uso.
 * Testa-lo aqui e testar a pagina que o HOSPEDA — se ele mudar de casa, estes
 * blocos migram junto, como os cinco de `H-88` migraram para `Clients.test.tsx`.
 *
 * **Ele traz a SEGUNDA regiao viva da tela**, e e por isso que `avisoDoCaminho`
 * pega a primeira: ele e o unico com este nome.
 */
async function painelDaEquipe(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: /responsáveis por importador/i })
}

/** Abre o painel: o conteudo nasce recolhido (`D-37`), e `hidden` o esconde. */
async function abrirPainel(): Promise<HTMLElement> {
  const painel = await painelDaEquipe()
  fireEvent.click(within(painel).getByRole('button', { name: /definir responsáveis/i }))
  return painel
}

describe('responsáveis por importador', () => {
  it('mostra a dívida na faixa, sem o operador abrir o painel', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await painelDaEquipe()
    expect(painel.textContent).toContain('2')
    expect(painel.textContent).toMatch(/responsáveis definidos/i)
    expect(painel.textContent).toMatch(/importador ainda não tem/i)
  })

  it('conta as linhas SEM importador e não as oferece', async () => {
    // 35 na planilha real: nenhuma carteira as alcanca por construcao, e
    // some-las seria descarte silencioso (regra inviolavel 2). O conserto e
    // preencher a coluna IMPORTADOR, editavel desde `H-80`.
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    expect(painel.textContent).toContain('35')
    expect(painel.textContent).toMatch(/sem importador preenchido/i)

    const seletor = within(painel).getByLabelText('Importador') as HTMLSelectElement
    const valores = [...seletor.options].map((opcao) => opcao.value)
    expect(valores).toEqual(['', 'MPA'])
  })

  it('diz que traço não é zero enquanto NUNCA houve leitura', async () => {
    api.teamWithoutRead()
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await painelDaEquipe()
    await waitFor(() => {
      expect(painel.textContent).toMatch(/vazio aqui não significa que está tudo atribuído/i)
    })
  })

  it('anuncia a falha da carga em vez de mostrar equipe vazia', async () => {
    api.failTeam()
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await painelDaEquipe()
    await waitFor(() => {
      expect(painel.textContent).toMatch(/não foi possível carregar a equipe/i)
    })
  })

  it('atribui um importador mandando a carteira INTEIRA', async () => {
    // A rota REDEFINE o membro: mandar so o importador novo apagaria os que ele
    // ja tinha.
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.change(within(painel).getByLabelText('Importador'), { target: { value: 'MPA' } })
    fireEvent.change(within(painel).getByLabelText('Responsável'), { target: { value: 'membro1' } })
    fireEvent.click(within(painel).getByRole('button', { name: /^atribuir$/i }))

    await waitFor(() => {
      expect(api.teamBodies).toEqual([
        { url: '/api/team/membro1', label: 'Membro 1', importers: ['IMPORTADORA UM', 'MPA'] },
      ])
    })
  })

  it('cria o responsável novo na chave IMPESSOAL do servidor, nunca no nome', async () => {
    /*
      Regra inviolavel 8. A chave viaja pelo dominio, entra no ranking de IND-20
      e vira parametro de URL no filtro Responsavel — derivada do nome digitado,
      como `H-88` faz com o cliente, ela levaria o nome da pessoa para todos
      esses lugares.
    */
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.change(within(painel).getByLabelText('Importador'), { target: { value: 'MPA' } })
    fireEvent.change(within(painel).getByLabelText('Responsável'), {
      target: { value: 'criar-novo' },
    })
    fireEvent.change(within(painel).getByLabelText(/nome do responsável/i), {
      target: { value: 'Maria Silva' },
    })
    fireEvent.click(within(painel).getByRole('button', { name: /^criar$/i }))

    await waitFor(() => {
      expect(api.teamBodies).toEqual([
        { url: '/api/team/membro3', label: 'Maria Silva', importers: ['MPA'] },
      ])
    })
    expect(api.teamBodies[0]?.url).not.toMatch(/maria/i)
  })

  it('cria com carteira VAZIA quando nenhum importador foi escolhido', async () => {
    // Alguem entra na equipe e recebe importador depois — o caso-limite que
    // `H-91` tornou legitimo, e que ate ali matava a partida.
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.change(within(painel).getByLabelText('Responsável'), {
      target: { value: 'criar-novo' },
    })
    fireEvent.change(within(painel).getByLabelText(/nome do responsável/i), {
      target: { value: 'Maria Silva' },
    })
    fireEvent.click(within(painel).getByRole('button', { name: /^criar$/i }))

    await waitFor(() => {
      expect(api.teamBodies[0]?.importers).toEqual([])
    })
  })

  it('não grava enquanto o operador não escolheu quem recebe', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.change(within(painel).getByLabelText('Importador'), { target: { value: 'MPA' } })

    const botao = within(painel).getByRole('button', { name: /^atribuir$/i }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
  })

  it('desfaz o responsável inteiro', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.click(within(painel).getByRole('button', { name: /desfazer membro 1/i }))

    await waitFor(() => {
      expect(api.teamRemovals).toEqual(['/api/team/membro1'])
    })
  })

  it('tira um importador sem desfazer a pessoa', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.click(
      within(painel).getByRole('button', { name: /tirar importadora um de membro 1/i }),
    )

    await waitFor(() => {
      expect(api.teamRemovals).toEqual(['/api/team/membro1/importers/IMPORTADORA%20UM'])
    })
  })

  it('entrega a recusa do servidor ao operador, sem tradução', async () => {
    // Ele nao e tecnico, e e ele quem vai corrigir o que escolheu.
    api.failSaveTeamMember('O importador "MPA" já está na carteira de Membro 2.')
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    fireEvent.change(within(painel).getByLabelText('Importador'), { target: { value: 'MPA' } })
    fireEvent.change(within(painel).getByLabelText('Responsável'), { target: { value: 'membro1' } })
    fireEvent.click(within(painel).getByRole('button', { name: /^atribuir$/i }))

    await waitFor(() => {
      expect(painel.textContent).toContain('já está na carteira de Membro 2')
    })
  })

  it('diz que a carteira vazia é legítima, em vez de deixar a linha muda', async () => {
    api.serveTeam(
      teamFixture({
        members: [{ key: 'membro1', label: 'Membro 1', importers: [], count: 0 }],
      }),
    )
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    expect(painel.textContent).toMatch(/sem importador ainda/i)
  })

  it('afirma o estado quando todo importador já tem responsável', async () => {
    api.serveTeam(teamFixture({ unassigned: [], blankImporters: 0 }))
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await abrirPainel()
    expect(painel.textContent).toMatch(/todo importador da planilha (já )?tem responsável/i)
  })
})

/**
 * `H-96`. O painel que diz o que mudou no cabeçalho da planilha.
 *
 * **Nada aqui bloqueia nada** — decisão do usuário em 17/09/2026: a leitura
 * segue, os processos entram, e o painel nunca para. O que esta seção entrega é
 * o MOTIVO, nomeando as duas pontas (`RF-44`).
 */
describe('diferenças no cabeçalho (H-96)', () => {
  const renomeado = {
    kind: 'AUSENTE' as const,
    column: 'D',
    expectedColumn: 'D',
    expected: 'BL',
    found: 'BL ORIGINAL',
    span: 1,
    duplicateOf: null,
  }

  const secao = async (): Promise<HTMLElement> =>
    await screen.findByRole('region', { name: 'Diferenças no cabeçalho da planilha' })

  it('nomeia as duas pontas do que mudou', async () => {
    render(
      <WorkbookSetup
        dataVersion={1}
        firstRun={false}
        schemaDivergences={[renomeado]}
        onSaved={onSaved}
      />,
    )

    expect((await secao()).textContent).toContain(
      'Coluna D: esperado "BL", encontrado "BL ORIGINAL".',
    )
  })

  /** Cabeçalho batendo é o caso normal: não há seção, e não há quadro vazio. */
  it('sem divergência, a seção não existe', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await campoDoCaminho()

    expect(screen.queryByRole('region', { name: 'Diferenças no cabeçalho da planilha' })).toBeNull()
  })

  /**
   * **Uma edição na planilha é UMA linha**, e não catorze. Inserir uma coluna
   * desloca 14, e o operador fez um gesto só — o domínio agrupa o bloco, e a
   * tela mostra o que ele agrupou.
   */
  it('o bloco deslocado sai como uma linha só, com o tamanho dele', async () => {
    render(
      <WorkbookSetup
        dataVersion={1}
        firstRun={false}
        schemaDivergences={[
          {
            kind: 'DESLOCADO',
            column: 'D',
            expectedColumn: 'C',
            expected: 'IMPORTADOR',
            found: 'IMPORTADOR',
            span: 14,
            duplicateOf: null,
          },
        ]}
        onSaved={onSaved}
      />,
    )

    const painel = await secao()
    expect(painel.textContent).toContain('14 colunas andaram 1 coluna à direita, a partir de C')
    expect(within(painel).getAllByRole('listitem')).toHaveLength(1)
  })

  /**
   * **Aparece no arranque a frio também.** É o caso em que o operador mais
   * precisa dela: a aplicação sobe, a casca desvia para esta tela, e sem o
   * painel aqui ele veria só o formulário de caminho, sem explicação.
   */
  it('aparece na primeira execução, e não só na rota', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun schemaDivergences={[renomeado]} onSaved={onSaved} />,
    )

    expect((await secao()).textContent).toContain('BL ORIGINAL')
  })
})

/**
 * O painel do mapa de clientes, de volta a esta pagina em `D-50`.
 *
 * Percurso completo: nasceu aqui (`D-32`), mudou para a Pagina Clientes em
 * 09/09/2026 (`D-36`, que reverteu a determinacao 1 de `D-32`), e voltou em
 * 18/09/2026 — agora no TOPO e ao lado do painel de responsaveis. Os testes
 * vieram junto da Pagina Clientes, com o render trocado e nada mais: o que eles
 * exercem e o componente, que nao mudou.
 */
async function secao(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Clientes por declarar' })
}

/**
 * **A faixa nasce recolhida** (`D-37`), e o corpo so existe depois do clique.
 *
 * Medido a 1920x1080: expandido, o painel consome 710 px de uma janela de 1080,
 * e os tres rankings caiam abaixo da dobra numa pagina de 1752 px.
 */
async function abrirPainelDeClientes(): Promise<HTMLElement> {
  const painel = await secao()
  const botao = await within(painel).findByRole('button', { name: 'Declarar clientes' })
  fireEvent.click(botao)
  return painel
}

/** As linhas da lista da ESQUERDA — as grafias sem cliente. */
async function itens(): Promise<HTMLElement[]> {
  const painel = await abrirPainelDeClientes()
  const lista = await within(painel).findByRole('list', {
    // O rotulo nomeia a COLUNA desde 21/09/2026: a lista acompanha a aba.
    name: 'Valores de CLT sem cliente declarado',
  })
  return within(lista).findAllByRole('listitem')
}

/** As linhas da lista da DIREITA — os clientes ja declarados. */
async function declarados(): Promise<HTMLElement[]> {
  const painel = await abrirPainelDeClientes()
  const lista = await within(painel).findByRole('list', { name: 'Clientes declarados' })
  return within(lista).findAllByRole('listitem')
}

describe('clientes por declarar', () => {
  /**
   * As duas tabelas separam o que falta do que já foi (08/09/2026): a fixture
   * traz uma grafia livre e uma dentro de um pai, e cada uma vai para um lado.
   */
  it('poe a grafia sem cliente a esquerda, com contagem e REF de exemplo', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const lista = await itens()

    expect(lista).toHaveLength(1)
    expect(lista[0]?.textContent).toContain('YT-769')
    expect(lista[0]?.textContent).toContain('3 processos')
    expect(lista[0]?.textContent).toContain('FT498.26 · FT471.26')
  })

  /** A tabela da direita lista CLIENTES, e nao grafias: `AV` consolida 304
      celulas que diriam todas "Vivi > AV". */
  it('poe os clientes declarados a direita, com o pai e o peso deles', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const lista = await declarados()

    expect(lista).toHaveLength(2)
    expect(lista[0]?.textContent).toContain('Vivi')
    expect(lista[0]?.textContent).toContain('AV')
    expect(lista[0]?.textContent).toContain('304 processos')
    expect(lista[0]?.textContent).toContain('304 grafias')
  })

  /** A frase evita o jargao "grafia" na abertura, e diz o EFEITO (09/09/2026). */
  /**
   * **A faixa e o estado de repouso** (`D-37`): recolhida, ela custa uma linha
   * em vez dos 710 px medidos a 1920x1080, e a divida continua a vista.
   */
  it('nasce recolhida, com o corpo fora de alcance', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const painel = await secao()

    const botao = await within(painel).findByRole('button', { name: 'Declarar clientes' })
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    expect(within(painel).queryByRole('list', { name: /sem cliente declarado/ })).toBeNull()
  })

  it('abre e recolhe no lugar, sem trocar de pagina', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const painel = await abrirPainelDeClientes()

    const botao = within(painel).getByRole('button', { name: 'Recolher' })
    expect(botao.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(botao)
    expect(within(painel).queryByRole('list', { name: /sem cliente declarado/ })).toBeNull()
  })

  /** O resumo vive FORA do contentor recolhivel: e o unico lugar onde a divida
      aparece sem o operador pedir. */
  it('diz quantos valores a coluna tem mesmo com o painel recolhido', async () => {
    api.serveClientKeys(clientKeysFixture({ total: 509 }))
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await secao()
    await within(painel).findByRole('button', { name: 'Declarar clientes' })

    /*
      A descricao ficou GENERICA em 21/09/2026, e cita as tres colunas: com a
      declaracao podendo vir de CLT, REF ou IMPORTADOR, a frase anterior —
      "A coluna CLT tem 509 valores diferentes" — prometia uma contagem de uma
      coluna so, e passaria a mentir quando um processo ganhasse dono por outra.
    */
    expect(painel.textContent).toContain('CLT')
    expect(painel.textContent).toContain('REF')
    expect(painel.textContent).toContain('IMPORTADOR')
    // A fixture traz uma livre e uma declarada dentro de um pai.
    expect(painel.textContent).toMatch(/Hoje há\s*1\s*valor esperando/)
  })

  /**
   * A grafia livre diz "sem cliente" na propria linha — o texto e o que separa
   * "ainda nao declarei" de "declarei e o dono e este".
   */
  it('marca a grafia livre como sem cliente', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const lista = await itens()

    expect(lista[0]?.textContent).toContain('sem cliente')
  })

  /**
   * **A rolagem e do QUADRO, e nao da pagina.** As 111 estao todas no DOM: quem
   * corta e o `max-height`, e o operador rola dentro da lista em vez de expandir
   * de 20 em 20 e empurrar as etapas da partida para fora da tela. Mesma escolha
   * de `H-84` na Operacional e de `FilterPanel` para os 509 clientes.
   */
  it('poe as 111 grafias no quadro, sem paginar', async () => {
    const items = Array.from({ length: 111 }, (_, i) => ({
      key: `K${String(i).padStart(3, '0')}`,
      label: `K${String(i).padStart(3, '0')}`,
      count: 1,
      samples: ['FT001.26'],
      client: null,
      parent: null,
    }))
    api.serveClientKeys(clientKeysFixture({ items, total: 111 }))
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    expect(await itens()).toHaveLength(111)

    const painel = await secao()
    expect(within(painel).queryByRole('button', { name: /mostrar mais/i })).toBeNull()
  })

  /** `SC 2.1.1`: regiao rolavel que nao recebe foco nao se percorre do teclado. */
  it('a lista e uma parada de tabulacao nomeada, para rolar sem apontador', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await itens()

    const lista = await screen.findByRole('list', { name: /sem cliente declarado/ })

    expect(lista.getAttribute('tabindex')).toBe('0')
    expect(lista.className).toContain('overflow-y-auto')
    expect(lista.className).toContain('pending-viewport')
  })

  /** Zero aqui e uma afirmacao forte, e so vale depois de uma leitura. */
  it('coluna sem grafia nenhuma afirma isso, e diz que a leitura terminou', async () => {
    api.serveClientKeys(clientKeysFixture({ items: [], total: 0, names: [] }))
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await secao()
    expect(await within(painel).findByText(/A leitura foi concluída, e não há/)).toBeTruthy()
  })

  it('sem leitura, diz que vazio NAO significa tudo declarado', async () => {
    api.clientKeysWithoutRead()
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await secao()
    expect(await within(painel).findByText(/não significa que está tudo declarado/)).toBeTruthy()
  })

  it('falha da rota vira alerta, e nao lista vazia', async () => {
    api.failClientKeys()
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )

    const painel = await secao()
    const aviso = await within(painel).findByRole('alert')

    expect(aviso.textContent).toMatch(/Não foi possível carregar/)
    expect(within(painel).queryAllByRole('listitem')).toEqual([])
  })

  /** `D-32`, determinacao 2: divida de configuracao nao e recorte. */
  it('nao anexa filtro global nenhum a requisicao', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await itens()

    /*
      A coluna passou a viajar na query em 21/09/2026, e o que este teste guarda
      continua sendo o mesmo: a divida de configuracao NAO segue o recorte da
      tela (`D-32`, determinacao 2). Por isso a assercao passou de "sem query
      nenhuma" para "so `field`" — filtro global aqui faria a divida sumir, e o
      operador concluiria que declarou tudo.
    */
    const chamadas = api.calls.filter((call) => call.startsWith('GET /api/clients'))
    expect(chamadas.length).toBeGreaterThan(0)
    for (const call of chamadas) {
      expect(call).toMatch(/^GET \/api\/clients\?field=(clt|ref|importer)$/)
    }
  })
})

/**
 * A declaracao pela tela (`H-88`, ponto verde 2).
 *
 * O caso que move tudo esta medido na planilha real: as 111 grafias caem em
 * tres prefixos que cobrem 98 delas, e `Y` casa `YT-769` — sem ver o alcance, o
 * operador declara supondo quatro e alcanca sessenta e duas.
 */
describe('declarar um cliente', () => {
  async function formulario(): Promise<HTMLElement> {
    await abrirPainelDeClientes()
    return screen.findByRole('button', { name: /^declarar$/i })
  }

  function preencher(valor: string, nome: string): void {
    fireEvent.change(screen.getByLabelText(/valor na coluna clt/i), { target: { value: valor } })
    fireEvent.change(screen.getByLabelText(/nome do cliente/i), { target: { value: nome } })
  }

  it('mostra o alcance da regra antes de gravar', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await formulario()

    preencher('Y', 'Vivi')

    expect(await screen.findByText(/passa a consolidar/i)).toBeTruthy()
    const previsao = screen.getByText(/passa a consolidar/i)
    expect(previsao.textContent).toContain('4')
    expect(previsao.textContent).toContain('Y2601, Y2602, YT-769')
  })

  /**
   * `Y` casa `YT-769`, que ja tem dono. A previsao precisa dizer que elas
   * continuam como estao — a regra nova entra no fim, e a primeira que casa
   * vence (determinacao 6 de `D-35`).
   */
  it('avisa quais grafias ja tem dono e nao mudam', async () => {
    api.serveRuleReach(
      ruleReachFixture({
        keys: 2,
        processes: 2,
        alreadyMapped: [
          { key: 'YT-769', label: 'Beta', count: 1 },
          { key: 'YT-777', label: 'Beta', count: 1 },
        ],
      }),
    )
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await formulario()

    preencher('Y', 'Vivi')

    // `findByText` devolve o `<strong>`; quem tem a frase inteira e o paragrafo.
    const marca = await screen.findByText(/continuam como estão/i)
    const previsao = marca.closest('p')

    expect(previsao?.textContent).toContain('YT-769, YT-777')
    expect(previsao?.textContent).toContain('2 grafias')
  })

  /** Determinacao 5 de `D-35`: nenhuma regra e gravada sem o alcance a vista. */
  it('mantem o botao fora de alcance ate a previsao chegar', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const botao = await formulario()

    expect(botao.hasAttribute('disabled')).toBe(true)

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)

    expect(botao.hasAttribute('disabled')).toBe(false)
  })

  it('nao deixa declarar o que nao alcanca nada', async () => {
    api.serveRuleReach(ruleReachFixture({ keys: 0, processes: 0, samples: [] }))
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const botao = await formulario()

    preencher('ZZZ', 'Vivi')
    await screen.findByText(/passa a consolidar/i)

    expect(botao.hasAttribute('disabled')).toBe(true)
  })

  it('envia o match escolhido junto do valor e do nome', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const botao = await formulario()

    fireEvent.change(screen.getByLabelText(/como comparar/i), { target: { value: 'prefix' } })
    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    await waitFor(() => expect(api.ruleBodies).toHaveLength(1))
    // `field` viaja desde 21/09/2026, e `clt` e a aba em que o formulario abre.
    expect(api.ruleBodies[0]).toEqual({ match: 'prefix', value: 'Y', label: 'Vivi', field: 'clt' })
  })

  /** Clicar na grafia poupa digitar o que a lista ja mostra. */
  it('clicar numa grafia da lista a leva para o formulario, como regra exata', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await itens()

    fireEvent.click(screen.getByRole('button', { name: 'YT-769' }))

    expect((screen.getByLabelText(/valor na coluna clt/i) as HTMLInputElement).value).toBe('YT-769')
    expect((screen.getByLabelText(/como comparar/i) as HTMLSelectElement).value).toBe('exact')
  })

  it('a recusa do servidor chega ao operador sem traducao', async () => {
    api.failCreateClientRule('Informe o nome do cliente.')
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const botao = await formulario()

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    expect(await screen.findByText('Informe o nome do cliente.')).toBeTruthy()
  })

  it('declarado com sucesso, limpa o formulario e refaz a lista', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const botao = await formulario()
    const antes = api.calls.filter((call) => call.startsWith('GET /api/clients?')).length

    preencher('Y', 'Vivi')
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    expect(await screen.findByText(/Declarado: Vivi\./)).toBeTruthy()
    expect((screen.getByLabelText(/valor na coluna clt/i) as HTMLInputElement).value).toBe('')
    await waitFor(() =>
      expect(
        api.calls.filter((call) => call.startsWith('GET /api/clients?')).length,
      ).toBeGreaterThan(antes),
    )
  })
})

/**
 * O nome escolhido, e o que ele FAZ (`H-88`, determinacoes 8 e 9).
 *
 * O caso vem do mapa real: `Vivi` ja e pai de AV, Chun e Kelly, e declarar nele
 * acrescenta um filho — enquanto um nome novo cria cliente.
 */
describe('escolher o nome do cliente', () => {
  async function campoNome(): Promise<HTMLInputElement> {
    await abrirPainelDeClientes()
    return (await screen.findByLabelText(/nome do cliente/i)) as HTMLInputElement
  }

  /**
   * Os nomes sao BOTOES, e nao `datalist`: o dropdown nativo nao aceita a
   * paleta do conjunto, e o operador precisava abri-lo para saber que havia
   * sugestao.
   */
  /**
   * **Escopado no painel** (09/09/2026): o ranking de Clientes tambem tem um
   * botao "Vivi" — a barra clicavel do grafico —, e desde `D-36` os dois vivem
   * na mesma pagina. Buscar no documento inteiro acha o do grafico.
   */
  it('mostra os nomes que existem como botoes, com o pai marcado', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const painel = await secao()
    await campoNome()

    expect(within(painel).getByRole('button', { name: /^Vivi/ }).textContent).toContain(
      '4 clientes',
    )
    expect(within(painel).getByRole('button', { name: 'Dennis' })).toBeTruthy()
  })

  it('clicar num nome existente preenche o campo', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoNome()

    const painel = await secao()
    fireEvent.click(within(painel).getByRole('button', { name: /^Vivi/ }))

    expect(campo.value).toBe('Vivi')
  })

  it('diz que um nome novo vira cliente novo', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Cliente Novo' } })

    expect(await screen.findByText(/ainda não existe: será criado como cliente novo/)).toBeTruthy()
  })

  /** O pai ja existe: o conjunto entra como mais um filho. */
  it('diz que um nome que ja agrupa recebe mais um conjunto', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Vivi' } })

    expect(await screen.findByText(/entra como mais um dentro dele/)).toBeTruthy()
  })

  /** O nome tem UM conjunto: este e o segundo, e o pai nasce. */
  it('diz que um nome com um conjunto so passa a agrupar os dois', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'Dennis' } })

    expect(await screen.findByText(/passa a agrupar os dois/)).toBeTruthy()
  })

  it('reconhece o nome existente sem exigir a mesma caixa', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const campo = await campoNome()

    fireEvent.change(campo, { target: { value: 'vivi' } })

    expect(await screen.findByText(/entra como mais um dentro dele/)).toBeTruthy()
  })
})

/**
 * Desfazer o agrupamento (`H-88`, determinacao 9).
 *
 * **Nenhum cliente e apagado**: sai o vinculo com o pai, e o cliente volta ao
 * ranking com a contagem que sempre teve.
 */
describe('desfazer o agrupamento', () => {
  it('oferece os dois botoes quando o pai tem nome proprio', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()

    // `AV` esta dentro de Vivi: dois caminhos diferentes, dois botoes.
    expect(
      within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }),
    ).toBeTruthy()
    expect(
      within(lista[0] as HTMLElement).getByRole('button', { name: /desfazer vivi/i }),
    ).toBeTruthy()
  })

  /**
   * A opcao (a), escolhida pelo usuario em 18/09/2026.
   *
   * `Dennis` foi declarado quando cliente solto existia, e a carga o le como
   * grupo de um membro. Pai e filho dizem a mesma palavra: a tela nao a repete,
   * e nao pede ao operador que escolha entre dois caminhos identicos.
   */
  it('o declarado cujo nome e o proprio valor nao repete a palavra nem duplica o botao', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()
    const dennis = lista[1] as HTMLElement

    expect(dennis.textContent).not.toMatch(/›/)
    expect(within(dennis).queryByRole('button', { name: /tirar de/i })).toBeNull()
    expect(within(dennis).getByRole('button', { name: /desfazer dennis/i })).toBeTruthy()
  })

  /**
   * O que a mudanca de 18/09/2026 conserta: ate ela, `Dennis` nao tinha botao
   * nenhum — cliente solto nao estava em agrupamento, e apagar regra ficara
   * fora de `H-88`. Desfazer uma declaracao exigia editar o JSON a mao.
   */
  it('o declarado herdado passa a ter como ser desfeito pela tela', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()

    expect(within(lista[1] as HTMLElement).queryAllByRole('button')).toHaveLength(1)
  })

  it('tirar do pai chama a rota do membro, e apaga a declaracao', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    await waitFor(() => expect(api.removals).toHaveLength(1))
    expect(api.removals[0]).toBe('/api/clients/groups/VIVI-GRUPO/members/AV')
    expect(await screen.findByText(/A declaração foi apagada/)).toBeTruthy()
  })

  it('desfazer o pai apaga as declaracoes dos filhos', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /desfazer vivi/i }))

    await waitFor(() => expect(api.removals).toHaveLength(1))
    expect(api.removals[0]).toBe('/api/clients/groups/VIVI-GRUPO')
    expect(await screen.findByText(/3 declarações foram apagadas/)).toBeTruthy()
  })

  it('refaz a lista depois de desfazer', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()
    const antes = api.calls.filter((call) => call.startsWith('GET /api/clients?')).length

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    await waitFor(() =>
      expect(
        api.calls.filter((call) => call.startsWith('GET /api/clients?')).length,
      ).toBeGreaterThan(antes),
    )
  })

  it('a recusa do servidor chega ao operador sem traducao', async () => {
    api.failRemoveGroup('Esse agrupamento nao existe mais.')
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await declarados()

    fireEvent.click(within(lista[0] as HTMLElement).getByRole('button', { name: /tirar de vivi/i }))

    expect(await screen.findByText('Esse agrupamento nao existe mais.')).toBeTruthy()
  })
})

/**
 * As abas de coluna no formulario de declaracao (21/09/2026).
 *
 * Opcao B do artefato, escolhida pelo usuario: a coluna escolhida fica visivel
 * o tempo todo, e o rotulo do campo de valor a acompanha — ate aqui ele dizia
 * "na coluna CLT" e seria falso nas outras duas.
 */
describe('declarar por CLT, REF ou IMPORTADOR', () => {
  const abas = async (): Promise<HTMLElement> => {
    await abrirPainelDeClientes()
    return screen.getByRole('tablist', { name: /coluna onde buscar/i })
  }

  it('oferece as tres colunas, abrindo em CLT', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await abas()
    const botoes = within(lista).getAllByRole('tab')

    expect(botoes.map((b) => b.textContent)).toEqual(['Por CLT', 'Por REF', 'Por IMPORTADOR'])
    expect(botoes[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('o rotulo do campo de valor acompanha a aba', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const lista = await abas()

    expect(screen.getByLabelText('Valor na coluna CLT')).toBeTruthy()

    fireEvent.click(within(lista).getByRole('tab', { name: 'Por REF' }))
    expect(screen.getByLabelText('Valor na coluna REF')).toBeTruthy()

    fireEvent.click(within(lista).getByRole('tab', { name: 'Por IMPORTADOR' }))
    expect(screen.getByLabelText('Valor na coluna IMPORTADOR')).toBeTruthy()
  })

  it('envia a coluna escolhida junto da regra', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    await abrirPainelDeClientes()
    const botao = await screen.findByRole('button', { name: /^declarar$/i })

    fireEvent.click(screen.getByRole('tab', { name: 'Por IMPORTADOR' }))
    fireEvent.change(screen.getByLabelText(/valor na coluna importador/i), {
      target: { value: 'ALFA' },
    })
    fireEvent.change(screen.getByLabelText(/nome do cliente/i), {
      target: { value: 'Cliente Alfa' },
    })
    await screen.findByText(/passa a consolidar/i)
    fireEvent.click(botao)

    await waitFor(() => expect(api.ruleBodies).toHaveLength(1))
    expect(api.ruleBodies[0]).toMatchObject({ field: 'importer', value: 'ALFA' })
  })

  /**
   * A descricao deixou de prometer a contagem de UMA coluna: com tres, dizer
   * "a coluna CLT tem 509 valores" passaria a mentir assim que um processo
   * ganhasse dono por REF.
   */
  it('a descricao cita as tres colunas, sem prometer contagem de uma so', async () => {
    render(
      <WorkbookSetup dataVersion={1} firstRun={false} schemaDivergences={[]} onSaved={onSaved} />,
    )
    const painel = await secao()

    expect(painel.textContent).not.toContain('A coluna CLT tem')
    expect(painel.textContent).toMatch(/CLT/)
    expect(painel.textContent).toMatch(/REF/)
    expect(painel.textContent).toMatch(/IMPORTADOR/)
  })
})
