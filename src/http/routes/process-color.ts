import type { FastifyInstance } from 'fastify'
import { store as defaultStore, type StoreAccess } from '../../app/process-store.ts'
import {
  type ColorMapEntry,
  type ColorTarget,
  representableTargets,
  resolveColor,
  resolveFillTarget,
} from '../../domain/color-mapper.ts'
import { normKey } from '../../domain/normalizer.ts'
import { UNWRITTEN_ROW } from '../../domain/process-projection.ts'
import {
  consolidated,
  DEFAULT_QUEUE_PATH,
  enqueue,
  isColorEdit,
  type PendingColorEdit,
} from '../../io/edit-queue.ts'
import { apiError } from '../errors.ts'
import { refuseDuringWrite } from './edits.ts'

/**
 * `PATCH /api/processes/:ref/color` — contrato em `docs/05-contratos-api.md §3`.
 *
 * **Nao toca no `.xlsx`.** Enfileira a troca, como as outras rotas de edicao; a
 * escrita e do `write-guard`, que resolve a combinacao no `fillId` e repinta as
 * colunas A a L.
 *
 * A rota **nao escolhe cor**: `resolveFillTarget` e `representableTargets` vivem
 * no dominio, porque decidir qual das entradas do mapa representa uma combinacao
 * e regra de negocio (regra inviolavel 6). Aqui so ha traducao para HTTP.
 */

export type EnqueuedColorResponse = PendingColorEdit & {
  /** Quantas edicoes ficaram na fila depois desta. */
  pendingEditsCount: number
}

export interface ColorOption {
  label: string
  responsible: ColorTarget['responsible']
  customsChannel: ColorTarget['customsChannel']
  importerOutsideRj: boolean
}

export interface ColorOptionsResponse {
  options: ColorOption[]
}

interface ColorRequestBody {
  responsible?: unknown
  customsChannel?: unknown
  importerOutsideRj?: unknown
}

/** As combinacoes que a aplicacao sabe gravar — a lista do `400` e a do menu. */
function representableList(colorMap: readonly ColorMapEntry[]): ColorOption[] {
  return representableTargets(colorMap).map((entry) => ({
    label: entry.label,
    responsible: entry.responsible,
    customsChannel: entry.customsChannel,
    importerOutsideRj: entry.importerOutsideRj,
  }))
}

export function registerProcessColorRoute(
  app: FastifyInstance,
  store: StoreAccess = defaultStore,
  colorMap: readonly ColorMapEntry[] = [],
  queuePath: string = DEFAULT_QUEUE_PATH,
): void {
  /**
   * O menu de cores da tela. Existe porque a alternativa e a interface carregar
   * uma copia das combinacoes: `config/color-map.json` e a fonte, e uma segunda
   * lista divergiria dela no primeiro ajuste — oferecendo ao operador uma cor
   * que a escrita nao grava, ou escondendo uma que ela grava.
   */
  app.get('/api/color-options', (_request, reply) => {
    const body: ColorOptionsResponse = { options: representableList(colorMap) }
    return reply.code(200).send(body)
  })

  app.patch('/api/processes/:ref/color', (request, reply) => {
    if (refuseDuringWrite(store, reply)) return reply

    const state = store.getState()

    if (state.lastReadAt === null) {
      return reply
        .code(503)
        .send(
          apiError(
            'ARQUIVO_INDISPONIVEL',
            state.degradedReason ?? 'A planilha ainda nao foi lida.',
          ),
        )
    }

    const body = (request.body ?? {}) as ColorRequestBody
    if (
      typeof body.responsible !== 'string' ||
      typeof body.customsChannel !== 'string' ||
      typeof body.importerOutsideRj !== 'boolean'
    ) {
      return reply
        .code(400)
        .send(
          apiError(
            'CORPO_INVALIDO',
            'Informe `responsible` e `customsChannel` como texto e `importerOutsideRj` como true ou false.',
            { representable: representableList(colorMap) },
          ),
        )
    }

    const { ref } = request.params as { ref: string }
    const wanted = normKey(ref)
    const process = state.processes.find((candidate) => normKey(candidate.ref) === wanted)
    if (process === undefined) {
      return reply
        .code(404)
        .send(apiError('PROCESSO_NAO_ENCONTRADO', `Nenhum processo com a REF "${ref}".`))
    }

    /*
      **Linha ainda nao gravada nao recebe cor** (02/09/2026). Ela aparece em
      `state.processes` pela projecao, entao a rota a encontra — mas o
      `write-guard` resolve o alvo da repintura pela REF no ARQUIVO, e ali ela
      nao esta: a edicao voltaria com `refMissing`, recusando a fila INTEIRA e
      dizendo ao operador que "esta linha nao esta mais na planilha", sobre uma
      linha que nunca esteve. Achado do revisor-xml.

      A linha nova nasce sem preenchimento por decisao; a cor se define depois
      de ela existir no arquivo.
    */
    if (process.sourceRow === UNWRITTEN_ROW) {
      return reply
        .code(409)
        .send(
          apiError(
            'LINHA_NAO_GRAVADA',
            'Esta linha ainda nao foi gravada na planilha. Aplique as alteracoes antes de definir a cor.',
          ),
        )
    }

    // A validacao dos tres valores e a resolucao sao a MESMA operacao: uma
    // combinacao so e valida se o mapa a representa. Conferir os dominios antes
    // criaria uma segunda lista de valores aceitos, que diverge do mapa no
    // primeiro ajuste — e o mapa e a fonte (A-31).
    const target = {
      responsible: body.responsible,
      customsChannel: body.customsChannel,
      importerOutsideRj: body.importerOutsideRj,
    } as ColorTarget

    const entry = resolveFillTarget(target, colorMap)
    if (entry === null) {
      return reply
        .code(400)
        .send(
          apiError(
            'CORPO_INVALIDO',
            'Essa combinacao nao tem cor correspondente na planilha. Escolha uma das listadas.',
            { representable: representableList(colorMap) },
          ),
        )
    }

    // `previousStyleKey` e a cor que esta na PLANILHA, nunca a que a tela mostra:
    // `state.processes` vem projetado com a fila, entao trocar a cor duas vezes
    // gravaria como anterior a cor da escolha anterior, que nunca esteve no
    // arquivo — e a defesa de H-25 recusaria a fila inteira, para sempre. Mesmo
    // cuidado que `POST /api/edits` tem com `previous`. Achado do revisor-xml em
    // H-25, aplicado aqui na abertura de H-27.
    const pending = consolidated(queuePath)
      .filter(isColorEdit)
      .find((candidate) => normKey(candidate.ref) === wanted)

    const previousStyleKey = pending?.previousStyleKey ?? process.styleKey

    const edit = enqueue(
      {
        kind: 'color',
        ref: process.ref,
        sourceRow: process.sourceRow,
        target,
        label: entry.label,
        previousStyleKey,
        previousLabel: pending?.previousLabel ?? resolveColor(previousStyleKey, colorMap).label,
      },
      queuePath,
    )

    const response: EnqueuedColorResponse = {
      ...edit,
      pendingEditsCount: consolidated(queuePath).length,
    }
    return reply.code(201).send(response)
  })
}
