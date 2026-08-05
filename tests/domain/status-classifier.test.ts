import { describe, expect, it } from 'vitest'
import { ALL_COLUMNS, classify } from '../../src/domain/status-classifier.ts'
import type { RawCell, RawRow } from '../../src/domain/types.ts'

/** As duas grafias reais medidas em H-01, ja normalizadas. */
const ALIASES = ['DESEMBARACADA', 'DESEMBARCADA']

const cell = (value: string | null): RawCell =>
  value === null ? { value: null, type: 'null' } : { value, type: 'string' }

/** Linha com REF e as demais colunas preenchidas, salvo o que for sobrescrito. */
function linha(overrides: Record<string, string | null> = {}): RawRow {
  const cells: Record<string, RawCell> = {}
  for (const column of ALL_COLUMNS) {
    cells[column] = cell(column === 'A' ? 'FT001.26' : `valor ${column}`)
  }
  for (const [column, value] of Object.entries(overrides)) {
    cells[column] = cell(value)
  }
  return { sourceRow: 2, cells, styleKey: 'none' }
}

/** Linha com REF preenchido e todas as demais colunas vazias. */
function soRef(ref = 'FT600.26', overrides: Record<string, string | null> = {}): RawRow {
  const cells: Record<string, RawCell> = {}
  for (const column of ALL_COLUMNS) cells[column] = cell(column === 'A' ? ref : null)
  for (const [column, value] of Object.entries(overrides)) cells[column] = cell(value)
  return { sourceRow: 2, cells, styleKey: 'none' }
}

describe('classify — TD-01, regra 3: desembaracado', () => {
  it('reconhece a forma canonica', () => {
    expect(classify(linha({ L: 'DESEMBARAÇADA' }), ALIASES).category).toBe('desembaracado')
  })

  // A grafia sem o segundo "A" existe de fato na planilha: 1 ocorrencia (A-03).
  it('reconhece a variante real DESEMBARÇADA', () => {
    expect(classify(linha({ L: 'DESEMBARÇADA' }), ALIASES).category).toBe('desembaracado')
  })

  it('ignora caixa, acento e espacos ao redor', () => {
    for (const valor of ['desembaraçada', 'DESEMBARACADA', '  DESEMBARAÇADA  ', 'Desembaraçada']) {
      expect(classify(linha({ L: valor }), ALIASES).category, valor).toBe('desembaracado')
    }
  })

  it('nao gera anomalia para forma catalogada', () => {
    expect(classify(linha({ L: 'DESEMBARAÇADA' }), ALIASES).anomalies).toEqual([])
  })
})

describe('classify — TD-01, regra 4: em desembaraco', () => {
  it('classifica STATUS vazio', () => {
    expect(classify(linha({ L: '' }), ALIASES).category).toBe('em_desembaraco')
  })

  it('classifica STATUS so com espacos', () => {
    expect(classify(linha({ L: '   ' }), ALIASES).category).toBe('em_desembaraco')
  })

  it('classifica STATUS nulo', () => {
    expect(classify(linha({ L: null }), ALIASES).category).toBe('em_desembaraco')
  })
})

describe('classify — TD-01, regra 5: em andamento', () => {
  it('classifica texto livre', () => {
    const r = classify(linha({ L: 'AG BL ORIGINAL' }), ALIASES)

    expect(r.category).toBe('em_andamento')
    expect(r.anomalies).toEqual([])
  })

  it('classifica DUIMP com conferencia', () => {
    const valor = 'DUIMP: 26BR0001273903-1 - CONFERIDO 29.07'

    expect(classify(linha({ L: valor }), ALIASES).category).toBe('em_andamento')
  })

  // Nao reclassifica por adivinhacao: sinaliza e deixa a decisao para humano.
  it('sinaliza variante proxima sem reclassificar', () => {
    const r = classify(linha({ L: 'DESEMBARAÇADO' }), ALIASES)

    expect(r.category).toBe('em_andamento')
    expect(r.anomalies).toContain('VARIANTE_STATUS_PROXIMA')
  })

  it('sinaliza DESEMBARAÇAD como variante proxima', () => {
    expect(classify(linha({ L: 'DESEMBARAÇAD' }), ALIASES).anomalies).toContain(
      'VARIANTE_STATUS_PROXIMA',
    )
  })

  // Os dois valores reais com data anexada estao a distancia 6: acima do
  // limiar, portanto NEM geram anomalia. Omissao consciente (achado A-53).
  it('nao sinaliza "DESEMBARAÇADA 03/02", que esta acima do limiar', () => {
    const r = classify(linha({ L: 'DESEMBARAÇADA 03/02' }), ALIASES)

    expect(r.category).toBe('em_andamento')
    expect(r.anomalies).not.toContain('VARIANTE_STATUS_PROXIMA')
  })

  it('nao sinaliza texto sem relacao com a forma catalogada', () => {
    expect(classify(linha({ L: 'NCM 28/07' }), ALIASES).anomalies).toEqual([])
  })
})

