import type { FastifyInstance } from 'fastify'
import {
  type AppConfig,
  ConfigWriteError,
  checkWorkbookPath,
  saveWorkbookPath,
} from '../../app/config.ts'
import {
  store as defaultStore,
  reconfigureWorkbook,
  type StoreAccess,
} from '../../app/process-store.ts'
import { apiError } from '../errors.ts'
import { buildHealthResponse, type HealthResponse } from './health.ts'

/**
 * GET e PUT /api/config/workbook — contrato em docs/05-contratos-api.md.
 *
 * A saida de PD-01: o operador aponta a aplicacao para a planilha dele pela
 * tela, e nunca edita `config/app.json` a mao — arquivo com aspas, virgulas e
 * barras invertidas do Windows, num painel cujo usuario final nao e tecnico.
 *
 * **A conferencia acontece ANTES da gravacao**, e e por isso que um caminho
 * invalido nunca derruba o que ja funcionava: o arquivo so e tocado depois que
 * o candidato passou. O criterio de aceite exige exatamente isso.
 */
export interface WorkbookConfigResponse {
  workbookPath: string
  exists: boolean
  readable: boolean
}

interface PutBody {
  path?: unknown
}

export function registerConfigRoutes(
  app: FastifyInstance,
  config: AppConfig,
  store: StoreAccess = defaultStore,
  /**
   * Aplica o caminho ja conferido. O padrao so reconfigura o store; em producao
   * `main` passa um que TAMBEM recria o watcher e reaponta o write-guard — o
   * store nao conhece o watcher, e o guard segurando o observador antigo
   * pausaria o arquivo errado durante a escrita.
   */
  applyWorkbookPath: (resolvedPath: string) => Promise<void> = reconfigureWorkbook,
  /** Ponto de injecao para teste. Nenhum teste toca `config/app.json` real. */
  configPath?: string,
): void {
  app.get('/api/config/workbook', (): WorkbookConfigResponse => {
    const check = checkWorkbookPath(config.workbookPath)
    return {
      workbookPath: config.workbookPath,
      exists: check.exists,
      readable: check.readable,
    }
  })

  app.put('/api/config/workbook', async (request, reply): Promise<HealthResponse | undefined> => {
    const body = (request.body ?? {}) as PutBody
    if (typeof body.path !== 'string') {
      return reply.code(400).send(apiError('CAMINHO_INVALIDO', 'Informe `path` como texto.'))
    }

    const check = checkWorkbookPath(body.path)
    if (check.reason !== null) {
      return reply
        .code(400)
        .send(apiError('CAMINHO_INVALIDO', check.reason, { workbookPath: check.resolved }))
    }

    try {
      saveWorkbookPath(check.resolved, configPath)
    } catch (error) {
      if (error instanceof ConfigWriteError) {
        return reply.code(400).send(apiError('CONFIG_NAO_GRAVAVEL', error.message))
      }
      throw error
    }

    // Depois da gravacao: a releitura pode falhar — planilha sem a aba `2026`,
    // por exemplo — e mesmo assim o caminho fica salvo, entrando em 'degradado'
    // com a razao. Recusar aqui esconderia do operador o motivo real.
    await applyWorkbookPath(check.resolved)

    return buildHealthResponse(config, store)
  })
}
