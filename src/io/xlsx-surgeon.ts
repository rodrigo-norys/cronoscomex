import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Cirurgia no XML do .xlsx: altera apenas os nos <c> alvo e recompacta, sem
 * reserializar o workbook (ADR-0004). Tudo que a aplicacao nao entende, ela
 * nao toca.
 *
 * TRES cirurgias, e elas nao se cruzam: `applyCellEdits` grava VALOR em celula
 * de linha que existe e preserva o estilo; `applyRowFill` troca o `fillId` do
 * estilo e nao encosta em valor; `appendRow` cria uma linha DEPOIS da ultima,
 * com o estilo que a COLUNA declara (02/09/2026).
 *
 * "Byte a byte identicas" vale sobre o CONTEUDO DESCOMPRIMIDO de cada entrada
 * do zip, nao sobre os bytes comprimidos: recompactar reproduz o conteudo, nao
 * o fluxo deflate do Excel. E o conteudo que carrega formatacao condicional,
 * validacao e comentario — os elementos que ADR-0004 existe para preservar.
 *
 * Quatro entradas do zip podem mudar, e so estas: a aba alvo, sempre;
 * xl/sharedStrings.xml, ao gravar texto; xl/styles.xml, quando o passo 5b de
 * TD-05.1 dispara — de forma estritamente aditiva, nenhum xf existente e
 * alterado, entao nenhuma celula fora da edicao muda de aparencia; e
 * xl/calcChain.xml, ao remover formula, para nao deixar entrada orfa apontando
 * para celula que nao calcula mais.
 *
 * A remocao na cadeia repassa o atributo `i` — o indice da aba — para a entrada
 * seguinte, com qualquer conjunto de atributos (o Excel emite tambem `l`, `s`,
 * `t` e `a`), nas duas formas de fechamento e com espaco entre as entradas.
 * Entrada que ja declara `i` proprio nao herda nada e nao e tocada. **A
 * seguinte precisa ser a proxima entrada da cadeia**: comentario ou elemento
 * estranho entre as duas faz o `i` se perder, e nenhum produtor conformante os
 * emite ali.
 *
 * O QUE NAO SE FAZ, e a consequencia: o cache de valor das celulas que
 * DEPENDEM da formula removida nao e invalidado — nao se marca
 * fullCalcOnLoad em <calcPr>. As dependentes exibem o valor antigo ate um
 * recalculo manual. Nao e corrupcao, e o cache do Excel funcionando como
 * projetado, mas e enganoso quando existe formula dependente da celula editada.
 * Marcar fullCalcOnLoad e a saida se isso passar a importar. Hoje nao importa:
 * a aba 2026 nao tem formula alguma — ver o bloco de H-24 em
 * docs/06-backlog.md, onde a medicao e a data estao registradas.
 *
 * CINCO LIMITES conhecidos, nenhum alcancavel pelas fixtures nem pela planilha
 * real. Os dois primeiros vieram do revisor-xml em H-24; o terceiro e o quarto,
 * dele tambem, ao revisar a fixture de cadeia (ver PD-05); o quinto, dele em
 * H-27, quando a repintura multiplicou por doze a exposicao a ele:
 *
 * 1. Se xl/sharedStrings.xml NAO existir no zip, gravar texto cria a entrada
 *    sem declara-la em [Content_Types].xml nem em xl/_rels/workbook.xml.rels,
 *    e o arquivo resultante e invalido. Toda planilha do Excel com texto ja
 *    tem a entrada; um .xlsx so de numeros, produzido por outra ferramenta,
 *    nao teria.
 * 2. StyleTable.serialize com sectionStart === -1 — arquivo sem <cellXfs> —
 *    produziria XML corrompido. Hoje e inalcancavel porque ensureDateFormat
 *    sai antes quando a tabela esta vazia: protecao ACIDENTAL, nao deliberada,
 *    e por isso anotada aqui em vez de silenciada.
 * 3. removeFromCalcChain casa a entrada por `r=` e NAO desambigua a aba. Duas
 *    abas com formula na mesma coordenada fariam a remocao acertar a entrada
 *    da aba errada, deixando orfa a da aba alvo. Desambiguar exigiria resolver
 *    o sheetId aqui dentro, cruzando xl/workbook.xml com os rels — o que este
 *    modulo nao faz e nao precisa fazer enquanto a planilha nao tiver formula.
 * 4. Remover a ULTIMA formula esvazia a cadeia, e <calcChain/> sem nenhum <c>
 *    viola o schema (CT_CalcChain exige minOccurs="1"). O Excel, nessa
 *    situacao, apaga a parte inteira e a declaracao dela. Alcancavel so num
 *    arquivo cujas formulas sejam TODAS editadas de uma vez.
 * 5. findCell e findRow casam `<c r="…"` e `<row r="…"`, com o `r` na PRIMEIRA
 *    posicao — e a saida antecipada da linha auto-fechada, em paintRow, tem a
 *    mesma restricao. Celula ou linha com `r` depois de outro atributo e lida
 *    como ausente. Ao gravar valor isso vale para 1 celula por edicao; ao
 *    repintar, para 12 por linha — e o desfecho e o oposto nos dois casos: a
 *    gravacao inseriria uma segunda <c> para a mesma coordenada, a repintura
 *    apenas nao pinta. Nenhum produtor conformante emite `r` fora da primeira
 *    posicao; o Excel sempre o emite primeiro.
 *    **`appendRow` NAO herda este limite**, e por isso ela nao usa `findRow`:
 *    `lastRowOf` le o `r` em qualquer posicao da tag e depois de qualquer
 *    whitespace, e o guarda dela e "vem depois de TODAS". Medido em 02/09/2026,
 *    depois de o revisor-xml achar o caso do TAB: `<row\tr="4">` era ignorado
 *    pela leitura por espaco literal, e a linha nova saia com `r` DUPLICADO.
 *
 * Nao foram tratados por escolha: cobri-los exigiria fixture que o gerador nao
 * produz, e o codigo nao verificado por teste e o que engana. H-25 tem o
 * write-guard, que e o lugar de recusar arquivo fora do formato esperado.
 */

export interface CellEdit {
  sourceRow: number
  column: string
  value: string | number | Date | null
}

/** Uma linha repintada: o `fillId` alvo e as colunas que acompanham a cor. */
export interface RowFillEdit {
  sourceRow: number
  fillId: number
  columns: string[]
}

/**
 * Uma linha NOVA no fim da aba (02/09/2026).
 *
 * `sourceRow` vem de quem chama, resolvido contra a leitura canonica do
 * momento da escrita — nunca de um numero congelado no enfileiramento. A defesa
 * contra linha deslocada e a mesma de `H-25`, aqui aplicada ao contrario: la o
 * alvo se acha pela REF, e uma insercao ainda nao tem REF no arquivo.
 */
