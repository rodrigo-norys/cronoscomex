import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClientMapError, loadClientMap, saveClientRule } from '../../src/app/client-map-loader.ts'

/**
 * H-48. A carga do mapa de clientes.
 *
 * Nenhum teste toca `config/client-map.json` real (RNF-38): tudo acontece em
 * diretorio temporario, e o caminho e sempre injetado.
 */

let dir: string

const clienteValido = {
  key: 'alfa',
  label: 'Alfa',
  rules: [{ match: 'prefix', value: 'alf' }],
}

function escrever(conteudo: unknown): string {
  const path = join(dir, 'client-map.json')
  writeFileSync(path, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-client-map-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadClientMap', () => {
  it('devolve lista vazia quando o arquivo NAO existe, sem lancar', () => {
    // Diverge de `loadColorMap` de proposito: sem mapa de clientes a aplicacao
    // se comporta como antes de H-49, e matar a partida por um arquivo que o
    // repositorio nem versiona repetiria o circulo que H-34 desfez.
    expect(loadClientMap(join(dir, 'nao-existe.json'))).toEqual({ clients: [], groups: [] })
  })

  it('devolve lista vazia para "clients" vazia, sem lancar', () => {
    expect(loadClientMap(escrever({ version: 1, clients: [] }))).toEqual({
      clients: [],
      groups: [],
    })
  })

  it('carrega e normaliza as regras', () => {
    const map = loadClientMap(escrever({ version: 1, clients: [clienteValido] }))

    expect(map.clients).toEqual([
      { key: 'ALFA', label: 'Alfa', rules: [{ match: 'prefix', value: 'ALF' }] },
    ])
    expect(map.groups).toEqual([])
  })

  it('usa a chave como rotulo quando "label" falta ou e vazio', () => {
    const map = loadClientMap(
      escrever({ version: 1, clients: [{ ...clienteValido, label: '   ' }] }),
    )

    expect(map.clients[0]?.label).toBe('alfa')
  })

  it('MATA a partida em JSON malformado', () => {
    // Ausente e "ainda nao configurei"; escrito errado e engano que nenhuma tela
    // conserta, e seguir vazio faria a consolidacao sumir sem aviso.
    expect(() => loadClientMap(escrever('{ isto nao e json'))).toThrow(ClientMapError)
  })

  it('recusa arquivo sem a lista "clients", apontando o exemplo', () => {
    expect(() => loadClientMap(escrever({ version: 1 }))).toThrow(/precisa ter a lista "clients"/)
  })

  it('recusa "match" fora do dominio, nomeando a entrada e os valores aceitos', () => {
    const path = escrever({
      version: 1,
      clients: [{ ...clienteValido, rules: [{ match: 'regex', value: 'alf' }] }],
    })

    expect(() => loadClientMap(path)).toThrow(/clients\[0\]\.rules\[0\]\.match/)
    expect(() => loadClientMap(path)).toThrow(/prefix, contains, exact/)
  })

  it('recusa valor vazio, que casaria toda linha', () => {
    // `''` como prefixo casa tudo, e a primeira regra vence: uma unica regra
    // assim engoliria o mapa inteiro em silencio.
    const path = escrever({
      version: 1,
      clients: [{ ...clienteValido, rules: [{ match: 'prefix', value: '  ' }] }],
    })

    expect(() => loadClientMap(path)).toThrow(/value e obrigatorio e nao pode ser vazio/)
  })

  it('recusa cliente com "rules" vazia, que nunca casaria', () => {
    const path = escrever({ version: 1, clients: [{ ...clienteValido, rules: [] }] })

    expect(() => loadClientMap(path)).toThrow(/nunca casaria/)
  })

  it('recusa "importer" presente e vazio, mas aceita ausente', () => {
    const comVazio = escrever({
      version: 1,
      clients: [{ ...clienteValido, rules: [{ match: 'prefix', value: 'alf', importer: '' }] }],
    })
    expect(() => loadClientMap(comVazio)).toThrow(/importer, quando presente/)

    const semCampo = escrever({ version: 1, clients: [clienteValido] })
    expect(loadClientMap(semCampo).clients[0]?.rules[0]).not.toHaveProperty('importer')
  })

  it('recusa chave de cliente repetida, nomeando as duas posicoes', () => {
    const path = escrever({ version: 1, clients: [clienteValido, clienteValido] })

    expect(() => loadClientMap(path)).toThrow(/clients\[0\] e clients\[1\]/)
  })

  it('preserva a ORDEM do arquivo, que e o desempate', () => {
    const path = escrever({
      version: 1,
      clients: [
        { key: 'gama', rules: [{ match: 'prefix', value: 'g', importer: 'um' }] },
        { key: 'delta', rules: [{ match: 'prefix', value: 'g' }] },
      ],
    })

    expect(loadClientMap(path).clients.map((entry) => entry.key)).toEqual(['GAMA', 'DELTA'])
  })
})

