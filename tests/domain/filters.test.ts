import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  COLOR_RESPONSIBLES,
  CUSTOMS_CHANNELS,
  emptyFilterSet,
  FilterParseError,
  type FilterSet,
  hasAnyFilter,
  optionsOf,
  parseFilters,
  STATUS_CATEGORIES,
} from '../../src/domain/filters.ts'
import type {
  ColorResponsible,
  CustomsChannel,
  Process,
  StatusCategory,
} from '../../src/domain/types.ts'

const civil = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

interface Fields {
  eta2?: string | null
  clientKey?: string
  clientProcessKey?: string
  clientGroupKey?: string
  clientRaw?: string
  importerKey?: string
  vesselKey?: string
  agentKey?: string
  goodsKey?: string
  portKey?: string
  statusCategory?: StatusCategory
  responsible?: string
  responsibleLabel?: string
  colorResponsible?: ColorResponsible
  customsChannel?: CustomsChannel
  importerOutsideRj?: boolean | null
}

let nextRow = 2

function process({
  eta2 = null,
  clientKey = '',
  clientProcessKey = clientKey,
  clientGroupKey = '',
  clientRaw = '',
  importerKey = '',
  vesselKey = '',
  agentKey = '',
  goodsKey = '',
  portKey = '',
  statusCategory = 'em_andamento',
  responsible = 'indefinido',
  responsibleLabel = 'Indefinido',
  colorResponsible = 'indefinido',
  customsChannel = 'indefinido',
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
    clientProcessKey,
    clientLabel: clientRaw,
    clientGroupKey,
    importerKey,
    agentKey,
    vesselKey,
    portKey,
    goodsKey,
    statusCategory,
    responsible,
    responsibleLabel,
    colorResponsible,
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
  const outro = process({ clientKey: 'BETA', statusCategory: 'em_andamento' })

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
    const resultado = applyFilters([acme, outro], withFilters({ client: ['ACME LOG', 'BETA'] }))

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

// A regra migrou COM O CAMPO em `H-50`: ela sempre foi sobre a cor — dois tons
// que o operador pinta para a mesma pessoa.
describe('applyFilters — a cor do responsavel inclui a subcategoria (A-18)', () => {
  const dele = process({ colorResponsible: 'colaborador1' })
  const outrosClientes = process({ colorResponsible: 'colaborador1_outros_clientes' })
  const doOutro = process({ colorResponsible: 'colaborador2' })

  it('colaborador1 seleciona tambem colaborador1_outros_clientes', () => {
    const resultado = applyFilters(
      [dele, outrosClientes, doOutro],
      withFilters({ colorResponsible: ['colaborador1'] }),
    )

    expect(resultado).toEqual([dele, outrosClientes])
  })

  // A inclusao e num sentido so: a subcategoria nao arrasta o pai.
  it('colaborador1_outros_clientes nao seleciona colaborador1', () => {
    const resultado = applyFilters(
      [dele, outrosClientes],
      withFilters({ colorResponsible: ['colaborador1_outros_clientes'] }),
    )

    expect(resultado).toEqual([outrosClientes])
  })

  it('colaborador2 nao arrasta ninguem', () => {
    const resultado = applyFilters(
      [dele, outrosClientes, doOutro],
      withFilters({ colorResponsible: ['colaborador2'] }),
    )

    expect(resultado).toEqual([doOutro])
  })
})

// `H-50`. O filtro da pessoa e de dominio aberto e NAO agrega: as duas cores de
// A-18 ja resolveram para o mesmo membro antes de chegar aqui.
describe('applyFilters — responsavel e a pessoa, nao a cor', () => {
  const daPessoa = process({ responsible: 'membro1', colorResponsible: 'colaborador1' })
  const daOutra = process({ responsible: 'membro2', colorResponsible: 'colaborador2' })
  const semDono = process({ responsible: '', colorResponsible: 'indefinido' })

  it('recorta pela chave da pessoa', () => {
    expect(
      applyFilters([daPessoa, daOutra, semDono], withFilters({ responsible: ['membro1'] })),
    ).toEqual([daPessoa])
  })

  // Os 42 sem responsavel sao um recorte legitimo: chave vazia e valor de
  // dominio, e e o que torna o buraco investigavel.
  it('recorta os processos sem responsavel pela chave vazia', () => {
    expect(applyFilters([daPessoa, daOutra, semDono], withFilters({ responsible: [''] }))).toEqual([
      semDono,
    ])
  })

  // Os dois filtros sao independentes: E entre parametros distintos.
  it('combina com o filtro da cor sem que um implique o outro', () => {
    expect(
      applyFilters(
        [daPessoa, daOutra],
        withFilters({ responsible: ['membro1'], colorResponsible: ['colaborador2'] }),
      ),
    ).toEqual([])
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
    expect(COLOR_RESPONSIBLES).toEqual([
      'colaborador1',
      'colaborador2',
      'colaborador1_outros_clientes',
      'indefinido',
    ])
    expect(CUSTOMS_CHANNELS).toEqual(['verde', 'vermelho', 'indefinido'])
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

  it('recusa cor de responsavel fora do dominio', () => {
    expect(() => parseFilters({ colorResponsible: 'ninguem' })).toThrow(FilterParseError)
  })

  // `H-50` abriu o dominio de `responsible`: a chave vem do mapa de equipe, que
  // nao e versionado, entao nao ha catalogo contra o que validar (A-36).
  it('aceita qualquer chave de responsavel, inclusive a vazia', () => {
    expect(parseFilters({ responsible: 'membro9' }).responsible).toEqual(['membro9'])
    expect(parseFilters({ responsible: '' }).responsible).toEqual([''])
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

  // Onde a chave vazia nao existe como valor, parametro vazio e ausencia: nao
  // ha categoria em branco nem data em branco. Os dominios abertos fazem o
  // oposto, no bloco seguinte.
  it('ignora parametro presente e vazio onde a chave vazia nao e valor', () => {
    expect(parseFilters({ etaFrom: '', category: '', importerOutsideRj: '' })).toEqual(
      emptyFilterSet(),
    )
  })
})

/**
 * A chave vazia atravessa a query inteira, e nao so o `applyFilters`.
 *
 * `optionsOf` a oferece de proposito e `applyFilters` a casa desde `H-15`, mas
 * ate `H-18` ela morria no `parseFilters`: `?goods=` virava lista vazia, o
 * recorte nao recortava, e a tela exibia a base inteira como se fossem os
 * processos sem mercadoria. Medido na planilha real: 57 processos, o segundo
 * maior grupo. Nenhuma camada acusava — falha silenciosa, que e o que a regra
 * inviolavel 3 proibe.
 */
describe('parseFilters — chave vazia nos dominios abertos', () => {
  it('preserva a chave vazia nos seis filtros de dominio aberto', () => {
    const filters = parseFilters({
      client: '',
      importer: '',
      vessel: '',
      agent: '',
      goods: '',
      port: '',
    })

    expect(filters.client).toEqual([''])
    expect(filters.importer).toEqual([''])
    expect(filters.vessel).toEqual([''])
    expect(filters.agent).toEqual([''])
    expect(filters.goods).toEqual([''])
    expect(filters.port).toEqual([''])
  })

  it('distingue parametro ausente de parametro vazio', () => {
    expect(parseFilters({}).goods).toEqual([])
    expect(parseFilters({ goods: '' }).goods).toEqual([''])
  })

  it('mantem a chave vazia ao lado de uma preenchida, sem descartar nenhuma', () => {
    expect(parseFilters({ goods: ['', 'BAZAR'] }).goods).toEqual(['', 'BAZAR'])
  })

  it('recorta de fato o conjunto, que e o ponto de preservar a chave', () => {
    const semMercadoria = process({ goodsKey: '' })
    const comMercadoria = process({ goodsKey: 'BAZAR' })

    const recorte = applyFilters([semMercadoria, comMercadoria], parseFilters({ goods: '' }))

    expect(recorte).toEqual([semMercadoria])
  })
})

describe('optionsOf — dominio derivado dos dados (A-36)', () => {
  it('devolve as chaves distintas, ordenadas', () => {
    const conjunto = [
      process({ clientKey: 'BETA', clientRaw: 'Beta' }),
      process({ clientKey: 'ACME LOG', clientRaw: 'Acme Log' }),
      process({ clientKey: 'BETA', clientRaw: 'BETA ' }),
    ]

    expect(
      optionsOf(
        conjunto,
        (p) => p.clientKey,
        (p) => p.clientRaw,
      ),
    ).toEqual([
      { key: 'ACME LOG', label: 'Acme Log', count: 1 },
      { key: 'BETA', label: 'Beta', count: 2 },
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

/**
 * `H-49`. `client` recorta a carteira; `clientProcess` acha um processo
 * especifico pelo valor da celula CLT. Sao perguntas distintas, e por isso dois
 * parametros — o de hoje mudaria de resposta se acumulasse as duas.
 */
describe('applyFilters — cliente consolidado e processo do cliente', () => {
  const primeiro = process({ clientKey: 'ACME', clientProcessKey: 'ACM-29', clientRaw: 'ACM-29' })
  const segundo = process({ clientKey: 'ACME', clientProcessKey: 'ACM-30', clientRaw: 'ACM-30' })
  const outro = process({ clientKey: 'BETA', clientProcessKey: 'BET-01', clientRaw: 'BET-01' })
  const semCliente = process({ clientKey: '', clientProcessKey: '', clientRaw: '' })

  const conjunto = [primeiro, segundo, outro, semCliente]

  it('a chave consolidada recorta todos os processos do cliente', () => {
    expect(applyFilters(conjunto, withFilters({ client: ['ACME'] }))).toEqual([primeiro, segundo])
  })

  it('a chave da celula recorta um processo so', () => {
    expect(applyFilters(conjunto, withFilters({ clientProcess: ['ACM-29'] }))).toEqual([primeiro])
  })

  it('combina os dois em E, como qualquer par de parametros distintos', () => {
    expect(
      applyFilters(conjunto, withFilters({ client: ['ACME'], clientProcess: ['BET-01'] })),
    ).toEqual([])
  })

  it('a chave vazia e valor legitimo nos dois', () => {
    expect(applyFilters(conjunto, withFilters({ clientProcess: [''] }))).toEqual([semCliente])
  })
})

describe('parseFilters e hasAnyFilter — clientProcess', () => {
  it('aceita qualquer texto, como os demais de dominio aberto', () => {
    expect(parseFilters({ clientProcess: ['ACM-29', 'ACM-30'] }).clientProcess).toEqual([
      'ACM-29',
      'ACM-30',
    ])
  })

  // `?clientProcess=` e "processo do cliente em branco"; ausente nao filtra.
  it('preserva a chave vazia e distingue do parametro ausente', () => {
    expect(parseFilters({ clientProcess: '' }).clientProcess).toEqual([''])
    expect(parseFilters({}).clientProcess).toEqual([])
  })

  it('conta como filtro ativo', () => {
    expect(hasAnyFilter(parseFilters({ clientProcess: 'ACM-29' }))).toBe(true)
    expect(hasAnyFilter(parseFilters({}))).toBe(false)
  })
})

/**
 * `H-55`. O grupo recorta pelos membros; a chave do cliente nao muda, e por isso
 * os indicadores continuam contando cada um separado.
 */
describe('applyFilters — grupo de clientes', () => {
  const daMatriz = process({ clientKey: 'ACME', clientGroupKey: 'GRUPO-UM' })
  const daFilial = process({ clientKey: 'BETA', clientGroupKey: 'GRUPO-UM' })
  const deFora = process({ clientKey: 'ZETA', clientGroupKey: '' })

  const conjunto = [daMatriz, daFilial, deFora]

  it('o grupo recorta todos os membros de uma vez', () => {
    expect(applyFilters(conjunto, withFilters({ clientGroup: ['GRUPO-UM'] }))).toEqual([
      daMatriz,
      daFilial,
    ])
  })

  it('o membro continua recortavel sozinho, pelo filtro de cliente', () => {
    expect(applyFilters(conjunto, withFilters({ client: ['BETA'] }))).toEqual([daFilial])
  })

  // OU dentro do parametro, E entre parametros: grupo e membro juntos nao
  // duplicam processo nem se anulam.
  it('grupo e membro marcados juntos devolvem a intersecao, sem repetir', () => {
    expect(
      applyFilters(conjunto, withFilters({ clientGroup: ['GRUPO-UM'], client: ['ACME'] })),
    ).toEqual([daMatriz])
  })

  it('quem nao tem grupo casa a chave vazia', () => {
    expect(applyFilters(conjunto, withFilters({ clientGroup: [''] }))).toEqual([deFora])
  })

  it('conta como filtro ativo e sobrevive a query', () => {
    expect(parseFilters({ clientGroup: 'GRUPO-UM' }).clientGroup).toEqual(['GRUPO-UM'])
    expect(hasAnyFilter(parseFilters({ clientGroup: 'GRUPO-UM' }))).toBe(true)
  })
})
