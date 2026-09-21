import { describe, expect, it } from 'vitest'
import type { ClientFields } from '../../src/domain/client-mapper.ts'
import {
  type ClientGroup,
  type ClientMapEntry,
  clientKeys,
  indexClientGroups,
  normalizeClientGroups,
  normalizeClientMap,
  planClientRule,
  resolveClient,
  resolveClientGroup,
} from '../../src/domain/client-mapper.ts'

/**
 * H-48. A consolidacao pura, sem I/O.
 *
 * Os valores concretos vem da forma medida em `docs/uso/RESULTADO.md §2`, com
 * nomes trocados: prefixo com sufixo crescente, nome contido em texto maior, e
 * um prefixo que cobre mais de um cliente. Os nomes reais nao entram em arquivo
 * versionado (regra inviolavel 8).
 */

const map = normalizeClientMap([
  {
    key: 'gama',
    label: 'Gama Trading',
    rules: [{ match: 'prefix', value: 'g', importer: 'importadora um' }],
  },
  { key: 'delta', label: 'Delta', rules: [{ match: 'prefix', value: 'g' }] },
  { key: 'alfa', label: 'Alfa', rules: [{ match: 'prefix', value: 'alf' }] },
  { key: 'beta', label: 'Beta', rules: [{ match: 'contains', value: 'beta' }] },
  { key: 'eps', label: 'Épsilon', rules: [{ match: 'exact', value: 'eps' }] },
])

/**
 * Os tres campos que uma regra pode procurar (21/09/2026).
 *
 * Os testes deste arquivo exercem a coluna CLT e o qualificador por importador,
 * que existiam antes; `ref` entra vazia porque nenhuma regra deles a procura.
 */
function campos(clt: string, importer = '', ref = ''): ClientFields {
  return { clt, ref, importer }
}

describe('resolveClient', () => {
  it('consolida o sufixo crescente num cliente so — o defeito que a historia existe para fechar', () => {
    // Medido: 649 processos produzem 509 valores em CLT porque a celula guarda
    // o processo daquele cliente, nao o cliente (docs/uso/RESULTADO.md §2).
    const chaves = ['ALFA-29', 'ALFA-30', 'ALFA-42'].map(
      (celula) => resolveClient(campos(celula, 'QUALQUER'), map).key,
    )

    expect(new Set(chaves)).toEqual(new Set(['ALFA']))
  })

  it('casa por texto contido, nao so por prefixo', () => {
    expect(resolveClient(campos('XYZ101 - BETA', ''), map)).toEqual({
      key: 'BETA',
      label: 'Beta',
      mapped: true,
    })
  })

  it('casa por igualdade exata sem alcancar o que apenas comeca igual', () => {
    expect(resolveClient(campos('EPS', ''), map).mapped).toBe(true)
    expect(resolveClient(campos('EPS2601', ''), map).mapped).toBe(false)
  })

  it('qualifica pelo importador quando um prefixo cobre mais de um cliente', () => {
    // O caso do prefixo de 62 processos que cobre TRES clientes, distinguiveis
    // so pelo importador (docs/uso/RESULTADO.md §2).
    expect(resolveClient(campos('G2530', 'IMPORTADORA UM'), map).key).toBe('GAMA')
    expect(resolveClient(campos('G2530', 'IMPORTADORA DOIS'), map).key).toBe('DELTA')
  })

  it('faz a PRIMEIRA regra que casa vencer, e nao exige correspondencia unica', () => {
    // `G2530` com importador UM casa as duas entradas; a ordem do arquivo e a
    // ferramenta de desempate do operador.
    expect(resolveClient(campos('G2530', 'IMPORTADORA UM'), map).key).toBe('GAMA')
  })

  it('devolve a chave da celula quando nenhuma regra casa, sem marcar mapeado', () => {
    // Nao consolidar e resultado legitimo: sao os 121 processos cujo cliente
    // ainda nao foi declarado (regra inviolavel 3).
    expect(resolveClient(campos('ZZ-901', ''), map)).toEqual({
      key: 'ZZ-901',
      label: 'ZZ-901',
      mapped: false,
    })
  })

  it('deixa a chave vazia vazia, sem casar regra alguma', () => {
    // Chave vazia e valor legitimo (TD-04) e continua filtravel.
    expect(resolveClient(campos('', 'IMPORTADORA UM'), map)).toEqual({
      key: '',
      label: '',
      mapped: false,
    })
  })

  it('nao consolida nada com mapa vazio', () => {
    expect(resolveClient(campos('ALFA-29'), []).key).toBe('ALFA-29')
  })
})

