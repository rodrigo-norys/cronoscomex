/**
 * O que e do CronosComex em `tools/contar-documentacao.mjs`: o escopo, os contadores das
 * regioes `conta`, a estrutura que marca registro, as familias de ID e os espelhos de
 * estado entre documentos, o piso de cada guarda, e a lingua em que os numeros sao escritos. O nucleo
 * nao sabe nada do projeto; quem adota o mecanismo troca este arquivo e leva o nucleo
 * como esta.
 *
 * Contador novo entra em `counters`, com teste sobre fonte de valor concreto em
 * `tests/tools/contar-documentacao.test.ts`. O nome e o que a regiao escreve —
 * `<!-- conta:NOME -->` ou `<!-- conta:NOME[argumento] -->` —, e o contador recebe a
 * fonte e o argumento como texto. Espelho novo entra em `ids.mirrors`, com o piso de
 * cada lado em `floors` e teste no mesmo arquivo.
 *
 * Nao importa nada do nucleo: e o nucleo que importa este arquivo.
 */

const BACKLOG = 'docs/06-backlog.md'
const TRACEABILITY = 'docs/09-rastreabilidade.md'
const STYLE_CORPUS = 'docs/estilizacao/corpus-estilo.md'

const IN_SCOPE = /^(?:docs\/.+|\.claude\/.+|README|CLAUDE)\.md$/

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
        body,
      }
    })
}

/**
 * Os itens de primeiro nivel da secao `**Casos-limite:**` da historia, ate o proximo
 * rotulo em negrito: a continuacao recuada e a citacao dentro de um item nao contam.
 */
