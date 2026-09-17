import { createServer } from 'node:net'

/**
 * Recusa o portao quando o servidor de desenvolvimento esta no ar.
 *
 * O `vite build` compartilha o diretorio de cache com o dev e apaga as
 * dependencias otimizadas: o cliente passa a receber `504` nos modulos, a raiz
 * da aplicacao fica vazia, e NADA e registrado em log nenhum. Medido em
 * 08/09/2026, ao validar `H-87`.
 *
 * **O aviso existia em prosa no `CLAUDE.md`, e prosa depende de lembrar.** Em
 * 17/09/2026 ele foi lembrado, e ainda assim custou o mesmo preambulo de guarda
 * colado a mao em OITO invocacoes do portao, porque nada o executava sozinho.
 * Mesmo movimento de `verifica-dados-sensiveis.sh`, que ate 02/09/2026 so
 * existia no CI: o portao local passava e o workflow reprovava, que e a ordem
 * errada de descobrir.
 *
 * **Sonda por `EADDRINUSE`, e nao por ferramenta de rede do sistema:** RNF-26
 * declara Windows como alvo e ha execucao do portao la, onde `ss` nao existe.
 *
 * **Falha ABERTA na deteccao e FECHADA no achado:** porta ocupada aborta; erro
 * inesperado de sondagem avisa e segue. Travar o portao por falha de ambiente
 * seria pior que o defeito que ele evita.
 */

// A primeira e a da API, declarada em `AppConfig`; a segunda e a da interface,
// fixada na configuracao do Vite.
const PORTAS = [5173, 5174]

function ocupada(porta) {
  return new Promise((resolve, reject) => {
    const sonda = createServer()
    sonda.once('error', (erro) => {
      sonda.close()
      if (erro.code === 'EADDRINUSE') resolve(true)
      else reject(erro)
    })
    sonda.once('listening', () => sonda.close(() => resolve(false)))
    sonda.listen(porta, '127.0.0.1')
  })
}

const ocupadas = []
for (const porta of PORTAS) {
  try {
    if (await ocupada(porta)) ocupadas.push(porta)
  } catch (erro) {
    console.warn(`portas: nao foi possivel sondar ${porta} (${erro.code ?? erro.message}); seguindo`)
  }
}

if (ocupadas.length > 0) {
  console.error(
    `ABORTADO: o dev esta no ar em ${ocupadas.join(' e ')}.\n` +
      'A build apagaria o cache de dependencias do Vite, e o painel passaria a responder 504 sem registrar nada em log nenhum.\n' +
      'Derrube o `npm run dev` e rode o portao de novo, ou reinicie o dev depois dele.',
  )
  process.exit(1)
}

console.log(`portas: ${PORTAS.join(' e ')} livres`)
