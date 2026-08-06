import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

/**
 * Espera o ExcelJS terminar de limpar os proprios arquivos temporarios.
 *
 * MITIGACAO TEMPORARIA — sai com H-33, que troca o leitor por fflate.
 *
 * `readWorkbook` resolve ANTES de o ExcelJS terminar: medido, deixa 4
 * temporarios em /tmp e 5 operacoes de FS pendentes. A limpeza acontece
 * sozinha em menos de 200 ms — o problema e a corrida, nao vazamento. Se o
 * worker do Vitest encerra nessa janela, o listener de `exit` do pacote `tmp`
 * apaga os arquivos e as operacoes pendentes falham com `ENOENT`: erro nao
 * tratado, que derruba o exit code sem reprovar teste algum.
 *
 * Em producao o sintoma nao existe — o servidor fica vivo e a limpeza conclui.
 * Por isso a espera vive aqui, no teste, e nao em `src/io/`: pagar por ela em
 * producao seria consertar o lugar errado, e drenar as abas fora de escopo
 * dentro de `readWorkbook` esbarraria na regra inviolavel 10.
 */

/** O pacote `tmp` nomeia como `tmp-<pid>-<aleatorio>`. */
const TEMP_PREFIX = `tmp-${process.pid}-`

const POLL_MS = 10
const DEADLINE_MS = 3000

function pendingTempFiles(): number {
  try {
    return readdirSync(tmpdir()).filter((name) => name.startsWith(TEMP_PREFIX)).length
  } catch {
    return 0
  }
}

/**
 * Devolve assim que nao houver temporario pendente. O limite existe para nunca
 * travar a suite: se estourar, o teste segue e o pior caso e o erro voltar —
 * visivel, nunca silencioso.
 */
export async function awaitExcelJsCleanup(): Promise<void> {
  const deadline = Date.now() + DEADLINE_MS

  while (pendingTempFiles() > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}
