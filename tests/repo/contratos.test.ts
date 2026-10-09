import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { buildServer } from '../../src/http/server.ts'

/**
 * A guarda das omissões mecânicas — as que não pedem julgamento nenhum.
 *
 * Seis histórias fecharam com a mesma falha de plano: a regra entrou, e a fiação
 * que a entrega ficou de fora da lista de arquivos. `src/http/routes/indicators.ts`
 * foi esquecida **cinco vezes seguidas**, de `H-09` a `H-13`; `H-14` esqueceu o
 * registro da rota e o teste dela. `/abrir-historia` pergunta e pega — mas
 * custa uma conversa por história, e só funciona enquanto alguém invoca a
 * skill.
 *
 * Estas asserções não substituem o protocolo de fatia: o que ele pega é da outra
 * classe — `styleId` em vez de `fillId` em `H-27`, a chave vazia em `H-18`. Isso
 * aqui é o piso mecânico, para o protocolo gastar atenção no que é decisão.
 *
 * **Nada aqui tem lista fixa.** Toda verificação deriva do que existe em disco:
 * acrescentar rota, campo ou página muda a expectativa sozinho.
 *
 * As asserções da guarda, com o que cada uma já pegou:
 *
 * 1. **toda `src/http/routes/*.ts` tem `tests/http/*.test.ts`.** Achou a lacuna
 *    na primeira execução: `GET /api/quarantine` nunca teve teste de servidor,
 *    só o stub do cliente — que devolve o que a interface espera, não o que a
 *    rota produz;
 * 2. **os blocos de `GET /api/indicators` batem com o `jsonc` de
 *    `docs/05-contratos-api.md`**, de topo e dentro de `counts`, `rankings` e
 *    `meta`. Compara **chaves, nunca valores**: o documento traz exemplo, e
 *    exigir igualdade de número transformaria cada medição nova em falha;
 * 3. **história com `✅ CONCLUÍDA` no backlog exige a página montada** — a
 *    asserção vive em `web/tests/paginas-montadas.test.tsx`;
 * 4. **toda âncora citada em comentário existe** — onze famílias de ID e
 *    caminho de arquivo, no código, nos testes, nas ferramentas, nos scripts
 *    e no CI (`COMMENTED_AREAS`). Nasceu verde: 331 citações e 18 caminhos,
 *    zero mortos (docs/08-qualidade-operacao.md §6.3). O ID precisa ser
 *    **definido** em `docs/`, não só aparecer lá: citação satisfazia a versão
 *    anterior, e ID cuja definição some mas
 *    que segue citado em outro documento passava verde; Não conserta dívida — impede que
 *    entre. É a metade computável da régua de `.claude/rules/comentarios.md`,
 *    e a razão de a régua exigir fonte em todo fato medido: número sem âncora
 *    é afirmação que ninguém reconfere;
 * 5. **toda peça de `.claude/` é mencionada no `CLAUDE.md`.** Substitui a
 *    checagem 1 de `conferir-alinhamento.sh`, que roda em `ConfigChange` e por
 *    isso **não vê a edição do `CLAUDE.md`** — que é justamente o lado por onde
 *    o defeito entra. O hook fica como aviso imediato; a garantia é aqui,
 *    porque isto roda em 100% dos commits, inclusive os feitos fora do
 *    Claude Code;
 * 6. **todo identificador em camelCase citado entre crases num comentário
 *    ainda existe.** O modo de falha é o *rename symbol* do editor: ele
 *    atualiza o código e deixa a prosa para trás, em silêncio. Medido
 *    (docs/08-qualidade-operacao.md §6.3): 120 citações, 70 identificadores
 *    distintos, zero ausentes;
 * 7. **todo gatilho de reavaliação que `D-16` declara foi observado.** A
 *    decisão registra quatro, e dois estavam atingidos sem que ninguém tivesse
 *    notado — o `router.ts` acima de ~100 linhas, e o carregamento por rota que
 *    `H-21` trouxe. Os limiares saem do texto da própria decisão, então mudá-la
 *    muda a expectativa. O que a asserção defende não é a conclusão, é a
 *    observação: gatilho declarado e nunca conferido dá a impressão de que a
 *    decisão está sendo revisitada quando não está;
 * 8. **o resumo do backlog concorda com os blocos das histórias.** As marcas por
 *    história congelaram com `H-17`, e a tabela seguiu afirmando que `H-13`
 *    estava aberta (docs/06-backlog.md) — contra o bloco `✅ CONCLUÍDA` dela e a
 *    linha dela em `docs/09-rastreabilidade.md` §4. Foi a **única** coisa no
 *    repositório dizendo isso, e custou uma pergunta sobre história fechada há
 *    doze dias. O que a asserção defende não é a marca ✅, que passou a ser por
 *    épico de propósito: é o **total**, que é computável e por isso não
 *    envelhece em silêncio;
 * 9. **nenhuma data de dia fora de crase em comentário**, nas áreas de
 *    `COMMENTED_AREAS` — as mesmas da asserção 4, mais `config/` e os `.ts` da
 *    raiz. A data mora no registro, e o comentário cita o ID dele (`D-76`).
 *    Nasceu verde: a data saiu dos comentários antes, e foi para o registro.
 *
 * Provado que morde, nas duas direções: bloco que a rota serve e o documento não
 * declara reprova, e campo que o documento promete e a rota não serve também.
 *
 * **O que ela ainda NÃO cobre:** que toda rota documentada exista.
 * `GET /api/processes/:ref` esteve em `docs/05-contratos-api.md` desde o começo
 * e só foi implementada em `H-22` — contrato documentado não é contrato servido,
 * e a asserção 2 compara o corpo de `GET /api/indicators`, não o catálogo de
 * rotas.
 */

const config: AppConfig = {
  workbookPath: '/caminho/ficticio/planilha.xlsx',
  sheetName: '2026',
  headerRow: 1,
  firstDataRow: 2,
  port: 0,
  stalledDaysThreshold: 15,
  topN: 10,
  timezone: 'America/Sao_Paulo',
}

const emptyState: StoreState = {
  state: 'pronto',
  processes: [],
  fileHash: 'sha256:abc',
  sheetName: '2026',
  headerLabels: {},
  schemaDivergences: [],
  lastReadAt: new Date('2026-08-07T12:00:00.000Z'),
  lastReadOk: true,
  degradedReason: null,
  lastReadDurationMs: 120,
  rowsRead: 0,
  rowsAccepted: 0,
  rowsQuarantined: 0,
  externalLock: false,
  conflictFiles: [],
  pendingEdits: [],
}

const fakeStore: StoreAccess = { getState: () => emptyState, reload: async () => undefined }

describe('toda rota tem teste de servidor', () => {
  /**
   * `GET /api/quarantine` viveu sem teste até esta guarda existir. O stub do
   * cliente a exercitava, mas stub devolve o que a interface espera — não o que
   * a rota produz, que é justamente o que pode divergir.
   */
  it('pareia src/http/routes/*.ts com tests/http/*.test.ts', () => {
    const routes = readdirSync('src/http/routes')
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
    const tests = new Set(
      readdirSync('tests/http')
        .filter((file) => file.endsWith('.test.ts'))
        .map((file) => file.replace(/\.test\.ts$/, '')),
    )

    expect(routes.length).toBeGreaterThan(0)
    expect(routes.filter((route) => !tests.has(route))).toEqual([])
  })
})

