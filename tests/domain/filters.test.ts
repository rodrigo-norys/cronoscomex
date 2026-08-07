import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  CUSTOMS_CHANNELS,
  emptyFilterSet,
  FilterParseError,
  type FilterSet,
  optionsOf,
  parseFilters,
  RESPONSIBLES,
  STATUS_CATEGORIES,
} from '../../src/domain/filters.ts'
import type {
  CustomsChannel,
  Process,
  Responsible,
  StatusCategory,
} from '../../src/domain/types.ts'

const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

interface Fields {
  eta2?: string | null
  clientKey?: string
  clientRaw?: string
  importerKey?: string
  vesselKey?: string
  agentKey?: string
  goodsKey?: string
  portKey?: string
  statusCategory?: StatusCategory
  responsible?: Responsible
  customsChannel?: CustomsChannel
  importerOutsideRj?: boolean | null
}

let nextRow = 2

function process({
  eta2 = null,
  clientKey = '',
  clientRaw = '',
  importerKey = '',
  vesselKey = '',
  agentKey = '',
  goodsKey = '',
  portKey = '',
  statusCategory = 'em_andamento',
  responsible = 'indefinido',
  customsChannel = 'nenhum',
  importerOutsideRj = null,
}: Fields): Process {
  const row = nextRow++
  return {
    sourceRow: row,
    ref: `FT${String(row).padStart(3, '0')}.26`,
    clientRaw,
    importerRaw: '',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: eta2 === null ? null : civil(eta2),
    registrationDate: null,
    docsSentDate: null,
    clientKey,
    importerKey,
    agentKey,
    vesselKey,
    portKey,
    goodsKey,
    statusCategory,
    responsible,
    customsChannel,
    importerOutsideRj,
    styleKey: 'none',
    anomalies: [],
  }
}

const withFilters = (overrides: Partial<FilterSet>): FilterSet => ({
  ...emptyFilterSet(),
  ...overrides,
})

describe('applyFilters — combinacao entre parametros', () => {
  const acme = process({ clientKey: 'ACME LOG', statusCategory: 'em_andamento' })
  const acmeConcluido = process({ clientKey: 'ACME LOG', statusCategory: 'desembaracado' })
  const outro = process({ clientKey: 'YRD', statusCategory: 'em_andamento' })

  // E entre parametros distintos.
  it('exige que ambos os filtros sejam satisfeitos', () => {
    const resultado = applyFilters(
      [acme, acmeConcluido, outro],
      withFilters({ client: ['ACME LOG'], category: ['em_andamento'] }),
    )

    expect(resultado).toEqual([acme])
  })

  // OU dentro do mesmo parametro.
  it('aceita qualquer um dos valores do mesmo parametro', () => {
    const resultado = applyFilters([acme, outro], withFilters({ client: ['ACME LOG', 'YRD'] }))

    expect(resultado).toHaveLength(2)
  })

  it('devolve o conjunto completo sem filtro algum', () => {
    const conjunto = [acme, acmeConcluido, outro]

    expect(applyFilters(conjunto, emptyFilterSet())).toEqual(conjunto)
  })

  it('devolve vazio para valor inexistente, sem erro', () => {
    expect(applyFilters([acme, outro], withFilters({ client: ['NAO EXISTE'] }))).toEqual([])
  })

  it('devolve vazio para conjunto vazio', () => {
    expect(applyFilters([], withFilters({ client: ['ACME LOG'] }))).toEqual([])
  })
})

describe('applyFilters — responsavel inclui a subcategoria (A-18)', () => {
  const dele = process({ responsible: 'colaborador1' })
  const outrosClientes = process({ responsible: 'colaborador1_outros_clientes' })
  const doOutro = process({ responsible: 'colaborador2' })

  it('colaborador1 seleciona tambem colaborador1_outros_clientes', () => {
    const resultado = applyFilters(
      [dele, outrosClientes, doOutro],
      withFilters({ responsible: ['colaborador1'] }),
    )

    expect(resultado).toEqual([dele, outrosClientes])
  })

  // A inclusao e num sentido so: a subcategoria nao arrasta o pai.
  it('colaborador1_outros_clientes nao seleciona colaborador1', () => {
    const resultado = applyFilters(
      [dele, outrosClientes],
      withFilters({ responsible: ['colaborador1_outros_clientes'] }),
    )

    expect(resultado).toEqual([outrosClientes])
  })

  it('colaborador2 nao arrasta ninguem', () => {
    const resultado = applyFilters(
      [dele, outrosClientes, doOutro],
      withFilters({ responsible: ['colaborador2'] }),
    )

    expect(resultado).toEqual([doOutro])
  })
})

