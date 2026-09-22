import { describe, expect, it } from 'vitest'
import { hasForbiddenXmlChar, validateEdit } from '../../src/domain/editable-fields.ts'

/**
 * `D-61`. O caractere que o XML 1.0 nao admite, recusado antes da fila.
 *
 * O que estes testes protegem: que a fronteira seja a do XML 1.0, e nao "todo
 * caractere de controle" — TAB, LF e CR sao validos, e o operador pode
 * digita-los —, e que o emoji, que vive num par de surrogate, continue
 * passando. Os dois erros produzem recusa onde nao deve, ou gravacao que
 * estraga o pool global do arquivo.
 */
describe('hasForbiddenXmlChar — D-61', () => {
  it.each([
    ['U+0000', 'a\u0000b'],
    ['U+0001', 'a\u0001b'],
    ['U+0008', 'a\u0008b'],
    ['U+000B, tab vertical', 'a\u000Bb'],
    ['U+000C, quebra de pagina', 'a\u000Cb'],
    ['U+000E', 'a\u000Eb'],
    ['U+001F', 'a\u001Fb'],
    ['U+FFFE', 'a￾b'],
    ['U+FFFF', 'a￿b'],
    ['surrogate isolado', 'a\uD800b'],
  ])('recusa %s', (_nome, valor) => {
    expect(hasForbiddenXmlChar(valor)).toBe(true)
  })

  it.each([
    ['TAB', 'a\tb'],
    ['LF', 'a\nb'],
    ['CR', 'a\rb'],
    ['espaco', 'a b'],
    ['acento', 'ação'],
    ['emoji, par de surrogate', 'a😀b'],
    ['texto vazio', ''],
  ])('aceita %s', (_nome, valor) => {
    expect(hasForbiddenXmlChar(valor)).toBe(false)
  })
})

describe('validateEdit — D-61', () => {
  it('recusa texto com caractere que o XML nao admite', () => {
    expect(validateEdit('statusRaw', 'SINT\u0001x')).toBe('CARACTERE_INVALIDO')
  })

  it('aceita o mesmo texto sem o caractere', () => {
    expect(validateEdit('statusRaw', 'SINT x')).toBeNull()
  })

  // O motivo que o operador precisa ouvir e o caractere, e nao o tamanho: com
  // os dois defeitos juntos, encurtar o texto nao resolveria.
  it('recusa pelo caractere antes do tamanho', () => {
    expect(validateEdit('statusRaw', `\u0001${'x'.repeat(2000)}`)).toBe('CARACTERE_INVALIDO')
  })

  // A fila e JSON em disco: um numero num campo de texto, editado a mao, nao pode
  // virar `TypeError` — o `write-guard` o registraria como defeito do programa.
  it('recusa valor que nao e texto como corpo invalido, sem lancar', () => {
    expect(validateEdit('clientRaw', 123 as unknown as string)).toBe('CORPO_INVALIDO')
  })

  it('nao muda a validacao de data, que ja recusa qualquer nao-digito', () => {
    expect(validateEdit('eta2', '2026-09-30')).toBeNull()
    expect(validateEdit('eta2', '2026\u0001-09-30')).toBe('CORPO_INVALIDO')
  })
})
