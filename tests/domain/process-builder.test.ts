import { describe, expect, it } from 'vitest'
import { type ColorMapEntry, indexColorMap } from '../../src/domain/color-mapper.ts'
import { type BuildDeps, buildProcesses, quarantineRate } from '../../src/domain/process-builder.ts'
import { ALL_COLUMNS } from '../../src/domain/status-classifier.ts'
import type { RawCell, RawRow } from '../../src/domain/types.ts'

const ENTRADAS: ColorMapEntry[] = [
  {
    styleKey: 'argb:FF5B9BD5',
    fillId: 8,
    label: 'Azul',
    responsible: 'samira',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFFF0000',
    fillId: 7,
    label: 'Vermelho',
    responsible: 'indefinido',
    customsChannel: 'vermelho',
    importerOutsideRj: false,
  },
  {
    styleKey: 'none',
    fillId: 0,
    label: 'Branco',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
]

const deps: BuildDeps = {
  colorMap: indexColorMap(ENTRADAS),
  statusAliases: ['DESEMBARACADA', 'DESEMBARCADA'],
}

const cell = (value: string | Date | null): RawCell =>
  value === null
    ? { value: null, type: 'null' }
    : value instanceof Date
      ? { value, type: 'date' }
      : { value, type: 'string' }

function linha(
  sourceRow: number,
  valores: Record<string, string | Date | null>,
  styleKey = 'none',
): RawRow {
  const cells: Record<string, RawCell> = {}
  for (const column of ALL_COLUMNS) cells[column] = cell(valores[column] ?? null)
  return { sourceRow, cells, styleKey }
}

describe('buildProcesses — aceite e rejeicao', () => {
  it('compoe um processo completo a partir de uma linha', () => {
    const rows = [
      linha(
        2,
        { A: 'FT001.26', B: 'acme log', C: 'IMPORTADORA', E: 'AGENTE', L: 'DESEMBARAÇADA' },
        'argb:FF5B9BD5',
      ),
    ]

    const { processes } = buildProcesses(rows, deps)
    const p = processes[0]

    expect(p?.ref).toBe('FT001.26')
    expect(p?.clientRaw).toBe('acme log')
    expect(p?.clientKey).toBe('ACME LOG')
    expect(p?.statusCategory).toBe('desembaracado')
    expect(p?.responsible).toBe('samira')
    expect(p?.sourceRow).toBe(2)
  })

  // Linha vazia nao e pendencia: e preenchimento de planilha.
  it('ignora linha inteiramente vazia, sem contar em totalDataRows', () => {
    const r = buildProcesses([linha(2, {}), linha(3, { A: 'FT001.26' })], deps)

    expect(r.totalDataRows).toBe(1)
    expect(r.processes).toHaveLength(1)
    expect(r.quarantine).toHaveLength(0)
  })

  it('rejeita linha sem REF mas com outras colunas preenchidas', () => {
    const r = buildProcesses([linha(2, { B: 'CLIENTE', G: 'NAVIO' })], deps)

    expect(r.processes).toHaveLength(0)
    expect(r.quarantine[0]?.reason).toBe('REF_AUSENTE')
    expect(r.quarantine[0]?.detail).toContain('B')
    expect(r.totalDataRows).toBe(1)
  })
})

describe('buildProcesses — REF duplicada, TD-06', () => {
  it('aceita a de menor sourceRow e quarentena a seguinte', () => {
    const rows = [
      linha(10, { A: 'FT498.26', B: 'PRIMEIRA' }),
      linha(20, { A: 'FT498.26', B: 'SEGUNDA' }),
    ]

    const r = buildProcesses(rows, deps)

    expect(r.processes).toHaveLength(1)
    expect(r.processes[0]?.sourceRow).toBe(10)
    expect(r.quarantine[0]?.reason).toBe('REF_DUPLICADA')
    expect(r.quarantine[0]?.detail).toContain('linha 10')
  })

  it('trata diferenca de caixa e espaco como o MESMO REF', () => {
    const rows = [linha(10, { A: 'FT498.26' }), linha(20, { A: 'ft498.26 ' })]

    const r = buildProcesses(rows, deps)

    expect(r.processes).toHaveLength(1)
    expect(r.quarantine).toHaveLength(1)
  })

  it('com tres ocorrencias, aceita uma e quarentena duas', () => {
    const rows = [10, 20, 30].map((n) => linha(n, { A: 'FT498.26' }))

    const r = buildProcesses(rows, deps)

    expect(r.processes).toHaveLength(1)
    expect(r.quarantine).toHaveLength(2)
    expect(r.quarantine.map((q) => q.sourceRow)).toEqual([20, 30])
  })
})

describe('buildProcesses — cor nao mapeada', () => {
  // Entra em AMBOS: conta no volume e a pendencia fica visivel (A-17).
  it('aceita a linha E a registra na quarentena', () => {
    const rows = [linha(2, { A: 'FT001.26' }, 'theme:9|tint:0.3999')]

    const r = buildProcesses(rows, deps)

    expect(r.processes).toHaveLength(1)
    expect(r.processes[0]?.responsible).toBe('indefinido')
    expect(r.processes[0]?.importerOutsideRj).toBeNull()
    expect(r.quarantine[0]?.reason).toBe('COR_NAO_MAPEADA')
    expect(r.quarantine[0]?.detail).toContain('theme:9|tint:0.3999')
  })

  it('registra tambem a anomalia COR_NAO_MAPEADA no processo', () => {
    const r = buildProcesses([linha(2, { A: 'FT001.26' }, 'argb:FFABCDEF')], deps)

    expect(r.processes[0]?.anomalies).toContain('COR_NAO_MAPEADA')
  })
})

describe('buildProcesses — anomalias em linhas aceitas', () => {
  // Achado A-05: a planilha real tem RG preenchido em processo nao concluido.
  it('sinaliza RG preenchido em processo nao desembaracado', () => {
    const rows = [
      linha(2, { A: 'FT001.26', K: new Date('2026-07-31T00:00:00Z'), L: 'AG BL ORIGINAL' }),
    ]

    const r = buildProcesses(rows, deps)

    expect(r.processes[0]?.anomalies).toContain('RG_SEM_DESEMBARACO')
    expect(r.anomalies[0]?.code).toBe('RG_SEM_DESEMBARACO')
  })

  it('nao sinaliza RG em processo desembaracado', () => {
    const rows = [
      linha(2, { A: 'FT001.26', K: new Date('2026-07-31T00:00:00Z'), L: 'DESEMBARAÇADA' }),
    ]

    expect(buildProcesses(rows, deps).processes[0]?.anomalies).not.toContain('RG_SEM_DESEMBARACO')
  })

  it('sinaliza intervalo documental negativo', () => {
    const rows = [
      linha(2, {
        A: 'FT001.26',
        K: new Date('2026-07-20T00:00:00Z'),
        O: new Date('2026-07-30T00:00:00Z'),
        L: 'DESEMBARAÇADA',
      }),
    ]

    const r = buildProcesses(rows, deps)

    expect(r.processes[0]?.anomalies).toContain('INTERVALO_DOCUMENTAL_NEGATIVO')
    expect(r.anomalies.find((a) => a.code === 'INTERVALO_DOCUMENTAL_NEGATIVO')?.detail).toContain(
      '10 dias',
    )
  })

  it('nao sinaliza intervalo quando RG e posterior a DOCS ENVIADOS', () => {
    const rows = [
      linha(2, {
        A: 'FT001.26',
        K: new Date('2026-07-30T00:00:00Z'),
        O: new Date('2026-07-20T00:00:00Z'),
        L: 'DESEMBARAÇADA',
      }),
    ]

    expect(buildProcesses(rows, deps).processes[0]?.anomalies).not.toContain(
      'INTERVALO_DOCUMENTAL_NEGATIVO',
    )
  })

  // Caso-limite de H-07: a linha e ACEITA, mas a data fica nula.
  it('aceita linha com data sem ano, registrando a anomalia', () => {
    const rows = [linha(2, { A: 'FT001.26', I: '29/jul' })]

    const r = buildProcesses(rows, deps)

    expect(r.processes).toHaveLength(1)
    expect(r.processes[0]?.eta2).toBeNull()
    expect(r.processes[0]?.anomalies).toContain('DATA_SEM_ANO')
    expect(r.quarantine).toHaveLength(0)
  })

  it('propaga a anomalia de canal em texto vinda do classificador', () => {
    const rows = [linha(2, { A: 'FT001.26', L: 'DUIMP 1 - CANAL AMARELO' })]

    expect(buildProcesses(rows, deps).processes[0]?.anomalies).toContain('CANAL_EM_TEXTO_STATUS')
  })
})

describe('quarantineRate', () => {
  it('calcula a fracao com 4 casas decimais', () => {
    const rows = [
      linha(2, { A: 'FT001.26' }),
      linha(3, { A: 'FT002.26' }),
      linha(4, { B: 'SEM REF' }),
    ]

    expect(quarantineRate(buildProcesses(rows, deps))).toBe(0.3333)
  })

  // Caso-limite de H-07: nao dividir por zero.
  it('devolve zero quando nao ha linha de dados', () => {
    expect(quarantineRate(buildProcesses([], deps))).toBe(0)
    expect(quarantineRate(buildProcesses([linha(2, {})], deps))).toBe(0)
  })

  it('devolve zero quando nada foi quarentenado', () => {
    expect(quarantineRate(buildProcesses([linha(2, { A: 'FT001.26' })], deps))).toBe(0)
  })
})
