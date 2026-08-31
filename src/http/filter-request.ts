import type { FastifyReply, FastifyRequest } from 'fastify'
import { applyFilters, FilterParseError, hasAnyFilter, parseFilters } from '../domain/filters.ts'
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

/**
 * O recorte E a janela que o produziu, para a rota que precisa dizer ao
 * operador **qual** periodo esta contando (`H-52`).
 *
 * Existe ao lado de `filteredProcesses`, e nao no lugar dele: alargar aquele
 * alcancaria as seis rotas **[F]**, e cinco delas nao tem uso para a janela.
 * Reparsear a query dentro da rota devolveria o mesmo objeto por outro caminho,
 * duplicando o tratamento de `400 FILTRO_INVALIDO` que este modulo existe para
 * concentrar.
 */
export function filteredWithPeriod(
  request: FastifyRequest,
  reply: FastifyReply,
  processes: readonly Process[],
): { processes: readonly Process[]; from: Date | null; to: Date | null } | null {
  try {
    const filters = parseFilters(request.query as Record<string, unknown>)
    return {
      processes: applyFilters(processes, filters),
      from: filters.etaFrom,
      to: filters.etaTo,
    }
  } catch (error) {
    if (error instanceof FilterParseError) {
      reply.code(400).send(apiError('FILTRO_INVALIDO', error.message))
      return null
    }
    throw error
  }
}

/**
 * Os REF que os filtros da query selecionam, para as rotas **[F]** que recortam
 * algo que nao e a lista de processos — hoje so a serie mensal de `H-28`.
 *
 * Tres respostas distintas, e a diferenca entre elas e o contrato:
 * `null` ja respondeu `400`; `{ refs: null }` significa **nenhum filtro ativo**,
 * e quem chama nao deve recortar nada; um conjunto significa recorte.
 */
export function filteredRefs(
  request: FastifyRequest,
  reply: FastifyReply,
  processes: readonly Process[],
): { refs: ReadonlySet<string> | null } | null {
  try {
    const filters = parseFilters(request.query as Record<string, unknown>)
    if (!hasAnyFilter(filters)) return { refs: null }

    return { refs: new Set(applyFilters(processes, filters).map((process) => process.ref)) }
  } catch (error) {
    if (error instanceof FilterParseError) {
      reply.code(400).send(apiError('FILTRO_INVALIDO', error.message))
      return null
    }
    throw error
  }
}
