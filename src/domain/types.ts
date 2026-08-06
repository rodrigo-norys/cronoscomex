/**
 * Tipos do dominio. Ver docs/03-modelo-dados.md secao 1.
 *
 * REGRA DE FRONTEIRA (ADR-0006): este diretorio nao importa nada de io/,
 * app/, http/ nem web/. Verificado pelo lint; quebra a build.
 */

/**
 * As quatro categorias canonicas, mutuamente exclusivas (secoes 2.1 e 2.2 da
 * especificacao). Nunca somar entre si em nenhum indicador.
 */
export type StatusCategory =
  | 'desembaracado'
  | 'em_desembaraco'
  | 'em_andamento'
  | 'fechado_aguardando_draft'

/**
 * Responsavel pelo processo. Derivado EXCLUSIVAMENTE da cor da linha.
 *
 * `colaborador1_outros_clientes` e subcategoria de `colaborador1`: o filtro
 * "Responsavel = Colaborador 1" seleciona os dois (achado A-18).
 *
 * As chaves sao deliberadamente impessoais. A planilha identifica o responsavel
 * pelo nome proprio; o dominio nao precisa disso para nada, e carregar nome de
 * pessoa num tipo publico contraria a mesma regra que proibe nome de cliente em
 * log (regra inviolavel 8).
 */
export type Responsible =
  | 'colaborador1'
  | 'colaborador2'
  | 'colaborador1_outros_clientes'
  | 'indefinido'

/**
 * Canal de fiscalizacao. Apenas a COR e fonte; texto em STATUS nao classifica
 * (achado A-06). Canal Amarelo nao tem representacao estruturada, porque
 * amarelo significa importador fora do RJ (achado A-38, decisao D-02).
 */
export type CustomsChannel = 'vermelho' | 'nenhum' | 'indefinido'

/** Divergencias detectadas numa linha. Vazio = linha limpa. */
export type AnomalyCode =
  | 'RG_SEM_DESEMBARACO'
  | 'INTERVALO_DOCUMENTAL_NEGATIVO'
  | 'CANAL_EM_TEXTO_STATUS'
  | 'DATA_SEM_ANO'
  | 'COR_NAO_MAPEADA'
  | 'VARIANTE_STATUS_PROXIMA'

/** Motivos de rejeicao para o relatorio de quarentena. Ver TD-06. */
export type QuarantineReason = 'REF_AUSENTE' | 'REF_DUPLICADA' | 'COR_NAO_MAPEADA'

/**
 * Linha crua da planilha, antes de qualquer interpretacao.
 *
 * Estes tipos vivem no DOMINIO, e nao em src/io/, porque descrevem dado e nao
 * mecanismo de leitura. `src/io/xlsx-reader.ts` os importa daqui — a seta
 * aponta para dentro, como a regra de fronteira exige (ADR-0006).
 */
export type RawCellType = 'string' | 'number' | 'date' | 'formula' | 'null'

export interface RawCell {
  value: string | number | Date | null
  type: RawCellType
}

export interface RawRow {
  /** Numero da linha na planilha, 1-based como o Excel exibe. Chave de escrita. */
  sourceRow: number
  /** Indexado por letra de coluna: 'A'..'P'. */
  cells: Record<string, RawCell>
  /** Chave de estilo da celula-ancora (coluna A). Ver TD-05. */
  styleKey: string
}

/**
 * Projecao de uma linha da planilha. Ver docs/03-modelo-dados.md secao 1.1.
 *
 * Os campos "Raw" guardam o texto como veio, apenas com trim. Os campos "Key"
 * sao normalizados para agrupamento (TD-04). Os derivados vem da cor (TD-05)
 * e da classificacao (TD-01).
 */
export interface Process {
  /** Numero da linha na planilha, 1-based. Chave de escrita. */
  readonly sourceRow: number

  // ---- Colunas lidas ----
  readonly ref: string
  readonly clientRaw: string
  readonly importerRaw: string
  readonly billOfLading: string
  readonly agentRaw: string
  readonly container: string
  readonly vesselRaw: string
  readonly portRaw: string
  readonly goodsRaw: string
  readonly statusRaw: string
  readonly boletoRaw: string
  readonly paymentRaw: string
  readonly columnPRaw: string

  // ---- Datas civis, sem fuso (ver TD-03) ----
  readonly eta2: Date | null
  readonly registrationDate: Date | null
  readonly docsSentDate: Date | null

  // ---- Chaves de agrupamento ----
  readonly clientKey: string
  readonly importerKey: string
  readonly agentKey: string
  readonly vesselKey: string
  readonly portKey: string
  readonly goodsKey: string

  // ---- Derivados ----
  readonly statusCategory: StatusCategory
  readonly responsible: Responsible
  readonly customsChannel: CustomsChannel
  /** `null` quando a cor nao foi reconhecida: diferente de "dentro do RJ". */
  readonly importerOutsideRj: boolean | null
  readonly styleKey: string

  readonly anomalies: readonly AnomalyCode[]
}
