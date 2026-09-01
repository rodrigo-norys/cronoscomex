import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { applyCellEdits } from '../../src/io/xlsx-surgeon.ts'

/**
 * Os hashes comparam o CONTEUDO DESCOMPRIMIDO de cada entrada do zip, nao os
 * bytes comprimidos: recompactar reproduz o conteudo, nao o fluxo deflate do
 * Excel. E o conteudo que carrega formatacao condicional, validacao e
 * comentario — o que ADR-0004 existe para preservar.
 */

const SHEET_PATH = 'xl/worksheets/sheet1.xml'
const SHARED_STRINGS_PATH = 'xl/sharedStrings.xml'
const STYLES_PATH = 'xl/styles.xml'
const CALC_CHAIN_PATH = 'xl/calcChain.xml'

// Excel exibiria este serial cru caso a celula ficasse sem numFmt de data (A-56).
const SERIAL_29_AGO_2026 = 46_263
const DATE_FMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47, 164])

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`tests/fixtures/${name}`))
}

function entriesOf(buffer: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(buffer)
}

function sheetOf(buffer: Uint8Array): string {
  return textOf(buffer, SHEET_PATH)
}

function textOf(buffer: Uint8Array, path: string): string {
  const entry = entriesOf(buffer)[path]
  if (!entry) throw new Error(`entrada ausente do zip: ${path}`)
  return strFromU8(entry)
}

function cellOf(sheetXml: string, reference: string): string | null {
  const pattern = new RegExp(
    `<c r="${reference}"(?:\\s[^>]*?)?/>|<c r="${reference}"(?:\\s[^>]*?)?>[\\s\\S]*?</c>`,
  )
  return pattern.exec(sheetXml)?.[0] ?? null
}

function styleOf(cell: string): string | null {
  return /\ss="(\d+)"/.exec(cell)?.[1] ?? null
}

function cellXfsOf(stylesXml: string): string[] {
  const section = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(stylesXml)
  return section?.[1]?.match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g) ?? []
}

