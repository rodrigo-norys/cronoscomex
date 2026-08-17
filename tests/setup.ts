import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'

/**
 * Caixa de areia do historico, um diretorio por arquivo de teste.
 *
 * `data/history.jsonl` e o unico artefato que a aplicacao **escreve** sem
 * comando explicito do operador — o `process-store` o alimenta a cada leitura
 * (`H-28`). Sem isto, todo teste que monta o servidor ou releia a planilha
 * gravaria no arquivo real e passaria a depender do que ficou de execucoes
 * anteriores: foi exatamente o que aconteceu na primeira execucao da suite
 * de `H-28`, com `tests/http/processes.test.ts` reprovando por historico que
 * ele proprio havia acabado de criar.
 *
 * Quem precisa controlar o conteudo do arquivo injeta `path` e ignora isto.
 * `history-store` RECUSA o caminho padrao sob `NODE_ENV=test`, entao esquecer
 * as duas coisas falha alto em vez de tocar `data/`.
 */
const sandbox = mkdtempSync(join(tmpdir(), 'cronos-history-'))

process.env.CRONOS_TEST_HISTORY_PATH = join(sandbox, 'history.jsonl')

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true })
})
