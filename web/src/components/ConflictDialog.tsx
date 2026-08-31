import type { ApplyRefusal } from '../api-client.ts'

/**
 * O nome da coluna como ela aparece NA PLANILHA, e nao o identificador de
 * `EDITABLE_FIELDS`. A convencao do projeto e identificador em ingles e texto
 * de interface em pt-br, e o operador procura a coluna pelo cabecalho que ele
 * ve no Excel. Achado do revisor-xml.
 */
const NOME_DA_COLUNA: Record<string, string> = {
  clientRaw: 'CLT',
  importerRaw: 'IMPORTADOR',
  billOfLading: 'BL',
  agentRaw: 'AGENTE',
  container: 'CNTR',
  vesselRaw: 'NAVIO',
  portRaw: 'ETA',
  eta2: 'ETA2',
  goodsRaw: 'MERCADORIA',
  registrationDate: 'RG',
  statusRaw: 'STATUS',
  boletoRaw: 'Coluna 13',
  paymentRaw: 'R$ ENVIADO',
  docsSentDate: 'DOCS ENVIADOS',
  columnPRaw: 'Coluna1',
  // Nao e coluna: e a cor da linha inteira (H-27). Entra aqui porque a coluna
  // "Campo" precisa dizer o que mudou, e "cor" sozinho nao diz.
  cor: 'Cor da linha',
}

interface ConflictDialogProps {
  refusal: ApplyRefusal | null
  onClose: () => void
}

/**
 * O que a interface diz quando a aplicacao e recusada.
 *
 * **Decide em duas etapas, nesta ordem** (05-contratos-api.md secao 3):
 *
 * 1. Por `conflicts.length`. **Vazio nao e dialogo de conflito** — e a mensagem
 *    do codigo, e so. Abrir a tabela de tres colunas sem nenhuma linha deixaria
 *    o operador com um quadro em branco no lugar da explicacao. O caso mais
 *    comum de `ARQUIVO_MUDOU` cai aqui: alguem salvou a planilha entre a leitura
 *    e a aplicacao, sem tocar nas celulas da fila.
 * 2. So entao, linha a linha, por `refMissing` — nunca pelo codigo. A linha que
 *    sumiu chega pelos dois codigos de hash, conforme o instante, e e `refMissing`
 *    que diz "esta linha nao existe mais" em vez de "esta celula esta vazia"
 *    (regra inviolavel 3).
 *
 * **Nao se infere o ramo pelo conteudo:** `ARQUIVO_MUDOU` com lista vazia nao
 * significa que o arquivo mudou durante a gravacao.
 */
export function ConflictDialog({ refusal, onClose }: ConflictDialogProps) {
  if (refusal === null) return null

  const temConflitos = refusal.conflicts.length > 0

  /**
   * O titulo e o `aria-labelledby` do dialogo, entao e o que o leitor de tela
   * anuncia. Decidido so por `conflicts.length`, ele afirmava "Nada foi
   * gravado" justamente nos dois desfechos em que isso e falso ou desconhecido.
   * Achado do revisor-xml.
   */
  const titulo = refusal.fileAtRisk
    ? 'A planilha pode estar inválida'
    : refusal.code === 'ERRO_INTERNO'
      ? 'Não foi possível concluir'
      : temConflitos
        ? 'As alterações não foram gravadas'
        : 'Nada foi gravado'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-scrim px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflito-titulo"
        className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg bg-surface-raised p-6 shadow-xl"
      >
        <h2 id="conflito-titulo" className="text-lg font-semibold text-text-primary">
          {titulo}
        </h2>

        <p className="mt-2 text-sm text-text-secondary">{refusal.message}</p>

        {refusal.restored && refusal.backupPath !== null && (
          <p className="mt-3 rounded border border-state-warning-border bg-state-warning-bg px-3 py-2 text-sm text-state-warning-fg">
            A planilha foi restaurada automaticamente da cópia de segurança em{' '}
            <code className="font-mono text-xs">{refusal.backupPath}</code>.
          </p>
        )}

        {/* O desfecho mais grave: gravou, reprovou na conferencia, e o backup
            nao pode ser reposto. Sem este aviso o operador fica com uma planilha
            possivelmente invalida e nenhuma instrucao. */}
        {refusal.fileAtRisk && refusal.backupPath !== null && (
          <p className="mt-3 rounded border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg">
            <strong className="font-semibold">A planilha não pôde ser restaurada.</strong> O arquivo
            em disco pode estar inválido. Feche o Excel e reponha manualmente a partir da cópia de
            segurança em <code className="font-mono text-xs">{refusal.backupPath}</code>.
          </p>
        )}

        {/* `ACHADO 19`. Cinco colunas dentro de um diálogo de largura fixa: a
            exceção bidimensional de `SC 1.4.10` cobre a tabela, e não o diálogo
            inteiro. */}
        {temConflitos && (
          <div className="overflow-x-auto">
            <table className="mt-4 w-full border-collapse text-sm">
              <caption className="sr-only">Conflitos entre a sua edição e a planilha</caption>
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-secondary">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Processo
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Campo
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Quando você editou
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Na planilha agora
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Você queria gravar
                  </th>
                </tr>
              </thead>
              <tbody>
                {refusal.conflicts.map((conflito) => (
                  <tr
                    key={`${conflito.ref}|${conflito.field}`}
                    className="border-b border-border-subtle align-top"
                  >
                    <td className="py-2 pr-3 font-mono text-xs">{conflito.ref}</td>
                    <td className="py-2 pr-3">
                      {NOME_DA_COLUNA[conflito.field] ?? conflito.field}
                    </td>
                    <td className="py-2 pr-3">{conflito.valueWhenEdited || '—'}</td>
                    <td className="py-2 pr-3">
                      {conflito.refMissing ? (
                        <span className="text-state-warning-fg">
                          Esta linha não está mais na planilha
                        </span>
                      ) : (
                        conflito.valueNow || '—'
                      )}
                    </td>
                    <td className="py-2">{conflito.yourValue || '(vazio)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Incondicional, o rodape mentia em tres ramos: `NADA_A_APLICAR` parte
            de fila vazia; `fileAtRisk` significa que houve gravacao; e
            `ERRO_INTERNO` de rede e o caso em que NAO SE SABE se gravou —
            afirmar que nao seria inventar o que nao se mediu. */}
        {refusal.code !== 'NADA_A_APLICAR' &&
          refusal.code !== 'ERRO_INTERNO' &&
          !refusal.fileAtRisk && (
            <p className="mt-4 text-sm text-text-secondary">
              Suas alterações continuam na fila. Nenhuma célula foi gravada.
            </p>
          )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-action-bg px-4 py-2 text-sm font-medium text-action-fg hover:bg-action-bg-hover"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
