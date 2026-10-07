#!/usr/bin/env bash
# InstructionsLoaded — uma linha por arquivo de instrucao que entra em contexto:
# quando, POR QUE (`load_reason`), qual, e a sessao. Nao imprime nada.
#
# Como ler: rule com `paths:` aparece como `path_glob_match`; se aparecer sempre
# como `session_start`, o `paths:` foi ignorado e ela custa contexto em toda
# sessao. O limite: o log mostra o que CARREGOU, nunca o que deveria ter
# carregado e nao carregou — essa falta so aparece nas transcricoes (`D-71`).
#
# Grava em .claude/local/, gitignored, e nao em data/, que e estado do operador
# (`D-73`). Sem assercao em tests/repo/: o arquivo e local, e o CI nao o tem.
#
# Falha ABERTO, e aqui isso e critico: neste evento `exit 2` IMPEDE a instrucao
# de carregar, e a sessao rodaria sem as regras inviolaveis, em silencio. Por
# isso nao ha `set -e`, todo comando tolera falha, e o `exit 0` no fim e explicito.

set -u

LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/local/instrucoes-carregadas.log"
MAX_LINHAS=5000

registrar() {
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || return 0

  # Acima do limite, corta a metade mais antiga: o arquivo fica limitado sem
  # perder a serie recente.
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
  # Sem jq, recorte simples: medir menos e melhor que travar a instrucao.
  motivo=$(printf '%s' "$payload" | grep -o '"load_reason"[^,}]*' | head -1 | cut -d'"' -f4)
  arquivo=$(printf '%s' "$payload" | grep -o '"file_path"[^,}]*' | head -1 | cut -d'"' -f4)
  sessao=$(printf '%s' "$payload" | grep -o '"session_id"[^,}]*' | head -1 | cut -d'"' -f4)
fi

# Caminho relativo a raiz: o absoluto carregaria o nome de usuario do SO (regra
# inviolavel 8). O que vem de fora do projeto — o CLAUDE.md global, o MEMORY.md
# do harness — vira o marcador <externo>/<arquivo>, e nao caminho redigido: o
# nome de usuario aparece tambem no meio do caminho do harness. Sem `$HOME` de
# proposito: com `set -u`, variavel desassociada abortaria o hook. O `%/` cobre
# CLAUDE_PROJECT_DIR com barra final, que sem ele faria todo caminho sair absoluto.
raiz="${CLAUDE_PROJECT_DIR:-}"
relativo="$arquivo"
[ -n "$raiz" ] && relativo="${arquivo#"${raiz%/}"/}"
case "$relativo" in
  /*) arquivo="<externo>/$(basename "$relativo")" ;;
  *)  arquivo="$relativo" ;;
esac

registrar "$(date -u '+%Y-%m-%dT%H:%MZ')" "${motivo:-?}" "${arquivo:-?}" "${sessao:0:8}"

exit 0
