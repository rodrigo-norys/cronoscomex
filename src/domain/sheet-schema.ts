import { normKey } from './normalizer.ts'

/**
 * O esquema da aba, conferido contra a linha de cabecalho (`H-96`, `D-43`).
 *
 * **O vinculo coluna->campo continua sendo por LETRA**, e este modulo nao o
 * troca: ele o CONFERE. Resolver o vinculo por nome — o desenho que `D-43`
 * previa — exigiria duas coordenadas convivendo, uma na leitura e outra na
 * escrita, e o modo de falha disso e pior que o defeito original: silencioso, e
 * no arquivo do operador.
 *
 * **O que este modulo entrega e o aviso, mais a recusa de ESCRITA.** Batendo o
 * cabecalho, nada muda — leitura, classificacao e escrita seguem byte a byte
 * como antes. Divergindo, a LEITURA segue igual e a tela diz QUAL coluna, o que
 * esperava e o que achou; so a gravacao recusa, e so no que pode escrever na
 * coluna errada — ver `blocksWriting`.
 *
 * *(A frase anterior dizia que, divergindo, a leitura "nao promove as linhas a
 * processo". Era verdade na primeira versao e deixou de ser no mesmo dia,
 * quando o ramo degradado saiu por decisao do usuario: o painel nunca para.)*
 *
 * O modo de falha que ele mata esta medido em `D-43`: deslocar uma coluna faz
 * **616 dos 650** processos lerem o dado do vizinho e **580 categorias**
 * ficarem erradas, com quarentena zero. *(A frase dizia tambem "nenhuma
 * anomalia"; o ensaio de 17/09/2026 mediu ao menos uma no primeiro processo, e
 * o total nao foi medido — `D-60`.)*
 *
 * **Os ramos de rotulo vazio e repetido nao sao alcancados pelo gesto do
 * operador.** Enquanto a `Tabela1` cobrir a coluna, o Excel renomeia sozinho o
 * cabecalho apagado para `Column1` e o repetido para `IMPORTADOR2` — medido no
 * ensaio de 17/09/2026 (`D-60`). So arquivo escrito fora do Excel chega a eles,
 * e ali eles reagem como declarado.
 */

/**
 * O cabecalho que cada letra deve ter, medido em `H-01` e mantido em
 * `docs/03-modelo-dados.md` secao 1.2, coluna "Cabecalho".
 *
 * **Os nomes sao os do ARQUIVO, nao os do dominio.** `H` se chama `ETA` e
 * guarda PORTO; `M` e `P` se chamam `Coluna 13` e `Coluna1`, que o Excel gerou
 * sozinho. Corrigi-los aqui faria a conferencia reprovar o arquivo real
 * (regra inviolavel 1).
 *
 * Confirmado em 17/09/2026 nas NOVE fixtures: as 16 letras, identicas em todas,
 * e identicas as medidas na planilha real por `H-95`.
 */
export const DECLARED_HEADERS: Readonly<Record<string, string>> = {
  A: 'REF',
  B: 'CLT',
  C: 'IMPORTADOR',
  D: 'BL',
  E: 'AGENTE',
  F: 'CNTR',
  G: 'NAVIO',
  H: 'ETA',
  I: 'ETA2',
  J: 'MERCADORIA',
  K: 'RG',
  L: 'STATUS',
  M: 'Coluna 13',
  N: 'R$ ENVIADO',
  O: 'DOCS ENVIADOS',
  P: 'Coluna1',
}

export type SchemaDivergenceKind =
  /** O cabecalho declarado nao esta em lugar nenhum da linha 1. */
  | 'AUSENTE'
  /** Ele existe, e em OUTRA letra — o caso que desloca os dados. */
  | 'DESLOCADO'
  /** A letra traz o cabecalho de outra coluna: o nome aparece duas vezes. */
  | 'DUPLICADO'
  /** Uma letra fora das declaradas traz cabecalho proprio. */
  | 'EXTRA'
  /** A linha de cabecalho nao tem rotulo nenhum: nao ha como conferir. */
  | 'CABECALHO_VAZIO'

