import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Carrega a planilha real e devolve o estado pronto para medicao.
 *
 * Existe porque toda conferencia de historia contra o arquivo real repetia o
 * mesmo preambulo — `loadConfig`, `loadColorMap`, `loadStatusAliases`,
 * `initStore`, `reload`, `getState`. Numa unica sessao foram oito scripts com
 * esse bloco identico.
 *
 * **Nao e usado por teste nem por producao.** Teste roda sobre
 * `tests/fixtures/` (RNF-37) e producao usa o servidor. Isto e ferramenta de
 * conferencia manual: o passo 4 do ciclo de `/novo-indicador`, e o "medido na
 * planilha real" que todo fechamento de historia carrega.
 *
 * Uso, a partir de um script no scratchpad:
 *
 *     const { carregarPlanilha, reportar } = await import(
 *       '/caminho/para/tools/carregar-planilha.mjs'
 *     )
 *     const { processes, hoje, config, dominio } = await carregarPlanilha()
 *
 *     reportar('IND-16', {
 *       valor: dominio.indicators.clearedTodayCount(processes, hoje),
 *     })
 *
 * Rode com `node --experimental-strip-types`, e a partir da raiz do projeto —
 * `loadConfig` resolve `config/app.json` relativo ao diretorio corrente.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const modulo = (caminho) => import(pathToFileURL(resolve(RAIZ, caminho)).href)

/**
 * @returns {Promise<{
 *   processes: readonly object[],
 *   hoje: Date,
 *   config: object,
 *   estado: object,
 *   dominio: Record<string, object>,
 * }>}
 */
export async function carregarPlanilha() {
  const { loadConfig } = await modulo('src/app/config.ts')
  const { loadColorMap } = await modulo('src/app/color-map-loader.ts')
  const { loadStatusAliases } = await modulo('src/app/status-aliases-loader.ts')
  const { getState, initStore, reload } = await modulo('src/app/process-store.ts')
  const dateWindow = await modulo('src/domain/date-window.ts')

  const config = loadConfig()
  initStore({ config, colorMap: loadColorMap(), statusAliases: loadStatusAliases() })
  await reload()

  const estado = getState()

  // O dominio inteiro vem junto para o script nao precisar de mais um import
  // por indicador medido. Sao seis modulos e o custo e uma resolucao de ESM.
  const dominio = {
    dateWindow,
    indicators: await modulo('src/domain/indicators.ts'),
    alerts: await modulo('src/domain/alerts.ts'),
    filters: await modulo('src/domain/filters.ts'),
    normalizer: await modulo('src/domain/normalizer.ts'),
    types: await modulo('src/domain/types.ts'),
  }

  return {
    processes: estado.processes,
    hoje: dateWindow.today(config.timezone),
    config,
    estado,
    dominio,
  }
}

/** Atalho para imprimir um resultado de medicao sem repetir o JSON.stringify. */
export function reportar(titulo, valores) {
  console.log(`\n=== ${titulo} ===`)
  console.log(JSON.stringify(valores, null, 2))
}