describe('normalizeClientMap', () => {
  it('normaliza chave, valor e importador, e PRESERVA o rotulo com acento', () => {
    const [entry] = normalizeClientMap([
      {
        key: ' épsilon ',
        label: 'Épsilon S/A',
        rules: [{ match: 'prefix', value: ' éps ', importer: ' importadora  um ' }],
      },
    ]) as [ClientMapEntry]

    expect(entry.key).toBe('EPSILON')
    // O rotulo e apresentacao: normaliza-lo mostraria EPSILON S/A na tela.
    expect(entry.label).toBe('Épsilon S/A')
    expect(entry.rules[0]?.value).toBe('EPS')
    expect(entry.rules[0]?.importer).toBe('IMPORTADORA UM')
  })

  it('omite o importador em vez de gravar undefined quando a regra nao o qualifica', () => {
    const [entry] = normalizeClientMap([
      { key: 'alfa', label: 'Alfa', rules: [{ match: 'prefix', value: 'alf' }] },
    ]) as [ClientMapEntry]

    expect(Object.hasOwn(entry.rules[0] ?? {}, 'importer')).toBe(false)
  })
})

/**
 * `H-55`. O grupo e um nivel de arvore do FILTRO: ele nao entra em `clientKey`,
 * e por isso nenhum indicador muda de valor ao ganhar um grupo.
 */
describe('grupos de clientes', () => {
  const grupos = normalizeClientGroups([
    {
      key: 'alfa-grupo',
      label: 'Alfa',
      members: [{ client: 'alfa', label: 'Alfa (matriz)' }, { client: 'beta' }],
    },
  ])

  it('normaliza a chave do grupo e a do membro, preservando o rotulo', () => {
    expect(grupos[0]?.key).toBe('ALFA-GRUPO')
    expect(grupos[0]?.label).toBe('Alfa')
    expect(grupos[0]?.members.map((membro) => membro.client)).toEqual(['ALFA', 'BETA'])
    expect(grupos[0]?.members[0]?.label).toBe('Alfa (matriz)')
  })

  it('indexa cada membro para o grupo dele', () => {
    const index = indexClientGroups(grupos)

    expect(resolveClientGroup('ALFA', index)).toBe('ALFA-GRUPO')
    expect(resolveClientGroup('BETA', index)).toBe('ALFA-GRUPO')
  })

  // Vazio e o caso comum: a maioria dos clientes nao pertence a grupo nenhum, e
  // `''` e chave legitima no filtro, como a celula em branco.
  it('devolve vazio para cliente fora de qualquer grupo', () => {
    expect(resolveClientGroup('GAMA', indexClientGroups(grupos))).toBe('')
    expect(resolveClientGroup('ALFA', indexClientGroups([]))).toBe('')
  })

  it('membro sem label fica sem label — quem resolve a exibicao e a rota', () => {
    expect(grupos[0]?.members[1]).not.toHaveProperty('label')
  })
})

/**
 * A volta do caminho (02/09/2026): declarar, a partir de uma linha da tela, a
 * que cliente a celula CLT pertence.
 *
 * O que estes casos protegem e a POSICAO da entrada. A primeira que casa vence,
 * entao uma regra acrescentada depois da entrada de prefixo que ja casa nunca
 * seria alcancada — a edicao viraria um no-op silencioso (regra inviolavel 2).
 */
