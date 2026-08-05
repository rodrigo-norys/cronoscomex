import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import { apiError } from '../errors.ts'

export interface ReloadResponse {
  reloaded: true
  lastReadAt: string | null
  rowsRead: number
  rowsQuarantined: number
}

/**
 * POST /api/reload — contrato em docs/05-contratos-api.md.
 *
 * Forca releitura imediata, sem esperar o watcher. E o caminho de saida quando
 * o evento do sistema de arquivos nao chega — caso previsto na premissa P-08,
 * de pasta acessada por caminho de rede.
 */
export function registerReloadRoute(app: FastifyInstance, store: StoreAccess = defaultStore): void {
  app.post('/api/reload', async (_request, reply) => {
    // O estado 'escrevendo' so passa a ser produzido pelo write-guard (H-25).
    // O guarda existe desde ja porque reler durante a escrita propria leria o
    // arquivo no meio da substituicao.
    if (store.getState().state === 'escrevendo') {
      return reply
        .code(409)
        .send(
          apiError(
            'ESCRITA_EM_ANDAMENTO',
            'Ha uma aplicacao de edicoes em curso. Tente novamente em instantes.',
          ),
        )
    }

    await store.reload()
    const state = store.getState()

    if (state.state === 'degradado') {
      return reply.code(503).send(
        apiError('ARQUIVO_INDISPONIVEL', state.degradedReason ?? 'A planilha nao pode ser lida.', {
          lastReadAt: state.lastReadAt?.toISOString() ?? null,
        }),
      )
    }

    const body: ReloadResponse = {
      reloaded: true,
      lastReadAt: state.lastReadAt?.toISOString() ?? null,
      rowsRead: state.rowsRead,
      rowsQuarantined: state.rowsQuarantined,
    }
    return reply.code(200).send(body)
  })
}
