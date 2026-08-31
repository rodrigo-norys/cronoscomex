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
    expect(loadClientMap(join(dir, 'nao-existe.json'))).toEqual([])
  })

  it('devolve lista vazia para "clients" vazia, sem lancar', () => {
    expect(loadClientMap(escrever({ version: 1, clients: [] }))).toEqual([])
  })

  it('carrega e normaliza as regras', () => {
    const map = loadClientMap(escrever({ version: 1, clients: [clienteValido] }))

    expect(map).toEqual([
      { key: 'ALFA', label: 'Alfa', rules: [{ match: 'prefix', value: 'ALF' }] },
    ])
  })

  it('usa a chave como rotulo quando "label" falta ou e vazio', () => {
    const map = loadClientMap(
      escrever({ version: 1, clients: [{ ...clienteValido, label: '   ' }] }),
    )

    expect(map[0]?.label).toBe('alfa')
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
    expect(loadClientMap(semCampo)[0]?.rules[0]).not.toHaveProperty('importer')
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

    expect(loadClientMap(path).map((entry) => entry.key)).toEqual(['GAMA', 'DELTA'])
  })
})
