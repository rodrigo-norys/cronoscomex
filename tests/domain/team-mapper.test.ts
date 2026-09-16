import { describe, expect, it } from 'vitest'
import {
  knownResponsibles,
  nextMemberKey,
  normalizeTeamMap,
  planTeamMember,
  planTeamRemoval,
  resolveTeam,
  type TeamMember,
  teamPlan,
} from '../../src/domain/team-mapper.ts'

/**
 * H-48. A atribuicao pura, sem I/O.
 *
 * A forma vem de `docs/uso/RESULTADO.md §3`: uma pessoa com lista de
 * importadores e a cor roxa, outra com lista e as cores azul e bege. Os nomes
 * sao ficticios — regra inviolavel 8.
 */

const map = normalizeTeamMap([
  {
    key: 'membro1',
    label: 'Primeiro',
    importers: ['importadora um', 'importadora dois'],
    colorResponsible: ['colaborador2'],
  },
  {
    key: 'membro2',
    label: 'Segundo',
    importers: ['importadora quatro'],
    colorResponsible: ['colaborador1', 'colaborador1_outros_clientes'],
  },
])

describe('resolveTeam', () => {
  it('atribui pelo importador, que e a primeira regra', () => {
    expect(resolveTeam('IMPORTADORA UM', 'indefinido', map)).toEqual({
      key: 'membro1',
      label: 'Primeiro',
      source: 'importador',
      conflict: false,
    })
  })

  it('tolera sufixo de filial sem exigir as duas grafias no mapa', () => {
    // Medido: tres importadores aparecem tambem com sufixo apos ` - `
    // (docs/uso/RESULTADO.md §3). Filial e o mesmo importador para responsavel.
    expect(resolveTeam('IMPORTADORA UM - SC', 'indefinido', map).key).toBe('membro1')
  })

  it('nao casa importador diferente que apenas comeca igual', () => {
    // `SUR` e `SURLA` sao importadores distintos na planilha real: sem o
    // separador literal, um prefixo engoliria o outro.
    expect(resolveTeam('IMPORTADORA UMBRAL', 'indefinido', map).source).toBe('nenhum')
  })

  it('desempata pela cor quando a lista de importadores nao alcanca', () => {
    // Os 48 processos que o importador nao cobre e a cor cobre — o achado que
    // dispensou a escolha arbitraria (docs/uso/RESULTADO.md §3).
    expect(resolveTeam('IMPORTADORA SEM DONO', 'colaborador1', map)).toEqual({
      key: 'membro2',
      label: 'Segundo',
      source: 'cor',
      conflict: false,
    })
  })

  it('trata a subcategoria de A-18 como a cor principal no desempate', () => {
    expect(resolveTeam('', 'colaborador1_outros_clientes', map).key).toBe('membro2')
  })

  it('nao atribui quando nem o importador nem a cor apontam alguem', () => {
    // Os 42 que ficam sem responsavel, visiveis (regra inviolavel 3).
    expect(resolveTeam('IMPORTADORA SEM DONO', 'indefinido', map)).toEqual({
      key: '',
      label: '',
      source: 'nenhum',
      conflict: false,
    })
  })

  it('faz o importador vencer a cor e MARCA a divergencia', () => {
    // Medido: ZERO ocorrencias em 31/08/2026 — o campo existe para a primeira,
    // que ninguem veria acontecer.
    const resolucao = resolveTeam('IMPORTADORA UM', 'colaborador1', map)

    expect(resolucao.key).toBe('membro1')
    expect(resolucao.conflict).toBe(true)
  })

  it('nao marca divergencia quando importador e cor apontam a mesma pessoa', () => {
    expect(resolveTeam('IMPORTADORA UM', 'colaborador2', map).conflict).toBe(false)
  })

  // `D-23`: sem mapa nao ha membro em quem casar, e devolver `UNASSIGNED` nas
  // 649 linhas esvaziaria o campo justamente na primeira execucao do operador.
  it('devolve a propria chave de cor quando o mapa esta vazio', () => {
    expect(resolveTeam('IMPORTADORA UM', 'colaborador1', [])).toEqual({
      key: 'colaborador1',
      label: 'Colaborador 1',
      source: 'cor',
      conflict: false,
    })
  })

  it('devolve indefinido quando o mapa esta vazio e a cor nao diz responsavel', () => {
    expect(resolveTeam('QUALQUER', 'indefinido', []).key).toBe('indefinido')
  })
})

