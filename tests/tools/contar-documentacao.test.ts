import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  COUNTERS,
  createSource,
  inspect,
  parseTree,
  rewrite,
  scanRegions,
} from '../../tools/contar-documentacao.mjs'

/**
 * `tools/contar-documentacao.mjs` sobre um repositorio git temporario, nunca o real
 * — regra inviolavel 7. O git entra de verdade porque e ele quem decide o que existe:
 * arquivo nao rastreado e arquivo oculto nao contam, e e isso que separa o portao
 * local do CI.
 *
 * Os formatos vem do que o levantamento de 01/10/2026 achou nos documentos: historia
 * cujo bloco seguinte e um epico, linha de tabela sem `|` final, e o balde "DE
 * EXECUCAO" escrito em duas variantes.
 */

let root: string

function write(path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function track() {
  execFileSync('git', ['add', '-A'], { cwd: root })
}

const BACKLOG = [
  '# Backlog',
  '',
  '## Épico E1 — Um',
  '',
  '### H-01 — Primeira',
  '',
  '> ✅ **CONCLUÍDA em 01/08/2026.**',
  '',
  '### H-02 — Segunda',
  '',
  '**Objetivo:** aberta.',
  '',
  '## Épico E2 — Dois',
  '',
  '> ✅ **CONCLUÍDA** fora de historia nenhuma, na abertura do epico.',
  '',
  '### H-33 — Terceira',
  '',
  '> ✅ **CONCLUÍDA em 02/08/2026.**',
  '',
].join('\n')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'contar-documentacao-'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  write('docs/06-backlog.md', BACKLOG)
  write(
    'package.json',
    JSON.stringify({ scripts: { verify: 'npm run lint && npm test && npm run build' } }),
  )
  write('docs/adr/0001-um.md', '# ADR 1')
  write('docs/adr/0002-dois.md', '# ADR 2')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('os contadores, sobre fonte com valor concreto', () => {
  it('historia termina no proximo titulo, e o bloco de abertura de epico nao fecha a anterior', () => {
    track()
    const source = createSource(root)
    expect(COUNTERS.historias(source)).toBe(3)
    expect(COUNTERS['historias-concluidas'](source)).toBe(2)
    expect(COUNTERS['historias-desde'](source, 'H-33')).toBe(1)
    expect(COUNTERS.epicos(source)).toBe(2)
  })

  it('passos do verify sao os comandos encadeados por &&, sem o prefixo do npm', () => {
    track()
    const source = createSource(root)
    expect(COUNTERS['passos-verify'](source)).toBe(3)
    expect(COUNTERS['passos-verify-lista'](source)).toBe('`lint`, `test`, `build`')
  })

  it('o git decide o que existe: arquivo oculto e arquivo nao rastreado nao contam', () => {
    write('docs/adr/.rascunho.md', 'oculto')
    track()
    write('docs/adr/0003-nao-rastreado.md', '# ADR 3')
    expect(COUNTERS.adrs(createSource(root))).toBe(2)
  })

  it('regra do corpus filtra pelo comeco do valor, e as duas variantes de EXECUCAO somam', () => {
    write(
      'docs/estilizacao/corpus-estilo.md',
      [
        '| ID | EIXO | PREDICADO | BALDE | SINAL | CONTRAEXEMPLO | FONTE | CUSTO |',
        '|---|---|---|---|---|---|---|---|',
        '| A01 | acessibilidade | p | EXECUÇÃO → estático via §3.2 | s | c | f | baixo |',
        '| A02 | acessibilidade | p | EXECUÇÃO → parcialmente estático | s | c | f | alto |',
        '| C01 | consistência | p | LOCAL | s | c | f | baixo |',
      ].join('\n'),
    )
    track()
    const source = createSource(root)
    expect(COUNTERS['regras-corpus'](source)).toBe(3)
    expect(COUNTERS['regras-corpus'](source, 'balde=EXECUÇÃO')).toBe(2)
    expect(COUNTERS['regras-corpus'](source, 'custo=baixo')).toBe(2)
    expect(COUNTERS['regras-corpus-faixa'](source, 'eixo=A')).toBe('A01–A02')
  })

  it('indicador ativo le a coluna de status, e nao a nota que algumas linhas trazem depois dela', () => {
    write(
      'docs/09-rastreabilidade.md',
      [
        '| IND-01 | a | b | c | H-09 | t | ✅ **Entregue** |',
        '| IND-03 | a | b | c | H-09 | t | ⏹️ **Aposentado** em D-49 — substituído por IND-23',
        '| IND-15 | a | b | c | H-12 | t | ✅ **Entregue** | *(**APOSENTADO** so na nota)*',
        '| IND-21 | a | b | c | — | — | **Bloqueado por lacuna.** |',
      ].join('\n'),
    )
    track()
    const source = createSource(root)
    expect(COUNTERS['indicadores-definidos'](source)).toBe(4)
    expect(COUNTERS['indicadores-ativos'](source)).toBe(2)
  })
})

describe('scanRegions — onde um marcador vale', () => {
  it('le a regiao conta com a linha e o valor escrito', () => {
    const { counts, errors } = scanRegions('titulo\n\nsao <!-- conta:adrs -->7<!-- /conta --> ADRs')
    expect(errors).toEqual([])
    expect(counts).toEqual([{ line: 3, raw: 'adrs', written: '7' }])
  })

  it('recusa conta no inicio da linha, onde o CommonMark abriria bloco HTML', () => {
    const { counts, errors } = scanRegions('<!-- conta:adrs -->7<!-- /conta --> ADRs')
    expect(counts).toEqual([])
    expect(errors).toMatchObject([{ line: 1 }])
  })

  it('ignora marcador entre crases e dentro de bloco cercado, que documentam a sintaxe', () => {
    const text = [
      'use `<!-- conta:adrs -->7<!-- /conta -->` assim',
      '```',
      'x <!-- conta:adrs -->7<!-- /conta -->',
      '```',
    ].join('\n')
    expect(scanRegions(text)).toEqual({ counts: [], checks: [], errors: [] })
  })

  it('acusa marcador sem par e confere sem fechamento', () => {
    expect(scanRegions('so <!-- conta:adrs -->7 aqui').errors).toHaveLength(1)
    expect(scanRegions('<!-- confere:arvore[src] -->\nx').errors).toHaveLength(1)
    expect(scanRegions('x\n<!-- /confere -->').errors).toHaveLength(1)
  })
})

describe('parseTree — a arvore desenhada vira caminho', () => {
  it('reconstroi o caminho pelos degraus e guarda a anotacao', () => {
    const tree = [
      'repo/',
      '├─ src/',
      '│  ├─ domain/',
      '│  │  └─ a.ts       # H-49',
      '│  └─ http/',
      '│     └─ routes/    # 2 arquivos de rota',
    ]
    expect(parseTree(tree)).toEqual([
      { path: 'src/', annotation: null },
      { path: 'src/domain/', annotation: null },
      { path: 'src/domain/a.ts', annotation: 'H-49' },
      { path: 'src/http/', annotation: null },
      { path: 'src/http/routes/', annotation: '2 arquivos de rota' },
    ])
  })
})

describe('inspect e rewrite, sobre o repositorio temporario', () => {
  it('aponta o valor velho, reescreve so ele, e a segunda passada nao muda nada', () => {
    write(
      'README.md',
      'tem <!-- conta:historias -->2<!-- /conta --> historias e <!-- conta:adrs -->2<!-- /conta --> ADRs\n',
    )
    track()

    expect(inspect(root)).toEqual({
      divergences: [{ file: 'README.md', line: 1, name: 'historias', written: '2', actual: '3' }],
      errors: [],
    })

    expect(rewrite(root)).toEqual(['README.md'])
    expect(readFileSync(join(root, 'README.md'), 'utf-8')).toBe(
      'tem <!-- conta:historias -->3<!-- /conta --> historias e <!-- conta:adrs -->2<!-- /conta --> ADRs\n',
    )
    expect(rewrite(root)).toEqual([])
    expect(inspect(root).divergences).toEqual([])
  })

  it('nome desconhecido e erro, e nao divergencia', () => {
    write('CLAUDE.md', 'sao <!-- conta:inexistente -->1<!-- /conta -->\n')
    track()
    const { divergences, errors } = inspect(root)
    expect(divergences).toEqual([])
    expect(errors).toEqual([
      { file: 'CLAUDE.md', line: 1, message: 'nome desconhecido: inexistente' },
    ])
  })

  it('confere a arvore: lista contra o git, anotacao contra a contagem, e nao reescreve', () => {
    write('src/domain/a.ts', '')
    write('src/domain/b.ts', '')
    write('src/http/routes/x.ts', '')
    const tree = [
      'texto',
      '<!-- confere:arvore[src/domain src/http/routes] -->',
      '```',
      'repo/',
      '├─ src/',
      '│  ├─ domain/',
      '│  │  ├─ a.ts',
      '│  │  └─ c.ts',
      '│  └─ http/',
      '│     └─ routes/    # 2 arquivos de rota',
      '```',
      '<!-- /confere -->',
      '',
    ].join('\n')
    write('docs/04-arquitetura.md', tree)
    track()

    expect(inspect(root).divergences.map((divergence) => divergence.actual)).toEqual([
      'src/domain: falta na arvore b.ts',
      'src/domain: a arvore lista o que nao existe: c.ts',
      'src/http/routes: anotado 2, real 1',
    ])
    expect(rewrite(root)).toEqual([])
    expect(readFileSync(join(root, 'docs/04-arquitetura.md'), 'utf-8')).toBe(tree)
  })
})
