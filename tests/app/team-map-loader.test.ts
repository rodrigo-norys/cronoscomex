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

    expect(map).toEqual([{ key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'] }])
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

  // `H-93`: a carga IGNORA `colorResponsible` e `fallback` em vez de recusa-los.
  // O mapa e do operador e foi escrito quando eles valiam; matar a partida por
  // um campo obsoleto o deixaria sem painel.
  it('IGNORA os campos que sairam em H-93, sem recusar o arquivo', () => {
    const path = escrever({
      version: 1,
      members: [{ ...membroValido, colorResponsible: ['colaborador3'], fallback: 'nem booleano' }],
    })

    expect(loadTeamMap(path)).toEqual([
      { key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'] },
    ])
  })

  it('aceita membro com carteira vazia', () => {
    /*
      **A validacao afrouxou em `H-91`**, e ate ali este arquivo matava a
      partida com `process.exit(1)`.

      O argumento antigo era que o membro nunca receberia processo — o mesmo
      defeito de `rules` vazia no mapa de clientes. Ele caiu quando a tela
      passou a CRIAR membro: alguem entra na equipe e ainda nao recebeu
      importador, e recusar o arquivo transformaria um estado normal do painel
      em painel nenhum. A pessoa aparece com zero, como `A-28` ja manda.
    */
    const path = escrever({ version: 1, members: [{ key: 'membro1', importers: [] }] })

    expect(loadTeamMap(path)).toEqual([{ key: 'membro1', label: 'membro1', importers: [] }])
  })

  /*
    **Os tres testes de `fallback` sairam em `H-93`**, com o proprio campo
    (`D-40`). Eles mediam o membro que recebia "todo o resto", a recusa de dois
    deles e a recusa do valor nao-booleano. O usuario o dispensou com a frase
    que virou o desenho: "o fallback deve cair no Sem responsavel, que ai o
    usuario ja sabe que tem que definir um".
  */

  it('recusa chave de membro repetida', () => {
    const path = escrever({ version: 1, members: [membroValido, membroValido] })

    expect(() => loadTeamMap(path)).toThrow(/members\[0\] e members\[1\]/)
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
      { key: 'membro1', label: 'Primeiro', importers: ['IMPORTADORA UM'] },
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

  it('PRESERVA os campos que a aplicacao nao le mais', () => {
    // `colorResponsible` e `fallback` deixaram de valer em `H-93`, e a gravacao
    // nao os apaga: o arquivo e do operador, e reescrever nele o que a historia
    // nao pediu e o que a gravacao crua existe para evitar. A carga os ignora.
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

/**
 * **Um importador pertence a um responsavel so, e agora a carga tambem cobra.**
 *
 * A tela recusa desde `H-91`, por `planTeamMember`. O arquivo editado a mao
 * passava — medido pelo ensaio em 17/09/2026, que carregou um mapa com o mesmo
 * importador em dois membros sem um erro sequer. `IND-20` conta por pessoa: o
 * processo entraria nas duas carteiras e a soma deixaria de fechar com o total.
 */
describe('loadTeamMap — importador em mais de um responsavel', () => {
  it('recusa, nomeando o importador e os dois membros', () => {
    const path = escrever({
      version: 1,
      members: [
        { key: 'membro1', label: 'Um', importers: ['ACME'] },
        { key: 'membro2', label: 'Dois', importers: ['ACME'] },
      ],
    })

    expect(() => loadTeamMap(path)).toThrow(TeamMapError)
    expect(() => loadTeamMap(path)).toThrow(/membro1/)
    expect(() => loadTeamMap(path)).toThrow(/membro2/)
  })

  /**
   * A comparacao e a mesma da tela — `overlaps`, e nao igualdade. Listar "ACME"
   * ja casa "ACME - SC", entao estes dois disputam os mesmos processos sem que
   * nenhuma string se repita.
   */
  it('recusa tambem quando um e sufixo de filial do outro', () => {
    const path = escrever({
      version: 1,
      members: [
        { key: 'membro1', label: 'Um', importers: ['ACME'] },
        { key: 'membro2', label: 'Dois', importers: ['ACME - SC'] },
      ],
    })

    expect(() => loadTeamMap(path)).toThrow(/mais de um responsavel/)
  })

  /** A ancora: importadores distintos entre membros continuam valendo. */
  it('aceita importadores diferentes em membros diferentes', () => {
    const path = escrever({
      version: 1,
      members: [
        { key: 'membro1', label: 'Um', importers: ['ACME'] },
        { key: 'membro2', label: 'Dois', importers: ['OUTRA'] },
      ],
    })

    expect(loadTeamMap(path)).toHaveLength(2)
  })

  /** Repetir o mesmo importador DENTRO de um membro nao e conflito. */
  it('aceita o mesmo importador repetido no mesmo membro', () => {
    const path = escrever({
      version: 1,
      members: [{ key: 'membro1', label: 'Um', importers: ['ACME', 'ACME'] }],
    })

    expect(loadTeamMap(path)).toHaveLength(1)
  })
})
