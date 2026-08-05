#!/usr/bin/env bash
# ConfigChange — avisa quando existe skill ou hook que o CLAUDE.md nao menciona.
#
# Falha ABERTO de proposito: sai sempre com 0. Um ConfigChange com exit 2
# reverteria a mudanca de configuracao, e travar o trabalho porque a
# documentacao esta atrasada inverte a prioridade. E o oposto do
# guard-dados-sensiveis.sh, que falha fechado porque la o dano e publicar
# dado de cliente.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f CLAUDE.md ] || exit 0

missing=""

for skill_dir in .claude/skills/*/; do
  [ -d "$skill_dir" ] || continue
  name=$(basename "$skill_dir")
  grep -q -- "/$name" CLAUDE.md || missing="$missing /$name"
done

for hook_file in .claude/hooks/*.sh; do
  [ -f "$hook_file" ] || continue
  name=$(basename "$hook_file")
  grep -q -- "$name" CLAUDE.md || missing="$missing $name"
done

[ -n "$missing" ] || exit 0

printf '{"systemMessage":"CLAUDE.md nao menciona:%s — atualize o bloco ## Infraestrutura de agente."}\n' "$missing"
exit 0