/**
 * As rotas que `05-contratos-api.md` declara, com a história que a entrega
 * quando ela ainda não existe.
 *
 * O marcador `> **Pendente de `H-NN`.**` logo abaixo do título é o que separa
 * "ainda não chegou" de "sumiu". Sem ele, uma rota documentada e ausente é
 * indistinguível de um plano adiantado — que foi exatamente o estado de
 * `GET /api/processes/:ref` **desde o começo do projeto até `H-22`**.
 */
interface DocumentedRoute {
  method: string
  url: string
  pendingStory: string | null
}

/**
 * A história que a seção declara estar esperando, ou `null`.
 *
 * Separada da varredura para poder ser exercida com entrada sintética: desde
 * `H-30` **não há rota pendente no documento**, e a âncora abaixo não pode
 * depender de o plano ainda ter alguma.
 */
function pendingStoryOf(section: string): string | null {
  return section.match(/^> \*\*Pendente de `(H-\d+)`/m)?.[1] ?? null
}

function documentedRoutes(): DocumentedRoute[] {
  const document = readFileSync('docs/05-contratos-api.md', 'utf-8')
  const routes: DocumentedRoute[] = []

  for (const section of document.split(/^### /m)) {
    const heading = section.match(/^`(GET|POST|PUT|PATCH|DELETE) ([^`]+)`/)
    if (heading?.[1] === undefined || heading[2] === undefined) continue

    routes.push({
      method: heading[1],
      url: heading[2],
      pendingStory: pendingStoryOf(section),
    })
  }
  return routes
}

/** As histórias com o bloco de conclusão em `docs/06-backlog.md`. */
function closedStories(): Set<string> {
  const backlog = readFileSync('docs/06-backlog.md', 'utf-8')
  const closed = new Set<string>()

  for (const section of backlog.split(/^### /m)) {
    const story = section.match(/^(H-\d+)\b/)
    if (story?.[1] && section.includes('✅ **CONCLUÍDA')) closed.add(story[1])
  }
  return closed
}

const DOCUMENTED = documentedRoutes()
const CLOSED = closedStories()

describe('toda rota documentada existe, ou diz de quem está esperando', () => {
  it('encontra as rotas no documento e as histórias no backlog', () => {
    // Âncora contra o pior modo de falha de guarda: verde por vacuidade. Se o
    // formato de um dos dois documentos mudar, isto reprova em vez de deixar as
    // asserções abaixo passarem sem verificar nada.
    expect(DOCUMENTED.length).toBeGreaterThan(8)
    expect(CLOSED.size).toBeGreaterThan(0)

    /**
     * O parser do marcador é exercido com entrada sintética, e não contando as
     * pendências vivas. `H-30` serviu `GET /*`, a última que faltava, e desde
     * então o documento não tem nenhuma — a asserção anterior reprovaria por o
     * plano ter terminado, que é o oposto do que ela existe para detectar.
     */
    expect(pendingStoryOf('> **Pendente de `H-99`.** Documentada, não servida.')).toBe('H-99')
    expect(pendingStoryOf('Serve a SPA compilada, em `dist/web`.')).toBeNull()
  })

  /**
   * `GET /api/processes/:ref` ficou documentada e ausente do começo do plano
   * até `H-22`, sem nada acusar: a checagem de contrato compara o **corpo** de
   * `GET /api/indicators` com o documento, e nunca a lista de rotas.
   *
   * A implicação é de mão única, como em `paginas-montadas`: rota implementada
   * antes de a história fechar é estado legítimo.
   */
  it.each(DOCUMENTED.map((route) => [`${route.method} ${route.url}`, route] as const))(
    '%s',
    (_label, route) => {
      const shouldExist = route.pendingStory === null || CLOSED.has(route.pendingStory)
      if (!shouldExist) return

      const app = buildServer(config, fakeStore)
      const registered = app.hasRoute({ method: route.method as 'GET', url: route.url })

      expect(
        registered,
        route.pendingStory === null
          ? `${route.method} ${route.url} está documentada e não é servida — marque-a como pendente ou implemente-a`
          : `${route.pendingStory} está concluída no backlog, mas ${route.method} ${route.url} não é servida`,
      ).toBe(true)
    },
  )
})

/**
 * Extrai as chaves declaradas num bloco ```jsonc de `05-contratos-api.md`.
 *
 * Compara **chaves**, nunca valores: o documento traz exemplos ilustrativos, e
 * exigir que batam transformaria cada medição nova em falha de teste. O que não
 * pode divergir é a lista de campos — foi ela que ficou para trás cinco vezes.
 */
