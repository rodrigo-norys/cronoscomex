import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { COUNTERS, caseStories, createSource, mandatoryCases } from './contar-documentacao.mjs'

/**
 * Monta as secoes da skill `/abrir-historia` a partir do repositorio. So le.
 *
 * Existe porque as secoes viviam em shell injetado na skill, sem teste, e tres
 * defeitos passaram em silencio (medido em 01/10/2026): o `$0` do `awk` virava o
 * argumento da skill e o contrato da rota saia vazio; `grep -F "| H-04 |"` perdia o
 * caso de `| H-04, H-07 |`; e `grep -F "H-10"` trazia as linhas de `H-100` a `H-114`.
 * Fora do modo automatico, o shell injetado nem rodava: o Claude Code recusa
 * expansao, `awk` e `sed` lendo arquivo. Este script e o unico comando que a skill
 * pre-aprova em `allowed-tools`.
 *
 * As contagens vem de `tools/contar-documentacao.mjs`, e nao de regra propria: o
 * numero da skill e o das regioes da documentacao nao podem divergir.
 *
 * O que NAO faz: escrever em arquivo, chamar rede, ou julgar a historia — ele so
 * recorta; a conferencia e do protocolo de fatia.
 *
 * Uso, a partir da raiz do projeto:
 *   node tools/abrir-historia.mjs <secao> H-NN
 *   secoes: historia, total-casos, casos, matriz, identificadores, contrato
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** O argumento da skill pode ser texto livre ("vamos para a H-12"); vale o primeiro H-NN. */
export function storyId(args) {
  return /\bH-\d+\b/.exec(args.join(' '))?.[0] ?? null
}

/** Palavra inteira: `H-10` nao casa dentro de `H-101`. */
const mentions = (line, id) => new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_])`).test(line)

/** Do proprio titulo ao proximo titulo de nivel 2 ou 3, que e de outra historia ou de um epico. */
export function storySection(backlog, id) {
  const lines = backlog.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`### ${id} `))
  if (start === -1) return null
  const end = lines.findIndex((line, index) => index > start && /^##/.test(line))
  return lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trimEnd()
}

/** Nome entre crases com 4+ caracteres, ou palavra em camelCase — o filtro que a skill ja usava. */
export function citedIdentifiers(story) {
  const names = [
    ...story.matchAll(/`([A-Za-z_][A-Za-z0-9_]{3,})`|\b([a-z]+[A-Z][A-Za-z0-9]*)\b/g),
  ].map((match) => match[1] ?? match[2])
  return [...new Set(names)].sort()
}

/**
 * Rota citada pelo texto, ou pelo nome do arquivo de rota, reduzida ao primeiro
 * segmento. O casamento por prefixo traz secoes vizinhas, e isso e aceito pela skill.
 */
export function citedRoutes(story) {
  const routes = [
    ...[...story.matchAll(/\/api\/[a-z0-9/:-]+/g)].map((match) => match[0]),
    ...[...story.matchAll(/src\/http\/routes\/([a-z-]+)\.ts/g)].map((match) => `/api/${match[1]}`),
  ].map((route) => /^\/api\/[a-z0-9-]*/.exec(route)[0])
  return [...new Set(routes)].sort()
}

/** As secoes do contrato cujo titulo cita a rota, ate o proximo titulo que nao cita. */
export function contractSections(contracts, route) {
  const out = []
  let on = false
  for (const line of contracts.split('\n')) {
    if (/^##/.test(line)) on = line.includes(route)
    if (on) out.push(line)
  }
  return out.join('\n')
}

const NO_CASE =
  'NENHUM caso obrigatório atribuído a esta história em §1.3 — os {casos} casos cobrem {historias} histórias, e a ausência aqui é esperada, não defeito. Os casos-limite do backlog continuam obrigatórios.'

/** Monta uma secao. Devolve o texto que entra no lugar da injecao. */
export function render(root, section, args) {
  const source = createSource(root)
  if (section === 'total-casos') return String(COUNTERS['casos-obrigatorios'](source))

  const id = storyId(args)
  if (!id) return 'informe H-NN: o argumento da skill não traz um identificador de história'
  const story = storySection(source.read('docs/06-backlog.md'), id)
  if (story === null) return `${id} não existe em docs/06-backlog.md`

  switch (section) {
    case 'historia':
      return story
    case 'casos': {
      const rows = mandatoryCases(source).filter((row) => caseStories(row).includes(id))
      if (rows.length > 0) return rows.join('\n')
      return NO_CASE.replace('{casos}', COUNTERS['casos-obrigatorios'](source)).replace(
        '{historias}',
        COUNTERS['historias-com-caso-obrigatorio'](source),
      )
    }
    case 'matriz':
      return source
        .read('docs/09-rastreabilidade.md')
        .split('\n')
        .filter((line) => mentions(line, id))
        .join('\n')
    case 'identificadores': {
      const code = source.tracked
        .filter((path) => path.startsWith('src/'))
        .map((path) => source.read(path))
        .join('\n')
      return citedIdentifiers(story)
        .filter((name) => !code.includes(name))
        .map((name) => `  ${name}`)
        .join('\n')
    }
    case 'contrato': {
      const contracts = source.read('docs/05-contratos-api.md')
      return citedRoutes(story)
        .map((route) => contractSections(contracts, route))
        .filter(Boolean)
        .join('\n')
    }
    default:
      return `seção desconhecida: ${section}`
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [section = '', ...args] = process.argv.slice(2)
  console.log(render(ROOT, section, args))
}
