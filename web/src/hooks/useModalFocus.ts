import { type RefObject, useEffect } from 'react'

/**
 * O comportamento de foco de uma sobreposicao modal, numa fonte so (`H-83`).
 *
 * **Nasceu dentro do `FilterPanel` em `H-82`** e saiu de la quando a busca por
 * atalho precisou do mesmo: duas copias divergem, e foi exatamente isso que
 * `H-60` teve de desfazer entre `MultiSelect` e os chips. O criterio de aceite
 * de `H-83` exige "o mesmo mecanismo, e nao uma segunda implementacao", e este
 * arquivo e o que torna a exigencia verificavel.
 *
 * **Ele cuida de tres coisas, e nao de uma quarta.** Foco de entrada, `Esc`, e a
 * prisao de `Tab`. A **inercia do resto da tela** e da casca: `inert` precisa
 * ser aplicado nos IRMAOS da sobreposicao, e so quem monta a arvore sabe quem
 * sao — dentro do proprio componente ele se aplicaria a si mesmo.
 *
 * **A prisao e manual porque `inert` nao basta sozinho.** Ele tira os irmaos da
 * ordem de tabulacao, mas a interface do navegador continua depois do ultimo
 * elemento focavel: quem passa daquele ponto perde a sobreposicao de vista sem
 * que nada a traga de volta.
 */

/**
 * Tudo que recebe foco por tabulacao. `[tabindex="-1"]` fica de fora de
 * proposito: o no de entrada costuma te-lo, e inclui-lo faria a primeira `Tab`
 * voltar para ele em vez de avancar.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalFocusOptions {
  /** A raiz da sobreposicao. O que estiver fora dela nao recebe `Tab`. */
  container: RefObject<HTMLElement | null>
  /**
   * Quem recebe o foco ao abrir.
   *
   * O titulo, e nao o primeiro campo: entrar num campo faz o leitor de tela
   * anunciar o campo sem dizer onde ele esta. A busca e a excecao declarada —
   * ali o campo **e** o conteudo, e `H-83` pede o foco nele.
   */
  initialFocus: RefObject<HTMLElement | null>
  onClose: () => void
}

export function useModalFocus({ container, initialFocus, onClose }: ModalFocusOptions): void {
  useEffect(() => {
    initialFocus.current?.focus()
  }, [initialFocus])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // Impede que uma sobreposicao interna a outra feche as duas de uma vez.
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const alvos = container.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!alvos || alvos.length === 0) return

      const primeiro = alvos[0]
      const ultimo = alvos[alvos.length - 1]
      if (primeiro === undefined || ultimo === undefined) return

      // O no de entrada tem `tabIndex={-1}` e nao esta na lista: com o foco
      // nele, `Tab` sem esta guarda sairia da sobreposicao na primeira tecla.
      if (document.activeElement === initialFocus.current) {
        event.preventDefault()
        ;(event.shiftKey ? ultimo : primeiro).focus()
        return
      }
      if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
        return
      }
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [container, initialFocus, onClose])
}
