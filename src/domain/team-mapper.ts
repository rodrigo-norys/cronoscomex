import {
  COLOR_RESPONSIBLE_LABELS,
  COLOR_RESPONSIBLES,
  UNASSIGNED_RESPONSIBLE_LABEL,
} from './filters.ts'
import { normKey } from './normalizer.ts'
import type { ColorResponsible } from './types.ts'

/**
 * Atribuicao do processo a uma pessoa da equipe, pelo IMPORTADOR, com a cor da
 * linha desempatando o que a lista de importadores nao alcanca.
 *
 * Funcao PURA: recebe o mapa ja carregado (ADR-0006).
 *
 * **As duas fontes concordam nas 649 linhas, e e isso que autoriza o
 * desempate.** Medido em 31/08/2026 (docs/uso/RESULTADO.md §3): roxo ocorre
 * exclusivamente em importador de uma pessoa, azul e bege exclusivamente em
 * importador da outra, e nao ha uma unica contradicao. Sem essa medicao, usar a
 * cor como segunda fonte seria supor que ela concorda — aqui ela foi verificada.
 *
 * **A regra inviolavel 4 nao e tocada.** A cor ja codifica responsavel desde
 * TD-05; este modulo le o que ela diz sobre RESPONSAVEL, e nunca sobre status.
 *
 * **Nao atribuir e resultado legitimo.** Medido: 42 processos nao tem importador
 * na lista nem cor de responsavel. Empurra-los para alguem produziria um numero
 * plausivel e errado (regra inviolavel 3).
 */

export interface TeamMember {
  /**
   * Chave impessoal do membro. Nome de pessoa vive no `label`, que sai de
   * arquivo nao versionado — regra inviolavel 8, a mesma que mantem nome de
   * cliente fora do log e que ja fez `Responsible` nascer impessoal.
   */
  key: string
  label: string
  /** Chaves de importador desta pessoa, ja normalizadas na carga. */
  importers: readonly string[]
  /** Cores de responsavel que apontam para ela, no desempate. */
  colorResponsible: readonly ColorResponsible[]
  /**
   * Recebe todo importador que nenhuma outra lista reivindica.
   *
   * No maximo um membro pode declara-lo — dois seriam uma ordem de avaliacao
   * disfarcada de conjunto, e a carga recusa. Com um `fallback` ativo o
   * desempate por cor nunca roda, porque nao sobra caso: e uma escolha entre
   * cobrir tudo e enxergar o que nao se sabe, e ela e do operador.
   */
  fallback?: boolean
}

export type TeamSource = 'importador' | 'cor' | 'nenhum'

export interface TeamResolution {
  /** Vazia quando nao ha atribuicao. Chave vazia e valor de dominio, nao ausencia. */
  key: string
  label: string
  source: TeamSource
  /**
   * O importador aponta uma pessoa e a cor aponta outra.
   *
   * O importador vence, e a divergencia sobe para virar anomalia visivel.
   * Medido: ZERO ocorrencias em 31/08/2026 — e e exatamente por isso que o
   * campo precisa existir antes da primeira, que ninguem veria acontecer.
   */
  conflict: boolean
}

const UNASSIGNED: TeamResolution = { key: '', label: '', source: 'nenhum', conflict: false }

/**
 * Casa o importador com uma entrada da lista, tolerando sufixo de filial.
 *
 * Medido: tres importadores aparecem tambem com sufixo apos ` - `
 * (docs/uso/RESULTADO.md §3). A filial e o mesmo importador para efeito de
 * responsavel, e exigir que o operador liste as duas grafias transformaria uma
 * filial nova num processo sem dono, em silencio.
 *
 * O separador e literal, nao heuristico: `startsWith(valor)` sozinho casaria
 * `SUR` com `SURLA`, que sao importadores diferentes na planilha real.
 */
function ownsImporter(member: TeamMember, importerKey: string): boolean {
  return member.importers.some(
    (owned) => importerKey === owned || importerKey.startsWith(`${owned} - `),
  )
}

