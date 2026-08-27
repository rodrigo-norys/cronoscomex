import type { HealthResponse } from '../api-client.ts'
import { navigate, WORKBOOK_SETUP_PAGE } from '../router.ts'

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
      // "Dado congelado" pressupoe dado a congelar. Na primeira execucao nao ha
      // nenhum, e o titulo contradizia o proprio detalhe logo abaixo — que ja
      // dizia que nunca houve leitura. E a distincao que `H-34` fixou entre dado
      // congelado e ausencia de dado, aplicada ao texto. Medido em Windows, H-35.
      title: firstRun(health) ? 'Nenhuma planilha configurada' : 'Dado congelado',
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

/** Nunca houve leitura E nao ha caminho: o estado de primeira execucao (H-34). */
function firstRun(health: HealthResponse): boolean {
  return health.lastReadAt === null && health.workbookPath === ''
}

function freezeDetail(health: HealthResponse): string {
  const reason = health.degradedReason ?? 'A planilha não pôde ser lida.'
  // Na primeira execucao a razao do servidor e o proprio titulo, e repeti-la
  // aqui diria a mesma frase duas vezes na mesma faixa. O detalhe acrescenta o
  // que vem em seguida — que e o unico dado novo que existe neste estado.
  if (firstRun(health)) {
    return 'O painel começa a ler assim que você informar o caminho da planilha.'
  }
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
  conflito: 'border-state-error-border bg-state-error-bg text-state-error-fg',
  degradado: 'border-state-warning-border bg-state-warning-bg text-state-warning-fg',
  arquivoAberto: 'border-state-info-border bg-state-info-bg text-state-info-fg',
}

/**
 * O terceiro caminho ate a tela de configuracao (`H-38`), e o mais importante:
 * a planilha nao pode ser lida, e o conserto quase sempre e apontar o arquivo
 * certo. Sem isto o operador le que o dado esta congelado e nao tem para onde ir.
 *
 * So no sinal de `degradado`. Conflito do OneDrive se resolve no Explorer, e
 * arquivo aberto no Excel nao se resolve em lugar nenhum — e so contexto (A-58).
 */
function SetupLink() {
  return (
    <button
      type="button"
      onClick={() => navigate(WORKBOOK_SETUP_PAGE.path)}
      className="ml-2 rounded border border-state-warning-fg px-2 py-0.5 font-medium text-state-warning-fg text-xs hover:bg-state-warning-bg"
    >
      Conferir a planilha configurada
    </button>
  )
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
          {signal.key === 'degradado' && <SetupLink />}
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
