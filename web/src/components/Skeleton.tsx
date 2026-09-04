import { LiveAnnouncement } from './PageAlert.tsx'

/**
 * O esqueleto de carregamento: a altura do conteudo real, antes dele chegar.
 *
 * **Ele existe para a pagina nao saltar.** O paragrafo "Carregando…" que estava
 * aqui media uma linha, entao a tela colapsava e voltava a crescer quando o
 * dado chegava — o conteudo abaixo se deslocava duas vezes por carga.
 *
 * **A linha e `h-10`, e isso nao e escolha desta fatia:** sao os 40 px de
 * `H-61`, a mesma altura da linha da tabela. Um esqueleto de outra altura
 * trocaria um salto por outro, menor.
 *
 * **A altura e UMA TELA, e nao a do conteudo inteiro** — decidido em
 * 04/09/2026, contra o que o criterio da historia dizia, e por medicao: a
 * Pagina Alertas tem **9.198 px** de conteudo com a planilha real, e a
 * Performance **1.773 px**. Um esqueleto fiel daria 191 barras pulsando e uma
 * barra de rolagem enorme que some ao carregar — pior que o salto que ele
 * existe para tirar. O que o operador percebe e o deslocamento do que esta a
 * VISTA; abaixo da dobra o conteudo cresce sem ninguem ver. Doze linhas sao
 * 600 px, uma tela util numa janela de 900.
 *
 * **O que o leitor de tela recebe e TEXTO, nunca forma.** As barras sao
 * `aria-hidden` e o anuncio vai pela regiao viva de `H-43` e `H-44`, no mesmo
 * par que `App.tsx` e `WorkbookSetup.tsx` ja usavam. O conteiner declara
 * `aria-busy`, como `StatCard` faz desde `H-16` — e ele **nao** e
 * `aria-hidden`, senao o `aria-busy` nao chegaria a ninguem.
 *
 * A pulsacao mora em `motion-pulse`, no `index.css`: utilitario de movimento no
 * `.tsx` reprova a guarda de `A10`. Sob `prefers-reduced-motion` ela para, e o
 * esqueleto fica estatico **sem** perder a altura, que e a razao de existir.
 */
/** `p-4` mais 12 linhas de 40 px com 8 px de intervalo: 600 px, uma tela. */
const ONE_SCREEN = 12

interface SkeletonProps {
  /** Quantas linhas de 40 px. O padrao e uma tela; so encurte com medida. */
  rows?: number
  /** O que o leitor de tela ouve. Frase inteira, com ponto final. */
  announcement: string
}

export function Skeleton({ rows = ONE_SCREEN, announcement }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a posicao E a identidade — as barras nao tem dado, a lista tem tamanho fixo, e nenhuma e removida do meio; o caso que a regra existe para pegar e lista que reordena
            key={index}
            className="motion-pulse h-10 rounded-control bg-surface-sunken"
          />
        ))}
      </div>

      <LiveAnnouncement text={announcement} tone="status" />
    </div>
  )
}
