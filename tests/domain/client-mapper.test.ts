import { describe, expect, it } from 'vitest'
import {
  type ClientMapEntry,
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

describe('resolveClient', () => {
  it('consolida o sufixo crescente num cliente so — o defeito que a historia existe para fechar', () => {
    // Medido: 649 processos produzem 509 valores em CLT porque a celula guarda
    // o processo daquele cliente, nao o cliente (docs/uso/RESULTADO.md §2).
    const chaves = ['ALFA-29', 'ALFA-30', 'ALFA-42'].map(
      (celula) => resolveClient(celula, 'QUALQUER', map).key,
    )

    expect(new Set(chaves)).toEqual(new Set(['ALFA']))
  })

  it('casa por texto contido, nao so por prefixo', () => {
    expect(resolveClient('XYZ101 - BETA', '', map)).toEqual({
      key: 'BETA',
      label: 'Beta',
      mapped: true,
    })
  })

  it('casa por igualdade exata sem alcancar o que apenas comeca igual', () => {
    expect(resolveClient('EPS', '', map).mapped).toBe(true)
    expect(resolveClient('EPS2601', '', map).mapped).toBe(false)
  })

  it('qualifica pelo importador quando um prefixo cobre mais de um cliente', () => {
    // O caso do prefixo de 62 processos que cobre TRES clientes, distinguiveis
    // so pelo importador (docs/uso/RESULTADO.md §2).
    expect(resolveClient('G2530', 'IMPORTADORA UM', map).key).toBe('GAMA')
    expect(resolveClient('G2530', 'IMPORTADORA DOIS', map).key).toBe('DELTA')
  })

  it('faz a PRIMEIRA regra que casa vencer, e nao exige correspondencia unica', () => {
    // `G2530` com importador UM casa as duas entradas; a ordem do arquivo e a
    // ferramenta de desempate do operador.
    expect(resolveClient('G2530', 'IMPORTADORA UM', map).key).toBe('GAMA')
  })

  it('devolve a chave da celula quando nenhuma regra casa, sem marcar mapeado', () => {
    // Nao consolidar e resultado legitimo: sao os 121 processos cujo cliente
    // ainda nao foi declarado (regra inviolavel 3).
    expect(resolveClient('ZZ-901', '', map)).toEqual({
      key: 'ZZ-901',
      label: 'ZZ-901',
      mapped: false,
    })
  })

  it('deixa a chave vazia vazia, sem casar regra alguma', () => {
    // Chave vazia e valor legitimo (TD-04) e continua filtravel.
    expect(resolveClient('', 'IMPORTADORA UM', map)).toEqual({
      key: '',
      label: '',
      mapped: false,
    })
  })

  it('nao consolida nada com mapa vazio', () => {
    expect(resolveClient('ALFA-29', '', []).key).toBe('ALFA-29')
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
      key: 'ALFA',
      label: 'Alfa',
      value: 'ALF-1',
      beforeKey: null,
    })
  })

  /** A celula nao casa regra nenhuma: a entrada nova pode ir para o fim. */
  it('cria a entrada no fim quando nada casava a celula', () => {
    expect(planClientRule('ZZZ-9', '', 'Zeta', map)).toEqual({
      kind: 'entrada-nova',
      key: 'ZETA',
      label: 'Zeta',
      value: 'ZZZ-9',
      beforeKey: null,
    })
  })

  /**
   * O caso que justifica `beforeKey`. `alf-1` casa Alfa por prefixo; declarar
   * outro cliente para essa linha exige que a entrada nova seja consultada
   * ANTES de Alfa, ou a regra `exact` nunca seria alcancada.
   */
  it('poe a entrada nova ANTES da que casa hoje', () => {
    expect(planClientRule('ALF-1', '', 'Zeta', map)).toEqual({
      kind: 'entrada-nova',
      key: 'ZETA',
      label: 'Zeta',
      value: 'ALF-1',
      beforeKey: 'ALFA',
    })
  })

  it('so acrescenta a regra quando a entrada alvo ja vem antes da que casa', () => {
    // `gama` e a primeira do mapa, e `ALF-1` casa `alfa`, que vem depois: a
    // regra nova ja vence onde a entrada esta. A entrada e achada pelo NOME
    // ("Gama Trading"), e a chave dela — `GAMA` — e o que a gravacao procura.
    expect(planClientRule('ALF-1', '', 'Gama Trading', map)).toEqual({
      kind: 'regra-acrescentada',
      key: 'GAMA',
      label: 'Gama Trading',
      value: 'ALF-1',
      beforeKey: null,
    })
  })

  it('manda mover a entrada alvo quando ela esta DEPOIS da que casa', () => {
    // `eps` e a ultima; `G1` casa `gama`, a primeira. Sem mover, a regra `exact`
    // acrescentada em `eps` ficaria atras e nunca seria alcancada.
    expect(planClientRule('G1', 'IMPORTADORA UM', 'Épsilon', map)).toEqual({
      kind: 'regra-acrescentada',
      key: 'EPS',
      label: 'Épsilon',
      value: 'G1',
      beforeKey: 'GAMA',
    })
  })
})
