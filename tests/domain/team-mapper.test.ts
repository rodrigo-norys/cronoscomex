import { describe, expect, it } from 'vitest'
import { normalizeTeamMap, resolveTeam, type TeamMember } from '../../src/domain/team-mapper.ts'

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

  it('cai na cor inteiramente quando o mapa esta vazio', () => {
    expect(resolveTeam('IMPORTADORA UM', 'colaborador1', []).source).toBe('nenhum')
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