/**
 * A pessoa responsavel pelo processo.
 *
 * Ordem de avaliacao, e ela e obrigatoria:
 *
 * 0. Mapa VAZIO — a cor bruta, sem membro nenhum. Ver abaixo.
 * 1. Importador declarado na lista de alguem.
 * 2. Membro marcado como `fallback`, se houver e o importador nao for vazio.
 * 3. Cor da linha, quando ela aponta um membro — o desempate de §3.
 * 4. Nada.
 *
 * A regra 2 exclui o importador VAZIO de proposito. "Todo o resto" e uma
 * afirmacao sobre importadores que existem; 35 linhas sem importador nao sao o
 * resto de nada, e varre-las para uma pessoa esconderia que o campo esta em
 * branco — que e informacao sobre a planilha (regra inviolavel 2).
 *
 * **A regra 0 e `D-23`, e ela nao e caso particular da 3.** Sem membros, a
 * regra 3 nao tem em quem casar e devolveria `UNASSIGNED` nas 649 linhas — o
 * campo Responsavel ficaria vazio na primeira execucao, que e o estado com que
 * o operador recebe a aplicacao (o arquivo esta no `.gitignore`). Devolver a
 * propria chave de cor mantem os 157 preenchidos de antes de `H-50`, e o
 * `source: 'cor'` diz de onde vieram.
 */
export function resolveTeam(
  importerKey: string,
  colorResponsible: ColorResponsible,
  map: readonly TeamMember[],
): TeamResolution {
  if (map.length === 0) {
    return {
      key: colorResponsible,
      label: COLOR_RESPONSIBLE_LABELS[colorResponsible],
      source: 'cor',
      conflict: false,
    }
  }

  const byImporter = map.find((member) => ownsImporter(member, importerKey))
  const byColor = map.find((member) => member.colorResponsible.includes(colorResponsible))

  if (byImporter) {
    return {
      key: byImporter.key,
      label: byImporter.label,
      source: 'importador',
      conflict: byColor !== undefined && byColor.key !== byImporter.key,
    }
  }

  const fallback = importerKey === '' ? undefined : map.find((member) => member.fallback === true)
  if (fallback) {
    return { key: fallback.key, label: fallback.label, source: 'importador', conflict: false }
  }

  if (byColor) {
    return { key: byColor.key, label: byColor.label, source: 'cor', conflict: false }
  }
  return UNASSIGNED
}

/**
 * Todas as chaves que `resolveTeam` pode devolver, com o rotulo de cada uma.
 *
 * Existe para o ranking de IND-20 e para a rota de opcoes exibirem a chave
 * ZERADA: pessoa declarada no mapa e sem processo algum aparece, pela mesma
 * razao de A-28. Derivar as chaves dos processos carregados faria essa pessoa
 * sumir da tela, e o operador leria a ausencia como "nao existe" em vez de
 * "nao tem processo".
 *
 * Sem mapa, o dominio e o das cores — e o estado de `D-23`, onde `responsible`
 * carrega a chave de cor. Com mapa, e o dos membros mais a chave vazia.
 */
export function knownResponsibles(map: readonly TeamMember[]): { key: string; label: string }[] {
  if (map.length === 0) {
    return COLOR_RESPONSIBLES.map((key) => ({ key, label: COLOR_RESPONSIBLE_LABELS[key] }))
  }
  return [
    ...map.map((member) => ({ key: member.key, label: member.label })),
    { key: '', label: UNASSIGNED_RESPONSIBLE_LABEL },
  ]
}

/** Normaliza as chaves de importador UMA vez, na carga. O `label` nao passa. */
export function normalizeTeamMap(members: readonly TeamMember[]): TeamMember[] {
  return members.map((member) => ({
    key: member.key,
    label: member.label,
    importers: member.importers.map(normKey),
    colorResponsible: member.colorResponsible,
    ...(member.fallback === undefined ? {} : { fallback: member.fallback }),
  }))
}