describe('planClientRule', () => {
  it('recusa rotulo vazio e celula vazia, com motivos distintos', () => {
    expect(planClientRule('ALF-1', '', '   ', map)).toBe('ROTULO_VAZIO')
    expect(planClientRule('', '', 'Alfa', map)).toBe('CELULA_VAZIA')
  })

  it('nao faz nada quando a celula JA resolve para aquele cliente', () => {
    // `alf-1` casa o prefixo `alf` da entrada Alfa: declarar Alfa de novo nao
    // acrescenta regra nenhuma, e dizer isso e diferente de falhar.
    expect(planClientRule('ALF-1', '', 'Alfa', map)).toEqual({
      kind: 'sem-efeito',
      match: 'exact',

      field: 'clt',
      key: 'ALFA',
      label: 'Alfa',
      value: 'ALF-1',
      beforeKey: null,
    })
  })

  /**
   * A celula nao casa regra nenhuma: a entrada nova pode ir para o fim.
   *
   * **`grupo-criado`, e nao `entrada-nova`** (18/09/2026): a primeira
   * declaracao ja forma o pai, porque cliente solto deixou de ser estado
   * possivel. Sem `demoted` — nao ha cliente anterior a rebaixar.
   */
  it('cria o grupo no fim quando nada casava a celula', () => {
    expect(planClientRule('ZZZ-9', '', 'Zeta', map)).toEqual({
      kind: 'grupo-criado',
      match: 'exact',

      field: 'clt',
      key: 'ZETA',
      label: 'Zeta',
      value: 'ZZZ-9',
      beforeKey: null,
      child: { key: 'ZZZ-9', label: 'ZZZ-9' },
    })
  })

  /**
   * O caso que justifica `beforeKey`. `alf-1` casa Alfa por prefixo; declarar
   * outro cliente para essa linha exige que a entrada nova seja consultada
   * ANTES de Alfa, ou a regra `exact` nunca seria alcancada.
   */
  it('poe a entrada nova ANTES da que casa hoje', () => {
    expect(planClientRule('ALF-1', '', 'Zeta', map)).toEqual({
      kind: 'grupo-criado',
      match: 'exact',

      field: 'clt',
      key: 'ZETA',
      label: 'Zeta',
      value: 'ALF-1',
      beforeKey: 'ALFA',
      child: { key: 'ALF-1', label: 'ALF-1' },
    })
  })

  /**
   * **O SEGUNDO conjunto num nome faz nascer o pai** (`H-88`, determinação 8).
   *
   * Ate 08/09/2026 isto devolvia `regra-acrescentada`, somando a regra ao
   * cliente que ja existia. O usuario descreveu outro comportamento ao usar a
   * tela: para ele nao ha dois conceitos — ha um nome que recebe conjuntos, e o
   * pai e o que acontece no segundo. O cliente que existia vira filho, nomeado
   * pelo valor da PRIMEIRA regra dele.
   */
  it('faz nascer o pai quando o nome ja tem conjunto, com os dois por filhos', () => {
    expect(planClientRule('ALF-1', '', 'Gama Trading', map)).toEqual({
      kind: 'grupo-criado',
      match: 'exact',

      field: 'clt',
      key: 'GAMA',
      label: 'Gama Trading',
      value: 'ALF-1',
      beforeKey: null,
      child: { key: 'ALF-1', label: 'ALF-1' },
      demoted: { key: 'G', label: 'G' },
    })
  })

  it('o filho herdado leva o valor da primeira regra, e nao o rotulo do pai', () => {
    const plano = planClientRule('G1', 'IMPORTADORA UM', 'Épsilon', map)

    // "Épsilon > Épsilon" nao diria nada; "Épsilon > EPS" diz de onde veio.
    expect(plano).toMatchObject({ kind: 'grupo-criado', demoted: { key: 'EPS' } })
  })

  /**
   * O nome ja e um PAI: o conjunto entra como mais um filho, sem converter nada.
   * O pai vem antes do cliente na busca do alvo — com `Vivi` e `VIVI` existindo
   * ao mesmo tempo, que foi o defeito de 08/09/2026, quem recebe e o pai.
   */
  it('acrescenta o filho quando o nome ja e um pai', () => {
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }] },
    ]

    expect(planClientRule('YT', '', 'Vivi', map, 'contains', grupos)).toEqual({
      kind: 'membro-acrescentado',
      match: 'contains',

      field: 'clt',
      key: 'VIVI-GRUPO',
      label: 'Vivi',
      value: 'YT',
      beforeKey: null,
      child: { key: 'YT', label: 'YT' },
    })
  })

  /**
   * Pai dentro de pai nao existe no modelo: `ClientGroupIndex` e cliente → UM
   * grupo. Achado em 08/09/2026, simulando declaracoes contra o mapa real.
   */
  it('recusa declarar num nome que ja e filho de outro', () => {
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }] },
    ]

    expect(planClientRule('BUENO', '', 'AV', map, 'prefix', grupos)).toBe('NOME_E_FILHO')
  })

  it('nao repete o filho que o pai ja tem', () => {
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'YT' }] },
    ]

    expect(planClientRule('YT', '', 'Vivi', map, 'contains', grupos)).toMatchObject({
      kind: 'sem-efeito',
    })
  })

  /** O valor digitado entra normalizado: `yt` e `YT` sao a mesma regra, e
      grava-los diferente duplicaria a entrada na segunda declaracao. */
  it('normaliza o valor digitado', () => {
    expect(planClientRule('  yt  ', '', 'Novo', map, 'contains')).toMatchObject({
      value: 'YT',
    })
  })
})

