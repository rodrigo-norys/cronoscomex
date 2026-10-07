#!/usr/bin/env bash
# PreToolUse/Bash — bloqueia, antes da execucao, comandos que podem publicar
# dado real, sobrescrever caminho protegido, destruir trabalho ou ler data/.
#
# Fecha o que regra de permissao nao alcanca: staging forcado, redirecionamento
# de saida, 'git diff --output=', remocao recursiva, o perfilador gravando
# dentro do repositorio e o acesso a data/ pelo shell (D-74).
#
# E impoe, em QUALQUER forma, as negacoes de git que o settings.json declara
# por prefixo: `Bash(git push --force *)` nao alcanca `git push origin x
# --force`, `-uf` nem `+x`, e o allow de `git push *` os libera sem prompt. O
# comando e tokenizado, o que vem antes do `git` sem mudar o que ele faz sai da
# frente, grupo de opcao curta e lido letra a letra e opcao longa casa por
# prefixo, como o proprio git as le.
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
# O `&` de segundo plano entra tambem: `sleep 1 & git push -f` roda o push.
split_subcommands() {
  printf '%s\n' "$1" | sed -E 's/(\&\&|\|\||;|\||[[:space:]]&([[:space:]]|$))/\n/g'
}

check_git_add() {
  parse_arguments "" "--chmod --pathspec-from-file" ${1+"$@"}

  if has_short "f" "" || has_long --force; then
    block "'git add' com --force anula o .gitignore e leva dado real ao historico."
  fi
  if has_short "A" "" || has_long --all; then
    block "'git add' em massa. Adicione caminho a caminho, para que a lista seja revisavel."
  fi
  if has_long --pathspec-from-file; then
    block "'git add --pathspec-from-file' tira a lista de caminhos do comando, e o guard nao a le."
  fi

  # Testa CAMINHO A CAMINHO: a excecao de fixture vale para o caminho que a
  # satisfaz, sem liberar os outros argumentos. Caminho com espaco quebra em
  # varios tokens e cai no bloqueio — falha fechado.
  local path
  for path in ${positionals[@]+"${positionals[@]}"}; do
    case "$path" in
      .|./|'*'|:/*|:\(*)
        block "'git add' em massa. Adicione caminho a caminho, para que a lista seja revisavel." ;;
    esac

    # Travessia anula a excecao: em `case`, `*` atravessa `/`, entao
    # `tests/fixtures/../CONTROLE.xlsx` casaria o glob da fixture.
    case "$path" in
      *..*) block "'git add' com travessia de diretorio: $path" ;;
    esac

    # Planilha DENTRO de tests/fixtures/ e versionada (regra 7), e o CI faz a
    # mesma excecao. Ela e por CAMINHO: quem olha DENTRO das fixtures e
    # tests/repo/fixtures-anonimas.test.ts.
    case "$path" in
      tests/fixtures/*.xlsx) continue ;;
    esac

    # Os tres `.exemplo` de config/ sao versionados, e o CI casa o nome exato.
    # Os globs abaixo tem `*` nas duas pontas, entao cada um casaria o seu par.
    case "$path" in
      config/app.json.exemplo) continue ;;
      config/client-map.json.exemplo) continue ;;
      config/team-map.json.exemplo) continue ;;
    esac

    # Os mapas de negocio trazem nome real de cliente e de pessoa (regra 8), e a
    # aplicacao cria o client-map.json em qualquer maquina de desenvolvimento.
    case "$path" in
      *.xlsx*|*.jpeg*|*"config/app.json"*|*"config/client-map.json"*|*"config/team-map.json"*|*"data/"*)
        block "'git add' apontando para artefato com dado real ou configuracao local: $path" ;;
    esac
  done
}

# Tokeniza como o shell, sem executar nada: o xargs respeita aspas e barra
# invertida e nao expande `$(...)` nem crase. Aspa sem par faz o xargs falhar,
# e a segunda leitura divide por espaco depois de tirar as aspas — nunca menos
# estrita que a primeira para flag, que e o que o guard procura.
tokenize() {
  local tokens
  if tokens=$(printf '%s\n' "$1" | xargs printf '%s\n' 2>/dev/null); then
    printf '%s\n' "$tokens"
  else
    printf '%s\n' "$1" | tr -d "\"'" | tr -s ' \t' '\n'
  fi
}

# Redirecionamento nao e argumento: `git push 2>/dev/null` nao tem um remoto
# chamado `2>/dev/null`.
drop_redirections() {
  local -a kept=()
  local word skip_next=0
  for word in ${words[@]+"${words[@]}"}; do
    if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
    case "$word" in
      '>'|'>>'|'<'|'<<'|'<<<'|'>|'|'&>'|'&>>'|[0-9]'>'|[0-9]'>>') skip_next=1 ;;
      '>'*|'<'*|'&>'*|[0-9]'>'*|[0-9]'<'*) ;;
      *) kept+=("$word") ;;
    esac
  done
  words=(${kept[@]+"${kept[@]}"})
}

# Pula o que vem antes do executavel sem mudar o que ele faz: atribuicao de
# variavel, palavra-chave do shell e os embrulhos que so repassam o comando.
find_executable() {
  local word
  start=0
  while [ "$start" -lt "${#words[@]}" ]; do
    word="${words[$start]}"
    case "$word" in
      [A-Za-z_]*=*|if|then|else|elif|do|while|until|'!'|command|exec|nohup|time|builtin)
        start=$((start + 1)) ;;
      env|nice|sudo|xargs|timeout)
        start=$((start + 1))
        skip_wrapper_options "$word" ;;
      *) return 0 ;;
    esac
  done
}

skip_wrapper_options() {
  local wrapper="$1" word
  while [ "$start" -lt "${#words[@]}" ]; do
    word="${words[$start]}"
    case "$wrapper:$word" in
      env:[A-Za-z_]*=*) start=$((start + 1)) ;;
      env:-u|env:-C|nice:-n|sudo:-u|sudo:-g|sudo:-C|sudo:-D|sudo:-h|sudo:-p|sudo:-r|sudo:-t|sudo:-U|timeout:-s|timeout:-k|xargs:-I|xargs:-n|xargs:-L|xargs:-P|xargs:-d|xargs:-a|xargs:-E|xargs:-s)
        start=$((start + 2)) ;;
      *:-*) start=$((start + 1)) ;;
      # A duracao do timeout e o unico posicional antes do comando.
      timeout:*) start=$((start + 1)); return 0 ;;
      *) return 0 ;;
    esac
  done
}

# Separa opcao de posicional. O que toma valor e declarado por subcomando: em
# `commit -m -n`, o `-n` e a mensagem, e nao a opcao.
parse_arguments() {
  local short_values="$1" long_values="$2" word rest letter expect_value=0
  shift 2
  options=()
  positionals=()
  saw_separator=0
  for word in ${1+"$@"}; do
    if [ "$expect_value" = 1 ]; then expect_value=0; continue; fi
    if [ "$saw_separator" = 1 ]; then positionals+=("$word"); continue; fi
    case "$word" in
      --) saw_separator=1 ;;
      --*=*) options+=("$word") ;;
      --*)
        options+=("$word")
        case " $long_values " in *" $word "*) expect_value=1 ;; esac ;;
      -?*)
        options+=("$word")
        rest="${word#-}"
        while [ -n "$rest" ]; do
          letter="${rest:0:1}"
          rest="${rest:1}"
          case "$short_values" in
            *"$letter"*) [ -n "$rest" ] || expect_value=1; break ;;
          esac
        done ;;
      *) positionals+=("$word") ;;
    esac
  done
}

# Grupo de opcao curta: `-uf` e `-u -f`. Para na primeira letra que toma valor,
# porque o resto do grupo e o valor dela — em `-mn`, o `n` e a mensagem.
short_group_has() {
  local rest letter
  case "$1" in --*|-) return 1 ;; -*) ;; *) return 1 ;; esac
  rest="${1#-}"
  while [ -n "$rest" ]; do
    letter="${rest:0:1}"
    rest="${rest:1}"
    case "$2" in *"$letter"*) return 0 ;; esac
    case "$3" in *"$letter"*) return 1 ;; esac
  done
  return 1
}

# Opcao longa abreviada: o git aceita prefixo unico — `--forc` e `--force`,
# `--mirr` e `--mirror`. Casa qualquer prefixo de duas letras ou mais; o
# prefixo ambiguo o proprio git recusa, entao barra-lo nao custa nada.
long_matches() {
  local token="${1%%=*}" option
  case "$token" in --??*) ;; *) return 1 ;; esac
  shift
  for option in "$@"; do
    case "$option" in "$token"*) return 0 ;; esac
  done
  return 1
}

has_short() {
  local option
  for option in ${options[@]+"${options[@]}"}; do
    short_group_has "$option" "$1" "$2" && return 0
  done
  return 1
}

has_long() {
  local option
  for option in ${options[@]+"${options[@]}"}; do
    long_matches "$option" "$@" && return 0
  done
  return 1
}

# `git -c` injeta configuracao so neste comando, e `core.fsmonitor`,
# `core.hooksPath`, `core.pager`, `diff.external` e `alias.*` transformam
# configuracao em execucao. Passa so o que muda apresentacao ou identidade.
check_git_override() {
  local key
  key=$(printf '%s' "${1%%=*}" | tr '[:upper:]' '[:lower:]')
  case "$key" in
    core.quotepath|color.*|advice.*|log.*|user.name|user.email|safe.directory|init.defaultbranch) return 0 ;;
  esac
  block "'git -c $key' injeta configuracao no comando; so passam as de apresentacao e identidade."
}

check_git() {
  local index=$((start + 1)) word subcommand
  local -a options=() positionals=() arguments=()
  local saw_separator=0

  # As opcoes globais saem da frente: `git -C . push -f` e `git -c x=y push -f`
  # sao o mesmo push.
  while [ "$index" -lt "${#words[@]}" ]; do
    word="${words[$index]}"
    case "$word" in
      -c|--config-env) check_git_override "${words[$((index + 1))]:-}"; index=$((index + 2)) ;;
      --config-env=*) check_git_override "${word#--config-env=}"; index=$((index + 1)) ;;
      -C|--git-dir|--work-tree|--namespace|--super-prefix) index=$((index + 2)) ;;
      -*) index=$((index + 1)) ;;
      *) break ;;
    esac
  done
  [ "$index" -lt "${#words[@]}" ] || return 0
  subcommand="${words[$index]}"
  arguments=("${words[@]:$((index + 1))}")

  case "$subcommand" in
    add|stage) check_git_add ${arguments[@]+"${arguments[@]}"} ;;
    push) check_git_push ${arguments[@]+"${arguments[@]}"} ;;
    commit) check_git_commit ${arguments[@]+"${arguments[@]}"} ;;
    branch) check_git_branch ${arguments[@]+"${arguments[@]}"} ;;
    switch) check_git_switch ${arguments[@]+"${arguments[@]}"} ;;
    checkout) check_git_checkout ${arguments[@]+"${arguments[@]}"} ;;
    restore) check_git_restore ${arguments[@]+"${arguments[@]}"} ;;
    reset) check_git_reset ${arguments[@]+"${arguments[@]}"} ;;
    pull) check_git_pull ${arguments[@]+"${arguments[@]}"} ;;
    config) check_git_config ${arguments[@]+"${arguments[@]}"} ;;
    clean) block "'git clean' apaga arquivo nao versionado sem volta." ;;
    rebase) block "'git rebase' reescreve historico." ;;
  esac
}

check_git_push() {
  parse_arguments "o" "--push-option --repo --receive-pack --exec" ${1+"$@"}

  if has_short "f" "o" || has_long --force --force-with-lease --force-if-includes; then
    block "'git push' forcado reescreve a branch remota."
  fi
  if has_long --mirror; then
    block "'git push --mirror' forca todas as refs e apaga as remotas sem par local."
  fi
  if has_short "d" "o" || has_long --delete; then
    block "'git push' apagando branch remota."
  fi
  if has_long --prune; then
    block "'git push --prune' apaga as branches remotas sem par local."
  fi

  # Remoto nomeado e o unico destino: URL, `usuario@host:caminho` e caminho de
  # disco publicam o historico onde ninguem revisa. Nome de remoto nao tem `:`,
  # `@` nem `/`.
  local option destination="${positionals[0]:-}" refspec
  for option in ${options[@]+"${options[@]}"}; do
    case "$option" in --repo=*) destination="${option#--repo=}" ;; esac
  done
  case "$destination" in
    *:*|*@*|*/*|.*|~*) block "'git push' para destino que nao e remoto nomeado: $destination" ;;
  esac

  for refspec in "${positionals[@]:1}"; do
    case "$refspec" in
      +*) block "'git push' com refspec '+' e push forcado: $refspec" ;;
      :*) block "'git push' com refspec vazio apaga a branch remota: $refspec" ;;
    esac
  done
}

