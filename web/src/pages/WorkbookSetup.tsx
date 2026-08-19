import { useEffect, useState } from 'react'
import { useWorkbookConfig } from '../hooks/useWorkbookConfig.ts'

/**
 * A tela de configuracao do caminho da planilha (`H-34`).
 *
 * E a saida de `PD-01`: ate ela, apontar a aplicacao para a planilha significava
 * editar `config/app.json` a mao — com aspas, virgulas e barras invertidas do
 * Windows —, num painel cujo usuario final nao e tecnico.
 *
 * **Nao calcula nada, e nao valida o caminho.** Quem diz se o arquivo existe, e
 * legivel e tem a extensao certa e o servidor: validar aqui tambem criaria uma
 * segunda regra, que divergiria da primeira no dia em que uma das duas mudasse.
 * A tela mostra a frase que o servidor escreveu.
 */
export function WorkbookSetup({
  dataVersion,
  firstRun,
}: {
  dataVersion: number
  /** Primeira execucao: nao houve leitura nenhuma, e nao ha painel para voltar. */
  firstRun: boolean
}) {
  const { state, save, saving } = useWorkbookConfig(dataVersion)
  const [path, setPath] = useState('')
  const [refusal, setRefusal] = useState('')

  // O campo parte do caminho ja configurado — na troca de arquivo, corrigir uma
  // pasta e mais comum que digitar o caminho inteiro. Depende da carga, e por
  // isso nao pode ser estado inicial do `useState`.
  useEffect(() => {
    if (state.status === 'pronto') setPath(state.config.workbookPath)
  }, [state])

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setRefusal((await save(path)) ?? '')
  }

  return (
    <section aria-label="Configuração da planilha" className="max-w-3xl">
      <h2 className="text-lg font-semibold text-slate-900">
        {firstRun ? 'Aponte a planilha para começar' : 'Caminho da planilha'}
      </h2>

      {firstRun ? (
        <p className="mt-2 text-sm text-slate-600">
          O painel ainda não leu nenhuma planilha. Informe onde ela está na sua pasta do OneDrive —
          isso é pedido <strong>uma vez</strong>, e fica salvo para as próximas aberturas.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Trocar o arquivo faz o painel reler imediatamente, sem reiniciar.
        </p>
      )}

      {state.status === 'carregando' && (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Carregando a configuração atual…
        </p>
      )}

      {state.status === 'erro' && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Não foi possível ler a configuração atual: {state.message}
        </p>
      )}

      {state.status === 'pronto' && (
        <form className="mt-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="workbook-path">
            Caminho completo do arquivo da planilha
          </label>
          <input
            id="workbook-path"
            name="workbookPath"
            type="text"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />

          {state.config.workbookPath !== '' && !state.config.exists && (
            <p className="mt-2 text-sm text-amber-800">
              O caminho salvo não aponta para nenhum arquivo. Confira se a pasta do OneDrive está
              sincronizada.
            </p>
          )}
          {state.config.exists && !state.config.readable && (
            <p className="mt-2 text-sm text-amber-800">
              O arquivo existe, mas o painel não consegue lê-lo.
            </p>
          )}

          <button
            type="submit"
            disabled={saving || path.trim() === ''}
            className="mt-4 rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Carregando a planilha…' : 'Carregar esta planilha'}
          </button>
        </form>
      )}

      {/*
        A regiao existe desde a montagem, e so o texto dentro dela muda: um no
        com `role="alert"` que nasce ja populado nao e anunciado pelo leitor de
        tela, porque nao houve mudanca a comparar.
      */}
      <p role="alert" className={refusal === '' ? 'sr-only' : 'mt-4 text-sm text-red-900'}>
        {refusal}
      </p>
    </section>
  )
}
