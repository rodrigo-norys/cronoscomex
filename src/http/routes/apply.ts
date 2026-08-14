import type { FastifyInstance } from 'fastify'
import { applyPendingEdits, type WriteRefusal, type WriteResult } from '../../app/write-guard.ts'
import { apiError } from '../errors.ts'

/**
 * POST /api/edits/apply — contrato em docs/05-contratos-api.md secao 3.
 *
 * **So traduz.** Toda a decisao vive no write-guard: esta rota converte
 * `WriteResult` em codigo HTTP e nada mais — nao le a planilha, nao mexe na
 * fila, nao decide se pode gravar (regra inviolavel 6).
 *
 * `validated` nao existe em `WriteResult` e e derivado de `ok`: se a resposta e
 * 200, a validacao pos-escrita passou, e um segundo campo dizendo o mesmo seria
 * ruido que pode divergir.
 */

export interface ApplyResponse {
  applied: number
  cellsWritten: number
  backupPath: string | null
  /** `null` quando a fila nao foi arquivada. Ver o aviso em §3 do contrato. */
  archivedQueuePath: string | null
  durationMs: number
  validated: true
}

const STATUS: Record<WriteRefusal, number> = {
  EXCEL_ABERTO: 409,
  ARQUIVO_MUDOU: 409,
  EDICAO_OBSOLETA: 409,
  NADA_A_APLICAR: 409,
  ESCRITA_EM_ANDAMENTO: 409,
  ESCRITA_INVALIDA: 500,
  ARQUIVO_INDISPONIVEL: 503,
}

/**
 * O que o operador precisa FAZER, nao o que aconteceu por dentro. Cada uma
 * termina com a acao dele, porque recusa sem saida e so um beco.
 */
const MESSAGE: Record<WriteRefusal, string> = {
  EXCEL_ABERTO:
    'A planilha esta aberta no Excel. Feche-a e aplique de novo — suas alteracoes continuam na fila.',
  ARQUIVO_MUDOU:
    'A planilha mudou desde a ultima leitura. Releia o painel e confira antes de aplicar; nada foi gravado.',
  EDICAO_OBSOLETA:
    'O que voce editou mudou na planilha depois da sua alteracao. Confira os valores; nada foi gravado.',
  NADA_A_APLICAR: 'Nao ha alteracoes pendentes para aplicar.',
  ESCRITA_EM_ANDAMENTO: 'Ja existe uma aplicacao em curso. Aguarde alguns instantes.',
  ESCRITA_INVALIDA: 'A gravacao nao pode ser concluida com seguranca. Nada foi perdido.',
  ARQUIVO_INDISPONIVEL:
    'A planilha nao pode ser lida agora. Confira se a pasta do OneDrive esta sincronizada.',
}

/**
 * `ESCRITA_INVALIDA` cobre desfechos opostos, e a mensagem nao pode ser uma so.
 * Com `fileState: 'incerto'` a planilha em disco pode estar invalida e o backup
 * e a unica saida — dizer "nada foi perdido" ali seria mentir para o operador
 * exatamente no caso em que ele precisa agir. Achado do revisor-xml.
 */
function messageOf(result: WriteResult, refusal: WriteRefusal): string {
  if (refusal !== 'ESCRITA_INVALIDA') return MESSAGE[refusal]

  if (result.fileState === 'incerto') {
    return 'A gravacao falhou e a planilha NAO pode ser restaurada automaticamente. Feche o Excel e reponha o arquivo a partir da copia de seguranca indicada abaixo.'
  }
  if (result.fileState === 'restaurado') {
    return 'A gravacao falhou na conferencia e a planilha foi restaurada da copia de seguranca. Nada foi perdido.'
  }
  return MESSAGE.ESCRITA_INVALIDA
}

/**
 * O `detail` carrega so o que a tela usa, e nunca o mesmo dado duas vezes.
 *
 * `conflicts` vai em qualquer recusa que o traga: a interface decide primeiro
 * por `conflicts.length` — vazio NAO e dialogo de conflito — e so depois, linha
 * a linha, por `refMissing`. Ver o aviso em §3 do contrato.
 */
function detailOf(result: WriteResult): Record<string, unknown> | undefined {
  const detail: Record<string, unknown> = {}

  if (result.expectedHash !== null) detail.expectedHash = result.expectedHash
  if (result.actualHash !== null) detail.actualHash = result.actualHash
  if (result.conflicts.length > 0) detail.conflicts = result.conflicts
  // Decide por `fileState`, nunca por `restored`: `restored: false` sai tanto de
  // recusa que nunca gravou quanto de restauracao que FALHOU, e so a segunda
  // precisa do caminho do backup — e e a que mais precisa. Quem sabe o estado
  // do arquivo e o guard (regra inviolavel 6).
  //
  // `gravado` fica de fora por nome, e nao por `!== 'intacto'`: ele so aparece
  // no sucesso, que nem chega aqui, mas H-27 reusa `WriteResult` — e uma recusa
  // futura que o carregue exporia o backup de uma escrita que deu certo.
  if (result.fileState === 'restaurado' || result.fileState === 'incerto') {
    detail.restored = result.restored
    detail.backupPath = result.backupPath
  }

  return Object.keys(detail).length === 0 ? undefined : detail
}

export function registerApplyRoute(
  app: FastifyInstance,
  apply: () => Promise<WriteResult> = applyPendingEdits,
): void {
  app.post('/api/edits/apply', async (_request, reply) => {
    const result = await apply()

    if (result.refusal !== null) {
      const refusal = result.refusal
      return reply
        .code(STATUS[refusal])
        .send(apiError(refusal, messageOf(result, refusal), detailOf(result)))
    }

    const body: ApplyResponse = {
      applied: result.applied,
      cellsWritten: result.cellsWritten,
      backupPath: result.backupPath,
      archivedQueuePath: result.archivedQueuePath,
      durationMs: result.durationMs,
      validated: true,
    }
    return reply.code(200).send(body)
  })
}
