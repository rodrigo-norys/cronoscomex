import type { Conflict, WriteRefusal } from '../../src/app/write-guard.ts'
import type { ColorTarget } from '../../src/domain/color-mapper.ts'
import type { AlertsResponse } from '../../src/http/routes/alerts.ts'
import type { ApplyResponse } from '../../src/http/routes/apply.ts'
import type { EditsListResponse, EnqueuedEditResponse } from '../../src/http/routes/edits.ts'
import type { FilterOptionsResponse } from '../../src/http/routes/filter-options.ts'
import type { HealthResponse } from '../../src/http/routes/health.ts'
import type { MonthlyHistoryResponse } from '../../src/http/routes/history.ts'
import type { IndicatorsResponse } from '../../src/http/routes/indicators.ts'
import type {
  ColorOption,
  ColorOptionsResponse,
  EnqueuedColorResponse,
} from '../../src/http/routes/process-color.ts'
import type {
  ProcessDetailResponse,
  ProcessDto,
  ProcessesResponse,
} from '../../src/http/routes/processes.ts'
import type { QuarantineResponse } from '../../src/http/routes/quarantine.ts'

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
export type {
  AlertsResponse,
  ApplyResponse,
  ColorOption,
  ColorOptionsResponse,
  ColorTarget,
  Conflict,
  EditsListResponse,
  EnqueuedColorResponse,
  EnqueuedEditResponse,
  FilterOptionsResponse,
  HealthResponse,
  IndicatorsResponse,
  MonthlyHistoryResponse,
  ProcessDetailResponse,
  ProcessDto,
  ProcessesResponse,
  QuarantineResponse,
}

/**
 * `503 ARQUIVO_INDISPONIVEL` nao e falha de rede: significa que **nunca** houve
 * leitura, e a interface precisa distinguir isso de "leu e deu zero" (regra
 * inviolavel 3). Por isso vira um tipo proprio em vez de mensagem de erro.
 */
export class NoReadYetError extends Error {
  override readonly name = 'NoReadYetError'

  constructor(readonly route: string) {
    super(`${route} ainda nao tem leitura concluida`)
  }
}

/**
 * `404 PROCESSO_NAO_ENCONTRADO`. Tipo proprio pelo mesmo motivo de
 * `NoReadYetError`: a tela precisa distinguir "esta REF nao existe" de "o
 * servidor falhou", e as duas telas sao diferentes.
 */
export class ProcessNotFoundError extends Error {
  override readonly name = 'ProcessNotFoundError'

  constructor(readonly ref: string) {
    super(`Nenhum processo com a REF ${ref}`)
  }
}

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
 * Os 21 indicadores, ja recortados pelos filtros globais.
 *
 * `queryString` vem inteira de `useFilters` — a pagina anexa, nunca remonta:
 * reconstruir os parametros no cliente duplicaria a serializacao dos onze
 * filtros num segundo lugar, e o recorte tem de ser o mesmo que a URL mostra.
 */
export async function getIndicators(
  queryString: string,
  signal?: AbortSignal,
): Promise<IndicatorsResponse> {
  const response = await fetch(`/api/indicators${queryString}`, signal ? { signal } : undefined)
  if (response.status === 503) throw new NoReadYetError('GET /api/indicators')
  if (!response.ok) throw new Error(`GET /api/indicators respondeu ${response.status}`)

  return (await response.json()) as IndicatorsResponse
}

/**
 * A lista de processos, ja filtrada, buscada, ordenada e paginada no servidor.
 *
 * `queryString` carrega os onze filtros globais **e** os parametros da pagina.
 * Como em `getIndicators`, ela vem pronta e e apenas anexada.
 */
export async function getProcesses(
  queryString: string,
  signal?: AbortSignal,
): Promise<ProcessesResponse> {
  const response = await fetch(`/api/processes${queryString}`, signal ? { signal } : undefined)
  if (response.status === 503) throw new NoReadYetError('GET /api/processes')
  if (!response.ok) throw new Error(`GET /api/processes respondeu ${response.status}`)

  return (await response.json()) as ProcessesResponse
}

/**
 * Os alertas, ja recortados pelos filtros globais (RF-18).
 *
 * Mesmo `503` de `getIndicators`: enquanto `lastReadAt` e `null` nao ha leitura
 * a apresentar, e lista vazia ali afirmaria ausencia de pendencia — que e o
 * oposto de "ainda nao se sabe".
 */
export async function getAlerts(
  queryString: string,
  signal?: AbortSignal,
): Promise<AlertsResponse> {
  const response = await fetch(`/api/alerts${queryString}`, signal ? { signal } : undefined)
  if (response.status === 503) throw new NoReadYetError('GET /api/alerts')
  if (!response.ok) throw new Error(`GET /api/alerts respondeu ${response.status}`)

  return (await response.json()) as AlertsResponse
}

