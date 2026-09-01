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
    /*
      **`<a href>`, e nao `<button>`** (`H-75`, `ACHADO 6`). Navegar e navegar:
      era o unico dos TRES acessos a `/configuracao` que usava outro papel, e
      `SC 4.1.2` mais a falha `F31` de `SC 3.2.4` incidem porque as sete telas
      tem URIs distintas. Como `<button>`, `Ctrl`+clique e o botao do meio nao
      abriam em outra aba, e o endereco nao aparecia na barra de estado.

      O nome tambem convergiu: os tres dizem "Configuracao", o rotulo canonico
      de `router.ts`. Alinhar por `aria-label` estava fora — o nome acessivel
      precisa CONTER o texto visivel (`SC 2.5.3`).

      O interceptador de modificador e o de `ProcessTable`.
    */
    <a
      href={WORKBOOK_SETUP_PAGE.path}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(WORKBOOK_SETUP_PAGE.path)
      }}
      className="ml-2 rounded-control border border-state-warning-fg px-2 py-0.5 font-medium text-state-warning-fg text-xs hover:bg-state-warning-bg"
    >
      Configuração
    </a>
  )
}

/**
 * As DUAS regioes vivem desde a montagem, e os sinais entram dentro delas
 * (`H-43`).
 *
 * Sao duas porque os papeis sao dois: `arquivoAberto` e contexto — o operador
 * nao precisa agir —, e os demais interrompem. Montar cada sinal com o seu
 * `role` ja populado era o `ACHADO 11`: o no nascia com o texto, e o leitor de
 * tela nao tinha o que comparar.
 *
 * **O estilo mora no filho, nunca no contentor.** Sem sinal, as duas regioes sao
 * nos vazios sem borda, fundo nem espacamento — o criterio nao e ausencia do no,
 * e ausencia de caixa vazia na tela.
 */
export function StatusBanner({ health }: { health: HealthResponse | null }) {
  const signals = health === null ? [] : bannerSignals(health)
  const alerts = signals.filter((signal) => signal.key !== 'arquivoAberto')
  const status = signals.filter((signal) => signal.key === 'arquivoAberto')

  return (
    <div className="flex flex-col gap-px">
      <div role="alert" className="flex flex-col gap-px">
        {alerts.map((signal) => (
          <Signal key={signal.key} signal={signal} />
        ))}
      </div>
      <div role="status" className="flex flex-col gap-px">
        {status.map((signal) => (
          <Signal key={signal.key} signal={signal} />
        ))}
      </div>
    </div>
  )
}

function Signal({ signal }: { signal: StatusSignal }) {
  return (
    <div className={`border-y px-6 py-3 text-sm ${SIGNAL_STYLE[signal.key]}`}>
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
  )
}
