import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MonthlyHistoryResponse } from '../src/api-client.ts'
import { History } from '../src/pages/History.tsx'
import { type ApiStub, monthlyHistoryFixture, stubApi } from './support/api-stub.ts'

/**
 * A Página Histórico (RF-14). Nada é agregado aqui: os pontos chegam prontos de
 * `GET /api/history/monthly`, cada um já sendo o **estado ao fim do mês**.
 *
 * O que esta suíte protege é a distinção que A-43 exige — "não há passado
 * gravado" nunca pode sair como zero, nem como falha, nem como série silenciosa
 * que aparente cobrir a planilha inteira.
 */

let api: ApiStub

beforeEach(() => {
  window.history.replaceState(null, '', '/historico')
  api = stubApi()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function serve(overrides: Partial<MonthlyHistoryResponse> = {}): void {
  api.serveHistory(monthlyHistoryFixture(overrides))
}

/**
 * `H-54` pos uma segunda serie no mesmo grafico e na mesma tabela. Os testes que
 * medem a OBSERVADA a servem vazia — isolar e o que mantem cada caso medindo o
 * que o nome dele diz.
 */
const SEM_RECONSTRUCAO = { points: [], missingEta2: 0, missingRegistration: 0 }

function renderPage(queryString = '') {
  return render(<History queryString={queryString} dataVersion={0} />)
}

function serie(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Evolução mensal' })
}

/** As células de uma linha da tabela, na ordem: mês, volume, desembaraçados, Canal Vermelho. */
async function linhas(): Promise<string[][]> {
  const secao = await serie()
  return within(secao)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    )
}

describe('a série mensal com as três medidas', () => {
  it('exibe volume, desembaracados e Canal Vermelho de cada mes', async () => {
    serve({
      series: [
        { month: '2026-06', total: 640, desembaracados: 470, canalVermelho: 4 },
        { month: '2026-07', total: 645, desembaracados: 475, canalVermelho: 6 },
        { month: '2026-08', total: 649, desembaracados: 480, canalVermelho: 5 },
      ],
      reconstructed: SEM_RECONSTRUCAO,
      truncated: false,
    })
    renderPage()

    // As duas ultimas colunas sao da serie reconstruida, servida vazia aqui: o
    // traco diz que ela nao tem o mes, que e diferente de ter zero.
    expect(await linhas()).toEqual([
      ['jun/2026', '640', '470', '4', '—', '—'],
      ['jul/2026', '645', '475', '6', '—', '—'],
      ['ago/2026', '649', '480', '5', '—', '—'],
    ])
  })

  /**
   * O critério de aceite: ausência de mudança não é ausência de processos. O
   * domínio repete o ponto anterior, e a tela precisa exibi-lo como veio — um
   * cliente que "corrigisse" o mês repetido para zero destruiria a regra.
   */
  it('exibe o mes sem evento com os valores do mes anterior, nao com zero', async () => {
    serve({
      series: [
        { month: '2026-06', total: 10, desembaracados: 7, canalVermelho: 1 },
        { month: '2026-07', total: 10, desembaracados: 7, canalVermelho: 1 },
      ],
      reconstructed: SEM_RECONSTRUCAO,
      truncated: false,
    })
    renderPage()

    expect(await linhas()).toEqual([
      ['jun/2026', '10', '7', '1', '—', '—'],
      ['jul/2026', '10', '7', '1', '—', '—'],
    ])
  })

  it('anexa a queryString dos filtros a requisicao', async () => {
    renderPage('?client=ACME')
    await serie()

    expect(api.calls).toContain('GET /api/history/monthly?client=ACME&months=12')
  })

  it('pede a janela padrao de 12 meses sem filtro algum', async () => {
    renderPage()
    await serie()

    expect(api.calls).toContain('GET /api/history/monthly?months=12')
  })
})

describe('o que a série não cobre (A-43)', () => {
  it('declara a data em que o historico comecou', async () => {
    serve({ historyStartedAt: '2026-08-03T14:22:31.004Z' })
    renderPage()
    await serie()

    expect(screen.getByText(/03\/08\/2026/)).toBeTruthy()
    expect(screen.getByText(/Não há dado anterior a essa data/)).toBeTruthy()
  })

  /**
   * Primeiro dia de uso, com o arquivo ainda vazio. O backlog descrevia "gráfico
   * com um único ponto", mas o contrato serve `series: []` e `historyStartedAt:
   * null` — não há ponto algum a desenhar, e um gráfico zerado afirmaria zero
   * processo. Divergência levantada na fatia de `H-21`: os dois estados são
   * distintos, e este é o de arquivo vazio ou apagado.
   */
  it('exibe estado vazio afirmativo sem historico algum, e nenhum grafico', async () => {
    // Sem reconstrucao tambem: com ela `H-54` acompanha o estado vazio em vez de
    // substitui-lo, e isso tem caso proprio abaixo.
    serve({
      series: [],
      reconstructed: SEM_RECONSTRUCAO,
      historyStartedAt: null,
      truncated: false,
    })
    renderPage()

    const vazio = await serie()
    expect(within(vazio).getByText('Ainda não há histórico registrado.')).toBeTruthy()
    expect(within(vazio).queryByRole('table')).toBe(null)
    expect(screen.getByText(/Não há retroatividade/)).toBeTruthy()
  })

  it('exibe um unico ponto quando so a primeira leitura foi gravada', async () => {
    serve({
      series: [{ month: '2026-08', total: 649, desembaracados: 480, canalVermelho: 5 }],
      reconstructed: SEM_RECONSTRUCAO,
      historyStartedAt: '2026-08-03T14:22:31.004Z',
    })
    renderPage()

    expect(await linhas()).toEqual([['ago/2026', '649', '480', '5', '—', '—']])
    expect(screen.getByText(/03\/08\/2026/)).toBeTruthy()
  })

  /**
   * `aggregateMonthly` acumula os REF vistos e nunca remove: sumir da planilha
   * não gera evento (ADR-0005), então o volume da série é o que a aplicação
   * observou, e não o que há no arquivo hoje. Sem a nota, o operador compara com
   * o cartão da Página Inicial e desconfia dos dois números.
   *
   * Medido em 17/08/2026 contra a planilha real: a série marca 650 e a leitura
   * tem 649. A REF a mais é `FT999.26`, `sourceRow` 11 — resíduo de conferência
   * manual no `data/history.jsonl` de desenvolvimento, **não** processo removido.
   * A divergência que a nota explica é real e o mecanismo é o descrito; o caso
   * que a produziu nesta máquina, não.
   */
  it('declara que volume conta o observado, e nao o que ha na planilha hoje', async () => {
    serve()
    renderPage()
    await serie()

    expect(screen.getByText(/Volume conta os processos que a aplicação já observou/)).toBeTruthy()
  })

  it('nao declara nada sobre volume sem serie a explicar', async () => {
    serve({
      series: [],
      reconstructed: SEM_RECONSTRUCAO,
      historyStartedAt: null,
      truncated: false,
    })
    renderPage()
    await serie()

    expect(screen.queryByText(/Volume conta os processos que a aplicação já observou/)).toBe(null)
  })

  it('avisa quando a janela pedida excede o historico', async () => {
    serve({ truncated: true })
    renderPage()
    await serie()

    expect(screen.getByText(/é maior que o histórico existente/)).toBeTruthy()
  })

  it('nao avisa nada quando a janela cabe no historico', async () => {
    serve({ truncated: false })
    renderPage()
    await serie()

    expect(screen.queryByText(/é maior que o histórico existente/)).toBe(null)
  })

  /** O limite do recorte por filtro: o evento gravado só carrega `ref`. */
  it('declara o limite do recorte quando ha filtro ativo', async () => {
    renderPage('?vessel=EVER+FAIR')
    await serie()

    expect(screen.getByText(/o histórico guarda apenas a REF/)).toBeTruthy()
  })

  it('nao declara limite de recorte nenhum sem filtro', async () => {
    renderPage()
    await serie()

    expect(screen.queryByText(/o histórico guarda apenas a REF/)).toBe(null)
  })
})

describe('a janela da série', () => {
  it('refaz a requisicao com a janela escolhida', async () => {
    renderPage()
    await serie()

    fireEvent.click(screen.getByRole('button', { name: '60 meses' }))

    await waitFor(() => expect(api.calls).toContain('GET /api/history/monthly?months=60'))
  })

  it('marca a janela corrente para o leitor de tela', async () => {
    renderPage()
    await serie()

    expect(screen.getByRole('button', { name: '12 meses', pressed: true })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '24 meses' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '24 meses', pressed: true })).toBeTruthy(),
    )
  })

  // A janela recorta a serie OBSERVADA, e por isso nao aparece sem ela — mesmo
  // com a reconstruida a vista, que nao e recortada por `months` (`H-54`).
  it('nao oferece janela nenhuma sem historico a recortar', async () => {
    serve({
      series: [],
      reconstructed: SEM_RECONSTRUCAO,
      historyStartedAt: null,
      truncated: false,
    })
    renderPage()
    await serie()

    expect(screen.queryByRole('button', { name: '60 meses' })).toBe(null)
  })
})

