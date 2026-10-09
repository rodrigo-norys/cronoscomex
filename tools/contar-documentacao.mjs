import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import config from './contar-documentacao.config.mjs'

/**
 * Prende os numeros de estado atual da documentacao a fonte deles.
 *
 * Existe pelo levantamento de 01/10/2026: das 41 ocorrencias de estado atual que
 * citam uma contagem sobre o repositorio, seis estavam velhas — `09-rastreabilidade.md`
 * dizia 96 historias com 114 no backlog, o `README.md` dizia seis ADRs com sete em
 * `docs/adr/`, e duas pecas diziam "sete passos" com oito em `scripts.verify`. So o
 * total de historias tinha guarda, e por regex sobre uma forma de frase.
 *
 * Este arquivo e o mecanismo; o que e do projeto esta em `contar-documentacao.config.mjs`,
 * e o cabecalho dela diz o que entra la.
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
 * Espelho de estado e o mesmo ID com estado em dois documentos, declarado na
 * configuracao com o lado-fonte e o lado-copia. A conferencia reprova o ID cujo estado
 * difere, o que falta de um lado sem significado declarado, e o lado que nao passa do
 * piso: o padrao que parou de casar deixaria a guarda verde por vacuidade.
 *
 * `--nuas` aponta o numero com unidade escrito FORA de regiao — "sete passos", "18
 * epicos" — nas linhas que o diff contra a base acrescentou. So avisa, e nunca reprova:
 * medido em 06/10/2026, a varredura completa achou 260 numeros, e a classificacao a mao
 * deu ~47% de falso positivo mesmo depois das regras estruturais abaixo. No diff de
 * seis PRs recentes foram de 0 a 13 avisos, ~6 em 10 verdadeiros — e o #150 teria
 * apontado as copias de "114 historias" que o #153 precisou prender em regiao depois.
 * O que NAO e apontado, por estrutura, sem marcacao no documento: bloco cercado,
 * titulo, regiao, trecho entre crases, linha com data ou "medido", limite de formato
 * ("no maximo 3 linhas"), e o que a configuracao declara registro.
 *
 * `--pares` lista, para cada ID cuja DEFINICAO o diff mudou — a linha de tabela que
 * abre com ele, ou o titulo `### H-NN` e `## Épico ENN` —, os outros blocos que o
 * citam: e neles que o fato que acabou de mudar pode ter ficado para tras. Historia
 * fechada no diff traz junto o epico dela. So avisa. Medido sobre os 68 PRs de #100 a
 * #168: a lista tem mediana de 5 blocos e p90 de 30, e 30 PRs nao geram lista; em cinco
 * PRs de origem, achou 22 dos 24 lugares que de fato envelheceram — os aposentados de
 * `D-49` vivos na `02` e na §3 da `09`, e o estado dos epicos copiado no `07`. Tomar a
 * chave de todo bloco alterado achava os 24, com lista mediana de 138. Nao sao alvo: o
 * proprio diff, o bloco cercado, que e exemplo, o titulo que define a chave, e o
 * registro. O que NAO alcanca: fato sem ID — a contagem fica com o `--nuas`, o resto
 * com a revisao —, a lista que devia ganhar um item novo, e o codigo.
 *
 * `--definicoes` conta, para cada ID citado no escopo, os lugares que o definem — a
 * linha de tabela que abre com ele, ou o titulo de nivel 1 a 4 —, e lista o ID sem
 * definicao e o definido em mais de um lugar, menos os dois lados de um espelho. So
 * relata. Citacao entre crases so vale quando a crase e o proprio ID: `D0 CF 11 E0` sao
 * bytes, e `~$E30.xlsx` e um arquivo.
 *
 * O que NAO faz: reescrever regiao `confere`; contar sobre codigo de `web/src/` — as
 * duas ficaram fora por decisao de 01/10/2026; avisar pela idade de uma medicao da
 * planilha — um terco das afirmacoes nao tem data, e o gatilho real e a aba `2027`.
 *
 * Uso, a partir da raiz do projeto:
 *   node tools/contar-documentacao.mjs                   confere regioes e espelhos; 1 se divergir
 *   node tools/contar-documentacao.mjs --write           reescreve as regioes `conta`
 *   node tools/contar-documentacao.mjs --nuas            avisa no diff contra a `main`
 *   node tools/contar-documentacao.mjs --nuas --base X   avisa no diff contra `X`
 *   node tools/contar-documentacao.mjs --nuas --tudo     avisa nos documentos inteiros
 *   node tools/contar-documentacao.mjs --pares           pares no diff contra a `main`
 *   node tools/contar-documentacao.mjs --pares --base X  pares no diff contra `X`
 *   node tools/contar-documentacao.mjs --definicoes      onde cada ID citado e definido
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IN_SCOPE = config.scope
const COUNTERS = config.counters

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
    tracked,
  }
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
  // Arquivo em CRLF deixa um `\r` final que quebrava o `$` dos marcadores de bloco: o
  // `verify-windows` do PR #153 reprovou assim a arvore de `04-arquitetura.md`, antes de o
  // `.gitattributes` fixar LF no checkout. A tolerancia fica para CRLF vindo de editor.
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''))
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

/**
 * O nivel de titulo de cada linha (base 0), e zero fora de titulo. Linha de bloco cercado
 * nao e titulo: o comentario `# ...` de um exemplo em shell cortaria a secao no meio.
 */
