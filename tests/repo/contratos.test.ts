import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import type { StoreAccess, StoreState } from '../../src/app/process-store.ts'
import { buildServer } from '../../src/http/server.ts'

/**
 * A guarda das omissões mecânicas — as que não pedem julgamento nenhum.
 *
 * Seis histórias fecharam com a mesma falha de plano: a regra entrou, e a fiação
 * que a entrega ficou de fora da lista de arquivos. `src/http/routes/indicators.ts`
 * foi esquecida **cinco vezes seguidas**, de `H-09` a `H-13`; `H-14` esqueceu o
 * registro da rota e o teste dela. `/fatia` pergunta e pega — mas custa uma
 * conversa por história, e só funciona enquanto alguém invoca a skill.
 *
 * Estas asserções não substituem o protocolo de fatia: o que ele pega é da outra
 * classe — `styleId` em vez de `fillId` em `H-27`, a chave vazia em `H-18`. Isso
 * aqui é o piso mecânico, para o protocolo gastar atenção no que é decisão.
 *
 * **Nada aqui tem lista fixa.** Toda verificação deriva do que existe em disco:
 * acrescentar rota, campo ou página muda a expectativa sozinho.
 */

const config: AppConfig = {
  workbookPath: '/caminho/ficticio/planilha.xlsx',
  sheetName: '2026',
  headerRow: 1,
  firstDataRow: 2,
  port: 0,
  stalledDaysThreshold: 15,
  topN: 10,
  timezone: 'America/Sao_Paulo',
}

const emptyState: StoreState = {
  state: 'pronto',
  processes: [],
  fileHash: 'sha256:abc',
  sheetName: '2026',
  lastReadAt: new Date('2026-08-07T12:00:00.000Z'),
  lastReadOk: true,
  degradedReason: null,
  lastReadDurationMs: 120,
  rowsRead: 0,
  rowsAccepted: 0,
  rowsQuarantined: 0,
  externalLock: false,
  conflictFiles: [],
}

const fakeStore: StoreAccess = { getState: () => emptyState, reload: async () => undefined }

describe('toda rota tem teste de servidor', () => {
  /**
   * `GET /api/quarantine` viveu sem teste até esta guarda existir. O stub do
   * cliente a exercitava, mas stub devolve o que a interface espera — não o que
   * a rota produz, que é justamente o que pode divergir.
   */
  it('pareia src/http/routes/*.ts com tests/http/*.test.ts', () => {
    const routes = readdirSync('src/http/routes')
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
    const tests = new Set(
      readdirSync('tests/http')
        .filter((file) => file.endsWith('.test.ts'))
        .map((file) => file.replace(/\.test\.ts$/, '')),
    )

    expect(routes.length).toBeGreaterThan(0)
    expect(routes.filter((route) => !tests.has(route))).toEqual([])
  })
})

/**
 * Extrai as chaves declaradas num bloco ```jsonc de `05-contratos-api.md`.
 *
 * Compara **chaves**, nunca valores: o documento traz exemplos ilustrativos, e
 * exigir que batam transformaria cada medição nova em falha de teste. O que não
 * pode divergir é a lista de campos — foi ela que ficou para trás cinco vezes.
 */
function documentedShape(heading: string): Record<string, unknown> {
  const document = readFileSync('docs/05-contratos-api.md', 'utf-8')
  const start = document.indexOf(heading)
  if (start === -1) throw new Error(`seção ausente em 05-contratos-api.md: ${heading}`)

  const open = document.indexOf('```jsonc', start)
  const close = document.indexOf('```', open + 8)
  if (open === -1 || close === -1) throw new Error(`bloco jsonc ausente após ${heading}`)

  const body = document
    .slice(open + 8, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  return JSON.parse(body) as Record<string, unknown>
}

async function indicatorsBody(): Promise<Record<string, Record<string, unknown>>> {
  const app = buildServer(config, fakeStore)
  const body = (await app.inject({ method: 'GET', url: '/api/indicators' })).json()
  await app.close()
  return body
}

describe('o documento de contrato acompanha a resposta real', () => {
  /**
   * O elo que o plano erra com regularidade: o indicador é calculado, o campo
   * entra na rota, e `docs/05-contratos-api.md` fica descrevendo a versão
   * anterior. Quem lê o documento para escrever a tela recebe um contrato que
   * não existe mais.
   */
  it('declara os mesmos blocos de topo que GET /api/indicators devolve', async () => {
    const body = await indicatorsBody()
    const documented = documentedShape('### `GET /api/indicators`')

    expect(Object.keys(body).sort()).toEqual(Object.keys(documented).sort())
  })

  // Os cinco esquecimentos de `H-09` a `H-13` foram todos DENTRO de `counts`.
  it.each(['counts', 'rankings', 'meta'])('declara os campos de %s', async (block) => {
    const body = await indicatorsBody()
    const documented = documentedShape('### `GET /api/indicators`')

    expect(Object.keys(body[block] ?? {}).sort()).toEqual(
      Object.keys((documented[block] ?? {}) as Record<string, unknown>).sort(),
    )
  })
})
