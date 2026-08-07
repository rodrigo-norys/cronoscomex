import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '../src/pages/Home.tsx'
import { type ApiStub, healthFixture, indicatorsFixture, stubApi } from './support/api-stub.ts'

/**
 * A Pagina Inicial (RF-09). Doze cartoes, na ordem fixada pelo backlog, e
 * nenhum numero calculado aqui — todos vem de `GET /api/indicators`, ja
 * recortado no servidor.
 *
 * Os valores das fixtures sao os medidos na planilha real em 07/08/2026.
 */

let api: ApiStub

/**
 * A ordem e criterio de aceite. Tres cartoes existem por achado, nao pela
 * especificacao original: "Em desembaraco" (A-12), os dois de urgencia (A-40) e
 * "Desembaracados hoje" (A-64).
 */
const ORDEM_ESPERADA = [
  'Total',
  'Desembaraçados',
  'Em andamento',
  'Em desembaraço',
  'Fechado — aguardando draft',
  'Canal Vermelho',
  'Chegando hoje',
  'Chegando esta semana',
  'Chegando em 15 dias',
  'Desembaraçados hoje',
  'Atrasados',
  'Documentos pendentes',
]

beforeEach(() => {
  api = stubApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderHome(queryString = '') {
  return render(<Home health={healthFixture()} queryString={queryString} dataVersion={0} />)
}

function cardsInOrder(): string[] {
  const section = screen.getByRole('region', { name: 'Cartões-resumo' })
  return within(section)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '')
}

describe('os doze cartoes', () => {
  it('exibe os doze, na ordem fixada', async () => {
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(12))
    expect(cardsInOrder()).toEqual(ORDEM_ESPERADA)
  })

  /** Restrito a secao: `649` tambem aparece em "Linhas lidas" e "Aceitas" do
   * painel de saude, e sao numeros diferentes que coincidem. */
  it('mostra os valores que a rota devolveu, cada um no seu cartao', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(12))
    const section = screen.getByRole('region', { name: 'Cartões-resumo' })

    const porRotulo = new Map(
      Array.from(section.querySelectorAll('article')).map((card) => [
        card.querySelector('h3')?.textContent,
        card.querySelector('p')?.textContent,
      ]),
    )

    expect(porRotulo.get('Total')).toBe('649')
    expect(porRotulo.get('Desembaraçados')).toBe('480')
    expect(porRotulo.get('Em andamento')).toBe('103')
    expect(porRotulo.get('Em desembaraço')).toBe('32')
    expect(porRotulo.get('Atrasados')).toBe('17')
    expect(porRotulo.get('Documentos pendentes')).toBe('14')
    // Zero MEDIDO, e nao ausencia: o RG mais recente da planilha e 31/07.
    expect(porRotulo.get('Desembaraçados hoje')).toBe('0')
  })

  it('separa visualmente as urgencias dos cartoes de volume (A-40)', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(12))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    const urgentes = section.querySelectorAll('[data-variant="urgencia"]')
    const volumes = section.querySelectorAll('[data-variant="volume"]')

    expect(urgentes).toHaveLength(2)
    expect(volumes).toHaveLength(10)
    expect(Array.from(urgentes).map((card) => card.querySelector('h3')?.textContent)).toEqual([
      'Atrasados',
      'Documentos pendentes',
    ])
  })

  it('conjunto vazio exibe doze zeros, sem erro', async () => {
    api.serveIndicators(
      indicatorsFixture({
        total: 0,
        emAndamento: 0,
        emDesembaraco: 0,
        desembaracados: 0,
        fechadoAguardandoDraft: 0,
        canalVermelho: 0,
        chegandoHoje: 0,
        chegandoSemana: 0,
        chegando15Dias: 0,
        atrasados: 0,
        documentosPendentes: 0,
        desembaracadosHoje: 0,
      }),
    )
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(12))
    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    expect(within(section).getAllByText('0')).toHaveLength(12)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('a conferencia de A-12', () => {
  it('exibe a soma das quatro categorias junto do total, e elas conferem', async () => {
    renderHome()

    // 103 + 32 + 480 + 34 = 649, medido na planilha real.
    const linha = await screen.findByText(/Soma das 4 categorias/)
    expect(linha.textContent).toMatch(/649/)
    expect(linha.textContent).toMatch(/conferem/)
  })

  it('denuncia quando a soma NAO fecha — o defeito seria do servidor', async () => {
    api.serveIndicators(indicatorsFixture({ emAndamento: 100 }))
    renderHome()

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/NÃO conferem/)
    expect(alerta.textContent).toMatch(/646/)
  })
})

describe('estados que nao sao zero', () => {
  it('sem leitura concluida, os cartoes ficam em carregamento — nunca em zero', async () => {
    api.indicatorsWithoutRead()
    renderHome()

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/os traços não significam zero/)).toBeTruthy()

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    expect(within(section).getAllByText('—')).toHaveLength(12)
    expect(within(section).queryByText('0')).toBeNull()
  })

  it('falha da rota vira aviso, nao painel de zeros', async () => {
    api.failIndicators()
    renderHome()

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/Não foi possível carregar os indicadores/)
    expect(screen.queryByRole('region', { name: 'Cartões-resumo' })).toBeNull()
  })
})

describe('filtros globais', () => {
  it('anexa a query as requisicoes, sem remonta-la', async () => {
    renderHome('?category=em_andamento&client=ACME')

    await waitFor(() =>
      expect(api.calls).toContain('GET /api/indicators?category=em_andamento&client=ACME'),
    )
  })

  it('a quarentena NAO leva filtro: e sobre a leitura do arquivo', async () => {
    renderHome('?category=em_andamento')

    await waitFor(() => expect(api.calls).toContain('GET /api/quarantine'))
    expect(api.calls.some((call) => call.startsWith('GET /api/quarantine?'))).toBe(false)
  })
})
