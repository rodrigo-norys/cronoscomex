import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import {
  type AppConfig,
  type ConfigFieldReport,
  ConfigWriteError,
  checkWorkbookPath,
  describeConfig,
  saveWorkbookPath,
  WORKBOOK_UNSET,
} from '../../app/config.ts'
import {
  FileDialogFailedError,
  FileDialogUnavailableError,
  openWorkbookDialog,
} from '../../app/file-dialog.ts'
import {
  store as defaultStore,
  reconfigureWorkbook,
  type StoreAccess,
  type StoreState,
} from '../../app/process-store.ts'
import { apiError } from '../errors.ts'
import { buildHealthResponse, type HealthResponse } from './health.ts'
import { WEB_DIST } from './static.ts'

/**
 * GET e PUT /api/config/workbook — contrato em docs/05-contratos-api.md.
 *
 * A saida de PD-01: o operador aponta a aplicacao para a planilha dele pela
 * tela, e nunca edita o `app.json` a mao — arquivo com aspas, virgulas e
 * barras invertidas do Windows, num painel cujo usuario final nao e tecnico.
 *
 * **A conferencia acontece ANTES da gravacao**, e e por isso que um caminho
 * invalido nunca derruba o que ja funcionava: o arquivo so e tocado depois que
 * o candidato passou. O criterio de aceite exige exatamente isso.
 *
 * O GET virou o INVENTARIO da configuracao em H-35: alem do caminho, os oito
 * campos com a origem de cada valor. Ele nao calcula nada — `describeConfig`
 * monta o inventario e a rota so serializa (regra inviolavel 6).
 *
 * `POST /browse` abre o seletor do sistema e devolve o caminho escolhido, SEM
 * gravar (H-37): o `PUT` continua sendo a unica porta de gravacao, com a
 * conferencia que ja existe. O operador ve o que escolheu antes de trocar a
 * planilha da empresa.
 */
export interface WorkbookConfigResponse {
  workbookPath: string
  /** Ha caminho configurado. NAO e o mesmo que existir em disco. */
  defined: boolean
  exists: boolean
  readable: boolean
  /**
   * A aba configurada apareceu na ULTIMA LEITURA BEM-SUCEDIDA.
   *
   * `null` enquanto nao houve nenhuma. Deduzir a presenca da aba do caminho
   * seria adivinhar (regra inviolavel 3), e abrir o arquivo so para responder
   * isto duplicaria o leitor numa segunda regra.
   */
  sheetPresent: boolean | null
  configFile: {
    path: string
    present: boolean
    parseable: boolean
  }
  fields: ConfigFieldReport[]
  /**
   * As etapas de partida que o navegador CONSEGUE conferir (H-36).
   *
   * As duas primeiras do `scripts/iniciar.cmd` — Node instalado e Node >= 22 —
   * nao entram: a pagina e servida PELO Node, entao chegar aqui ja e a prova
   * delas, e reporta-las como pendentes seria impossivel por construcao. O que
   * sobra e o que muda depois da partida.
   */
  runtime: {
    /** `process.versions.node` real, e nao o de `.nvmrc`: e o que esta rodando. */
    nodeVersion: string
    /** `dist/web/index.html` existe AGORA — a SPA em memoria nao prova nada. */
    webBuilt: boolean
  }
}

function sheetPresent(config: AppConfig, state: StoreState): boolean | null {
  if (state.lastReadAt === null || !state.lastReadOk) return null
  // `sheetName` nulo na config significa "a primeira aba do arquivo", que esta
  // em escopo por definicao — nao ha nome a conferir.
  return config.sheetName === null || state.sheetName === config.sheetName
}

interface PutBody {
  path?: unknown
}

/**
 * `null` quando o operador cancelou.
 *
 * Cancelar e uma escolha, e nao uma falha: um erro aqui faria a tela acusar
 * problema onde o operador so mudou de ideia.
 */
export interface BrowseResponse {
  path: string | null
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
  /** Ponto de injecao para teste. Nenhum teste toca o `app.json` real. */
  configPath?: string,
  /**
   * Abre o seletor do sistema. O padrao usa o dialogo do Windows, que nenhum
   * teste alcanca — por isso a injecao chega ate aqui, e nao para no modulo.
   */
  openDialog: () => Promise<string | null> = openWorkbookDialog,
  /**
   * Onde `vite build` escreve. Ponto de injecao pela regra inviolavel 7: o
   * portao roda `test` ANTES de `build`, e no CI o checkout e limpo — um teste
   * que lesse `dist/web` do disco ficaria verde na maquina de quem acabou de
   * compilar e vermelho no CI, sem nada ter mudado no codigo.
   */
  webRoot: string = WEB_DIST,
): void {
  app.get('/api/config/workbook', (): WorkbookConfigResponse => {
    const check = checkWorkbookPath(config.workbookPath)
    const report = describeConfig(config, configPath)

    return {
      workbookPath: config.workbookPath,
      defined: config.workbookPath !== WORKBOOK_UNSET,
      exists: check.exists,
      readable: check.readable,
      sheetPresent: sheetPresent(config, store.getState()),
      configFile: {
        path: report.path,
        present: report.present,
        parseable: report.parseable,
      },
      fields: report.fields,
      runtime: {
        nodeVersion: process.versions.node,
        // Consultado a cada requisicao, e nao na partida: e o que faz o botao
        // Atualizar valer alguma coisa depois de o operador compilar.
        webBuilt: existsSync(join(webRoot, 'index.html')),
      },
    }
  })

  app.post(
    '/api/config/workbook/browse',
    async (_request, reply): Promise<BrowseResponse | undefined> => {
      try {
        return { path: await openDialog() }
      } catch (error) {
        // Indisponivel NAO e falha: e uma maquina que nao tem como abrir a janela,
        // e a saida do operador e digitar o caminho — que continua funcionando.
        if (error instanceof FileDialogUnavailableError) {
          return reply.code(501).send(apiError('SELETOR_INDISPONIVEL', error.message))
        }
        if (error instanceof FileDialogFailedError) {
          return reply.code(500).send(apiError('SELETOR_FALHOU', error.message))
        }
        throw error
      }
    },
  )

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
