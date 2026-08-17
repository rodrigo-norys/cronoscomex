import { describe, expect, it } from 'vitest'
import {
  type ColorMapEntry,
  indexColorMap,
  representableTargets,
  resolveColor,
  resolveColorIndexed,
  resolveFillTarget,
} from '../../src/domain/color-mapper.ts'

/** As 9 entradas reais, medidas por H-01 sobre a aba 2026. */
const MAPA: ColorMapEntry[] = [
  {
    styleKey: 'argb:FF00FF00',
    fillId: 2,
    label: 'Verde (tom A)',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FF00FF0D',
    fillId: 12,
    label: 'Verde (tom B)',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FF5B9BD5',
    fillId: 8,
    label: 'Azul',
    responsible: 'colaborador1',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFA74F7B',
    fillId: 27,
    label: 'Roxo (tom A)',
    responsible: 'colaborador2',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFA64D79',
    fillId: 11,
    label: 'Roxo (tom B)',
    responsible: 'colaborador2',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
  {
    styleKey: 'argb:FFFFE599',
    fillId: 9,
    label: 'Bege',
    responsible: 'colaborador1_outros_clientes',
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
    styleKey: 'argb:FFFFFF00',
    fillId: 10,
    label: 'Amarelo forte',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: true,
  },
  {
    styleKey: 'theme:0|tint:0.0000',
    fillId: 13,
    label: 'Branco (do tema)',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: false,
  },
]

describe('resolveColor — as 9 cores reais', () => {
  it('azul identifica o Colaborador 1', () => {
    const r = resolveColor('argb:FF5B9BD5', MAPA)

    expect(r.responsible).toBe('colaborador1')
    expect(r.mapped).toBe(true)
    expect(r.label).toBe('Azul')
  })

  it('bege e subcategoria de Colaborador 1, nao um responsavel novo (A-18)', () => {
    expect(resolveColor('argb:FFFFE599', MAPA).responsible).toBe('colaborador1_outros_clientes')
  })

  it('vermelho identifica o Canal Vermelho', () => {
    const r = resolveColor('argb:FFFF0000', MAPA)

    expect(r.customsChannel).toBe('vermelho')
    expect(r.responsible).toBe('indefinido')
  })

  // Decisao do usuario sobre A-38: amarelo e localizacao, nao canal.
  it('amarelo indica importador fora do RJ e canal NENHUM', () => {
    const r = resolveColor('argb:FFFFFF00', MAPA)

    expect(r.importerOutsideRj).toBe(true)
    expect(r.customsChannel).toBe('nenhum')
  })

  it('branco do tema mapeia com todos os derivados neutros', () => {
    const r = resolveColor('theme:0|tint:0.0000', MAPA)

    expect(r.mapped).toBe(true)
    expect(r.responsible).toBe('indefinido')
    expect(r.customsChannel).toBe('nenhum')
    expect(r.importerOutsideRj).toBe(false)
  })

  // Verde NAO deriva responsavel nem status: a cor jamais infere categoria.
  // Medido: 66 linhas com STATUS vazio contra 1 linha branca (A-04, A-54).
  it('verde nao deriva responsavel nem canal', () => {
    for (const chave of ['argb:FF00FF00', 'argb:FF00FF0D']) {
      const r = resolveColor(chave, MAPA)

      expect(r.mapped).toBe(true)
      expect(r.responsible).toBe('indefinido')
      expect(r.customsChannel).toBe('nenhum')
    }
  })

  it('os dois tons de verde tem o mesmo significado (A-48)', () => {
    const a = resolveColor('argb:FF00FF00', MAPA)
    const b = resolveColor('argb:FF00FF0D', MAPA)

    expect(a.responsible).toBe(b.responsible)
    expect(a.customsChannel).toBe(b.customsChannel)
    expect(a.importerOutsideRj).toBe(b.importerOutsideRj)
  })

  it('os dois tons de roxo identificam o mesmo responsavel (A-48)', () => {
    expect(resolveColor('argb:FFA74F7B', MAPA).responsible).toBe('colaborador2')
    expect(resolveColor('argb:FFA64D79', MAPA).responsible).toBe('colaborador2')
  })
})

describe('resolveColor — chave nao reconhecida', () => {
  it('devolve indefinido, importerOutsideRj null e mapped false', () => {
    const r = resolveColor('theme:9|tint:0.3999', MAPA)

    expect(r.mapped).toBe(false)
    expect(r.responsible).toBe('indefinido')
    expect(r.customsChannel).toBe('indefinido')
    expect(r.importerOutsideRj).toBeNull()
  })

  it('usa a propria chave como label, para aparecer legivel na quarentena', () => {
    expect(resolveColor('theme:9|tint:0.3999', MAPA).label).toBe('theme:9|tint:0.3999')
  })

  // A ausencia de tolerancia e deliberada (ADR-0003). Um limiar de distancia
  // teria unificado os dois verdes reais sozinho — e qualquer cor nova junto.
  it('NAO aproxima cor vizinha: um bit de diferenca ja nao mapeia', () => {
    expect(resolveColor('argb:FF00FF01', MAPA).mapped).toBe(false)
    expect(resolveColor('argb:FF00B051', MAPA).mapped).toBe(false)
  })

  it('nao confunde importerOutsideRj null com false', () => {
    const naoMapeada = resolveColor('argb:FFABCDEF', MAPA)
    const branca = resolveColor('theme:0|tint:0.0000', MAPA)

    expect(naoMapeada.importerOutsideRj).toBeNull()
    expect(branca.importerOutsideRj).toBe(false)
  })

  it('mapa vazio resulta em tudo nao mapeado, sem lancar erro', () => {
    const r = resolveColor('argb:FF5B9BD5', [])

    expect(r.mapped).toBe(false)
    expect(r.responsible).toBe('indefinido')
  })

  it('a chave "none" so mapeia se estiver no mapa', () => {
    expect(resolveColor('none', MAPA).mapped).toBe(false)
  })
})

describe('resolveColorIndexed', () => {
  it('produz o mesmo resultado da versao linear, para todas as chaves do mapa', () => {
    const index = indexColorMap(MAPA)

    for (const entry of MAPA) {
      expect(resolveColorIndexed(entry.styleKey, index)).toEqual(resolveColor(entry.styleKey, MAPA))
    }
  })

  it('trata chave ausente igual a versao linear', () => {
    const index = indexColorMap(MAPA)

    expect(resolveColorIndexed('argb:FFABCDEF', index)).toEqual(resolveColor('argb:FFABCDEF', MAPA))
  })
})

/**
 * A volta — da combinacao para a cor que a escrita grava (`H-27`).
 *
 * O mapa real NAO e uma bijecao: tres entradas casam com
 * `indefinido/nenhum/false` e duas com `colaborador2/nenhum/false` (A-48).
 * Exigir correspondencia unica, como o contrato dizia ate `H-27`, recusaria o
 * verde — 477 das 649 linhas (medido em `H-01`, 03/08/2026).
 */
describe('resolveFillTarget', () => {
  it('devolve a entrada da combinacao com uma cor so', () => {
    const alvo = resolveFillTarget(
      { responsible: 'colaborador1', customsChannel: 'nenhum', importerOutsideRj: false },
      MAPA,
    )

    expect(alvo?.fillId).toBe(8)
    expect(alvo?.label).toBe('Azul')
  })

  it('devolve a PRIMEIRA entrada quando mais de uma casa — o tom canonico', () => {
    const roxo = resolveFillTarget(
      { responsible: 'colaborador2', customsChannel: 'nenhum', importerOutsideRj: false },
      MAPA,
    )
    const verde = resolveFillTarget(
      { responsible: 'indefinido', customsChannel: 'nenhum', importerOutsideRj: false },
      MAPA,
    )

    expect(roxo?.fillId).toBe(27)
    expect(verde?.fillId).toBe(2)
  })

  it('devolve null para combinacao que o mapa nao representa (A-31)', () => {
    expect(
      resolveFillTarget(
        { responsible: 'colaborador1', customsChannel: 'vermelho', importerOutsideRj: false },
        MAPA,
      ),
    ).toBeNull()
  })

  it('devolve null com mapa vazio, sem lancar erro', () => {
    expect(
      resolveFillTarget(
        { responsible: 'indefinido', customsChannel: 'nenhum', importerOutsideRj: false },
        [],
      ),
    ).toBeNull()
  })
})

describe('representableTargets', () => {
  it('reduz as 9 entradas reais as 6 combinacoes distintas', () => {
    expect(representableTargets(MAPA).map((entry) => entry.label)).toEqual([
      'Verde (tom A)',
      'Azul',
      'Roxo (tom A)',
      'Bege',
      'Vermelho',
      'Amarelo forte',
    ])
  })

  /**
   * Branco tem a mesma combinacao do verde e fica de fora: a aplicacao grava o
   * tom canonico, e oferecer "Branco" na tela para gravar verde seria dizer o
   * que o codigo nao faz.
   */
  it('deixa de fora os tons que a escrita nao produz', () => {
    const rotulos = representableTargets(MAPA).map((entry) => entry.label)

    expect(rotulos).not.toContain('Branco (do tema)')
    expect(rotulos).not.toContain('Verde (tom B)')
    expect(rotulos).not.toContain('Roxo (tom B)')
  })

  it('so devolve entradas que `resolveFillTarget` reencontra', () => {
    for (const entry of representableTargets(MAPA)) {
      expect(resolveFillTarget(entry, MAPA)).toBe(entry)
    }
  })

  it('devolve lista vazia com mapa vazio', () => {
    expect(representableTargets([])).toEqual([])
  })
})
