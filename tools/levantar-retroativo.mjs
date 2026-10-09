import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Levanta o que entrou na `main` depois da ultima historia escrita — o insumo da
 * escrita retroativa de historias (`D-69`) —, sem modelo e sem rede.
 *
 * Existe pelo custo medido (ADR-0007): o mesmo levantamento, feito a mao na
 * sessao, custou uns quinze comandos, e a redacao das 13 historias de `E17` e
 * `E18` custou cerca de 630 mil tokens, a maior parte relendo diffs e decisoes
 * inteiras. O esqueleto que sai daqui e o insumo compacto da redacao.
 *
 * O que ele NAO faz: agrupar em historia ou epico, que e julgamento; escrever no
 * backlog; e achar divergencia semantica — parametro de rota fora do contrato so
 * aparece lendo o codigo.
 *
 * `--desde H-NN` e o merge que trouxe o cabecalho `### H-NN —` ao backlog. Para
 * historia escrita antes do codigo, passe o SHA do merge que a fechou.
 *
 * Uso:
 *   node tools/levantar-retroativo.mjs --desde H-100
 *   node tools/levantar-retroativo.mjs --desde cc68238 --ate origin/main
 *   node tools/levantar-retroativo.mjs --tamanho 52a144c,87c5b60
 *
 * A saida vai para `.claude/local/levantamento-retroativo.md`, gitignored, e o
 * terminal recebe so o resumo.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BACKLOG = 'docs/06-backlog.md'
const CONTRACT = 'docs/05-contratos-api.md'
const GOVERNANCE = 'docs/10-governanca.md'
const OUTPUT = '.claude/local/levantamento-retroativo.md'

