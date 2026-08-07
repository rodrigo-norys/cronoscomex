import type { FilterOptionsResponse } from '../../src/http/routes/filter-options.ts'
import type { HealthResponse } from '../../src/http/routes/health.ts'

/**
 * O unico ponto da interface que fala HTTP.
 *
 * Os tipos de resposta sao importados das proprias rotas, com `import type`:
 * `verbatimModuleSyntax` apaga o import na compilacao, entao nem o Fastify nem
 * o `process-store` chegam perto do pacote do navegador. O ganho e que o
 * contrato tem **uma** declaracao — redeclarar `HealthResponse` aqui deixaria o
 * cliente divergir do servidor em silencio, que foi exatamente o que o
 * esqueleto de `H-02` fazia, com metade dos campos.
 */
export type { FilterOptionsResponse, HealthResponse }

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', signal ? { signal } : undefined)
  if (!response.ok) {
    throw new Error(`GET /api/health respondeu ${response.status}`)
  }
  return (await response.json()) as HealthResponse
}

/**
 * As opcoes de cada filtro, derivadas dos dados carregados (A-36) — nunca de
 * lista fixa. Responde `503` enquanto nao houve leitura nenhuma, e nesse caso a
 * barra fica sem opcoes em vez de inventar um catalogo.
 */
export async function getFilterOptions(signal?: AbortSignal): Promise<FilterOptionsResponse> {
  const response = await fetch('/api/filters/options', signal ? { signal } : undefined)
  if (!response.ok) {
    throw new Error(`GET /api/filters/options respondeu ${response.status}`)
  }
  return (await response.json()) as FilterOptionsResponse
}

/**
 * Forca a releitura da planilha. **Nunca lanca.**
 *
 * A rota responde `409 ESCRITA_EM_ANDAMENTO` e `503 ARQUIVO_INDISPONIVEL`, e
 * nenhum dos dois deve interromper o botao de atualizacao: o passo seguinte —
 * refazer as requisicoes — continua valendo, porque as rotas de dado devolvem a
 * ultima leitura valida mesmo em estado `degradado`. O resultado real chega
 * pelo `health` buscado logo depois, e a faixa e quem comunica o problema.
 * Devolver o booleano em vez de engolir mantem o desfecho visivel a quem chama.
 */
export async function requestReload(): Promise<boolean> {
  try {
    const response = await fetch('/api/reload', { method: 'POST' })
    return response.ok
  } catch {
    return false
  }
}
