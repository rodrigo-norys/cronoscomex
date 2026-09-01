import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Medicao da interface num Chrome de verdade, por CDP.
 *
 * Existe porque **o mesmo harness foi reconstruido do zero em duas sessoes** —
 * 31/08/2026 declarou os procedimentos de navegador inalcancaveis e estava
 * errada; 01/09/2026 os executou e mediu seis historias, e o harness morreu com
 * o scratchpad dela. Foi a Pendencia 2 do relatorio daquele dia. `E11` inteiro
 * depende deste arquivo, e `H-65` o exige por definicao.
 *
 * **Sem dependencia nova** (`D-16` vale para o runtime, e a regra do plano vale
 * para tudo): `WebSocket` e global no Node 22, e o Chrome ja esta na maquina.
 *
 * **Nada aqui toca estado real** — nem a planilha do operador, nem `data/`, nem
 * `config/app.json`. `abrirAplicacao` sobe o servidor sobre uma fixture de
 * `tests/fixtures/` e redireciona os tres caminhos de escrita para um diretorio
 * temporario. Em 01/09/2026 um harness de medicao gravou na fila do operador
 * **duas vezes**; as duas defesas — fixture e caminhos injetados — sao a
 * resposta, e nenhuma delas sozinha basta.
 *
 * Uso, a partir de um script no scratchpad:
 *
 *     const { abrirAplicacao, comNavegador } = await import(
 *       '/caminho/para/tools/medir-navegador.mjs'
 *     )
 *     const app = await abrirAplicacao()
 *     const medida = await comNavegador(
 *       { url: `${app.baseUrl}/performance`, viewport: { width: 1280, height: 900 } },
 *       async (pagina) => pagina.avaliar('document.title'),
 *     )
 *     await app.fechar()
 *
 * Rode com `node --experimental-strip-types`, a partir da raiz do projeto, e
 * prefixe `LOG_LEVEL=silent` — o log do Fastify se mistura a medicao no stdout.
 * Exige `npm run build` feito antes: a interface servida e `dist/web`.
 *
 * **`NODE_ENV=test` nao serve para calar o log aqui**, ainda que tambem o cale:
 * ele liga as recusas de caminho padrao de `history-store` e `saveWorkbookPath`,
 * que existem para a suite e mudariam o que a medicao observa.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = '/usr/bin/google-chrome'

const modulo = (caminho) => import(pathToFileURL(resolve(RAIZ, caminho)).href)

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))

/**
 * Sobe a aplicacao inteira — API mais interface compilada — sobre uma FIXTURE.
 *
 * A alternativa seria `npm run dev`, e ela e proibida aqui: `main()` resolve os
 * caminhos padrao e grava em `data/` (regra inviolavel 7).
 *
 * @param {{fixture?: string, porta?: number}} opcoes
 */
export async function abrirAplicacao({ fixture = 'cores.xlsx', porta = 5199 } = {}) {
  const { loadColorMap } = await modulo('src/app/color-map-loader.ts')
  const { loadStatusAliases } = await modulo('src/app/status-aliases-loader.ts')
  const { initStore, reload, store } = await modulo('src/app/process-store.ts')
  const { buildServer, LOOPBACK } = await modulo('src/http/server.ts')

  const area = mkdtempSync(join(tmpdir(), 'cronos-medicao-'))
  const webRoot = resolve(RAIZ, 'dist/web')
  if (!existsSync(webRoot)) {
    throw new Error(`${webRoot} nao existe. Rode "npm run build" antes de medir.`)
  }

  const config = {
    workbookPath: resolve(RAIZ, 'tests/fixtures', fixture),
    sheetName: '2026',
    port: porta,
    timezone: 'America/Sao_Paulo',
    topN: 10,
  }
  const colorMap = loadColorMap()

  initStore({
    config,
    colorMap,
    statusAliases: loadStatusAliases(),
    quarantinePath: join(area, 'quarantine.json'),
    historyPath: join(area, 'history.jsonl'),
    queuePath: join(area, 'pending-edits.jsonl'),
  })
  await reload()

  const app = buildServer(
    config,
    store,
    colorMap,
    join(area, 'history.jsonl'),
    undefined,
    undefined,
    undefined,
    webRoot,
    [],
    join(area, 'pending-edits.jsonl'),
  )
  await app.listen({ host: LOOPBACK, port: porta })

  return {
    baseUrl: `http://${LOOPBACK}:${porta}`,
    area,
    async fechar() {
      await app.close()
      rmSync(area, { recursive: true, force: true })
    },
  }
}

