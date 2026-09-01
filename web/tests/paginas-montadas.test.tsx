import { readFileSync } from 'node:fs'
import { cleanup, render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
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