function documentedShape(heading: string): Record<string, unknown> {
  const document = readFileSync('docs/05-contratos-api.md', 'utf-8')
  const start = document.indexOf(heading)
  if (start === -1) throw new Error(`seção ausente em 05-contratos-api.md: ${heading}`)

  const open = document.indexOf('```jsonc', start)
  const close = document.indexOf('```', open + 8)
  if (open === -1 || close === -1) throw new Error(`bloco jsonc ausente após ${heading}`)

  const body = document
    .slice(open + 8, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  return JSON.parse(body) as Record<string, unknown>
}

async function indicatorsBody(): Promise<Record<string, Record<string, unknown>>> {
  const app = buildServer(config, fakeStore)
  const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
  await app.close()
  return body
}

describe('o documento de contrato acompanha a resposta real', () => {
  /**
   * O elo que o plano erra com regularidade: o indicador é calculado, o campo
   * entra na rota, e `docs/05-contratos-api.md` fica descrevendo a versão
   * anterior. Quem lê o documento para escrever a tela recebe um contrato que
   * não existe mais.
   */
  it('declara os mesmos blocos de topo que GET /api/indicators devolve', async () => {
    const body = await indicatorsBody()
    const documented = documentedShape('### `GET /api/indicators`')

    expect(Object.keys(body).sort()).toEqual(Object.keys(documented).sort())
  })

  // Os cinco esquecimentos de `H-09` a `H-13` foram todos DENTRO de `counts`.
  it.each(['counts', 'rankings', 'meta'])('declara os campos de %s', async (block) => {
    const body = await indicatorsBody()
    const documented = documentedShape('### `GET /api/indicators`')

    expect(Object.keys(body[block] ?? {}).sort()).toEqual(
      Object.keys((documented[block] ?? {}) as Record<string, unknown>).sort(),
    )
  })
})

/**
 * As areas cujo comentario as guardas leem, com o piso de linhas de comentario
 * de cada uma.
 *
 * **O piso e ancora, e nao meta.** O que ele pega e o extrator que parou de
 * reconhecer um estilo — o `#` do shell e do YAML, o `rem` do `.cmd`, a chave
 * `_` do JSON de `config/` —: sem ele a area sai das guardas em silencio, e
 * tudo fica verde. Folgado de proposito, na casa da metade do que cada area
 * tem, para nao reprovar por refatoracao normal.
 *
 * A `raiz` sao os `.ts` do topo, como `vitest.config.ts`. `config/` e a raiz
 * entram so na guarda de data; a de ancora le as demais. `.md` nao entra em
 * area nenhuma: documento guarda a data no registro, e as guardas dele sao as
 * de `tests/repo/documentacao.test.ts` e `tests/repo/contagens.test.ts`.
 */
const COMMENTED_AREAS: readonly {
  name: string
  pathspec: string
  floor: number
  anchors: boolean
}[] = [
  { name: 'src', pathspec: 'src', floor: 3000, anchors: true },
  { name: 'web/src', pathspec: 'web/src', floor: 2000, anchors: true },
  { name: 'tests', pathspec: 'tests', floor: 2000, anchors: true },
  { name: 'web/tests', pathspec: 'web/tests', floor: 1000, anchors: true },
  { name: 'tools', pathspec: 'tools', floor: 500, anchors: true },
  { name: 'scripts', pathspec: 'scripts', floor: 180, anchors: true },
  { name: '.github', pathspec: '.github', floor: 100, anchors: true },
  { name: 'config', pathspec: 'config', floor: 40, anchors: false },
  { name: 'raiz', pathspec: ':(glob)*.ts', floor: 20, anchors: false },
]

const SLASH_STYLE = /\.(?:[cm]?[jt]sx?|css)$/
const HASH_STYLE = /\.(?:sh|ya?ml|py|ps1)$/
const BATCH_STYLE = /\.(?:cmd|bat)$/
const JSON_STYLE = /^config\/[^/]+\.(?:json|exemplo)$/

/**
 * O piso de linhas de comentario de cada estilo, alem do de cada area.
 *
 * **O da area nao basta:** a minoria de uma area pode sumir sem levar a area
 * abaixo do piso dela — e o `.cmd` e minoria nas duas em que existe. O piso por
 * estilo pega o extrator quebrado onde quer que o estilo viva.
 */
const STYLE_FLOORS: Readonly<Record<CommentStyle, number>> = {
  barra: 8000,
  cerquilha: 200,
  rem: 50,
  json: 40,
}

type CommentStyle = 'barra' | 'cerquilha' | 'rem' | 'json'

/** O comentario de um arquivo, por linha, e o codigo dele, inteiro. */
interface CommentScan {
  comments: Map<number, string>
  code: string
}

interface CommentedFile extends CommentScan {
  file: string
  area: string
  style: CommentStyle
  anchors: boolean
}

/**
 * Os arquivos que o git rastreia em cada area, com o comentario separado do
 * codigo. Do git, e nao do disco, pelo mesmo motivo de `trackedPaths`: o CI tem
 * exatamente o que o `git ls-files` lista.
 */
function commentedFiles(): CommentedFile[] {
  const found: CommentedFile[] = []

  for (const { name, pathspec, anchors } of COMMENTED_AREAS) {
    const listed = execFileSync('git', ['ls-files', '-z', '--', pathspec], { encoding: 'utf-8' })
    for (const file of listed.split('\0')) {
      if (file === '' || file.endsWith('.md')) continue
      const style = styleOf(file)
      if (style === null) continue
      const scan = scanComments(style, file, readFileSync(file, 'utf-8'))
      found.push({ file, area: name, style, anchors, ...scan })
    }
  }

  return found
}

function styleOf(file: string): CommentStyle | null {
  if (SLASH_STYLE.test(file)) return 'barra'
  if (HASH_STYLE.test(file)) return 'cerquilha'
  if (BATCH_STYLE.test(file)) return 'rem'
  if (JSON_STYLE.test(file)) return 'json'
  return null
}

function scanComments(style: CommentStyle, file: string, content: string): CommentScan {
  if (style === 'barra') return scanSlashStyle(content)
  if (style === 'cerquilha') return scanHashStyle(file, content)
  if (style === 'rem') return scanBatchStyle(content)
  return scanJsonStyle(content)
}

/**
 * Comentario de TypeScript, JavaScript e CSS: as duas barras, o bloco e o bloco
 * entre chaves do JSX — fora de string, template e regex.
 *
 * **Lexico, e nao por prefixo de linha.** A versao anterior reconhecia a linha
 * que comeca com barra ou asterisco, e perdia o bloco cujas linhas nao levam
 * asterisco, o comentario no fim de uma linha de codigo e o do JSX.
 *
 * **O limite declarado e a regex literal:** ela se distingue da divisao pelo
 * caractere anterior, como faz um tokenizador sem gramatica — barra depois de
 * parentese ou de identificador e divisao. String e regex nao atravessam linha,
 * entao um engano para no fim dela; o template atravessa, e e rastreado com as
 * chaves das interpolacoes.
 *
 * **O apostrofo colado a uma letra e texto, e nao abre string:** em codigo, a
 * string nunca vem colada a uma letra; no texto JSX, `d'agua` abria uma string
 * ate o fim da linha e escondia o comentario que vinha depois.
 */
function scanSlashStyle(content: string): CommentScan {
  const comments = new Map<number, string>()
  const code: string[] = []
  const comment = (line: number, text: string): void => {
    comments.set(line, `${comments.get(line) ?? ''}${text}`)
  }
  const regexAfter = '(,=:[!&|?{};+-*%~^'
  const regexAfterWord = new Set(['return', 'typeof', 'case', 'in', 'of', 'void', 'throw'])

  let state: 'code' | 'line' | 'block' | 'single' | 'double' | 'template' | 'regex' | 'class' =
    'code'
  const templateDepths: number[] = []
  let braces = 0
  let line = 1
  let previous = ''
  let word = ''

  for (let index = 0; index < content.length; index++) {
    const char = content[index] ?? ''
    const next = content[index + 1] ?? ''

    if (char === '\n') {
      line++
      code.push(char)
      if (state !== 'block' && state !== 'template') state = 'code'
      continue
    }
    if (state === 'line') {
      comment(line, char)
      continue
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        comment(line, '*/')
        state = 'code'
        index++
      } else comment(line, char)
      continue
    }

    code.push(char)
    if (state === 'single' || state === 'double' || state === 'template') {
      if (char === '\\') {
        code.push(next)
        index++
      } else if (
        (state === 'single' && char === "'") ||
        (state === 'double' && char === '"') ||
        (state === 'template' && char === '`')
      ) {
        state = 'code'
      } else if (state === 'template' && char === '$' && next === '{') {
        templateDepths.push(braces)
        braces++
        state = 'code'
        code.push(next)
        index++
      }
      continue
    }
    if (state === 'regex' || state === 'class') {
      if (char === '\\') {
        code.push(next)
        index++
      } else if (state === 'regex' && char === '[') state = 'class'
      else if (state === 'class' && char === ']') state = 'regex'
      else if (state === 'regex' && char === '/') state = 'code'
      continue
    }

    if (char === '/' && (next === '/' || next === '*')) {
      code.pop()
      comment(line, `/${next}`)
      state = next === '/' ? 'line' : 'block'
      index++
      continue
    }
    if (char === "'" && !/\p{L}/u.test(content[index - 1] ?? '')) state = 'single'
    else if (char === '"') state = 'double'
    else if (char === '`') state = 'template'
    else if (
      char === '/' &&
      (previous === '' || regexAfter.includes(previous) || regexAfterWord.has(word))
    )
      state = 'regex'
    else if (char === '{') braces++
    else if (char === '}') {
      braces--
      if (templateDepths.at(-1) === braces) {
        templateDepths.pop()
        state = 'template'
      }
    }

    if (!/\s/.test(char)) {
      word = /[\w$]/.test(char) ? (/[\w$]/.test(content[index - 1] ?? '') ? word + char : char) : ''
      previous = char
    }
  }

  return { comments, code: code.join('') }
}

