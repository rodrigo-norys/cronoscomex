import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertsResponse } from '../src/api-client.ts'
import { severityBand } from '../src/components/SeverityMark.tsx'
import { Alerts } from '../src/pages/Alerts.tsx'
import { type ApiStub, alertsFixture, stubApi } from './support/api-stub.ts'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * A Página Alertas (RF-13) é fila de trabalho, não panorama (A-59).
 *
 * Nada é ordenado nem contado aqui: a severidade (A-41) e as contagens vêm
 * prontas. O agrupamento por processo é apresentação (A-60), e herda a ordem
 * recebida.
 */

let api: ApiStub

beforeEach(() => {
  mountLiveRegions()
  window.history.replaceState(null, '', '/alertas')
  api = stubApi()
})

afterEach(() => {
  unmountLiveRegions()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

type Alert = AlertsResponse['items'][number]

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    type: 'eta_vencida',
    severity: 1,
    ref: 'FT501.26',
    sourceRow: 502,
    eta2: '2026-07-20',
    daysOverdue: 18,
    message: 'ETA2 vencida ha 18 dias',
    ...overrides,
  }
}

function serve(overrides: Partial<AlertsResponse> = {}): void {
  api.serveAlerts(alertsFixture(overrides))
}

function renderPage(queryString = '') {
  return render(<Alerts queryString={queryString} dataVersion={0} />)
}

function fila(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Fila de alertas' })
}

describe('agrupamento por processo (A-60)', () => {
  /**
   * O critério de aceite venceu o caso-limite do backlog, que dizia o oposto —
   * texto anterior à decisão de 06/08/2026. Medido na planilha real: 40 linhas
   * achatadas para 25 processos, e 13 deles apareceriam repetidos.
   */
  it('exibe o processo uma unica vez, com os tres tipos', async () => {
    serve({
      items: [
        alert({ type: 'eta_vencida', severity: 1 }),
        alert({
          type: 'canal_vermelho',
          severity: 2,
          daysOverdue: null,
          message: 'Canal Vermelho',
        }),
        alert({
          type: 'documentacao_pendente',
          severity: 3,
          daysOverdue: null,
          message: 'Sem documentacao',
        }),
      ],
    })
    renderPage()

    expect(await within(await fila()).findAllByRole('listitem')).toHaveLength(1)
    const linha = within(await fila()).getByRole('listitem')
    expect(within(linha).getByText('ETA vencida')).toBeTruthy()
    expect(within(linha).getByText('Canal Vermelho')).toBeTruthy()
    expect(within(linha).getByText('Documentação pendente')).toBeTruthy()
  })

  /**
   * A posição do grupo é a da primeira aparição, e o primeiro alerta de um
   * processo é o mais severo dele — então a ordenação do servidor é herdada
   * inteira, sem reordenar no cliente (regra inviolável 6).
   */
  it('preserva a ordem recebida, pela primeira aparicao', async () => {
    serve({
      items: [
        alert({ ref: 'A-1', sourceRow: 10, type: 'eta_vencida', severity: 1 }),
        alert({ ref: 'B-2', sourceRow: 20, type: 'canal_vermelho', severity: 2 }),
        alert({ ref: 'A-1', sourceRow: 10, type: 'chegadas_7_dias', severity: 6 }),
        alert({ ref: 'C-3', sourceRow: 30, type: 'chegadas_7_dias', severity: 6 }),
      ],
    })
    renderPage()

    const linhas = await within(await fila()).findAllByRole('listitem')

    expect(linhas).toHaveLength(3)
    expect(
      // `H-45` trocou o `<button>` por `<a href>`: abrir o detalhe é a MESMA
      // ação que a tabela oferece, e tinha dois papéis (`SC 3.2.4`).
      linhas.map((linha) => within(linha).getByRole('link').textContent?.slice(0, 3)),
    ).toEqual(['A-1', 'B-2', 'C-3'])
  })

  it('conta processos, nao linhas, no cabecalho da fila', async () => {
    serve({
      items: [
        alert({ ref: 'A-1', type: 'eta_vencida', severity: 1 }),
        alert({ ref: 'A-1', type: 'chegadas_7_dias', severity: 6 }),
      ],
    })
    renderPage()

    expect(await screen.findByText('1 processo pede ação')).toBeTruthy()
  })

  // Nulos por ultimo vem do servidor; a pagina so nao pode desfazer isso.
  it('exibe traco no ETA2 nulo, mantendo a posicao recebida', async () => {
    serve({
      items: [
        alert({ ref: 'COM-ETA', type: 'chegadas_7_dias', severity: 6, eta2: '2026-08-10' }),
        alert({
          ref: 'SEM-ETA',
          type: 'documentacao_pendente',
          severity: 6,
          eta2: null,
          daysOverdue: null,
        }),
      ],
    })
    renderPage()

    const linhas = await within(await fila()).findAllByRole('listitem')

    expect(within(linhas[0] as HTMLElement).getByText(/10\/08\/2026/)).toBeTruthy()
    // Pelo conteúdo da linha, e não pelo nó: `H-61` pôs a data num `<span>`
    // próprio para aplicar mono, então o texto vive em dois elementos.
    expect((linhas[1] as HTMLElement).textContent).toContain('ETA2 —')
  })
})

