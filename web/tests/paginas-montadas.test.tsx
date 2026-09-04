import { readFileSync } from 'node:fs'
import { cleanup, render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { LINHA_PENDENTE } from '../src/api-client.ts'
import { NAV_PAGES, PROCESS_DETAIL_PAGE } from '../src/router.ts'
import { stubApi } from './support/api-stub.ts'

/**
 * O último elo da cadeia domínio → rota → **tela**, verificado por máquina.
 *
 * O plano erra aqui com regularidade: `IND-13`, `IND-17` e `IND-20` ficaram
 * calculados, servidos e **sem página** até A-65 varrer; `IND-16` era um cartão
 * que ninguém previu (A-64). Servir não é entregar, e nada quebrava quando a
 * apresentação faltava.
 *
 * Esta asserção se mantém sozinha: a fonte da verdade é o `✅ CONCLUÍDA` que
 * `/fechar-historia` escreve no backlog, cruzado com a história que `router.ts`
 * declara para cada página. Fechar `H-19` no documento passa a **exigir** que a
 * Página Performance esteja montada — sem ninguém lembrar de nada.
 */

/** As histórias com o bloco de conclusão em `docs/06-backlog.md`. */
function closedStories(): Set<string> {
  const backlog = readFileSync('docs/06-backlog.md', 'utf-8')
  const closed = new Set<string>()

  // Cada trecho vai de um título de história ao próximo, então o bloco de
  // conclusão encontrado dentro dele pertence àquela história.
  for (const section of backlog.split(/^### /m)) {
    const story = section.match(/^(H-\d+)\b/)
    if (story?.[1] && section.includes('✅ **CONCLUÍDA')) closed.add(story[1])
  }
  return closed
}

const CLOSED = closedStories()

/**
 * As páginas verificadas: as seis do menu, **mais o detalhe do processo**.
 *
 * Ele ficou de fora da primeira versão por viver em `PROCESS_DETAIL_PAGE`, e não
 * em `NAV_PAGES` — só se chega nele a partir de um processo. Mas declara
 * `story:` como as outras, e tem a mesma exposição ao erro que esta guarda
 * existe para pegar. Incluído em `H-22`, quando a página nasceu.
 *
 * O `path` dele precisa de uma REF: `/processo` sozinho não casa com nenhuma
 * rota — `parseRoute` devolve `notFound` para REF vazia, de propósito.
 */
const PAGES = [
  ...NAV_PAGES.map((page) => [page.label, page.path, page.story] as const),
  [
    PROCESS_DETAIL_PAGE.label,
    `${PROCESS_DETAIL_PAGE.path}/FT001.26`,
    PROCESS_DETAIL_PAGE.story,
  ] as const,
]

beforeEach(() => {
  stubApi()
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

/**
 * O chunk da Página Histórico é carregado ANTES da primeira montagem — `PD-10`.
 *
 * **O diagnóstico da pendência era o alvo errado**, e a medição de 04/09/2026
 * mostrou por quê. Ela propunha trocar a espera do fallback por uma asserção
 * positiva; mas `findBy*` e `waitForElementToBeRemoved` usam o **mesmo**
 * `asyncUtilTimeout` de 1.000 ms, então a troca move a forma da espera sem
 * mover o prazo. O que estoura o prazo é o `import()` do Recharts — 377 kB, o
 * maior chunk do pacote — acontecendo DENTRO da janela cronometrada.
 *
 * Medido: 357 ms com a máquina livre e 472 ms sob carga, contra os 1.000 ms do
 * teto. Degradação de 1,3×, contra 5,1× dos casos de paginação — e é essa
 * assimetria que separa espera cara de montagem cara. Pago aqui, uma vez e fora
 * do teto, o carregamento deixa de disputar com a asserção.
 */
beforeAll(async () => {
  await import('../src/pages/History.tsx')
})

describe('história concluída exige página montada', () => {
  it('encontra os blocos de conclusão no backlog', () => {
    // Sem esta âncora, um backlog que mudasse de formato faria todas as
    // asserções abaixo passarem por vacuidade — o pior modo de falha de uma
    // guarda: verde porque não verifica mais nada.
    expect(CLOSED.size).toBeGreaterThan(0)
    expect(CLOSED.has('H-16')).toBe(true)
  })

  it.each(PAGES)('%s (%s) — %s', async (_label, path, story) => {
    window.history.replaceState(null, '', path)
    render(<App />)

    // A Página Histórico é carregada sob demanda desde 17/08/2026 — o Recharts
    // responde por 374 dos 634 kB do pacote. Sem esperar o módulo chegar, a
    // consulta abaixo aconteceria com o fallback do `Suspense` na tela, e a
    // guarda passaria **sem nunca ter renderizado a página**.
    const fallback = () => screen.queryByText('Carregando página…')
    if (fallback() !== null) await waitForElementToBeRemoved(fallback)

    const placeholder = screen.queryByText(/Página ainda não implementada/)

    // A implicação é de mão única: história concluída **exige** página. O
    // inverso não vale — durante a própria história a página existe antes de
    // `/fechar-historia` escrever o bloco no backlog, e exigir o marcador ali
    // faria a guarda brigar com o fluxo que ela protege.
    if (!CLOSED.has(story)) return

    expect(placeholder, `${story} está concluída no backlog, mas a página é um marcador`).toBe(null)
  })
})

/**
 * `C08` — um `<h1>` por página, e nenhum salto de nível (`H-74`, `ACHADO 1`).
 *
 * É guarda **composicional**: o defeito não existe dentro de um arquivo. O
 * `<h1>` vive na `TopBar`, e quem descia para `<h3>` era `StatCard` — dois
 * arquivos que nunca se veem. `SC 1.3.1` nomeia isto como falha `F43`.
 *
 * Ela mora aqui porque este é o único teste que monta as sete páginas dentro da
 * casca; `web/tests/Home.test.tsx` e as irmãs montam a página sozinha, sem o
 * `<h1>` que faz o salto existir.
 */
describe('C08 — um h1 por página, sem salto de nível', () => {
  it.each(PAGES)('%s (%s)', async (_label, path) => {
    window.history.replaceState(null, '', path)
    render(<App />)

    const fallback = () => screen.queryByText('Carregando página…')
    if (fallback() !== null) await waitForElementToBeRemoved(fallback)

    const niveis = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((titulo) =>
      Number(titulo.tagName[1]),
    )
    const saltos = niveis
      .map((nivel, i) => ({ de: niveis[i - 1], para: nivel }))
      .filter(({ de, para }) => de !== undefined && para > de + 1)
      .map(({ de, para }) => `h${de} → h${para}`)

    expect(niveis.filter((nivel) => nivel === 1)).toHaveLength(1)
    expect(saltos).toEqual([])
  })
})

/**
 * As duas listas mantidas à mão que o `web/` guarda do servidor, e que nenhuma
 * asserção cobria até 02/09/2026.
 *
 * `web/` só importa **tipo**, e só de `src/http/routes/` (`D-18`), então valor
 * compartilhado é declarado duas vezes por construção. O que impede a
 * divergência é a conferência aqui — mesmo padrão de `STYLED_COLUMNS`.
 *
 * **É COBERTURA, e não igualdade**, e a diferença importa para quem ler: a
 * asserção reprova quando o servidor tem código que a tela não conhece, e passa
 * em silêncio quando a tela tem um a mais. `ERRO_INTERNO` é justamente esse a
 * mais — ele é do cliente, para a falha de rede, e não existe como recusa do
 * servidor. O preço é que um código aposentado no servidor e esquecido em
 * `REFUSAL_CODES` não é detectado.
 */
describe('o que o cliente duplica do servidor', () => {
  /**
   * **O defeito que criou esta guarda:** `TABELA_CHEIA` entrou no servidor e não
   * em `REFUSAL_CODES`, e a recusa caía em `ERRO_INTERNO` — o diálogo dizia "Não
   * foi possível concluir", que significa "não se sabe o que aconteceu", e
   * suprimia o rodapé que garante "nada foi gravado" justamente na única recusa
   * em que o código tem certeza disso.
   */
  /**
   * **A fonte e `STATUS`, e nao a uniao em si** — e a diferenca e o que faz a
   * guarda valer. `STATUS` e declarado `Record<WriteRefusal, number>`, entao o
   * `tsc` **obriga** que ele tenha todo membro da uniao: parsear as chaves dele
   * da a lista completa por construcao.
   *
   * A primeira versao lia a uniao ate a primeira linha em branco, e o
   * revisor-xml mediu o furo: uma linha em branco entre membros — TypeScript
   * legal, que nenhum lint remove — cortava a captura, e os **ultimos** membros
   * escapavam. E exatamente onde codigo novo e acrescentado, que e o defeito
   * que esta guarda existe para impedir.
   */
  it('REFUSAL_CODES cobre toda WriteRefusal do servidor', () => {
    const rota = readFileSync('src/http/routes/apply.ts', 'utf-8')
    const mapa =
      /const STATUS: Record<WriteRefusal, number> = \{([\s\S]*?)\n\}/.exec(rota)?.[1] ?? ''
    const doServidor = [...mapa.matchAll(/^\s*([A-Z_0-9]+):/gm)].map((achado) => achado[1])

    const cliente = readFileSync('web/src/api-client.ts', 'utf-8')
    const lista =
      /const REFUSAL_CODES: readonly string\[\] = \[([\s\S]*?)\]/.exec(cliente)?.[1] ?? ''
    const naTela = [...lista.matchAll(/'([A-Z_0-9]+)'/g)].map((achado) => achado[1])

    // Ancora na contagem REAL, e nao abaixo dela: calibrada folgada, ela nao
    // detectaria a propria cegueira — foi assim que a versao anterior passou
    // aprovando enquanto dois membros escapavam.
    expect(doServidor).toHaveLength(8)
    expect(doServidor.filter((codigo) => !naTela.includes(codigo))).toEqual([])
  })

  it('LINHA_PENDENTE e UNWRITTEN_ROW sao o mesmo valor', () => {
    const dominio = readFileSync('src/domain/process-projection.ts', 'utf-8')
    const doDominio = /export const UNWRITTEN_ROW = (\d+)/.exec(dominio)?.[1]

    expect(doDominio).toBeDefined()
    expect(Number(doDominio)).toBe(LINHA_PENDENTE)
  })
})
