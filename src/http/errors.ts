/** Envelope de erro de 05-contratos-api.md secao 1.2. */

export type ApiErrorCode =
  | 'FILTRO_INVALIDO'
  | 'CORPO_INVALIDO'
  | 'CAMPO_NAO_EDITAVEL'
  | 'PROCESSO_NAO_ENCONTRADO'
  | 'EDICAO_NAO_ENCONTRADA'
  | 'EXCEL_ABERTO'
  | 'ARQUIVO_MUDOU'
  | 'EDICAO_OBSOLETA'
  | 'NADA_A_APLICAR'
  | 'ESCRITA_EM_ANDAMENTO'
  | 'ARQUIVO_INDISPONIVEL'
  | 'ESCRITA_INVALIDA'
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