describe('cabecalho de contagens', () => {
  it('exibe os seis tipos, inclusive os zerados', async () => {
    serve()
    renderPage()

    const cabecalho = await screen.findByRole('region', { name: 'Alertas por tipo' })

    expect(within(cabecalho).getAllByRole('article')).toHaveLength(6)
    expect(within(cabecalho).getByText('17')).toBeTruthy()
    expect(within(cabecalho).getByText('14')).toBeTruthy()
    expect(within(cabecalho).getByText('7')).toBeTruthy()
  })

  /**
   * Os dois zeros significam coisas opostas: `chegadas_hoje` é zero **medido**,
   * `processos_parados` é zero **não mensurável** enquanto o histórico for mais
   * novo que o limiar. Exibi-los igual é o que a regra 3 proíbe.
   */
  it('distingue o zero medido do zero nao mensuravel', async () => {
    serve({ stalledMeasurable: false })
    renderPage()

    const cabecalho = await screen.findByRole('region', { name: 'Alertas por tipo' })
    const chegadasHoje = within(cabecalho).getByRole('article', { name: /Chegada hoje/ })
    const parados = within(cabecalho).getByRole('article', { name: /Processo parado/ })

    expect(within(chegadasHoje).getByText('0')).toBeTruthy()
    expect(within(parados).getByText('—')).toBeTruthy()
    expect(within(parados).queryByText('0')).toBeNull()
  })

  // O traço deixa de ser permanente em `H-29`: assim que o histórico cobre o
  // limiar, o zero passa a ser medido como os outros cinco.
  it('exibe a contagem de parados quando o historico ja cobre o limiar', async () => {
    serve({
      stalledMeasurable: true,
      stalledCoverageDays: 30,
      countsByType: { ...alertsFixture().countsByType, processos_parados: 4 },
    })
    renderPage()

    const cabecalho = await screen.findByRole('region', { name: 'Alertas por tipo' })
    const parados = within(cabecalho).getByRole('article', { name: /Processo parado/ })

    expect(within(parados).getByText('4')).toBeTruthy()
    expect(within(parados).queryByText('—')).toBeNull()
  })

  it('exibe zero medido em parados quando o historico cobre e nada esta parado', async () => {
    serve({ stalledMeasurable: true, stalledCoverageDays: 30 })
    renderPage()

    const cabecalho = await screen.findByRole('region', { name: 'Alertas por tipo' })
    const parados = within(cabecalho).getByRole('article', { name: /Processo parado/ })

    expect(within(parados).getByText('0')).toBeTruthy()
    expect(within(parados).queryByText('—')).toBeNull()
  })
})

