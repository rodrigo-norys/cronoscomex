import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import type { Conflict, WriteResult } from '../../src/app/write-guard.ts'
import { registerApplyRoute } from '../../src/http/routes/apply.ts'

/**
 * `POST /api/edits/apply` **so traduz** `WriteResult` em codigo HTTP. Por isso
 * o teste injeta o resultado direto: nao ha planilha, nem fila, nem write-guard
 * aqui — se houvesse, o teste estaria provando a decisao no lugar errado.
 *
 * A decisao vive em `tests/app/write-guard.test.ts`, sobre copia de fixture.
 */

const CONFLICT: Conflict = {
  ref: 'FT533.26',
  field: 'eta2',
  valueWhenEdited: '2026-08-04',
  valueNow: '2026-08-05',
  yourValue: '2026-08-06',
}

function result(overrides: Partial<WriteResult> = {}): WriteResult {
  return {
    ok: false,
    refusal: null,
    applied: 0,
    cellsWritten: 0,
    backupPath: null,
    conflicts: [],
    restored: false,
    durationMs: 12,
    expectedHash: null,
    actualHash: null,
    fileState: 'intacto',
    archivedQueuePath: null,
    ...overrides,
  }
}

function buildApp(write: WriteResult) {
  const app = Fastify({ logger: false })
  registerApplyRoute(app, async () => write)
  return app
}

async function post(write: WriteResult) {
  const app = buildApp(write)
  const response = await app.inject({ method: 'POST', url: '/api/edits/apply' })
  await app.close()
  return response
}

