import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { extname, resolve } from 'node:path'

/** Configuracao da aplicacao. Ver docs/03-modelo-dados.md secao 3.5. */
export interface AppConfig {
  /** Caminho absoluto do .xlsx na pasta sincronizada do OneDrive. */
  workbookPath: string
  /** Aba a ler. Medido em H-01: apenas '2026' esta em escopo (A-46, D-10). */
  sheetName: string | null
  headerRow: number
  firstDataRow: number
  port: number
  /** Limiar do alerta ALE-06, em dias. Premissa, nao regra declarada (A-32). */
  stalledDaysThreshold: number
  /** Top N dos rankings (A-25). */
  topN: number
  timezone: string
}

export const CONFIG_EXAMPLE_PATH = 'config/app.json.exemplo'
const DEFAULT_CONFIG_PATH = 'config/app.json'

export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

/**
 * Acesso ao `app.json` falhou: arquivo somente-leitura na gravacao, ou caminho
 * padrao sob teste. O nome diz "Write" porque a gravacao foi o primeiro uso
 * (H-34); `describeConfig` o reaproveita, e a rota ja o mapeia para 400.
 */
export class ConfigWriteError extends Error {
  override readonly name = 'ConfigWriteError'
}

/**
 * Caminho ainda nao configurado.
 *
 * NAO e "planilha vazia" nem "planilha ilegivel": e a ausencia de configuracao,
 * o estado de primeira execucao. A tela de H-34 existe para sair dele, e a
 * distincao importa porque as tres situacoes levam a mensagens diferentes —
 * regra inviolavel 3 aplicada ao proprio caminho.
 */
export const WORKBOOK_UNSET = ''

const DEFAULTS = {
  sheetName: '2026',
  headerRow: 1,
  firstDataRow: 2,
  port: 5173,
  stalledDaysThreshold: 15,
  topN: 10,
  timezone: 'America/Sao_Paulo',
} as const

function optionalNumber(raw: Record<string, unknown>, key: string, fallback: number): number {
  const value = raw[key]
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ConfigError(`"${key}" deve ser um numero inteiro nao negativo.`)
  }
  return value
}

/**
 * Carrega e valida a configuracao.
 *
 * **Duas condicoes NAO impedem a partida, e ate H-34 impediam:** o arquivo de
 * configuracao ausente, e o `workbookPath` ausente ou apontando para arquivo
 * que nao existe. Nas duas o servidor sobe, a leitura falha, e o store fica em
 * 'degradado' com `lastReadAt` em null — que e o gatilho da tela de
 * configuracao. A regra anterior era o contrario, e criava um circulo: o
 * o `app.json` nao e versionado — o que o repositorio guarda e
 * `config/app.json.exemplo` —, entao numa instalacao nova o processo
 * morria antes de servir a tela que existiria para consertar o caminho.
 *
 * **As demais continuam matando a partida**, e de proposito: JSON malformado,
 * porta fora de faixa e `firstDataRow` menor ou igual a `headerRow` nao sao
 * consertaveis pela tela. Subir com elas trocaria uma falha visivel por uma
 * aplicacao que se comporta errado sem dizer por que.
 */
export function loadConfig(path: string = DEFAULT_CONFIG_PATH): AppConfig {
  let raw: Record<string, unknown> = {}
  if (existsSync(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    } catch (cause) {
      throw new ConfigError(`${path} nao e um JSON valido: ${(cause as Error).message}`)
    }
  }

  const declared = typeof raw.workbookPath === 'string' ? raw.workbookPath.trim() : ''
  // Caminho declarado e inexistente e PRESERVADO: a tela mostra o que esta
  // configurado e que ele nao existe, o que e informacao. Descartar deixaria o
  // operador sem saber para onde a aplicacao estava apontando.
  const workbookPath = declared === '' ? WORKBOOK_UNSET : resolve(declared)

  const sheetName =
    raw.sheetName === null ? null : ((raw.sheetName as string) ?? DEFAULTS.sheetName)
  if (sheetName !== null && (typeof sheetName !== 'string' || sheetName.trim() === '')) {
    throw new ConfigError('"sheetName" deve ser um texto nao vazio ou null.')
  }

  const timezone = (raw.timezone as string) ?? DEFAULTS.timezone
  if (typeof timezone !== 'string' || timezone.trim() === '') {
    throw new ConfigError('"timezone" deve ser um texto nao vazio.')
  }

  const headerRow = optionalNumber(raw, 'headerRow', DEFAULTS.headerRow)
  const firstDataRow = optionalNumber(raw, 'firstDataRow', DEFAULTS.firstDataRow)
  if (firstDataRow <= headerRow) {
    throw new ConfigError('"firstDataRow" deve ser maior que "headerRow".')
  }

  const port = optionalNumber(raw, 'port', DEFAULTS.port)
  if (port < 1 || port > 65535) {
    throw new ConfigError('"port" deve estar entre 1 e 65535.')
  }

  return {
    workbookPath,
    sheetName,
    headerRow,
    firstDataRow,
    port,
    stalledDaysThreshold: optionalNumber(
      raw,
      'stalledDaysThreshold',
      DEFAULTS.stalledDaysThreshold,
    ),
    topN: optionalNumber(raw, 'topN', DEFAULTS.topN),
    timezone,
  }
}