/**
 * A Tabela do Excel nao alcanca a linha pedida.
 *
 * Classe propria, e nao `Error` generico, porque o chamador precisa DISTINGUIR:
 * o `write-guard` traduz todo lanco da cirurgia em "a gravacao nao pode ser
 * concluida com seguranca", e o operador ficaria sem saber que a folga da
 * `Tabela1` acabou — que e um evento previsivel e com data. Achado do
 * revisor-xml.
 */
export class TableFullError extends Error {
  override readonly name = 'TableFullError'
}

export interface RowInsert {
  sourceRow: number
  /** Valor por coluna. Coluna ausente NAO vira `<c>`, como o Excel faz. */
  values: Record<string, CellEdit['value']>
}

export interface SurgeryResult {
  buffer: Uint8Array
  cellsWritten: number
  entriesPreserved: number
}

export interface RowFillResult extends SurgeryResult {
  /**
   * Linhas em que ao menos uma celula mudou de estilo — MEDIDO, nao pedido.
   * Uma linha cujas celulas ja estejam na cor alvo nao entra na conta, e e
   * este numero que a aplicacao mostra ao operador.
   */
  rowsPainted: number
}

const SHARED_STRINGS_PATH = 'xl/sharedStrings.xml'
const STYLES_PATH = 'xl/styles.xml'
const CALC_CHAIN_PATH = 'xl/calcChain.xml'

/** Os limites de endereçamento da planilha desde o formato de 2007: XFD e a
    ultima coluna, 1.048.576 a ultima linha. Coordenada alem de qualquer um dos
    dois faz o Excel abrir pedindo reparo e reconstruir a aba. */
const MAX_ROW = 1_048_576
const MAX_COLUMN = 16_384

const MS_PER_DAY = 86_400_000
// O Excel conta a partir de 1899-12-30 por causa do ano bissexto ficticio de
// 1900, que ele mantem por compatibilidade com o Lotus 1-2-3.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

// `d-mmm` embutido, usado so quando o arquivo nao declara formato de data
// proprio. Preferir o do arquivo mantem a celula nova igual as vizinhas.
const FALLBACK_DATE_NUM_FMT_ID = 16
const BUILT_IN_DATE_FMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

export function applyCellEdits(
  original: Uint8Array,
  edits: CellEdit[],
  sheetPath: string,
): SurgeryResult {
  const entries = unzipSync(original)

  if (edits.length === 0) {
    return { buffer: original, cellsWritten: 0, entriesPreserved: Object.keys(entries).length }
  }

  const sheetEntry = entries[sheetPath]
  if (!sheetEntry) throw new Error(`aba nao encontrada no zip: ${sheetPath}`)

  const sharedStringsEntry = entries[SHARED_STRINGS_PATH]
  const stylesEntry = entries[STYLES_PATH]
  const sharedStrings = new SharedStringPool(
    sharedStringsEntry ? strFromU8(sharedStringsEntry) : null,
  )
  const styles = new StyleTable(stylesEntry ? strFromU8(stylesEntry) : null)

  let sheetXml = strFromU8(sheetEntry)
  let cellsWritten = 0
  const clearedFormulas: string[] = []

  for (const edit of edits) {
    sheetXml = writeCell(sheetXml, edit, sharedStrings, styles, clearedFormulas)
    cellsWritten += 1
  }

  const rebuilt: Record<string, Uint8Array> = { ...entries }
  rebuilt[sheetPath] = strToU8(sheetXml)
  if (sharedStrings.changed) rebuilt[SHARED_STRINGS_PATH] = strToU8(sharedStrings.serialize())
  if (styles.changed) rebuilt[STYLES_PATH] = strToU8(styles.serialize())

  const calcChainEntry = entries[CALC_CHAIN_PATH]
  if (calcChainEntry && clearedFormulas.length > 0) {
    let calcChain = strFromU8(calcChainEntry)
    for (const reference of clearedFormulas) calcChain = removeFromCalcChain(calcChain, reference)
    rebuilt[CALC_CHAIN_PATH] = strToU8(calcChain)
  }

  let entriesPreserved = 0
  for (const [path, content] of Object.entries(rebuilt)) {
    if (sameBytes(content, entries[path])) entriesPreserved += 1
  }

  return { buffer: zipSync(rebuilt), cellsWritten, entriesPreserved }
}

/**
 * Acrescenta uma linha DEPOIS da ultima que existe na aba.
 *
 * **A linha nasce em branco, no sentido do Excel**: cada celula recebe o estilo
 * declarado pela COLUNA em `<cols>`, e nada mais. Medido no arquivo real em
 * 02/09/2026: as 16 colunas declaram `style="162"` — fonte 1, centralizado, sem
 * preenchimento e sem borda. Copiar o estilo da linha de cima seria mais facil e
 * estaria errado: `xf 181`, o das ultimas 95 linhas, carrega `fillId 8`, que o
 * `color-map.json` traduz como **Colaborador 1** — todo processo novo nasceria
 * atribuido a uma pessoa que ninguem escolheu (regra inviolavel 3).
 *
 * Data continua passando por `ensureDateFormat`, como em `applyCellEdits`: a
 * coluna declara `numFmtId=0`, e sem isso o Excel mostraria o serial cru
 * (A-56).
 *
 * **CINCO recusas na entrada, e duas a jusante — todas a mesma preocupacao, nao
 * gravar as cegas.** Quem escrever o chamador precisa traduzir as sete em recusa
 * ao operador; hoje elas sobem como excecao.
 *
 * 1. `values` vazio. Criar linha sem celula alguma mudaria os bytes do arquivo
 *    — hash novo, backup consumido, releitura do watcher — para gravar nada.
 * 2. Chave de coluna que nao e letra de coluna, ou passa de `XFD`. Coordenada
 *    fora do espaco de endereçamento faz o Excel reconstruir a aba.
 * 3. `sourceRow` que nao e indice de linha valido (1 a `MAX_ROW`).
 * 4. `sourceRow` que NAO vem depois de todas. `<sheetData>` exige `<row>` em
 *    ordem crescente de `r`, e a insercao e sempre antes de `</sheetData>`:
 *    mirar um buraco no meio produziria 1,2,4,3. Este guarda tambem cobre o
 *    caso de o arquivo ter crescido desde a leitura que resolveu o alvo — o que
 *    faz `H-25` resolver a celula pela REF, aqui aplicado ao contrario.
 * 5. A linha cair FORA da Tabela do Excel. O arquivo real tem
 *    `xl/tables/table1.xml` com `ref="A1:P997"` contra 745 linhas escritas —
 *    ha folga, e enquanto houver a Tabela nao precisa ser estendida. Quando
 *    acabar, uma linha alem do `ref` nasceria fora da Tabela: sem banda, fora do
 *    filtro, e colidindo com a proxima linha que o Excel expandir sozinho.
 *    Estender o `ref` e trabalho de outra fatia; ate la, a recusa e o que
 *    impede o dano silencioso (regra inviolavel 2).
 *
 * As duas a jusante: `<sheetData>` que nao pode ser localizada, e `<dimension>`
 * presente em forma que nao e intervalo. `renderCell` acrescenta a terceira, em
 * numero nao finito.
 */
