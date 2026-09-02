import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { appendRow } from '../../src/io/xlsx-surgeon.ts'

/**
 * `appendRow` — a linha nova no fim da aba (02/09/2026).
 *
 * **A linha nasce em branco, no sentido do Excel:** cada célula recebe o estilo
 * declarado pela COLUNA, e nada mais. Copiar o estilo da linha de cima é o
 * caminho fácil e errado — no arquivo real ele carrega `fillId 8`, que o
 * `color-map.json` traduz como Colaborador 1, e todo processo novo nasceria
 * atribuído a alguém que ninguém escolheu.
 *
 * A Tabela do Excel é construída aqui, em memória, e não numa fixture nova:
 * nenhuma das nove tem a parte `xl/tables/`, e o que os casos precisam é da
 * FORMA dela — `ref`, e o rel que a liga à aba certa. Uma fixture versionada
 * para isso seria um arquivo binário a mais para provar duas linhas de XML.
 */

const SHEET_PATH = 'xl/worksheets/sheet1.xml'
const SERIAL_10_AGO_2026 = 46_244

/** Hash do CONTEUDO DESCOMPRIMIDO, como as demais suites do cirurgiao. */
function digest(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`tests/fixtures/${name}`))
}

function sheetOf(buffer: Uint8Array): string {
  const entry = unzipSync(buffer)[SHEET_PATH]
  if (!entry) throw new Error('aba ausente')
  return strFromU8(entry)
}

function cellOf(sheetXml: string, reference: string): string | null {
  const pattern = new RegExp(
    `<c r="${reference}"(?:\\s[^>]*?)?/>|<c r="${reference}"(?:\\s[^>]*?)?>[\\s\\S]*?</c>`,
  )
  return pattern.exec(sheetXml)?.[0] ?? null
}

function lastRowOf(sheetXml: string): number {
  const rows = [...sheetXml.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1]))
  return Math.max(...rows)
}

/** Enxerta uma Tabela do Excel cobrindo `A1:P{ate}`, ligada à aba alvo. */
function comTabela(buffer: Uint8Array, ate: number, aba = 'sheet1.xml'): Uint8Array {
  const entries = unzipSync(buffer)
  entries['xl/tables/table1.xml'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" ' +
      `name="Tabela1" displayName="Tabela1" ref="A1:P${ate}" totalsRowShown="0">` +
      `<autoFilter ref="A1:P${ate}"/></table>`,
  )
  entries[`xl/worksheets/_rels/${aba}.rels`] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/' +
      'relationships/table" Target="../tables/table1.xml"/></Relationships>',
  )
  return zipSync(entries)
}

