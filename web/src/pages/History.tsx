import type { ReactNode } from 'react'
import { useState } from 'react'
import type { TooltipContentProps } from 'recharts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyHistoryResponse } from '../api-client.ts'
import { PageAlert } from '../components/PageAlert.tsx'
import { Skeleton } from '../components/Skeleton.tsx'
import { useFirstLoad } from '../hooks/useFirstLoad.ts'
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
 * **A serie OBSERVADA deixou de ser desenhada** (`D-58`), por ordem do usuario:
 * ela sai de `data/history.jsonl` e so cobre o que a aplicacao presenciou — duas
 * pontas de linha contra os dez meses que a planilha data —, e o par custava
 * cinco entradas de legenda, seis colunas de tabela e cinco linhas de tooltip
 * para exibir dois pontos. **A rota continua servindo, e o historico continua
 * sendo gravado:** o que saiu foi o desenho, nao o dado.
 *
 * **A-43 nao foi revogada, e passou a ser cumprida por outro caminho.** O que
 * ele proibe e apresentar reconstrucao COMO historico observado; com uma serie
 * so, nomeada pelo que ela e — "pelas datas da planilha" —, nao ha o que
 * confundir. O preco esta declarado: a reconstruida projeta o estado de HOJE nas
 * datas, entao ela se reescreve a cada leitura, e a observada, que nao se
 * reescrevia, e a que saiu da vista.
 *
 * O grafico e `aria-hidden` e a tabela ao lado carrega os mesmos numeros: o SVG
 * do Recharts nao e legivel por leitor de tela, e o operador nao e tecnico.
 */

/**
 * A janela pedida a rota. **Deixou de ser escolhivel na tela** (`D-58`): ela
 * recorta apenas a serie OBSERVADA, e sem ela desenhada o seletor nao mudava
 * nada do que se ve. Controle mudo e defeito, nao economia.
 */
const DEFAULT_WINDOW = 12

/**
 * As duas medidas do acumulado (`D-58`).
 *
 * **Sao as reconstruidas, e o adjetivo saiu junto com o par.** A serie observada
 * deixou de ser desenhada, entao nao ha o que distinguir: `Volume` e
 * `Desembaracados` bastam, e o que elas sao esta dito uma vez, no subtitulo do
 * painel. Nao ha Canal Vermelho aqui — a cor e o estado de hoje e nao carrega
 * data, e so a serie observada o registrava.
 *
 * Le o token de `web/src/index.css`, e nao um literal: dois dos tres valores de
 * eixo e grade que viviam aqui ja eram passo da v3 do Tailwind, divergindo da
 * paleta que o resto do conjunto usa (`H-42`).
 */
interface MeasureDefinition {
  readonly key: 'chegados' | 'desembaracados'
  readonly label: string
  readonly color: string
}

const MEASURES: readonly MeasureDefinition[] = [
  { key: 'chegados', label: 'Volume', color: 'var(--color-chart-series-1)' },
  { key: 'desembaracados', label: 'Desembaraçados', color: 'var(--color-chart-series-2)' },
]

interface RegistrationMeasure {
  readonly key: 'registered' | 'cleared'
  readonly label: string
  readonly noun: string
  readonly color: string
  readonly caveat: string
}

/** Liga a ressalva ao checkbox que ela descreve — ha um painel destes por pagina. */
const CAVEAT_ID = 'registros-recorte'

const REGISTRATION_ALL: RegistrationMeasure = {
  key: 'registered',
  label: 'Registros no mês',
  noun: 'registros',
  color: 'var(--color-chart-series-1)',
  caveat: 'Conta toda linha com data em RG, seja qual for o STATUS dela',
}

const REGISTRATION_CLEARED: RegistrationMeasure = {
  key: 'cleared',
  label: 'Desembaraçados no mês',
  noun: 'desembaraçados',
  color: 'var(--color-chart-series-2)',
  caveat: 'Deixa de fora quem tem data em RG mas ainda não está como desembaraçado',
}

