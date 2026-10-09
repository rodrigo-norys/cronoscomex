import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * O portão sobre a documentação derivada.
 *
 * `tests/repo/contratos.test.ts` guarda o eixo documento↔código — rota servida,
 * chave de resposta, âncora de comentário. Este arquivo guarda o outro eixo:
 * **documento contra documento**, que é onde metade do trabalho do repositório
 * acontece — 220 dos 445 commits não-merge da `main` tocam apenas `docs/`,
 * `CLAUDE.md` ou `README.md` (medido em 11/09/2026) — e onde, até aqui, nenhuma
 * asserção olhava.
 *
 * **Nenhuma expectativa é lista fixa.** Toda contagem sai do disco: épico novo,
 * história nova e requisito novo entram sem tocar neste arquivo. O que ele
 * cobra é concordância entre cópias do mesmo fato, e a fonte é sempre o bloco
 * da história ou a linha de definição — nunca a prosa que a resume.
 *
 * O total de histórias afirmado em prosa saiu daqui em 06/10/2026: desde as
 * regiões de 01/10/2026 o regex não casava linha nenhuma, e quem o cobre é
 * `tests/repo/contagens.test.ts`.
 *
 * A matriz contra o backlog, e o requisito revogado contra a matriz, também saíram:
 * são espelhos de estado declarados em `tools/contar-documentacao.config.mjs`, que o
 * `--check` confere e `tests/repo/contagens.test.ts` cobra. A tabela partida por linha
 * em branco, que nenhum dos dois eixos alcança, saiu pelo mesmo caminho.
 */

const BACKLOG = readFileSync('docs/06-backlog.md', 'utf-8')

interface Historia {
  id: string
  tamanho: string
  /** Quantos arquivos o bloco declara; `-1` quando o texto não traz o número. */
  arquivos: number
  concluida: boolean
}