describe('applyFilters — periodo sobre ETA2', () => {
  const julho = process({ eta2: '2026-07-15' })
  const agosto = process({ eta2: '2026-08-15' })
  const semData = process({ eta2: null })

  it('inclui os extremos', () => {
    const resultado = applyFilters(
      [julho, agosto],
      withFilters({ etaFrom: civil('2026-07-15'), etaTo: civil('2026-08-15') }),
    )

    expect(resultado).toHaveLength(2)
  })

  it('aceita apenas o limite inferior', () => {
    expect(applyFilters([julho, agosto], withFilters({ etaFrom: civil('2026-08-01') }))).toEqual([
      agosto,
    ])
  })

  it('aceita apenas o limite superior', () => {
    expect(applyFilters([julho, agosto], withFilters({ etaTo: civil('2026-08-01') }))).toEqual([
      julho,
    ])
  })

  // Intervalo invertido nao contem nada. Nao e erro: e um conjunto vazio.
  it('devolve vazio quando etaFrom e posterior a etaTo', () => {
    const resultado = applyFilters(
      [julho, agosto],
      withFilters({ etaFrom: civil('2026-09-01'), etaTo: civil('2026-08-01') }),
    )

    expect(resultado).toEqual([])
  })

  // A-20: data ausente nao esta dentro nem fora, e incluir seria afirmar que esta.
  it('exclui processo sem eta2 quando ha limite', () => {
    expect(applyFilters([semData], withFilters({ etaFrom: civil('2026-01-01') }))).toEqual([])
    expect(applyFilters([semData], withFilters({ etaTo: civil('2099-01-01') }))).toEqual([])
  })

  it('inclui processo sem eta2 quando nao ha limite', () => {
    expect(applyFilters([semData], emptyFilterSet())).toEqual([semData])
  })
})

describe('applyFilters — importador fora do RJ', () => {
  const fora = process({ importerOutsideRj: true })
  const dentro = process({ importerOutsideRj: false })
  const indefinido = process({ importerOutsideRj: null })

  /**
   * `null` significa cor nao reconhecida. Nao saber onde o importador esta e
   * diferente de saber que ele esta no RJ — mesma regra da cor que nao vira
   * canal.
   */
  it('false inclui apenas false, nunca null', () => {
    expect(
      applyFilters([fora, dentro, indefinido], withFilters({ importerOutsideRj: false })),
    ).toEqual([dentro])
  })

  it('true inclui apenas true', () => {
    expect(
      applyFilters([fora, dentro, indefinido], withFilters({ importerOutsideRj: true })),
    ).toEqual([fora])
  })

  it('ausente inclui os tres', () => {
    const conjunto = [fora, dentro, indefinido]

    expect(applyFilters(conjunto, emptyFilterSet())).toHaveLength(3)
  })
})

describe('applyFilters — chave vazia e valor legitimo', () => {
  it('permite filtrar pelos processos sem cliente', () => {
    const semCliente = process({ clientKey: '' })
    const comCliente = process({ clientKey: 'ACME LOG' })

    expect(applyFilters([semCliente, comCliente], withFilters({ client: [''] }))).toEqual([
      semCliente,
    ])
  })
})