describe('appendRow', () => {
  it('escreve a linha DEPOIS da ultima que existe', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    const { buffer, cellsWritten } = appendRow(
      original,
      { sourceRow: proxima, values: { A: 'FT900.26', B: 'CLIENTE NOVO' } },
      SHEET_PATH,
    )

    const sheet = sheetOf(buffer)
    expect(cellsWritten).toBe(2)
    expect(lastRowOf(sheet)).toBe(proxima)
    expect(cellOf(sheet, `A${proxima}`)).toBeTruthy()
    // A ordem das celulas dentro da linha e a das colunas, como o Excel emite.
    expect(sheet.indexOf(`<c r="A${proxima}"`)).toBeLessThan(sheet.indexOf(`<c r="B${proxima}"`))
  })

  /**
   * O ponto da história: o estilo vem da COLUNA, e não da linha de cima. Nas
   * fixtures as duas coincidem em fonte, mas no arquivo real a linha de cima
   * carrega preenchimento azul — que significa Colaborador 1.
   */
  it('usa o estilo declarado pela coluna, e nao o da linha anterior', () => {
    const original = fixture('basico.xlsx')
    const sheetAntes = sheetOf(original)
    const proxima = lastRowOf(sheetAntes) + 1
    const estiloDaColuna = /<col [^>]*min="1"[^>]*style="(\d+)"/.exec(sheetAntes)?.[1] ?? null
    const estiloDaLinhaAcima = /\ss="(\d+)"/.exec(cellOf(sheetAntes, `A${proxima - 1}`) ?? '')?.[1]

    const { buffer } = appendRow(original, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH)

    const celula = cellOf(sheetOf(buffer), `A${proxima}`) ?? ''
    const estilo = /\ss="(\d+)"/.exec(celula)?.[1] ?? null
    expect(estilo).toBe(estiloDaColuna)
    // A âncora contra teste vazio: os dois estilos precisam DIFERIR para o caso
    // significar alguma coisa. Se a fixture mudar e eles coincidirem, reprova.
    expect(estilo).not.toBe(estiloDaLinhaAcima)
  })

  /** A coluna declara `numFmtId=0`: sem isto o Excel exibiria o serial cru (A-56). */
  it('a data recebe formato de data, criado de forma aditiva', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    const { buffer } = appendRow(
      original,
      { sourceRow: proxima, values: { I: new Date(Date.UTC(2026, 7, 10)) } },
      SHEET_PATH,
    )

    const sheet = sheetOf(buffer)
    const celula = cellOf(sheet, `I${proxima}`) ?? ''
    expect(celula).toContain(`<v>${SERIAL_10_AGO_2026}</v>`)

    const estilo = Number(/\ss="(\d+)"/.exec(celula)?.[1] ?? '0')
    const styles = strFromU8(unzipSync(buffer)['xl/styles.xml'] as Uint8Array)
    const xfs =
      /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/
        .exec(styles)?.[1]
        ?.match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g) ?? []
    const numFmt = Number(/numFmtId="(\d+)"/.exec(xfs[estilo] ?? '')?.[1] ?? '0')
    expect(numFmt).not.toBe(0)
  })

  it('estende a dimensao para cobrir a linha nova', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    const { buffer } = appendRow(original, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH)

    expect(/<dimension ref="A1:[A-Z]+(\d+)"\/>/.exec(sheetOf(buffer))?.[1]).toBe(String(proxima))
  })

  /**
   * A invariante do ADR-0004: tudo que a aplicação não entende, ela não toca.
   * Só a aba, `sharedStrings` e `styles` podem mudar.
   */
  it('deixa as demais entradas do zip byte a byte identicas', () => {
    const original = fixture('formatado.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    const { buffer } = appendRow(original, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH)

    const antes = unzipSync(original)
    const depois = unzipSync(buffer)
    // A UNIAO das chaves, e nao so as de `antes`: iterar a origem nao detectaria
    // entrada ACRESCENTADA ao zip. Achado do revisor-xml sobre este proprio teste.
    const caminhos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    const mudaram = caminhos.filter((path) => {
      const a = antes[path]
      const b = depois[path]
      return a === undefined || b === undefined || digest(a) !== digest(b)
    })
    expect(mudaram.sort()).toEqual(['xl/sharedStrings.xml', SHEET_PATH])
  })

  /**
   * O `sourceRow` foi resolvido contra uma leitura. Se o arquivo cresceu desde
   * então, escrever ali sobrescreveria trabalho de outra pessoa — a mesma
   * preocupação que faz `H-25` resolver a célula pela REF.
   */
  it('RECUSA linha que nao vem depois da ultima', () => {
    const original = fixture('basico.xlsx')
    const ultima = lastRowOf(sheetOf(original))

    // A recusa e "nao e depois da ultima", e nao "ja existe": `<sheetData>`
    // exige `<row>` em ordem crescente de `r`, e a insercao e sempre antes de
    // `</sheetData>`. Mirar um buraco no meio produziria 1,2,4,3 — e o Excel
    // reconstroi a aba inteira. Achado do revisor-xml.
    expect(() =>
      appendRow(original, { sourceRow: ultima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/nao e depois da ultima/)
    expect(() => appendRow(original, { sourceRow: 2, values: { A: 'X' } }, SHEET_PATH)).toThrow(
      /nao e depois da ultima/,
    )
  })

  /** `r` e indice de linha, de 1 a 1.048.576. O tipo `number` admite o resto. */
  it('RECUSA linha fracionaria, negativa e alem do limite da planilha', () => {
    const original = fixture('basico.xlsx')

    for (const linha of [0, -1, 3.5, 1_048_577]) {
      expect(() =>
        appendRow(original, { sourceRow: linha, values: { A: 'X' } }, SHEET_PATH),
      ).toThrow(/linha invalida/)
    }
  })

  /**
   * Sem a recusa, o arquivo do operador mudaria de bytes — hash novo, backup
   * consumido, releitura do watcher — para gravar `<row>` sem celula alguma.
   */
  it('RECUSA insercao sem celula alguma', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    expect(() => appendRow(original, { sourceRow: proxima, values: {} }, SHEET_PATH)).toThrow(
      /sem celula/,
    )
  })

  /** `A1` produziria `<c r="A15">` dentro de `<row r="5">`: a coordenada
      contradiz a linha que a contem, e o Excel abre pedindo reparo. */
  it('RECUSA chave de coluna que nao e letra de coluna', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    for (const coluna of ['a', 'A1', '', '1']) {
      expect(() =>
        appendRow(original, { sourceRow: proxima, values: { [coluna]: 'X' } }, SHEET_PATH),
      ).toThrow(/coluna invalida/)
    }
  })

  /**
   * `<sheetData />` com espaco e XML legal e equivalente. Antes, o `replace` nao
   * achava alvo, a linha sumia — e a funcao devolvia SUCESSO, com
   * `sharedStrings` ja incrementado.
   */
  it('grava em <sheetData/> auto-fechado, com e sem espaco', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    for (const forma of ['<sheetData/>', '<sheetData />']) {
      const entries = unzipSync(original)
      const vazia = strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        /<sheetData>[\s\S]*?<\/sheetData>/,
        forma,
      )
      entries[SHEET_PATH] = strToU8(vazia)

      const { buffer } = appendRow(
        zipSync(entries),
        { sourceRow: proxima, values: { A: 'X' } },
        SHEET_PATH,
      )

      expect(cellOf(sheetOf(buffer), `A${proxima}`)).toBeTruthy()
    }
  })

  /** Dimensao que existe e nao e entendida sairia declarando um intervalo que
      nao cobre a linha gravada — em silencio, e reportando sucesso. */
  it('RECUSA dimensao em forma nao reconhecida, em vez de ignora-la', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        /<dimension ref="[^"]*"\s*\/>/,
        '<dimension ref="A1:P4:Z9"/>',
      ),
    )

    expect(() =>
      appendRow(zipSync(entries), { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/dimension/)
  })

  it('estende dimensao declarada como celula unica', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        /<dimension ref="[^"]*"\s*\/>/,
        '<dimension ref="A1"/>',
      ),
    )

    const { buffer } = appendRow(
      zipSync(entries),
      { sourceRow: proxima, values: { A: 'X' } },
      SHEET_PATH,
    )

    expect(sheetOf(buffer)).toContain(`<dimension ref="A1:A${proxima}"/>`)
  })

  it('RECUSA quando a linha cai fora da Tabela do Excel', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const apertada = comTabela(original, proxima - 1)

    expect(() =>
      appendRow(apertada, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/fora da Tabela/)
  })

  it('aceita quando a Tabela ainda tem folga', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const folgada = comTabela(original, proxima + 200)

    const { buffer } = appendRow(folgada, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH)

    expect(lastRowOf(sheetOf(buffer))).toBe(proxima)
  })

  /**
   * Regra inviolável 10. O arquivo real tem quatro abas e uma Tabela; casar a
   * Tabela pelo nome do arquivo faria a inserção consultar a da aba `2025`.
   */
  it('so consulta a Tabela ligada a aba ALVO', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    // A Tabela apertada existe, mas pertence a OUTRA aba: não restringe esta.
    const deOutraAba = comTabela(original, proxima - 1, 'sheet2.xml')

    const { buffer } = appendRow(deOutraAba, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH)

    expect(lastRowOf(sheetOf(buffer))).toBe(proxima)
  })

  it('celula nula vira <c> vazia, e nao some', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    const { buffer } = appendRow(
      original,
      { sourceRow: proxima, values: { A: 'X', L: null } },
      SHEET_PATH,
    )

    expect(cellOf(sheetOf(buffer), `L${proxima}`)).toMatch(/<c r="L\d+"[^>]*\/>/)
  })
})

