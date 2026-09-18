import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '../src/pages/Home.tsx'
import { type ApiStub, healthFixture, indicatorsFixture, stubApi } from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * A Pagina Inicial (RF-09). Treze cartoes desde `H-52`, na ordem fixada pelo
 * backlog, e nenhum numero calculado aqui — todos vem de `GET /api/indicators`,
 * ja recortado no servidor.
 *
 * Os valores das fixtures sao os medidos na planilha real em 07/08/2026.
 */

let api: ApiStub

/**
 * A ordem e criterio de aceite, e `D-49` a refez: treze cartoes viraram nove.
 * Sairam os de IND-08, IND-14 e IND-16 e o de periodo por registro; "Em
 * andamento" e "Fechado — aguardando draft" trocaram de rotulo.
 */
const ORDEM_ESPERADA = [
  'Total',
  'Desembaraçados',
  'Processos ativos',
  'Em desembaraço',
  'Aguardando draft',
  'Canal Vermelho',
  'Chegando hoje',
  'Chegando em 15 dias',
  'Atrasados',
]

beforeEach(() => {
  mountLiveRegions()
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  vi.unstubAllGlobals()
})

function renderHome(queryString = '') {
  return render(<Home health={healthFixture()} queryString={queryString} dataVersion={0} />)
}

function cardsInOrder(): string[] {
  const section = screen.getByRole('region', { name: 'Cartões-resumo' })
  return (
    within(section)
      // `H-74`, `ACHADO 1`: nivel 2, e nao 3. A secao dos cartoes nao tem titulo
      // proprio, entao o `h1` da `TopBar` desceria direto para `h3`.
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '')
  )
}

describe('os nove cartoes', () => {
  it('exibe os nove, na ordem fixada', async () => {
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    expect(cardsInOrder()).toEqual(ORDEM_ESPERADA)
  })

  /** Restrito a secao: `649` tambem aparece em "Linhas lidas" e "Aceitas" do
   * painel de saude, e sao numeros diferentes que coincidem. */
  it('mostra os valores que a rota devolveu, cada um no seu cartao', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    const section = screen.getByRole('region', { name: 'Cartões-resumo' })

    const porRotulo = new Map(
      Array.from(section.querySelectorAll('article')).map((card) => [
        card.querySelector('h2')?.textContent,
        card.querySelector('p')?.textContent,
      ]),
    )

    expect(porRotulo.get('Total')).toBe('649')
    expect(porRotulo.get('Desembaraçados')).toBe('480')
    expect(porRotulo.get('Processos ativos')).toBe('103')
    expect(porRotulo.get('Em desembaraço')).toBe('32')
    expect(porRotulo.get('Aguardando draft')).toBe('34')
    expect(porRotulo.get('Atrasados')).toBe('17')
    // Zero MEDIDO, e nao ausencia: a unica linha branca nao chega hoje (`D-49`).
    expect(porRotulo.get('Chegando hoje')).toBe('0')
  })

  it('separa visualmente a urgencia dos cartoes de volume (A-40)', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    const urgentes = section.querySelectorAll('[data-variant="urgencia"]')
    const volumes = section.querySelectorAll('[data-variant="volume"]')

    // Um so desde `D-49`: "Documentos pendentes" saiu da tela.
    expect(urgentes).toHaveLength(1)
    expect(volumes).toHaveLength(8)
    expect(Array.from(urgentes).map((card) => card.querySelector('h2')?.textContent)).toEqual([
      'Atrasados',
    ])
  })

  it('conjunto vazio exibe nove zeros, sem erro', async () => {
    api.serveIndicators(
      indicatorsFixture(
        {
          total: 0,
          emAndamento: 0,
          emDesembaraco: 0,
          desembaracados: 0,
          fechadoAguardandoDraft: 0,
          canalVermelho: 0,
          chegandoHoje: 0,
          chegando15Dias: 0,
          atrasados: 0,
        },
        {},
        {},
        { sum: 0, total: 0, matches: true },
      ),
    )
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    expect(within(section).getAllByText('0')).toHaveLength(9)
    // `H-43`: as regiões vivas existem sempre; o que não pode haver é texto de
    // erro dentro delas.
    for (const regiao of screen.queryAllByRole('alert')) expect(regiao.textContent).toBe('')
  })
})

