import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectInterference } from '../../src/io/interference-detector.ts'

/**
 * Nome ficticio, com espaco e caixa alta como o arquivo real, para exercitar o
 * casamento de padrao sem depender da planilha de producao (RNF-38).
 */
const WORKBOOK = 'CONTROLE DOS EMBARQUE.xlsx'

let directory: string
let workbookPath: string

function touch(name: string): void {
  writeFileSync(join(directory, name), '')
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-interference-'))
  workbookPath = join(directory, WORKBOOK)
  touch(WORKBOOK)
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('detectInterference — arquivo de lock do Excel', () => {
  it('acusa externalLock quando existe ~$<nome>.xlsx', () => {
    touch(`~$${WORKBOOK}`)

    expect(detectInterference(workbookPath).externalLock).toBe(true)
  })

  it('devolve false quando o lock nao existe', () => {
    expect(detectInterference(workbookPath).externalLock).toBe(false)
  })

  // O sinal nunca fica preso: e derivado do estado da pasta, nao acumulado.
  it('volta a false quando o lock some', () => {
    touch(`~$${WORKBOOK}`)
    expect(detectInterference(workbookPath).externalLock).toBe(true)

    rmSync(join(directory, `~$${WORKBOOK}`))

    expect(detectInterference(workbookPath).externalLock).toBe(false)
  })

  // O padrao e ancorado no nome configurado.
  it('ignora o lock de outra planilha na mesma pasta', () => {
    touch('~$outra.xlsx')

    expect(detectInterference(workbookPath).externalLock).toBe(false)
  })
})

describe('detectInterference — arquivo de conflito do OneDrive', () => {
  const CONFLITO = 'CONTROLE DOS EMBARQUE-Cópia em conflito de PC-01 2026-08-04.xlsx'

  it('lista o arquivo de conflito', () => {
    touch(CONFLITO)

    expect(detectInterference(workbookPath).conflictFiles).toEqual([CONFLITO])
  })

  it('lista dois conflitos em ordem alfabetica', () => {
    const segundo = 'CONTROLE DOS EMBARQUE-Cópia em conflito de PC-02 2026-08-05.xlsx'
    touch(segundo)
    touch(CONFLITO)

    expect(detectInterference(workbookPath).conflictFiles).toEqual([CONFLITO, segundo])
  })

  it('devolve o nome do arquivo, nunca o caminho completo', () => {
    touch(CONFLITO)

    const [primeiro] = detectInterference(workbookPath).conflictFiles

    expect(primeiro).not.toContain(directory)
    expect(primeiro).toBe(CONFLITO)
  })

  it('devolve lista vazia quando nao ha conflito', () => {
    expect(detectInterference(workbookPath).conflictFiles).toEqual([])
  })

  it('nao confunde a propria planilha com um conflito', () => {
    expect(detectInterference(workbookPath).conflictFiles).not.toContain(WORKBOOK)
  })

  it('ignora conflito de outra planilha na mesma pasta', () => {
    touch('outra-Cópia em conflito de PC-01 2026-08-04.xlsx')

    expect(detectInterference(workbookPath).conflictFiles).toEqual([])
  })

  it('ignora arquivo que casa o nome mas nao e xlsx', () => {
    touch('CONTROLE DOS EMBARQUE-Cópia em conflito de PC-01.txt')

    expect(detectInterference(workbookPath).conflictFiles).toEqual([])
  })

  it('reconhece conflito com C maiusculo', () => {
    const maiusculo = 'CONTROLE DOS EMBARQUE-Cópia em Conflito de PC-01.xlsx'
    touch(maiusculo)

    expect(detectInterference(workbookPath).conflictFiles).toEqual([maiusculo])
  })

  /**
   * Limitacao declarada: o padrao e ancorado em "onflito", e a forma em ingles
   * NAO e coberta. O Windows do operador e pt-br (RNF-26). Este teste fixa a
   * limitacao para que ela seja uma escolha visivel, nao uma surpresa.
   */
  it('NAO reconhece a forma em ingles, por decisao', () => {
    touch('CONTROLE DOS EMBARQUE-Conflicted copy 2026-08-04.xlsx')

    expect(detectInterference(workbookPath).conflictFiles).toEqual([])
  })
})

describe('detectInterference — a deteccao nunca derruba a leitura', () => {
  it('devolve os sinais em branco quando a pasta nao existe', () => {
    const inexistente = join(directory, 'sem-pasta', WORKBOOK)

    expect(detectInterference(inexistente)).toEqual({
      externalLock: false,
      conflictFiles: [],
    })
  })

  it('nao lanca com caminho vazio', () => {
    expect(() => detectInterference('')).not.toThrow()
  })
})

describe('detectInterference — os dois sinais sao independentes', () => {
  it('acusa lock e conflito ao mesmo tempo', () => {
    const conflito = 'CONTROLE DOS EMBARQUE-Cópia em conflito de PC-01.xlsx'
    touch(`~$${WORKBOOK}`)
    touch(conflito)

    expect(detectInterference(workbookPath)).toEqual({
      externalLock: true,
      conflictFiles: [conflito],
    })
  })
})
