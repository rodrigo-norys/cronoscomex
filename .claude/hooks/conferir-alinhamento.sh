#!/usr/bin/env bash
# ConfigChange — avisa quando o CLAUDE.md e a estrutura .claude/ saem de
# sincronia, nas duas direcoes:
#
#   1. existe skill, subagente ou hook que o CLAUDE.md nao MENCIONA;
#   2. existe skill ou subagente JA CRIADO cujo gatilho na tabela
#      "## Marcos de tooling" continua em aberto, sem o risco de cumprido.
#
# A segunda checagem nasceu de um defeito real: `/nova-pagina` foi criada em
# 07/08/2026, ao fechar `H-20`, e a linha que mandava cria-la seguiu dizendo
# "criar" por quatro dias. A checagem 1 saia 0 o tempo todo, porque a skill
# ESTAVA mencionada — no bloco de infraestrutura, e nao na tabela de marcos.
# Mencionar e marcar sao coisas diferentes, e so a primeira era verificada.
#
# Uma linha e considerada cumprida quando comeca com `| ~~`, que e a convencao
# de risco da tabela. Teste textual, nao julgamento: ou o nome aparece numa
# linha aberta, ou nao aparece.
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