/**
 * `#` no comeco de palavra, fora de aspas — em shell, YAML, Python e
 * PowerShell, que tem tambem o bloco entre `<#` e `#>`. O heredoc do shell e
 * dado, e nao comentario: as linhas dele ficam de fora ate o terminador.
 *
 * **A here-string, `<<<`, nao e heredoc:** ela nao tem terminador, e lida como
 * heredoc tirava o resto do arquivo das duas guardas.
 */
function scanHashStyle(file: string, content: string): CommentScan {
  const comments = new Map<number, string>()
  const code: string[] = []
  const shell = file.endsWith('.sh')
  const powershell = file.endsWith('.ps1')
  let quote: string | null = null
  let heredoc: string | null = null
  let psBlock = false

  content.split('\n').forEach((text, index) => {
    const line = index + 1
    if (heredoc !== null) {
      code.push(text)
      if (text.replace(/^\t+/, '') === heredoc) heredoc = null
      return
    }
    if (psBlock) {
      comments.set(line, text)
      if (text.includes('#>')) psBlock = false
      return
    }

    let cut = text.length
    for (let column = 0; column < text.length; column++) {
      const char = text[column] ?? ''
      if (quote !== null) {
        if (char === '\\' && quote === '"') column++
        else if (char === quote) quote = null
        continue
      }
      if (char === "'" || char === '"') {
        quote = char
        continue
      }
      if (powershell && char === '<' && text[column + 1] === '#') {
        cut = column
        psBlock = !text.slice(column + 2).includes('#>')
        break
      }
      if (char === '#' && (column === 0 || /\s/.test(text[column - 1] ?? ''))) {
        if (line === 1 && text[column + 1] === '!') break
        cut = column
        break
      }
    }

    if (cut < text.length) comments.set(line, text.slice(cut))
    code.push(text.slice(0, cut))
    if (!shell) quote = null
    else if (quote === null)
      heredoc = /(?<!<)<<(?!<)-?\s*['"]?([A-Za-z_]\w*)['"]?/.exec(text)?.[1] ?? null
  })

  return { comments, code: code.join('\n') }
}

/** `rem` e `::` no comeco da linha, como o `cmd.exe` os le. */
function scanBatchStyle(content: string): CommentScan {
  const comments = new Map<number, string>()
  const code: string[] = []

  content.split('\n').forEach((text, index) => {
    if (/^\s*(?:rem\b|::)/i.test(text)) comments.set(index + 1, text)
    else code.push(text)
  })

  return { comments, code: code.join('\n') }
}

/**
 * O valor das chaves `_` do JSON de `config/`, que e o comentario daqueles
 * arquivos — inclusive objeto e array que atravessam linhas.
 *
 * **A chave aninhada fica de fora:** num comentario como `_naoIncluidas`, ela
 * nomeia um valor do dominio — a grafia `DESEMBARACADA 03/02` da planilha —, e
 * nao e prosa.
 */
function scanJsonStyle(content: string): CommentScan {
  const comments = new Map<number, string>()
  const code: string[] = []
  const withoutKeys = (text: string): string => text.replace(/"(?:[^"\\]|\\.)*"\s*:/g, '')
  let depth = 0

  content.split('\n').forEach((text, index) => {
    if (depth > 0) {
      comments.set(index + 1, withoutKeys(text))
      depth += bracketBalance(text)
      return
    }
    const key = /^\s*"_[^"]*"\s*:(.*)$/.exec(text)
    if (key === null) {
      code.push(text)
      return
    }
    comments.set(index + 1, withoutKeys(key[1] ?? ''))
    depth = Math.max(0, bracketBalance(key[1] ?? ''))
  })

  return { comments, code: code.join('\n') }
}

/** Quantos `{` e `[` ficam abertos na linha, fora de string. */
function bracketBalance(text: string): number {
  let balance = 0
  let inString = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === '\\') index++
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{' || char === '[') balance++
    else if (char === '}' || char === ']') balance--
  }

  return balance
}

/** Todo `.md` de `docs/`, recursivamente. */
function documentationFiles(): string[] {
  const found: string[] = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.md')) found.push(path)
    }
  }

  walk('docs')
  return found
}

/**
 * Os IDs que `docs/` **define**, não os que ele apenas cita.
 *
 * A distinção decide um defeito que a versão anterior desta guarda deixava
 * passar: bastava o ID aparecer em qualquer lugar de `docs/`, e citação é
 * aparição. Apagar `A-60` da auditoria mantinha tudo verde enquanto o backlog
 * seguisse citando `A-60` — a âncora apontava para uma citação, não para uma
 * definição, e o comentário do código ficava sem lastro sem nada acusar.
 *
 * Definição é posição, e posição é computável: título `#`, ou **primeira
 * célula** de linha de tabela. Nenhuma lista fixa — medido
 * (docs/08-qualidade-operacao.md §6.3), os 261 IDs distintos de `docs/` têm
 * posição de definição.
 */
function definedIds(): Set<string> {
  const defined = new Set<string>()

  for (const file of documentationFiles()) {
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      let scope: string | null = null

      if (/^#{1,6}\s/.test(line)) scope = line
      else if (line.startsWith('|')) scope = line.split('|')[1] ?? ''

      if (scope === null) continue
      for (const match of scope.matchAll(PLAN_ID)) defined.add(match[0])
    }
  }

  return defined
}

/**
 * As onze famílias de âncora do plano. A ordem é do mais longo para o mais
 * curto por higiene, não por necessidade: os `\b` já impedem que `D-\d{2}` case
 * dentro de `TD-05` ou `IND-22`, e que `R-\d{2}` case dentro de `ADR-0004` —
 * em todos falta fronteira de palavra antes da letra.
 *
 * **Dois ou três dígitos.** Com `\d{2}` e o `\b` do fim, `H-100` não casava — o
 * `\b` exige fronteira entre o segundo e o terceiro dígito —, e desde que o
 * backlog passou de `H-99` nenhuma citação de três dígitos era conferida: um
 * comentário citando um `H-` de três dígitos inexistente passava verde. Achado
 * por mutação (ADR-0007).
 */
const PLAN_ID =
  /\b(?:ADR-\d{4}|RNF-\d{2,3}|IND-\d{2,3}|ALE-\d{2,3}|TD-\d{2,3}(?:\.\d)?|RF-\d{2,3}|H-\d{2,3}|A-\d{2,3}|D-\d{2,3}|P-\d{2,3}|R-\d{2,3})\b/g
