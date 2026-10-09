import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COUNTERS } from '../../tools/contar-documentacao.config.mjs'
import {
  blocks,
  createSource,
  findLooseNumbers,
  findPairs,
  inspect,
  looseNumbers,
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

  it('caso obrigatorio atribuido a duas historias conta as duas', () => {
    write(
      'docs/08-qualidade-operacao.md',
      [
        '### 1.3. Cobertura obrigatória por regra',
        '',
        '| Caso-limite | Valor concreto | Resultado esperado | História |',
        '|---|---|---|---|',
        '| STATUS canônico | `"X"` | `x` | H-06 |',
        '| Cor não reconhecida | `"theme:9\\|tint"` | quarentena | H-04, H-07 |',
        '',
        '## 2. Ingestão',
      ].join('\n'),
    )
    track()
    const source = createSource(root)
    expect(COUNTERS['casos-obrigatorios'](source)).toBe(2)
    expect(COUNTERS['historias-com-caso-obrigatorio'](source)).toBe(3)
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

  it('rules sao os .md de .claude/rules, pela mesma regra do git', () => {
    write('.claude/rules/comentarios.md', '')
    write('.claude/rules/microcopia.md', '')
    write('.claude/rules/LEIA.txt', '')
    track()
    expect(COUNTERS.rules(createSource(root))).toBe(2)
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
    expect(COUNTERS['indicadores-aposentados'](source)).toBe(1)
  })

  it('versao le o package.json, de dependencia ou de desenvolvimento, e a do node le o .nvmrc', () => {
    write(
      'package.json',
      JSON.stringify({
        dependencies: { fastify: '5.12.1' },
        devDependencies: { vitest: '4.1.11' },
      }),
    )
    write('.nvmrc', '22.23.2\n')
    track()
    const source = createSource(root)
    expect(COUNTERS.versao(source, 'fastify')).toBe('5.12.1')
    expect(COUNTERS.versao(source, 'vitest')).toBe('4.1.11')
    expect(COUNTERS.versao(source, 'node')).toBe('22.23.2')
    expect(() => COUNTERS.versao(source, 'exceljs')).toThrow('pacote ausente')
  })
})

describe('looseNumbers — o numero escrito fora de regiao', () => {
  const numbers = (file: string, lines: string[]) =>
    looseNumbers(file, lines.join('\n')).map(
      ({ line, number, unit }) => `${line}:${number} ${unit}`,
    )

  it('aponta algarismo e numero por extenso, com negrito e uma palavra no meio', () => {
    expect(
      numbers('CLAUDE.md', [
        'o verify tem os sete passos de sempre',
        'sao **18** épicos e 649 linhas reais',
      ]),
    ).toEqual(['1:sete passos', '2:18 épicos', '2:649 linhas'])
  })

  it('nao aponta regiao, crase, titulo, data, medicao, limite de formato nem bloco cercado', () => {
    expect(
      numbers('CLAUDE.md', [
        'sao <!-- conta:adrs -->7<!-- /conta --> ADRs',
        'o comando `grep 3 linhas` fica',
        '### 4.1. Premissas',
        'em 03/08/2026 eram 649 linhas',
        'medido: 649 linhas',
        'no máximo 12 linhas',
        '```',
        'sete passos',
        '```',
      ]),
    ).toEqual([])
  })

  it('nao aponta linha de registro: matriz concluida, indice fechado, decisao, plano original', () => {
    expect(
      numbers('docs/09-rastreabilidade.md', [
        '| H-77 | RF-32 | ✅ **Concluída.** a tabela tem nove colunas |',
        '- [H-77 — A tabela ordena pelas nove colunas](#h-77) ✅',
        '| D-52 | 2026-09-18 | sobe em dois passos |',
        'o plano original tinha 34 histórias',
        '| H-101 | RF-46 | **Aberta.** Nove blocos de teste |',
      ]),
    ).toEqual(['5:Nove blocos'])
  })

  it('no backlog, historia fechada e epico todo fechado sao registro; o epico aberto nao', () => {
    const backlog = [
      '## Épico E1 — Fechado',
      '',
      'o cabecalho fala de nove colunas',
      '',
      '### H-01 — Uma',
      '',
      'tinha sete passos',
      '',
      '> ✅ **CONCLUÍDA em 01/08/2026.**',
      '',
      '## Épico E2 — Aberto',
      '',
      'o cabecalho fala de 17 colunas',
      '',
      '### H-02 — Duas',
      '',
      'mexe em cinco arquivos',
    ]
    expect(numbers('docs/06-backlog.md', backlog)).toEqual(['13:17 colunas', '17:cinco arquivos'])
  })

  it('arquivo de registro nao e varrido; a visao de escopo, que mistura spec e estado, e', () => {
    const line = ['a especificacao descreve 15 colunas']
    expect(numbers('docs/01-auditoria-especificacao.md', line)).toEqual([])
    expect(numbers('docs/adr/0001-um.md', line)).toEqual([])
    expect(numbers('docs/00-visao-escopo.md', line)).toEqual(['1:15 colunas'])
  })
})

describe('findLooseNumbers — so as linhas que o diff acrescentou', () => {
  const commit = (message: string) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', message], {
      cwd: root,
    })

  it('aponta a linha nova, commitada ou nao, e o arquivo novo inteiro; a velha fica', () => {
    write('CLAUDE.md', 'antes havia sete passos\n')
    track()
    commit('base')
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim()

    write('CLAUDE.md', 'antes havia sete passos\nagora sao 18 épicos\n')
    track()
    commit('na branch')
    write('CLAUDE.md', 'antes havia sete passos\nagora sao 18 épicos\ne seis ADRs sem commit\n')
    write('docs/novo.md', 'um arquivo com 3 rotas\n')

    expect(
      findLooseNumbers(root, { base }).map(({ file, line, number }) => `${file}:${line}:${number}`),
    ).toEqual(['CLAUDE.md:2:18', 'CLAUDE.md:3:seis', 'docs/novo.md:1:3'])
    expect(findLooseNumbers(root, { base, all: true }).map(({ number }) => number)).toContain(
      'sete',
    )
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

  it('CRLF, como de editor no Windows: a regiao confere vale, e o --write preserva o CRLF', () => {
    const crlf = (lines: string[]) => lines.join('\r\n')
    write('src/domain/a.ts', '')
    write(
      'docs/04-arquitetura.md',
      crlf([
        '<!-- confere:arvore[src/domain] -->',
        '```',
        'repo/',
        '├─ src/',
        '│  └─ domain/',
        '│     └─ a.ts',
        '```',
        '<!-- /confere -->',
        '',
      ]),
    )
    write('README.md', crlf(['tem <!-- conta:adrs -->1<!-- /conta --> ADRs', '']))
    track()

    expect(inspect(root)).toEqual({
      divergences: [{ file: 'README.md', line: 1, name: 'adrs', written: '1', actual: '2' }],
      errors: [],
    })
    rewrite(root)
    expect(readFileSync(join(root, 'README.md'), 'utf-8')).toBe(
      crlf(['tem <!-- conta:adrs -->2<!-- /conta --> ADRs', '']),
    )
  })
})

describe('blocks — a unidade do par', () => {
  it('linha de tabela, item de lista e titulo sao blocos proprios; o bloco cercado e marcado', () => {
    const lines = ['# T', 'para', 'grafo', '| a |', '| b |', '- item', '  continua', '- outro']
    lines.push('```', 'codigo', '```', 'fim')

    expect(blocks(lines)).toEqual([
      { start: 1, end: 1, fenced: false },
      { start: 2, end: 3, fenced: false },
      { start: 4, end: 4, fenced: false },
      { start: 5, end: 5, fenced: false },
      { start: 6, end: 7, fenced: false },
      { start: 8, end: 8, fenced: false },
      { start: 9, end: 11, fenced: true },
      { start: 12, end: 12, fenced: false },
    ])
  })
})

/**
 * O caso que motivou o `--pares`: `D-49` aposentou o IND-14 na matriz, e a `02`
 * continuou listando-o como requisito vivo. A linha de definicao que muda e a chave;
 * quem a cita e o alvo — menos o registro, o exemplo e o proprio diff.
 */
describe('findPairs — quem cita o ID cuja definicao mudou', () => {
  const commit = (message: string) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', message], {
      cwd: root,
    })
  const head = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim()

  it('lista quem cita o ID da definicao alterada, e nao o registro, o exemplo nem o diff', () => {
    write(
      'docs/09-rastreabilidade.md',
      '| IND-14 | Pendentes | ✅ **Entregue** |\n| IND-15 | x |\n',
    )
    write('docs/02-requisitos.md', '| IND-14 | Pendentes | `count` |\n\nO IND-15 acusa volume.\n')
    write('docs/10-governanca.md', '| D-01 | 2026-09-18 | IND-14 sai da tela |\n')
    write('docs/adr/0001-x.md', 'O IND-14 nasceu aqui.\n')
    write('CLAUDE.md', '```\nexemplo com IND-14\n```\n\nO plano original lista o IND-14.\n')
    track()
    commit('base')
    const base = head()

    write(
      'docs/09-rastreabilidade.md',
      '| IND-14 | Pendentes | ⏹️ **Aposentado** |\n| IND-15 | x |\n',
    )
    write(
      'docs/02-requisitos.md',
      '| IND-14 | Pendentes | `count` |\n\nO IND-15, sem cartao, acusa.\n',
    )

    const pairs = findPairs(root, { base })

    expect(pairs.map(({ key, definedAt }) => [key, definedAt])).toEqual([
      ['IND-14', ['docs/09-rastreabilidade.md:1']],
    ])
    expect(pairs[0]?.citedBy.map(({ file, line }) => `${file}:${line}`)).toEqual([
      'CLAUDE.md:5',
      'docs/02-requisitos.md:1',
    ])
  })

  it('historia fechada no diff traz o epico dela, e o titulo do epico nao cita a si mesmo', () => {
    const backlog = (fechada: boolean) =>
      ['## Épico E1 — Um', '', '### H-01 — Uma', '']
        .concat(fechada ? ['> ✅ **CONCLUÍDA em 07/10/2026.**', ''] : [])
        .concat(['corpo', '', '### H-02 — Duas', '', 'corpo', ''])
        .join('\n')
    write('docs/06-backlog.md', backlog(false))
    write('README.md', 'O `E1` é o único aberto.\n')
    track()
    commit('base')
    const base = head()

    write('docs/06-backlog.md', backlog(true))

    expect(
      findPairs(root, { base }).map(({ key, definedAt, citedBy }) => ({
        key,
        definedAt,
        citedBy: citedBy.map(({ file, line }) => `${file}:${line}`),
      })),
    ).toEqual([{ key: 'E1', definedAt: ['docs/06-backlog.md:5'], citedBy: ['README.md:1'] }])
  })

  it('sem definicao alterada nao ha par, mesmo com o ID citado no trecho que mudou', () => {
    write('docs/09-rastreabilidade.md', '| IND-14 | Pendentes |\n')
    write('docs/02-requisitos.md', 'O IND-14 acusa volume.\n')
    track()
    commit('base')
    const base = head()

    write('docs/02-requisitos.md', 'O IND-14 acusa volume alto.\n')

    expect(findPairs(root, { base })).toEqual([])
  })
})