function numFmtOf(stylesXml: string, styleId: string): number {
  const xf = cellXfsOf(stylesXml)[Number(styleId)]
  return Number(/numFmtId="(\d+)"/.exec(xf ?? '')?.[1] ?? '0')
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

// Monta variantes da fixture em memoria, para cenarios que o arquivo versionado
// nao carrega. A fixture em disco nunca e tocada.
function rezip(buffer: Uint8Array, transformarAba: (xml: string) => string): Uint8Array {
  const entries = entriesOf(buffer)
  const aba = entries[SHEET_PATH]
  if (!aba) throw new Error('aba ausente da fixture')
  return zipSync({ ...entries, [SHEET_PATH]: strToU8(transformarAba(strFromU8(aba))) })
}

function withEntry(buffer: Uint8Array, path: string, content: string): Uint8Array {
  return zipSync({ ...entriesOf(buffer), [path]: strToU8(content) })
}

describe('applyCellEdits — critérios de aceite', () => {
  it('preserva formatação condicional, validação, autofiltro e coluna oculta ao alterar texto', () => {
    const original = fixture('formatado.xlsx')
    const antes = sheetOf(original)

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'CLIENTE ALTERADO' }],
      SHEET_PATH,
    )
    const depois = sheetOf(buffer)

    for (const elemento of [
      'conditionalFormatting',
      'dataValidation',
      'autoFilter',
      'hidden="1"',
    ]) {
      expect(antes, `a fixture precisa conter ${elemento} para o teste valer`).toContain(elemento)
      expect(depois, `${elemento} foi destruído pela cirurgia`).toContain(elemento)
    }
  })

  it('mantém idêntica toda entrada do zip fora da aba, sharedStrings e styles', () => {
    const original = fixture('formatado.xlsx')
    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'OUTRO CLIENTE' }],
      SHEET_PATH,
    )

    const antes = entriesOf(original)
    const depois = entriesOf(buffer)
    const tocadas = new Set([SHEET_PATH, SHARED_STRINGS_PATH, STYLES_PATH, CALC_CHAIN_PATH])

    expect(Object.keys(depois).sort()).toEqual(Object.keys(antes).sort())

    const divergentes = Object.keys(antes)
      .filter((path) => !tocadas.has(path))
      .filter(
        (path) =>
          digest(antes[path] ?? new Uint8Array()) !== digest(depois[path] ?? new Uint8Array()),
      )

    expect(divergentes).toEqual([])
  })

  it('preserva o atributo s= — mudar valor não muda cor', () => {
    const original = fixture('formatado.xlsx')
    const estiloOriginal = styleOf(cellOf(sheetOf(original), 'B2') ?? '')

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'NOME NOVO' }],
      SHEET_PATH,
    )

    expect(estiloOriginal).not.toBeNull()
    expect(styleOf(cellOf(sheetOf(buffer), 'B2') ?? '')).toBe(estiloOriginal)
  })

  it('grava data como serial e garante numFmt de data em célula com estilo Geral', () => {
    const original = fixture('data-vazia.xlsx')
    expect(
      numFmtOf(
        textOf(original, STYLES_PATH),
        styleOf(cellOf(sheetOf(original), 'O2') ?? '') ?? '0',
      ),
    ).toBe(0)

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'O2') ?? ''
    expect(celula).toContain(`<v>${SERIAL_29_AGO_2026}</v>`)
    expect(DATE_FMT_IDS.has(numFmtOf(textOf(buffer, STYLES_PATH), styleOf(celula) ?? '0'))).toBe(
      true,
    )
  })

  it('preserva o estilo quando a célula já tem formato de data, sem criar cellXf', () => {
    const original = fixture('data-vazia.xlsx')
    const estiloOriginal = styleOf(cellOf(sheetOf(original), 'O4') ?? '')
    const xfsAntes = cellXfsOf(textOf(original, STYLES_PATH)).length

    expect(DATE_FMT_IDS.has(numFmtOf(textOf(original, STYLES_PATH), estiloOriginal ?? '0'))).toBe(
      true,
    )

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 4, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) }],
      SHEET_PATH,
    )

    expect(styleOf(cellOf(sheetOf(buffer), 'O4') ?? '')).toBe(estiloOriginal)
    expect(cellXfsOf(textOf(buffer, STYLES_PATH)).length).toBe(xfsAntes)
  })

  it('esvazia a célula preservando o estilo quando o valor é null', () => {
    const original = fixture('formatado.xlsx')
    const estiloOriginal = styleOf(cellOf(sheetOf(original), 'B2') ?? '')

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: null }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'B2') ?? ''
    expect(celula).toBe(`<c r="B2" s="${estiloOriginal}"/>`)
  })

  // Regressao: a celula vazia termina em `/>`, e uma regex que trate isso como
  // sufixo opcional varre ate o `</c>` da celula SEGUINTE, apagando-a. Foi o
  // defeito real desta fatia.
  it('não afeta as células vizinhas ao esvaziar uma célula no meio da linha', () => {
    const original = fixture('formatado.xlsx')
    const vizinhas = ['A2', 'C2', 'D2'].map((ref) => cellOf(sheetOf(original), ref))

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: null }],
      SHEET_PATH,
    )

    const depois = sheetOf(buffer)
    expect(['A2', 'C2', 'D2'].map((ref) => cellOf(depois, ref))).toEqual(vizinhas)
  })

  it('não vaza para a linha seguinte ao editar a última célula de uma linha', () => {
    const original = fixture('data-vazia.xlsx')
    const linhaSeguinte = /<row r="3"[^>]*>[\s\S]*?<\/row>/.exec(sheetOf(original))?.[0]

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'O', value: null }],
      SHEET_PATH,
    )

    expect(/<row r="3"[^>]*>[\s\S]*?<\/row>/.exec(sheetOf(buffer))?.[0]).toBe(linhaSeguinte)
  })

  it('só acrescenta a xl/styles.xml, nunca altera xf existente', () => {
    const original = fixture('data-vazia.xlsx')
    const xfsAntes = cellXfsOf(textOf(original, STYLES_PATH))

    const { buffer } = applyCellEdits(
      original,
      [
        { sourceRow: 2, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) },
        { sourceRow: 2, column: 'L', value: new Date(Date.UTC(2026, 7, 29)) },
      ],
      SHEET_PATH,
    )

    const xfsDepois = cellXfsOf(textOf(buffer, STYLES_PATH))
    expect(xfsDepois.length).toBeGreaterThanOrEqual(xfsAntes.length)
    expect(xfsDepois.slice(0, xfsAntes.length)).toEqual(xfsAntes)
  })
})

