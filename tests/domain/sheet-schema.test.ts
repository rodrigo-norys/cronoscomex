import { describe, expect, it } from 'vitest'
import {
  checkSheetSchema,
  DECLARED_HEADERS,
  describeDivergence,
  type SchemaDivergence,
  writeBlock,
} from '../../src/domain/sheet-schema.ts'

/**
 * `H-96`. A conferencia do cabecalho contra o esquema declarado.
 *
 * **Os valores sao os medidos**, e nao ilustrativos: os 16 cabecalhos saem de
 * `H-01` e foram reconferidos em 17/09/2026 nas NOVE fixtures e na planilha
 * real, onde sao identicos. Por isso o cenario feliz usa `DECLARED_HEADERS`
 * como entrada — ele E o que o arquivo tem.
 *
 * O que estes testes guardam nao e a formatacao das frases: e que **uma edicao
 * na planilha produza UM aviso**. Sem isso o contador da lateral mente, e foi o
 * defeito que a primeira versao deste modulo tinha em dois lugares.
 */

/** O cabecalho como o arquivo real o traz, por letra. */
const BOM = { ...DECLARED_HEADERS }

const LETRAS = Object.keys(DECLARED_HEADERS)

/** Insere uma coluna antes de `IMPORTADOR`, empurrando tudo a direita. */
function comColunaInserida(preservaUltima: boolean): Record<string, string> {
  const headers: Record<string, string> = { A: BOM.A as string, B: BOM.B as string, C: 'NOVA' }
  const ate = preservaUltima ? LETRAS.length : LETRAS.length - 1
  for (let i = 2; i < ate; i++) {
    const destino = LETRAS[i + 1] ?? 'Q'
    headers[destino] = BOM[LETRAS[i] as string] as string
  }
  return headers
}

const soKind = (todas: SchemaDivergence[]): string[] => todas.map((one) => one.kind)

describe('o esquema declarado', () => {
  it('tem as 16 colunas da aba, de A a P — âncora contra guarda vazia', () => {
    expect(LETRAS).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
      'N',
      'O',
      'P',
    ])
  })

  /**
   * **O cabeçalho MENTE sobre o conteúdo, e o esquema segue o arquivo.** A
   * coluna `H` se chama `ETA` e guarda PORTO — medidos `RIO`, `MULTIRIO`,
   * `MULTI`, `SC` e `RO`. Corrigir o nome aqui faria a conferência reprovar a
   * planilha real (regra inviolável 1).
   */
  it('usa o nome do ARQUIVO, inclusive onde ele mente', () => {
    expect(DECLARED_HEADERS.H).toBe('ETA')
    expect(DECLARED_HEADERS.I).toBe('ETA2')
    // Os dois que o Excel gerou sozinho.
    expect(DECLARED_HEADERS.M).toBe('Coluna 13')
    expect(DECLARED_HEADERS.P).toBe('Coluna1')
  })
})

describe('cabeçalho que bate', () => {
  it('não produz divergência nenhuma', () => {
    const check = checkSheetSchema(BOM)

    expect(check.ok).toBe(true)
    expect(check.divergences).toEqual([])
  })

  /**
   * `D-43` temia exatamente isto ao pedir que nada recusasse: *"uma diferença
   * de caixa no cabeçalho derrubaria o painel lá"*. O casamento é por `normKey`,
   * a mesma normalização que o projeto usa para agrupar.
   */
  it('tolera caixa, espaço sobrando e acento — o medo declarado em D-43', () => {
    const check = checkSheetSchema({ ...BOM, A: 'ref', L: '  status  ', J: 'mercadória' })

    expect(check.ok).toBe(true)
    expect(check.divergences).toEqual([])
  })
})

