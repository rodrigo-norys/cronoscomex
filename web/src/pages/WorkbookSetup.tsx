import { useEffect, useRef, useState } from 'react'
import type { ConfigFieldReport, ConfigFieldSource } from '../../../src/app/config.ts'
import type { WorkbookConfigResponse } from '../../../src/http/routes/config.ts'
import type { HealthResponse } from '../api-client.ts'
import { useWorkbookConfig } from '../hooks/useWorkbookConfig.ts'

/**
 * A tela de configuracao do caminho da planilha (`H-34`), que `H-35` transformou
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
 * **Ela mostra o que ESTA configurado, e nao so o que falta** (`H-35`). Origem
 * de cada valor inclusive: `5173` vindo do arquivo e `5173` vindo do padrao sao
 * a mesma tela e coisas diferentes, e ocultar a distincao afirmaria configuracao
 * onde ha ausencia dela — regra inviolavel 3 aplicada a propria configuracao.
 */
export function WorkbookSetup({
  dataVersion,
  firstRun,
  onSaved,
}: {
  dataVersion: number
  /** Primeira execucao: nao houve leitura nenhuma, e nao ha painel para voltar. */
  firstRun: boolean
  /**
   * O health que o `PUT` devolveu, entregue a casca.
   *
   * Sem isto o painel so aparece quando o poll de 5 s pega o estado novo, e a
   * tela fica IDENTICA nesse intervalo — o operador conclui que o botao nao fez
   * nada e clica de novo. Obrigatoria de proposito: e a fiacao que faz o clique
   * ter efeito visivel, e um default silencioso a devolveria ao esquecimento.
   */
  onSaved: (health: HealthResponse) => void
}) {
  const { state, save, saving, browse, browsing, reload } = useWorkbookConfig(dataVersion)
  const [path, setPath] = useState('')
  const [refusal, setRefusal] = useState('')
  const [confirmation, setConfirmation] = useState('')

  // O campo parte do caminho ja configurado — na troca de arquivo, corrigir uma
  // pasta e mais comum que digitar o caminho inteiro. Depende da carga, e por
  // isso nao pode ser estado inicial do `useState`.
  //
  // **Uma vez so.** O efeito antes reagia a toda resposta do servidor, e o
  // recorte e refeito a cada `dataVersion` — uma releitura da planilha no meio
  // da digitacao apagava o que o operador tinha escrito, deixando o botao
  // desabilitado sem nada explicando por que.
  const filled = useRef(false)
  useEffect(() => {
    if (filled.current || state.status !== 'pronto') return
    filled.current = true
    setPath(state.config.workbookPath)
  }, [state])

  async function onBrowse(): Promise<void> {
    const outcome = await browse()
    if (outcome.chosen) {
      setPath(outcome.path)
      setRefusal('')
      setConfirmation('')
      return
    }
    // Cancelou: o campo e as mensagens ficam exatamente como estavam. So a
    // indisponibilidade do seletor tem o que dizer.
    if (outcome.message !== null) {
      setConfirmation('')
      setRefusal(outcome.message)
    }
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const outcome = await save(path)

    if (!outcome.saved) {
      setConfirmation('')
      setRefusal(outcome.message)
      return
    }

    // Gravou e leu sao coisas diferentes, e o 200 cobre as duas: uma planilha
    // sem a aba `2026` tem o caminho aceito e a leitura reprovada, de proposito
    // — recusar a gravacao esconderia do operador o motivo real (H-34).
    const { health } = outcome
    setPath(health.workbookPath)
    if (health.lastReadOk) {
      setRefusal('')
      setConfirmation(`Planilha carregada: ${countRead(health.rowsAccepted)}.`)
    } else {
      setConfirmation('')
      setRefusal(
        `O caminho foi salvo, mas a planilha não pôde ser lida. ${health.degradedReason ?? ''}`.trim(),
      )
    }
    onSaved(health)
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="workbook-path"
              name="workbookPath"
              type="text"
              className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            {/*
              A forma do `RefreshButton`: mesmo papel de UI — acao secundaria com
              estado ocupado — tem a mesma forma nas sete telas (`SC 3.2.4`,
              determinacao `Z1` do epico E9).

              O campo CONTINUA editavel ao lado. Numa maquina que nao abre o
              dialogo — Linux, ou Windows sem PowerShell — ele e a unica via, e
              esconde-lo trocaria um caminho a menos por caminho nenhum.
            */}
            <button
              type="button"
              onClick={() => void onBrowse()}
              disabled={browsing}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-progress disabled:opacity-60"
            >
              {browsing ? 'Escolhendo…' : 'Escolher arquivo…'}
            </button>
          </div>

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
            roteamento por URI (`SC 3.2.4`, determinacao `Z1` do epico E9).
          */}
          <button
            type="submit"
            disabled={saving || path.trim() === ''}
            className="mt-4 rounded border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Carregando a planilha…' : 'Carregar esta planilha'}
          </button>
        </form>
      )}

      {/*
        As duas regioes existem desde a montagem — fora do condicional de
        proposito: um no com `role="alert"` que nasce ja populado nao e
        anunciado pelo leitor de tela, porque nao houve mudanca a comparar.

        **E ficam junto do botao, e nao no fim da secao.** Ate aqui a recusa
        vinha depois do inventario inteiro — uma tabela de oito linhas —, e
        nascia fora da area visivel: o operador clicava, o servidor recusava, e a
        tela nao mudava nada onde ele estava olhando. Medido na primeira
        instalacao em Windows (H-35, PD-06).
      */}
      <p role="alert" className={refusal === '' ? 'sr-only' : 'mt-3 text-sm text-red-900'}>
        {refusal}
      </p>
      <p
        role="status"
        className={confirmation === '' ? 'sr-only' : 'mt-3 text-sm text-emerald-700'}
      >
        {confirmation}
      </p>

      {state.status === 'pronto' && (
        <>
          <StartupChecklist config={state.config} onRecheck={reload} />
          <ConfigInventory config={state.config} />
        </>
      )}
    </section>
  )
}

