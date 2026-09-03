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
 * **Mas ela ESCREVE**, e por padrao no temporario desde 02/09/2026. Antes disso
 * `carregarPlanilha()` sobrescrevia `data/quarantine.json` em toda execucao bem
 * sucedida e fazia append em `data/history.jsonl` — os dois sao estado do
 * operador, e o segundo alimenta a Pagina Historico. Pior que a escrita era a
 * assimetria: sob `NODE_ENV=test` o historico era pulado EM SILENCIO
 * (`persistHistory` engole a recusa num `catch` nu), entao a mesma conferencia
 * media diferente conforme a variavel de ambiente, sem erro nenhum.
 *
 * Quem precisa da serie REAL passa os caminhos:
 *
 *     await carregarPlanilha({
 *       quarantinePath: 'data/quarantine.json',
 *       historyPath: 'data/history.jsonl',
 *     })
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
export async function carregarPlanilha({ quarantinePath, historyPath } = {}) {
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
  const clientMap = loadClientMap()

  // Padrao no temporario, como `medir-navegador.mjs` ja fazia: sem isto o
  // `reload()` grava em `data/`, que e estado do operador. Sobrescrivivel de
  // proposito — uma conferencia de ALE-06 ou da Pagina Historico apontada para
  // um temporario veria serie VAZIA e mediria numero errado sem aviso, que e
  // exatamente o que a regra inviolavel 3 proibe.
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const area = mkdtempSync(join(tmpdir(), 'cronos-conferencia-'))

  initStore({
    config,
    colorMap: loadColorMap(),
    statusAliases: loadStatusAliases(),
    clientMap: clientMap.clients,
    clientGroups: clientMap.groups,
    teamMap: loadTeamMap(),
    quarantinePath: quarantinePath ?? join(area, 'quarantine.json'),
    historyPath: historyPath ?? join(area, 'history.jsonl'),
  })
  await reload()

  const estado = getState()

  // TODOS os modulos de `src/domain/`, enumerados do diretorio — o script nao
  // precisa de mais um import por indicador medido, e a lista nao envelhece.
  // Ela ja envelheceu duas vezes escrita a mao (6 -> 8), e a segunda mordeu: em
  // 02/09/2026 quatro dos cinco modulos alterados no dia estavam FORA do pacote
  // — `color-mapper`, `process-query`, `process-builder` e `process-projection`
  // —, entao a conferencia daquele trabalho precisava importar a mao justamente
  // o que este arquivo existe para evitar.
  //
  // O filtro por extensao e obrigatorio: `readdirSync` devolve o `.fronteira.md`
  // do mesmo diretorio. `types.ts` nao exporta nada em runtime e entra so por
  // simetria.
  const { readdirSync } = await import('node:fs')
  const camelCase = (nome) =>
    nome.replace(/\.ts$/, '').replace(/-(\w)/g, (_, letra) => letra.toUpperCase())

  const dominio = { dateWindow }
  for (const arquivo of readdirSync(resolve(RAIZ, 'src/domain')).filter((f) => f.endsWith('.ts'))) {
    dominio[camelCase(arquivo)] = await modulo(`src/domain/${arquivo}`)
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
 * escrita sobre a estrutura verdadeira do arquivo — a `Tabela1` cobrindo
 * `A1:P997` com o autofiltro dentro dela, os comentarios encadeados, o estilo
 * que cada `<col>` declara e as 30 entradas do zip —, e a unica forma segura e
 * sobre copia.
 *
 * A aba `2026` **nao tem** formatacao condicional, validacao de dados,
 * autofiltro proprio, celula mesclada nem `calcChain` — medido em 02/09/2026, e
 * o texto anterior prometia as duas primeiras. Quem precisa exercer CF, DV ou
 * formula usa `tests/fixtures/formatado.xlsx`, onde `enriquecer_formatado` as
 * injetou de proposito, justamente porque o arquivo real nao as oferece.
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
 * E a conferencia que toda historia de escrita faz antes de fechar. Sobre copia
 * do arquivo real sao **30** entradas, e quantas mudam depende da cirurgia:
 * `H-25` mediu 29 identicas (so `sheet1.xml`), `H-27` mediu 28 (`sheet1.xml` e
 * `styles.xml`). O "27 de 28" de `H-26` veio do caminho fim a fim sobre
 * fixture, que tem 28 entradas — nao do arquivo real.
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
