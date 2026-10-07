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
 * `--nuas` aponta o numero com unidade escrito FORA de regiao — "sete passos", "18
 * epicos" — nas linhas que o diff contra a base acrescentou. So avisa, e nunca reprova:
 * medido em 06/10/2026, a varredura completa achou 260 numeros, e a classificacao a mao
 * deu ~47% de falso positivo mesmo depois das regras estruturais abaixo. No diff de
 * seis PRs recentes foram de 0 a 13 avisos, ~6 em 10 verdadeiros — e o #150 teria
 * apontado as copias de "114 historias" que o #153 precisou prender em regiao depois.
 * O que NAO e apontado, por estrutura, sem marcacao no documento: bloco cercado,
 * titulo, regiao, trecho entre crases, linha com data ou "medido", linha de matriz
 * `✅ **Concluida`, item de indice terminado em `✅`, decisao `| D-NN`, "plano
 * original", limite de formato ("no maximo 3 linhas"), historia fechada inteira e
 * epico com todas as historias fechadas, e os arquivos de registro. A
 * `00-visao-escopo.md` NAO e registro: mistura a especificacao com o escopo vigente.
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
 * registro, pela estrutura do `--nuas` menos "plano original", que escondia o paragrafo
 * de estado do `07`. O que NAO alcanca: fato sem ID — a contagem fica com o `--nuas`, o
 * resto com a revisao —, a lista que devia ganhar um item novo, e o codigo.
 *
 * O que NAO faz: reescrever regiao `confere`; contar sobre codigo de `web/src/` — as
 * duas ficaram fora por decisao de 01/10/2026; avisar pela idade de uma medicao da
 * planilha — um terco das afirmacoes nao tem data, e o gatilho real e a aba `2027`.
 *
 * Uso, a partir da raiz do projeto:
 *   node tools/contar-documentacao.mjs                   confere; sai com 1 se divergir
 *   node tools/contar-documentacao.mjs --write           reescreve as regioes `conta`
 *   node tools/contar-documentacao.mjs --nuas            avisa no diff contra a `main`
 *   node tools/contar-documentacao.mjs --nuas --base X   avisa no diff contra `X`
 *   node tools/contar-documentacao.mjs --nuas --tudo     avisa nos documentos inteiros
 *   node tools/contar-documentacao.mjs --pares           pares no diff contra a `main`
 *   node tools/contar-documentacao.mjs --pares --base X  pares no diff contra `X`
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
    tracked,
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

