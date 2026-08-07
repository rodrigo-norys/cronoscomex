import { readdirSync } from 'node:fs'
import { basename, dirname, extname } from 'node:path'

/**
 * Sinais de que outra pessoa mexeu no arquivo — nunca acao (A-58).
 *
 * A leitura acontece igual em qualquer caso, e o painel continua servindo o
 * dado. Quem reage e a interface, com a faixa de `H-15`, e a escrita de `H-25`,
 * que recusa gravar com o Excel aberto.
 */
export interface Interference {
  /** Existe `~$<nome>.xlsx` na pasta: alguem tem o arquivo aberto no Excel. */
  externalLock: boolean
  /**
   * Nomes de arquivo, sem caminho, em ordem alfabetica. O caminho ja esta em
   * `workbookPath`, e repeti-lo poluiria a interface.
   */
  conflictFiles: string[]
}

/** Prefixo do arquivo de lock que o Excel cria ao abrir uma planilha. */
const LOCK_PREFIX = '~$'

/**
 * Fragmento que o OneDrive em pt-br usa: "...-Copia em conflito de PC-01...".
 *
 * Ancorado em `onflito` para cobrir "conflito" e "Conflito" sem depender de
 * caixa. **Nao cobre** a forma em ingles, `-Conflicted copy` — limitacao aceita
 * porque o Windows do operador e pt-br (RNF-26).
 */
const CONFLICT_MARKER = 'onflito'

/**
 * Le a pasta da planilha e devolve os dois sinais.
 *
 * Sincrona de proposito: a pasta tem poucos arquivos, roda uma vez por leitura,
 * e a alternativa assincrona so acrescentaria complexidade ao chamador e ao
 * teste. O contrato de `docs/06-backlog.md` fixa esta assinatura.
 *
 * **Nunca lanca.** Pasta inacessivel devolve os sinais em branco: a deteccao e
 * acessoria, e derrubar a leitura por causa dela inverteria a prioridade.
 */
export function detectInterference(workbookPath: string): Interference {
  const directory = dirname(workbookPath)
  const fileName = basename(workbookPath)
  const stem = basename(fileName, extname(fileName))

  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return { externalLock: false, conflictFiles: [] }
  }

  const lockName = `${LOCK_PREFIX}${fileName}`
  const conflictFiles = entries
    .filter((entry) => isConflictOf(entry, stem))
    .sort((a, b) => a.localeCompare(b))

  return { externalLock: entries.includes(lockName), conflictFiles }
}

/**
 * Ancorado no nome configurado: `~$outra.xlsx` ou o conflito de outra planilha
 * na mesma pasta nao dizem nada sobre o arquivo que este painel le.
 */
function isConflictOf(entry: string, stem: string): boolean {
  if (!entry.startsWith(stem) || entry === stem) return false
  if (extname(entry).toLowerCase() !== '.xlsx') return false
  return entry.slice(stem.length).includes(CONFLICT_MARKER)
}