/** So codigo e teste contam para a regua do backlog; documento nao entra na lista de arquivos. */
export function classifyFile(path) {
  if (/^(src|web\/src)\//.test(path)) return 'code'
  if (/^(tests|web\/tests)\//.test(path)) return 'test'
  if (/^docs\//.test(path) || /^[^/]+\.md$/.test(path)) return 'doc'
  return 'other'
}

/** A regua do topo do backlog: P ate 3 arquivos e sem contrato, M ate 8 ou com contrato, G acima. */
export function sizeByRule(files, contractChanged) {
  if (files > 8) return 'G'
  if (files > 3 || contractChanged) return 'M'
  return 'P'
}

const PRODUCT_TYPES = new Set(['feat', 'fix', 'refactor', 'perf'])

export function commitType(subject) {
  return /^([a-z]+)[(:!]/.exec(subject)?.[1] ?? null
}

/**
 * Branch `H-NN/` e trabalho de historia; o assunto do commit nao entra, porque
 * citar historia antiga ("emenda H-88") nao faz do PR uma historia.
 *
 * Produto e commit `feat`, `fix`, `refactor` ou `perf` que toca codigo. Tocar
 * `src/` nao basta: o #149 so pos comentario em `web/src/`, e o #138 extraiu
 * texto para cabecalho — os dois sao ferramenta e documento.
 */
export function classifyPullRequest(branch, commits) {
  if (/^H-\d+\//.test(branch)) return 'covered'
  const product = commits.some(
    ({ subject, files }) =>
      PRODUCT_TYPES.has(commitType(subject)) && files.some((file) => classifyFile(file) === 'code'),
  )
  return product ? 'product' : 'outside'
}

export function extractDecisions(text) {
  const ids = new Set(text.match(/\bD-\d+\b/g) ?? [])
  return [...ids].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)))
}

export function parseMergeSubject(subject) {
  const match = /^Merge pull request #(\d+) from [^/]+\/(.+)$/.exec(subject)
  return match ? { pr: Number(match[1]), branch: match[2] } : null
}

/** Data, titulo e custo das linhas `| D-NN | data | **titulo** | ... |` da governanca. */
export function parseDecisions(markdown) {
  const decisions = new Map()
  for (const line of markdown.split('\n')) {
    const match = /^\| (D-\d+) \| ([^|]+) \| \*\*(.+?)\*\*/.exec(line)
    if (match === null) continue
    const cost = /Custo: ([^|]+?)\s*\|\s*$/.exec(line)?.[1] ?? null
    decisions.set(match[1], { date: match[2].trim(), title: match[3], cost })
  }
  return decisions
}

/**
 * Decisao REGISTRADA e a linha da governanca que o diff acrescenta sem remover.
 * Citar `D-NN` na mensagem nao conta, e emendar uma linha existente tambem nao:
 * ela aparece removida e acrescentada no mesmo diff.
 */
export function registeredDecisions(diff) {
  const idsIn = (sign) =>
    new Set(
      diff
        .split('\n')
        .filter((line) => line.startsWith(`${sign}| D-`))
        .flatMap((line) => /^.\| (D-\d+) \|/.exec(line)?.[1] ?? []),
    )
  const removed = idsIn('-')
  return extractDecisions([...idsIn('+')].filter((id) => !removed.has(id)).join(' '))
}

/** Quantas linhas um diff sem contexto acrescenta — o sinal de que o contrato mudou. */
export function countAddedLines(diff) {
  return diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).length
}

export function summarizeFiles(files, contractLines) {
  const counted = [...new Set(files)].filter((file) =>
    ['code', 'test'].includes(classifyFile(file)),
  )
  return {
    counted,
    contractChanged: contractLines > 0,
    size: sizeByRule(counted.length, contractLines > 0),
  }
}

const KIND_LABEL = { product: 'produto', outside: 'fora de história', covered: 'já é história' }

export function renderReport({
  since,
  until,
  frontier,
  generatedAt,
  pullRequests,
  decisions,
  cited,
}) {
  const lines = [
    '# Levantamento retroativo',
    '',
    `Gerado por \`tools/levantar-retroativo.mjs\` em ${generatedAt}: desde ${since}`,
    `(merge \`${frontier.slice(0, 7)}\`) até \`${until}\`. Nada aqui é agrupamento: o`,
    'esqueleto diz o que entrou, e quem decide as histórias é a redação.',
    '',
    '## Resumo',
    '',
  ]
  for (const kind of ['product', 'outside', 'covered']) {
    const prs = pullRequests.filter((pr) => pr.kind === kind).map((pr) => `#${pr.pr}`)
    lines.push(
      `- **${KIND_LABEL[kind]}:** ${prs.length}${prs.length ? ` — ${prs.join(', ')}` : ''}`,
    )
  }

  lines.push('', '## PRs', '')
  lines.push('| PR | Data | Branch | Classe | Registra | Código e teste | Contrato | Tamanho |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const pr of pullRequests) {
    const contract = pr.contractChanged ? 'sim' : '—'
    lines.push(
      `| #${pr.pr} | ${pr.date} | \`${pr.branch}\` | ${KIND_LABEL[pr.kind]} | ${pr.decisions.join(', ') || '—'} | ${pr.counted.length} | ${contract} | ${pr.size} |`,
    )
  }

  lines.push('', '## PRs de produto, em detalhe', '')
  for (const pr of pullRequests.filter((item) => item.kind === 'product')) {
    lines.push(`### #${pr.pr} · \`${pr.branch}\` · ${pr.date}`, '')
    for (const commit of pr.commits) {
      const extras = [
        commit.counted.length ? `${commit.counted.length} de código e teste` : null,
        commit.contractLines ? `contrato +${commit.contractLines}` : null,
        commit.decisions.length ? `registra ${commit.decisions.join(', ')}` : null,
        commit.cited.length ? `cita ${commit.cited.join(', ')}` : null,
      ].filter(Boolean)
      lines.push(
        `- \`${commit.sha.slice(0, 7)}\` ${commit.subject}${extras.length ? ` — ${extras.join(' · ')}` : ''}`,
      )
      for (const file of commit.counted) lines.push(`  - \`${file}\``)
    }
    lines.push('')
  }

  const pending = [...new Set(pullRequests.flatMap((pr) => pr.decisions))].filter(
    (id) => !cited.has(id),
  )
  lines.push('## Decisões registradas no intervalo e ainda sem história no backlog', '')
  if (pending.length === 0) lines.push('Nenhuma.')
  else {
    lines.push(
      '| Decisão | Data | Título | Custo declarado | PR | Classe do PR |',
      '|---|---|---|---|---|---|',
    )
    for (const id of pending) {
      const decision = decisions.get(id)
      const owners = pullRequests.filter((pr) => pr.decisions.includes(id))
      const prs = owners.map((pr) => `#${pr.pr}`).join(', ')
      const kinds = [...new Set(owners.map((pr) => KIND_LABEL[pr.kind]))].join(', ')
      lines.push(
        `| ${id} | ${decision?.date ?? '?'} | ${decision?.title ?? 'não achada na governança'} | ${decision?.cost ?? '—'} | ${prs} | ${kinds} |`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function isAncestor(commit, of) {
  try {
    git(['merge-base', '--is-ancestor', commit, of])
    return true
  } catch {
    return false
  }
}

function resolveFrontier(since, until) {
  if (/^[0-9a-f]{7,40}$/.test(since)) return git(['rev-parse', since]).trim()

  const heading = `### ${since} —`
  const written = git(['log', '--reverse', '--format=%H', '-S', heading, until, '--', BACKLOG])
    .split('\n')
    .find(Boolean)
  if (written === undefined) throw new Error(`o backlog em ${until} nunca teve "${heading}"`)

  const merges = git(['log', '--first-parent', '--merges', '--reverse', '--format=%H', until])
    .split('\n')
    .filter(Boolean)
  const frontier = merges.find((merge) => isAncestor(written, merge))
  if (frontier === undefined) throw new Error(`${since} não entrou na linha principal de ${until}`)
  return frontier
}

function describeCommit(sha, subject, body) {
  const files = git(['show', '--format=', '--name-only', sha]).split('\n').filter(Boolean)
  const contractLines = countAddedLines(
    git(['show', '--format=', '--unified=0', sha, '--', CONTRACT]),
  )
  const decisions = registeredDecisions(
    git(['show', '--format=', '--unified=0', sha, '--', GOVERNANCE]),
  )
  const cited = extractDecisions(`${subject}\n${body}`)
  return {
    sha,
    subject,
    files,
    contractLines,
    decisions,
    cited,
    ...summarizeFiles(files, contractLines),
  }
}

function collect(since, until) {
  const frontier = resolveFrontier(since, until)
  const merges = git([
    'log',
    '--first-parent',
    '--merges',
    '--reverse',
    '--date=short',
    // biome-ignore lint/security/noSecrets: formato do git log, nao credencial
    '--format=%H%x09%ad%x09%s',
    `${frontier}..${until}`,
  ])
    .split('\n')
    .filter(Boolean)

  const pullRequests = merges.flatMap((line) => {
    const [merge, date, subject] = line.split('\t')
    const parsed = parseMergeSubject(subject)
    if (parsed === null) return []
    const commits = git([
      'log',
      '--reverse',
      '--no-merges',
      // biome-ignore lint/security/noSecrets: formato do git log, nao credencial
      '--format=%H%x1f%s%x1f%b%x1e',
      `${merge}^1..${merge}^2`,
    ])
      .split('\x1e')
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => describeCommit(...record.split('\x1f')))
    const files = commits.flatMap((commit) => commit.files)
    const contractLines = commits.reduce((total, commit) => total + commit.contractLines, 0)
    return [
      {
        ...parsed,
        date,
        commits,
        kind: classifyPullRequest(parsed.branch, commits),
        decisions: extractDecisions(commits.flatMap((commit) => commit.decisions).join(' ')),
        ...summarizeFiles(files, contractLines),
      },
    ]
  })

  const backlog = readFileSync(join(ROOT, BACKLOG), 'utf8')
  return {
    frontier,
    pullRequests,
    decisions: parseDecisions(readFileSync(join(ROOT, GOVERNANCE), 'utf8')),
    cited: new Set(extractDecisions(backlog)),
  }
}

function sizeOf(shas) {
  const commits = shas.map((sha) => describeCommit(sha, '', ''))
  const files = commits.flatMap((commit) => commit.files)
  const contractLines = commits.reduce((total, commit) => total + commit.contractLines, 0)
  const summary = summarizeFiles(files, contractLines)
  console.log(`${summary.size} (${summary.counted.length} arquivos, contrato +${contractLines})`)
  for (const file of summary.counted) console.log(`  ${file}`)
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const shas = option('--tamanho')
  if (shas !== undefined) {
    sizeOf(shas.split(',').filter(Boolean))
  } else {
    const since = option('--desde')
    if (since === undefined) {
      console.error('uso: --desde H-NN|<sha> [--ate <ref>]  ou  --tamanho <sha>,<sha>')
      process.exit(1)
    }
    const until = option('--ate') ?? 'origin/main'
    const data = collect(since, until)
    const generatedAt = new Date().toISOString().slice(0, 10)
    mkdirSync(dirname(join(ROOT, OUTPUT)), { recursive: true })
    writeFileSync(join(ROOT, OUTPUT), renderReport({ since, until, generatedAt, ...data }))
    const product = data.pullRequests.filter((pr) => pr.kind === 'product').length
    console.log(`${data.pullRequests.length} PRs desde ${since}, ${product} de produto → ${OUTPUT}`)
  }
}
