/** Envelope de erro de 05-contratos-api.md secao 1.2. */

export type ApiErrorCode =
  | 'FILTRO_INVALIDO'
  | 'CORPO_INVALIDO'
  | 'CAMPO_NAO_EDITAVEL'
  | 'PROCESSO_NAO_ENCONTRADO'
  /** A REF da linha nova ja esta na planilha (02/09/2026). */
  | 'REF_DUPLICADA'
  /** A linha existe so na fila: nao da para repintar o que nao foi gravado. */
  | 'LINHA_NAO_GRAVADA'
  | 'EDICAO_NAO_ENCONTRADA'
  | 'EXCEL_ABERTO'
  | 'ARQUIVO_MUDOU'
  | 'EDICAO_OBSOLETA'
  | 'NADA_A_APLICAR'
  | 'ESCRITA_EM_ANDAMENTO'
  | 'ARQUIVO_INDISPONIVEL'
  | 'ESCRITA_INVALIDA'
  /** A folga da Tabela do Excel acabou (02/09/2026). */
  | 'TABELA_CHEIA'
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

export function apiError(
  code: ApiErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): ApiErrorBody {
  return { error: detail === undefined ? { code, message } : { code, message, detail } }
}
