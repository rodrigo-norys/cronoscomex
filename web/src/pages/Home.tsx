import type { HealthResponse, IndicatorsResponse } from '../api-client.ts'
import { IngestionHealth } from '../components/IngestionHealth.tsx'
import { StatCard, type StatVariant } from '../components/StatCard.tsx'
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
 * —, os dois de urgencia por A-40, e "Desembaracados hoje" por A-64.
 */

interface CardDefinition {
  readonly key: keyof IndicatorsResponse['counts']
  readonly label: string
  readonly variant?: StatVariant
}

const CARDS: readonly CardDefinition[] = [
  { key: 'total', label: 'Total' },
  { key: 'desembaracados', label: 'Desembaraçados' },
  { key: 'emAndamento', label: 'Em andamento' },
  { key: 'emDesembaraco', label: 'Em desembaraço' },
  { key: 'fechadoAguardandoDraft', label: 'Fechado — aguardando draft' },
  { key: 'canalVermelho', label: 'Canal Vermelho' },
  { key: 'chegandoHoje', label: 'Chegando hoje' },
  { key: 'chegandoSemana', label: 'Chegando esta semana' },
  { key: 'chegando15Dias', label: 'Chegando em 15 dias' },
  // A-64. Fecha o bloco temporal: os anteriores dizem o que o dia trouxe ou
  // trara, este diz o que ele concluiu.
  { key: 'desembaracadosHoje', label: 'Desembaraçados hoje' },
  { key: 'atrasados', label: 'Atrasados', variant: 'urgencia' },
  { key: 'documentosPendentes', label: 'Documentos pendentes', variant: 'urgencia' },
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

export function Home({ health, queryString, dataVersion }: HomeProps) {
  const state = useIndicators(queryString, dataVersion)
  const quarantine = useQuarantine(dataVersion)

  if (state.status === 'erro') {
    return (
      <p role="alert" className="panel-error">
        <strong className="font-semibold">Não foi possível carregar os indicadores.</strong>{' '}
        {state.message}
      </p>
    )
  }

  const counts = state.status === 'pronto' ? state.indicators.counts : null

  return (
    <div className="flex flex-col gap-6">
      {state.status === 'semLeitura' && (
        <p role="status" className="panel-no-read">
          Nenhuma leitura da planilha foi concluída ainda. Os cartões aparecem assim que a primeira
          terminar — os traços não significam zero.
        </p>
      )}

      <section aria-label="Cartões-resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={counts?.[card.key] ?? null}
            {...(card.variant ? { variant: card.variant } : {})}
          />
        ))}
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
    <p
      className={`rounded border px-4 py-2 text-sm ${
        matches
          ? 'border-border-subtle bg-surface-raised text-text-secondary'
          : 'border-state-error-border bg-state-error-bg'
      }`}
      {...(matches ? {} : { role: 'alert' })}
    >
      Soma das 4 categorias: <strong className="tabular-nums">{sum.toLocaleString('pt-BR')}</strong>{' '}
      · Total: <strong className="tabular-nums">{counts.total.toLocaleString('pt-BR')}</strong>
      {matches ? (
        <span className="ml-2 text-text-muted">conferem</span>
      ) : (
        <span className="ml-2 font-semibold text-state-error-fg">
          NÃO conferem — há processo fora das quatro categorias
        </span>
      )}
    </p>
  )
}
