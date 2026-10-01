import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Prende os numeros de estado atual da documentacao a fonte deles.
 *
 * Existe pelo levantamento de 01/10/2026: das 41 ocorrencias de estado atual que
 * citam uma contagem sobre o repositorio, seis estavam velhas — `09-rastreabilidade.md`
 * dizia 96 historias com 114 no backlog, o `README.md` dizia seis ADRs com sete em
 * `docs/adr/`, e duas pecas diziam "sete passos" com oito em `scripts.verify`. So o
 * total de historias tinha guarda, e por regex sobre uma forma de frase.
 *
 * Dois tipos de regiao:
 * - `conta`, numa linha so, entre `<!-- conta:NOME -->` e `<!-- /conta -->`: o valor
 *   entre os marcadores pertence a ferramenta, e `--write` o reescreve.
 * - `confere`, com os dois marcadores sozinhos na linha, em volta de conteudo escrito
 *   a mao — a arvore de `04-arquitetura.md` traz anotacao `# H-49` ao lado do arquivo
 *   e se perderia regenerada. A ferramenta so aponta a divergencia.
 *
 * `conta` em inicio de linha e erro: o CommonMark abre ali um bloco HTML, e o resto
 * da linha deixa de ser markdown. Marcador dentro de bloco cercado ou entre crases e
 * ignorado — e texto que documenta a sintaxe, e o GitHub o mostra literalmente.
 *
 * O que NAO faz: achar numero fora de regiao; reescrever regiao `confere`; contar
 * sobre codigo de `web/src/` — as tres ficaram fora por decisao de 01/10/2026.
 *
 * Uso, a partir da raiz do projeto:
 *   node tools/contar-documentacao.mjs            confere; sai com 1 se divergir
 *   node tools/contar-documentacao.mjs --write    reescreve as regioes `conta`
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IN_SCOPE = /^(?:docs\/.+|\.claude\/.+|README|CLAUDE)\.md$/

const BACKLOG = 'docs/06-backlog.md'
const TRACEABILITY = 'docs/09-rastreabilidade.md'
const STYLE_CORPUS = 'docs/estilizacao/corpus-estilo.md'

/** O `git` decide o que existe, e nao o disco: arquivo ignorado existe so na maquina de quem o tem. */
export function createSource(root) {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean)
  return {
    read: (path) => readFileSync(join(root, path), 'utf-8'),
    filesIn: (dir) =>
      tracked
        .filter((path) => dirname(path) === dir && !basename(path).startsWith('.'))
        .map((path) => basename(path)),
    scope: tracked.filter((path) => IN_SCOPE.test(path)),
  }
}

