import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Mede TODOS os numeros que a aplicacao APRESENTA, contra a planilha real.
 *
 * A diferenca em relacao a `carregar-planilha.mjs` e o ponto de medicao: aquela
 * entrega o dominio, e a conferencia chama a funcao pura. Esta exerce as ROTAS,
 * com `server.inject` — sem porta e sem rede —, porque o que o operador ve e o
 * que a rota serve, e nao o que o dominio calcula. Indicador certo no dominio e
 * errado na rota ja aconteceu: `H-09` a `H-13` esqueceram a fiacao da rota cinco
 * vezes seguidas.
 *
 * **NENHUMA STRING SAI DAQUI.** `soNumeros` substitui todo texto por `<texto>` e
 * todo array pela contagem dele. Os rankings trazem nome de cliente, importador
 * e navio — dado pessoal pela regra inviolavel 8, num repositorio publico. A
 * garantia e mecanica, e nao convencao: quem editar este arquivo precisa manter
 * a redacao, ou a medicao passa a vazar.
 *
 * **Escreve em temporario.** `carregarPlanilha()` ja aponta quarentena e
 * historico para um diretorio temporario proprio; aqui o `historyPath` do
 * servidor recebe o mesmo tratamento. Sem isso a medicao gravaria em `data/`,
 * que e estado do operador e alimenta a Pagina Historico.
 *
 * **A saida vai para ARQUIVO, e o terminal recebe so o resumo.** O relatorio
 * inteiro tem dezenas de numeros por rota; despeja-lo na sessao e o que infla o
 * contexto sem acrescentar nada — quem precisa do detalhe abre o arquivo.
 *
 * Uso, a partir da raiz do projeto:
 *
 *     node --experimental-strip-types tools/medir-numeros.mjs
 *     node --experimental-strip-types tools/medir-numeros.mjs <destino.md>
 *
 * O destino padrao e `docs/ensaio-planilha/medicao-referencia.md`.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PADRAO = 'docs/ensaio-planilha/medicao-referencia.md'

/** As rotas que servem numero. `GET` apenas: medir nao altera estado. */
const ROTAS = [
  '/api/health',
  '/api/indicators',
  '/api/alerts',
  '/api/quarantine',
  '/api/processes',
  '/api/history/monthly',
  '/api/clients',
  '/api/team',
  '/api/filters/options',
]

/**
 * Mantem numero, booleano e nulo. Apaga texto. Array vira contagem mais a forma
 * do primeiro item, o que preserva a ESTRUTURA sem revelar conteudo.
 */
function soNumeros(valor) {
  if (typeof valor === 'number' || typeof valor === 'boolean' || valor === null) return valor
  if (typeof valor === 'string') return '<texto>'
  if (Array.isArray(valor)) {
    return { _itens: valor.length, _forma: valor.length ? soNumeros(valor[0]) : null }
  }
  if (valor && typeof valor === 'object') {
    const saida = {}
    for (const [chave, dentro] of Object.entries(valor)) {
      // Chave fora do formato de identificador pode ser nome indexado — redige.
      saida[/^[A-Za-z_][A-Za-z0-9_]*$/.test(chave) ? chave : '<chave>'] = soNumeros(dentro)
    }
    return saida
  }
  return valor
}

export async function medirNumeros(destino = PADRAO) {
  // O logger do Fastify imprime uma linha por requisicao, e nove requisicoes
  // afogam o resumo que esta ferramenta existe para produzir. Silenciar aqui, e
  // nao pedir `LOG_LEVEL=silent` a quem chama, e a diferenca entre mecanismo e
  // instrucao — `medir-navegador.mjs` pede, e a instrucao e esquecida.
  process.env.LOG_LEVEL ??= 'silent'

  const modulo = (caminho) => import(pathToFileURL(resolve(RAIZ, caminho)).href)

  const { carregarPlanilha } = await modulo('tools/carregar-planilha.mjs')
  const { buildServer } = await modulo('src/http/server.ts')

  const comecou = Date.now()
  const { config, estado } = await carregarPlanilha()
  const area = mkdtempSync(join(tmpdir(), 'medicao-numeros-'))
  const server = buildServer(config, undefined, undefined, join(area, 'history.jsonl'))

  const linhas = [
    '# Medicao de referencia — os numeros que a aplicacao apresenta',
    '',
    `**Medido em:** ${new Date().toISOString()}`,
    `**Processos carregados:** ${estado.processes.length}`,
    '',
    '> Gerado por `tools/medir-numeros.mjs`. Toda string foi substituida por',
    '> `<texto>` e todo array pela contagem dele — regra inviolavel 8.',
    '',
    '> **`ALE-06` e a Pagina Historico NAO sao medidos aqui, e o zero deles e',
    '> artefato.** O historico vai para diretorio temporario, entao a serie chega',
    '> vazia: `processos_parados` sai `0` e `stalledMeasurable` sai `false` por',
    '> CONSTRUCAO, nunca por medicao. Quem precisar deles passa um `historyPath`',
    '> real a `carregarPlanilha()` — e aceita que a medicao grava no estado do',
    '> operador. Ler esse zero como fato e o que a regra inviolavel 3 proibe.',
    '',
  ]

  const falhas = []

  for (const url of ROTAS) {
    const resposta = await server.inject({ method: 'GET', url })
    if (resposta.statusCode !== 200) falhas.push(`${url} -> ${resposta.statusCode}`)

    linhas.push(`## \`GET ${url}\` — ${resposta.statusCode}`, '', '```json')
    try {
      linhas.push(JSON.stringify(soNumeros(JSON.parse(resposta.body)), null, 1))
    } catch {
      linhas.push('(corpo nao e JSON)')
    }
    linhas.push('```', '')
  }

  await server.close()

  const segundos = ((Date.now() - comecou) / 1000).toFixed(1)
  linhas.push('---', '', `**Custo desta medicao:** ${segundos}s de execucao.`, '')
  writeFileSync(resolve(RAIZ, destino), linhas.join('\n'))

  return { destino, rotas: ROTAS.length, falhas, segundos, processos: estado.processes.length }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const resultado = await medirNumeros(process.argv[2])
  console.log(`processos: ${resultado.processos}`)
  console.log(`rotas medidas: ${resultado.rotas}`)
  console.log(`rotas fora de 200: ${resultado.falhas.length ? resultado.falhas.join(', ') : 'nenhuma'}`)
  console.log(`tempo: ${resultado.segundos}s`)
  console.log(`relatorio: ${resultado.destino}`)
}
