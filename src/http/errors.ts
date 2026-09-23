/** Envelope de erro de 05-contratos-api.md secao 1.2. */

export type ApiErrorCode =
  | 'FILTRO_INVALIDO'
  | 'CORPO_INVALIDO'
  | 'CAMPO_NAO_EDITAVEL'
  /** `D-61`: caractere que o XML 1.0 nao admite, em geral de texto colado. */
  | 'CARACTERE_INVALIDO'
  | 'PROCESSO_NAO_ENCONTRADO'
  /** A REF da linha nova ja esta na planilha (02/09/2026). */
  | 'REF_DUPLICADA'
  /** A linha existe so na fila: nao da para repintar o que nao foi gravado. */
  | 'LINHA_NAO_GRAVADA'
  | 'EDICAO_NAO_ENCONTRADA'
  /** `H-88`: o agrupamento, ou o cliente dentro dele, nao existe mais. */
  | 'GRUPO_INEXISTENTE'
  | 'MEMBRO_INEXISTENTE'
  /** `H-91`: o importador nao esta na carteira daquele responsavel. */
  | 'IMPORTADOR_INEXISTENTE'
  | 'EXCEL_ABERTO'
  | 'ARQUIVO_MUDOU'
  | 'EDICAO_OBSOLETA'
  | 'NADA_A_APLICAR'
  | 'ESCRITA_EM_ANDAMENTO'
  | 'ARQUIVO_INDISPONIVEL'
  | 'ESCRITA_INVALIDA'
  /** A folga da Tabela do Excel acabou (02/09/2026). */
  | 'TABELA_CHEIA'
  /**
   * Uma coluna mudou de lugar na planilha (`H-96`, 17/09/2026). Recusa de
   * ESCRITA apenas: a leitura segue, e o painel mostra o dado com o aviso.
   */
  | 'CABECALHO_DESLOCADO'
  /**
   * A linha de cabecalho esta em branco (`H-96`, 17/09/2026). Recusa de ESCRITA
   * apenas, como a anterior — e separada dela porque a causa e outra: nao ha
   * deslocamento detectado, ha impossibilidade de detectar.
   */
  | 'CABECALHO_VAZIO'
  | 'CAMINHO_INVALIDO'
  | 'CONFIG_NAO_GRAVAVEL'
  | 'SELETOR_INDISPONIVEL'
  | 'SELETOR_FALHOU'
  | 'ERRO_INTERNO'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    detail?: Record<string, unknown>
  }
}

/**
 * A recusa de ENFILEIRAR quando o cabecalho bloqueia a escrita (`D-65`).
 *
 * A frase difere da do `apply` numa palavra que importa: la nada foi *gravado*,
 * aqui nada foi *enfileirado*. E `409`, como as irmas dela no `apply`: o estado
 * do arquivo conflita com o que a aplicacao conhece, e o operador tem o que
 * fazer.
 */
export function queueBlockedError(block: {
  code: 'CABECALHO_DESLOCADO' | 'CABECALHO_VAZIO'
  detail: string
}): ApiErrorBody {
  const instrucao =
    block.code === 'CABECALHO_DESLOCADO'
      ? 'Uma coluna mudou de lugar na planilha, e o que voce editou seria registrado a partir da coluna errada. Desfaca a mudanca no Excel e tente de novo; nada foi enfileirado.'
      : 'Falta o nome de uma coluna na linha 1, e sem ele nao da para conferir onde gravar. Restaure o cabecalho no Excel e tente de novo; nada foi enfileirado.'
  // A frase QUE NOMEIA A COLUNA entra na mensagem, e nao so no `detail`: as tres
  // rotas de enfileiramento sao consumidas por `api-client.ts`, que le
  // `error.message` e descarta o resto — o operador receberia a instrucao sem
  // saber onde olhar, que e o buraco que `H-96` fechou para o `apply`. O
  // `detail` continua, para quem quiser o dado estruturado. Achado do
  // revisor-xml.
  return apiError(block.code, `${block.detail} ${instrucao}`, { schemaDivergence: block.detail })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): ApiErrorBody {
  return { error: detail === undefined ? { code, message } : { code, message, detail } }
}
