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
 * **Para conferir ESCRITA**, a partir da Fase 3, o preambulo e outro — copiar,
 * exercer, comparar o zip:
 *
 *     const { copiarPlanilha, compararZip } = await import(…)
 *     const { copia, config, bytesOriginais } = await copiarPlanilha(area)
 *     // … initWriteGuard sobre `config`, applyPendingEdits() …
 *     const { identicas, mudadas } = await compararZip(referencia, copia)
 *
 * A copia e obrigatoria: **nenhuma conferencia abre o arquivo real para
 * escrita**. Em `H-25` e `H-26` este preambulo foi reescrito em onze scripts.
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
  const { loadClientMap } = await modulo('src/app/client-map-loader.ts')
  const { loadTeamMap } = await modulo('src/app/team-map-loader.ts')
  const { getState, initStore, reload } = await modulo('src/app/process-store.ts')
  const dateWindow = await modulo('src/domain/date-window.ts')

  // Os dois mapas de `H-48` entram aqui pelo mesmo motivo que os outros tres:
  // a conferencia mede o que a producao serve. Omiti-los faria a medicao ver um
  // cliente e um responsavel que o painel do operador nao mostra.
  const config = loadConfig()
  initStore({
    config,
    colorMap: loadColorMap(),
    statusAliases: loadStatusAliases(),
    clientMap: loadClientMap(),
    teamMap: loadTeamMap(),
  })
  await reload()

  const estado = getState()

  // O dominio inteiro vem junto para o script nao precisar de mais um import
  // por indicador medido. Sao oito modulos e o custo e uma resolucao de ESM.
  const dominio = {
    dateWindow,
    indicators: await modulo('src/domain/indicators.ts'),
    alerts: await modulo('src/domain/alerts.ts'),
    filters: await modulo('src/domain/filters.ts'),
    normalizer: await modulo('src/domain/normalizer.ts'),
    types: await modulo('src/domain/types.ts'),
    clientMapper: await modulo('src/domain/client-mapper.ts'),
    teamMapper: await modulo('src/domain/team-mapper.ts'),
  }

  return {
    processes: estado.processes,
    hoje: dateWindow.today(config.timezone),
    config,
    estado,
    dominio,
  }
}

/**
 * Uma COPIA da planilha real, com a config apontando para ela.
 *
 * **O original nunca e aberto para escrita.** Conferir a Fase 3 exige exercer a
 * escrita sobre a estrutura verdadeira do arquivo — 649 linhas, formatacao
 * condicional, validacao —, e a unica forma segura e sobre copia.
 *
 * Existe porque `H-25` e `H-26` repetiram este preambulo em onze scripts:
 * `loadConfig`, copiar, remontar a config, e so entao chamar o write-guard.
 *
 * @param {string} destino diretorio de trabalho, normalmente no scratchpad
 * @returns {Promise<{copia: string, config: object, bytesOriginais: Buffer}>}
 */
export async function copiarPlanilha(destino) {
  const { copyFileSync, mkdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { loadConfig } = await modulo('src/app/config.ts')

  const real = loadConfig()
  mkdirSync(destino, { recursive: true })
  const copia = join(destino, 'planilha.xlsx')
  copyFileSync(real.workbookPath, copia)

  return {
    copia,
    config: { ...real, workbookPath: copia },
    bytesOriginais: readFileSync(copia),
  }
}

/**
 * O `fflate` resolvido pelo caminho do pacote.
 *
 * Script no scratchpad **nao** resolve `import 'fflate'`: ele esta fora da
 * arvore do projeto, e o Node procura `node_modules` a partir do proprio
 * arquivo. Medido em `H-25`: `ERR_MODULE_NOT_FOUND` na primeira conferencia,
 * e o mesmo contorno reescrito em oito scripts depois dela.
 */
export async function fflate() {
  return await import(pathToFileURL(resolve(RAIZ, 'node_modules/fflate/esm/browser.js')).href)
}

/**
 * Compara duas versoes do `.xlsx` **entrada a entrada**, pelo conteudo
 * descomprimido — o criterio de ADR-0004, e nao os bytes comprimidos:
 * recompactar reproduz o conteudo, nao o fluxo deflate do Excel.
 *
 * E a conferencia que toda historia de escrita faz antes de fechar. Medido em
 * `H-26`: 27 das 28 entradas identicas, so a aba alvo mudou.
 *
 * @returns {Promise<{total: number, identicas: number, mudadas: string[]}>}
 */
export async function compararZip(caminhoA, caminhoB) {
  const { readFileSync } = await import('node:fs')
  const { unzipSync } = await fflate()

  const ler = (caminho) => {
    const zip = unzipSync(new Uint8Array(readFileSync(caminho)))
    return Object.fromEntries(
      Object.entries(zip).map(([nome, dados]) => [nome, Buffer.from(dados)]),
    )
  }

  const antes = ler(caminhoA)
  const depois = ler(caminhoB)
  const nomes = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].sort()
  const mudadas = nomes.filter(
    (nome) =>
      Buffer.compare(antes[nome] ?? Buffer.alloc(0), depois[nome] ?? Buffer.alloc(0)) !== 0,
  )

  return { total: nomes.length, identicas: nomes.length - mudadas.length, mudadas }
}

/** Atalho para imprimir um resultado de medicao sem repetir o JSON.stringify. */
export function reportar(titulo, valores) {
  console.log(`\n=== ${titulo} ===`)
  console.log(JSON.stringify(valores, null, 2))
}
