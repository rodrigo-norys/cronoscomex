import { readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { applyRowFill, type RowFillEdit } from '../../src/io/xlsx-surgeon.ts'

/**
 * A repintura de linha — TD-05.1 aplicado ao `fillId` (achado A-49).
 *
 * As fixtures carregam o `xl/styles.xml` REAL da planilha (ver o cabecalho de
 * `tools/build_fixtures.py`), entao os styleIds citados nos criterios de aceite
 * de `H-27` existem aqui com a mesma tupla medida em `H-01`:
 *
 * - 165 = (numFmt 0, font 1, fill 2, border **5**)
 * - 181 = (numFmt 0, font 1, fill **8**, border 34)
 * - 215 = (numFmt 0, font 1, fill 9, border **34**)
 *
 * O criterio fala em 199 → 181; 199 e 215 tem a MESMA borda 34, e `cores.xlsx`
 * traz 215. O ramo provado e o mesmo: tupla resultante que ja existe e reusada.
 */

const SHEET_PATH = 'xl/worksheets/sheet1.xml'
const STYLES_PATH = 'xl/styles.xml'

/** Azul — `argb:FF5B9BD5`, `responsible = colaborador1` em `config/color-map.json`. */
const AZUL = 8
const TODAS_AS_COLUNAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`tests/fixtures/${name}`))
}

function textOf(buffer: Uint8Array, path: string): string {
  const entry = unzipSync(buffer)[path]
  if (!entry) throw new Error(`entrada ausente do zip: ${path}`)
  return strFromU8(entry)
}

function cellOf(sheetXml: string, reference: string): string | null {
  const pattern = new RegExp(
    `<c r="${reference}"(?:\\s[^>]*?)?/>|<c r="${reference}"(?:\\s[^>]*?)?>[\\s\\S]*?</c>`,
  )
  return pattern.exec(sheetXml)?.[0] ?? null
}

function styleOf(sheetXml: string, reference: string): string | null {
  const cell = cellOf(sheetXml, reference)
  return cell === null ? null : (/\ss="(\d+)"/.exec(cell)?.[1] ?? null)
}

function cellValueOf(sheetXml: string, reference: string): string | null {
  const cell = cellOf(sheetXml, reference)
  return cell === null ? null : (/<v>([\s\S]*?)<\/v>/.exec(cell)?.[1] ?? null)
}

function cellXfsOf(stylesXml: string): string[] {
  const section = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(stylesXml)
  return section?.[1]?.match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g) ?? []
}

function declaredCount(stylesXml: string): number {
  return Number(/<cellXfs count="(\d+)"/.exec(stylesXml)?.[1] ?? '0')
}

function attributeOf(xf: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(xf)?.[1] ?? null
}

function xfAt(stylesXml: string, styleId: string | null): string {
  const xf = cellXfsOf(stylesXml)[Number(styleId)]
  if (xf === undefined) throw new Error(`cellXfs[${styleId}] nao existe`)
  return xf
}

function repaint(name: string, edits: RowFillEdit[]): { antes: Uint8Array; depois: Uint8Array } {
  const antes = fixture(name)
  return { antes, depois: applyRowFill(antes, edits, SHEET_PATH).buffer }
}