function headingLevels(lines) {
  let fenced = false
  return lines.map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced
      return 0
    }
    return fenced ? 0 : (/^(#{1,6}) /.exec(line)?.[1].length ?? 0)
  })
}

/** Onde termina o titulo da linha `start`: no proximo de nivel igual ou acima, exclusivo. */
function sectionEnd(levels, start) {
  const end = levels.findIndex(
    (level, index) => index > start && level > 0 && level <= levels[start],
  )
  return end === -1 ? levels.length : end
}

/** As linhas (base 0, fim exclusivo) da secao cujo titulo casa `heading`; sem ele, o arquivo. */
function sectionSpan(lines, levels, heading) {
  if (!heading) return { start: 0, end: lines.length }
  const start = lines.findIndex((line, index) => levels[index] > 0 && heading.test(line))
  return start === -1 ? null : { start: start + 1, end: sectionEnd(levels, start) }
}

const linesOf = (text) => text.split('\n').map((line) => line.replace(/\r$/, ''))

/** Um lado do espelho: cada ID com a linha (base 1) e o estado, e o ID repetido a parte. */
function readMirrorSide(source, family, side) {
  if (!source.tracked.includes(side.file)) return { error: 'arquivo fora do git' }
  const lines = linesOf(source.read(side.file))
  const levels = headingLevels(lines)
  const span = sectionSpan(lines, levels, side.section)
  if (!span) return { error: `secao nao encontrada: ${side.section}` }
  const heading = new RegExp(String.raw`^#{1,6} (${family})\b`)
  const cited = new RegExp(String.raw`\b(?:${family})\b`, 'g')
  const entries = new Map()
  const repeated = []
  const add = (id, index, text) => {
    if (entries.has(id)) repeated.push({ id, line: index + 1 })
    else entries.set(id, { line: index + 1, state: side.state(text) })
  }
  let fenced = false
  for (let index = span.start; index < span.end; index++) {
    const line = lines[index]
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    if (side.entries === 'headings') {
      const id = levels[index] > 0 ? heading.exec(line)?.[1] : undefined
      const end = Math.min(sectionEnd(levels, index), span.end)
      if (id) add(id, index, lines.slice(index, end).join('\n'))
    } else if (line.startsWith('|')) {
      for (const [id] of (line.split('|')[1] ?? '').matchAll(cited)) add(id, index, line)
    }
  }
  return { entries, repeated }
}

/**
 * Confere os espelhos de estado: o ID com estados diferentes nos dois lados, o que falta
 * de um lado quando faltar nao tem significado declarado, o repetido, e o lado que nao
 * passou do piso — o padrao que parou de casar deixaria a guarda verde por vacuidade.
 */
