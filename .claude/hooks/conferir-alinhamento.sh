#!/usr/bin/env bash
# ConfigChange — avisa quando o CLAUDE.md e a estrutura .claude/ saem de
# sincronia, nas duas direcoes:
#
#   1. existe skill, subagente, hook ou rule que o CLAUDE.md nao MENCIONA;
#   2. existe skill ou subagente JA CRIADO cujo gatilho na tabela
#      "## Marcos de tooling" continua em aberto, sem o risco de cumprido.
#
# Mencionar e marcar sao coisas diferentes: uma skill citada no bloco de
# infraestrutura passa na checagem 1 com o gatilho dela ainda mandando criar.
#
# O aviso e OPORTUNISTA: o matcher e "project_settings|skills", entao criar
# arquivo em .claude/rules/ ou .claude/hooks/ nao o dispara. Quem garante em
# todo commit e tests/repo/contratos.test.ts.
#
# Falha ABERTO, sempre com 0: um ConfigChange com exit 2 reverteria a mudanca
# de configuracao, e documentacao atrasada nao justifica travar o trabalho.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f CLAUDE.md ] || exit 0

missing=""
criados=""

for skill_dir in .claude/skills/*/; do
  [ -d "$skill_dir" ] || continue
  name=$(basename "$skill_dir")
  criados="$criados $name"
  grep -q -- "/$name" CLAUDE.md || missing="$missing /$name"
done

for agent_file in .claude/agents/*.md; do
  [ -f "$agent_file" ] || continue
  name=$(basename "$agent_file" .md)
  criados="$criados $name"
  grep -q -- "$name" CLAUDE.md || missing="$missing $name"
done

for hook_file in .claude/hooks/*.sh; do
  [ -f "$hook_file" ] || continue
  name=$(basename "$hook_file")
  grep -q -- "$name" CLAUDE.md || missing="$missing $name"
done

# Rule NAO alimenta `criados`: a checagem 2 e sobre a tabela de marcos, e rule
# nao tem linha la.
for rule_file in .claude/rules/*.md; do
  [ -f "$rule_file" ] || continue
  name=$(basename "$rule_file")
  grep -q -- "$name" CLAUDE.md || missing="$missing $name"
done

# A tabela de marcos, isolada: do titulo dela ate o proximo titulo de nivel 2.
marcos=$(awk '/^## Marcos de tooling/ { dentro = 1; next }
              /^## /                 { dentro = 0 }
              dentro' CLAUDE.md)

naomarcados=""
for name in $criados; do
  # Linha de tabela que cita o nome e NAO comeca com `| ~~`: gatilho em aberto
  # para peca que ja existe.
  printf '%s\n' "$marcos" | grep -F -- "$name" | grep -q '^| [^~]' &&
    naomarcados="$naomarcados $name"
done

aviso=""
[ -n "$missing" ] &&
  aviso="CLAUDE.md nao menciona:$missing — atualize o bloco ## Infraestrutura de agente."
[ -n "$naomarcados" ] &&
  aviso="$aviso${aviso:+ }Gatilho ja cumprido e ainda em aberto na tabela ## Marcos de tooling:$naomarcados — risque a linha e registre a data de criacao."

[ -n "$aviso" ] || exit 0

printf '{"systemMessage":"%s"}\n' "$aviso"
exit 0
