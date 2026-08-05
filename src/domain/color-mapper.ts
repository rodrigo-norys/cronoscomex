import type { CustomsChannel, Responsible } from './types.ts'

/**
 * Traducao da chave de estilo nos tres campos que so existem como cor —
 * responsavel, canal e localizacao do importador (secao 3 da especificacao).
 *
 * Funcao PURA: recebe o mapa ja carregado. O I/O fica em
 * src/app/color-map-loader.ts, porque src/domain/ nao faz I/O (ADR-0006).
 */

export interface ColorMapEntry {
  styleKey: string
  /**
   * Indice do preenchimento em xl/styles.xml. Usado pela ESCRITA (H-27), que
   * troca apenas o fillId dentro do cellXf e preserva fonte, borda e formato
   * numerico. Trocar o styleId inteiro destruiria bordas — achado A-49.
   */
  fillId: number
  label: string
  responsible: Responsible
  customsChannel: CustomsChannel
  importerOutsideRj: boolean
}

export interface ColorResolution {
  responsible: Responsible
  customsChannel: CustomsChannel
  /** `null` quando a cor nao foi reconhecida: nao e o mesmo que "dentro do RJ". */
  importerOutsideRj: boolean | null
  mapped: boolean
  /** Rotulo legivel; para chave nao mapeada, a propria chave, para o relatorio. */
  label: string
}

const UNMAPPED = (styleKey: string): ColorResolution => ({
  responsible: 'indefinido',
  customsChannel: 'indefinido',
  importerOutsideRj: null,
  mapped: false,
  label: styleKey,
})

/**
 * Resolve a chave de estilo contra o mapa.
 *
 * A correspondencia e por igualdade EXATA. Nao ha tolerancia, limiar de
 * distancia nem aproximacao por proximidade de cor — decisao do ADR-0003.
 * Medido em H-01: o arquivo real tem `argb:FF00FF00` e `argb:FF00FF0D`,
 * visualmente identicos e a 13 unidades num canal. Um limiar os unificaria
 * sozinho, e unificaria tambem qualquer cor nova com outro significado. Os
 * dois tons sao DUAS entradas apontando para o mesmo valor (achado A-48).
 *
 * Chave desconhecida vira pendencia visivel, nunca classificacao adivinhada.
 */
export function resolveColor(styleKey: string, map: readonly ColorMapEntry[]): ColorResolution {
  const entry = map.find((candidate) => candidate.styleKey === styleKey)
  if (!entry) return UNMAPPED(styleKey)

  return {
    responsible: entry.responsible,
    customsChannel: entry.customsChannel,
    importerOutsideRj: entry.importerOutsideRj,
    mapped: true,
    label: entry.label,
  }
}

/** Índice por chave, para leitura em lote sem varrer o mapa a cada linha. */
export function indexColorMap(map: readonly ColorMapEntry[]): ReadonlyMap<string, ColorMapEntry> {
  return new Map(map.map((entry) => [entry.styleKey, entry]))
}

/** Versao indexada de `resolveColor`, para o caminho quente da ingestao. */
export function resolveColorIndexed(
  styleKey: string,
  index: ReadonlyMap<string, ColorMapEntry>,
): ColorResolution {
  const entry = index.get(styleKey)
  if (!entry) return UNMAPPED(styleKey)

  return {
    responsible: entry.responsible,
    customsChannel: entry.customsChannel,
    importerOutsideRj: entry.importerOutsideRj,
    mapped: true,
    label: entry.label,
  }
}