export function checkMirrors(source, mirrors, floors = {}) {
  const problems = []
  const report = (name, file, line, message) =>
    problems.push({ file, line, guard: `espelho:${name}`, message })
  for (const mirror of mirrors) {
    const sides = { source: mirror.source, copy: mirror.copy }
    const read = {}
    for (const [role, side] of Object.entries(sides)) {
      read[role] = readMirrorSide(source, mirror.family, side)
      if (read[role].error) {
        report(mirror.name, side.file, 0, read[role].error)
        continue
      }
      for (const { id, line } of read[role].repeated)
        report(mirror.name, side.file, line, `${id} repetido neste lado do espelho`)
      const floor = floors[mirror.name]?.[role]
      const count = read[role].entries.size
      if (floor !== undefined && count <= floor)
        report(mirror.name, side.file, 0, `leu ${count} ID(s), e o piso e ${floor}`)
    }
    if (read.source.error || read.copy.error) continue

    for (const id of new Set([...read.source.entries.keys(), ...read.copy.entries.keys()])) {
      const found = { source: read.source.entries.get(id), copy: read.copy.entries.get(id) }
      const states = {}
      let compare = true
      for (const [role, other] of [
        ['source', 'copy'],
        ['copy', 'source'],
      ]) {
        if (found[role]) states[role] = found[role].state
        else if (sides[role].absent === 'ignore') compare = false
        else if (sides[role].absent !== undefined) states[role] = sides[role].absent
        else {
          report(
            mirror.name,
            sides[other].file,
            found[other].line,
            `${id} falta em ${sides[role].file}`,
          )
          compare = false
        }
      }
      if (!compare || states.source === states.copy) continue
      const say = (role) =>
        found[role]
          ? `${sides[role].file}:${found[role].line} diz "${states[role]}"`
          : `${sides[role].file} nao o lista, e isso diz "${states[role]}"`
      const at = found.copy ? 'copy' : 'source'
      report(mirror.name, sides[at].file, found[at].line, `${id}: ${say('copy')}; ${say('source')}`)
    }
  }
  return problems
}

/** As guardas de estrutura, alem das regioes: espelho de estado, com o piso de cada lado. */
export function inspectStructure(
  root,
  { mirrors = config.ids.mirrors, floors = config.floors } = {},
) {
  const source = createSource(root)
  return { problems: checkMirrors(source, mirrors, floors.mirrors) }
}

