import { pathToFileURL } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { ClientMapError, loadClientMap } from '../app/client-map-loader.ts'
import { ColorMapError, loadColorMap } from '../app/color-map-loader.ts'
import { type AppConfig, ConfigError, loadConfig, WORKBOOK_UNSET } from '../app/config.ts'
import { createLogger, type Logger } from '../app/logger.ts'
import {
  store as defaultStore,
  initStore,
  reconfigureWorkbook,
  reload,
  type StoreAccess,
} from '../app/process-store.ts'
import { loadStatusAliases, StatusAliasesError } from '../app/status-aliases-loader.ts'
import { loadTeamMap, TeamMapError } from '../app/team-map-loader.ts'
import { initWriteGuard, retargetWatcher } from '../app/write-guard.ts'
import type { ClientGroup } from '../domain/client-mapper.ts'
import type { ColorMapEntry } from '../domain/color-mapper.ts'
import { createWatcher, DEFAULT_DEBOUNCE_MS, type Watcher } from '../io/watcher.ts'
import { registerAlertsRoute } from './routes/alerts.ts'
import { registerApplyRoute } from './routes/apply.ts'
import { registerConfigRoutes } from './routes/config.ts'
import { registerEditsRoutes } from './routes/edits.ts'
import { registerFilterOptionsRoute } from './routes/filter-options.ts'
import { registerHealthRoute } from './routes/health.ts'
import { registerHistoryRoute } from './routes/history.ts'
import { registerIndicatorsRoute } from './routes/indicators.ts'
import { registerProcessColorRoute } from './routes/process-color.ts'
import { registerProcessesRoute } from './routes/processes.ts'
import { registerQuarantineRoute } from './routes/quarantine.ts'
import { registerReloadRoute } from './routes/reload.ts'
import { registerStaticRoute } from './routes/static.ts'

/**
 * Endereco de escuta. RNF-29: o processo escuta EXCLUSIVAMENTE em loopback.
 * E o que torna a ausencia de autenticacao (RNF-32) uma decisao segura e nao
 * uma omissao — nao existe superficie de rede a proteger.
 */
export const LOOPBACK = '127.0.0.1'

/** Sem planilha configurada nao ha observador — nem escrita a coordenar. */
const INERT_WATCHER = { pause: (): void => {}, resume: (): void => {} }

export function buildServer(
  config: AppConfig,
  store: StoreAccess = defaultStore,
  // Carregado aqui so quando quem chama nao o tem em maos. Em producao `main`
  // passa o MESMO mapa que o store e o guard receberam: ler tres vezes
  // permitiria servir, projetar e gravar por mapas diferentes.
  colorMap: readonly ColorMapEntry[] = loadColorMap(),
  // Sem valor aqui: `history-store` resolve o padrao, e RECUSA o padrao sob
  // teste. Um default nesta assinatura anularia essa guarda em todo teste que
  // monta o servidor.
  historyPath?: string,
  /**
   * Aplica um caminho de planilha ja conferido (H-34). Ausente, `PUT
   * /api/config/workbook` so reconfigura o store — que e o certo em teste, onde
   * nao ha watcher. Em producao `main` passa o que tambem troca o observador.
   */
  applyWorkbookPath?: (resolvedPath: string) => Promise<void>,
  /** Ponto de injecao para teste. `saveWorkbookPath` recusa o padrao sob teste. */
  configPath?: string,
  /** Abre o seletor do sistema (H-37). Ausente, vale o dialogo do Windows. */
  openDialog?: () => Promise<string | null>,
  /** Raiz da interface compilada (H-36). Ausente, vale `dist/web`. */
  webRoot?: string,
  /**
   * Grupos de clientes do filtro (H-55). O padrao e a lista VAZIA, e nao a
   * leitura do arquivo: `client-map.json` e estado real do operador, e um
   * default que o lesse faria toda montagem de servidor em teste depender dele
   * (regra inviolavel 7). Em producao `main` passa o mesmo mapa que o store
   * recebeu.
   */
  clientGroups: readonly ClientGroup[] = [],
): FastifyInstance {
  // Silencioso sob teste: a saida do Vitest e o relatorio, nao o log do servidor.
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  })

  registerHealthRoute(app, config, store)
  registerConfigRoutes(app, config, store, applyWorkbookPath, configPath, openDialog, webRoot)
  registerQuarantineRoute(app)
  registerReloadRoute(app, store)
  registerIndicatorsRoute(app, config, store)
  registerAlertsRoute(app, config, store, historyPath)
  registerFilterOptionsRoute(app, store, clientGroups)
  registerProcessesRoute(app, config, store, historyPath)
  registerHistoryRoute(app, config, store, historyPath)
  registerEditsRoutes(app, store)
  registerProcessColorRoute(app, store, colorMap)
  registerApplyRoute(app)

  // Por ultimo: `GET /*` e o catch-all, e registra-la antes nao mudaria o
  // roteamento — mas leria como se as rotas de API fossem o caso excepcional.
  registerStaticRoute(app, webRoot)

  return app
}

/**
 * Erros que MATAM a partida, com mensagem em vez de pilha.
 *
 * Os dois mapas de `H-48` entram porque JSON malformado e engano que nenhuma
 * tela conserta — arquivo AUSENTE nao chega aqui: os loaders devolvem lista
 * vazia, e a aplicacao sobe sem consolidacao, que e o estado de quem ainda nao
 * configurou (mesma regra de `H-34`).
 */
