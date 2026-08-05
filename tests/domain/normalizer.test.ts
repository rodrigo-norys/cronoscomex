import { describe, expect, it } from 'vitest'
import { levenshtein, normKey, parseCellDate, serialToDate } from '../../src/domain/normalizer.ts'
import type { RawCell } from '../../src/domain/types.ts'

const texto = (value: string): RawCell => ({ value, type: 'string' })
const numero = (value: number): RawCell => ({ value, type: 'number' })
const data = (value: Date): RawCell => ({ value, type: 'date' })
const vazia: RawCell = { value: null, type: 'null' }

/** Data civil, ancorada em UTC, como o dominio representa. */
const civil = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('normKey — TD-04', () => {
  it('remove espacos ao redor e aplica maiusculas', () => {
    expect(normKey('  acme log  ')).toBe('ACME LOG')
  })

  it('colapsa espacos internos', () => {
    expect(normKey('ACME  LOG')).toBe('ACME LOG')
    expect(normKey('ACME   LOG   LTDA')).toBe('ACME LOG LTDA')
  })

  it('remove diacriticos', () => {
    expect(normKey('DESEMBARAÇADA')).toBe('DESEMBARACADA')
    expect(normKey('DESEMBARÇADA')).toBe('DESEMBARCADA')
    expect(normKey('MERCADORÍA')).toBe('MERCADORIA')
  })

  it('unifica variacao de caixa e espaco num unico grupo', () => {
    const chaves = ['ACME LOG', 'acme log', '  ACME LOG  '].map(normKey)

    expect(new Set(chaves).size).toBe(1)
  })

  // TD-04: a normalizacao NAO corrige digitacao.
  it('mantem nomes parecidos como grupos distintos', () => {
    expect(normKey('NAVIO ALFA')).not.toBe(normKey('NAVIO ALFHA'))
    expect(normKey('ACME')).not.toBe(normKey('ACME - SC'))
  })

  it('devolve string vazia para entrada vazia', () => {
    expect(normKey('')).toBe('')
    expect(normKey('   ')).toBe('')
  })
})

describe('levenshtein', () => {
  it('mede a distancia entre as duas grafias reais de DESEMBARACADA', () => {
    expect(levenshtein('DESEMBARACADA', 'DESEMBARCADA')).toBe(1)
  })

  it('devolve zero para strings iguais', () => {
    expect(levenshtein('ABC', 'ABC')).toBe(0)
  })

  it('devolve o comprimento quando a outra e vazia', () => {
    expect(levenshtein('', 'ABC')).toBe(3)
    expect(levenshtein('ABC', '')).toBe(3)
  })

  it('e simetrica', () => {
    expect(levenshtein('DESEMBARACADO', 'DESEMBARACADA')).toBe(
      levenshtein('DESEMBARACADA', 'DESEMBARACADO'),
    )
  })

  // Os dois valores reais com data anexada estao a distancia 6: acima do
  // limiar 3, portanto nem geram VARIANTE_STATUS_PROXIMA (achado A-53).
  it('coloca "DESEMBARACADA 03/02" acima do limiar de 3', () => {
    expect(levenshtein('DESEMBARACADA 03/02', 'DESEMBARACADA')).toBeGreaterThan(3)
  })
})

