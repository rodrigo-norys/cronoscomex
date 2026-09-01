import { describe, expect, it } from 'vitest'
import {
  indexClientGroups,
  normalizeClientGroups,
  normalizeClientMap,
} from '../../src/domain/client-mapper.ts'
import { type ColorMapEntry, indexColorMap } from '../../src/domain/color-mapper.ts'
import { type BuildDeps, buildProcesses, quarantineRate } from '../../src/domain/process-builder.ts'
import { ALL_COLUMNS } from '../../src/domain/status-classifier.ts'
import { normalizeTeamMap } from '../../src/domain/team-mapper.ts'
import type { RawCell, RawRow } from '../../src/domain/types.ts'

const ENTRADAS: ColorMapEntry[] = [
  {
    styleKey: 'argb:FF5B9BD5',
    fillId: 8,
    label: 'Azul',
    responsible: 'colaborador1',
    customsChannel: 'indefinido',
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
    customsChannel: 'indefinido',
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
    expect(p?.responsible).toBe('colaborador1')
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

/**
 * `H-49`. O campo CLT guarda o processo do cliente, e nao o cliente: medido,
 * 649 processos produzem 509 valores distintos (`docs/uso/RESULTADO.md` §2).
 */
describe('buildProcesses — cliente consolidado (H-49)', () => {
  const CLIENTES = normalizeClientMap([
    { key: 'ACME', label: 'Acme Comércio', rules: [{ match: 'prefix', value: 'ACM' }] },
    {
      key: 'BETA',
      label: 'Beta Ltda',
      rules: [
        { match: 'prefix', value: 'NOR', importer: 'IMPORTADORA NORTE' },
        { match: 'contains', value: 'BETA' },
      ],
    },
  ])

  const comMapa: BuildDeps = { ...deps, clientMap: CLIENTES }

  const cliente = (rows: RawRow[], mapDeps: BuildDeps = comMapa) =>
    buildProcesses(rows, mapDeps).processes[0]

  it('sem mapa, a chave do cliente e a da propria celula', () => {
    const process = cliente([linha(2, { A: 'FT001.26', B: 'ACM-29' })], deps)

    expect(process?.clientKey).toBe('ACM-29')
    expect(process?.clientProcessKey).toBe('ACM-29')
    expect(process?.clientLabel).toBe('ACM-29')
  })

  it('consolida pela regra de prefixo, preservando o valor da celula', () => {
    const process = cliente([linha(2, { A: 'FT001.26', B: 'ACM-29' })])

    expect(process?.clientKey).toBe('ACME')
    expect(process?.clientLabel).toBe('Acme Comércio')
    expect(process?.clientProcessKey).toBe('ACM-29')
    expect(process?.clientRaw).toBe('ACM-29')
  })

  /**
   * Medido: um prefixo de 62 processos cobre TRES clientes, separaveis so pelo
   * importador. Sem qualificar, o grupo inteiro permanece como esta.
   */
  it('qualifica a regra pelo importador', () => {
    const daNorte = cliente([linha(2, { A: 'FT001.26', B: 'NOR-77', C: 'Importadora Norte' })])
    const deOutro = cliente([linha(3, { A: 'FT002.26', B: 'NOR-77', C: 'Importadora Leste' })])

    expect(daNorte?.clientKey).toBe('BETA')
    expect(deOutro?.clientKey).toBe('NOR-77')
    expect(deOutro?.clientLabel).toBe('NOR-77')
  })

  it('casa tambem por texto contido, na segunda regra da mesma entrada', () => {
    const process = cliente([
      linha(2, { A: 'FT001.26', B: 'NOR-77 - BETA', C: 'Importadora Leste' }),
    ])

    expect(process?.clientKey).toBe('BETA')
    expect(process?.clientLabel).toBe('Beta Ltda')
  })

  it('com duas entradas casando, a primeira do arquivo vence', () => {
    const ambiguo = normalizeClientMap([
      { key: 'PRIMEIRA', label: 'Primeira', rules: [{ match: 'prefix', value: 'AC' }] },
      { key: 'SEGUNDA', label: 'Segunda', rules: [{ match: 'prefix', value: 'ACM' }] },
    ])

    const process = cliente([linha(2, { A: 'FT001.26', B: 'ACM-29' })], {
      ...deps,
      clientMap: ambiguo,
    })

    expect(process?.clientKey).toBe('PRIMEIRA')
  })

  it('celula vazia nao casa regra alguma e segue filtravel pela chave vazia', () => {
    const process = cliente([linha(2, { A: 'FT001.26', B: null })])

    expect(process?.clientKey).toBe('')
    expect(process?.clientProcessKey).toBe('')
    expect(process?.clientLabel).toBe('')
  })

  /**
   * A-26: o rotulo do grupo nao coberto e a primeira grafia encontrada, e nao
   * a chave normalizada que `resolveClient` devolve quando nada casa.
   */
  it('rotula o grupo sem regra pela grafia da celula', () => {
    const process = cliente([linha(2, { A: 'FT001.26', B: 'zeta comércio' })])

    expect(process?.clientKey).toBe('ZETA COMERCIO')
    expect(process?.clientLabel).toBe('zeta comércio')
  })
})

/**
 * `H-55`. O grupo acompanha o cliente CONSOLIDADO, nao a celula: e o cliente
 * que o mapa reune, e a celula pode nem ter regra.
 */
describe('buildProcesses — grupo de clientes (H-55)', () => {
  const CLIENTES = normalizeClientMap([
    { key: 'ACME', label: 'Acme Comércio', rules: [{ match: 'prefix', value: 'ACM' }] },
    { key: 'BETA', label: 'Beta Ltda', rules: [{ match: 'prefix', value: 'BET' }] },
  ])
  const GRUPOS = indexClientGroups(
    normalizeClientGroups([
      { key: 'GRUPO-UM', label: 'Grupo Um', members: [{ client: 'ACME' }, { client: 'BETA' }] },
    ]),
  )

  const comGrupo: BuildDeps = { ...deps, clientMap: CLIENTES, clientGroups: GRUPOS }

  it('marca o grupo do cliente consolidado', () => {
    const process = buildProcesses([linha(2, { A: 'FT001.26', B: 'ACM-29' })], comGrupo)
      .processes[0]

    expect(process?.clientKey).toBe('ACME')
    expect(process?.clientGroupKey).toBe('GRUPO-UM')
  })

  it('cliente fora de grupo fica com o grupo vazio', () => {
    const process = buildProcesses([linha(2, { A: 'FT001.26', B: 'ZETA' })], comGrupo).processes[0]

    expect(process?.clientKey).toBe('ZETA')
    expect(process?.clientGroupKey).toBe('')
  })

  it('sem grupos declarados, ninguem tem grupo', () => {
    const process = buildProcesses([linha(2, { A: 'FT001.26', B: 'ACM-29' })], {
      ...deps,
      clientMap: CLIENTES,
    }).processes[0]

    expect(process?.clientKey).toBe('ACME')
    expect(process?.clientGroupKey).toBe('')
  })
})

/**
 * `H-50`. O responsavel deixa de ser a cor e passa a ser a pessoa, com a cor
 * desempatando — e a cor vira campo proprio.
 */
describe('buildProcesses — responsavel pela pessoa (H-50)', () => {
  const EQUIPE = normalizeTeamMap([
    {
      key: 'membro1',
      label: 'Primeiro',
      importers: ['importadora um'],
      colorResponsible: ['colaborador2'],
    },
    {
      key: 'membro2',
      label: 'Segundo',
      importers: ['importadora dois'],
      colorResponsible: ['colaborador1'],
    },
  ])
  const comEquipe: BuildDeps = { ...deps, teamMap: EQUIPE }

  it('atribui pelo importador e guarda a cor em campo proprio', () => {
    const process = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA UM' }, 'argb:FF5B9BD5')],
      comEquipe,
    ).processes[0]

    expect(process?.responsible).toBe('membro1')
    expect(process?.responsibleLabel).toBe('Primeiro')
    // A cor azul continua dizendo `colaborador1`, e agora diz so isso.
    expect(process?.colorResponsible).toBe('colaborador1')
  })

  // Medido: tres importadores aparecem tambem com sufixo (docs/uso/RESULTADO.md §3).
  it('atribui a mesma pessoa ao importador com sufixo de filial', () => {
    const process = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA UM - SC' })],
      comEquipe,
    ).processes[0]

    expect(process?.responsible).toBe('membro1')
  })

  it('desempata pela cor o importador que nenhuma lista alcanca', () => {
    const process = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA SEM DONO' }, 'argb:FF5B9BD5')],
      comEquipe,
    ).processes[0]

    expect(process?.responsible).toBe('membro2')
  })

  // Os 42 que ficam sem responsavel, visiveis (regra inviolavel 3).
  it('deixa sem responsavel quem nao tem importador na lista nem cor', () => {
    const process = buildProcesses([linha(2, { A: 'FT001.26' })], comEquipe).processes[0]

    expect(process?.responsible).toBe('')
    expect(process?.responsibleLabel).toBe('')
    expect(process?.colorResponsible).toBe('indefinido')
  })

  // Medido: ZERO ocorrencias em 31/08/2026. A anomalia existe para a primeira.
  it('registra anomalia quando o importador e a cor apontam pessoas diferentes', () => {
    const resultado = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA UM' }, 'argb:FF5B9BD5')],
      comEquipe,
    )

    expect(resultado.processes[0]?.responsible).toBe('membro1')
    expect(resultado.processes[0]?.anomalies).toContain('RESPONSAVEL_DIVERGENTE')
    expect(resultado.anomalies[0]?.detail).toBe(
      'o importador atribui a "membro1"; a cor "colaborador1" aponta outra pessoa',
    )
  })

  it('nao registra anomalia quando as duas fontes concordam', () => {
    const resultado = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA DOIS' }, 'argb:FF5B9BD5')],
      comEquipe,
    )

    expect(resultado.processes[0]?.responsible).toBe('membro2')
    expect(resultado.processes[0]?.anomalies).not.toContain('RESPONSAVEL_DIVERGENTE')
  })

  // `D-23`: sem mapa o campo mostra o que a cor mostra hoje.
  it('sem mapa de equipe, o responsavel vale a chave de cor', () => {
    const process = buildProcesses(
      [linha(2, { A: 'FT001.26', C: 'IMPORTADORA UM' }, 'argb:FF5B9BD5')],
      deps,
    ).processes[0]

    expect(process?.responsible).toBe('colaborador1')
    expect(process?.responsibleLabel).toBe('Colaborador 1')
    expect(process?.colorResponsible).toBe('colaborador1')
  })
})
