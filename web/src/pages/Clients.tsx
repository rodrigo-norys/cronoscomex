import { RankingBar } from '../components/RankingBar.tsx'
import { type MultiFilterKey, useFilters } from '../hooks/useFilters.ts'
import { useIndicators } from '../hooks/useIndicators.ts'
import { navigate } from '../router.ts'

/**
 * Pagina Clientes (RF-11): a distribuicao da carteira em tres dimensoes —
 * CLT (IND-10, IND-18), IMPORTADOR (IND-11, IND-19) e MERCADORIA (IND-13).
 *
 * A terceira entrou por A-65: era calculada desde `H-11`, servida em
 * `rankings.goods`, e nenhuma pagina a exibia. Com ela vinha o `bazarShare` de
 * A-34, que existe para o operador nao ler o ranking de mercadorias como se
 * fosse fiel — e que por isso aparece **junto** dele, nunca em separado.
 *
 * Os tres rankings chegam prontos: ordenados, desempatados e cortados em
 * `meta.topN` pelo servidor. Aqui so se escolhe o rotulo e se desenha a barra.
 */

interface ClientsProps {
  queryString: string
  dataVersion: number
}

interface RankingDefinition {
  readonly source: 'clients' | 'importers' | 'goods'
  readonly filter: MultiFilterKey
  readonly title: string
  readonly emptyMessage: string
}

const RANKINGS: readonly RankingDefinition[] = [
  {
    source: 'clients',
    filter: 'client',
    title: 'Clientes',
    emptyMessage: 'Nenhum cliente no recorte atual.',
  },
  {
    source: 'importers',
    filter: 'importer',
    title: 'Importadores',
    emptyMessage: 'Nenhum importador no recorte atual.',
  },
  {
    source: 'goods',
    filter: 'goods',
    title: 'Mercadorias',
    emptyMessage: 'Nenhuma mercadoria no recorte atual.',
  },
]

export function Clients({ queryString, dataVersion }: ClientsProps) {
  const state = useIndicators(queryString, dataVersion)
  const filters = useFilters()

  /**
   * Aplicar, e nao alternar: quem clica num item pede aquele recorte. `toggle`
   * sozinho desmarcaria o valor ja selecionado e levaria a Operacional com o
   * filtro que o clique acabou de tirar.
   *
   * A ordem importa. `replaceState` e sincrono, entao `navigate` ja le a query
   * nova; invertido, a pagina trocaria antes do filtro existir e o recorte se
   * perderia.
   */
  const selectAndOpen = (key: MultiFilterKey, value: string): void => {
    if (!filters.selection.multi[key].includes(value)) filters.toggle(key, value)
    navigate('/operacional')
  }

  if (state.status === 'erro') {
    return (
      <p role="alert" className="panel-error">
        <strong className="font-semibold">Não foi possível carregar os rankings.</strong>{' '}
        {state.message}
      </p>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <p role="status" className="panel-no-read">
        Nenhuma leitura da planilha foi concluída ainda. Os rankings aparecem assim que a primeira
        terminar — lista vazia aqui não significa nenhum processo.
      </p>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando rankings…</p>
  }

  const { rankings, meta } = state.indicators

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Os {meta.topN} maiores de cada dimensão, no recorte atual. Clique em um item para filtrar
        por ele e abrir a Página Operacional.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {RANKINGS.map((ranking) => (
          <RankingBar
            key={ranking.source}
            title={ranking.title}
            entries={rankings[ranking.source]}
            emptyMessage={ranking.emptyMessage}
            // `H-56`: a linha do grupo recorta por `clientGroup`; o nome de um
            // componente, acima da barra, recorta o cliente dele.
            onSelect={(value, isGroup) =>
              selectAndOpen(isGroup ? 'clientGroup' : ranking.filter, value)
            }
            {...(ranking.source === 'goods'
              ? { caveat: <BazarCaveat share={meta.bazarShare} /> }
              : {})}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A-34, exibida onde qualifica.
 *
 * `null` significa que nenhum processo tem mercadoria preenchida — nao ha
 * fracao a apresentar, e a ressalva afirmaria uma distorcao que nao foi medida.
 * A base da fracao sao os processos **com** mercadoria, de proposito: dilui-la
 * com as linhas em branco mascararia justamente o que ela denuncia.
 */
function BazarCaveat({ share }: { share: number | null }) {
  if (share === null) return null

  return (
    <p className="mt-2 rounded border border-state-warning-border bg-state-warning-bg px-3 py-2 text-xs text-state-warning-fg">
      <strong className="font-semibold">
        BAZAR concentra {(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
      </strong>{' '}
      dos processos com mercadoria preenchida. É um rótulo genérico da planilha, não uma mercadoria
      real — o ranking abaixo descreve como o campo é preenchido, não o que se importa.
    </p>
  )
}