describe('a conferencia de A-12', () => {
  // `D-49`: silencio quando confere. A linha ocupava espaco para dizer todo dia
  // a mesma coisa, e os cartoes deixaram de ser as quatro categorias.
  it('nao exibe nada enquanto as categorias somam o total', async () => {
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    expect(screen.queryByText(/Soma das 4 categorias/)).toBeNull()
  })

  it('denuncia quando a soma NAO fecha — o defeito seria do servidor', async () => {
    api.serveIndicators(indicatorsFixture({}, {}, {}, { sum: 646, total: 649, matches: false }))
    renderHome()

    // `H-43` pôs regiões vivas VAZIAS em cena desde a montagem, então esperar
    // por "existe algum alert" resolve cedo demais: o que se espera é a região
    // que carrega a mensagem.
    const regiao = await findLiveRegion('alert')

    expect(regiao.textContent).toMatch(/NÃO conferem/)
    expect(regiao.textContent).toMatch(/646/)
    // O bloco visível NÃO carrega `role`: ganhá-lo na quebra criaria uma região
    // já populada — `ACHADO 11` por outro caminho.
    const visivel = screen
      .getAllByText(/NÃO conferem/)
      .find((no) => no.closest(`#${'regiao-viva-da-pagina'}`) === null)
    expect(visivel).toBeTruthy()
    expect(visivel?.closest('[role="alert"]')).toBeNull()
  })

  // A conferencia vem PRONTA do servidor: a tela nao soma cartao nenhum.
  it('nao deriva a soma dos cartoes exibidos', async () => {
    api.serveIndicators(
      indicatorsFixture({ emDesembaraco: 167 }, {}, {}, { sum: 649, total: 649, matches: true }),
    )
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    expect(screen.queryByText(/NÃO conferem/)).toBeNull()
  })
})

