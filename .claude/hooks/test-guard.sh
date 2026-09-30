#!/usr/bin/env bash
# Teste de regressao do guard-dados-sensiveis.sh.
#
# O guard e a unica camada mecanica de autoria deste projeto: regra de
# permissao e do cliente, skill e instrucao. Sem este teste uma regex
# quebrada falha em SILENCIO — o hook segue saindo 0, e a protecao some
# sem que nada avise.
#
# Por isso roda PRIMEIRO no `npm run verify`, antes de lint, typecheck,
# teste e build: verificar a protecao antes de verificar o codigo.
# Mesma razao pela qual test-verifica-dados-sensiveis.sh roda primeiro no
# workflow do CI.
#
# Convencao: `blocks` espera exit 2, `allows` espera exit 0.
# Os casos de `allows` nao sao enfeite: cada um e um falso positivo que
# ja aconteceu ou que a estrutura do guard torna provavel, e QUATRO deles ja
# morderam de verdade — a fixture (13/08/2026) e o exemplo de configuracao
# (H-30), narrados nas secoes abaixo, mais os dois marcados no bloco final.
#
# Exige `bash` e `jq`.

set -uo pipefail

hook_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
guard="$hook_dir/guard-dados-sensiveis.sh"

[ -f "$guard" ] || { echo "guard nao encontrado: $guard" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq ausente — o guard depende dele" >&2; exit 1; }

passed=0
failed=0

run_case() {
  local expected="$1" command="$2" actual
  jq -nc --arg c "$command" '{tool_input:{command:$c}}' | bash "$guard" >/dev/null 2>&1
  actual=$?
  if [ "$actual" -eq "$expected" ]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    printf 'FALHOU  esperava %s, obteve %s  <-  %s\n' "$expected" "$actual" "$command" >&2
  fi
}

blocks() { run_case 2 "$1"; }
allows() { run_case 0 "$1"; }

# --- staging forcado ou em massa -------------------------------------------
blocks 'git add -f config/app.json'
blocks 'git add --force docs/perfilamento/bruto.json'
blocks 'git add -A'
blocks 'git add --all'
blocks 'git add .'

# --- staging apontando para artefato com dado real -------------------------
blocks 'git add CONTROLE DOS EMBARQUE.xlsx'
blocks 'git add planilha1.jpeg'
blocks 'git add config/app.json'
blocks 'git add data/logs/app-20260805.jsonl'

# --- fixture versionada: a excecao que o CI ja fazia e o guard nao ----------
# O guard bloqueava `tests/fixtures/*.xlsx` enquanto
# verifica-dados-sensiveis.sh a permitia. A contradicao apareceu ao versionar
# data-vazia.xlsx, em 13/08/2026: o commit era legitimo e o guard o barrava.
allows 'git add tests/fixtures/data-vazia.xlsx'
allows 'git add tools/build_fixtures.py tests/fixtures/data-vazia.xlsx docs/06-backlog.md'
# A excecao vale para a fixture, nunca para o vizinho no mesmo comando.
blocks 'git add tests/fixtures/data-vazia.xlsx config/app.json'
# Travessia anula a excecao: em `case`, `*` atravessa `/`.
blocks 'git add tests/fixtures/../CONTROLE.xlsx'

# --- o exemplo de configuracao: versionado, e o guard o barrava --------------
# Mesmo defeito da fixture acima, encontrado em H-30 ao atualizar o arquivo. O
# glob `*"config/app.json"*` tem `*` nas duas pontas, entao o sufixo `.exemplo`
# casava. O que carrega caminho local e `config/app.json`, e ele segue bloqueado.
allows 'git add config/app.json.exemplo'
allows 'git add README.md config/app.json.exemplo'
blocks 'git add config/app.json.exemplo config/app.json'
# A excecao e do nome exato: nada mais sob esse prefixo passa.
blocks 'git add config/app.json.local'
blocks 'git add config/app.json.exemplo.bak'

# --- redirecionamento para caminho protegido -------------------------------
blocks 'echo x > config/app.json'
blocks 'cat foo >> data/quarantine.json'
blocks 'npm test > relatorio.xlsx'
blocks 'node script.js > docs/perfilamento/bruto.json'
blocks 'echo x > .claude/settings.json'
blocks 'cat foo | cat > data/vazou.json'

# --- escrita disfarcada de leitura -----------------------------------------
blocks 'git diff --output=/tmp/../home/vazamento.txt'

# --- remocao recursiva em diretorio versionado -----------------------------
blocks 'rm -rf src/domain'
blocks 'rm -r tests/fixtures'
blocks 'rm -R .claude'

# Os tres casos acima passavam por ACIDENTE DE FORMA: dois trazem subdiretorio,
# logo a barra que o glob exigia, e o terceiro caia no unico glob sem barra.
# Nenhum exercitava o diretorio de topo nu, que era o furo — e a suite reportava
# "todos passaram" com ele aberto. Medido em 02/09/2026: `rm -rf src` saia 0.
blocks 'rm -rf src'
blocks 'rm -rf docs'
blocks 'rm -rf config'
blocks 'rm -rf web'
blocks 'rm -rf tools'
blocks 'rm -r tests'
blocks 'rm -rf ./src'
blocks 'rm -rf "src"'
blocks 'rm -rf src -v'

# Furo distinto do anterior, e este passava MESMO COM a barra: os dois
# diretorios faltavam na lista por inteiro. Sao versionados e nasceram DEPOIS
# do guard — `.github/` guarda os dois unicos gates que rodam em todo commit.
blocks 'rm -rf scripts'
blocks 'rm -rf scripts/sincronizar-distribuicao.ts'
blocks 'rm -rf .github'
blocks 'rm -rf .github/workflows'

# Os dois piores, que tambem saiam 0.
blocks 'rm -rf .'
blocks 'rm -rf .git'

# --- perfilador gravando fora de /tmp --------------------------------------
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" saida.json'
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" docs/perfilamento/bruto.json'

# O teste era sobre a LINHA, nao sobre o destino: qualquer ` /tmp/` em qualquer
# posicao liberava o comando. Os tres primeiros saiam 0 em 02/09/2026 — o
# primeiro gravando perfilamento bruto dentro de docs/perfilamento/, que o
# .gitignore cobre justamente por trazer amostra de celula.
blocks 'python3 tools/profile_workbook.py /tmp/copia.xlsx docs/perfilamento/bruto.json'
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" /tmp/../home/saida.json'
blocks 'python3 tools/profile_workbook.py /tmp/copia.xlsx .claude/vazamento.json'
blocks 'python3 tools/profile_workbook.py /tmp/copia.xlsx config/perfil.json'
# Destino e OPCIONAL no perfilador: sem ele a saida cai na raiz do repositorio.
blocks 'python3 tools/profile_workbook.py /tmp/copia.xlsx'

# A isencao do git nao pode virar bypass: substituicao de comando executa.
blocks 'git commit -m "$(python3 tools/profile_workbook.py x.xlsx saida.json)"'

# --- comando composto: o guard testa por subcomando, nao a linha inteira ---
blocks 'npm test && git add -A'
blocks 'echo ok; echo x > config/app.json'

# --- git: a negacao por prefixo nao alcanca posicao, grupo nem abreviacao ---
# Medido em 23/09/2026: 71 formas passavam no guard E sem prompt. O deny
# `git push --force *` so pega a forma canonica; `git push origin x --force`
# cai no allow `git push *` antes. Mesma coisa em commit, branch e switch.
# Estas sao as formas que o roadmap nomeou (B1).
blocks 'git add -fA'
blocks 'git add -Af'
blocks 'git add -vf config/app.json'
blocks 'git push origin distribuicao --force'
blocks 'git push -uf origin distribuicao'
blocks 'git push --force-with-lease origin distribuicao'
blocks 'git push --force-w origin distribuicao'
blocks 'git push origin +distribuicao'
blocks 'git push origin +HEAD:distribuicao'
blocks 'git commit -n -m "x"'
blocks 'git commit -nm "x"'
blocks 'git commit -m "x" --no-verify'
blocks 'git commit --no-verif -m "x"'
blocks 'git branch feature -D'
blocks 'git branch -df feature'
blocks 'git branch --delete --force feature'
blocks 'git branch --del --forc feature'

# O mesmo push atras do que vem antes do `git` sem mudar o que ele faz.
blocks 'git -C . push -f origin x'
blocks 'env git push -f origin x'
blocks 'timeout 30 git push -f origin x'
blocks '\git push -f origin x'
blocks '/usr/bin/git push -f origin x'
blocks 'sleep 1 & git push -f origin x'
blocks '(git push -f origin x)'
blocks 'bash -c "git push -f origin x"'

# --- git: o resto da familia, que o roadmap nao nomeava (B ampliado) --------
# Publica ou apaga sem forcar.
blocks 'git push --mirror origin'
blocks 'git push --mirr origin'
blocks 'git push --delete origin distribuicao'
blocks 'git push -d origin distribuicao'
blocks 'git push origin :distribuicao'
blocks 'git push --prune origin x'
blocks 'git push https://example.invalid/copia.git HEAD:main'
blocks 'git push git@example.invalid:copia.git HEAD'
# Descarta mudanca nao commitada: o mesmo que `checkout --`, ja negado.
blocks 'git checkout .'
blocks 'git checkout HEAD -- .'
blocks 'git restore .'
blocks 'git restore --staged --worktree .'
blocks 'git switch main -f'
blocks 'git switch -qf main'
blocks 'git switch --disc main'
blocks 'git checkout main --force'
# Recria ou move branch, e os commits dela ficam orfaos.
blocks 'git switch -C main origin/main'
blocks 'git checkout -B main origin/main'
blocks 'git branch -f main HEAD~5'
# Reescreve historico.
blocks 'git reset HEAD~1 --hard'
blocks 'git commit --no-edit --amend'
blocks 'git commit --amen --no-edit'
blocks 'git pull --rebase origin main'
blocks 'git pull -r'
# Configuracao que vira execucao ou publicacao no comando seguinte.
blocks 'git config core.hooksPath /dev/null'
blocks 'git config remote.origin.url https://example.invalid/copia.git'
blocks 'git config --add alias.x "push -f"'
blocks 'git -c core.fsmonitor=/tmp/x.sh status'
# O merge e do dono, no GitHub: nem com flag antes do verbo, nem pela API.
blocks 'gh pr -R dono/repo merge 146 --merge'
blocks 'gh api -X PUT repos/dono/repo/pulls/146/merge'
blocks 'gh repo delete dono/repo --yes'

# Os usos do dia a dia, tirados do corpus de comandos ja rodados aqui.
allows 'git push -u origin H-99/feat-exemplo'
allows 'git push origin distribuicao'
allows 'git push'
allows 'git push 2>/dev/null'
allows 'git commit -m "menciona --force, -n e --amend so no texto"'
allows 'git commit -am "x"'
allows 'git branch -d feature'
allows 'git branch --show-current'
allows 'git switch -c H-99/feat-exemplo'
allows 'git switch -'
allows 'git checkout -b H-99/feat-exemplo'
allows 'git checkout main'
allows 'git restore --staged src/domain/indicators.ts'
allows 'git reset src/domain/indicators.ts'
allows 'git pull origin main'
allows 'git pull --no-rebase origin main'
allows 'git config --get remote.origin.url'
allows 'git config user.name'
allows 'git config --list --show-origin'
allows 'git -c core.quotepath=false status'
allows 'gh pr create --title "merge da fase B" --body "sem merge pelo agente"'
allows 'gh pr view 146 --json mergeStateStatus'
allows 'gh api repos/dono/repo/rulesets'

# --- falsos positivos que precisam continuar passando ----------------------
# Este mordeu de verdade: `grep` cujo ARGUMENTO e a string "git add".
allows 'grep -n "git add" docs/06-backlog.md'
# Este tambem: `2>/dev/null` num comando que apenas MENCIONA .claude/.
allows 'grep -rn "usuario" .claude/ 2>/dev/null'
# Os dois mapas de H-48 estao no .gitignore por carregarem nome real; os
# `.exemplo` sao versionados, e o glob com `*` nas duas pontas casaria os dois.
blocks 'git add config/client-map.json'
blocks 'git add config/team-map.json'
allows 'git add config/client-map.json.exemplo'
allows 'git add config/team-map.json.exemplo'
allows 'git add src/domain/indicators.ts'
allows 'git add docs/06-backlog.md docs/09-rastreabilidade.md'
allows 'npm run verify'
allows 'git diff main...HEAD --stat'
allows 'git log --oneline -10'
allows 'rm /tmp/scratch.json'
allows 'rm -rf /tmp/claude-1000/algum-diretorio'
# A varredura por SEGMENTO existe para nao transformar sufixo em falso
# positivo: `mydocs` e `websrc` nao sao `docs` nem `src`.
allows 'rm -rf /tmp/mydocs'
allows 'rm -rf /tmp/websrc'
allows 'rm -rf node_modules'
allows 'python3 tools/profile_workbook.py "planilha.xlsx" /tmp/saida.json'
# `split_subcommands` nao quebra em `>`, entao o token de redirecionamento
# entrava na conta dos posicionais e bloqueava comando legitimo.
allows 'python3 tools/profile_workbook.py "planilha.xlsx" /tmp/saida.json 2>/dev/null'
# Comando do git que CITA o perfilador nao o executa. Os tres saiam 2 ate
# 03/09/2026, e o primeiro apareceu commitando a correcao do proprio guard.
allows 'git add tools/profile_workbook.py'
allows 'git commit -m "fix(tools): profile_workbook.py exige destino em /tmp"'
allows 'git diff main...HEAD -- tools/profile_workbook.py'
allows 'node --version 2>/dev/null'
allows 'echo "config/app.json e o arquivo de configuracao local"'

total=$((passed + failed))
if [ "$failed" -eq 0 ]; then
  printf 'guard-dados-sensiveis: %s casos, todos passaram\n' "$total"
  exit 0
fi

printf 'guard-dados-sensiveis: %s casos, %s FALHARAM\n' "$total" "$failed" >&2
exit 1