export function appendRow(
  original: Uint8Array,
  insert: RowInsert,
  sheetPath: string,
): SurgeryResult {
  const entries = unzipSync(original)

  const sheetEntry = entries[sheetPath]
  if (!sheetEntry) throw new Error(`aba nao encontrada no zip: ${sheetPath}`)

  let sheetXml = strFromU8(sheetEntry)

  const columns = Object.keys(insert.values).sort(
    (left, right) => columnIndex(left) - columnIndex(right),
  )
  /*
    Linha sem celula nenhuma nao e pedido legitimo: `applyCellEdits` devolve o
    buffer intacto para lista vazia porque "nada a gravar" e estado normal da
    fila, mas quem chama AQUI pediu para criar uma linha. Sem a recusa, o
    arquivo do operador mudaria de bytes — hash novo, backup consumido,
    releitura do watcher — para gravar `<row>` sem celula alguma.
  */
  if (columns.length === 0) throw new Error('insercao sem celula alguma')
  for (const column of columns) {
    // `a`, `A1` e `` produzem coordenada que contradiz a linha, ou nem e
    // referencia: o Excel abre pedindo reparo e reconstroi a aba.
    // A FORMA e o LIMITE: `ZZZ` casa a forma e endereca a coluna 18.278, que nao
    // existe. O eixo de linha ganhou `MAX_ROW`; este e o par dele.
    if (!/^[A-Z]{1,3}$/.test(column) || columnIndex(column) > MAX_COLUMN) {
      throw new Error(`coluna invalida: "${column}"`)
    }
  }

  /*
    **A linha precisa vir DEPOIS de todas**, e nao apenas "nao existir".
    `<sheetData>` exige `<row>` em ordem crescente de `r`, e a insercao e sempre
    antes de `</sheetData>`: mirar um buraco no meio — linhas 1,2,4 e alvo 3 —
    produz 1,2,4,3, e o Excel reconstroi a aba inteira removendo os registros de
    linha. `r` tambem e indice, de 1 a 1.048.576: fracionario e negativo passam
    pelo tipo `number` e nao pelo formato.
  */
  if (!Number.isInteger(insert.sourceRow) || insert.sourceRow < 1 || insert.sourceRow > MAX_ROW) {
    throw new Error(`linha invalida: ${insert.sourceRow}`)
  }
  const ultima = lastRowOf(sheetXml)
  if (insert.sourceRow <= ultima) {
    throw new Error(`linha ${insert.sourceRow} nao e depois da ultima, que e a ${ultima}`)
  }

  const limite = tableLastRow(entries, sheetPath)
  if (limite !== null && insert.sourceRow > limite) {
    throw new TableFullError(
      `linha ${insert.sourceRow} fica fora da Tabela do Excel, que termina na ${limite}`,
    )
  }

  const sharedStringsEntry = entries[SHARED_STRINGS_PATH]
  const stylesEntry = entries[STYLES_PATH]
  const sharedStrings = new SharedStringPool(
    sharedStringsEntry ? strFromU8(sharedStringsEntry) : null,
  )
  const styles = new StyleTable(stylesEntry ? strFromU8(stylesEntry) : null)

  let cells = ''
  let cellsWritten = 0
  for (const column of columns) {
    const value = insert.values[column] ?? null
    const columnStyle = columnStyleOf(sheetXml, column)
    const style = value instanceof Date ? styles.ensureDateFormat(columnStyle) : columnStyle
    if (typeof value === 'string') sharedStrings.adjustReferences(1)
    cells += renderCell(`${column}${insert.sourceRow}`, style, value, sharedStrings)
    cellsWritten += 1
  }

  // `spans` acompanha o que foi escrito, como nas linhas vizinhas — o arquivo
  // real usa 1:14, 1:15 e 1:16 conforme a linha. E dica de renderizacao, nao
  // conteudo: emiti-la errada nao corrompe, mas emiti-la certa custa nada.
  const first = columns[0]
  const last = columns[columns.length - 1]
  const spans =
    first === undefined || last === undefined
      ? ''
      : ` spans="${columnIndex(first)}:${columnIndex(last)}"`
  const row = `<row r="${insert.sourceRow}"${spans}>${cells}</row>`

  /*
    `<sheetData />` — com espaco antes do fechamento — e XML legal e equivalente
    ao auto-fechado sem espaco. Casar a string literal deixava a gravacao cair no
    `replace` de `</sheetData>`, que nao existe: a linha sumia e a funcao
    devolvia sucesso, com `sharedStrings` ja incrementado. A conferencia depois
    do `replace` e o que transforma o silencio em erro.
  */
  const antes = sheetXml
  sheetXml = /<sheetData\s*\/>/.test(sheetXml)
    ? sheetXml.replace(/<sheetData\s*\/>/, `<sheetData>${row}</sheetData>`)
    : sheetXml.replace('</sheetData>', `${row}</sheetData>`)
  if (sheetXml === antes) throw new Error('nao foi possivel localizar <sheetData> na aba')
  sheetXml = growDimension(sheetXml, insert.sourceRow, columns)

  const rebuilt: Record<string, Uint8Array> = { ...entries }
  rebuilt[sheetPath] = strToU8(sheetXml)
  if (sharedStrings.changed) rebuilt[SHARED_STRINGS_PATH] = strToU8(sharedStrings.serialize())
  if (styles.changed) rebuilt[STYLES_PATH] = strToU8(styles.serialize())

  let entriesPreserved = 0
  for (const [path, content] of Object.entries(rebuilt)) {
    if (sameBytes(content, entries[path])) entriesPreserved += 1
  }

  return { buffer: zipSync(rebuilt), cellsWritten, entriesPreserved }
}

/** O maior `r` declarado na aba. `0` quando nao ha linha alguma. */
function lastRowOf(sheetXml: string): number {
  let last = 0
  // `\s`, e nao um espaco literal: TAB entre `<row` e o primeiro atributo e
  // whitespace legal em XML, e a linha nao contada faria a insercao emitir um
  // `r` DUPLICADO. Achado do revisor-xml na segunda passagem.
  for (const row of sheetXml.matchAll(/<row\s[^>]*?\br="(\d+)"/g)) {
    last = Math.max(last, Number(row[1]))
  }
  return last
}

