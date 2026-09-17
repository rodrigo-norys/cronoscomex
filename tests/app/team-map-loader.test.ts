import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadTeamMap,
  removeTeamMember,
  saveTeamMember,
  TeamMapError,
} from '../../src/app/team-map-loader.ts'

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

  it('aceita membro com carteira vazia, sem cor e sem fallback', () => {
    /*
      **A validacao afrouxou em `H-91`**, e ate ali este arquivo matava a
      partida com `process.exit(1)`.

      O argumento antigo era que o membro nunca receberia processo — o mesmo
      defeito de `rules` vazia no mapa de clientes. Ele caiu quando a tela
      passou a CRIAR membro: alguem entra na equipe e ainda nao recebeu
      importador, e recusar o arquivo transformaria um estado normal do painel
      em painel nenhum. A pessoa aparece com zero, como `A-28` ja manda.
    */
    const path = escrever({
      version: 1,
      members: [{ key: 'membro1', importers: [], colorResponsible: [] }],
    })

    expect(loadTeamMap(path)).toEqual([
      { key: 'membro1', label: 'membro1', importers: [], colorResponsible: [] },
    ])
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

/**
 * `H-91`. A gravacao — o QUARTO caminho de escrita da aplicacao.
 *
 * Todo teste injeta o caminho: `saveTeamMember` recusa o padrao sob
 * `NODE_ENV=test`, e sem a injecao a suite reescreveria a equipe do operador
 * (regra inviolavel 7, medida em `H-28` e `H-34`).
 */
describe('saveTeamMember', () => {
  it('RECUSA o caminho padrao sob NODE_ENV=test', () => {
    // A guarda que `H-28` e `H-34` pagaram para existir. Sem ela a suite grava
    // no arquivo do operador, e o sintoma aparece semanas depois.
    expect(() =>
      saveTeamMember({ kind: 'membro-criado', key: 'membro1', label: 'Primeiro', importers: [] }),
    ).toThrow(/injete o caminho/)
  })

  it('CRIA o arquivo que ainda nao existe', () => {
    // O estado da maquina do operador (`PD-08`): a distribuicao leva so o
    // `.exemplo`, e definir o primeiro responsavel e o que faz o mapa nascer.
    const path = join(dir, 'team-map.json')

    saveTeamMember(
      { kind: 'membro-criado', key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'] },
      path,
    )

    expect(loadTeamMap(path)).toEqual([
      { key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'], colorResponsible: [] },
    ])
  })

  it('PRESERVA as chaves com prefixo "_", que sao a documentacao do formato', () => {
    const path = escrever({
      _origem: 'Formato entregue por H-48.',
      _comentario_key: 'A chave e IMPESSOAL de proposito.',
      version: 1,
      members: [],
    })

    saveTeamMember(
      { kind: 'membro-criado', key: 'membro1', label: 'Primeiro', importers: [] },
      path,
    )

    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    expect(raw._origem).toBe('Formato entregue por H-48.')
    expect(raw._comentario_key).toBe('A chave e IMPESSOAL de proposito.')
    expect(raw.version).toBe(1)
  })

  it('PRESERVA os campos que esta historia nao conhece', () => {
    // `colorResponsible` e `fallback` saem em `H-93`. Apaga-los aqui
    // anteciparia a remocao sem a historia que a explica — e sem os testes que
    // medem quantos processos migram.
    const path = escrever({
      version: 1,
      members: [
        {
          key: 'membro1',
          label: 'Primeiro',
          _nota: 'Lista explicita mais o roxo.',
          importers: ['importadora um'],
          colorResponsible: ['colaborador2'],
          fallback: false,
        },
      ],
    })

    saveTeamMember(
      { kind: 'membro-redefinido', key: 'membro1', label: 'Primeiro', importers: ['MPA'] },
      path,
    )

    const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
      members: Record<string, unknown>[]
    }
    expect(raw.members[0]).toEqual({
      key: 'membro1',
      label: 'Primeiro',
      _nota: 'Lista explicita mais o roxo.',
      importers: ['MPA'],
      colorResponsible: ['colaborador2'],
      fallback: false,
    })
  })

  it('acrescenta o membro novo sem mexer nos que ja estavam', () => {
    const path = escrever({ version: 1, members: [membroValido] })

    saveTeamMember(
      { kind: 'membro-criado', key: 'membro2', label: 'Segundo', importers: ['mpa'] },
      path,
    )

    expect(loadTeamMap(path).map((membro) => membro.key)).toEqual(['membro1', 'membro2'])
  })
})

describe('removeTeamMember', () => {
  it('RECUSA o caminho padrao sob NODE_ENV=test', () => {
    expect(() =>
      removeTeamMember({ kind: 'membro-desfeito', key: 'membro1', importer: null, releases: [] }),
    ).toThrow(/injete o caminho/)
  })

  it('apaga a entrada do responsavel desfeito', () => {
    /*
      Aqui o mapa de equipe DIVERGE do de clientes: la o cliente sobrevive a
      saida do grupo, porque a regra dele continua valendo sozinha; aqui a
      entrada E a regra, e uma pessoa sem carteira que permanecesse voltaria ao
      painel como membro ativo com zero — indistinguivel de quem acabou de
      entrar na equipe.
    */
    const path = escrever({ version: 1, members: [membroValido] })

    removeTeamMember(
      {
        kind: 'membro-desfeito',
        key: 'membro1',
        importer: null,
        releases: ['IMPORTADORA UM'],
      },
      path,
    )

    expect(loadTeamMap(path)).toEqual([])
  })

  it('tira SO o importador pedido, deixando os demais', () => {
    const path = escrever({
      version: 1,
      members: [{ ...membroValido, importers: ['importadora um', 'mpa'] }],
    })

    removeTeamMember(
      { kind: 'importador-removido', key: 'membro1', importer: 'MPA', releases: ['MPA'] },
      path,
    )

    expect(loadTeamMap(path)[0]?.importers).toEqual(['IMPORTADORA UM'])
  })

  it('e no-op quando o arquivo nao existe', () => {
    const path = join(dir, 'nao-existe.json')

    expect(() =>
      removeTeamMember(
        { kind: 'membro-desfeito', key: 'membro1', importer: null, releases: [] },
        path,
      ),
    ).not.toThrow()
  })
})
