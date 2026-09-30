/**
 * Tipos de `levantar-retroativo.mjs`, para a suite poder importar as funcoes
 * puras — pelo mesmo motivo de `medir-navegador.d.mts`: sem `allowJs`, que faria
 * o compilador varrer `tools/` inteiro.
 *
 * Declara **apenas o que a suite usa**. A parte que chama o `git` roda direto,
 * pela linha de comando, e nao passa pelo `tsc`.
 */

export type FileClass = 'code' | 'test' | 'doc' | 'other'
export type Size = 'P' | 'M' | 'G'
export type PullRequestKind = 'product' | 'outside' | 'covered'

export function classifyFile(path: string): FileClass

export function sizeByRule(files: number, contractChanged: boolean): Size

export function commitType(subject: string): string | null

export function classifyPullRequest(
  branch: string,
  commits: readonly { subject: string; files: readonly string[] }[],
): PullRequestKind

export function extractDecisions(text: string): string[]

export function parseMergeSubject(subject: string): { pr: number; branch: string } | null

export function parseDecisions(
  markdown: string,
): Map<string, { date: string; title: string; cost: string | null }>

export function registeredDecisions(diff: string): string[]

export function countAddedLines(diff: string): number

export function summarizeFiles(
  files: readonly string[],
  contractLines: number,
): { counted: string[]; contractChanged: boolean; size: Size }
