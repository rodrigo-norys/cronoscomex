import { readFileSync } from 'node:fs'

/**
 * Imprime a porta configurada. Consumido por `scripts/iniciar.cmd`.
 *
 * **Ausencia do arquivo e o caso NORMAL da primeira execucao** (H-35). Ate
 * entao o `.cmd` barrava a partida antes de chegar aqui, e este script so via
 * arquivo existente; hoje ele e a primeira coisa que responde por um
 * `config/app.json` que ainda nao foi criado.
 *
 * Existe por limitacao do CMD, nao por necessidade de logica: dentro de
 * `for /f`, o comando entre backticks e reanalisado pelo interpretador, e
 * PARENTESES e aspas simples no meio dele quebram o parser. Um `node -p` com
 * `JSON.parse` e `readFileSync` tem os dois. Chamar um arquivo pelo nome nao
 * tem nenhum.
 *
 * A porta e lida da MESMA fonte que o servidor le. Escrever 5173 no `.cmd`
 * criaria a terceira copia do numero — as duas existentes sao `DEFAULTS.port`
 * em `src/app/config.ts` e `FALLBACK_API_PORT` em `web/vite.config.ts`, e o
 * cabecalho deste ultimo registra por que a duplicacao da errado.
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
  // Ausencia nao e erro: a aplicacao sobe nos padroes e abre a tela de
  // configuracao, que cria o arquivo ao salvar o caminho da planilha. O `.cmd`
  // apenas informa que ele ainda nao existe.
  process.stdout.write(String(FALLBACK_PORT))
  process.exit(0)
}

try {
  const { port } = JSON.parse(raw)
  process.stdout.write(String(typeof port === 'number' ? port : FALLBACK_PORT))
} catch {
  process.exit(1)
}
