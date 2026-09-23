#!/usr/bin/env bash
# PostToolUse(Bash) — avisa quando a branch `distribuicao` ficou para tras da
# `main` depois de um merge.
#
# O gatilho e `git pull`, `git merge` ou `git fetch` COM A MAIN EM HEAD, porque
# a distribuicao se sincroniza APENAS a partir da `main` mesclada — regra em
# `.claude/rules/distribuicao.md` e no bloco "A branch distribuicao" do
# CLAUDE.md. Rodar o `scripts/sincronizar-distribuicao.ts` depois disso depende
# de alguem lembrar, e a consequencia de esquecer nao aparece aqui: aparece na
# maquina do operador, que continua rodando a versao anterior sem nenhum sinal
# de que ha correcao pronta.
#
# Nasceu da regra que o proprio CLAUDE.md ja declarava para o gatilho de commit:
# "e instrucao, e instrucao falha. Se falhar seguido, o gatilho vira hook
# PostToolUse". Aqui a instrucao foi antecipada a pedido, em 31/08/2026, porque
# o passo 7 responde "nada a fazer" na maioria das vezes — e gatilho que quase
# sempre nao faz nada e exatamente o que se para de executar.
#
# NAO sincroniza, NAO commita e NAO empurra. So mede e avisa: sincronizar troca
# de branch e mexe no indice, e um hook que faz isso sozinho depois de um
# comando qualquer e como o operador descobre que perdeu trabalho.
#
# Falha ABERTO — sai 0 quando falta `jq`, falta `node`, falta a branch local ou
# o script nao existe. O trabalho nao para porque a conferencia nao pode rodar;
# o proposito e lembrar, e um lembrete que bloqueia vira um lembrete desligado.
# E o oposto do guard-dados-sensiveis.sh, que falha fechado porque la o dano e
# publicar dado de cliente.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

command -v jq >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0

entrada=$(cat)
comando=$(printf '%s' "$entrada" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$comando" ] || exit 0

# O filtro barato vem PRIMEIRO: o hook roda em todo Bash da sessao, e o script
# de conferencia le uma arvore inteira de imports. Sem este recorte, cada `ls`
# pagaria por ele.
# `fetch` entrou em 23/09/2026, por /avaliar-claude: este repositorio mescla NO
# GITHUB, entao `pull` e `merge` quase nao acontecem aqui — a `main` local
# alcanca por `fetch`. Sem ele o hook nao disparou uma vez em toda a sessao do
# PR #145, e a distribuicao ficou 14 arquivos atras sem aviso.
#
# DOIS LIMITES, e o segundo e estrutural. Nenhum PostToolUse ve o terminal do
# usuario — mesmo limite que o CLAUDE.md declara para o PreToolUse. E o
# casamento e na STRING do comando, nao no que o git fez: um comando que apenas
# MENCIONE `git pull` dispara. Medido no dia, por acidente, num laco de teste
# que nao rodou git nenhum. O falso positivo e barato — avisa de uma condicao
# que ou e verdadeira, ou sai em zero divergencia.
printf '%s' "$comando" | grep -qE '\bgit\s+(pull|merge|fetch)\b' || exit 0

# So com a `main` em HEAD. Um `git pull` numa branch de historia nao muda o que
# o operador deveria estar rodando.
[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] || exit 0

git rev-parse --verify --quiet distribuicao >/dev/null 2>&1 || exit 0
[ -f scripts/sincronizar-distribuicao.ts ] || exit 0

# A atribuicao dentro do `if` captura o codigo de saida do proprio `node`.
# Separar em duas linhas e consultar `$?` depois funciona por acidente e quebra
# no dia em que alguem inserir um comando entre elas.
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
