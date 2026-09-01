import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilterOptionsResponse } from '../src/api-client.ts'
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
      },
    },
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

function renderBar(
  filters: Filters = filtersStub(),
  options: FilterOptionsResponse = filterOptionsFixture(),
) {
  return render(<FilterBar filters={filters} options={options} optionsError={null} />)
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

describe('os treze chips', () => {
  /**
   * `H-60`. Eram treze controles sempre abertos; agora sao treze CHIPS, e o
   * conteudo de cada um vive num popover. O periodo e o tri-estado ganharam
   * chip proprio — antes eram os unicos controles sem forma comum.
   */
  it('monta os treze chips, e nenhum popover aberto', () => {
    renderBar()
    const bar = screen.getByRole('region', { name: 'Filtros' })

    // 11 de multipla escolha + periodo + tri-estado. Sem filtro ativo nao ha
    // botao de limpar, entao os treze sao todos os botoes da barra.
    expect(within(bar).getAllByRole('button')).toHaveLength(13)
    expect(within(bar).getByRole('button', { name: /Período \(ETA2\)/ })).toBeTruthy()
    expect(within(bar).getByRole('button', { name: /Importador fora do RJ/ })).toBeTruthy()
    // O conteudo so existe com o popover aberto: e o que libera a linha.
    expect(within(bar).queryByLabelText('ETA2 de')).toBeNull()
    expect(bar.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0)
  })

  it('nao mostra contador nem botao de limpar sem filtro ativo', () => {
    renderBar()

    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull()
  })

  it('mostra quantos filtros estao ativos no botao de limpar', () => {
    const { rerender } = renderBar(filtersStub({ activeCount: 1 }))
    expect(screen.getByRole('button', { name: 'Limpar 1' })).toBeTruthy()

    rerender(
      <FilterBar
        filters={filtersStub({ activeCount: 3 })}
        options={filterOptionsFixture()}
        optionsError={null}
      />,
    )
    expect(screen.getByRole('button', { name: 'Limpar 3' })).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /Período \(ETA2\)/ }))

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
    fireEvent.click(screen.getByRole('button', { name: /Importador fora do RJ/ }))
    // Pelo papel, e nao pelo rotulo: desde `H-60` o chip tambem se chama
    // "Importador fora do RJ", e `getByLabelText` casaria os dois.
    const select = screen.getByRole('combobox')

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

/**
 * `H-55`. A arvore vive DENTRO do controle de Cliente: o grupo em cima, os
 * membros indentados, e cada nivel escrevendo no seu proprio parametro.
 */
describe('grupo de clientes dentro do filtro Cliente', () => {
  const comGrupo = () =>
    filterOptionsFixture({
      clients: [
        { key: 'ACME', label: 'Acme Comércio', count: 12 },
        { key: 'BETA', label: 'Beta Ltda', count: 5 },
        { key: 'ZETA', label: 'Zeta', count: 3 },
      ],
      clientGroups: [
        {
          key: 'GRUPO-UM',
          label: 'Grupo Um',
          count: 17,
          members: [
            { key: 'ACME', label: 'Matriz', count: 12 },
            { key: 'BETA', label: 'Beta Ltda', count: 5 },
          ],
        },
      ],
    })

  function abrirCliente(filters = filtersStub()) {
    render(<FilterBar filters={filters} options={comGrupo()} optionsError={null} />)
    fireEvent.click(screen.getByRole('button', { name: /^Cliente/ }))
    return filters
  }

  it('exibe o grupo com a soma e os membros com a contagem propria', () => {
    abrirCliente()

    expect(screen.getByRole('checkbox', { name: /Grupo Um/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Matriz/ })).toBeTruthy()
    expect(screen.getByText('17')).toBeTruthy()
  })

  it('marcar o grupo escreve no filtro clientGroup', () => {
    const filters = abrirCliente()

    fireEvent.click(screen.getByRole('checkbox', { name: /Grupo Um/ }))

    expect(filters.toggle).toHaveBeenCalledWith('clientGroup', 'GRUPO-UM')
  })

  it('marcar um membro escreve no filtro client, como sempre', () => {
    const filters = abrirCliente()

    fireEvent.click(screen.getByRole('checkbox', { name: /Matriz/ }))

    expect(filters.toggle).toHaveBeenCalledWith('client', 'ACME')
  })

  // A mesma chave nos dois lugares daria duas caixas para o mesmo cliente.
  it('o membro NAO aparece tambem na lista solta', () => {
    abrirCliente()

    expect(screen.getAllByRole('checkbox', { name: /Beta Ltda/ })).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: /Zeta/ })).toBeTruthy()
  })
})

