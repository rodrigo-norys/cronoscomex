import type { FastifyInstance } from 'fastify'
import { DEFAULT_QUARANTINE_PATH, readReport } from '../../io/quarantine-reporter.ts'

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
  app.get('/api/quarantine', () => {
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
