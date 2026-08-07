import type { FastifyReply, FastifyRequest } from 'fastify'
import { applyFilters, FilterParseError, parseFilters } from '../domain/filters.ts'
import type { Process } from '../domain/types.ts'
import { apiError } from './errors.ts'

/**
 * Recorta o conjunto pelos filtros da query, ou responde `400 FILTRO_INVALIDO`.
 *
 * Vive aqui, e nao em cada rota, porque toda rota marcada **[F]** repete
 * exatamente este bloco — hoje duas, e `H-17`, `H-19` e `H-21` acrescentam
 * mais. Nao e regra de negocio: a regra do que e valido e do que casa vive em
 * `src/domain/filters.ts`. Isto e traducao de HTTP.
 *
 * Devolve `null` quando ja respondeu com erro — o chamador so precisa parar.
 */
export function filteredProcesses(
  request: FastifyRequest,
  reply: FastifyReply,
  processes: readonly Process[],
): readonly Process[] | null {
  try {
    return applyFilters(processes, parseFilters(request.query as Record<string, unknown>))
  } catch (error) {
    if (error instanceof FilterParseError) {
      reply.code(400).send(apiError('FILTRO_INVALIDO', error.message))
      return null
    }
    throw error
  }
}
