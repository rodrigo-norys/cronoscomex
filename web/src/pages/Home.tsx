import type { HealthResponse, IndicatorsResponse } from '../api-client.ts'
import { ArrivalCalendar } from '../components/ArrivalCalendar.tsx'
import { DateField } from '../components/DateField.tsx'
import { IngestionHealth } from '../components/IngestionHealth.tsx'
import { LiveAnnouncement, PageAlert } from '../components/PageAlert.tsx'
import { StatCard, type StatVariant } from '../components/StatCard.tsx'
import { type FilterSelection, useFilters } from '../hooks/useFilters.ts'
import { useIndicators, useQuarantine } from '../hooks/useIndicators.ts'

/**
 * Pagina Inicial (RF-09).
 *
 * Nove cartoes, **nesta ordem**, e nenhum numero calculado aqui: todos vem de
 * `GET /api/indicators`, ja recortado pelos filtros globais no servidor (regra
 * inviolavel 6).
 *
 * **`D-49` levou os treze cartoes a nove**, por ordem do usuario depois de usar
 * a tela: sairam os de IND-08, IND-14 e IND-16 e o de periodo por registro, e
 * tres mudaram de regra — "Em desembaraco" passou a IND-23, "Chegando hoje" a
 * IND-24 e "Atrasados" a IND-25.
 *
 * **Nada mais aparece abaixo do contador**, e isso tambem e `D-49`: a janela
 * que cada cartao declarava desde `H-52` saiu junto com a faixa do seletor, para
 * despoluir a tela. O que ela resolvia — cartao zerado por recorte contra
 * cartao zerado por ausencia de dado — passou a ser respondido pelo proprio
 * seletor de periodo, logo acima dos cartoes.
 */

interface CardDefinition {
  readonly key: keyof IndicatorsResponse['counts']
  readonly label: string
  readonly variant?: StatVariant
}

const CARDS: readonly CardDefinition[] = [
  { key: 'total', label: 'Total' },
  { key: 'desembaracados', label: 'Desembaraçados' },
  { key: 'emAndamento', label: 'Processos ativos' },
  { key: 'emDesembaraco', label: 'Em desembaraço' },
  { key: 'fechadoAguardandoDraft', label: 'Aguardando draft' },
  { key: 'canalVermelho', label: 'Canal Vermelho' },
  { key: 'chegandoHoje', label: 'Chegando hoje' },
  { key: 'chegando15Dias', label: 'Chegando em 15 dias' },
  { key: 'atrasados', label: 'Atrasados', variant: 'urgencia' },
]

interface HomeProps {
  health: HealthResponse | null
  queryString: string
  dataVersion: number
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

      <PeriodPicker selection={filters.selection} setPeriod={filters.setPeriod} />

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

      {indicators && <CategorySum check={indicators.categoryCheck} />}

      {state.status === 'pronto' && (
        <ChannelPanel distribution={state.indicators.channelDistribution} />
      )}

      {/*
        O calendario de chegadas veio da Pagina Operacional em `H-98`, e esta e a
        casa natural dele: `IND-12` e indicador, e esta pagina ja pedia
        `GET /api/indicators` — a mudanca nao cria requisicao nenhuma.
        **Remove-lo sem realocar deixaria `IND-12` calculado, servido e sem
        tela**, que e exatamente o defeito que `A-65` varreu em `IND-13`,
        `IND-17` e `IND-20`.
      */}
      {state.status === 'pronto' && <ArrivalCalendar days={state.indicators.arrivalCalendar} />}

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
}: {
  selection: FilterSelection
  setPeriod: (from: string, to: string) => void
}) {
  const ativo = selection.etaFrom !== '' || selection.etaTo !== ''

  return (
    <section
      aria-label="Período"
      className="flex flex-wrap items-end gap-3 rounded-container border border-border-subtle bg-surface-raised px-4 py-3"
    >
      <DateField
        label="Período (ETA2) — de"
        value={selection.etaFrom}
        onValue={(iso) => setPeriod(iso, selection.etaTo)}
      />
      <DateField
        label="até"
        value={selection.etaTo}
        onValue={(iso) => setPeriod(selection.etaFrom, iso)}
      />

      {ativo && (
        <button
          type="button"
          onClick={() => setPeriod('', '')}
          className="rounded-control border border-border-control px-3 py-1 text-sm text-text-primary"
        >
          Todo o período
        </button>
      )}

      <p className="text-xs text-text-muted">
        {ativo ? 'O mesmo filtro da barra acima — mudar aqui muda lá.' : 'Todo o período'}
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
      className="rounded-container border border-border-subtle bg-surface-raised px-4 py-3"
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
 * A conferencia de A-12, e so quando ela quebra (`D-49`).
 *
 * **A soma saiu do cliente.** Ate aqui os quatro cartoes de categoria estavam
 * na tela e soma-los nao derivava indicador novo; com IND-23 no lugar de
 * IND-03 eles deixaram de ser as quatro categorias, e a conta passou a vir
 * pronta em `categoryCheck`.
 *
 * **Silencio quando confere** — o outro lado da ordem de despoluir a tela. A
 * invariante vale em toda leitura boa, entao uma linha permanente dizendo
 * "conferem" ocupa espaco para nunca informar nada; quando ela quebra, o
 * defeito e do servidor, e este continua sendo o unico lugar onde isso fica
 * visivel antes de alguem conferir na mao.
 */
function CategorySum({ check }: { check: IndicatorsResponse['categoryCheck'] }) {
  if (check.matches) return null

  return (
    <>
      {/* Sem `role="alert"`: o `<p>` nasce ja populado, e anunciar daqui seria
          o `ACHADO 11` por outro caminho. Quem anuncia e a regiao viva da
          casca, logo abaixo. */}
      <p className="rounded-control border border-state-error-border bg-state-error-bg px-4 py-2 text-sm">
        Soma das 4 categorias:{' '}
        <strong className="tabular-nums">{check.sum.toLocaleString('pt-BR')}</strong> · Total:{' '}
        <strong className="tabular-nums">{check.total.toLocaleString('pt-BR')}</strong>
        <span className="ml-2 font-semibold text-state-error-fg">
          NÃO conferem — há processo fora das quatro categorias
        </span>
      </p>
      <LiveAnnouncement
        text={`A soma das 4 categorias é ${check.sum}, e o total é ${check.total}. Elas NÃO conferem — há processo fora das quatro categorias.`}
      />
    </>
  )
}