describe('classify — TD-01, regra 2: fechado aguardando draft', () => {
  // A regra 2 PRECEDE a regra 4: sem isso, uma linha so com REF cairia em
  // em_desembaraco, porque seu STATUS tambem esta vazio (achado A-22).
  it('classifica linha com apenas REF preenchido', () => {
    expect(classify(soRef(), ALIASES).category).toBe('fechado_aguardando_draft')
  })

  it('trata colunas so com espacos como vazias', () => {
    const row = soRef('FT600.26', { B: '   ', C: '  ', J: ' ' })

    expect(classify(row, ALIASES).category).toBe('fechado_aguardando_draft')
  })

  // "Demais colunas" inclui as fora de escopo, Coluna 13 e R$ ENVIADO (A-23).
  it('deixa de ser aguardando draft quando a Coluna 13 tem valor', () => {
    const row = soRef('FT600.26', { M: 'N/A' })

    expect(classify(row, ALIASES).category).toBe('em_desembaraco')
  })

  it('deixa de ser aguardando draft quando R$ ENVIADO tem valor', () => {
    expect(classify(soRef('FT600.26', { N: 'OK 23/07' }), ALIASES).category).toBe('em_desembaraco')
  })

  it('deixa de ser aguardando draft quando a Coluna1 tem valor', () => {
    expect(classify(soRef('FT600.26', { P: 'FERREIRA' }), ALIASES).category).toBe('em_desembaraco')
  })

  it('linha so com REF e STATUS preenchido vira em andamento', () => {
    expect(classify(soRef('FT600.26', { L: 'AG BL ORIGINAL' }), ALIASES).category).toBe(
      'em_andamento',
    )
  })
})

describe('classify — anomalia de canal em texto', () => {
  // A cor e a UNICA fonte do canal (A-06). Isto so alimenta o relatorio.
  it('sinaliza CANAL AMARELO sem alterar a categoria', () => {
    const r = classify(linha({ L: 'DUIMP: 26BR0001247418-6 - CANAL AMARELO' }), ALIASES)

    expect(r.category).toBe('em_andamento')
    expect(r.anomalies).toContain('CANAL_EM_TEXTO_STATUS')
  })

  it('sinaliza os quatro canais aduaneiros', () => {
    for (const canal of ['VERDE', 'AMARELO', 'VERMELHO', 'CINZA']) {
      const r = classify(linha({ L: `DUIMP 123 - CANAL ${canal}` }), ALIASES)

      expect(r.anomalies, canal).toContain('CANAL_EM_TEXTO_STATUS')
    }
  })

  it('nao sinaliza a palavra CANAL sozinha', () => {
    expect(classify(linha({ L: 'AGUARDANDO CANAL' }), ALIASES).anomalies).not.toContain(
      'CANAL_EM_TEXTO_STATUS',
    )
  })

  it('nao sinaliza a cor sem a palavra CANAL', () => {
    expect(classify(linha({ L: 'CONTAINER VERMELHO' }), ALIASES).anomalies).not.toContain(
      'CANAL_EM_TEXTO_STATUS',
    )
  })
})

describe('classify — as quatro categorias sao mutuamente exclusivas', () => {
  it('cada linha recebe exatamente uma categoria', () => {
    const casos: [RawRow, string][] = [
      [linha({ L: 'DESEMBARAÇADA' }), 'desembaracado'],
      [linha({ L: '' }), 'em_desembaraco'],
      [linha({ L: 'AG BL ORIGINAL' }), 'em_andamento'],
      [soRef(), 'fechado_aguardando_draft'],
    ]

    const categorias = casos.map(([row]) => classify(row, ALIASES).category)

    expect(new Set(categorias).size).toBe(4)
    for (const [row, esperada] of casos) {
      expect(classify(row, ALIASES).category).toBe(esperada)
    }
  })

  it('dicionario vazio faz tudo cair em em_andamento, nunca em desembaracado', () => {
    expect(classify(linha({ L: 'DESEMBARAÇADA' }), []).category).toBe('em_andamento')
  })
})