/**
 * `src/` e `web/` entraram em `H-21`: sem eles, `\b` casava o `tests` de
 * `web/tests/paginas-montadas.test.tsx` no meio da palavra e a guarda cobrava
 * o mesmo caminho sem o `web/` da frente, que nunca existiu — falso positivo em
 * caminho certo, e cegueira nos dois diretorios onde o codigo vive.
 *
 * **O `(?<!\/)` entrou em `H-34`, e exclui URL.** Caminho de repositorio e
 * citado relativo — `src/io/xlsx-reader.ts` —, nunca precedido de barra. A rota
 * `/api/config/workbook` casava do `config` em diante, e a guarda cobrava um arquivo
 * que nunca existiria, o que empurraria o nome da rota para fora do comentario
 * que a documenta. Sem a exclusao, toda rota sob um prefixo homonimo de
 * diretorio — `config`, `docs`, `tools` — teria o mesmo destino.
 *
 * **A guarda cobra existencia em disco, e o arquivo de configuracao do operador
 * esta no `.gitignore`** — num checkout limpo ele nao existe, e citar o caminho
 * dele em comentario reprova o CI enquanto passa na maquina de quem ja o tem.
 * Foi o que aconteceu em `H-34`. Por isso os comentarios o nomeiam **sem o
 * prefixo de diretorio**, como `app.json`: ele e artefato de execucao, e o que
 * o repositorio versiona e `config/app.json.exemplo`. Nao "conserte" de volta.
 */
const REPO_PATH = /(?<!\/)\b(?:web\/)?(?:docs|config|tools|tests|src|web)\/[A-Za-z0-9._/-]+/g
const BACKTICKED = /`([^`]+)`/g

/**
 * Só camelCase com maiúscula interna: `serialToDate` entra, `tmp` não.
 *
 * A forma frouxa — qualquer coisa que comece em minúscula — foi medida e custa
 * falso positivo: em 120 candidatos, `tmp` (palavra de prosa) e
 * `verbatimModuleSyntax` (opção de compilador, que não vive em `.ts`)
 * reprovariam a suíte no dia um. Exigir a maiúscula interna resolve o primeiro;
 * o palheiro ampliado, o segundo.
 */
const IDENTIFIER = /^[a-z]+[A-Z][A-Za-z0-9]*$/

interface Citation {
  file: string
  line: number
  token: string
}

/**
 * O `.ts` e o `.tsx` de `src/` e `web/src` — o alcance do identificador em
 * camelCase, dos dois lados: o que o comentario cita e o dicionario contra o
 * qual se confere.
 *
 * **O ID e o caminho valem em toda area; o identificador, so aqui.** Em teste,
 * ferramenta e script o comentario cita API de fora — `asyncUtilTimeout` da
 * Testing Library, `allowJs` do compilador, `scrollWidth` do DOM —, e o
 * dicionario do repositorio nao as tem: o falso positivo dominaria.
 */
function isApplicationCode(area: string, file: string): boolean {
  return (area === 'src' || area === 'web/src') && /\.tsx?$/.test(file)
}

/**
 * As citações que aparecem **dentro de comentário**, nunca em código.
 *
 * A distinção não é cosmética: `import ... from '../../domain/types.ts'` não é
 * afirmação sobre o plano, e um caminho em literal de string é dado, não
 * documentação. O que esta guarda protege é a afirmação — o comentário que diz
 * "medido: 40 linhas (A-60)" e continua dizendo isso depois de `A-60` sumir.
 */
function citationsInComments(): {
  ids: Citation[]
  paths: Citation[]
  identifiers: Citation[]
} {
  const ids: Citation[] = []
  const paths: Citation[] = []
  const identifiers: Citation[] = []

  for (const { file, comments, anchors, area } of COMMENTED) {
    if (!anchors) continue
    for (const [line, text] of comments) {
      for (const match of text.matchAll(PLAN_ID)) {
        ids.push({ file, line, token: match[0] })
      }
      for (const match of text.matchAll(REPO_PATH)) {
        paths.push({ file, line, token: match[0].replace(/[.,;:)]+$/, '') })
      }
      if (!isApplicationCode(area, file)) continue
      for (const match of text.matchAll(BACKTICKED)) {
        const token = match[1] ?? ''
        if (IDENTIFIER.test(token)) identifiers.push({ file, line, token })
      }
    }
  }

  return { ids, paths, identifiers }
}

/**
 * Todo token que aparece em código ou configuração — o dicionário contra o qual
 * um identificador citado em comentário é conferido.
 *
 * Inclui `tsconfig.json`, `package.json` e `vitest.config.ts` porque comentário
 * cita opção de compilador com a mesma naturalidade com que cita função:
 * `verbatimModuleSyntax` é referência legítima e não vive em `.ts` nenhum.
 */
function declaredTokens(): Set<string> {
  const tokens = new Set<string>()

  const absorb = (content: string): void => {
    for (const token of content.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) tokens.add(token)
  }

  for (const { code, area, file } of COMMENTED) {
    if (isApplicationCode(area, file)) absorb(code)
  }
  for (const file of ['tsconfig.json', 'package.json', 'vitest.config.ts']) {
    if (existsSync(file)) absorb(readFileSync(file, 'utf-8'))
  }

  return tokens
}

const COMMENTED = commentedFiles()
const CITATIONS = citationsInComments()
const DEFINED = definedIds()
const TRACKED = trackedPaths()

/**
 * Os caminhos que o git rastreia — arquivos e os diretorios que os contem.
 *
 * **Os diretorios entram derivados, e nao listados:** `git ls-files` devolve
 * arquivos, e um comentario que cita `src/domain/` estaria citando algo que a
 * lista nao tem. Cada prefixo de cada arquivo rastreado vira uma entrada, com e
 * sem a barra final, porque as duas grafias aparecem em comentario.
 */
function trackedPaths(): ReadonlySet<string> {
  const saida = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf-8' })
  const paths = new Set<string>()

  for (const arquivo of saida.split('\0')) {
    if (arquivo === '') continue
    paths.add(arquivo)

    const partes = arquivo.split('/')
    for (let corte = 1; corte < partes.length; corte += 1) {
      const pasta = partes.slice(0, corte).join('/')
      paths.add(pasta)
      paths.add(`${pasta}/`)
    }
  }
  return paths
}

describe('toda âncora citada em comentário ainda existe', () => {
  it('encontra citações — âncora contra guarda verde por vacuidade', () => {
    // `H-21` levou a guarda a `src/` e `web/`, e os caminhos conferidos de 18
    // para 54; hoje ela le tambem testes, ferramentas, scripts e CI. O piso e
    // folgado de proposito: o que ele pega e a regex que parou de casar, nao a
    // variacao normal de refatorar. O de cada area esta em `COMMENTED_AREAS`.
    expect(CITATIONS.ids.length).toBeGreaterThan(1000)
    expect(CITATIONS.paths.length).toBeGreaterThan(120)
  })

  it('todo ID citado é DEFINIDO em docs/, não apenas citado lá também', () => {
    // Âncora: se o extrator de definição quebrar, isto reprova antes de a
    // asserção abaixo passar a acusar os 331 IDs de uma vez.
    expect(DEFINED.size).toBeGreaterThan(200)

    const dead = CITATIONS.ids.filter((citation) => !DEFINED.has(citation.token))

    expect(
      dead.map(
        (citation) =>
          `${citation.file}:${citation.line} cita ${citation.token}, que não é definido em docs/ — todo fato medido cita uma fonte que existe (.claude/rules/comentarios.md, regra 4)`,
      ),
    ).toEqual([])
  })

  /**
   * **O que o git RASTREIA, e nao o que existe em disco.**
   *
   * A versao anterior usava `existsSync`, e com ela o portao local e o CI
   * divergiam: `app.json` esta no `.gitignore` e existe na maquina do dono,
   * entao citar o caminho dele, com o `config/` da frente, num comentario
   * passava aqui e reprovava la, num checkout limpo. **Custou o PR #131 e
   * reprovou de novo** (ADR-0007), nos dois gates — `verify` e `verify-windows`
   * — pelo mesmo comentario.
   *
   * Consultar o git torna as duas execucoes iguais por construcao: o CI tem
   * exatamente o que o `git ls-files` lista. A convencao que o repositorio ja
   * usava — citar `app.json` sem o prefixo `config/`, fixada em `H-34` —
   * continua valendo, e agora e cobrada no lugar certo.
   */
  it('todo caminho de arquivo citado e rastreado pelo git', () => {
    const dead = CITATIONS.paths.filter((citation) => !TRACKED.has(citation.token))

    expect(
      dead.map((citation) => `${citation.file}:${citation.line} cita ${citation.token}`),
    ).toEqual([])
  })

  /**
   * O modo de falha é o *rename symbol*: ele reescreve o código e deixa a prosa
   * para trás, sem nada acusar. Foi o que motivou esta asserção —
   * `src/domain/date-window.ts` afirma que `serialToDate` trunca o serial, e a
   * afirmação atravessa dois módulos sem nenhuma amarra mecânica.
   *
   * **Escopo declarado, e as duas coisas que ela NÃO faz:**
   *
   * 1. **não cobre `PascalCase`.** Ali moram `REF`, `STATUS`, `AGENTE`,
   *    `DESEMBARACADA` — nomes de coluna da planilha, não símbolos. O falso
   *    positivo dominaria;
   * 2. **verifica existência, nunca veracidade.** Trocar `Math.floor` por
   *    `Math.round` em `serialToDate` deixa esta asserção verde e o comentário
   *    mentiroso. A metade cara da consistência continua sem guarda mecânica —
   *    e é de propósito que isto está escrito aqui, e não só no chat: guarda
   *    cujo limite não está declarado vira falsa segurança.
   */
  it('todo identificador em camelCase citado em comentário existe', () => {
    const declared = declaredTokens()
    const dead = CITATIONS.identifiers.filter((citation) => !declared.has(citation.token))

    expect(CITATIONS.identifiers.length).toBeGreaterThan(40)
    expect(
      dead.map((citation) => `${citation.file}:${citation.line} cita \`${citation.token}\``),
    ).toEqual([])
  })
})

