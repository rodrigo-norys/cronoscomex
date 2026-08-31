import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type ColorEditCommand,
  consolidated,
  discard,
  discardAll,
  enqueue,
  type FieldEditCommand,
  isColorEdit,
  type PendingColorEdit,
  type PendingEdit,
  type PendingFieldEdit,
  rotate,
} from '../../src/io/edit-queue.ts'

/**
 * A fila de edicoes. **Nada aqui toca o `.xlsx`** — a camada so registra a
 * intencao, e RNF-37 proibe teste sobre a planilha real de qualquer forma.
 */

let directory: string
let queuePath: string
let appliedDir: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-fila-'))
  queuePath = join(directory, 'pending-edits.jsonl')
  appliedDir = join(directory, 'applied')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function command(overrides: Partial<FieldEditCommand> = {}): FieldEditCommand {
  return {
    ref: 'FT533.26',
    sourceRow: 483,
    field: 'eta2',
    value: '2026-08-06',
    previous: '2026-08-04',
    ...overrides,
  }
}

function colorCommand(overrides: Partial<ColorEditCommand> = {}): ColorEditCommand {
  return {
    kind: 'color',
    ref: 'FT533.26',
    sourceRow: 483,
    target: { responsible: 'colaborador2', customsChannel: 'indefinido', importerOutsideRj: false },
    label: 'Roxo (tom A)',
    previousStyleKey: 'argb:FF00FF00',
    previousLabel: 'Verde (tom A)',
    ...overrides,
  }
}

/** `PendingEdit` virou uniao em `H-27`; os testes de campo estreitam aqui. */
function asField(edit: PendingEdit | undefined): PendingFieldEdit {
  if (edit === undefined || isColorEdit(edit)) throw new Error('esperava uma edicao de campo')
  return edit
}

function asColor(edit: PendingEdit | undefined): PendingColorEdit {
  if (edit === undefined || !isColorEdit(edit)) throw new Error('esperava uma edicao de cor')
  return edit
}

