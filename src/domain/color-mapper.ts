import type { CustomsChannel, Responsible } from './types.ts'

/**
 * Traducao da chave de estilo nos tres campos que so existem como cor —
 * responsavel, canal e localizacao do importador (secao 3 da especificacao) —
 * e, desde H-27, o caminho de volta: da combinacao dos tres para o `fillId`
 * que a escrita grava.
 *
 * Funcao PURA: recebe o mapa ja carregado. O I/O fica em
 * src/app/color-map-loader.ts, porque src/domain/ nao faz I/O (ADR-0006).
 *
 * **A volta nao e uma bijecao, e e por isso que ela vive aqui.** Duas entradas
 * do mapa real podem ter a MESMA combinacao: `indefinido/nenhum/false` casa com
 * verde tom A, verde tom B e branco; `colaborador2/nenhum/false` casa com os
 * dois roxos (A-48). Escolher entre elas e regra de negocio, e a rota nao
 * decide regra (regra inviolavel 6).
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

/**
 * Os tres campos que so existem como cor — o corpo de `PATCH .../color`.
 *
 * `importerOutsideRj` e `boolean`, nunca `null`: o `null` da LEITURA significa
 * "cor nao reconhecida", e nao ha como pedir a escrita de uma cor que o mapa
 * nao conhece.
 */
export interface ColorTarget {
  responsible: Responsible
  customsChannel: CustomsChannel
  importerOutsideRj: boolean
}

function targetKey(target: ColorTarget): string {
  return `${target.responsible}|${target.customsChannel}|${target.importerOutsideRj}`
}

/**
 * A entrada que a escrita vai gravar, ou `null` quando a combinacao nao existe
 * no mapa — o `400 CORPO_INVALIDO` de A-31, que a rota traduz.
 *
 * **A PRIMEIRA entrada que casa vence**, e nao "exatamente uma". Exigir
 * correspondencia unica — como 05-contratos-api.md dizia ate H-27 — recusaria
 * tres das nove entradas do mapa real, entre elas o verde, que cobre 477 das
 * 649 linhas (medido em H-01, 03/08/2026). A primeira e o tom canonico, o mesmo
 * criterio que o caso-limite de H-27 ja fixa para a linha verde tom B repintada
 * de verde: a aplicacao unifica no tom do mapa.
 */
export function resolveFillTarget(
  target: ColorTarget,
  map: readonly ColorMapEntry[],
): ColorMapEntry | null {
  const wanted = targetKey(target)
  return map.find((candidate) => targetKey(candidate) === wanted) ?? null
}

/**
 * Uma entrada por combinacao distinta, na ordem do mapa — o que a aplicacao
 * sabe GRAVAR. Sao seis no mapa real, contra nove entradas.
 *
 * A interface oferece esta lista, e nao as nove: rotular uma opcao "Branco" e
 * gravar verde seria a tela afirmando o que o codigo nao faz. Branco e os tons
 * B seguem legiveis; deixam de ser alvos.
 */
export function representableTargets(map: readonly ColorMapEntry[]): ColorMapEntry[] {
  const seen = new Set<string>()
  return map.filter((entry) => {
    const key = targetKey(entry)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * As colunas que acompanham a cor da linha (A-44). M, N, O e P tem
 * preenchimento proprio e nao sao repintadas.
 *
 * Duplica `styledColumns` de config/color-map.json de proposito: `loadColorMap`
 * devolve so as entradas, e alargar a assinatura dele alcancaria process-store e
 * as fabricas de estado dos testes. Quem impede a divergencia e a assercao de
 * igualdade em tests/app/color-map-loader.test.ts.
 */
export const STYLED_COLUMNS: readonly string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
]

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