/**
 * Data de dia: `dd/mm`, `dd/mm/aaaa` e `aaaa-mm-dd`, com um ou dois digitos no
 * dia e no mes.
 */
const DAY_DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/
const CODE_SPAN = /`[^`]*`/g

/**
 * **A data mora no registro, e o comentario cita o ID dele** (`D-76`): "(A-60)",
 * e nao a data do dia em que algo aconteceu. Comentario datado envelhece calado
 * — o fato muda, a data fica, e ninguem sabe se a frase ainda vale.
 *
 * **Entre crases, a data passa, e e de proposito:** e o valor do dominio — o
 * serial 1 e `01/01/1900`, o `Date` normaliza `2026-02-31` —, e nao o registro
 * de quando algo aconteceu.
 *
 * **O que fica de fora, declarado:** data em `.md`, que e documento e guarda a
 * data no registro; data em string ou em valor que nao e comentario, que e dado
 * — o `eta2` de uma fixture; mes e ano sozinhos, como `set/2026`; e a docstring
 * de Python, que o extrator nao le como comentario.
 *
 * **O alarme falso, declarado** — falha fechado, e a mensagem aponta a linha:
 * - o `//` de texto JSX, como numa URL, e lido como comentario ate o fim da linha;
 * - fracao e razao, como `1/2` e `24/7`, casam a forma `dd/mm`;
 * - o `#` dentro de docstring de Python e lido como comentario.
 *
 * **A omissao, declarada** — falha aberto: no texto JSX, a aspa simples solta
 * depois de espaco abre uma string, e o comentario seguinte na mesma linha nao e
 * lido.
 */
describe('nenhuma data fora de crase em comentário', () => {
  it('lê cada área e cada estilo — âncora contra guarda verde por vacuidade', () => {
    const lines = new Map<string, number>()
    for (const { area, style, comments } of COMMENTED) {
      lines.set(area, (lines.get(area) ?? 0) + comments.size)
      lines.set(style, (lines.get(style) ?? 0) + comments.size)
    }
    const floors = [
      ...COMMENTED_AREAS.map(({ name, floor }) => [name, floor] as const),
      ...Object.entries(STYLE_FLOORS),
    ]

    expect(
      floors
        .filter(([name, floor]) => (lines.get(name) ?? 0) < floor)
        .map(
          ([name, floor]) => `${name}: ${lines.get(name) ?? 0} linhas de comentario, piso ${floor}`,
        ),
    ).toEqual([])
  })

  it('toda data de dia em comentário está entre crases', () => {
    const dated = COMMENTED.flatMap(({ file, comments }) =>
      [...comments]
        .filter(([, text]) => DAY_DATE.test(text.replace(CODE_SPAN, '')))
        .map(([line]) => `${file}:${line}`),
    )

    expect(
      dated.map(
        (place) =>
          `${place} tem data fora de crase em comentário — a data mora no registro, e o comentário cita o ID dele (.claude/rules/comentarios.md, regra 4)`,
      ),
    ).toEqual([])
  })

  it('o apóstrofo do texto JSX não esconde o comentário que vem depois dele', () => {
    const { comments } = scanComments(
      'barra',
      'Pagina.tsx',
      "<p>d'agua {/* medido em 05/10/2026 */}</p>",
    )

    expect(comments.get(1)).toBe('/* medido em 05/10/2026 */')
  })

  it('a here-string do shell não tira o resto do arquivo da guarda', () => {
    const { comments } = scanComments(
      'cerquilha',
      'probe.sh',
      'grep -q x <<< "abc"\n# medido em 05/10/2026',
    )

    expect(comments.get(2)).toBe('# medido em 05/10/2026')
  })
})

/**
 * As peças de `.claude/`, no formato em que o `CLAUDE.md` as nomeia: skill por
 * `/nome`, subagente pelo nome sem extensão, hook e rule pelo nome do arquivo.
 */
function claudePieces(): string[] {
  const pieces: string[] = []

  if (existsSync('.claude/skills')) {
    for (const entry of readdirSync('.claude/skills', { withFileTypes: true })) {
      if (entry.isDirectory()) pieces.push(`/${entry.name}`)
    }
  }
  if (existsSync('.claude/agents')) {
    for (const file of readdirSync('.claude/agents')) {
      if (file.endsWith('.md')) pieces.push(file.replace(/\.md$/, ''))
    }
  }
  for (const [directory, extension] of [
    ['.claude/hooks', '.sh'],
    ['.claude/rules', '.md'],
  ] as const) {
    if (!existsSync(directory)) continue
    for (const file of readdirSync(directory)) {
      if (file.endsWith(extension)) pieces.push(file)
    }
  }

  return pieces
}

const PIECES = claudePieces()