/**
 * A serie mensal do historico (RF-14), recortada pelos filtros globais.
 *
 * `months` nao e filtro global: ele vive no estado local da Pagina Historico, e
 * por isso e anexado aqui, depois da `queryString` que ja vem pronta. O
 * separador depende de haver recorte ativo — sem filtro a query esta vazia.
 *
 * Mesmo `503` de `getIndicators`. Serie vazia, ao contrario, e resposta
 * legitima: significa que a planilha foi lida e o historico ainda nao tem
 * evento nenhum (A-43), o que a tela precisa distinguir de "ainda nao se sabe".
 */
export async function getMonthlyHistory(
  queryString: string,
  months: number,
  signal?: AbortSignal,
): Promise<MonthlyHistoryResponse> {
  const separator = queryString === '' ? '?' : '&'
  const response = await fetch(
    `/api/history/monthly${queryString}${separator}months=${months}`,
    signal ? { signal } : undefined,
  )
  if (response.status === 503) throw new NoReadYetError('GET /api/history/monthly')
  if (!response.ok) throw new Error(`GET /api/history/monthly respondeu ${response.status}`)

  return (await response.json()) as MonthlyHistoryResponse
}

/**
 * O detalhe de UM processo, achado pela REF.
 *
 * **Sem `queryString`**: os filtros globais nao valem aqui. O detalhe e sobre um
 * processo, e recortar o conjunto nao muda o que ele mostra — a casca ja esconde
 * a barra nesta rota.
 *
 * `404` vira erro proprio, e nao `NoReadYetError`: REF inexistente e resposta
 * legitima do servidor, distinta de "ainda nao houve leitura".
 */
export async function getProcessDetail(
  ref: string,
  signal?: AbortSignal,
): Promise<ProcessDetailResponse> {
  const response = await fetch(
    `/api/processes/${encodeURIComponent(ref)}`,
    signal ? { signal } : undefined,
  )
  if (response.status === 503) throw new NoReadYetError('GET /api/processes/:ref')
  if (response.status === 404) throw new ProcessNotFoundError(ref)
  if (!response.ok) throw new Error(`GET /api/processes/:ref respondeu ${response.status}`)

  return (await response.json()) as ProcessDetailResponse
}

/**
 * Enfileira uma edicao. **Nao grava no `.xlsx`** — a escrita e de `H-26`.
 *
 * `value: null` esvazia a celula; cancelar e `discardEdit`. O `400` vira erro
 * com a mensagem do servidor, que ja explica qual campo e por que.
 */
export async function enqueueEdit(
  edit: { ref: string; field: string; value: string | null },
  signal?: AbortSignal,
): Promise<EnqueuedEditResponse> {
  const response = await fetch('/api/edits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(edit),
    ...(signal ? { signal } : {}),
  })
  if (response.ok) return (await response.json()) as EnqueuedEditResponse

  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  throw new Error(body?.error?.message ?? `POST /api/edits respondeu ${response.status}`)
}

/** As combinacoes que a aplicacao sabe gravar. Fonte: `config/color-map.json`. */
export async function getColorOptions(signal?: AbortSignal): Promise<ColorOptionsResponse> {
  const response = await fetch('/api/color-options', signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`GET /api/color-options respondeu ${response.status}`)

  return (await response.json()) as ColorOptionsResponse
}

/**
 * Enfileira a troca dos campos codificados em cor (`H-27`). **Nao grava no
 * `.xlsx`** — a gravacao continua sendo o comando de aplicacao.
 *
 * A combinacao precisa existir em `config/color-map.json`; o `400` traz a
 * mensagem do servidor com as que existem.
 */
export async function enqueueColor(
  ref: string,
  target: ColorTarget,
  signal?: AbortSignal,
): Promise<EnqueuedColorResponse> {
  const response = await fetch(`/api/processes/${encodeURIComponent(ref)}/color`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(target),
    ...(signal ? { signal } : {}),
  })
  if (response.ok) return (await response.json()) as EnqueuedColorResponse

  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  throw new Error(
    body?.error?.message ?? `PATCH /api/processes/:ref/color respondeu ${response.status}`,
  )
}

export async function getEdits(signal?: AbortSignal): Promise<EditsListResponse> {
  const response = await fetch('/api/edits', signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`GET /api/edits respondeu ${response.status}`)

  return (await response.json()) as EditsListResponse
}

/**
 * A mensagem que o servidor escreveu, quando ele escreveu uma.
 *
 * As duas rotas de descarte passaram a recusar com `409 ESCRITA_EM_ANDAMENTO`
 * durante uma aplicacao (H-26), e o codigo cru nao diz ao operador o que fazer;
 * a frase da rota diz. Ate H-26 nenhuma delas tinha caminho de erro com corpo,
 * e por isso o status bastava.
 */
async function messageOf(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? fallback
}

