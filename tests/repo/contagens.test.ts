import { describe, expect, it } from 'vitest'
import { inspect, inspectStructure } from '../../tools/contar-documentacao.mjs'

/**
 * As regiões de contagem de `docs/`, `README.md`, `CLAUDE.md` e `.claude/` contra a
 * fonte de cada número, sobre o repositório real — documento versionado, como em
 * `documentacao.test.ts`; nada de planilha, `data/` ou `config/app.json`.
 *
 * Existe porque só o total de histórias tinha guarda, e por regex sobre uma forma de
 * frase: o levantamento de 01/10/2026 achou seis de 41 números de estado atual velhos
 * — 96 histórias com 114 no backlog, seis ADRs com sete, "sete passos" com oito no
 * `verify`. A reprovação diz o comando que corrige; quem decide a regra de cada
 * contador é `tools/contar-documentacao.config.mjs`, e não este arquivo.
 *
 * A região `confere` — a árvore de `04-arquitetura.md` — reprova aqui do mesmo jeito,
 * mas não se corrige pelo comando: é conteúdo escrito à mão.
 *
 * Os espelhos de estado — o mesmo ID com estado em dois documentos — e a tabela solta
 * depois de linha em branco também reprovam aqui, e também se corrigem à mão. A âncora
 * contra guarda verde por vacuidade é o piso de cada guarda — regiões, arquivos e IDs de
 * cada lado de espelho —, em `floors`, em `tools/contar-documentacao.config.mjs`.
 */

const ROOT = process.cwd()

describe('as regiões de contagem da documentação batem com a fonte', () => {
  it('nenhuma região diverge da fonte, e nenhum marcador está quebrado', () => {
    const { divergences, errors } = inspect(ROOT)

    expect(errors.map(({ file, line, message }) => `${file}:${line} ${message}`)).toEqual([])
    expect(
      divergences.map(({ file, line, name, written, actual }) =>
        written === null
          ? `${file}:${line} ${name}: ${actual} — corrija à mão`
          : `${file}:${line} ${name}: escrito "${written}", real "${actual}" — rode node tools/contar-documentacao.mjs --write (.claude/rules/documentacao.md)`,
      ),
    ).toEqual([])
  })
})

describe('a estrutura da documentação: espelhos, tabelas e pisos', () => {
  it('nenhum espelho diverge, nenhuma tabela fica solta, e cada guarda passa do piso', () => {
    expect(
      inspectStructure(ROOT).problems.map(
        ({ file, line, guard, message }) =>
          `${file}:${line} ${guard}: ${message} — corrija à mão (.claude/rules/documentacao.md)`,
      ),
    ).toEqual([])
  })
})
