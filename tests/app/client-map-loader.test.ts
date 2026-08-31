import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClientMapError, loadClientMap } from '../../src/app/client-map-loader.ts'

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
