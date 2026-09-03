import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Calcula e confere a arvore da branch `distribuicao` — o recorte do
 * repositorio que vai para a maquina do operador.
 *
 * **Ela existe porque o operador nao recebe o repositorio.** `docs/`, `tests/`,
 * `tools/` e `.claude/` nao servem para nada em producao; a arvore minima e o
 * que o `iniciar.cmd` precisa para subir. O tamanho dos dois lados este script
 * mede e imprime — nao ha numero congelado aqui, de proposito: o que estava
 * escrito ("3 de cada 4") nunca bateu, nem no commit que o escreveu.
 *
 * **O que entra NAO e uma lista escrita a mao.** E o fecho transitivo dos
 * imports a partir dos pontos de entrada, mais um conjunto declarado de
 * arquivos que nenhum import alcanca — configuracao lida em execucao, o
 * `package.json`, os scripts do atalho. Lista manual foi o que quase quebrou a
 * distribuicao em `H-48`: `server.ts` passou a importar dois modulos novos, e
 * so nao morreu na partida porque alguem reparou na hora. O fecho repara
 * sozinho.
 *
 * **NAO commita e NAO empurra.** Sem argumento ele so confere. Com `--aplicar`
 * ele TROCA para a branch `distribuicao` — recusando antes se a arvore estiver
 * suja — prepara os arquivos no indice e PARA, deixando voce nela. O commit, o
 * push e o `git switch` de volta continuam sendo decisao de quem esta olhando.
 *
 * Uso:
 *
 *     node --experimental-strip-types scripts/sincronizar-distribuicao.ts
 *     node --experimental-strip-types scripts/sincronizar-distribuicao.ts --aplicar
 *
 * E `.ts`, e nao `.mjs` como os vizinhos de `scripts/`: `tests/repo/` o importa,
 * e modulo sem tipo reprova o `typecheck` do portao. Roda por
 * `--experimental-strip-types`, como a propria aplicacao.
 *
 * **Sincronize apenas a partir da `main` mesclada.** Assim o operador nunca
 * recebe codigo que o CI e a revisao do PR ainda nao aceitaram — decisao de
 * 31/08/2026, tomada depois de `H-48` ter ido para a distribuicao antes do
 * merge.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BRANCH = 'distribuicao'

/** Onde a aplicacao comeca. Tudo que eles alcancam por import vai junto. */
const ENTRYPOINTS = ['src/http/server.ts', 'web/src/main.tsx']

/**
 * O que nenhum import alcanca e a aplicacao mesmo assim precisa.
 *
 * Cada linha e uma afirmacao conferivel, e `tests/repo/distribuicao.test.ts`
 * reprova quando uma delas aponta para arquivo que nao existe mais: caminho
 * morto aqui vira arquivo faltando na maquina do operador, e o sintoma aparece
 * la, nao aqui.
 */
const SUPORTE = [
  // Instalacao e compilacao — o `iniciar.cmd` roda `npm ci` e `npm run build`.
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.nvmrc',
  '.gitignore',

  // O atalho do operador e o que ele chama.
  'scripts/iniciar.cmd',
  'scripts/esperar-porta.mjs',
  'scripts/porta.mjs',

  // O diagnostico do seletor de arquivos, que `PD-06` manda rodar NA MAQUINA DO
  // OPERADOR quando o dialogo de `H-37` nao abre. Ficou de fora ate 31/08/2026,
  // e o efeito foi medido la: a ferramenta que isola o unico defeito conhecido
  // da pendencia nao existia na maquina onde o defeito acontece.
  'scripts/diagnostico-seletor.mjs',

  // A interface: o HTML hospedeiro, a configuracao do Vite e os tipos dele.
  // O CSS nao entra aqui — `main.tsx` o importa, e o fecho o alcanca; os seis
  // `.woff2` tambem nao — o fecho os alcanca pelos `url("/fonts/...")` dele.
  'web/index.html',
  'web/vite.config.ts',
  'web/src/vite-env.d.ts',

  // A licenca das fontes. Nenhum `url()` a cita, e distribuir os `.woff2` sem
  // ela viola a SIL OFL 1.1 — obrigacao da licenca, nao conveniencia.
  'web/public/fonts/LICENSE.txt',

  // Configuracao lida em EXECUCAO, nunca importada. Os `.exemplo` viajam como
  // documentacao do formato, e nao para o operador copiar: ele nao escreve
  // nenhum dos tres arquivos reais que o `.gitignore` cobre. O app.json nasce
  // ao salvar o caminho na tela (`H-35`), o mapa de clientes nasce ao declarar
  // o cliente de uma linha (`saveClientRule`), e o da equipe chega por copia
  // manual (`PD-08`). Os dois ultimos sao o caminho que `loadClientMap` e
  // `loadTeamMap` citam na mensagem de formato invalido.
  'config/color-map.json',
  'config/status-aliases.json',
  'config/app.json.exemplo',
  'config/client-map.json.exemplo',
  'config/team-map.json.exemplo',
]