/** `A1:P997` e `A1` — as duas formas de `ref`. `null` quando nao e intervalo. */
function parseRef(
  ref: string | null,
): { first: string; firstRow: number; last: string; lastRow: number } | null {
  const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref ?? '')
  if (!match) return null

  const first = match[1] ?? ''
  return {
    first,
    firstRow: Number(match[2]),
    last: match[3] ?? first,
    lastRow: Number(match[4] ?? match[2]),
  }
}

/**
 * A ultima linha coberta pelas Tabelas do Excel desta aba, ou `null` quando a
 * aba nao tem Tabela.
 *
 * **Resolve pelos rels da aba ALVO, e nunca varre `xl/tables/` inteiro.** O
 * arquivo real tem quatro abas, e tres estao fora de escopo: casar a tabela pelo
 * nome do arquivo faria a insercao consultar — ou, pior, um dia estender — a
 * Tabela da aba `2025` (regra inviolavel 10).
 *
 * **O limite e o MINIMO entre TODAS as Tabelas da aba, sem filtrar por coluna.**
 * A primeira versao so considerava Tabela que sobrepusesse as colunas escritas,
 * e o revisor-xml mediu o buraco: com `Tabela A1:P4` e um insert na coluna `Q`,
 * o limite sumia e a linha 90.000 era aceita — o guarda virava contornavel pela
 * escolha das colunas. O minimo sem filtro nao e contornavel, e o preco e recusa
 * FALSA numa aba com duas Tabelas desalinhadas: direcao segura, e a aba `2026`
 * tem uma so.
 */
function tableLastRow(entries: Record<string, Uint8Array>, sheetPath: string): number | null {
  const relsPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels')
  const relsEntry = entries[relsPath]
  // Aba com Tabela SEMPRE tem rels: a ausencia e "nao ha Tabela", nao "nao sei".
  if (!relsEntry) return null

  let last: number | null = null
  for (const match of strFromU8(relsEntry).matchAll(/Target="([^"]*tables\/[^"]+)"/g)) {
    // `../tables/x.xml` e relativo a `xl/worksheets/`; `/xl/tables/x.xml` e nome
    // de parte ABSOLUTO, legal em OPC e emitido por outras ferramentas.
    const raw = match[1] ?? ''
    const target = raw.startsWith('/') ? raw.slice(1) : raw.replace(/^\.\.\//, 'xl/')
    const tableEntry = entries[target]
    if (!tableEntry) continue

    const ref = parseRef(
      readAttribute(/<table[^>]*>/.exec(strFromU8(tableEntry))?.[0] ?? '', 'ref'),
    )
    if (ref === null) continue

    last = last === null ? ref.lastRow : Math.min(last, ref.lastRow)
  }
  return last
}

/**
 * Estende `<dimension>` para cobrir a linha nova E as colunas escritas.
 *
 * **A primeira versao errou nos dois sentidos, e o revisor-xml mediu os dois.**
 * Ela lancava em `ref="a1:p4"` — caixa baixa, que o Excel le sem reclamar —,
 * derrubando uma gravacao que antes funcionava; e, partindo de `ref="A1"`,
 * montava `A1:A5` para um insert que escreveu ate `P`, ASSINANDO um intervalo
 * que exclui a celula recem-gravada. Silencio virou afirmacao errada, que e pior.
 *
 * Agora: caixa e normalizada, as duas formas de fechamento e atributos extras
 * casam, e o canto final e o MAXIMO entre o que a dimensao ja declarava e o que
 * foi escrito. Ausente continua legitimo — `<dimension>` e opcional no OOXML.
 * Presente e ilegivel continua lancando, e agora a forma ilegivel e so a que
 * nao e intervalo.
 */
function growDimension(sheetXml: string, row: number, columns: readonly string[]): string {
  const match = /<dimension\b[^>]*?\bref="([^"]*)"[^>]*?>/.exec(sheetXml)
  if (!match) return sheetXml

  const ref = parseRef((match[1] ?? '').toUpperCase())
  if (ref === null) throw new Error(`<dimension> em forma nao reconhecida: ${match[1]}`)

  const escrita = columns[columns.length - 1] ?? 'A'
  const fim = columnIndex(ref.last) >= columnIndex(escrita) ? ref.last : escrita
  const linha = Math.max(ref.lastRow, row)
  if (fim === ref.last && linha === ref.lastRow) return sheetXml

  return sheetXml.replace(match[0], `<dimension ref="${ref.first}${ref.firstRow}:${fim}${linha}"/>`)
}

/**
 * Repinta linhas trocando o `fillId` do cellXf de cada celula, nunca o
 * `styleId` inteiro (TD-05.1, achado A-49). VALOR NENHUM e tocado, e nenhuma
 * celula e criada: so o atributo `s=` das celulas que ja existem muda.
 *
 * Separada de `applyCellEdits`, e nao um parametro dela, porque o contrato de
 * H-27 a fixa assim. Quem tem os dois tipos de edicao encadeia as duas sobre o
 * buffer — o custo e um unzip/zip a mais, e so quando ha cor na fila.
 *
 * Consequencia do encadeamento: `entriesPreserved` da SEGUNDA passagem compara
 * com o buffer que a primeira produziu, nao com o arquivo original. Quem
 * precisa do numero contra o original compara os dois zips.
 */
export function applyRowFill(
  original: Uint8Array,
  edits: RowFillEdit[],
  sheetPath: string,
): RowFillResult {
  const entries = unzipSync(original)

  if (edits.length === 0) {
    return {
      buffer: original,
      cellsWritten: 0,
      rowsPainted: 0,
      entriesPreserved: Object.keys(entries).length,
    }
  }

  const sheetEntry = entries[sheetPath]
  if (!sheetEntry) throw new Error(`aba nao encontrada no zip: ${sheetPath}`)

  const stylesEntry = entries[STYLES_PATH]
  const styles = new StyleTable(stylesEntry ? strFromU8(stylesEntry) : null)

  let sheetXml = strFromU8(sheetEntry)
  let cellsWritten = 0
  let rowsPainted = 0

  for (const edit of edits) {
    // Antes de tocar em qualquer celula: `fillId` fora de `<fills>` produziria
    // um xf com indice pendurado, e o Excel abriria pedindo reparo. Recusar aqui
    // deixa o arquivo intacto; deixar passar custaria a restauracao do backup.
    if (!styles.hasFill(edit.fillId)) {
      throw new Error(`fillId ${edit.fillId} nao existe em xl/styles.xml`)
    }
    const painted = paintRow(sheetXml, edit, styles)
    sheetXml = painted.xml
    cellsWritten += painted.cells
    if (painted.cells > 0) rowsPainted += 1
  }

  const rebuilt: Record<string, Uint8Array> = { ...entries }
  rebuilt[sheetPath] = strToU8(sheetXml)
  if (styles.changed) rebuilt[STYLES_PATH] = strToU8(styles.serialize())

  let entriesPreserved = 0
  for (const [path, content] of Object.entries(rebuilt)) {
    if (sameBytes(content, entries[path])) entriesPreserved += 1
  }

  return { buffer: zipSync(rebuilt), cellsWritten, rowsPainted, entriesPreserved }
}