/** Uma conexao CDP com um alvo, com `enviar` e `aoEvento`. */
async function conectar(wsUrl) {
  const socket = new WebSocket(wsUrl)
  await new Promise((ok, falha) => {
    socket.addEventListener('open', ok, { once: true })
    socket.addEventListener('error', () => falha(new Error(`nao conectou em ${wsUrl}`)), {
      once: true,
    })
  })

  let proximoId = 0
  const pendentes = new Map()
  const ouvintes = new Map()

  socket.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data)
    if (mensagem.id !== undefined) {
      const pendente = pendentes.get(mensagem.id)
      pendentes.delete(mensagem.id)
      if (!pendente) return
      if (mensagem.error) pendente.falha(new Error(JSON.stringify(mensagem.error)))
      else pendente.ok(mensagem.result)
      return
    }
    for (const ouvinte of ouvintes.get(mensagem.method) ?? []) ouvinte(mensagem.params)
  })

  return {
    enviar(metodo, params = {}) {
      const id = proximoId++
      socket.send(JSON.stringify({ id, method: metodo, params }))
      return new Promise((ok, falha) => pendentes.set(id, { ok, falha }))
    },
    aoEvento(metodo, ouvinte) {
      if (!ouvintes.has(metodo)) ouvintes.set(metodo, [])
      ouvintes.get(metodo).push(ouvinte)
    },
    fechar() {
      socket.close()
    },
  }
}

