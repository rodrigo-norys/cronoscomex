import { render, screen, within } from '@testing-library/react'
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

  // `daysInCurrentCategory` e `null` ate H-28: zero afirmaria mudanca hoje.
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
   * Duas ausências diferentes. Até `H-28` a lista está vazia **porque não há
   * histórico**, não porque o processo nunca mudou — dizer a segunda afirmaria
   * estabilidade que ninguém mediu.
   */
  it('explica que o historico ainda nao e gravado, sem afirmar estabilidade', async () => {
    api.serveProcessDetail(processDetailFixture({ statusHistory: [] }))
    renderPage()

    const historico = await bloco('Histórico de categoria')

    expect(within(historico).getByText(/começa em/)).toBeTruthy()
    expect(within(historico).getByText(/não haverá retroatividade/)).toBeTruthy()
    expect(within(historico).queryByText(/nunca mudou de categoria\./)).toBeNull()
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
