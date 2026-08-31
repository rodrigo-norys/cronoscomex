import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProcessDetail } from '../src/pages/ProcessDetail.tsx'
import { type ApiStub, processDetailFixture, processFixture, stubApi } from './support/api-stub.ts'

/**
 * O detalhe do processo (RF-15). É a **única** tela onde `statusRaw` aparece
 * (§2.1), e a única que exibe as três colunas fora de escopo.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/processo/FT501.26')
  api = stubApi()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function renderPage(processRef = 'FT501.26') {
  return render(<ProcessDetail processRef={processRef} dataVersion={0} />)
}

function bloco(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name })
}

describe('status original ao lado da categoria', () => {
  it('exibe o statusRaw, que so aparece aqui (§2.1)', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        process: processFixture({
          statusRaw: 'CANAL AMARELO - AGUARDANDO',
          statusCategory: 'em_andamento',
        }),
      }),
    )
    renderPage()

    const status = await bloco('Status')

    expect(within(status).getByText('CANAL AMARELO - AGUARDANDO')).toBeTruthy()
    expect(within(status).getByText('Em andamento')).toBeTruthy()
  })

  it('deixa visivel que o texto original nao agrupa nem conta', async () => {
    api.serveProcessDetail(processDetailFixture())
    renderPage()

    expect(
      within(await bloco('Status')).getByText(/nunca é usado para agrupar ou contar/),
    ).toBeTruthy()
  })

  // `null` e REF sem evento no historico; zero afirmaria que mudou hoje.
  it('exibe traco em dias na categoria, e nao zero', async () => {
    api.serveProcessDetail(processDetailFixture({ daysInCurrentCategory: null }))
    renderPage()

    const status = await bloco('Status')

    expect(within(status).getByText('—')).toBeTruthy()
    expect(within(status).queryByText('0')).toBeNull()
  })
})

describe('campos fora de escopo (§2)', () => {
  it('exibe as tres colunas como texto puro, rotuladas', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        process: processFixture({
          boletoRaw: 'BOL-123',
          paymentRaw: 'R$ 1.234,56',
          columnPRaw: 'anotacao',
        }),
      }),
    )
    renderPage()

    const fora = await bloco('Campos fora de escopo')

    expect(within(fora).getByText('BOL-123')).toBeTruthy()
    expect(within(fora).getByText('R$ 1.234,56')).toBeTruthy()
    expect(within(fora).getByText('anotacao')).toBeTruthy()
    expect(within(fora).getByText(/Nenhum indicador os usa/)).toBeTruthy()
  })
})

describe('anomalias com a explicacao', () => {
  /**
   * O texto vem do domínio, junto do código. Montá-lo aqui escreveria a tabela
   * de `describeAnomaly` num segundo lugar.
   */
  it('lista cada anomalia com o texto que a explica', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        anomalies: [
          { code: 'RG_SEM_DESEMBARACO', detail: 'RG preenchido com categoria em_andamento' },
          { code: 'DATA_SEM_ANO', detail: 'celula de data sem ano; o ano NAO foi inferido' },
        ],
      }),
    )
    renderPage()

    const anomalias = await bloco('Anomalias')

    expect(within(anomalias).getByText('RG_SEM_DESEMBARACO')).toBeTruthy()
    expect(within(anomalias).getByText(/RG preenchido com categoria em_andamento/)).toBeTruthy()
    expect(within(anomalias).getByText(/o ano NAO foi inferido/)).toBeTruthy()
  })

  it('afirma a ausencia de divergencia em vez de secao vazia', async () => {
    api.serveProcessDetail(processDetailFixture({ anomalies: [] }))
    renderPage()

    expect(
      within(await bloco('Anomalias')).getByText(/Nenhuma divergência registrada/),
    ).toBeTruthy()
  })
})

