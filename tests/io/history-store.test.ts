import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Logger, LogInput } from '../../src/app/logger.ts'
import type { CustomsChannel, Process, StatusCategory } from '../../src/domain/types.ts'
import {
  daysInCurrentCategory,
  eventsOf,
  historyStartedAt,
  monthlySeries,
  recordChanges,
  stalledDaysByRef,
} from '../../src/io/history-store.ts'

/**
 * A persistencia do historico (`H-28`), sobre arquivo temporario.
 *
 * Cada teste usa um diretorio proprio: o modulo mantem um indice em memoria
 * chaveado pelo caminho e pelo tamanho do arquivo, e paths distintos garantem
 * que um teste nao herde o indice do anterior.
 */

const SP = 'America/Sao_Paulo'

let dir: string
let path: string

function process(
  ref: string,
  statusCategory: StatusCategory,
  customsChannel: CustomsChannel = 'nenhum',
  sourceRow = 10,
): Process {
  return {
    sourceRow,
    ref,
    clientRaw: '',
    importerRaw: '',
    billOfLading: '',
    agentRaw: '',
    container: '',
    vesselRaw: '',
    portRaw: '',
    goodsRaw: '',
    statusRaw: '',
    boletoRaw: '',
    paymentRaw: '',
    columnPRaw: '',
    eta2: null,
    registrationDate: null,
    docsSentDate: null,
    clientKey: '',
    clientProcessKey: '',
    clientLabel: '',
    importerKey: '',
    agentKey: '',
    vesselKey: '',
    portKey: '',
    goodsKey: '',
    statusCategory,
    responsible: 'indefinido',
    customsChannel,
    importerOutsideRj: null,
    styleKey: 'none',
    anomalies: [],
  }
}

/** Logger espiao: guarda as entradas em memoria, sem tocar disco. */
function spyLogger(): Logger & { entries: LogInput[] } {
  const entries: LogInput[] = []
  return {
    entries,
    log: (entry) => {
      entries.push(entry)
    },
    purgeExpired: () => [],
    currentFile: () => '',
  }
}

