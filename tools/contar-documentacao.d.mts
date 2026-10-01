/**
 * Tipos de `contar-documentacao.mjs`, para a suite importar a ferramenta — pelo
 * mesmo motivo de `levantar-retroativo.d.mts`: sem `allowJs`, que faria o
 * compilador varrer `tools/` inteiro.
 *
 * Declara **apenas o que a suite usa**.
 */

export interface Source {
  read(path: string): string
  filesIn(dir: string): string[]
  scope: string[]
}

export function createSource(root: string): Source

type Counter = (source: Source, arg?: string) => number | string

export const COUNTERS: {
  historias: Counter
  'historias-concluidas': Counter
  'historias-desde': Counter
  epicos: Counter
  premissas: Counter
  riscos: Counter
  'casos-obrigatorios': Counter
  'historias-com-caso-obrigatorio': Counter
  achados: Counter
  'passos-verify': Counter
  'passos-verify-lista': Counter
  'regras-corpus': Counter
  'regras-corpus-faixa': Counter
  'indicadores-definidos': Counter
  'indicadores-ativos': Counter
  'indicadores-aposentados': Counter
  alertas: Counter
  'chaves-de-cor': Counter
  adrs: Counter
  rules: Counter
  'pendencias-abertas': Counter
  'arvore-src': Counter
}

export function scanRegions(text: string): {
  counts: { line: number; raw: string; written: string }[]
  checks: { line: number; raw: string; body: string[] }[]
  errors: { line: number; message: string }[]
}

export function parseTree(lines: readonly string[]): { path: string; annotation: string | null }[]

export interface Divergence {
  file: string
  line: number
  name: string
  written: string | null
  actual: string
}

export function inspect(root: string): {
  divergences: Divergence[]
  errors: { file: string; line: number; message: string }[]
}

export function rewrite(root: string): string[]