describe('uma edição na planilha produz UM aviso', () => {
  /**
   * O caso que `H-96` existe para matar: inserir uma coluna faz **616 dos 650**
   * processos lerem o dado do vizinho, com quarentena zero e nenhuma anomalia.
   *
   * São 14 colunas empurradas, e **uma** linha de aviso: o operador fez um
   * gesto só. Sem o agrupamento o contador da lateral diria 14.
   */
  it('coluna inserida vira um bloco só, com o tamanho dele', () => {
    const check = checkSheetSchema(comColunaInserida(true))

    expect(check.ok).toBe(false)
    expect(check.divergences).toHaveLength(1)

    const bloco = check.divergences[0] as SchemaDivergence
    expect(bloco.kind).toBe('DESLOCADO')
    expect(bloco.span).toBe(14)
    expect(bloco.expectedColumn).toBe('C')
    expect(bloco.expected).toBe('IMPORTADOR')
    expect(bloco.column).toBe('D')
    expect(describeDivergence(bloco)).toBe(
      '14 colunas andaram 1 coluna à direita, a partir de C — a primeira é "IMPORTADOR".',
    )
  })

  /**
   * A borda que custou uma correção: `indexOfLetter` procurava a letra na lista
   * declarada e devolvia `-1` para qualquer uma além de `P`. O `-1` entrava na
   * aritmética como se fosse posição, e `Coluna1` empurrada para `Q` saía FORA
   * do bloco — mais um `EXTRA` dizendo que `Q` não é da planilha, o que é falso:
   * ela é, só mudou de casa. Três linhas para um gesto.
   */
  it('a coluna empurrada para além de P entra no bloco, e não vira EXTRA', () => {
    const check = checkSheetSchema(comColunaInserida(true))

    // O `toEqual` abaixo prova as DUAS metades: um `EXTRA` a mais e um bloco
    // partido em dois acrescentariam, cada um, um segundo elemento. O
    // `not.toContain('EXTRA')` que vinha depois dele não podia falhar sozinho.
    // Achado do revisor-xml.
    expect(soKind(check.divergences)).toEqual(['DESLOCADO'])
  })

  /**
   * Quando a inserção empurra `Coluna1` para fora das 16, ela some de verdade —
   * e aí são DOIS fatos: o bloco andou, e uma coluna desapareceu. O segundo não
   * é sintoma do primeiro, e por isso conta à parte.
   */
  it('coluna que some no empurrão conta à parte, porque é outro fato', () => {
    const check = checkSheetSchema(comColunaInserida(false))

    expect(soKind(check.divergences)).toEqual(['DESLOCADO', 'AUSENTE'])
    expect((check.divergences[0] as SchemaDivergence).span).toBe(13)
    expect((check.divergences[1] as SchemaDivergence).expected).toBe('Coluna1')
  })
})

describe('as demais divergências', () => {
  it('cabeçalho renomeado nomeia as duas pontas (RF-44)', () => {
    const check = checkSheetSchema({ ...BOM, D: 'BL ORIGINAL' })

    expect(check.ok).toBe(false)
    expect(check.divergences).toHaveLength(1)
    expect(describeDivergence(check.divergences[0] as SchemaDivergence)).toBe(
      'Coluna D: esperado "BL", encontrado "BL ORIGINAL".',
    )
  })

  /**
   * Nome repetido produzia DUAS linhas para a mesma coluna — o duplicado e o
   * "sumiu", que é consequência dele. Uma divergência por letra, no máximo.
   */
  it('cabeçalho repetido é uma linha só, e diz de quem é o nome', () => {
    const check = checkSheetSchema({ ...BOM, N: 'STATUS' })

    expect(check.divergences).toHaveLength(1)
    const uma = check.divergences[0] as SchemaDivergence
    expect(uma.kind).toBe('DUPLICADO')
    expect(uma.duplicateOf).toBe('L')
    expect(describeDivergence(uma)).toBe(
      'Coluna N: esperado "R$ ENVIADO", encontrado "STATUS" — que já é o cabeçalho da coluna L.',
    )
  })

  /**
   * Regra inviolável 2: a coluna a mais **não** é descartada em silêncio. Ela
   * não entra na tabela — `D-43` descartou a coluna descoberta —, mas aparece.
   */
  it('coluna a mais aparece, em vez de ser descartada calada', () => {
    const check = checkSheetSchema({ ...BOM, Q: 'OBSERVAÇÃO' })

    expect(soKind(check.divergences)).toEqual(['EXTRA'])
    expect(describeDivergence(check.divergences[0] as SchemaDivergence)).toBe(
      'Coluna Q: "OBSERVAÇÃO" não faz parte da planilha que o painel conhece.',
    )
  })

  /** Sem rótulo nenhum não há o que conferir, e seguir seria adivinhar (regra 3). */
  it('linha de cabeçalho vazia é divergência, e não silêncio', () => {
    const check = checkSheetSchema({})

    expect(check.ok).toBe(false)
    expect(soKind(check.divergences)).toEqual(['CABECALHO_VAZIO'])
  })
})

/**
 * **Nenhuma divergência impede a leitura** — decisão do usuário em 17/09/2026.
 * O painel nunca para; o que ele ganha é saber o que mudou.
 *
 * `blocksWriting` é outra pergunta, e existe para a ESCRITA: gravar na coluna
 * errada alcança o arquivo da empresa, e lá não há desfazer.
 */