/**
 * A tabela recolhida (`D-57`).
 *
 * **Ela existe para o par ter a mesma altura.** E a tabela que varia entre os
 * dois paineis — nove linhas contra doze, duas colunas contra seis —, e tirando-a
 * do fluxo a altura passa a ser a do grafico, que e fixa nos dois.
 *
 * **O custo e declarado, nao esquecido:** a tabela e a alternativa textual do
 * grafico, porque o SVG do Recharts nao e legivel por leitor de tela. Fechada,
 * ela continua no DOM e alcancavel por teclado, mas sai da arvore de
 * acessibilidade ate a primeira abertura. O `<details>` nativo e o mesmo que
 * `Operational` ja usa, e o `summary` veste o estilo de la.
 */
function NumbersDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-4 border-t border-border-subtle pt-3">
      {/* Aberto, ele veste o mesmo azul das fichas de filtro ativas — borda
          `action-bg` sobre `action-soft` —, que e como a casca ja marca "isto
          esta ligado". `forced-colors:border-2` porque sob cores forcadas o
          agente de usuario troca a COR e nao a espessura, e sem o canal
          nao-cromatico aberto e fechado ficariam identicos (`ACHADO 13`). */}
      <summary className="motion-tint inline-block cursor-pointer list-none rounded-control border border-border-control px-2.5 py-1 text-sm text-text-secondary hover:text-text-primary group-open:border-action-bg group-open:bg-action-soft group-open:text-text-primary group-open:forced-colors:border-2">
        Ver os números
      </summary>
      {children}
    </details>
  )
}

interface HistoryProps {
  queryString: string
  dataVersion: number
}

export function History({ queryString, dataVersion }: HistoryProps) {
  const state = useHistory(queryString, DEFAULT_WINDOW, dataVersion)
  const firstLoad = useFirstLoad('historico', state.status === 'pronto')

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
    return firstLoad ? (
      <Skeleton announcement="Carregando histórico." />
    ) : (
      <p className="panel-loading"></p>
    )
  }

  const { reconstructed, registrations } = state.history

  return (
    <div className="flex flex-col gap-4">
      {reconstructed.points.length === 0 && <EmptyHistory />}

      {reconstructed.points.length > 0 && (
        <>
          {/* Par lado a lado, e **sem `items-start`**: a ausencia dela e o que faz
              os dois esticarem juntos — medido na Pagina Clientes, num Chrome
              real a 1920, 478/478 sem a classe contra 478/382 com ela. Abaixo de
              `lg` (1024px de janela) o grid empilha sozinho.

              Sem registros nao ha par, e a evolucao ocupa a largura inteira em
              vez de metade com um vao ao lado. */}
          {registrations.points.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MonthlyRegistrations registrations={registrations} />
              <MonthlySeries reconstructed={reconstructed} />
            </div>
          ) : (
            <MonthlySeries reconstructed={reconstructed} />
          )}
        </>
      )}
    </div>
  )
}

/**
 * `D-56`. Quantos registros a coluna RG marca em cada mes.
 *
 * **Barra, e nao linha**, porque a medida e contagem discreta de um periodo
 * fechado; linha afirmaria continuidade entre dois meses que nao se tocam. E
 * **uma medida por vez**: o checkbox TROCA o que a barra conta, em vez de somar
 * camada. Medido na planilha real em 21/09/2026, `cleared` e 480 contra 483 de
 * `registered` — sobrepor as duas prometeria uma comparacao de 3 linhas em 483,
 * que nenhum desenho entrega a 2 px de diferenca.
 *
 * A janela de `WindowPicker` nao a recorta, pelo mesmo motivo da reconstruida: a
 * serie sai das datas da planilha, e nao do arquivo de historico.
 */