/**
 * De onde veio o valor que a aplicacao esta usando.
 *
 * `ausente` existe por `workbookPath`, o unico dos oito campos SEM padrao —
 * `DEFAULTS` nao o tem, e ele e modelado por `WORKBOOK_UNSET`. Dizer `padrao`
 * ali afirmaria um padrao que nao existe, que e a regra inviolavel 3 aplicada a
 * propria configuracao.
 */
export type ConfigFieldSource = 'arquivo' | 'padrao' | 'ausente' | 'desconhecida'

export interface ConfigFieldReport {
  key: string
  /** O valor EFETIVO — o que a aplicacao esta usando agora, nao o do arquivo. */
  value: string | number | null
  source: ConfigFieldSource
  /**
   * O arquivo declara valor diferente do que esta em uso. Nao afirma que o
   * proximo inicio o aceitara: afirma que o arquivo e a memoria divergem.
   *
   * So `workbookPath` e trocavel em execucao (H-34); os outros sete sao lidos
   * na partida, e editar o arquivo com a aplicacao no ar nao muda nada ate
   * reiniciar. Sem este campo o inventario mostraria o valor do arquivo como se
   * estivesse valendo.
   */
  restartPending: boolean
}

export interface ConfigReport {
  /** Caminho do proprio `app.json`, para a tela poder nomea-lo. */
  path: string
  /** Ausente NAO e erro desde H-34: os padroes valem e a tela resolve o resto. */
  present: boolean
  /** Legivel como JSON agora. So pode ser falso quando `present`. */
  parseable: boolean
  fields: ConfigFieldReport[]
}

/** A ordem do inventario e a de `config/app.json.exemplo`, nao a alfabetica. */
const FIELD_ORDER: readonly (keyof AppConfig)[] = [
  'workbookPath',
  'sheetName',
  'headerRow',
  'firstDataRow',
  'port',
  'stalledDaysThreshold',
  'topN',
  'timezone',
]

/** O valor declarado, na mesma forma que `loadConfig` produziria. */
function normalizeDeclared(key: keyof AppConfig, declared: unknown): unknown {
  if (key !== 'workbookPath') return declared
  if (typeof declared !== 'string') return declared

  const trimmed = declared.trim()
  return trimmed === '' ? WORKBOOK_UNSET : resolve(trimmed)
}

/**
 * O inventario dos oito campos: valor efetivo, origem e divergencia (H-44).
 *
 * **A origem e o ponto.** `port: 5173` vindo do arquivo e `port: 5173` vindo do
 * padrao mostram o mesmo numero e significam coisas diferentes — uma foi
 * decidida por alguem, a outra ninguem decidiu. Sem a distincao, a tela de
 * configuracao afirmaria configuracao onde ha ausencia dela.
 *
 * O valor sai do objeto EM MEMORIA e a origem sai do arquivo, relido a cada
 * chamada: e assim que uma edicao manual feita depois da partida aparece como
 * divergencia em vez de virar um numero que ninguem esta usando.
 *
 * NAO valida nada. Reprovar aqui duplicaria `loadConfig` numa segunda regra, que
 * divergiria da primeira no dia em que uma das duas mudasse.
 */
export function describeConfig(config: AppConfig, path?: string): ConfigReport {
  const target = resolveConfigPath(path)
  const present = existsSync(target)

  let raw: Record<string, unknown> | null = {}
  if (present) {
    try {
      raw = JSON.parse(readFileSync(target, 'utf-8')) as Record<string, unknown>
    } catch {
      // Corrompido DEPOIS da partida: a aplicacao segue rodando com o que leu, e
      // a origem de cada campo deixa de ser conhecivel. Ver `desconhecida`.
      raw = null
    }
  }

  const fields = FIELD_ORDER.map((key): ConfigFieldReport => {
    const value = config[key]
    if (raw === null) {
      return { key, value, source: 'desconhecida', restartPending: false }
    }

    const declaredHere = Object.hasOwn(raw, key)
    const declared = normalizeDeclared(key, raw[key])
    const unset = key === 'workbookPath' && (!declaredHere || declared === WORKBOOK_UNSET)

    return {
      key,
      value,
      source: unset ? 'ausente' : declaredHere ? 'arquivo' : 'padrao',
      restartPending: declaredHere && declared !== value,
    }
  })

  return { path: target, present, parseable: raw !== null, fields }
}

