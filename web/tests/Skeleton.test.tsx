import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PAGE_LIVE_STATUS_ID } from '../src/components/PageAlert.tsx'
import { Skeleton } from '../src/components/Skeleton.tsx'
import { findLiveRegion, mountLiveRegions, unmountLiveRegions } from './support/live-region.ts'

/**
 * O esqueleto de carregamento (`H-85`).
 *
 * O que ele garante e de duas naturezas: **altura**, que so o navegador mede, e
 * **acessibilidade**, que o `jsdom` mede inteira. Aqui esta a segunda; a
 * primeira esta no bloco de conclusao da historia, medida num Chrome real.
 */

beforeEach(mountLiveRegions)
afterEach(unmountLiveRegions)

describe('o que o leitor de tela recebe', () => {
  it('as barras sao invisiveis para o leitor, e o anuncio e texto', async () => {
    render(<Skeleton announcement="Carregando processos." />)

    // As formas nao tem nome nem significado: o que a regiao viva diz e a
    // unica coisa que chega a quem nao ve a tela.
    expect(document.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect((await findLiveRegion('status', /Carregando processos/)).textContent).toBe(
      'Carregando processos.',
    )
  })

  /** `StatCard` declara `aria-busy` desde `H-16`, e as paginas nao declaravam. */
  it('o conteiner declara aria-busy, e NAO e aria-hidden', () => {
    render(<Skeleton announcement="Carregando." />)

    const conteiner = document.querySelector('[aria-busy="true"]')

    expect(conteiner).toBeTruthy()
    // Se o conteiner fosse `aria-hidden`, o proprio `aria-busy` nao chegaria a
    // ninguem — a ocultacao vale para as barras, e so para elas.
    expect(conteiner?.getAttribute('aria-hidden')).toBe(null)
  })
})

describe('a forma', () => {
  /** Um esqueleto de outra altura troca um salto por outro, menor (`H-61`). */
  it('cada barra mede a linha de 40 px, em unidade relativa', () => {
    render(<Skeleton rows={3} announcement="Carregando." />)

    const barras = [...document.querySelectorAll('.motion-pulse')]

    expect(barras).toHaveLength(3)
    for (const barra of barras) expect(barra.className).toContain('h-10')
  })

  /**
   * Doze linhas sao 600 px — `p-4` mais 12 × 40 px com 8 px de intervalo —, uma
   * tela util numa janela de 900. **O padrao e uma tela, e nao a altura do
   * conteudo**: medido em 04/09/2026 sobre a planilha real, a Pagina Alertas
   * tem 9.198 px de conteudo, e um esqueleto fiel daria 191 barras.
   */
  it('o padrao e uma tela', () => {
    render(<Skeleton announcement="Carregando." />)

    expect(document.querySelectorAll('.motion-pulse')).toHaveLength(12)
  })

  /**
   * A pulsacao vive no `index.css`, e a guarda de `A10` cobra a contraparte sob
   * `prefers-reduced-motion` pelo NOME do seletor. Aqui basta afirmar que o
   * componente usa o utilitario, e nao um `animate-*` proprio — que reprovaria
   * aquela guarda antes de chegar a este teste.
   */
  it('nomeia o papel de movimento, sem declarar movimento proprio', () => {
    render(<Skeleton rows={1} announcement="Carregando." />)

    const barra = document.querySelector('.motion-pulse')

    expect(barra).toBeTruthy()
    expect(barra?.className).not.toMatch(/\banimate-/)
  })
})

describe('o que o esqueleto NAO faz', () => {
  it('nao poe texto no bloco — quem fala e a regiao viva', () => {
    render(<Skeleton announcement="Carregando processos." />)

    // O anuncio sai por portal para a regiao da casca: ele EXISTE no documento,
    // e nao dentro do bloco. As duas metades importam — sem a primeira o leitor
    // ficaria mudo, sem a segunda o texto apareceria na tela sob as barras.
    const conteiner = document.querySelector('[aria-busy="true"]') as HTMLElement

    expect(conteiner.textContent).toBe('')
    expect(screen.getByText('Carregando processos.').id).toBe(PAGE_LIVE_STATUS_ID)
  })
})
