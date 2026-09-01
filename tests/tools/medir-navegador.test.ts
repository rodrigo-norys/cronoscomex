import { describe, expect, it } from 'vitest'
import { luminancia, razaoContraste } from '../../tools/medir-navegador.mjs'

/**
 * A conta da WCAG de `tools/medir-navegador.mjs`, e SO ela.
 *
 * O resto do harness lanca um Chrome e sobe um servidor: cobri-lo aqui tornaria
 * a suite lenta e dependente de binario externo, e `tools/` nao entra no build.
 * **A conta e a parte que erra em silencio** — um expoente trocado devolve um
 * numero plausivel, e uma historia inteira de `E11` fecharia com contraste
 * reprovado passando por aprovado.
 *
 * Os dois pares sao os canonicos da especificacao: preto sobre branco e
 * `#767676`, o cinza exatamente no limite de `SC 1.4.3` AA.
 */

describe('razaoContraste — a conta da WCAG', () => {
  it('devolve 21 para preto sobre branco', () => {
    expect(razaoContraste([0, 0, 0], [255, 255, 255])).toBe(21)
  })

  it('nao depende da ordem dos argumentos', () => {
    expect(razaoContraste([255, 255, 255], [0, 0, 0])).toBe(21)
  })

  it('devolve 1 para a mesma cor', () => {
    expect(razaoContraste([90, 155, 213], [90, 155, 213])).toBe(1)
  })

  // `#767676` sobre branco e o limiar de 4,5:1 — um decimal a mais ou a menos
  // aqui move a fronteira entre aprovado e reprovado.
  it('devolve 4,54 para #767676 sobre branco', () => {
    expect(razaoContraste([118, 118, 118], [255, 255, 255])).toBe(4.54)
  })

  it('usa a curva sRGB, e nao o valor linear', () => {
    // O trecho linear vale so ate 0,03928 — 10/255 cai nele, 11/255 nao.
    expect(luminancia([10, 10, 10])).toBeCloseTo(0.003035, 5)
    expect(luminancia([255, 255, 255])).toBe(1)
  })
})
