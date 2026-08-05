import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWatcher, DEFAULT_DEBOUNCE_MS, type Watcher } from '../../src/io/watcher.ts'

/**
 * O watcher depende de eventos reais do sistema de arquivos, entao os testes
 * escrevem em diretorio temporario. O debounce e curto aqui; o valor de
 * producao (2000 ms) e verificado a parte, pela constante.
 */
const DEBOUNCE = 60

let dir: string
let filePath: string
let watcher: Watcher | null = null

function waitFor(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const tick = (): void => {
      if (condition()) {
        resolve()
        return
      }
      if (Date.now() > deadline) {
        reject(new Error('condicao nao atingida a tempo'))
        return
      }
      setTimeout(tick, 10)
    }
    tick()
  })
}

function settle(ms = DEBOUNCE * 4): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-watch-'))
  filePath = join(dir, 'planilha.xlsx')
  writeFileSync(filePath, 'v0')
})

afterEach(() => {
  watcher?.stop()
  watcher = null
  rmSync(dir, { recursive: true, force: true })
})

describe('createWatcher', () => {
  it('fixa o debounce de producao em 2000 ms (RNF-17)', () => {
    expect(DEFAULT_DEBOUNCE_MS).toBe(2000)
  })

  it('dispara o handler quando o arquivo muda', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    writeFileSync(filePath, 'v1')

    await waitFor(() => calls === 1)
  })

  it('agrupa varias alteracoes seguidas em uma unica releitura', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    for (let i = 1; i <= 5; i++) writeFileSync(filePath, `v${i}`)

    await waitFor(() => calls === 1)
    await settle()
    expect(calls).toBe(1)
  })

  // O Excel cria ~$planilha.xlsx ao abrir o arquivo. Nao e alteracao de dado.
  it('ignora o arquivo temporario de lock do Excel', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    writeFileSync(join(dir, '~$planilha.xlsx'), 'lock')

    await settle()
    expect(calls).toBe(0)
  })

  it('ignora outros arquivos da mesma pasta', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    writeFileSync(join(dir, 'outra-planilha.xlsx'), 'x')

    await settle()
    expect(calls).toBe(0)
  })

  it('nao dispara enquanto pausado', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    watcher.pause()
    writeFileSync(filePath, 'v1')

    await settle()
    expect(calls).toBe(0)
  })

  it('recupera a alteracao perdida ao retomar', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    watcher.pause()
    writeFileSync(filePath, 'v1')
    await settle()
    expect(calls).toBe(0)

    watcher.resume()

    await waitFor(() => calls === 1)
  })

  it('nao dispara ao retomar quando nada mudou durante a pausa', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    watcher.pause()
    watcher.resume()

    await settle()
    expect(calls).toBe(0)
  })

  it('para de disparar apos stop', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    watcher.stop()
    writeFileSync(filePath, 'v1')

    await settle()
    expect(calls).toBe(0)
  })

  it('dispara quando o arquivo e removido', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    rmSync(filePath)

    await waitFor(() => calls === 1)
  })

  // O Excel salva gravando um temporario e renomeando por cima: o inode muda.
  // Observar o diretorio e o que mantem o evento visivel.
  it('continua observando apos substituicao atomica do arquivo', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
    })
    watcher.start()
    await settle()

    const temporary = join(dir, 'tmp-save.xlsx')
    writeFileSync(temporary, 'v1')
    rmSync(filePath)
    writeFileSync(filePath, 'v1')

    await waitFor(() => calls === 1)
    rmSync(temporary, { force: true })
  })

  it('sobrevive a um handler que lanca excecao', async () => {
    let calls = 0
    watcher = createWatcher(filePath, DEBOUNCE)
    watcher.onChange(async () => {
      calls++
      throw new Error('falha de leitura')
    })
    watcher.start()
    await settle()

    writeFileSync(filePath, 'v1')
    await waitFor(() => calls === 1)

    writeFileSync(filePath, 'v2')
    await waitFor(() => calls === 2)
  })
})
