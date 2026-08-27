import type { IndicatorsResponse } from '../api-client.ts'
import { RankingBar } from '../components/RankingBar.tsx'
import { type MultiFilterKey, useFilters } from '../hooks/useFilters.ts'
import { useIndicators } from '../hooks/useIndicators.ts'
import { navigate } from '../router.ts'

/**
 * Pagina Performance (RF-12): IND-22 quebrado em quatro dimensoes, mais os
 * rankings de volume por agente (IND-17) e por responsavel (IND-20).
 *
 * Os dois rankings entraram por A-65 — eram calculados desde `H-11`, servidos, e
 * nenhuma pagina os exibia. Com IND-17 se perdia o `overdueCount` de A-27, que
 * existe porque volume por agente nao atende ao objetivo declarado: o que
 * importa e quem acumula atraso.
 *
 * **O denominador nunca sai do lado da media** (A-42). Medido na planilha real:
 * so 101 dos 649 processos tem as duas datas, e a media de um grupo pode vir de
 * uma unica medicao — numero sem amostra ao lado convida a conclusao errada.
 */

type LeadTimeGroup = IndicatorsResponse['leadTimeByGroup']['clients'][number]
type Breakdowns = IndicatorsResponse['leadTimeByGroup']

interface PerformanceProps {
  queryString: string
  dataVersion: number
}

interface BreakdownDefinition {
  readonly source: keyof Omit<Breakdowns, 'groupTotals'>
  readonly title: string
  readonly unit: string
}

const BREAKDOWNS: readonly BreakdownDefinition[] = [
  { source: 'clients', title: 'Tempo documental por cliente', unit: 'cliente' },
  { source: 'agents', title: 'Tempo documental por agente', unit: 'agente' },
  { source: 'vessels', title: 'Tempo documental por navio', unit: 'navio' },
  { source: 'responsible', title: 'Tempo documental por responsável', unit: 'responsável' },
]

