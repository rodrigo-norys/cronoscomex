import { connect } from 'node:net'

/**
 * Espera a porta aceitar conexao. Consumido por `scripts/iniciar.cmd`.
 *
 * Existe por um defeito medido na PRIMEIRA execucao em Windows, em 19/08/2026
 * (H-44, PD-06): o atalho esperava 4 segundos fixos e abria o navegador, e numa
 * maquina onde a partida demorou mais que isso o operador recebeu
 * `ERR_CONNECTION_REFUSED` com o servidor subindo normalmente atras. O tempo de
 * partida nao e previsivel — `--experimental-strip-types` transpila os modulos a
 * cada execucao, e a primeira, logo apos um `npm ci`, e a mais lenta de todas.
 *
 * **Numero fixo maior nao resolveria**, so trocaria o limiar de quem falha:
 * espera curta demais numa maquina lenta, e segundos de janela preta em toda
 * maquina rapida. Perguntar a porta responde na hora em que a resposta existe.
 *
 * Saida 0 quando conectou. Saida 1 no estouro — e o `.cmd` abre o navegador
 * assim mesmo: um servidor que nao subiu em 90 segundos ja imprimiu o proprio
 * erro na janela, e nao ha nada que este script possa dizer de util alem disso.
 */

const port = Number(process.argv[2])
const LOOPBACK = '127.0.0.1'
const TIMEOUT_MS = 90_000
const RETRY_MS = 250
/** Curto de proposito: a tentativa que estourar aqui e refeita 250 ms depois. */
const ATTEMPT_MS = 1_000

if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1)

const deadline = Date.now() + TIMEOUT_MS

function attempt() {
  return new Promise((resolve) => {
    const socket = connect({ host: LOOPBACK, port })
    const settle = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(ATTEMPT_MS)
    socket.once('connect', () => settle(true))
    socket.once('timeout', () => settle(false))
    socket.once('error', () => settle(false))
  })
}

while (Date.now() < deadline) {
  if (await attempt()) process.exit(0)
  await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
}

process.exit(1)