describe('parseCellDate — TD-03', () => {
  it('regra 1: Date do ExcelJS vira data civil, com a hora truncada', () => {
    const r = parseCellDate(data(new Date('2026-07-29T00:00:00.000Z')))

    expect(r.date?.toISOString()).toBe('2026-07-29T00:00:00.000Z')
    expect(r.anomaly).toBeNull()
  })

  // O Excel nao armazena fuso. Converter para UTC-3 empurraria a data para o
  // dia anterior — medido: 2026-08-01T00:00Z daria dia 31 em getDate().
  it('nao desloca a data por fuso horario', () => {
    const r = parseCellDate(data(new Date('2026-08-01T00:00:00.000Z')))

    expect(r.date?.getUTCDate()).toBe(1)
    expect(r.date?.getUTCMonth()).toBe(7)
    expect(r.date?.toISOString().slice(0, 10)).toBe('2026-08-01')
  })

  it('regra 2: serial numerico vira data, com o epoch de 1899-12-30', () => {
    // 45292 = 2024-01-01, referencia conhecida do calendario do Excel.
    expect(serialToDate(45292)?.toISOString().slice(0, 10)).toBe('2024-01-01')
    expect(parseCellDate(numero(45292)).date?.toISOString().slice(0, 10)).toBe('2024-01-01')
  })

  it('regra 2: o serial 61 e 1900-03-01, absorvendo o bug do ano bissexto', () => {
    expect(serialToDate(61)?.toISOString().slice(0, 10)).toBe('1900-03-01')
  })

  it('regra 3: texto dd/MM/yyyy', () => {
    const r = parseCellDate(texto('29/07/2026'))

    expect(r.date?.toISOString().slice(0, 10)).toBe('2026-07-29')
    expect(r.anomaly).toBeNull()
  })

  it('regra 4: texto dd/MM/yy assume o seculo 2000', () => {
    expect(parseCellDate(texto('29/07/26')).date?.toISOString().slice(0, 10)).toBe('2026-07-29')
  })

  // A regra 5 e o coracao de TD-03: o ano NUNCA e inferido.
  it('regra 5: texto sem ano devolve null e a anomalia DATA_SEM_ANO', () => {
    for (const entrada of ['29/jul', '04/ago', '29/07', '1/8']) {
      const r = parseCellDate(texto(entrada))

      expect(r.date, `${entrada} nao deveria virar data`).toBeNull()
      expect(r.anomaly).toBe('DATA_SEM_ANO')
    }
  })

  it('regra 6: vazio e espacos devolvem null SEM anomalia', () => {
    for (const entrada of ['', '   ']) {
      const r = parseCellDate(texto(entrada))

      expect(r.date).toBeNull()
      expect(r.anomaly).toBeNull()
    }
    expect(parseCellDate(vazia)).toEqual({ date: null, anomaly: null })
  })

  it('regra 7: formato inesperado devolve null com anomalia', () => {
    for (const entrada of ['OK 23/07', 'N/A', 'BOLETO OK', 'texto qualquer']) {
      const r = parseCellDate(texto(entrada))

      expect(r.date).toBeNull()
      expect(r.anomaly).toBe('DATA_SEM_ANO')
    }
  })

  it('rejeita data invalida em vez de deixar transbordar para o mes seguinte', () => {
    for (const entrada of ['32/13/2026', '31/02/2026', '00/01/2026']) {
      const r = parseCellDate(texto(entrada))

      expect(r.date, `${entrada} nao e data valida`).toBeNull()
      expect(r.anomaly).toBe('DATA_SEM_ANO')
    }
  })

  it('aceita separadores ponto e hifen', () => {
    expect(parseCellDate(texto('29.07.2026')).date?.toISOString().slice(0, 10)).toBe('2026-07-29')
    expect(parseCellDate(texto('29-07-2026')).date?.toISOString().slice(0, 10)).toBe('2026-07-29')
  })

  it('trata Date invalido como anomalia', () => {
    expect(parseCellDate(data(new Date('nao e data'))).anomaly).toBe('DATA_SEM_ANO')
  })

  it('e deterministica: a mesma entrada devolve sempre o mesmo resultado', () => {
    const entrada = texto('29/07/2026')

    expect(parseCellDate(entrada)).toEqual(parseCellDate(entrada))
  })

  it('produz datas comparaveis entre si, para os indicadores de calendario', () => {
    const a = parseCellDate(texto('29/07/2026')).date
    const b = parseCellDate(numero(46232)).date

    expect(a).toBeInstanceOf(Date)
    expect(b).toBeInstanceOf(Date)
    expect(civil('2026-07-29').getTime()).toBe(a?.getTime())
  })
})
