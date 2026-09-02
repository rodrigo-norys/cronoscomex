import { NO_FILL_KEY } from './color-mapper.ts'
import { EDITABLE_FIELDS, type EditableField } from './editable-fields.ts'
import { normKey } from './normalizer.ts'
import { type BuildDeps, buildProcesses, toRawRow } from './process-builder.ts'
import { ALL_COLUMNS, REF_COLUMN } from './status-classifier.ts'
import type { Process, RawCell, RawRow } from './types.ts'

/**
 * A projecao das edicoes pendentes sobre os processos lidos (`H-23`).
 *
 * O operador altera um campo e vê o efeito **em toda a aplicacao** — tabela,
 * indicadores, alertas —, sem que o `.xlsx` seja tocado. O que a tela mostra
 * passa a ser "o arquivo, mais o que ainda nao foi gravado".
 *
 * **Tudo que deriva do campo editado e refeito**, e nao so o campo: editar
 * `clientRaw` muda `clientKey`, e sem isso os rankings agrupariam pelo valor
 * velho; editar `statusRaw` para uma grafia de "desembaracada" muda a
 * categoria; editar RG num processo nao concluido cria `RG_SEM_DESEMBARACO`.
 *
 * A re-derivacao **reusa `buildProcesses`**, reconstruindo a linha crua com
 * `toRawRow`. Reimplementar TD-01 e a normalizacao aqui criaria uma segunda
 * implementacao das mesmas regras, que diverge no primeiro ajuste.
 *
 * A troca de cor pendente (`H-27`) entra pela mesma porta: muda a `styleKey` da
 * linha crua, e responsavel, canal e localizacao do importador saem da
 * re-derivacao — a cor continua sendo a unica fonte dos tres.
 */

/** O minimo que a projecao precisa de uma edicao enfileirada. */
export interface FieldEdit {
  kind?: 'field'
  ref: string
  field: EditableField
  /** `null` e celula vazia. */
  value: string | null
}

/**
 * A troca de cor pendente (`H-27`), ja resolvida contra o mapa: a projecao
 * recebe a chave de estilo ALVO, e nao a combinacao. Resolver o mapa aqui
 * duplicaria em `src/domain/` uma escolha que `resolveFillTarget` ja faz.
 */
export interface ColorEdit {
  kind: 'color'
  ref: string
  styleKey: string
}

/**
 * A linha NOVA, ainda nao gravada (02/09/2026).
 *
 * Ela **acrescenta** um processo, em vez de alterar um que existe — e e a unica
 * das tres que faz isso. Sem ela, o operador digitaria a linha e nao a veria
 * ate mandar aplicar: a projecao existe justamente para a tela mostrar "o
 * arquivo, mais o que ainda nao foi gravado" (`H-23`).
 */
export interface RowInsertEdit {
  kind: 'insert'
  ref: string
  values: Partial<Record<EditableField, string | null>>
}

export type ProjectedEdit = FieldEdit | ColorEdit | RowInsertEdit

/**
 * O `sourceRow` de uma linha que ainda nao existe.
 *
 * **Zero, e nao um numero plausivel.** Chutar "a ultima com REF mais um" daria
 * 651 no arquivo real, e a linha vai para a **746** — o numero seria inventado,
 * e apareceria como fato na tela e no log (regra inviolavel 3). Quem resolve o
 * numero de verdade e o `write-guard`, no momento da escrita.
 */
export const UNWRITTEN_ROW = 0

export interface ProjectionResult {
  processes: Process[]
  /** As REFs com ao menos uma edicao pendente, para a tela marcar. */
  editedRefs: Set<string>
}

/** Datas viajam como texto na fila e voltam a ser `Date` pela re-derivacao. */
const DATE_FIELDS: readonly EditableField[] = ['eta2', 'registrationDate', 'docsSentDate']

/**
 * A cor entra pela `styleKey`, e os tres campos derivados dela vêm da
 * re-derivacao — nunca escritos a mao. Escrever `responsible` direto aqui
 * criaria uma segunda traducao de cor, ao lado de `resolveColorIndexed`, e a
 * regra inviolavel 4 deixaria de ser verificavel num lugar so.
 */
