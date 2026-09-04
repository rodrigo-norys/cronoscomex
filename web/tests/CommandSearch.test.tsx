import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandSearch } from '../src/components/CommandSearch.tsx'
import type { Route } from '../src/router.ts'
import { type ApiStub, processesFixture, processFixture, stubApi } from './support/api-stub.ts'

/**
 * A busca por atalho (`H-83`). O componente e apresentacao mais consulta: quem
 * decide o atalho e a inercia e a casca, testada em `App.test.tsx`, e quem
 * prende o foco e `useModalFocus`, o mesmo mecanismo de `H-82`.
 *
 * **O casamento e do servidor.** O `api-stub` responde a `GET /api/processes`, e
 * os testes afirmam o que a interface FAZ com a resposta — nunca que ela
 * filtrou algo (regra inviolavel 6).
 */

const ROTA: Route = { pageId: 'home', ref: null }

let stub: ApiStub

beforeEach(() => {
  stub = stubApi()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderSearch() {
  const onClose = vi.fn()
  const result = render(<CommandSearch route={ROTA} dataVersion={1} onClose={onClose} />)
  return { ...result, onClose }
}

function caixa(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Buscar processo' })
}

describe('a sobreposicao', () => {
  it('se declara modal, e o foco entra no CAMPO', () => {
    renderSearch()

    expect(caixa().getAttribute('aria-modal')).toBe('true')
    // A excecao declarada ao padrao de `H-82`: aqui o campo e o conteudo.
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }),
    )
  })

  it('Esc fecha', () => {
    const { onClose } = renderSearch()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o veu fecha ao ser clicado', () => {
    const { container, onClose } = renderSearch()
    const veu = container.querySelector('[aria-hidden="true"]')

    expect(veu).not.toBeNull()
    if (veu !== null) fireEvent.click(veu)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('os sete destinos', () => {
  it('aparecem em grupo proprio, separados dos processos', () => {
    renderSearch()
    const paginas = within(caixa()).getByRole('region', { name: 'Páginas' })

    // Os sete de `NAV_PAGES`, e a Configuracao entre eles desde `H-38`.
    expect(within(paginas).getAllByRole('button')).toHaveLength(7)
    expect(within(paginas).getByRole('button', { name: 'Operacional' })).toBeTruthy()
    expect(within(caixa()).getByRole('region', { name: 'Processos' })).toBeTruthy()
  })

  it('o destino corrente se anuncia', () => {
    renderSearch()
    const paginas = within(caixa()).getByRole('region', { name: 'Páginas' })

    expect(
      within(paginas).getByRole('button', { name: 'Início' }).getAttribute('aria-current'),
    ).toBe('page')
  })

  it('escolher um destino navega por pushState, sem recarregar', () => {
    const { onClose } = renderSearch()
    const paginas = within(caixa()).getByRole('region', { name: 'Páginas' })

    fireEvent.click(within(paginas).getByRole('button', { name: 'Alertas' }))

    expect(window.location.pathname).toBe('/alertas')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o termo recorta os destinos', () => {
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'aler' },
    })

    const paginas = within(caixa()).getByRole('region', { name: 'Páginas' })
    expect(within(paginas).getAllByRole('button')).toHaveLength(1)
  })
})

describe('a busca de processos', () => {
  /** Uma letra casaria centenas: o prefixo `FT` cobre a planilha inteira. */
  it('termo curto nao vira requisicao', async () => {
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'F' },
    })

    expect(within(caixa()).getByText(/Digite ao menos duas letras/)).toBeTruthy()
    expect(stub.calls.filter((call) => call.includes('search='))).toHaveLength(0)
  })

  it('consulta o servidor e lista o que ele devolveu', async () => {
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'FT501' },
    })

    const processos = within(caixa()).getByRole('region', { name: 'Processos' })
    expect(await within(processos).findByText('FT501.26')).toBeTruthy()

    // A busca vai pela rota, com o `search` de `H-17` — nada e filtrado aqui.
    const busca = stub.calls.find((call) => call.includes('search='))
    expect(busca).toBeDefined()
    expect(busca).toContain('search=FT501')
    // A fila de trabalho e da Operacional; a busca acha UM processo, inclusive
    // desembaracado.
    expect(busca).toContain('activeOnly=false')
  })

  it('escolher um processo abre o detalhe dele', async () => {
    const { onClose } = renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'FT501' },
    })
    const processos = within(caixa()).getByRole('region', { name: 'Processos' })
    fireEvent.click(await within(processos).findByRole('button', { name: /FT501\.26/ }))

    expect(window.location.pathname).toBe('/processo/FT501.26')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * **A linha diz por que o processo esta na lista**, e `D-34` mudou quais
   * campos servem para isso: ela mostrava `client` — o consolidado, que e
   * justamente o unico campo que a busca NAO casa — e omitia importador e
   * navio, que passaram a casar. Sem esta troca, procurar por um navio
   * devolveria linhas sem nada visivelmente correspondente.
   */
  it('o subtitulo mostra os campos buscaveis, e nao o cliente consolidado', async () => {
    stub.serveProcesses(
      processesFixture([
        processFixture({
          ref: 'FT501.26',
          client: 'GRUPO ACME',
          clientProcess: 'ABC25004',
          importer: 'IMPORTACOES DELTA',
          vessel: 'NAVIO ALFA BRAVO',
        }),
      ]),
    )
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'BRAVO' },
    })

    const processos = within(caixa()).getByRole('region', { name: 'Processos' })
    const linha = await within(processos).findByRole('button', { name: /FT501\.26/ })

    expect(linha.textContent).toContain('NAVIO ALFA BRAVO')
    expect(linha.textContent).toContain('IMPORTACOES DELTA')
    expect(linha.textContent).toContain('ABC25004')
    expect(linha.textContent).not.toContain('GRUPO ACME')
  })

  /**
   * Estado proprio e afirmativo: lista vazia diria que a planilha nao tem o
   * processo, e o que se sabe e que o TERMO nao casou (regra inviolavel 3).
   */
  it('sem resultado, diz o que nao casou — e nao fica em branco', async () => {
    stub.serveProcesses(processesFixture([]))
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'ZZZZ' },
    })

    expect(await within(caixa()).findByText(/Nenhum processo com “ZZZZ”/)).toBeTruthy()
  })

  it('avisa quando o servidor recusa', async () => {
    stub.failProcesses()
    renderSearch()

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar em qualquer campo/ }), {
      target: { value: 'FT501' },
    })

    await waitFor(() => {
      expect(within(caixa()).getByRole('alert').textContent).toContain('Não foi possível buscar')
    })
  })
})
