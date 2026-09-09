import { describe, expect, it } from 'vitest'
import {
  type ClientGroup,
  type ClientMapEntry,
  clientKeys,
  clientNames,
  type PendingClientSource,
  planClientRule,
  planGroupRemoval,
  ruleReach,
} from '../../src/domain/client-mapper.ts'

/**
 * `H-88`. A coluna CLT com o dono de cada grafia, o alcance de uma regra
 * candidata, e o `match` do plano.
 *
 * Os numeros dos casos sao os medidos na planilha real em 08/09/2026: **509
 * grafias distintas**, das quais 111 sem cliente declarado, 140 processos,
 * **11 entradas de mapa** e um pai com tres filhos, mais 38 linhas sem CLT.
 */

function source(overrides: Partial<PendingClientSource> = {}): PendingClientSource {
  return {
    ref: 'FT501.26',
    clientProcessKey: 'AV-480',
    clientRaw: 'AV-480',
    importerKey: 'IMPORTADORA X',
    ...overrides,
  }
}

const MAPA: ClientMapEntry[] = [
  { key: 'ALFA', label: 'Alfa', rules: [{ match: 'exact', value: 'AV-480' }] },
]

describe('clientKeys', () => {
  /**
   * A lista traz TUDO desde 08/09/2026: trazer so o pendente tornava impossivel
   * agrupar `AV`, que ja e cliente e por isso sumia dela.
   */
  it('devolve toda a coluna, dizendo a quem cada grafia pertence', () => {
    const lista = clientKeys(
      [
        source({ ref: 'FT001.26', clientProcessKey: 'AV-480', clientRaw: 'AV-480' }),
        source({ ref: 'FT002.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
      ],
      MAPA,
    )

    expect(lista.map((item) => item.key)).toEqual(['AV-480', 'YT-769'])
    expect(lista[0]?.client).toEqual({ key: 'ALFA', label: 'Alfa' })
    expect(lista[1]?.client).toBeNull()
  })

  it('diz qual e o pai da grafia, quando o cliente dela esta num grupo', () => {
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'ALFA' }] },
    ]
    const lista = clientKeys(
      [source({ clientProcessKey: 'AV-480', clientRaw: 'AV-480' })],
      MAPA,
      grupos,
    )

    expect(lista[0]?.parent).toEqual({ key: 'VIVI-GRUPO', label: 'Vivi' })
  })

  it('grafia sem cliente nao tem pai', () => {
    const lista = clientKeys([source({ clientProcessKey: 'YT-769', clientRaw: 'YT-769' })], MAPA)

    expect(lista[0]?.client).toBeNull()
    expect(lista[0]?.parent).toBeNull()
  })

  /**
   * A heuristica da igualdade erra aqui: `planClientRule` usa `normKey(label)`
   * como chave da entrada, entao declarar `D2530` com o nome "D2530" produz uma
   * entrada cuja chave e igual a da celula. Ela ESTA declarada, e
   * `clientKey === clientProcessKey` a chamaria de livre.
   */
  it('nao trata como livre a grafia declarada cujo cliente tem o nome dela', () => {
    const mapa: ClientMapEntry[] = [
      { key: 'D2530', label: 'D2530', rules: [{ match: 'exact', value: 'D2530' }] },
    ]
    const lista = clientKeys([source({ clientProcessKey: 'D2530', clientRaw: 'D2530' })], mapa)

    expect(lista[0]?.client).toEqual({ key: 'D2530', label: 'D2530' })
  })

  it('ignora processo sem CLT: ausencia de dado nao e cliente por declarar', () => {
    const lista = clientKeys(
      [
        source({ ref: 'FT001.26', clientProcessKey: '', clientRaw: '' }),
        source({ ref: 'FT002.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
      ],
      MAPA,
    )

    expect(lista).toHaveLength(1)
    expect(lista[0]?.count).toBe(1)
  })

  it('conta os processos de cada grafia e guarda ate tres REF de exemplo', () => {
    const lista = clientKeys(
      ['FT001.26', 'FT002.26', 'FT003.26', 'FT004.26'].map((ref) =>
        source({ ref, clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
      ),
      [],
    )

    expect(lista[0]?.count).toBe(4)
    expect(lista[0]?.samples).toEqual(['FT001.26', 'FT002.26', 'FT003.26'])
  })

  /**
   * 83 das 111 grafias valem um processo cada: sem desempate a lista sai na
   * ordem de insercao, e muda quando alguem insere linha na planilha.
   */
  it('ordena por contagem desc e desempata pela chave, em ordem estavel', () => {
    const lista = clientKeys(
      [
        source({ ref: 'FT001.26', clientProcessKey: 'ZZZ', clientRaw: 'ZZZ' }),
        source({ ref: 'FT002.26', clientProcessKey: 'AAA', clientRaw: 'AAA' }),
        source({ ref: 'FT003.26', clientProcessKey: 'MMM', clientRaw: 'MMM' }),
        source({ ref: 'FT004.26', clientProcessKey: 'MMM', clientRaw: 'MMM' }),
      ],
      [],
    )

    expect(lista.map((item) => `${item.key}:${item.count}`)).toEqual(['MMM:2', 'AAA:1', 'ZZZ:1'])
  })

  /** `TD-04`: a chave e normalizada, a grafia e o que a planilha mostra. */
  it('devolve a grafia da celula como rotulo, e a chave normalizada como chave', () => {
    const lista = clientKeys(
      [source({ clientProcessKey: 'ACUCAR LTDA', clientRaw: 'Açúcar  Ltda' })],
      [],
    )

    expect(lista[0]?.key).toBe('ACUCAR LTDA')
    expect(lista[0]?.label).toBe('Açúcar  Ltda')
  })

  it('mapa vazio devolve todas as grafias, todas sem dono', () => {
    const lista = clientKeys(
      [
        source({ ref: 'FT001.26', clientProcessKey: 'AV-480', clientRaw: 'AV-480' }),
        source({ ref: 'FT002.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
      ],
      [],
    )

    expect(lista).toHaveLength(2)
    expect(lista.every((item) => item.client === null)).toBe(true)
  })
})

/**
 * `ruleReach` — o alcance de uma regra ANTES de ela ser gravada (`H-88`).
 *
 * O caso que a motiva esta nos dados do operador: `Y` e `YT` sao prefixos
 * distintos na planilha, e `Y` casa `YT-769`.
 */
describe('ruleReach', () => {
  const YT_DECLARADO: ClientMapEntry[] = [
    { key: 'BETA', label: 'Beta', rules: [{ match: 'prefix', value: 'YT' }] },
  ]

  const FROTA = [
    source({ ref: 'FT001.26', clientProcessKey: 'Y2601', clientRaw: 'Y2601' }),
    source({ ref: 'FT002.26', clientProcessKey: 'Y2602', clientRaw: 'Y2602' }),
    source({ ref: 'FT003.26', clientProcessKey: 'YT-769', clientRaw: 'YT-769' }),
    source({ ref: 'FT004.26', clientProcessKey: 'YT-777', clientRaw: 'YT-777' }),
    source({ ref: 'FT005.26', clientProcessKey: 'D2530', clientRaw: 'D2530' }),
  ]

  it('conta as grafias e os processos que o prefixo passaria a consolidar', () => {
    const alcance = ruleReach(FROTA, [], 'prefix', 'Y')

    expect(alcance.keys).toBe(4)
    expect(alcance.processes).toBe(4)
    expect(alcance.samples).toEqual(['Y2601', 'Y2602', 'YT-769'])
  })

  /**
   * `Y` casa `YT-769`, e `YT` ja tem dono: as duas grafias aparecem em
   * `alreadyMapped` e NAO entram na contagem, porque a regra nova entra no fim
   * do mapa e a primeira que casa vence.
   */
  it('separa o que a regra casa mas nao leva, por ja ter dono', () => {
    const alcance = ruleReach(FROTA, YT_DECLARADO, 'prefix', 'Y')

    expect(alcance.keys).toBe(2)
    expect(alcance.processes).toBe(2)
    expect(alcance.alreadyMapped.map((item) => `${item.key}→${item.label}`)).toEqual([
      'YT-769→Beta',
      'YT-777→Beta',
    ])
  })

  it('normaliza o valor digitado antes de comparar', () => {
    expect(ruleReach(FROTA, [], 'prefix', ' y ').keys).toBe(4)
  })

  /** Valor vazio casaria tudo como prefixo: devolve zero em vez de um alcance
      que a gravacao recusaria de qualquer forma. */
  it('valor vazio nao alcanca nada', () => {
    const alcance = ruleReach(FROTA, [], 'prefix', '   ')

    expect(alcance).toMatchObject({ keys: 0, processes: 0, samples: [], alreadyMapped: [] })
  })

  it('conta processos, e nao grafias, quando a mesma grafia se repete', () => {
    const alcance = ruleReach(
      [
        source({ ref: 'FT001.26', clientProcessKey: 'D2530', clientRaw: 'D2530' }),
        source({ ref: 'FT002.26', clientProcessKey: 'D2530', clientRaw: 'D2530' }),
        source({ ref: 'FT003.26', clientProcessKey: 'D2531', clientRaw: 'D2531' }),
      ],
      [],
      'prefix',
      'D',
    )

    expect(alcance.keys).toBe(2)
    expect(alcance.processes).toBe(3)
  })

  it('ignora processo sem CLT', () => {
    expect(
      ruleReach([source({ clientProcessKey: '', clientRaw: '' })], [], 'prefix', 'D').keys,
    ).toBe(0)
  })
})

/**
 * O `match` do plano (`H-88`). A assimetria e deliberada: `exact` disputa lugar
 * e regra abrangente nao.
 */
describe('planClientRule com match', () => {
  const PREFIXO_DECLARADO: ClientMapEntry[] = [
    { key: 'BETA', label: 'Beta', rules: [{ match: 'prefix', value: 'YT' }] },
  ]

  it('grava o match escolhido no plano', () => {
    const plano = planClientRule('D', '', 'Cliente', [], 'prefix')

    expect(plano).toMatchObject({ kind: 'entrada-nova', match: 'prefix', value: 'D' })
  })

  it('exact continua sendo `exact` sem o parametro', () => {
    expect(planClientRule('D2530', '', 'Cliente', [])).toMatchObject({ match: 'exact' })
  })

  /**
   * A grafia ja resolve para "Beta" pelo prefixo `YT`. Declarar a celula
   * especifica para outro cliente precisa VENCER, senao a edicao vira no-op
   * silencioso (regra inviolavel 2).
   */
  it('exact disputa lugar com a entrada que ja casa', () => {
    const plano = planClientRule('YT-769', '', 'Gama', PREFIXO_DECLARADO, 'exact')

    expect(plano).toMatchObject({ kind: 'entrada-nova', beforeKey: 'BETA' })
  })

  /**
   * O oposto: um prefixo movido para a frente roubaria em silencio as grafias
   * que a entrada anterior ja consolida. Ele entra no FIM.
   */
  it('prefix NAO disputa lugar, e nao rouba o que ja tem dono', () => {
    const plano = planClientRule('Y', '', 'Gama', PREFIXO_DECLARADO, 'prefix')

    expect(plano).toMatchObject({ kind: 'entrada-nova', match: 'prefix', beforeKey: null })
  })

  /**
   * **A chave normaliza; o rotulo preserva a grafia digitada.**
   *
   * Ate 09/09/2026 os dois saiam de `normKey`, e quem digitava "Kelly" no valor
   * via "KELLY" declarado — medido no mapa real, onde a entrada trocou de
   * `label: 'Kelly'` para `label: 'KELLY'` ao ser redeclarada.
   */
  it('o filho leva a grafia digitada por rotulo, e a chave normalizada por chave', () => {
    const grupos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }] },
    ]

    expect(planClientRule('Kelly', '', 'Vivi', [], 'contains', grupos)).toMatchObject({
      child: { key: 'KELLY', label: 'Kelly' },
      value: 'KELLY',
    })
  })

  it('apara o espaco da grafia sem mudar a caixa', () => {
    expect(planClientRule('  Dahao Pesca  ', '', 'Novo', [], 'prefix')).toMatchObject({
      value: 'DAHAO PESCA',
    })
  })

  it('recusa rotulo vazio e valor vazio, como antes', () => {
    expect(planClientRule('D', '', '  ', [], 'prefix')).toBe('ROTULO_VAZIO')
    expect(planClientRule('', '', 'Cliente', [], 'prefix')).toBe('CELULA_VAZIA')
  })
})

