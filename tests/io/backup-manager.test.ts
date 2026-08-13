import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backup, prune, restore } from '../../src/io/backup-manager.ts'

/**
 * As copias do .xlsx e o expurgo de RNF-21. Os arquivos aqui sao textos
 * quaisquer: o modulo copia bytes e nunca os interpreta, e nenhum teste toca a
 * planilha real (RNF-38).
 *
 * O expurgo e exercido por NOME, com `now` injetado — e o que torna os 90 dias
 * testaveis sem depender do relogio do sistema de arquivos.
 */

const DAY_MS = 86_400_000

let directory: string
let backupDir: string
let workbook: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-backup-'))
  backupDir = join(directory, 'backups')
  workbook = join(directory, 'planilha.xlsx')
  writeFileSync(workbook, 'conteudo original', 'utf-8')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

/** Nome no formato de 03-modelo-dados.md secao 3.4, com a idade pedida. */
function aged(daysAgo: number, now: Date): string {
  const moment = new Date(now.getTime() - daysAgo * DAY_MS)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const day = `${moment.getFullYear()}${pad(moment.getMonth() + 1)}${pad(moment.getDate())}`
  const time = `${pad(moment.getHours())}${pad(moment.getMinutes())}${pad(moment.getSeconds())}`
  return `planilha-${day}-${time}.xlsx`
}

function seed(names: string[]): void {
  mkdirSync(backupDir, { recursive: true })
  for (const name of names) writeFileSync(join(backupDir, name), 'copia', 'utf-8')
}

describe('backup', () => {
  it('copia o arquivo e devolve o caminho no formato de 03-modelo-dados.md 3.4', async () => {
    const path = await backup(workbook, backupDir)

    expect(path).toMatch(/planilha-\d{8}-\d{6}\.xlsx$/)
    expect(readFileSync(path, 'utf-8')).toBe('conteudo original')
  })

  it('cria a pasta de backups quando ela ainda nao existe', async () => {
    expect(existsSync(backupDir)).toBe(false)

    await backup(workbook, backupDir)

    expect(existsSync(backupDir)).toBe(true)
  })

  // O nome tem resolucao de segundo: sem o sufixo, a segunda copia apagaria a
  // primeira — justamente a que se quer preservar.
  it('nao sobrescreve a copia anterior gravada no mesmo segundo', async () => {
    const instant = new Date(2026, 7, 13, 14, 35, 12)

    const primeira = await backup(workbook, backupDir, instant)
    writeFileSync(workbook, 'conteudo alterado', 'utf-8')
    const segunda = await backup(workbook, backupDir, instant)

    expect(segunda).not.toBe(primeira)
    expect(readFileSync(primeira, 'utf-8')).toBe('conteudo original')
    expect(readFileSync(segunda, 'utf-8')).toBe('conteudo alterado')
  })

  // Quem chama precisa abortar a escrita; backup ausente em silencio e pior
  // que escrita recusada.
  it('lanca quando o arquivo de origem nao existe', async () => {
    await expect(backup(join(directory, 'inexistente.xlsx'), backupDir)).rejects.toThrow()
  })
})

describe('restore', () => {
  it('devolve o arquivo ao conteudo da copia', async () => {
    const path = await backup(workbook, backupDir)
    writeFileSync(workbook, 'conteudo corrompido', 'utf-8')

    await restore(path, workbook)

    expect(readFileSync(workbook, 'utf-8')).toBe('conteudo original')
  })

  it('nao deixa o temporario da restauracao para tras', async () => {
    const path = await backup(workbook, backupDir)

    await restore(path, workbook)

    expect(readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})

describe('prune', () => {
  const now = new Date(2026, 7, 13, 12, 0, 0)

  // RNF-21 e uniao, nao intersecao: os dois casos abaixo isolam cada metade.
  it('mantem os 30 mais novos ainda que todos estejam vencidos', async () => {
    seed(Array.from({ length: 30 }, (_, index) => aged(91 + index, now)))

    expect(await prune(30, 90, backupDir, now)).toBe(0)
    expect(readdirSync(backupDir)).toHaveLength(30)
  })

  it('mantem os de menos de 90 dias ainda que passem de 30 copias', async () => {
    seed(Array.from({ length: 40 }, (_, index) => aged(index, now)))

    expect(await prune(30, 90, backupDir, now)).toBe(0)
    expect(readdirSync(backupDir)).toHaveLength(40)
  })

  it('remove apenas quem falha nos dois criterios, do mais antigo', async () => {
    const excedenteVencido = aged(91, now)
    seed([...Array.from({ length: 30 }, (_, index) => aged(index, now)), excedenteVencido])

    expect(await prune(30, 90, backupDir, now)).toBe(1)

    const restantes = readdirSync(backupDir)
    expect(restantes).toHaveLength(30)
    expect(restantes).not.toContain(excedenteVencido)
  })

  // A pasta e do operador: apagar o que o modulo nao escreveu inferiria
  // intencao, o que a regra inviolavel 3 proibe.
  it('nunca remove arquivo fora do padrao de nome', async () => {
    seed([...Array.from({ length: 31 }, (_, index) => aged(200 + index, now))])
    writeFileSync(join(backupDir, 'anotacao-do-operador.txt'), 'nao apague', 'utf-8')
    writeFileSync(join(backupDir, 'planilha-copia.xlsx'), 'nao apague', 'utf-8')

    await prune(30, 90, backupDir, now)

    const restantes = readdirSync(backupDir)
    expect(restantes).toContain('anotacao-do-operador.txt')
    expect(restantes).toContain('planilha-copia.xlsx')
  })

  it('devolve zero quando a pasta de backups nao existe', async () => {
    rmSync(backupDir, { recursive: true, force: true })

    expect(await prune(30, 90, backupDir, now)).toBe(0)
  })
})
