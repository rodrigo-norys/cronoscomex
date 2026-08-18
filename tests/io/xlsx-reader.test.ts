import { readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/app/config.ts'
import { readWorkbook, WorkbookReadError } from '../../src/io/xlsx-reader.ts'

function config(fixture: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    workbookPath: `tests/fixtures/${fixture}`,
    sheetName: '2026',
    headerRow: 1,
    firstDataRow: 2,
    port: 5173,
    stalledDaysThreshold: 15,
    topN: 10,
    timezone: 'America/Sao_Paulo',
    ...overrides,
  }
}

describe('readWorkbook', () => {
  it('le as linhas de dados e numera a partir da linha 2', async () => {
    const result = await readWorkbook(config('basico.xlsx'))

    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]?.sourceRow).toBe(2)
    expect(result.rows[2]?.sourceRow).toBe(4)
  })

  it('indexa as celulas por letra de coluna', async () => {
    const result = await readWorkbook(config('basico.xlsx'))
    const primeira = result.rows[0]

    expect(primeira?.cells.A?.value).toBe('FT001.26')
    expect(primeira?.cells.E?.value).toBe('AGENTE UM')
    expect(primeira?.cells.L?.value).toBe('DESEMBARAÇADA')
  })

  it('classifica os tipos de celula', async () => {
    const result = await readWorkbook(config('basico.xlsx'))
    const primeira = result.rows[0]

    expect(primeira?.cells.A?.type).toBe('string')
    expect(primeira?.cells.I?.type).toBe('date')
    expect(primeira?.cells.I?.value).toBeInstanceOf(Date)
  })

  it('resolve o caminho da aba dentro do zip, sem presumir sheet1.xml', async () => {
    const result = await readWorkbook(config('basico.xlsx'))

    expect(result.sheetName).toBe('2026')
    expect(result.sheetPath).toMatch(/^xl\/worksheets\/sheet\d+\.xml$/)
  })

  it('produz o mesmo fileHash em duas leituras do mesmo arquivo', async () => {
    const a = await readWorkbook(config('basico.xlsx'))
    const b = await readWorkbook(config('basico.xlsx'))

    expect(a.fileHash).toBe(b.fileHash)
    expect(a.fileHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('o fileHash corresponde ao conteudo binario do arquivo', async () => {
    const { createHash } = await import('node:crypto')
    const esperado = createHash('sha256')
      .update(readFileSync('tests/fixtures/basico.xlsx'))
      .digest('hex')

    const result = await readWorkbook(config('basico.xlsx'))

    expect(result.fileHash).toBe(`sha256:${esperado}`)
  })

  it('falha listando as abas disponiveis quando a aba nao existe', async () => {
    await expect(readWorkbook(config('basico.xlsx', { sheetName: '2099' }))).rejects.toThrow(
      WorkbookReadError,
    )
    await expect(readWorkbook(config('basico.xlsx', { sheetName: '2099' }))).rejects.toThrow(
      /Abas disponiveis: .*2026/,
    )
  })

  // Regra inviolavel 10: nenhuma celula das abas fora de escopo vira RawRow.
  it('nao materializa nenhuma linha das abas fora de escopo', async () => {
    const result = await readWorkbook(config('formatado.xlsx'))

    expect(result.sheetName).toBe('2026')
    expect(result.rows).toHaveLength(9)
    // as fixtures tem 2025, 2024 e CNPJ com sheetData vazio; ainda assim a
    // asserção vale como regressao: so a aba em escopo produz linhas.
    expect(result.rows.every((r) => r.sourceRow >= 2 && r.sourceRow <= 10)).toBe(true)
  })

  /**
   * H-33. Ate a troca do leitor, ler esta fixture deixava 4 arquivos em /tmp e
   * 5 FSReqCallback mais 1 PipeWrap vivos depois da promise resolver: o ExcelJS
   * despejava cada aba num temporario antes de emiti-la, e as abas fora de
   * escopo — puladas pela regra inviolavel 10 — nunca fechavam o descritor.
   *
   * A conferencia de /tmp filtra pelo prefixo do pacote `tmp`, e nao compara o
   * diretorio inteiro: ele e compartilhado com os outros processos da maquina, e
   * uma comparacao total reprovaria por arquivo que nao e nosso.
   */
  it('nao deixa temporario em /tmp nem trabalho pendente depois de resolver', async () => {
    const pendentes = () =>
      process.getActiveResourcesInfo().filter((tipo) => tipo === 'FSReqCallback').length
    const temporarios = () => readdirSync(tmpdir()).filter((entrada) => entrada.startsWith('tmp-'))

    const antes = temporarios()
    const pendentesAntes = pendentes()

    await readWorkbook(config('formatado.xlsx'))

    expect(temporarios().filter((entrada) => !antes.includes(entrada))).toEqual([])
    expect(pendentes()).toBeLessThanOrEqual(pendentesAntes)
  })

  it('devolve conjunto vazio para planilha so com cabecalho', async () => {
    const result = await readWorkbook(config('vazio.xlsx'))

    expect(result.rows).toHaveLength(0)
    expect(result.sheetName).toBe('2026')
  })
})

describe('readWorkbook — chaves de estilo', () => {
  it('extrai as 9 chaves reais medidas por H-01', async () => {
    const result = await readWorkbook(config('cores.xlsx'))
    const chaves = result.rows.map((r) => r.styleKey)

    expect(chaves.slice(0, 9)).toEqual([
      'argb:FF00FF00',
      'argb:FF00FF0D',
      'argb:FF5B9BD5',
      'argb:FFA74F7B',
      'argb:FFA64D79',
      'argb:FFFFE599',
      'argb:FFFF0000',
      'argb:FFFFFF00',
      'theme:0|tint:0.0000',
    ])
  })

  it('as chaves lidas cobrem 100% das entradas de config/color-map.json', async () => {
    const mapa = JSON.parse(readFileSync('config/color-map.json', 'utf-8')) as {
      entries: { styleKey: string }[]
    }
    const doMapa = new Set(mapa.entries.map((e) => e.styleKey))

    const result = await readWorkbook(config('cores.xlsx'))
    const lidas = result.rows.slice(0, 9).map((r) => r.styleKey)

    for (const chave of lidas) {
      expect(doMapa.has(chave), `chave ${chave} ausente de color-map.json`).toBe(true)
    }
  })

  it('a decima linha usa cor fora do mapa, para exercitar COR_NAO_MAPEADA em H-07', async () => {
    const mapa = JSON.parse(readFileSync('config/color-map.json', 'utf-8')) as {
      entries: { styleKey: string }[]
    }
    const doMapa = new Set(mapa.entries.map((e) => e.styleKey))

    const result = await readWorkbook(config('cores.xlsx'))

    expect(doMapa.has(result.rows[9]?.styleKey ?? '')).toBe(false)
  })

  it('linha em branco e devolvida com celulas nulas; o descarte fica para H-06', async () => {
    const result = await readWorkbook(config('sujeira.xlsx'))
    const semRef = result.rows.filter((r) => r.cells.A?.value === null)

    expect(semRef.length).toBeGreaterThan(0)
    expect(semRef[0]?.cells.A?.type).toBe('null')
  })
})
