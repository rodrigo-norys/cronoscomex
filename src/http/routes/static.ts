import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

/**
 * GET /* — a SPA compilada. Contrato em docs/05-contratos-api.md secao 4.
 *
 * **O servidor nao conhece as rotas do cliente, e nao deve conhecer.** Qualquer
 * caminho fora de `/api/` devolve `index.html`, e e a casca quem decide se
 * aquele endereco existe. Duplicar o mapa de `web/src/router.ts` aqui criaria
 * duas listas para manter, e a segunda envelheceria em silencio.
 *
 * Registrada em `H-30` porque e aqui que `dist/web` passa a existir na maquina
 * do operador (A-63). Ate entao o fallback de SPA do Vite cobria `npm run dev`,
 * e recarga direta de URL em producao nao era exercivel.
 */

/** Onde `vite build` escreve. Declarado em `web/vite.config.ts`. */
export const WEB_DIST = 'dist/web'

/**
 * A rota `GET /*` e registrada SEMPRE, e a pasta e consultada por requisicao.
 *
 * O portao roda `test` antes de `build`, e no CI o checkout e limpo — nesse
 * instante `dist/web` nao existe. Condicionar o registro a pasta faria
 * `tests/repo/contratos.test.ts` reprovar por uma rota que o codigo tem, e
 * `@fastify/static` lanca no registro quando o `root` nao existe. Consultar por
 * requisicao tambem cobre o operador que roda o `build` com o servidor no ar.
 */
export function registerStaticRoute(app: FastifyInstance, root: string = WEB_DIST): void {
  // `wildcard: false` faz o plugin criar uma rota por arquivo encontrado, em
  // vez da propria `/*` — que e nossa, e precisa existir de forma sincrona.
  // `resolve` e nao `join(cwd, root)`: o plugin exige caminho absoluto, e o
  // teste injeta um diretorio temporario que ja e absoluto — concatenar o
  // diretorio corrente o transformaria num caminho inexistente.
  if (existsSync(root)) {
    void app.register(fastifyStatic, { root: resolve(root), wildcard: false })
  }

  app.get('/*', (request, reply) => {
    // Sem isto, `/api/qualquer-coisa-errada` receberia o HTML da casca em vez
    // do 404 do Fastify, e um erro de digitacao na URL viraria tela em branco.
    if (request.url.startsWith('/api/')) return reply.callNotFound()

    const index = join(root, 'index.html')
    if (!existsSync(index)) return reply.code(503).type(HTML).send(missingBuildPage(root))

    return reply.type(HTML).send(readFileSync(index))
  })
}

const HTML = 'text/html; charset=utf-8'

/**
 * Quem le isto e o operador, num navegador — nao um cliente de API. Devolver o
 * envelope JSON de erro deixaria a tela em branco com um texto tecnico, e o
 * caso-limite de `H-30` pede o oposto: dizer o que falta fazer.
 */
function missingBuildPage(root: string): string {
  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8"><title>CronosComex — interface nao compilada</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; line-height: 1.6">
  <h1>A interface ainda nao foi compilada</h1>
  <p>A API esta no ar, mas a pasta <code>${root}</code> nao existe.</p>
  <p>Feche esta janela, execute <code>npm run build</code> na pasta do projeto e
     inicie de novo pelo atalho <code>iniciar.cmd</code>.</p>
</body>
</html>`
}
