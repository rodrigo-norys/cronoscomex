import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
 */

const BACKLOG = readFileSync('docs/06-backlog.md', 'utf-8')
const MATRIZ = readFileSync('docs/09-rastreabilidade.md', 'utf-8')
const REQUISITOS = readFileSync('docs/02-requisitos.md', 'utf-8')

interface Historia {
  id: string
  tamanho: string
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
 * 45 números — e o `N abertas` da própria linha de Total não eram: a regex de
 * `totalDeclarado()` casa `**N**` e `N concluídas`, e nada mais.
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
    const total = BACKLOG.split('\n').find((linha) => linha.startsWith('| **Total**')) ?? ''
    const declaradas = /(\d+) abertas?/.exec(total)?.[1]

    expect(declaradas).toBeDefined()
    expect(Number(declaradas)).toBe(TOTAL - CONCLUIDAS)
  })
})

/**
 * A §4 da matriz é o único lugar do repositório que enumera história por
 * história fora do backlog, e o cabeçalho dela registra o modo de falha com
 * todas as letras: o número "já envelheceu QUATRO vezes — 33, depois 43, depois
 * 61, depois 81 —, e a ressalva que anunciava o modo de falha não o impediu,
 * nem na vez em que ela mesma trazia o número" (`docs/09-rastreabilidade.md:180`).
 * O documento publica as duas receitas `grep -cE` em prosa; isto as executa.
 */
describe('a matriz de rastreabilidade concorda com o backlog', () => {
  const naMatriz = [...MATRIZ.matchAll(/^\| (H-\d+) \|(.*)$/gm)].map((linha) => ({
    id: linha[1] ?? '',
    concluida: (linha[2] ?? '').includes('✅'),
  }))

  it('encontra as linhas — âncora contra guarda verde por vacuidade', () => {
    expect(naMatriz.length).toBeGreaterThan(30)
  })

  it('toda história tem linha na §4, e toda linha tem história', () => {
    expect(naMatriz.map((linha) => linha.id).sort()).toEqual(
      HISTORIAS.map((historia) => historia.id).sort(),
    )
  })

  it('o estado da §4 é o do bloco da história', () => {
    const divergentes = naMatriz
      .filter((linha) => linha.concluida !== HISTORIAS.find((h) => h.id === linha.id)?.concluida)
      .map((linha) => linha.id)

    expect(divergentes).toEqual([])
  })
})

/** A primeira célula de uma linha de tabela — onde o identificador é definido. */
function primeiraCelula(linha: string): string {
  return linha.split('|')[1] ?? ''
}

/**
 * Revogar um requisito é a mudança de estado que mais viaja: ela nasce em
 * `02-requisitos.md` e precisa alcançar a §5 da matriz. Em 11/09/2026 `RF-35`
 * foi revogado por `D-43` e a matriz seguiu dizendo "✅ **Entregue**" — a
 * propagação que não aconteceu, e que nenhuma asserção via.
 */
describe('requisito revogado não continua entregue na matriz', () => {
  const revogados = [...REQUISITOS.matchAll(/^\| (RF-\d+) \|(.*)$/gm)]
    .filter((linha) => /REVOGAD/i.test(linha[2] ?? ''))
    .map((linha) => linha[1] ?? '')

  it('encontra os requisitos — âncora contra guarda verde por vacuidade', () => {
    expect([...REQUISITOS.matchAll(/^\| (RF-\d+) \|/gm)].length).toBeGreaterThan(30)
  })

  it('toda linha da matriz que define um revogado diz que ele foi revogado', () => {
    const desalinhadas = revogados.flatMap((requisito) =>
      MATRIZ.split('\n')
        .filter(
          (linha) =>
            linha.startsWith('|') && new RegExp(`\\b${requisito}\\b`).test(primeiraCelula(linha)),
        )
        .filter((linha) => !/REVOGAD/i.test(linha))
        .map((linha) => `${requisito}: ${linha.slice(0, 80)}`),
    )

    expect(desalinhadas).toEqual([])
  })
})

/** Todo `.md` de um diretório, recursivamente. */
function arquivosMarkdown(diretorio: string): string[] {
  const encontrados: string[] = []
  if (!existsSync(diretorio)) return encontrados

  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = `${diretorio}/${entrada.name}`
    if (entrada.isDirectory()) encontrados.push(...arquivosMarkdown(caminho))
    else if (entrada.name.endsWith('.md')) encontrados.push(caminho)
  }

  return encontrados
}

/**
 * `docs/sessao-autonoma/` fica fora do palheiro, e a isenção é estrutural, não
 * conveniência: são relatórios datados de sessão, congelados no dia em que
 * foram escritos — dizem o que era verdade naquela data, como uma mensagem de
 * commit. `RELATORIO-01-09-2026-2.md` afirma "66 das 72 histórias", e estava
 * certo em 01/09/2026. Reprovar ali ensinaria a reescrever registro histórico,
 * que é o oposto do que o repositório quer.
 */
const PALHEIRO = [
  ...arquivosMarkdown('docs'),
  ...arquivosMarkdown('.claude'),
  'CLAUDE.md',
  'README.md',
].filter((caminho) => !caminho.startsWith('docs/sessao-autonoma/'))

/**
 * O total de histórias é o fato derivado mais copiado do projeto — ele vive em
 * sete lugares. A única cópia que tem asserção — a linha de Total do backlog,
 * conferida em `contratos.test.ts` — é a única que nunca esteve errada. Das
 * demais, **duas estavam erradas quando esta asserção foi escrita**, em
 * 11/09/2026: `README.md` dizia "89 das 91 histórias" e
 * `.claude/skills/fatia/SKILL.md` dizia "11 das 90 histórias", contra 91 de 96.
 * A segunda é a que pesa: a skill que conduz a história, e que manda copiar do
 * plano "copiados, não inventados", mentia sobre o tamanho do plano.
 *
 * **`.claude/` está no palheiro de propósito:** a peça que conduz a história é
 * a que menos pode mentir sobre o backlog, porque a `/fatia` manda copiar do
 * plano, "copiados, não inventados".
 *
 * A forma casada é estreita — `N das M histórias` —, e é isso que a torna
 * segura: ela só casa afirmação sobre o conjunto vigente, nunca número
 * histórico em prosa corrente ("o plano original tinha 34 histórias",
 * `README.md:248`, que é verdade e continua sendo).
 */
describe('o total de histórias afirmado em prosa é o total real', () => {
  it('encontra o palheiro — âncora contra guarda verde por vacuidade', () => {
    expect(PALHEIRO.length).toBeGreaterThan(20)
    expect(TOTAL).toBeGreaterThan(30)
  })

  it('nenhum documento afirma um backlog que não é este', () => {
    const erradas: string[] = []

    for (const caminho of PALHEIRO) {
      readFileSync(caminho, 'utf-8')
        .split('\n')
        .forEach((linha, indice) => {
          for (const achado of linha.matchAll(/(\d+) das \*{0,2}(\d+)\*{0,2} histórias/g)) {
            const posicao = `${caminho}:${indice + 1}`
            if (Number(achado[2]) !== TOTAL) {
              erradas.push(`${posicao} diz que o backlog tem ${achado[2]}; tem ${TOTAL}`)
            } else if (/conclu/i.test(linha) && Number(achado[1]) !== CONCLUIDAS) {
              erradas.push(`${posicao} diz ${achado[1]} concluídas; são ${CONCLUIDAS}`)
            }
          }
        })
    }

    expect(erradas).toEqual([])
  })
})
