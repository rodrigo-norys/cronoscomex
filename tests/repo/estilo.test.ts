import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A guarda do vocabulário de cor — a metade computável do épico E9.
 *
 * `H-39` declarou a camada de tema e `H-40` a `H-42` migraram os 24 arquivos
 * consumidores. Nada impede que o próximo `.tsx` volte a escrever
 * `text-slate-600`: o Tailwind gera a classe, o build passa, e a divergência só
 * apareceria numa auditoria seguinte — foi assim que o conjunto chegou a 40
 * classes de cor distintas e zero tokens, medido em
 * `docs/estilizacao/RESULTADO.md`.
 *
 * **Ela entra em `H-42`, e não em `H-39`, porque só aqui pode passar.**
 * Declarada antes, reprovaria enquanto `H-40` e `H-41` não tivessem migrado — e
 * guarda que nasce vermelha é desligada, não obedecida.
 *
 * Duas asserções, uma por regra do corpus:
 *
 * 1. **`C01`** — nenhum utilitário de passo bruto de paleta. O que se escreve é
 *    o papel (`text-text-muted`), nunca o degrau (`text-slate-400`);
 * 2. **`C02`** — nenhum literal hexadecimal de cor. É o defeito que `H-42`
 *    acabou de consertar em `web/src/pages/History.tsx`, e que nenhuma regex de
 *    utilitário alcançaria: seis valores passados direto às props do Recharts,
 *    dois deles já divergindo da paleta da versão instalada (`ACHADO 8`).
 *
 * O escopo é `web/src/` — `web/tests/` fica de fora de propósito: teste que
 * verifica cor precisa citar cor, e `web/tests/WorkbookSetup.test.tsx` cita.
 */

/** As onze famílias cromáticas da paleta do Tailwind, mais os cinza. */
const PALETTE_FAMILIES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|')

/**
 * `(^|[\s'"\`{])` ancora o começo do utilitário: sem isso, `bg-channel-red-bg`
 * casaria pelo trecho `red-b`, e todo token de papel com nome de cor viraria
 * falso positivo.
 */
const RAW_STEP = new RegExp(
  `(^|[\\s'"\`{])(text|bg|border|ring|fill|stroke|divide|outline|decoration|accent|caret|shadow)-(${PALETTE_FAMILIES})-\\d`,
)

const HEX_LITERAL = /#[0-9a-fA-F]{6}\b/

/**
 * Apaga o conteúdo dos comentários preservando as linhas.
 *
 * **O critério é o utilitário, nunca a prosa**, e até `H-64` isso era
 * aproximado por "`className` ou `@apply` na mesma linha". A aproximação erra
 * dos dois lados, e o lado caro apareceu na prova por mutação de `H-64`:
 * `AppSidebar.tsx` extrai as classes para `ITEM_BASE`, `ITEM_CURRENT` e
 * `ITEM_REST` — constantes sem `className` nenhum na linha —, e um
 * `transition-colors duration-150` plantado ali passou por todas as asserções.
 * `shadow-` e `font-bold` de `D-22` tinham o mesmo ponto cego.
 *
 * Prosa é comentário; apagá-lo dá o critério exato em vez do aproximado. O
 * `(?<!:)` preserva `https://`, que aparece em URL de documentação.
 */
function semComentarios(fonte: string): string {
  const embranquecer = (trecho: string): string => trecho.replace(/[^\n]/g, ' ')

  return fonte.replace(/\/\*[\s\S]*?\*\//g, embranquecer).replace(/(?<!:)\/\/[^\n]*/g, embranquecer)
}

/**
 * `SC 1.4.3` e `SC 1.4.11` isentam componente de interface inativo, e o corpus
 * registra a isenção. O conjunto **de fato** unificou o estado desabilitado num
 * token só, em `H-41` — mas a guarda não é o lugar de cobrar consistência que a
 * norma não exige: reprovar aqui transformaria uma decisão de papel de UI em
 * regra normativa, que é o que `docs/estilizacao/corpus-estilo.md` evita.
 */
const EXEMPT = /disabled:/

interface Occurrence {
  readonly file: string
  readonly line: number
  readonly text: string
}

/** Todo `.ts`/`.tsx` de `web/src/`, recursivamente. */
function interfaceFiles(): string[] {
  const found: string[] = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name)) found.push(path)
    }
  }

  walk('web/src')
  return found
}

function occurrencesOf(pattern: RegExp): Occurrence[] {
  const found: Occurrence[] = []

  for (const file of interfaceFiles()) {
    const lines = semComentarios(readFileSync(file, 'utf-8')).split('\n')

    lines.forEach((text, index) => {
      if (EXEMPT.test(text)) return
      if (pattern.test(text)) found.push({ file, line: index + 1, text: text.trim() })
    })
  }

  return found
}

const FILES = interfaceFiles()

