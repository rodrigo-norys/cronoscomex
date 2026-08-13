import { constants } from 'node:fs'
import { copyFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Copias integrais do .xlsx, gravadas imediatamente antes de cada escrita
 * (03-modelo-dados.md secao 3.4). E a rede de seguranca de H-25: falhar aqui
 * aborta a escrita antes de o original ser tocado.
 *
 * O expurgo ordena e data pelo NOME, nunca por mtime. O nome foi escrito por
 * este modulo; mtime e estado externo que uma copia, uma sincronizacao ou um
 * antivirus reescrevem — e ai o expurgo apagaria o backup errado. Consequencia
 * deliberada: arquivo que nao casa o padrao nunca e removido. A pasta e do
 * operador, e apagar o que nao reconhecemos violaria a regra inviolavel 3.
 *
 * O prefixo e a palavra literal `planilha`, e nao o nome do arquivo real: o
 * nome de producao carrega identificacao da empresa, e a pasta de backups nao
 * precisa reproduzi-la.
 */

export const DEFAULT_BACKUP_DIR = 'data/backups'

/** RNF-21. Sobrevive quem passa em QUALQUER um dos dois. */
export const DEFAULT_KEEP_COUNT = 30
export const DEFAULT_KEEP_DAYS = 90

const PREFIX = 'planilha'
const EXTENSION = '.xlsx'
const NAME_PATTERN = /^planilha-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-\d+)?\.xlsx$/
const DAY_MS = 86_400_000
/** Colisao so acontece com dois backups no mesmo segundo; o teto evita laco infinito. */
const MAX_COLLISION_SUFFIX = 100

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/**
 * Horario local, nao UTC: quem le esta pasta para escolher uma copia e o
 * operador, e o relogio dele e o do Windows (RNF-30).
 */
function stamp(moment: Date): string {
  const day = `${moment.getFullYear()}${pad(moment.getMonth() + 1, 2)}${pad(moment.getDate(), 2)}`
  const time = `${pad(moment.getHours(), 2)}${pad(moment.getMinutes(), 2)}${pad(moment.getSeconds(), 2)}`
  return `${day}-${time}`
}

function momentOf(name: string): number | null {
  const match = NAME_PATTERN.exec(name)
  if (!match) return null

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ).getTime()
}

/**
 * Copia o arquivo e devolve o caminho da copia. **Lanca** quando nao consegue:
 * o chamador precisa abortar, e backup silenciosamente ausente e pior que
 * escrita recusada.
 */
export async function backup(
  filePath: string,
  dir: string = DEFAULT_BACKUP_DIR,
  now: Date = new Date(),
): Promise<string> {
  return await write(dir, now, (path) =>
    // COPYFILE_EXCL transforma a colisao em erro em vez de sobrescrever a copia
    // anterior — que e justamente a que se quer preservar.
    copyFile(filePath, path, constants.COPYFILE_EXCL),
  )
}

/**
 * A copia a partir de bytes ja em memoria. H-25 grava o backup do MESMO buffer
 * que entrega a cirurgia: copiar do disco de novo abriria uma janela em que o
 * backup guarda um estado e a cirurgia opera outro.
 */
export async function backupFrom(
  bytes: Uint8Array,
  dir: string = DEFAULT_BACKUP_DIR,
  now: Date = new Date(),
): Promise<string> {
  return await write(dir, now, (path) => writeFile(path, bytes, { flag: 'wx' }))
}

async function write(
  dir: string,
  now: Date,
  emit: (path: string) => Promise<void>,
): Promise<string> {
  await mkdir(dir, { recursive: true })

  const base = `${PREFIX}-${stamp(now)}`
  for (let suffix = 0; suffix < MAX_COLLISION_SUFFIX; suffix += 1) {
    const path = join(dir, `${base}${suffix === 0 ? '' : `-${suffix}`}${EXTENSION}`)
    try {
      await emit(path)
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw new Error(`nao foi possivel gravar o backup em ${dir}: nomes esgotados para ${base}`)
}

/**
 * Devolve o arquivo ao estado do backup, por temporario e renomeacao. A
 * restauracao acontece quando o arquivo ja esta invalido; copiar por cima
 * abriria uma segunda janela de arquivo pela metade.
 */
export async function restore(backupPath: string, filePath: string): Promise<void> {
  const temporary = `${filePath}.restore.tmp`
  await copyFile(backupPath, temporary)
  await rename(temporary, filePath)
}

/**
 * Remove os backups que falham nos DOIS criterios de RNF-21 e devolve quantos
 * removeu. Pasta inexistente devolve zero, e remocao que falha nao interrompe
 * as demais: expurgo e higiene, nao operacao.
 */
export async function prune(
  keepCount: number = DEFAULT_KEEP_COUNT,
  keepDays: number = DEFAULT_KEEP_DAYS,
  dir: string = DEFAULT_BACKUP_DIR,
  now: Date = new Date(),
): Promise<number> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return 0
  }

  const backups = names
    .flatMap((name) => {
      const moment = momentOf(name)
      return moment === null ? [] : [{ name, moment }]
    })
    .sort((a, b) => b.moment - a.moment || b.name.localeCompare(a.name))

  let removed = 0
  for (const [index, entry] of backups.entries()) {
    if (index < keepCount) continue
    if ((now.getTime() - entry.moment) / DAY_MS <= keepDays) continue

    try {
      await rm(join(dir, entry.name))
      removed += 1
    } catch {
      // Arquivo em uso ou sem permissao: fica para o proximo expurgo.
    }
  }
  return removed
}
