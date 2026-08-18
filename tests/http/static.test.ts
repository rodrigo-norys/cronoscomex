import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerStaticRoute, WEB_DIST } from '../../src/http/routes/static.ts'

/**
 * `GET /*` (`H-30`, A-63) — a rota que faz a recarga direta de URL funcionar.
 *
 * A raiz e injetada para o teste apontar para um diretorio temporario: `dist/`
 * e artefato de build, e o portao roda `test` ANTES de `build` — depender dele
 * faria o resultado mudar conforme o que sobrou da execucao anterior.
 */

const INDEX = '<!doctype html><html><body><div id="root"></div></body></html>'

let directory: string
let root: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-estatico-'))
  root = join(directory, 'web')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function compile(): void {
  mkdirSync(join(root, 'assets'), { recursive: true })
  writeFileSync(join(root, 'index.html'), INDEX, 'utf-8')
  writeFileSync(join(root, 'assets', 'index-abc123.js'), 'export const painel = 1\n', 'utf-8')
}

function buildApp() {
  const app = Fastify({ logger: false })
  registerStaticRoute(app, root)
  return app
}

describe('GET /* — serve a SPA compilada', () => {
  it('aponta para dist/web, o outDir de web/vite.config.ts', () => {
    expect(WEB_DIST).toBe('dist/web')
  })

  it('devolve index.html na raiz', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.headers['content-type']).toContain('text/html')
    expect(resposta.body).toBe(INDEX)

    await app.close()
  })

  /**
   * O caso que A-63 descreve: `/alertas` e endereco real desde a casca de
   * `H-15`, e o operador pode marca-lo como favorito ou recarregar com F5.
   */
  it('devolve index.html em caminho da casca, e nao 404', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/alertas' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.body).toBe(INDEX)

    await app.close()
  })

  /**
   * Caso-limite do backlog: caminho FORA do mapa da casca responde igual. Quem
   * exibe "pagina nao encontrada" e o cliente — o servidor nao conhece as rotas
   * dele, e passar a conhece-las duplicaria o mapa de `web/src/router.ts`.
   */
  it('devolve index.html tambem em caminho que a casca nao conhece', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/relatorios' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.body).toBe(INDEX)

    await app.close()
  })

  it('preserva a query string sem interferir na resposta', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/processos?responsavel=bazar' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.body).toBe(INDEX)

    await app.close()
  })

  it('serve os assets pelo caminho real, e nao o index', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' })

    expect(resposta.statusCode).toBe(200)
    expect(resposta.body).toContain('export const painel')

    await app.close()
  })
})

describe('GET /* — o que a rota NAO captura', () => {
  /**
   * Sem a guarda de prefixo, `/*` engoliria toda URL de API digitada errado e
   * devolveria o HTML da casca com `200` — o erro viraria tela em branco, e o
   * diagnostico apontaria para o cliente.
   */
  it('deixa caminho de API cair no 404 do Fastify', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/api/inexistente' })

    expect(resposta.statusCode).toBe(404)
    expect(resposta.body).not.toContain('<div id="root">')

    await app.close()
  })

  it('nao captura outro metodo alem de GET', async () => {
    compile()
    const app = buildApp()

    const resposta = await app.inject({ method: 'POST', url: '/alertas' })

    expect(resposta.statusCode).toBe(404)

    await app.close()
  })
})

describe('GET /* — sem o build (caso-limite de H-30)', () => {
  /**
   * O registro nao pode depender da pasta: o portao roda `test` antes de
   * `build`, e no CI o checkout e limpo. `tests/repo/contratos.test.ts` monta o
   * servidor e exige a rota nesse exato instante.
   */
  it('registra a rota mesmo com a pasta inexistente', async () => {
    const app = buildApp()

    expect(app.hasRoute({ method: 'GET', url: '/*' })).toBe(true)

    await app.close()
  })

  it('explica que falta rodar o build, em vez de 404 cru', async () => {
    const app = buildApp()

    const resposta = await app.inject({ method: 'GET', url: '/alertas' })

    expect(resposta.statusCode).toBe(503)
    expect(resposta.headers['content-type']).toContain('text/html')
    expect(resposta.body).toContain('npm run build')
    expect(resposta.body).toContain(root)

    await app.close()
  })

  /**
   * A pasta pode nascer com o servidor no ar — o operador roda o `build` e
   * recarrega. Consultar por requisicao evita exigir reinicio.
   */
  it('passa a servir assim que a pasta aparece, sem reiniciar', async () => {
    const app = buildApp()

    expect((await app.inject({ method: 'GET', url: '/alertas' })).statusCode).toBe(503)
    compile()
    const depois = await app.inject({ method: 'GET', url: '/alertas' })

    expect(depois.statusCode).toBe(200)
    expect(depois.body).toBe(INDEX)

    await app.close()
  })
})