/**
 * `clientNames` — os nomes que o campo de declaracao oferece (`H-88`).
 *
 * Existe por um defeito observado em 08/09/2026: declarando "Vivi" a mao, o
 * operador criou um cliente `VIVI` ao lado do pai `Vivi` que ja existia, e o
 * ranking passou a mostrar 326 e 58 como clientes diferentes.
 */
describe('clientNames', () => {
  const MAPA_COM_FILHOS: ClientMapEntry[] = [
    { key: 'AV', label: 'AV', rules: [{ match: 'prefix', value: 'AV' }] },
    { key: 'CHUN', label: 'Chun', rules: [{ match: 'prefix', value: 'CHUN' }] },
    { key: 'DENNIS', label: 'Dennis', rules: [{ match: 'contains', value: 'DENNIS' }] },
  ]
  const GRUPOS: ClientGroup[] = [
    { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }, { client: 'CHUN' }] },
  ]

  it('oferece os pais e os clientes soltos, em ordem alfabetica', () => {
    expect(clientNames(MAPA_COM_FILHOS, GRUPOS)).toEqual([
      { key: 'DENNIS', label: 'Dennis', isParent: false, children: 0 },
      // O NUMERO, e nao a palavra "agrupa": a tela mostra "Vivi · 2 clientes".
      { key: 'VIVI-GRUPO', label: 'Vivi', isParent: true, children: 2 },
    ])
  })

  /**
   * O filho nao se oferece: quem recebe conjunto e o PAI. Oferece-lo faria o
   * operador acrescentar regra a um membro sem perceber que a barra do grafico
   * e a do pai.
   */
  it('nao oferece quem ja e filho de um pai', () => {
    const nomes = clientNames(MAPA_COM_FILHOS, GRUPOS).map((item) => item.key)

    expect(nomes).not.toContain('AV')
    expect(nomes).not.toContain('CHUN')
  })

  it('sem grupo nenhum, oferece todos os clientes', () => {
    expect(clientNames(MAPA_COM_FILHOS, []).map((item) => item.label)).toEqual([
      'AV',
      'Chun',
      'Dennis',
    ])
  })
})