describe('POST /api/edits/apply — sucesso', () => {
  it('devolve 200 com o contrato de §3', async () => {
    const response = await post(
      result({
        ok: true,
        applied: 3,
        cellsWritten: 3,
        backupPath: 'data/backups/planilha-20260814-143512.xlsx',
        archivedQueuePath: 'data/applied/pending-edits-20260814-143512.jsonl',
        durationMs: 284,
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      applied: 3,
      cellsWritten: 3,
      backupPath: 'data/backups/planilha-20260814-143512.xlsx',
      archivedQueuePath: 'data/applied/pending-edits-20260814-143512.jsonl',
      durationMs: 284,
      validated: true,
    })
  })

  // A planilha foi gravada e validada; so a fila ficou para tras. Devolver erro
  // aqui mandaria o operador procurar um backup obsoleto.
  it('devolve 200 com archivedQueuePath null quando a fila nao foi arquivada', async () => {
    const response = await post(result({ ok: true, applied: 1, cellsWritten: 1 }))

    expect(response.statusCode).toBe(200)
    expect(response.json().archivedQueuePath).toBeNull()
    expect(response.json().validated).toBe(true)
  })
})

describe('POST /api/edits/apply — as sete recusas', () => {
  it.each([
    ['EXCEL_ABERTO', 409],
    ['ARQUIVO_MUDOU', 409],
    ['EDICAO_OBSOLETA', 409],
    ['NADA_A_APLICAR', 409],
    ['ESCRITA_EM_ANDAMENTO', 409],
    ['ESCRITA_INVALIDA', 500],
    ['ARQUIVO_INDISPONIVEL', 503],
  ] as const)('mapeia %s para %i', async (refusal, status) => {
    const response = await post(result({ refusal }))

    expect(response.statusCode).toBe(status)
    expect(response.json().error.code).toBe(refusal)
    // A mensagem termina na acao do operador: recusa sem saida e so um beco.
    expect(response.json().error.message.length).toBeGreaterThan(20)
  })
})

describe('POST /api/edits/apply — o detail de cada recusa', () => {
  it('leva os dois hashes e os conflitos em ARQUIVO_MUDOU', async () => {
    const response = await post(
      result({
        refusal: 'ARQUIVO_MUDOU',
        conflicts: [CONFLICT],
        expectedHash: 'sha256:9f2c',
        actualHash: 'sha256:1ab7',
      }),
    )

    expect(response.json().error.detail).toEqual({
      expectedHash: 'sha256:9f2c',
      actualHash: 'sha256:1ab7',
      conflicts: [CONFLICT],
    })
  })

  /**
   * O caso mais comum de `ARQUIVO_MUDOU`: alguem salvou a planilha entre a
   * leitura e a aplicacao, sem tocar nas celulas da fila. A interface decide
   * por `conflicts.length` — vazio NAO e dialogo de conflito —, e por isso a
   * chave nem aparece.
   */
  it('omite conflicts quando a lista esta vazia', async () => {
    const response = await post(
      result({ refusal: 'ARQUIVO_MUDOU', expectedHash: 'sha256:9f2c', actualHash: 'sha256:1ab7' }),
    )

    expect(response.json().error.detail).not.toHaveProperty('conflicts')
  })

  // Os dois hashes conferem, e e a igualdade que prova ao operador que ninguem
  // mexeu no arquivo — o valor e que envelheceu.
  it('leva conflitos e hashes iguais em EDICAO_OBSOLETA', async () => {
    const response = await post(
      result({
        refusal: 'EDICAO_OBSOLETA',
        conflicts: [{ ...CONFLICT, valueNow: '', refMissing: true }],
        expectedHash: 'sha256:9f2c',
        actualHash: 'sha256:9f2c',
      }),
    )

    const detail = response.json().error.detail
    expect(detail.expectedHash).toBe(detail.actualHash)
    expect(detail.conflicts[0].refMissing).toBe(true)
  })

  it('leva restored e backupPath quando o backup foi restaurado', async () => {
    const response = await post(
      result({
        refusal: 'ESCRITA_INVALIDA',
        restored: true,
        fileState: 'restaurado',
        backupPath: 'data/backups/planilha-20260814-143512.xlsx',
      }),
    )

    expect(response.json().error.detail).toEqual({
      restored: true,
      backupPath: 'data/backups/planilha-20260814-143512.xlsx',
    })
  })

  /**
   * `restored: false` em recusa que nunca chegou a gravar diria ao operador que
   * houve o que desfazer. Quatro das sete recusas nem tocam no arquivo.
   */
  it('omite o detail inteiro quando nao ha o que detalhar', async () => {
    const response = await post(result({ refusal: 'EXCEL_ABERTO' }))

    expect(response.json().error).not.toHaveProperty('detail')
  })

  it('nao expoe backupPath em recusa que deixou o arquivo intacto', async () => {
    const response = await post(
      result({
        refusal: 'ESCRITA_INVALIDA',
        backupPath: 'data/backups/planilha-x.xlsx',
        fileState: 'intacto',
      }),
    )

    expect(JSON.stringify(response.json())).not.toContain('data/backups')
  })

  /**
   * O desfecho mais grave de todos, e o que a primeira versao desta rota
   * escondia: a validacao reprovou E a restauracao falhou, entao o arquivo
   * gravado ficou no lugar do original. `restored` continua `false`, mas o
   * caminho do backup e a UNICA saida — omiti-lo deixava o operador com uma
   * planilha possivelmente invalida e a instrucao de que nada havia a fazer.
   * Achado do revisor-xml.
   */
  it('expoe o backup quando a restauracao falhou, apesar de restored false', async () => {
    const response = await post(
      result({
        refusal: 'ESCRITA_INVALIDA',
        restored: false,
        fileState: 'incerto',
        backupPath: 'data/backups/planilha-20260814-143512.xlsx',
      }),
    )

    expect(response.json().error.detail).toEqual({
      restored: false,
      backupPath: 'data/backups/planilha-20260814-143512.xlsx',
    })
    expect(response.json().error.message).toContain('NAO pode ser restaurada')
  })

  it('diz que a planilha foi restaurada quando ela foi', async () => {
    const response = await post(
      result({
        refusal: 'ESCRITA_INVALIDA',
        restored: true,
        fileState: 'restaurado',
        backupPath: 'data/backups/planilha-20260814-143512.xlsx',
      }),
    )

    expect(response.json().error.message).toContain('foi restaurada')
    expect(response.json().error.message).not.toContain('NAO pode')
  })
})