/**
 * As tres colunas que uma regra pode procurar (21/09/2026).
 *
 * O pedido veio de procedimentos internos do operador: declarar cliente a
 * partir de REF ou de IMPORTADOR, e nao so da CLT. A regra de precedencia nao
 * mudou — a PRIMEIRA que casa vence —, e e ela que faz a linha ja tomada ficar
 * invisivel para as regras de baixo.
 */
describe('resolveClient com as tres colunas', () => {
  const porRef: ClientMapEntry[] = [
    { key: 'NORTE', label: 'Norte', rules: [{ match: 'prefix', value: 'FT05', field: 'ref' }] },
  ]
  const porImportador: ClientMapEntry[] = [
    {
      key: 'ALFA',
      label: 'Alfa',
      rules: [{ match: 'exact', value: 'ALFA SA', field: 'importer' }],
    },
  ]

  it('casa pela REF quando a regra declara o campo', () => {
    const r = resolveClient({ clt: 'QUALQUER', ref: 'FT051.26', importer: '' }, porRef)

    expect(r).toEqual({ key: 'NORTE', label: 'Norte', mapped: true })
  })

  it('casa pelo IMPORTADOR quando a regra declara o campo', () => {
    const r = resolveClient({ clt: '', ref: 'FT900.26', importer: 'ALFA SA' }, porImportador)

    expect(r).toEqual({ key: 'ALFA', label: 'Alfa', mapped: true })
  })

  /**
   * **CLT vazia deixou de significar "sem cliente"**, e esta e a mudanca de
   * comportamento que as tres colunas trazem: ate aqui `resolveClient` devolvia
   * "sem dono" antes de olhar o mapa, e um processo sem CLT nao podia ter
   * cliente nenhum.
   */
  it('um processo de CLT vazia tem dono quando outra coluna casa', () => {
    const r = resolveClient({ clt: '', ref: '', importer: 'ALFA SA' }, porImportador)

    expect(r.mapped).toBe(true)
  })

  it('a regra sem campo continua procurando na CLT', () => {
    const antiga: ClientMapEntry[] = [
      { key: 'BETA', label: 'Beta', rules: [{ match: 'prefix', value: 'BT' }] },
    ]

    expect(resolveClient(campos('BT-1', '', 'FT051.26'), antiga).mapped).toBe(true)
    // O mesmo texto na REF nao casa: a regra procura na CLT.
    expect(resolveClient(campos('OUTRO', '', 'BT-1'), antiga).mapped).toBe(false)
  })

  it('coluna vazia nunca casa, nem por prefixo', () => {
    const r = resolveClient({ clt: 'ALGO', ref: '', importer: '' }, porRef)

    expect(r.mapped).toBe(false)
  })

  /**
   * A regra de precedencia que o usuario pediu: a linha tomada pela primeira
   * regra nao e vista pela segunda, mesmo que a segunda case outra coluna.
   */
  it('a primeira regra que casa vence, mesmo entre colunas diferentes', () => {
    const map: ClientMapEntry[] = [
      {
        key: 'PRIMEIRO',
        label: 'Primeiro',
        rules: [{ match: 'prefix', value: 'FT05', field: 'ref' }],
      },
      {
        key: 'SEGUNDO',
        label: 'Segundo',
        rules: [{ match: 'exact', value: 'ALFA SA', field: 'importer' }],
      },
    ]
    const linha = { clt: '', ref: 'FT051.26', importer: 'ALFA SA' }

    expect(resolveClient(linha, map).key).toBe('PRIMEIRO')

    // Invertida a ordem do arquivo, o dono muda — e e o unico jeito de mudar.
    expect(resolveClient(linha, [...map].reverse()).key).toBe('SEGUNDO')
  })

  /**
   * O qualificador `importer` e a coluna `field: 'importer'` coexistem, por
   * decisao do usuario: o primeiro RESTRINGE uma regra de outra coluna, o
   * segundo faz do importador a coluna procurada.
   */
  it('o qualificador por importador continua restringindo, e nao vira coluna', () => {
    const map: ClientMapEntry[] = [
      {
        key: 'GAMA',
        label: 'Gama',
        rules: [{ match: 'prefix', value: 'G', importer: 'ALFA SA' }],
      },
    ]

    expect(resolveClient(campos('G2530', 'ALFA SA'), map).key).toBe('GAMA')
    // Mesmo prefixo, outro importador: a regra nao casa.
    expect(resolveClient(campos('G2530', 'OUTRA SA'), map).mapped).toBe(false)
    // E o texto do importador na CLT nao casa — a coluna procurada e a CLT.
    expect(resolveClient(campos('ALFA SA', 'ALFA SA'), map).mapped).toBe(false)
  })
})

