import type { FastifyInstance, FastifyReply } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  DEFAULT_TEAM_MAP_PATH,
  loadTeamMap,
  removeTeamMember,
  saveTeamMember,
} from '../../app/team-map-loader.ts'
import {
  planTeamMember,
  planTeamRemoval,
  type TeamMember,
  type TeamPlan,
  teamPlan,
} from '../../domain/team-mapper.ts'
import { apiError } from '../errors.ts'
import { refuseDuringWrite } from './edits.ts'

/**
 * As rotas do mapa de equipe (`H-91`) — contrato em `docs/05-contratos-api.md`.
 *
 * **Espelham as de `H-88`**, e a simetria e deliberada: criar, redefinir,
 * desfazer, e tirar um item da carteira sao as mesmas quatro operacoes que o
 * operador ja aprendeu no painel de clientes. O que muda e o que a carteira
 * guarda — importadores em vez de grafias da coluna CLT.
 *
 * **Nenhuma delas e marcada [F]**, pela mesma razao da determinacao 2 de
 * `D-32`: o que elas servem e estado de CONFIGURACAO, e nao recorte. Seguindo
 * os filtros globais, filtrar por um responsavel esconderia os importadores sem
 * dono, e o operador concluiria que declarou tudo.
 *
 * **A gravacao nao passa pelo `Aplicar alteracoes`**, como em `clients.ts`: nao
 * ha o que escrever na planilha, e a fila existe para adiar a escrita no
 * arquivo da empresa. O mapa e local e reversivel.
 *
 * **Nome de pessoa viaja para a tela e NUNCA para o log** (regra inviolavel 8,
 * determinacao 3 de `D-35`). A chave e impessoal e e gerada pelo dominio; o
 * `label` so aparece no corpo da resposta.
 */
export type TeamResponse = TeamPlan

export interface TeamMemberSavedResponse {
  outcome: 'membro-criado' | 'membro-redefinido'
  key: string
  label: string
  importers: string[]
}

export interface TeamMemberRemovedResponse {
  outcome: 'membro-desfeito' | 'importador-removido'
  key: string
  /** `null` quando o responsavel inteiro foi desfeito. */
  importer: string | null
  /** Os importadores que voltaram para "Sem responsavel". */
  released: string[]
}

const REJECTIONS: Record<string, string> = {
  CHAVE_VAZIA: 'Informe a chave do responsável.',
  ROTULO_VAZIO: 'Informe o nome do responsável.',
  IMPORTADOR_VAZIO: 'Há um importador em branco na carteira.',
}

const REMOVAL_REJECTIONS: Record<string, string> = {
  MEMBRO_INEXISTENTE: 'Esse responsável não existe mais.',
  IMPORTADOR_INEXISTENTE: 'Esse importador não está na carteira desse responsável.',
}