function lines(): string[] {
  return readFileSync(path, 'utf-8').trimEnd().split('\n')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-history-'))
  path = join(dir, 'history.jsonl')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('recordChanges — criterios de aceite', () => {
  it('gera um evento com from nulo para cada processo na primeira leitura', () => {
    const events = recordChanges([process('A', 'em_andamento'), process('B', 'em_desembaraco')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(events).toHaveLength(2)
    expect(events.every((event) => event.from === null)).toBe(true)
    expect(lines()).toHaveLength(2)
  })

  it('nao grava nada numa segunda leitura sem mudancas', () => {
    const conjunto = [process('A', 'em_andamento')]
    recordChanges(conjunto, { path, now: new Date('2026-08-17T12:00:00.000Z') })

    const events = recordChanges(conjunto, { path, now: new Date('2026-08-18T12:00:00.000Z') })

    expect(events).toEqual([])
    expect(lines()).toHaveLength(1)
  })

  it('grava from e to na mudanca de em_andamento para desembaracado', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    const [evento] = recordChanges([process('A', 'desembaracado')], {
      path,
      now: new Date('2026-08-18T12:00:00.000Z'),
    })

    expect(evento).toMatchObject({ ref: 'A', from: 'em_andamento', to: 'desembaracado' })
  })

  it('recria o arquivo apagado e trata todos como vistos pela primeira vez', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })
    rmSync(path)

    const events = recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-18T12:00:00.000Z'),
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.from).toBeNull()
    expect(lines()).toHaveLength(1)
  })

  it('nao grava evento por REF que sumiu do arquivo', () => {
    recordChanges([process('A', 'em_andamento'), process('B', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    const events = recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-18T12:00:00.000Z'),
    })

    expect(events).toEqual([])
  })

  it('grava as chaves de 03-modelo-dados.md secao 3.1, mais channel', () => {
    recordChanges([process('A', 'em_andamento', 'vermelho', 42)], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(JSON.parse(lines()[0] ?? '{}')).toEqual({
      ts: '2026-08-17T12:00:00.000Z',
      ref: 'A',
      from: null,
      to: 'em_andamento',
      channel: 'vermelho',
      sourceRow: 42,
    })
  })

  it('registra a quantidade de eventos em history.appended', () => {
    const logger = spyLogger()
    recordChanges([process('A', 'em_andamento'), process('B', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
      logger,
    })

    expect(logger.entries).toContainEqual({ level: 'info', event: 'history.appended', events: 2 })
  })
})

describe('recordChanges — casos-limite', () => {
  /**
   * Duas mudancas entre leituras produzem UM evento, e ele registra o estado
   * anterior conhecido — nao o intermediario, que ninguem observou (regra 3).
   */
  it('registra so a diferenca observavel quando o processo muda duas vezes entre leituras', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    const events = recordChanges([process('A', 'desembaracado')], {
      path,
      now: new Date('2026-08-19T12:00:00.000Z'),
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ from: 'em_andamento', to: 'desembaracado' })
    expect(lines()).toHaveLength(2)
  })

  it('ignora a linha corrompida, conta no log e usa o resto do arquivo', () => {
    writeFileSync(
      path,
      [
        '{"ts":"2026-08-17T12:00:00.000Z","ref":"A","from":null,"to":"em_andamento","channel":"nenhum","sourceRow":10}',
        '{"ts":"2026-08-17T12:00:00',
        '{"ts":"2026-08-17T12:00:00.000Z","ref":"B","from":null,"to":"desembaracado","channel":"nenhum","sourceRow":11}',
        '',
      ].join('\n'),
      'utf-8',
    )
    const logger = spyLogger()

    const events = recordChanges([process('A', 'em_andamento'), process('B', 'desembaracado')], {
      path,
      now: new Date('2026-08-18T12:00:00.000Z'),
      logger,
    })

    expect(events).toEqual([])
    expect(logger.entries).toContainEqual({
      level: 'warn',
      event: 'history.appended',
      errorCode: 'LINHA_INVALIDA',
      skippedLines: 1,
    })
  })

  it('descarta a linha cuja categoria nao pertence ao dominio', () => {
    writeFileSync(
      path,
      `{"ts":"2026-08-17T12:00:00.000Z","ref":"A","from":null,"to":"inventada","channel":"nenhum","sourceRow":10}\n`,
      'utf-8',
    )

    const events = recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-18T12:00:00.000Z'),
    })

    expect(events[0]?.from).toBeNull()
  })

  /**
   * 100 mil linhas, 3 REF. O que se mede e o que a estrutura em memoria guarda:
   * um registro por REF, nunca um por evento.
   */
  it('consolida 100 mil linhas em um registro por REF', () => {
    const refs = ['A', 'B', 'C']
    const blocos: string[] = []
    for (let i = 0; i < 100_000; i += 1) {
      const ref = refs[i % 3] as string
      const categoria = i % 2 === 0 ? 'em_andamento' : 'em_desembaraco'
      blocos.push(
        `{"ts":"2026-08-17T12:00:00.000Z","ref":"${ref}","from":null,"to":"${categoria}","channel":"nenhum","sourceRow":10}`,
      )
    }
    writeFileSync(path, `${blocos.join('\n')}\n`, 'utf-8')

    const stalled = stalledDaysByRef(
      refs.map((ref) => process(ref, 'em_andamento')),
      new Date('2026-08-17T00:00:00.000Z'),
      SP,
      { path },
    )

    expect(stalled.size).toBe(3)
    // A ultima linha de cada REF e a que vale: 99.999 % 3 === 0 → 'A' em 'em_desembaraco'.
    expect(
      recordChanges([process('A', 'em_desembaraco')], {
        path,
        now: new Date('2026-08-18T12:00:00.000Z'),
      }),
    ).toEqual([])
  })

  it('devolve null em daysInCurrentCategory de REF sem evento algum', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(
      daysInCurrentCategory('DESCONHECIDA', new Date('2026-08-17T00:00:00.000Z'), SP, { path }),
    ).toBeNull()
  })
})

