import { useState } from 'react'
import { removeTeamMember, saveTeamMember, type TeamResponse } from '../api-client.ts'
import { useTeamMap } from '../hooks/useTeamMap.ts'

/**
 * O painel que opera o mapa de equipe (`H-91`).
 *
 * **Componente, e nao secao de pagina**, e a forma vem de `D-36`: o painel de
 * clientes nasceu escrito dentro da Pagina Configuracao e precisou mudar de
 * casa depois de o usuario USAR a tela. Componente, a pagina que o hospeda pode
 * mudar de novo sem reescrever nada — ele so depende de `dataVersion`.
 *
 * **Ele vive na Pagina Configuracao**, e isso e a emenda de `D-35`: o painel de
 * clientes foi para a Pagina Clientes porque declarar cliente e olhar o ranking
 * de clientes sao o mesmo trabalho. Aqui nao ha o par — nenhuma pagina analisa
 * a equipe —, e o assunto e manutencao de configuracao.
 *
 * **Ele IGNORA os filtros globais** (`D-32`, determinacao 2): o que ele mostra e
 * divida de configuracao, nao recorte. Seguindo o filtro, filtrar por um
 * responsavel faria os importadores sem dono sumirem, e o operador concluiria
 * que atribuiu tudo.
 *
 * **Nada e contado, somado nem ordenado aqui.** As listas chegam prontas do
 * dominio, ja na ordem — os membros na ordem do arquivo, os sem dono por
 * contagem. O unico numero derivado e `length`, que e o tamanho de uma lista
 * que o servidor ja mandou inteira: mesma excecao que `ClientDeclaration`
 * declara desde `H-88`.
 */

/** A altura do quadro, em torno de DEZ linhas — a mesma de `ClientDeclaration`. */
const TEAM_VIEWPORT = 'pending-viewport overflow-y-auto'

/**
 * As duas escolhas do seletor que nao sao uma pessoa.
 *
 * Constantes nomeadas, e nao `''` nu: o vazio ja significa "nada escolhido", e
 * usar o mesmo valor para "criar novo" faria o botao habilitar antes de o
 * operador ter escolhido coisa alguma.
 */
const NAO_ESCOLHIDO = ''
const CRIAR_NOVO = 'criar-novo'

type TeamMemberView = TeamResponse['members'][number]