export function mandatoryCases(source) {
  return section(source.read('docs/08-qualidade-operacao.md'), /^### 1\.3/)
    .split('\n')
    .filter((line) => /^\| (?!Caso-limite \||-)/.test(line))
}

/** A ultima celula da linha de §1.3 nomeia a historia, ou duas: `| H-04, H-07 |`. */
export function caseStories(row) {
  return /\| (H-\d+(?:, H-\d+)*) \|\s*$/.exec(row)?.[1].split(', ') ?? []
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
    new Set(mandatoryCases(source).flatMap(caseStories)).size,
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
  'indicadores-aposentados': (source) =>
    indicatorRows(source).filter((row) => /Aposentado/.test(row.status)).length,
  alertas: (source) => distinct(source.read(TRACEABILITY), /^\| (ALE-\d+) \|/gm),
  'chaves-de-cor': (source) => JSON.parse(source.read('config/color-map.json')).entries.length,
  adrs: (source) => source.filesIn('docs/adr').filter((name) => name.endsWith('.md')).length,
  rules: (source) => source.filesIn('.claude/rules').filter((name) => name.endsWith('.md')).length,
  'pendencias-abertas': (source) =>
    distinct(
      section(source.read('CLAUDE.md'), /^### Pendências abertas/),
      /^\| \*\*(PD-\d+)\*\*/gm,
    ),
  'arvore-src': (source) =>
    ['src/domain', 'src/io', 'src/app', 'src/http', 'src/http/routes']
      .map((dir) => source.filesIn(dir).length)
      .join(' · '),
  /** `versao[vitest]` le o `package.json`; `versao[node]`, o `.nvmrc`. A versao e exata: o projeto fixa todas. */
  versao: (source, name) => {
    if (name === 'node') return source.read('.nvmrc').trim()
    const pkg = JSON.parse(source.read('package.json'))
    const version = { ...pkg.dependencies, ...pkg.devDependencies }[name]
    if (!version) throw new Error(`pacote ausente do package.json: ${name}`)
    return version
  },
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

const RECORD_FILES =
  /^docs\/(?:adr|perfilamento|ensaio-planilha|uso)\/|^docs\/01-auditoria-especificacao\.md$/
const NUMBER_WORDS = [
  ...['dois', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
  ...['onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis', 'dezessete'],
  ...['dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'cem'],
]
const UNITS = [
  ...['histórias?', 'testes?', 'arquivos?', 'linhas?', 'épicos?', 'indicadores?', 'alertas?'],
  ...['premissas?', 'riscos?', 'achados?', 'casos(?:-limite)?', 'passos?', 'regras?', 'ADRs?'],
  ...['pendências?', 'colunas?', 'cartões', 'cartão', 'filtros?', 'destinos?', 'páginas?'],
  ...['telas?', 'chaves?', 'fases?', 'rotas?', 'skills?', 'rules?', 'hooks?', 'subagentes?'],
  ...['agentes?', 'workflows?', 'requisitos?', 'RFs?', 'RNFs?', 'decisões', 'decisão', 'campos?'],
  ...['abas?', 'documentos?', 'módulos?', 'componentes?', 'cenários?', 'procedimentos?'],
  ...['contadores?', 'regiões', 'região', 'blocos?', 'asserções', 'commits?', 'PRs?', 'cores?'],
  ...['estados?', 'seções', 'seção', 'itens', 'item', 'células?', 'eixos?', 'baldes?', 'ondas?'],
  'categorias?',
]
// O numero, no maximo uma palavra entre ele e a unidade — "649 linhas", "seis campos
// novos", "18 **épicos**" —, e negrito em volta de qualquer parte.
const LOOSE = new RegExp(
  String.raw`(?<![\w.\-/:#°§])(\d{1,3}(?:\.\d{3})+|\d+|${NUMBER_WORDS.join('|')})(?:\*\*)?(?:\s+(?:\*\*)?[\wÀ-ú-]+(?:\*\*)?)?\s+(?:\*\*)?(${UNITS.join('|')})\b`,
  'giu',
)
const DATED = /\b\d{2}\/\d{2}(?:\/\d{4})?\b|\b[Mm]edid[oa]s?\b/
const RECORD_LINE = /✅ \*\*Conclu|\]\(#h-\d+\) ✅\s*$|^\| D-\d+ \||plano original/
const FORMAT_LIMIT = /(?:no máximo|no mínimo|até|máximo de|mínimo de|cada|por)\s*(?:\*\*)?$/i

/** No backlog, historia fechada e epico com todas as historias fechadas sao registro inteiros. */
function closedBacklogLines(lines) {
  const closed = new Set()
  const isClosed = (line) => line.startsWith('> ✅ **CONCLUÍDA')
  let story = -1
  let epic = -1
  const closeStory = (end) => {
    if (story >= 0 && lines.slice(story, end).some(isClosed))
      for (let i = story; i < end; i++) closed.add(i)
    story = -1
  }
  const closeEpic = (end) => {
    if (epic < 0) return
    const body = lines.slice(epic, end)
    const opened = body.filter((line) => line.startsWith('### H-')).length
    const done = body.filter(isClosed).length
    if (opened > 0 && done >= opened) for (let i = epic; i < end; i++) closed.add(i)
    epic = -1
  }
  lines.forEach((line, index) => {
    if (/^##/.test(line)) closeStory(index)
    if (/^## /.test(line)) closeEpic(index)
    if (line.startsWith('## Épico ')) epic = index
    if (line.startsWith('### H-')) story = index
  })
  closeStory(lines.length)
  closeEpic(lines.length)
  return closed
}

/** Os numeros soltos de um arquivo; com `onlyLines`, so nas linhas (base 1) do conjunto. */
export function looseNumbers(file, text, onlyLines) {
  if (RECORD_FILES.test(file)) return []
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''))
  const closed = file === BACKLOG ? closedBacklogLines(lines) : new Set()
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

// As regras do `--pares` ficam nestas constantes, e nao espalhadas pela logica: sao o
// que um projeto novo troca para adotar o mecanismo.
const PAIR_ID = String.raw`(?:IND|ALE|RNF|RF|TD|PD|A|D|H|P|R)-\d{2,3}(?:\.\d+)?|ADR-\d{4}|E\d{1,2}`
const PAIR_CITATION = new RegExp(String.raw`\b(?:${PAIR_ID})\b`, 'g')
// A linha de tabela que abre com o ID tambem e alvo quando nao mudou: a `02` espelha a
// `09`, e foi o espelho que envelheceu. O titulo nao: ele e a propria fonte.
const PAIR_DEFINITION_ROW = new RegExp(String.raw`^\| \*{0,2}(${PAIR_ID})\*{0,2} \|`)
const PAIR_DEFINITION_HEADING = new RegExp(String.raw`^#{2,4} (?:Épico )?(${PAIR_ID})\b`)
const PAIR_EPIC = /^## Épico (E\d+)/
const PAIR_STORY_CLOSED = /^> ✅ \*\*CONCLUÍDA/
const PAIR_RECORD_LINE = /✅ \*\*Conclu|\]\(#h-\d+\) ✅\s*$|^\| D-\d+ \|/

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

/** O epico de cada historia que o diff fechou, com a linha do fechamento: o estado dele pode ter mudado. */
function epicsOfClosedStories(lines, isChanged) {
  const epics = new Map()
  let epic = null
  lines.forEach((line, index) => {
    epic = PAIR_EPIC.exec(line)?.[1] ?? epic
    if (epic && PAIR_STORY_CLOSED.test(line) && isChanged(index + 1)) epics.set(epic, index + 1)
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
    const closed = file === BACKLOG ? closedBacklogLines(lines) : new Set()
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
    if (file === BACKLOG)
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
        for (const match of line.matchAll(PAIR_CITATION)) {
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
  if (process.argv.includes('--pares')) return reportPairs()
  if (process.argv.includes('--nuas')) return reportLoose()
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
