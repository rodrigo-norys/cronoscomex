import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyHistoryResponse } from '../api-client.ts'
import { PageAlert } from '../components/PageAlert.tsx'
import { useHistory } from '../hooks/useHistory.ts'

/**
 * Pagina Historico (RF-14): a evolucao mensal de volume, desembaracados e
 * Canal Vermelho, servida inteira por `GET /api/history/monthly`.
 *
 * **Cada ponto e o estado ao fim do mes**, nao a contagem de eventos dele — mes
 * sem evento algum repete o anterior, porque ausencia de mudanca nao e ausencia
 * de processos. Quem repete e o dominio (`aggregateMonthly`); aqui nao se
 * calcula nada, nem se preenche buraco.
 *
 * **Nao ha retroatividade** (A-43): a serie OBSERVADA comeca quando o historico
 * passou a ser gravado, e a tela diz isso em vez de deixar o operador supor que
 * o grafico cobre a planilha inteira. Serie vazia e um terceiro estado, distinto
 * de `semLeitura` — ver `useHistory`.
 *
 * **Duas series, nunca emendadas** (`H-54`). A observada sai dos eventos que a
 * aplicacao viu; a reconstruida sai das datas que a planilha carrega. Elas
 * aparecem no mesmo eixo, com tracado e nome distintos, e a legenda diz qual e
 * qual — juntar as duas numa linha so afirmaria continuidade que nao existe, que
 * e exatamente o que A-43 proibe. Divergirem no mesmo mes e informacao sobre a
 * planilha, e por isso as duas ficam a vista.
 *
 * O grafico e `aria-hidden` e a tabela ao lado carrega os mesmos numeros: o SVG
 * do Recharts nao e legivel por leitor de tela, e o operador nao e tecnico.
 */

const WINDOWS = [12, 24, 60] as const
type WindowMonths = (typeof WINDOWS)[number]

const DEFAULT_WINDOW: WindowMonths = 12

interface MeasureDefinition {
  readonly key: 'total' | 'desembaracados' | 'canalVermelho'
  readonly label: string
  /**
   * Le o token de `web/src/index.css`, e nao um literal: dois dos tres valores
   * de eixo e grade que viviam aqui ja eram passo da v3 do Tailwind, divergindo
   * da paleta que o resto do conjunto usa (`H-42`).
   *
   * Validado contra fundo claro: pior par adjacente com ΔE 13,1 em deuteranopia.
   */
  readonly color: string
}

const MEASURES: readonly MeasureDefinition[] = [
  { key: 'total', label: 'Volume (observado)', color: 'var(--color-chart-series-1)' },
  {
    key: 'desembaracados',
    label: 'Desembaraçados (observado)',
    color: 'var(--color-chart-series-2)',
  },
  {
    key: 'canalVermelho',
    label: 'Canal Vermelho (observado)',
    color: 'var(--color-chart-series-3)',
  },
]

/**
 * As duas medidas reconstruidas (`H-54`), tracejadas para se distinguirem das
 * observadas **sem depender de cor** — o tracado e um canal a mais, e a legenda
 * escreve "reconstruído" em cada nome.
 *
 * Nao ha Canal Vermelho aqui: a cor e o estado de hoje e nao carrega data, entao
 * projeta-la para tras afirmaria o que ninguem observou (regra inviolavel 3).
 */
const RECONSTRUCTED_MEASURES = [
  { key: 'r_chegados', label: 'Volume (reconstruído)', color: 'var(--color-chart-series-1)' },
  {
    key: 'r_desembaracados',
    label: 'Desembaraçados (reconstruído)',
    color: 'var(--color-chart-series-2)',
  },
] as const

interface HistoryProps {
  queryString: string
  dataVersion: number
}

