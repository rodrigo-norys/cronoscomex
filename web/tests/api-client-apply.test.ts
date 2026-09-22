import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApplyRefusedError, applyEdits } from '../src/api-client.ts'

/**
 * `D-64`, o elo do MEIO do lado do cliente: `applyEdits` traduz o corpo da
 * recusa em `ApplyRefusal`, e nada afirmava que o `detail` atravessa.
 *
 * **O elo existe e ja se perdeu uma vez:** `TABELA_CHEIA` nao chegou a tela em
 * 02/09/2026 e caiu em `ERRO_INTERNO`. Com a rota e o dialogo testados nas duas
 * pontas, a traducao no meio passava verde mesmo desligada. Achado do
 * revisor-xml.
 *
 * O `fetch` e trocado por um duble porque o alvo e a traducao, e nao a rede.
 */
function recusaHttp(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyEdits — a traducao da recusa', () => {
  it('leva as REF inadmissiveis ate a recusa', async () => {
    recusaHttp(500, {
      error: {
        code: 'ESCRITA_INVALIDA',
        message: 'A gravacao nao pode ser concluida com seguranca.',
        detail: { invalidRefs: ['FT533.26', 'FT900.26'] },
      },
    })

    await expect(applyEdits()).rejects.toMatchObject({
      refusal: { code: 'ESCRITA_INVALIDA', invalidRefs: ['FT533.26', 'FT900.26'] },
    })
  })

  // Sem o campo, a lista e vazia — e nao `undefined`, que quebraria o `.length`
  // do dialogo.
  it('devolve lista vazia quando o detail nao a traz', async () => {
    recusaHttp(409, { error: { code: 'NADA_A_APLICAR', message: 'Nao ha nada a aplicar.' } })

    await expect(applyEdits()).rejects.toMatchObject({ refusal: { invalidRefs: [] } })
  })

  // A frase que nomeia a coluna vem montada do servidor, e o cliente nao a
  // remonta: duas fontes para o mesmo texto divergiriam (`H-96`).
  it('leva a frase do cabecalho ate a recusa', async () => {
    recusaHttp(409, {
      error: {
        code: 'CABECALHO_DESLOCADO',
        message: 'Uma coluna mudou de lugar.',
        detail: { schemaDivergence: '"IMPORTADOR" saiu do lugar: era esperada em C, e esta em D.' },
      },
    })

    await expect(applyEdits()).rejects.toMatchObject({
      refusal: { schemaDivergence: '"IMPORTADOR" saiu do lugar: era esperada em C, e esta em D.' },
    })
  })

  // Codigo que a interface nao conhece vira `ERRO_INTERNO`, e nao passa cru
  // para a tela.
  it('traduz codigo desconhecido para ERRO_INTERNO', async () => {
    recusaHttp(500, { error: { code: 'CODIGO_QUE_NAO_EXISTE', message: 'seja la o que for' } })

    await expect(applyEdits()).rejects.toMatchObject({ refusal: { code: 'ERRO_INTERNO' } })
  })

  it('recusa e um ApplyRefusedError, e nao um Error qualquer', async () => {
    recusaHttp(409, { error: { code: 'NADA_A_APLICAR', message: 'Nao ha nada a aplicar.' } })

    await expect(applyEdits()).rejects.toBeInstanceOf(ApplyRefusedError)
  })
})
