import { useEffect, useRef, useState } from 'react'
import type { GridCellProps } from '../hooks/useGridNavigation.ts'
import { LiveAnnouncement } from './PageAlert.tsx'

/**
 * Uma celula da tabela que se edita onde esta, sem abrir o detalhe.
 *
 * **Nada aqui grava no `.xlsx`, e nada aqui valida.** Quem envia e `onCommit`,
 * e quem recusa `2026-02-31` ou texto acima do limite e o servidor — a mensagem
 * que aparece na celula e a dele. Uma segunda tabela de regras no cliente
 * divergiria da primeira no ajuste seguinte (regra inviolavel 6).
 *
 * **Duas rotas usam esta celula, e por isso ela nao conhece nenhuma das duas.**
 * As seis colunas que sao celula da planilha enfileiram em `POST /api/edits`;
 * Cliente declara a regra de consolidacao em
 * `PUT /api/processes/:ref/client`, que nao enfileira nada. Categoria fica de
 * fora: ela sai de cinco regras das quais so uma le a celula L (`A-22`), e
 * editar o rotulo gravaria numa celula que nao esta a vista.
 */

interface EditableCellProps {
  processRef: string
  /** Como o campo se chama para quem le a tela. */
  label: string
  kind: 'text' | 'date'
  /** O valor como a planilha o guarda: texto cru, ou `AAAA-MM-DD` na data. */
  value: string
  /** O que a celula mostra quando nao esta em edicao. Padrao: o proprio valor. */
  display?: string
  /** O que a coluna acrescenta ao `<td>` — fonte monoespacada, alinhamento. */
  className?: string
  /** As quatro props da grade: a celula participa da navegacao por setas. */
  cell: GridCellProps
  /** Envia o valor. `null` e celula vazia. Rejeicao vira a mensagem da celula. */
  onCommit: (value: string | null) => Promise<unknown>
  /** Recarrega a lista: a projecao do servidor ja inclui o que foi enviado. */
  onEdited: () => void
}

export function EditableCell({
  processRef,
  label,
  kind,
  value,
  display,
  className = '',
  cell,
  onCommit,
  onEdited,
}: EditableCellProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /**
   * Escape sai da edicao, e sair da edicao dispara `blur` — que grava. Sem esta
   * marca o cancelamento gravaria exatamente o que o operador acabou de desfazer.
   */
  const cancelling = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const container = useRef<HTMLTableCellElement>(null)
  /** Se a celula ESTAVA em edicao, para devolver o foco ao sair dela. */
  const edited = useRef(false)

  const shown = display ?? value

  /**
   * O foco vai para o campo assim que a celula vira campo: a celula so virou
   * campo porque o operador a acionou, e pedir um segundo passo para digitar e
   * o que o Excel nao faz. Num efeito, e nao na prop de foco automatico do
   * React: ela so vale na MONTAGEM, e a celula abre depois — a tabela inteira ja
   * esta montada quando o operador clica.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: o gatilho e a ABERTURA, nao o valor digitado
  useEffect(() => {
    if (draft !== null) {
      edited.current = true
      input.current?.select()
      return
    }
    /*
      **O foco volta para a celula ao sair da edicao.** O campo desmonta, e sem
      isto o foco cai no `<body>` — que e a falha `SC 2.4.3` que `VN-4` mediu na
      outra ponta da aplicacao. Numa grade o efeito e pior: o operador perde a
      posicao e recomeca do cabecalho.
    */
    if (edited.current) {
      edited.current = false
      container.current?.focus()
    }
  }, [draft !== null])

  async function commit(): Promise<void> {
    if (cancelling.current) {
      cancelling.current = false
      return
    }
    if (draft === null) return

    // Campo de data vazio e **celula vazia**, e nao "nao mexer" — e assim que o
    // operador limpa uma data (`H-23`). Em texto, a string vazia e o mesmo.
    const next = kind === 'date' && draft === '' ? null : draft
    if ((next ?? '') === value) {
      setDraft(null)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onCommit(next)
      setDraft(null)
      onEdited()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function cancel(): void {
    cancelling.current = true
    setDraft(null)
    setError(null)
  }

  if (draft === null) {
    return (
      /*
        O teto e a medicao de `H-76` (`ACHADO 12`), herdada do componente de
        texto que esta celula substituiu. Contra a planilha real: dos **3591**
        valores de texto livre destas colunas, **81 eram cortados** com
        `max-w-48` — e **80 estavam em Navio**, cujo maior valor mede 196 px
        contra os 168 de orcamento. Subir o teto NAO alarga as outras: `max-w` e
        teto, e o algoritmo de tabela dimensiona pelo conteudo.

        `truncate` fica no `<td>` E no botao. Ele traz o `white-space: nowrap`
        que segura a linha de 40 px de `H-61`, e no botao e o que produz a
        reticencia — o valor inteiro continua no `title`.
      */
      <td
        ref={container}
        {...cell}
        className={`max-w-56 truncate px-3 ${className}`}
        /* O `title` carrega o texto VISIVEL, e nao o valor cru: ele existe para
           mostrar inteiro o que a coluna cortou, e na data o cru e `AAAA-MM-DD`
           enquanto a tela mostra `dd/mm/aaaa`. */
        {...(value !== '' ? { title: shown } : {})}
      >
        {/*
          O nome acessivel CONTEM o texto visivel, como `SC 2.5.3` exige e como
          o link da REF ja faz (`H-75`, `ACHADO 7`) — e diz de que processo a
          celula e, porque "Editar BL" repetido 200 vezes nao localiza nada.
        */}
        <button
          type="button"
          onClick={() => setDraft(value)}
          // Fora da ordem de tabulacao: quem tabula e a GRADE, e o botao e
          // acionado por Enter sobre a celula.
          tabIndex={-1}
          aria-label={`Editar ${label} de ${processRef}: ${shown}`}
          className="motion-tint block w-full truncate text-left hover:text-text-primary"
        >
          {shown}
        </button>
      </td>
    )
  }

  return (
    <td ref={container} {...cell} className="px-3">
      <input
        ref={input}
        type={kind === 'date' ? 'date' : 'text'}
        value={draft}
        disabled={busy}
        aria-label={`${label} de ${processRef}`}
        aria-invalid={error !== null}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit()
          }
          if (event.key === 'Escape') cancel()
        }}
        onBlur={() => void commit()}
        className="w-full rounded-control border border-border-control bg-surface-raised px-1 py-0.5 text-sm text-text-primary"
      />
      {error !== null && (
        <>
          <span className="block text-xs text-state-error-fg">{error}</span>
          <LiveAnnouncement text={`${label} de ${processRef}: ${error}`} />
        </>
      )}
    </td>
  )
}
