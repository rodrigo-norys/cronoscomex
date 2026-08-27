import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import type { FastifyInstance } from 'fastify'

/**
 * GET /* — a SPA compilada. Contrato em docs/05-contratos-api.md secao 4.
 *
 * **O servidor nao conhece as rotas do cliente, e nao deve conhecer.** Qualquer
 * caminho fora de `/api/` que nao case um arquivo em disco devolve
 * `index.html`, e e a casca quem decide se aquele endereco existe. Duplicar o
 * mapa de `web/src/router.ts` aqui criaria duas listas para manter, e a segunda
 * envelheceria em silencio.
 *
 * Registrada em `H-30` porque e aqui que `dist/web` passa a existir na maquina
 * do operador (A-63). Ate entao o fallback de SPA do Vite cobria `npm run dev`,
 * e recarga direta de URL em producao nao era exercivel.
 */

/** Onde `vite build` escreve. Declarado em `web/vite.config.ts`. */
export const WEB_DIST = 'dist/web'

/**
 * A rota `GET /*` e registrada SEMPRE, e **cada requisicao consulta o disco** —
 * inclusive as de asset.
 *
 * Ate `H-42` isto valia so para o `index.html`: os arquivos vinham do
 * `@fastify/static` com `wildcard: false`, que **enumera o diretorio uma vez, no
 * registro**, e a propria documentacao do plugin avisa que ele "will not serve
 * newly added files". Dois caminhos rotineiros caiam nisso, e os dois davam a
 * MESMA tela branca, sem erro nenhum:
 *
 * 1. o servidor sobe antes de `dist/web` existir — o plugin nem chega a ser
 *    registrado, porque ele lanca quando o `root` nao existe;
 * 2. o servidor esta no ar e alguem recompila — os nomes ganham hash novo, e
 *    nenhuma rota existe para eles.
 *
 * Em ambos, o `index.html` era servido (esse ja era lido por requisicao) e
 * apontava para arquivos que caiam no proprio `/*`, devolvendo HTML onde o
 * navegador esperava JavaScript. Medido em 21/08/2026.
 *
 * Servir a mao troca o plugin por ~20 linhas e faz o comentario acima virar
 * verdade. O preco e a guarda de travessia, abaixo, que o plugin dava de graca.
 */
export function registerStaticRoute(app: FastifyInstance, root: string = WEB_DIST): void {
  app.get('/*', (request, reply) => {
    // Sem isto, `/api/qualquer-coisa-errada` receberia o HTML da casca em vez
    // do 404 do Fastify, e um erro de digitacao na URL viraria tela em branco.
    if (request.url.startsWith('/api/')) return reply.callNotFound()

    const asset = assetPath(root, request.url)
    if (asset !== null) return reply.type(contentTypeOf(asset)).send(readFileSync(asset))

    const index = join(root, 'index.html')
    if (!existsSync(index)) return reply.code(503).type(HTML).send(missingBuildPage(root))

    return reply.type(HTML).send(readFileSync(index))
  })
}

/**
 * O arquivo que a URL pede, ou `null` se ela nao aponta para um arquivo dentro
 * de `root` — caso em que quem responde e a casca.
 *
 * **A guarda de travessia e o motivo de esta funcao existir separada.** O
 * caminho pedido chega do navegador e nao e confiavel: `%2e%2e` decodifica para
 * `..` DEPOIS do `decodeURIComponent`, entao comparar a URL crua nao serve. A
 * verificacao e feita no caminho ja resolvido, e o `relative` responde a unica
 * pergunta que importa: sair de `root` para chegar no alvo exige subir?
 */
function assetPath(root: string, url: string): string | null {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  } catch {
    return null
  }

  if (pathname.includes('\0')) return null

  const base = resolve(root)
  const alvo = resolve(base, `.${pathname}`)
  const dentro = relative(base, alvo)
  if (dentro === '' || dentro.startsWith('..') || dentro.startsWith(sep)) return null

  return existsSync(alvo) && statSync(alvo).isFile() ? alvo : null
}

const HTML = 'text/html; charset=utf-8'

/**
 * So o que `vite build` emite. Extensao desconhecida vira octet-stream, que o
 * navegador baixa em vez de executar — recusar por omissao e melhor que anunciar
 * um tipo adivinhado.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': HTML,
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

function contentTypeOf(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

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