export function History({ queryString, dataVersion }: HistoryProps) {
  const [months, setMonths] = useState<WindowMonths>(DEFAULT_WINDOW)
  const state = useHistory(queryString, months, dataVersion)

  if (state.status === 'erro') {
    return (
      <PageAlert
        className="panel-error"
        announcement={`Não foi possível carregar o histórico. ${state.message}`}
      >
        <strong className="font-semibold">Não foi possível carregar o histórico.</strong>{' '}
        {state.message}
      </PageAlert>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <PageAlert
        tone="status"
        className="panel-no-read"
        announcement="Nenhuma leitura da planilha foi concluída ainda. A série aparece assim que a primeira terminar — gráfico vazio aqui não significa zero processo."
      >
        Nenhuma leitura da planilha foi concluída ainda. A série aparece assim que a primeira
        terminar — gráfico vazio aqui não significa zero processo.
      </PageAlert>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando histórico…</p>
  }

  const { series, reconstructed, historyStartedAt, truncated } = state.history

  return (
    <div className="flex flex-col gap-4">
      {/* `H-54`: o estado vazio de `H-21` nao e substituido, e acompanhado — a
          reconstruida aparece sozinha, e a tela segue dizendo que nao ha
          observacao. */}
      {series.length === 0 && <EmptyHistory alone={reconstructed.points.length === 0} />}

      {(series.length > 0 || reconstructed.points.length > 0) && (
        <>
          {series.length > 0 && <WindowPicker months={months} onChange={setMonths} />}
          <MonthlySeries series={series} reconstructed={reconstructed} />
          <ReconstructionNote reconstructed={reconstructed} />
          {series.length > 0 && (
            <>
              <StartNote startedAt={historyStartedAt} />
              <VolumeNote />
              {truncated && <TruncatedNote months={months} pointCount={series.length} />}
            </>
          )}
        </>
      )}

      {queryString !== '' && <FilterCaveat />}
    </div>
  )
}

/**
 * O que a reconstrucao NAO cobre, dito com o numero (`H-54`).
 *
 * Processo sem `ETA2` nao entra no volume reconstruido, e sem data de registro
 * nao entra nos desembaracados: data ausente nao pertence a mes nenhum (A-20), e
 * sumir sem contagem seria descarte silencioso (regra inviolavel 2). Medido em
 * 31/08/2026: 64 dos 649 sem `ETA2` e 166 sem `RG`.
 */
function ReconstructionNote({
  reconstructed,
}: {
  reconstructed: MonthlyHistoryResponse['reconstructed']
}) {
  const previsao = reconstructed.points.filter((point) => point.forecast)

  return (
    <p className="rounded-container border border-border-subtle bg-surface-sunken px-4 py-3 text-xs text-text-secondary">
      A série <strong className="font-semibold">reconstruída</strong> é derivada das datas que a
      planilha carrega, e não do que a aplicação observou — as duas aparecem separadas de propósito,
      e divergirem num mês é informação sobre a planilha, não erro.{' '}
      <strong className="font-semibold">{reconstructed.missingEta2.toLocaleString('pt-BR')}</strong>{' '}
      processos não têm ETA2 e ficam fora do volume reconstruído;{' '}
      <strong className="font-semibold">
        {reconstructed.missingRegistration.toLocaleString('pt-BR')}
      </strong>{' '}
      não têm data de registro e ficam fora dos desembaraçados.
      {previsao.length > 0 && (
        <>
          {' '}
          Os {previsao.length === 1 ? 'último mês' : `últimos ${previsao.length} meses`} da série —
          a partir de {formatMonth(previsao[0]?.month ?? '')} — são{' '}
          <strong className="font-semibold">previsão</strong>: a data já está na planilha, o mês
          ainda não aconteceu.
        </>
      )}
    </p>
  )
}

/**
 * Serie vazia com `historyStartedAt` nulo: a planilha foi lida, e o arquivo de
 * historico esta vazio ou foi apagado. Nao e erro, e nao e zero processo — e
 * ausencia de passado registrado, que so a proxima leitura resolve.
 *
 * Sem `role="status"`: ele substituiria o papel de regiao, e a secao da serie
 * precisa ser a mesma marca nos dois estados, cheio e vazio.
 *
 * **`alone` decide o rotulo da regiao** (`H-54`). Sozinha, ela E a secao da
 * serie e mantem o nome que `H-21` fixou. Acompanhada da reconstruida, o nome
 * pertence ao grafico, e duas landmarks homonimas na mesma pagina deixariam o
 * leitor de tela sem como distingui-las.
 */
function EmptyHistory({ alone }: { alone: boolean }) {
  return (
    <section
      aria-label={alone ? 'Evolução mensal' : 'Histórico observado'}
      className="rounded-container border border-border-subtle bg-surface-raised p-6 text-sm"
    >
      <h2 className="text-base font-semibold text-text-secondary">
        Ainda não há histórico registrado.
      </h2>
      <p className="mt-2 text-text-secondary">
        A série é montada a partir das mudanças que a aplicação observa a cada leitura da planilha,
        e o primeiro ponto aparece na próxima. Um gráfico zerado aqui afirmaria que não há
        processos, o que é diferente de não haver passado gravado.
      </p>
      <p className="mt-2 text-text-secondary">
        <strong className="font-semibold">Não há retroatividade</strong> (A-43): a aplicação não
        reconstrói o histórico anterior à sua primeira execução, porque a planilha guarda o estado
        de hoje e não o de cada mês.
      </p>
    </section>
  )
}

function WindowPicker({
  months,
  onChange,
}: {
  months: WindowMonths
  onChange: (next: WindowMonths) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2 rounded-container border border-border-subtle bg-surface-raised px-4 py-3">
      <legend className="sr-only">Janela da série</legend>
      <span className="text-sm text-text-secondary">Janela:</span>
      {WINDOWS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === months}
          onClick={() => onChange(option)}
          /*
            `ACHADO 13`. A ESPESSURA da borda e o canal nao-cromatico: sob
            `forced-colors: active` o agente de usuario substitui a cor, e o
            selecionado ficaria indistinguivel dos outros dois. O `aria-pressed`
            acima ja resolve o eixo programatico; isto resolve o visual.
          */
          className={`rounded-control px-3 py-1 text-sm font-medium ${
            option === months
              ? 'border-2 border-action-bg bg-action-bg text-action-fg'
              : 'border border-border-control text-text-secondary hover:border-border-strong'
          }`}
        >
          {option} meses
        </button>
      ))}
    </fieldset>
  )
}

