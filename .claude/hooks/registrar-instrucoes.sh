#!/usr/bin/env bash
# InstructionsLoaded — uma linha por arquivo de instrucao que entra em contexto:
# quando, POR QUE, e qual. Nao imprime nada; o log e para leitura posterior.
#
# Existe porque em 31/08/2026 ~1750 palavras do CLAUDE.md migraram para tres
# rules novas, e nada prova que elas disparam. Rule que nunca carrega nao
# economizou contexto: ESCONDEU a instrucao, e o efeito so aparece longe de quem
# poderia consertar — o mesmo modo de falha de tests/repo/distribuicao.test.ts.
#
# O campo que importa e o `load_reason`, nao o nome do arquivo. Uma rule com
# `paths:` deve aparecer como `path_glob_match`. Se aparecer sempre como
# `session_start`, o `paths:` esta sendo ignorado e ela custa contexto em TODA
# sessao — o oposto do que a migracao pretendia.
#
# GATILHO DE REAVALIACAO, declarado: ao acumular 20 `session_id` distintos,
# conferir o log. Rule que nunca apareceu com `path_glob_match` ou volta para o
# CLAUDE.md, ou tem o glob consertado. Se as cinco dispararem, isto vira so
# observabilidade. Nao virou assercao em tests/repo/ de proposito: dependeria de
# arquivo em data/, que e gitignored, e foi assim que o CI reprovou em `H-49`.
#
# Falha ABERTO, e aqui isso e mais grave que nos outros hooks: neste evento
# `exit 2` BLOQUEIA o arquivo de instrucao de carregar. Um exit acidental
# rodaria a sessao inteira sem as regras inviolaveis, em silencio. Por isso:
# sem `set -e`, todo comando tolera falha, e `exit 0` explicito no fim.

set -u

LOG="${CLAUDE_PROJECT_DIR:-.}/data/instrucoes-carregadas.log"
MAX_LINHAS=5000

registrar() {
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || return 0

  # Truncagem por corte da metade mais antiga: mantem o arquivo limitado sem
  # perder a serie inteira, que e o que a comparacao entre sessoes precisa.
  if [ -f "$LOG" ]; then
    local total
    total=$(wc -l < "$LOG" 2>/dev/null || echo 0)
    if [ "$total" -gt "$MAX_LINHAS" ]; then
      tail -n $((MAX_LINHAS / 2)) "$LOG" > "$LOG.tmp" 2>/dev/null &&
        mv "$LOG.tmp" "$LOG" 2>/dev/null
    fi
  fi

  printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" >> "$LOG" 2>/dev/null
}

payload=$(cat 2>/dev/null || printf '')
[ -n "$payload" ] || exit 0

if command -v jq >/dev/null 2>&1; then
  motivo=$(printf '%s' "$payload" | jq -r '.load_reason // "?"' 2>/dev/null || printf '?')
  arquivo=$(printf '%s' "$payload" | jq -r '.file_path // "?"' 2>/dev/null || printf '?')
  sessao=$(printf '%s' "$payload" | jq -r '.session_id // "?"' 2>/dev/null || printf '?')
else
  # Sem jq o hook continua util: o motivo e o arquivo saem por recorte simples.
  # Nao bloqueia nem reclama — medir e o objetivo, e medir menos e melhor que
  # travar o carregamento de uma instrucao.
  motivo=$(printf '%s' "$payload" | grep -o '"load_reason"[^,}]*' | head -1 | cut -d'"' -f4)
  arquivo=$(printf '%s' "$payload" | grep -o '"file_path"[^,}]*' | head -1 | cut -d'"' -f4)
  sessao=$(printf '%s' "$payload" | grep -o '"session_id"[^,}]*' | head -1 | cut -d'"' -f4)
fi

# O caminho vai relativo a raiz: absoluto carregaria o nome de usuario do SO
# para um arquivo que alguem pode colar num relatorio (regra inviolavel 8).
#
# A remocao de prefixo so alcanca instrucao DENTRO do projeto. O CLAUDE.md
# global e o MEMORY.md do harness vem de fora e entravam absolutos, com o nome
# do usuario — medido em 02/09/2026, e o do MEMORY.md o traz DUAS vezes, porque
# o diretorio de projeto do harness e o caminho absoluto com `/` virando `-`.
# Por isso o que nao perdeu o prefixo vira marcador, e nao caminho redigido:
# redigir so o prefixo deixaria o nome no meio do segmento. `$HOME` fica fora de
# proposito — `set -u` esta ativo, e referenciar variavel desassociada abortaria
# o hook, que neste evento roda a sessao sem as regras inviolaveis.
#
# O `%/` cobre CLAUDE_PROJECT_DIR com barra final: sem ele o corte procura `//`,
# nao casa nada, e TODO caminho passa a ser gravado absoluto.
raiz="${CLAUDE_PROJECT_DIR:-}"
relativo="$arquivo"
[ -n "$raiz" ] && relativo="${arquivo#"${raiz%/}"/}"
case "$relativo" in
  /*) arquivo="<externo>/$(basename "$relativo")" ;;
  *)  arquivo="$relativo" ;;
esac

registrar "$(date -u '+%Y-%m-%dT%H:%MZ')" "${motivo:-?}" "${arquivo:-?}" "${sessao:0:8}"

exit 0