export interface SchemaDivergence {
  kind: SchemaDivergenceKind
  /** Onde o cabecalho ESTA. `null` so em `CABECALHO_VAZIO`. */
  column: string | null
  /** Onde o esquema o esperava. `null` quando nada era esperado ali. */
  expectedColumn: string | null
  /** O cabecalho que o esquema declara. */
  expected: string | null
  /** O cabecalho que o arquivo traz. `null` quando a celula esta vazia. */
  found: string | null
  /**
   * Quantas colunas o MESMO deslocamento alcanca; `1` fora de bloco.
   *
   * **Existe porque uma edicao nao pode virar quatorze avisos.** Medido em
   * 17/09/2026: inserir UMA coluna antes de `IMPORTADOR` desloca 14 — e o
   * operador fez um gesto so. O painel mostra o bloco numa linha, e o contador
   * da lateral conta MUDANCAS, nao sintomas.
   */
  span: number
  /** Em `DUPLICADO`, de quem e o cabecalho repetido. */
  duplicateOf: string | null
}

export interface SchemaCheck {
  /** `true` quando o arquivo casa o esquema: nenhuma divergencia. */
  ok: boolean
  /**
   * `true` quando a ESCRITA e recusada — ver `blocksWritingOne` para a regra.
   *
   * **Nenhuma divergencia impede a leitura** (decisao do usuario, 17/09/2026):
   * o painel sempre mostra o dado e o aviso, e nunca para. Este campo existe
   * porque a ESCRITA e outra pergunta: gravar na coluna errada alcanca o
   * arquivo da empresa, e la nao ha desfazer.
   *
   * **Recusar nao e o mesmo que ter detectado movimento.** `DESLOCADO` e
   * movimento detectado; `CABECALHO_VAZIO` e o rotulo APAGADO sao a
   * impossibilidade de detectar — sem nome com que conferir, um deslocamento
   * real fica invisivel, e gravar trataria "nao conferivel" como "conferido e
   * certo" (regra inviolavel 3).
   *
   * *(Ate 17/09/2026 o campo tinha um nome que descrevia o SINTOMA — mover
   * dado — em vez da decisao, e foi o nome que produziu o buraco: a linha em
   * branco nao move dado, entao ficava de fora e a escrita seguia. O nome
   * passou a dizer o que o predicado decide.)*
   *
   * **`EXTRA` e `DUPLICADO` nao recusam**, nem `AUSENTE` com o rotulo apenas
   * trocado de nome: nos tres a coluna declarada continua onde estava, e
   * gravar por letra segue acertando.
   */
  blocksWriting: boolean
  divergences: SchemaDivergence[]
}

/**
 * Esta divergencia recusa a escrita?
 *
 * **Predicado, e nao um conjunto de `kind`** — porque `AUSENTE` cobre dois
 * casos de sentidos OPOSTOS, e so um deles recusa:
 *
 * - rotulo trocado por outro nome (`found` preenchido) — a coluna ficou onde
 *   estava, ler e gravar por letra seguem acertando. **Nao recusa.**
 * - rotulo APAGADO (`found` nulo) — nao ha nome com que conferir aquela coluna,
 *   e um deslocamento que alcance so colunas sem rotulo fica invisivel.
 *   **Recusa**, pela mesma razao de `CABECALHO_VAZIO`: "nao conferivel" nao e
 *   "conferido e certo" (regra inviolavel 3).
 *
 * `DUPLICADO` fica de fora: o `found` dele e o nome de outra coluna, presente.
 */
function blocksWritingOne(one: SchemaDivergence): boolean {
  if (one.kind === 'DESLOCADO' || one.kind === 'CABECALHO_VAZIO') return true
  return one.kind === 'AUSENTE' && one.found === null
}

/**
 * A primeira divergencia que recusa a escrita, ou `null` quando nenhuma recusa.
 *
 * **Devolve a divergencia, e nao um booleano**, porque quem recusa precisa da
 * CAUSA para escolher a mensagem: mandar "desfaca a mudanca no Excel" diante de
 * uma linha 1 em branco nomeia uma coluna que nao mudou de lugar, e o operador
 * procuraria o que nao existe.
 *
 * **Existe para a ESCRITA**, que decide separado da leitura: ler com as colunas
 * deslocadas mostra dado errado numa tela que avisa, e gravar alcanca o arquivo
 * da empresa, onde nao ha desfazer. `write-guard` recebe a lista de
 * `StoreState` e nao refaz a conferencia — uma regra, um lugar.
 *
 * **Renome nao entra.** `AUSENTE` sozinho e cabecalho renomeado, e a coluna fica
 * onde estava: gravar nela continua acertando. Coluna apagada faria tudo a
 * direita andar, e ai e `DESLOCADO`.
 */
