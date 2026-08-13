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
 * registro da rota e o teste dela. `/fatia` pergunta e pega — mas custa uma
 * conversa por história, e só funciona enquanto alguém invoca a skill.
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
 *    caminho de arquivo. Nasceu verde: 331 citações e 18 caminhos, zero mortos
 *    em 12/08/2026. O ID precisa ser **definido** em `docs/`, não só aparecer
 *    lá: citação satisfazia a versão anterior, e ID cuja definição some mas
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
 *    atualiza o código e deixa a prosa para trás, em silêncio. Medido em
 *    12/08/2026: 120 citações, 70 identificadores distintos, zero ausentes.
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

function documentedRoutes(): DocumentedRoute[] {
  const document = readFileSync('docs/05-contratos-api.md', 'utf-8')
  const routes: DocumentedRoute[] = []

  for (const section of document.split(/^### /m)) {
    const heading = section.match(/^`(GET|POST|PUT|PATCH|DELETE) ([^`]+)`/)
    if (heading?.[1] === undefined || heading[2] === undefined) continue

    const pending = section.match(/^> \*\*Pendente de `(H-\d+)`/m)
    routes.push({
      method: heading[1],
      url: heading[2],
      pendingStory: pending?.[1] ?? null,
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
    expect(DOCUMENTED.some((route) => route.pendingStory !== null)).toBe(true)
    expect(CLOSED.size).toBeGreaterThan(0)
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

/** Todo `.ts`/`.tsx` de `src/` e `web/src`, recursivamente. */
function sourceFiles(): string[] {
  const found: string[] = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name)) found.push(path)
    }
  }

  walk('src')
  walk('web/src')
  return found
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
 * célula** de linha de tabela. Nenhuma lista fixa — medido em 12/08/2026, os
 * 261 IDs distintos de `docs/` têm posição de definição.
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

const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/
/**
 * As onze famílias de âncora do plano. A ordem é do mais longo para o mais
 * curto por higiene, não por necessidade: os `\b` já impedem que `D-\d{2}` case
 * dentro de `TD-05` ou `IND-22`, e que `R-\d{2}` case dentro de `ADR-0004` —
 * em todos falta fronteira de palavra antes da letra.
 */
const PLAN_ID =
  /\b(?:ADR-\d{4}|RNF-\d{2}|IND-\d{2}|ALE-\d{2}|TD-\d{2}(?:\.\d)?|RF-\d{2}|H-\d{2}|A-\d{2}|D-\d{2}|P-\d{2}|R-\d{2})\b/g
const REPO_PATH = /\b(?:docs|config|tools|tests)\/[A-Za-z0-9._/-]+/g
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

  for (const file of sourceFiles()) {
    const lines = readFileSync(file, 'utf-8').split('\n')

    lines.forEach((text, index) => {
      if (!COMMENT_LINE.test(text)) return

      for (const match of text.matchAll(PLAN_ID)) {
        ids.push({ file, line: index + 1, token: match[0] })
      }
      for (const match of text.matchAll(REPO_PATH)) {
        paths.push({ file, line: index + 1, token: match[0].replace(/[.,;:)]+$/, '') })
      }
      for (const match of text.matchAll(BACKTICKED)) {
        const token = match[1] ?? ''
        if (IDENTIFIER.test(token)) identifiers.push({ file, line: index + 1, token })
      }
    })
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

  for (const file of sourceFiles()) {
    const code = readFileSync(file, 'utf-8')
      .split('\n')
      .filter((line) => !COMMENT_LINE.test(line))
      .join('\n')
    absorb(code)
  }
  for (const file of ['tsconfig.json', 'package.json', 'vitest.config.ts']) {
    if (existsSync(file)) absorb(readFileSync(file, 'utf-8'))
  }

  return tokens
}

const CITATIONS = citationsInComments()
const DEFINED = definedIds()

describe('toda âncora citada em comentário ainda existe', () => {
  it('encontra citações — âncora contra guarda verde por vacuidade', () => {
    // Medido em 12/08/2026, contando só linhas de comentário de `src/` e
    // `web/src`: 331 IDs e 18 caminhos. O piso é folgado de propósito — o que
    // ele pega é a regex que parou de casar, não a variação normal de refatorar.
    expect(CITATIONS.ids.length).toBeGreaterThan(200)
    expect(CITATIONS.paths.length).toBeGreaterThan(5)
  })

  it('todo ID citado é DEFINIDO em docs/, não apenas citado lá também', () => {
    // Âncora: se o extrator de definição quebrar, isto reprova antes de a
    // asserção abaixo passar a acusar os 331 IDs de uma vez.
    expect(DEFINED.size).toBeGreaterThan(200)

    const dead = CITATIONS.ids.filter((citation) => !DEFINED.has(citation.token))

    expect(
      dead.map((citation) => `${citation.file}:${citation.line} cita ${citation.token}`),
    ).toEqual([])
  })

  it('todo caminho de arquivo citado existe em disco', () => {
    const dead = CITATIONS.paths.filter((citation) => !existsSync(citation.token))

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
   * O defeito que motivou a asserção tem data: `/nova-pagina` foi criada em
   * 07/08/2026 e a tabela de marcos seguiu mandando criá-la por quatro dias.
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
