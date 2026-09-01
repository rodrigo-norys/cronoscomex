import type { IndicatorsResponse } from '../api-client.ts'
import { PageAlert } from '../components/PageAlert.tsx'
import { RankingBar } from '../components/RankingBar.tsx'
import {
  type FilterSelection,
  MULTI_FILTER_LABELS,
  MULTI_FILTERS,
  type MultiFilterKey,
  useFilters,
} from '../hooks/useFilters.ts'
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
 *
 * **A pagina diz o que mede e sobre o que mede** (`H-53`). Duas perguntas do
 * levantamento de uso morreram aqui, e nenhuma era defeito de calculo: qual e a
 * metrica — correta desde IND-22 — e se dava para filtrar por cliente e
 * importador — dava desde `H-15`. Aplicacao certa e muda e a variante mais
 * barata de defeito, e a mais facil de deixar aberta para sempre.
 *
 * **Nada aqui passa a ser calculado no cliente.** A formula e a lista de filtros
 * ativos sao apresentacao de regras que ja existem: a primeira vem de A-02, a
 * segunda da propria URL, que e o unico estado dos filtros.
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
      <PageAlert
        className="panel-error"
        announcement={`Não foi possível carregar a performance. ${state.message}`}
      >
        <strong className="font-semibold">Não foi possível carregar a performance.</strong>{' '}
        {state.message}
      </PageAlert>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <PageAlert
        tone="status"
        className="panel-no-read"
        announcement="Nenhuma leitura da planilha foi concluída ainda. Os tempos aparecem assim que a primeira terminar — traço aqui não significa zero dia."
      >
        Nenhuma leitura da planilha foi concluída ainda. Os tempos aparecem assim que a primeira
        terminar — traço aqui não significa zero dia.
      </PageAlert>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando performance…</p>
  }

  const { documentaryLeadTime, leadTimeByGroup, rankings, meta } = state.indicators

  return (
    <div className="flex flex-col gap-4">
      <ActiveScope selection={filters.selection} activeCount={filters.activeCount} />

      <Aggregate leadTime={documentaryLeadTime} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

/**
 * O recorte que a pagina esta exibindo, dito em vez de suposto (`H-53`).
 *
 * A pagina SEMPRE respeitou os filtros globais (RF-18) — o que faltava era
 * dizer isso. O operador perguntou se dava para filtrar por cliente e
 * importador; dava desde `H-15`, e a funcionalidade era invisivel.
 *
 * **Nao recalcula nada** (regra inviolavel 6): le a selecao da URL, que e o
 * unico estado dos filtros, e a nomeia. Quem recortou os numeros foi o servidor.
 */
function ActiveScope({
  selection,
  activeCount,
}: {
  selection: FilterSelection
  activeCount: number
}) {
  const ativos: string[] = []

  for (const key of MULTI_FILTERS) {
    const valores = selection.multi[key]
    if (valores.length === 0) continue
    ativos.push(
      valores.length === 1
        ? `${MULTI_FILTER_LABELS[key]}: ${valores[0] === '' ? '(em branco)' : valores[0]}`
        : `${MULTI_FILTER_LABELS[key]}: ${valores.length} valores`,
    )
  }

  if (selection.etaFrom !== '' || selection.etaTo !== '') {
    const inicio = selection.etaFrom === '' ? 'início' : formatDay(selection.etaFrom)
    const fim = selection.etaTo === '' ? 'hoje em diante' : formatDay(selection.etaTo)
    ativos.push(`Período (ETA2): ${inicio} a ${fim}`)
  }

  if (selection.importerOutsideRj !== '') {
    ativos.push(
      selection.importerOutsideRj === 'true'
        ? 'Importador fora do RJ: sim'
        : 'Importador fora do RJ: não',
    )
  }

  return (
    <section
      aria-label="Recorte ativo"
      className="rounded border border-border-subtle bg-surface-sunken px-4 py-3 text-xs text-text-secondary"
    >
      {activeCount === 0 ? (
        <p>
          <strong className="font-semibold">Sem filtro ativo:</strong> os números abaixo cobrem a
          base inteira. Para recortá-los — por cliente, importador, agente, navio ou período —, use
          a barra de filtros no topo da página; ela vale para todas as telas.
        </p>
      ) : (
        <>
          <p>
            <strong className="font-semibold">
              {activeCount === 1 ? '1 filtro ativo' : `${activeCount} filtros ativos`}
            </strong>{' '}
            recortando os números abaixo:
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {ativos.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** `AAAA-MM-DD` como o operador lê. Formatação, nunca cálculo. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** O agregado de IND-22, com as duas exclusões de A-30 à vista. */
function Aggregate({ leadTime }: { leadTime: IndicatorsResponse['documentaryLeadTime'] }) {
  return (
    <section
      aria-label="Tempo médio de envio documental"
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Tempo médio de envio documental</h2>

      {/* `H-53`. A formula junto do agregado, e nao em nota de rodape: o
          operador perguntou o que a metrica media, e a resposta estava correta
          desde IND-22 — so nao estava escrita. A ordem das duas datas e a que
          A-02 fixou; a invertida produziria valor negativo, porque RG e a
          extremidade final do intervalo. */}
      <p className="mt-1 text-xs text-text-secondary">
        <strong className="font-semibold">RG − DOCS ENVIADOS</strong>, em dias inteiros: quantos
        dias se passaram entre o envio da documentação e o registro. Média sobre os processos que
        têm <strong>as duas</strong> datas.
      </p>

      <p className="mt-2 flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tabular-nums">
          {formatDays(leadTime.averageDays)}
        </strong>
        <span className="text-sm text-text-muted">
          sobre {leadTime.sampleSize.toLocaleString('pt-BR')}{' '}
          {leadTime.sampleSize === 1 ? 'processo medido' : 'processos medidos'}
        </span>
      </p>

      {/* Amostra zerada e o caso-limite: traco, nunca zero dia — media de
          conjunto vazio nao e zero (A-42) —, e a tela diz POR QUE, senao o
          traco parece falha de carregamento. */}
      {leadTime.sampleSize === 0 && (
        <p className="mt-1 text-xs text-text-secondary">
          O traço significa que{' '}
          <strong className="font-semibold">nenhum processo do recorte</strong> tem o par completo
          de datas — não que o tempo seja zero.
        </p>
      )}
      {/* As duas exclusoes de A-30 seguem contadas, agora com o que cada uma
          significa: numero sem explicacao e descarte que parece medicao. */}
      <p className="mt-2 text-xs text-text-secondary">
        <strong className="font-semibold">Excluídos e contados</strong> (A-30):{' '}
        <strong className="tabular-nums">
          {leadTime.excludedIncomplete.toLocaleString('pt-BR')}
        </strong>{' '}
        <span>
          sem uma das duas datas — falta RG, DOCS ENVIADOS, ou as duas, e sem par não há intervalo a
          medir
        </span>{' '}
        ·{' '}
        <strong className="tabular-nums">
          {leadTime.excludedNegative.toLocaleString('pt-BR')}
        </strong>{' '}
        <span>
          com intervalo negativo — o registro está datado antes do envio, o que é divergência da
          planilha e não tempo de zero dia
        </span>
        . Nenhum dos dois entra na média; ambos continuam contados aqui, porque descartar em
        silêncio esconderia o tamanho real da lacuna.
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
          {/* `ACHADO 19`. A exceção bidimensional de `SC 1.4.10` cobre a
              TABELA, e não a página: sem o invólucro, as quatro quebras
              arrastam as notas irmãs e a barra de filtros para a rolagem
              horizontal. Mesmo padrão que `ProcessTable` já usa. */}
          <div className="overflow-x-auto">
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
                    {/* `VN-2` mediu o truncamento CRESCENDO com a ampliacao,
                        e nenhuma das celulas tinha `title` — o texto cortado
                        nao tinha recurso nenhum (`H-69`). `max-w-0` espremia a
                        coluna ao minimo e `truncate` cortava o que sobrasse;
                        agora o rotulo quebra em linhas e a coluna toma o espaco
                        que as tres numericas nao usam. Medido nos quatro
                        cenarios de ampliacao: zero celulas cortadas, contra 31
                        a 100% e 41 a 640 px com fonte 24. Nada foi acrescentado
                        a celula que ja cabia — sem `title`, sem parada de
                        tabulacao. */}
                    <td className="break-words py-1 pr-2">
                      {group.label === '' ? '(sem valor)' : group.label}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatDays(group.averageDays)}
                    </td>
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
          </div>

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
 * De onde vem o responsavel, e o que significa a linha sem ele.
 *
 * **Este texto dizia o contrario ate `H-66`**, e estava certo enquanto disse: a
 * cor era a unica fonte, linha vermelha ou verde perdia o responsavel (A-31,
 * R-02), e `Indefinido` liderava com 484 dos 649. `H-50` trocou a fonte para o
 * importador, e a limitacao de A-31 deixou de valer para este campo — ela
 * continua valendo para a COR, que agora e o outro filtro da barra.
 */
function ResponsibleCaveat() {
  return (
    <p className="mt-2 rounded border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-secondary">
      O responsável vem do <strong>importador</strong>, e a cor da linha decide o que a lista de
      importadores não alcança. <strong>Sem responsável</strong> é o processo que não tem nem uma
      coisa nem a outra — ele aparece aqui de propósito, porque escondê-lo faria o ranking parecer
      completo. Para recortar por <strong>o que a linha está pintada</strong>, use o filtro Cor do
      responsável na barra do topo: ele responde outra pergunta, e uma linha vermelha ou verde não a
      responde (A-31).
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