async function alvoDaPagina(portaCdp) {
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${portaCdp}/json/list`)).json()
      const pagina = alvos.find((alvo) => alvo.type === 'page')
      if (pagina) return pagina
    } catch {
      // O Chrome ainda nao abriu a porta. Tentar de novo.
    }
    await esperar(100)
  }
  throw new Error('o Chrome nao expos nenhum alvo de pagina em 6s')
}

/**
 * Abre `url` num Chrome headless e entrega a pagina ao callback.
 *
 * `viewport` e obrigatorio em toda medicao de largura: sem
 * `setDeviceMetricsOverride` a largura e a do headless padrao, que nao e a
 * nenhuma tela real — e `scrollWidth` medido assim nao responde nada.
 *
 * @param {{url: string, viewport?: {width: number, height: number},
 *          esquema?: 'light'|'dark', coresForcadas?: boolean,
 *          fonteBase?: number, deviceScaleFactor?: number}} opcoes
 * @param {(pagina: object) => Promise<unknown>} fn
 */
export async function comNavegador(opcoes, fn) {
  const {
    url,
    viewport,
    esquema,
    coresForcadas = false,
    fonteBase,
    deviceScaleFactor = 1,
  } = opcoes

  const perfil = mkdtempSync(join(tmpdir(), 'cronos-chrome-'))
  const portaCdp = 9222 + Math.floor(Math.random() * 400)
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${portaCdp}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ])
  chrome.stderr.resume()

  let conexao
  try {
    const alvo = await alvoDaPagina(portaCdp)
    conexao = await conectar(alvo.webSocketDebuggerUrl)

    await conexao.enviar('Page.enable')
    await conexao.enviar('Runtime.enable')
    await conexao.enviar('DOM.enable')

    if (viewport) {
      await conexao.enviar('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor,
        mobile: false,
      })
    }

    // As duas emulacoes que tornam `H-65` e `VN-5` alcancaveis sem outra
    // maquina: o UA substitui a paleta do autor do mesmo jeito que no Windows,
    // e o que o procedimento pergunta e se o desenho sobrevive a isso.
    const features = []
    if (esquema) features.push({ name: 'prefers-color-scheme', value: esquema })
    if (coresForcadas) features.push({ name: 'forced-colors', value: 'active' })
    if (features.length > 0) {
      await conexao.enviar('Emulation.setEmulatedMedia', { features })
    }

    // O cenario "Muito grande" do Chrome e `Page.setFontSizes`, e nao um zoom:
    // ele muda a fonte-base que o `rem` resolve, que e o que `SC 1.4.4` cobra.
    if (fonteBase !== undefined) {
      await conexao.enviar('Page.setFontSizes', {
        fontSizes: { standard: fonteBase, fixed: fonteBase },
      })
    }

    const carregou = new Promise((ok) => conexao.aoEvento('Page.loadEventFired', ok))
    await conexao.enviar('Page.navigate', { url })
    await carregou

    const pagina = {
      /** Avalia a expressao na pagina e devolve o valor por JSON. */
      async avaliar(expressao) {
        const { result, exceptionDetails } = await conexao.enviar('Runtime.evaluate', {
          expression: `(() => { return (${expressao}) })()`,
          awaitPromise: true,
          returnByValue: true,
        })
        if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails))
        return result.value
      },
      /** Espera um seletor aparecer. A SPA monta depois do `load`. */
      async esperarSeletor(seletor, tentativas = 100) {
        for (let i = 0; i < tentativas; i++) {
          if (await pagina.avaliar(`document.querySelector(${JSON.stringify(seletor)}) !== null`)) {
            return true
          }
          await esperar(50)
        }
        throw new Error(`seletor ${seletor} nao apareceu`)
      },
      /** Uma tecla, para percorrer as paradas de tabulacao. */
      async teclar(key, { shift = false } = {}) {
        const comuns = { key, modifiers: shift ? 8 : 0, windowsVirtualKeyCode: key === 'Tab' ? 9 : 0 }
        await conexao.enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...comuns })
        await conexao.enviar('Input.dispatchKeyEvent', { type: 'keyUp', ...comuns })
        await esperar(20)
      },
      cdp: conexao,
    }

    return await fn(pagina)
  } finally {
    conexao?.fechar()
    chrome.kill('SIGKILL')
    // O Chrome ainda escreve no cache quando o sinal chega, e `maxRetries` **nao
    // basta**: medido em 01/09/2026, `ENOTEMPTY` voltou DEPOIS de uma medicao
    // que ja tinha dado certo, e o erro aparecia como defeito do que se media.
    //
    // **Limpar o perfil temporario nao vale derrubar a medicao.** O diretorio
    // fica em `/tmp`, que o sistema recolhe; perder a medicao custa a sessao.
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // Perfil orfao em /tmp e consequencia aceita, e declarada.
    }
  }
}

/**
 * A expressao que resolve uma cor computada para sRGB **pelo proprio
 * navegador**, com o alfa composto sobre o fundo efetivo.
 *
 * Existe porque o projeto usa `oklch()` e a conversao a mao erra: quem decide o
 * valor final e o compositor, nao a formula. O canvas de 1 px devolve o que a
 * tela mostraria — e e por isso que o alfa precisa ser pintado sobre o fundo,
 * em vez de multiplicado.
 *
 * @param {string} seletor elemento cuja cor sera lida
 * @param {'color'|'backgroundColor'|'borderColor'} propriedade
 */
export function corComoRgb(seletor, propriedade = 'color') {
  return `(() => {
    const alvo = document.querySelector(${JSON.stringify(seletor)})
    if (!alvo) return null
    const valor = getComputedStyle(alvo).${propriedade}
    const fundo = (() => {
      let no = alvo
      while (no) {
        const cor = getComputedStyle(no).backgroundColor
        if (cor && cor !== 'rgba(0, 0, 0, 0)' && cor !== 'transparent') return cor
        no = no.parentElement
      }
      return 'rgb(255, 255, 255)'
    })()
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = fundo
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillStyle = valor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return { valor, fundo, rgb: [r, g, b] }
  })()`
}

/** Luminancia relativa da WCAG, sobre sRGB de 0 a 255. */
export function luminancia([r, g, b]) {
  const canal = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Razao de contraste da WCAG, com 2 casas. Ordem dos argumentos e irrelevante. */
export function razaoContraste(rgbA, rgbB) {
  const a = luminancia(rgbA)
  const b = luminancia(rgbB)
  const [claro, escuro] = a > b ? [a, b] : [b, a]
  return Number(((claro + 0.05) / (escuro + 0.05)).toFixed(2))
}

/** A expressao que devolve as paradas de tabulacao visiveis, em ordem de DOM. */
export const PARADAS_DE_TABULACAO = `[
  ...document.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ),
]
  .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
  .map((el) => ({
    tag: el.tagName.toLowerCase(),
    nome: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
  }))`

/** A expressao que devolve o elemento com foco, identificavel sem depender de id. */
export const ELEMENTO_FOCADO = `(() => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  return {
    tag: el.tagName.toLowerCase(),
    nome: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
  }
})()`
