import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadTeamMap, TeamMapError } from '../../src/app/team-map-loader.ts'

/**
 * H-48. A carga do mapa de equipe.
 *
 * Nomes ficticios, e nenhum teste toca `config/team-map.json` real (RNF-38).
 */

let dir: string

const membroValido = {
  key: 'membro1',
  label: 'Primeiro',
  importers: ['importadora um'],
  colorResponsible: ['colaborador2'],
}

function escrever(conteudo: unknown): string {
  const path = join(dir, 'team-map.json')
  writeFileSync(path, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cronos-team-map-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadTeamMap', () => {
  it('devolve lista vazia quando o arquivo NAO existe', () => {
    // Sem mapa, a atribuicao cai inteira na cor — o comportamento anterior a
    // H-50, que continua correto.
    expect(loadTeamMap(join(dir, 'nao-existe.json'))).toEqual([])
  })

  it('carrega e normaliza os importadores, preservando o rotulo', () => {
    const map = loadTeamMap(escrever({ version: 1, members: [membroValido] }))

    expect(map).toEqual([
      {
        key: 'membro1',
        label: 'Primeiro',
        importers: ['IMPORTADORA UM'],
        colorResponsible: ['colaborador2'],
      },
    ])
  })

  it('usa a chave como rotulo quando "label" falta', () => {
    const { label: _ignorado, ...semRotulo } = membroValido
    const map = loadTeamMap(escrever({ version: 1, members: [semRotulo] }))

    expect(map[0]?.label).toBe('membro1')
  })

  it('MATA a partida em JSON malformado', () => {
    expect(() => loadTeamMap(escrever('{ isto nao e json'))).toThrow(TeamMapError)
  })

  it('recusa arquivo sem a lista "members"', () => {
    expect(() => loadTeamMap(escrever({ version: 1 }))).toThrow(/precisa ter a lista "members"/)
  })

  it('recusa cor de responsavel fora do dominio de TD-05', () => {
    const path = escrever({
      version: 1,
      members: [{ ...membroValido, colorResponsible: ['colaborador3'] }],
    })

    expect(() => loadTeamMap(path)).toThrow(/colorResponsible\[0\] invalido: colaborador3/)
  })

  it('recusa membro que nunca receberia processo algum', () => {
    // Intencao escrita, regra esquecida: o sintoma seria a pessoa sumir do
    // ranking, e nao um erro.
    const path = escrever({
      version: 1,
      members: [{ key: 'membro1', importers: [], colorResponsible: [] }],
    })

    expect(() => loadTeamMap(path)).toThrow(/nunca receberia processo algum/)
  })

  it('aceita membro sem importadores quando ele e o fallback', () => {
    const path = escrever({
      version: 1,
      members: [{ key: 'membro2', importers: [], colorResponsible: [], fallback: true }],
    })

    expect(loadTeamMap(path)[0]?.fallback).toBe(true)
  })

  it('recusa DOIS fallbacks, nomeando os dois', () => {
    // Dois "todo o resto" seriam uma ordem de avaliacao disfarcada de conjunto:
    // o primeiro levaria tudo, e o segundo pareceria uma pessoa sem processos.
    const path = escrever({
      version: 1,
      members: [
        { key: 'membro1', importers: [], colorResponsible: [], fallback: true },
        { key: 'membro2', importers: [], colorResponsible: [], fallback: true },
      ],
    })

    expect(() => loadTeamMap(path)).toThrow(/"membro1", "membro2"/)
  })

  it('recusa chave de membro repetida', () => {
    const path = escrever({ version: 1, members: [membroValido, membroValido] })

    expect(() => loadTeamMap(path)).toThrow(/members\[0\] e members\[1\]/)
  })

  it('recusa "fallback" que nao e booleano', () => {
    const path = escrever({ version: 1, members: [{ ...membroValido, fallback: 'sim' }] })

    expect(() => loadTeamMap(path)).toThrow(/fallback deve ser true ou false/)
  })

  it('recusa importador vazio na lista, apontando o indice', () => {
    const path = escrever({
      version: 1,
      members: [{ ...membroValido, importers: ['importadora um', '  '] }],
    })

    expect(() => loadTeamMap(path)).toThrow(/importers\[1\] deve ser um texto nao vazio/)
  })
})
