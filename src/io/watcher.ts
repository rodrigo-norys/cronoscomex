import { basename, dirname } from 'node:path'
import { type ChokidarOptions, type FSWatcher, watch } from 'chokidar'

/**
 * Observador do arquivo da planilha.
 *
 * Observa o DIRETORIO, nao o arquivo. O Excel salva por substituicao atomica —
 * grava um temporario e renomeia — o que troca o inode; um observador preso ao
 * arquivo original perderia todos os eventos seguintes ao primeiro salvamento.
 *
 * O debounce nao e otimizacao: um unico salvamento produz varios eventos de
 * sistema de arquivos, e reler a planilha a cada um deles significaria ler o
 * arquivo pela metade.
 */

/** RNF-17. Somado ao parse, atende o RNF-14 (<= 5 s). */
export const DEFAULT_DEBOUNCE_MS = 2000

export interface Watcher {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  onChange(handler: () => Promise<void>): void
}

export function createWatcher(filePath: string, debounceMs: number = DEFAULT_DEBOUNCE_MS): Watcher {
  const directory = dirname(filePath)
  const fileName = basename(filePath)

  let fsWatcher: FSWatcher | null = null
  let timer: NodeJS.Timeout | null = null
  let handler: (() => Promise<void>) | null = null
  let paused = false
  let missedWhilePaused = false

  /**
   * Deixa passar somente o arquivo alvo. Cobre o temporario `~$planilha.xlsx`
   * que o Excel cria na mesma pasta ao abrir o arquivo: nome diferente, logo
   * ignorado, e nenhuma releitura e disparada por ele.
   */
  const options: ChokidarOptions = {
    ignoreInitial: true,
    depth: 0,
    persistent: true,
    ignored: (candidate, stats) => {
      if (candidate === directory) return false
      if (stats?.isDirectory()) return true
      return basename(candidate) !== fileName
    },
  }

  function schedule(): void {
    if (paused) {
      missedWhilePaused = true
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void fire()
    }, debounceMs)
  }

  async function fire(): Promise<void> {
    if (!handler) return
    try {
      await handler()
    } catch {
      // O handler registra a propria falha e o store passa a 'degradado'.
      // Uma excecao aqui nao pode derrubar o observador: sem ele, o painel
      // congelaria em silencio ate o operador reiniciar a aplicacao.
    }
  }

  return {
    start(): void {
      if (fsWatcher) return
      fsWatcher = watch(directory, options)
      fsWatcher.on('add', schedule)
      fsWatcher.on('change', schedule)
      fsWatcher.on('unlink', schedule)
    },

    stop(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (fsWatcher) {
        void fsWatcher.close()
        fsWatcher = null
      }
      paused = false
      missedWhilePaused = false
    },

    pause(): void {
      paused = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },

    /**
     * Retoma e, se houve alteracao durante a pausa, reagenda a releitura.
     * Descartar o evento perdido deixaria o painel desatualizado ate a proxima
     * alteracao — que pode nao vir. E o que fecha a sequencia de aplicacao de
     * edicoes de 04-arquitetura.md secao 3.2: o write-guard retoma o watcher e
     * a releitura acontece em seguida.
     */
    resume(): void {
      paused = false
      if (missedWhilePaused) {
        missedWhilePaused = false
        schedule()
      }
    },

    onChange(next: () => Promise<void>): void {
      handler = next
    },
  }
}
