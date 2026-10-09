/**
 * Tipos de `contar-documentacao.config.mjs`, para a suite importar os contadores —
 * pelo mesmo motivo de `contar-documentacao.d.mts`. Declara apenas o que a suite usa.
 */

import type { Floors, Mirror, Source } from './contar-documentacao.mjs'

type Counter = (source: Source, arg?: string) => number | string

export const COUNTERS: {
  historias: Counter
  'historias-concluidas': Counter
  'historias-abertas': Counter
  'historias-desde': Counter
  epicos: Counter
  premissas: Counter
  riscos: Counter
  'casos-obrigatorios': Counter
  'casos-limite': Counter
  'historias-com-caso-obrigatorio': Counter
  achados: Counter
  'passos-verify': Counter
  'passos-verify-lista': Counter
  'regras-corpus': Counter
  'regras-corpus-faixa': Counter
  'indicadores-definidos': Counter
  'indicadores-ativos': Counter
  'indicadores-aposentados': Counter
  alertas: Counter
  'chaves-de-cor': Counter
  adrs: Counter
  rules: Counter
  'pendencias-abertas': Counter
  'arvore-src': Counter
  versao: Counter
}

declare const config: {
  ids: { mirrors: Mirror[] }
  floors: Floors
}

export default config
