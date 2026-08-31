import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * O endereco da regiao viva que sobrevive ao `return` antecipado das paginas.
 *
 * Mora aqui, e nao em `App.tsx`, para nao fechar um ciclo de import: a casca
 * importa as sete paginas, e as paginas importam este modulo. Constante, e nao
 * literal repetido — um `id` escrito duas vezes vira dois `id` diferentes no
 * primeiro ajuste, e o portal falharia em silencio.
 */
export const PAGE_LIVE_REGION_ID = 'regiao-viva-da-pagina'

/**
 * A segunda regiao, para o que **nao** interrompe.
 *
 * "A planilha ainda nao foi lida" e contexto, e nao urgencia: anuncia-lo como
 * `alert` cortaria o que o leitor de tela estivesse falando. Sao dois papeis
 * porque sao duas coisas, a mesma razao pela qual `StatusBanner` tem duas.
 */
export const PAGE_LIVE_STATUS_ID = 'regiao-viva-da-pagina-status'

/**
 * O aviso de uma pagina, anunciado pela regiao que `H-43` deixou na casca.
 *
 * **Por que nao basta pos `role="alert"` no proprio aviso.** As sete paginas
 * fazem `return` antecipado no estado de erro: o no com o `role` NASCE ja
 * populado, e a MDN e explicita — *"Do not try to dynamically add/generate an
 * element with `role='alert'` that is already populated"*. Sem estado anterior,
 * o leitor de tela nao tem o que comparar, e a mensagem nao e anunciada
 * (`ACHADO 11`).
 *
 * Uma regiao declarada DENTRO da pagina nao resolve: ela nasceria junto com o
 * `return`, no mesmo commit em que o texto chega. Quem sobrevive a troca de
 * estado da pagina e o no da casca, que nao desmonta.
 *
 * **O texto e lido uma vez so.** O bloco visivel e `aria-hidden`, e quem carrega
 * o conteudo acessivel e o portal — sem isso o operador ouviria a mesma frase
 * duas vezes, uma no fluxo e outra na regiao viva.
 *
 * Fora da casca — teste de pagina isolada — nao ha alvo, e o portal simplesmente
 * nao acontece. O bloco visivel continua na tela, e e por isso que ele carrega o
 * texto de verdade, e nao um resumo.
 */
export function PageAlert({
  announcement,
  children,
  className,
  tone = 'alert',
}: {
  /** O que o leitor de tela anuncia. Texto puro: a regiao viva recebe so isto. */
  announcement: string
  /** O que a tela mostra no lugar do conteudo da pagina. */
  children: ReactNode
  className?: string
  /** `alert` interrompe; `status` espera a vez. Ausencia de leitura e contexto. */
  tone?: 'alert' | 'status'
}) {
  return (
    <>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
      <LiveAnnouncement text={announcement} tone={tone} />
    </>
  )
}

/**
 * So o anuncio, sem bloco visivel.
 *
 * Existe para o caso em que a tela JA mostra a informacao num elemento que fica
 * — a linha de conferencia de A-12 na Pagina Inicial, que existe sempre e so
 * muda de tom. Acrescentar `role` a ela quando a soma quebra criaria uma regiao
 * ja populada, que e o mesmo `ACHADO 11` por outro caminho.
 */
export function LiveAnnouncement({
  text,
  tone = 'alert',
}: {
  text: string
  tone?: 'alert' | 'status'
}) {
  const target = useLiveRegion(tone === 'alert' ? PAGE_LIVE_REGION_ID : PAGE_LIVE_STATUS_ID)

  return target === null ? null : createPortal(text, target)
}

/**
 * O alvo do portal, resolvido DEPOIS da montagem.
 *
 * Durante o render do filho o `<div>` da casca pode ainda nao estar no
 * documento — o React insere os nos no commit. Resolver num efeito tambem e o
 * que faz o conteudo chegar num no que ja existia, que e a condicao do anuncio.
 */
function useLiveRegion(id: string): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById(id))
  }, [id])

  return target
}