/**
 * `H-55`. Os grupos sao conferidos CONTRA a lista de clientes, e e por isso que
 * a validacao vive na mesma leitura.
 */
describe('loadClientMap — a secao "groups"', () => {
  const doisClientes = [
    { key: 'alfa', rules: [{ match: 'prefix', value: 'alf' }] },
    { key: 'beta', rules: [{ match: 'prefix', value: 'bet' }] },
  ]

  const comGrupos = (groups: unknown): string =>
    escrever({ version: 1, clients: doisClientes, groups })

  it('carrega o grupo com os membros normalizados', () => {
    const map = loadClientMap(
      comGrupos([
        {
          key: 'grupo-um',
          label: 'Grupo Um',
          members: [{ client: 'alfa', label: 'Alfa (matriz)' }, { client: 'beta' }],
        },
      ]),
    )

    expect(map.groups).toEqual([
      {
        key: 'GRUPO-UM',
        label: 'Grupo Um',
        members: [{ client: 'ALFA', label: 'Alfa (matriz)' }, { client: 'BETA' }],
      },
    ])
  })

  // Sem a secao, o filtro e o de `H-49` — nenhum nivel de arvore.
  it('trata "groups" ausente como nenhum grupo', () => {
    expect(loadClientMap(escrever({ version: 1, clients: doisClientes })).groups).toEqual([])
  })

  /**
   * O modo de falha provavel: o operador renomeia a chave de um cliente e o
   * grupo passa a apontar para o nada, sem sintoma nenhum na tela.
   */
  it('recusa membro que aponta para cliente inexistente', () => {
    const path = comGrupos([{ key: 'g', members: [{ client: 'gama' }] }])

    expect(() => loadClientMap(path)).toThrow(/nao esta em "clients"/)
  })

  it('recusa o mesmo cliente em dois grupos', () => {
    const path = comGrupos([
      { key: 'um', members: [{ client: 'alfa' }] },
      { key: 'dois', members: [{ client: 'alfa' }] },
    ])

    expect(() => loadClientMap(path)).toThrow(/no maximo um grupo/)
  })

  it('recusa chave de grupo repetida, nomeando as duas posicoes', () => {
    const path = comGrupos([
      { key: 'um', members: [{ client: 'alfa' }] },
      { key: 'um', members: [{ client: 'beta' }] },
    ])

    expect(() => loadClientMap(path)).toThrow(/groups\[0\] e groups\[1\]/)
  })

  // Grupo sem membro nunca apareceria no filtro: e intencao escrita pela metade.
  it('recusa grupo sem membros', () => {
    expect(() => loadClientMap(comGrupos([{ key: 'um', members: [] }]))).toThrow(
      /ao menos um cliente/,
    )
  })

  it('usa a chave como rotulo do grupo quando "label" falta', () => {
    const map = loadClientMap(comGrupos([{ key: 'um', members: [{ client: 'alfa' }] }]))

    expect(map.groups[0]?.label).toBe('um')
  })

  it('recusa "groups" que nao e lista', () => {
    expect(() => loadClientMap(comGrupos({ key: 'um' }))).toThrow(/precisa ser uma lista/)
  })
})

/**
 * A gravacao da regra (02/09/2026), que fecha o caminho de volta: a coluna
 * Cliente lê o mapa desde `H-49`, e agora escreve nele.
 *
 * O que estes casos protegem e o arquivo do OPERADOR. Ele carrega `_origem`,
 * `_comentario_*` e `_nota`, que sao a documentacao do formato, e a grafia dos
 * valores e dele — serializar o mapa em memoria por cima apagaria os dois.
 */
