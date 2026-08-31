import type { HealthResponse, IndicatorsResponse } from '../api-client.ts'
import { IngestionHealth } from '../components/IngestionHealth.tsx'
import { LiveAnnouncement, PageAlert } from '../components/PageAlert.tsx'
import { StatCard, type StatVariant } from '../components/StatCard.tsx'
import { type FilterSelection, useFilters } from '../hooks/useFilters.ts'
import { useIndicators, useQuarantine } from '../hooks/useIndicators.ts'

/**
 * Pagina Inicial (RF-09).
 *
 * Doze cartoes, **nesta ordem**, e nenhum numero calculado aqui: todos vem de
 * `GET /api/indicators`, ja recortado pelos filtros globais no servidor (regra
 * inviolavel 6).
 *
 * Tres deles existem por achado, nao pela especificacao original: "Em
 * desembaraco" por A-12 — sem ele a soma das categorias nao fecha com o total
 * —, os dois de urgencia por A-40, e "Desembaracados hoje" por A-64. O
 * decimo-terceiro veio de `H-52`, do uso: `desembaracados` era lido como
 * "quantos concluimos na janela" e responde "quantos dos que chegaram na janela
 * ja concluiram".
 *
 * **Cada cartao declara a janela que esta contando** (`H-52`), e o campo de data
 * que ela recorta: sao dois, e sao perguntas diferentes. A janela vem do
 * servidor, formatada aqui — formatar nao e calcular.
 */

/** Qual data o cartao conta. Decide a janela que ele exibe, e so isso. */
type CardDate = 'eta2' | 'registration' | 'nenhuma'

interface CardDefinition {
  readonly key: keyof IndicatorsResponse['counts']
  readonly label: string
  readonly variant?: StatVariant
  readonly date: CardDate
  /**
   * O que distingue o cartao de urgencia, em TEXTO (`ACHADO 18`, `SC 1.4.1`).
   *
   * Ate `H-45` a distincao era so o par de cores da variante: quem nao enxerga
   * a diferenca cromatica via doze cartoes iguais. O `hint` ja existia em
   * `StatCard`, e nenhum cartao o usava.
   */
  readonly hint?: string
}

const CARDS: readonly CardDefinition[] = [
  { key: 'total', label: 'Total', date: 'eta2' },
  { key: 'desembaracados', label: 'Desembaraçados', date: 'eta2' },
  { key: 'emAndamento', label: 'Em andamento', date: 'eta2' },
  { key: 'emDesembaraco', label: 'Em desembaraço', date: 'eta2' },
  { key: 'fechadoAguardandoDraft', label: 'Fechado — aguardando draft', date: 'eta2' },
  // `H-52`. Ao lado do de categoria, e nao no lugar dele: a soma das quatro
  // continua fechando com o total (A-12), e este responde a outra pergunta.
  {
    key: 'desembaracadosNoPeriodo',
    label: 'Desembaraçados no período (por registro)',
    date: 'registration',
  },
  { key: 'canalVermelho', label: 'Canal Vermelho', date: 'eta2' },
  { key: 'chegandoHoje', label: 'Chegando hoje', date: 'nenhuma' },
  { key: 'chegandoSemana', label: 'Chegando esta semana', date: 'nenhuma' },
  { key: 'chegando15Dias', label: 'Chegando em 15 dias', date: 'nenhuma' },
  // A-64. Fecha o bloco temporal: os anteriores dizem o que o dia trouxe ou
  // trara, este diz o que ele concluiu.
  { key: 'desembaracadosHoje', label: 'Desembaraçados hoje', date: 'nenhuma' },
  {
    key: 'atrasados',
    label: 'Atrasados',
    variant: 'urgencia',
    date: 'eta2',
    hint: 'Pede ação',
  },
  {
    key: 'documentosPendentes',
    label: 'Documentos pendentes',
    variant: 'urgencia',
    date: 'eta2',
    hint: 'Pede ação',
  },
]

/** As quatro categorias canonicas, cuja soma tem de igualar o total. */
const CATEGORY_KEYS = [
  'emAndamento',
  'emDesembaraco',
  'desembaracados',
  'fechadoAguardandoDraft',
] as const

interface HomeProps {
  health: HealthResponse | null
  queryString: string
  dataVersion: number
}

/** `AAAA-MM-DD` como o operador le. Formatacao, nunca calculo. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

const DATE_LABEL: Readonly<Record<Exclude<CardDate, 'nenhuma'>, string>> = {
  eta2: 'ETA2',
  registration: 'registro',
}

/**
 * A frase que cada cartao exibe abaixo do numero.
 *
 * Tres estados, e a distincao e o motivo da historia: janela ativa diz o
 * recorte; sem janela, diz a faixa REAL dos dados, que veio do servidor; e base
 * sem nenhuma data diz "sem data", nunca uma faixa inventada (regra inviolavel
 * 3). Cartao que nao conta data alguma nao recebe frase.
 */
