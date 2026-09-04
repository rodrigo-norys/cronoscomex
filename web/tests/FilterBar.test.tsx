import { fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { FilterOptionsResponse } from '../src/api-client.ts'
import { FilterBar } from '../src/components/FilterBar.tsx'
import type { Filters, MultiFilterKey } from '../src/hooks/useFilters.ts'
import { filterOptionsFixture } from './support/api-stub.ts'

/**
 * A barra e apresentacao pura: recebe a selecao e os manipuladores, e nao sabe
 * de URL nem de rede. O casamento com a URL e testado em `useFilters.test.tsx`,
 * a prisao de foco em `FilterPanel.test.tsx`, e a integracao em `App.test.tsx`.
 *
 * **Ate `H-82` ela era treze chips**; agora e UMA linha que descreve o recorte,
 * mais o gatilho do painel. Os testes de popover sairam junto com o chip.
 */

const VAZIO: Readonly<Record<MultiFilterKey, readonly string[]>> = {
  client: [],
  clientProcess: [],
  clientGroup: [],
  importer: [],
  vessel: [],
  agent: [],
  goods: [],
  category: [],
  responsible: [],
  colorResponsible: [],
  channel: [],
  port: [],
}

function filtersStub(overrides: Partial<Filters> = {}): Filters {
  return {
    selection: { etaFrom: '', etaTo: '', importerOutsideRj: '', multi: VAZIO },
    activeCount: 0,
    queryString: '',
    toggle: vi.fn(),
    setRange: vi.fn(),
    setPeriod: vi.fn(),
    setImporterOutsideRj: vi.fn(),
    clearAll: vi.fn(),
    ...overrides,
  }
}

/** A selecao com alguns multi preenchidos, sem repetir o objeto inteiro. */
function comMulti(
  partes: Partial<Record<MultiFilterKey, readonly string[]>>,
  extras: Partial<Filters['selection']> = {},
): Filters['selection'] {
  return {
    etaFrom: '',
    etaTo: '',
    importerOutsideRj: '',
    ...extras,
    multi: { ...VAZIO, ...partes },
  }
}

function renderBar(
  filters: Filters = filtersStub(),
  options: FilterOptionsResponse | null = filterOptionsFixture(),
  panelOpen = false,
) {
  const onOpenPanel = vi.fn()
  const result = render(
    <FilterBar
      filters={filters}
      options={options}
      panelOpen={panelOpen}
      triggerRef={createRef<HTMLButtonElement>()}
      onOpenPanel={onOpenPanel}
    />,
  )
  return { ...result, onOpenPanel }
}

function frase(): string {
  const bar = screen.getByRole('region', { name: 'Filtros' })
  const paragrafo = bar.querySelector('p')
  return paragrafo?.textContent ?? ''
}

describe('a linha de resumo', () => {
  it('sem filtro ativo, diz o recorte padrao e nao oferece limpar', () => {
    renderBar()

    expect(frase()).toBe('Todos os processos, sem recorte')
    expect(screen.queryByRole('button', { name: /^Limpar/ })).toBeNull()
    // O gatilho e o unico botao: e isso que faz a barra caber em UMA linha.
    const bar = screen.getByRole('region', { name: 'Filtros' })
    expect(within(bar).getAllByRole('button')).toHaveLength(1)
  })

  it('nomeia o filtro ativo por extenso, com o valor', () => {
    renderBar(filtersStub({ selection: comMulti({ client: ['ACME'] }), activeCount: 1 }))

    expect(frase()).toBe('Cliente: ACME')
  })

  /**
   * O valor vira o ROTULO, e nao a chave: a chave e normalizada, e um resumo
   * dizendo `ACME` onde a celula diz `Acme Logística` faria o operador duvidar
   * do recorte.
   */
  it('usa o rotulo da opcao, nao a chave', () => {
    renderBar(filtersStub({ selection: comMulti({ category: ['em_andamento'] }), activeCount: 1 }))

    expect(frase()).toBe('Categoria: Em andamento')
  })

  it('cai na propria chave quando nenhuma opcao corresponde', () => {
    // Acontece quando o endereco e digitado a mao.
    renderBar(filtersStub({ selection: comMulti({ client: ['DIGITADO'] }), activeCount: 1 }))

    expect(frase()).toBe('Cliente: DIGITADO')
  })

  it('chave vazia e valor legitimo, e diz "(em branco)"', () => {
    renderBar(filtersStub({ selection: comMulti({ responsible: [''] }), activeCount: 1 }))

    // A fixture rotula a chave vazia como "Sem responsável"; sem rotulo, o
    // resumo cairia em "(em branco)" — nunca numa linha invisivel.
    expect(frase()).toBe('Responsável: Sem responsável')
  })

  it('de dois valores em diante vira contagem', () => {
    renderBar(filtersStub({ selection: comMulti({ port: ['RJ', 'RO'] }), activeCount: 1 }))

    expect(frase()).toBe('Porto: 2 valores')
  })
})

describe('o teto da frase', () => {
  /**
   * Com seis filtros ativos a frase nao cabe em 1280 px. O corte e por FILTRO,
   * nunca por caractere: truncar no meio de um valor diria "Cliente: Acme Log…"
   * e deixaria o operador sem saber se ha mais de um Acme.
   */
  it('nomeia os dois primeiros e resume o resto', () => {
    renderBar(
      filtersStub({
        selection: comMulti({
          category: ['em_andamento'],
          client: ['ACME'],
          importer: ['IMP'],
          vessel: ['NAVIO ALFA'],
          port: ['RJ'],
          goods: ['BAZAR'],
        }),
        activeCount: 6,
      }),
    )

    expect(frase()).toBe('Categoria: Em andamento · Cliente: ACME · e mais 4')
  })

  it('mantem a lista inteira no title, para nada sumir em silencio', () => {
    renderBar(
      filtersStub({
        selection: comMulti({
          category: ['em_andamento'],
          client: ['ACME'],
          importer: ['IMP'],
        }),
        activeCount: 3,
      }),
    )

    const bar = screen.getByRole('region', { name: 'Filtros' })
    expect(bar.querySelector('p')?.getAttribute('title')).toBe(
      'Categoria: Em andamento · Cliente: ACME · Importador: IMP',
    )
  })
})

/**
 * Sao QUATORZE filtros, e nao treze: `clientGroup` (`H-55`) conta e nao tem
 * controle proprio. A frase que o ignorasse mostraria "2" no botao e nomearia
 * um — a barra divergindo de `activeCount` no primeiro recorte por grupo.
 */
describe('clientGroup — o filtro sem controle proprio', () => {
  it('entra na frase, logo depois de Cliente', () => {
    renderBar(
      filtersStub({
        selection: comMulti({ client: ['ACME'], clientGroup: ['GRUPO-1'] }),
        activeCount: 2,
      }),
      filterOptionsFixture({
        clientGroups: [{ key: 'GRUPO-1', label: 'Grupo Um', count: 17, members: [] }],
      }),
    )

    expect(frase()).toBe('Cliente: ACME · Grupo de clientes: Grupo Um')
  })

  it('sozinho, ainda assim aparece', () => {
    renderBar(
      filtersStub({ selection: comMulti({ clientGroup: ['GRUPO-1'] }), activeCount: 1 }),
      filterOptionsFixture({
        clientGroups: [{ key: 'GRUPO-1', label: 'Grupo Um', count: 17, members: [] }],
      }),
    )

    expect(frase()).toBe('Grupo de clientes: Grupo Um')
  })
})

describe('periodo e tri-estado', () => {
  it('com os dois extremos, mostra o intervalo', () => {
    renderBar(
      filtersStub({
        selection: comMulti({}, { etaFrom: '2026-09-01', etaTo: '2026-09-30' }),
        activeCount: 1,
      }),
    )

    expect(frase()).toBe('Período (ETA2): 01/09/2026 a 30/09/2026')
  })

  it('com um extremo so, diz qual', () => {
    const { rerender } = renderBar(
      filtersStub({ selection: comMulti({}, { etaFrom: '2026-09-01' }), activeCount: 1 }),
    )
    expect(frase()).toBe('Período (ETA2): desde 01/09/2026')

    rerender(
      <FilterBar
        filters={filtersStub({
          selection: comMulti({}, { etaTo: '2026-09-30' }),
          activeCount: 1,
        })}
        options={filterOptionsFixture()}
        panelOpen={false}
        triggerRef={createRef<HTMLButtonElement>()}
        onOpenPanel={vi.fn()}
      />,
    )
    expect(frase()).toBe('Período (ETA2): até 30/09/2026')
  })

  /**
   * Tres estados, nao uma caixa de marcar: "Não" inclui apenas `false`, nunca
   * `null` — cor nao reconhecida nao e o mesmo que "dentro do RJ".
   */
  it('o tri-estado exibe o rotulo do estado', () => {
    renderBar(
      filtersStub({
        selection: comMulti({}, { importerOutsideRj: 'false' }),
        activeCount: 1,
      }),
    )

    expect(frase()).toBe('Importador fora do RJ: Não')
  })
})

describe('o gatilho do painel', () => {
  it('declara que abre um dialogo, e o estado dele', () => {
    const { rerender } = renderBar()
    const botao = screen.getByRole('button', { name: /Filtros/ })

    expect(botao.getAttribute('aria-haspopup')).toBe('dialog')
    expect(botao.getAttribute('aria-expanded')).toBe('false')

    rerender(
      <FilterBar
        filters={filtersStub()}
        options={filterOptionsFixture()}
        panelOpen
        triggerRef={createRef<HTMLButtonElement>()}
        onOpenPanel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Filtros/ }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('avisa a casca ao ser acionado', () => {
    const { onOpenPanel } = renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }))

    expect(onOpenPanel).toHaveBeenCalledTimes(1)
  })

  it('mostra a contagem de filtros ativos', () => {
    renderBar(filtersStub({ activeCount: 14 }))

    expect(screen.getByRole('button', { name: 'Filtros, 14 ativos' })).toBeTruthy()
  })
})

describe('limpar', () => {
  it('aparece com filtro ativo e chama clearAll', () => {
    const clearAll = vi.fn()
    renderBar(filtersStub({ activeCount: 3, clearAll }))

    fireEvent.click(screen.getByRole('button', { name: 'Limpar 3' }))

    expect(clearAll).toHaveBeenCalledTimes(1)
  })
})

describe('opcoes ausentes', () => {
  it('sem opcoes carregadas, a barra monta e a frase nao mente', () => {
    renderBar(filtersStub({ selection: comMulti({ client: ['ACME'] }), activeCount: 1 }), null)

    // Sem a lista, o rotulo nao existe: cai na chave, que e o que se sabe.
    expect(frase()).toBe('Cliente: ACME')
  })
})