describe('historico de categoria', () => {
  /**
   * Duas ausências diferentes, e `daysInCurrentCategory` é o que as separa.
   * Sem evento algum a lista está vazia **porque o histórico não conhece o
   * processo** — dizer "nunca mudou" afirmaria estabilidade que ninguém mediu.
   */
  it('diz que nao ha evento algum quando o historico nao conhece o processo', async () => {
    api.serveProcessDetail(processDetailFixture({ statusHistory: [], daysInCurrentCategory: null }))
    renderPage()

    const historico = await bloco('Histórico de categoria')

    expect(within(historico).getByText(/Nenhum evento registrado/)).toBeTruthy()
    expect(within(historico).getByText(/não há retroatividade/)).toBeTruthy()
    expect(within(historico).queryByText(/Nenhuma mudança de categoria desde/)).toBeNull()
  })

  /**
   * O processo é conhecido e não mudou. Aqui "nenhuma mudança" é medido, e
   * declarar o que **não** entra na lista evita que o operador leia a ausência
   * como defeito quando trocou a cor da linha e nada apareceu.
   */
  it('diz que nao houve mudanca quando o processo e conhecido e estavel', async () => {
    api.serveProcessDetail(processDetailFixture({ statusHistory: [], daysInCurrentCategory: 9 }))
    renderPage()

    const historico = await bloco('Histórico de categoria')

    expect(within(historico).getByText(/Nenhuma mudança de categoria desde/)).toBeTruthy()
    expect(within(historico).getByText(/trocas de cor da linha não aparecem/)).toBeTruthy()
    expect(within(historico).queryByText(/Nenhum evento registrado/)).toBeNull()
  })

  it('exibe os eventos em ordem cronologica quando existirem', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        statusHistory: [
          { ts: '2026-07-30T10:00:00.000Z', from: 'em_andamento', to: 'em_desembaraco' },
          { ts: '2026-08-02T10:00:00.000Z', from: 'em_desembaraco', to: 'desembaracado' },
        ],
      }),
    )
    renderPage()

    const eventos = within(await bloco('Histórico de categoria')).getAllByRole('listitem')

    expect(eventos).toHaveLength(2)
    expect(eventos[0]?.textContent).toContain('30/07/2026')
    expect(eventos[1]?.textContent).toContain('Desembaraçado')
  })
})

describe('casos-limite', () => {
  it('exibe tela propria para REF inexistente', async () => {
    api.processDetailNotFound()
    renderPage('FT999.99')

    const naoEncontrado = await bloco('Processo não encontrado')

    expect(within(naoEncontrado).getByText('FT999.99')).toBeTruthy()
  })

  /**
   * `fechado_aguardando_draft` é a linha que tem REF e quase nada mais (A-22).
   * Campo vazio vira traço, e a categoria é exibida explicando o que ela é.
   */
  it('exibe traco nos campos vazios de fechado_aguardando_draft', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        process: processFixture({
          statusCategory: 'fechado_aguardando_draft',
          statusRaw: '',
          client: '',
          importer: '',
          billOfLading: '',
          container: '',
          eta2: null,
        }),
      }),
    )
    renderPage()

    expect(within(await bloco('Status')).getByText('Fechado — aguardando draft')).toBeTruthy()
    expect(
      within(await bloco('Campos do processo')).getAllByText('—').length,
    ).toBeGreaterThanOrEqual(4)
  })
})

describe('estados que nao sao zero', () => {
  it('distingue ausencia de leitura de REF inexistente', async () => {
    api.processDetailWithoutRead()
    renderPage()

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/não significa que a REF não existe/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Processo não encontrado' })).toBeNull()
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failProcessDetail()
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Não foi possível carregar o processo/)).toBeTruthy()
  })
})

describe('requisicao', () => {
  // Sem filtros globais: o detalhe e sobre UM processo achado pela REF.
  it('busca pela REF e nao anexa recorte nenhum', async () => {
    api.serveProcessDetail(processDetailFixture())
    renderPage('FT501.26')

    await bloco('Identificação')
    expect(api.calls).toContain('GET /api/processes/FT501.26')
  })

  it('escapa a REF na URL', async () => {
    api.serveProcessDetail(processDetailFixture())
    renderPage('FT 501/26')

    await bloco('Identificação')
    expect(api.calls).toContain('GET /api/processes/FT%20501%2F26')
  })
})

/**
 * A edicao na tela (`H-23`). **Nada aqui grava no `.xlsx`** — o formulario
 * enfileira, e a projecao do servidor faz o valor aparecer no painel inteiro.
 */