const STARTUP_ERRORS = [
  ConfigError,
  ColorMapError,
  StatusAliasesError,
  ClientMapError,
  TeamMapError,
]

async function main(): Promise<void> {
  let config: AppConfig
  // Fora do `try` porque o write-guard, la embaixo, tambem registra nele.
  let logger: Logger
  let colorMap: readonly ColorMapEntry[]
  // Fora do `try` pelo mesmo motivo do mapa de cor: a rota de opcoes, montada
  // abaixo, precisa dos MESMOS grupos que o store recebeu.
  let clientGroups: readonly ClientGroup[]
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
    // Os dois mapas de negocio (`H-48`) sao lidos na partida para que um JSON
    // escrito errado apareca aqui, e nao quando o operador abrir a Pagina
    // Clientes com o campo silenciosamente sem consolidacao.
    const clientMap = loadClientMap()
    clientGroups = clientMap.groups
    initStore({
      config,
      colorMap,
      statusAliases: loadStatusAliases(),
      clientMap: clientMap.clients,
      clientGroups: clientMap.groups,
      teamMap: loadTeamMap(),
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

  const app = buildServer(
    config,
    defaultStore,
    colorMap,
    undefined,
    (path) => applyWorkbookPath(path),
    undefined,
    undefined,
    undefined,
    clientGroups,
  )

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

  /**
   * O watcher e o UNICO consumidor que guarda uma copia do caminho, e por isso
   * ele — e so ele — precisa ser recriado quando o caminho muda (H-34). Todos
   * os demais leem `config.workbookPath` por referencia do mesmo objeto, que
   * `reconfigureWorkbook` muta.
   *
   * Nulo enquanto nao ha planilha configurada: observar o diretorio corrente a
   * espera de um arquivo sem nome nao vigia nada e ainda segura um descritor.
   */
  let watcher: Watcher | null = null

  const startWatching = (path: string): void => {
    const next = createWatcher(path, DEFAULT_DEBOUNCE_MS)
    next.onChange(reload)
    next.start()
    watcher = next
    // O guard pausa e retoma o observador durante a escrita cirurgica. Segurando
    // o antigo, ele pausaria um watcher que nao observa mais nada, e o novo
    // dispararia releitura no meio da gravacao.
    retargetWatcher(next)
  }

  if (config.workbookPath !== WORKBOOK_UNSET) startWatching(config.workbookPath)

  /**
   * A releitura vem ANTES da troca de observador: `reconfigureWorkbook` espera
   * a leitura em voo e rele com o caminho novo, e so entao passa a observar.
   * Invertido, o watcher novo poderia disparar uma releitura concorrente com a
   * que a propria reconfiguracao ja fez.
   */
  const applyWorkbookPath = async (resolvedPath: string): Promise<void> => {
    await reconfigureWorkbook(resolvedPath)
    watcher?.stop()
    startWatching(resolvedPath)
  }

  // Depois do `start`: o guard pausa e retoma o observador durante a escrita
  // (04-arquitetura.md secao 3.2), e nao teria o que pausar antes disto.
  //
  // Nenhum `queuePath` e passado aqui de proposito. O guard e `registerEditsRoutes`
  // tem pontos de injecao independentes, que so coincidem pelo mesmo default:
  // divergi-los faria o guard arquivar um arquivo que as rotas nao escrevem, e a
  // fila do operador ficaria para tras a cada aplicacao. Enquanto os dois usarem
  // o default nao ha como divergirem — e passar um so aqui seria exatamente o
  // jeito de quebrar isso.
  // `watcher` e nulo enquanto nao ha planilha configurada, e ai nao ha o que
  // pausar: sem caminho nao ha escrita. O primeiro salvamento bem-sucedido chama
  // `retargetWatcher` com o observador de verdade — e as chamadas de
  // `startWatching` anteriores a esta linha sao silenciosas de proposito, porque
  // o guard ainda nao existe.
  initWriteGuard({ config, colorMap, watcher: watcher ?? INERT_WATCHER, logger })

  const shutdown = (): void => {
    watcher?.stop()
    void app.close().then(() => process.exit(0))
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  app.log.info(`CronosComex em http://${LOOPBACK}:${config.port}`)
}

/**
 * Executa apenas quando invocado diretamente; importar para teste nao sobe
 * servidor.
 *
 * `pathToFileURL`, e NUNCA concatenar `file://` com o caminho. A concatenacao
 * esteve aqui de H-30 ate 19/08/2026 e funcionava em Linux por acidente — o
 * caminho ja comeca com barra, entao `file://` + `/home/...` produz as tres
 * barras certas. Em Windows `process.argv[1]` e `C:\...\server.ts`, a
 * concatenacao produz `file://C:\...` e `import.meta.url` traz
 * `file:///C:/...`: nunca batem.
 *
 * **O modo de falha e mudo, e por isso custou uma sessao inteira de teste.**
 * `main()` nao roda, o processo carrega os modulos e termina com codigo ZERO —
 * sem erro, sem servidor, sem nada escutando. `scripts/iniciar.cmd` lia o zero
 * como termino normal e fechava a janela, e o navegador abria em
 * ERR_CONNECTION_REFUSED. Medido na primeira execucao real em Windows (PD-06),
 * que e o unico ambiente onde o defeito existe — e o unico que nenhum teste
 * alcanca.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