/**
 * Os quatro modos em que o guarda da Tabela **falhava aberto** — cada um
 * gravaria a linha além do `ref` sem aviso, e no arquivo real isso é linha fora
 * da banda, fora do autoFilter, na rota de colisão com a linha que o Excel
 * materializa ao expandir a Tabela sozinho. Todos achados do revisor-xml.
 */
describe('appendRow — o guarda da Tabela do Excel', () => {
  function comRelsBrutos(buffer: Uint8Array, alvos: string[], refs: string[]): Uint8Array {
    const entries = unzipSync(buffer)
    for (const [i, ref] of refs.entries()) {
      entries[`xl/tables/table${i + 1}.xml`] = strToU8(
        '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          `id="${i + 1}" name="T${i + 1}" displayName="T${i + 1}" ref="${ref}"/>`,
      )
    }
    entries['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        alvos
          .map(
            (alvo, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/` +
              `officeDocument/2006/relationships/table" Target="${alvo}"/>`,
          )
          .join('') +
        '</Relationships>',
    )
    return zipSync(entries)
  }

  const proximaDe = (b: Uint8Array): number => lastRowOf(sheetOf(b)) + 1

  it('entende Target como nome de parte ABSOLUTO, e nao so relativo', () => {
    const original = fixture('basico.xlsx')
    const proxima = proximaDe(original)
    const arquivo = comRelsBrutos(original, ['/xl/tables/table1.xml'], [`A1:P${proxima - 1}`])

    expect(() =>
      appendRow(arquivo, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/fora da Tabela/)
  })

  it('entende ref de celula unica', () => {
    const original = fixture('basico.xlsx')
    const proxima = proximaDe(original)
    const arquivo = comRelsBrutos(original, ['../tables/table1.xml'], ['A1'])

    expect(() =>
      appendRow(arquivo, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/fora da Tabela/)
  })

  /**
   * Duas Tabelas na mesma aba são legais e podem descrever regiões que não se
   * tocam. Tomar o MAIOR limite fazia a segunda autorizar gravação fora da
   * primeira; a que vale é a que sobrepõe as colunas escritas.
   */
  it('ignora Tabela que nao alcanca as colunas escritas, e nao a usa para autorizar', () => {
    const original = fixture('basico.xlsx')
    const proxima = proximaDe(original)
    const arquivo = comRelsBrutos(
      original,
      ['../tables/table1.xml', '../tables/table2.xml'],
      [`A1:P${proxima - 1}`, 'R1:T900'],
    )

    expect(() =>
      appendRow(arquivo, { sourceRow: proxima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/fora da Tabela/)
  })

  /**
   * **O guarda não é contornável pela escolha das colunas.** A primeira correção
   * só considerava Tabela que sobrepusesse as colunas escritas, e o revisor-xml
   * mediu o buraco: com `A1:P4` e um insert na coluna `Q`, o limite sumia e a
   * linha 90.000 era aceita. O mínimo sem filtro recusa; o preço é recusa falsa
   * numa aba com duas Tabelas desalinhadas, que é a direção segura.
   */
  it('nao deixa a escolha de coluna escapar do limite da Tabela', () => {
    const original = fixture('basico.xlsx')
    const arquivo = comRelsBrutos(original, ['../tables/table1.xml'], ['A1:P4'])

    expect(() => appendRow(arquivo, { sourceRow: 90_000, values: { Q: 'X' } }, SHEET_PATH)).toThrow(
      /fora da Tabela/,
    )
  })
})

/**
 * Defeitos que o revisor-xml achou em código JÁ COMMITADO, alcançáveis também
 * por `applyCellEdits` — o módulo inteiro entra na revisão, não só o trecho novo.
 */
describe('xlsx-surgeon — regressões achadas na revisão de appendRow', () => {
  it('preserva <si/> auto-fechado no pool, que e GLOBAL a pasta de trabalho', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    const pool = strFromU8(entries['xl/sharedStrings.xml'] as Uint8Array)
    entries['xl/sharedStrings.xml'] = strToU8(pool.replace('<si>', '<si/><si>'))

    const { buffer } = appendRow(
      zipSync(entries),
      { sourceRow: proxima, values: { A: 'TEXTO NOVO' } },
      SHEET_PATH,
    )

    // Descartá-lo deslocaria em um TODO índice `t="s"` posterior, e as quatro
    // abas passariam a exibir a string errada — inclusive as fora de escopo.
    const depois = strFromU8(unzipSync(buffer)['xl/sharedStrings.xml'] as Uint8Array)
    expect(depois).toContain('<si/>')
    // `uniqueCount` acompanha as entradas do pool: a auto-fechada conta como uma.
    expect(/uniqueCount="(\d+)"/.exec(depois)?.[1]).toBe(
      String((depois.match(/<si>|<si\/>/g) ?? []).length),
    )
  })

  it('RECUSA numero que o Excel nao aceita, em vez de grava-lo', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    for (const valor of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        appendRow(original, { sourceRow: proxima, values: { M: valor } }, SHEET_PATH),
      ).toThrow(/numerico invalido/)
    }
  })

  it('le o estilo de coluna declarado como <col></col>', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(/<col ([^>]*?)\/>/g, '<col $1></col>'),
    )

    const { buffer } = appendRow(
      zipSync(entries),
      { sourceRow: proxima, values: { A: 'X' } },
      SHEET_PATH,
    )

    expect(cellOf(sheetOf(buffer), `A${proxima}`)).toMatch(/\ss="\d+"/)
  })
})