export function Performance({ queryString, dataVersion }: PerformanceProps) {
  const state = useIndicators(queryString, dataVersion)
  const filters = useFilters()

  // Mesma regra da Pagina Clientes: aplicar, nao alternar, e escrever o filtro
  // antes de navegar — `replaceState` e sincrono, e a ordem inversa perderia o
  // recorte.
  const selectAndOpen = (key: MultiFilterKey, value: string): void => {
    if (!filters.selection.multi[key].includes(value)) filters.toggle(key, value)
    navigate('/operacional')
  }

  if (state.status === 'erro') {
    return (
      <p role="alert" className="panel-error">
        <strong className="font-semibold">Não foi possível carregar a performance.</strong>{' '}
        {state.message}
      </p>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <p role="status" className="panel-no-read">
        Nenhuma leitura da planilha foi concluída ainda. Os tempos aparecem assim que a primeira
        terminar — traço aqui não significa zero dia.
      </p>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando performance…</p>
  }

  const { documentaryLeadTime, leadTimeByGroup, rankings, meta } = state.indicators

  return (
    <div className="flex flex-col gap-4">
      <Aggregate leadTime={documentaryLeadTime} />

      <div className="grid gap-4 lg:grid-cols-2">
        {BREAKDOWNS.map((breakdown) => (
          <LeadTimeTable
            key={breakdown.source}
            title={breakdown.title}
            unit={breakdown.unit}
            groups={leadTimeByGroup[breakdown.source]}
            total={leadTimeByGroup.groupTotals[breakdown.source]}
            shown={leadTimeByGroup[breakdown.source].length}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingBar
          title="Agentes"
          entries={rankings.agents}
          emptyMessage="Nenhum agente no recorte atual."
          onSelect={(value) => selectAndOpen('agent', value)}
          secondary={(entry) => <OverdueBadge overdue={entry.overdueCount} />}
        />

        <RankingBar
          title="Responsáveis"
          entries={rankings.responsible}
          emptyMessage="Nenhum responsável no recorte atual."
          caveat={<ResponsibleCaveat />}
        />
      </div>

      <OutOfScopeNote topN={meta.topN} />
    </div>
  )
}

/** O agregado de IND-22, com as duas exclusões de A-30 à vista. */
function Aggregate({ leadTime }: { leadTime: IndicatorsResponse['documentaryLeadTime'] }) {
  return (
    <section
      aria-label="Tempo médio de envio documental"
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Tempo médio de envio documental</h2>
      <p className="mt-2 flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tabular-nums">
          {formatDays(leadTime.averageDays)}
        </strong>
        <span className="text-sm text-text-muted">
          sobre {leadTime.sampleSize.toLocaleString('pt-BR')}{' '}
          {leadTime.sampleSize === 1 ? 'processo medido' : 'processos medidos'}
        </span>
      </p>
      <p className="mt-2 text-xs text-text-secondary">
        Excluídos e contados (A-30):{' '}
        <strong className="tabular-nums">
          {leadTime.excludedIncomplete.toLocaleString('pt-BR')}
        </strong>{' '}
        sem uma das duas datas ·{' '}
        <strong className="tabular-nums">
          {leadTime.excludedNegative.toLocaleString('pt-BR')}
        </strong>{' '}
        com intervalo negativo.
      </p>
    </section>
  )
}

interface LeadTimeTableProps {
  title: string
  unit: string
  groups: readonly LeadTimeGroup[]
  total: number
  shown: number
}

/**
 * Uma quebra. As linhas chegam ordenadas por **tamanho da amostra**, e nao por
 * volume: dos 509 grupos de cliente da planilha real, 425 nao tem nenhum par
 * completo, e ordenar por volume deixaria a media fora do corte.
 *
 * O que o teto cortou aparece no rodape — recorte que nao se anuncia e descarte
 * silencioso (regra inviolavel 2).
 */
function LeadTimeTable({ title, unit, groups, total, shown }: LeadTimeTableProps) {
  return (
    <section
      aria-label={title}
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>

      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">Nenhum {unit} no recorte atual.</p>
      ) : (
        <>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                <th className="pb-1 font-medium">{unit}</th>
                <th className="pb-1 text-right font-medium">média</th>
                <th className="pb-1 text-right font-medium">amostra</th>
                <th className="pb-1 text-right font-medium">processos</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.key} className="border-b border-border-subtle last:border-0">
                  <td className="max-w-0 truncate py-1 pr-2">
                    {group.label === '' ? '(sem valor)' : group.label}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatDays(group.averageDays)}</td>
                  <td className="py-1 text-right tabular-nums text-text-muted">
                    {group.sampleSize.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-1 text-right tabular-nums text-text-muted">
                    {group.count.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > shown && (
            <p className="mt-2 text-xs text-text-muted">
              Exibindo {shown} de {total.toLocaleString('pt-BR')} grupos, os de maior amostra.
            </p>
          )}
        </>
      )}
    </section>
  )
}

/** A-27: volume sozinho não avalia agente nenhum. */
function OverdueBadge({ overdue }: { overdue: number | undefined }) {
  if (overdue === undefined) return null

  return (
    <span className={overdue > 0 ? 'font-semibold text-state-warning-fg' : 'text-text-muted'}>
      {overdue.toLocaleString('pt-BR')} {overdue === 1 ? 'atrasado' : 'atrasados'}
    </span>
  )
}

/**
 * Por que a linha não leva à Operacional, e por que `Indefinido` é o maior
 * grupo. A-31 e R-02: a cor da linha é a única fonte do responsável, e linha
 * vermelha ou verde a perde — 477 verdes, medido.
 */
function ResponsibleCaveat() {
  return (
    <p className="mt-2 rounded border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-secondary">
      O responsável vem da cor da linha, e linha vermelha ou verde não o carrega (A-31) — por isso{' '}
      <strong>Indefinido</strong> costuma liderar. As linhas não são clicáveis: o filtro por
      Colaborador 1 seleciona também os outros clientes dele (A-18), e o recorte não bateria com a
      contagem acima.
    </p>
  )
}

/** IND-21 não tem tela porque não tem dado — e isso precisa estar dito. */
function OutOfScopeNote({ topN }: { topN: number }) {
  return (
    <section
      aria-label="Fora de escopo"
      className="rounded border border-dashed border-border-subtle bg-surface-sunken p-4 text-xs text-text-secondary"
    >
      <p>
        <strong className="font-semibold text-text-secondary">
          Tempo médio até desembaraço não é exibido.
        </strong>{' '}
        O cálculo exige a data de presença de carga, que a planilha não tem (§4 da especificação).
        Estimá-lo a partir de outra data produziria um número plausível e errado.
      </p>
      <p className="mt-2">
        As três primeiras quebras mostram até {topN} grupos cada, os de maior amostra. A quebra por
        responsável vem inteira — são quatro chaves fixas, e todas aparecem, inclusive zeradas
        (A-28).
      </p>
    </section>
  )
}

/** Traço, nunca `0`: média de amostra vazia não é zero dia (A-42). */
function formatDays(days: number | null): string {
  return days === null ? '—' : `${days.toLocaleString('pt-BR')} d`
}