function periodOf(card: CardDefinition, meta: IndicatorsResponse['meta']): string | undefined {
  if (card.date === 'nenhuma') return undefined

  const campo = DATE_LABEL[card.date]
  const { from, to } = meta.period
  if (from !== null || to !== null) {
    const inicio = from === null ? 'início' : formatDay(from)
    const fim = to === null ? 'hoje em diante' : formatDay(to)
    return `${campo} · ${inicio} a ${fim}`
  }

  const faixa = meta.dataRange[card.date]
  if (faixa.from === null || faixa.to === null) return `${campo} · sem data`
  return `${campo} · todo o período — ${formatDay(faixa.from)} a ${formatDay(faixa.to)}`
}

export function Home({ health, queryString, dataVersion }: HomeProps) {
  const state = useIndicators(queryString, dataVersion)
  const quarantine = useQuarantine(dataVersion)
  const filters = useFilters()

  if (state.status === 'erro') {
    return (
      <PageAlert
        className="panel-error"
        announcement={`Não foi possível carregar os indicadores. ${state.message}`}
      >
        <strong className="font-semibold">Não foi possível carregar os indicadores.</strong>{' '}
        {state.message}
      </PageAlert>
    )
  }

  const indicators = state.status === 'pronto' ? state.indicators : null
  const counts = indicators?.counts ?? null

  return (
    <div className="flex flex-col gap-6">
      {state.status === 'semLeitura' && (
        <PageAlert
          tone="status"
          className="panel-no-read"
          announcement="Nenhuma leitura da planilha foi concluída ainda. Os cartões aparecem assim que a primeira terminar."
        >
          Nenhuma leitura da planilha foi concluída ainda. Os cartões aparecem assim que a primeira
          terminar — os traços não significam zero.
        </PageAlert>
      )}

      <PeriodPicker
        selection={filters.selection}
        setPeriod={filters.setPeriod}
        {...(indicators ? { meta: indicators.meta } : {})}
      />

      <section aria-label="Cartões-resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((card) => {
          const period = indicators ? periodOf(card, indicators.meta) : undefined
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={counts?.[card.key] ?? null}
              {...(card.variant ? { variant: card.variant } : {})}
              {...(card.hint ? { hint: card.hint } : {})}
              {...(period ? { period } : {})}
            />
          )
        })}
      </section>

      {counts && <CategorySum counts={counts} />}

      {state.status === 'pronto' && (
        <ChannelPanel distribution={state.indicators.channelDistribution} />
      )}

      <IngestionHealth health={health} quarantine={quarantine} />
    </div>
  )
}

/**
 * O atalho de periodo, na propria pagina (`H-52`).
 *
 * **Escreve nos mesmos `etaFrom`/`etaTo` da barra de filtros**, pelo mesmo
 * `useFilters` — um estado so, na URL, nunca dois periodos que divergem. Por
 * isso ele nao tem `useState` proprio: o valor exibido e o que esta na URL, e
 * mudar por aqui ou pela barra e a mesma escrita.
 *
 * `setPeriod` escreve os dois de uma vez porque duas chamadas a `setRange`
 * derivariam o rascunho da MESMA leitura de query, e a segunda perderia a
 * primeira.
 */
function PeriodPicker({
  selection,
  setPeriod,
  meta,
}: {
  selection: FilterSelection
  setPeriod: (from: string, to: string) => void
  meta?: IndicatorsResponse['meta']
}) {
  const ativo = selection.etaFrom !== '' || selection.etaTo !== ''
  const faixa = meta?.dataRange.eta2

  return (
    <section
      aria-label="Período"
      className="flex flex-wrap items-end gap-3 rounded border border-border-subtle bg-surface-raised px-4 py-3"
    >
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        Período (ETA2) — de
        <input
          type="date"
          value={selection.etaFrom}
          onChange={(event) => setPeriod(event.target.value, selection.etaTo)}
          className="rounded border border-border-control px-2 py-1 text-sm text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        até
        <input
          type="date"
          value={selection.etaTo}
          onChange={(event) => setPeriod(selection.etaFrom, event.target.value)}
          className="rounded border border-border-control px-2 py-1 text-sm text-text-primary"
        />
      </label>

      {ativo && (
        <button
          type="button"
          onClick={() => setPeriod('', '')}
          className="rounded border border-border-control px-3 py-1 text-sm text-text-primary"
        >
          Todo o período
        </button>
      )}

      <p className="text-xs text-text-muted">
        {ativo
          ? 'O mesmo filtro da barra acima — mudar aqui muda lá.'
          : faixa && faixa.from !== null && faixa.to !== null
            ? `Sem recorte: os cartões contam de ${formatDay(faixa.from)} a ${formatDay(faixa.to)}.`
            : 'Sem recorte.'}
      </p>
    </section>
  )
}