function withEditApplied(process: Process, edit: ProjectedEdit): Process {
  if (edit.kind === 'color') return { ...process, styleKey: edit.styleKey }
  // Insercao nao altera processo nenhum — ela cria um. `applyEdits` a separa
  // antes de chegar aqui, e este ramo existe para o tipo.
  if (edit.kind === 'insert') return process

  if (DATE_FIELDS.includes(edit.field)) {
    return {
      ...process,
      [edit.field]: edit.value === null ? null : new Date(`${edit.value}T00:00:00Z`),
    }
  }
  return { ...process, [edit.field]: edit.value ?? '' }
}

/**
 * A linha crua de uma insercao: as 16 colunas, vazias, com a REF na A e os
 * campos que o operador preencheu.
 *
 * `styleKey` e a AUSENCIA de preenchimento, que e o que `appendRow` grava — a
 * tela mostra a mesma cor que o arquivo vai ter. Desde 02/09/2026 isso resolve
 * para indefinido nos tres campos de cor, e nao para quarentena.
 */
export function insertToRawRow(insert: RowInsertEdit): RawRow {
  const cells: Record<string, RawCell> = {}
  for (const column of ALL_COLUMNS) cells[column] = { value: null, type: 'null' }
  cells[REF_COLUMN] = { value: insert.ref, type: 'string' }

  for (const [field, value] of Object.entries(insert.values)) {
    const column = EDITABLE_FIELDS[field as EditableField]?.column
    if (column === undefined || value === null) continue

    cells[column] = DATE_FIELDS.includes(field as EditableField)
      ? { value: new Date(`${value}T00:00:00Z`), type: 'date' }
      : { value, type: 'string' }
  }

  return { sourceRow: UNWRITTEN_ROW, cells, styleKey: NO_FILL_KEY }
}

export function applyEdits(
  processes: readonly Process[],
  edits: readonly ProjectedEdit[],
  deps: BuildDeps,
): ProjectionResult {
  const editedRefs = new Set(edits.map((edit) => edit.ref))
  if (editedRefs.size === 0) return { processes: [...processes], editedRefs }

  const byRef = new Map<string, ProjectedEdit[]>()
  for (const edit of edits) {
    if (edit.kind === 'insert') continue
    byRef.set(edit.ref, [...(byRef.get(edit.ref) ?? []), edit])
  }

  const projected = processes.map((process) => {
    const pending = byRef.get(process.ref)
    if (pending === undefined) return process

    const edited = pending.reduce(withEditApplied, process)

    // A volta pela linha crua e o que garante UMA implementacao da derivacao.
    // `buildProcesses` sobre uma linha nao pode rejeita-la: a REF veio de um
    // processo ja aceito, e nao e editavel. O `?? edited` existe para o tipo,
    // nao para um caso possivel.
    const rebuilt = buildProcesses([toRawRow(edited)], deps).processes[0]
    return rebuilt ?? edited
  })

  /*
    As insercoes entram DEPOIS das lidas, e nao intercaladas: elas ainda nao tem
    numero de linha, entao nao ha posicao a respeitar. Uma insercao cuja REF ja
    exista no arquivo NAO e projetada — o `write-guard` a recusaria na escrita, e
    mostra-la na tela prometeria o que a aplicacao nao vai cumprir.
  */
  // `normKey`, como TD-06 define a identidade e como o `write-guard` decide.
  // Comparar a REF crua fazia `ft900.26` no arquivo e `FT900.26` na fila
  // conviverem na tabela — duas linhas que sao o MESMO processo —, e a
  // aplicacao recusava a fila inteira depois. Achado do revisor-xml.
  const existentes = new Set(processes.map((process) => normKey(process.ref)))
  const novas = edits
    .filter((edit): edit is RowInsertEdit => edit.kind === 'insert')
    .filter((insert) => !existentes.has(normKey(insert.ref)))
    .flatMap((insert) => buildProcesses([insertToRawRow(insert)], deps).processes)

  return { processes: [...projected, ...novas], editedRefs }
}