function edgeCases(source, id) {
  const body = stories(source).find((story) => story.number === Number(id.slice(2)))?.body
  if (!body) throw new Error(`historia ausente do backlog: ${id}`)
  const start = body.findIndex((line) => line.startsWith('**Casos-limite'))
  if (start === -1) throw new Error(`${id} sem secao Casos-limite`)
  const end = body.findIndex((line, index) => index > start && /^\*\*[^*]+:\*\*/.test(line))
  const section = body.slice(start + 1, end === -1 ? undefined : end)
  return section.filter((line) => /^[-*] /.test(line))
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
  'historias-abertas': (source) => stories(source).filter((story) => !story.closed).length,
  'historias-desde': (source, from) =>
    stories(source).filter((story) => story.number >= Number(from.slice(2))).length,
  epicos: (source) => (source.read(BACKLOG).match(/^## Épico /gm) ?? []).length,
  premissas: (source) => distinct(source.read('docs/00-visao-escopo.md'), /^\| *\*{0,2}(P-\d+)/gm),
  riscos: (source) => distinct(source.read('docs/07-plano-entrega.md'), /^#{3,4} (R-\d+)/gm),
  'casos-obrigatorios': (source) => mandatoryCases(source).length,
  'casos-limite': (source, id) => edgeCases(source, id).length,
  /**
   * `casos-limite-desde[H-24 9]`: os itens do nono em diante, na ordem do backlog. A
   * prosa que separa os do plano original dos acrescentados depois guarda o primeiro
   * numero como registro, e o resto envelhecia ao lado da regiao do total (R5 de `D-76`).
   */
  'casos-limite-desde': (source, arg) => {
    const [id, from] = (arg ?? '').split(/\s+/)
    if (!/^[1-9]\d*$/.test(from ?? '')) throw new Error(`posicao invalida: ${arg}`)
    return edgeCases(source, id).slice(Number(from) - 1).length
  },
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
  /**
   * A lista que a prosa escrevia a mao ao lado da contagem, e que esquecia a regra nova
   * (R5 de `D-76`). Em ordem de ID, e nao na do corpus, que poe o eixo R antes do D.
   */
  'regras-corpus-lista': (source, filter) => {
    const ids = styleRules(source, filter)
      .map((rule) => rule.id)
      .sort()
    if (ids.length === 0) throw new Error(`nenhuma regra com ${filter}`)
    return ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} e ${ids.at(-1)}`
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

/**
 * Registro e o que nunca envelhece, porque diz o que era verdade na data: nem o `--nuas`
 * nem o `--pares` o apontam. Aqui sao os arquivos de registro, a linha de matriz
 * `✅ **Concluida`, o item de indice terminado em `✅`, a decisao `| D-NN`, e no backlog
 * a historia fechada inteira e o epico com todas as historias fechadas. A
 * `00-visao-escopo.md` NAO e registro: mistura a especificacao com o escopo vigente. Nem
 * "plano original": a frase que o cita diz tambem o estado de hoje, como a `09` e o
 * `docs/README.md` ao lado da contagem de historias.
 */
const RECORD_FILES =
  /^docs\/(?:adr|perfilamento|ensaio-planilha|uso)\/|^docs\/01-auditoria-especificacao\.md$/
const RECORD_LINE = /✅ \*\*Conclu|\]\(#h-\d+\) ✅\s*$|^\| D-\d+ \|/

/**
 * No backlog, historia fechada e registro inteira, e o epico com todas as historias
 * fechadas tambem — menos a secao `###` que nao e historia: a varredura de verbos do
 * `E18` fala do backlog de hoje.
 */
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
    if (opened > 0 && done >= opened) {
      let other = false
      for (let i = epic; i < end; i++) {
        if (lines[i].startsWith('### ')) other = !lines[i].startsWith('### H-')
        if (!other) closed.add(i)
      }
    }
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

const PAIR_ID = String.raw`(?:IND|ALE|RNF|RF|TD|PD|A|D|H|P|R)-\d{2,3}(?:\.\d+)?|ADR-\d{4}|E\d{1,2}`
// A linha de tabela que abre com o ID tambem e alvo quando nao mudou: a `02` espelha a
// `09`, e foi o espelho que envelheceu. O titulo nao: ele e a propria fonte.
const PAIR_DEFINITION_ROW = new RegExp(String.raw`^\| \*{0,2}(${PAIR_ID})\*{0,2} \|`)
const PAIR_DEFINITION_HEADING = new RegExp(String.raw`^#{1,4} (?:Épico )?(${PAIR_ID})\b`)
const PAIR_EPIC = /^## Épico (E\d+)/
const PAIR_STORY = /^### (H-\d+)/
const PAIR_STORY_CLOSED = /^> ✅ \*\*CONCLUÍDA/

// O ID fica na primeira celula; as colunas seguintes contam a partir de zero.
const cellAfterId = (row, index) => cellsOf(row.replace(/^\|[^|]*\|/, ''))[index] ?? ''
const revoked = (row) => (/REVOGAD/i.test(row) ? 'revogado' : 'vigente')

/**
 * Espelho de estado: o mesmo ID com estado em dois documentos, por desenho. A guarda do
 * `--check` le os dois lados e reprova o ID cujo estado difere. Cada lado diz o arquivo,
 * a secao, se o ID abre titulo ou linha de tabela, e como o estado se reconhece ali — as
 * palavras mudam de um lado para o outro. `absent` diz o que significa o ID faltar de um
 * lado: um estado, ou `ignore`; sem ele, faltar e defeito.
 */
const MIRRORS = [
  {
    // A §4 da matriz lista toda historia do backlog, fechada ou aberta, com o estado.
    name: 'historias',
    family: String.raw`H-\d+`,
    source: {
      file: BACKLOG,
      entries: 'headings',
      state: (block) => (/^> ✅ \*\*CONCLUÍDA/m.test(block) ? 'fechada' : 'aberta'),
    },
    copy: {
      file: TRACEABILITY,
      section: /^## 4\. /,
      entries: 'rows',
      state: (row) => (row.includes('✅') ? 'fechada' : 'aberta'),
    },
  },
  {
    // RF-35 foi revogado por D-43 na `02`, e a §5 da matriz seguiu dizendo "✅ Entregue".
    // A §5 so lista o RF sem indicador, e o que falta nela nao e defeito.
    name: 'requisitos',
    family: String.raw`RF-\d+`,
    source: { file: 'docs/02-requisitos.md', section: /^## 1\. /, entries: 'rows', state: revoked },
    copy: {
      file: TRACEABILITY,
      section: /^## 5\. /,
      entries: 'rows',
      state: revoked,
      absent: 'ignore',
    },
  },
  {
    // O status da matriz e a setima coluna (ver `indicatorRows`); na `02`, o aposentado
    // leva ⏹️ no nome, e o IND-21 que a matriz diz "Bloqueado" a `02` diz "Fora de escopo".
    name: 'indicadores',
    family: String.raw`(?:IND|ALE)-\d+`,
    source: {
      file: TRACEABILITY,
      entries: 'rows',
      state: (row) => {
        const status = cellAfterId(row, 5)
        if (/Aposentado/.test(status)) return 'aposentado'
        return /Bloqueado/.test(status) ? 'bloqueado' : 'ativo'
      },
    },
    copy: {
      file: 'docs/02-requisitos.md',
      entries: 'rows',
      state: (row) => {
        if (/⏹️|aposentad/i.test(cellAfterId(row, 0))) return 'aposentado'
        return /Fora de escopo/i.test(cellAfterId(row, 1)) ? 'bloqueado' : 'ativo'
      },
    },
  },
  {
    // A pendencia vive no `docs/README.md` aberta ou fechada; o `CLAUDE.md` so tem a aberta.
    name: 'pendencias',
    family: String.raw`PD-\d+`,
    source: {
      file: 'docs/README.md',
      section: /^## Pendências$/,
      entries: 'rows',
      state: (row) => (cellAfterId(row, 1).includes('✅') ? 'fechada' : 'aberta'),
    },
    copy: {
      file: 'CLAUDE.md',
      section: /^### Pendências abertas/,
      entries: 'rows',
      state: () => 'aberta',
      absent: 'fechada',
    },
  },
]

/**
 * O minimo que cada guarda tem de examinar — o numero tem de passar do piso: as regioes
 * `conta` do escopo, os arquivos em que a tabela solta e procurada, as regioes de cada
 * nome em `byName`, e os IDs de cada lado de cada espelho. Pega o padrao que parou de
 * casar e deixaria a guarda verde por vacuidade, nao a variacao normal. O lado que pode
 * estar vazio, como as pendencias abertas do `CLAUDE.md`, nao tem piso.
 *
 * A `confere` apagada inteira, ou posta em bloco cercado, nao abala o total de regioes
 * nem tem numero que o `--nuas` aponte: so o piso do nome a ve. A chave e `confere:NOME`
 * ou `conta:NOME`, sem o argumento, e piso 0 pede ao menos uma.
 */
const FLOORS = {
  regions: 40,
  tables: 30,
  byName: { 'confere:arvore': 0, 'confere:links': 0 },
  mirrors: {
    historias: { source: 30, copy: 30 },
    requisitos: { source: 30, copy: 15 },
    indicadores: { source: 20, copy: 20 },
    pendencias: { source: 5 },
  },
}

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
  // O marcador de familia, `IND-NN` ou `ADR-NNNN`, e a unidade de "os 27 `IND-NN`".
  '[A-Z]+-N{2,4}',
]
// O adjetivo de estado faz as vezes da unidade: "113 concluídas, 1 aberta".
// biome-ignore lint/security/noSecrets: regex de palavra com e sem acento, nao credencial
const STATES = ['Abert[ao]s?', 'Fechad[ao]s?', 'Conclu[ií]d[ao]s?', 'Ativ[ao]s?']
// O rotulo antes de dois-pontos: "Abertas: 0", "Total: **114**".
const LABELS = ['Total', ...STATES]
// Quem tem versao exata na prosa; a regiao `versao[...]` le a do `package.json`.
const VERSIONED = [
  ...['Node(?:\\.js)?', 'npm', 'React', 'Vite', 'Vitest', 'TypeScript', 'Tailwind(?: CSS)?'],
  ...['Recharts', 'Fastify', 'fflate', 'chokidar', 'Biome', 'jsdom', 'Testing Library'],
]
const CONNECTIVES = { partOf: 'de|das|dos', article: 'os|as', breakdown: 'Por' }
const DATED = /\b\d{2}\/\d{2}(?:\/\d{4})?\b|\b[Mm]edid[oa]s?\b/
const FORMAT_LIMIT = /(?:no máximo|no mínimo|até|máximo de|mínimo de|cada|por)\s*(?:\*\*)?$/i

export default {
  scope: IN_SCOPE,
  rule: '.claude/rules/documentacao.md',
  counters: COUNTERS,
  record: {
    files: RECORD_FILES,
    line: RECORD_LINE,
    closedBlocks: { file: BACKLOG, lines: closedBacklogLines },
  },
  ids: {
    pattern: PAIR_ID,
    definitionRow: PAIR_DEFINITION_ROW,
    definitionHeading: PAIR_DEFINITION_HEADING,
    closedStory: { file: BACKLOG, epic: PAIR_EPIC, story: PAIR_STORY, closed: PAIR_STORY_CLOSED },
    mirrors: MIRRORS,
  },
  language: {
    numberWords: NUMBER_WORDS,
    units: UNITS,
    states: STATES,
    labels: LABELS,
    versioned: VERSIONED,
    connectives: CONNECTIVES,
    dated: DATED,
    formatLimit: FORMAT_LIMIT,
  },
  floors: FLOORS,
}
