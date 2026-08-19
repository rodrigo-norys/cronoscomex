import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ConfigWriteError,
  checkWorkbookPath,
  saveWorkbookPath,
  WORKBOOK_UNSET,
} from '../../src/app/config.ts'

/**
 * H-34. Nenhum destes testes toca `config/app.json` real — todo caminho e
 * diretorio temporario (regra inviolavel 7).
 */

let dir: string
let workbook: string

/** `chmod` nao restringe o superusuario: sob root a assercao seria vacua. */
const semPrivilegio = process.getuid?.() !== 0

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-cfg-'))
  workbook = join(dir, 'planilha.xlsx')
  writeFileSync(workbook, 'conteudo irrelevante')
})

afterEach(() => {
  chmodSync(dir, 0o700)
  rmSync(dir, { recursive: true, force: true })
})

describe('checkWorkbookPath', () => {
  it('aceita um .xlsx existente e legivel', () => {
    expect(checkWorkbookPath(workbook)).toEqual({
      resolved: workbook,
      exists: true,
      readable: true,
      reason: null,
    })
  })

  it('aceita caminho com espacos e acentos', () => {
    const pasta = join(dir, 'Relatórios de Março')
    mkdirSync(pasta)
    const comAcento = join(pasta, 'planilha do ano.xlsx')
    writeFileSync(comAcento, 'x')

    expect(checkWorkbookPath(comAcento).reason).toBeNull()
  })

  /**
   * "Copiar como caminho" do Explorer do Windows — a unica forma de copiar um
   * caminho sem digita-lo — envolve o texto em aspas duplas. Sem isto o
   * candidato colado tem extensao `.xlsx"`, e a recusa manda o operador
   * procurar um arquivo `.xlsx` que ele ja escolheu. Medido na primeira
   * instalacao em Windows (H-35, PD-06).
   */
  it('aceita o caminho colado do Explorer, entre aspas duplas', () => {
    expect(checkWorkbookPath(`"${workbook}"`)).toEqual({
      resolved: workbook,
      exists: true,
      readable: true,
      reason: null,
    })
  })

  it('aceita aspas com espaco em volta, como o campo as recebe', () => {
    expect(checkWorkbookPath(`  "${workbook}"  `).reason).toBeNull()
  })

  /** Aspas de um lado so nao sao envolvimento: o nome fica como esta. */
  it('nao remove aspas soltas, que fazem parte do nome no Linux', () => {
    const aspas = join(dir, 'com"aspas.xlsx')
    writeFileSync(aspas, 'conteudo irrelevante')

    expect(checkWorkbookPath(aspas).reason).toBeNull()
    expect(checkWorkbookPath(`"${workbook}`).resolved).not.toBe(workbook)
  })

  it('recusa quem nao e .xlsx antes de conferir existencia', () => {
    writeFileSync(join(dir, 'planilha.xls'), 'x')

    expect(checkWorkbookPath(join(dir, 'planilha.xls')).reason).toMatch(/\.xlsx/)
  })

  it('recusa caminho inexistente citando a sincronizacao do OneDrive', () => {
    expect(checkWorkbookPath(join(dir, 'sumiu.xlsx')).reason).toMatch(/OneDrive/)
  })

  it('recusa pasta, e nao so arquivo ausente', () => {
    const pasta = join(dir, 'pasta.xlsx')
    mkdirSync(pasta)

    expect(checkWorkbookPath(pasta)).toMatchObject({ exists: true, readable: false })
    expect(checkWorkbookPath(pasta).reason).toMatch(/pasta/)
  })

  it.skipIf(!semPrivilegio)('recusa arquivo sem permissao de leitura', () => {
    chmodSync(workbook, 0o000)

    expect(checkWorkbookPath(workbook)).toMatchObject({ exists: true, readable: false })
    expect(checkWorkbookPath(workbook).reason).toMatch(/permissao/i)
  })

  it('recusa caminho vazio pedindo que informe', () => {
    expect(checkWorkbookPath('   ')).toEqual({
      resolved: WORKBOOK_UNSET,
      exists: false,
      readable: false,
      reason: 'Informe o caminho da planilha.',
    })
  })

  /**
   * Caminho UNC do Windows. Este teste roda em Linux, entao o que ele afirma
   * NAO e que o arquivo seja encontrado — e que a recusa venha da ausencia, e
   * nunca do formato: nada aqui interpreta ou restringe a forma do caminho.
   */
  it('nao rejeita caminho UNC pela forma', () => {
    const unc = '\\\\servidor\\compartilhado\\planilha.xlsx'

    expect(checkWorkbookPath(unc).reason).not.toMatch(/\.xlsx/)
  })
})

describe('saveWorkbookPath', () => {
  it('preserva todos os demais campos do arquivo', () => {
    const path = join(dir, 'app.json')
    writeFileSync(
      path,
      JSON.stringify({
        _origem: 'comentario prefixado, lido em execucao',
        workbookPath: '/antigo/planilha.xlsx',
        port: 5199,
        sheetName: '2026',
        timezone: 'America/Sao_Paulo',
        stalledDaysThreshold: 21,
        topN: 7,
      }),
    )

    saveWorkbookPath(workbook, path)
    const gravado = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>

    expect(gravado.workbookPath).toBe(workbook)
    expect(gravado).toMatchObject({
      _origem: 'comentario prefixado, lido em execucao',
      port: 5199,
      sheetName: '2026',
      timezone: 'America/Sao_Paulo',
      stalledDaysThreshold: 21,
      topN: 7,
    })
  })

  it('cria o arquivo quando ele ainda nao existe', () => {
    const path = join(dir, 'app.json')

    saveWorkbookPath(workbook, path)

    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({ workbookPath: workbook })
  })

  it('nao deixa o temporario para tras', () => {
    const path = join(dir, 'app.json')

    saveWorkbookPath(workbook, path)

    expect(() => readFileSync(`${path}.tmp`)).toThrow()
  })

  it.skipIf(!semPrivilegio)('falha com ConfigWriteError quando nao pode gravar', () => {
    const path = join(dir, 'app.json')
    writeFileSync(path, JSON.stringify({ workbookPath: '/antigo/planilha.xlsx' }))
    chmodSync(dir, 0o500)

    expect(() => saveWorkbookPath(workbook, path)).toThrow(ConfigWriteError)
    chmodSync(dir, 0o700)
    // O criterio de aceite: uma tentativa falha nunca derruba o que funcionava.
    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({
      workbookPath: '/antigo/planilha.xlsx',
    })
  })

  it('recusa gravar sobre um app.json malformado, em vez de sobrescreve-lo', () => {
    const path = join(dir, 'app.json')
    writeFileSync(path, '{ nao e json')

    expect(() => saveWorkbookPath(workbook, path)).toThrow(ConfigWriteError)
    expect(readFileSync(path, 'utf-8')).toBe('{ nao e json')
  })
})
