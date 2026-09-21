import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MonthlyHistoryResponse } from '../src/api-client.ts'
import { History } from '../src/pages/History.tsx'
import { type ApiStub, monthlyHistoryFixture, stubApi } from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

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
  mountLiveRegions()
  window.history.replaceState(null, '', '/historico')
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function serve(overrides: Partial<MonthlyHistoryResponse> = {}): void {
  api.serveHistory(monthlyHistoryFixture(overrides))
}

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

describe('a requisição da série', () => {
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

/**
 * `D-58`. A série observada saiu da tela, e o que A-43 protege mudou de forma.
 *
 * O que estes testes protegem é o que sobrou da regra: série sem ponto nenhum é
 * ausência de DATA, nunca zero processo, e a tela precisa dizer isso em palavras
 * em vez de desenhar um gráfico chapado no eixo.
 */
describe('o que a série não cobre (A-43)', () => {
  it('diz que não há data em vez de desenhar série zerada', async () => {
    serve({
      registrations: { points: [], missingRegistration: 0 },
      reconstructed: { points: [], missingEta2: 0, missingRegistration: 0 },
    })
    renderPage()

    const vazio = await serie()
    expect(within(vazio).getByText('Nenhum processo tem data para montar a série.')).toBeTruthy()
    expect(within(vazio).queryByRole('table')).toBe(null)
  })

  // A serie OBSERVADA nao e mais desenhada, e nenhuma das notas que falavam dela
  // sobrevive: elas descreviam o que a tela deixou de mostrar.
  it('não fala mais do histórico observado', async () => {
    serve()
    renderPage()
    await serie()

    expect(screen.queryByText(/Volume conta os processos que a aplicação já observou/)).toBe(null)
    expect(screen.queryByText(/O histórico começou em/)).toBe(null)
  })

  it('não oferece seletor de janela, que recortava só a observada', async () => {
    serve()
    renderPage()
    await serie()

    expect(screen.queryByRole('button', { name: /meses/ })).toBe(null)
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

    const aviso = await findLiveRegion('status', /Nenhuma leitura/)
    expect(aviso.textContent).toMatch(/Nenhuma leitura da planilha foi concluída ainda/)
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('exibe a falha como alerta, nunca como serie vazia', async () => {
    api.failHistory()
    renderPage()

    const erro = await findLiveRegion('alert')
    expect(erro.textContent).toMatch(/Não foi possível carregar o histórico/)
    expect(screen.queryByRole('table')).toBe(null)
  })
})

/**
 * `D-58`. A serie do acumulado, agora sozinha na tela.
 *
 * O que se verifica: que ela aparece com as duas medidas nomeadas sem adjetivo,
 * que o rotulo do mes leva quatro digitos de ano, e que quem ficou fora de cada
 * medida esta contado — data ausente nao pertence a mes nenhum, e sumir sem
 * contagem seria descarte silencioso.
 */
describe('a série do acumulado', () => {
  it('exibe as duas medidas na tabela, sem adjetivo de origem', async () => {
    serve({
      reconstructed: {
        points: [
          { month: '2026-07', chegados: 600, desembaracados: 470, forecast: false },
          { month: '2026-08', chegados: 631, desembaracados: 483, forecast: false },
        ],
        missingEta2: 0,
        missingRegistration: 0,
      },
    })
    renderPage()

    const secao = await serie()
    const cabecalhos = within(secao)
      .getAllByRole('columnheader')
      .map((th) => th.textContent ?? '')

    expect(cabecalhos).toEqual(['mês', 'Volume', 'Desembaraçados'])
    expect(await linhas()).toEqual([
      ['jul/2026', '600', '470'],
      ['ago/2026', '631', '483'],
    ])
  })

  // O defeito que o operador relatou: `ago/26` foi lido como dia 26 de agosto.
  it('escreve o ano com quatro dígitos no rótulo do mês', async () => {
    serve({
      reconstructed: {
        points: [{ month: '2026-08', chegados: 1, desembaracados: 0, forecast: false }],
        missingEta2: 0,
        missingRegistration: 0,
      },
    })
    renderPage()

    const secao = await serie()

    expect(within(secao).getByText('ago/2026')).toBeTruthy()
    expect(within(secao).queryByText('ago/26')).toBeNull()
  })

  // Regra inviolável 2: quem ficou fora da reconstrução está contado na tela.
  it('diz quantos processos ficaram fora de cada medida', async () => {
    serve()
    renderPage()
    await serie()

    const nota = screen.getByText(/data de chegada \(ETA2\)/)

    expect(nota.textContent).toContain('64')
    expect(nota.textContent).toContain('166')
  })

  // O caso-limite do backlog: 18 processos com ETA2 em set/2026. O trecho
  // futuro é marcado como previsão, e não omitido.
  it('marca o trecho futuro como previsão, com o mês em que ele começa', async () => {
    serve()
    renderPage()
    await serie()

    const nota = screen.getByText(/data de chegada \(ETA2\)/)

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

    expect(screen.getByText(/data de chegada \(ETA2\)/).textContent).not.toContain('previsão')
  })
})

/**
 * `H-44` tirou o gráfico do caminho de tabulação; **`H-74` o devolveu com
 * nome** (`ACHADO 11`).
 *
 * O defeito que `ACHADO 12` mediu era a **orfandade**, não a parada: o
 * `RootSurface` do Recharts dá `tabIndex={0}` e `role="application"` ao `<svg>`,
 * e dentro de `aria-hidden="true"` isso vira um foco que a árvore de
 * acessibilidade não expõe — sem nome nenhum a anunciar. Com o `aria-hidden`
 * fora e um `aria-label` no gráfico, a parada deixa de ser órfã.
 *
 * A tabela irmã nunca esteve em jogo: ela continua carregando os mesmos
 * números, e é a alternativa textual.
 */
describe('acessibilidade do gráfico e da janela', () => {
  /**
   * **O `<svg>` do Recharts não existe em jsdom**: `ResponsiveContainer` mede o
   * pai, e aqui todo retângulo é zero. O que se afirma aqui é o invólucro; a
   * parada em si foi medida em Chrome 151, em `H-74` — `/historico` vai de 26
   * para 27 paradas, **zero órfãs e zero sem nome**, com o `<svg>` respondendo
   * `role="application"` e "Gráfico da evolução mensal".
   */
  it('não envolve o gráfico em subárvore aria-hidden', async () => {
    serve()
    renderPage()
    const secao = await serie()

    // Escopado na seção: `D-57` igualou os dois gráficos em `h-64`, e no
    // documento inteiro o seletor pegaria o painel de registros.
    const invólucro = secao.querySelector('.h-64')

    expect(invólucro).toBeTruthy()
    expect(invólucro?.closest('[aria-hidden="true"]')).toBeNull()
  })

  /**
   * `ACHADO 13`. Sob `forced-colors: active` o agente de usuário substitui a
   * **cor** da borda, e não a espessura. Sem o canal não-cromático, o disclosure
   * aberto ficaria indistinguível do fechado.
   */
  it('marca o "Ver os números" aberto pela cor e pela espessura da borda', async () => {
    serve()
    renderPage()
    const secao = await serie()

    const gatilho = within(secao).getByText('Ver os números')

    expect(gatilho.className).toContain('group-open:border-action-bg')
    expect(gatilho.className).toContain('group-open:forced-colors:border-2')
  })

  it('mantém a tabela irmã com os mesmos números', async () => {
    serve({
      reconstructed: {
        points: [{ month: '2026-08', chegados: 649, desembaracados: 480, forecast: false }],
        missingEta2: 0,
        missingRegistration: 0,
      },
    })
    renderPage()

    const secao = await serie()

    expect(secao.querySelector('.h-64')?.closest('[aria-hidden="true"]')).toBeNull()
    expect(await linhas()).toEqual([['ago/2026', '649', '480']])
  })
})

/**
 * `D-56`. O painel de registros do mês, que conta a coluna RG **sem acumular**.
 *
 * O que esta suíte protege é a distinção que o operador nomeou: a barra é o que
 * o mês trouxe, e não o estoque até ele — trocar uma pela outra devolve números
 * plausíveis e responde a outra pergunta.
 */
describe('os registros do mês (D-56)', () => {
  const REGISTROS = {
    points: [
      { month: '2026-06', registered: 83, cleared: 83 },
      { month: '2026-07', registered: 75, cleared: 74 },
      { month: '2026-08', registered: 0, cleared: 0 },
    ],
    missingRegistration: 167,
  }

  function painel(): Promise<HTMLElement> {
    return screen.findByRole('region', { name: 'Registros por mês' })
  }

  async function contagens(): Promise<string[][]> {
    const secao = await painel()
    return within(secao)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent ?? ''),
      )
  }

  function marcar(secao: HTMLElement): void {
    fireEvent.click(within(secao).getByRole('checkbox', { name: /Desembaraçado/ }))
  }

  it('exibe a contagem de cada mês', async () => {
    serve({ registrations: REGISTROS })
    renderPage()

    expect(await contagens()).toEqual([
      ['jun/2026', '83'],
      ['jul/2026', '75'],
      ['ago/2026', '0'],
    ])
  })

  // Mês medido sem registro é zero, e não ausência: a linha existe na tabela.
  it('mostra zero no mês sem registro, em vez de omitir a linha', async () => {
    serve({ registrations: REGISTROS })
    renderPage()
    const secao = await painel()

    expect(within(secao).getByText('ago/2026')).toBeTruthy()
  })

  it('o checkbox troca a medida para a categoria Desembaraçado', async () => {
    serve({ registrations: REGISTROS })
    renderPage()
    const secao = await painel()

    expect(within(secao).getByText('158 registros')).toBeTruthy()

    marcar(secao)

    expect(await contagens()).toEqual([
      ['jun/2026', '83'],
      ['jul/2026', '74'],
      ['ago/2026', '0'],
    ])
    expect(within(secao).getByText('157 desembaraçados')).toBeTruthy()
  })

  // Regra inviolável 2: quem não tem RG não entra em mês nenhum, e some sem
  // contagem se a tela não disser quantos são.
  it('diz quantos processos ficam fora por não terem RG', async () => {
    serve({ registrations: REGISTROS })
    renderPage()
    const secao = await painel()

    expect(within(secao).getByText(/não têm data de registro/).textContent).toContain('167')
  })

  // Regra inviolável 3: sem RG nenhum não há série, e não uma série de zeros que
  // pareceria medida.
  it('não desenha o painel quando nenhum processo tem RG', async () => {
    serve({ registrations: { points: [], missingRegistration: 12 } })
    renderPage()
    await serie()

    expect(screen.queryByRole('region', { name: 'Registros por mês' })).toBeNull()
  })
})