const RECORD_FILES = config.record.files
const RECORD_LINE = config.record.line
const CLOSED_BLOCKS = config.record.closedBlocks
const {
  numberWords: NUMBER_WORDS,
  units: UNITS,
  dated: DATED,
  formatLimit: FORMAT_LIMIT,
} = config.language
// O numero, no maximo uma palavra entre ele e a unidade — "649 linhas", "seis campos
// novos", "18 **épicos**" —, e negrito em volta de qualquer parte.
const LOOSE = new RegExp(
  String.raw`(?<![\w.\-/:#°§])(\d{1,3}(?:\.\d{3})+|\d+|${NUMBER_WORDS.join('|')})(?:\*\*)?(?:\s+(?:\*\*)?[\wÀ-ú-]+(?:\*\*)?)?\s+(?:\*\*)?(${UNITS.join('|')})\b`,
  'giu',
)
/** Os numeros soltos de um arquivo; com `onlyLines`, so nas linhas (base 1) do conjunto. */
export function looseNumbers(file, text, onlyLines) {
  if (RECORD_FILES.test(file)) return []
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''))
  const closed = file === CLOSED_BLOCKS.file ? CLOSED_BLOCKS.lines(lines) : new Set()
  const found = []
  let fenced = false
  lines.forEach((raw, index) => {
    if (FENCE.test(raw)) {
      fenced = !fenced
      return
    }
    if (fenced || (onlyLines && !onlyLines.has(index + 1))) return
    if (/^#{1,6} /.test(raw) || closed.has(index) || RECORD_LINE.test(raw) || DATED.test(raw))
      return
    const clean = raw.replace(new RegExp(INLINE.source, 'g'), ' ').replace(/`[^`]*`/g, ' ')
    for (const match of clean.matchAll(LOOSE)) {
      if (FORMAT_LIMIT.test(clean.slice(Math.max(0, match.index - 25), match.index))) continue
      found.push({ file, line: index + 1, number: match[1], unit: match[2], text: raw.trim() })
    }
  })
  return found
}

/**
 * Linhas acrescentadas desde o ponto em que a arvore saiu de `base`, incluindo o que
 * ainda nao foi commitado, e os arquivos novos nao rastreados por inteiro.
 */
export function changedLines(root, base) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf-8' })
  const forkPoint = git('merge-base', base, 'HEAD').trim()
  const changed = new Map()
  let file = null
  for (const line of git(
    'diff',
    '-U0',
    '--no-color',
    '--no-ext-diff',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    forkPoint,
  ).split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6) : null
      continue
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk || !file || !IN_SCOPE.test(file)) continue
    if (!changed.has(file)) changed.set(file, new Set())
    const start = Number(hunk[1])
    for (let i = 0; i < Number(hunk[2] ?? 1); i++) changed.get(file).add(start + i)
  }
  for (const path of git('ls-files', '--others', '--exclude-standard').split('\n')) {
    if (IN_SCOPE.test(path)) changed.set(path, null)
  }
  return changed
}

/** Os numeros soltos do escopo: no diff contra `base`, ou em tudo com `all`. */
export function findLooseNumbers(root, { base = 'main', all = false } = {}) {
  const source = createSource(root)
  if (all) return source.scope.flatMap((file) => looseNumbers(file, source.read(file)))
  return [...changedLines(root, base)].flatMap(([file, lines]) =>
    looseNumbers(file, readFileSync(join(root, file), 'utf-8'), lines ?? undefined),
  )
}

const PAIR_CITATION = new RegExp(String.raw`\b(?:${config.ids.pattern})\b`, 'g')
const PAIR_DEFINITION_ROW = config.ids.definitionRow
const PAIR_DEFINITION_HEADING = config.ids.definitionHeading
const CLOSED_STORY = config.ids.closedStory
const PAIR_RECORD_LINE = config.record.pairLine

/** Os blocos de um arquivo, base 1: paragrafo, linha de tabela, item de lista, titulo, bloco cercado. */
export function blocks(lines) {
  const found = []
  let start = -1
  let fenced = false
  let fencedBlock = false
  const close = (end) => {
    if (start >= 0) found.push({ start: start + 1, end, fenced: fencedBlock })
    start = -1
    fencedBlock = false
  }
  lines.forEach((line, index) => {
    if (FENCE.test(line)) {
      if (!fenced) {
        close(index)
        start = index
        fencedBlock = true
      }
      fenced = !fenced
      if (!fenced) close(index + 1)
      return
    }
    if (fenced) return
    if (line.trim() === '') {
      close(index)
      return
    }
    const previous = lines[index - 1] ?? ''
    const opens = line.startsWith('|') || /^#{1,6} /.test(line) || /^\s*(?:[-*]|\d+\.) /.test(line)
    if (opens || previous.startsWith('|') || /^#{1,6} /.test(previous)) close(index)
    if (start < 0) start = index
  })
  close(lines.length)
  return found
}

/**
 * As citacoes de ID numa linha. Dentro de crases, so a crase que e o proprio ID cita:
 * `H-35` cita; `D0 CF 11 E0 A1 B1` e `~$E30.xlsx` sao bytes e nome de arquivo.
 */
function citationsIn(line) {
  const spans = [...line.matchAll(/`[^`]*`/g)].map((span) => ({
    start: span.index,
    end: span.index + span[0].length,
    text: span[0].slice(1, -1).trim(),
  }))
  return [...line.matchAll(PAIR_CITATION)].filter((match) => {
    const span = spans.find(({ start, end }) => match.index > start && match.index < end)
    return !span || span.text === match[0]
  })
}

/** O epico de cada historia que o diff fechou, com a linha do fechamento: o estado dele pode ter mudado. */
function epicsOfClosedStories(lines, isChanged) {
  const epics = new Map()
  let epic = null
  lines.forEach((line, index) => {
    epic = CLOSED_STORY.epic.exec(line)?.[1] ?? epic
    if (epic && CLOSED_STORY.closed.test(line) && isChanged(index + 1)) epics.set(epic, index + 1)
  })
  return epics
}

/**
 * Para cada ID cuja definicao o diff contra `base` mudou, os outros blocos que o citam.
 * Bloco alterado no proprio diff, bloco cercado e registro nao sao alvo.
 */
export function findPairs(root, { base = 'main' } = {}) {
  const source = createSource(root)
  const changed = changedLines(root, base)
  const parsed = new Map()
  for (const file of new Set([...source.scope, ...changed.keys()])) {
    const lines = source
      .read(file)
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
    const closed = file === CLOSED_BLOCKS.file ? CLOSED_BLOCKS.lines(lines) : new Set()
    parsed.set(file, { lines, blocks: blocks(lines), closed })
  }

  const keys = new Map()
  const touched = new Set()
  const define = (key, where) => keys.set(key, [...(keys.get(key) ?? []), where])
  for (const [file, set] of changed) {
    const info = parsed.get(file)
    if (!info) continue
    const isChanged = (line) => set === null || set.has(line)
    for (const block of info.blocks) {
      let hit = false
      for (let line = block.start; line <= block.end && !hit; line++) hit = isChanged(line)
      if (!hit) continue
      touched.add(`${file}:${block.start}`)
      if (block.fenced) continue
      for (const pattern of [PAIR_DEFINITION_ROW, PAIR_DEFINITION_HEADING]) {
        const key = pattern.exec(info.lines[block.start - 1])?.[1]
        if (key) define(key, `${file}:${block.start}`)
      }
    }
    if (file === CLOSED_STORY.file)
      for (const [epic, line] of epicsOfClosedStories(info.lines, isChanged))
        define(epic, `${file}:${line}`)
  }

  const citations = []
  for (const [file, info] of parsed) {
    if (RECORD_FILES.test(file)) continue
    for (const block of info.blocks) {
      if (block.fenced || touched.has(`${file}:${block.start}`)) continue
      if (info.closed.has(block.start - 1)) continue
      const text = info.lines.slice(block.start - 1, block.end)
      if (text.some((line) => PAIR_RECORD_LINE.test(line))) continue
      const ownHeading = PAIR_DEFINITION_HEADING.exec(text[0] ?? '')?.[1]
      text.forEach((line, offset) => {
        for (const match of citationsIn(line)) {
          if (match[0] === ownHeading) continue
          citations.push({
            key: match[0],
            file,
            line: block.start + offset,
            block: block.start,
            text: line,
          })
        }
      })
    }
  }

  return [...keys].map(([key, definedAt]) => {
    const seen = new Set()
    const citedBy = citations
      .filter((citation) => citation.key === key)
      .filter(
        (citation) =>
          !seen.has(`${citation.file}:${citation.block}`) &&
          seen.add(`${citation.file}:${citation.block}`),
      )
      .map(({ file, line, text }) => ({ file, line, text: text.trim() }))
    return { key, definedAt, citedBy }
  })
}

/**
 * Onde cada ID citado no escopo e definido: a linha de tabela que abre com ele, ou o
 * titulo. Sem definicao, a citacao nao tem para onde apontar; com duas ou mais, o mesmo
 * fato vive em dois lugares e pode divergir entre eles — menos quando sao os dois lados
 * de um espelho declarado, que a guarda do `--check` confere.
 */
export function findDefinitions(root, { mirrors = config.ids.mirrors } = {}) {
  const source = createSource(root)
  const citedAt = new Map()
  const definedAt = new Map()
  for (const file of source.scope) {
    let fenced = false
    source
      .read(file)
      .split('\n')
      .forEach((raw, index) => {
        const line = raw.replace(/\r$/, '')
        if (FENCE.test(line)) {
          fenced = !fenced
          return
        }
        if (fenced) return
        const at = `${file}:${index + 1}`
        for (const [id] of citationsIn(line)) if (!citedAt.has(id)) citedAt.set(id, at)
        for (const pattern of [PAIR_DEFINITION_ROW, PAIR_DEFINITION_HEADING]) {
          const id = pattern.exec(line)?.[1]
          if (id) definedAt.set(id, [...(definedAt.get(id) ?? []), at])
        }
      })
  }
  const spans = mirrors.map((mirror) => ({
    name: mirror.name,
    family: new RegExp(`^(?:${mirror.family})$`),
    sides: [mirror.source, mirror.copy].map((side) => {
      if (!source.tracked.includes(side.file)) return { file: side.file, start: 0, end: 0 }
      const lines = linesOf(source.read(side.file))
      const span = sectionSpan(lines, headingLevels(lines), side.section)
      return { file: side.file, ...(span ?? { start: 0, end: 0 }) }
    }),
  }))
  const inside = (at, side) => {
    const line = Number(at.slice(at.lastIndexOf(':') + 1))
    return at.startsWith(`${side.file}:`) && line > side.start && line <= side.end
  }
  const mirrorOf = (id, places) => {
    if (places.length !== 2) return null
    const [first, second] = places
    const mirror = spans.find(
      ({ family, sides: [one, other] }) =>
        family.test(id) &&
        ((inside(first, one) && inside(second, other)) ||
          (inside(first, other) && inside(second, one))),
    )
    return mirror?.name ?? null
  }
  return [...citedAt]
    .map(([id, at]) => ({
      id,
      family: /^[A-Z]+/.exec(id)[0],
      citedAt: at,
      definedAt: definedAt.get(id) ?? [],
      mirror: mirrorOf(id, definedAt.get(id) ?? []),
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
}

function reportDefinitions() {
  const found = findDefinitions(ROOT)
  const families = new Map()
  for (const { family, definedAt, mirror } of found) {
    const row = families.get(family) ?? { cited: 0, none: 0, one: 0, many: 0, mirrored: 0 }
    row.cited++
    if (definedAt.length === 0) row.none++
    else if (definedAt.length === 1) row.one++
    else if (mirror) row.mirrored++
    else row.many++
    families.set(family, row)
  }
  console.log('familia  citados      0      1     2+ espelho')
  for (const [family, row] of [...families].sort(([a], [b]) => a.localeCompare(b))) {
    const cells = [row.cited, row.none, row.one, row.many, row.mirrored]
    console.log(`${family.padEnd(7)} ${cells.map((n) => String(n).padStart(6)).join(' ')}`)
  }
  const none = found.filter((entry) => entry.definedAt.length === 0)
  const many = found.filter((entry) => entry.definedAt.length > 1 && !entry.mirror)
  if (none.length > 0) console.log('\nsem definicao — a citacao nao tem para onde apontar:')
  for (const { id, citedAt } of none) console.log(`  ${id}  citado em ${citedAt}`)
  if (many.length > 0)
    console.log('\ndefinido em mais de um lugar — o fato pode divergir entre eles:')
  for (const { id, definedAt } of many) console.log(`  ${id}  ${definedAt.join(', ')}`)
  console.log(
    `\n${found.length} ID(s) citado(s), ${none.length} sem definicao, ${many.length} com mais de uma fora de espelho — relatorio, nao reprovacao.`,
  )
}

function reportPairs() {
  const baseIndex = process.argv.indexOf('--base')
  const base = baseIndex === -1 ? 'main' : process.argv[baseIndex + 1]
  const pairs = findPairs(ROOT, { base })
  let total = 0
  for (const { key, definedAt, citedBy } of pairs.filter((pair) => pair.citedBy.length > 0)) {
    console.log(`${key} — definicao alterada em ${definedAt.join(', ')}`)
    for (const { file, line, text } of citedBy) {
      const at = Math.max(0, text.indexOf(key) - 50)
      console.log(`  ${file}:${line}  ${at > 0 ? '…' : ''}${text.slice(at, at + 130)}`)
    }
    console.log('')
    total += citedBy.length
  }
  console.log(
    `${pairs.length} chave(s) com definicao alterada no diff contra ${base}, ${total} bloco(s) que as citam — aviso, nao reprovacao.`,
  )
  if (total > 0)
    console.log(
      'Para cada bloco: ainda diz a verdade depois da mudanca? Se nao, corrija antes do commit.',
    )
}

function reportLoose() {
  const all = process.argv.includes('--tudo')
  const baseIndex = process.argv.indexOf('--base')
  const base = baseIndex === -1 ? 'main' : process.argv[baseIndex + 1]
  const found = findLooseNumbers(ROOT, { base, all })
  for (const { file, line, number, unit, text } of found)
    console.log(`${file}:${line}  [${number} ${unit}]  ${text.slice(0, 140)}`)
  console.log(
    `\n${found.length} numero(s) solto(s) ${all ? 'nos documentos' : `no diff contra ${base}`} — aviso, nao reprovacao.` +
      '\nEstado atual: prenda numa regiao `conta`, ou diga a data da medicao. Registro: ignore.',
  )
}

function main() {
  if (process.argv.includes('--definicoes')) return reportDefinitions()
  if (process.argv.includes('--pares')) return reportPairs()
  if (process.argv.includes('--nuas')) return reportLoose()
  const write = process.argv.includes('--write')
  if (write) {
    const changed = rewrite(ROOT)
    console.log(changed.length > 0 ? `reescritos:\n  ${changed.join('\n  ')}` : 'nada a reescrever')
  }
  const { divergences, errors } = inspect(ROOT)
  const { problems } = inspectStructure(ROOT)
  for (const { file, line, message } of errors) console.error(`${file}:${line}  ERRO  ${message}`)
  for (const { file, line, name, written, actual } of divergences) {
    console.error(
      written === null
        ? `${file}:${line}  ${name}  ${actual}`
        : `${file}:${line}  ${name}  escrito "${written}", real "${actual}"`,
    )
  }
  for (const { file, line, guard, message } of problems)
    console.error(`${line ? `${file}:${line}` : file}  ${guard}  ${message}`)
  if (errors.length > 0 || divergences.length > 0 || problems.length > 0) {
    const fixable = divergences.some((divergence) => divergence.written !== null)
    if (fixable && !write)
      console.error(
        '\nas regioes conta se corrigem com: node tools/contar-documentacao.mjs --write',
      )
    if (problems.length > 0)
      console.error(`\na estrutura se corrige no documento, pela regra de ${config.rule}`)
    process.exit(1)
  }
  console.log('regioes e estrutura conferidas: nenhuma divergencia')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
