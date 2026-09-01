/**
 * Tipos de `medir-navegador.mjs`, para a suite poder importar a conta da WCAG.
 *
 * **Existe em vez de `allowJs` no `tsconfig.json`**: ligar `allowJs` faria o
 * compilador varrer `tools/` inteiro, e o `.mjs` esta em `.mjs` de proposito —
 * ele roda direto, sem passar por `--experimental-strip-types`, porque quem o
 * invoca e um script de conferencia e nao a aplicacao.
 *
 * Este arquivo declara **apenas o que a suite usa**. O resto da API do harness
 * e consumido de scripts `.mjs` no scratchpad, que nao passam pelo `tsc`.
 */

/** Luminancia relativa da WCAG, sobre sRGB de 0 a 255. */
export function luminancia(rgb: readonly [number, number, number]): number

/** Razao de contraste da WCAG, com 2 casas. Ordem dos argumentos e irrelevante. */
export function razaoContraste(
  rgbA: readonly [number, number, number],
  rgbB: readonly [number, number, number],
): number
