import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import config, { COUNTERS } from '../../tools/contar-documentacao.config.mjs'
import type { MirrorSide } from '../../tools/contar-documentacao.mjs'
import {
  blocks,
  checkMirrors,
  createSource,
  findDefinitions,
  findLooseNumbers,
  findPairs,
  inspect,
  inspectStructure,
  looseNumbers,
  looseTableRows,
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
 * Os formatos vem do que o levantamento da ADR-0007 achou nos documentos: historia
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
    expect(COUNTERS['historias-abertas'](source)).toBe(1)
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

  it('casos-limite sao os itens de primeiro nivel da secao, ate o proximo rotulo', () => {
    write(
      'docs/06-backlog.md',
      [
        '# Backlog',
        '',
        '### H-01 — Sem a secao',
        '',
        '### H-102 — Com a secao',
        '',
        '**Casos-limite:**',
        '- Um caso',
        '  que continua na linha seguinte.',
        '- Outro caso',
        '',
        '  > Nota recuada dentro do item, com - travessao.',
        '- Terceiro',
        '',
        '**Dependências:** H-01',
        '- nao e caso-limite',
        '',
      ].join('\n'),
    )
    track()
    const source = createSource(root)
    expect(COUNTERS['casos-limite'](source, 'H-102')).toBe(3)
    expect(() => COUNTERS['casos-limite'](source, 'H-01')).toThrow('sem secao Casos-limite')
    expect(() => COUNTERS['casos-limite'](source, 'H-07')).toThrow('historia ausente')
    expect(COUNTERS['casos-limite-desde'](source, 'H-102 2')).toBe(2)
    expect(COUNTERS['casos-limite-desde'](source, 'H-102 4')).toBe(0)
    expect(() => COUNTERS['casos-limite-desde'](source, 'H-102')).toThrow('posicao invalida')
    expect(() => COUNTERS['casos-limite-desde'](source, 'H-102 0')).toThrow('posicao invalida')
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

  it('lista de regras do corpus sai em ordem de ID, com "e" antes da ultima', () => {
    write(
      'docs/estilizacao/corpus-estilo.md',
      [
        '| ID | EIXO | PREDICADO | BALDE | SINAL | CONTRAEXEMPLO | FONTE | CUSTO |',
        '|---|---|---|---|---|---|---|---|',
        '| A11 | acessibilidade | p | COMPOSICIONAL | s | c | f | baixo |',
        '| C04 | consistência | p | COMPOSICIONAL | s | c | f | baixo |',
        '| C05 | consistência | p | LOCAL | s | c | f | baixo |',
        '| R06 | responsividade | p | COMPOSICIONAL | s | c | f | médio |',
        '| D01 | modo escuro | p | COMPOSICIONAL | s | c | f | baixo |',
      ].join('\n'),
    )
    track()
    const source = createSource(root)
    expect(COUNTERS['regras-corpus-lista'](source, 'balde=COMPOSICIONAL')).toBe(
      'A11, C04, D01 e R06',
    )
    expect(COUNTERS['regras-corpus-lista'](source, 'custo=médio')).toBe('R06')
    expect(() => COUNTERS['regras-corpus-lista'](source, 'balde=EXECUÇÃO')).toThrow('nenhuma regra')
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

  it('aponta as outras formas de estado que o corpus usa, alem de "numero, unidade"', () => {
    expect(
      numbers('CLAUDE.md', [
        '**113 das 114 histórias** estão concluídas',
        '**Pendências abertas: 1**, e Total: **114**',
        'Por custo: **baixo 19** · **médio 17**',
        'são 27 `IND-NN` definidos',
        'o verify encadeia os **8**, na ordem',
        'React 19.2.8 e Tailwind CSS 4.3.3',
        'Total: 114 — 113 concluídas, 1 aberta',
        'com os 65',
        'achados, e as sete',
        'páginas do painel',
      ]),
    ).toEqual([
      '1:113 histórias',
      '1:114 histórias',
      '2:1 Pendências',
      '2:114 Total',
      '3:19 custo',
      '3:17 custo',
      '4:27 IND-NN',
      '5:8 …',
      '6:19.2.8 React',
      '6:4.3.3 Tailwind CSS',
      '7:114 Total',
      '7:113 concluídas',
      '7:1 aberta',
      '8:65 achados',
      '9:sete páginas',
    ])
  })

  it('nao aponta o que so parece estado: numero da palavra seguinte, versao maior, faixa, percentual', () => {
    expect(
      numbers('CLAUDE.md', [
        'REGRA ANTI-PROLIFERAÇÃO: duas peças que compartilham gatilho',
        'Faixa total: 28 a 66 sessões',
        'só existe se as ondas 1 e 2 estiverem concluídas',
        'React 19 com Tailwind v4',
        'os épicos vão de `E1` a `E19`',
        'acha cerca de 30% das divergências',
        'a API atende em **5173**',
        'termina em os 65',
        '',
        'achados',
      ]),
    ).toEqual([])
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

  it('nao aponta linha de registro: matriz concluida, indice fechado, decisao', () => {
    expect(
      numbers('docs/09-rastreabilidade.md', [
        '| H-77 | RF-32 | ✅ **Concluída.** a tabela tem nove colunas |',
        '- [H-77 — A tabela ordena pelas nove colunas](#h-77) ✅',
        '| D-52 | 2026-09-18 | sobe em dois passos |',
        '| H-101 | RF-46 | **Aberta.** Nove blocos de teste |',
      ]),
    ).toEqual(['4:Nove blocos'])
  })

  it('"plano original" nao e registro: a frase que o cita diz tambem o estado de hoje', () => {
    expect(
      numbers('docs/README.md', ['sao 114 histórias (o 31 era do plano original de cinco fases)']),
    ).toEqual(['1:114 histórias', '1:cinco fases'])
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

  it('no epico fechado, a secao ### que nao e historia fala do presente, e nao e registro', () => {
    const backlog = [
      '## Épico E18 — Fechado',
      '',
      '### H-01 — Uma',
      '',
      '> ✅ **CONCLUÍDA em 01/08/2026.**',
      '',
      'tinha sete passos',
      '',
      '### Varredura de verbos',
      '',
      'o backlog tem 114 histórias hoje',
    ]
    expect(numbers('docs/06-backlog.md', backlog)).toEqual(['11:114 histórias'])
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

  it('a linha que so o --write tocou nao e acrescentada; a editada em volta da regiao e', () => {
    write(
      'CLAUDE.md',
      [
        'São <!-- conta:historias -->2<!-- /conta --> histórias, do plano de cinco fases',
        'Há <!-- conta:adrs -->1<!-- /conta --> ADRs e sete passos',
        '',
      ].join('\n'),
    )
    track()
    commit('base')
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim()

    expect(rewrite(root)).toEqual(['CLAUDE.md'])
    const text = readFileSync(join(root, 'CLAUDE.md'), 'utf-8')
    write('CLAUDE.md', text.replace('sete passos', 'oito passos'))

    expect(
      findLooseNumbers(root, { base }).map(({ file, line, number }) => `${file}:${line}:${number}`),
    ).toEqual(['CLAUDE.md:2:oito'])
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

  it('confere os links: o indice aponta cada arquivo do diretorio, e so eles', () => {
    const index = [
      '<!-- confere:links[docs/adr] -->',
      '',
      '| ADR | Decisão |',
      '|---|---|',
      '| [0001](adr/0001-um.md) | Um |',
      '| [0003](adr/0003-tres.md#contexto) | Tres, que nao existe |',
      '| [fora](../README.md) | Fora do diretorio |',
      '',
      '<!-- /confere -->',
      '',
    ].join('\n')
    write('docs/README.md', index)
    track()

    expect(inspect(root).divergences.map((divergence) => divergence.actual)).toEqual([
      'docs/adr: falta no indice 0002-dois.md',
      'docs/adr: o indice aponta o que nao existe: 0003-tres.md',
    ])
    expect(rewrite(root)).toEqual([])

    write('docs/README.md', index.replace('adr/0003-tres.md#contexto', 'adr/0002-dois.md'))
    expect(inspect(root)).toEqual({ divergences: [], errors: [] })
  })

  it('confere que nao examina nenhum arquivo e erro com arquivo:linha, e cita a rule', () => {
    write('src/domain/a.ts', '')
    write('docs/vazio/.gitkeep', '')
    write('docs/README.md', '')
    write('docs/04-arquitetura.md', '')
    track()
    write('docs/vazio/nao-rastreado.md', '')
    const regions = {
      links: { file: 'docs/README.md', body: ['[0001](adr/0001-um.md), [0002](adr/0002-dois.md)'] },
      arvore: {
        file: 'docs/04-arquitetura.md',
        body: ['├─ src/', '│  └─ domain/', '│     └─ a.ts'],
      },
    }
    const found = (marker: string, { closed = true, body = '' } = {}) => {
      const check = marker.startsWith('link') ? 'links' : 'arvore'
      for (const { file } of Object.values(regions)) write(file, '')
      const region = regions[check]
      const lines = body ? [body] : region.body
      write(
        region.file,
        [`<!-- confere:${marker} -->`, ...lines, ...(closed ? ['<!-- /confere -->'] : []), ''].join(
          '\n',
        ),
      )
      const { divergences, errors } = inspect(root)
      return [
        ...divergences.map(({ file, line, actual }) => `${file}:${line} ${actual}`),
        ...errors.map(({ file, line, message }) => `${file}:${line} ${message}`),
      ]
    }
    const vacuous = 'a confere nao examinaria nada (.claude/rules/documentacao.md, R5)'

    expect(found('links[docs/adr]')).toEqual([])
    expect(found('arvore[src/domain]')).toEqual([])

    expect(found('links[docs/adr]', { closed: false })).toEqual([
      'docs/README.md:1 confere sem fechamento',
    ])
    expect(found('linkz[docs/adr]')).toEqual([
      'docs/README.md:1 nome desconhecido: linkz[docs/adr]',
    ])
    expect(found('links[docs/adrs]')).toEqual([
      `docs/README.md:1 links[docs/adrs] falhou: docs/adrs nao tem arquivo no git, e ${vacuous}`,
    ])
    expect(found('links')).toEqual([
      `docs/README.md:1 links falhou: nenhum diretorio no argumento, e ${vacuous}`,
    ])
    expect(found('links[]')).toEqual([
      `docs/README.md:1 links[] falhou: nenhum diretorio no argumento, e ${vacuous}`,
    ])
    expect(found('links[adr]')).toEqual([
      `docs/README.md:1 links[adr] falhou: adr nao tem arquivo no git, e ${vacuous}`,
    ])
    expect(found('links[docs/vazio]', { body: '[x](vazio/nao-rastreado.md)' })).toEqual([
      `docs/README.md:1 links[docs/vazio] falhou: docs/vazio nao tem arquivo no git, e ${vacuous}`,
    ])

    expect(found('arvore[src/domain]', { closed: false })).toEqual([
      'docs/04-arquitetura.md:1 confere sem fechamento',
    ])
    expect(found('arvorr[src/domain]')).toEqual([
      'docs/04-arquitetura.md:1 nome desconhecido: arvorr[src/domain]',
    ])
    expect(found('arvore[src/domainx]')).toEqual([
      `docs/04-arquitetura.md:1 arvore[src/domainx] falhou: src/domainx nao tem arquivo no git, e ${vacuous}`,
    ])
    expect(found('arvore')).toEqual([
      `docs/04-arquitetura.md:1 arvore falhou: nenhum diretorio no argumento, e ${vacuous}`,
    ])
    expect(found('arvore[]')).toEqual([
      `docs/04-arquitetura.md:1 arvore[] falhou: nenhum diretorio no argumento, e ${vacuous}`,
    ])
    expect(found('arvore[docs/vazio]', { body: '├─ docs/\n│  └─ vazio/    # 0 arquivos' })).toEqual(
      [
        `docs/04-arquitetura.md:1 arvore[docs/vazio] falhou: docs/vazio nao tem arquivo no git, e ${vacuous}`,
      ],
    )
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

  const backlog = (fechada: boolean) =>
    ['## Épico E1 — Um', '', '### H-01 — Uma', '']
      .concat(fechada ? ['> ✅ **CONCLUÍDA em 07/10/2026.**', ''] : [])
      .concat(['corpo', '', '### H-02 — Duas', '', 'corpo', ''])
      .join('\n')
  const keysAndCiters = () =>
    findPairs(root, { base: 'HEAD' }).map(({ key, definedAt, citedBy }) => ({
      key,
      definedAt,
      citedBy: citedBy.map(({ file, line }) => `${file}:${line}`),
    }))

  it('historia fechada no diff e chave e traz o epico dela; o titulo do epico nao cita a si mesmo', () => {
    write('docs/06-backlog.md', backlog(false))
    write(
      'README.md',
      'O `E1` é o único aberto.\n\nA assinatura `D0 CF 11 E0 A1 B1 1A E1`.\n\nA única aberta é `H-01`.\n',
    )
    track()
    commit('base')

    write('docs/06-backlog.md', backlog(true))

    expect(keysAndCiters()).toEqual([
      { key: 'H-01', definedAt: ['docs/06-backlog.md:5'], citedBy: ['README.md:5'] },
      { key: 'E1', definedAt: ['docs/06-backlog.md:5'], citedBy: ['README.md:1'] },
    ])
  })

  it('a regiao que o --write reescreveu nao tira do alvo o paragrafo em volta dela', () => {
    write('docs/06-backlog.md', backlog(false))
    write(
      'CLAUDE.md',
      'São <!-- conta:historias-concluidas -->0<!-- /conta --> concluídas: o `E1` segue\naberto, e resta `H-01`.\n',
    )
    track()
    commit('base')

    write('docs/06-backlog.md', backlog(true))
    expect(rewrite(root)).toEqual(['CLAUDE.md'])

    expect(keysAndCiters()).toEqual([
      { key: 'H-01', definedAt: ['docs/06-backlog.md:5'], citedBy: ['CLAUDE.md:2'] },
      { key: 'E1', definedAt: ['docs/06-backlog.md:5'], citedBy: ['CLAUDE.md:1'] },
    ])
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

describe('findDefinitions — onde cada ID citado e definido', () => {
  it('titulo de nivel 1 a 4 e linha de tabela definem; aponta o ID sem definicao e o repetido', () => {
    write('docs/adr/0003-tres.md', '# ADR-0003 — Tres\n')
    write('docs/02-requisitos.md', '| RF-01 | Ler |\n\n#### TD-05 — Cor\n\n### TD-05 — medido\n')
    write(
      'CLAUDE.md',
      'Segue a ADR-0003 e o RF-01; falta a PD-01.\n\n```\n| PD-02 | exemplo |\n```\n',
    )
    track()

    const found = new Map(findDefinitions(root).map((entry) => [entry.id, entry]))

    expect(found.get('ADR-0003')?.definedAt).toEqual(['docs/adr/0003-tres.md:1'])
    expect(found.get('RF-01')?.definedAt).toEqual(['docs/02-requisitos.md:1'])
    expect(found.get('TD-05')?.definedAt).toEqual([
      'docs/02-requisitos.md:3',
      'docs/02-requisitos.md:5',
    ])
    expect(found.get('PD-01')).toEqual({
      id: 'PD-01',
      family: 'PD',
      citedAt: 'CLAUDE.md:1',
      definedAt: [],
      mirror: null,
    })
    expect(found.has('PD-02')).toBe(false)
  })

  it('os dois lados de um espelho declarado nao contam como definicao repetida; um terceiro conta', () => {
    write('docs/09-rastreabilidade.md', '## 4. Verificação\n\n| H-01 | ✅ |\n| H-02 | x |\n')
    write('docs/perfilamento/RESULTADO.md', '# H-02 — Resultado\n')
    track()

    const found = new Map(findDefinitions(root).map((entry) => [entry.id, entry]))

    expect(found.get('H-01')?.mirror).toBe('historias')
    expect(found.get('H-02')).toMatchObject({ mirror: null, definedAt: { length: 3 } })
  })

  it('entre crases, so a crase que e o proprio ID cita: bytes e nome de arquivo nao', () => {
    write('CLAUDE.md', 'assinatura `D0 CF 11 E0 A1 B1`, trava `~$E30.xlsx`, e a `H-35` fechada\n')
    track()

    const ids = findDefinitions(root).map((entry) => entry.id)

    expect(ids).toContain('H-35')
    expect(ids).not.toContain('E0')
    expect(ids).not.toContain('E30')
  })
})

/**
 * Os espelhos declarados em `contar-documentacao.config.mjs`, cada um sobre os dois
 * documentos que ele liga. Os casos sao os que motivaram a guarda: RF-35, revogado por
 * D-43 na `02` e "✅ Entregue" na matriz; historia fechada no backlog e aberta na §4, e o
 * inverso; IND-21, "Bloqueado" de um lado e "Fora de escopo" do outro.
 */
describe('checkMirrors — o estado de um ID nos dois lados do espelho', () => {
  const only = (name: string) => ({
    mirrors: config.ids.mirrors.filter((mirror) => mirror.name === name),
    floors: {},
  })
  const problems = (name: string) =>
    inspectStructure(root, only(name))
      .problems.filter(({ guard }) => guard === `espelho:${name}`)
      .map(({ file, line, message }) => `${file}:${line} ${message}`)

  it('historia: o estado do backlog e o da §4, nos dois sentidos, e a que falta de um lado', () => {
    write(
      'docs/09-rastreabilidade.md',
      [
        '## 4. Verificação de histórias órfãs',
        '',
        '| História | Aparece em | Papel |',
        '|---|---|---|',
        '| H-01 | x | ✅ **Concluída.** |',
        '| H-02 | x | ✅ **Concluída.** |',
        '| H-33 | x | **Aberta** |',
        '| H-40 | x | **Aberta** |',
        '',
        '## 5. Requisitos',
        '',
        '| H-99 | fora da §4 |',
      ].join('\n'),
    )
    track()

    expect(problems('historias')).toEqual([
      'docs/09-rastreabilidade.md:6 H-02: docs/09-rastreabilidade.md:6 diz "fechada"; docs/06-backlog.md:9 diz "aberta"',
      'docs/09-rastreabilidade.md:7 H-33: docs/09-rastreabilidade.md:7 diz "aberta"; docs/06-backlog.md:17 diz "fechada"',
      'docs/09-rastreabilidade.md:8 H-40 falta em docs/06-backlog.md',
    ])
  })

  it('requisito: revogado na 02 e entregue na matriz reprova; o que a §5 nao lista, nao', () => {
    write(
      'docs/02-requisitos.md',
      [
        '## 1. Requisitos funcionais',
        '',
        '| RF-20 | Editar | H-23 |',
        '| RF-35 | ~~Declarar~~ *(**REVOGADO por `D-43`**)* | H-79 |',
      ].join('\n'),
    )
    write(
      'docs/09-rastreabilidade.md',
      [
        '## 5. Requisitos funcionais sem indicador correspondente',
        '',
        '| RF-35 · ~~Declarar o cliente~~ | Decorrência | H-79 | ✅ **Entregue.** |',
        '| RF-23 a RF-26 · Defesas | D7 | H-25 | ✅ **Entregue.** |',
      ].join('\n'),
    )
    track()

    expect(problems('requisitos')).toEqual([
      'docs/09-rastreabilidade.md:3 RF-35: docs/09-rastreabilidade.md:3 diz "vigente"; docs/02-requisitos.md:4 diz "revogado"',
      ...['RF-23', 'RF-24', 'RF-25', 'RF-26'].map(
        (id) => `docs/09-rastreabilidade.md:4 ${id} falta em docs/02-requisitos.md`,
      ),
    ])
  })

  it('faixa de ID na primeira celula vale para cada ID dela, com "a" ou travessao', () => {
    write(
      'docs/02-requisitos.md',
      [
        '## 1. Requisitos funcionais',
        '',
        ...['RF-23', 'RF-24 | ~~Barrar~~ *(**REVOGADO**)*', 'RF-25', 'RF-26'].map(
          (row) => `| ${row} | H-25 |`,
        ),
        ...['RF-07', 'RF-08 | ~~Ler~~ *(**REVOGADO**)*', 'RF-09'].map((row) => `| ${row} | H-02 |`),
      ].join('\n'),
    )
    write(
      'docs/09-rastreabilidade.md',
      [
        '## 5. Requisitos funcionais sem indicador correspondente',
        '',
        '| RF-23 a RF-26 · Defesas | D7 | H-25 | ✅ **Entregue.** |',
        '| RF-07–RF-09 · Leitura | D1 | H-02 | ✅ **Entregue.** |',
      ].join('\n'),
    )
    track()

    expect(problems('requisitos')).toEqual([
      'docs/09-rastreabilidade.md:3 RF-24: docs/09-rastreabilidade.md:3 diz "vigente"; docs/02-requisitos.md:4 diz "revogado"',
      'docs/09-rastreabilidade.md:4 RF-08: docs/09-rastreabilidade.md:4 diz "vigente"; docs/02-requisitos.md:8 diz "revogado"',
    ])
  })

  it('indicador: aposentado e bloqueado tem palavras diferentes de cada lado', () => {
    write(
      'docs/09-rastreabilidade.md',
      [
        '| IND-01 | a | b | c | H-09 | t | ✅ **Entregue** |',
        '| IND-03 | a | b | c | H-09 | t | ⏹️ **Aposentado** em D-49',
        '| IND-21 | a | — | c | — | — | ⛔ **Bloqueado por lacuna.** |',
        '| ALE-01 | a | b | c | H-14 | t | ✅ **Entregue** |',
      ].join('\n'),
    )
    write(
      'docs/02-requisitos.md',
      [
        '| IND-01 | Quantidade, que substitui o aposentado de nada | `count` | H-09 |',
        '| IND-03 | Processos em desembaraço | `count` | H-09 |',
        '| IND-21 | Tempo médio | **Fora de escopo.** | — |',
        '| ALE-01 | ETA vencida | `eta2 < hoje` | H-14 |',
      ].join('\n'),
    )
    track()

    expect(problems('indicadores')).toEqual([
      'docs/02-requisitos.md:1 IND-01: docs/02-requisitos.md:1 diz "aposentado"; docs/09-rastreabilidade.md:1 diz "ativo"',
      'docs/02-requisitos.md:2 IND-03: docs/02-requisitos.md:2 diz "ativo"; docs/09-rastreabilidade.md:2 diz "aposentado"',
    ])
  })

  it('pendencia: a fechada nao fica no CLAUDE.md, e a aberta nao falta dele', () => {
    write(
      'docs/README.md',
      [
        '## Pendências',
        '',
        '| Pendência | O que era | Estado |',
        '|---|---|---|',
        '| **PD-01** | a | ✅ Fechada em 04/09/2026 |',
        '| **PD-02** | b | Aberta |',
        '| **PD-03** | c | Aberta |',
      ].join('\n'),
    )
    write(
      'CLAUDE.md',
      ['### Pendências abertas', '', '| **PD-01** | a |', '| **PD-03** | c |'].join('\n'),
    )
    track()

    expect(problems('pendencias')).toEqual([
      'CLAUDE.md:3 PD-01: CLAUDE.md:3 diz "aberta"; docs/README.md:5 diz "fechada"',
      'docs/README.md:6 PD-02: CLAUDE.md nao o lista, e isso diz "fechada"; docs/README.md:6 diz "aberta"',
    ])
  })

  it('o lado que nao passa do piso, a secao que sumiu e o ID repetido reprovam', () => {
    write(
      'docs/09-rastreabilidade.md',
      ['## 4. Verificação', '', '| H-01 | ✅ |', '| H-01 | ✅ |'].join('\n'),
    )
    write('docs/README.md', '## Pendências que mudaram de nome\n')
    write('CLAUDE.md', '### Pendências abertas\n')
    track()

    const floors = { mirrors: { historias: { source: 3, copy: 3 } } }
    const historias = inspectStructure(root, { ...only('historias'), floors }).problems.filter(
      ({ guard }) => guard === 'espelho:historias',
    )
    expect(historias.map(({ file, line, message }) => `${file}:${line} ${message}`)).toEqual([
      'docs/06-backlog.md:0 leu 3 ID(s); precisa passar de 3',
      'docs/09-rastreabilidade.md:4 H-01 repetido neste lado do espelho',
      'docs/09-rastreabilidade.md:0 leu 1 ID(s); precisa passar de 3',
      'docs/06-backlog.md:9 H-02 falta em docs/09-rastreabilidade.md',
      'docs/06-backlog.md:17 H-33 falta em docs/09-rastreabilidade.md',
    ])
    expect(problems('pendencias')).toEqual([
      'docs/README.md:0 secao nao encontrada: /^## Pendências$/',
    ])
  })

  it('`cell` le o ID de outra celula, e `merge` junta o estado do ID em mais linhas', () => {
    write(
      'docs/matriz.md',
      [
        '| RF-01 | H-01 | ✅ |',
        '| RF-02 | H-01, H-02 | — |',
        '| RF-03 | H-02 | ✅ |',
        '| RF-04 | H-33 | ✅ |',
      ].join('\n'),
    )
    track()
    const copy: MirrorSide = {
      file: 'docs/matriz.md',
      entries: 'rows',
      cell: 1,
      state: (row) => (row.includes('✅') ? 'fechada' : 'aberta'),
    }
    const problemsWith = (side: MirrorSide) =>
      checkMirrors(
        createSource(root),
        only('historias').mirrors.map((mirror) => ({ ...mirror, copy: side })),
      ).map(({ file, line, message }) => `${file}:${line} ${message}`)

    expect(
      problemsWith({ ...copy, merge: (state, other) => (state === 'fechada' ? state : other) }),
    ).toEqual([
      'docs/matriz.md:3 H-02: docs/matriz.md:3 diz "fechada"; docs/06-backlog.md:9 diz "aberta"',
    ])
    expect(problemsWith(copy)).toEqual([
      'docs/matriz.md:2 H-01 repetido neste lado do espelho',
      'docs/matriz.md:3 H-02 repetido neste lado do espelho',
    ])
  })
})

describe('looseTableRows e os pisos — a estrutura de que a renderizacao depende', () => {
  it('aponta a linha de tabela depois de linha em branco, e nao a tabela nova nem o exemplo', () => {
    const text = [
      '| D-43 | a |',
      '',
      '| D-44 | partida |',
      '',
      '| Nova | tabela |',
      '|---|---|',
      '| x | y |',
      '',
      '```',
      '',
      '| exemplo | cercado |',
      '```',
    ].join('\n')
    expect(looseTableRows(text)).toEqual([3])
  })

  it('dentro de citacao, mesmo recuada, a linha em branco e o > sozinho tambem soltam a seguinte', () => {
    const text = [
      '> | Campo | Tipo |',
      '> |---|---|',
      '> | a | x |',
      '>',
      '> | b | y |',
      '',
      '> | c | z |',
      '>',
      '> | Nova | tabela |',
      '> |---|---|',
      '',
      '  > | Ramo | Código |',
      '  > |---|---|',
      '  >',
      '  > | e | w |',
    ].join('\n')
    expect(looseTableRows(text)).toEqual([5, 7, 15])
  })

  it('reprova a tabela solta no escopo, e o escopo que nao passa do piso de regioes e de arquivos', () => {
    write(
      'README.md',
      'tem <!-- conta:adrs -->2<!-- /conta --> ADRs\n\n| a |\n|---|\n\n| solta |\n',
    )
    track()

    expect(
      inspectStructure(root, { mirrors: [], floors: { regions: 1, tables: 4 } }).problems.map(
        ({ file, line, guard, message }) => `${file}:${line} ${guard} ${message}`,
      ),
    ).toEqual([
      'README.md:6 tabela linha de tabela solta depois de linha em branco: o GitHub a mostra como texto',
      'escopo:0 piso examinou 1 regiao(oes) conta; precisa passar de 1',
      'escopo:0 piso examinou 4 arquivo(s) em busca de tabela solta; precisa passar de 4',
    ])
  })

  it('reprova o nome abaixo do piso: a confere apagada e a cercada nao contam, e o argumento nao entra', () => {
    write(
      'docs/README.md',
      [
        'tem <!-- conta:adrs -->1<!-- /conta --> ADR',
        '',
        '<!-- confere:arvore[src/domain] -->',
        '<!-- /confere -->',
        '',
        '```',
        '<!-- confere:links[docs/adr] -->',
        '<!-- /confere -->',
        '```',
      ].join('\n'),
    )
    track()
    const byName = { 'conta:adrs': 0, 'confere:arvore': 0, 'confere:links': 0, 'conta:rules': 0 }

    expect(
      inspectStructure(root, { mirrors: [], floors: { byName } }).problems.map(
        ({ file, line, guard, message }) => `${file}:${line} ${guard} ${message}`,
      ),
    ).toEqual([
      'confere:links:0 piso achou 0 regiao(oes) fora de bloco cercado; precisa passar de 0 (.claude/rules/documentacao.md, R5)',
      'conta:rules:0 piso achou 0 regiao(oes) fora de bloco cercado; precisa passar de 0 (.claude/rules/documentacao.md, R5)',
    ])
  })
})

describe('o que a configuracao troca no nucleo — formato do numero, anotacao e base', () => {
  const saved = { base: config.base, ...config.language }
  afterEach(() => {
    config.base = saved.base
    config.language.locale = saved.locale
    config.language.treeFiles = saved.treeFiles
    Reflect.deleteProperty(config.counters, 'milhar')
  })

  it('o numero sai no formato de `language.locale`', () => {
    config.counters.milhar = () => 1234
    write('README.md', 'sao <!-- conta:milhar -->1.234<!-- /conta --> linhas\n')
    track()
    expect(inspect(root).divergences).toEqual([])

    config.language.locale = 'en-US'
    expect(inspect(root).divergences.map(({ actual }) => actual)).toEqual(['1,234'])
  })

  it('a anotacao da arvore e a palavra de `language.treeFiles`', () => {
    write('src/domain/a.ts', '')
    write(
      'docs/04-arquitetura.md',
      [
        '<!-- confere:arvore[src/domain] -->',
        '├─ src/',
        '│  └─ domain/    # 1 file',
        '<!-- /confere -->',
      ].join('\n'),
    )
    track()
    const problems = () => inspect(root).divergences.map(({ actual }) => actual)
    expect(problems()).toEqual(['src/domain: a arvore nao lista nem anota este diretorio'])

    config.language.treeFiles = 'files?'
    expect(problems()).toEqual([])
  })

  it('sem `base` na chamada, o `--nuas` e o `--pares` comparam contra a `base` da configuracao', () => {
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root })
    git('symbolic-ref', 'HEAD', 'refs/heads/topico')
    write('CLAUDE.md', 'antes havia sete passos\n\nA H-02 segue aberta.\n')
    track()
    git('commit', '-qm', 'base')
    git('branch', 'tronco')
    write('CLAUDE.md', 'antes havia sete passos\nagora sao 18 épicos\n\nA H-02 segue aberta.\n')
    write(
      'docs/06-backlog.md',
      BACKLOG.replace('### H-02 — Segunda', '### H-02 — Segunda, renomeada'),
    )
    config.base = 'tronco'

    expect(
      findLooseNumbers(root).map(({ file, line, number }) => `${file}:${line}:${number}`),
    ).toEqual(['CLAUDE.md:2:18'])
    expect(
      findPairs(root).map(({ key, citedBy }) => [key, citedBy.map(({ line }) => line)]),
    ).toEqual([['H-02', [4]]])
  })
})
