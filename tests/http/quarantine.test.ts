import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerQuarantineRoute } from '../../src/http/routes/quarantine.ts'
import type { QuarantineReport } from '../../src/io/quarantine-reporter.ts'

/**
 * `GET /api/quarantine` — a unica rota que estava sem teste de servidor.
 *
 * A ausencia so apareceu quando `tests/repo/contratos.test.ts` passou a exigir
 * o par rota↔teste. Ate aqui, o unico exercicio dela era o stub do cliente, que
 * por definicao devolve o que a interface espera — nao o que a rota produz.
 *
 * A rota recebe o caminho por parametro, entao o teste monta a instancia sem
 * `buildServer`: e o que permite apontar para um arquivo temporario em vez de
 * `data/quarantine.json`, que RNF-37 proibe tocar.
 */

let directory: string
let reportPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-quarentena-'))
  reportPath = join(directory, 'quarantine.json')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function buildApp() {
  const app = Fastify({ logger: false })
  registerQuarantineRoute(app, reportPath)
  return app
}

function write(report: QuarantineReport): void {
  writeFileSync(reportPath, JSON.stringify(report), 'utf-8')
}

const REPORT: QuarantineReport = {
  generatedAt: '2026-08-07T12:00:00.000Z',
  sourceFileHash: 'sha256:abc',
  totalDataRows: 649,
  acceptedRows: 648,
  quarantinedRows: 1,
  quarantineRate: 0.0015,
  items: [{ sourceRow: 42, ref: '', reason: 'REF_AUSENTE', detail: 'coluna A vazia' }],
  anomalies: [],
}

describe('GET /api/quarantine', () => {
  it('devolve o relatorio gravado, com o contrato de 05-contratos-api.md', async () => {
    write(REPORT)
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/quarantine' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(REPORT)

    await app.close()
  })

  /**
   * Relatorio vazio, e nao `404`: a interface precisa distinguir "ainda nao
   * leu" de "leu e nao ha pendencia". Um `404` colapsaria os dois num erro, e o
   * painel de saude sumiria em vez de dizer que ainda nao ha leitura.
   */
  it('devolve relatorio vazio quando nunca houve leitura', async () => {
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/quarantine' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      generatedAt: null,
      sourceFileHash: null,
      totalDataRows: 0,
      acceptedRows: 0,
      quarantinedRows: 0,
      quarantineRate: 0,
      items: [],
      anomalies: [],
    })

    await app.close()
  })

  /**
   * `generatedAt` e `sourceFileHash` sao `string | null` no corpo da rota e
   * `string` no relatorio do disco. A distincao existe porque o cliente tipava
   * os dois como `string` e recebia `null` em execucao — mesma classe do
   * `today` ausente que derrubou a casca em `H-15`.
   */
  it('fixa a lista completa de campos, nos dois casos', async () => {
    const app = buildApp()
    const vazio = Object.keys((await app.inject({ url: '/api/quarantine' })).json()).sort()

    write(REPORT)
    const preenchido = Object.keys((await app.inject({ url: '/api/quarantine' })).json()).sort()

    expect(vazio).toEqual([
      'acceptedRows',
      'anomalies',
      'generatedAt',
      'items',
      'quarantineRate',
      'quarantinedRows',
      'sourceFileHash',
      'totalDataRows',
    ])
    expect(preenchido).toEqual(vazio)

    await app.close()
  })

  // Arquivo corrompido cai no mesmo caminho de "nunca houve leitura": o
  // relatorio e complementar, e derrubar a rota por causa dele apagaria o
  // painel de saude inteiro.
  it('trata relatorio ilegivel como ausencia, sem derrubar a rota', async () => {
    writeFileSync(reportPath, '{ isto nao e json', 'utf-8')
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/quarantine' })

    expect(response.statusCode).toBe(200)
    expect(response.json().generatedAt).toBeNull()

    await app.close()
  })
})
