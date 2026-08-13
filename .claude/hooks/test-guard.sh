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
# ja aconteceu ou que a estrutura do guard torna provavel — metade dos casos,
# e dois deles ja morderam de verdade.
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

# --- perfilador gravando fora de /tmp --------------------------------------
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" saida.json'
blocks 'python3 tools/profile_workbook.py "planilha.xlsx" docs/perfilamento/bruto.json'

# --- comando composto: o guard testa por subcomando, nao a linha inteira ---
blocks 'npm test && git add -A'
blocks 'echo ok; echo x > config/app.json'

# --- falsos positivos que precisam continuar passando ----------------------
# Este mordeu de verdade: `grep` cujo ARGUMENTO e a string "git add".
allows 'grep -n "git add" docs/06-backlog.md'
# Este tambem: `2>/dev/null` num comando que apenas MENCIONA .claude/.
allows 'grep -rn "usuario" .claude/ 2>/dev/null'
allows 'git add src/domain/indicators.ts'
allows 'git add docs/06-backlog.md docs/09-rastreabilidade.md'
allows 'npm run verify'
allows 'git diff main...HEAD --stat'
allows 'git log --oneline -10'
allows 'rm /tmp/scratch.json'
allows 'rm -rf /tmp/claude-1000/algum-diretorio'
allows 'python3 tools/profile_workbook.py "planilha.xlsx" /tmp/saida.json'
allows 'node --version 2>/dev/null'
allows 'echo "config/app.json e o arquivo de configuracao local"'

total=$((passed + failed))
if [ "$failed" -eq 0 ]; then
  printf 'guard-dados-sensiveis: %s casos, todos passaram\n' "$total"
  exit 0
fi

printf 'guard-dados-sensiveis: %s casos, %s FALHARAM\n' "$total" "$failed" >&2
exit 1
