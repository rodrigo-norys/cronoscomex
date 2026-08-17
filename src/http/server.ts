import Fastify, { type FastifyInstance } from 'fastify'
import { ColorMapError, loadColorMap } from '../app/color-map-loader.ts'
import { type AppConfig, ConfigError, loadConfig } from '../app/config.ts'
import { createLogger, type Logger } from '../app/logger.ts'
import { store as defaultStore, initStore, reload, type StoreAccess } from '../app/process-store.ts'
import { loadStatusAliases, StatusAliasesError } from '../app/status-aliases-loader.ts'
import { initWriteGuard } from '../app/write-guard.ts'
import type { ColorMapEntry } from '../domain/color-mapper.ts'
import { createWatcher, DEFAULT_DEBOUNCE_MS } from '../io/watcher.ts'
import { registerAlertsRoute } from './routes/alerts.ts'
import { registerApplyRoute } from './routes/apply.ts'
import { registerEditsRoutes } from './routes/edits.ts'
import { registerFilterOptionsRoute } from './routes/filter-options.ts'
import { registerHealthRoute } from './routes/health.ts'
import { registerIndicatorsRoute } from './routes/indicators.ts'
import { registerProcessColorRoute } from './routes/process-color.ts'
import { registerProcessesRoute } from './routes/processes.ts'
import { registerQuarantineRoute } from './routes/quarantine.ts'
import { registerReloadRoute } from './routes/reload.ts'

/**
 * Endereco de escuta. RNF-29: o processo escuta EXCLUSIVAMENTE em loopback.
 * E o que torna a ausencia de autenticacao (RNF-32) uma decisao segura e nao
 * uma omissao — nao existe superficie de rede a proteger.
 */
export const LOOPBACK = '127.0.0.1'

export function buildServer(
  config: AppConfig,
  store: StoreAccess = defaultStore,
  // Carregado aqui so quando quem chama nao o tem em maos. Em producao `main`
  // passa o MESMO mapa que o store e o guard receberam: ler tres vezes
  // permitiria servir, projetar e gravar por mapas diferentes.
  colorMap: readonly ColorMapEntry[] = loadColorMap(),
): FastifyInstance {
  // Silencioso sob teste: a saida do Vitest e o relatorio, nao o log do servidor.
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  })

  registerHealthRoute(app, config, store)
  registerQuarantineRoute(app)
  registerReloadRoute(app, store)
  registerIndicatorsRoute(app, config, store)
  registerAlertsRoute(app, config, store)
  registerFilterOptionsRoute(app, store)
  registerProcessesRoute(app, store)
  registerEditsRoutes(app, store)
  registerProcessColorRoute(app, store, colorMap)
  registerApplyRoute(app)

  return app
}

const STARTUP_ERRORS = [ConfigError, ColorMapError, StatusAliasesError]

async function main(): Promise<void> {
  let config: AppConfig
  // Fora do `try` porque o write-guard, la embaixo, tambem registra nele.
  let logger: Logger
  let colorMap: readonly ColorMapEntry[]
  try {
    config = loadConfig()
    logger = createLogger({ timezone: config.timezone })
    // Expurgo antes da primeira leitura: a partida e o unico momento garantido
    // de execucao numa aplicacao que o operador liga e desliga (RNF-18).
    logger.purgeExpired()

    // Carregado UMA vez e passado aos dois: o store deriva os campos de cor na
    // leitura e o guard resolve o `fillId` na escrita. Dois carregamentos
    // permitiriam ler e gravar por mapas diferentes se o arquivo mudasse entre
    // eles.
    colorMap = loadColorMap()
    initStore({
      config,
      colorMap,
      statusAliases: loadStatusAliases(),
      logger,
    })
  } catch (error) {
    if (STARTUP_ERRORS.some((type) => error instanceof type)) {
      process.stderr.write(`\nErro de configuracao:\n${(error as Error).message}\n\n`)
      process.exit(1)
    }
    throw error
  }

  // A primeira leitura acontece antes de escutar: o painel nunca aparece vazio
  // por ainda nao ter lido. Falha aqui vira estado 'degradado', nao morte do
  // processo — `POST /api/reload` continua disponivel para nova tentativa.
  await reload()

  const app = buildServer(config, defaultStore, colorMap)

  try {
    await app.listen({ host: LOOPBACK, port: config.port })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EADDRINUSE') {
      process.stderr.write(
        `\nA porta ${config.port} ja esta em uso.\n` +
          'Feche a outra instancia ou altere "port" em config/app.json.\n\n',
      )
      process.exit(1)
    }
    throw error
  }

  const watcher = createWatcher(config.workbookPath, DEFAULT_DEBOUNCE_MS)
  watcher.onChange(reload)
  watcher.start()

  // Depois do `start`: o guard pausa e retoma o observador durante a escrita
  // (04-arquitetura.md secao 3.2), e nao teria o que pausar antes disto.
  //
  // Nenhum `queuePath` e passado aqui de proposito. O guard e `registerEditsRoutes`
  // tem pontos de injecao independentes, que so coincidem pelo mesmo default:
  // divergi-los faria o guard arquivar um arquivo que as rotas nao escrevem, e a
  // fila do operador ficaria para tras a cada aplicacao. Enquanto os dois usarem
  // o default nao ha como divergirem — e passar um so aqui seria exatamente o
  // jeito de quebrar isso.
  initWriteGuard({ config, colorMap, watcher, logger })

  const shutdown = (): void => {
    watcher.stop()
    void app.close().then(() => process.exit(0))
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  app.log.info(`CronosComex em http://${LOOPBACK}:${config.port}`)
}

// Executa apenas quando invocado diretamente; importar para teste nao sobe servidor.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
