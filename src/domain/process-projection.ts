import type { EditableField } from './editable-fields.ts'
import { type BuildDeps, buildProcesses, toRawRow } from './process-builder.ts'
import type { Process } from './types.ts'

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

export type ProjectedEdit = FieldEdit | ColorEdit

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

  if (DATE_FIELDS.includes(edit.field)) {
    return {
      ...process,
      [edit.field]: edit.value === null ? null : new Date(`${edit.value}T00:00:00Z`),
    }
  }
  return { ...process, [edit.field]: edit.value ?? '' }
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

  return { processes: projected, editedRefs }
}