export function TeamMap({ dataVersion }: { dataVersion: number }) {
  /**
   * A gravacao muda o mapa, e o painel precisa refazer a busca — `dataVersion`
   * vem da casca e nao mexe. Somar uma versao local e a mesma forma de
   * `ClientDeclaration`.
   */
  const [version, setVersion] = useState(0)
  const state = useTeamMap(dataVersion + version)

  const [aberto, setAberto] = useState(false)
  const [importer, setImporter] = useState(NAO_ESCOLHIDO)
  const [memberKey, setMemberKey] = useState(NAO_ESCOLHIDO)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState('')
  const [refusal, setRefusal] = useState('')
  const [done, setDone] = useState('')

  const team = state.status === 'pronto' ? state.team : null

  const limpar = (): void => {
    setRefusal('')
    setDone('')
  }

  /**
   * Atribuir um importador, ou criar a pessoa que ainda nao existe.
   *
   * **A carteira vai INTEIRA**, porque a rota redefine o membro: mandar so o
   * importador novo apagaria os que ele ja tinha. Quem soma e esta tela, que e
   * quem conhece a lista que acabou de exibir.
   */
  const atribuir = async (): Promise<void> => {
    if (team === null) return
    setSaving(true)
    limpar()

    try {
      if (memberKey === CRIAR_NOVO) {
        // A chave vem do SERVIDOR (`nextKey`), nunca do nome digitado: ela viaja
        // pelo dominio e vira parametro de URL (regra inviolavel 8).
        const answer = await saveTeamMember(
          team.nextKey,
          newName,
          importer === NAO_ESCOLHIDO ? [] : [importer],
        )
        setDone(
          importer === NAO_ESCOLHIDO
            ? `${answer.label} entrou na equipe, ainda sem importador.`
            : `${answer.label} entrou na equipe, com ${importer}.`,
        )
        setNewName('')
      } else {
        const alvo = team.members.find((member) => member.key === memberKey)
        if (alvo === undefined) return
        const answer = await saveTeamMember(alvo.key, alvo.label, [...alvo.importers, importer])
        setDone(`${importer} agora é de ${answer.label}.`)
      }

      setImporter(NAO_ESCOLHIDO)
      setVersion((atual) => atual + 1)
    } catch (cause) {
      setRefusal((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Desfazer o responsavel, ou tirar um importador da carteira dele.
   *
   * **Nenhum processo fica sem grupo**: o que sai cai em "Sem responsavel", que
   * ja existe no filtro e em `IND-20`.
   */
  const desfazer = async (key: string, alvo: string | null): Promise<void> => {
    setRemoving(alvo ?? key)
    limpar()

    try {
      const answer = await removeTeamMember(key, alvo)
      const quantos = answer.released.length
      setDone(
        answer.outcome === 'membro-desfeito'
          ? `Responsável desfeito. ${
              quantos === 1 ? '1 importador voltou' : `${quantos} importadores voltaram`
            } para "Sem responsável".`
          : `${answer.importer} voltou para "Sem responsável".`,
      )
      setVersion((atual) => atual + 1)
    } catch (cause) {
      setRefusal((cause as Error).message)
    } finally {
      setRemoving('')
    }
  }

  if (state.status === 'erro') {
    return (
      <section aria-label="Responsáveis por importador" className="mt-8">
        <h2 className="text-sm font-semibold text-text-primary">Responsáveis por importador</h2>
        <p role="alert" className="mt-2 text-sm text-state-error-fg">
          Não foi possível carregar a equipe. {state.message}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Responsáveis por importador"
      className="mt-8 rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      {/* A faixa: uma linha, com a dívida e o gesto de abrir — mesma forma de
          `ClientDeclaration`, que `D-37` fixou. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Responsáveis por importador</h2>

        {team !== null && (
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="painel-equipe"
            onClick={() => setAberto((atual) => !atual)}
            className="motion-tint rounded-control border border-border-control px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {aberto ? 'Recolher' : 'Definir responsáveis'}
          </button>
        )}
      </div>

      {/* O resumo vive FORA do contentor recolhível, e por isso sobrevive a ele
          fechado: é o único lugar onde a dívida aparece sem o operador pedir. */}
      {team !== null && (
        <p className="mt-2 text-sm text-text-secondary">
          {team.members.length === 0 ? (
            <>
              Nenhum responsável definido ainda — todos os processos aparecem em{' '}
              <strong className="text-text-primary">Sem responsável</strong>.
            </>
          ) : (
            <>
              <strong className="font-mono tabular-nums text-text-primary">
                {team.members.length}
              </strong>{' '}
              {team.members.length === 1 ? 'responsável' : 'responsáveis'} definidos.
            </>
          )}{' '}
          {team.unassigned.length === 0 ? (
            'Todo importador da planilha tem responsável.'
          ) : (
            <>
              <strong className="font-mono tabular-nums text-text-primary">
                {team.unassigned.length}
              </strong>{' '}
              {team.unassigned.length === 1
                ? 'importador ainda não tem'
                : 'importadores ainda não têm'}{' '}
              responsável.
            </>
          )}
          {team.blankImporters > 0 && (
            <>
              {' '}
              Outras{' '}
              <strong className="font-mono tabular-nums text-text-primary">
                {team.blankImporters}
              </strong>{' '}
              linhas estão <strong>sem importador preenchido</strong>: nenhum responsável as
              alcança, e o conserto delas é preencher a coluna IMPORTADOR na tabela.
            </>
          )}
        </p>
      )}

      {/* Carteira vazia aqui afirmaria que ninguém precisa de dono, e enquanto
          não houve leitura o que se sabe é outra coisa (regra inviolável 3). */}
      {state.status === 'semLeitura' ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhuma leitura da planilha foi concluída ainda. A equipe aparece assim que a primeira
          terminar — vazio aqui não significa que está tudo atribuído.
        </p>
      ) : state.status === 'carregando' ? (
        <p className="mt-2 text-sm text-text-muted">Carregando…</p>
      ) : (
        team !== null && (
          <div id="painel-equipe" hidden={!aberto}>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Unassigned
                items={team.unassigned}
                onPick={(key) => {
                  setImporter(key)
                  limpar()
                }}
              />
              <Members items={team.members} onRemove={desfazer} removing={removing} />
            </div>

            <AssignForm
              team={team}
              importer={importer}
              memberKey={memberKey}
              newName={newName}
              saving={saving}
              refusal={refusal}
              done={done}
              onImporter={setImporter}
              onMemberKey={setMemberKey}
              onNewName={setNewName}
              onSubmit={atribuir}
            />
          </div>
        )
      )}
    </section>
  )
}

/**
 * Os importadores que nenhuma carteira alcanca.
 *
 * A lista chega ordenada por contagem — a ordem e prioridade de trabalho, e
 * refaze-la aqui seria calculo no cliente.
 */
function Unassigned({
  items,
  onPick,
}: {
  items: TeamResponse['unassigned']
  onPick: (key: string) => void
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-text-secondary">Sem responsável</h3>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Todo importador da planilha já tem responsável. A leitura foi concluída — não há dívida
          pendente.
        </p>
      ) : (
        <ul
          aria-label="Importadores sem responsável"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: regiao rolavel precisa receber foco para ser percorrida do teclado (`SC 2.1.1`)
          tabIndex={0}
          className={`mt-2 flex flex-col gap-1 rounded-container ${TEAM_VIEWPORT}`}
        >
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-baseline gap-x-3 rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
            >
              {/* Clicar leva o importador para o formulário: é o gesto mais
                  comum, e redigitar o que está na tela seria trabalho que a
                  lista já fez. */}
              <button
                type="button"
                onClick={() => onPick(item.key)}
                className="rounded-control font-mono font-medium text-text-primary underline decoration-border-control underline-offset-2 hover:decoration-text-primary"
              >
                {item.key}
              </button>
              <span className="font-mono tabular-nums text-text-secondary">
                {item.count} {item.count === 1 ? 'processo' : 'processos'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * A equipe, com a carteira de cada um.
 *
 * **Os dois botoes desfazem coisas diferentes**: o `×` de um importador tira so
 * ele; "Desfazer" tira a pessoa e devolve a carteira inteira. Nos dois casos o
 * que sai vai para "Sem responsavel" — nenhum processo fica sem grupo.
 */
function Members({
  items,
  onRemove,
  removing,
}: {
  items: TeamMemberView[]
  onRemove: (key: string, importer: string | null) => void
  removing: string
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-text-secondary">Responsáveis</h3>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhum responsável definido ainda. Use o formulário abaixo para criar o primeiro.
        </p>
      ) : (
        <ul
          aria-label="Responsáveis definidos"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: regiao rolavel precisa receber foco para ser percorrida do teclado (`SC 2.1.1`)
          tabIndex={0}
          className={`mt-2 flex flex-col gap-1 rounded-container ${TEAM_VIEWPORT}`}
        >
          {items.map((member) => (
            <li
              key={member.key}
              className="rounded-control border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium text-text-primary">{member.label}</span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {member.count} {member.count === 1 ? 'processo' : 'processos'}
                </span>
                <button
                  type="button"
                  disabled={removing !== ''}
                  onClick={() => onRemove(member.key, null)}
                  className="ml-auto rounded-control border border-border-control px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-base disabled:text-control-disabled-fg"
                >
                  Desfazer {member.label}
                </button>
              </div>

              {/* Carteira vazia é legítima: alguém entrou na equipe e ainda não
                  recebeu importador. Dizer isso é melhor que uma linha muda. */}
              {member.importers.length === 0 ? (
                <p className="mt-1 text-xs text-text-muted">
                  Sem importador ainda — os processos dele continuam em "Sem responsável".
                </p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {member.importers.map((owned) => (
                    <li key={owned}>
                      <button
                        type="button"
                        disabled={removing !== ''}
                        onClick={() => onRemove(member.key, owned)}
                        aria-label={`Tirar ${owned} de ${member.label}`}
                        className="motion-tint flex cursor-pointer items-center gap-1 rounded-control border border-border-control bg-surface-raised px-2 py-0.5 font-mono text-xs text-text-primary hover:bg-surface-hover disabled:text-control-disabled-fg"
                      >
                        {owned}
                        <span aria-hidden="true" className="text-text-muted">
                          ×
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * O formulario que atribui um importador, ou cria a pessoa.
 *
 * **Os dois seletores sao rotulados, e nenhum age sozinho.** Escolher no
 * seletor nao grava: quem grava e o botao. Controle mudo que aplica no
 * `change` deixaria o operador sem o passo em que ele confere o que escolheu —
 * e aqui o engano custa a carteira de outra pessoa.
 *
 * **Criar sem importador e permitido de proposito**: e a carteira vazia, que
 * `H-91` tornou legitima. O operador monta a equipe primeiro e distribui
 * depois, que e como ele descreveu o trabalho.
 */
function AssignForm({
  team,
  importer,
  memberKey,
  newName,
  saving,
  refusal,
  done,
  onImporter,
  onMemberKey,
  onNewName,
  onSubmit,
}: {
  team: TeamResponse
  importer: string
  memberKey: string
  newName: string
  saving: boolean
  refusal: string
  done: string
  onImporter: (next: string) => void
  onMemberKey: (next: string) => void
  onNewName: (next: string) => void
  onSubmit: () => void
}) {
  const criando = memberKey === CRIAR_NOVO
  const podeGravar =
    !saving &&
    memberKey !== NAO_ESCOLHIDO &&
    (criando ? newName.trim() !== '' : importer !== NAO_ESCOLHIDO)

  return (
    <form
      className="mt-4 rounded-container border border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (podeGravar) onSubmit()
      }}
    >
      <h3 className="text-sm font-medium text-text-secondary">Definir um responsável</h3>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-text-secondary">
          Importador
          {/* Mesma forma dos demais seletores do conjunto (determinação `Z1` de
              `E9`). O fundo declarado é o que faz o dropdown nativo herdar a
              paleta. */}
          <select
            value={importer}
            onChange={(event) => onImporter(event.target.value)}
            className="mt-1 rounded-control border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
          >
            <option value={NAO_ESCOLHIDO}>— nenhum, só criar a pessoa —</option>
            {team.unassigned.map((item) => (
              <option key={item.key} value={item.key}>
                {item.key} ({item.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs text-text-secondary">
          Responsável
          <select
            value={memberKey}
            onChange={(event) => onMemberKey(event.target.value)}
            className="mt-1 rounded-control border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
          >
            <option value={NAO_ESCOLHIDO}>Escolha…</option>
            {team.members.map((member) => (
              <option key={member.key} value={member.key}>
                {member.label}
              </option>
            ))}
            <option value={CRIAR_NOVO}>— Criar novo responsável —</option>
          </select>
        </label>

        {criando && (
          <label className="flex flex-col text-xs text-text-secondary">
            Nome do responsável
            <input
              type="text"
              value={newName}
              onChange={(event) => onNewName(event.target.value)}
              className="mt-1 rounded-control border border-border-control bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
        )}

        <button type="submit" disabled={!podeGravar} className="button-primary px-3 py-1.5">
          {saving ? 'Gravando…' : criando ? 'Criar' : 'Atribuir'}
        </button>
      </div>

      {/* O que a gravação FARÁ, antes de ela acontecer: criar pessoa e mover um
          importador de mão são coisas diferentes, e o operador precisa saber
          qual delas o botão faz. */}
      <p className="mt-2 text-xs text-text-muted">
        {memberKey === NAO_ESCOLHIDO
          ? 'Escolha quem recebe, ou crie um responsável novo.'
          : criando
            ? importer === NAO_ESCOLHIDO
              ? 'A pessoa entra na equipe sem importador, e você atribui depois.'
              : `A pessoa entra na equipe já com ${importer}.`
            : importer === NAO_ESCOLHIDO
              ? 'Escolha o importador que passa a ser dessa pessoa.'
              : `${importer} sai de "Sem responsável" e entra nessa carteira.`}
      </p>

      {/* As duas regiões existem desde a montagem — nó que nasce populado não é
          anunciado pelo leitor de tela (`ACHADO 11`). */}
      <p role="alert" className={refusal === '' ? 'sr-only' : 'mt-2 text-sm text-state-error-fg'}>
        {refusal}
      </p>
      <p role="status" className={done === '' ? 'sr-only' : 'mt-2 text-sm text-state-success-fg'}>
        {done}
      </p>
    </form>
  )
}
