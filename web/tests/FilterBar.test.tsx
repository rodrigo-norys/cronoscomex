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
    activeValueCount: 0,
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

/** O rotulo VISIVEL de cada ficha, na ordem em que aparecem. O `x` fica fora:
    ele e decorativo, e o nome acessivel vive no `aria-label` do botao. */
function fichas(): string[] {
  const bar = screen.getByRole('region', { name: 'Filtros' })
  return within(bar)
    .queryAllByRole('button', { name: /^Remover filtro / })
    .map((botao) => botao.querySelector('span')?.textContent ?? '')
}

describe('a linha de fichas', () => {
  /**
   * A frase do estado vazio SAIU em 10/09/2026. Ela dizia "Todos os processos,
   * sem recorte" e afirmava o falso com `Ocultar desembaracados` ligado — o
   * checkbox vive em `useProcessQuery`, e esta barra e da casca.
   */
  it('sem filtro ativo, nao diz nada e nao oferece limpar', () => {
    renderBar()

    expect(fichas()).toEqual([])
    expect(screen.queryByRole('button', { name: /^Limpar/ })).toBeNull()
    // O gatilho e o unico botao: e isso que faz a barra caber em UMA linha.
    const bar = screen.getByRole('region', { name: 'Filtros' })
    expect(within(bar).getAllByRole('button')).toHaveLength(1)
  })

  it('cada valor marcado vira uma ficha com o nome dele', () => {
    renderBar(filtersStub({ selection: comMulti({ client: ['ACME'] }), activeValueCount: 1 }))

    expect(fichas()).toEqual(['ACME'])
  })

  /**
   * O `x` e o contrato da ficha: ele tira UM valor e preserva os outros do mesmo
   * filtro — `toggle`, e nao `clearAll`.
   */
  it('clicar na ficha remove aquele valor, e so ele', () => {
    const toggle = vi.fn()
    renderBar(
      filtersStub({
        selection: comMulti({ client: ['ACME', 'BETA'] }),
        activeValueCount: 2,
        toggle,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Cliente: ACME' }))

    expect(toggle).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveBeenCalledWith('client', 'ACME')
  })

  it('dois valores do mesmo filtro sao duas fichas', () => {
    renderBar(filtersStub({ selection: comMulti({ port: ['RJ', 'RO'] }), activeValueCount: 2 }))

    expect(fichas()).toHaveLength(2)
  })

  /**
   * O valor vira o ROTULO, e nao a chave: a chave e normalizada, e um resumo
   * dizendo `ACME` onde a celula diz `Acme Logística` faria o operador duvidar
   * do recorte.
   */
  it('usa o rotulo da opcao, nao a chave', () => {
    renderBar(
      filtersStub({ selection: comMulti({ category: ['em_andamento'] }), activeValueCount: 1 }),
    )

    expect(fichas()).toEqual(['Em andamento'])
  })

  it('cai na propria chave quando nenhuma opcao corresponde', () => {
    // Acontece quando o endereco e digitado a mao.
    renderBar(filtersStub({ selection: comMulti({ client: ['DIGITADO'] }), activeValueCount: 1 }))

    expect(fichas()).toEqual(['DIGITADO'])
  })

  it('chave vazia e valor legitimo, e diz "(em branco)"', () => {
    renderBar(filtersStub({ selection: comMulti({ responsible: [''] }), activeValueCount: 1 }))

    // A fixture rotula a chave vazia como "Sem responsável"; sem rotulo, a ficha
    // cairia em "(em branco)" — nunca numa ficha invisivel.
    expect(fichas()).toEqual(['Sem responsável'])
  })
})

describe('o teto das fichas', () => {
  const seisValores = filtersStub({
    selection: comMulti({
      category: ['em_andamento'],
      client: ['ACME'],
      importer: ['IMP'],
      vessel: ['NAVIO ALFA'],
      port: ['RJ'],
      goods: ['BAZAR'],
    }),
    activeValueCount: 6,
  })

  /**
   * Acima de quatro as fichas nao cabem em uma linha a 1280 px — e foi a
   * multiplicidade que matou os treze chips de `H-60`, medidos em 1437 px contra
   * 1064 disponiveis. O excedente vira UMA ficha de contagem.
   */
  it('mostra as quatro primeiras e resume o resto', () => {
    renderBar(seisValores)

    expect(fichas()).toEqual(['Em andamento', 'ACME', 'IMP', 'NAVIO ALFA'])
    expect(screen.getByRole('button', { name: /e mais 2/ })).toBeTruthy()
  })

  it('a ficha de contagem abre o painel, onde o resto esta', () => {
    const { onOpenPanel } = renderBar(seisValores)

    fireEvent.click(screen.getByRole('button', { name: /e mais 2/ }))

    expect(onOpenPanel).toHaveBeenCalledTimes(1)
  })

  it('cada ficha leva o filtro de origem no title, para o valor nao ficar ambiguo', () => {
    renderBar(filtersStub({ selection: comMulti({ client: ['ACME'] }), activeValueCount: 1 }))

    expect(
      screen.getByRole('button', { name: 'Remover filtro Cliente: ACME' }).getAttribute('title'),
    ).toBe('Cliente: ACME')
  })
})

/**
 * Sao QUATORZE filtros, e nao treze: `clientGroup` (`H-55`) conta e nao tem
 * controle proprio. A frase que o ignorasse mostraria "2" no botao e nomearia
 * um — a barra divergindo de `activeCount` no primeiro recorte por grupo.
 */
describe('clientGroup — o filtro sem controle proprio', () => {
  it('entra nas fichas, logo depois de Cliente', () => {
    renderBar(
      filtersStub({
        selection: comMulti({ client: ['ACME'], clientGroup: ['GRUPO-1'] }),
        activeValueCount: 2,
      }),
      filterOptionsFixture({
        clientGroups: [{ key: 'GRUPO-1', label: 'Grupo Um', count: 17, members: [] }],
      }),
    )

    expect(fichas()).toEqual(['ACME', 'Grupo Um'])
  })

  it('sozinho, ainda assim aparece', () => {
    renderBar(
      filtersStub({ selection: comMulti({ clientGroup: ['GRUPO-1'] }), activeValueCount: 1 }),
      filterOptionsFixture({
        clientGroups: [{ key: 'GRUPO-1', label: 'Grupo Um', count: 17, members: [] }],
      }),
    )

    expect(fichas()).toEqual(['Grupo Um'])
  })
})

describe('periodo e tri-estado', () => {
  it('com os dois extremos, mostra o intervalo', () => {
    renderBar(
      filtersStub({
        selection: comMulti({}, { etaFrom: '2026-09-01', etaTo: '2026-09-30' }),
        activeValueCount: 1,
      }),
    )

    expect(fichas()).toEqual(['01/09/2026 a 30/09/2026'])
  })

  /** O periodo ocupa dois parametros e e UM filtro: a ficha limpa os dois. */
  it('remover a ficha de periodo limpa os dois extremos', () => {
    const setPeriod = vi.fn()
    renderBar(
      filtersStub({
        selection: comMulti({}, { etaFrom: '2026-09-01', etaTo: '2026-09-30' }),
        activeValueCount: 1,
        setPeriod,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Remover filtro Período \(ETA2\)/ }))

    expect(setPeriod).toHaveBeenCalledWith('', '')
  })

  it('com um extremo so, diz qual', () => {
    const { rerender } = renderBar(
      filtersStub({ selection: comMulti({}, { etaFrom: '2026-09-01' }), activeValueCount: 1 }),
    )
    expect(fichas()).toEqual(['desde 01/09/2026'])

    rerender(
      <FilterBar
        filters={filtersStub({
          selection: comMulti({}, { etaTo: '2026-09-30' }),
          activeValueCount: 1,
        })}
        options={filterOptionsFixture()}
        panelOpen={false}
        triggerRef={createRef<HTMLButtonElement>()}
        onOpenPanel={vi.fn()}
      />,
    )
    expect(fichas()).toEqual(['até 30/09/2026'])
  })

  /**
   * Tres estados, nao uma caixa de marcar: "Não" inclui apenas `false`, nunca
   * `null` — cor nao reconhecida nao e o mesmo que "dentro do RJ".
   */
  it('o tri-estado exibe o rotulo do estado', () => {
    renderBar(
      filtersStub({
        selection: comMulti({}, { importerOutsideRj: 'false' }),
        activeValueCount: 1,
      }),
    )

    expect(fichas()).toEqual(['Não'])
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

  /** O numero conta VALORES desde `H-92`: o operador o confere contando fichas.
      `activeCount`, que conta filtros, continua servindo a Pagina Performance. */
  it('mostra a contagem de valores marcados', () => {
    renderBar(filtersStub({ activeCount: 3, activeValueCount: 14 }))

    expect(screen.getByRole('button', { name: 'Filtros, 14 ativos' })).toBeTruthy()
  })
})

describe('limpar', () => {
  it('aparece com filtro ativo e chama clearAll', () => {
    const clearAll = vi.fn()
    renderBar(filtersStub({ activeValueCount: 3, clearAll }))

    fireEvent.click(screen.getByRole('button', { name: 'Limpar 3' }))

    expect(clearAll).toHaveBeenCalledTimes(1)
  })
})

describe('opcoes ausentes', () => {
  it('sem opcoes carregadas, a barra monta e a ficha nao mente', () => {
    renderBar(filtersStub({ selection: comMulti({ client: ['ACME'] }), activeValueCount: 1 }), null)

    // Sem a lista, o rotulo nao existe: cai na chave, que e o que se sabe.
    expect(fichas()).toEqual(['ACME'])
  })
})