describe('applyRowFill — troca o fillId, nunca o styleId', () => {
  it('reusa o xf existente quando a tupla resultante ja esta em cellXfs', () => {
    // Linha 7 de `cores.xlsx` e bege: A7 e B7 tem styleId 215 = (0, 1, 9, 34).
    // Pintada de azul, a tupla vira (0, 1, 8, 34), que ja existe como 181.
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 7, fillId: AZUL, columns: ['A', 'B'] },
    ])

    expect(styleOf(textOf(antes, SHEET_PATH), 'A7')).toBe('215')
    expect(styleOf(textOf(depois, SHEET_PATH), 'A7')).toBe('181')
    expect(styleOf(textOf(depois, SHEET_PATH), 'B7')).toBe('181')
    // Nenhum xf criado: `xl/styles.xml` sai byte a byte igual.
    expect(textOf(depois, STYLES_PATH)).toBe(textOf(antes, STYLES_PATH))
  })

  it('acrescenta xf novo preservando a borda quando a tupla nao existe', () => {
    // Linha 2 de `cores.xlsx` e verde tom A: A2 tem styleId 165, com borda 5.
    // (0, 1, 8, 5) nao existe — trocar o styleId inteiro por 181 destruiria a
    // borda 5, que e o defeito que A-49 pegou antes de virar codigo.
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: ['A'] },
    ])

    const stylesAntes = textOf(antes, STYLES_PATH)
    const stylesDepois = textOf(depois, STYLES_PATH)
    const novoId = styleOf(textOf(depois, SHEET_PATH), 'A2')
    const original = xfAt(stylesAntes, '165')
    const novo = xfAt(stylesDepois, novoId)

    expect(novoId).not.toBe('165')
    expect(attributeOf(novo, 'fillId')).toBe(String(AZUL))
    expect(attributeOf(novo, 'borderId')).toBe(attributeOf(original, 'borderId'))
    expect(attributeOf(novo, 'borderId')).toBe('5')
    expect(attributeOf(novo, 'fontId')).toBe(attributeOf(original, 'fontId'))
    expect(attributeOf(novo, 'numFmtId')).toBe(attributeOf(original, 'numFmtId'))
  })

  // Sem applyFill="1" o Excel ignora o fill do cellXf, e a linha continua com a
  // cor antiga na tela — uma gravacao que a validacao aprova e o operador nao ve.
  it('marca applyFill no xf acrescentado', () => {
    const { depois } = repaint('cores.xlsx', [{ sourceRow: 2, fillId: AZUL, columns: ['A'] }])
    const sheet = textOf(depois, SHEET_PATH)

    expect(xfAt(textOf(depois, STYLES_PATH), styleOf(sheet, 'A2'))).toContain('applyFill="1"')
  })

  it('incrementa o count de cellXfs sem alterar nenhum xf anterior', () => {
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: ['A'] },
    ])

    const anteriores = cellXfsOf(textOf(antes, STYLES_PATH))
    const posteriores = cellXfsOf(textOf(depois, STYLES_PATH))

    expect(posteriores).toHaveLength(anteriores.length + 1)
    expect(posteriores.slice(0, anteriores.length)).toEqual(anteriores)
    expect(declaredCount(textOf(depois, STYLES_PATH))).toBe(posteriores.length)
  })

  it('resolve cada celula da linha por conta propria quando os styleId diferem', () => {
    // A2 tem borda 5 e B2 tem borda 2 (fim de bloco na planilha real). A linha
    // termina com DOIS styleId distintos, e isso e correto — cada celula
    // preservou a sua borda.
    const { depois } = repaint('cores.xlsx', [{ sourceRow: 2, fillId: AZUL, columns: ['A', 'B'] }])
    const styles = textOf(depois, STYLES_PATH)
    const sheet = textOf(depois, SHEET_PATH)

    expect(styleOf(sheet, 'A2')).not.toBe(styleOf(sheet, 'B2'))
    expect(attributeOf(xfAt(styles, styleOf(sheet, 'A2')), 'borderId')).toBe('5')
    expect(attributeOf(xfAt(styles, styleOf(sheet, 'B2')), 'borderId')).toBe('2')
    expect(attributeOf(xfAt(styles, styleOf(sheet, 'A2')), 'fillId')).toBe(String(AZUL))
    expect(attributeOf(xfAt(styles, styleOf(sheet, 'B2')), 'fillId')).toBe(String(AZUL))
  })

  it('nao cria xf quando a cor pedida ja e a atual', () => {
    // Linha 4 de `cores.xlsx` ja e azul (styleId 181, fillId 8).
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 4, fillId: AZUL, columns: ['A'] },
    ])

    expect(styleOf(textOf(depois, SHEET_PATH), 'A4')).toBe('181')
    expect(textOf(depois, STYLES_PATH)).toBe(textOf(antes, STYLES_PATH))
  })

  /**
   * O backlog diz "tratada como `styleId 0`". A base real e o estilo da COLUNA,
   * porque e ele que o Excel ja aplica na celula: partir de `cellXfs[0]` — que
   * em `cores.xlsx` e `(numFmt 0, font 0, fill 0, border 0)`, sem alinhamento —
   * trocaria a fonte e o alinhamento que a celula exibe hoje, que e a classe de
   * dano que A-49 existe para impedir. Divergencia registrada no fechamento.
   */
  it('acrescenta o s herdando a COLUNA, e nao cellXfs[0]', () => {
    // A1 e o cabecalho de `cores.xlsx`, sem `s=`. A coluna A declara
    // `style="162"` = (numFmt 0, font 1, fill 0, border 0) + alinhamento.
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 1, fillId: AZUL, columns: ['A'] },
    ])
    const stylesDepois = textOf(depois, STYLES_PATH)
    const novo = xfAt(stylesDepois, styleOf(textOf(depois, SHEET_PATH), 'A1'))
    const daColuna = xfAt(textOf(antes, STYLES_PATH), '162')

    expect(styleOf(textOf(antes, SHEET_PATH), 'A1')).toBeNull()
    expect(attributeOf(novo, 'fillId')).toBe(String(AZUL))
    expect(attributeOf(novo, 'fontId')).toBe(attributeOf(daColuna, 'fontId'))
    expect(attributeOf(novo, 'fontId')).not.toBe(attributeOf(xfAt(stylesDepois, '0'), 'fontId'))
    expect(novo).toContain('<alignment')
  })
})