check_git_commit() {
  parse_arguments "mFCct" "--message --file --reuse-message --reedit-message --template --author --date --fixup --squash --trailer --cleanup" ${1+"$@"}

  if has_long --amend; then
    block "'git commit --amend' reescreve historico."
  fi
  if has_short "n" "mFCct" || has_long --no-verify; then
    block "'git commit' sem verificacao pula os hooks do git."
  fi
}

check_git_branch() {
  parse_arguments "u" "--set-upstream-to --contains --no-contains --merged --no-merged --points-at --format --sort" ${1+"$@"}

  # `-D`, `-M` e `-C` sao as formas forcadas de apagar, renomear e copiar;
  # `-d -f` e `--delete --force` sao `-D`; `-f` sozinho move a branch.
  if has_short "DMCf" "u" || has_long --force; then
    block "'git branch' forcado apaga ou move branch, e os commits dela ficam orfaos."
  fi
}

check_git_switch() {
  parse_arguments "cC" "--create --force-create --orphan --conflict" ${1+"$@"}

  if has_short "fC" "cC" || has_long --force --discard-changes --force-create; then
    block "'git switch' forcado descarta mudanca nao commitada ou recria a branch."
  fi
}

check_git_checkout() {
  parse_arguments "bB" "--orphan --conflict" ${1+"$@"}

  if has_short "fB" "bB" || has_long --force; then
    block "'git checkout' forcado descarta mudanca nao commitada ou recria a branch."
  fi
  if [ "$saw_separator" = 1 ]; then
    block "'git checkout --' descarta mudanca nao commitada."
  fi
  local path
  for path in ${positionals[@]+"${positionals[@]}"}; do
    case "$path" in
      .|./*|:*) block "'git checkout' sobre caminho descarta mudanca nao commitada: $path" ;;
    esac
  done
}

check_git_restore() {
  parse_arguments "s" "--source --conflict --pathspec-from-file" ${1+"$@"}

  # So `--staged` e seguro: ele tira do indice. A arvore de trabalho e o que o
  # `restore` sobrescreve por padrao.
  if has_short "W" "s" || has_long --worktree; then
    block "'git restore --worktree' descarta mudanca nao commitada."
  fi
  if ! has_short "S" "s" && ! has_long --staged; then
    block "'git restore' fora de --staged descarta mudanca nao commitada."
  fi
}

check_git_reset() {
  parse_arguments "" "--pathspec-from-file" ${1+"$@"}

  if has_long --hard; then
    block "'git reset --hard' descarta mudanca nao commitada."
  fi
}

check_git_pull() {
  parse_arguments "sX" "--strategy --strategy-option --depth --deepen --shallow-since --shallow-exclude --upload-pack" ${1+"$@"}

  local option
  for option in ${options[@]+"${options[@]}"}; do
    case "$option" in --rebase=false|--rebase=no) continue ;; esac
    long_matches "$option" --rebase && block "'git pull --rebase' reescreve historico."
  done
  if has_short "r" "sX"; then
    block "'git pull -r' reescreve historico."
  fi
}

# So leitura passa. Escrita em `git config` vira execucao ou publicacao no
# comando seguinte: `core.fsmonitor` roda no proximo `git status`,
# `remote.origin.url` troca o destino do proximo `git push`.
check_git_config() {
  parse_arguments "f" "--file --blob --type --default --comment" ${1+"$@"}

  case "${positionals[0]:-}" in
    get|list) return 0 ;;
    set|unset|rename-section|remove-section|edit)
      block "'git config ${positionals[0]}' altera configuracao do git." ;;
  esac
  if has_short "e" "f" || has_long --edit --add --unset --unset-all --replace-all --rename-section --remove-section; then
    block "'git config' com escrita altera configuracao do git."
  fi
  if has_short "l" "f" || has_long --get --get-all --get-regexp --get-urlmatch --get-color --get-colorbool --list; then
    return 0
  fi
  if [ "${#positionals[@]}" -ge 2 ]; then
    block "'git config' com escrita altera configuracao do git: ${positionals[0]}"
  fi
}

# O merge e do dono, no GitHub. O deny `gh pr merge *` nao alcanca
# `gh pr -R dono/repo merge`, e o `gh api` chega ao mesmo endpoint.
check_gh() {
  local index=$((start + 1)) word
  local -a verbs=()
  while [ "$index" -lt "${#words[@]}" ]; do
    word="${words[$index]}"
    case "$word" in
      -R|--repo|--hostname) index=$((index + 2)); continue ;;
      -*) ;;
      *) verbs+=("$word") ;;
    esac
    index=$((index + 1))
  done

  case "${verbs[0]:-} ${verbs[1]:-}" in
    "pr merge") block "'gh pr merge': o merge e do dono, no GitHub." ;;
    "repo delete") block "'gh repo delete' apaga o repositorio." ;;
  esac
  if [ "${verbs[0]:-}" = api ]; then
    for word in "${words[@]:$((start + 1))}"; do
      case "$word" in
        *pulls/*/merge*|*mergePullRequest*) block "merge de PR pela API: o merge e do dono, no GitHub." ;;
      esac
    done
  fi
}