function MonthlyRegistrations({
  registrations,
}: {
  registrations: MonthlyHistoryResponse['registrations']
}) {
  const [clearedOnly, setClearedOnly] = useState(false)
  const measure = clearedOnly ? REGISTRATION_CLEARED : REGISTRATION_ALL
  const total = registrations.points.reduce((sum, point) => sum + point[measure.key], 0)

  return (
    <section
      aria-label="Registros por mês"
      className="flex flex-col rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      {/* Titulo sozinho na linha, e o apoio ABAIXO: e a forma dos outros paineis
          — `ProcessDetail`, `Performance`, `Home` —, e ao lado a frase nao tem
          a que se ancorar. So o numero acompanha o titulo, porque numero nao
          disputa leitura com texto. */}
      <div className="flex items-baseline gap-x-3">
        <h2 className="text-sm font-semibold text-text-secondary">Registros por mês</h2>
        <p className="ml-auto shrink-0 text-sm tabular-nums text-text-primary">
          {total.toLocaleString('pt-BR')} {measure.noun}
        </p>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Pela data da coluna RG · cada barra conta só o próprio mês
      </p>

      {/* O rotulo envolve o controle, entao o clique no texto alcanca a caixa e a
          area de toque passa dos 24px que a WCAG 2.2 pede em `SC 2.5.8`.

          A ressalva e a DESCRICAO do controle, e nao um texto vizinho: `pl-6`
          alinha com o rotulo — `size-4` mais `gap-2` —, e `aria-describedby` diz
          a mesma coisa a quem nao ve o alinhamento. */}
      <div className="mt-3 border-y border-border-subtle py-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={clearedOnly}
            onChange={(changeEvent) => setClearedOnly(changeEvent.target.checked)}
            aria-describedby={CAVEAT_ID}
            className="size-4 cursor-pointer accent-action-bg"
          />
          Somente categoria Desembaraçado
        </label>
        <p id={CAVEAT_ID} className="pl-6 text-xs text-text-muted">
          {measure.caveat}
        </p>
      </div>

      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            aria-label="Gráfico dos registros por mês"
            data={registrations.points}
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
              cursor={{ fill: 'var(--color-chart-grid)' }}
              content={(props) => <RegistrationTooltip {...props} measure={measure} />}
            />
            <Bar dataKey={measure.key} name={measure.label} fill={measure.color} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <NumbersDisclosure>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Quantos {measure.noun} em cada mês</caption>
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                <th className="pb-1 font-medium">mês</th>
                <th className="pb-1 text-right font-medium">{measure.label}</th>
              </tr>
            </thead>
            <tbody>
              {registrations.points.map((point) => (
                <tr key={point.month} className="h-10 border-b border-border-subtle last:border-0">
                  <td className="py-1">
                    <time dateTime={point.month}>{formatMonth(point.month)}</time>
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {point[measure.key].toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NumbersDisclosure>

      <p className="mt-3 text-xs text-text-secondary">
        <strong className="font-semibold">
          {registrations.missingRegistration.toLocaleString('pt-BR')}
        </strong>{' '}
        processos não têm data de registro e ficam fora de todos os meses — somar as barras não dá o
        total da planilha. Barra em zero é mês medido sem registro, e não mês sem dado.
      </p>
    </section>
  )
}

/**
 * O tooltip da barra. O padrao do Recharts pinta o valor com a cor da serie sobre
 * caixa branca fixa, que no esquema escuro quase some — o mesmo defeito que
 * `MonthlyTooltip` ja corrige para as linhas.
 */
function RegistrationTooltip({
  active,
  label,
  payload,
  measure,
}: TooltipContentProps & { measure: RegistrationMeasure }) {
  if (active !== true) return null

  const value = payload?.[0]?.value
  if (typeof value !== 'number') return null

  return (
    <div className="rounded-container border border-border-modal bg-surface-raised px-3 py-2 text-xs">
      <p className="font-semibold text-text-primary">
        {typeof label === 'string' ? formatMonth(label) : label}
      </p>
      <p className="mt-1 flex items-center gap-3 text-text-secondary">
        {measure.label}
        <span className="ml-auto font-semibold tabular-nums text-text-primary">
          {value.toLocaleString('pt-BR')}
        </span>
      </p>
    </div>
  )
}

/**
 * O que a serie NAO cobre, dito com o numero (`H-54`).
 *
 * Processo sem `ETA2` nao entra no volume, e sem data de registro nao entra nos
 * desembaracados: data ausente nao pertence a mes nenhum (A-20), e sumir sem
 * contagem seria descarte silencioso (regra inviolavel 2). Medido em 21/09/2026:
 * 65 dos 650 sem `ETA2` e 167 sem `RG`.
 *
 * **Vive DENTRO do painel desde `D-58`, e o nome deixou de citar a reconstrucao.**
 * Solta abaixo do par, ela falava so da coluna da direita enquanto ocupava a
 * largura das duas, repetia o numero de `RG` que o painel irmao ja diz, e abria
 * declarando uma distincao que a tela nao faz mais.
 */
function SeriesCoverageNote({
  reconstructed,
}: {
  reconstructed: MonthlyHistoryResponse['reconstructed']
}) {
  const previsao = reconstructed.points.filter((point) => point.forecast)

  return (
    <p className="mt-3 text-xs text-text-secondary">
      <strong className="font-semibold">{reconstructed.missingEta2.toLocaleString('pt-BR')}</strong>{' '}
      processos não têm data de chegada (ETA2) e ficam fora do Volume;{' '}
      <strong className="font-semibold">
        {reconstructed.missingRegistration.toLocaleString('pt-BR')}
      </strong>{' '}
      não têm data em RG e ficam fora dos Desembaraçados. Quem não tem a data não entra em mês
      nenhum — é por isso que nenhuma das duas curvas alcança o total da planilha.
      {previsao.length > 0 && (
        <>
          {' '}
          Os {previsao.length === 1 ? 'último mês' : `últimos ${previsao.length} meses`} — a partir
          de {formatMonth(previsao[0]?.month ?? '')} — são{' '}
          <strong className="font-semibold">previsão</strong>: a data já está na planilha, o mês
          ainda não aconteceu.
        </>
      )}
    </p>
  )
}

/**
 * A planilha foi lida e nenhum processo tem `ETA2` nem data em RG (`D-58`).
 *
 * **Nao e zero processo, e nao e falha.** Serie sem ponto nenhum e ausencia de
 * DATA, e um grafico zerado aqui afirmaria que a planilha esta vazia (regra
 * inviolavel 3). Distinto de `semLeitura`, que a casca trata antes — ver
 * `useHistory`.
 */
function EmptyHistory() {
  return (
    <section
      aria-label="Evolução mensal"
      className="rounded-container border border-border-subtle bg-surface-raised p-6 text-sm"
    >
      <h2 className="text-base font-semibold text-text-secondary">
        Nenhum processo tem data para montar a série.
      </h2>
      <p className="mt-2 text-text-secondary">
        A evolução é derivada das datas que a planilha carrega — a de chegada para o volume, e a da
        coluna RG para os desembaraçados. Sem nenhuma das duas preenchida não há mês a desenhar, e
        um gráfico zerado afirmaria que não há processos, o que é diferente.
      </p>
    </section>
  )
}

/**
 * A amostra da cor, do tamanho em que ela se le.
 *
 * O padrao do Recharts desenha um icone de 14px, que e pouco para a linha ser
 * reconhecida ao lado do nome; 28px bastam. **O parametro `dashed` saiu com a
 * serie observada** (`D-58`): ele existia para separar o par que dividia a cor,
 * e sem par nao ha o que separar.
 */
function SeriesStroke({ color }: { color: string }) {
  return (
    <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true" className="shrink-0">
      <line x1="0" y1="4" x2="28" y2="4" stroke={color} strokeWidth="2" />
    </svg>
  )
}

/**
 * A chave do grafico, na faixa do cabecalho — o lugar que no painel irmao e do
 * checkbox, e e o que alinha os dois graficos do par (`D-57`).
 *
 * **Tres entradas, e nao cinco.** Cor diz a MEDIDA e traco diz a ORIGEM, entao
 * listar `Volume (observado)` e `Volume (reconstruido)` separados gastava duas
 * linhas da faixa para repetir a mesma cor. A regra do tracejado e dita uma vez,
 * abaixo, com a amostra ao lado.
 *
 * **O nome veste tinta de texto, e nao a cor da serie.** Quem carrega a
 * identidade e o traco ao lado; texto colorido gasta contraste para repetir o
 * que a amostra ja diz.
 */
function MonthlyLegend() {
  return (
    <>
      <ul className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
        {MEASURES.map((measure) => (
          <li key={measure.key} className="flex items-center gap-2">
            <SeriesStroke color={measure.color} />
            {measure.label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">
        Um processo entra no volume pela data de chegada, e nos desembaraçados pela data em RG
      </p>
    </>
  )
}

/**
 * O tooltip proprio, por tres motivos que o padrao do Recharts nao atende.
 *
 * 1. Ele nao desenha o traco, e sem ele as duas linhas do par chegam ao leitor
 *    so como cor — que e a mesma de proposito.
 * 2. Ele pinta o valor com a cor da serie e o mes em cinza claro sobre caixa
 *    branca fixa: no esquema escuro o cabecalho quase some, porque a caixa nao
 *    acompanha o tema.
 * 3. Ele ordena por nome. Aqui a ordem e a das linhas na tela, com o par junto.
 *
 * Mes sem a medida nao vira zero — a linha simplesmente nao aparece, como o
 * traco da tabela irma (regra inviolavel 3).
 */
function MonthlyTooltip({ active, label, payload }: TooltipContentProps) {
  if (active !== true) return null

  const valueByKey = new Map((payload ?? []).map((entry) => [entry.dataKey, entry.value]))
  const rows = MEASURES.map((line) => ({ line, value: valueByKey.get(line.key) })).filter(
    (row): row is { line: MeasureDefinition; value: number } => typeof row.value === 'number',
  )
  if (rows.length === 0) return null

  return (
    <div className="rounded-container border border-border-modal bg-surface-raised px-3 py-2 text-xs">
      <p className="font-semibold text-text-primary">
        {typeof label === 'string' ? formatMonth(label) : label}
      </p>
      <ul className="mt-1 space-y-1">
        {rows.map(({ line, value }) => (
          <li key={line.key} className="flex items-center gap-2">
            <SeriesStroke color={line.color} />
            <span className="text-text-secondary">{line.label}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-text-primary">
              {value.toLocaleString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * O grafico e a tabela sobre os mesmos pontos. Um eixo so: as medidas contam
 * processos, e escalas separadas fariam o Canal Vermelho — cinco linhas na
 * planilha real — parecer da mesma ordem que o volume.
 */
function MonthlySeries({
  reconstructed,
}: {
  reconstructed: MonthlyHistoryResponse['reconstructed']
}) {
  const points = reconstructed.points
  return (
    <section
      aria-label="Evolução mensal"
      className="flex flex-col rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Evolução mensal</h2>
      <p className="mt-1 text-xs text-text-muted">
        Pelas datas da planilha · cada ponto é o total acumulado até o fim do mês
      </p>

      <div className="mt-3 border-y border-border-subtle py-2">
        <MonthlyLegend />
      </div>

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
      <div className="mt-3 h-64 w-full">
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
            <Tooltip content={(props) => <MonthlyTooltip {...props} />} />
            {MEASURES.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={points.length === 1}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <NumbersDisclosure>
        {/* A alternativa textual do grafico: o SVG do Recharts nao e legivel por
            leitor de tela. */}
        {/* `ACHADO 19`. A exceção bidimensional de `SC 1.4.10` cobre a TABELA,
            e não a página: sem o invólucro, ela arrasta as notas irmãs e a
            barra de filtros para a rolagem horizontal. Mesmo padrão que
            `ProcessTable` já usa. */}
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">
              Volume e desembaraçados acumulados ao fim de cada mês
            </caption>
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                <th className="pb-1 font-medium">mês</th>
                {MEASURES.map((measure) => (
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
                  {MEASURES.map((measure) => (
                    <td key={measure.key} className="py-1 text-right tabular-nums">
                      {point[measure.key].toLocaleString('pt-BR')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NumbersDisclosure>

      <SeriesCoverageNote reconstructed={reconstructed} />
    </section>
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