describe('nenhum passo bruto de paleta em web/src', () => {
  it('encontra os arquivos — âncora contra guarda verde por vacuidade', () => {
    // 30 arquivos em 21/08/2026, ao fechar `H-42`. O piso é folgado: o que ele
    // pega é o coletor que parou de andar na árvore, não arquivo a mais ou a
    // menos.
    expect(FILES.length).toBeGreaterThan(20)
  })

  it('a regex reconhece o passo bruto e ignora o token de papel', () => {
    // Âncora da regex, não do conjunto: sem isto, um erro de ancoragem faria as
    // duas asserções abaixo passarem por nunca casarem nada.
    expect(RAW_STEP.test('className="text-slate-600"')).toBe(true)
    expect(RAW_STEP.test('className="border-b border-amber-300 p-4"')).toBe(true)
    expect(RAW_STEP.test('className="bg-channel-red-bg text-state-error-fg"')).toBe(false)
    expect(RAW_STEP.test('className="text-text-muted border-border-control"')).toBe(false)
    expect(HEX_LITERAL.test("stroke='#e2e8f0'")).toBe(true)
    expect(HEX_LITERAL.test("stroke='var(--color-chart-grid)'")).toBe(false)
  })

  it('C01 — nenhum utilitário cita degrau de paleta', () => {
    const raw = occurrencesOf(RAW_STEP)

    expect(raw.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  it('C02 — nenhum literal hexadecimal de cor', () => {
    const hex = occurrencesOf(HEX_LITERAL)

    expect(hex.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

/**
 * `H-45`, `C04`. Um mesmo papel de UI usa a mesma combinação de raio, borda e
 * sombra nas sete páginas.
 *
 * `SC 3.2.4 Consistent Identification` **incide** aqui: a determinação `Z1` do
 * passo zero mediu URIs distintas em `web/src/router.ts`, então as sete telas
 * são um *set of web pages*. Fosse URI única, isto seria preferência.
 *
 * Duas asserções, e as duas são de conjunto — a violação não existe dentro de um
 * arquivo, é a diferença entre arquivos, e por isso `revisor-estilo` recebe a
 * casca e as sete páginas de uma vez.
 */

/**
 * O papel majoritário: "seção de conteúdo sobre fundo elevado".
 *
 * O `p-` uniforme no fim é o sinal sintático que separa esse papel do de
 * **controle** — `input`, `select` e botão usam `px-`/`py-` assimétricos e a
 * borda de controle, que é outro papel e outro token de propósito.
 */
const SECTION_ROLE = /rounded-container border border-\S+ bg-surface-raised p-\d/

/** O papel "ressalva/fora de escopo", distinto e consistente entre si. */
const CAVEAT_ROLE = /border-dashed border-\S+ bg-surface-sunken/

describe('C04 — o mesmo papel de UI tem a mesma forma', () => {
  it('as regexes reconhecem cada papel, e não se confundem', () => {
    // Âncora das regexes, não do conjunto: sem isto, um erro de ancoragem faria
    // as duas asserções abaixo passarem por nunca casarem nada — a mesma
    // armadilha que a âncora de `C01` já cobre para o passo bruto.
    expect(
      SECTION_ROLE.test('rounded-container border border-border-subtle bg-surface-raised p-4'),
    ).toBe(true)
    // `H-61` trocou o raio do papel: o valor antigo deixa de casar, e é isso que
    // impede um arquivo novo de nascer com o raio de antes.
    expect(SECTION_ROLE.test('rounded border border-border-subtle bg-surface-raised p-4')).toBe(
      false,
    )
    expect(
      SECTION_ROLE.test('rounded-container border border-border-strong bg-surface-raised p-6'),
    ).toBe(true)
    // Controle não é seção: `px-`/`py-` assimétricos, e borda de controle.
    expect(
      SECTION_ROLE.test('rounded border border-border-control bg-surface-raised px-2 py-1.5'),
    ).toBe(false)
    expect(CAVEAT_ROLE.test('border-dashed border-border-subtle bg-surface-sunken p-4')).toBe(true)
    expect(CAVEAT_ROLE.test('rounded border border-border-subtle bg-surface-raised p-4')).toBe(
      false,
    )
  })

  /**
   * O painel MODAL é papel distinto, e a exceção é declarada (`H-62`).
   *
   * `ConflictDialog` flutua sobre o `overlay-scrim`, e desde `H-62` não tem
   * sombra: o que o separa do que está atrás é a borda. `border-border-subtle`
   * mede **1,25:1** e `border-border-strong` mede **1,91:1 contra o véu** — os
   * dois abaixo do piso de 3:1 que o critério pede. Quem serve é
   * `border-border-modal`, que existe por causa do que está atrás: 4,66:1 no
   * claro e 5,66:1 no escuro.
   *
   * O sinal sintático é `max-h-[`: só o modal limita a própria altura à
   * viewport, porque só ele não rola com a página.
   */
  const MODAL_ROLE = /max-h-\[/

  it('toda seção de conteúdo usa a borda sutil, e nenhuma desvia', () => {
    const desviantes = occurrencesOf(SECTION_ROLE).filter(
      (one) => !/border-border-subtle/.test(one.text) && !MODAL_ROLE.test(one.text),
    )

    expect(desviantes.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  // O modal não fica sem regra: ele usa a borda forte, e é a dele.
  it('o painel modal usa a borda forte, e nenhum outro papel a usa', () => {
    const modais = occurrencesOf(MODAL_ROLE)

    expect(modais.length).toBeGreaterThan(0)
    for (const modal of modais) expect(modal.text).toContain('border-border-modal')
  })

  /**
   * Os painéis de ressalva são papel **distinto**, e a distinção é legítima
   * porque eles são consistentes **entre si**. O que a asserção guarda é isso:
   * um quarto painel de ressalva com outra borda quebraria o papel.
   */
  it('todo painel de ressalva usa a mesma tripla', () => {
    const ressalvas = occurrencesOf(CAVEAT_ROLE)

    expect(ressalvas.length).toBeGreaterThan(0)
    for (const uma of ressalvas) expect(uma.text).toMatch(/border-border-subtle/)
  })
})

/**
 * `H-46`, `R01` e `R04`. A responsividade que a estática alcança.
 *
 * O que ela **não** alcança é `VN-1`, em `H-47`: se a página de fato rola na
 * horizontal a 320 px CSS só se vê no navegador. O que estas asserções guardam é
 * o que produz aquela rolagem, e é verificável sem abrir nada.
 *
 * **A exigência de 320 px não vem do telefone**, e sim de `SC 1.4.10 Reflow`: o
 * *Understanding* explica que 320 px CSS equivale a uma janela de 1280 px com
 * zoom em 400 %. O alvo é o desktop do operador; não há dispositivo móvel no
 * escopo.
 */

/** Toda `<table>` do conjunto, com o arquivo e a linha. */
function tables(): Occurrence[] {
  return occurrencesOf(/<table\b/)
}

describe('R01 — toda tabela rola dentro do próprio invólucro', () => {
  it('encontra as tabelas — âncora contra guarda verde por vacuidade', () => {
    // Quatro em 31/08/2026, ao fechar `H-46`: `ProcessTable`, `History`,
    // `Performance` e `ConflictDialog`.
    expect(tables().length).toBeGreaterThanOrEqual(4)
  })

  /**
   * A exceção bidimensional de `SC 1.4.10` cobre a **tabela**, e não a página:
   * sem o invólucro, ela arrasta as notas irmãs e a barra de filtros junto — e
   * essa é a rolagem que o critério proíbe.
   *
   * O invólucro é procurado nas **três** linhas acima da tabela, e não na mesma:
   * o JSX quebra a linha, e exigir os dois no mesmo texto reprovaria o padrão
   * que `ProcessTable` já usava antes desta história.
   */
  it('nenhuma tabela fica fora de um contêiner com overflow-x-auto', () => {
    const soltas = tables().filter((one) => {
      const lines = readFileSync(one.file, 'utf-8').split('\n')
      const before = lines.slice(Math.max(0, one.line - 4), one.line).join(' ')
      return !/overflow-x-auto/.test(before)
    })

    expect(soltas.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

describe('R04 — todo grid declara o valor abaixo do breakpoint', () => {
  /**
   * `grid-cols-1` implícito é o valor inicial do CSS, e escrevê-lo é o que faz a
   * intenção aparecer no código: sem ele, quem lê não sabe se uma coluna é
   * decisão ou esquecimento.
   *
   * O contraexemplo que `R04` admite — `max-width: none`, valor inicial que não
   * precisa de contraparte — não se aplica aqui: `grid-template-columns` **tem**
   * valor abaixo do breakpoint, e ele é observável na tela.
   */
  it('nenhum grid tem contagem de colunas só com prefixo', () => {
    const semBase = occurrencesOf(/\b(?:sm|md|lg|xl):grid-cols-/).filter(
      (one) =>
        !/\bgrid-cols-(?!\S*:)/.test(one.text.replace(/\b(?:sm|md|lg|xl):grid-cols-\S*/g, '')),
    )

    expect(semBase.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

describe('R03 — o texto do gráfico acompanha a fonte-base', () => {
  /**
   * `SC 1.4.4`. O React converte `fontSize: 12` para pixel, e pixel não
   * acompanha a fonte-base que o operador escolheu no navegador. `width={48}` e
   * `margin={{…}}` continuam numéricos de propósito: são **geometria** do
   * Recharts, não tipografia.
   */
  it('nenhum fontSize numérico nas props do gráfico', () => {
    const pixels = occurrencesOf(/fontSize:\s*\d/)

    expect(pixels.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

/**
 * `H-57`, `D-21`. Todo token de COR tem valor nos dois esquemas.
 *
 * O modo de falha é silencioso e assimétrico: um token declarado só no claro
 * não some no escuro — ele **mantém o valor claro**, e a tela escura ganha uma
 * mancha branca que ninguém vê até abrir o sistema em modo escuro. Nenhum teste
 * de componente pega isso, porque o valor existe e o utilitário resolve.
 *
 * A recíproca também reprova, e é o caso-limite do backlog: raio, velocidade e
 * curva **não** são cor, e duplicá-los sob a media query seria ruído que a
 * próxima fatia copiaria. Por isso a asserção compara os dois conjuntos nos
 * dois sentidos, e não só "tudo que está no claro está no escuro".
 */
const CSS = readFileSync('web/src/index.css', 'utf-8')

/** Os nomes de variável declarados dentro de um bloco delimitado por chaves. */
function tokensDe(fonte: string): string[] {
  return [...fonte.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((one) => one[1] as string)
}

function bloco(marcador: string): string {
  const inicio = CSS.indexOf(marcador)
  if (inicio === -1) throw new Error(`bloco ${marcador} nao encontrado em web/src/index.css`)

  let profundidade = 0
  for (let i = CSS.indexOf('{', inicio); i < CSS.length; i++) {
    if (CSS[i] === '{') profundidade++
    else if (CSS[i] === '}' && --profundidade === 0) return CSS.slice(inicio, i)
  }
  throw new Error(`bloco ${marcador} nao fecha`)
}

describe('D-21 — todo token de cor tem par no esquema escuro', () => {
  const claros = tokensDe(bloco('@theme static'))
  const escuros = tokensDe(bloco('@media (prefers-color-scheme: dark)'))

  it('encontra os dois blocos — âncora contra guarda verde por vacuidade', () => {
    // 44 tokens de cor em 01/09/2026, ao fechar `H-57`. O piso é folgado: o que
    // ele pega é o parser que parou de casar, não token a mais ou a menos.
    expect(claros.length).toBeGreaterThan(30)
    expect(escuros.length).toBeGreaterThan(30)
  })

  it('nenhum token de cor fica sem valor no escuro', () => {
    const semPar = claros.filter(
      (token) => token.startsWith('--color-') && !escuros.includes(token),
    )

    expect(semPar).toEqual([])
  })

  it('nenhum token do escuro deixa de existir no claro', () => {
    expect(escuros.filter((token) => !claros.includes(token))).toEqual([])
  })

  // Raio, velocidade e curva não mudam porque o sistema está escuro.
  it('nenhum token que não seja cor aparece sob a media query', () => {
    expect(escuros.filter((token) => !token.startsWith('--color-'))).toEqual([])
  })

  // `color-scheme` sozinho decide a cor das barras de rolagem e dos controles
  // nativos — os quatro `input type="date"` e os três `select` do conjunto.
  it('declara os dois esquemas em color-scheme', () => {
    expect(/:root\s*\{[^}]*color-scheme:\s*light dark/.test(CSS)).toBe(true)
  })
})

/**
 * `H-59`, `SC 1.4.10`. Trilha de grid explícita encolhe até zero.
 *
 * `1fr` é `minmax(auto, 1fr)`, e o `auto` mínimo é a largura **intrínseca** do
 * conteúdo: um grid com `[1fr_20rem]` e uma tabela larga dentro recusa encolher
 * e empurra a página para fora da tela. **O `overflow-x-auto` de `R01` não
 * alcança isto** — ele está na tabela, e quem se recusa a encolher é a trilha,
 * acima dela.
 *
 * Medido em 01/09/2026, com a Página Operacional: `lg:grid-cols-[1fr_20rem]`
 * estourava o documento entre 1024 px, onde `lg:` liga, e ~1240 px. `H-59`
 * estreitou a coluna de conteúdo em 216 px e levou o estouro até 1440 —
 * revelando o defeito em vez de criá-lo. Com `minmax(0,1fr)`, zero estouros em
 * 320, 360, 768, 1024, 1064, 1280 e 1440.
 */
describe('SC 1.4.10 — trilha de grid explícita encolhe até zero', () => {
  const TRILHA_EXPLICITA = /grid-cols-\[[^\]]*\]/

  it('a regex reconhece a trilha rígida e ignora a que encolhe', () => {
    expect(/(?<!minmax\(0,)1fr/.test('lg:grid-cols-[1fr_20rem]')).toBe(true)
    expect(/(?<!minmax\(0,)1fr/.test('lg:grid-cols-[minmax(0,1fr)_20rem]')).toBe(false)
  })

  it('nenhuma trilha usa 1fr fora de minmax(0,…)', () => {
    const rigidas = occurrencesOf(TRILHA_EXPLICITA).filter((one) => {
      const trilha = one.text.match(TRILHA_EXPLICITA)?.[0] ?? ''
      return /(?<!minmax\(0,)1fr/.test(trilha)
    })

    expect(rigidas.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

/**
 * `H-58`, RNF-34 e RNF-43. Nenhuma origem externa em `web/`.
 *
 * **O modo de falha é o silêncio.** Uma fonte por CDN não quebra a tela: ela
 * cai para a pilha do sistema, sem erro nenhum, e a interface simplesmente
 * parece outra. A máquina do operador pode estar sem internet — é um dos
 * caminhos infelizes de `PD-06` —, e nesse cenário o defeito só apareceria como
 * "a tipografia está estranha", meses depois.
 *
 * O escopo inclui `web/index.html`, que `interfaceFiles()` não alcança: ele não
 * é `.ts` nem `.tsx`, e é exatamente onde um `<link rel="stylesheet">` para
 * `fonts.googleapis.com` entraria.
 */
const ORIGEM_EXTERNA = /https?:\/\/(?!localhost|127\.0\.0\.1)/

describe('RNF-34 — nenhuma origem externa na interface', () => {
  const html = readFileSync('web/index.html', 'utf-8')

  it('a regex reconhece a origem externa e ignora o caminho local', () => {
    expect(ORIGEM_EXTERNA.test('<link href="https://fonts.googleapis.com/css2?family=X">')).toBe(
      true,
    )
    expect(ORIGEM_EXTERNA.test('src: url("/fonts/IBMPlexSans-Regular.woff2")')).toBe(false)
    // O harness de medição fala com o próprio servidor, e isso não é saída.
    expect(ORIGEM_EXTERNA.test('http://127.0.0.1:5199/api/health')).toBe(false)
  })

  /**
   * **`web/src/index.css` entra explicitamente**, e não por `interfaceFiles()`:
   * aquele coletor só junta `.ts` e `.tsx`, e o `@font-face` mora no CSS. Sem
   * esta linha a guarda passaria com a fonte voltando para o CDN — medido por
   * mutação ao escrever o teste, que reprovou pela asserção errada.
   */
  it('nenhum arquivo de web/src cita origem externa, o CSS incluído', () => {
    const externas = occurrencesOf(ORIGEM_EXTERNA)
    const noCss = readFileSync('web/src/index.css', 'utf-8')
      .split('\n')
      .map((text, index) => ({ file: 'web/src/index.css', line: index + 1, text: text.trim() }))
      .filter((one) => ORIGEM_EXTERNA.test(one.text))

    expect([...externas, ...noCss].map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual(
      [],
    )
  })

  it('web/index.html não carrega nada de fora', () => {
    const linhas = html
      .split('\n')
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter((one) => ORIGEM_EXTERNA.test(one.text))

    expect(linhas.map((one) => `web/index.html:${one.line} — ${one.text}`)).toEqual([])
  })

  /**
   * As seis faces existem em disco. Sem esta asserção, apagar um `.woff2` da
   * distribuição passaria — o `@font-face` continuaria declarado, o navegador
   * cairia na reserva, e nada reclamaria.
   */
  it('cada @font-face aponta para um arquivo que existe', () => {
    const css = readFileSync('web/src/index.css', 'utf-8')
    const urls = [...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((one) => one[1] as string)

    expect(urls).toHaveLength(6)
    expect(urls.filter((url) => !existsSync(`web/public${url}`))).toEqual([])
  })

  // O repositório vai a público, e IBM Plex é OFL: a licença acompanha.
  it('a licença acompanha os arquivos de fonte', () => {
    expect(existsSync('web/public/fonts/LICENSE.txt')).toBe(true)
    expect(readFileSync('web/public/fonts/LICENSE.txt', 'utf-8')).toContain('SIL OPEN FONT LICENSE')
  })
})

/**
 * `H-63`, `D-22`. A forma nova, travada — as quatro asserções da onda 3.
 *
 * `tests/repo/estilo.test.ts` nasceu em `H-42` para impedir o passo bruto de
 * paleta de voltar, e a mecânica é a mesma: sem guarda, o próximo arquivo nasce
 * com `rounded-md` e `shadow-sm` porque era o que estava à mão — foi assim que
 * o conjunto chegou a **81 ocorrências de raio, 77 delas no mesmo valor**, e a
 * duas sombras, medido em `docs/estilizacao/RESULTADO.md`.
 *
 * **Ela entra aqui, e não em `H-61`, porque só aqui pode passar.** Escrita
 * naquela fatia, nascia vermelha: sobravam 47 `rounded`, 2 `rounded-sm` e 1
 * `rounded-lg` em 17 arquivos. `H-45` fixou o precedente — guarda que nasce
 * vermelha é desligada, não obedecida.
 *
 * **O escopo é o utilitário, nunca a prosa.** O único `font-bold` do conjunto
 * em 01/09/2026 era um comentário de `H-58` afirmando que havia zero; contar
 * prosa faria a guarda reprovar a própria documentação.
 */
const EM_UTILITARIO = (nome: string) => new RegExp(`\\b${nome}`)

/** Raio que não é `rounded-control`, `rounded-container` nem a pílula declarada. */
const RAIO_SOLTO = /(^|[\s'"`{@])rounded(-(none|sm|md|lg|xl|2xl|3xl))?(\s|$|'|"|`)/

/** `text-[13px]` e afins: pixel não acompanha a fonte-base do operador. */
const FONTE_ABSOLUTA = /text-\[\d+(px|pt)\]/

describe('D-22 — a forma nova, e o que a mantém', () => {
  it('as quatro regexes reconhecem o defeito e ignoram a prosa', () => {
    expect(RAIO_SOLTO.test('className="rounded-md border"')).toBe(true)
    expect(RAIO_SOLTO.test('className="rounded border"')).toBe(true)
    expect(RAIO_SOLTO.test('className="rounded-control px-2"')).toBe(false)
    expect(RAIO_SOLTO.test('className="rounded-container p-4"')).toBe(false)
    // A pílula de canal é exceção declarada, e a guarda a conhece pelo nome.
    expect(RAIO_SOLTO.test('className="rounded-full px-2"')).toBe(false)
    expect(EM_UTILITARIO('font-bold').test('className="font-bold"')).toBe(true)
    // A prosa nao chega ate aqui: `semComentarios` a apagou antes. A amostra e
    // o BLOCO inteiro, e nao uma linha dele — a limpeza roda sobre o arquivo.
    expect(semComentarios('/*\n * o conjunto tem zero `font-bold`\n */').trim()).toBe('')
    expect(semComentarios('const A = 1 // font-bold').trim()).toBe('const A = 1')
    expect(semComentarios('const U = "https://x/y"')).toBe('const U = "https://x/y"')
    // O que a linha de `className` escondia: a classe extraida para constante.
    expect(EM_UTILITARIO('shadow-').test("const BASE = 'shadow-lg p-4'")).toBe(true)
    expect(EM_UTILITARIO('shadow-').test('className="shadow-xl"')).toBe(true)
    expect(FONTE_ABSOLUTA.test('className="text-[13px]"')).toBe(true)
    expect(FONTE_ABSOLUTA.test('className="text-sm"')).toBe(false)
  })

  it('todo raio é um dos dois papéis, ou a pílula declarada', () => {
    const soltos = occurrencesOf(RAIO_SOLTO)

    expect(soltos.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  /** `D-22`: zero sombra. A separação de superfície é borda de 1 px. */
  it('nenhuma sombra sobrou no conjunto', () => {
    const sombras = occurrencesOf(EM_UTILITARIO('shadow-'))

    expect(sombras.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  /**
   * O teto de peso é 600, e ele existe porque **não há arquivo de fonte acima
   * disso** (`H-58`): `font-bold` faria o navegador SINTETIZAR o peso,
   * engordando o traço em vez de trocar a face.
   */
  it('nenhum peso acima de 600', () => {
    const pesados = occurrencesOf(EM_UTILITARIO('font-(bold|extrabold|black)'))

    expect(pesados.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  /**
   * `SC 1.4.4`. Pixel não acompanha a fonte-base que o operador escolheu —
   * mesma razão de `R03`, agora para o texto de interface e não só do gráfico.
   */
  it('nenhum tamanho de fonte em unidade absoluta', () => {
    const absolutos = occurrencesOf(FONTE_ABSOLUTA)

    expect(absolutos.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })
})

/**
 * `A10` — todo movimento tem contraparte de reducao, e ela nasce no mesmo
 * commit (`H-64`).
 *
 * O conjunto tinha **zero** `transition-*` e **zero** `animate-*` ate aqui, e
 * era por isso que `A07`, `A09` e `A10` do corpus estavam dispensadas por
 * inaplicabilidade. A primeira transicao torna as tres aplicaveis de uma vez:
 * sem esta guarda, o proximo arquivo nasce com `transition-all duration-300`
 * porque era o que estava a mao — a mesma mecanica que levou o conjunto a 40
 * classes de cor distintas (`C01`) e a 81 ocorrencias de raio (`D-22`).
 *
 * **Ela nasce verde, e isso e requisito**: `H-45` fixou o precedente de que
 * guarda vermelha e desligada, nao obedecida. Por isso ela entra junto do
 * movimento, e nao antes dele.
 *
 * **O escopo aqui e o CSS, e `interfaceFiles()` NAO o alcanca** — ele varre
 * `.ts`/`.tsx`. Medido em `H-58`, quando a prova por mutacao reprovou pelo
 * teste errado e revelou justamente esta lacuna.
 *
 * Quatro asserções:
 *
 * 1. nenhum utilitario de movimento em `.tsx` — o papel se nomeia, a duracao
 *    nao se escreve;
 * 2. toda duracao e um dos dois tokens, e toda curva e a unica;
 * 3. todo seletor que se move tem contraparte anulada sob `reduce`;
 * 4. o bloco de reducao existe e nao esta vazio — ancora contra guarda verde
 *    por vacuidade.
 */

const CSS_DA_INTERFACE = 'web/src/index.css'

const REDUCAO = '@media (prefers-reduced-motion: reduce)'

/**
 * Utilitario de movimento escrito no `.tsx`. `motion-tint` e `motion-surface`
 * NAO casam: o que se proibe e a duracao e a curva soltas, nao o papel.
 */
const MOVIMENTO_EM_TSX = EM_UTILITARIO('(transition|duration|ease|animate)-')

/**
 * Movimento e uma de duas coisas, e a primeira versao desta regex so via a
 * primeira: a propriedade que desloca pixel sendo DECLARADA, ou uma `transition`
 * que NOMEIA essa propriedade no valor. Sem a segunda metade,
 * `transition: transform var(--speed-fast)` — a regra de recuo do controle, o
 * unico movimento real da fatia — passava batido. Pego pela ancora, e nao pelo
 * conjunto: e o que `H-58` aprendeu ao provar a guarda por mutacao.
 */
const DECLARA_MOVIMENTO =
  /\b(transform|translate|rotate|animation)\s*:|\btransition\s*:[^;]*\b(transform|translate|rotate|all)\b/

/** `transition` e `animation` — as duas propriedades que carregam tempo e curva. */
const TEMPORIZADA = /\b(transition|animation)\s*:([^;]*)/g

/** Tempo literal: `150ms`, `.3s`. O que se aceita e `var(--speed-*)`. */
const TEMPO_LITERAL = /(^|[\s,(])\.?\d+(\.\d+)?m?s\b/

/** Curva literal. O que se aceita e `var(--ease-brand)`. */
const CURVA_LITERAL = /\b(cubic-bezier|linear|ease-in|ease-out|ease-in-out|steps)\b/

interface RegraCss {
  readonly seletor: string
  readonly declaracoes: string
  /** O prelúdio da at-rule que a contém, ou `null` no topo do arquivo. */
  readonly dentroDe: string | null
}

/**
 * Percorre o CSS por contagem de chaves e devolve uma entrada por bloco.
 *
 * Nao e um parser de CSS, e nao precisa ser: o que se pergunta e "que seletor
 * declara isto, e dentro de que at-rule" — duas perguntas que a contagem de
 * chaves responde. Comentario sai antes, senao uma chave em prosa desalinha a
 * pilha inteira.
 */
function regrasCss(fonte: string): RegraCss[] {
  const limpo = fonte.replace(/\/\*[\s\S]*?\*\//g, '')
  const regras: RegraCss[] = []
  const pilha: string[] = []
  let corrente = ''

  for (const caractere of limpo) {
    if (caractere === '{') {
      pilha.push(corrente.trim())
      corrente = ''
    } else if (caractere === '}') {
      const seletor = pilha.pop() ?? ''
      regras.push({ seletor, declaracoes: corrente, dentroDe: pilha.at(-1) ?? null })
      corrente = ''
    } else {
      corrente += caractere
    }
  }

  return regras
}

/** `@utility motion-surface` e a classe `.motion-surface` sao o mesmo alvo. */
const comoSeletor = (prelúdio: string): string =>
  prelúdio.replace(/^@utility\s+/, '.').replace(/\s+/g, ' ')

describe('A10 — todo movimento tem contraparte de redução', () => {
  const css = readFileSync(CSS_DA_INTERFACE, 'utf-8')
  const regras = regrasCss(css)

  it('as regexes e o percurso reconhecem o defeito e ignoram a prosa', () => {
    expect(MOVIMENTO_EM_TSX.test('className="transition-colors duration-150"')).toBe(true)
    expect(MOVIMENTO_EM_TSX.test('className="motion-tint hover:bg-surface-hover"')).toBe(false)
    expect(MOVIMENTO_EM_TSX.test("const BASE = 'transition-colors duration-150'")).toBe(true)
    expect(DECLARA_MOVIMENTO.test('transform: scale(0.975)')).toBe(true)
    expect(DECLARA_MOVIMENTO.test('transition: transform var(--speed-fast)')).toBe(true)
    expect(DECLARA_MOVIMENTO.test('transition: color var(--speed-fast)')).toBe(false)
    expect(TEMPO_LITERAL.test('transition: transform 150ms')).toBe(true)
    expect(TEMPO_LITERAL.test('transition: transform var(--speed-fast)')).toBe(false)
    expect(CURVA_LITERAL.test('animation: x var(--speed-base) ease-in-out')).toBe(true)
    expect(CURVA_LITERAL.test('animation: x var(--speed-base) var(--ease-brand)')).toBe(false)
    expect(comoSeletor('@utility motion-surface')).toBe('.motion-surface')

    // O percurso separa o que esta dentro do bloco de reducao do que esta fora,
    // e emite tambem a propria at-rule ao fecha-la — sem declaracao nenhuma,
    // entao ela nunca casa uma regex de movimento.
    const amostra = regrasCss('a { transform: none } @media (x) { b { transform: none } }')
    expect(amostra.map((uma) => `${uma.dentroDe ?? '—'} > ${uma.seletor}`)).toEqual([
      '— > a',
      '@media (x) > b',
      '— > @media (x)',
    ])
  })

  it('nenhum utilitário de movimento escrito no .tsx', () => {
    const soltos = occurrencesOf(MOVIMENTO_EM_TSX)

    expect(soltos.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  it('toda duração é um dos dois tokens, e toda curva é a única', () => {
    const fora: string[] = []

    for (const regra of regras) {
      for (const encontro of regra.declaracoes.matchAll(TEMPORIZADA)) {
        const valor = encontro[2] ?? ''
        if (TEMPO_LITERAL.test(valor) || CURVA_LITERAL.test(valor)) {
          fora.push(`${regra.seletor} — ${encontro[0].trim()}`)
        }
      }
    }

    expect(fora).toEqual([])
  })

  it('todo seletor que se move tem contraparte anulada sob redução', () => {
    const anulados = new Set(
      regras
        .filter(
          (regra) =>
            regra.dentroDe === REDUCAO &&
            /\b(transform|animation|transition)\s*:\s*none/.test(regra.declaracoes),
        )
        .map((regra) => comoSeletor(regra.seletor)),
    )

    // O passo de `@keyframes` nao tem contraparte propria: quem a tem e a regra
    // que USA a animacao, e e la que `animation: none` incide.
    const semContraparte = regras
      .filter(
        (regra) =>
          regra.dentroDe !== REDUCAO &&
          !regra.dentroDe?.startsWith('@keyframes') &&
          DECLARA_MOVIMENTO.test(regra.declaracoes),
      )
      .map((regra) => comoSeletor(regra.seletor))
      .filter((seletor) => !anulados.has(seletor))

    expect(semContraparte).toEqual([])
  })

  /** Âncora: sem isto a asserção acima passaria num arquivo sem movimento nenhum. */
  it('o bloco de redução existe e anula alguma coisa', () => {
    const dentro = regras.filter((regra) => regra.dentroDe === REDUCAO)

    expect(dentro.length).toBeGreaterThan(0)
    expect(css).toContain(REDUCAO)
  })
})

/**
 * `C10` — um nivel de severidade, um par de cor; e o glifo definido uma vez
 * (`H-73`).
 *
 * O conjunto chegou a **tres** copias do mesmo `path` de triangulo — em
 * `SeverityMark`, em `AlertRow` e em `IngestionHealth` —, e a duas cores para a
 * mesma faixa: `state-warning-fg` na compartilhada e `state-warning-border` na
 * de `AlertRow`, que media **1,60:1** no claro contra o piso de 3:1 de
 * `SC 1.4.11`.
 *
 * **`H-62` ja tinha escrito no cabecalho de `SeverityMark` que o padrao aparece
 * em seis lugares.** Aparecia; quatro consumiam. Esta guarda e o que impede a
 * afirmacao de voltar a ser intencao.
 */

/** O `path` do triangulo de atencao. Um arquivo pode desenha-lo; os outros importam. */
const TRIANGULO = /d="M8 2\.5 14\.5 13\.5h-13z"/

/** Faixa de severidade pintada com o token de BORDA em vez do de texto. */
const FAIXA_COM_BORDA = /border-l-state-(error|warning|info)-border/

describe('C10 — a severidade tem um par de cor e um glifo', () => {
  it('as duas regexes reconhecem o defeito e ignoram o vizinho', () => {
    expect(TRIANGULO.test('<path d="M8 2.5 14.5 13.5h-13z" strokeLinejoin="round" />')).toBe(true)
    expect(TRIANGULO.test('<path d="M8 6.5v3.5" />')).toBe(false)
    expect(FAIXA_COM_BORDA.test("'border-l-state-warning-border'")).toBe(true)
    // O contorno do painel usa o MESMO token, e e legitimo: ele delimita, nao
    // marca severidade. So o `border-l-` e faixa.
    expect(FAIXA_COM_BORDA.test("'border border-state-warning-border'")).toBe(false)
    expect(FAIXA_COM_BORDA.test("'border-l-state-warning-fg'")).toBe(false)
  })

  it('o glifo de severidade é desenhado em um arquivo só', () => {
    const desenham = occurrencesOf(TRIANGULO).map((one) => one.file)

    expect([...new Set(desenham)]).toEqual(['web/src/components/SeverityMark.tsx'])
  })

  it('nenhuma faixa de severidade usa o token de borda', () => {
    const faixas = occurrencesOf(FAIXA_COM_BORDA)

    expect(faixas.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  /**
   * A contraparte da guarda acima: `severityBand` precisa **ser usada**. Sem
   * isto, apagar as tres chamadas deixaria as duas assercoes verdes por
   * vacuidade — nao ha faixa errada quando nao ha faixa nenhuma.
   */
  it('encontra os consumidores da faixa compartilhada', () => {
    const consomem = FILES.filter((file) =>
      /severityBand\(/.test(semComentarios(readFileSync(file, 'utf-8'))),
    )

    expect(consomem.length).toBeGreaterThanOrEqual(6)
  })
})

/**
 * `C04` — um papel de UI, uma forma (`H-75`, `ACHADO 4`).
 *
 * O botao de acao primaria aparece em **cinco** lugares, e o que divergia nao
 * era detalhe: a borda existia em 3 dos 5 e o `hover` em 2 dos 5 — o mesmo
 * papel com dois desenhos e dois comportamentos sob o cursor. `SC 3.2.4` incide
 * porque as sete telas tem URIs distintas (determinacao `Z1` da revisao).
 *
 * **A assinatura e a TRIPLA, e nao o fundo sozinho.** Dois elementos usam
 * `bg-action-bg` com `text-action-fg` e NAO sao o papel: o link de salto de
 * `App.tsx`, que e link, e o seletor de janela de `History.tsx`, que e controle
 * de selecao com `aria-pressed`. Nenhum dos dois traz `font-medium` na mesma
 * linha — o do seletor vive na base do template, fora do ramo de cor. E por
 * isso que a guarda nao precisa de lista de excecao.
 */
const BOTAO_A_MAO =
  /(?=[^\n]*\bbg-action-bg\b)(?=[^\n]*\btext-action-fg\b)(?=[^\n]*\bfont-medium\b)[^\n]*/

describe('C04 — o botão de ação primária tem uma forma só', () => {
  it('a regex reconhece a tripla e ignora os dois que não são o papel', () => {
    expect(
      BOTAO_A_MAO.test(
        'className="rounded-control bg-action-bg px-3 py-1.5 text-sm font-medium text-action-fg"',
      ),
    ).toBe(true)
    // O link de salto: `bg-action-bg` e `text-action-fg`, sem `font-medium`.
    expect(
      BOTAO_A_MAO.test(
        'className="sr-only rounded-control bg-action-bg px-3 py-2 text-sm text-action-fg"',
      ),
    ).toBe(false)
    // O seletor de janela: a tripla existe, mas em DUAS linhas do template.
    expect(BOTAO_A_MAO.test("? 'border-2 border-action-bg bg-action-bg text-action-fg'")).toBe(
      false,
    )
    expect(BOTAO_A_MAO.test('className="button-primary px-3 py-1.5"')).toBe(false)
  })

  it('nenhum botão primário escreve a composição à mão', () => {
    const aMao = occurrencesOf(BOTAO_A_MAO)

    expect(aMao.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
  })

  /**
   * Âncora: sem consumidores, a asserção acima passaria por vacuidade.
   *
   * **Seis desde 02/09/2026** — `NewRowButton` é o sexto, e entra pelo mesmo
   * motivo dos outros cinco: enfileirar a linha nova é ação primária, e escrever
   * a composição à mão foi o que `ACHADO 4` encontrou divergindo em 3 de 5.
   */
  it('encontra os seis consumidores da utilidade', () => {
    const consomem = FILES.filter((file) =>
      /\bbutton-primary\b/.test(semComentarios(readFileSync(file, 'utf-8'))),
    )

    expect(consomem).toHaveLength(6)
  })
})

/**
 * `C04` — as duas faixas de largura total da casca (`H-75`, `ACHADO 5`).
 *
 * Elas empilham no MESMO lugar: `StatusBanner` desenha os sinais de saude e
 * `App` desenha a recusa de escrita, uma embaixo da outra. Uma com `border-b` e
 * a outra com `border-y` davam separacao diferente para o mesmo papel.
 */
const FAIXA_DA_CASCA = /border-(y|b)[^\n]*px-6 py-3 text-sm/

describe('C04 — as faixas da casca têm a mesma borda', () => {
  it('a regex reconhece a faixa e ignora o painel de página', () => {
    expect(FAIXA_DA_CASCA.test("'border-b border-state-error-border px-6 py-3 text-sm'")).toBe(true)
    expect(FAIXA_DA_CASCA.test('`border-y px-6 py-3 text-sm ')).toBe(true)
    expect(FAIXA_DA_CASCA.test("'rounded-container border p-4 text-sm'")).toBe(false)
  })

  it('toda faixa da casca usa border-y, e nenhuma desvia', () => {
    const faixas = occurrencesOf(FAIXA_DA_CASCA)

    expect(faixas.length).toBeGreaterThanOrEqual(2)
    expect(faixas.filter((one) => !/border-y/.test(one.text)).map((one) => one.file)).toEqual([])
  })
})