describe('enqueue', () => {
  it('anexa ao arquivo e devolve a edicao com id e ts', () => {
    const edit = enqueue(command(), queuePath)

    expect(edit.id).not.toBe('')
    expect(edit.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(edit.ref).toBe('FT533.26')
    expect(readFileSync(queuePath, 'utf-8').trim().split('\n')).toHaveLength(1)
  })

  // Sem `normKey` na chave, as duas sobrevivem a consolidacao e resolvem para a
  // MESMA celula: a cirurgia grava duas vezes e a validacao pos-escrita condena
  // a escrita. Achado do revisor-xml em H-25.
  it('consolida REFs que diferem so na caixa como o mesmo par', () => {
    enqueue(command(), queuePath)
    enqueue(command({ ref: 'ft533.26 ', value: '2026-08-09' }), queuePath)

    const items = consolidated(queuePath)

    expect(items).toHaveLength(1)
    expect(asField(items[0]).value).toBe('2026-08-09')
  })

  it('gera id distinto a cada edicao', () => {
    const primeira = enqueue(command(), queuePath)
    const segunda = enqueue(command({ field: 'statusRaw', value: 'AG BL' }), queuePath)

    expect(primeira.id).not.toBe(segunda.id)
  })

  // Append-only: a segunda edicao nao reescreve a primeira no disco.
  it('preserva as entradas anteriores no arquivo', () => {
    enqueue(command(), queuePath)
    enqueue(command({ value: '2026-08-10' }), queuePath)

    expect(readFileSync(queuePath, 'utf-8').trim().split('\n')).toHaveLength(2)
  })

  it('cria o diretorio quando ele ainda nao existe', () => {
    const aninhado = join(directory, 'data', 'pending-edits.jsonl')

    enqueue(command(), aninhado)

    expect(readFileSync(aninhado, 'utf-8')).toContain('FT533.26')
  })
})

describe('consolidated — a ultima por (ref, field)', () => {
  it('devolve apenas a ultima edicao do mesmo par', () => {
    enqueue(command({ value: '2026-08-06' }), queuePath)
    enqueue(command({ value: '2026-08-10' }), queuePath)

    const fila = consolidated(queuePath)

    expect(fila).toHaveLength(1)
    expect(asField(fila[0]).value).toBe('2026-08-10')
  })

  it('mantem pares distintos do mesmo processo', () => {
    enqueue(command({ field: 'eta2' }), queuePath)
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    expect(
      consolidated(queuePath)
        .map((edit) => asField(edit).field)
        .sort(),
    ).toEqual(['eta2', 'statusRaw'])
  })

  it('mantem o mesmo campo de processos distintos', () => {
    enqueue(command({ ref: 'FT001.26' }), queuePath)
    enqueue(command({ ref: 'FT002.26' }), queuePath)

    expect(consolidated(queuePath)).toHaveLength(2)
  })

  /**
   * Reordenar pela ultima edicao faria a lista dancar sob o operador a cada
   * tecla: ele edita `eta2` de novo e a linha pula para o fim.
   */
  it('preserva a ordem de primeira aparicao, nao a da ultima edicao', () => {
    enqueue(command({ ref: 'A', field: 'eta2' }), queuePath)
    enqueue(command({ ref: 'B', field: 'eta2' }), queuePath)
    enqueue(command({ ref: 'A', field: 'eta2', value: '2026-09-01' }), queuePath)

    expect(consolidated(queuePath).map((edit) => edit.ref)).toEqual(['A', 'B'])
  })

  it('devolve lista vazia quando o arquivo nao existe', () => {
    expect(consolidated(join(directory, 'inexistente.jsonl'))).toEqual([])
  })

  /**
   * Gravacao interrompida nao pode custar a fila inteira: as demais linhas
   * continuam valendo, e o operador nao perde o que enfileirou.
   */
  it('ignora linha ilegivel sem derrubar as demais', () => {
    enqueue(command(), queuePath)
    writeFileSync(queuePath, `${readFileSync(queuePath, 'utf-8')}{ isto nao e json\n`, 'utf-8')
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    expect(consolidated(queuePath)).toHaveLength(2)
  })
})

describe('null e celula vazia, nunca cancelamento', () => {
  /**
   * `03-modelo-dados.md` dizia ate `H-23` que `value: null` cancelava a edicao
   * anterior. Com o cancelamento em rota propria, `null` ficou livre para o que
   * o operador precisa: esvaziar a celula. Sem isso ele nao teria como limpar
   * uma data.
   */
  it('enfileira a limpeza de uma data como edicao normal', () => {
    enqueue(command({ value: '2026-08-06' }), queuePath)
    enqueue(command({ value: null }), queuePath)

    const fila = consolidated(queuePath)

    expect(fila).toHaveLength(1)
    expect(asField(fila[0]).value).toBeNull()
  })
})

describe('discard', () => {
  it('remove a edicao da projecao e devolve true', () => {
    const edit = enqueue(command(), queuePath)

    expect(discard(edit.id, queuePath)).toBe(true)
    expect(consolidated(queuePath)).toEqual([])
  })

  it('devolve false para id inexistente, sem escrever lapide', () => {
    enqueue(command(), queuePath)
    const antes = readFileSync(queuePath, 'utf-8')

    expect(discard('id-que-nao-existe', queuePath)).toBe(false)
    expect(readFileSync(queuePath, 'utf-8')).toBe(antes)
  })

  // A lapide nao reescreve nada: o arquivo continua sendo o relato do que
  // aconteceu, e o append-only de 03-modelo-dados.md fica de pe.
  it('descarta por lapide, sem reescrever o arquivo', () => {
    const edit = enqueue(command(), queuePath)

    discard(edit.id, queuePath)

    const linhas = readFileSync(queuePath, 'utf-8').trim().split('\n')
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toContain(edit.id)
    expect(JSON.parse(linhas[1] ?? '{}').discarded).toBe(edit.id)
  })

  it('descarta so o par pedido, deixando os demais', () => {
    const primeira = enqueue(command({ field: 'eta2' }), queuePath)
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    discard(primeira.id, queuePath)

    expect(consolidated(queuePath).map((edit) => asField(edit).field)).toEqual(['statusRaw'])
  })

  /**
   * Descartar a ultima de um par NAO ressuscita a anterior: o operador pediu
   * para tirar aquela edicao da fila, e devolver um valor que ele ja havia
   * substituido seria inventar intencao.
   */
  it('nao ressuscita a edicao anterior do mesmo par', () => {
    enqueue(command({ value: '2026-08-06' }), queuePath)
    const ultima = enqueue(command({ value: '2026-08-10' }), queuePath)

    discard(ultima.id, queuePath)

    expect(consolidated(queuePath)).toEqual([])
  })
})

describe('discardAll', () => {
  it('esvazia a fila e devolve quantas descartou', () => {
    enqueue(command({ ref: 'A' }), queuePath)
    enqueue(command({ ref: 'B' }), queuePath)

    expect(discardAll(queuePath)).toBe(2)
    expect(consolidated(queuePath)).toEqual([])
  })

  it('devolve zero e nao escreve lapide com a fila ja vazia', () => {
    expect(discardAll(join(directory, 'inexistente.jsonl'))).toBe(0)
  })

  it('nao impede enfileirar depois', () => {
    enqueue(command(), queuePath)
    discardAll(queuePath)
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    expect(consolidated(queuePath).map((edit) => asField(edit).field)).toEqual(['statusRaw'])
  })
})

describe('persistencia', () => {
  /**
   * O criterio de aceite fala em servidor reiniciado; o equivalente testavel e
   * ler o arquivo sem nenhum estado em memoria carregado. A fila nao mantem
   * cache justamente para isto ser verdade por construcao.
   */
  it('devolve a fila lendo so o arquivo, sem estado em memoria', () => {
    enqueue(command({ ref: 'A' }), queuePath)
    enqueue(command({ ref: 'B', field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    const outroProcesso = consolidated(queuePath)

    expect(outroProcesso).toHaveLength(2)
    expect(outroProcesso.map((edit) => edit.ref)).toEqual(['A', 'B'])
  })
})

/**
 * A rotacao acontece DEPOIS de a escrita ser validada, e e o que impede que a
 * mesma fila seja reaplicada. Antes disso a fila precisa sobreviver a qualquer
 * recusa — testado em `tests/app/write-guard.test.ts`.
 */
describe('rotate', () => {
  const momento = new Date(2026, 7, 14, 15, 42, 7)

  it('arquiva a fila em data/applied e a recria vazia', () => {
    enqueue(command(), queuePath)
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)
    const antes = readFileSync(queuePath, 'utf-8')

    const arquivado = rotate(queuePath, appliedDir, momento)

    expect(arquivado).toBe(join(appliedDir, 'pending-edits-20260814-154207.jsonl'))
    expect(readFileSync(arquivado as string, 'utf-8')).toBe(antes)
    expect(readFileSync(queuePath, 'utf-8')).toBe('')
    expect(consolidated(queuePath)).toEqual([])
  })

  // A lapide conta o que o operador desistiu de aplicar, e some se a rotacao
  // gravar so a projecao. Mover preserva o relato inteiro.
  it('preserva as lapides de descarte no arquivo arquivado', () => {
    const edit = enqueue(command(), queuePath)
    discard(edit.id, queuePath)

    const arquivado = rotate(queuePath, appliedDir, momento)

    expect(readFileSync(arquivado as string, 'utf-8')).toContain(`"discarded":"${edit.id}"`)
  })

  it('devolve null quando nao ha fila para arquivar', () => {
    expect(rotate(queuePath, appliedDir, momento)).toBeNull()
    expect(existsSync(appliedDir)).toBe(false)
  })

  it('nao sobrescreve um arquivo ja arquivado no mesmo segundo', () => {
    enqueue(command(), queuePath)
    const primeiro = rotate(queuePath, appliedDir, momento)

    enqueue(command({ value: '2026-08-20' }), queuePath)
    const segundo = rotate(queuePath, appliedDir, momento)

    expect(segundo).not.toBe(primeiro)
    expect(readFileSync(primeiro as string, 'utf-8')).toContain('2026-08-06')
    expect(readFileSync(segundo as string, 'utf-8')).toContain('2026-08-20')
  })
})

/**
 * A troca de cor na fila (`H-27`). Consolidada por REF, e nao por par: a linha
 * tem uma cor so, entao a ultima escolha vence.
 */
describe('edicao de cor', () => {
  it('enfileira com id, ts e a combinacao alvo', () => {
    const edit = asColor(enqueue(colorCommand(), queuePath))

    expect(edit.kind).toBe('color')
    expect(edit.target.responsible).toBe('colaborador2')
    expect(edit.previousStyleKey).toBe('argb:FF00FF00')
    expect(edit.id).not.toBe('')
  })

  it('consolida por REF: a ultima cor escolhida vence', () => {
    enqueue(colorCommand(), queuePath)
    enqueue(
      colorCommand({
        target: {
          responsible: 'colaborador1',
          customsChannel: 'indefinido',
          importerOutsideRj: false,
        },
        label: 'Azul',
      }),
      queuePath,
    )

    const fila = consolidated(queuePath)

    expect(fila).toHaveLength(1)
    expect(asColor(fila[0]).label).toBe('Azul')
  })

  it('consolida REFs que diferem so na caixa como a mesma linha', () => {
    enqueue(colorCommand(), queuePath)
    enqueue(colorCommand({ ref: 'ft533.26 ', label: 'Azul' }), queuePath)

    expect(consolidated(queuePath)).toHaveLength(1)
  })

  // A cor e os campos ocupam pares distintos: trocar a cor nao pode fazer sumir
  // a data que o operador digitou no mesmo processo.
  it('convive com a edicao de campo do mesmo processo', () => {
    enqueue(command(), queuePath)
    enqueue(colorCommand(), queuePath)

    const fila = consolidated(queuePath)

    expect(fila).toHaveLength(2)
    expect(fila.filter(isColorEdit)).toHaveLength(1)
  })

  it('descarta so a edicao de cor, deixando a de campo na fila', () => {
    enqueue(command(), queuePath)
    const cor = enqueue(colorCommand(), queuePath)

    expect(discard(cor.id, queuePath)).toBe(true)
    expect(consolidated(queuePath).filter(isColorEdit)).toEqual([])
    expect(consolidated(queuePath)).toHaveLength(1)
  })

  /**
   * A fila e append-only em disco e sobrevive ao reinicio: um registro gravado
   * antes de `H-27` nao tem `kind`, e precisa continuar valendo como edicao de
   * campo. Migrar o arquivo seria reescrever o relato do que aconteceu.
   */
  it('le registro sem `kind` como edicao de campo', () => {
    const antigo = {
      id: 'edicao-de-antes-de-h27',
      ts: '2026-08-14T10:00:00.000Z',
      ref: 'FT533.26',
      sourceRow: 483,
      field: 'eta2',
      value: '2026-08-06',
      previous: '2026-08-04',
    }
    writeFileSync(queuePath, `${JSON.stringify(antigo)}\n`, 'utf-8')

    const fila = consolidated(queuePath)

    expect(fila).toHaveLength(1)
    expect(isColorEdit(fila[0] as PendingEdit)).toBe(false)
    expect(asField(fila[0]).field).toBe('eta2')
  })
})
