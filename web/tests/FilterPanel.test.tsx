import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FilterOptionsResponse } from '../src/api-client.ts'
import { FilterPanel } from '../src/components/FilterPanel.tsx'
import type { Filters, MultiFilterKey } from '../src/hooks/useFilters.ts'
import { filterOptionsFixture } from './support/api-stub.ts'

/**
 * O primeiro modal do conjunto com teste (`H-82`, `D-30`).
 *
 * O `ConflictDialog` so abre com a planilha alterada durante a sessao, e por
 * isso a gestao de foco dele segue parada em `PD-07`; este abre a qualquer
 * momento, e o padrao passa a ter prova.
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

function renderPanel(
  filters: Filters = filtersStub(),
  options: FilterOptionsResponse | null = filterOptionsFixture(),
  optionsError: string | null = null,
) {
  const onClose = vi.fn()
  const result = render(
    <FilterPanel
      filters={filters}
      options={options}
      optionsError={optionsError}
      onClose={onClose}
    />,
  )
  return { ...result, onClose }
}

function dialogo(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Filtros' })
}

describe('o dialogo', () => {
  /** Sobreposto com veu significa modal, com tudo que o padrao exige (`D-30`). */
  it('se declara modal e nomeado', () => {
    renderPanel()
    const painel = dialogo()

    expect(painel.getAttribute('aria-modal')).toBe('true')
    expect(painel.getAttribute('aria-labelledby')).toBe('filtros-titulo')
    expect(screen.getByRole('heading', { name: 'Filtros' }).id).toBe('filtros-titulo')
  })

  /**
   * O foco entra no TITULO, e nao no primeiro campo: entrar num campo faz o
   * leitor de tela anunciar o campo sem dizer onde ele esta.
   */
  it('recebe o foco no titulo ao abrir', () => {
    renderPanel()

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Filtros' }))
  })

  it('monta os catorze filtros, com Grupo de clientes dentro de Cliente', () => {
    renderPanel(
      filtersStub(),
      filterOptionsFixture({
        clientGroups: [
          {
            key: 'GRUPO-1',
            label: 'Grupo Um',
            count: 17,
            members: [{ key: 'ACME', label: 'ACME', count: 12 }],
          },
        ],
      }),
    )
    const painel = dialogo()

    // Onze de multipla escolha + periodo + tri-estado = treze secoes; o
    // quatorze e `clientGroup`, que vive DENTRO da de Cliente (`H-55`).
    expect(within(painel).getByRole('region', { name: 'Cliente' })).toBeTruthy()
    expect(within(painel).getByRole('region', { name: 'Período (ETA2)' })).toBeTruthy()
    expect(within(painel).getByRole('region', { name: 'Importador fora do RJ' })).toBeTruthy()
    expect(within(painel).getByLabelText('ETA2 de')).toBeTruthy()
    expect(within(painel).getByLabelText('ETA2 até')).toBeTruthy()

    const cliente = within(painel).getByRole('region', { name: 'Cliente' })
    expect(within(cliente).getByText('Grupo Um')).toBeTruthy()
  })

  /**
   * O painel e coluna: o valor longo cabe INTEIRO, e quem resume e a barra.
   * No chip de `H-60` ele truncava em `max-w-64`.
   */
  it('mostra o valor longo por extenso', () => {
    const longo = 'Importadora Muito Longa de Mercadorias Diversas Ltda'
    renderPanel(
      filtersStub(),
      filterOptionsFixture({ importers: [{ key: 'LONGO', label: longo, count: 1 }] }),
    )

    expect(within(dialogo()).getByText(longo)).toBeTruthy()
  })
})

describe('o fechamento', () => {
  it('Esc fecha', () => {
    const { onClose } = renderPanel()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o botao Fechar fecha', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o veu fecha ao ser clicado', () => {
    const { container, onClose } = renderPanel()
    const veu = container.querySelector('[aria-hidden="true"]')

    expect(veu).not.toBeNull()
    if (veu !== null) fireEvent.click(veu)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Filtrar e observar o efeito, e o efeito acontece ATRAS do painel — na
   * contagem da barra e nos numeros da pagina. Fechar a cada clique obrigaria a
   * reabrir para o segundo valor.
   */
  it('alterar um filtro NAO fecha o painel', () => {
    const toggle = vi.fn()
    const { onClose } = renderPanel(filtersStub({ toggle }))

    // O nome acessivel traz a contagem colada — "ACME12" —, porque o `gap` do
    // flex e espaco visual e nao textual. A busca e por prefixo de proposito.
    const cliente = within(dialogo()).getByRole('region', { name: 'Cliente' })
    fireEvent.click(within(cliente).getByRole('checkbox', { name: /^ACME/ }))

    expect(toggle).toHaveBeenCalledWith('client', 'ACME')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('mudar a data NAO fecha o painel', () => {
    const setRange = vi.fn()
    const { onClose } = renderPanel(filtersStub({ setRange }))

    fireEvent.change(within(dialogo()).getByLabelText('ETA2 de'), {
      target: { value: '2026-09-01' },
    })

    expect(setRange).toHaveBeenCalledWith('etaFrom', '2026-09-01')
    expect(onClose).not.toHaveBeenCalled()
  })
})

/**
 * A prisao e manual porque `inert` no restante nao basta: ele tira os irmaos da
 * ordem de tabulacao, mas a interface do navegador continua depois do ultimo
 * elemento, e o operador que passa dali perde o painel de vista.
 */
describe('a prisao de foco', () => {
  function focaveis(): HTMLElement[] {
    return Array.from(
      dialogo().querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
  }

  it('Tab no ultimo volta para o primeiro', () => {
    renderPanel()
    const alvos = focaveis()
    const ultimo = alvos[alvos.length - 1]
    expect(ultimo).toBeDefined()
    ultimo?.focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(alvos[0])
  })

  it('Shift+Tab no primeiro vai para o ultimo', () => {
    renderPanel()
    const alvos = focaveis()
    alvos[0]?.focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(alvos[alvos.length - 1])
  })

  /**
   * O titulo tem `tabIndex={-1}` e nao entra na lista de focaveis: com o foco
   * nele — que e onde o painel abre —, `Tab` sem guarda sairia na primeira
   * tecla, e o operador de teclado perderia o painel imediatamente.
   */
  it('Tab a partir do titulo entra no painel, e nao sai dele', () => {
    renderPanel()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Filtros' }))

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(focaveis()[0])
  })
})

describe('as opcoes de filtro', () => {
  /** A regiao existe desde a montagem (`H-43`); vazia, e `sr-only`. */
  it('a regiao de erro existe montada e vazia', () => {
    renderPanel()
    const regiao = dialogo().querySelector('[role="alert"]')

    expect(regiao).not.toBeNull()
    expect(regiao?.textContent).toBe('')
    expect(regiao?.className).toContain('sr-only')
  })

  it('mostra a falha ao carregar as opcoes', () => {
    renderPanel(filtersStub(), null, 'rede indisponível')

    const regiao = dialogo().querySelector('[role="alert"]')
    expect(regiao?.textContent).toContain('rede indisponível')
    expect(regiao?.className).not.toContain('sr-only')
  })

  it('sem opcoes carregadas, o painel monta com as listas vazias', () => {
    renderPanel(filtersStub(), null)

    expect(dialogo()).toBeTruthy()
    expect(within(dialogo()).getAllByText('Nenhum valor corresponde.').length).toBeGreaterThan(0)
  })
})