describe('applyRowFill — o que ela nao pode tocar', () => {
  it('preserva os valores das celulas repintadas', () => {
    // `basico.xlsx` tem a linha 2 com A a M preenchidas, entao a comparacao
    // cobre texto, data e celula vazia.
    const { antes, depois } = repaint('basico.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: TODAS_AS_COLUNAS },
    ])
    const sheetAntes = textOf(antes, SHEET_PATH)
    const sheetDepois = textOf(depois, SHEET_PATH)

    for (const column of TODAS_AS_COLUNAS) {
      expect(cellValueOf(sheetDepois, `${column}2`)).toBe(cellValueOf(sheetAntes, `${column}2`))
    }
  })

  it('deixa M a P intactas (A-44)', () => {
    const { antes, depois } = repaint('basico.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: TODAS_AS_COLUNAS },
    ])
    const sheetAntes = textOf(antes, SHEET_PATH)
    const sheetDepois = textOf(depois, SHEET_PATH)

    for (const column of ['M', 'N', 'O', 'P']) {
      expect(cellOf(sheetDepois, `${column}2`)).toBe(cellOf(sheetAntes, `${column}2`))
    }
  })

  it('nao toca nas outras linhas da aba', () => {
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: TODAS_AS_COLUNAS },
    ])
    const sheetAntes = textOf(antes, SHEET_PATH)
    const sheetDepois = textOf(depois, SHEET_PATH)

    for (const row of [3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      expect(styleOf(sheetDepois, `A${row}`)).toBe(styleOf(sheetAntes, `A${row}`))
    }
  })

  /**
   * ADR-0004: so a aba alvo e `xl/styles.xml` podem mudar. As tres abas fora de
   * escopo — `2025`, `2024` e `CNPJ` — entram na contagem das preservadas
   * (regra inviolavel 10).
   */
  it('preserva todas as demais entradas do zip', () => {
    const antes = fixture('cores.xlsx')
    const entradas = unzipSync(antes)
    const resultado = applyRowFill(
      antes,
      [{ sourceRow: 2, fillId: AZUL, columns: TODAS_AS_COLUNAS }],
      SHEET_PATH,
    )

    expect(resultado.entriesPreserved).toBe(Object.keys(entradas).length - 2)
  })
})