describe('saveClientRule', () => {
  it('cria o arquivo quando ele nao existe', () => {
    // O estado da maquina do operador (`PD-08`): a distribuicao leva so o
    // `.exemplo`, e declarar o cliente de uma linha e o que faz o mapa nascer.
    const path = join(dir, 'novo.json')

    saveClientRule(
      { kind: 'entrada-nova', key: 'ALFA', label: 'Alfa', value: 'ALF-1', beforeKey: null },
      path,
    )

    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({
      version: 1,
      clients: [{ key: 'ALFA', label: 'Alfa', rules: [{ match: 'exact', value: 'ALF-1' }] }],
    })
  })

  it('preserva as chaves de comentario e a secao de grupos', () => {
    const path = escrever({
      version: 1,
      _origem: 'escrito a mao',
      _comentario_ordem: 'a primeira que casa vence',
      clients: [clienteValido],
      groups: [{ key: 'g', label: 'G', members: [{ client: 'alfa' }] }],
    })

    saveClientRule(
      { kind: 'entrada-nova', key: 'ZETA', label: 'Zeta', value: 'ZZZ', beforeKey: null },
      path,
    )

    const gravado = JSON.parse(readFileSync(path, 'utf-8'))
    expect(gravado._origem).toBe('escrito a mao')
    expect(gravado._comentario_ordem).toBe('a primeira que casa vence')
    expect(gravado.groups).toEqual([{ key: 'g', label: 'G', members: [{ client: 'alfa' }] }])
  })

  /** O mecanismo inteiro: a regra `exact` so vence se a entrada dela for
      consultada antes da entrada de prefixo que ja casava a celula. */
  it('insere a entrada nova ANTES da que casa hoje', () => {
    const path = escrever({ version: 1, clients: [clienteValido] })

    saveClientRule(
      { kind: 'entrada-nova', key: 'ZETA', label: 'Zeta', value: 'ALF-1', beforeKey: 'ALFA' },
      path,
    )

    expect(loadClientMap(path).clients.map((entry) => entry.key)).toEqual(['ZETA', 'ALFA'])
  })

  it('move a entrada que ja existia quando ela esta atras da que casa', () => {
    const path = escrever({
      version: 1,
      clients: [
        clienteValido,
        { key: 'zeta', label: 'Zeta', rules: [{ match: 'exact', value: 'z' }] },
      ],
    })

    saveClientRule(
      { kind: 'regra-acrescentada', key: 'ZETA', label: 'Zeta', value: 'ALF-1', beforeKey: 'ALFA' },
      path,
    )

    const clients = loadClientMap(path).clients
    expect(clients.map((entry) => entry.key)).toEqual(['ZETA', 'ALFA'])
    expect(clients[0]?.rules).toEqual([
      { match: 'exact', value: 'Z' },
      { match: 'exact', value: 'ALF-1' },
    ])
  })

  it('nao duplica a regra que ja esta la', () => {
    const path = escrever({
      version: 1,
      clients: [{ key: 'alfa', label: 'Alfa', rules: [{ match: 'exact', value: 'alf-1' }] }],
    })

    saveClientRule(
      { kind: 'regra-acrescentada', key: 'ALFA', label: 'Alfa', value: 'ALF-1', beforeKey: null },
      path,
    )

    expect(loadClientMap(path).clients[0]?.rules).toHaveLength(1)
  })

  it('nao grava nada quando o plano e sem efeito', () => {
    const path = join(dir, 'intocado.json')

    saveClientRule(
      { kind: 'sem-efeito', key: 'ALFA', label: 'Alfa', value: 'ALF-1', beforeKey: null },
      path,
    )

    expect(existsSync(path)).toBe(false)
  })

  /**
   * A guarda de `H-28` e `H-34`, no terceiro caminho de escrita. Sem ela a
   * suite reescreveria o `client-map.json` do operador a cada execucao, e o
   * sintoma apareceria semanas depois como consolidacao que parou de funcionar.
   */
  it('RECUSA o caminho padrao sob NODE_ENV=test', () => {
    expect(() =>
      saveClientRule({
        kind: 'entrada-nova',
        key: 'ALFA',
        label: 'Alfa',
        value: 'ALF-1',
        beforeKey: null,
      }),
    ).toThrow(ClientMapError)
  })
})
