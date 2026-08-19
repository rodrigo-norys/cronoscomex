import { useEffect, useState } from 'react'
import type { ConfigFieldReport, ConfigFieldSource } from '../../../src/app/config.ts'
import type { WorkbookConfigResponse } from '../../../src/http/routes/config.ts'
import { useWorkbookConfig } from '../hooks/useWorkbookConfig.ts'

/**
 * A tela de configuracao do caminho da planilha (`H-34`), que `H-44` transformou
 * no INVENTARIO da configuracao.
 *
 * E a saida de `PD-01`: ate ela, apontar a aplicacao para a planilha significava
 * editar o `app.json` a mao — com aspas, virgulas e barras invertidas do
 * Windows —, num painel cujo usuario final nao e tecnico.
 *
 * **Nao calcula nada, e nao valida o caminho.** Quem diz se o arquivo existe, e
 * legivel e tem a extensao certa e o servidor: validar aqui tambem criaria uma
 * segunda regra, que divergiria da primeira no dia em que uma das duas mudasse.
 * A tela mostra a frase que o servidor escreveu.
 *
 * **Ela mostra o que ESTA configurado, e nao so o que falta** (`H-44`). Origem
 * de cada valor inclusive: `5173` vindo do arquivo e `5173` vindo do padrao sao
 * a mesma tela e coisas diferentes, e ocultar a distincao afirmaria configuracao
 * onde ha ausencia dela — regra inviolavel 3 aplicada a propria configuracao.
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
        <>
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

            {/*
              A mesma forma dos demais botoes de submissao de superficie de
              edicao — `EditProcessForm` e `ColorFieldsForm`. O mesmo papel de UI
              tem a mesma forma nas sete telas, e elas sao um conjunto com
              roteamento por URI (`SC 3.2.4`, determinacao `Z1` do epico E8).
            */}
            <button
              type="submit"
              disabled={saving || path.trim() === ''}
              className="mt-4 rounded border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Carregando a planilha…' : 'Carregar esta planilha'}
            </button>
          </form>

          <ConfigInventory config={state.config} />
        </>
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

/** Os oito campos de `config/app.json.exemplo`, com o nome que o operador lê. */
const FIELD_LABELS: Record<string, string> = {
  workbookPath: 'Caminho da planilha',
  sheetName: 'Aba lida',
  headerRow: 'Linha do cabeçalho',
  firstDataRow: 'Primeira linha de dados',
  port: 'Porta do painel',
  stalledDaysThreshold: 'Dias para "processo parado"',
  topN: 'Tamanho dos rankings',
  timezone: 'Fuso horário',
}

const SOURCE_LABELS: Record<ConfigFieldSource, string> = {
  arquivo: 'definido no arquivo',
  padrao: 'padrão aplicado',
  ausente: 'não configurado',
  desconhecida: 'não foi possível ler',
}

/**
 * O que esta configurado, e nao so o que falta.
 *
 * **Os quatro fatos do caminho sao quatro linhas**, e nao um "ok / nao ok":
 * caminho ausente, arquivo que sumiu do OneDrive e arquivo sem permissao levam a
 * tres acoes diferentes do operador, e agrupa-los perderia justamente a
 * informacao que diz o que fazer em seguida.
 */
function ConfigInventory({ config }: { config: WorkbookConfigResponse }) {
  return (
    <section aria-label="O que está configurado" className="mt-8">
      <h3 className="text-sm font-semibold text-slate-900">O que está configurado</h3>

      <dl className="mt-2 rounded border border-slate-200 bg-white p-4 text-sm">
        <Fact term="Caminho informado">
          {config.defined ? (
            <span className="break-all font-mono text-slate-900">{config.workbookPath}</span>
          ) : (
            <span className="text-slate-600">Nenhum caminho informado ainda.</span>
          )}
        </Fact>
        <Fact term="Existe no disco">{answer(config.defined, config.exists)}</Fact>
        <Fact term="O painel consegue ler">{answer(config.defined, config.readable)}</Fact>
        <Fact term="Aba da planilha">{sheetAnswer(config)}</Fact>
      </dl>

      <p className="mt-4 text-sm text-slate-600">
        O arquivo <span className="font-mono">{config.configFile.path}</span>{' '}
        {configFileAnswer(config)}
      </p>

      {/*
        A tabela rola dentro do proprio quadro. Sem isto, um caminho de OneDrive
        corporativo — que e longo por natureza — empurraria a pagina inteira para
        os lados.
      */}
      <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-slate-200 border-b text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Campo</th>
              <th className="px-4 py-2 font-medium">Valor em uso</th>
              <th className="px-4 py-2 font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {config.fields.map((field) => (
              <FieldRow key={field.key} field={field} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FieldRow({ field }: { field: ConfigFieldReport }) {
  return (
    <tr className="border-slate-100 border-t align-top">
      <th scope="row" className="px-4 py-2 font-medium text-slate-700">
        {FIELD_LABELS[field.key] ?? field.key}
      </th>
      <td className="break-all px-4 py-2 font-mono text-slate-900">
        {field.value === null || field.value === '' ? '—' : String(field.value)}
      </td>
      <td className="px-4 py-2 text-slate-600">
        {SOURCE_LABELS[field.source]}
        {field.restartPending && (
          <span className="block text-amber-900">
            O arquivo declara outro valor, que passa a valer no próximo início.
          </span>
        )}
      </td>
    </tr>
  )
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <dt className="font-medium text-slate-700">{term}:</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  )
}

/**
 * Travessao quando a pergunta nao chegou a ser feita.
 *
 * Sem caminho informado, "existe no disco" nao tem resposta — e "Não" afirmaria
 * que se procurou. Regra inviolavel 3.
 */
function answer(asked: boolean, value: boolean): string {
  if (!asked) return '—'
  return value ? 'Sim' : 'Não'
}

function sheetAnswer(config: WorkbookConfigResponse): string {
  if (!config.defined) return '—'
  if (config.sheetPresent === null) return 'Ainda não lida'
  return config.sheetPresent ? 'Encontrada na última leitura' : 'A última leitura trouxe outra aba'
}

function configFileAnswer(config: WorkbookConfigResponse): string {
  if (!config.configFile.present) {
    return 'ainda não existe — ele é criado ao salvar, e até lá valem os padrões abaixo.'
  }
  if (!config.configFile.parseable) {
    return 'existe e não pôde ser lido, então a origem de cada valor é desconhecida.'
  }
  return 'guarda o que está marcado como definido no arquivo.'
}
