import type { HealthResponse } from '../api-client.ts'

/**
 * A faixa de estado vive na casca, nunca nas paginas (A-57).
 *
 * O plano original so previa o aviso na Pagina Inicial, deixando as outras seis
 * sem indicativo algum de que o numero na tela esta congelado. Aqui ela envolve
 * todas por construcao — pagina nova nao precisa lembrar de nada.
 */

export type SignalKey = 'conflito' | 'degradado' | 'arquivoAberto'

export interface StatusSignal {
  readonly key: SignalKey
  readonly title: string
  readonly detail: string
  readonly files: readonly string[]
}

/**
 * Os sinais ativos, do mais severo ao menos.
 *
 * Conflito vem primeiro porque significa duas versoes da planilha coexistindo
 * na pasta — alguem ja perdeu trabalho. Depois o dado congelado, que e numero
 * velho na tela. Por ultimo o arquivo aberto, que e so contexto: a leitura
 * acontece igual (A-58). **Todos os ativos aparecem**; nenhum encobre o outro.
 */
export function bannerSignals(health: HealthResponse): readonly StatusSignal[] {
  const signals: StatusSignal[] = []

  if (health.conflictFiles.length > 0) {
    signals.push({
      key: 'conflito',
      title: 'O OneDrive gerou arquivo de conflito',
      detail:
        'Duas versões da planilha coexistem na pasta, e o painel está lendo apenas uma. ' +
        'Resolva o conflito no OneDrive antes de continuar editando.',
      files: health.conflictFiles,
    })
  }

  if (health.state === 'degradado') {
    signals.push({
      key: 'degradado',
      title: 'Dado congelado',
      detail: freezeDetail(health),
      files: [],
    })
  }

  if (health.externalLock) {
    signals.push({
      key: 'arquivoAberto',
      title: 'Alguém está com a planilha aberta no Excel',
      detail: 'A leitura continua normal. O aviso existe para explicar edições que aparecerem.',
      files: [],
    })
  }

  return signals
}

function freezeDetail(health: HealthResponse): string {
  const reason = health.degradedReason ?? 'A planilha não pôde ser lida.'
  return health.lastReadAt === null
    ? `${reason} Ainda não houve nenhuma leitura bem-sucedida.`
    : `${reason} Última leitura bem-sucedida: ${formatInstant(health.lastReadAt)}.`
}

function formatInstant(isoInstant: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(isoInstant),
  )
}

const SIGNAL_STYLE: Record<SignalKey, string> = {
  conflito: 'border-red-300 bg-red-50 text-red-900',
  degradado: 'border-amber-300 bg-amber-50 text-amber-900',
  arquivoAberto: 'border-sky-300 bg-sky-50 text-sky-900',
}

export function StatusBanner({ health }: { health: HealthResponse | null }) {
  if (health === null) return null

  const signals = bannerSignals(health)
  if (signals.length === 0) return null

  return (
    <div className="flex flex-col gap-px">
      {signals.map((signal) => (
        <div
          key={signal.key}
          role={signal.key === 'arquivoAberto' ? 'status' : 'alert'}
          className={`border-y px-6 py-3 text-sm ${SIGNAL_STYLE[signal.key]}`}
        >
          <strong className="font-semibold">{signal.title}</strong> {signal.detail}
          {signal.files.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-mono text-xs">
              {signal.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
