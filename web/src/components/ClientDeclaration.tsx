import { useState } from 'react'
import {
  type ClientMatch,
  type ClientName,
  createClientRule,
  type DeclaredClient,
  removeClientGroup,
} from '../api-client.ts'
import { type RuleReachState, useClientKeys, useRuleReach } from '../hooks/usePendingClients.ts'

/**
 * O painel que opera o mapa de clientes (`H-88`).
 *
 * **Ele vive na Pagina Clientes desde 09/09/2026** (`D-36`), e nasceu na Pagina
 * Configuracao: a determinacao 1 de `D-32` o pos la por ser manutencao, nao
 * analise, e o usuario a reverteu depois de USAR a tela — declarar cliente e
 * olhar o ranking de clientes sao o mesmo trabalho, e separa-los obrigava a
 * trocar de pagina para conferir o efeito.
 *
 * **Componente, e nao pagina**, pelo mesmo motivo: a pagina que o hospeda pode
 * mudar de novo, e o painel nao depende dela. Ele so precisa de `dataVersion`.
 *
 * **Ele IGNORA os filtros globais**, mesmo dentro de uma pagina que os respeita
 * (determinacao 2 de `D-32`): o que ele mostra e divida de configuracao, nao
 * recorte — seguindo o filtro, filtrar por um cliente faria a divida sumir e o
 * operador concluiria que declarou tudo.
 */

/**
 * A altura do quadro da lista, em torno de DEZ linhas.
 *
 * **A rolagem e do quadro, e nao da pagina** — mesma escolha de `H-84` para a
 * tabela da Operacional, e de `FilterPanel` para os 509 clientes. Com 111
 * grafias medidas em 08/09/2026, uma lista sem teto empurraria as etapas da
 * partida e o inventario para fora do alcance; e um teto SEM rolagem, que foi a
 * primeira versao desta tela, obrigava a expandir de 20 em 20 para ver o fim.
 *
 * **A altura vive em `index.css`**, e nao aqui: `max-h-[` no JSX e o sinal que
 * `tests/repo/estilo.test.ts` usa para reconhecer o painel modal (`C04`).
 */
const PENDING_VIEWPORT = 'pending-viewport overflow-y-auto'

/**
 * A divida de declaracao do mapa de clientes (`H-88`).
 *
 * **Ela vive aqui, e nao na Pagina Clientes** (`D-32`): e manutencao de
 * configuracao, nao analise — dar dois papeis a uma pagina analitica foi
 * recusado.
 *
 * **Nada e contado, somado nem ordenado aqui.** A lista chega pronta do
 * dominio, ja na ordem — `count` desc, `key` asc. O teto e apresentacao: a tela
 * corta o que MOSTRA, e diz de quantas (regra inviolavel 2).
 */