/**
 * RECUSA o padrao sob NODE_ENV=test, como `history-store` faz desde H-28.
 *
 * Guarda a leitura de `describeConfig` tambem, e nao so a gravacao: um teste que
 * caisse no padrao leria o `app.json` da maquina, e passaria ou reprovaria pelo
 * estado dela — o defeito que H-28 mediu com 649 eventos gravados no arquivo do
 * operador.
 *
 * Nao e zelo: um ponto de injecao esquecido aqui grava no `app.json` do
 * OPERADOR, e silenciosamente — a gravacao preserva os demais campos, entao o
 * unico sintoma seria a aplicacao apontando para um temporario ja apagado.
 * Aconteceu ao escrever H-34: `buildServer` recebeu um caminho de configuracao
 * como sexto argumento, e a assinatura so tinha cinco — o argumento foi
 * ignorado em silencio, e o teste sobrescreveu o arquivo real. Com esta recusa,
 * o mesmo engano reprova o teste.
 *
 * Fora de teste a variavel nao e sequer consultada.
 */
function resolveConfigPath(path: string | undefined): string {
  if (path !== undefined) return path
  if (process.env.NODE_ENV !== 'test') return DEFAULT_CONFIG_PATH

  throw new ConfigWriteError(
    'config: sob teste, injete o caminho — o padrao aponta para o config/app.json real.',
  )
}

export interface WorkbookPathCheck {
  /** Absoluto. Vazio quando nada foi informado. */
  resolved: string
  exists: boolean
  readable: boolean
  /** Motivo em pt-br, e null quando o caminho serve. O usuario final nao e tecnico. */
  reason: string | null
}

/**
 * Confere um caminho candidato ANTES de grava-lo.
 *
 * A ordem das conferencias e a da mensagem mais util: extensao primeiro, porque
 * apontar para o arquivo errado e o engano mais provavel e a mensagem mais
 * especifica; depois existencia; depois permissao de leitura. Invertida, um
 * `.docx` inexistente diria "nao existe", e o operador procuraria o arquivo em
 * vez de perceber que escolheu o tipo errado.
 *
 * NAO confere se a aba `2026` esta la: isso e leitura, e uma planilha sem ela
 * deve ser salva assim mesmo, entrando em 'degradado' com a razao. Recusar aqui
 * esconderia do operador o motivo real (H-34, caso-limite).
 */
export function checkWorkbookPath(candidate: string): WorkbookPathCheck {
  const trimmed = candidate.trim()
  if (trimmed === '') {
    return {
      resolved: WORKBOOK_UNSET,
      exists: false,
      readable: false,
      reason: 'Informe o caminho da planilha.',
    }
  }

  const resolved = resolve(trimmed)
  if (extname(resolved).toLowerCase() !== '.xlsx') {
    return {
      resolved,
      exists: false,
      readable: false,
      reason: 'O arquivo precisa ser uma planilha .xlsx.',
    }
  }
  if (!existsSync(resolved)) {
    return {
      resolved,
      exists: false,
      readable: false,
      reason:
        'Nao ha nenhum arquivo nesse caminho. Confira se a pasta do OneDrive esta sincronizada.',
    }
  }
  if (!statSync(resolved).isFile()) {
    return {
      resolved,
      exists: true,
      readable: false,
      reason: 'Esse caminho e uma pasta, e nao um arquivo.',
    }
  }

  try {
    accessSync(resolved, constants.R_OK)
  } catch {
    return {
      resolved,
      exists: true,
      readable: false,
      reason: 'Sem permissao para ler esse arquivo.',
    }
  }

  return { resolved, exists: true, readable: true, reason: null }
}

/**
 * Grava o caminho preservando TODOS os demais campos do arquivo.
 *
 * Reserializa o JSON lido em vez de montar um objeto novo: `port`, `sheetName`,
 * `timezone` e os limiares sao do operador, e um deles perdido viraria um
 * comportamento diferente sem nenhum aviso. As chaves prefixadas com `_` das
 * configuracoes de exemplo sobrevivem pelo mesmo caminho.
 *
 * A gravacao e atomica — temporario ao lado e renomeacao — porque este arquivo
 * e lido na partida: interrompido no meio, um `app.json` truncado impediria a
 * aplicacao de subir, e o operador nao teria tela para consertar.
 */
export function saveWorkbookPath(resolvedPath: string, path?: string): void {
  const target = resolveConfigPath(path)
  let raw: Record<string, unknown> = {}
  if (existsSync(target)) {
    try {
      raw = JSON.parse(readFileSync(target, 'utf-8')) as Record<string, unknown>
    } catch (cause) {
      throw new ConfigWriteError(`${target} nao e um JSON valido: ${(cause as Error).message}`)
    }
  }

  raw.workbookPath = resolvedPath
  const temporary = `${target}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(raw, null, 2)}\n`, 'utf-8')
    renameSync(temporary, target)
  } catch (cause) {
    throw new ConfigWriteError(
      `Nao foi possivel gravar ${target}: ${(cause as Error).message}\n` +
        'Confira se o arquivo nao esta somente-leitura.',
    )
  }
}
