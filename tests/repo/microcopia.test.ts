import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A regra dura de `.claude/rules/microcopia.md`: identificador de auditoria não
 * aparece na tela. `A-NN`, `D-NN`, `H-NN` e os demais são vocabulário do
 * repositório e não dizem nada a quem usa o painel.
 *
 * Existe porque a rule sozinha não garante nada: ela só entra em contexto quando
 * o agente lê um `.tsx` de `web/src/` com `Read` e, conforme a versão do
 * Claude Code, também quando o escreve, o edita ou o lê pelo shell, e, medido nas
 * transcrições do projeto (ADR-0007), carregou em **zero** das três sessões que
 * tocaram esses arquivos depois de criada. Na mesma medição, sete identificadores
 * estavam no texto de apoio de três páginas.
 *
 * A varredura é estática: tira os comentários — onde o identificador é bem-vindo,
 * porque é lá que o porquê vai — e procura o padrão no que sobra. Texto montado em
 * tempo de execução, como `{page.story}`, fica fora do alcance.
 */

const ROOT = 'web/src'
const AUDIT_ID = /\b(?:A|D|TD|H|IND|RF|RNF|ALE|PD|P|R|E|VN)-\d{2,3}(?:\.\d)?\b|\bADR-\d{4}\b/g

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

/** Troca cada comentário por espaço, preservando as quebras — e com elas o número da linha. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_line, before: string) => before)
}

function auditIdsOnScreen(file: string, source: string): string[] {
  return withoutComments(source)
    .split('\n')
    .flatMap((line, index) =>
      [...line.matchAll(AUDIT_ID)].map(
        ([id]) =>
          `${file}:${index + 1} mostra "${id}" na tela — identificador de auditoria não aparece para o operador; o porquê vai no comentário ao lado (.claude/rules/microcopia.md, regra 2)`,
      ),
    )
}

describe('o texto da tela não mostra identificador de auditoria', () => {
  const files = tsxFiles(ROOT)

  it('encontra os componentes — âncora contra guarda verde por vacuidade', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('o identificador em comentário é ignorado, e o do texto é apontado com a linha', () => {
    const source = [
      '// A-32 explica o limiar',
      '/* D-49 decidiu */',
      '<p>',
      '  Limiar configurável (A-32).',
      '</p>',
    ].join('\n')
    expect(auditIdsOnScreen('X.tsx', source)).toEqual([
      'X.tsx:4 mostra "A-32" na tela — identificador de auditoria não aparece para o operador; o porquê vai no comentário ao lado (.claude/rules/microcopia.md, regra 2)',
    ])
  })

  it('nenhum componente de web/src mostra A-NN, D-NN, H-NN e afins', () => {
    const found = files.flatMap((file) => auditIdsOnScreen(file, readFileSync(file, 'utf-8')))
    expect(found).toEqual([])
  })
})