/**
 * A distribuicao de canal (`H-51`).
 *
 * **O denominador aparece ao lado da fracao, e nao embaixo dela** (A-42): o
 * percentual e sobre os processos cujo canal a cor classifica, e as linhas em
 * `indefinido` sao contadas separadamente, fora da conta. Sao 167 das 649 na
 * planilha real, medidas em 31/08/2026 — dilui-las no percentual afirmaria que
 * o canal delas e conhecido.
 *
 * Nada e calculado aqui: as contagens e as duas fracoes vem prontas de
 * `GET /api/indicators` (regra inviolavel 6). Formatar `null` como travessao e
 * apresentacao; decidir que ele e `null` foi do dominio.
 */
function ChannelPanel({
  distribution,
}: {
  distribution: IndicatorsResponse['channelDistribution']
}) {
  const rows = [
    { label: 'Canal Verde', count: distribution.verde, share: distribution.verdeShare },
    { label: 'Canal Vermelho', count: distribution.vermelho, share: distribution.vermelhoShare },
  ]

  return (
    <section
      aria-label="Distribuição por canal"
      className="rounded border border-border-subtle bg-surface-raised px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-text-primary">Distribuição por canal</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Percentual sobre os{' '}
        <strong className="tabular-nums">{distribution.known.toLocaleString('pt-BR')}</strong>{' '}
        processos com canal conhecido.
      </p>

      <ul className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="text-sm text-text-primary">
            {row.label}:{' '}
            <strong className="tabular-nums">{row.count.toLocaleString('pt-BR')}</strong>
            <span className="ml-2 text-text-secondary">
              {row.share === null ? (
                '—'
              ) : (
                <>
                  <span className="tabular-nums">
                    {(row.share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>{' '}
                  de {distribution.known.toLocaleString('pt-BR')}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-sm text-text-muted">
        Sem canal conhecido:{' '}
        <strong className="tabular-nums">{distribution.indefinido.toLocaleString('pt-BR')}</strong>{' '}
        — a cor dessas linhas diz responsável ou localização do importador, e por isso não diz
        canal. Elas ficam fora do percentual, contadas.
      </p>
    </section>
  )
}

/**
 * A conferencia de A-12, exibida em vez de presumida.
 *
 * Somar quatro numeros ja calculados nao deriva indicador novo nem classifica
 * nada — evidencia uma invariante que o dominio garante. Quando ela quebra, o
 * defeito e do servidor, e esta linha e o unico lugar onde isso fica visivel
 * antes de alguem conferir na mao.
 */
function CategorySum({ counts }: { counts: IndicatorsResponse['counts'] }) {
  const sum = CATEGORY_KEYS.reduce((accumulated, key) => accumulated + counts[key], 0)
  const matches = sum === counts.total

  return (
    <>
      {/* Este `<p>` existe SEMPRE e so muda de tom; acrescentar `role="alert"`
          a ele quando a soma quebra criaria uma regiao ja populada — o mesmo
          `ACHADO 11` por outro caminho, e era o que a linha de `:114` fazia por
          spread condicional. Quem anuncia e a regiao viva da casca. */}
      <p
        className={`rounded border px-4 py-2 text-sm ${
          matches
            ? 'border-border-subtle bg-surface-raised text-text-secondary'
            : 'border-state-error-border bg-state-error-bg'
        }`}
      >
        Soma das 4 categorias:{' '}
        <strong className="tabular-nums">{sum.toLocaleString('pt-BR')}</strong> · Total:{' '}
        <strong className="tabular-nums">{counts.total.toLocaleString('pt-BR')}</strong>
        {matches ? (
          <span className="ml-2 text-text-muted">conferem</span>
        ) : (
          <span className="ml-2 font-semibold text-state-error-fg">
            NÃO conferem — há processo fora das quatro categorias
          </span>
        )}
      </p>
      {!matches && (
        <LiveAnnouncement
          text={`A soma das 4 categorias é ${sum}, e o total é ${counts.total}. Elas NÃO conferem — há processo fora das quatro categorias.`}
        />
      )}
    </>
  )
}
