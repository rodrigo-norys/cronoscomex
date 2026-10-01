/**
 * Tipos de `abrir-historia.mjs`, para a suite importar o script — pelo mesmo motivo
 * de `contar-documentacao.d.mts`. Declara apenas o que a suite usa.
 */

export function storyId(args: readonly string[]): string | null

export function render(root: string, section: string, args: readonly string[]): string