# `bash -c '...'` e `eval` carregam um comando inteiro como argumento, e ele
# passa pelas mesmas checagens. O limite de profundidade falha fechado.
inspect_shell_script() {
  local depth="$1" index=$((start + 1)) word
  while [ "$index" -lt "${#words[@]}" ]; do
    word="${words[$index]}"
    case "$word" in
      --*) ;;
      -*c*) inspect_line "${words[$((index + 1))]:-}" $((depth + 1)); return 0 ;;
      -*) ;;
      *) return 0 ;;
    esac
    index=$((index + 1))
  done
}

check_executable() {
  local subcommand="$1" depth="$2" token executable
  local -a words=()
  local start=0

  case "$subcommand" in *git*|*gh*|*sh*|*eval*) ;; *) return 0 ;; esac

  while IFS= read -r token; do
    words+=("$token")
  done < <(tokenize "$(printf '%s' "$subcommand" | sed -E 's/^[[:space:](){}!&]+//')")
  drop_redirections
  find_executable
  [ "$start" -lt "${#words[@]}" ] || return 0

  executable="${words[$start]##*/}"
  case "$executable" in
    git) check_git ;;
    gh) check_gh ;;
    bash|sh|zsh|dash|ksh) inspect_shell_script "$depth" ;;
    eval) inspect_line "${words[*]:$((start + 1))}" $((depth + 1)) ;;
  esac
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

  # Testa ARGUMENTO A ARGUMENTO e SEGMENTO A SEGMENTO: o diretorio nu
  # (`rm -rf src`) e o caso mais destrutivo, e comparar segmento evita o falso
  # positivo do sufixo — `mydocs` e `websrc` nao sao `docs` nem `src`.
  local argument path segment
  for argument in ${subcommand#rm}; do
    case "$argument" in
      -*) continue ;;
    esac

    path=$(printf '%s' "$argument" | tr -d "\"'")

    case "$path" in
      .|..|./|../) block "remocao recursiva do diretorio corrente: $argument" ;;
    esac

    while [ -n "$path" ]; do
      segment="${path##*/}"
      case "$segment" in
        src|tests|docs|config|web|tools|scripts|.github|.claude|.git)
          block "remocao recursiva em diretorio versionavel do projeto: $argument" ;;
      esac
      case "$path" in
        */*) path="${path%/*}" ;;
        *) path="" ;;
      esac
    done
  done
}

check_profiler() {
  local subcommand="$1"
  case "$subcommand" in
    *"profile_workbook.py"*) ;;
    *) return 0 ;;
  esac

  # Comando do git que CITA o perfilador nao o executa: e manutencao do proprio
  # script. A isencao CAI com substituicao de comando ou interpretador na linha:
  # `git commit -m "$(python3 tools/profile_workbook.py x.xlsx saida.json)"`
  # executa de verdade.
  case "$subcommand" in
    "git "*)
      case "$subcommand" in
        *'$('*|*'`'*|*python*|*"npm "*) ;;
        *) return 0 ;;
      esac
      ;;
  esac

  # Testa o DESTINO, que e o SEGUNDO posicional depois do script: ` /tmp/` na
  # entrada nao libera a saida.
  local token destination='' seen_script=0 positionals=0 skip_next=0
  for token in ${subcommand}; do
    if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi

    # Redirecionamento nao e posicional. `2>/dev/null` traz o alvo colado;
    # `> saida.json` o traz no token seguinte.
    case "$token" in
      *'>'*|*'<'*)
        case "$token" in
          *'>'|*'<') skip_next=1 ;;
        esac
        continue ;;
      -*) continue ;;
    esac

    if [ "$seen_script" = 0 ]; then
      case "$token" in
        *profile_workbook.py*) seen_script=1 ;;
      esac
      continue
    fi

    positionals=$((positionals + 1))
    [ "$positionals" = 2 ] && destination="$token"
  done

  # O destino e OPCIONAL no perfilador, e sem ele a saida cai em
  # `perfilamento.json` no diretorio corrente — a raiz do repositorio.
  [ -n "$destination" ] || block "perfilador sem destino explicito: a saida cai em perfilamento.json no diretorio corrente. Passe um caminho em /tmp/."

  destination=$(printf '%s' "$destination" | tr -d "\"'")

  # Travessia anula a excecao, pela mesma razao registrada em check_git_add.
  case "$destination" in
    *..*) block "perfilador com travessia de diretorio no destino: $destination" ;;
  esac

  case "$destination" in
    /tmp/*) return 0 ;;
  esac

  block "perfilador com destino fora de /tmp: a saida traz amostras de celula das quatro abas, inclusive CNPJ. Grave em /tmp, sanitize, e so entao mova."
}

# So o comando que cita data/ ou `cd` paga o `jq` do diretorio corrente.
data_context_ready=0
load_data_context() {
  [ "$data_context_ready" = 0 ] || return 0
  data_context_ready=1
  project_root="${CLAUDE_PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)}"
  project_root="${project_root%/}"
  data_dir="$project_root/data"
  data_cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)
  [ -n "$data_cwd" ] || data_cwd="$project_root"
}

# Absoluto e normalizado, sem tocar o disco: `data/../src` nao e data/, e
# `src/../data` e.
resolve_path() {
  local path="$1" part
  local -a parts=() normalized=()
  case "$path" in
    '~'|'~/'*) path="${HOME:-}${path#\~}" ;;
    '$HOME'|'$HOME/'*) path="${HOME:-}${path#\$HOME}" ;;
    '${HOME}'|'${HOME}/'*) path="${HOME:-}${path#\$\{HOME\}}" ;;
    '$CLAUDE_PROJECT_DIR'|'$CLAUDE_PROJECT_DIR/'*) path="$project_root${path#\$CLAUDE_PROJECT_DIR}" ;;
    '${CLAUDE_PROJECT_DIR}'|'${CLAUDE_PROJECT_DIR}/'*) path="$project_root${path#\$\{CLAUDE_PROJECT_DIR\}}" ;;
    '$PWD'|'$PWD/'*) path="$data_cwd${path#\$PWD}" ;;
    '${PWD}'|'${PWD}/'*) path="$data_cwd${path#\$\{PWD\}}" ;;
  esac
  case "$path" in /*) ;; *) path="$data_cwd/$path" ;; esac

  IFS=/ read -r -a parts <<< "$path"
  for part in ${parts[@]+"${parts[@]}"}; do
    case "$part" in
      ''|.) ;;
      ..) [ "${#normalized[@]}" -eq 0 ] || unset 'normalized[${#normalized[@]}-1]' ;;
      *) normalized+=("$part") ;;
    esac
  done
  resolved=''
  for part in ${normalized[@]+"${normalized[@]}"}; do
    resolved="$resolved/$part"
  done
  [ -n "$resolved" ] || resolved=/
}

check_data_word() {
  [ -n "$1" ] || return 0
  resolve_path "$1"
  case "$resolved" in
    "$data_dir"|"$data_dir"/*)
      block "acesso a data/ pelo shell: $1 — data/ e o estado do operador, negado ao agente (D-74). O que o agente grava para si fica em .claude/local/." ;;
  esac
  return 0
}

# Opcao curta que toma valor: em `grep -A 3` o `3` nao e caminho, e em
# `grep -f ARQUIVO` e.
short_option_value() {
  local rest="${1#-}" letter values
  case "$executable" in
    grep|egrep|fgrep|rgrep|zgrep) values='ABCmdDef' ;;
    rg) values='ABCmgtTMjrEef' ;;
    ls) values='I' ;;
    *) return 0 ;;
  esac
  while [ -n "$rest" ]; do
    letter="${rest:0:1}"
    rest="${rest:1}"
    case "$values" in
      *"$letter"*)
        if [ -n "$rest" ]; then
          [ "$letter" = f ] && check_data_word "$rest"
        elif [ "$letter" = f ]; then
          value_next=path
        else
          value_next=text
        fi
        return 0 ;;
    esac
  done
}

# `data/` e o estado do operador. Barra o caminho que resolve para dentro dele
# como argumento de comando conhecido, valor de atribuicao ou alvo de `<`, com o
# `cd` acompanhado. Comando desconhecido — a linha de heredoc, a prosa — nao e
# acesso, nem o padrao do grep e o valor de `--exclude-dir=data`. Fragmento com
# aspa sem par fica de fora: e o corte do `|` dentro de aspas que
# `split_subcommands` faz, e as palavras dali sao texto. Fica de fora tambem
# (D-74): caminho dentro de codigo ou de `$(...)`, variavel, laco, glob que nao
# nomeia data/ e busca recursiva.
check_data_access() {
  local subcommand="$1" word index executable tokens value_next='' pattern_pending=0 find_roots=1 after_separator=0
  local -a words=() arguments=()
  local start=0

  case "$subcommand" in *data*|cd|*'cd '*|*pushd*) ;; *) return 0 ;; esac
  load_data_context

  tokens=$(printf '%s\n' "$subcommand" | sed -E 's/^[[:space:](){}!&]+//' | xargs printf '%s\n' 2>/dev/null) || return 0
  while IFS= read -r word; do
    words+=("$word")
  done <<< "$tokens"

  for ((index = 0; index < ${#words[@]}; index++)); do
    case "${words[$index]}" in
      '<<'*) ;;
      '<'|[0-9]'<') check_data_word "${words[$((index + 1))]:-}" ;;
      '<'*) check_data_word "${words[$index]#<}" ;;
    esac
  done

  drop_redirections
  find_executable
  for ((index = 0; index < start; index++)); do
    case "${words[$index]}" in
      [A-Za-z_]*=*) check_data_word "${words[$index]#*=}" ;;
    esac
  done
  [ "$start" -lt "${#words[@]}" ] || return 0
  executable="${words[$start]##*/}"
  arguments=("${words[@]:$((start + 1))}")

  case "$executable" in
    cd|pushd)
      word="${arguments[0]:-}"
      case "$word" in -) return 0 ;; -?*) word="${arguments[1]:-}" ;; esac
      if [ -z "$word" ]; then data_cwd="${HOME:-/}"; return 0; fi
      check_data_word "$word"
      data_cwd="$resolved"
      return 0 ;;
    grep|egrep|fgrep|rgrep|zgrep|rg)
      pattern_pending=1
      for word in ${arguments[@]+"${arguments[@]}"}; do
        case "$word" in --regexp*|--file*) pattern_pending=0 ;; --*) ;; -*[ef]*) pattern_pending=0 ;; esac
      done ;;
    cat|tac|head|tail|less|more|wc|nl|cut|sort|uniq|paste|column|diff|cmp|comm|ls|stat|file|du|find|cp|mv|rm|ln|touch|mkdir|rmdir|chmod|truncate|tee|dd|xxd|od|hexdump|strings|base64|md5sum|sha1sum|sha256sum|iconv|jq|awk|gawk|mawk|sed|zcat|unzip|zip|tar|gzip|gunzip|node|python|python3|bash|sh|zsh|source|.|test|'['|'[['|export) ;;
    *) return 0 ;;
  esac

  for word in ${arguments[@]+"${arguments[@]}"}; do
    if [ -n "$value_next" ]; then
      [ "$value_next" = path ] && check_data_word "$word"
      value_next=''
      continue
    fi
    if [ "$after_separator" = 0 ]; then
      case "$word" in
        --) after_separator=1; continue ;;
        --exclude*=*|--include*=*|--glob*=*|--iglob*=*|--ignore*=*|--hide*=*) continue ;;
        --exclude|--exclude-dir|--include|--glob|--iglob|--ignore|--hide|--regexp|--max-count|--after-context|--before-context|--context|--directories|--devices|--label|--binary-files)
          value_next=text; continue ;;
        --file) value_next=path; continue ;;
        --*=*) check_data_word "${word#*=}"; continue ;;
        -?*) find_roots=0; short_option_value "$word"; continue ;;
        '('|'!') find_roots=0; continue ;;
      esac
    fi
    # No find, so a raiz e caminho: `-path ./data -prune` e expressao.
    [ "$executable" = find ] && [ "$find_roots" = 0 ] && continue
    if [ "$pattern_pending" = 1 ]; then pattern_pending=0; continue; fi
    case "$word" in
      [A-Za-z_]*=*) check_data_word "${word#*=}" ;;
      *) check_data_word "$word" ;;
    esac
  done
}

inspect_line() {
  local line="$1" depth="$2" raw_subcommand subcommand
  [ "$depth" -le 3 ] || block "comando embrulhado em mais de tres niveis de shell."

  while IFS= read -r raw_subcommand; do
    subcommand=$(printf '%s' "$raw_subcommand" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/[[:space:]]+/ /g')
    [ -n "$subcommand" ] || continue

    check_redirect "$subcommand"
    check_git_diff_output "$subcommand"
    check_recursive_remove "$subcommand"
    check_profiler "$subcommand"
    check_data_access "$subcommand"
    check_executable "$subcommand" "$depth"
  done < <(split_subcommands "$line")
}

inspect_line "$full_command" 0

exit 0
