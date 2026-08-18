import { readFileSync } from 'node:fs'

/**
 * Imprime a porta configurada. Consumido por `scripts/iniciar.cmd`.
 *
 * Existe por limitacao do CMD, nao por necessidade de logica: dentro de
 * `for /f`, o comando entre backticks e reanalisado pelo interpretador, e
 * PARENTESES e aspas simples no meio dele quebram o parser. Um `node -p` com
 * `JSON.parse` e `readFileSync` tem os dois. Chamar um arquivo pelo nome nao
 * tem nenhum.
 *
 * A porta e lida da MESMA fonte que o servidor le. Escrever 5173 no `.cmd`
 * criaria a terceira copia do numero — `src/app/config.ts` e
 * `web/vite.config.ts` ja registram por que isso da errado.
 *
 * Saida 1 quando o arquivo existe e nao e JSON: o `.cmd` distingue "nao consegui
 * ler" de "li e deu 5173", e diz ao operador para conferir a configuracao.
 */

const CONFIG_PATH = 'config/app.json'
const FALLBACK_PORT = 5173

let raw
try {
  raw = readFileSync(CONFIG_PATH, 'utf-8')
} catch {
  // Ausencia nao e erro aqui: o `.cmd` ja barrou o arquivo faltando antes de
  // chegar neste ponto, com mensagem propria.
  process.stdout.write(String(FALLBACK_PORT))
  process.exit(0)
}

try {
  const { port } = JSON.parse(raw)
  process.stdout.write(String(typeof port === 'number' ? port : FALLBACK_PORT))
} catch {
  process.exit(1)
}