/**
 * A uniao dos meses das duas series, cada uma nas suas chaves (`H-54`).
 *
 * Mes presente numa e ausente na outra fica `undefined` ali, e o Recharts abre
 * um buraco em vez de ligar os pontos: a observada nao existe antes da primeira
 * execucao, e desenha-la ali afirmaria observacao que nao houve (A-43).
 */
interface ChartPoint {
  month: string
  total?: number
  desembaracados?: number
  canalVermelho?: number
  r_chegados?: number
  r_desembaracados?: number
}

function mergePoints(
  series: MonthlyHistoryResponse['series'],
  reconstructed: MonthlyHistoryResponse['reconstructed'],
): ChartPoint[] {
  const byMonth = new Map<string, ChartPoint>()

  for (const point of reconstructed.points) {
    byMonth.set(point.month, {
      month: point.month,
      r_chegados: point.chegados,
      r_desembaracados: point.desembaracados,
    })
  }
  for (const point of series) {
    const existing = byMonth.get(point.month) ?? { month: point.month }
    byMonth.set(point.month, {
      ...existing,
      total: point.total,
      desembaracados: point.desembaracados,
      canalVermelho: point.canalVermelho,
    })
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * O grafico e a tabela sobre os mesmos pontos. Um eixo so: as medidas contam
 * processos, e escalas separadas fariam o Canal Vermelho — cinco linhas na
 * planilha real — parecer da mesma ordem que o volume.
 */
function MonthlySeries({
  series,
  reconstructed,
}: {
  series: MonthlyHistoryResponse['series']
  reconstructed: MonthlyHistoryResponse['reconstructed']
}) {
  const points = mergePoints(series, reconstructed)
  return (
    <section
      aria-label="Evolução mensal"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Evolução mensal</h2>

      {/*
        **O grafico deixou de ser `aria-hidden`** (`H-74`, `ACHADO 11`).

        `ACHADO 12` mediu a parada de tabulacao ORFA: `RootSurface` da
        `tabIndex={0}` e `role="application"` ao `<svg>`, e dentro de uma
        subarvore `aria-hidden` isso vira um foco que a arvore de acessibilidade
        nao expoe — sem nome nenhum a anunciar. `H-46` matou a parada desligando
        a camada.

        **O defeito era a orfandade, nao a parada.** Com o `aria-hidden` fora e
        um nome no proprio grafico, ela deixa de ser orfa: passa a ser uma parada
        legitima, anunciada, com a navegacao por ponto que a camada oferece.
        Medido em `H-65`: `/historico` vai de 26 para 27 paradas.

        A tabela irma continua carregando os mesmos numeros — a alternativa
        textual nunca esteve em jogo.
      */}
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            aria-label="Gráfico da evolução mensal"
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              stroke="var(--color-chart-grid)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fill: 'var(--color-chart-axis)', fontSize: '0.75rem' }}
              stroke="var(--color-chart-axis)"
            />
            <YAxis
              allowDecimals={false}
              width={48}
              tick={{ fill: 'var(--color-chart-axis)', fontSize: '0.75rem' }}
              stroke="var(--color-chart-axis)"
            />
            <Tooltip
              labelFormatter={(label) => (typeof label === 'string' ? formatMonth(label) : label)}
            />
            <Legend />
            {MEASURES.map((measure) => (
              <Line
                key={measure.key}
                type="monotone"
                dataKey={measure.key}
                name={measure.label}
                stroke={measure.color}
                strokeWidth={2}
                dot={series.length === 1}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
            {RECONSTRUCTED_MEASURES.map((measure) => (
              <Line
                key={measure.key}
                type="monotone"
                dataKey={measure.key}
                name={measure.label}
                stroke={measure.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* A alternativa textual do grafico, com as DUAS series: o SVG do Recharts
          nao e legivel por leitor de tela, e omitir a reconstruida aqui deixaria
          metade da informacao so no desenho. Traco onde a serie nao tem o mes —
          ausencia de ponto nao e zero. */}
      {/* `ACHADO 19`. A exceção bidimensional de `SC 1.4.10` cobre a TABELA,
          e não a página: sem o invólucro, ela arrasta as notas irmãs e a
          barra de filtros para a rolagem horizontal. Mesmo padrão que
          `ProcessTable` já usa. */}
      <div className="overflow-x-auto">
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">
            Volume, desembaraçados e Canal Vermelho ao fim de cada mês, observados e reconstruídos
          </caption>
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
              <th className="pb-1 font-medium">mês</th>
              {MEASURES.map((measure) => (
                <th key={measure.key} className="pb-1 text-right font-medium">
                  {measure.label}
                </th>
              ))}
              {RECONSTRUCTED_MEASURES.map((measure) => (
                <th key={measure.key} className="pb-1 text-right font-medium">
                  {measure.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* `h-10` — a densidade de `H-61`, em unidade relativa. */}
            {points.map((point) => (
              <tr key={point.month} className="h-10 border-b border-border-subtle last:border-0">
                <td className="py-1">
                  <time dateTime={point.month}>{formatMonth(point.month)}</time>
                </td>
                {[...MEASURES, ...RECONSTRUCTED_MEASURES].map((measure) => {
                  const value = point[measure.key]
                  return (
                    <td key={measure.key} className="py-1 text-right tabular-nums">
                      {value === undefined ? '—' : value.toLocaleString('pt-BR')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** A-43: o que a serie NAO cobre precisa estar dito, e com a data à vista. */
function StartNote({ startedAt }: { startedAt: string | null }) {
  if (startedAt === null) return null

  return (
    <p className="rounded-container border border-border-subtle bg-surface-sunken px-4 py-3 text-xs text-text-secondary">
      O histórico começou em <strong className="font-semibold">{formatInstant(startedAt)}</strong>,
      quando a aplicação passou a registrar as mudanças.{' '}
      <strong>Não há dado anterior a essa data</strong> — a planilha guarda o estado de hoje, e
      reconstruir os meses passados a partir dela produziria uma série plausível e errada.
    </p>
  )
}

/**
 * Por que o ultimo ponto pode nao bater com o cartao da Pagina Inicial.
 *
 * `aggregateMonthly` acumula os REF observados e nunca remove: REF que some da
 * planilha nao gera evento (ADR-0005), entao o volume do historico e "quantos
 * ja se viu", nao "quantos ha hoje". **Medido em 17/08/2026 contra a planilha
 * real: 650 no historico, 649 na planilha** — uma REF ja saiu, e a diferenca
 * cresce com o tempo. Dois numeros certos medindo coisas diferentes viram
 * desconfianca no numero certo se a tela nao disser qual e qual.
 */
function VolumeNote() {
  return (
    <p className="rounded-container border border-border-subtle bg-surface-sunken px-4 py-3 text-xs text-text-secondary">
      <strong className="font-semibold">
        Volume conta os processos que a aplicação já observou
      </strong>{' '}
      desde o início do histórico, e não os que estão na planilha hoje: uma REF removida da planilha
      permanece na série, porque desaparecer não é uma mudança de estado que se possa registrar. Por
      isso o último ponto pode ficar acima do total da Página Inicial — os dois números medem coisas
      diferentes.
    </p>
  )
}

/**
 * Recorte que nao se anuncia e descarte silencioso (regra inviolavel 2).
 *
 * O bloco e montado condicionalmente, entao o `role` que ele carregava nascia ja
 * populado — o mesmo `ACHADO 11` das outras seis paginas, num ponto que a lista
 * de `H-44` nao nomeava. Quem anuncia agora e a regiao viva da casca.
 */
function TruncatedNote({ months, pointCount }: { months: number; pointCount: number }) {
  return (
    <PageAlert
      tone="status"
      className="rounded-container border border-state-warning-border bg-state-warning-bg px-4 py-3 text-xs text-state-warning-fg"
      announcement={`A janela pedida — ${months} meses — é maior que o histórico existente. A série mostra os ${pointCount} ${pointCount === 1 ? 'mês' : 'meses'} que há.`}
    >
      A janela pedida — <strong className="font-semibold">{months} meses</strong> — é maior que o
      histórico existente. A série mostra os{' '}
      <strong className="font-semibold">
        {pointCount} {pointCount === 1 ? 'mês' : 'meses'}
      </strong>{' '}
      que há, e começa onde o histórico começou.
    </PageAlert>
  )
}

/**
 * O limite do recorte por filtro, do contrato de `GET /api/history/monthly`. O
 * evento gravado carrega apenas `ref`: cliente, navio e agente vivem na
 * planilha, entao o filtro resolve os REF contra a leitura de HOJE.
 */
function FilterCaveat() {
  return (
    <p className="rounded-container border border-border-subtle bg-surface-sunken px-4 py-3 text-xs text-text-secondary">
      Há filtro ativo, e o histórico guarda apenas a REF de cada processo. Os filtros são resolvidos
      contra a leitura atual da planilha: a série descreve o passado dos processos que casam{' '}
      <strong className="font-semibold">hoje</strong>. Um processo cujo navio mudou aparece sob o
      navio de agora, e um que saiu da planilha não aparece sob filtro algum. Sem filtro, a série
      sai inteira do arquivo.
    </p>
  )
}

const MONTH_NAMES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/**
 * `2026-08` vira `ago/2026`. Valor fora da forma volta inteiro, nunca excecao:
 * resposta de rede nao e verificada pelo tipo, e tela branca e o pior dos
 * buracos invisiveis (regra inviolavel 3).
 *
 * **O ano vai com quatro digitos desde `H-54`.** `ago/26` foi lido pelo operador
 * como uma data — em pt-br `26/08` e dia 26 de agosto (`docs/uso/RESULTADO.md`
 * secao 6). Quatro digitos tambem tornam legivel a virada de ano, que a serie
 * reconstruida atravessa: ela comeca em dez/2025.
 */
function formatMonth(month: string): string {
  const [year, index] = month.split('-')
  if (year === undefined || index === undefined) return month

  const name = MONTH_NAMES[Number(index) - 1]
  return name === undefined ? month : `${name}/${year}`
}

/** Instante ISO no dia civil do navegador, que na maquina do operador e o fuso da aplicacao. */
function formatInstant(instant: string): string {
  const parsed = new Date(instant)
  if (Number.isNaN(parsed.getTime())) return '—'

  return parsed.toLocaleDateString('pt-BR')
}
