import { describe, expect, it } from 'vitest'
import { indexColorMap } from '../../src/domain/color-mapper.ts'
import type { BuildDeps } from '../../src/domain/process-builder.ts'
import { applyEdits, type FieldEdit } from '../../src/domain/process-projection.ts'
import type { Process } from '../../src/domain/types.ts'

/**
 * A projecao das edicoes pendentes (`H-23`).
 *
 * O ponto que estes testes fixam nao e "o campo mudou" — e que **tudo que
 * deriva dele foi refeito**, porque a projecao reconstroi a linha crua e a passa
 * pela mesma derivacao da leitura.
 */

const deps: BuildDeps = {
  colorMap: indexColorMap([
    {
      styleKey: 'none',
      fillId: 0,
      label: 'sem cor',
      responsible: 'indefinido',
      customsChannel: 'nenhum',
      importerOutsideRj: false,
    },
  ]),
  statusAliases: ['DESEMBARACADA'],
}

function process(overrides: Partial<Process> = {}): Process {
  return {
    sourceRow: 483,
    ref: 'FT533.26',
    clientRaw: 'ACME LOG',
    importerRaw: 'IMP',
    billOfLading: 'BL1',
    agentRaw: 'AG',
    container: 'CNTR1',
    vesselRaw: 'EVER FAIR',
    portRaw: 'RJ',
    goodsRaw: 'BAZAR',
    statusRaw: 'EM ANDAMENTO',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: new Date('2026-08-04T00:00:00Z'),
    registrationDate: null,
    docsSentDate: null,
    clientKey: 'ACME LOG',
    importerKey: 'IMP',
    agentKey: 'AG',
    vesselKey: 'EVER FAIR',
    portKey: 'RJ',
    goodsKey: 'BAZAR',
    statusCategory: 'em_andamento',
    responsible: 'indefinido',
    customsChannel: 'nenhum',
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
    ...overrides,
  }
}

const edit = (overrides: Partial<FieldEdit> = {}): FieldEdit => ({
  ref: 'FT533.26',
  field: 'clientRaw',
  value: 'NOVO CLIENTE',
  ...overrides,
})

describe('applyEdits — o campo e o que dele deriva', () => {
  it('devolve os processos intactos quando nao ha edicao', () => {
    const original = [process()]

    const resultado = applyEdits(original, [], deps)

    expect(resultado.processes).toEqual(original)
    expect(resultado.editedRefs.size).toBe(0)
  })

  it('aplica o valor no campo editado', () => {
    const { processes } = applyEdits([process()], [edit()], deps)

    expect(processes[0]?.clientRaw).toBe('NOVO CLIENTE')
  })

  /**
   * Sem isto os rankings agrupariam pelo valor velho: o operador corrige o nome
   * do cliente e a Pagina Clientes continua contando na chave antiga.
   */
  it('refaz a chave de agrupamento do campo editado', () => {
    const { processes } = applyEdits([process()], [edit({ value: '  acme   log  ' })], deps)

    expect(processes[0]?.clientRaw).toBe('acme   log')
    expect(processes[0]?.clientKey).toBe('ACME LOG')
  })

  // O caso-limite do backlog, com o valor concreto que ele cita.
  it('reclassifica a categoria ao editar statusRaw para DESEMBARACADA', () => {
    const { processes } = applyEdits(
      [process()],
      [edit({ field: 'statusRaw', value: 'DESEMBARAÇADA' })],
      deps,
    )

    expect(processes[0]?.statusCategory).toBe('desembaracado')
  })

  it('volta a em_andamento ao editar de novo para um texto qualquer', () => {
    const { processes } = applyEdits(
      [process({ statusRaw: 'DESEMBARAÇADA', statusCategory: 'desembaracado' })],
      [edit({ field: 'statusRaw', value: 'AG BL ORIGINAL' })],
      deps,
    )

    expect(processes[0]?.statusCategory).toBe('em_andamento')
  })

  /**
   * Anomalia tambem e derivada: editar RG num processo nao concluido cria
   * `RG_SEM_DESEMBARACO` (A-05), e a tela precisa ve-la sem esperar a gravacao.
   */
  it('recalcula as anomalias', () => {
    const { processes } = applyEdits(
      [process()],
      [edit({ field: 'registrationDate', value: '2026-08-05' })],
      deps,
    )

    expect(processes[0]?.anomalies).toContain('RG_SEM_DESEMBARACO')
  })

  it('converte data de texto para Date, e null para celula vazia', () => {
    const comData = applyEdits([process()], [edit({ field: 'eta2', value: '2026-09-01' })], deps)
    const semData = applyEdits([process()], [edit({ field: 'eta2', value: null })], deps)

    expect(comData.processes[0]?.eta2?.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(semData.processes[0]?.eta2).toBeNull()
  })

  it('aplica varias edicoes do mesmo processo', () => {
    const { processes } = applyEdits(
      [process()],
      [edit({ field: 'clientRaw', value: 'X' }), edit({ field: 'portRaw', value: 'RO' })],
      deps,
    )

    expect(processes[0]?.clientRaw).toBe('X')
    expect(processes[0]?.portKey).toBe('RO')
  })

  it('nao toca nos processos sem edicao', () => {
    const outro = process({ ref: 'FT001.26', sourceRow: 2, clientRaw: 'OUTRO' })

    const { processes } = applyEdits([process(), outro], [edit()], deps)

    expect(processes[1]).toEqual(outro)
  })

  it('informa as REFs editadas, para a tela marcar a pendencia', () => {
    const { editedRefs } = applyEdits(
      [process(), process({ ref: 'FT001.26', sourceRow: 2 })],
      [edit(), edit({ ref: 'FT001.26', field: 'portRaw', value: 'RO' })],
      deps,
    )

    expect([...editedRefs].sort()).toEqual(['FT001.26', 'FT533.26'])
  })

  // Edicao de REF que sumiu da planilha entre a leitura e agora: a projecao
  // ignora, e a fila continua com ela ate alguem descartar.
  it('ignora edicao de REF ausente do conjunto', () => {
    const { processes } = applyEdits([process()], [edit({ ref: 'FT999.99' })], deps)

    expect(processes[0]?.clientRaw).toBe('ACME LOG')
  })

  it('preserva sourceRow e styleKey, que nao sao editaveis', () => {
    const { processes } = applyEdits([process()], [edit()], deps)

    expect(processes[0]?.sourceRow).toBe(483)
    expect(processes[0]?.styleKey).toBe('none')
  })
})
