import { describe, expect, it } from 'vitest'
import {
  parseSharedStrings,
  parseSheetRows,
  parseStyles,
  type SheetParseOptions,
  type StyleIndex,
} from '../../src/io/xlsx-parts.ts'

/**
 * Os casos abaixo usam XML literal, e nao fixture, de proposito: nenhuma das 9
 * fixtures tem richText, inlineStr, t="b" nem t="e". `tools/build_fixtures.py`
 * deriva do arquivo real e reescreve o sharedStrings do zero, e RNF-37 proibe
 * apontar teste para a planilha. Sem estes casos, os limites que H-33 declara
 * ficariam sem prova.
 */

const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF00FF00"/><bgColor indexed="64"/></patternFill></fill>',
  '<fill><patternFill patternType="solid"><fgColor theme="4" tint="-0.249977111117893"/></patternFill></fill>',
  '<fill><patternFill patternType="solid"><fgColor indexed="43"/></patternFill></fill>',
  '<fill><gradientFill degree="90"><stop position="0"><color rgb="FFFFFFFF"/></stop></gradientFill></fill>',
  '<fill><patternFill patternType="solid"/></fill>',
].join('')

const XFS = [
  '<xf numFmtId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fillId="2" borderId="5" xfId="0" applyFill="1"><alignment vertical="center"/></xf>',
  '<xf numFmtId="16" fillId="3" borderId="2" xfId="0" applyNumberFormat="1"/>',
  '<xf numFmtId="164" fillId="4" borderId="0" xfId="0"/>',
  '<xf numFmtId="165" fillId="5" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fillId="6" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fillId="1" borderId="0" xfId="0"/>',
  '<xf fontId="1" xfId="0"/>',
].join('')

const NUM_FMTS =
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="[$-416]d\\-mmm;@"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>'

const stylesXml = `<?xml version="1.0" encoding="UTF-8"?><styleSheet>${NUM_FMTS}<fills count="7">${FILLS}</fills><cellXfs count="8">${XFS}</cellXfs></styleSheet>`

describe('parseStyles — chave de estilo (TD-05)', () => {
  const styles = parseStyles(stylesXml)

  it('deriva a chave do fillId do cellXf, e nao do styleId', () => {
    expect(styles.styleKeyOf(1)).toBe('argb:FF00FF00')
    expect(styles.styleKeyOf(2)).toBe('theme:4|tint:-0.2500')
    expect(styles.styleKeyOf(3)).toBe('indexed:43')
  })

  it('devolve "none" para preenchimento ausente, em gradiente ou sem fgColor', () => {
    expect(styles.styleKeyOf(0)).toBe('none')
    expect(styles.styleKeyOf(4)).toBe('none')
    expect(styles.styleKeyOf(5)).toBe('none')
    expect(styles.styleKeyOf(6)).toBe('none')
  })

  it('devolve "none" para celula sem estilo e para styleId inexistente', () => {
    expect(styles.styleKeyOf(null)).toBe('none')
    expect(styles.styleKeyOf(999)).toBe('none')
  })

  it('nao exige applyFill: o xf 7 nao declara fillId e cai no fill 0', () => {
    expect(styles.styleKeyOf(7)).toBe('none')
  })
})

describe('parseStyles — formato de data', () => {
  const styles = parseStyles(stylesXml)

  it('reconhece os embutidos de data e recusa o formato geral', () => {
    expect(styles.isDateFormat(2)).toBe(true)
    expect(styles.isDateFormat(0)).toBe(false)
    expect(styles.isDateFormat(null)).toBe(false)
  })

  it('reconhece formato declarado em <numFmts>, ignorando o seletor de locale', () => {
    expect(styles.isDateFormat(3)).toBe(true)
    expect(styles.isDateFormat(4)).toBe(false)
  })

  it('a declaracao do arquivo vence o embutido de mesmo id', () => {
    const redefinido = parseStyles(
      `<styleSheet><numFmts count="1"><numFmt numFmtId="16" formatCode="#,##0"/></numFmts><fills count="1">${FILLS}</fills><cellXfs count="1"><xf numFmtId="16" fillId="0"/></cellXfs></styleSheet>`,
    )

    expect(redefinido.isDateFormat(0)).toBe(false)
  })
})

describe('parseSharedStrings', () => {
  it('le um item simples e preserva o espaco declarado', () => {
    const pool = parseSharedStrings(
      '<sst><si><t>FT001.26</t></si><si><t xml:space="preserve"> AG BL </t></si></sst>',
    )

    expect(pool).toEqual(['FT001.26', ' AG BL '])
  })

  it('concatena os fragmentos de richText', () => {
    const pool = parseSharedStrings(
      '<sst><si><r><rPr><b/></rPr><t>DESEMBARA</t></r><r><t>CADA</t></r></si></sst>',
    )

    expect(pool).toEqual(['DESEMBARACADA'])
  })

  it('desfaz as entidades XML, nomeadas e numericas', () => {
    const pool = parseSharedStrings(
      '<sst><si><t>A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;</t></si><si><t>F&#10;G&#x41;</t></si></sst>',
    )

    expect(pool).toEqual([`A & B <C> "D" 'E'`, 'F\nGA'])
  })

  it('ignora a leitura fonetica e aceita item vazio', () => {
    const pool = parseSharedStrings(
      '<sst><si><t>TOKYO</t><rPh sb="0" eb="2"><t>IGNORAR</t></rPh></si><si><t/></si><si/></sst>',
    )

    expect(pool).toEqual(['TOKYO', '', ''])
  })
})

const semData: StyleIndex = { styleKeyOf: () => 'none', isDateFormat: () => false }

