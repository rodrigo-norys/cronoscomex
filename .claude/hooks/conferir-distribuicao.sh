#!/usr/bin/env bash
# PostToolUse(Bash) — avisa quando a branch `distribuicao` ficou para tras da
# `main`, depois de `git pull`, `git merge` ou `git fetch` com a `main` em HEAD.
# A distribuicao so se sincroniza a partir da `main` mesclada
# (`.claude/rules/distribuicao.md`), e esquecer so aparece na maquina do
# operador, que segue na versao anterior sem sinal nenhum.
#
# NAO sincroniza, NAO commita e NAO empurra: sincronizar troca de branch e mexe
# no indice, e isso nao pode acontecer sozinho depois de um comando qualquer.
#
# Falha ABERTO — sai 0 sem `jq`, sem `node`, sem a branch local ou sem o
# script: um lembrete que bloqueia vira um lembrete desligado.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

command -v jq >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0

entrada=$(cat)
comando=$(printf '%s' "$entrada" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$comando" ] || exit 0

# O filtro barato vem PRIMEIRO: o hook roda em todo Bash da sessao, e o script
# de conferencia le uma arvore inteira de imports. `fetch` entra porque aqui o
# merge e no GitHub, e a `main` local alcanca por `fetch`.
#
# Dois limites: nenhum PostToolUse ve o terminal do usuario, e o casamento e na
# STRING do comando — um comando que apenas MENCIONE `git pull` dispara. O falso
# positivo e barato: ou a condicao e verdadeira, ou sai em zero divergencia.
printf '%s' "$comando" | grep -qE '\bgit\s+(pull|merge|fetch)\b' || exit 0

# So com a `main` em HEAD. Um `git pull` numa branch de historia nao muda o que
# o operador deveria estar rodando.
[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] || exit 0

git rev-parse --verify --quiet distribuicao >/dev/null 2>&1 || exit 0
[ -f scripts/sincronizar-distribuicao.ts ] || exit 0

if saida=$(node --experimental-strip-types scripts/sincronizar-distribuicao.ts 2>&1); then
  exit 0
fi

# exit 2 e o canal do PostToolUse para devolver texto ao Claude. A acao ja
# aconteceu — nada e revertido; o que este codigo faz e garantir que o aviso
# seja lido em vez de virar uma linha de stdout que ninguem olha.
{
  echo "A branch 'distribuicao' esta defasada em relacao a main."
  echo
  echo "$saida"
  echo "O comando acima prepara o indice e para: o commit e o push da branch"
  echo "'distribuicao' continuam sendo decisao de quem esta olhando. O"
  echo "procedimento inteiro esta em .claude/rules/distribuicao.md."
} >&2
exit 2
