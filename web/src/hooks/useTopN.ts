import { useCallback, useMemo } from 'react'
import { replaceQuery, useQuery } from '../router.ts'

/**
 * Quantos itens cada ranking mostra, escolhido pelo operador (21/09/2026).
 *
 * **Ate aqui o numero vivia so em `config/app.json`**, e mudar de 10 para 20
 * exigia editar JSON e reiniciar — o mesmo gesto que `H-34` tirou do caminho da
 * planilha e `H-88` do mapa de clientes.
 *
 * **E parametro DA PAGINA, e a casca o apaga ao sair dela** — emenda de
 * 21/09/2026 a `D-55`, que o declarara global. O argumento de la continua
 * verdadeiro e deixou de ser decisivo: Clientes e Performance consomem os
 * mesmos rankings, e agora o valor escolhido numa nao alcanca a outra, que
 * volta ao padrao de `app.json`. Quem apaga e `App.tsx`, pela tabela
 * `PARAMS_POR_PAGINA`; ele viaja na `queryString` sem fiacao nova, porque ela e
 * a query INTEIRA da URL.
 *
 * **Quem valida e o servidor.** Valor fora da faixa volta ao padrao de
 * `app.json` la, e nao aqui: duas validacoes divergem no primeiro ajuste, e a
 * regra de quantos itens uma rota devolve e da rota.
 */

/** O nome do parametro na URL. A casca o apaga ao sair da Pagina Clientes. */
export const TOP_N_PARAM = 'topN'

/**
 * Os tamanhos que a tela oferece, e o ultimo e "Todos".
 *
 * `MAX_TOP_N` e o mesmo teto da paginacao — `MAX_LIMIT` de
 * `src/domain/process-query.ts` —, para o pior caso de renderizacao ficar
 * previsto num lugar so. **Ele nao mente**, pelo mesmo motivo do "Todas" de
 * `H-100`: passando de mil grupos, o corte volta a acontecer e `groupTotals`
 * continua dizendo de quantos.
 */
export const MAX_TOP_N = 1000
export const TOP_N_SIZES = [5, 10, 20, 50, MAX_TOP_N] as const

export const topNLabel = (size: number): string => (size === MAX_TOP_N ? 'Todos' : String(size))

interface TopNControl {
  /** O valor da URL, ou `null` quando o operador nao escolheu — aí vale o do servidor. */
  readonly escolhido: number | null
  readonly setTopN: (valor: number) => void
}

export function useTopN(): TopNControl {
  const query = useQuery()

  const escolhido = useMemo(() => {
    const bruto = query.get(TOP_N_PARAM)
    if (bruto === null) return null

    const valor = Number(bruto)
    return Number.isInteger(valor) && valor >= 1 && valor <= MAX_TOP_N ? valor : null
  }, [query])

  const setTopN = useCallback(
    (valor: number): void => {
      const draft = new URLSearchParams(query)
      draft.set(TOP_N_PARAM, String(valor))
      const texto = draft.toString()
      replaceQuery(texto === '' ? '' : `?${texto}`)
    },
    [query],
  )

  return { escolhido, setTopN }
}