/** O plural do numero que o servidor contou. Nao calcula nada: so concorda. */
function countRead(rows: number): string {
  return rows === 1 ? '1 processo lido' : `${rows} processos lidos`
}

interface StartupStep {
  readonly label: string
  readonly done: boolean
  /** O fato conferivel ao lado do rotulo. Vazio quando nao ha o que mostrar. */
  readonly detail: string
}

/**
 * As etapas da partida, na ordem em que `scripts/iniciar.cmd` as percorre.
 *
 * **As tres primeiras aparecem sempre cumpridas, e isso nao e decoracao.** Node
 * instalado, Node >= 22 e servidor no ar sao pre-condicao de esta pagina
 * existir — ela e servida PELO Node. Ve-las cumpridas e a prova de que o
 * operador passou delas, e a versao real ao lado transforma "deu certo ate
 * aqui" em fato conferivel. Quem reporta a FALHA das duas primeiras continua
 * sendo o `.cmd`, e nao ha outra camada possivel (H-36).
 *
 * A planilha nao entra: os quatro fatos dela sao o inventario logo abaixo, e
 * repeti-los aqui criaria dois lugares para manter o mesmo estado.
 */
function startupSteps(config: WorkbookConfigResponse): StartupStep[] {
  return [
    { label: 'Node.js instalado', done: true, detail: `versão ${config.runtime.nodeVersion}` },
    { label: 'Node.js 22 ou superior', done: true, detail: 'exigido para rodar sem compilar' },
    { label: 'Painel respondendo', done: true, detail: 'esta página veio dele' },
    {
      label: 'Interface compilada',
      done: config.runtime.webBuilt,
      detail: config.runtime.webBuilt ? 'dist/web/index.html no lugar' : 'falta gerar dist/web',
    },
    {
      label: 'Arquivo de configuração',
      done: config.configFile.present,
      detail: config.configFile.present
        ? config.configFile.path
        : 'nasce ao salvar o caminho da planilha',
    },
  ]
}

/**
 * Onde a partida parou — e o botao que reconfere sem reexecutar o atalho.
 *
 * **Etapa pendente nao e erro.** Sem `role="alert"` e sem vermelho: um painel de
 * falha na primeira execucao afirmaria problema onde ha so ausencia, e a
 * ausencia e o estado normal de quem acabou de instalar (regra inviolavel 3).
 */
function StartupChecklist({
  config,
  onRecheck,
}: {
  config: WorkbookConfigResponse
  onRecheck: () => void
}) {
  const steps = startupSteps(config)
  const pending = steps.filter((step) => !step.done).length

  return (
    <section aria-label="Etapas da partida" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Etapas da partida</h3>
        {/*
          A forma do `RefreshButton`: mesmo papel de UI — acao secundaria de
          revalidacao — tem a mesma forma nas sete telas (determinacao `Z1` do
          epico E9).
        */}
        <button
          type="button"
          onClick={onRecheck}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Atualizar
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-600">
        {pending === 0
          ? 'Tudo pronto. O painel está no ar com a configuração completa.'
          : 'Resolva o que falta e clique em Atualizar — não é preciso fechar esta janela.'}
      </p>

      <ul className="mt-2 rounded border border-slate-200 bg-white p-4 text-sm">
        {steps.map((step) => (
          <li key={step.label} className="flex flex-wrap items-baseline gap-x-2 py-1">
            {/*
              O simbolo e redundante com o texto de proposito: informacao que so
              existe na forma ou na cor nao chega a quem usa leitor de tela, nem
              a um canal com perda de cor.
            */}
            <span aria-hidden="true" className={step.done ? 'text-emerald-700' : 'text-slate-400'}>
              {step.done ? '✓' : '○'}
            </span>
            <span className="font-medium text-slate-800">{step.label}</span>
            <span className="text-slate-600">
              — {step.done ? 'cumprida' : 'pendente'}
              {step.detail === '' ? '' : `, ${step.detail}`}
            </span>
          </li>
        ))}
      </ul>
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