describe('resolveTeam com fallback', () => {
  const comFallback = normalizeTeamMap([
    {
      key: 'membro1',
      label: 'Primeiro',
      importers: ['importadora um'],
      colorResponsible: ['colaborador2'],
    },
    {
      key: 'membro2',
      label: 'Segundo',
      importers: [],
      colorResponsible: ['colaborador1'],
      fallback: true,
    },
  ] as TeamMember[])

  it('entrega ao fallback o importador que ninguem reivindica', () => {
    expect(resolveTeam('IMPORTADORA SEM DONO', 'indefinido', comFallback)).toEqual({
      key: 'membro2',
      label: 'Segundo',
      source: 'importador',
      conflict: false,
    })
  })

  it('nao deixa o fallback alcancar o importador VAZIO', () => {
    // "Todo o resto" fala de importadores que existem. As 35 linhas em branco
    // nao sao o resto de nada, e varre-las esconderia que o campo esta vazio
    // (regra inviolavel 2). Sem importador, so a cor decide.
    expect(resolveTeam('', 'indefinido', comFallback).source).toBe('nenhum')
    expect(resolveTeam('', 'colaborador1', comFallback).source).toBe('cor')
  })

  it('faz a lista explicita vencer o fallback', () => {
    expect(resolveTeam('IMPORTADORA UM', 'indefinido', comFallback).key).toBe('membro1')
  })
})

describe('normalizeTeamMap', () => {
  it('normaliza o importador e preserva o rotulo com acento', () => {
    const [membro] = normalizeTeamMap([
      {
        key: 'membro1',
        label: 'Antônio',
        importers: [' importadora  úm '],
        colorResponsible: [],
        fallback: true,
      },
    ]) as [TeamMember]

    expect(membro.importers).toEqual(['IMPORTADORA UM'])
    expect(membro.label).toBe('Antônio')
    expect(membro.fallback).toBe(true)
  })
})

/**
 * `H-50`. As chaves que o ranking e a rota de opcoes exibem, incluindo as
 * zeradas — A-28.
 */
describe('knownResponsibles', () => {
  it('sem mapa, o dominio e o das quatro cores (D-23)', () => {
    expect(knownResponsibles([])).toEqual([
      { key: 'colaborador1', label: 'Colaborador 1' },
      { key: 'colaborador2', label: 'Colaborador 2' },
      { key: 'colaborador1_outros_clientes', label: 'Colaborador 1 — outros clientes' },
      { key: 'indefinido', label: 'Indefinido' },
    ])
  })

  it('com mapa, sao os membros mais a chave sem responsavel', () => {
    expect(knownResponsibles(map)).toEqual([
      { key: 'membro1', label: 'Primeiro' },
      { key: 'membro2', label: 'Segundo' },
      { key: '', label: 'Sem responsável' },
    ])
  })

  // O caso-limite de `H-50`: a pessoa existe no mapa do operador mesmo sem
  // processo algum, e o ranking a exibe com zero.
  it('inclui o membro que nenhuma regra alcanca', () => {
    const semRegraAlcancavel = normalizeTeamMap([
      { key: 'membro9', label: 'Nono', importers: ['importadora nove'], colorResponsible: [] },
    ])

    expect(knownResponsibles(semRegraAlcancavel).map((o) => o.key)).toContain('membro9')
  })
})

/**
 * `H-91`. A chave IMPESSOAL do proximo responsavel.
 *
 * Ela existe porque a alternativa — deriva-la do nome digitado, como `H-88` faz
 * com o cliente — levaria o nome da pessoa para o dominio, para o ranking de
 * IND-20 e para o parametro de URL do filtro Responsavel (regra inviolavel 8).
 */
describe('nextMemberKey', () => {
  it('comeca em membro1 quando nao ha equipe', () => {
    expect(nextMemberKey([])).toBe('membro1')
  })

  it('segue a partir do maior ordinal em uso', () => {
    expect(nextMemberKey(map)).toBe('membro3')
  })

  it('devolve o primeiro ordinal LIVRE, e nao o seguinte', () => {
    // Desfazer o membro2 de uma equipe de tres devolve a chave a quem entrar
    // depois, em vez de abrir buraco e crescer para sempre.
    const comBuraco = normalizeTeamMap([
      { key: 'membro1', label: 'Primeiro', importers: [], colorResponsible: [] },
      { key: 'membro3', label: 'Terceiro', importers: [], colorResponsible: [] },
    ])

    expect(nextMemberKey(comBuraco)).toBe('membro2')
  })

  it('nao colide com chave escrita a mao em outra caixa', () => {
    // A chave nao passa por `normalizeTeamMap` — so os importadores passam —,
    // entao um arquivo editado a mao pode trazer `MEMBRO1`.
    const aMao = normalizeTeamMap([
      { key: 'MEMBRO1', label: 'Primeiro', importers: [], colorResponsible: [] },
    ])

    expect(nextMemberKey(aMao)).toBe('membro2')
  })

  it('ignora chave que nao e um ordinal', () => {
    const livre = normalizeTeamMap([
      { key: 'coordenacao', label: 'Coordenacao', importers: [], colorResponsible: [] },
    ])

    expect(nextMemberKey(livre)).toBe('membro1')
  })
})