describe('parseFilters — dominios fechados', () => {
  it('fixa os dominios catalogados', () => {
    expect(STATUS_CATEGORIES).toHaveLength(4)
    expect(RESPONSIBLES).toEqual([
      'colaborador1',
      'colaborador2',
      'colaborador1_outros_clientes',
      'indefinido',
    ])
    expect(CUSTOMS_CHANNELS).toEqual(['vermelho', 'nenhum', 'indefinido'])
  })

  it('aceita valor dentro do dominio', () => {
    expect(parseFilters({ category: 'em_andamento' }).category).toEqual(['em_andamento'])
  })

  it('aceita lista repetida no mesmo parametro', () => {
    expect(parseFilters({ client: ['A', 'B'] }).client).toEqual(['A', 'B'])
  })

  it('recusa categoria fora do dominio', () => {
    expect(() => parseFilters({ category: 'inventada' })).toThrow(FilterParseError)
  })

  it('recusa canal fora do dominio', () => {
    expect(() => parseFilters({ channel: 'roxo' })).toThrow(FilterParseError)
  })

  it('recusa responsavel fora do dominio', () => {
    expect(() => parseFilters({ responsible: 'ninguem' })).toThrow(FilterParseError)
  })

  it('nomeia o campo e o valor recusados', () => {
    try {
      parseFilters({ channel: 'roxo' })
      expect.unreachable('deveria ter lancado')
    } catch (error) {
      expect(error).toBeInstanceOf(FilterParseError)
      expect((error as FilterParseError).field).toBe('channel')
      expect((error as FilterParseError).value).toBe('roxo')
    }
  })

  // Dominio aberto (A-36): a lista vem dos dados, nao de catalogo.
  it('aceita qualquer texto nos filtros de dominio aberto', () => {
    expect(() => parseFilters({ port: 'RO', client: 'QUALQUER COISA' })).not.toThrow()
  })
})

describe('parseFilters — datas e booleano', () => {
  it('converte AAAA-MM-DD em ancora UTC', () => {
    expect(parseFilters({ etaFrom: '2026-08-03' }).etaFrom?.getTime()).toBe(
      civil('2026-08-03').getTime(),
    )
  })

  it('recusa formato de data diferente', () => {
    expect(() => parseFilters({ etaFrom: '03/08/2026' })).toThrow(FilterParseError)
  })

  it('recusa data com formato valido mas inexistente', () => {
    expect(() => parseFilters({ etaTo: '2026-13-45' })).toThrow(FilterParseError)
  })

  it('converte true e false', () => {
    expect(parseFilters({ importerOutsideRj: 'true' }).importerOutsideRj).toBe(true)
    expect(parseFilters({ importerOutsideRj: 'false' }).importerOutsideRj).toBe(false)
  })

  it('recusa booleano em outra grafia', () => {
    expect(() => parseFilters({ importerOutsideRj: '1' })).toThrow(FilterParseError)
  })

  it('devolve o conjunto vazio para query sem parametro', () => {
    expect(parseFilters({})).toEqual(emptyFilterSet())
  })

  it('ignora parametro presente e vazio', () => {
    expect(parseFilters({ client: '', etaFrom: '' })).toEqual(emptyFilterSet())
  })
})

describe('optionsOf — dominio derivado dos dados (A-36)', () => {
  it('devolve as chaves distintas, ordenadas', () => {
    const conjunto = [
      process({ clientKey: 'YRD', clientRaw: 'Yrd' }),
      process({ clientKey: 'ACME LOG', clientRaw: 'Acme Log' }),
      process({ clientKey: 'YRD', clientRaw: 'YRD ' }),
    ]

    expect(
      optionsOf(
        conjunto,
        (p) => p.clientKey,
        (p) => p.clientRaw,
      ),
    ).toEqual([
      { key: 'ACME LOG', label: 'Acme Log', count: 1 },
      { key: 'YRD', label: 'Yrd', count: 2 },
    ])
  })

  // A-26: vale a primeira grafia encontrada, na ordem da planilha.
  it('mantem a primeira grafia, nao a ultima', () => {
    const conjunto = [
      process({ clientKey: 'ACME LOG', clientRaw: 'Acme Log' }),
      process({ clientKey: 'ACME LOG', clientRaw: 'ACME LOG' }),
    ]

    expect(
      optionsOf(
        conjunto,
        (p) => p.clientKey,
        (p) => p.clientRaw,
      )[0]?.label,
    ).toBe('Acme Log')
  })

  it('inclui a chave vazia, que e informacao sobre o preenchimento', () => {
    const conjunto = [process({ clientKey: '' }), process({ clientKey: 'ACME LOG' })]

    expect(
      optionsOf(
        conjunto,
        (p) => p.clientKey,
        (p) => p.clientRaw,
      ).map((o) => o.key),
    ).toEqual(['', 'ACME LOG'])
  })

  it('devolve lista vazia para conjunto vazio', () => {
    expect(
      optionsOf(
        [],
        (p) => p.clientKey,
        (p) => p.clientRaw,
      ),
    ).toEqual([])
  })
})
