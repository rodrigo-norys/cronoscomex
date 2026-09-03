import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Importa TODO modulo de `src/` sob `--experimental-strip-types`, que e como a
 * aplicacao roda de verdade (`npm start` e `npm run dev`).
 *
 * Existe porque nenhuma outra etapa do portao executa `src/` com essa flag:
 * `tsc --noEmit` verifica tipos sem emitir codigo, o Vitest usa um
 * transformador proprio que aceita mais sintaxe, e `vite build` so compila
 * `web/`. Uma `parameter property` num construtor passou pelos quatro e teria
 * derrubado a aplicacao no primeiro `npm start` — foi o que motivou este
 * arquivo, em 06/08/2026.
 *
 * O modo strip-only apenas REMOVE anotacoes de tipo. Recusa qualquer sintaxe
 * que precise gerar codigo: `parameter property`, `enum`, `namespace` e
 * `experimentalDecorators`.
 *
 * Roda no `npm run verify` ANTES de `lint`, `typecheck`, `test` e `build` — as
 * quatro etapas que a `parameter property` atravessou. Hoje em terceiro, depois
 * de `test:hooks` e de `test:dados`, mas o ordinal nao e a parte duravel: ele
 * quebra na proxima insercao no portao, e foi o que aconteceu em 02/09/2026.
 * Provado que pega: reintroduzir o defeito faz o passo sair com `1`.
 *
 * Sem contagem de modulos aqui: o proprio script a imprime na ultima linha, e o
 * numero que estava escrito envelheceu de 28 para 51 sem que nada acusasse —
 * `tools/` fica fora de `sourceFiles()` em tests/repo/contratos.test.ts.
 */

const SRC = resolve(import.meta.dirname, '..', 'src')

async function collectModules(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await collectModules(full)))
    else if (entry.name.endsWith('.ts')) found.push(full)
  }
  return found
}

const modules = (await collectModules(SRC)).sort()
const failures = []

for (const file of modules) {
  try {
    await import(pathToFileURL(file).href)
  } catch (error) {
    // Sintaxe recusada e o que este verificador procura. Erro de execucao na
    // carga e outro problema, e tambem merece falhar — um modulo que nao
    // importa nao serve, qualquer que seja o motivo.
    failures.push({ file: relative(SRC, file), message: error.message.split('\n')[0] })
  }
}

if (failures.length > 0) {
  console.error(`strip-types: ${failures.length} de ${modules.length} modulos falharam\n`)
  for (const { file, message } of failures) console.error(`  src/${file}\n    ${message}\n`)
  process.exit(1)
}

console.log(`strip-types: ${modules.length} modulos carregam sob --experimental-strip-types`)
