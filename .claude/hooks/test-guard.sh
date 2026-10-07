#!/usr/bin/env bash
# Teste de regressao do guard-dados-sensiveis.sh. Sem ele uma regex quebrada
# falha em SILENCIO: o hook segue saindo 0, e a protecao some sem aviso. Por
# isso roda PRIMEIRO no `npm run verify`, antes de lint, typecheck, teste e
# build: verificar a protecao antes de verificar o codigo.
#
# Convencao: `blocks` espera exit 2, `allows` espera exit 0, e as variantes
# `_in` passam o diretorio corrente do payload. Os casos de `allows` nao sao
# enfeite: cada um e um falso positivo que ja aconteceu ou que a estrutura do
# guard torna provavel.
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
  local expected="$1" command="$2" cwd="${3:-}" actual
  jq -nc --arg c "$command" --arg d "$cwd" '{tool_input:{command:$c}} + (if $d == "" then {} else {cwd:$d} end)' \
    | bash "$guard" >/dev/null 2>&1
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
blocks_in() { run_case 2 "$2" "$1"; }
allows_in() { run_case 0 "$2" "$1"; }

repo_root=$(cd -- "$hook_dir/../.." && pwd)

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

# --- fixture versionada: a mesma excecao que o CI faz ----------------------
allows 'git add tests/fixtures/data-vazia.xlsx'
allows 'git add tools/build_fixtures.py tests/fixtures/data-vazia.xlsx docs/06-backlog.md'
# A excecao vale para a fixture, nunca para o vizinho no mesmo comando.
blocks 'git add tests/fixtures/data-vazia.xlsx config/app.json'
# Travessia anula a excecao: em `case`, `*` atravessa `/`.
blocks 'git add tests/fixtures/../CONTROLE.xlsx'

# --- o exemplo de configuracao e versionado ---------------------------------
# O glob `*"config/app.json"*` tem `*` nas duas pontas e casaria o `.exemplo`.
# O que carrega caminho local e `config/app.json`, e ele segue bloqueado.
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

# O diretorio de topo nu, sem barra, e o caso mais destrutivo.
blocks 'rm -rf src'
blocks 'rm -rf docs'
blocks 'rm -rf config'
blocks 'rm -rf web'
blocks 'rm -rf tools'
blocks 'rm -r tests'
blocks 'rm -rf ./src'
blocks 'rm -rf "src"'
blocks 'rm -rf src -v'

# `scripts/` e `.github/` tambem sao versionados, e `.github/` guarda os gates
# que rodam em todo commit.
blocks 'rm -rf scripts'
blocks 'rm -rf scripts/sincronizar-distribuicao.ts'
blocks 'rm -rf .github'
blocks 'rm -rf .github/workflows'

# Os dois piores.
blocks 'rm -rf .'
blocks 'rm -rf .git'

# --- perfilador gravando fora de /tmp --------------------------------------
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" saida.json'
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" docs/perfilamento/bruto.json'

# O destino decide, e nao a linha: ` /tmp/` na entrada nao libera a saida.
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
# O deny `git push --force *` so pega a forma canonica; `git push origin x
# --force` cai no allow `git push *` antes. Vale para commit, branch e switch.
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

# --- git: o resto da familia ----------------------------------------------
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
# `grep` cujo ARGUMENTO e a string "git add".
allows 'grep -n "git add" docs/06-backlog.md'
# `2>/dev/null` num comando que apenas MENCIONA .claude/.
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
# Comando do git que CITA o perfilador nao o executa.
allows 'git add tools/profile_workbook.py'
allows 'git commit -m "fix(tools): profile_workbook.py exige destino em /tmp"'
allows 'git diff main...HEAD -- tools/profile_workbook.py'
allows 'node --version 2>/dev/null'
allows 'echo "config/app.json e o arquivo de configuracao local"'