describe('os dois estados que não são zero', () => {
  /**
   * `503` é "a planilha nunca foi lida", e não "o histórico está vazio". Série
   * vazia ali afirmaria que não há processos — o pior erro possível numa tela
   * cuja função é mostrar evolução.
   */
  it('distingue leitura ausente de historico vazio', async () => {
    api.historyWithoutRead()
    renderPage()

    const aviso = await screen.findByRole('status')
    expect(aviso.textContent).toMatch(/Nenhuma leitura da planilha foi concluída ainda/)
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('exibe a falha como alerta, nunca como serie vazia', async () => {
    api.failHistory()
    renderPage()

    const erro = await screen.findByRole('alert')
    expect(erro.textContent).toMatch(/Não foi possível carregar o histórico/)
    expect(screen.queryByRole('table')).toBe(null)
  })
})

/**
 * `H-54`. As duas series na mesma tela, e o rotulo com quatro digitos.
 *
 * O que se verifica: que a reconstruida aparece distinta e nomeada, que ela
 * acompanha o estado vazio em vez de substitui-lo, e que o que ficou fora dela
 * esta contado.
 */
describe('a série reconstruída', () => {
  it('exibe as duas séries na tabela, com nome que diz qual é qual', async () => {
    serve({
      series: [{ month: '2026-08', total: 649, desembaracados: 480, canalVermelho: 5 }],
      reconstructed: {
        points: [
          { month: '2026-07', chegados: 600, desembaracados: 470, forecast: false },
          { month: '2026-08', chegados: 631, desembaracados: 483, forecast: false },
        ],
        missingEta2: 64,
        missingRegistration: 166,
      },
    })
    renderPage()

    const secao = await serie()
    const cabecalhos = within(secao)
      .getAllByRole('columnheader')
      .map((th) => th.textContent ?? '')

    expect(cabecalhos).toContain('Volume (observado)')
    expect(cabecalhos).toContain('Volume (reconstruído)')

    // Julho tem só a reconstruída: traço nas observadas, e não zero.
    expect(await linhas()).toEqual([
      ['jul/2026', '—', '—', '—', '600', '470'],
      ['ago/2026', '649', '480', '5', '631', '483'],
    ])
  })

  // O defeito que o operador relatou: `ago/26` foi lido como dia 26 de agosto.
  it('escreve o ano com quatro dígitos no rótulo do mês', async () => {
    serve({
      series: [{ month: '2026-08', total: 1, desembaracados: 0, canalVermelho: 0 }],
      reconstructed: SEM_RECONSTRUCAO,
    })
    renderPage()

    const secao = await serie()

    expect(within(secao).getByText('ago/2026')).toBeTruthy()
    expect(within(secao).queryByText('ago/26')).toBeNull()
  })

  // Regra inviolável 2: quem ficou fora da reconstrução está contado na tela.
  it('diz quantos processos ficaram fora de cada medida reconstruída', async () => {
    serve()
    renderPage()
    await serie()

    const nota = screen.getByText(/não têm ETA2/)

    expect(nota.textContent).toContain('64')
    expect(nota.textContent).toContain('166')
  })

  // O caso-limite do backlog: 18 processos com ETA2 em set/2026. O trecho
  // futuro é marcado como previsão, e não omitido.
  it('marca o trecho futuro como previsão, com o mês em que ele começa', async () => {
    serve()
    renderPage()
    await serie()

    const nota = screen.getByText(/não têm ETA2/)

    expect(nota.textContent).toContain('previsão')
    expect(nota.textContent).toContain('set/2026')
  })

  it('não diz nada sobre previsão quando nenhum mês é futuro', async () => {
    serve({
      reconstructed: {
        points: [{ month: '2026-01', chegados: 10, desembaracados: 3, forecast: false }],
        missingEta2: 0,
        missingRegistration: 0,
      },
    })
    renderPage()
    await serie()

    expect(screen.getByText(/não têm ETA2/).textContent).not.toContain('previsão')
  })

  /**
   * O critério de aceite: o estado vazio de `H-21` não é substituído, é
   * acompanhado. A tela continua dizendo que não há observação registrada, e a
   * reconstruída aparece ao lado.
   */
  it('acompanha o estado vazio em vez de substituí-lo', async () => {
    serve({ series: [], historyStartedAt: null, truncated: false })
    renderPage()

    await serie()

    // O aviso de `H-21` continua, sob rótulo próprio: acompanhado da série, o
    // nome "Evolução mensal" pertence ao gráfico, e duas landmarks homônimas
    // deixariam o leitor de tela sem como distingui-las.
    const vazio = screen.getByRole('region', { name: 'Histórico observado' })
    expect(within(vazio).getByText('Ainda não há histórico registrado.')).toBeTruthy()
    expect(within(vazio).getByText(/Não há retroatividade/)).toBeTruthy()

    // E a reconstruída, apesar disso, está na tela.
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('dez/2025')).toBeTruthy()
  })

  // A janela recorta a observada; sem observada não há o que recortar, mesmo
  // com a reconstruída à vista.
  it('não oferece a janela quando só há série reconstruída', async () => {
    serve({ series: [], historyStartedAt: null, truncated: false })
    renderPage()
    await screen.findByRole('region', { name: 'Evolução mensal' })

    expect(screen.queryByRole('button', { name: '60 meses' })).toBeNull()
  })

  /**
   * Divergirem no mesmo mês é informação sobre a planilha, não erro: escolher
   * uma esconderia o que `docs/uso/RESULTADO.md` §6 documenta.
   */
  it('mostra as duas quando divergem no mesmo mês', async () => {
    serve({
      series: [{ month: '2026-08', total: 650, desembaracados: 480, canalVermelho: 5 }],
      reconstructed: {
        points: [{ month: '2026-08', chegados: 585, desembaracados: 483, forecast: false }],
        missingEta2: 64,
        missingRegistration: 166,
      },
    })
    renderPage()

    expect(await linhas()).toEqual([['ago/2026', '650', '480', '5', '585', '483']])
  })
})