function options(overrides: Partial<SheetParseOptions> = {}): SheetParseOptions {
  return {
    sharedStrings: ['REF-A', '', 'ACME LOG'],
    styles: semData,
    firstDataRow: 2,
    date1904: false,
    ...overrides,
  }
}

const sheet = (linhas: string) =>
  `<?xml version="1.0"?><worksheet><dimension ref="A1:P4"/><sheetData>${linhas}</sheetData></worksheet>`

describe('parseSheetRows — valor da celula', () => {
  it('resolve t="s" pelo pool, e texto vazio vira ausencia', () => {
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c></row>'),
      options(),
    )

    expect(linha?.cells.A).toEqual({ value: 'REF-A', type: 'string' })
    expect(linha?.cells.B).toEqual({ value: null, type: 'null' })
  })

  it('le inlineStr e t="str", desfazendo entidades', () => {
    const [linha] = parseSheetRows(
      sheet(
        '<row r="2"><c r="A2" t="inlineStr"><is><r><t>AG </t></r><r><t>BL</t></r></is></c><c r="B2" t="str"><f>X</f><v>A &amp; B</v></c></row>',
      ),
      options(),
    )

    expect(linha?.cells.A).toEqual({ value: 'AG BL', type: 'string' })
    expect(linha?.cells.B).toEqual({ value: 'A & B', type: 'string' })
  })

  it('booleano e erro nao viram valor', () => {
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" t="b"><v>1</v></c><c r="B2" t="e"><v>#REF!</v></c></row>'),
      options(),
    )

    expect(linha?.cells.A).toEqual({ value: null, type: 'null' })
    expect(linha?.cells.B).toEqual({ value: null, type: 'null' })
  })

  it('numero sem formato de data continua numero', () => {
    const [linha] = parseSheetRows(sheet('<row r="2"><c r="A2"><v>46235</v></c></row>'), options())

    expect(linha?.cells.A).toEqual({ value: 46235, type: 'number' })
  })

  it('numero com formato de data vira Date ancorada em UTC', () => {
    const comData: StyleIndex = { styleKeyOf: () => 'none', isDateFormat: (id) => id === 7 }
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" s="7"><v>46235</v></c></row>'),
      options({ styles: comData }),
    )

    expect((linha?.cells.A?.value as Date | undefined)?.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    )
    expect(linha?.cells.A?.type).toBe('date')
  })

  it('respeita o epoch de 1904 quando o arquivo o declara', () => {
    const comData: StyleIndex = { styleKeyOf: () => 'none', isDateFormat: () => true }
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" s="7"><v>44773</v></c></row>'),
      options({ styles: comData, date1904: true }),
    )

    expect((linha?.cells.A?.value as Date | undefined)?.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    )
  })

  it('formula vale o resultado, nunca a expressao — inclusive compartilhada', () => {
    const [linha] = parseSheetRows(
      sheet(
        '<row r="2"><c r="A2"><f>K2-4</f><v>46235</v></c><c r="B2"><f t="shared" si="0"/><v>17</v></c></row>',
      ),
      options(),
    )

    expect(linha?.cells.A).toEqual({ value: 46235, type: 'number' })
    expect(linha?.cells.B).toEqual({ value: 17, type: 'number' })
  })

  it('celula sem <v> e numero ilegivel viram ausencia', () => {
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" s="1"/><c r="B2"><v>N/A</v></c></row>'),
      options(),
    )

    expect(linha?.cells.A).toEqual({ value: null, type: 'null' })
    expect(linha?.cells.B).toEqual({ value: null, type: 'null' })
  })
})

describe('parseSheetRows — forma da linha', () => {
  it('preenche o buraco entre colunas e para na ultima celula presente', () => {
    const [linha] = parseSheetRows(
      sheet('<row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" t="s"><v>2</v></c></row>'),
      options(),
    )

    expect(Object.keys(linha?.cells ?? {})).toEqual(['A', 'B', 'C'])
    expect(linha?.cells.B).toEqual({ value: null, type: 'null' })
  })

  it('numera a partir de firstDataRow, descartando o cabecalho', () => {
    const linhas = parseSheetRows(
      sheet('<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"/><row r="3"/>'),
      options(),
    )

    expect(linhas.map((l) => l.sourceRow)).toEqual([2, 3])
  })

  it('sem o atributo r, linha e celula sao as seguintes', () => {
    const linhas = parseSheetRows(
      sheet('<row><c t="s"><v>0</v></c></row><row><c t="s"><v>2</v></c></row>'),
      options(),
    )

    expect(linhas.map((l) => l.sourceRow)).toEqual([2])
    expect(linhas[0]?.cells.A?.value).toBe('ACME LOG')
  })

  it('a chave de estilo vem da coluna A, mesmo com a celula vazia', () => {
    const porColuna: StyleIndex = {
      styleKeyOf: (id) => (id === 165 ? 'argb:FF00FF00' : 'none'),
      isDateFormat: () => false,
    }
    const linhas = parseSheetRows(
      sheet(
        '<row r="2"><c r="A2" s="165"/><c r="B2" s="279" t="s"><v>0</v></c></row><row r="3"><c r="B3" s="165" t="s"><v>0</v></c></row>',
      ),
      options({ styles: porColuna }),
    )

    expect(linhas[0]?.styleKey).toBe('argb:FF00FF00')
    expect(linhas[1]?.styleKey).toBe('none')
  })

  it('aba sem nenhuma linha devolve conjunto vazio', () => {
    expect(parseSheetRows('<worksheet><sheetData/></worksheet>', options())).toEqual([])
    expect(parseSheetRows(sheet(''), options())).toEqual([])
  })
})