/**
 * `H-91`. O estado do mapa para o painel: carteiras, sem dono, e o proximo.
 */
describe('teamPlan', () => {
  const processos = [
    { importerKey: 'IMPORTADORA UM', responsible: 'membro1' },
    { importerKey: 'IMPORTADORA UM', responsible: 'membro1' },
    { importerKey: 'IMPORTADORA QUATRO', responsible: 'membro2' },
    { importerKey: 'MPA', responsible: '' },
    { importerKey: 'MPA', responsible: '' },
    { importerKey: 'SURLA', responsible: '' },
    { importerKey: '', responsible: '' },
  ]

  it('conta os processos de cada pessoa, na ordem do ARQUIVO', () => {
    // A ordem e a da equipe do operador: reordenar por contagem faria o botao
    // de desfazer mudar de lugar entre uma conferida e outra.
    expect(teamPlan(processos, map).members).toEqual([
      {
        key: 'membro1',
        label: 'Primeiro',
        importers: ['IMPORTADORA UM', 'IMPORTADORA DOIS'],
        count: 2,
      },
      { key: 'membro2', label: 'Segundo', importers: ['IMPORTADORA QUATRO'], count: 1 },
    ])
  })

  it('lista os sem dono por contagem desc, desempatando pela chave', () => {
    // Sem o desempate a lista sairia na ordem de insercao, que muda quando
    // alguem insere linha na planilha.
    expect(teamPlan(processos, map).unassigned).toEqual([
      { key: 'MPA', count: 2 },
      { key: 'SURLA', count: 1 },
    ])
  })

  it('conta o importador em BRANCO e nao o oferece', () => {
    // 35 linhas na planilha real, medidas em 10/09/2026: nenhuma carteira as
    // alcanca por construcao, e some-las seria descarte silencioso (regra 2).
    const plano = teamPlan(processos, map)

    expect(plano.blankImporters).toBe(1)
    expect(plano.unassigned.map((item) => item.key)).not.toContain('')
  })

  it('nao trata filial como importador sem dono', () => {
    // A carteira lista `IMPORTADORA UM`; a filial casa por sufixo, e exigir as
    // duas grafias faria uma filial nova virar processo sem dono, em silencio.
    const plano = teamPlan([{ importerKey: 'IMPORTADORA UM - SC', responsible: 'membro1' }], map)

    expect(plano.unassigned).toEqual([])
  })

  it('devolve a chave do proximo responsavel junto', () => {
    expect(teamPlan(processos, map).nextKey).toBe('membro3')
  })

  it('sem equipe, todo importador preenchido aparece sem dono', () => {
    const plano = teamPlan(processos, [])

    expect(plano.members).toEqual([])
    expect(plano.unassigned.map((item) => item.key)).toEqual([
      'IMPORTADORA UM',
      'MPA',
      'IMPORTADORA QUATRO',
      'SURLA',
    ])
  })
})

/**
 * `H-91`. Criar e redefinir um responsavel.
 */
