import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type AppConfig, describeConfig, loadConfig, WORKBOOK_UNSET } from '../../src/app/config.ts'

let dir: string
let workbook: string

function writeConfig(content: unknown): string {
  const path = join(dir, 'app.json')
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-'))
  workbook = join(dir, 'planilha.xlsx')
  writeFileSync(workbook, 'conteudo irrelevante para este teste')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('carrega uma configuracao valida e aplica os defaults', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook }))

    expect(config.workbookPath).toBe(workbook)
    expect(config.sheetName).toBe('2026')
    expect(config.headerRow).toBe(1)
    expect(config.firstDataRow).toBe(2)
    expect(config.port).toBe(5173)
    expect(config.stalledDaysThreshold).toBe(15)
    expect(config.topN).toBe(10)
    expect(config.timezone).toBe('America/Sao_Paulo')
  })

  it('preserva valores explicitos sobre os defaults', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook, port: 8080, topN: 25 }))

    expect(config.port).toBe(8080)
    expect(config.topN).toBe(25)
  })

  /**
   * As tres assercoes abaixo foram INVERTIDAS em H-34, e a inversao e a
   * historia. Ate ela, cada uma destas condicoes matava a partida — e isso
   * criava um circulo: `config/app.json` nao e versionado, entao numa
   * instalacao nova o processo morria antes de servir a tela de configuracao
   * que existe para consertar o caminho.
   */
  it('sobe sem app.json, com o caminho nao configurado', () => {
    const config = loadConfig(join(dir, 'nao-existe.json'))

    expect(config.workbookPath).toBe(WORKBOOK_UNSET)
    expect(config.port).toBe(5173)
  })

  // O caminho declarado e PRESERVADO mesmo inexistente: a tela mostra para onde
  // a aplicacao estava apontando, e o store entra em 'degradado' com a razao.
  it('sobe com a planilha inexistente, preservando o caminho configurado', () => {
    const sumiu = join(dir, 'sumiu.xlsx')

    expect(loadConfig(writeConfig({ workbookPath: sumiu })).workbookPath).toBe(sumiu)
  })

  it('trata workbookPath ausente ou so com espacos como nao configurado', () => {
    expect(loadConfig(writeConfig({})).workbookPath).toBe(WORKBOOK_UNSET)
    expect(loadConfig(writeConfig({ workbookPath: '   ' })).workbookPath).toBe(WORKBOOK_UNSET)
  })

  it('falha quando o JSON e invalido', () => {
    expect(() => loadConfig(writeConfig('{ nao e json'))).toThrow(/JSON valido/)
  })

  it('rejeita porta fora da faixa', () => {
    expect(() => loadConfig(writeConfig({ workbookPath: workbook, port: 70000 }))).toThrow(
      /entre 1 e 65535/,
    )
  })

  it('rejeita firstDataRow menor ou igual a headerRow', () => {
    const path = writeConfig({ workbookPath: workbook, headerRow: 3, firstDataRow: 3 })

    expect(() => loadConfig(path)).toThrow(/maior que "headerRow"/)
  })

  it('aceita sheetName null, que significa primeira aba', () => {
    const config = loadConfig(writeConfig({ workbookPath: workbook, sheetName: null }))

    expect(config.sheetName).toBeNull()
  })
})

/**
 * H-35. O inventario dos oito campos, que e o que a tela de configuracao mostra.
 *
 * O caminho do `app.json` e SEMPRE injetado: sob `NODE_ENV=test` o padrao e
 * recusado, e o ultimo teste deste bloco e quem prova a recusa.
 */