describe('o CLAUDE.md menciona toda peça de .claude/', () => {
  it('encontra as peças', () => {
    expect(PIECES.length).toBeGreaterThan(5)
  })

  /**
   * O defeito que motivou a asserção (ADR-0007): `/nova-pagina` foi criada e a
   * tabela de marcos seguiu mandando criá-la por quatro dias.
   * `conferir-alinhamento.sh` deveria ter pego — mas roda em `ConfigChange`, e
   * editar o `CLAUDE.md` não é mudança de configuração. O evento nunca dispara
   * para o lado por onde o defeito entra.
   */
  it.each(PIECES)('%s aparece no CLAUDE.md', (piece) => {
    const claudeMd = readFileSync('CLAUDE.md', 'utf-8')

    expect(
      claudeMd.includes(piece),
      `${piece} existe em .claude/ e o CLAUDE.md não a menciona — atualize o bloco ## Infraestrutura de agente`,
    ).toBe(true)
  })
})

/**
 * O nome de cada peça vive em DOIS lugares: o diretório da skill — ou o arquivo
 * do subagente —, que é por onde o Claude Code a invoca, e o `name:` do
 * frontmatter, que é como ela se anuncia na listagem. O frontmatter não é
 * executado, então divergir não quebra nada na hora: a peça passa a ser chamada
 * por um nome e a se apresentar por outro, e nada acusa.
 *
 * O modo de falha é renomear — `git mv` do diretório sem tocar no frontmatter,
 * ou o inverso. A asserção acima cobre o elo com o `CLAUDE.md`; esta cobre o elo
 * entre as duas fontes do nome. Sem lista fixa: a expectativa é o disco.
 */
function declaredNames(): { path: string; onDisk: string; declared: string }[] {
  const found: { path: string; onDisk: string; declared: string }[] = []
  const declaredIn = (file: string): string =>
    /^name:\s*(.+)$/m.exec(readFileSync(file, 'utf-8'))?.[1]?.trim() ?? ''

  if (existsSync('.claude/skills')) {
    for (const entry of readdirSync('.claude/skills', { withFileTypes: true })) {
      const file = `.claude/skills/${entry.name}/SKILL.md`
      if (!entry.isDirectory() || !existsSync(file)) continue
      found.push({ path: file, onDisk: entry.name, declared: declaredIn(file) })
    }
  }
  if (existsSync('.claude/agents')) {
    for (const file of readdirSync('.claude/agents')) {
      if (!file.endsWith('.md')) continue
      const path = `.claude/agents/${file}`
      found.push({ path, onDisk: file.replace(/\.md$/, ''), declared: declaredIn(path) })
    }
  }

  return found
}

const DECLARED = declaredNames()

describe('o nome declarado por cada peça de .claude/ é o nome em disco', () => {
  it('encontra as peças — âncora contra guarda verde por vacuidade', () => {
    expect(DECLARED.length).toBeGreaterThan(5)
  })

  it.each(DECLARED)('$onDisk declara o próprio nome', ({ path, onDisk, declared }) => {
    expect(declared, `${path} declara "name: ${declared}", mas é invocada como "${onDisk}"`).toBe(
      onDisk,
    )
  })
})

/**
 * Os limiares que `D-16` declara, lidos do próprio texto da decisão: mudar a
 * decisão muda a expectativa, sem lista fixa aqui.
 */
function decisionD16(): string {
  const governance = readFileSync('docs/10-governanca.md', 'utf-8')
  const line = governance.split('\n').find((candidate) => candidate.startsWith('| D-16 |'))

  if (line === undefined) throw new Error('D-16 não está em docs/10-governanca.md')
  return line
}

function thresholdOf(decision: string, pattern: RegExp): number {
  const found = decision.match(pattern)?.[1]
  if (found === undefined) throw new Error(`limiar não encontrado em D-16: ${pattern}`)
  return Number(found)
}

const OBSERVED = 'Gatilhos observados'

/**
 * Linhas que executam algo: sem vazias, sem `//`, sem bloco `/** *\/`. Contar o
 * arquivo inteiro faria o comentário de porquê — obrigatório pela régua de
 * `.claude/rules/comentarios.md` — empurrar o gatilho sozinho.
 */
function codeLines(path: string): number {
  let inBlock = false
  let count = 0

  for (const raw of readFileSync(path, 'utf-8').split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('/*')) inBlock = true

    if (inBlock || line.startsWith('//') || line.startsWith('*')) {
      if (line.endsWith('*/')) inBlock = false
      continue
    }
    count += 1
  }

  return count
}

/**
 * Uma decisão que declara os próprios gatilhos de reavaliação só serve se
 * alguém os medir. `D-16` declarou quatro, e **dois foram
 * atingidos sem que ninguém notasse**: `web/src/router.ts` passou de ~100
 * linhas em algum ponto entre `H-15` e `H-21`, e o carregamento por rota chegou
 * com a Página Histórico sob demanda, em `H-21` — o próprio gatilho que a
 * decisão cita como motivo para reconsiderar o `react-router`.
 *
 * Nenhum dos dois muda a conclusão, e não é isso que a asserção defende: ela
 * defende que o gatilho seja **observado e registrado**, com o número medido no
 * texto. Gatilho declarado e nunca conferido é pior que gatilho nenhum — dá a
 * impressão de que a decisão está sendo revisitada quando não está.
 */
