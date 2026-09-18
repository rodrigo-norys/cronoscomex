import type { RawCell } from './types.ts'

/**
 * Normalizacao de texto (TD-04) e conversao de data (TD-03).
 * Funcoes puras: nenhum I/O, nenhuma leitura de relogio.
 */

// ---------------------------------------------------------------- TD-04

/**
 * Chave de agrupamento: trim -> maiusculas -> remocao de diacriticos ->
 * colapso de espacos internos.
 *
 * NAO corrige digitacao. Unificar nomes parecidos e melhoria futura (secao 8
 * da especificacao) e exigiria dicionario de negocio; sem ele, `NAVIO ALFA` e
 * `NAVIO ALFHA` permanecem DOIS grupos distintos.
 */
export function normKey(value: string): string {
  return value.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

/** Distancia de Levenshtein. Usada em TD-02 para sinalizar variante proxima. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  let atual = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      atual[j] = Math.min(
        (atual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + custo,
      )
    }
    ;[anterior, atual] = [atual, anterior]
  }
  return anterior[b.length] ?? 0
}

// ---------------------------------------------------------------- TD-03

export interface DateParse {
  date: Date | null
  anomaly: 'DATA_SEM_ANO' | 'DATA_FORA_DA_FAIXA' | null
}

/**
 * A faixa em que uma data de despacho aduaneiro e plausivel.
 *
 * **O serial do Excel nao tem teto**, e o leitor o converte sem conferir: medido
 * em 17/09/2026, o serial `99999999` virava uma data do ano **275690** e `-500`
 * virava **1898**, ambos aceitos, sem quarentena e sem anomalia. Uma data
 * impossivel atravessava o dominio inteiro e chegava a tela como fato.
 *
 * `1900` e o piso do proprio formato — o serial 1 e 01/01/1900, e nada antes
 * dele existe em OOXML. `2200` e folga deliberada: o que se quer pegar e o
 * digito a mais, nao o planejamento de longo prazo.
 *
 * **Zero linhas da planilha real caem fora desta faixa** (medido em 17/09/2026),
 * entao a mudanca nao mexe em nenhum numero de hoje — ela existe para o dia em
 * que alguem digitar errado.
 */
const ANO_MINIMO = 1900
const ANO_MAXIMO = 2200

const FORA_DA_FAIXA: DateParse = { date: null, anomaly: 'DATA_FORA_DA_FAIXA' }

/** `null` quando a data cai fora da faixa plausivel. */
function dentroDaFaixa(date: Date): boolean {
  const ano = date.getUTCFullYear()
  return ano >= ANO_MINIMO && ano <= ANO_MAXIMO
}

const COM_ANO_4 = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const COM_ANO_2 = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/

const VAZIO: DateParse = { date: null, anomaly: null }
const SEM_ANO: DateParse = { date: null, anomaly: 'DATA_SEM_ANO' }

/**
 * Monta uma data CIVIL, sem fuso.
 *
 * O Excel nao armazena fuso: "01/ago" e 01/ago em qualquer lugar do mundo. O
 * leitor de src/io/xlsx-parts.ts interpreta o serial como meia-noite UTC,
 * entao converter para
 * America/Sao_Paulo (UTC-3) empurraria a data para o dia ANTERIOR — medido:
 * 2026-08-01T00:00:00Z vira dia 31 em getDate(). Por isso ancoramos em UTC e
 * nunca convertemos. O fuso da configuracao vale apenas para determinar o que
 * e "hoje" (H-10), unica nocao que de fato depende de fuso.
 */
function civilDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejeita datas que "transbordam", como 32/01 ou 31/02.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

/**
 * Converte o serial do Excel em data civil.
 *
 * O epoch e 1899-12-30 porque o Excel trata 1900 como bissexto, o que nao e
 * verdade: o serial 60 corresponde a um 29/02/1900 inexistente. Ancorar em
 * 30/12/1899 absorve o desvio para todas as datas posteriores a 01/03/1900,
 * que sao as unicas que ocorrem nesta planilha.
 */
export function serialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const dias = Math.floor(serial)
  return new Date(Date.UTC(1899, 11, 30 + dias))
}

/**
 * Converte uma celula em data, seguindo TD-03.
 *
 * A regra 5 e deliberada: texto SEM ano nao recebe ano inferido. Inferir
 * corromperia silenciosamente todo indicador de calendario, atraso e tempo.
 * Uma data ausente e um buraco visivel; uma data errada, um buraco invisivel.
 */
export function parseCellDate(raw: RawCell): DateParse {
  const { value } = raw

  if (value === null || value === undefined) return VAZIO

  // 1. Date vinda do leitor: ancorada em UTC, apenas truncamos a hora.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return SEM_ANO
    if (!dentroDaFaixa(value)) return FORA_DA_FAIXA
    const civil = civilDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
    return civil ? { date: civil, anomaly: null } : SEM_ANO
  }

  // 2. Serial numerico.
  if (typeof value === 'number') {
    const date = serialToDate(value)
    if (date === null) return SEM_ANO
    return dentroDaFaixa(date) ? { date, anomaly: null } : FORA_DA_FAIXA
  }

  const texto = value.trim()

  // 6. Vazio ou so espacos: ausencia nao e anomalia.
  if (texto === '') return VAZIO

  // 3. dd/MM/yyyy
  const comAno4 = COM_ANO_4.exec(texto)
  if (comAno4) {
    const date = civilDate(Number(comAno4[3]), Number(comAno4[2]), Number(comAno4[1]))
    return date ? { date, anomaly: null } : SEM_ANO
  }

  // 4. dd/MM/yy, seculo 2000
  const comAno2 = COM_ANO_2.exec(texto)
  if (comAno2) {
    const date = civilDate(2000 + Number(comAno2[3]), Number(comAno2[2]), Number(comAno2[1]))
    return date ? { date, anomaly: null } : SEM_ANO
  }

  // 5 e 7. Sem ano, ou formato inesperado: NAO inferir.
  return SEM_ANO
}