/**
 * Arquivos que a `distribuicao` tem em versao PROPRIA, e que a sincronizacao
 * nunca sobrescreve.
 *
 * `README.md` la e o guia de instalacao do operador, nao o do desenvolvedor;
 * `iniciar.cmd` na raiz e o lancador curto que chama `scripts\iniciar.cmd`,
 * para o ponto de partida estar na primeira pasta que ele abre. Copiar a versao
 * da `main` por cima destruiria os dois em silencio.
 */
const EXCLUSIVOS = ['README.md', 'iniciar.cmd']

/**
 * Import relativo COM extensao — a forma que o projeto usa sem excecao.
 *
 * As tres formas casam: `from './x.ts'`, `import './x.css'` e, com o parenteses
 * opcional, `import('./x.tsx')`. **A dinamica nao e detalhe:** `App.tsx` carrega
 * a Pagina Historico por `lazy(() => import(...))`, e a primeira versao deste
 * regex exigia espaco depois de `import`. Ela nao casava a chamada, o script
 * declarava `History.tsx` e `useHistory.ts` como sobrando, e `--aplicar` os
 * teria REMOVIDO da distribuicao — a pagina quebraria so na maquina do
 * operador. Medido em 31/08/2026, na primeira execucao.
 */
const IMPORT_RELATIVO = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.[^'"]+)['"]/g

function importsDe(arquivo: string): string[] {
  const conteudo = readFileSync(join(RAIZ, arquivo), 'utf-8')
  const base = dirname(arquivo)
  const alvos: string[] = []

  for (const [, especificador] of conteudo.matchAll(IMPORT_RELATIVO)) {
    // O grupo 1 e obrigatorio no padrao, mas `noUncheckedIndexedAccess` nao
    // sabe disso: sem a guarda, um especificador vazio viraria a propria RAIZ,
    // e a arvore ganharia uma entrada que nao e arquivo nenhum.
    if (especificador === undefined) continue
    alvos.push(relative(RAIZ, resolve(RAIZ, base, especificador)))
  }
  return alvos
}

/**
 * Asset citado por caminho ABSOLUTO numa folha de estilo — `url("/fonts/x")`.
 *
 * **Tratar `.css` como folha foi o defeito medido em 03/09/2026:** os seis
 * `.woff2` de `web/public/fonts/` nunca entraram na `distribuicao`, e a
 * ausencia deles nao produz erro nenhum — o navegador cai na fonte de fallback
 * —, entao o script imprimia "sincronizada com HEAD" com a tipografia de `H-58`
 * faltando na maquina do operador desde que ela existe.
 *
 * Casa so o caminho absoluto, que o Vite resolve contra `web/public/`. `data:`,
 * `http:` e caminho relativo ficam fora de proposito: o primeiro nao e arquivo,
 * e os outros dois o repositorio nao usa — `tests/repo/estilo.test.ts` reprova
 * origem externa em `index.css`.
 */
const URL_ABSOLUTA_CSS = /url\(\s*["']?(\/[^"')]+)["']?\s*\)/g

/** Raiz publica do Vite: `web/` e o root, e o `public/` dele e servido em `/`. */
const PUBLICO = 'web/public'

function assetsDe(arquivo: string): string[] {
  const conteudo = readFileSync(join(RAIZ, arquivo), 'utf-8')
  const alvos: string[] = []

  for (const [, caminho] of conteudo.matchAll(URL_ABSOLUTA_CSS)) {
    if (caminho === undefined) continue
    alvos.push(join(PUBLICO, caminho))
  }
  return alvos
}

/**
 * Fecho transitivo dos imports. Devolve tambem o que nao resolveu, em vez de
 * ignorar: import quebrado e defeito, e some-lo aqui o esconderia ate a
 * partida na maquina do operador.
 */
function alcancaveis(entrypoints: readonly string[]): {
  vistos: Set<string>
  quebrados: string[]
} {
  const vistos = new Set<string>()
  const quebrados: string[] = []
  const fila = [...entrypoints]

  while (fila.length > 0) {
    const arquivo = fila.pop()
    if (arquivo === undefined || vistos.has(arquivo)) continue

    if (!existsSync(join(RAIZ, arquivo))) {
      quebrados.push(arquivo)
      continue
    }
    vistos.add(arquivo)

    // Arquivo de codigo carrega import; `.css` carrega asset por `url()`. Folha
    // de verdade, aqui, e so o `.json`.
    if (/\.(ts|tsx|mjs|js)$/.test(arquivo)) fila.push(...importsDe(arquivo))
    else if (arquivo.endsWith('.css')) fila.push(...assetsDe(arquivo))
  }

  return { vistos, quebrados }
}

/** O conjunto completo que a `distribuicao` deve conter, ja ordenado. */
export function arvoreEsperada(): {
  esperada: string[]
  quebrados: string[]
  alcancados: number
} {
  const { vistos, quebrados } = alcancaveis(ENTRYPOINTS)
  const esperada = new Set([...vistos, ...SUPORTE, ...EXCLUSIVOS])

  return { esperada: [...esperada].sort(), quebrados, alcancados: vistos.size }
}

export { ENTRYPOINTS, EXCLUSIVOS, SUPORTE }

function arvoreAtual(): string[] {
  const saida = execFileSync('git', ['ls-tree', '-r', '--name-only', BRANCH], {
    cwd: RAIZ,
    encoding: 'utf-8',
  })
  return saida.split('\n').filter((linha) => linha !== '')
}

function main(): void {
  const aplicar = process.argv.includes('--aplicar')
  const { esperada, quebrados, alcancados } = arvoreEsperada()

  if (quebrados.length > 0) {
    process.stderr.write(
      `\nImports que nao resolvem — corrija antes de sincronizar:\n${quebrados
        .map((arquivo) => `  ${arquivo}`)
        .join('\n')}\n\n`,
    )
    process.exit(1)
  }

  let atual: string[]
  try {
    atual = arvoreAtual()
  } catch {
    process.stderr.write(
      `\nA branch "${BRANCH}" nao existe localmente.\n` +
        `Traga-a com: git fetch origin ${BRANCH}:${BRANCH}\n\n`,
    )
    process.exit(1)
  }

  const naSuporte = new Set(atual)
  const faltando = esperada.filter((arquivo) => !naSuporte.has(arquivo))
  const sobrando = atual.filter((arquivo) => !esperada.includes(arquivo))

  // Desatualizado: esta nas duas arvores, e o conteudo difere. `EXCLUSIVOS`
  // ficam de fora — divergir e o proposito deles.
  const desatualizados = esperada.filter((arquivo) => {
    if (EXCLUSIVOS.includes(arquivo) || !naSuporte.has(arquivo)) return false
    try {
      execFileSync('git', ['diff', '--quiet', BRANCH, 'HEAD', '--', arquivo], { cwd: RAIZ })
      return false
    } catch {
      return true
    }
  })

  process.stdout.write(
    `\nArvore de distribuicao — ${esperada.length} arquivos\n` +
      `  ${alcancados} alcancados por import a partir de ${ENTRYPOINTS.join(' e ')}\n` +
      `  ${SUPORTE.length} de suporte declarado · ${EXCLUSIVOS.length} exclusivos da branch\n\n`,
  )

  const relatar = (titulo: string, lista: readonly string[]): void => {
    if (lista.length === 0) return
    process.stdout.write(`${titulo} (${lista.length}):\n${lista.map((a) => `  ${a}`).join('\n')}\n\n`)
  }

  relatar('FALTANDO na distribuicao', faltando)
  relatar('DESATUALIZADOS', desatualizados)
  relatar('SOBRANDO na distribuicao', sobrando)

  const divergencias = faltando.length + desatualizados.length + sobrando.length
  if (divergencias === 0) {
    process.stdout.write('A distribuicao esta sincronizada com HEAD.\n\n')
    return
  }

  if (!aplicar) {
    process.stdout.write(
      `${divergencias} divergencia(s). Para preparar a sincronizacao:\n` +
        '  node --experimental-strip-types scripts/sincronizar-distribuicao.ts --aplicar\n\n',
    )
    process.exit(1)
  }

  aplicarSincronizacao([...faltando, ...desatualizados], sobrando)
}

/**
 * Prepara os arquivos no indice da `distribuicao` e PARA.
 *
 * Nao commita: a mensagem descreve o que mudou, e isso e leitura de quem esta
 * olhando o diff — nao de uma lista de caminhos.
 */
function aplicarSincronizacao(copiar: readonly string[], remover: readonly string[]): void {
  const origem = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf-8' }).trim()
  const sujo = execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf-8' })

  if (sujo.trim() !== '') {
    process.stderr.write('\nArvore suja. Commite ou guarde antes de sincronizar.\n\n')
    process.exit(1)
  }

  execFileSync('git', ['switch', BRANCH], { cwd: RAIZ, stdio: 'inherit' })
  if (copiar.length > 0) {
    execFileSync('git', ['checkout', origem, '--', ...copiar], { cwd: RAIZ, stdio: 'inherit' })
  }
  if (remover.length > 0) {
    execFileSync('git', ['rm', '-q', '--', ...remover], { cwd: RAIZ, stdio: 'inherit' })
  }

  process.stdout.write(
    `\nPreparado na branch "${BRANCH}", a partir de ${origem.slice(0, 7)}.\n` +
      `  ${copiar.length} copiado(s) · ${remover.length} removido(s)\n\n` +
      'Voce esta agora na branch "distribuicao". Confira com `git status` e\n' +
      'commite. O push e o `git switch main` de volta continuam sendo seus.\n\n',
  )
}

// `pathToFileURL`, nunca `file://` concatenado: em `C:\...` a comparacao daria
// falso e o script sairia com codigo zero sem fazer nada. E o defeito que
// manteve a aplicacao inteira sem subir em Windows desde `H-30` (PD-06).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
