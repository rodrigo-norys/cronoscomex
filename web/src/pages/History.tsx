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
 * **Nao ha retroatividade** (A-43): a serie comeca quando o historico passou a
 * ser gravado, e a tela diz isso em vez de deixar o operador supor que o grafico
 * cobre a planilha inteira. Serie vazia e um terceiro estado, distinto de
 * `semLeitura` — ver `useHistory`.
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
  /** Validado contra fundo claro: pior par adjacente com ΔE 13,1 em deuteranopia. */
  readonly color: string
}

const MEASURES: readonly MeasureDefinition[] = [
  { key: 'total', label: 'Volume', color: '#4f46e5' },
  { key: 'desembaracados', label: 'Desembaraçados', color: '#0d9488' },
  { key: 'canalVermelho', label: 'Canal Vermelho', color: '#dc2626' },
]

interface HistoryProps {
  queryString: string
  dataVersion: number
}

export function History({ queryString, dataVersion }: HistoryProps) {
  const [months, setMonths] = useState<WindowMonths>(DEFAULT_WINDOW)
  const state = useHistory(queryString, months, dataVersion)

  if (state.status === 'erro') {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <strong className="font-semibold">Não foi possível carregar o histórico.</strong>{' '}
        {state.message}
      </p>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <p role="status" className="rounded border border-slate-300 bg-white p-4 text-sm">
        Nenhuma leitura da planilha foi concluída ainda. A série aparece assim que a primeira
        terminar — gráfico vazio aqui não significa zero processo.
      </p>
    )
  }

  if (state.status === 'carregando') {
    return (
      <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando histórico…
      </p>
    )
  }

  const { series, historyStartedAt, truncated } = state.history

  return (
    <div className="flex flex-col gap-4">
      {series.length === 0 ? (
        <EmptyHistory />
      ) : (
        <>
          <WindowPicker months={months} onChange={setMonths} />
          <MonthlySeries series={series} />
          <StartNote startedAt={historyStartedAt} />
          <VolumeNote />
          {truncated && <TruncatedNote months={months} pointCount={series.length} />}
        </>
      )}

      {queryString !== '' && <FilterCaveat />}
    </div>
  )
}

/**
 * Serie vazia com `historyStartedAt` nulo: a planilha foi lida, e o arquivo de
 * historico esta vazio ou foi apagado. Nao e erro, e nao e zero processo — e
 * ausencia de passado registrado, que so a proxima leitura resolve.
 *
 * Sem `role="status"`: ele substituiria o papel de regiao, e a secao da serie
 * precisa ser a mesma marca nos dois estados, cheio e vazio.
 */
function EmptyHistory() {
  return (
    <section
      aria-label="Evolução mensal"
      className="rounded border border-slate-300 bg-white p-6 text-sm"
    >
      <h2 className="text-base font-semibold text-slate-700">Ainda não há histórico registrado.</h2>
      <p className="mt-2 text-slate-600">
        A série é montada a partir das mudanças que a aplicação observa a cada leitura da planilha,
        e o primeiro ponto aparece na próxima. Um gráfico zerado aqui afirmaria que não há
        processos, o que é diferente de não haver passado gravado.
      </p>
      <p className="mt-2 text-slate-600">
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
    <fieldset className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3">
      <legend className="sr-only">Janela da série</legend>
      <span className="text-sm text-slate-600">Janela:</span>
      {WINDOWS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === months}
          onClick={() => onChange(option)}
          className={`rounded border px-3 py-1 text-sm font-medium ${
            option === months
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-300 text-slate-600 hover:border-slate-500'
          }`}
        >
          {option} meses
        </button>
      ))}
    </fieldset>
  )
}

/**
 * O grafico e a tabela sobre os mesmos pontos. Um eixo so: as tres medidas
 * contam processos, e escalas separadas fariam o Canal Vermelho — cinco linhas
 * na planilha real — parecer da mesma ordem que o volume.
 */
function MonthlySeries({ series }: { series: MonthlyHistoryResponse['series'] }) {
  return (
    <section aria-label="Evolução mensal" className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Evolução mensal</h2>

      <div aria-hidden="true" className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fill: '#64748b', fontSize: 12 }}
              stroke="#cbd5e1"
            />
            <YAxis
              allowDecimals={false}
              width={48}
              tick={{ fill: '#64748b', fontSize: 12 }}
              stroke="#cbd5e1"
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
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">
          Volume, desembaraçados e Canal Vermelho ao fim de cada mês
        </caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="pb-1 font-medium">mês</th>
            {MEASURES.map((measure) => (
              <th key={measure.key} className="pb-1 text-right font-medium">
                {measure.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.month} className="border-b border-slate-100 last:border-0">
              <td className="py-1">
                <time dateTime={point.month}>{formatMonth(point.month)}</time>
              </td>
              {MEASURES.map((measure) => (
                <td key={measure.key} className="py-1 text-right tabular-nums">
                  {point[measure.key].toLocaleString('pt-BR')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** A-43: o que a serie NAO cobre precisa estar dito, e com a data à vista. */
function StartNote({ startedAt }: { startedAt: string | null }) {
  if (startedAt === null) return null

  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
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
    <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
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

/** Recorte que nao se anuncia e descarte silencioso (regra inviolavel 2). */
function TruncatedNote({ months, pointCount }: { months: number; pointCount: number }) {
  return (
    <p
      role="status"
      className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900"
    >
      A janela pedida — <strong className="font-semibold">{months} meses</strong> — é maior que o
      histórico existente. A série mostra os{' '}
      <strong className="font-semibold">
        {pointCount} {pointCount === 1 ? 'mês' : 'meses'}
      </strong>{' '}
      que há, e começa onde o histórico começou.
    </p>
  )
}

/**
 * O limite do recorte por filtro, do contrato de `GET /api/history/monthly`. O
 * evento gravado carrega apenas `ref`: cliente, navio e agente vivem na
 * planilha, entao o filtro resolve os REF contra a leitura de HOJE.
 */
function FilterCaveat() {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
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
 * `2026-08` vira `ago/26`. Valor fora da forma volta inteiro, nunca excecao:
 * resposta de rede nao e verificada pelo tipo, e tela branca e o pior dos
 * buracos invisiveis (regra inviolavel 3).
 */
function formatMonth(month: string): string {
  const [year, index] = month.split('-')
  if (year === undefined || index === undefined) return month

  const name = MONTH_NAMES[Number(index) - 1]
  return name === undefined ? month : `${name}/${year.slice(2)}`
}

/** Instante ISO no dia civil do navegador, que na maquina do operador e o fuso da aplicacao. */
function formatInstant(instant: string): string {
  const parsed = new Date(instant)
  if (Number.isNaN(parsed.getTime())) return '—'

  return parsed.toLocaleDateString('pt-BR')
}