/**
 * Uma passagem por LINHA, e nao por celula: `expandSelfClosingRow` e `findRow`
 * varrem a aba inteira, e refaze-los doze vezes por linha multiplicaria por
 * doze o custo de uma aplicacao grande (RNF-15 da 15 s para 100 celulas).
 *
 * As celulas sao resolvidas uma a uma sobre o `inner` ja atualizado, porque os
 * indices de `findCell` sao relativos a ele.
 */
function paintRow(
  sheetXml: string,
  edit: RowFillEdit,
  styles: StyleTable,
): { xml: string; cells: number } {
  // A linha auto-fechada NAO e expandida aqui, ao contrario do que acontece ao
  // gravar valor: `<row .../>` nao tem celula alguma, a repintura nao cria
  // nenhuma, e abri-la para `<row ...></row>` produziria diferenca no arquivo
  // sem uma unica celula pintada.
  if (new RegExp(`<row r="${edit.sourceRow}"(?:\\s[^>]*?)?/>`).test(sheetXml)) {
    return { xml: sheetXml, cells: 0 }
  }

  const row = findRow(sheetXml, edit.sourceRow)
  if (!row) throw new Error(`linha ${edit.sourceRow} nao encontrada na aba`)

  let inner = row.inner
  let cells = 0

  for (const column of edit.columns) {
    const reference = `${column}${edit.sourceRow}`
    const existing = findCell(inner, reference)

    // CELULA AUSENTE NAO E CRIADA. Ela ja e governada pelo estilo da coluna, e
    // criar uma com o preenchimento novo lhe daria o borderId da coluna — zero
    // na planilha real —, deixando a linha colorida e SEM as bordas da tabela
    // justamente nas colunas vazias. Buraco visivel e melhor que aparencia
    // inventada (regra inviolavel 3), e o criterio de aceite de H-27 diz que
    // apenas o atributo `s=` muda.
    //
    // Medido em 17/08/2026 sobre a planilha real: 744 linhas de dados, ZERO
    // celulas ausentes em A a L. O ramo nao e alcancavel pelo arquivo de
    // producao; existe para nao inventar aparencia num arquivo atipico.
    if (!existing) continue

    const currentStyle = readAttribute(openTagOf(existing.text), 's')

    // A mesma heranca do Excel usada ao gravar valor: celula, depois linha,
    // depois coluna. Celula presente SEM `s=` herda o estilo da coluna, e nao
    // cellXfs[0]: e a coluna que o Excel aplica nela, e partir do xf zero
    // trocaria a fonte e o alinhamento que ela ja exibe.
    const inherited = currentStyle ?? rowStyleOf(row.openTag) ?? columnStyleOf(sheetXml, column)

    const resolved = styles.ensureFill(inherited, edit.fillId)

    // A celula ja EXIBE o estilo alvo: reescreve-la nao mudaria a aparencia e
    // contaria uma repintura que nao aconteceu. Comparado contra o estilo
    // herdado, e nao so contra o `s=` proprio — celula sem `s=` cuja coluna ja
    // carrega o `fillId` alvo receberia um `s=` explicito redundante, alterando
    // bytes numa linha que ja esta na cor pedida. Achado do revisor-xml.
    //
    // A igualdade so acontece quando o xf herdado ja tem o `fillId` alvo E ja
    // tem applyFill="1": com applyFill="0" a celula NAO exibe aquele
    // preenchimento, e a repintura ocorre — corretamente. Com `inherited` nulo,
    // `ensureFill` devolve "0", que difere de `null`, e a celula e reescrita;
    // so alcancavel com `fillId` alvo zero, que nenhuma entrada do mapa tem.
    if (resolved === inherited) continue

    inner =
      inner.slice(0, existing.start) +
      withStyleAttribute(existing.text, resolved) +
      inner.slice(existing.end)
    cells += 1
  }

  return { xml: sheetXml.slice(0, row.innerStart) + inner + sheetXml.slice(row.innerEnd), cells }
}

/**
 * A tag de abertura da celula, sem o conteudo.
 *
 * Ler atributo do elemento INTEIRO e um vetor real: uma celula de texto inline
 * — `<c r="A22" t="inlineStr"><is><t>… s="7" …</t></is></c>` — faz `readAttribute`
 * casar o ` s="7"` de dentro do TEXTO, e a repintura parte do estilo errado,
 * trocando fonte e borda de uma celula que so deveria mudar de preenchimento.
 * Achado do revisor-xml na segunda revisao de H-27.
 */
function openTagOf(cell: string): string {
  const end = cell.indexOf('>')
  return end === -1 ? cell : cell.slice(0, end)
}

/**
 * Troca `s=` sem tocar em mais nada da celula — valor, `t=`, formula.
 *
 * A substituicao acontece so na TAG DE ABERTURA: uma celula de texto cujo valor
 * contenha ` s="` teria o conteudo corrompido por um replace sobre o elemento
 * inteiro.
 */