/** Uma entrada por `### H-NN`, com o tamanho declarado e se há bloco de conclusão. */
function historias(): Historia[] {
  return BACKLOG.split(/\n(?=### H-\d+)/).flatMap((bloco) => {
    const id = /^### (H-\d+)/.exec(bloco)?.[1]
    if (id === undefined) return []

    return [
      {
        id,
        tamanho: /\*\*Tamanho:\*\*\s*(\w)/.exec(bloco)?.[1] ?? '?',
        arquivos: Number(/\*\*Tamanho:\*\*[^(]*\((\d+)\s*arquivos?/.exec(bloco)?.[1] ?? -1),
        concluida: /✅ \*\*CONCLUÍDA/.test(bloco),
      },
    ]
  })
}

const HISTORIAS = historias()
const TOTAL = HISTORIAS.length
const CONCLUIDAS = HISTORIAS.filter((historia) => historia.concluida).length

/**
 * A qual épico cada história pertence, num texto em que o épico é um cabeçalho
 * e a história é uma linha abaixo dele. Serve às duas formas: o corpo, onde o
 * cabeçalho é `## Épico ENN`, e o índice, onde é `**[Épico ENN …](#eNN)**`.
 *
 * O `null` inicial não é decoração: história escrita ACIMA do primeiro
 * cabeçalho recebe grupo `null` dos dois lados, e `null === null` passaria
 * verde. É por isso que a asserção reprova grupo `null` antes de comparar.
 */
function grupoPorHistoria(
  texto: string,
  cabecalho: RegExp,
  entrada: RegExp,
): Map<string, string | null> {
  const grupos = new Map<string, string | null>()
  let atual: string | null = null

  for (const linha of texto.split('\n')) {
    const epico = cabecalho.exec(linha)
    if (epico !== null) {
      atual = epico[1] ?? null
      continue
    }

    const historia = entrada.exec(linha)
    if (historia !== null && historia[1] !== undefined) grupos.set(historia[1], atual)
  }

  return grupos
}

const INDICE = grupoPorHistoria(
  BACKLOG.slice(BACKLOG.indexOf('## Índice'), BACKLOG.indexOf('<a id="h-01">')),
  /^\*\*\[Épico (E\d+)/,
  /^- \[(H-\d+) — /,
)
const CORPO = grupoPorHistoria(BACKLOG, /^## Épico (E\d+)/, /^### (H-\d+)/)

/**
 * O índice do backlog já é conferido em QUEM ele lista — âncora, entrada, ✅ e
 * destino, em `tests/repo/contratos.test.ts`. Não era conferido em ONDE: as
 * quatro histórias de `E15` entraram sob o cabeçalho de `E14` em 11/09/2026,
 * com as cinco asserções de índice verdes, e quem achou foi o olho do usuário.
 * Na mesma execução esta guarda reprovou **dois números vivos** que a revisão
 * adversarial não pegara, e um deles estava na skill que conduz a história.
 */
describe('o índice do backlog agrupa cada história sob o épico do corpo', () => {
  it('encontra os dois agrupamentos — âncora contra guarda verde por vacuidade', () => {
    expect(CORPO.size).toBeGreaterThan(30)
    expect(INDICE.size).toBe(CORPO.size)
  })

  it('nenhuma história fica fora de um épico, nos dois lugares', () => {
    const orfas = [...INDICE, ...CORPO].filter(([, epico]) => epico === null).map(([id]) => id)

    expect(orfas).toEqual([])
  })

  it('o épico do índice é o épico do corpo', () => {
    const divergentes = [...CORPO]
      .filter(([id, epico]) => INDICE.get(id) !== epico)
      .map(([id, epico]) => `${id}: corpo ${epico}, índice ${INDICE.get(id) ?? 'nenhum'}`)

    expect(divergentes).toEqual([])
  })
})

/**
 * A linha de Total da tabela de resumo já é conferida. As 15 linhas por épico —
 * 45 números — e o `abertas: N` da própria linha de Total não eram: a regex de
 * `totalDeclarado()` casa `**N**` e `concluídas: N`, e nada mais.
 */
describe('a tabela de resumo do backlog bate linha a linha', () => {
  const linhas = [...BACKLOG.matchAll(/^\| (E\d+) [^|]*\|[^|]*\| (\d+) \| (\d+) \| (\d+) \|$/gm)]
  const porEpico = new Map<string | null, string[]>()
  for (const [id, epico] of CORPO) porEpico.set(epico, [...(porEpico.get(epico) ?? []), id])
  const tamanhoDe = new Map(HISTORIAS.map((historia) => [historia.id, historia.tamanho]))

  it('encontra uma linha por épico — âncora contra guarda verde por vacuidade', () => {
    expect(linhas.length).toBeGreaterThan(10)
    expect(linhas.length).toBe(porEpico.size)
  })

  it('P, M e G de cada épico batem com os blocos daquele épico', () => {
    const divergentes = linhas.flatMap((linha) => {
      const [, epico, p, m, g] = linha
      const doEpico = porEpico.get(epico ?? '') ?? []
      const conta = (tamanho: string): number =>
        doEpico.filter((id) => tamanhoDe.get(id) === tamanho).length

      return conta('P') === Number(p) && conta('M') === Number(m) && conta('G') === Number(g)
        ? []
        : [
            `${epico}: tabela P${p} M${m} G${g}, blocos P${conta('P')} M${conta('M')} G${conta('G')}`,
          ]
    })

    expect(divergentes).toEqual([])
  })

  it('as abertas declaradas no Total são as que não têm bloco de conclusão', () => {
    const total = (BACKLOG.split('\n').find((linha) => linha.startsWith('| **Total**')) ?? '')
      // A contagem vive em região `conta`; o número é lido sem os marcadores.
      .replace(/<!-- \/?conta[^>]*-->/g, '')
    const declaradas = /abertas: (\d+)/.exec(total)?.[1]

    expect(declaradas).toBeDefined()
    expect(Number(declaradas)).toBe(TOTAL - CONCLUIDAS)
  })
})

/**
 * A régua do topo do backlog — `P` até 3 arquivos, `M` até 8, `G` acima — é um
 * ALERTA, e `D-24` declara a função dela: "avisar que a fatia é longa". Foi
 * assim que `H-50` foi cortada em duas **antes** de ser executada.
 *
 * **Só as abertas são cobradas, e a assimetria é o ponto.** Em história fechada
 * o rótulo já não alerta coisa nenhuma — a fatia foi executada —, e ele passa a
 * ser registro do que foi entregue. Sete fechadas trazem rótulo abaixo da
 * régua, declaradas uma vez no topo do backlog em vez de reescritas, pela mesma
 * convenção que manteve "nove colunas" no título de `H-77`.
 *
 * O critério é o número de arquivos, e só ele: o "ou 1 contrato novo" da régua
 * apenas ALARGA `M`, nunca o estreita, então ignorá-lo não produz falso
 * positivo. Medido em 16/09/2026: as quatro de `E15` estavam rotuladas abaixo
 * da régua — `H-94` dizia `M` com **18** arquivos.
 */
describe('o tamanho declarado respeita a régua, nas histórias abertas', () => {
  const ORDEM = ['P', 'M', 'G']
  const abertas = HISTORIAS.filter((historia) => !historia.concluida && historia.arquivos >= 0)

  /** O menor rótulo que a régua admite para um bloco com tantos arquivos. */
  function minimo(arquivos: number): string {
    if (arquivos > 8) return 'G'
    return arquivos > 3 ? 'M' : 'P'
  }

  it('encontra as abertas — âncora contra guarda verde por vacuidade', () => {
    expect(abertas.length).toBeGreaterThan(0)
  })

  it('nenhuma história aberta declara tamanho abaixo do que a régua exige', () => {
    const violacoes = abertas
      .filter(
        (historia) => ORDEM.indexOf(historia.tamanho) < ORDEM.indexOf(minimo(historia.arquivos)),
      )
      .map(
        (historia) =>
          `${historia.id}: declarado ${historia.tamanho} com ${historia.arquivos} arquivos, a régua exige ${minimo(historia.arquivos)}`,
      )

    expect(violacoes).toEqual([])
  })
})
