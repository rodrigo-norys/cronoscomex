import { readdirSync, readFileSync } from 'node:fs'
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
    const lines = readFileSync(file, 'utf-8').split('\n')

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
const SECTION_ROLE = /rounded border border-\S+ bg-surface-raised p-\d/

/** O papel "ressalva/fora de escopo", distinto e consistente entre si. */
const CAVEAT_ROLE = /border-dashed border-\S+ bg-surface-sunken/

describe('C04 — o mesmo papel de UI tem a mesma forma', () => {
  it('as regexes reconhecem cada papel, e não se confundem', () => {
    // Âncora das regexes, não do conjunto: sem isto, um erro de ancoragem faria
    // as duas asserções abaixo passarem por nunca casarem nada — a mesma
    // armadilha que a âncora de `C01` já cobre para o passo bruto.
    expect(SECTION_ROLE.test('rounded border border-border-subtle bg-surface-raised p-4')).toBe(
      true,
    )
    expect(SECTION_ROLE.test('rounded border border-border-strong bg-surface-raised p-6')).toBe(
      true,
    )
    // Controle não é seção: `px-`/`py-` assimétricos, e borda de controle.
    expect(
      SECTION_ROLE.test('rounded border border-border-control bg-surface-raised px-2 py-1.5'),
    ).toBe(false)
    expect(CAVEAT_ROLE.test('border-dashed border-border-subtle bg-surface-sunken p-4')).toBe(true)
    expect(CAVEAT_ROLE.test('rounded border border-border-subtle bg-surface-raised p-4')).toBe(
      false,
    )
  })

  it('toda seção de conteúdo usa a borda sutil, e nenhuma desvia', () => {
    const desviantes = occurrencesOf(SECTION_ROLE).filter(
      (one) => !/border-border-subtle/.test(one.text),
    )

    expect(desviantes.map((one) => `${one.file}:${one.line} — ${one.text}`)).toEqual([])
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
