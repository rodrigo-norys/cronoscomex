import { describe, expect, it } from 'vitest'
import { createSource, inspect, scanRegions } from '../../tools/contar-documentacao.mjs'

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
 */

const ROOT = process.cwd()

describe('as regiões de contagem da documentação batem com a fonte', () => {
  it('encontra as regiões — âncora contra guarda verde por vacuidade', () => {
    // Medido em 01/10/2026 com `tools/contar-documentacao.mjs`: 63 regiões `conta` em
    // 13 arquivos. O piso pega o marcador que parou de casar, não a variação normal.
    const source = createSource(ROOT)
    const regions = source.scope.flatMap((file) => scanRegions(source.read(file)).counts)
    expect(regions.length).toBeGreaterThan(40)
  })

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
