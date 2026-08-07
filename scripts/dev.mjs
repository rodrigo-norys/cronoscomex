import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

/**
 * Sobe servidor e interface no mesmo terminal.
 *
 * O `CLAUDE.md` sempre documentou `npm run dev` como "servidor + interface",
 * mas o script subia so o servidor — a interface exigia um segundo terminal que
 * a documentacao nao mencionava. Este arquivo faz a documentacao virar verdade.
 *
 * Sem dependencia nova, por duas razoes: o plano proibe acrescentar o que ele
 * nao preve, e `concurrently` resolveria com 30 pacotes o que `child_process`
 * resolve com 40 linhas. O `&` do shell tambem nao serve — a maquina do
 * operador e Windows (RNF-26), e ali o `npm` invoca `cmd`, que nao o entende.
 */

const PROCESSES = [
  {
    label: 'servidor',
    args: ['--watch', '--experimental-strip-types', 'src/http/server.ts'],
  },
  {
    label: 'interface',
    args: ['node_modules/vite/bin/vite.js', '--config', 'web/vite.config.ts'],
  },
]

const children = []
let shuttingDown = false

function prefixed(label, stream, target) {
  createInterface({ input: stream }).on('line', (line) => {
    target.write(`[${label}] ${line}\n`)
  })
}

function start({ label, args }) {
  // `process.execPath` e nao `npx`: o Windows resolveria `npx` para um `.cmd`,
  // e `spawn` sem shell nao o executa. O binario do Vite e um script Node.
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  prefixed(label, child.stdout, process.stdout)
  prefixed(label, child.stderr, process.stderr)

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    process.stderr.write(`\n[${label}] encerrou (${signal ?? `codigo ${code}`}). Derrubando o resto.\n`)
    shutdown(code ?? 1)
  })

  children.push(child)
}

/** Um processo morto deixa o outro inutil: a interface sem API so mostra erro,
 * e a API sem interface nao tem quem a consuma. Cair junto e mais honesto que
 * deixar meia aplicacao no ar parecendo saudavel. */
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  process.exitCode = code
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

for (const definition of PROCESSES) start(definition)
