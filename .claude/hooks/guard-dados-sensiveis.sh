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
    # planilha DENTRO de tests/fixtures/ e versionada por exigencia da regra 7.
    # Sem isto as duas camadas se contradizem, e a que bloqueia e a que nao
    # vale: o CI e quem roda em todo commit.
    #
    # A excecao e por CAMINHO — quem olha DENTRO delas e
    # tests/repo/fixtures-anonimas.test.ts, no `npm run verify` e no verify.yml.
    # Esta excecao so se sustenta com ela. Sem contagem de proposito: a que
    # estava aqui nasceu errada — declarou 8 quando o indice tinha 7, porque foi
    # contada na arvore de trabalho, e nada no portao a reconfere.
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
    # Os tres `.exemplo` de config/ sao versionados; os globs abaixo tem `*` nas
    # duas pontas, entao cada um deles casaria o exemplo do seu par.
    case "$path" in
      config/app.json.exemplo) continue ;;
      config/client-map.json.exemplo) continue ;;
      config/team-map.json.exemplo) continue ;;
    esac

    # Os dois mapas de negocio de H-48 faltavam aqui e no CI ate 02/09/2026:
    # carregam nome real de cliente e de pessoa da equipe (regra inviolavel 8),
    # e `PUT /api/processes/:ref/client` CRIA o client-map.json, entao ele passa
    # a existir em toda maquina de desenvolvimento.
    case "$path" in
      *.xlsx*|*.jpeg*|*"config/app.json"*|*"config/client-map.json"*|*"config/team-map.json"*|*"data/"*)
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

  # Testa ARGUMENTO A ARGUMENTO e SEGMENTO A SEGMENTO, como check_git_add ja
  # faz. Glob sobre a linha inteira deixava passar o caso mais destrutivo de
  # todos — o diretorio nu: `rm -rf src` saia 0 e `rm -rf src/` saia 2, porque
  # todo glob menos o de `.claude` exigia a barra. E `scripts/` e `.github/`
  # faltavam por inteiro: os dois sao versionados e nasceram DEPOIS do guard.
  # Comparar segmento tambem evita o falso positivo que o sufixo criaria —
  # `mydocs` e `websrc` nao sao `docs` nem `src`.
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

  # Comando do git que CITA o perfilador nao o executa: preparar o arquivo dele
  # para o indice, ou commita-lo, e manutencao do proprio script. Sem esta saida
  # o gatilho — a string em qualquer posicao da linha — lia `git add` do arquivo
  # como execucao sem destino e bloqueava. Medido em 03/09/2026, ao commitar a
  # correcao deste guard; contornado na hora com um pathspec que casava so ele.
  #
  # A isencao vale para o git e CAI se o subcomando trouxer substituicao de
  # comando ou interpretador: `git commit -m "$(python3 tools/profile_workbook.py
  # x.xlsx saida.json)"` executa de verdade, e ali o guard volta a falhar
  # fechado. Mesmo desenho de check_git_add, que delimita pelo verbo antes de
  # olhar os argumentos.
  case "$subcommand" in
    "git "*)
      case "$subcommand" in
        *'$('*|*'`'*|*python*|*"npm "*) ;;
        *) return 0 ;;
      esac
      ;;
  esac

  # Isola o DESTINO, em vez de testar a linha inteira: ` /tmp/` em qualquer
  # posicao liberava o comando, inclusive quando era o caminho de ENTRADA — e a
  # saida caia em docs/perfilamento/, que o .gitignore cobre justamente por
  # trazer amostra de celula. O destino e o SEGUNDO posicional depois do script.
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
