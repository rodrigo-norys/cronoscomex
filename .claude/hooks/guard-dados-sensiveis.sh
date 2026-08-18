#!/usr/bin/env bash
# PreToolUse/Bash — bloqueia, antes da execucao, comandos que podem publicar
# dado real, sobrescrever caminho protegido ou destruir trabalho.
#
# Fecha o que regra de permissao nao alcanca: staging forcado, redirecionamento
# de saida, 'git diff --output=', remocao recursiva e o perfilador gravando
# dentro do repositorio.
#
# Falha FECHADO: sem jq ou com entrada ilegivel, bloqueia em vez de liberar.
# Um bloqueio falso custa redigitar um comando; uma passagem falsa publica
# dado de cliente.

set -uo pipefail

block() {
  echo "BLOQUEADO por guard-dados-sensiveis: $1" >&2
  echo "Se a acao for mesmo necessaria, execute-a voce mesmo no terminal." >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || block "jq ausente — o guard nao pode inspecionar o comando."

payload=$(cat)
full_command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) \
  || block "entrada do hook ilegivel."

[ -n "$full_command" ] || exit 0

# Os testes rodam por subcomando, nao sobre a string inteira. Sem isso um
# `grep "git add" arquivo` casaria como se fosse staging real. Os separadores
# sao os mesmos que o Claude Code reconhece ao avaliar regras de permissao.
split_subcommands() {
  printf '%s\n' "$1" | sed -E 's/(\&\&|\|\||;|\|)/\n/g'
}

check_git_add() {
  local subcommand="$1"
  case "$subcommand" in
    "git add"*) ;;
    *) return 0 ;;
  esac

  case " $subcommand " in
    *" -f "*|*" --force"*)
      block "'git add' com --force anula o .gitignore e leva dado real ao historico." ;;
    *" -A "*|*" --all "*|*" . "*)
      block "'git add' em massa. Adicione caminho a caminho, para que a lista seja revisavel." ;;
  esac

  # Testa CAMINHO A CAMINHO, e nao a linha inteira: a excecao de fixture precisa
  # valer para o caminho que a satisfaz sem liberar os outros argumentos do mesmo
  # comando. Caminho com espaco quebra em varios tokens e cai no bloqueio — falha
  # fechado, que e a direcao certa.
  local path
  for path in ${subcommand#git add}; do
    # Travessia anula a excecao: em `case`, `*` atravessa `/`, entao
    # `tests/fixtures/../CONTROLE.xlsx` casaria o glob da fixture.
    case "$path" in
      *..*) block "'git add' com travessia de diretorio: $path" ;;
    esac

    # A mesma excecao que .github/scripts/verifica-dados-sensiveis.sh ja faz:
    # planilha DENTRO de tests/fixtures/ e versionada por exigencia da regra 7 —
    # sao 8 hoje. Sem isto as duas camadas se contradizem, e a que bloqueia e a
    # que nao vale: o CI e quem roda em todo commit.
    case "$path" in
      tests/fixtures/*.xlsx) continue ;;
    esac

    # Mesma razao da excecao acima, e mesmo modo de falha: `config/app.json.exemplo`
    # e VERSIONADO desde o primeiro commit — quem carrega caminho local e
    # `config/app.json`, que o `.gitignore` cobre. O glob abaixo tem `*` nas duas
    # pontas, entao o exemplo casava e o guard recusava `git add` de arquivo que o
    # repositorio ja rastreia. Medido em `H-30`, ao atualizar o exemplo.
    #
    # De novo era ESTA a camada divergente: verifica-dados-sensiveis.sh casa
    # `config/app.json` com `grep -xE`, exato, e nunca barrou o exemplo. O guard
    # que bloqueia sozinho e o guard que nao vale — o CI e quem roda em todo commit.
    case "$path" in
      config/app.json.exemplo) continue ;;
    esac

    case "$path" in
      *.xlsx*|*.jpeg*|*"config/app.json"*|*"data/"*)
        block "'git add' apontando para artefato com dado real ou configuracao local: $path" ;;
    esac
  done
}

check_redirect() {
  local subcommand="$1"

  # Testa o ALVO do redirecionamento, nao a linha inteira: um `2>/dev/null` em
  # comando que apenas mencione .claude/ nao e escrita em caminho protegido.
  local targets
  targets=$(printf '%s' "$subcommand" \
    | grep -oE '[0-9]*>>?[[:space:]]*[^[:space:];|&<>]+' \
    | sed -E 's/^[0-9]*>>?[[:space:]]*//')
  [ -n "$targets" ] || return 0

  while IFS= read -r target; do
    [ -n "$target" ] || continue
    case "$target" in
      *"config/"*|*"data/"*|*.xlsx|*.jpeg|*"docs/perfilamento"*|*".claude/"*)
        block "redirecionamento de saida para caminho protegido: $target" ;;
    esac
  done <<EOF
$targets
EOF
}

check_git_diff_output() {
  case "$1" in
    "git diff"*"--output"*)
      block "'git diff --output=' escreve arquivo sob um comando de aparencia somente-leitura." ;;
  esac
}

check_recursive_remove() {
  local subcommand="$1"
  case "$subcommand" in
    "rm "*) ;;
    *) return 0 ;;
  esac

  case " $subcommand " in
    *" -rf "*|*" -fr "*|*" -r "*|*" -R "*|*" --recursive "*) ;;
    *) return 0 ;;
  esac

  case "$subcommand" in
    *src/*|*tests/*|*docs/*|*config/*|*web/*|*tools/*|*".claude"*)
      block "remocao recursiva em diretorio versionavel do projeto." ;;
  esac
}

check_profiler() {
  local subcommand="$1"
  case "$subcommand" in
    *"profile_workbook.py"*) ;;
    *) return 0 ;;
  esac

  case "$subcommand" in
    *" /tmp/"*) return 0 ;;
  esac

  block "perfilador com destino fora de /tmp: a saida traz amostras de celula das quatro abas, inclusive CNPJ. Grave em /tmp, sanitize, e so entao mova."
}

while IFS= read -r raw_subcommand; do
  subcommand=$(printf '%s' "$raw_subcommand" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/[[:space:]]+/ /g')
  [ -n "$subcommand" ] || continue

  check_git_add "$subcommand"
  check_redirect "$subcommand"
  check_git_diff_output "$subcommand"
  check_recursive_remove "$subcommand"
  check_profiler "$subcommand"
done < <(split_subcommands "$full_command")

exit 0
