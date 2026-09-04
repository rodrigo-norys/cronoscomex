import { useRef, useState } from 'react'
import { useCommandSearch } from '../hooks/useCommandSearch.ts'
import { useModalFocus } from '../hooks/useModalFocus.ts'
import { NAV_PAGES, navigate, type Route } from '../router.ts'

/**
 * Achar um processo de qualquer tela, sem passar pela Pagina Operacional
 * (`H-83`).
 *
 * **Nenhum contrato novo:** `GET /api/processes` com o `search` de `H-17`, sobre
 * REF, BL e CNTR (`A-39`). O casamento e do servidor — a lista que chega aqui ja
 * vem recortada, e nada e filtrado no navegador (regra inviolavel 6).
 *
 * **O foco e a inercia sao os de `H-82`**, por `useModalFocus`: o criterio de
 * aceite exige o mesmo mecanismo, e nao uma segunda implementacao. A diferenca
 * declarada e o no de entrada — aqui o foco vai para o CAMPO, e nao para o
 * titulo, porque o campo e o conteudo desta sobreposicao.
 *
 * **Ela nao e paleta de comandos.** Buscar cliente e navio ficou fora pela
 * determinacao 3 do epico, e acoes — "aplicar edicoes", "recarregar" — fariam
 * dela outra coisa.
 */

interface CommandSearchProps {
  route: Route
  dataVersion: number
  onClose: () => void
}

export function CommandSearch({ route, dataVersion, onClose }: CommandSearchProps) {
  const [termo, setTermo] = useState('')
  const caixa = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const resultado = useCommandSearch(termo, dataVersion)

  useModalFocus({ container: caixa, initialFocus: campo, onClose })

  /**
   * Os sete destinos casam por texto AQUI, e isso nao contradiz a regra 6: eles
   * sao a navegacao da propria casca, nao dado da planilha. O que vem do
   * servidor e a lista de processos.
   */
  const limpo = termo.trim().toLowerCase()
  const destinos =
    limpo === '' ? NAV_PAGES : NAV_PAGES.filter((page) => page.label.toLowerCase().includes(limpo))

  const irPara = (path: string): void => {
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* `fixed`, e nao `absolute` como o painel de `H-82`: a busca alcanca
          QUALQUER tela, inclusive as que nao tem barra de filtros, e nao ha
          regiao de conteudo comum a todas onde ancorar. */}
      <div className="fixed inset-0 z-50 bg-overlay-scrim" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-16">
        <div
          ref={caixa}
          role="dialog"
          aria-modal="true"
          aria-label="Buscar processo"
          /* A borda e o que separa a caixa do fundo sob `forced-colors: active`,
             onde o `overlay-scrim` some — mesmo argumento de `border-modal` em
             `H-62`, medido em `H-82`. */
          className="motion-surface flex max-h-[70vh] w-full max-w-2xl flex-col rounded-container border border-border-modal bg-surface-raised"
        >
          <div className="border-b border-border-subtle p-3">
            <input
              ref={campo}
              type="search"
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Buscar por REF, BL ou contêiner"
              aria-label="Buscar por REF, BL ou contêiner"
              className="w-full rounded-control border border-border-control bg-surface-base px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {destinos.length > 0 && (
              <section aria-label="Páginas">
                <h2 className="px-2 py-1 text-xs font-medium text-text-secondary">Páginas</h2>
                <ul>
                  {destinos.map((page) => (
                    <li key={page.id}>
                      <button
                        type="button"
                        onClick={() => irPara(page.path)}
                        aria-current={route.pageId === page.id ? 'page' : undefined}
                        className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover"
                      >
                        {page.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Processos">
              <h2 className="px-2 py-1 text-xs font-medium text-text-secondary">Processos</h2>

              {resultado.status === 'ocioso' && (
                <p className="px-2 py-2 text-sm text-text-muted">
                  Digite ao menos duas letras da REF, do BL ou do contêiner.
                </p>
              )}

              {resultado.status === 'carregando' && (
                <p className="px-2 py-2 text-sm text-text-muted">Buscando…</p>
              )}

              {/* Estado proprio e afirmativo: uma lista vazia aqui diria que a
                  planilha nao tem o processo, e o que se sabe e que o TERMO nao
                  casou (regra inviolavel 3). */}
              {resultado.status === 'pronto' && resultado.items.length === 0 && (
                <p className="px-2 py-2 text-sm text-text-muted">
                  Nenhum processo com “{termo.trim()}” em REF, BL ou contêiner.
                </p>
              )}

              {resultado.status === 'semLeitura' && (
                <p className="px-2 py-2 text-sm text-text-muted">A planilha ainda não foi lida.</p>
              )}

              {resultado.status === 'erro' && (
                <p role="alert" className="px-2 py-2 text-sm text-state-error-fg">
                  Não foi possível buscar: {resultado.message}
                </p>
              )}

              {resultado.status === 'pronto' && resultado.items.length > 0 && (
                <>
                  <ul>
                    {resultado.items.map((item) => (
                      <li key={item.ref}>
                        <button
                          type="button"
                          onClick={() => irPara(`/processo/${encodeURIComponent(item.ref)}`)}
                          className="flex w-full flex-col gap-0.5 rounded-control px-2 py-1.5 text-left hover:bg-surface-hover"
                        >
                          <span className="font-mono text-sm text-text-primary">{item.ref}</span>
                          {/* O que casou nem sempre e a REF: sem BL e contêiner
                              a linha nao diz por que ela esta na lista. */}
                          <span className="truncate text-xs text-text-secondary">
                            {[item.client, item.billOfLading, item.container]
                              .filter((campo) => campo !== '')
                              .join(' · ') || '—'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {resultado.total > resultado.items.length && (
                    <p className="px-2 py-2 text-xs text-text-muted">
                      Mostrando {resultado.items.length} de {resultado.total}. Refine o termo.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