describe('daysInCurrentCategory e stalledDaysByRef', () => {
  it('conta os dias desde a ultima mudanca de categoria', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    expect(daysInCurrentCategory('A', new Date('2026-08-17T00:00:00.000Z'), SP, { path })).toBe(16)
  })

  /** Trocar a cor nao pode apagar o alerta de processo parado (ALE-06). */
  it('nao reinicia a contagem quando so o canal mudou', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    recordChanges([process('A', 'em_andamento', 'vermelho')], {
      path,
      now: new Date('2026-08-16T12:00:00.000Z'),
    })

    expect(daysInCurrentCategory('A', new Date('2026-08-17T00:00:00.000Z'), SP, { path })).toBe(16)
  })

  it('deixa de fora do mapa o REF sem evento, em vez de dar zero', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    const stalled = stalledDaysByRef(
      [process('A', 'em_andamento'), process('SEM_EVENTO', 'em_andamento')],
      new Date('2026-08-17T00:00:00.000Z'),
      SP,
      { path },
    )

    expect(stalled.has('SEM_EVENTO')).toBe(false)
    expect(stalled.get('A')).toBe(16)
  })
})

describe('historyStartedAt', () => {
  it('devolve null enquanto nao ha historico', () => {
    expect(historyStartedAt({ path })).toBeNull()
  })

  it('devolve o instante do primeiro evento gravado', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    recordChanges([process('A', 'desembaracado')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(historyStartedAt({ path })).toBe('2026-08-01T12:00:00.000Z')
  })
})

describe('eventsOf', () => {
  it('devolve so os eventos do REF pedido, em ordem', () => {
    recordChanges([process('A', 'em_andamento'), process('B', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    recordChanges([process('A', 'desembaracado'), process('B', 'em_andamento')], {
      path,
      now: new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(eventsOf('A', { path }).map((event) => event.to)).toEqual([
      'em_andamento',
      'desembaracado',
    ])
  })

  it('devolve lista vazia quando o arquivo nao existe', () => {
    expect(eventsOf('A', { path })).toEqual([])
  })
})

describe('monthlySeries', () => {
  it('devolve serie vazia quando o arquivo nao existe', () => {
    expect(monthlySeries(12, new Date('2026-08-17T00:00:00.000Z'), SP, { path })).toEqual({
      series: [],
      truncated: false,
    })
  })

  it('devolve um ponto por mes desde o primeiro evento, e marca truncated', () => {
    recordChanges([process('A', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    const { series, truncated } = monthlySeries(12, new Date('2026-10-15T00:00:00.000Z'), SP, {
      path,
    })

    expect(series.map((ponto) => ponto.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(truncated).toBe(true)
  })

  it('recorta a serie aos REF pedidos', () => {
    recordChanges([process('A', 'em_andamento'), process('B', 'em_andamento')], {
      path,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    const { series } = monthlySeries(1, new Date('2026-08-17T00:00:00.000Z'), SP, {
      path,
      refs: new Set(['A']),
    })

    expect(series[0]?.total).toBe(1)
  })

  it('atravessa a fronteira de bloco de leitura sem perder evento', () => {
    // Cada linha tem ~120 bytes; 2.000 linhas passam de 64 KB, que e o bloco.
    const blocos: string[] = []
    for (let i = 0; i < 2_000; i += 1) {
      blocos.push(
        `{"ts":"2026-08-17T12:00:00.000Z","ref":"REF${i}","from":null,"to":"em_andamento","channel":"nenhum","sourceRow":${i}}`,
      )
    }
    writeFileSync(path, `${blocos.join('\n')}\n`, 'utf-8')

    const { series } = monthlySeries(1, new Date('2026-08-17T00:00:00.000Z'), SP, { path })

    expect(series[0]?.total).toBe(2_000)
  })

  it('enxerga a linha final sem quebra de linha ao fim do arquivo', () => {
    appendFileSync(
      path,
      '{"ts":"2026-08-17T12:00:00.000Z","ref":"A","from":null,"to":"em_andamento","channel":"nenhum","sourceRow":10}',
      'utf-8',
    )

    expect(
      monthlySeries(1, new Date('2026-08-17T00:00:00.000Z'), SP, { path }).series[0]?.total,
    ).toBe(1)
  })
})
