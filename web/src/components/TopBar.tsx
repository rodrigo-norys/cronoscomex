import type { ApplyRefusal, HealthResponse } from '../api-client.ts'
import { ApplyChangesButton } from './ApplyChangesButton.tsx'
import { RefreshButton } from './RefreshButton.tsx'

/**
 * O topo de UMA linha (`H-59`, `D-22`).
 *
 * A casca empilhava quatro faixas antes do primeiro dado — titulo com acoes,
 * navegacao, filtros e faixa de estado. A navegacao saiu para a lateral e o
 * titulo do produto foi com ela; sobra aqui o que muda de pagina para pagina: o
 * nome da tela, a data do dado e as duas acoes.
 *
 * **O titulo e `h1`, e nao `h2`.** Ele deixou de ser o nome do produto e passou
 * a ser o nome da pagina, que e o que `SC 2.4.6` pede de um cabecalho: descrever
 * o topico. Quem identifica o produto agora e a lateral, onde ele nao compete
 * com o conteudo por hierarquia.
 *
 * Nao decide nada: recebe pronto o que a casca ja tinha.
 */
export function TopBar({
  title,
  health,
  refreshing,
  onRefresh,
  onRefused,
}: {
  title: string
  health: HealthResponse | null
  refreshing: boolean
  onRefresh: () => Promise<void>
  onRefused: (refusal: ApplyRefusal) => void
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-raised px-6 py-3">
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {health && (
          <span className="text-sm text-text-muted">
            Dados de <time dateTime={health.today}>{formatDay(health.today)}</time>
          </span>
        )}
        <ApplyChangesButton
          pendingCount={health?.pendingEditsCount ?? 0}
          onApplied={onRefresh}
          onRefused={onRefused}
        />
        <RefreshButton onRefresh={onRefresh} busy={refreshing} />
      </div>
    </header>
  )
}

/**
 * Campo ausente vira travessao, nunca excecao.
 *
 * O tipo diz `string`, mas ele descreve o contrato, nao a resposta que chegou:
 * dado de rede nao e verificado em execucao. Um servidor de versao anterior —
 * medido, com o `--watch` servindo codigo velho — devolvia o corpo **sem**
 * `today`, e `undefined.split` derrubava a casca inteira, com a faixa de estado
 * e a navegacao junto. Tela branca e o pior dos buracos invisiveis (regra 3).
 */
function formatDay(isoDay: string | undefined): string {
  const parts = isoDay?.split('-')
  if (parts === undefined || parts.length !== 3) return '—'

  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}