describe('ressalvas de ALE-06', () => {
  it('exibe o limiar em uso, marcado como premissa (A-32)', async () => {
    serve({ stalledThresholdDays: 15 })
    renderPage()

    const nota = await screen.findByRole('region', { name: 'Processos parados' })

    // Ancorado no paragrafo do limiar: desde `H-29` a explicacao acima tambem
    // cita o valor, e um `/15 dias/` solto casaria com os dois.
    expect(within(nota).getByText(/Limiar em uso/).textContent).toContain('15 dias')
    expect(within(nota).getByText(/premissa/)).toBeTruthy()
  })

  it('diz que o historico ainda nao comecou quando e null (A-61)', async () => {
    serve({ historyStartedAt: null, stalledCoverageDays: null, stalledMeasurable: false })
    renderPage()

    const nota = await screen.findByRole('region', { name: 'Processos parados' })

    expect(within(nota).getByText(/histórico ainda não começou/)).toBeTruthy()
    expect(within(nota).getByText(/nenhuma leitura foi registrada ainda/)).toBeTruthy()
    expect(within(nota).getByText(/não haverá retroatividade/)).toBeTruthy()
  })

  /**
   * O critério de aceite de `H-29`: com 3 dias de histórico e limiar de 15, o
   * zero é inevitável, e dizer só "não é medido" deixaria o operador sem saber
   * quando passará a ser. A tela nomeia os dois números (A-43).
   */
  it('explica que o historico e novo demais para o limiar', async () => {
    serve({ stalledCoverageDays: 3, stalledThresholdDays: 15, stalledMeasurable: false })
    renderPage()

    const nota = await screen.findByRole('region', { name: 'Processos parados' })

    expect(within(nota).getByText(/O histórico tem 3 dias e o limiar é de 15 dias/)).toBeTruthy()
    expect(within(nota).getByText(/não que nenhum processo esteja parado/)).toBeTruthy()
  })

  it('afirma que parados esta medido quando o historico cobre o limiar', async () => {
    serve({ stalledCoverageDays: 20, stalledThresholdDays: 15, stalledMeasurable: true })
    renderPage()

    const nota = await screen.findByRole('region', { name: 'Processos parados' })

    expect(within(nota).getByText(/Processos parados está medido/)).toBeTruthy()
    expect(within(nota).queryByText(/não é medido/)).toBeNull()
  })

  /**
   * A-43: exibir a data impede que o operador leia a fila como se cobrisse todo
   * o passado. O valor é **instante ISO completo**, como a rota devolve — até
   * `H-29` este teste servia data pura, e a tela renderizava
   * `01T12:00:00.000Z/08/2026` contra o servidor real.
   */
  it('formata a data de inicio a partir do instante ISO completo', async () => {
    serve({ historyStartedAt: '2026-08-01T12:00:00.000Z' })
    renderPage()

    const nota = await screen.findByRole('region', { name: 'Processos parados' })

    expect(within(nota).getByText('01/08/2026')).toBeTruthy()
    expect(within(nota).getByText(/não há retroatividade/)).toBeTruthy()
  })
})

describe('navegacao', () => {
  it('abre o detalhe do processo ao clicar', async () => {
    serve({ items: [alert({ ref: 'FT501.26' })] })
    renderPage()

    // O nome acessível é o `aria-label` explícito, e não o bloco concatenado:
    // sem ele seriam dois nomes para a mesma ação (`ACHADO 16`).
    fireEvent.click(
      await within(await fila()).findByRole('link', { name: 'Abrir o detalhe de FT501.26' }),
    )

    expect(window.location.pathname).toBe('/processo/FT501.26')
  })

  it('escapa a REF no endereco', async () => {
    serve({ items: [alert({ ref: 'FT 501/26' })] })
    renderPage()

    fireEvent.click(
      await within(await fila()).findByRole('link', { name: 'Abrir o detalhe de FT 501/26' }),
    )

    expect(window.location.pathname).toBe('/processo/FT%20501%2F26')
  })
})

describe('casos-limite', () => {
  /**
   * Ausência afirmada, não tela vazia — e a frase diz que a leitura terminou,
   * porque é isso que separa este estado de `semLeitura`.
   */
  it('afirma a ausencia de pendencias quando a fila esta vazia', async () => {
    serve({ items: [] })
    renderPage()

    expect(
      await within(await fila()).findByText(/Nenhum processo ativo com pendência/),
    ).toBeTruthy()
    expect(within(await fila()).getByText(/leitura foi concluída/)).toBeTruthy()
  })

  it('nao confunde fila vazia com ausencia de leitura', async () => {
    api.alertsWithoutRead()
    renderPage()

    expect((await findLiveRegion('status')).textContent).not.toBe('')
    expect(screen.getAllByText(/vazio aqui não significa ausência de pendências/)).toHaveLength(2)
    expect(screen.queryByRole('region', { name: 'Fila de alertas' })).toBeNull()
  })

  it('reporta falha sem apagar a pagina', async () => {
    api.failAlerts()
    renderPage()

    // `H-44`: o portal monta num efeito, então esperar a região viva primeiro é
    // o que torna a contagem determinística. O texto aparece duas vezes de
    // propósito — o bloco visível é `aria-hidden`, e a região carrega o
    // conteúdo acessível.
    expect((await findLiveRegion('alert')).textContent).toMatch(
      /Não foi possível carregar os alertas/,
    )
    expect(screen.getAllByText(/Não foi possível carregar os alertas/)).toHaveLength(2)
  })
})

