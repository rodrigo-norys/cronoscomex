import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { watch } from 'chokidar'

/**
 * Mede, no sistema operacional em que roda, se o watcher recebe evento — e,
 * quando nao recebe, em qual das tres camadas ele para.
 *
 * Existe porque `verify-windows` reprovou na primeira execucao, em 16/09/2026,
 * com um padrao que uma hipotese so nao explica: dos 12 blocos de
 * `tests/io/watcher.test.ts`, **os 6 que esperam disparo falharam e os 6 que
 * esperam silencio passaram**. Lentidao de runner produziria falha parcial;
 * isto parece ausencia total de evento. E o caminho nunca foi exercido em
 * Windows — `docs-windows/` tem quatro sessoes, nenhuma sobre o watcher —,
 * embora seja **em Windows que a aplicacao roda**.
 *
 * A pergunta que ele responde nao e "passou ou falhou", e sim ONDE para:
 *
 *   passo 3  chokidar cru          -> se falha aqui, e a biblioteca ou o SO
 *   passo 4  chokidar + `ignored`  -> se falha so aqui, e o nosso filtro
 *   passo 5  createWatcher real    -> o caminho de producao, ponta a ponta
 *
 * O passo 4 registra **cada caminho que o `ignored` recebe**, porque a suspeita
 * e a comparacao `candidate === directory`: separador e normalizacao diferem
 * entre plataformas, e igualdade de string nao perdoa.
 *
 * Nao toca a planilha, `data/` nem `config/` — escreve so em diretorio
 * temporario (regra inviolavel 7). Rode a partir da pasta do projeto:
 *
 *     node --experimental-strip-types scripts/diagnostico-watcher.mjs
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Generoso de proposito: a medida e o TEMPO ate o evento, nao um veredicto binario. */
const LIMITE_MS = 10_000

/** O mesmo do teste, para que a comparacao com o CI seja direta. */
const DEBOUNCE_MS = 60

let passos = 0

function passo(nome) {
  passos += 1
  console.log(`\n[${passos}] ${nome}`)
}

function ok(mensagem) {
  console.log(`    OK: ${mensagem}`)
}

function falhou(mensagem) {
  console.log(`    FALHOU: ${mensagem}`)
}

function info(mensagem) {
  console.log(`    ${mensagem}`)
}

/**
 * Resolve assim que a condicao vira verdadeira, devolvendo quanto tempo levou.
 * Nunca rejeita: "nao chegou" e um resultado a reportar, nao uma excecao — o
 * script precisa seguir para os passos seguintes mesmo quando um deles falha.
 */
function esperar(condicao, limiteMs = LIMITE_MS) {
  return new Promise((resolve) => {
    const inicio = Date.now()
    const tick = () => {
      if (condicao()) {
        resolve({ chegou: true, ms: Date.now() - inicio })
        return
      }
      if (Date.now() - inicio > limiteMs) {
        resolve({ chegou: false, ms: Date.now() - inicio })
        return
      }
      setTimeout(tick, 10)
    }
    tick()
  })
}

function criarArea(prefixo) {
  const dir = mkdtempSync(join(tmpdir(), prefixo))
  const arquivo = join(dir, 'planilha.xlsx')
  writeFileSync(arquivo, 'v0')
  return { dir, arquivo }
}

const veredictos = []

// ── 1 ────────────────────────────────────────────────────────────────────────
passo('Ambiente')
info(`plataforma: ${process.platform} ${process.arch}`)
info(`node: ${process.version}`)
info(`separador de caminho: ${JSON.stringify(sep)}`)
const { version: versaoChokidar } = await import(
  pathToFileURL(resolve(RAIZ, 'node_modules/chokidar/package.json')).href,
  { with: { type: 'json' } }
).then((m) => m.default)
info(`chokidar: ${versaoChokidar}`)

// ── 2 ────────────────────────────────────────────────────────────────────────
passo('Forma dos caminhos — a causa candidata da falha de tests/repo/distribuicao.test.ts')
const exemplo = relative(RAIZ, resolve(RAIZ, 'web/src', './pages/History.tsx'))
info(`relative() devolve: ${JSON.stringify(exemplo)}`)
info(`o teste compara com: "web/src/pages/History.tsx"`)
const caminhoCasa = exemplo === 'web/src/pages/History.tsx'
if (caminhoCasa) ok('as duas formas coincidem nesta plataforma')
else falhou('as duas formas DIVERGEM — e isto explica os 4 blocos de distribuicao.test.ts')
veredictos.push(['forma de caminho', caminhoCasa ? 'coincide' : 'DIVERGE'])