function withStyleAttribute(cell: string, styleId: string): string {
  const openTagEnd = cell.indexOf('>')
  const head = cell.slice(0, openTagEnd)
  const tail = cell.slice(openTagEnd)

  if (readAttribute(head, 's') !== null) {
    return head.replace(/\ss="[^"]*"/, ` s="${styleId}"`) + tail
  }
  // Depois de `r=`, na ordem em que o proprio Excel emite os atributos.
  return head.replace(/^(<c\s+r="[^"]*")/, `$1 s="${styleId}"`) + tail
}

function writeCell(
  sheetXml: string,
  edit: CellEdit,
  sharedStrings: SharedStringPool,
  styles: StyleTable,
  clearedFormulas: string[],
): string {
  const reference = `${edit.column}${edit.sourceRow}`
  const expanded = expandSelfClosingRow(sheetXml, edit.sourceRow)
  const row = findRow(expanded, edit.sourceRow)
  if (!row) throw new Error(`linha ${edit.sourceRow} nao encontrada na aba`)

  const existing = findCell(row.inner, reference)
  if (existing) {
    assertNotSharedFormulaMaster(existing.text, reference)
    if (existing.text.includes('<f')) clearedFormulas.push(reference)
  }

  // Celula ausente nao tem `s=` para preservar, e emitir <c> sem estilo a joga
  // em cellXfs[0] (Geral): data viraria o serial cru na tela, que e o defeito
  // de A-56 no caso mais provavel — coluna O, 79,3% vazia no arquivo real.
  // A herança segue a do proprio Excel: celula, depois linha, depois coluna.
  //
  // `openTagOf` protege as duas leituras: sem ele, texto inline contendo ` s="`
  // ou ` t="` faz `readAttribute` casar o conteudo da celula. Achado do
  // revisor-xml em H-27, e o mesmo defeito valia aqui desde H-24.
  const openTag = existing ? openTagOf(existing.text) : null
  const inheritedStyle =
    (openTag === null ? null : readAttribute(openTag, 's')) ??
    rowStyleOf(row.openTag) ??
    columnStyleOf(expanded, edit.column)

  const resolvedStyle =
    edit.value instanceof Date ? styles.ensureDateFormat(inheritedStyle) : inheritedStyle

  sharedStrings.adjustReferences(
    (typeof edit.value === 'string' ? 1 : 0) -
      (openTag !== null && readAttribute(openTag, 't') === 's' ? 1 : 0),
  )

  const cellXml = renderCell(reference, resolvedStyle, edit.value, sharedStrings)

  const nextInner = existing
    ? row.inner.slice(0, existing.start) + cellXml + row.inner.slice(existing.end)
    : insertCellInColumnOrder(row.inner, reference, cellXml)

  return expanded.slice(0, row.innerStart) + nextInner + expanded.slice(row.innerEnd)
}

function renderCell(
  reference: string,
  styleId: string | null,
  value: CellEdit['value'],
  sharedStrings: SharedStringPool,
): string {
  const style = styleId === null ? '' : ` s="${styleId}"`

  if (value === null) return `<c r="${reference}"${style}/>`

  if (value instanceof Date) {
    return `<c r="${reference}"${style}><v>${toExcelSerial(value)}</v></c>`
  }

  if (typeof value === 'number') {
    // `NaN` e `Infinity` serializam como texto e NAO sao valor numerico do
    // Excel: o arquivo abre pedindo reparo. Recusar aqui e a unica barreira —
    // o tipo `number` de TypeScript admite os dois.
    if (!Number.isFinite(value))
      throw new Error(`valor numerico invalido em ${reference}: ${value}`)
    return `<c r="${reference}"${style}><v>${value}</v></c>`
  }

  return `<c r="${reference}"${style} t="s"><v>${sharedStrings.indexOf(value)}</v></c>`
}

// O no <f> some junto com o valor: formula orfa apontando para valor fixo faz o
// Excel recalcular por cima do que o operador acabou de gravar.
function findCell(
  rowInner: string,
  reference: string,
): { text: string; start: number; end: number } | null {
  // As duas formas sao alternativas SEPARADAS, e nao um sufixo opcional: com
  // `(?:\s[^>]*)?(?:/>|>...</c>)` o grupo de atributos engole a barra de uma
  // celula vazia, `/>` deixa de casar, e a varredura ate `</c>` atravessa a
  // celula seguinte — e ate a linha seguinte.
  const pattern = new RegExp(
    `<c r="${reference}"(?:\\s[^>]*?)?/>|<c r="${reference}"(?:\\s[^>]*?)?>[\\s\\S]*?</c>`,
  )
  const match = pattern.exec(rowInner)
  if (!match) return null
  return { text: match[0], start: match.index, end: match.index + match[0].length }
}

// Uma formula compartilhada mestre — <f t="shared" ref="..." si="N"> — carrega
// a definicao que as dependentes daquele si apenas referenciam. Sobrescreve-la
// deixaria as outras celulas sem definicao, e reescrever a formula noutra
// ancora exigiria traduzi-la: adivinhacao, que a regra inviolavel 3 proibe.
// A dependente nao tem `ref` e so afeta a si mesma, entao e permitida.
function assertNotSharedFormulaMaster(cell: string, reference: string): void {
  const formula = /<f\s[^>]*>/.exec(cell)?.[0]
  if (!formula) return
  if (readAttribute(formula, 't') === 'shared' && readAttribute(formula, 'ref') !== null) {
    throw new Error(
      `${reference} e a celula mestre de uma formula compartilhada; sobrescreve-la invalidaria as dependentes`,
    )
  }
}

// A entrada da cadeia de calculo herda `i` — o indice da aba — da anterior.
// Remover quem o declara sem repassa-lo mudaria a aba das entradas seguintes,
// e o Excel abriria pedindo reparo.
//
// A seguinte e casada por `<c` e QUALQUER atributo, nao por `<c r="…"/>`: o
// Excel emite tambem `l`, `s`, `t` e `a` nessas entradas, e casar so a forma
// minima perdia o `i` justamente nas cadeias que o Excel produz — deixando a
// cadeia inteira sem indice de aba, que e a entrada orfa que esta funcao existe
// para evitar. Achado do revisor-xml ao fechar PD-05.
//
// As DUAS formas de fechamento valem nos DOIS lados. Ampliar so o repasse
// deixava a funcao capaz de produzir `<c …></c>` e incapaz de remove-la depois:
// duas edicoes na mesma cadeia geravam a orfa que a primeira tinha acabado de
// evitar.
function removeFromCalcChain(calcChainXml: string, reference: string): string {
  const match = new RegExp(`<c r="${reference}"(?:\\s[^>]*?)?(?:/>|></c>)`).exec(calcChainXml)
  if (!match) return calcChainXml

  const inheritedIndex = readAttribute(match[0], 'i')
  const rest = calcChainXml.slice(match.index + match[0].length)
  const patched =
    inheritedIndex === null
      ? rest
      : // O espaco inicial e a forma `<c ...></c>` sao tolerados porque XML
        // legal os permite: uma cadeia que tenha passado por um formatador
        // perderia o indice de aba inteiro se so a forma compacta casasse.
        // Entrada seguinte que ja declara `i` proprio nao herda nada, e
        // sobrescreve-lo trocaria a aba dela.
        rest.replace(
          /^(\s*)<c\b([^>]*?)(\/>|><\/c>)/,
          (whole, spacing: string, attributes: string, closing: string) =>
            readAttribute(whole, 'i') === null
              ? `${spacing}<c${attributes} i="${inheritedIndex}"${closing}`
              : whole,
        )

  return calcChainXml.slice(0, match.index) + patched
}

// O Excel emite <row .../> para linha formatada sem nenhuma celula. Inserir
// dentro dela exige abri-la ANTES de calcular posicoes: mexer nos indices sem
// reescrever o XML faz o ponto de insercao cair entre a `/` e o `>`, e o
// arquivo deixa de ser bem-formado.
function expandSelfClosingRow(sheetXml: string, rowNumber: number): string {
  const match = new RegExp(`<row r="${rowNumber}"(?:\\s[^>]*?)?/>`).exec(sheetXml)
  if (!match) return sheetXml

  const opened = `${match[0].slice(0, -2)}></row>`
  return sheetXml.slice(0, match.index) + opened + sheetXml.slice(match.index + match[0].length)
}

function findRow(
  sheetXml: string,
  rowNumber: number,
): { openTag: string; inner: string; innerStart: number; innerEnd: number } | null {
  const match = new RegExp(`<row r="${rowNumber}"(?:\\s[^>]*?)?>`).exec(sheetXml)
  if (!match) return null

  const innerStart = match.index + match[0].length
  const innerEnd = sheetXml.indexOf('</row>', innerStart)
  if (innerEnd === -1) return null
  return { openTag: match[0], inner: sheetXml.slice(innerStart, innerEnd), innerStart, innerEnd }
}

function insertCellInColumnOrder(rowInner: string, reference: string, cellXml: string): string {
  const target = columnIndex(columnOf(reference))

  // Basta a abertura de cada <c>: a posicao de insercao e o inicio da primeira
  // celula de coluna maior, e casar o fechamento so reintroduziria o risco de
  // varrer alem da celula.
  for (const cell of rowInner.matchAll(/<c r="([A-Z]+)\d+"/g)) {
    if (columnIndex(cell[1] ?? '') > target) {
      return rowInner.slice(0, cell.index) + cellXml + rowInner.slice(cell.index)
    }
  }
  return rowInner + cellXml
}

// `s=` da <row> so vale quando customFormat="1"; sem isso o atributo existe mas
// o Excel o ignora.
function rowStyleOf(openTag: string): string | null {
  return readAttribute(openTag, 'customFormat') === '1' ? readAttribute(openTag, 's') : null
}

function columnStyleOf(sheetXml: string, column: string): string | null {
  const index = columnIndex(column)
  // `<col ...></col>` e XML legal e o Excel nao o emite, mas outra ferramenta
  // pode: sem a segunda forma a celula nova sairia sem `s=` e cairia em
  // `cellXfs[0]`, perdendo fonte e alinhamento das vizinhas.
  for (const col of sheetXml.matchAll(/<col\s[^>]*?\/>|<col\s[^>]*?>/g)) {
    const min = Number(readAttribute(col[0], 'min') ?? '0')
    const max = Number(readAttribute(col[0], 'max') ?? '0')
    if (index >= min && index <= max) return readAttribute(col[0], 'style')
  }
  return null
}

class SharedStringPool {
  changed = false
  private readonly header: string
  private readonly items: string[]
  private readonly originalCount: number
  private referenceDelta = 0

  constructor(xml: string | null) {
    this.header =
      xml?.slice(0, xml.indexOf('<sst')) ??
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    /*
      `<si/>` auto-fechado entra na lista. Descarta-lo deslocaria em um TODO
      indice `t="s"` posterior a ele — e o pool e GLOBAL a pasta de trabalho,
      entao as quatro abas passariam a exibir a string errada, inclusive as tres
      fora de escopo (regra inviolavel 10). Achado do revisor-xml em 02/09/2026,
      e o defeito existia desde `H-24`.
    */
    this.items = xml?.match(/<si>[\s\S]*?<\/si>|<si\s*\/>/g) ?? []
    this.originalCount = Number(/<sst[^>]*\scount="(\d+)"/.exec(xml ?? '')?.[1] ?? '0')
  }

  indexOf(value: string): number {
    const rendered = renderSharedString(value)
    const found = this.items.indexOf(rendered)
    if (found !== -1) return found

    this.items.push(rendered)
    this.changed = true
    return this.items.length - 1
  }

  // `count` conta REFERENCIAS na pasta de trabalho, nao entradas: sobrescrever
  // uma celula que ja era `t="s"` por outra string deixa o total intacto.
  // Igualar count a uniqueCount escreveria um numero errado por construcao.
  adjustReferences(delta: number): void {
    if (delta === 0) return
    this.referenceDelta += delta
    this.changed = true
  }

  serialize(): string {
    const count = Math.max(0, this.originalCount + this.referenceDelta)
    return `${this.header}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${this.items.length}">${this.items.join('')}</sst>`
  }
}

// A tabela casa pelo ELEMENTO inteiro, nao pela tupla de quatro campos de
// TD-05.1: dois xf podem ter (numFmt, font, fill, border) iguais e diferir em
// <alignment>, e escolher o errado mudaria a aparencia da celula — exatamente
// o que a regra existe para impedir.
class StyleTable {
  changed = false
  private readonly xml: string
  private readonly entries: string[]
  private readonly dateFormatIds: Set<number>
  private readonly dateNumFmtId: number
  private readonly sectionStart: number
  private readonly sectionEnd: number
  private readonly fillCount: number

  constructor(xml: string | null) {
    this.xml = xml ?? ''
    const section = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(this.xml)
    this.entries = section?.[1]?.match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g) ?? []
    this.sectionStart = section?.index ?? -1
    this.sectionEnd = section ? section.index + section[0].length : -1
    this.dateFormatIds = collectDateFormatIds(this.xml)
    this.dateNumFmtId = prevailingDateNumFmtId(this.entries, this.dateFormatIds)
    // Contado DENTRO de <fills>, e nao no arquivo inteiro: <dxf> — os formatos
    // da formatacao condicional — PODE carregar <fill> pelo schema, e conta-los
    // inflaria o limite, deixando passar o `fillId` pendurado que esta
    // conferencia existe para recusar. Nas fixtures os dois numeros coincidem
    // (31 e 31, com <dxfs count="18">), entao a restricao esta correta por
    // construcao e nao por medicao. Achado do revisor-xml.
    const fills = /<fills count="\d+">([\s\S]*?)<\/fills>/.exec(this.xml)
    this.fillCount = (fills?.[1]?.match(/<fill>|<fill\/>/g) ?? []).length
  }

  /**
   * Se `fillId` existe em `<fills>`. Um indice alem do fim faz o Excel abrir
   * pedindo reparo, e sem esta conferencia o erro so apareceria depois de
   * gravar, na validacao pos-escrita, ao preco de restaurar o backup.
   */
  hasFill(fillId: number): boolean {
    return fillId >= 0 && fillId < this.fillCount
  }

  ensureDateFormat(styleId: string | null): string | null {
    if (this.sectionStart === -1 || this.entries.length === 0) return styleId

    // Sem estilo herdado, a base e cellXfs[0]: precisa existir um xf de partida
    // sobre o qual trocar o numFmtId, senao a data sai sem formato.
    const base = (styleId === null ? this.entries[0] : this.entries[Number(styleId)]) ?? null
    if (!base) return styleId

    const current = Number(readAttribute(base, 'numFmtId') ?? '0')
    if (styleId !== null && this.dateFormatIds.has(current)) return styleId

    const target = withDateNumberFormat(base, this.dateNumFmtId)
    const existing = this.entries.findIndex((xf) => canonicalXf(xf) === canonicalXf(target))
    if (existing !== -1) return String(existing)

    this.entries.push(target)
    this.changed = true
    return String(this.entries.length - 1)
  }

  /**
   * TD-05.1 aplicado ao `fillId`: preserva fonte, borda e formato numerico do
   * cellXf original. Trocar o estilo inteiro destruiria a borda — medido em
   * A-49: argb:FF00FF00 vem dos styleIds 199, 165 e 189, que compartilham o
   * mesmo preenchimento e diferem nas bordas 34, 5 e 48.
   *
   * LANCA em vez de devolver o estilo recebido, ao contrario de
   * `ensureDateFormat`: uma repintura que nao repinta e silenciosa, e quem a
   * pegaria e a validacao pos-escrita, ao preco de restaurar o backup. Falhar
   * aqui deixa o arquivo intacto. Achado do revisor-xml.
   */
  ensureFill(styleId: string | null, fillId: number): string {
    if (this.sectionStart === -1 || this.entries.length === 0) {
      throw new Error('xl/styles.xml nao tem <cellXfs> utilizavel')
    }

    // Sem estilo herdado a base e cellXfs[0], como em `ensureDateFormat`: e
    // preciso um xf de partida sobre o qual trocar o fillId.
    const baseIndex = styleId === null ? 0 : Number(styleId)
    const base = this.entries[baseIndex]
    if (!base) throw new Error(`styleId ${styleId} nao existe em cellXfs`)

    const target = withFill(base, fillId)
    // A cor ja e a pedida: o `s=` fica como esta, e styles.xml intacto. Procurar
    // um equivalente aqui trocaria o styleId por outro de aparencia identica,
    // mexendo no arquivo sem motivo.
    if (canonicalXf(base) === canonicalXf(target)) return String(baseIndex)

    const existing = this.entries.findIndex((xf) => canonicalXf(xf) === canonicalXf(target))
    if (existing !== -1) return String(existing)

    this.entries.push(target)
    this.changed = true
    return String(this.entries.length - 1)
  }

  serialize(): string {
    const section = `<cellXfs count="${this.entries.length}">${this.entries.join('')}</cellXfs>`
    return this.xml.slice(0, this.sectionStart) + section + this.xml.slice(this.sectionEnd)
  }
}