export function registerTeamRoutes(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  /**
   * O mapa em memoria — o MESMO que o store recebeu, pelo motivo de
   * `clients.ts`: lido de novo aqui, o painel discordaria do campo Responsavel
   * que a tabela mostra.
   */
  teamMap: readonly TeamMember[] = [],
  /** Ponto de injecao para teste. `saveTeamMember` recusa o padrao sob teste. */
  teamMapPath: string = DEFAULT_TEAM_MAP_PATH,
  /** Reprojeta com o mapa novo. Em producao `main` passa `refreshTeamMap`. */
  applyTeamMap?: (map: readonly TeamMember[]) => Promise<void>,
): void {
  /**
   * O mapa CORRENTE. Reatribuido depois de cada gravacao pelo mesmo motivo de
   * `clients.ts`: o parametro e um instantaneo da partida, e a segunda edicao
   * seguida planejaria contra a carteira anterior a primeira — a sobreposicao
   * de importador deixaria de ser detectada.
   */
  let map = teamMap

  /**
   * `503` apenas quando NUNCA houve leitura.
   *
   * Carteira vazia aqui afirmaria que nenhum importador precisa de dono, que e
   * o oposto de "ainda nao se sabe" (regra inviolavel 3).
   */
  const semLeitura = (reply: FastifyReply): boolean => {
    const state = store.getState()
    if (state.lastReadAt !== null) return false

    reply
      .code(503)
      .send(
        apiError('ARQUIVO_INDISPONIVEL', state.degradedReason ?? 'A planilha ainda nao foi lida.'),
      )
    return true
  }

  /** Grava, rele e reprojeta. A ordem importa: `map` precisa sair do arquivo. */
  const aplicar = async (): Promise<void> => {
    const next = loadTeamMap(teamMapPath)
    map = next
    if (applyTeamMap) await applyTeamMap(next)
  }

  app.get('/api/team', (_request, reply) => {
    if (semLeitura(reply)) return reply

    const body: TeamResponse = teamPlan(store.getState().processes, map)
    return reply.send(body)
  })

  app.put('/api/team/:key', async (request, reply) => {
    if (refuseDuringWrite(store, reply)) return reply
    if (semLeitura(reply)) return reply

    const body = (request.body ?? {}) as { label?: unknown; importers?: unknown }
    if (typeof body.label !== 'string') {
      return reply.code(400).send(apiError('CORPO_INVALIDO', 'Informe `label` como texto.'))
    }
    /*
      Lista AUSENTE e carteira vazia, e nao erro: criar o responsavel antes de
      lhe dar importador e o caso-limite legitimo de `H-91`. O que a rota recusa
      e `importers` presente com outro tipo — isso e engano de quem chama.
    */
    if (body.importers !== undefined && !Array.isArray(body.importers)) {
      return reply
        .code(400)
        .send(apiError('CORPO_INVALIDO', 'Informe `importers` como lista de textos.'))
    }

    const { key } = request.params as { key: string }
    const plan = planTeamMember(key, body.label, (body.importers ?? []) as string[], map)

    if ('code' in plan) {
      const message =
        plan.code === 'IMPORTADOR_EM_DUAS_CARTEIRAS'
          ? `O importador "${plan.importer}" já está na carteira de ${plan.ownerLabel}. ` +
            'Tire-o de lá antes, ou atribua outro — um importador pertence a um responsável só.'
          : (REJECTIONS[plan.code] ?? plan.code)
      return reply.code(400).send(apiError('CORPO_INVALIDO', message))
    }

    saveTeamMember(plan, teamMapPath)
    await aplicar()

    const answer: TeamMemberSavedResponse = {
      outcome: plan.kind,
      key: plan.key,
      label: plan.label,
      importers: plan.importers,
    }
    return reply.code(plan.kind === 'membro-criado' ? 201 : 200).send(answer)
  })

  /**
   * As duas remocoes.
   *
   * **Nenhum processo fica sem grupo.** Sai o vinculo importador → pessoa, e os
   * processos caem em "Sem responsavel" — que ja existe em `knownResponsibles`,
   * ja aparece no filtro e ja e contado por IND-20.
   */
  const desfazer = async (
    reply: FastifyReply,
    key: string,
    importer: string | null,
  ): Promise<unknown> => {
    if (refuseDuringWrite(store, reply)) return reply
    if (semLeitura(reply)) return reply

    const plan = planTeamRemoval(key, importer, map)
    if ('code' in plan) {
      return reply
        .code(404)
        .send(apiError(plan.code, REMOVAL_REJECTIONS[plan.code] ?? 'Nao encontrado.'))
    }

    removeTeamMember(plan, teamMapPath)
    await aplicar()

    const answer: TeamMemberRemovedResponse = {
      outcome: plan.kind,
      key: plan.key,
      importer: plan.importer,
      released: plan.releases,
    }
    return reply.send(answer)
  }

  app.delete('/api/team/:key/importers/:importer', async (request, reply) => {
    const { key, importer } = request.params as { key: string; importer: string }
    return desfazer(reply, key, importer)
  })

  app.delete('/api/team/:key', async (request, reply) => {
    const { key } = request.params as { key: string }
    return desfazer(reply, key, null)
  })
}