// ── 3 ────────────────────────────────────────────────────────────────────────
passo('chokidar CRU — sem ignored, sem debounce')
{
  const { dir, arquivo } = criarArea('cronos-diag-cru-')
  let eventos = []
  const observador = watch(dir, { ignoreInitial: true, depth: 0, persistent: true })
  observador.on('all', (evento, caminho) => eventos.push({ evento, caminho }))

  await new Promise((r) => setTimeout(r, 300))
  writeFileSync(arquivo, 'v1')

  const { chegou, ms } = await esperar(() => eventos.length > 0)
  if (chegou) {
    ok(`${eventos.length} evento(s) em ${ms} ms`)
    for (const { evento, caminho } of eventos.slice(0, 4)) info(`  ${evento} -> ${caminho}`)
  } else {
    falhou(`nenhum evento em ${ms} ms — o chokidar nao observa esta pasta neste SO`)
  }
  veredictos.push(['chokidar cru', chegou ? `${ms} ms` : 'SEM EVENTO'])

  await observador.close()
  rmSync(dir, { recursive: true, force: true })
}

// ── 4 ────────────────────────────────────────────────────────────────────────
passo('chokidar com o `ignored` de src/io/watcher.ts — e o que ele recebe')
{
  const { dir, arquivo } = criarArea('cronos-diag-filtro-')
  const diretorio = dirname(arquivo)
  const nomeArquivo = basename(arquivo)

  const vistos = []
  let eventos = 0

  const observador = watch(diretorio, {
    ignoreInitial: true,
    depth: 0,
    persistent: true,
    // Copia literal do filtro de producao, com um registro em volta: o que
    // interessa medir nao e o veredicto do filtro, e sim QUE STRING ele recebe.
    ignored: (candidate, stats) => {
      let decisao
      if (candidate === diretorio) decisao = false
      else if (stats?.isDirectory()) decisao = true
      else decisao = basename(candidate) !== nomeArquivo
      if (vistos.length < 12) vistos.push({ candidate, decisao })
      return decisao
    },
  })
  observador.on('all', () => {
    eventos += 1
  })

  await new Promise((r) => setTimeout(r, 300))
  writeFileSync(arquivo, 'v1')

  const { chegou, ms } = await esperar(() => eventos > 0)

  info(`diretorio observado: ${JSON.stringify(diretorio)}`)
  info('candidatos que o filtro recebeu:')
  if (vistos.length === 0) info('  (nenhum — o filtro nunca foi chamado)')
  for (const { candidate, decisao } of vistos) {
    const marca = candidate === diretorio ? ' == diretorio' : ''
    info(`  ${decisao ? 'IGNORA ' : 'aceita '} ${JSON.stringify(candidate)}${marca}`)
  }

  if (chegou) ok(`evento passou o filtro em ${ms} ms`)
  else falhou(`nenhum evento passou o filtro em ${ms} ms`)
  veredictos.push(['chokidar + ignored', chegou ? `${ms} ms` : 'SEM EVENTO'])

  await observador.close()
  rmSync(dir, { recursive: true, force: true })
}

// ── 5 ────────────────────────────────────────────────────────────────────────
passo('createWatcher real — o caminho de producao, ponta a ponta')
{
  const { createWatcher } = await import(pathToFileURL(resolve(RAIZ, 'src/io/watcher.ts')).href)
  const { dir, arquivo } = criarArea('cronos-diag-prod-')

  let chamadas = 0
  const observador = createWatcher(arquivo, DEBOUNCE_MS)
  observador.onChange(async () => {
    chamadas += 1
  })
  observador.start()

  await new Promise((r) => setTimeout(r, 300))
  writeFileSync(arquivo, 'v1')

  const { chegou, ms } = await esperar(() => chamadas > 0)
  if (chegou) ok(`handler disparou em ${ms} ms (debounce de ${DEBOUNCE_MS} ms incluso)`)
  else falhou(`handler NAO disparou em ${ms} ms — e o sintoma que o operador veria`)
  veredictos.push(['createWatcher', chegou ? `${ms} ms` : 'SEM DISPARO'])

  observador.stop()
  rmSync(dir, { recursive: true, force: true })
}

// ── resumo ───────────────────────────────────────────────────────────────────
console.log('\n=== resumo ===')
for (const [nome, resultado] of veredictos) console.log(`  ${nome.padEnd(22)} ${resultado}`)

const cru = veredictos.find(([n]) => n === 'chokidar cru')?.[1]
const filtrado = veredictos.find(([n]) => n === 'chokidar + ignored')?.[1]

console.log('\n=== leitura ===')
if (cru === 'SEM EVENTO') {
  console.log('  O chokidar nao entrega evento nenhum neste SO. A causa esta abaixo do')
  console.log('  nosso codigo: biblioteca, backend de sistema de arquivos ou o proprio')
  console.log('  ambiente. `usePolling` passa a ser a saida a avaliar (P-08 ja a previa).')
} else if (filtrado === 'SEM EVENTO') {
  console.log('  O chokidar entrega evento, e o NOSSO filtro o descarta. A causa e o')
  console.log('  `ignored` de src/io/watcher.ts — compare acima a string que ele recebe')
  console.log('  com o diretorio observado. Defeito de producao, nao de teste.')
} else {
  console.log('  As tres camadas entregam evento. Se o CI reprovou mesmo assim, o que')
  console.log('  sobra e o limite de tempo do teste, e ai a correcao e o timeout —')
  console.log('  agora com o numero medido acima para sustenta-la.')
}

console.log('\n=== fim ===')
