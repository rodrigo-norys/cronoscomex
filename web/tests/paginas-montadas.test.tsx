import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App.tsx'
import { NAV_PAGES } from '../src/router.ts'
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

  it.each(NAV_PAGES.map((page) => [page.label, page.path, page.story] as const))(
    '%s (%s) — %s',
    (_label, path, story) => {
      window.history.replaceState(null, '', path)
      render(<App />)

      const placeholder = screen.queryByText(/Página ainda não implementada/)

      // A implicação é de mão única: história concluída **exige** página. O
      // inverso não vale — durante a própria história a página existe antes de
      // `/fechar-historia` escrever o bloco no backlog, e exigir o marcador ali
      // faria a guarda brigar com o fluxo que ela protege.
      if (!CLOSED.has(story)) return

      expect(placeholder, `${story} está concluída no backlog, mas a página é um marcador`).toBe(
        null,
      )
    },
  )
})