describe('applyCellEdits — casos-limite', () => {
  it('insere <c> novo na posição correta quando a célula não existe no XML', () => {
    const original = fixture('data-vazia.xlsx')
    expect(cellOf(sheetOf(original), 'O3')).toBeNull()

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 3, column: 'O', value: 'INSERIDA' }],
      SHEET_PATH,
    )

    const linha = /<row r="3"[^>]*>([\s\S]*?)<\/row>/.exec(sheetOf(buffer))?.[1] ?? ''
    const colunas = [...linha.matchAll(/<c r="([A-Z]+)\d+"/g)].map((match) => match[1])

    expect(colunas).toContain('O')
    expect(colunas).toEqual([...colunas].sort())
  })

  it('reutiliza o índice quando a string já existe em sharedStrings', () => {
    const original = fixture('formatado.xlsx')
    const antes = textOf(original, SHARED_STRINGS_PATH)
    const existente = /<si><t>([^<]+)<\/t><\/si>/.exec(antes)?.[1] ?? ''

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: existente }],
      SHEET_PATH,
    )

    const depois = textOf(buffer, SHARED_STRINGS_PATH)
    expect((depois.match(/<si>/g) ?? []).length).toBe((antes.match(/<si>/g) ?? []).length)
    expect(/uniqueCount="(\d+)"/.exec(depois)?.[1]).toBe(/uniqueCount="(\d+)"/.exec(antes)?.[1])
  })

  it('acrescenta string nova ao fim, atualizando count e uniqueCount', () => {
    const original = fixture('formatado.xlsx')
    const antes = textOf(original, SHARED_STRINGS_PATH)
    const total = Number(/uniqueCount="(\d+)"/.exec(antes)?.[1])

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'STRING INEDITA NESTE ARQUIVO' }],
      SHEET_PATH,
    )

    const depois = textOf(buffer, SHARED_STRINGS_PATH)
    expect(Number(/uniqueCount="(\d+)"/.exec(depois)?.[1])).toBe(total + 1)
    expect(depois).toContain('<si><t>STRING INEDITA NESTE ARQUIVO</t></si>')

    // `count` conta REFERENCIAS, nao entradas: sobrescrever uma celula que ja
    // era t="s" nao muda o total, mesmo com a string nova entrando no pool.
    expect(/\scount="(\d+)"/.exec(depois)?.[1]).toBe(/\scount="(\d+)"/.exec(antes)?.[1])
  })

  it('remove o nó <f> ao substituir o valor de célula que continha fórmula', () => {
    const original = fixture('formatado.xlsx')
    expect(cellOf(sheetOf(original), 'N9')).toContain('<f>')

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'N9') ?? ''
    expect(celula).not.toContain('<f>')
    expect(celula).toContain('t="s"')
  })

  it('grava data na coluna O garantindo o formato, não presumindo', () => {
    const original = fixture('data-vazia.xlsx')
    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'O2') ?? ''
    expect(numFmtOf(textOf(buffer, STYLES_PATH), styleOf(celula) ?? '0')).not.toBe(0)
  })

  it('escapa &, < e " no texto gravado', () => {
    const original = fixture('formatado.xlsx')
    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'A & B <tag> "aspas"' }],
      SHEET_PATH,
    )

    const strings = textOf(buffer, SHARED_STRINGS_PATH)
    expect(strings).toContain('A &amp; B &lt;tag&gt; &quot;aspas&quot;')
    expect(strings).not.toContain('<tag>')
  })

  it('preserva quebra de linha com xml:space="preserve"', () => {
    const original = fixture('formatado.xlsx')
    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'B', value: 'linha um\nlinha dois' }],
      SHEET_PATH,
    )

    const strings = textOf(buffer, SHARED_STRINGS_PATH)
    expect(strings).toContain('<t xml:space="preserve">linha um\nlinha dois</t>')
  })

  it('devolve o buffer original inalterado quando a lista de edições é vazia', () => {
    const original = fixture('formatado.xlsx')
    const resultado = applyCellEdits(original, [], SHEET_PATH)

    expect(resultado.cellsWritten).toBe(0)
    expect(resultado.buffer).toBe(original)
    expect(resultado.entriesPreserved).toBe(Object.keys(entriesOf(original)).length)
  })
})

