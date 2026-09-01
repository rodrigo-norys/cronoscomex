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
 * O que a COR da linha codifica sobre responsavel (TD-05, A-17).
 *
 * `colaborador1_outros_clientes` e subcategoria de `colaborador1`: o filtro
 * "Cor do responsavel = Colaborador 1" seleciona os dois (achado A-18).
 *
 * As chaves sao deliberadamente impessoais. A planilha identifica o responsavel
 * pelo nome proprio; o dominio nao precisa disso para nada, e carregar nome de
 * pessoa num tipo publico contraria a mesma regra que proibe nome de cliente em
 * log (regra inviolavel 8).
 *
 * Ate `H-50` este tipo se chamava `Responsible` e era o unico. Ele deixou de
 * ser, porque a cor e o importador respondem perguntas diferentes: uma diz o
 * que o operador pintou, a outra diz quem responde pelo processo.
 */
export type ColorResponsible =
  | 'colaborador1'
  | 'colaborador2'
  | 'colaborador1_outros_clientes'
  | 'indefinido'

/**
 * A pessoa que responde pelo processo (`H-50`), atribuida pelo IMPORTADOR com a
 * cor desempatando o que a lista de importadores nao alcanca — `resolveTeam`.
 *
 * **Dominio ABERTO, e por isso e `string`:** a chave vem de
 * `team-map.json`, que nao e versionado (regra inviolavel 8). Ate `H-50`
 * eram quatro chaves fixas, e fecha-lo agora exigiria escrever no codigo os
 * membros da equipe do operador.
 *
 * Dois valores tem significado proprio:
 *  - `''` — sem responsavel. Medido: 42 dos 649, sem importador na lista e sem
 *    cor de responsavel (docs/uso/RESULTADO.md §3). Chave vazia e valor de
 *    dominio, nunca ausencia de dado.
 *  - uma chave de `ColorResponsible` — apenas enquanto NAO houver mapa de
 *    equipe (`D-23`). Nesse estado o campo mostra o que a cor diz, que e o
 *    comportamento anterior a `H-50`, e a resolucao declara `source: 'cor'`.
 */
export type Responsible = string

/**
 * Canal de fiscalizacao. Apenas a COR e fonte; texto em STATUS nao classifica
 * (achado A-06). Canal Amarelo nao tem representacao estruturada, porque
 * amarelo significa importador fora do RJ (achado A-38, decisao D-02).
 *
 * `H-51` trocou `nenhum` por `indefinido` nas linhas que a cor nao classifica.
 * A cor e um canal de informacao unico, disputado por tres significados: uma
 * linha azul diz responsavel, e por isso NAO diz canal. Afirmar `nenhum` para
 * ela era afirmar que se sabe que nao houve canal — 167 das 649 linhas, medidas
 * em 31/08/2026 (docs/uso/RESULTADO.md secao 4). E a regra inviolavel 3
 * aplicada ao proprio mapa de cores.
 */
export type CustomsChannel = 'verde' | 'vermelho' | 'indefinido'

/** Divergencias detectadas numa linha. Vazio = linha limpa. */
export type AnomalyCode =
  | 'RG_SEM_DESEMBARACO'
  | 'INTERVALO_DOCUMENTAL_NEGATIVO'
  | 'CANAL_EM_TEXTO_STATUS'
  | 'DATA_SEM_ANO'
  | 'COR_NAO_MAPEADA'
  | 'VARIANTE_STATUS_PROXIMA'
  /**
   * O importador atribui o processo a uma pessoa e a cor da linha aponta outra
   * (`H-50`). O importador vence, e a divergencia fica visivel.
   *
   * Medido: ZERO ocorrencias em 31/08/2026 (docs/uso/RESULTADO.md §3), e e
   * exatamente por isso que o codigo precisa existir antes da primeira — ela
   * seria uma atribuicao errada que ninguem veria acontecer.
   */
  | 'RESPONSAVEL_DIVERGENTE'

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
  /**
   * O cliente CONSOLIDADO (`H-49`), resolvido contra `client-map.json`.
   *
   * Sem mapa, ou com celula que nenhuma regra alcanca, vale exatamente
   * `clientProcessKey` — nao consolidar e resultado legitimo, e o unico honesto
   * para os grupos cujo cliente o operador ainda nao declarou.
   */
  readonly clientKey: string
  /**
   * A chave da CELULA CLT, que guarda o processo daquele cliente e nao o
   * cliente (`docs/uso/RESULTADO.md` secao 2). Medido: 649 processos produzem
   * 509 valores distintos.
   *
   * Continua sendo a unica forma de achar um processo especifico na Pagina
   * Operacional, e por isso o campo antigo nao some — muda de nome.
   */
  readonly clientProcessKey: string
  /**
   * O rotulo do cliente consolidado: o `label` do mapa quando alguma regra
   * casou, e a primeira grafia da celula quando nenhuma casou (A-26).
   *
   * Existe porque `clientKey` e normalizado: rotular o grupo consolidado pela
   * celula do primeiro processo dele exibiria a referencia de um processo no
   * lugar do nome do cliente, que e o defeito que `H-49` fecha.
   */
  readonly clientLabel: string
  /**
   * O grupo de clientes a que este cliente pertence (`H-55`), ou `''` quando
   * ele nao pertence a nenhum.
   *
   * **Existe so para o filtro.** Nenhum indicador agrupa por ele: fundir os
   * membros mudaria o valor de IND-10, IND-18 e IND-22, e a decisao do operador
   * foi manter cada cliente contado separado.
   */
  readonly clientGroupKey: string
  readonly importerKey: string
  readonly agentKey: string
  readonly vesselKey: string
  readonly portKey: string
  readonly goodsKey: string

  // ---- Derivados ----
  readonly statusCategory: StatusCategory
  /**
   * A pessoa que responde pelo processo (`H-50`). `''` quando ninguem responde.
   *
   * Ate `H-50` este campo era a cor, e a cor passou a ser `colorResponsible`.
   * Medido em 31/08/2026: a cor preenchia 157 das 649; o importador preenche
   * 559, o desempate pela cor mais 48, e 42 ficam sem responsavel.
   */
  readonly responsible: Responsible
  /**
   * O rotulo legivel de `responsible` — o nome da pessoa, quando ha mapa.
   *
   * Existe pela mesma razao de `clientLabel`: a chave e impessoal e o nome vive
   * em arquivo nao versionado, entao nenhuma tabela escrita no codigo consegue
   * traduzi-la. `''` quando nao ha responsavel.
   */
  readonly responsibleLabel: string
  /** O que a cor da linha diz sobre responsavel — campo proprio desde `H-50`. */
  readonly colorResponsible: ColorResponsible
  readonly customsChannel: CustomsChannel
  /** `null` quando a cor nao foi reconhecida: diferente de "dentro do RJ". */
  readonly importerOutsideRj: boolean | null
  readonly styleKey: string

  readonly anomalies: readonly AnomalyCode[]
}
