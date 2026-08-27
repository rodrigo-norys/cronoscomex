import type { FastifyInstance } from 'fastify'
import {
  DEFAULT_QUARANTINE_PATH,
  type QuarantineReport,
  readReport,
} from '../../io/quarantine-reporter.ts'

/**
 * O corpo da rota, que **nao** e o `QuarantineReport` do disco.
 *
 * Enquanto nao houve leitura, `generatedAt` e `sourceFileHash` valem `null` — o
 * relatorio persistido nunca tem esses campos nulos, mas a resposta vazia tem.
 * Sem esta declaracao o cliente tipava os dois como `string` e receberia `null`
 * em execucao, que e a mesma classe de defeito do `today` ausente em `H-15`:
 * tipo descrevendo o contrato de um caso e a resposta vindo de outro.
 */
export interface QuarantineResponse
  extends Omit<QuarantineReport, 'generatedAt' | 'sourceFileHash'> {
  generatedAt: string | null
  sourceFileHash: string | null
}

/**
 * GET /api/quarantine — contrato em docs/05-contratos-api.md.
 *
 * Le o ultimo relatorio gravado. Enquanto nao houver leitura, devolve um
 * relatorio vazio em vez de 404: a interface precisa distinguir "ainda nao
 * leu" de "leu e nao ha pendencia".
 */
export function registerQuarantineRoute(
  app: FastifyInstance,
  path = DEFAULT_QUARANTINE_PATH,
): void {
  app.get('/api/quarantine', (): QuarantineResponse => {
    const report = readReport(path)
    if (report) return report

    return {
      generatedAt: null,
      sourceFileHash: null,
      totalDataRows: 0,
      acceptedRows: 0,
      quarantinedRows: 0,
      quarantineRate: 0,
      items: [],
      anomalies: [],
    }
  })
}