/**
 * `H-43`. A região de erro das opções existe desde a montagem.
 *
 * Um `role="alert"` que nasce já populado não é anunciado: o leitor de tela não
 * tem estado anterior com que comparar.
 */
describe('a região viva das opções de filtro', () => {
  it('monta a região vazia, sem caixa na tela, quando não há erro', () => {
    const { container } = renderBar()

    const regiao = screen.getByRole('alert')
    expect(regiao.textContent).toBe('')
    // O caso-limite: nenhuma caixa vazia. O estilo só entra com a mensagem.
    expect(regiao.className).toBe('sr-only')
    expect(container.querySelector('.bg-state-error-bg')).toBeNull()
  })

  it('escreve no mesmo nó quando o erro aparece', () => {
    const { rerender } = renderBar()
    const antes = screen.getByRole('alert')

    rerender(
      <FilterBar
        filters={filtersStub()}
        options={filterOptionsFixture()}
        optionsError="rede indisponível"
      />,
    )

    expect(screen.getByRole('alert')).toBe(antes)
    expect(antes.textContent).toContain('rede indisponível')
  })
})

/**
 * `H-66`. Dois controles vizinhos e independentes: um recorta por quem responde
 * pelo processo, o outro por o que a linha está pintada (`H-50`).
 */
describe('responsável e cor do responsável', () => {
  it('oferece os dois controles, com nomes que os distinguem', () => {
    renderBar()
    const bar = screen.getByRole('region', { name: 'Filtros' })

    expect(within(bar).getByRole('button', { name: /^Responsável/ })).toBeTruthy()
    expect(within(bar).getByRole('button', { name: /^Cor do responsável/ })).toBeTruthy()
  })

  // As duas chaves de A-18 vêm do servidor e aparecem separadas no controle: a
  // agregação acontece no recorte, não na lista de opções.
  it('lista as quatro chaves de cor de TD-05', () => {
    renderBar(
      filtersStub(),
      filterOptionsFixture({
        colorResponsible: [
          { key: 'colaborador1', label: 'Colaborador 1', count: 120 },
          { key: 'colaborador2', label: 'Colaborador 2', count: 36 },
          {
            key: 'colaborador1_outros_clientes',
            label: 'Colaborador 1 — outros clientes',
            count: 9,
          },
          { key: 'indefinido', label: 'Indefinido', count: 484 },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /^Cor do responsável/ }))

    expect(screen.getByRole('checkbox', { name: /Colaborador 1 — outros clientes/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Indefinido/ })).toBeTruthy()
  })

  // Controle que some esconde que o recorte zerou (A-28). Ele fica, vazio.
  it('aparece vazio quando nenhum processo do recorte tem cor de responsável', () => {
    renderBar(filtersStub(), filterOptionsFixture({ colorResponsible: [] }))

    const controle = screen.getByRole('button', { name: /^Cor do responsável/ })
    expect(controle).toBeTruthy()

    fireEvent.click(controle)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})

/**
 * `H-60`. O chip diz o recorte **sem abrir o popover** — é o que separa esta
 * forma de simplesmente esconder o filtro atrás de um botão.
 */
describe('o chip diz o recorte ativo', () => {
  const comSelecao = (multi: Partial<Record<string, readonly string[]>>) =>
    filtersStub({
      selection: {
        ...filtersStub().selection,
        multi: { ...filtersStub().selection.multi, ...multi },
      },
    })

  it('um valor vira o rótulo dele, e não a chave normalizada', () => {
    // A chave e o rótulo precisam DIFERIR, senão a asserção passa sem medir
    // nada: `clientKey` é normalizado, e um chip dizendo `ACME LOG` quando a
    // célula diz `Acme Logística` faria o operador duvidar do recorte.
    renderBar(
      comSelecao({ client: ['ACME LOG'] }),
      filterOptionsFixture({ clients: [{ key: 'ACME LOG', label: 'Acme Logística', count: 12 }] }),
    )

    expect(screen.getByRole('button', { name: /^Cliente: Acme Logística/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Cliente: ACME LOG/ })).toBeNull()
  })

  // Listar quatro clientes num chip ocuparia a linha que a fatia libera.
  it('dois valores ou mais viram contagem', () => {
    renderBar(comSelecao({ client: ['ACME', 'BETA'] }))

    expect(screen.getByRole('button', { name: /^Cliente: 2 valores/ })).toBeTruthy()
  })

  // Chave vazia é valor legítimo do domínio — célula em branco na planilha.
  it('a chave vazia tem rótulo próprio, e não vira chip sem valor', () => {
    renderBar(comSelecao({ goods: [''] }))

    expect(screen.getByRole('button', { name: /^Mercadoria: \(em branco\)/ })).toBeTruthy()
  })

  // Chave digitada no endereço, sem opção correspondente: o chip mostra a
  // chave, nunca um chip aparentemente inativo.
  it('chave sem opção correspondente cai na própria chave', () => {
    renderBar(comSelecao({ vessel: ['NAVIO INEXISTENTE'] }))

    expect(screen.getByRole('button', { name: /^Navio: NAVIO INEXISTENTE/ })).toBeTruthy()
  })

  /** Período é UM filtro que ocupa dois parâmetros, e o chip exibe o intervalo. */
  it('o período exibe intervalo, e cada extremo sozinho tem forma própria', () => {
    const base = filtersStub()
    const { rerender } = renderBar(
      filtersStub({ selection: { ...base.selection, etaFrom: '2026-02-01', etaTo: '2026-02-28' } }),
    )
    expect(screen.getByRole('button', { name: /01\/02\/2026 a 28\/02\/2026/ })).toBeTruthy()

    const so = (campo: 'etaFrom' | 'etaTo', valor: string) =>
      rerender(
        <FilterBar
          filters={filtersStub({ selection: { ...base.selection, [campo]: valor } })}
          options={filterOptionsFixture()}
          optionsError={null}
        />,
      )

    so('etaFrom', '2026-02-01')
    expect(screen.getByRole('button', { name: /desde 01\/02\/2026/ })).toBeTruthy()
    so('etaTo', '2026-02-28')
    expect(screen.getByRole('button', { name: /até 28\/02\/2026/ })).toBeTruthy()
  })

  /**
   * Três estados, e o chip não pode reduzi-los a marcado/desmarcado: "Não"
   * inclui apenas `false`, nunca `null` — cor não reconhecida não é o mesmo que
   * "dentro do RJ".
   */
  it('o tri-estado exibe o rótulo do estado, não um sinal de marcado', () => {
    const base = filtersStub()
    const { rerender } = renderBar(
      filtersStub({ selection: { ...base.selection, importerOutsideRj: 'false' } }),
    )
    expect(screen.getByRole('button', { name: /^Importador fora do RJ: Não/ })).toBeTruthy()

    rerender(
      <FilterBar
        filters={filtersStub({ selection: { ...base.selection, importerOutsideRj: 'true' } })}
        options={filterOptionsFixture()}
        optionsError={null}
      />,
    )
    expect(screen.getByRole('button', { name: /^Importador fora do RJ: Sim/ })).toBeTruthy()
  })

  /**
   * Nome de cliente real estoura a linha. O chip trunca por CSS e guarda o
   * valor completo no `title` — cortar em silêncio esconderia parte do recorte
   * que o operador montou.
   */
  it('o rótulo longo trunca com o valor completo acessível', () => {
    renderBar(comSelecao({ vessel: ['UM NOME DE NAVIO BEM MAIS LONGO QUE O CHIP'] }))
    const chip = screen.getByRole('button', { name: /^Navio: UM NOME/ })

    expect(chip.getAttribute('title')).toBe('Navio: UM NOME DE NAVIO BEM MAIS LONGO QUE O CHIP')
    expect(chip.querySelector('.truncate')).toBeTruthy()
  })
})

/**
 * `H-60`. O popover abre, fecha por `Esc` e por clique fora, e **devolve o foco
 * ao chip**. Sem a devolução o foco cai no `<body>` e o operador de teclado
 * recomeça a tabulação do topo — o defeito que `VN-4` mediu na navegação.
 */
describe('o popover do chip', () => {
  it('abre e fecha pelo próprio chip, anunciando o estado', () => {
    renderBar()
    const chip = screen.getByRole('button', { name: /^Cliente/ })

    expect(chip.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('false')
  })

  it('Esc fecha e devolve o foco ao chip', () => {
    renderBar()
    const chip = screen.getByRole('button', { name: /^Cliente/ })
    fireEvent.click(chip)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(chip)
  })

  it('clique fora fecha', () => {
    renderBar()
    const chip = screen.getByRole('button', { name: /^Cliente/ })
    fireEvent.click(chip)

    fireEvent.pointerDown(document.body)

    expect(chip.getAttribute('aria-expanded')).toBe('false')
  })

  /** O segundo nível de `H-55` continua dentro do popover, com a árvore intacta. */
  it('mantém a árvore de grupos dentro do popover de Cliente', () => {
    renderBar(filtersStub(), filterOptionsFixture())
    fireEvent.click(screen.getByRole('button', { name: /^Cliente/ }))

    expect(screen.getByRole('checkbox', { name: /ACME/ })).toBeTruthy()
  })
})