describe('filtros globais', () => {
  it('anexa o recorte a propria requisicao', async () => {
    serve()
    renderPage('?category=em_andamento')

    await fila()
    expect(api.calls).toContain('GET /api/alerts?category=em_andamento')
  })
})

/**
 * `H-45`. A mesma ação com o mesmo papel e o mesmo nome nas sete telas.
 *
 * `SC 3.2.4 Consistent Identification` incide porque o roteamento tem URIs
 * distintas (determinação `Z1` do passo zero): as sete telas são um *set of web
 * pages*, e a consistência deixa de ser preferência.
 */
describe('papel e nome da ação de abrir o detalhe', () => {
  it('abrir o detalhe é um link, como na tabela — e não um botão', async () => {
    serve({ items: [alert({ ref: 'FT501.26' })] })
    renderPage()

    const acao = await within(await fila()).findByRole('link', {
      name: 'Abrir o detalhe de FT501.26',
    })

    expect(acao.getAttribute('href')).toBe('/processo/FT501.26')
    expect(within(await fila()).queryByRole('button')).toBeNull()
  })

  /**
   * Sem o `aria-label`, o nome acessível seria o bloco inteiro concatenado —
   * REF, linha, ETA2, os rótulos de tipo e a mensagem —, contra `"NBSC260"` na
   * tabela. Dois nomes para a mesma ação é o que `SC 3.2.4` proíbe.
   */
  it('tem nome acessível curto e explícito, e não o bloco concatenado', async () => {
    serve({
      items: [alert({ ref: 'FT501.26', message: 'ETA2 vencida ha 18 dias', sourceRow: 502 })],
    })
    renderPage()

    const acao = await within(await fila()).findByRole('link')

    expect(acao.getAttribute('aria-label')).toBe('Abrir o detalhe de FT501.26')
    // O conteúdo visível segue completo — o que muda é o nome, não o texto.
    expect(acao.textContent).toContain('ETA2 vencida ha 18 dias')
    expect(acao.textContent).toContain('502')
  })

  // O mesmo interceptador da tabela: modificador pressionado abre em aba nova,
  // como qualquer link.
  it('deixa o navegador cuidar do clique com modificador', async () => {
    serve({ items: [alert({ ref: 'FT501.26' })] })
    renderPage()

    const acao = await within(await fila()).findByRole('link')
    fireEvent.click(acao, { metaKey: true })

    expect(window.location.pathname).toBe('/alertas')
  })
})

/**
 * `H-45`, `ACHADO 18` e `SC 1.4.1`. Nenhuma urgência é transmitida apenas por
 * cor.
 */
describe('a urgência não é só cor', () => {
  it('o badge urgente traz prefixo textual', async () => {
    serve({ items: [alert({ type: 'eta_vencida', severity: 1, daysOverdue: null })] })
    renderPage()

    const badge = within(await fila()).getByText(/ETA vencida/)

    expect(badge.textContent).toContain('Pede ação')
  })

  // Severidade 4–6 é aviso, e não pede ação: o prefixo não aparece.
  it('o badge não urgente não traz o prefixo', async () => {
    serve({
      items: [alert({ type: 'chegadas_7_dias', severity: 6, daysOverdue: null })],
    })
    renderPage()

    const badge = within(await fila()).getByText(/Chegada em 7 dias/)

    expect(badge.textContent).not.toContain('Pede ação')
  })

  // `data-severity` não é exposto ao usuário, e por isso não conta como canal.
  it('data-severity continua presente, e não substitui o texto', async () => {
    serve({ items: [alert({ type: 'eta_vencida', severity: 1, daysOverdue: null })] })
    renderPage()

    const badge = within(await fila()).getByText(/ETA vencida/)

    expect(badge.getAttribute('data-severity')).toBe('1')
    expect(badge.textContent).toContain('Pede ação')
  })
})

/**
 * `H-61`, `D-22`. Severidade como **forma**, não só matiz.
 *
 * Canal aduaneiro e severidade são sistemas diferentes — IND-06 contra A-41 —, e
 * a **regra inviolável 4** proíbe que a cor decida qual é qual. Os dois passam a
 * se distinguir pela forma: canal é pílula preenchida com rótulo escrito;
 * severidade é faixa lateral mais ícone.
 */