describe('estados que nao sao zero', () => {
  it('sem leitura concluida, os cartoes ficam em carregamento — nunca em zero', async () => {
    api.indicatorsWithoutRead()
    renderHome()

    expect((await findLiveRegion('status')).textContent).not.toBe('')
    expect(screen.getByText(/os traços não significam zero/)).toBeTruthy()

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    expect(within(section).getAllByText('—')).toHaveLength(9)
    expect(within(section).queryByText('0')).toBeNull()
  })

  it('falha da rota vira aviso, nao painel de zeros', async () => {
    api.failIndicators()
    renderHome()

    expect((await findLiveRegion('alert')).textContent).toMatch(
      /Não foi possível carregar os indicadores/,
    )
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

/**
 * `H-51`. O painel nao calcula: contagens e fracoes vem prontas da rota. O que
 * se verifica e que o denominador aparece ao lado da fracao, e que as linhas sem
 * canal conhecido ficam fora dela — contadas.
 */
describe('a distribuicao por canal', () => {
  function painel(): HTMLElement {
    return screen.getByRole('region', { name: 'Distribuição por canal' })
  }

  it('exibe contagem, percentual e o denominador ao lado', async () => {
    renderHome()

    await waitFor(() => expect(painel()).toBeTruthy())
    const texto = painel().textContent ?? ''

    // 477 de 482, medido na planilha real em 31/08/2026 — 98,96%, exibido com
    // uma casa no maximo.
    expect(texto).toContain('477')
    expect(texto).toContain('99% de 482')
    expect(texto).toContain('1% de 482')
  })

  // A-42: o denominador nao sai do lado da fracao, e as 167 aparecem contadas
  // FORA dela — dilui-las afirmaria que o canal delas e conhecido.
  it('conta as linhas sem canal conhecido fora do percentual', async () => {
    renderHome()

    await waitFor(() => expect(painel()).toBeTruthy())
    const texto = painel().textContent ?? ''

    expect(texto).toContain('167')
    expect(texto).toMatch(/Sem canal conhecido/i)
  })

  // O caso-limite do backlog: sem denominador, o painel mostra as contagens e
  // omite o percentual. `0%` afirmaria que nenhum processo e verde.
  it('omite o percentual quando nenhum processo tem canal conhecido', async () => {
    api.serveIndicators(
      indicatorsFixture(
        {},
        { verde: 0, vermelho: 0, indefinido: 12, known: 0, verdeShare: null, vermelhoShare: null },
      ),
    )
    renderHome()

    await waitFor(() => expect(painel()).toBeTruthy())
    const texto = painel().textContent ?? ''

    expect(texto).not.toContain('%')
    expect(texto).toContain('12')
  })

  // IND-06 continua no seu cartao, com o mesmo valor: a distribuicao acompanha
  // o indicador, nao o substitui.
  it('nao remove o cartao Canal Vermelho', async () => {
    renderHome()

    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))
    expect(cardsInOrder()).toContain('Canal Vermelho')
  })
})

/**
 * `H-52`. A janela em cada cartao e o atalho que a edita.
 *
 * Nada e calculado aqui: a faixa e a janela vem de `GET /api/indicators`, e a
 * pagina so formata. O que se verifica e que ela diz **qual** data cada cartao
 * conta, e que o atalho escreve nos mesmos parametros da barra de filtros.
 */
/**
 * `D-49` tirou tudo o que ficava abaixo do contador.
 *
 * O bloco anterior media a janela que cada cartao declarava desde `H-52`; a
 * ordem do usuario foi despoluir a tela, e o que sobrou de verificavel e a
 * AUSENCIA — sem ela, a linha voltaria sem ninguem notar.
 */
describe('o cartao nao exibe nada abaixo do numero', () => {
  function cardByLabel(label: string): HTMLElement {
    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    const card = Array.from(section.querySelectorAll('article')).find(
      (article) => article.querySelector('h2')?.textContent === label,
    )
    if (!card) throw new Error(`cartão ausente: ${label}`)
    return card as HTMLElement
  }

  it('nenhum cartao declara janela, nem com filtro de periodo ativo', async () => {
    api.serveIndicators(
      indicatorsFixture({}, {}, { period: { from: '2026-02-01', to: '2026-02-28' } }),
    )
    renderHome('?etaFrom=2026-02-01&etaTo=2026-02-28')
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    expect(section.querySelectorAll('[data-period]')).toHaveLength(0)
  })

  // Rotulo e numero: dois `<p>` por cartao seria a janela ou o `hint` de volta.
  it('cada cartao tem um titulo e um unico paragrafo', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    for (const card of Array.from(section.querySelectorAll('article'))) {
      expect(card.querySelectorAll('p')).toHaveLength(1)
    }
  })

  it('recorte sem nenhum processo exibe zero, e so', async () => {
    api.serveIndicators(
      indicatorsFixture(
        { total: 0 },
        {},
        { period: { from: '2026-02-01', to: '2026-02-28' } },
        { sum: 0, total: 0, matches: true },
      ),
    )
    renderHome('?etaFrom=2026-02-01&etaTo=2026-02-28')
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const cartao = cardByLabel('Total')

    expect(cartao.querySelector('p')?.textContent).toBe('0')
    expect(cartao.querySelectorAll('p')).toHaveLength(1)
  })
})

describe('o atalho de periodo', () => {
  it('escreve nos mesmos parametros da barra de filtros', async () => {
    window.history.replaceState(null, '', '/')
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const painel = screen.getByRole('region', { name: 'Período' })
    // `dd/mm/aaaa` na tela, `AAAA-MM-DD` na URL: a traducao vive no `DateField`.
    const de = within(painel).getByLabelText('Período (ETA2) — de')
    fireEvent.change(de, { target: { value: '01/02/2026' } })

    expect(window.location.search).toContain('etaFrom=2026-02-01')
    window.history.replaceState(null, '', '/')
  })

  // Um estado so: o botao de limpar apaga os dois parametros, e nao guarda
  // periodo proprio que divergiria da barra.
  it('o botao de todo o período apaga os dois extremos', async () => {
    window.history.replaceState(null, '', '/?etaFrom=2026-02-01&etaTo=2026-02-28')
    renderHome('?etaFrom=2026-02-01&etaTo=2026-02-28')
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    fireEvent.click(screen.getByRole('button', { name: 'Todo o período' }))

    expect(window.location.search).not.toContain('etaFrom')
    expect(window.location.search).not.toContain('etaTo')
    window.history.replaceState(null, '', '/')
  })
})

/**
 * `H-44`. As páginas anunciam pela região que `H-43` deixou na casca.
 *
 * Uma região declarada DENTRO da página não resolveria: ela nasceria junto com
 * o `return` antecipado, no mesmo commit em que o texto chega — que é o próprio
 * `ACHADO 11`.
 */
describe('a página anuncia pela região da casca', () => {
  it('o bloco visível do erro não carrega role, e é aria-hidden', async () => {
    api.failIndicators()
    renderHome()

    await findLiveRegion('alert')
    const visivel = screen
      .getAllByText(/Não foi possível carregar os indicadores/)
      .find((no) => no.closest('#regiao-viva-da-pagina') === null)

    expect(visivel?.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(visivel?.closest('[role="alert"]')).toBeNull()
  })

  // "Ainda não foi lida" é contexto, não urgência: anunciá-lo como `alert`
  // cortaria o que o leitor de tela estivesse falando.
  it('usa status, e não alert, para a ausência de leitura', async () => {
    api.indicatorsWithoutRead()
    renderHome()

    const regiao = await findLiveRegion('status')

    expect(regiao.textContent).toMatch(/Nenhuma leitura da planilha foi concluída ainda/)
    expect(document.getElementById('regiao-viva-da-pagina')?.textContent).toBe('')
  })
})

/**
 * `H-45`, `ACHADO 18` e `SC 1.4.1`. A distinção entre volume e urgência deixa de
 * ser transmitida **apenas** por cor.
 */
/**
 * `D-49` tirou o "Pede ação", e este bloco registra a consequência em vez de
 * apagá-la.
 *
 * Ele nasceu em `H-45` fechando `ACHADO 18` (`SC 1.4.1`): a variante de
 * urgência precisava de uma distinção que não fosse cromática. O usuário
 * mandou remover tudo o que ficava abaixo do contador, e com isso a distinção
 * voltou a ser só o par de cores — medido aqui, não presumido.
 */
describe('a urgência do cartão, depois de `D-49`', () => {
  it('o cartão de urgência não traz mais a distinção em texto', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    const urgentes = Array.from(section.querySelectorAll('[data-variant="urgencia"]'))

    expect(urgentes).toHaveLength(1)
    for (const cartao of urgentes) expect(cartao.textContent).not.toContain('Pede ação')
  })

  // O que sobrou: a variante continua marcada no DOM, e é por ela que o estilo
  // distingue os dois grupos.
  it('a variante continua declarada em `data-variant`', async () => {
    renderHome()
    await waitFor(() => expect(cardsInOrder()).toHaveLength(9))

    const section = screen.getByRole('region', { name: 'Cartões-resumo' })
    const urgente = section.querySelector('[data-variant="urgencia"]')

    expect(urgente?.querySelector('h2')?.textContent).toBe('Atrasados')
  })
})

/**
 * O calendario de chegadas, vindo da Pagina Operacional em `H-98`.
 *
 * **Os tres testes sao os mesmos, e a mudanca e so de casa** — o componente nao
 * foi tocado. Ele esta aqui porque `IND-12` precisa de UMA tela: removido sem
 * realocar, ele ficaria calculado, servido e invisivel, que e o defeito que
 * `A-65` varreu em `IND-13`, `IND-17` e `IND-20`.
 */
describe('calendario de chegadas', () => {
  it('agrupa por dia e por navio, com o total do dia vindo do servidor', async () => {
    api.serveIndicators({
      ...indicatorsFixture(),
      arrivalCalendar: [
        {
          eta2: '2026-08-13',
          processCount: 7,
          vessels: [
            {
              vesselKey: 'CMA CGM COBALT',
              vesselLabel: 'CMA CGM COBALT',
              eta2: '2026-08-13',
              processCount: 2,
            },
            {
              vesselKey: 'EVER LEADER',
              vesselLabel: 'EVER LEADER',
              eta2: '2026-08-13',
              processCount: 4,
            },
            {
              vesselKey: 'EVER UTILE',
              vesselLabel: 'EVER UTILE',
              eta2: '2026-08-13',
              processCount: 1,
            },
          ],
        },
      ],
    })
    renderHome()

    const calendario = await screen.findByRole('region', { name: 'Calendário de chegadas' })
    expect(within(calendario).getByText('13/08/2026')).toBeTruthy()
    // A contagem ganhou `<span>` próprio para o mono (`H-61`).
    expect(calendario.textContent).toContain('7 processos')
    expect(within(calendario).getByText('EVER LEADER')).toBeTruthy()
  })

  it('sem chegada prevista, explica em vez de mostrar caixa vazia', async () => {
    renderHome()

    const calendario = await screen.findByRole('region', { name: 'Calendário de chegadas' })
    expect(within(calendario).getByText(/Nenhuma chegada prevista/)).toBeTruthy()
  })

  /** Ele segue os filtros globais, como antes: o que mudou foi a pagina que o
      hospeda, e nao de onde ele tira o recorte. */
  it('recebe os filtros globais', async () => {
    renderHome('?client=ACME')

    await waitFor(() => expect(api.calls).toContain('GET /api/indicators?client=ACME'))
  })
})