describe('planTeamMember', () => {
  it('cria quando a chave ainda nao existe', () => {
    expect(planTeamMember('membro3', 'Terceiro', ['mpa'], map)).toEqual({
      kind: 'membro-criado',
      key: 'membro3',
      label: 'Terceiro',
      importers: ['MPA'],
    })
  })

  it('redefine quando ela existe, e a carteira vai INTEIRA', () => {
    const plano = planTeamMember('membro2', 'Segundo', ['importadora quatro', 'mpa'], map)

    expect(plano).toEqual({
      kind: 'membro-redefinido',
      key: 'membro2',
      label: 'Segundo',
      importers: ['IMPORTADORA QUATRO', 'MPA'],
    })
  })

  it('aceita carteira VAZIA', () => {
    // Alguem entrou na equipe e ainda nao recebeu importador. Ate `H-91` a
    // carga recusava esse membro e matava a partida.
    expect(planTeamMember('membro3', 'Terceiro', [], map)).toEqual({
      kind: 'membro-criado',
      key: 'membro3',
      label: 'Terceiro',
      importers: [],
    })
  })

  it('normaliza e desduplica os importadores', () => {
    const plano = planTeamMember('membro3', 'Terceiro', [' mpa ', 'MPA'], map)

    expect(plano).toMatchObject({ importers: ['MPA'] })
  })

  it('recusa rotulo vazio', () => {
    expect(planTeamMember('membro3', '   ', ['mpa'], map)).toEqual({ code: 'ROTULO_VAZIO' })
  })

  it('recusa chave vazia', () => {
    expect(planTeamMember('  ', 'Terceiro', [], map)).toEqual({ code: 'CHAVE_VAZIA' })
  })

  it('recusa importador em branco, apontando o indice', () => {
    expect(planTeamMember('membro3', 'Terceiro', ['mpa', '  '], map)).toEqual({
      code: 'IMPORTADOR_VAZIO',
      at: 1,
    })
  })

  it('recusa importador que ja esta em outra carteira, NOMEANDO o dono', () => {
    // IND-20 conta por pessoa, e a soma deixaria de fechar. Quem corrige e o
    // operador, e ele precisa saber qual carteira abrir.
    expect(planTeamMember('membro3', 'Terceiro', ['importadora um'], map)).toEqual({
      code: 'IMPORTADOR_EM_DUAS_CARTEIRAS',
      importer: 'IMPORTADORA UM',
      owner: 'membro1',
      ownerLabel: 'Primeiro',
    })
  })

  it('recusa a FILIAL de um importador que outro ja tem', () => {
    expect(planTeamMember('membro3', 'Terceiro', ['importadora um - sc'], map)).toMatchObject({
      code: 'IMPORTADOR_EM_DUAS_CARTEIRAS',
      owner: 'membro1',
    })
  })

  it('recusa a MATRIZ quando o outro tem a filial', () => {
    // A sobreposicao e simetrica: qual grafia foi digitada primeiro nao muda
    // que as duas sao o mesmo importador para efeito de responsavel.
    const comFilial = normalizeTeamMap([
      { key: 'membro1', label: 'Primeiro', importers: ['acme - sc'], colorResponsible: [] },
    ])

    expect(planTeamMember('membro2', 'Segundo', ['acme'], comFilial)).toMatchObject({
      code: 'IMPORTADOR_EM_DUAS_CARTEIRAS',
      owner: 'membro1',
    })
  })

  it('nao acusa sobreposicao do membro CONSIGO MESMO', () => {
    // Redefinir mantendo a carteira e a operacao mais comum do painel.
    expect(planTeamMember('membro1', 'Primeiro', ['importadora um'], map)).toMatchObject({
      kind: 'membro-redefinido',
    })
  })

  it('nao confunde importador que apenas comeca igual', () => {
    // `SUR` e `SURLA` sao importadores distintos na planilha real.
    const comSur = normalizeTeamMap([
      { key: 'membro1', label: 'Primeiro', importers: ['sur'], colorResponsible: [] },
    ])

    expect(planTeamMember('membro2', 'Segundo', ['surla'], comSur)).toMatchObject({
      kind: 'membro-criado',
    })
  })
})

/**
 * `H-91`. Desfazer, e tirar um importador da carteira.
 */
describe('planTeamRemoval', () => {
  it('desfaz o responsavel e devolve a carteira inteira', () => {
    expect(planTeamRemoval('membro1', null, map)).toEqual({
      kind: 'membro-desfeito',
      key: 'membro1',
      importer: null,
      releases: ['IMPORTADORA UM', 'IMPORTADORA DOIS'],
    })
  })

  it('tira SO o importador pedido', () => {
    expect(planTeamRemoval('membro1', 'importadora um', map)).toEqual({
      kind: 'importador-removido',
      key: 'membro1',
      importer: 'IMPORTADORA UM',
      releases: ['IMPORTADORA UM'],
    })
  })

  it('recusa responsavel inexistente', () => {
    expect(planTeamRemoval('membro9', null, map)).toEqual({ code: 'MEMBRO_INEXISTENTE' })
  })

  it('recusa importador que nao esta naquela carteira', () => {
    expect(planTeamRemoval('membro1', 'mpa', map)).toEqual({ code: 'IMPORTADOR_INEXISTENTE' })
  })
})
