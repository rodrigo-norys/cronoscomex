import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from '../src/components/FilterBar.tsx'
import type { Filters } from '../src/hooks/useFilters.ts'
import { filterOptionsFixture } from './support/api-stub.ts'

/**
 * A barra e apresentacao pura: recebe a selecao e os manipuladores, e nao sabe
 * de URL nem de rede. O casamento com a URL e testado em `useFilters.test.tsx`,
 * e a integracao em `App.test.tsx`.
 */

function filtersStub(overrides: Partial<Filters> = {}): Filters {
  return {
    selection: {
      etaFrom: '',
      etaTo: '',
      importerOutsideRj: '',
      multi: {
        client: [],
        clientProcess: [],
        importer: [],
        vessel: [],
        agent: [],
        goods: [],
        category: [],
        responsible: [],
        channel: [],
        port: [],
      },
    },
    activeCount: 0,
    queryString: '',
    toggle: vi.fn(),
    setRange: vi.fn(),
    setImporterOutsideRj: vi.fn(),
    clearAll: vi.fn(),
    ...overrides,
  }
}

function renderBar(filters: Filters = filtersStub()) {
  return render(
    <FilterBar filters={filters} options={filterOptionsFixture()} optionsError={null} />,
  )
}

beforeEach(() => {
  // `pointerdown` fecha o painel; sem isto o `jsdom` nao tem o construtor.
  if (!('PointerEvent' in window)) {
    vi.stubGlobal('PointerEvent', MouseEvent)
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('os doze controles', () => {
  it('monta os dez de multipla escolha, o periodo e o tri-estado', () => {
    renderBar()
    const bar = screen.getByRole('region', { name: 'Filtros' })

    // 10 botoes de multipla escolha + 1 select tri-estado + 2 campos de data.
    expect(within(bar).getAllByRole('button')).toHaveLength(10)
    expect(within(bar).getByLabelText('Importador fora do RJ')).toBeTruthy()
    expect(within(bar).getByLabelText('ETA2 de')).toBeTruthy()
    expect(within(bar).getByLabelText('ETA2 até')).toBeTruthy()
  })

  it('nao mostra contador nem botao de limpar sem filtro ativo', () => {
    renderBar()

    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull()
  })

  it('mostra quantos filtros estao ativos, no singular e no plural', () => {
    const { rerender } = renderBar(filtersStub({ activeCount: 1 }))
    expect(screen.getByText('1 ativo')).toBeTruthy()

    rerender(
      <FilterBar
        filters={filtersStub({ activeCount: 3 })}
        options={filterOptionsFixture()}
        optionsError={null}
      />,
    )
    expect(screen.getByText('3 ativos')).toBeTruthy()
  })
})

describe('multipla escolha', () => {
  it('abre o painel e lista os valores com a contagem', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))

    expect(screen.getByRole('checkbox', { name: /ACME/ })).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('marcar um valor chama toggle com o filtro e a chave', () => {
    const filters = filtersStub()
    renderBar(filters)

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /ACME/ }))

    expect(filters.toggle).toHaveBeenCalledWith('client', 'ACME')
  })

  it('reflete o que ja esta selecionado', () => {
    const filters = filtersStub()
    const selected = {
      ...filters,
      selection: {
        ...filters.selection,
        multi: { ...filters.selection.multi, client: ['ACME'] },
      },
    }
    renderBar(selected)

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))

    expect(screen.getByRole('checkbox', { name: /ACME/ }).getAttribute('checked')).not.toBe('false')
    expect((screen.getByRole('checkbox', { name: /ACME/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('fecha o painel com Escape', () => {
    renderBar()
    const trigger = screen.getByRole('button', { name: /Cliente/ })

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('nao oferece busca em lista curta, e oferece em lista longa', () => {
    const longa = filterOptionsFixture({
      clients: Array.from({ length: 40 }, (_, index) => ({
        key: `C${index}`,
        label: `CLIENTE ${index}`,
        count: 1,
      })),
    })
    render(<FilterBar filters={filtersStub()} options={longa} optionsError={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Canal/ }))
    expect(screen.queryByRole('searchbox')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('a busca ignora caixa e acento', () => {
    const comAcento = filterOptionsFixture({
      clients: Array.from({ length: 20 }, (_, index) => ({
        key: `K${index}`,
        label: index === 0 ? 'LOGÍSTICA MARÍTIMA' : `OUTRO ${index}`,
        count: 1,
      })),
    })
    render(<FilterBar filters={filtersStub()} options={comAcento} optionsError={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'maritima' } })

    expect(screen.getByRole('checkbox', { name: /LOGÍSTICA MARÍTIMA/ })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /OUTRO 1/ })).toBeNull()
  })

  it('diz que nada corresponde, em vez de painel vazio sem explicacao', () => {
    const longa = filterOptionsFixture({
      clients: Array.from({ length: 20 }, (_, index) => ({
        key: `K${index}`,
        label: `CLIENTE ${index}`,
        count: 1,
      })),
    })
    render(<FilterBar filters={filtersStub()} options={longa} optionsError={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })

    expect(screen.getByText('Nenhum valor corresponde.')).toBeTruthy()
  })

  it('rotula a chave vazia, que e valor legitimo e viraria linha invisivel', () => {
    const comVazio = filterOptionsFixture({
      agents: [{ key: '', label: '', count: 7 }],
    })
    render(<FilterBar filters={filtersStub()} options={comVazio} optionsError={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Agente/ }))

    expect(screen.getByText('(em branco)')).toBeTruthy()
  })
})

describe('periodo e tri-estado', () => {
  it('o periodo escreve cada extremo no seu parametro', () => {
    const filters = filtersStub()
    renderBar(filters)

    fireEvent.change(screen.getByLabelText('ETA2 de'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('ETA2 até'), { target: { value: '2026-08-31' } })

    expect(filters.setRange).toHaveBeenCalledWith('etaFrom', '2026-08-01')
    expect(filters.setRange).toHaveBeenCalledWith('etaTo', '2026-08-31')
  })

  /** Tres estados e nao caixa de marcar: `false` inclui apenas `false`, nunca
   * `null` — cor nao reconhecida nao e o mesmo que "dentro do RJ". */
  it('o importador fora do RJ tem tres estados', () => {
    const filters = filtersStub()
    renderBar(filters)
    const select = screen.getByLabelText('Importador fora do RJ')

    expect(within(select).getAllByRole('option')).toHaveLength(3)

    fireEvent.change(select, { target: { value: 'false' } })
    expect(filters.setImporterOutsideRj).toHaveBeenCalledWith('false')
  })
})

describe('opcoes ausentes', () => {
  it('sobrevive sem opcoes carregadas, sem inventar catalogo (A-36)', () => {
    render(<FilterBar filters={filtersStub()} options={null} optionsError={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('exibe a falha da rota de opcoes em vez de lista vazia silenciosa', () => {
    render(<FilterBar filters={filtersStub()} options={null} optionsError="respondeu 503" />)

    expect(screen.getByRole('alert').textContent).toMatch(/opções de filtro: respondeu 503/)
  })
})

/**
 * `H-49`. Dois controles, porque sao duas perguntas: um recorta a carteira do
 * cliente, o outro acha um processo pelo valor da celula CLT.
 */
describe('cliente e processo do cliente', () => {
  it('monta o controle do processo do cliente com as opcoes da rota', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Processo do cliente/ }))

    expect(screen.getByRole('checkbox', { name: /ACME-12/ })).toBeTruthy()
  })

  it('marcar um valor chama toggle com o filtro proprio', () => {
    const filters = filtersStub()
    renderBar(filters)

    fireEvent.click(screen.getByRole('button', { name: /Processo do cliente/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /ACME-12/ }))

    expect(filters.toggle).toHaveBeenCalledWith('clientProcess', 'ACME-12')
  })
})