export async function discardEdit(id: string): Promise<void> {
  const response = await fetch(`/api/edits/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await messageOf(response, `DELETE /api/edits/:id respondeu ${response.status}`))
  }
}

/**
 * A recusa de uma aplicacao, ja desmontada para a tela.
 *
 * **A tela decide em duas etapas, nesta ordem** (05-contratos-api.md secao 3):
 * primeiro por `conflicts.length` — vazio **nao** e dialogo de conflito, e sim a
 * mensagem do codigo —, e so depois, linha a linha, por `refMissing`. Nao se
 * infere o ramo pelo conteudo: `ARQUIVO_MUDOU` com lista vazia e o caso mais
 * comum de todos, e nao significa que o arquivo mudou durante a gravacao.
 */
/**
 * As sete recusas do guard, mais `ERRO_INTERNO`: um 500 do proprio Fastify —
 * corpo malformado, rota que lancou — nao passa por `WriteRefusal`, e fingir
 * que passou faria a tela ramificar sobre um codigo que o servidor nao disse.
 */
export type ApplyRefusalCode = WriteRefusal | 'ERRO_INTERNO'

const REFUSAL_CODES: readonly string[] = [
  'EXCEL_ABERTO',
  'ARQUIVO_MUDOU',
  'EDICAO_OBSOLETA',
  'NADA_A_APLICAR',
  'ESCRITA_EM_ANDAMENTO',
  'ESCRITA_INVALIDA',
  'ARQUIVO_INDISPONIVEL',
  'ERRO_INTERNO',
]

export interface ApplyRefusal {
  code: ApplyRefusalCode
  message: string
  conflicts: Conflict[]
  expectedHash: string | null
  actualHash: string | null
  /** `true` so quando o backup foi mesmo restaurado — nunca em recusa que nao gravou. */
  restored: boolean
  backupPath: string | null
  /**
   * `true` quando a planilha em disco pode estar invalida: a gravacao aconteceu,
   * a conferencia reprovou, e a restauracao do backup TAMBEM falhou. Derivado de
   * `backupPath` presente com `restored` falso — o servidor so envia os dois
   * quando o arquivo deixou de estar intacto.
   */
  fileAtRisk: boolean
}

/**
 * Recusa esperada, com motivo — nao falha de rede.
 *
 * Erro em vez de retorno de uniao porque as sete recusas sao excepcionais por
 * natureza e o caminho feliz e um so: quem chama trata `catch` uma vez, em vez
 * de ramificar em toda chamada.
 */
export class ApplyRefusedError extends Error {
  readonly refusal: ApplyRefusal

  constructor(refusal: ApplyRefusal) {
    super(refusal.message)
    this.name = 'ApplyRefusedError'
    this.refusal = refusal
  }
}

interface ApplyErrorBody {
  error?: {
    code?: string
    message?: string
    detail?: {
      conflicts?: Conflict[]
      expectedHash?: string
      actualHash?: string
      restored?: boolean
      backupPath?: string
    }
  }
}

/**
 * Grava a fila no `.xlsx`. **O unico ponto da interface que dispara escrita.**
 *
 * Sem `signal`: cancelar do lado do cliente nao cancela a gravacao, que ja
 * seguiu no servidor atras das defesas de `H-25` — abortar aqui so faria a tela
 * perder o resultado de algo que aconteceu.
 */
export async function applyEdits(): Promise<ApplyResponse> {
  const response = await fetch('/api/edits/apply', { method: 'POST' })
  if (response.ok) return (await response.json()) as ApplyResponse

  const body = (await response.json().catch(() => null)) as ApplyErrorBody | null
  const detail = body?.error?.detail

  const code = body?.error?.code

  throw new ApplyRefusedError({
    code:
      code !== undefined && REFUSAL_CODES.includes(code)
        ? (code as ApplyRefusalCode)
        : 'ERRO_INTERNO',
    // `||`, e nao `??`: mensagem vazia e ausencia de mensagem, e `??` a
    // deixaria passar para a tela como um dialogo sem explicacao.
    message: body?.error?.message || `A aplicacao falhou (HTTP ${response.status}).`,
    conflicts: detail?.conflicts ?? [],
    expectedHash: detail?.expectedHash ?? null,
    actualHash: detail?.actualHash ?? null,
    restored: detail?.restored === true,
    backupPath: detail?.backupPath ?? null,
    fileAtRisk: detail?.backupPath !== undefined && detail?.restored !== true,
  })
}

/** Esvazia a fila **inteira**, de todos os processos. */
export async function discardAllEdits(): Promise<number> {
  const response = await fetch('/api/edits', { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await messageOf(response, `DELETE /api/edits respondeu ${response.status}`))
  }

  return ((await response.json()) as { discarded: number }).discarded
}

/**
 * O relatorio da ultima leitura. Responde `200` com relatorio vazio enquanto
 * nao houve leitura, entao nao ha caso de `503` aqui — e `quarantineRate` vem
 * calculado, que e o que mantem o limiar de RNF-24 fora do cliente.
 */
export async function getQuarantine(signal?: AbortSignal): Promise<QuarantineResponse> {
  const response = await fetch('/api/quarantine', signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`GET /api/quarantine respondeu ${response.status}`)

  return (await response.json()) as QuarantineResponse
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