/**
 * `planGroupRemoval` — o desfazer (`H-88`, determinacao 9).
 *
 * **Desagrupar e desdeclarar sao uma operacao so** desde 08/09/2026: os botoes
 * tiram do pai E apagam a regra, por escolha do usuario.
 */
describe('planGroupRemoval', () => {
  const GRUPO: ClientGroup[] = [
    {
      key: 'VIVI-GRUPO',
      label: 'Vivi',
      members: [{ client: 'AV' }, { client: 'CHUN' }, { client: 'KELLY' }],
    },
  ]

  it('tira o filho e manda apagar a declaracao dele', () => {
    expect(planGroupRemoval('VIVI-GRUPO', 'KELLY', GRUPO)).toEqual({
      kind: 'membro-removido',
      key: 'VIVI-GRUPO',
      client: 'KELLY',
      dissolves: false,
      removes: ['KELLY'],
    })
  })

  it('desfaz o pai e manda apagar TODAS as declaracoes dele', () => {
    expect(planGroupRemoval('VIVI-GRUPO', null, GRUPO)).toEqual({
      kind: 'grupo-desfeito',
      key: 'VIVI-GRUPO',
      dissolves: true,
      removes: ['AV', 'CHUN', 'KELLY'],
    })
  })

  /**
   * Arvore de um galho e ruido. O filho que SOBRA nao e apagado: ele nao foi
   * pedido, e some do grupo por consequencia.
   */
  it('dissolve o pai ao tirar o penultimo, sem apagar quem sobra', () => {
    const doisFilhos: ClientGroup[] = [
      { key: 'VIVI-GRUPO', label: 'Vivi', members: [{ client: 'AV' }, { client: 'CHUN' }] },
    ]

    expect(planGroupRemoval('VIVI-GRUPO', 'CHUN', doisFilhos)).toEqual({
      kind: 'membro-removido',
      key: 'VIVI-GRUPO',
      client: 'CHUN',
      dissolves: true,
      removes: ['CHUN'],
    })
  })

  it('recusa agrupamento e membro que nao existem', () => {
    expect(planGroupRemoval('NAO-EXISTE', null, GRUPO)).toBe('GRUPO_INEXISTENTE')
    expect(planGroupRemoval('VIVI-GRUPO', 'NAO-EXISTE', GRUPO)).toBe('MEMBRO_INEXISTENTE')
  })

  it('normaliza as chaves recebidas', () => {
    expect(planGroupRemoval(' vivi-grupo ', ' kelly ', GRUPO)).toMatchObject({
      kind: 'membro-removido',
      client: 'KELLY',
    })
  })
})
