import Fastify, { type FastifyInstance } from 'fastify'
import { ColorMapError, loadColorMap } from '../app/color-map-loader.ts'
import { type AppConfig, ConfigError, loadConfig } from '../app/config.ts'
import { createLogger } from '../app/logger.ts'
import { store as defaultStore, initStore, reload, type StoreAccess } from '../app/process-store.ts'
import { loadStatusAliases, StatusAliasesError } from '../app/status-aliases-loader.ts'
import { createWatcher, DEFAULT_DEBOUNCE_MS } from '../io/watcher.ts'
import { registerAlertsRoute } from './routes/alerts.ts'
import { registerFilterOptionsRoute } from './routes/filter-options.ts'
import { registerHealthRoute } from './routes/health.ts'
import { registerIndicatorsRoute } from './routes/indicators.ts'
import { registerQuarantineRoute } from './routes/quarantine.ts'
import { registerReloadRoute } from './routes/reload.ts'

/**
 * Endereco de escuta. RNF-29: o processo escuta EXCLUSIVAMENTE em loopback.
 * E o que torna a ausencia de autenticacao (RNF-32) uma decisao segura e nao
 * uma omissao — nao existe superficie de rede a proteger.
 */
export const LOOPBACK = '127.0.0.1'

export function buildServer(config: AppConfig, store: StoreAccess = defaultStore): FastifyInstance {
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

  return app
}

const STARTUP_ERRORS = [ConfigError, ColorMapError, StatusAliasesError]

async function main(): Promise<void> {
  let config: AppConfig
  try {
    config = loadConfig()
    const logger = createLogger({ timezone: config.timezone })
    // Expurgo antes da primeira leitura: a partida e o unico momento garantido
    // de execucao numa aplicacao que o operador liga e desliga (RNF-18).
    logger.purgeExpired()

    initStore({
      config,
      colorMap: loadColorMap(),
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

  const app = buildServer(config)

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