/**
 * A lista "Por declarar" segue a COLUNA da aba (21/09/2026).
 *
 * Pedido do usuario: declarar por REF olhando uma lista de grafias de CLT
 * obrigaria a procurar na planilha o valor que se vai digitar.
 */
describe('clientKeys pela coluna escolhida', () => {
  const linhas = [
    { ref: 'FT001.26', clientProcessKey: 'ALFA-1', clientRaw: 'Alfa-1', importerKey: 'ACME' },
    { ref: 'FT002.26', clientProcessKey: 'ALFA-2', clientRaw: 'Alfa-2', importerKey: 'ACME' },
    { ref: 'FT003.26', clientProcessKey: '', clientRaw: '', importerKey: 'BETA SA' },
  ]

  it('agrupa por CLT quando a coluna e a padrao', () => {
    const lista = clientKeys(linhas, [])

    // A linha de CLT vazia nao entra: nao ha valor a declarar naquela coluna.
    expect(lista.map((item) => item.key)).toEqual(['ALFA-1', 'ALFA-2'])
  })

  it('agrupa por REF quando a coluna e REF', () => {
    const lista = clientKeys(linhas, [], [], 'ref')

    expect(lista.map((item) => item.key)).toEqual(['FT001.26', 'FT002.26', 'FT003.26'])
  })

  /** O importador junta as duas linhas da ACME numa entrada de contagem 2. */
  it('agrupa por IMPORTADOR quando a coluna e IMPORTADOR', () => {
    const lista = clientKeys(linhas, [], [], 'importer')

    expect(lista.map((item) => [item.key, item.count])).toEqual([
      ['ACME', 2],
      ['BETA SA', 1],
    ])
  })

  /**
   * A linha de CLT vazia SOME da lista de CLT e aparece na de importador — e o
   * que faz a lista por coluna valer a pena: ela mostra o que ha para declarar
   * naquela coluna, e nao o que falta em outra.
   */
  it('a linha sem CLT aparece nas outras colunas', () => {
    expect(clientKeys(linhas, []).some((i) => i.count === 1 && i.key === '')).toBe(false)
    expect(clientKeys(linhas, [], [], 'importer').map((i) => i.key)).toContain('BETA SA')
  })

  // Em REF e IMPORTADOR a chave normalizada ja e o que a celula diz.
  it('o rotulo e a propria chave fora da CLT', () => {
    const porRef = clientKeys(linhas, [], [], 'ref')

    expect(porRef[0]?.label).toBe('FT001.26')
  })

  /** O dono continua saindo de `resolveClient`, que olha as tres colunas. */
  it('marca como declarado o que uma regra de outra coluna ja tomou', () => {
    const map: ClientMapEntry[] = [
      { key: 'DONO', label: 'Dono', rules: [{ match: 'exact', value: 'ACME', field: 'importer' }] },
    ]
    const lista = clientKeys(linhas, map)

    expect(lista.every((item) => item.client?.key === 'DONO')).toBe(true)
  })
})
