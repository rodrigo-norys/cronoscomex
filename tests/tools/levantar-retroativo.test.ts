import { describe, expect, it } from 'vitest'
import {
  classifyFile,
  classifyPullRequest,
  commitType,
  countAddedLines,
  extractDecisions,
  parseDecisions,
  parseMergeSubject,
  registeredDecisions,
  sizeByRule,
  summarizeFiles,
} from '../../tools/levantar-retroativo.mjs'

/**
 * As funcoes puras de `tools/levantar-retroativo.mjs`, e SO elas.
 *
 * A parte que chama o `git` le a historia do repositorio real, e a regra
 * inviolavel 7 nao deixa a suite tocar estado real. O que erra em silencio e a
 * CLASSIFICACAO: um PR de produto lido como ferramenta some do levantamento, e a
 * historia que ele devia virar nunca e escrita. Os casos vem dos PRs medidos em
 * `D-69`.
 */

describe('classifyFile — so codigo e teste contam para a regua', () => {
  it('separa codigo, teste, documento e o resto', () => {
    expect(classifyFile('src/domain/indicators.ts')).toBe('code')
    expect(classifyFile('web/src/pages/Home.tsx')).toBe('code')
    expect(classifyFile('tests/domain/indicators-counts.test.ts')).toBe('test')
    expect(classifyFile('web/tests/Home.test.tsx')).toBe('test')
    expect(classifyFile('docs/06-backlog.md')).toBe('doc')
    expect(classifyFile('CLAUDE.md')).toBe('doc')
    expect(classifyFile('tools/medir-numeros.mjs')).toBe('other')
    expect(classifyFile('.claude/hooks/guard-dados-sensiveis.sh')).toBe('other')
  })
})

describe('sizeByRule — a regua do topo do backlog', () => {
  it('P ate 3 arquivos sem contrato, M ate 8 ou com contrato, G acima', () => {
    expect(sizeByRule(2, false)).toBe('P')
    expect(sizeByRule(3, false)).toBe('P')
    expect(sizeByRule(3, true)).toBe('M')
    expect(sizeByRule(4, false)).toBe('M')
    expect(sizeByRule(8, true)).toBe('M')
    expect(sizeByRule(9, false)).toBe('G')
    expect(sizeByRule(15, true)).toBe('G')
  })
})

describe('commitType — o tipo do Conventional Commits', () => {
  it('le o tipo com e sem escopo, e devolve null fora do formato', () => {
    expect(commitType('feat(web): declarar cliente por CLT, REF ou IMPORTADOR')).toBe('feat')
    expect(commitType('fix: recusa data fora da faixa')).toBe('fix')
    expect(commitType('feat!: muda o contrato')).toBe('feat')
    expect(commitType('Merge pull request #149 from dono/branch')).toBe(null)
  })
})

describe('classifyPullRequest — produto, fora de historia ou ja historia', () => {
  it('branch H-NN e historia, mesmo com feat em codigo', () => {
    const commits = [{ subject: 'feat(domain): confere o cabecalho', files: ['src/domain/a.ts'] }]
    expect(classifyPullRequest('H-96/feat-confere-o-cabecalho', commits)).toBe('covered')
  })

  it('comentario em web/src por chore ou docs nao faz produto — os casos de #149 e #138', () => {
    const chore = [
      { subject: 'chore(config): o lint cobre tools/', files: ['web/src/api-client.ts'] },
    ]
    const docs = [{ subject: 'docs(web): extrai o que so vivia la', files: ['web/src/index.css'] }]
    expect(classifyPullRequest('chore/config-biome', chore)).toBe('outside')
    expect(classifyPullRequest('docs/docs-arquiva', docs)).toBe('outside')
  })

  it('fix fora de codigo nao faz produto — o caso de #147', () => {
    const commits = [{ subject: 'fix(claude): o guard', files: ['.claude/hooks/guard.sh'] }]
    expect(classifyPullRequest('fix/claude-guard', commits)).toBe('outside')
  })

  it('um commit de produto basta — o caso de #142', () => {
    const commits = [
      { subject: 'fix(repo): a guarda consulta o git', files: ['tests/repo/contratos.test.ts'] },
      { subject: 'refactor(domain): remove o kind', files: ['src/domain/client-mapper.ts'] },
    ]
    expect(classifyPullRequest('fix/repo-guarda', commits)).toBe('product')
  })
})

describe('extractDecisions e registeredDecisions — citar nao e registrar', () => {
  it('extrai D-NN sem repetir, em ordem numerica, e ignora o que so termina em D-', () => {
    expect(extractDecisions('D-49, D-5, de novo D-49, XD-3 e D-10')).toEqual([
      'D-5',
      'D-10',
      'D-49',
    ])
  })

  it('registra so a linha nova; a emendada aparece removida e acrescentada', () => {
    const diff = [
      '+| D-68 | 2026-09-30 | **nova** | texto |',
      '-| D-63 | 2026-09-22 | **antiga** | texto |',
      '+| D-63 | 2026-09-22 | **antiga** | texto emendado |',
      '+| D-69 | 2026-09-30 | **outra** | texto |',
    ].join('\n')
    expect(registeredDecisions(diff)).toEqual(['D-68', 'D-69'])
  })
})

describe('parseMergeSubject e parseDecisions — o que vem do git e da governanca', () => {
  it('le numero e branch do merge de PR, e recusa merge que nao e de PR', () => {
    expect(
      parseMergeSubject('Merge pull request #149 from dono/chore/config-biome-regras-de-seguranca'),
    ).toEqual({ pr: 149, branch: 'chore/config-biome-regras-de-seguranca' })
    expect(parseMergeSubject('Merge main em H-97: traz a correcao')).toBe(null)
  })

  it('le data, titulo e o custo declarado, quando existe', () => {
    const markdown = [
      '| D-65 | 2026-09-22 | **As rotas recusam** | texto. Custo: 5 arquivos de producao, 3 de teste |',
      '| D-68 | 2026-09-30 | **Tres colunas** | texto sem custo |',
      '| Linha | que nao e decisao |',
    ].join('\n')
    const decisions = parseDecisions(markdown)
    expect(decisions.size).toBe(2)
    expect(decisions.get('D-65')).toEqual({
      date: '2026-09-22',
      title: 'As rotas recusam',
      cost: '5 arquivos de producao, 3 de teste',
    })
    expect(decisions.get('D-68')?.cost).toBe(null)
  })
})

describe('countAddedLines e summarizeFiles — a conta do tamanho', () => {
  it('conta so as linhas acrescentadas, sem o cabecalho do diff', () => {
    expect(countAddedLines('+++ b/docs/05-contratos-api.md\n+linha\n+outra\n-removida')).toBe(2)
  })

  it('conta arquivo de codigo e teste uma vez so, e contrato sobe P para M', () => {
    const files = [
      'src/a.ts',
      'src/a.ts',
      'tests/a.test.ts',
      'docs/05-contratos-api.md',
      'tools/x.mjs',
    ]
    expect(summarizeFiles(files, 3)).toEqual({
      counted: ['src/a.ts', 'tests/a.test.ts'],
      contractChanged: true,
      size: 'M',
    })
  })
})
