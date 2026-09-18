import { readFileSync } from 'node:fs'

/**
 * Le um arquivo de configuracao JSON, tolerando o BOM.
 *
 * **Existe porque o alvo e Windows (RNF-26).** O Bloco de Notas e vários
 * editores de lá gravam UTF-8 **com** BOM sem avisar, e `JSON.parse` recusa o
 * `﻿` inicial com `Unexpected token`, que nao diz ao operador o que houve.
 * Medido em 17/09/2026, por acidente de metodo durante o ensaio: um `app.json`
 * gravado por `[System.Text.Encoding]::UTF8` do .NET — que inclui BOM — matou a
 * partida.
 *
 * **Uma fonte, e nao uma copia por loader.** Sao oito pontos de leitura em
 * quatro arquivos, e o criterio de `H-83` vale igual aqui: duas copias divergem.
 *
 * O BOM e removido apenas do INICIO. No meio do arquivo ele e um caractere como
 * outro qualquer, e apaga-lo ali mudaria o conteudo — que e o que a regra
 * inviolavel 3 proibe.
 */
export function readJsonConfig(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8').replace(/^﻿/, ''))
}
