import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColorTarget } from '../src/api-client.ts'
import { ColorFieldsForm } from '../src/components/ColorFieldsForm.tsx'
import { type ApiStub, stubApi } from './support/api-stub.ts'

/**
 * O formulário dos três campos codificados em cor (`H-27`).
 *
 * O menu vem de `GET /api/color-options`, e não de uma lista escrita no
 * componente: a fonte é `config/color-map.json`, e uma segunda cópia ofereceria
 * ao operador uma cor que a escrita não grava.
 */

let api: ApiStub
let enfileirou: number

beforeEach(() => {
  api = stubApi()
  enfileirou = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const VERDE: ColorTarget = {
  responsible: 'indefinido',
  customsChannel: 'verde',
  importerOutsideRj: false,
}

function renderForm(current: ColorTarget | null = VERDE) {
  return render(
    <ColorFieldsForm
      processRef="FT501.26"
      current={current}
      onEnqueued={() => {
        enfileirou += 1
      }}
    />,
  )
}

function bloco(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Alterar cor da linha' })
}

describe('o menu de cores', () => {
  /**
   * Cada opção nomeia os três campos que grava. Só o nome da cor deixaria o
   * operador escolher "Amarelo forte" numa linha de Colaborador 1 sem ver que
   * isso também reverte o responsável para indefinido.
   */
  it('lista as combinações que o servidor diz saber gravar, com o que cada uma grava', async () => {
    renderForm()

    const opcoes = await screen.findAllByRole('option')

    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      'Selecione…',
      'Verde (tom A) — sem responsável · Canal Verde',
      'Azul — Colaborador 1 · canal indefinido',
    ])
  })

  it('busca as opções uma vez, no endereço do contrato', async () => {
    renderForm()

    await screen.findAllByRole('option')

    expect(api.calls.filter((call) => call === 'GET /api/color-options')).toHaveLength(1)
  })

  it('diz que não há cor configurada quando o mapa está vazio', async () => {
    api.serveColorOptions([])
    renderForm()

    expect(await screen.findByText(/Nenhuma cor configurada/)).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('avisa quando não consegue carregar as cores, em vez de mostrar menu vazio', async () => {
    api.failColorOptions()
    renderForm()

    // `H-43`: as duas regiões vivas existem desde a montagem, então o que se
    // espera é o texto — não a existência do nó.
    expect(await screen.findByText(/Não foi possível carregar as cores/)).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

describe('enfileirar a troca', () => {
  it('envia os três campos da opção escolhida', async () => {
    renderForm()
    await screen.findAllByRole('option')

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'colaborador1|indefinido|false' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enfileirar' }))

    await waitFor(() => {
      expect(api.calls).toContain('PATCH /api/processes/FT501.26/color')
    })
    expect(enfileirou).toBe(1)
  })

  // Sem escolha nao ha o que enfileirar, e um clique que nao faz nada e pior
  // que um botao desabilitado: o operador nao sabe se enfileirou.
  it('mantém o botão desabilitado enquanto nada foi escolhido', async () => {
    renderForm()
    await screen.findAllByRole('option')

    expect(screen.getByRole('button', { name: 'Enfileirar' }).hasAttribute('disabled')).toBe(true)
  })

  it('mostra a mensagem do servidor quando a combinação é recusada', async () => {
    api.failEnqueueColor('Essa combinacao nao tem cor correspondente na planilha.')
    renderForm()
    await screen.findAllByRole('option')

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'colaborador1|indefinido|false' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enfileirar' }))

    // A mensagem cai na região de recusa, que existe desde a montagem (`H-43`).
    const recusa = await screen.findByText(
      'Essa combinacao nao tem cor correspondente na planilha.',
    )

    expect(recusa.getAttribute('role')).toBe('alert')
    expect(enfileirou).toBe(0)
  })
})

describe('o que a tela afirma', () => {
  /**
   * A gravacao acontece no comando de aplicacao, nunca aqui. Afirmar o
   * contrario faria o operador acreditar que a planilha ja mudou.
   */
  it('diz que a planilha não é modificada pelo enfileiramento', async () => {
    renderForm()

    expect(within(await bloco()).getByText(/a planilha não é modificada/i)).toBeTruthy()
  })

  /**
   * A planilha tem dois verdes e dois roxos (A-48), e a gravação unifica no tom
   * canônico. Sem o aviso, o operador veria a linha mudar de tom sem ter pedido.
   */
  it('avisa que a gravação unifica os tons', async () => {
    renderForm()

    expect(within(await bloco()).getByText(/tom principal/i)).toBeTruthy()
  })

  it('diz que escolher uma cor substitui os três campos', async () => {
    renderForm()

    expect(within(await bloco()).getByText(/substitui os três/i)).toBeTruthy()
  })

  it('mostra o que a cor atual da linha diz', async () => {
    renderForm({
      responsible: 'colaborador1',
      customsChannel: 'indefinido',
      importerOutsideRj: false,
    })

    expect(within(await bloco()).getByText('Colaborador 1 · canal indefinido')).toBeTruthy()
  })

  /**
   * `importerOutsideRj: null` é cor NÃO reconhecida, e não "dentro do RJ".
   * Descrever uma combinação ali afirmaria o que ninguém leu (regra inviolável 3).
   */
  it('diz "cor não reconhecida" em vez de descrever o que não foi lido', async () => {
    renderForm(null)

    expect(within(await bloco()).getByText('cor não reconhecida')).toBeTruthy()
  })
})

/**
 * `H-43`. Os dois `role="alert"` deste formulário existem desde a montagem — o
 * da carga das cores e o da recusa do enfileiramento.
 */
describe('as duas regiões vivas', () => {
  it('monta as duas vazias, sem caixa na tela', async () => {
    const { container } = renderForm()
    await screen.findAllByRole('option')

    const regioes = screen.getAllByRole('alert')

    expect(regioes).toHaveLength(2)
    for (const regiao of regioes) expect(regiao.textContent).toBe('')
    expect(container.querySelector('.bg-state-error-bg')).toBeNull()
  })

  it('a recusa cai numa região que já estava no DOM', async () => {
    api.failEnqueueColor('Combinação sem cor correspondente.')
    renderForm()
    await screen.findAllByRole('option')
    const antes = screen.getAllByRole('alert')

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'colaborador1|indefinido|false' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enfileirar' }))

    const texto = await screen.findByText('Combinação sem cor correspondente.')

    expect(antes).toContain(texto.closest('[role="alert"]'))
  })
})