describe('os gatilhos de reavaliação de D-16 foram observados', () => {
  const decision = decisionD16()

  it('encontra a decisão e seus limiares — âncora contra guarda verde por vacuidade', () => {
    expect(decision).toContain('react-router')
    expect(thresholdOf(decision, /páginas passarem de ~(\d+)/)).toBeGreaterThan(0)
    expect(thresholdOf(decision, /ultrapassar ~(\d+) \*\*linhas de código\*\*/)).toBeGreaterThan(0)
  })

  /**
   * **Linhas de código, não linhas de arquivo** (`D-16`). Contar o arquivo
   * inteiro mede a coisa errada: comentário de porquê é 24%
   * de `router.ts` por política deste repositório, então documentar bem
   * aproximava do limiar sem acrescentar um ramo sequer ao fluxo. Medido:
   * 132 linhas no total, 79 de código.
   */
  it('o tamanho de router.ts está sob o limiar, ou o valor atual está registrado', () => {
    const limit = thresholdOf(decision, /ultrapassar ~(\d+) \*\*linhas de código\*\*/)
    const code = codeLines('web/src/router.ts')

    if (code <= limit) return

    expect(
      decision.includes(OBSERVED) && decision.includes(`${code} de código`),
      `web/src/router.ts tem ${code} linhas de código, acima das ~${limit} que D-16 declara como ` +
        'gatilho. Reavalie a decisão e registre o resultado na linha dela, com o número medido.',
    ).toBe(true)
  })

  it('o número de páginas está sob o limiar, ou o valor atual está registrado', () => {
    const limit = thresholdOf(decision, /páginas passarem de ~(\d+)/)
    const router = readFileSync('web/src/router.ts', 'utf-8')
    const pages = router.match(/\bid: '/g)?.length ?? 0

    // Âncora: seis do menu e o detalhe. Zero aqui significaria regex quebrada,
    // e a comparação abaixo passaria sem medir nada.
    expect(pages).toBeGreaterThanOrEqual(6)
    if (pages <= limit) return

    expect(
      decision.includes(OBSERVED) && decision.includes(`${pages} páginas`),
      `web/src/router.ts declara ${pages} páginas, acima das ~${limit} que D-16 declara como gatilho.`,
    ).toBe(true)
  })

  it('carregamento por rota, se existir, está registrado na decisão', () => {
    const shell = readFileSync('web/src/App.tsx', 'utf-8')
    if (!shell.includes('lazy(')) return

    expect(
      decision.includes(OBSERVED) && decision.includes('carregamento por rota'),
      'web/src/App.tsx carrega página por `lazy`, que é o gatilho de carregamento por rota de ' +
        'D-16. Reavalie a decisão e registre o resultado na linha dela.',
    ).toBe(true)
  })
})

const BACKLOG = readFileSync('docs/06-backlog.md', 'utf-8')

/** Uma entrada por `### H-NN`, com o tamanho declarado e se há bloco de conclusão. */
function historiasDoBacklog(): { id: string; tamanho: string; concluida: boolean }[] {
  return BACKLOG.split(/\n(?=### H-\d+)/).flatMap((bloco) => {
    const id = /^### (H-\d+)/.exec(bloco)?.[1]
    if (id === undefined) return []

    return [
      {
        id,
        tamanho: /\*\*Tamanho:\*\*\s*(\w)/.exec(bloco)?.[1] ?? '?',
        concluida: /✅ \*\*CONCLUÍDA/.test(bloco),
      },
    ]
  })
}

/**
 * Os cinco números da linha de Total: o total, quantas estão concluídas, e a
 * contagem por tamanho. Lê da linha, e não de lista fixa — mudar a tabela muda
 * a expectativa, como em todas as outras asserções deste arquivo. O total e as
 * concluídas vivem em região `conta`, e o número é lido sem os marcadores.
 */
function totalDeclarado(): { total: number; concluidas: number; p: number; m: number; g: number } {
  const linha = BACKLOG.split('\n')
    .find((candidata) => candidata.startsWith('| **Total**'))
    ?.replace(/<!-- \/?conta[^>]*-->/g, '')
  if (linha === undefined) throw new Error('a tabela de resumo não tem linha de Total')

  const numeros = [...linha.matchAll(/\*\*(\d+)\*\*|concluídas: (\d+)/g)].map((achado) =>
    Number(achado[1] ?? achado[2]),
  )
  if (numeros.length !== 5) {
    throw new Error(`a linha de Total traz ${numeros.length} números, e a asserção espera 5`)
  }

  const [total, concluidas, p, m, g] = numeros as [number, number, number, number, number]
  return { total, concluidas, p, m, g }
}

describe('o resumo do backlog concorda com as histórias', () => {
  /**
   * Guarda contra guarda verde por vacuidade: se o parse dos blocos quebrar, a
   * asserção seguinte passaria comparando zero com zero.
   */
  it('encontra as histórias — âncora contra guarda verde por vacuidade', () => {
    expect(historiasDoBacklog().length).toBeGreaterThan(30)
  })

  it('o total, as concluídas e os tamanhos batem com os blocos', () => {
    const todas = historiasDoBacklog()
    const declarado = totalDeclarado()

    expect(declarado.total).toBe(todas.length)
    expect(declarado.concluidas).toBe(todas.filter((historia) => historia.concluida).length)
    expect(declarado.p).toBe(todas.filter((historia) => historia.tamanho === 'P').length)
    expect(declarado.m).toBe(todas.filter((historia) => historia.tamanho === 'M').length)
    expect(declarado.g).toBe(todas.filter((historia) => historia.tamanho === 'G').length)
  })
})

/**
 * O índice do backlog envelhece em silêncio: história nova nasce no fim do
 * arquivo, e nada obriga quem a escreve a voltar ao topo. Sem esta guarda, o
 * índice descreveria um backlog que existiu, que é o mesmo modo de falha do
 * comentário de `web/src/router.ts` — corrigido em `H-38` depois de afirmar por
 * quase um dia um caminho que ninguém havia construído.
 *
 * As âncoras são HTML explícito (`<a id="h-37">`) e não o slug automático do
 * título: `#h-37` sobrevive a uma reescrita do título, e o slug — que embute o
 * título inteiro — não.
 */
describe('o índice do backlog alcança todas as histórias', () => {
  const ancoras = [...BACKLOG.matchAll(/^<a id="(h-\d+)"><\/a>$/gm)].map((achado) => achado[1])
  const entradas = [...BACKLOG.matchAll(/^- \[H-\d+ — .+\]\(#(h-\d+)\)( ✅)?$/gm)].map(
    (achado) => achado[1],
  )

  it('encontra âncoras e entradas — contra guarda verde por vacuidade', () => {
    expect(ancoras.length).toBeGreaterThan(30)
    expect(entradas.length).toBeGreaterThan(30)
  })

  it('toda história tem âncora, e toda âncora tem entrada no índice', () => {
    const historias = historiasDoBacklog().map((historia) => historia.id.toLowerCase())

    expect([...ancoras].sort()).toEqual([...historias].sort())
    expect([...entradas].sort()).toEqual([...historias].sort())
  })

  /**
   * O marcador de conclusão do índice concorda com o bloco da história.
   *
   * Marcar história por história já foi tentado e falhou (docs/06-backlog.md):
   * as marcas congelaram e o índice afirmou `H-13` aberta, contra o bloco
   * `✅ CONCLUÍDA` dela. O defeito não era a marca, era ela ser manual e não
   * verificada — esta asserção é o que autorizou a marca a voltar. Sem lista
   * fixa: o estado sai do próprio bloco.
   */
  it('o ✅ do índice concorda com o bloco de cada história', () => {
    const concluidas = new Set(
      historiasDoBacklog()
        .filter((historia) => historia.concluida)
        .map((historia) => historia.id.toLowerCase()),
    )

    const divergentes = [...BACKLOG.matchAll(/^- \[H-\d+ — .+\]\(#(h-\d+)\)( ✅)?$/gm)]
      .map((achado) => ({ id: achado[1] ?? '', marcada: achado[2] !== undefined }))
      .filter((entrada) => concluidas.has(entrada.id) !== entrada.marcada)
      .map((entrada) => entrada.id)

    expect(divergentes).toEqual([])
  })

  /** Link para âncora que não existe é buraco silencioso: não erra, só não vai. */
  it('todo destino citado no índice está definido no arquivo', () => {
    const definidas = new Set(
      [...BACKLOG.matchAll(/^<a id="([\w-]+)"><\/a>$/gm)].map((achado) => achado[1]),
    )
    const citados = [...BACKLOG.matchAll(/\]\(#([\w-]+)\)/g)].map((achado) => achado[1])

    expect(citados.length).toBeGreaterThan(30)
    expect([...new Set(citados)].filter((destino) => !definidas.has(destino))).toEqual([])
  })

  /** O caminho de volta, do meio de uma história de cem linhas. */
  it('toda história oferece o retorno ao índice', () => {
    const semRetorno = BACKLOG.split(/\n(?=<a id="h-\d+")/)
      .filter((bloco) => /^<a id="(h-\d+)"/.test(bloco))
      .filter((bloco) => !bloco.includes('[↑ Índice](#indice)'))
      .map((bloco) => /^<a id="(h-\d+)"/.exec(bloco)?.[1])

    expect(semRetorno).toEqual([])
  })
})