describe('severidade como faixa lateral e ícone (H-61)', () => {
  it('marca a linha urgente com faixa lateral, e a não urgente sem ela', async () => {
    serve({
      items: [
        alert({ ref: 'URGENTE', severity: 1 }),
        alert({ ref: 'AVISO', sourceRow: 9, severity: 5, type: 'chegadas_7_dias' }),
      ],
    })
    renderPage()

    const linhas = await within(await fila()).findAllByRole('listitem')

    expect(linhas[0]?.getAttribute('data-urgent')).toBe('true')
    // `H-73`: a faixa vem de `severityBand('warning')`. O token anterior,
    // `state-warning-border`, media 1,60:1 contra o piso de 3:1 de `SC 1.4.11`.
    expect(linhas[0]?.className).toContain(severityBand('warning'))
    expect(linhas[0]?.className).not.toContain('border-l-state-warning-border')
    expect(linhas[1]?.getAttribute('data-urgent')).toBe('false')
    expect(linhas[1]?.className).toContain('border-l-transparent')
  })

  /**
   * `H-73`. O glifo segue o tom, e o tom do urgente e `error` — o triangulo.
   * A correcao do revisor mandava `tone="warning"` no icone tambem, e isso
   * colapsaria os dois glifos: urgente e nao urgente mostrando o mesmo circulo
   * perderia um canal em vez de ganhar consistencia.
   */
  it('mantém glifos distintos entre urgente e não urgente', async () => {
    serve({
      items: [
        alert({ ref: 'URGENTE', severity: 1 }),
        alert({ ref: 'AVISO', sourceRow: 9, severity: 5, type: 'chegadas_7_dias' }),
      ],
    })
    renderPage()

    const linhas = await within(await fila()).findAllByRole('listitem')
    const glifo = (linha: HTMLElement | undefined): string =>
      [...(linha?.querySelectorAll('svg path, svg circle') ?? [])]
        .map((no) => no.getAttribute('d') ?? `r${no.getAttribute('r')}`)
        .join(' ')

    // O triangulo do urgente, e o circulo do aviso: desenhos diferentes.
    expect(glifo(linhas[0])).toContain('M8 2.5 14.5 13.5h-13z')
    expect(glifo(linhas[1])).not.toContain('M8 2.5 14.5 13.5h-13z')
    expect(glifo(linhas[0])).not.toBe(glifo(linhas[1]))
  })

  /**
   * A espessura é o canal que sobrevive a `forced-colors: active`, onde o UA
   * substitui a cor da faixa — mesma técnica de `H-72` e `H-59`.
   *
   * **A asserção anterior provava o contrário do que o nome dela dizia**
   * (`H-65`): ela cobrava `forced-colors:border-l-4` nas DUAS severidades, e
   * classe igual nas duas é exatamente a definição de não distinguir. A base já
   * era `border-l-4`, então a variante repetia o valor e era inerte. Quem tem
   * de mudar sob o modo forçado é o ramo **não urgente** — o urgente já está no
   * máximo.
   *
   * **Isto não é reparo de perda de informação:** o prefixo "Pede ação" de
   * `H-45` é texto e sobrevive ao modo forçado em qualquer caso. É o canal
   * redundante que o comentário prometia e não entregava.
   */
  it('distingue as duas severidades sob forced-colors, e não as iguala', async () => {
    serve({
      items: [
        alert({ severity: 1 }),
        alert({ ref: 'B-2', sourceRow: 9, severity: 5, type: 'chegadas_7_dias' }),
      ],
    })
    renderPage()

    const [urgente, comum] = await within(await fila()).findAllByRole('listitem')

    expect(urgente?.getAttribute('data-urgent')).toBe('true')
    expect(urgente?.className).toContain('border-l-4')
    expect(urgente?.className).not.toContain('forced-colors:border-l-0')

    // O `pl` devolve os 4 px que a borda deixa de ocupar, como em `H-59`.
    expect(comum?.getAttribute('data-urgent')).toBe('false')
    expect(comum?.className).toContain('forced-colors:border-l-0')
    expect(comum?.className).toContain('forced-colors:pl-1')
  })

  /**
   * **O ícone se soma ao prefixo textual de `H-45`, nunca o substitui.** Trocar
   * um pelo outro devolveria `ACHADO 18`: a urgência dependendo de enxergar um
   * desenho, contra `SC 1.4.1`.
   */
  it('mantém o prefixo textual ao lado do ícone', async () => {
    serve({ items: [alert({ ref: 'URGENTE', severity: 1 })] })
    renderPage()

    const linha = (await within(await fila()).findAllByRole('listitem'))[0] as HTMLElement

    expect(linha.textContent).toContain('Pede ação')
    // O ícone é decorativo: quem carrega a informação é o texto.
    const icone = linha.querySelector('svg')
    expect(icone?.getAttribute('aria-hidden')).toBe('true')
  })
})