function collectDateFormatIds(stylesXml: string): Set<number> {
  const ids = new Set(BUILT_IN_DATE_FMT_IDS)
  for (const match of stylesXml.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)) {
    // O seletor de locale — [$-416] — nao e token de data e sairia como falso
    // positivo pelo 4 de 416.
    const code = (match[2] ?? '').replace(/\[[^\]]*\]/g, '')
    if (/[dy]/i.test(code)) ids.add(Number(match[1]))
  }
  return ids
}

// O formato de data mais usado no proprio arquivo, para que a celula nova saia
// igual as vizinhas em vez de trazer um embutido de aparencia diferente.
function prevailingDateNumFmtId(entries: string[], dateFormatIds: Set<number>): number {
  const tally = new Map<number, number>()
  for (const xf of entries) {
    const id = Number(readAttribute(xf, 'numFmtId') ?? '0')
    if (dateFormatIds.has(id)) tally.set(id, (tally.get(id) ?? 0) + 1)
  }

  let chosen = FALLBACK_DATE_NUM_FMT_ID
  let best = 0
  for (const [id, count] of tally) {
    if (count > best) {
      chosen = id
      best = count
    }
  }
  return chosen
}

function withDateNumberFormat(xf: string, numFmtId: number): string {
  const withFormat = xf.replace(/numFmtId="\d+"/, `numFmtId="${numFmtId}"`)
  // TD-05.1 passo 3 fala em trocar so o campo em questao, mas sem
  // applyNumberFormat="1" o Excel ignora o numFmt e a troca nao surte efeito.
  if (withFormat.includes('applyNumberFormat="1"')) return withFormat
  if (withFormat.includes('applyNumberFormat="0"')) {
    return withFormat.replace('applyNumberFormat="0"', 'applyNumberFormat="1"')
  }
  return withFormat.replace(/^<xf /, '<xf applyNumberFormat="1" ')
}