/**
 * Os defeitos que as CORREÇÕES da primeira revisão introduziram. Foi assim em
 * `H-25`, `H-26` e `H-27`: vários achados nasceram do conserto do anterior, e é
 * por isso que a régua manda reinvocar o revisor depois de corrigir.
 */
describe('appendRow — regressões da segunda revisão', () => {
  it('nao derruba a gravacao por dimensao em caixa baixa, que o Excel le', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        /<dimension ref="[^"]*"\s*\/>/,
        '<dimension ref="a1:p4"/>',
      ),
    )

    const { buffer } = appendRow(
      zipSync(entries),
      { sourceRow: proxima, values: { A: 'X' } },
      SHEET_PATH,
    )

    expect(sheetOf(buffer)).toContain(`<dimension ref="A1:P${proxima}"/>`)
  })

  /** Partindo de `ref="A1"` e escrevendo até P, a versão anterior montava
      `A1:A5` — assinando um intervalo que exclui a célula recém-gravada. */
  it('a dimensao cobre as COLUNAS escritas, e nao so a linha', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        /<dimension ref="[^"]*"\s*\/>/,
        '<dimension ref="A1"/>',
      ),
    )

    const { buffer } = appendRow(
      zipSync(entries),
      { sourceRow: proxima, values: { A: 'X', P: 'Y' } },
      SHEET_PATH,
    )

    expect(sheetOf(buffer)).toContain(`<dimension ref="A1:P${proxima}"/>`)
  })

  it('entende dimensao com atributo extra e com fechamento em par', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    for (const forma of [
      '<dimension ref="A1:P4" xr:uid="{X}"/>',
      '<dimension ref="A1:P4"></dimension>',
    ]) {
      const entries = unzipSync(original)
      entries[SHEET_PATH] = strToU8(
        strFromU8(entries[SHEET_PATH] as Uint8Array).replace(/<dimension ref="[^"]*"\s*\/>/, forma),
      )

      const { buffer } = appendRow(
        zipSync(entries),
        { sourceRow: proxima, values: { A: 'X' } },
        SHEET_PATH,
      )

      expect(sheetOf(buffer)).toContain(`<dimension ref="A1:P${proxima}"/>`)
    }
  })

  /** TAB entre `<row` e o primeiro atributo é whitespace legal. A linha não
      contada faria a inserção emitir um `r` DUPLICADO. */
  it('conta linha declarada com TAB, e recusa o `r` que a duplicaria', () => {
    const original = fixture('basico.xlsx')
    const ultima = lastRowOf(sheetOf(original))
    const entries = unzipSync(original)
    entries[SHEET_PATH] = strToU8(
      strFromU8(entries[SHEET_PATH] as Uint8Array).replace(
        `<row r="${ultima}"`,
        `<row\tr="${ultima}"`,
      ),
    )

    expect(() =>
      appendRow(zipSync(entries), { sourceRow: ultima, values: { A: 'X' } }, SHEET_PATH),
    ).toThrow(/nao e depois da ultima/)
  })

  /** `ZZZ` casa a forma de letra de coluna e endereça a 18.278, que não existe:
      o Excel abre pedindo reparo. XFD é a última. */
  it('RECUSA coluna alem de XFD', () => {
    const original = fixture('basico.xlsx')
    const proxima = lastRowOf(sheetOf(original)) + 1

    for (const coluna of ['XFE', 'ZZZ']) {
      expect(() =>
        appendRow(original, { sourceRow: proxima, values: { [coluna]: 'X' } }, SHEET_PATH),
      ).toThrow(/coluna invalida/)
    }
    // E XFD, que existe, passa.
    expect(() =>
      appendRow(original, { sourceRow: proxima, values: { XFD: 'X' } }, SHEET_PATH),
    ).not.toThrow()
  })
})
