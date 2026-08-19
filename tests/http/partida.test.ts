import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A guarda do disparo de `main()` em `src/http/server.ts`.
 *
 * Existe por um defeito que sobreviveu de `H-30` a 19/08/2026 e so aparece em
 * Windows — o unico ambiente que nenhum teste alcanca, e o unico onde a
 * aplicacao roda de verdade. A condicao era
 * `import.meta.url === \`file://${process.argv[1]}\``, que funciona em Linux por
 * acidente: o caminho ja comeca com barra, entao a concatenacao produz as tres
 * barras da URL. Em Windows `process.argv[1]` e `C:\\...\\server.ts`, e a
 * concatenacao nunca casa com `file:///C:/...`.
 *
 * **O modo de falha e mudo**, e e isso que justifica uma guarda: `main()` nao
 * roda, o processo carrega os modulos e sai com codigo ZERO. Nenhum erro em
 * lugar nenhum — `scripts/iniciar.cmd` lia o zero como termino normal e fechava
 * a janela, e o navegador abria em ERR_CONNECTION_REFUSED. Custou uma sessao
 * inteira de teste na maquina do operador (PD-06).
 *
 * A assercao e sobre o CODIGO porque o comportamento nao e testavel daqui: subir
 * o servidor de verdade tocaria `config/app.json` e `data/` reais (regra
 * inviolavel 7), e nenhum runner deste projeto executa em Windows.
 */
const SERVER = readFileSync('src/http/server.ts', 'utf-8')

describe('o disparo de main() sobrevive ao Windows', () => {
  it('resolve o caminho do processo com pathToFileURL', () => {
    expect(SERVER).toMatch(/import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  })

  /**
   * O contraexemplo, e nao so a forma certa: sem isto, alguem reintroduz a
   * concatenacao em outra linha e a assercao acima segue verde.
   */
  it('nao concatena file:// com um caminho de sistema', () => {
    expect(SERVER).not.toMatch(/`file:\/\/\$\{/)
  })

  /**
   * Ancora contra guarda verde por vacuidade: prova que o idioma exigido acima
   * de fato identifica o modulo em execucao no ambiente que roda esta suite.
   */
  it('o idioma exigido identifica o proprio modulo', () => {
    expect(pathToFileURL(import.meta.filename).href).toBe(import.meta.url)
  })
})