export function ClientDeclaration({ dataVersion }: { dataVersion: number }) {
  /**
   * A declaracao muda o mapa, e a lista precisa refazer a busca — `dataVersion`
   * vem da casca e nao mexe. Somar uma versao local e a mesma forma que a
   * Pagina Operacional usa para a edicao em linha (`editVersion`).
   */
  const [version, setVersion] = useState(0)
  const state = useClientKeys(dataVersion + version)
  const [match, setMatch] = useState<ClientMatch>('exact')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [refusal, setRefusal] = useState('')
  const [done, setDone] = useState('')
  const [saving, setSaving] = useState(false)
  const reach = useRuleReach(match, value, dataVersion + version)

  /**
   * Quantas grafias ainda nao tem dono.
   *
   * **Contar aqui nao viola a regra 6:** nao e indicador nem recorte — e o
   * tamanho de um subconjunto da lista que o servidor JA mandou inteira, do
   * mesmo tipo do `groups.length` que a Pagina Alertas usa desde `H-20`.
   */
  const livres =
    state.status === 'pronto' ? state.keys.items.filter((item) => item.client === null) : []
  const semDono = livres.length
  const [undoing, setUndoing] = useState('')

  /**
   * **A faixa nasce recolhida** (`D-37`).
   *
   * Medido em 09/09/2026, a 1920x1080: expandido o painel consome 710 px de uma
   * janela de 1080, e os tres rankings ficavam abaixo da dobra numa pagina de
   * 1752 px. Recolhido ele custa uma linha, e a divida continua a vista —
   * o numero esta na propria faixa.
   */
  const [aberto, setAberto] = useState(false)

  /**
   * Desfazer o agrupamento (determinacao 9).
   *
   * **Nao apaga cliente nenhum**: sai o vinculo com o pai, e o cliente volta ao
   * ranking com a contagem que sempre teve.
   */
  const undo = async (groupKey: string, clientKey: string | null): Promise<void> => {
    setUndoing(clientKey ?? groupKey)
    setRefusal('')
    setDone('')
    try {
      const answer = await removeClientGroup(groupKey, clientKey)
      const quantos = answer.removed.length
      setDone(
        `${quantos === 1 ? 'A declaração foi apagada' : `${quantos} declarações foram apagadas`}` +
          `${answer.dissolved ? ', e o agrupamento desfeito' : ''}. ` +
          'As grafias voltaram para a lista da esquerda.',
      )
      setVersion((atual) => atual + 1)
    } catch (cause) {
      setRefusal((cause as Error).message)
    } finally {
      setUndoing('')
    }
  }

  const declare = async (): Promise<void> => {
    setSaving(true)
    setRefusal('')
    setDone('')
    try {
      const answer = await createClientRule(match, value, label)
      setDone(
        answer.outcome === 'sem-efeito'
          ? `"${answer.value}" já pertencia a ${answer.label}. Nada mudou.`
          : `Declarado: ${answer.label}.`,
      )
      setValue('')
      setLabel('')
      setVersion((atual) => atual + 1)
    } catch (cause) {
      setRefusal((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'erro') {
    return (
      <section aria-label="Clientes por declarar">
        <h2 className="text-sm font-semibold text-text-primary">Clientes por declarar</h2>
        <p role="alert" className="mt-2 text-sm text-state-error-fg">
          Não foi possível carregar a lista. {state.message}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Clientes por declarar"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      {/*
        **A faixa: uma linha, com a divida e o gesto de abrir** (`D-37`).
        Ela e o estado de repouso do painel — o numero fica a vista sem custar a
        primeira tela, e quem vai declarar abre no lugar, sem trocar de pagina.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Clientes por declarar</h2>

        {state.status === 'pronto' && state.keys.total > 0 && (
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="painel-clientes"
            onClick={() => setAberto((atual) => !atual)}
            className="motion-tint rounded-control border border-border-control px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {aberto ? 'Recolher' : 'Declarar clientes'}
          </button>
        )}
      </div>

      {/*
        **O resumo vive FORA do contentor recolhivel**, e por isso sobrevive a
        ele fechado: e o unico lugar onde a divida aparece sem o operador pedir.
        Sem o jargao "grafia" na abertura — o operador pensa em "o que esta
        escrito na celula", e a palavra so aparece depois, ja ancorada.
      */}
      {state.status === 'pronto' && state.keys.total > 0 && (
        <p className="mt-2 text-sm text-text-secondary">
          A coluna CLT tem{' '}
          <strong className="font-mono tabular-nums text-text-primary">{state.keys.total}</strong>{' '}
          valores diferentes.{' '}
          {semDono === 0 ? (
            'Todos já têm cliente declarado.'
          ) : (
            <>
              Em <strong className="font-mono tabular-nums text-text-primary">{semDono}</strong>{' '}
              deles o cliente ainda não foi declarado, e nesses o painel mostra o que está escrito
              na célula em vez do nome do cliente.
            </>
          )}
        </p>
      )}

      {/* Lista vazia aqui afirmaria que nao falta declarar nada, e enquanto nao
          houve leitura o que se sabe e outra coisa (regra inviolavel 3). */}
      {state.status === 'semLeitura' ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhuma leitura da planilha foi concluída ainda. A lista aparece assim que a primeira
          terminar — vazio aqui não significa que está tudo declarado.
        </p>
      ) : state.status === 'carregando' ? (
        <p className="mt-2 text-sm text-text-muted">Carregando…</p>
      ) : state.keys.total === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Todas as grafias da coluna CLT têm cliente declarado. A leitura foi concluída, e não há
          dívida pendente.
        </p>
      ) : (
        <div id="painel-clientes" hidden={!aberto}>
          {/*
            `tabIndex` no quadro nao e decoracao: regiao rolavel precisa ser
            alcancavel por teclado (`SC 2.1.1`), e sem ele quem nao usa apontador
            nao chega ao fim da lista. Por isso ela tambem se nomeia — parada de
            tabulacao sem nome nao diz ao leitor de tela onde o foco parou.
          */}
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium text-text-secondary">Por declarar</h3>
              <ul
                aria-label="Grafias sem cliente declarado"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: regiao rolavel precisa receber foco para ser percorrida do teclado (`SC 2.1.1`)
                tabIndex={0}
                className={`mt-2 flex flex-col gap-1 rounded-container ${PENDING_VIEWPORT}`}
              >
                {livres.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-baseline gap-x-3 rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
                  >
                    {/* Clicar na grafia a leva para o formulario com `exact`: e o
                    gesto mais comum, e digitar de novo o que esta na tela seria
                    trabalho que a lista ja fez. */}
                    <button
                      type="button"
                      onClick={() => {
                        setMatch('exact')
                        setValue(item.key)
                      }}
                      className="rounded-control font-mono font-medium text-text-primary underline decoration-border-control underline-offset-2 hover:decoration-text-primary"
                    >
                      {item.label}
                    </button>
                    <span className="font-mono tabular-nums text-text-secondary">
                      {item.count} {item.count === 1 ? 'processo' : 'processos'}
                    </span>
                    {/* O dono, e o pai dele quando houver: e o que permite ver que
                    `AV` ja e cliente e esta dentro de Vivi, sem abrir o JSON. */}
                    {item.client === null ? (
                      <span className="text-xs text-text-muted">sem cliente</span>
                    ) : (
                      <span className="text-xs text-text-secondary">
                        {item.parent === null ? (
                          item.client.label
                        ) : (
                          <>
                            {item.parent.label} <span className="text-text-muted">›</span>{' '}
                            {item.client.label}
                          </>
                        )}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-text-muted">
                      {item.samples.join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Declared items={state.keys.declared} onRemove={undo} removing={undoing} />
          </div>

          <DeclareRule
            match={match}
            value={value}
            label={label}
            names={state.keys.names}
            reach={reach}
            saving={saving}
            refusal={refusal}
            done={done}
            onMatch={setMatch}
            onValue={setValue}
            onLabel={setLabel}
            onSubmit={declare}
          />
        </div>
      )}
    </section>
  )
}

/**
 * O formulario que declara o cliente de uma grafia ou de um prefixo (`H-88`).
 *
 * **O botao so habilita depois da previsao** (determinacao 5 de `D-35`): a
 * regra abrangente captura mais do que parece, e o operador nao enumera o que
 * ela pega. `Y` e `YT` sao prefixos distintos na planilha real, e `Y` casa
 * `YT-769` — sessenta e duas linhas mudariam de dono sem ninguem ver.
 *
 * **A tela nao calcula o alcance** (regra inviolavel 6): quem conta e
 * `ruleReach`, no dominio; aqui so se exibe o que ele devolveu.
 */
function DeclareRule({
  match,
  value,
  label,
  names,
  reach,
  saving,
  refusal,
  done,
  onMatch,
  onValue,
  onLabel,
  onSubmit,
}: {
  match: ClientMatch
  value: string
  label: string
  names: ClientName[]
  reach: RuleReachState
  saving: boolean
  refusal: string
  done: string
  onMatch: (next: ClientMatch) => void
  onValue: (next: string) => void
  onLabel: (next: string) => void
  onSubmit: () => void
}) {
  const previsto = reach.status === 'pronto' ? reach.reach : null
  const escolhido = names.find(
    (name) => name.label.toLocaleUpperCase() === label.trim().toLocaleUpperCase(),
  )
  const destino =
    label.trim() === ''
      ? ''
      : escolhido === undefined
        ? `"${label.trim()}" ainda não existe: será criado como cliente novo.`
        : escolhido.isParent
          ? `"${escolhido.label}" já agrupa outros conjuntos: este entra como mais um dentro dele.`
          : `"${escolhido.label}" já tem um conjunto: ele passa a agrupar os dois.`
  // Sem previsao nao se grava, e previsao que nao alcanca nada nao tem o que
  // declarar — nos dois casos o botao fica fora de alcance, com a razao a vista.
  const podeDeclarar = previsto !== null && previsto.keys > 0 && label.trim() !== '' && !saving

  return (
    <form
      className="mt-4 rounded-container border border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (podeDeclarar) onSubmit()
      }}
    >
      <h3 className="text-sm font-medium text-text-secondary">Declarar um cliente</h3>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-text-secondary">
          Como comparar
          {/* Mesma forma do seletor de linhas por pagina da Operacional
              (determinacao `Z1` de `E9`): um papel de UI, uma forma. O fundo
              declarado e o que faz o dropdown nativo herdar a paleta. */}
          <select
            value={match}
            onChange={(event) => onMatch(event.target.value as ClientMatch)}
            className="mt-1 rounded-control border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
          >
            <option value="exact">Exatamente esta grafia</option>
            <option value="prefix">Tudo que começa com</option>
            <option value="contains">Tudo que contém</option>
          </select>
        </label>

        <label className="flex flex-col text-xs text-text-secondary">
          Valor na coluna CLT
          <input
            type="text"
            value={value}
            onChange={(event) => onValue(event.target.value)}
            className="mt-1 rounded-control border border-border-control px-2 py-1.5 font-mono text-sm"
          />
        </label>

        <label className="flex flex-col text-xs text-text-secondary">
          Nome do cliente
          <input
            type="text"
            value={label}
            onChange={(event) => onLabel(event.target.value)}
            className="mt-1 rounded-control border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
          />
        </label>

        <button
          type="submit"
          disabled={!podeDeclarar}
          className="rounded-control bg-action-bg px-3 py-1.5 text-sm font-medium text-action-fg hover:bg-action-bg-hover disabled:bg-control-disabled-bg disabled:text-control-disabled-fg"
        >
          {saving ? 'Declarando…' : 'Declarar'}
        </button>
      </div>

      {/* O no e o MESMO antes e depois de a previsao chegar: so o texto dentro
          dele muda, para o leitor de tela ter o que comparar (`ACHADO 11`). */}
      <p role="status" className="mt-2 text-sm text-text-secondary">
        {reach.status === 'ocioso' &&
          'Digite um valor da coluna CLT para ver quantos processos ele alcança antes de declarar.'}
        {reach.status === 'carregando' && 'Calculando o alcance…'}
        {reach.status === 'erro' && `Não foi possível prever o alcance. ${reach.message}`}
        {previsto !== null && (
          <>
            Esta regra passa a consolidar{' '}
            <strong className="font-mono tabular-nums">{previsto.keys}</strong>{' '}
            {previsto.keys === 1 ? 'grafia' : 'grafias'} e{' '}
            <strong className="font-mono tabular-nums">{previsto.processes}</strong>{' '}
            {previsto.processes === 1 ? 'processo' : 'processos'}
            {previsto.samples.length > 0 && (
              <>
                {' '}
                — <span className="font-mono">{previsto.samples.join(', ')}</span>
              </>
            )}
            .
            {previsto.alreadyMapped.length > 0 && (
              <>
                {' '}
                Outras{' '}
                <strong className="font-mono tabular-nums">{previsto.alreadyMapped.length}</strong>{' '}
                que ela alcança já têm cliente declarado e <strong>continuam como estão</strong>:{' '}
                <span className="font-mono">
                  {previsto.alreadyMapped.map((item) => item.key).join(', ')}
                </span>
                .
              </>
            )}
          </>
        )}
      </p>

      {/*
        **Os nomes existentes sao BOTOES, e nao um `datalist`** (09/09/2026).
        O dropdown nativo nao aceita a paleta do conjunto — ele herda a do
        agente de usuario —, e o operador precisava abri-lo para descobrir que
        havia sugestao. Aqui eles estao a vista, e clicar preenche.
        Foi a falta da sugestao que criou um cliente `VIVI` ao lado do pai
        `Vivi` em 08/09/2026, com o ranking mostrando 326 e 58 como se fossem
        clientes diferentes.
      */}
      {names.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {/*
            **O rotulo diz a ACAO, e nao o estado** (09/09/2026): "Já existem"
            descrevia a lista e nao convidava a clicar. O operador nao viu o
            chip como controle — a borda fina sem fundo le como etiqueta.
          */}
          <span>Ou clique num nome já usado:</span>
          {names.map((name) => (
            <button
              key={name.key}
              type="button"
              onClick={() => onLabel(name.label)}
              className="motion-tint flex cursor-pointer items-center gap-1 rounded-control border border-border-control bg-surface-raised px-2.5 py-1 text-sm text-text-primary hover:bg-surface-hover"
            >
              {name.label}
              {/* O NUMERO, e nao a palavra: "agrupa" era jargao nosso, e colado
                  ao nome dava para ler como parte dele (09/09/2026). Quem tem
                  contagem e pai; quem nao tem, e cliente solto. */}
              {name.isParent && (
                <span className="rounded-control bg-action-soft px-1.5 font-mono text-xs tabular-nums text-text-secondary">
                  {name.children} {name.children === 1 ? 'cliente' : 'clientes'}
                </span>
              )}
            </button>
          ))}
        </p>
      )}

      {/* O que a declaracao FARA com o nome escolhido — o pai nasce no segundo
          conjunto, e o operador precisa saber disso antes de gravar. */}
      <p className="mt-2 text-xs text-text-muted">{destino}</p>

      <p role="alert" className={refusal === '' ? 'sr-only' : 'mt-2 text-sm text-state-error-fg'}>
        {refusal}
      </p>
      <p role="status" className={done === '' ? 'sr-only' : 'mt-2 text-sm text-state-success-fg'}>
        {done}
      </p>
    </form>
  )
}

/**
 * Os clientes JA declarados, e o desfazer (`H-88`, determinacao 9).
 *
 * **Ela lista CLIENTES, e nao grafias**, e e o que a torna util: `AV` consolida
 * 304 celulas que diriam todas "Vivi > AV". Desfazer age sobre o cliente.
 *
 * **Os dois botoes apagam a declaracao junto** — escolha do usuario em
 * 08/09/2026. "Tirar de Vivi" remove o vinculo E a regra do cliente; "Desfazer
 * Vivi" faz isso com todos. As grafias voltam para a lista da esquerda.
 *
 * **Os rotulos dizem menos do que os botoes fazem, e isso foi decidido:** o
 * usuario preferiu manter a nomenclatura que ja conhecia. Nao "corrija" para
 * "Apagar AV" sem perguntar — a alternativa foi oferecida e recusada.

 */
function Declared({
  items,
  onRemove,
  removing,
}: {
  items: DeclaredClient[]
  onRemove: (groupKey: string, clientKey: string | null) => void
  removing: string
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-text-secondary">Declarados</h3>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhum cliente declarado ainda. A leitura foi concluída — o que aparece à esquerda é a
          coluna como a planilha a tem.
        </p>
      ) : (
        <ul
          aria-label="Clientes declarados"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: regiao rolavel precisa receber foco para ser percorrida do teclado (`SC 2.1.1`)
          tabIndex={0}
          className={`mt-2 flex flex-col gap-1 rounded-container ${PENDING_VIEWPORT}`}
        >
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-baseline gap-x-3 rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
            >
              <span className="font-mono font-medium text-text-primary">
                {item.parent === null ? (
                  item.label
                ) : (
                  <>
                    <span className="text-text-secondary">{item.parent.label}</span>{' '}
                    <span className="text-text-muted">›</span> {item.label}
                  </>
                )}
              </span>
              <span className="font-mono tabular-nums text-text-secondary">
                {item.count} {item.count === 1 ? 'processo' : 'processos'}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {item.keys} {item.keys === 1 ? 'grafia' : 'grafias'}
              </span>

              {/* Só quem tem pai pode ser tirado dele: cliente solto não está
                  em agrupamento nenhum, e apagar regra ficou fora desta fatia. */}
              {item.parent !== null && (
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={removing !== ''}
                    onClick={() => onRemove(item.parent?.key ?? '', item.key)}
                    className="rounded-control border border-border-control px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-base disabled:text-control-disabled-fg"
                  >
                    Tirar de {item.parent.label}
                  </button>
                  <button
                    type="button"
                    disabled={removing !== ''}
                    onClick={() => onRemove(item.parent?.key ?? '', null)}
                    className="rounded-control border border-border-control px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-base disabled:text-control-disabled-fg"
                  >
                    Desfazer {item.parent.label}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
