import type { ReactNode } from 'react'
import type { IndicatorsResponse } from '../api-client.ts'

type RankingEntry = IndicatorsResponse['rankings']['clients'][number]

interface RankingBarProps {
  title: string
  entries: readonly RankingEntry[]
  /**
   * Recebe a **chave normalizada**, que e o que os filtros casam (TD-04).
   *
   * Ausente torna a linha inerte, e isso e usado de proposito no ranking por
   * responsavel de `H-19`: A-18 faz o filtro `colaborador1` selecionar **junto**
   * `colaborador1_outros_clientes`, enquanto o ranking os exibe separados, por
   * serem perguntas diferentes. Clicar numa linha de 120 e cair numa tela de 129
   * faria o operador desconfiar do numero certo.
   */
  onSelect?: (key: string, isGroup: boolean) => void
  /** Fica sob o titulo, antes da lista: ressalva lida depois nao ressalva nada. */
  caveat?: ReactNode
  /** Metrica ao lado da contagem — o `overdueCount` de A-27 em `H-19`. */
  secondary?: (entry: RankingEntry) => ReactNode
  emptyMessage: string
}

/**
 * Um ranking em barras horizontais, cada linha levando ao recorte que ela conta.
 *
 * Nada e ordenado nem cortado aqui: a lista chega decrescente, com desempate
 * alfabetico pela chave (A-25) e ja limitada a `meta.topN` pelo servidor. A
 * unica aritmetica e a largura da barra — proporcao de pixel, nao indicador
 * derivado, do mesmo estatuto da soma exibida na Pagina Inicial.
 */
export function RankingBar({
  title,
  entries,
  onSelect,
  caveat,
  secondary,
  emptyMessage,
}: RankingBarProps) {
  const largest = entries.reduce((greatest, entry) => Math.max(greatest, entry.count), 0)

  return (
    <section
      aria-label={title}
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
      {caveat}

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.key}>
              <RankingRow
                entry={entry}
                largest={largest}
                {...(onSelect ? { onSelect } : {})}
                {...(secondary ? { secondary } : {})}
              />

              {/* Os membros de um grupo (`H-56`) viram linhas proprias,
                  indentadas e na MESMA escala do ranking: nome e numero ficam
                  legiveis por menor que seja a fatia, e a comparacao com os
                  demais clientes continua valendo. Rotular dentro da barra
                  empilhada nao serve aqui — medido, o menor membro ocupa 0,6%
                  da largura. */}
              {entry.segments !== undefined && entry.segments.length > 0 && (
                <ul>
                  {entry.segments.map((segment) => (
                    <li key={segment.key}>
                      <RankingRow
                        entry={segment}
                        largest={largest}
                        nested
                        {...(onSelect ? { onSelect } : {})}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** A-26: a grafia de origem, nunca a chave normalizada. */
function displayLabel(entry: RankingEntry): string {
  return entry.label === '' ? '(sem valor)' : entry.label
}

function RankingRow({
  entry,
  largest,
  onSelect,
  secondary,
  nested = false,
}: {
  entry: RankingEntry
  largest: number
  onSelect?: (key: string, isGroup: boolean) => void
  secondary?: (entry: RankingEntry) => ReactNode
  /** Membro de um grupo (`H-56`): recuado, mais baixo, e nunca um grupo. */
  nested?: boolean
}) {
  const label = displayLabel(entry)
  const share = largest === 0 ? 0 : (entry.count / largest) * 100
  const isGroup = (entry.segments?.length ?? 0) > 0

  const content = (
    <>
      {/* Com `secondary` a linha tem QUATRO slots de largura fixa, e a 320 px
          eles somam 348 antes da barra — `VN-1/A` mediu a pagina rolando ate
          385 (`H-67`). Abaixo de 640 o rotulo passa a ocupar a linha inteira e
          o resto desce junto, em vez de a linha romper a borda. **So incide
          quando ha `secondary`**, e so `Performance.tsx` o passa: as outras
          seis paginas que usam este componente nao recebem nem o `flex-wrap`,
          e por isso nao mudam. */}
      {/* `title` porque o rotulo TRUNCA, e trunca nos dois tamanhos de fonte:
          medido em `H-65`/`VN-2` a 1280 px, 160 px visiveis para 200
          necessarios no padrao e 240 para 300 em "Muito grande" — a proporcao e
          a mesma, o que cresce e o deficit. Sem ele o nome consolidado do
          colaborador some sem aviso, e a regra ja estava fixada em
          `ProcessTable`: texto livre que trunca guarda o valor inteiro. */}
      <span
        title={label}
        className={`shrink-0 truncate text-sm group-hover:text-text-primary ${
          secondary ? 'w-full sm:w-40' : 'w-40'
        } ${nested ? 'pl-5 text-xs text-text-muted' : 'text-text-secondary'}`}
      >
        {label}
      </span>
      {/* Raio de controle tambem na barra: ela nao e contentor, e `D-22` nao
          admite valor intermediario. Na barra fina o efeito e quase o de uma
          pilula, e isso e consequencia do raio unico, nao excecao. */}
      <span className={`grow rounded-control bg-meter-track ${nested ? 'h-2' : 'h-4'}`}>
        <span
          className="block h-full rounded-control bg-meter-fill group-hover:bg-meter-fill-hover"
          style={{ width: `${share}%` }}
        />
      </span>
      <span
        className={`w-12 shrink-0 text-right font-mono tabular-nums ${
          nested ? 'text-xs text-text-muted' : 'text-sm text-text-secondary'
        }`}
      >
        {entry.count.toLocaleString('pt-BR')}
      </span>
      {secondary && <span className="w-24 shrink-0 text-right text-xs">{secondary(entry)}</span>}
    </>
  )

  // `min-h-6` sao 24 px, e e `SC 2.5.8` (`H-74`, `ACHADO 9`): com `py-0.5`
  // sobre `text-xs` a caixa media **20 px**, e o `<ul>` nao tem `gap` — dois
  // membros vizinhos ficavam a 20 px de centro a centro, e circulos de 24 px
  // centrados em cada um se intersectam, o que nao satisfaz a excecao Spacing.
  //
  // `min-h` e nao `py-1`: o recuo menor e o que distingue o aninhado da linha
  // de topo, que ja mede 28 px e passa.
  const shared = `group flex w-full items-center gap-3 rounded-control px-1 text-left ${
    secondary ? 'flex-wrap' : ''
  } ${nested ? 'min-h-6 py-0.5' : 'py-1'}`

  if (onSelect === undefined) return <span className={shared}>{content}</span>

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key, isGroup)}
      title={`Filtrar por ${label} e abrir na Página Operacional`}
      className={`${shared} hover:bg-surface-sunken`}
    >
      {content}
    </button>
  )
}