/** Cada historia vai do proprio titulo ao proximo titulo de nivel 2 ou 3. */
function stories(source) {
  return source
    .read(BACKLOG)
    .split(/^(?=### H-)/m)
    .slice(1)
    .map((chunk) => {
      const lines = chunk.split('\n')
      const end = lines.findIndex((line, index) => index > 0 && /^##/.test(line))
      const body = lines.slice(0, end === -1 ? undefined : end)
      return {
        number: Number(/^### H-(\d+)/.exec(body[0])[1]),
        closed: body.some((line) => line.startsWith('> ✅ **CONCLUÍDA')),
      }
    })
}

function distinct(text, regex) {
  return new Set([...text.matchAll(regex)].map((match) => match[1])).size
}

function section(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => heading.test(line))
  const level = /^#+/.exec(lines[start])[0].length
  const end = lines.findIndex(
    (line, index) => index > start && new RegExp(`^#{1,${level}} `).test(line),
  )
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n')
}

function mandatoryCases(source) {
  return section(source.read('docs/08-qualidade-operacao.md'), /^### 1\.3/)
    .split('\n')
    .filter((line) => /^\| (?!Caso-limite \||-)/.test(line))
}

function verifySteps(source) {
  return JSON.parse(source.read('package.json'))
    .scripts.verify.split('&&')
    .map((step) => step.trim().replace(/^npm (?:run )?/, ''))
}

/** O `|` final e opcional no GFM, e oito linhas de indicador nao o tem. */
const cellsOf = (rest) =>
  rest
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => index < cells.length - 1 || cell !== '')

/**
 * Colunas do corpus: ID, EIXO, PREDICADO, BALDE, SINAL, CONTRAEXEMPLO, FONTE, CUSTO.
 * O filtro compara pelo comeco: o balde DE EXECUCAO aparece como "EXECUÇÃO → estático
 * via §3.2" e "EXECUÇÃO → parcialmente estático", e a distribuicao declarada os soma.
 */
function styleRules(source, filter) {
  const rules = [...source.read(STYLE_CORPUS).matchAll(/^\| ([ACRD]\d\d) \|(.*)$/gm)].map(
    ([, id, rest]) => {
      const cells = cellsOf(rest)
      return { id, eixo: id[0], balde: cells[2], custo: cells.at(-1) }
    },
  )
  if (!filter) return rules
  const [field, value] = filter.split('=')
  return rules.filter((rule) => rule[field].startsWith(value))
}

/**
 * Colunas da §1: #, Indicador, Campos, Regra, Historias, Testes, Status. O status e a
 * setima, e nao a ultima: oito linhas trazem depois dele uma nota sem `|` final, e a
 * nota do IND-15 diz "APOSENTADO" enquanto a do IND-14 diz "REMOVIDO da tela".
 */
function indicatorRows(source) {
  return [...source.read(TRACEABILITY).matchAll(/^\| (IND-\d+) \|(.*)$/gm)].map(([, id, rest]) => ({
    id,
    status: cellsOf(rest)[5] ?? '',
  }))
}

export const COUNTERS = {
  historias: (source) => stories(source).length,
  'historias-concluidas': (source) => stories(source).filter((story) => story.closed).length,
  'historias-desde': (source, from) =>
    stories(source).filter((story) => story.number >= Number(from.slice(2))).length,
  epicos: (source) => (source.read(BACKLOG).match(/^## Épico /gm) ?? []).length,
  premissas: (source) => distinct(source.read('docs/00-visao-escopo.md'), /^\| *\*{0,2}(P-\d+)/gm),
  riscos: (source) => distinct(source.read('docs/07-plano-entrega.md'), /^#{3,4} (R-\d+)/gm),
  'casos-obrigatorios': (source) => mandatoryCases(source).length,
  'historias-com-caso-obrigatorio': (source) =>
    new Set(
      mandatoryCases(source)
        .map((row) => /\| (H-\d+) \|\s*$/.exec(row)?.[1])
        .filter(Boolean),
    ).size,
  achados: (source) =>
    distinct(
      source.read('docs/01-auditoria-especificacao.md'),
      /^(?:#{2,4} *|\| *\*{0,2})(A-\d+)/gm,
    ),
  'passos-verify': (source) => verifySteps(source).length,
  'passos-verify-lista': (source) =>
    verifySteps(source)
      .map((step) => `\`${step}\``)
      .join(', '),
  'regras-corpus': (source, filter) => styleRules(source, filter).length,
  'regras-corpus-faixa': (source, filter) => {
    const ids = styleRules(source, filter).map((rule) => rule.id)
    return `${ids[0]}–${ids.at(-1)}`
  },
  'indicadores-definidos': (source) => indicatorRows(source).length,
  'indicadores-ativos': (source) =>
    indicatorRows(source).filter((row) => !/Bloqueado|Aposentado/.test(row.status)).length,
  alertas: (source) => distinct(source.read(TRACEABILITY), /^\| (ALE-\d+) \|/gm),
  'chaves-de-cor': (source) => JSON.parse(source.read('config/color-map.json')).entries.length,
  adrs: (source) => source.filesIn('docs/adr').filter((name) => name.endsWith('.md')).length,
  'pendencias-abertas': (source) =>
    distinct(
      section(source.read('CLAUDE.md'), /^### Pendências abertas/),
      /^\| \*\*(PD-\d+)\*\*/gm,
    ),
  'arvore-src': (source) =>
    ['src/domain', 'src/io', 'src/app', 'src/http', 'src/http/routes']
      .map((dir) => source.filesIn(dir).length)
      .join(' · '),
}

export const CHECKS = {
  arvore: checkTree,
}

const formatValue = (value) => (typeof value === 'number' ? value.toLocaleString('pt-BR') : value)

/** `nome` ou `nome[argumento]` — o argumento vai para o contador como texto. */
function parseName(raw) {
  const match = /^([a-z0-9-]+)(?:\[([^\]]*)\])?$/.exec(raw)
  return match ? { name: match[1], arg: match[2] } : null
}

const NAME = String.raw`[a-z0-9-]+(?:\[[^\]]*\])?`
const INLINE = new RegExp(String.raw`<!-- conta:(${NAME}) -->(.*?)<!-- \/conta -->`, 'g')
const BLOCK_OPEN = new RegExp(`^<!-- confere:(${NAME}) -->$`)
const BLOCK_CLOSE = /^<!-- \/confere -->$/
const STRAY = /<!-- \/?(?:conta|confere)\b/
const FENCE = /^\s*(```|~~~)/

const insideInlineCode = (line, index) => (line.slice(0, index).match(/`/g) ?? []).length % 2 === 1

/**
 * Le as regioes de um arquivo sem avaliar nenhuma. Devolve `conta` e `confere` com a
 * linha (base 1), e os erros de estrutura — o que impede saber o que a regiao diz.
 */
export function scanRegions(text) {
  const lines = text.split('\n')
  const counts = []
  const checks = []
  const errors = []
  let fenced = false
  let open = null

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    if (FENCE.test(line)) {
      fenced = !fenced
      if (open) open.body.push(line)
      return
    }
    if (fenced) {
      if (open) open.body.push(line)
      return
    }

    const blockOpen = BLOCK_OPEN.exec(line)
    if (blockOpen) {
      if (open)
        errors.push({
          line: lineNumber,
          message: `confere aberto dentro de outro, aberto na linha ${open.line}`,
        })
      open = { line: lineNumber, raw: blockOpen[1], body: [] }
      return
    }
    if (BLOCK_CLOSE.test(line)) {
      if (open) checks.push(open)
      else errors.push({ line: lineNumber, message: 'fechamento de confere sem abertura' })
      open = null
      return
    }
    if (open) open.body.push(line)

    let unmatched = line
    for (const match of line.matchAll(INLINE)) {
      unmatched = unmatched.replace(match[0], '')
      if (insideInlineCode(line, match.index)) continue
      if (match.index === 0) {
        errors.push({
          line: lineNumber,
          message:
            'conta no inicio da linha: o CommonMark abre bloco HTML e o resto da linha deixa de ser markdown',
        })
        continue
      }
      counts.push({ line: lineNumber, raw: match[1], written: match[2] })
    }
    const stray = STRAY.exec(unmatched)
    if (stray && !insideInlineCode(unmatched, stray.index)) {
      errors.push({
        line: lineNumber,
        message: 'marcador sem par, fora de lugar ou com nome invalido',
      })
    }
  })

  if (open) errors.push({ line: open.line, message: 'confere sem fechamento' })
  return { counts, checks, errors }
}

/**
 * Le uma arvore desenhada com `├─`, `└─` e `│`, em degraus de tres caracteres. Cada
 * entrada sai com o caminho completo e a anotacao depois do `#`, se houver.
 */
export function parseTree(lines) {
  const entries = []
  const parents = []
  for (const line of lines) {
    const match = /^((?:│ {2}| {3})*)[├└]─ (\S+)\s*(?:#\s*(.*))?$/.exec(line)
    if (!match) continue
    const depth = match[1].length / 3
    parents.length = depth
    entries.push({ path: parents.join('') + match[2], annotation: match[3]?.trim() ?? null })
    if (match[2].endsWith('/')) parents[depth] = match[2]
  }
  return entries
}

/**
 * Para cada diretorio pedido: se a arvore lista os arquivos dele, a lista tem de ser
 * a do `git`; se so anota "N arquivos", o N tem de ser a contagem.
 */
function checkTree(source, arg, body) {
  const entries = parseTree(body)
  const problems = []
  for (const dir of (arg ?? '').split(/\s+/).filter(Boolean)) {
    const actual = source.filesIn(dir)
    const listed = entries
      .filter((entry) => dirname(entry.path) === dir && !entry.path.endsWith('/'))
      .map((entry) => basename(entry.path))
    const node = entries.find((entry) => entry.path === `${dir}/`)
    const annotated = /^(\d+) arquivos/.exec(node?.annotation ?? '')
    if (listed.length > 0) {
      const missing = actual.filter((name) => !listed.includes(name))
      const extra = listed.filter((name) => !actual.includes(name))
      if (missing.length > 0) problems.push(`${dir}: falta na arvore ${missing.join(', ')}`)
      if (extra.length > 0)
        problems.push(`${dir}: a arvore lista o que nao existe: ${extra.join(', ')}`)
    } else if (annotated) {
      if (Number(annotated[1]) !== actual.length)
        problems.push(`${dir}: anotado ${annotated[1]}, real ${actual.length}`)
    } else {
      problems.push(`${dir}: a arvore nao lista nem anota este diretorio`)
    }
  }
  return problems
}

function evaluate(registry, source, raw, ...rest) {
  const parsed = parseName(raw)
  if (!parsed || !(parsed.name in registry)) return { error: `nome desconhecido: ${raw}` }
  try {
    return { value: registry[parsed.name](source, parsed.arg, ...rest) }
  } catch (error) {
    return { error: `${raw} falhou: ${error.message}` }
  }
}

/** Confere todas as regioes do escopo. Nao escreve nada. */
export function inspect(root) {
  const source = createSource(root)
  const divergences = []
  const errors = []
  for (const file of source.scope) {
    const scanned = scanRegions(source.read(file))
    for (const error of scanned.errors) errors.push({ file, ...error })
    for (const region of scanned.counts) {
      const result = evaluate(COUNTERS, source, region.raw)
      if (result.error) errors.push({ file, line: region.line, message: result.error })
      else if (formatValue(result.value) !== region.written) {
        divergences.push({
          file,
          line: region.line,
          name: region.raw,
          written: region.written,
          actual: formatValue(result.value),
        })
      }
    }
    for (const region of scanned.checks) {
      const result = evaluate(CHECKS, source, region.raw, region.body)
      if (result.error) errors.push({ file, line: region.line, message: result.error })
      for (const problem of result.value ?? []) {
        divergences.push({
          file,
          line: region.line,
          name: `confere:${region.raw}`,
          written: null,
          actual: problem,
        })
      }
    }
  }
  return { divergences, errors }
}

/** Reescreve as regioes `conta` que divergem e devolve os arquivos alterados. `confere` fica. */
export function rewrite(root) {
  const source = createSource(root)
  const changed = []
  for (const file of source.scope) {
    const text = source.read(file)
    const valid = new Set(scanRegions(text).counts.map((region) => `${region.line}:${region.raw}`))
    const next = text
      .split('\n')
      .map((line, index) =>
        line.replace(INLINE, (whole, raw) => {
          if (!valid.has(`${index + 1}:${raw}`)) return whole
          const result = evaluate(COUNTERS, source, raw)
          return result.error
            ? whole
            : `<!-- conta:${raw} -->${formatValue(result.value)}<!-- /conta -->`
        }),
      )
      .join('\n')
    if (next !== text) {
      writeFileSync(join(root, file), next)
      changed.push(file)
    }
  }
  return changed
}

function main() {
  const write = process.argv.includes('--write')
  if (write) {
    const changed = rewrite(ROOT)
    console.log(changed.length > 0 ? `reescritos:\n  ${changed.join('\n  ')}` : 'nada a reescrever')
  }
  const { divergences, errors } = inspect(ROOT)
  for (const { file, line, message } of errors) console.error(`${file}:${line}  ERRO  ${message}`)
  for (const { file, line, name, written, actual } of divergences) {
    console.error(
      written === null
        ? `${file}:${line}  ${name}  ${actual}`
        : `${file}:${line}  ${name}  escrito "${written}", real "${actual}"`,
    )
  }
  if (errors.length > 0 || divergences.length > 0) {
    const fixable = divergences.some((divergence) => divergence.written !== null)
    if (fixable && !write)
      console.error(
        '\nas regioes conta se corrigem com: node tools/contar-documentacao.mjs --write',
      )
    process.exit(1)
  }
  console.log('regioes conferidas: nenhuma divergencia')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