describe('edicao na tela', () => {
  it('enfileira o campo escolhido com o valor digitado', async () => {
    api.serveProcessDetail(processDetailFixture())
    renderPage('FT501.26')

    const form = await bloco('Editar processo')
    fireEvent.change(within(form).getByLabelText('Campo'), { target: { value: 'clientRaw' } })
    fireEvent.change(within(form).getByLabelText('Valor novo'), { target: { value: 'NOVO' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Enfileirar' }))

    await waitFor(() => expect(api.calls).toContain('POST /api/edits'))
  })

  it('diz que a planilha nao e modificada', async () => {
    api.serveProcessDetail(processDetailFixture())
    renderPage()

    expect(within(await bloco('Editar processo')).getByText(/não é modificada/)).toBeTruthy()
  })

  // A mensagem do 400 vem do servidor: validar de novo no cliente criaria uma
  // segunda tabela de regras, que diverge da primeira no ajuste seguinte.
  it('exibe a recusa do servidor sem revalidar no cliente', async () => {
    api.serveProcessDetail(processDetailFixture())
    api.failEnqueueEdit('O campo "statusCategory" nao e editavel.')
    renderPage()

    const form = await bloco('Editar processo')
    fireEvent.change(within(form).getByLabelText('Valor novo'), { target: { value: 'x' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Enfileirar' }))

    expect(await within(form).findByRole('alert')).toBeTruthy()
    expect(within(form).getByText(/nao e editavel/)).toBeTruthy()
  })

  it('afirma a ausencia de pendencia quando nao ha nenhuma', async () => {
    api.serveProcessDetail(processDetailFixture({ pendingEdits: [] }))
    renderPage()

    expect(
      within(await bloco('Edições pendentes')).getByText(/valores exibidos são os da planilha/),
    ).toBeTruthy()
  })

  it('lista a pendencia com o de-para, e o vazio nomeado', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        pendingEdits: [
          {
            id: 'e1',
            ts: '2026-08-07T12:00:00.000Z',
            ref: 'FT501.26',
            sourceRow: 502,
            field: 'eta2',
            value: null,
            previous: '2026-08-20',
          },
        ],
      }),
    )
    renderPage()

    const painel = await bloco('Edições pendentes')

    expect(within(painel).getByText('ETA2')).toBeTruthy()
    expect(within(painel).getByText('2026-08-20')).toBeTruthy()
    expect(within(painel).getByText('(vazio)')).toBeTruthy()
  })

  it('descarta uma edicao pela lista', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        pendingEdits: [
          {
            id: 'e1',
            ts: '2026-08-07T12:00:00.000Z',
            ref: 'FT501.26',
            sourceRow: 502,
            field: 'clientRaw',
            value: 'NOVO',
            previous: 'ACME LOG',
          },
        ],
      }),
    )
    renderPage()

    fireEvent.click(
      await within(await bloco('Edições pendentes')).findByRole('button', {
        name: 'Descartar',
      }),
    )

    await waitFor(() => expect(api.calls).toContain('DELETE /api/edits/e1'))
  })

  /**
   * O esvaziamento atinge a fila inteira, e o rotulo diz isso. Um botao que
   * descarta o trabalho de outros processos sem avisar seria o pior da
   * aplicacao.
   */
  it('rotula o esvaziamento global com o alcance dele', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        pendingEdits: [
          {
            id: 'e1',
            ts: '2026-08-07T12:00:00.000Z',
            ref: 'FT501.26',
            sourceRow: 502,
            field: 'clientRaw',
            value: 'NOVO',
            previous: 'ACME LOG',
          },
        ],
      }),
    )
    renderPage()

    const painel = await bloco('Edições pendentes')
    const botao = within(painel).getByRole('button', { name: /Esvaziar a fila inteira/ })

    expect(botao.textContent).toContain('todos')

    fireEvent.click(botao)
    await waitFor(() => expect(api.calls).toContain('DELETE /api/edits'))
  })
})

/**
 * `H-49`. Os dois campos vêm juntos do servidor: a tela nunca deriva um do
 * outro (regra inviolavel 6).
 */
describe('cliente consolidado e processo do cliente', () => {
  it('exibe os dois campos lado a lado', async () => {
    api.serveProcessDetail(
      processDetailFixture({
        process: processFixture({ client: 'Acme Comércio', clientProcess: 'ACM-29' }),
      }),
    )
    renderPage()

    const campos = await bloco('Campos do processo')

    expect(within(campos).getByText('Cliente')).toBeTruthy()
    expect(within(campos).getByText('Acme Comércio')).toBeTruthy()
    expect(within(campos).getByText('Processo do cliente')).toBeTruthy()
    expect(within(campos).getByText('ACM-29')).toBeTruthy()
  })
})