describe('o que recusa a escrita', () => {
  /**
   * Só o deslocamento move dado. É o caso medido em `D-43`: **616 dos 650**
   * processos passam a ler o do vizinho, e **580 categorias** ficam erradas.
   */
  it('deslocamento detectado recusa a escrita', () => {
    expect(checkSheetSchema(comColunaInserida(true)).blocksWriting).toBe(true)
  })

  /**
   * **Cabeçalho renomeado NÃO move nada**, e é a correção de uma análise minha
   * que estava errada: `BL` vira `BL ORIGINAL` e continua na coluna `D`, então
   * ler por letra segue correto. Coluna apagada faria tudo à direita andar — e
   * isso vira `DESLOCADO`, não `AUSENTE`.
   */
  it('renome, repetição e coluna extra NÃO recusam a escrita', () => {
    expect(checkSheetSchema({ ...BOM, D: 'BL ORIGINAL' }).blocksWriting).toBe(false)
    expect(checkSheetSchema({ ...BOM, N: 'STATUS' }).blocksWriting).toBe(false)
    expect(checkSheetSchema({ ...BOM, Q: 'OBSERVAÇÃO' }).blocksWriting).toBe(false)
  })

  /**
   * **Os dois `AUSENTE` têm sentidos opostos, e é o `found` que os separa.**
   *
   * Rótulo trocado por outro nome: a coluna ficou onde estava, e gravar por
   * letra continua acertando. Rótulo **apagado**: não há nome com que conferir
   * aquela coluna, e um deslocamento que alcance só colunas sem rótulo fica
   * invisível — a mesma razão de `CABECALHO_VAZIO`.
   *
   * **O par é obrigatório**: um predicado que recusasse todo `AUSENTE` passaria
   * na primeira asserção e travaria a gravação em cabeçalho só renomeado, que
   * a determinação 3 da história garante permitido.
   */
  it('rótulo APAGADO recusa; rótulo renomeado não', () => {
    const apagado = checkSheetSchema(Object.fromEntries(Object.entries(BOM).slice(0, 2)))
    const renomeado = checkSheetSchema({ ...BOM, D: 'BL ORIGINAL' })

    expect(apagado.blocksWriting).toBe(true)
    expect(soKind(apagado.divergences)).toEqual(Array(14).fill('AUSENTE'))

    expect(renomeado.blocksWriting).toBe(false)
    expect(soKind(renomeado.divergences)).toEqual(['AUSENTE'])
  })

  /**
   * **Recusa, e NÃO por mover dado** — a linha em branco não move nada. Recusa
   * porque sem rótulo nenhum um deslocamento real fica invisível à conferência,
   * e gravar trataria "não conferível" como "conferido e certo" (regra 3).
   *
   * *(Era o único caso que a primeira versão deixava passar, e o culpado foi o
   * nome: o predicado descrevia o sintoma — mover dado —, e a linha em branco
   * de fato não move dado. Achado do `revisor-xml`; o nome mudou junto com o
   * comportamento, para dizer o que ele decide.)*
   */
  it('cabeçalho vazio recusa a escrita, por não haver o que conferir', () => {
    const check = checkSheetSchema({})

    expect(check.blocksWriting).toBe(true)
    expect(soKind(check.divergences)).toEqual(['CABECALHO_VAZIO'])
  })

  it('cabeçalho que bate não recusa nada, e não diverge', () => {
    const check = checkSheetSchema(BOM)

    expect(check.ok).toBe(true)
    expect(check.blocksWriting).toBe(false)
  })
})

/**
 * `D-65`. O par (codigo, frase) que o `write-guard` e as tres rotas de
 * enfileiramento consomem.
 *
 * O que estes testes protegem e a EQUIVALENCIA entre os consumidores: antes de
 * `D-65` o mapeamento vivia inline no `write-guard`, e levar a recusa as rotas
 * o copiaria. Uma copia que divergisse daria ao operador codigos diferentes
 * para o mesmo estado da planilha, dependendo de onde ele clicasse.
 */
describe('writeBlock — D-65', () => {
  it('devolve null quando o cabecalho bate', () => {
    expect(writeBlock(checkSheetSchema(BOM).divergences)).toBeNull()
  })

  it('coluna inserida vira CABECALHO_DESLOCADO, com a frase que nomeia a coluna', () => {
    const block = writeBlock(checkSheetSchema(comColunaInserida(true)).divergences)

    expect(block?.code).toBe('CABECALHO_DESLOCADO')
    expect(block?.detail).toBe(
      '14 colunas andaram 1 coluna à direita, a partir de C — a primeira é "IMPORTADOR".',
    )
  })

  it('linha 1 em branco vira CABECALHO_VAZIO', () => {
    expect(writeBlock(checkSheetSchema({}).divergences)?.code).toBe('CABECALHO_VAZIO')
  })

  // Renome NAO bloqueia: a coluna fica onde estava, e gravar nela continua
  // acertando. E o contraste que separa `AUSENTE` com `found` de `AUSENTE` sem.
  it('cabecalho renomeado nao bloqueia', () => {
    expect(writeBlock(checkSheetSchema({ ...BOM, E: 'REPRESENTANTE' }).divergences)).toBeNull()
  })

  /**
   * O rotulo APAGADO de uma coluna so e `CABECALHO_VAZIO`, e nao
   * `CABECALHO_DESLOCADO`: nada foi detectado fora do lugar, e mandar desfazer
   * nomearia uma coluna que nao se moveu.
   */
  it('rotulo apagado de uma coluna vira CABECALHO_VAZIO, e nao deslocamento', () => {
    const headers: Record<string, string> = { ...BOM }
    delete headers.E

    expect(writeBlock(checkSheetSchema(headers).divergences)?.code).toBe('CABECALHO_VAZIO')
  })
})