describe('applyRowFill — casos de borda da chamada', () => {
  it('devolve o buffer original quando nao ha o que pintar', () => {
    const original = fixture('cores.xlsx')
    const resultado = applyRowFill(original, [], SHEET_PATH)

    expect(resultado.buffer).toBe(original)
    expect(resultado.cellsWritten).toBe(0)
  })

  it('conta so as celulas que existiam e mudaram de estilo', () => {
    // C2 nao existe em `cores.xlsx`: o gerador so escreve A, B, I e L.
    const resultado = applyRowFill(
      fixture('cores.xlsx'),
      [{ sourceRow: 2, fillId: AZUL, columns: ['A', 'B', 'C'] }],
      SHEET_PATH,
    )

    expect(resultado.cellsWritten).toBe(2)
  })

  /**
   * A celula ausente ja e governada pelo estilo da COLUNA, cujo `borderId` e
   * zero na planilha real. Cria-la com o preenchimento novo deixaria a linha
   * colorida e **sem as bordas da tabela** nessas colunas — aparencia inventada,
   * que a regra inviolavel 3 proibe. E o criterio de aceite diz que apenas o
   * atributo `s=` muda.
   *
   * Medido em 17/08/2026 sobre a planilha real: **744 linhas de dados, zero
   * celulas ausentes em A a L**. Nenhuma coluna fica sem pintar no uso real.
   */
  it('NAO cria a celula ausente, e nao mexe na linha por causa dela', () => {
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 2, fillId: AZUL, columns: ['C'] },
    ])

    expect(cellOf(textOf(antes, SHEET_PATH), 'C2')).toBeNull()
    expect(cellOf(textOf(depois, SHEET_PATH), 'C2')).toBeNull()
    expect(textOf(depois, SHEET_PATH)).toBe(textOf(antes, SHEET_PATH))
    expect(textOf(depois, STYLES_PATH)).toBe(textOf(antes, STYLES_PATH))
  })

  /**
   * O caso-limite do backlog: "combinacao que ja e a atual → aceita e gravada;
   * o resultado e identico, e nenhum `xf` novo e criado". Com as 12 colunas do
   * caminho de producao, e nao so com a coluna A.
   */
  it('deixa a aba e os estilos identicos quando a linha ja esta na cor pedida', () => {
    // Linha 4 de `cores.xlsx` e azul inteira: A4 e B4 com styleId 181.
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 4, fillId: AZUL, columns: TODAS_AS_COLUNAS },
    ])

    expect(textOf(depois, SHEET_PATH)).toBe(textOf(antes, SHEET_PATH))
    expect(textOf(depois, STYLES_PATH)).toBe(textOf(antes, STYLES_PATH))
  })

  // `fillId` alem de `<fills>` produziria um xf com indice pendurado, e o Excel
  // abriria pedindo reparo. Recusar antes de gravar deixa o arquivo intacto.
  it('recusa fillId que nao existe em styles.xml', () => {
    expect(() =>
      applyRowFill(
        fixture('cores.xlsx'),
        [{ sourceRow: 2, fillId: 9999, columns: ['A'] }],
        SHEET_PATH,
      ),
    ).toThrow(/fillId 9999 nao existe/)
  })

  /**
   * O `s=` e lido da TAG DE ABERTURA. Sobre o elemento inteiro, uma celula de
   * texto inline cujo conteudo contenha ` s="` faz a repintura partir do estilo
   * errado e trocar fonte e borda — dano fora do preenchimento, que e a classe
   * de A-49. Achado do revisor-xml na segunda revisao.
   */
  it('nao confunde ` s=` dentro do texto da celula com o estilo dela', () => {
    const original = fixture('cores.xlsx')
    const zip = unzipSync(original)
    const inline = '<c r="A2" t="inlineStr"><is><t>PECA s="7" AVULSA</t></is></c>'
    zip[SHEET_PATH] = strToU8(
      strFromU8(zip[SHEET_PATH] as Uint8Array).replace(
        /<c r="A2"(?:\s[^>]*?)?>[\s\S]*?<\/c>/,
        inline,
      ),
    )

    const depois = applyRowFill(
      zipSync(zip),
      [{ sourceRow: 2, fillId: AZUL, columns: ['A'] }],
      SHEET_PATH,
    ).buffer
    const stylesDepois = textOf(depois, STYLES_PATH)
    const novo = xfAt(stylesDepois, styleOf(textOf(depois, SHEET_PATH), 'A2'))
    // Sem `s=` proprio, a base e a COLUNA (162), nao o xf 7 do texto.
    const daColuna = xfAt(stylesDepois, '162')

    expect(attributeOf(novo, 'fontId')).toBe(attributeOf(daColuna, 'fontId'))
    expect(attributeOf(novo, 'borderId')).toBe(attributeOf(daColuna, 'borderId'))
    expect(attributeOf(novo, 'fillId')).toBe(String(AZUL))
    // O texto sai intacto: a troca so mexe na tag de abertura.
    expect(textOf(depois, SHEET_PATH)).toContain('PECA s="7" AVULSA')
  })

  /**
   * `<row r="N" .../>` nao tem celula, e a repintura nao cria nenhuma. Abri-la
   * para `<row ...></row>` produziria diferenca no arquivo sem uma unica celula
   * pintada. Achado do revisor-xml.
   */
  it('deixa a linha auto-fechada exatamente como estava', () => {
    const original = fixture('cores.xlsx')
    const zip = unzipSync(original)
    const comLinhaVazia = strFromU8(zip[SHEET_PATH] as Uint8Array).replace(
      '</sheetData>',
      '<row r="20" spans="1:16" s="165" customFormat="1"/></sheetData>',
    )
    zip[SHEET_PATH] = strToU8(comLinhaVazia)
    const entrada = zipSync(zip)

    const resultado = applyRowFill(
      entrada,
      [{ sourceRow: 20, fillId: AZUL, columns: TODAS_AS_COLUNAS }],
      SHEET_PATH,
    )

    expect(resultado.cellsWritten).toBe(0)
    expect(resultado.rowsPainted).toBe(0)
    expect(textOf(resultado.buffer, SHEET_PATH)).toBe(comLinhaVazia)
    expect(textOf(resultado.buffer, STYLES_PATH)).toBe(textOf(entrada, STYLES_PATH))
  })

  // Silencio aqui seria uma repintura que nao repinta, pega so pela validacao
  // pos-escrita — ao preco de restaurar o backup. Achado do revisor-xml.
  it('recusa celula cujo s aponta alem do fim de cellXfs', () => {
    const zip = unzipSync(fixture('cores.xlsx'))
    zip[SHEET_PATH] = strToU8(
      strFromU8(zip[SHEET_PATH] as Uint8Array).replace('<c r="A2" s="165"', '<c r="A2" s="9999"'),
    )

    expect(() =>
      applyRowFill(zipSync(zip), [{ sourceRow: 2, fillId: AZUL, columns: ['A'] }], SHEET_PATH),
    ).toThrow(/styleId 9999 nao existe/)
  })

  it('conta a linha repintada so quando alguma celula mudou', () => {
    const semMudanca = applyRowFill(
      fixture('cores.xlsx'),
      [{ sourceRow: 4, fillId: AZUL, columns: TODAS_AS_COLUNAS }],
      SHEET_PATH,
    )
    const comMudanca = applyRowFill(
      fixture('cores.xlsx'),
      [{ sourceRow: 2, fillId: AZUL, columns: TODAS_AS_COLUNAS }],
      SHEET_PATH,
    )

    expect(semMudanca.rowsPainted).toBe(0)
    expect(comMudanca.rowsPainted).toBe(1)
  })

  /**
   * O caso-limite do backlog: verde tom B (`fillId 12`) repintado de verde tem
   * como alvo o tom A (`fillId 2`), e a gravacao unifica o tom.
   */
  it('unifica o tom ao repintar verde tom B de verde', () => {
    const VERDE_TOM_A = 2
    const { antes, depois } = repaint('cores.xlsx', [
      { sourceRow: 3, fillId: VERDE_TOM_A, columns: ['A', 'B'] },
    ])

    expect(styleOf(textOf(antes, SHEET_PATH), 'A3')).toBe('201')
    expect(styleOf(textOf(depois, SHEET_PATH), 'A3')).toBe('199')
    expect(attributeOf(xfAt(textOf(depois, STYLES_PATH), '199'), 'fillId')).toBe(
      String(VERDE_TOM_A),
    )
    expect(attributeOf(xfAt(textOf(depois, STYLES_PATH), '199'), 'borderId')).toBe('34')
    expect(textOf(depois, STYLES_PATH)).toBe(textOf(antes, STYLES_PATH))
  })

  it('recusa linha que nao existe na aba', () => {
    expect(() =>
      applyRowFill(
        fixture('cores.xlsx'),
        [{ sourceRow: 9999, fillId: AZUL, columns: ['A'] }],
        SHEET_PATH,
      ),
    ).toThrow(/linha 9999/)
  })

  it('recusa aba que nao existe no zip', () => {
    expect(() =>
      applyRowFill(
        fixture('cores.xlsx'),
        [{ sourceRow: 2, fillId: AZUL, columns: ['A'] }],
        'xl/worksheets/inexistente.xml',
      ),
    ).toThrow(/aba nao encontrada/)
  })
})