describe('describeConfig', () => {
  function effective(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
      workbookPath: workbook,
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

  function sourceOf(report: ReturnType<typeof describeConfig>, key: string): string {
    const field = report.fields.find((candidate) => candidate.key === key)
    if (field === undefined) throw new Error(`o inventario nao trouxe "${key}"`)
    return field.source
  }

  it('inventaria os OITO campos, na ordem de config/app.json.exemplo', () => {
    const report = describeConfig(effective(), writeConfig({ workbookPath: workbook }))

    expect(report.fields.map((field) => field.key)).toEqual([
      'workbookPath',
      'sheetName',
      'headerRow',
      'firstDataRow',
      'port',
      'stalledDaysThreshold',
      'topN',
      'timezone',
    ])
  })

  it('sem arquivo, os sete com padrao vem de "padrao" e o caminho vem de "ausente"', () => {
    const report = describeConfig(
      effective({ workbookPath: WORKBOOK_UNSET }),
      join(dir, 'nao-existe.json'),
    )

    expect(report.present).toBe(false)
    expect(report.parseable).toBe(true)
    expect(sourceOf(report, 'workbookPath')).toBe('ausente')
    expect(report.fields.filter((field) => field.source === 'padrao')).toHaveLength(7)
  })

  /**
   * O motivo de o campo `source` existir. As duas situacoes mostram `5173`, e
   * uma delas foi decidida por alguem — regra inviolavel 3 aplicada a propria
   * configuracao.
   */
  it('distingue "padrao aplicado" de "configurado com valor igual ao padrao"', () => {
    const declarado = describeConfig(
      effective(),
      writeConfig({ workbookPath: workbook, port: 5173 }),
    )
    const omitido = describeConfig(effective(), writeConfig({ workbookPath: workbook }))

    expect(declarado.fields[4]?.value).toBe(5173)
    expect(omitido.fields[4]?.value).toBe(5173)
    expect(sourceOf(declarado, 'port')).toBe('arquivo')
    expect(sourceOf(omitido, 'port')).toBe('padrao')
  })

  it('o valor e o EFETIVO, e o arquivo divergente vira restartPending', () => {
    const report = describeConfig(
      effective({ port: 5173 }),
      writeConfig({ workbookPath: workbook, port: 5174 }),
    )
    const port = report.fields.find((field) => field.key === 'port')

    expect(port?.value).toBe(5173)
    expect(port?.restartPending).toBe(true)
  })

  it('nao marca restartPending quando o arquivo concorda com o que esta em uso', () => {
    const report = describeConfig(
      effective({ topN: 25 }),
      writeConfig({ workbookPath: workbook, topN: 25 }),
    )

    expect(report.fields.every((field) => field.restartPending === false)).toBe(true)
  })

  it('arquivo corrompido depois da partida: origem desconhecida, valores preservados', () => {
    const report = describeConfig(effective(), writeConfig('{ "port": 5173,, }'))

    expect(report.present).toBe(true)
    expect(report.parseable).toBe(false)
    expect(report.fields.every((field) => field.source === 'desconhecida')).toBe(true)
    expect(report.fields[4]?.value).toBe(5173)
  })

  it('caminho com espacos e acentos chega inteiro ao inventario', () => {
    const comAcento = join(dir, 'Contrôle DOS EMBARQUE 2026.xlsx')
    writeFileSync(comAcento, 'conteudo irrelevante para este teste')
    const report = describeConfig(
      effective({ workbookPath: comAcento }),
      writeConfig({ workbookPath: comAcento }),
    )

    expect(report.fields[0]?.value).toBe(comAcento)
    expect(sourceOf(report, 'workbookPath')).toBe('arquivo')
  })

  /**
   * Roda em Linux, entao o que este teste afirma NAO e que o caminho seja
   * encontrado — e que a forma UNC nao o faca sumir do inventario nem ser lido
   * como ausencia de configuracao. Mesma leitura do teste irmao em
   * `tests/app/config-write.test.ts`.
   */
  it('caminho UNC continua sendo configuracao, e nao ausencia', () => {
    const unc = '\\\\servidor\\compartilhado\\planilha.xlsx'

    const report = describeConfig(
      effective({ workbookPath: unc }),
      writeConfig({ workbookPath: unc }),
    )

    expect(sourceOf(report, 'workbookPath')).toBe('arquivo')
  })

  it('workbookPath declarado vazio conta como ausente, e nao como arquivo', () => {
    const report = describeConfig(
      effective({ workbookPath: WORKBOOK_UNSET }),
      writeConfig({ workbookPath: '   ' }),
    )

    expect(sourceOf(report, 'workbookPath')).toBe('ausente')
  })

  /**
   * A regra inviolavel 7. Sem esta recusa, um teste sem caminho injetado leria o
   * `app.json` da maquina e passaria — ou reprovaria — pelo estado dela.
   */
  it('recusa o caminho padrao sob NODE_ENV=test', () => {
    expect(() => describeConfig(effective())).toThrow(/injete o caminho/)
  })
})
