import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  consolidated,
  discard,
  discardAll,
  type EditCommand,
  enqueue,
} from '../../src/io/edit-queue.ts'

/**
 * A fila de edicoes. **Nada aqui toca o `.xlsx`** — a camada so registra a
 * intencao, e RNF-37 proibe teste sobre a planilha real de qualquer forma.
 */

let directory: string
let queuePath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cronos-fila-'))
  queuePath = join(directory, 'pending-edits.jsonl')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function command(overrides: Partial<EditCommand> = {}): EditCommand {
  return {
    ref: 'FT533.26',
    sourceRow: 483,
    field: 'eta2',
    value: '2026-08-06',
    previous: '2026-08-04',
    ...overrides,
  }
}

describe('enqueue', () => {
  it('anexa ao arquivo e devolve a edicao com id e ts', () => {
    const edit = enqueue(command(), queuePath)

    expect(edit.id).not.toBe('')
    expect(edit.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(edit.ref).toBe('FT533.26')
    expect(readFileSync(queuePath, 'utf-8').trim().split('\n')).toHaveLength(1)
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
    expect(fila[0]?.value).toBe('2026-08-10')
  })

  it('mantem pares distintos do mesmo processo', () => {
    enqueue(command({ field: 'eta2' }), queuePath)
    enqueue(command({ field: 'statusRaw', value: 'AG BL', previous: '' }), queuePath)

    expect(
      consolidated(queuePath)
        .map((edit) => edit.field)
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
    expect(fila[0]?.value).toBeNull()
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

    expect(consolidated(queuePath).map((edit) => edit.field)).toEqual(['statusRaw'])
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

    expect(consolidated(queuePath).map((edit) => edit.field)).toEqual(['statusRaw'])
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