# --- acesso a data/ pelo shell (D-74) ---------------------------------------
# O deny de `Read(/data/**)` so alcanca a ferramenta Read. Os bloqueios sao
# as formas que as transcricoes mostraram lendo data/.
blocks 'ls -la data/'
blocks 'ls data 2>/dev/null'
blocks 'head -c 300 data/pending-edits.jsonl 2>/dev/null'
blocks 'wc -l data/history.jsonl && echo ok'
blocks 'wc -l < data/history.jsonl'
blocks "awk -F'\t' '{print \$2}' data/quarantine.json | sort -u"
blocks "stat -c '%y %n' data/*"
blocks 'grep -n "REF" data/history.jsonl'
blocks 'grep -rn -e x -- data/'
blocks 'jq . ./data/quarantine.json'
blocks 'cat src/../data/history.jsonl'
blocks 'cat "$CLAUDE_PROJECT_DIR/data/history.jsonl"'
blocks 'cat ${CLAUDE_PROJECT_DIR}/data/history.jsonl'
blocks "cat $repo_root/data/history.jsonl"
blocks "L=$repo_root/data/instrucoes-carregadas.log; wc -l \"\$L\""
blocks 'export L=data/history.jsonl'
blocks 'cd data && ls'
blocks 'cd docs && cat ../data/history.jsonl'
blocks 'find data -type f'
blocks 'cp data/history.jsonl /tmp/'
blocks 'timeout 5 tail -n 20 data/logs/app.jsonl'
blocks 'python3 tools/ler.py data/history.jsonl'
blocks 'bash -c "cat data/history.jsonl"'
blocks '[ -f data/pending-edits.jsonl ] && echo sim'
blocks_in "$repo_root/docs" 'cat ../data/history.jsonl'
# Texto que cita data/ nao e acesso: padrao de busca, mensagem de commit, prosa
# de heredoc e exclusao. Os tres primeiros passam pelo corte do `|` e do `;`
# dentro das aspas, que `split_subcommands` faz por desenho.
allows 'grep -n "data/\|config/" .claude/hooks/guard-dados-sensiveis.sh'
allows "grep -n -E 'Nenhum processo tem data|Ver os numeros' web/src/pages/History.tsx"
allows "sed -i 's#nao em data/, que e#x#; s#y#z#' .claude/hooks/registrar-instrucoes.sh"
allows 'for d in docs data dist; do grep -c "$d/" CLAUDE.md; done'
allows 'grep -rn "data/" src/'
allows 'grep -e "data/" -n src/app/config.ts'
allows 'grep -n -A 3 "data/" docs/04-arquitetura.md'
allows 'grep -rn x . --exclude-dir=data'
allows 'find . -path ./data -prune -o -name "*.ts" -print'
allows "sed -n '/data\\//p' docs/04-arquitetura.md"
allows 'echo "data/ e o estado do operador"'
allows 'git log --oneline -- data/'
allows 'git commit -m "fix: o log sai de data/; data/ fica so com o estado"'
allows "$(printf 'git commit -F - <<%sEOF%s\n- o guard barra data/ pelo shell\nEOF' "'" "'")"
allows 'ls src/data'
allows 'cat /tmp/data/x.json'
allows 'du -sh --exclude=data .'
allows 'cd docs && ls'
allows 'sed -n 1,40p .claude/local/levantamento-retroativo.md'
allows_in /tmp 'cat data/x.json'

# --- o guard que quebra bloqueia --------------------------------------------
# Saida fora de 0 e 2 o Claude Code trata como erro nao bloqueante. A copia
# tira a linha `data_dir=`, como fica o guard no meio de uma edicao, e roda um
# comando que o guard inteiro libera: tem de sair 2, pelo `trap`. A mensagem e
# conferida porque erro de sintaxe tambem sai 2, e passaria sem o `trap`.
allows 'grep -rn data src/'
broken_dir=$(mktemp -d)
broken_guard="$broken_dir/guard-dados-sensiveis.sh"
sed '/^  data_dir=/d' "$guard" > "$broken_guard"
if cmp -s "$guard" "$broken_guard"; then
  failed=$((failed + 1))
  echo 'FALHOU  a copia quebrada saiu igual ao guard: a linha `data_dir=` mudou de forma' >&2
else
  message=$(jq -nc '{tool_input:{command:"grep -rn data src/"}}' | bash "$broken_guard" 2>&1 >/dev/null)
  actual=$?
  if [ "$actual" -eq 2 ] && [[ "$message" == *"o guard falhou"* ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    printf 'FALHOU  guard quebrado: esperava 2 pelo trap, obteve %s  <-  %s\n' "$actual" "$message" >&2
  fi
fi
rm -rf -- "$broken_dir"

total=$((passed + failed))
if [ "$failed" -eq 0 ]; then
  printf 'guard-dados-sensiveis: %s casos, todos passaram\n' "$total"
  exit 0
fi

printf 'guard-dados-sensiveis: %s casos, %s FALHARAM\n' "$total" "$failed" >&2
exit 1