function withFill(xf: string, fillId: number): string {
  const withPattern = /\sfillId="\d+"/.test(xf)
    ? xf.replace(/\sfillId="\d+"/, ` fillId="${fillId}"`)
    : xf.replace(/^<xf /, `<xf fillId="${fillId}" `)

  // Pelo mesmo motivo de `applyNumberFormat` em `withDateNumberFormat`: sem
  // applyFill="1" o Excel ignora o fill do cellXf e a repintura nao aparece.
  if (withPattern.includes('applyFill="1"')) return withPattern
  if (withPattern.includes('applyFill="0"')) {
    return withPattern.replace('applyFill="0"', 'applyFill="1"')
  }
  return withPattern.replace(/^<xf /, '<xf applyFill="1" ')
}

function canonicalXf(xf: string): string {
  const attributes = [...xf.matchAll(/([\w:]+)="([^"]*)"/g)]
    .map((match) => `${match[1]}=${match[2]}`)
    .sort()
    .join(' ')
  const inner = /<xf [^>]*>([\s\S]*)<\/xf>/.exec(xf)?.[1] ?? ''
  return `${attributes}|${inner}`
}

function renderSharedString(value: string): string {
  const needsPreserve = value !== value.trim() || value.includes('\n')
  const space = needsPreserve ? ' xml:space="preserve"' : ''
  return `<si><t${space}>${escapeXml(value)}</t></si>`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Trunca no dia em UTC, nunca arredonda: com Math.round um horario a partir de
// meio-dia viraria o dia seguinte na planilha.
function toExcelSerial(value: Date): number {
  const midnight = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  return (midnight - EXCEL_EPOCH_MS) / MS_PER_DAY
}

function readAttribute(element: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(element)?.[1] ?? null
}

function columnOf(reference: string): string {
  return /^[A-Z]+/.exec(reference)?.[0] ?? ''
}

function columnIndex(column: string): number {
  let index = 0
  for (const letter of column) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index
}

function sameBytes(left: Uint8Array, right: Uint8Array | undefined): boolean {
  if (!right || left.length !== right.length) return false
  return left.every((byte, position) => byte === right[position])
}