// Os dois primeiros nasceram de achados do revisor-xml: a suíte anterior
// gravava texto em célula ausente e data em célula existente, e nunca cruzava
// os dois eixos.
describe('applyCellEdits — achados da revisão adversarial', () => {
  it('garante formato de data mesmo quando a célula não existe no XML', () => {
    const original = fixture('data-vazia.xlsx')
    expect(cellOf(sheetOf(original), 'O3')).toBeNull()

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 3, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'O3') ?? ''
    expect(celula).toContain(`<v>${SERIAL_29_AGO_2026}</v>`)
    expect(styleOf(celula), 'célula sem s= cai em Geral e o Excel exibe o serial').not.toBeNull()
    expect(DATE_FMT_IDS.has(numFmtOf(textOf(buffer, STYLES_PATH), styleOf(celula) ?? '0'))).toBe(
      true,
    )
  })

  it('mantém o XML bem-formado ao inserir célula em linha auto-fechada', () => {
    const original = fixture('data-vazia.xlsx')
    // A forma que o Excel emite para linha formatada sem nenhuma célula.
    const comLinhaVazia = rezip(original, (xml) =>
      xml.replace(
        /<row r="3"[^>]*>[\s\S]*?<\/row>/,
        '<row r="3" spans="1:16" s="215" customFormat="1"/>',
      ),
    )

    const { buffer } = applyCellEdits(
      comLinhaVazia,
      [{ sourceRow: 3, column: 'O', value: 'INSERIDA' }],
      SHEET_PATH,
    )

    const depois = sheetOf(buffer)
    expect(depois).not.toContain('/<c')
    expect(depois).toContain('<row r="3" spans="1:16" s="215" customFormat="1">')
    expect(cellOf(depois, 'O3')).toContain('t="s"')
    expect(depois.match(/<row /g)?.length).toBe(depois.match(/<\/row>/g)?.length)
  })

  it('trunca a hora do dia em vez de arredondar para o dia seguinte', () => {
    const original = fixture('data-vazia.xlsx')
    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'O', value: new Date(Date.UTC(2026, 7, 29, 18, 30)) }],
      SHEET_PATH,
    )

    expect(cellOf(sheetOf(buffer), 'O2')).toContain(`<v>${SERIAL_29_AGO_2026}</v>`)
  })

  it('remove da cadeia de cálculo a célula cuja fórmula saiu', () => {
    const comCadeia = withEntry(
      fixture('formatado.xlsx'),
      CALC_CHAIN_PATH,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<c r="N9" i="1"/><c r="A1"/></calcChain>',
    )

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )

    const cadeia = textOf(buffer, CALC_CHAIN_PATH)
    expect(cadeia).not.toContain('r="N9"')
    // `i` era herdado da entrada removida: sem repassá-lo, A1 mudaria de aba.
    expect(cadeia).toContain('<c r="A1" i="1"/>')
  })

  /**
   * O mesmo caso sobre um `.xlsx` COMPLETO: `formulas.xlsx` traz a cadeia
   * declarada em `[Content_Types].xml` e relacionada em
   * `xl/_rels/workbook.xml.rels`, gerada por `--formulas` a partir de
   * `basico.xlsx`. Os testes acima montam a entrada dentro do próprio teste, o
   * que provava o algoritmo contra o entendimento de quem o escreveu.
   *
   * A entrada seguinte carrega `l="1"`. O Excel emite `l`, `s`, `t` e `a` nas
   * entradas de `calcChain`, e a primeira versão desta fixture usava só `r` —
   * a mesma forma do teste sintético que ela deveria superar. Com isso o
   * defeito passava: o repasse do `i` casava apenas `<c r="…"/>`, e a cadeia
   * inteira ficava sem índice de aba em todo arquivo produzido pelo Excel.
   * Achado do `revisor-xml`.
   */
  it('repassa o `i` mesmo quando a entrada seguinte tem outros atributos', () => {
    const original = fixture('formulas.xlsx')
    expect(textOf(original, CALC_CHAIN_PATH)).toContain('<c r="I2" i="1"/>')
    expect(textOf(original, CALC_CHAIN_PATH)).toContain('<c r="I3" l="1"/>')

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 2, column: 'I', value: new Date(Date.UTC(2026, 8, 15)) }],
      SHEET_PATH,
    )

    const cadeia = textOf(buffer, CALC_CHAIN_PATH)
    expect(cadeia).not.toContain('r="I2"')
    expect(cadeia).toContain('<c r="I3" l="1" i="1"/>')
    expect(cadeia).toContain('<c r="I4"/>')

    // A fórmula saiu e o estilo de data ficou: sem ele o Excel mostraria o
    // serial cru, que é A-56.
    const celula = cellOf(sheetOf(buffer), 'I2') ?? ''
    expect(celula).not.toContain('<f>')
    expect(celula).toContain('s="167"')
  })

  // Cadeia que passou por um formatador de XML, ou por outro produtor. As duas
  // formas são XML legal, e casar só a compacta e adjacente fazia a cadeia
  // inteira perder o índice de aba. Achado do `revisor-xml`.
  it.each([
    [
      'espaço entre as entradas',
      '<c r="N9" i="1"/>\n  <c r="A1" l="1"/>',
      '<c r="A1" l="1" i="1"/>',
    ],
    ['fechamento por tag', '<c r="N9" i="1"/><c r="A1" l="1"></c>', '<c r="A1" l="1" i="1"></c>'],
  ])('repassa o `i` com %s', (_titulo, entradas, esperado) => {
    const comCadeia = withEntry(
      fixture('formatado.xlsx'),
      CALC_CHAIN_PATH,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${entradas}</calcChain>`,
    )

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )

    expect(textOf(buffer, CALC_CHAIN_PATH)).toContain(esperado)
  })

  // As duas formas de fechamento valem nos dois lados. Com a remoção aceitando
  // só `/>`, duas edições na mesma cadeia deixavam órfã a entrada que a
  // primeira edição tinha acabado de reescrever. Achado do `revisor-xml`.
  it('remove a entrada fechada por tag, e não só a auto-fechada', () => {
    const comCadeia = withEntry(
      fixture('formatado.xlsx'),
      CALC_CHAIN_PATH,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<c r="N9" i="1"></c><c r="A1" l="1"/></calcChain>',
    )

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )

    const cadeia = textOf(buffer, CALC_CHAIN_PATH)
    expect(cadeia).not.toContain('r="N9"')
    expect(cadeia).toContain('<c r="A1" l="1" i="1"/>')
  })

  /**
   * **A forma que o Excel realmente emite, e ela refuta a premissa de `PD-05`**
   * (01/09/2026).
   *
   * A pendência supunha que o Excel emite `i` apenas na PRIMEIRA entrada, com
   * as seguintes herdando a aba — o que a especificação OOXML permite. Medido em
   * dois arquivos que o Excel gerou sozinho, um do **desktop** e outro do
   * **Excel Online**: os dois emitem `i` em **todas** as entradas. O do desktop
   * tem **705 entradas, 705 com `i`**, em dois índices de aba (`1` e `3`) e com
   * `l` e `s` misturados.
   *
   * A entrada deste teste reproduz essa forma. **Nenhum `i` é injetado**, porque
   * cada entrada já tem o seu — e injetar produziria atributo duplicado, que é
   * XML malformado e o Excel recusaria com pedido de reparo.
   *
   * O caso da herança continua coberto pelos testes acima: a especificação
   * permite omitir `i`, e um formatador ou outro produtor pode fazê-lo.
   */
  it('preserva a cadeia na forma que o Excel emite — `i` em toda entrada', () => {
    const comoOExcelEmite =
      '<c r="L57" i="3" l="1"/><c r="N9" i="3"/><c r="F57" i="3"/>' +
      '<c r="K51" i="3" s="1"/><c r="I3" i="1"/><c r="I4" i="1"/>'
    const comCadeia = withEntry(
      fixture('formatado.xlsx'),
      CALC_CHAIN_PATH,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${comoOExcelEmite}</calcChain>`,
    )

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )
    const cadeia = textOf(buffer, CALC_CHAIN_PATH)

    expect(cadeia).not.toContain('r="N9"')
    // As cinco restantes intactas, e nenhuma com `i` duplicado.
    expect(cadeia).toContain('<c r="L57" i="3" l="1"/><c r="F57" i="3"/>')
    expect(cadeia).toContain('<c r="K51" i="3" s="1"/><c r="I3" i="1"/><c r="I4" i="1"/>')
    expect(/i="[^"]*"[^>]*i="/.test(cadeia)).toBe(false)
  })

  // A seguinte com `i` proprio nao herda nada: sobrescreve-lo trocaria a aba
  // dela, que e o mesmo defeito na direcao oposta.
  it('não sobrescreve o `i` próprio da entrada seguinte', () => {
    const comCadeia = withEntry(
      fixture('formatado.xlsx'),
      CALC_CHAIN_PATH,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<c r="N9" i="1"/><c r="A1" i="3"/></calcChain>',
    )

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 9, column: 'N', value: 'VALOR FIXO' }],
      SHEET_PATH,
    )

    expect(textOf(buffer, CALC_CHAIN_PATH)).toContain('<c r="A1" i="3"/>')
  })

  it('não toca a cadeia de cálculo quando nenhuma fórmula é removida', () => {
    const cadeiaOriginal =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<c r="N9" i="1"/></calcChain>'
    const comCadeia = withEntry(fixture('formatado.xlsx'), CALC_CHAIN_PATH, cadeiaOriginal)

    const { buffer } = applyCellEdits(
      comCadeia,
      [{ sourceRow: 2, column: 'B', value: 'SEM MEXER EM FORMULA' }],
      SHEET_PATH,
    )

    expect(textOf(buffer, CALC_CHAIN_PATH)).toBe(cadeiaOriginal)
  })

  it('recusa sobrescrever a célula mestre de uma fórmula compartilhada', () => {
    const comCompartilhada = rezip(fixture('formatado.xlsx'), (xml) =>
      xml.replace(
        /<c r="N9"[^>]*>[\s\S]*?<\/c>/,
        '<c r="N9" s="214"><f t="shared" ref="N9:N10" si="0">1+1</f><v>2</v></c>',
      ),
    )

    expect(() =>
      applyCellEdits(comCompartilhada, [{ sourceRow: 9, column: 'N', value: 'X' }], SHEET_PATH),
    ).toThrow(/formula compartilhada/)
  })

  it('permite sobrescrever uma dependente de fórmula compartilhada', () => {
    const comDependente = rezip(fixture('formatado.xlsx'), (xml) =>
      xml.replace(
        /<c r="N9"[^>]*>[\s\S]*?<\/c>/,
        '<c r="N9" s="214"><f t="shared" si="0"/><v>2</v></c>',
      ),
    )

    const { buffer } = applyCellEdits(
      comDependente,
      [{ sourceRow: 9, column: 'N', value: 'X' }],
      SHEET_PATH,
    )

    expect(cellOf(sheetOf(buffer), 'N9')).not.toContain('<f')
  })

  it('usa o formato de data do próprio arquivo, não um embutido alheio', () => {
    const original = fixture('data-vazia.xlsx')
    const formatosExistentes = cellXfsOf(textOf(original, STYLES_PATH))
      .map((xf) => Number(/numFmtId="(\d+)"/.exec(xf)?.[1] ?? '0'))
      .filter((id) => DATE_FMT_IDS.has(id))

    const { buffer } = applyCellEdits(
      original,
      [{ sourceRow: 3, column: 'O', value: new Date(Date.UTC(2026, 7, 29)) }],
      SHEET_PATH,
    )

    const celula = cellOf(sheetOf(buffer), 'O3') ?? ''
    const escolhido = numFmtOf(textOf(buffer, STYLES_PATH), styleOf(celula) ?? '0')
    expect(formatosExistentes).toContain(escolhido)
  })
})
