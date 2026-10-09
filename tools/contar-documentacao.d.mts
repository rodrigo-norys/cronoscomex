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
  tracked: string[]
}

export function createSource(root: string): Source

export interface LooseNumber {
  file: string
  line: number
  number: string
  unit: string
  text: string
}

export function looseNumbers(
  file: string,
  text: string,
  onlyLines?: ReadonlySet<number>,
): LooseNumber[]

export function findLooseNumbers(
  root: string,
  options?: { base?: string; all?: boolean },
): LooseNumber[]

export function blocks(lines: readonly string[]): { start: number; end: number; fenced: boolean }[]

export interface Pair {
  key: string
  definedAt: string[]
  citedBy: { file: string; line: number; text: string }[]
}

export function findPairs(root: string, options?: { base?: string }): Pair[]

export interface Definition {
  id: string
  family: string
  citedAt: string
  definedAt: string[]
  mirror: string | null
}

export interface MirrorSide {
  file: string
  section?: RegExp
  entries: 'headings' | 'rows'
  state: (text: string) => string
  absent?: string
  cell?: number
  merge?: (state: string, other: string) => string
}

export interface Mirror {
  name: string
  family: string
  source: MirrorSide
  copy: MirrorSide
}

export interface Floors {
  regions?: number
  tables?: number
  byName?: Record<string, number>
  mirrors?: Record<string, { source?: number; copy?: number }>
}

export function findDefinitions(root: string, options?: { mirrors?: Mirror[] }): Definition[]

export interface Problem {
  file: string
  line: number
  guard: string
  message: string
}

export function checkMirrors(
  source: Source,
  mirrors: Mirror[],
  floors?: Floors['mirrors'],
): Problem[]

export function looseTableRows(text: string): number[]

export function inspectStructure(
  root: string,
  options?: { mirrors?: Mirror[]; floors?: Floors },
): { problems: Problem[] }

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