export function blockingDivergence(
  divergences: readonly SchemaDivergence[],
): SchemaDivergence | null {
  return divergences.find(blocksWritingOne) ?? null
}

/** Alguma destas divergencias recusa a escrita? */
export function blocksWriting(divergences: readonly SchemaDivergence[]): boolean {
  return blockingDivergence(divergences) !== null
}

const LETTERS = Object.keys(DECLARED_HEADERS)

/**
 * A posicao da letra na planilha, 0-based — `A` e 0, `Q` e 16, `AA` e 26.
 *
 * **Calculada, e nao procurada em `LETTERS`.** A busca devolvia `-1` para
 * qualquer letra alem de `P`, e o `-1` entrava na aritmetica de `groupShifted`
 * como se fosse posicao: a coluna empurrada para fora das declaradas nao
 * entrava no bloco e virava um aviso solto do MESMO gesto. Medido em
 * 17/09/2026, ao inserir uma coluna preservando `Coluna1`.
 */
function indexOfLetter(letter: string): number {
  let index = 0
  for (const char of letter.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

/**
 * Confere a linha de cabecalho contra `DECLARED_HEADERS`.
 *
 * **Casamento por `normKey`**, e nao literal: a mesma normalizacao que o
 * projeto usa para agrupar — sem caixa, sem acento, espaco interno colapsado.
 * Sem ela, `STATUS ` com um espaco a mais recusaria a planilha inteira, que e
 * exatamente o que `D-43` temia ao pedir que nada recusasse.
 *
 * **Uma divergencia por LETRA, no maximo.** Sem esse teto, trocar o cabecalho
 * de `N` por um nome que ja existe produzia DUAS linhas para a mesma coluna —
 * o duplicado e o "sumiu", que e consequencia dele. Duas frases para um fato so
 * fazem o contador mentir.
 *
 * **Cabecalho repetido: vence o primeiro da esquerda.** Sem a regra o resultado
 * dependeria da ordem de iteracao do objeto, que e adivinhar (regra 3).
 *
 * `headerLabels` vem de `H-95`, ja sem as celulas vazias: coluna sem nome nao
 * entra no mapa, e por isso `found` pode ser `null`.
 */
export function checkSheetSchema(headerLabels: Record<string, string>): SchemaCheck {
  const found = Object.entries(headerLabels)

  if (found.length === 0) {
    return {
      ok: false,
      // Recusa a escrita, e a razao NAO e ter detectado deslocamento: e nao
      // haver como detectar. Ver `SchemaCheck.blocksWriting`.
      blocksWriting: true,
      divergences: [
        {
          kind: 'CABECALHO_VAZIO',
          column: null,
          expectedColumn: null,
          expected: null,
          found: null,
          span: 1,
          duplicateOf: null,
        },
      ],
    }
  }

  const byLetter = new Map(found.map(([letter, label]) => [letter, normKey(label)]))

  /** Cabecalho normalizado -> a PRIMEIRA letra que o traz, da esquerda. */
  const firstLetterOf = new Map<string, string>()
  for (const letter of [...byLetter.keys()].sort()) {
    const label = byLetter.get(letter) as string
    if (!firstLetterOf.has(label)) firstLetterOf.set(label, letter)
  }

  const perLetter: SchemaDivergence[] = []

  for (const expectedColumn of LETTERS) {
    const expected = DECLARED_HEADERS[expectedColumn] as string
    if (byLetter.get(expectedColumn) === normKey(expected)) continue

    const elsewhere = firstLetterOf.get(normKey(expected))
    if (elsewhere !== undefined) {
      perLetter.push({
        kind: 'DESLOCADO',
        column: elsewhere,
        expectedColumn,
        expected,
        found: expected,
        span: 1,
        duplicateOf: null,
      })
      continue
    }

    const achado = headerLabels[expectedColumn] ?? null
    const dono = achado === null ? undefined : firstLetterOf.get(normKey(achado))
    perLetter.push({
      kind: dono !== undefined && dono !== expectedColumn ? 'DUPLICADO' : 'AUSENTE',
      column: expectedColumn,
      expectedColumn,
      expected,
      found: achado,
      span: 1,
      duplicateOf: dono !== undefined && dono !== expectedColumn ? dono : null,
    })
  }

  /**
   * As letras que um `DESLOCADO` ja explicou: e para la que o cabecalho foi.
   *
   * Sem isto, a coluna empurrada para alem das declaradas saia DUAS vezes — um
   * `DESLOCADO` dizendo "`Coluna1` esta em Q" e um `EXTRA` dizendo "Q nao faz
   * parte da planilha". O segundo e FALSO: ela faz parte, so mudou de casa.
   */
  const explicadas = new Set(
    perLetter.filter((one) => one.kind === 'DESLOCADO').map((one) => one.column),
  )

  for (const [letter, label] of found) {
    if (DECLARED_HEADERS[letter] !== undefined) continue
    if (explicadas.has(letter)) continue
    // Coluna a mais NAO e descartada em silencio (regra inviolavel 2). Ela nao
    // entra na tabela — `D-43` descartou a coluna descoberta —, mas aparece.
    perLetter.push({
      kind: 'EXTRA',
      column: letter,
      expectedColumn: null,
      expected: null,
      found: label,
      span: 1,
      duplicateOf: null,
    })
  }

  const divergences = groupShifted(perLetter)
  return { ok: divergences.length === 0, blocksWriting: blocksWriting(divergences), divergences }
}

/**
 * Colapsa a corrida de `DESLOCADO` que anda o MESMO tanto em letras seguidas.
 *
 * Inserir uma coluna empurra tudo a direita dela de uma vez, e cada coluna
 * empurrada e sintoma do mesmo gesto. O bloco vira uma linha com `span`; o
 * detalhe por coluna continua derivavel de `expectedColumn` e `span`.
 */
function groupShifted(todas: readonly SchemaDivergence[]): SchemaDivergence[] {
  const saida: SchemaDivergence[] = []

  for (const one of todas) {
    const anterior = saida.at(-1)
    const emBloco =
      anterior !== undefined &&
      anterior.kind === 'DESLOCADO' &&
      one.kind === 'DESLOCADO' &&
      anterior.expectedColumn !== null &&
      one.expectedColumn !== null &&
      anterior.column !== null &&
      one.column !== null &&
      // Letras seguidas, e o mesmo salto: um gesto so.
      indexOfLetter(one.expectedColumn) ===
        indexOfLetter(anterior.expectedColumn) + anterior.span &&
      indexOfLetter(one.column) - indexOfLetter(one.expectedColumn) ===
        indexOfLetter(anterior.column) - indexOfLetter(anterior.expectedColumn)

    if (emBloco && anterior !== undefined) anterior.span += 1
    else saida.push({ ...one })
  }

  return saida
}

/** A frase que a tela mostra, nomeando as DUAS pontas (`RF-44`). */
export function describeDivergence(one: SchemaDivergence): string {
  const achado = one.found === null ? 'nada' : `"${one.found}"`

  switch (one.kind) {
    case 'CABECALHO_VAZIO':
      return 'A linha de cabeçalho está vazia: não há nome nenhum para conferir.'
    case 'DESLOCADO': {
      const salto = indexOfLetter(one.column ?? '') - indexOfLetter(one.expectedColumn ?? '')
      const casas = `${Math.abs(salto)} ${Math.abs(salto) === 1 ? 'coluna' : 'colunas'}`
      const lado = salto > 0 ? 'à direita' : 'à esquerda'
      if (one.span === 1) {
        return `"${one.expected}" saiu do lugar: era esperada em ${one.expectedColumn}, e está em ${one.column}.`
      }
      return `${one.span} colunas andaram ${casas} ${lado}, a partir de ${one.expectedColumn} — a primeira é "${one.expected}".`
    }
    case 'DUPLICADO':
      return `Coluna ${one.column}: esperado "${one.expected}", encontrado ${achado} — que já é o cabeçalho da coluna ${one.duplicateOf}.`
    case 'AUSENTE':
      return `Coluna ${one.column}: esperado "${one.expected}", encontrado ${achado}.`
    case 'EXTRA':
      return `Coluna ${one.column}: ${achado} não faz parte da planilha que o painel conhece.`
  }
}
