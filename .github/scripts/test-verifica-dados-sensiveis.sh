#!/usr/bin/env bash
#
# Regressao de verifica-dados-sensiveis.sh.
#
# Existe pelo mesmo motivo que .claude/hooks/test-guard.sh: uma regex quebrada
# num guard falha em SILENCIO — continuaria saindo 0 e dizendo "aprovado".
# Metade dos casos aqui sao falsos positivos que precisam **passar**, e dois
# deles ja morderam de verdade durante a escrita do script.
#
#   bash .github/scripts/test-verifica-dados-sensiveis.sh

set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1
ALVO='.github/scripts/verifica-dados-sensiveis.sh'
AREA="$(mktemp -d)"
trap 'rm -rf "$AREA"' EXIT

passou=0
falhou=0

# roda <esperado: reprova|aprova> <descricao> <lista de arquivos, um por linha>
roda() {
  local esperado="$1" descricao="$2" lista="$3"
  local saida codigo
  saida="$(ARQUIVOS_PARA_VERIFICAR="$lista" USER=fulano bash "$ALVO" 2>&1)"
  codigo=$?

  local obtido='aprova'
  [ "$codigo" -ne 0 ] && obtido='reprova'

  if [ "$obtido" = "$esperado" ]; then
    passou=$((passou + 1))
    printf '  ok    %-52s (%s)\n' "$descricao" "$esperado"
  else
    falhou=$((falhou + 1))
    printf '  FALHA %-52s esperava %s, obteve %s\n' "$descricao" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/          /'
  fi
}

printf '\nDeve REPROVAR — dado real versionado\n'
roda reprova 'planilha na raiz'            'CONTROLE DOS EMBARQUE.xlsx'
roda reprova 'planilha em pasta qualquer'  'docs/anexos/planilha.xlsx'
roda reprova 'config/app.json'             'config/app.json'
roda reprova 'artefato de data/'           'data/quarantine.json'
roda reprova 'backup do .xlsx'             'data/backups/2026-08-06.xlsx'
roda reprova 'print .jpeg'                 'planilha.jpeg'
roda reprova 'print .png'                  'docs/print.png'
roda reprova 'perfilamento bruto'          'docs/perfilamento/cru.json'

printf '\nDeve APROVAR — falso positivo que precisa passar\n'
roda aprova  'as 7 fixtures versionadas'   'tests/fixtures/basico.xlsx
tests/fixtures/cores.xlsx
tests/fixtures/formatado.xlsx'
roda aprova  'exemplo de configuracao'     'config/app.json.exemplo'
roda aprova  'perfilamento sanitizado'     'docs/perfilamento/perfil-sanitizado.json'
roda aprova  'documento comum'             'docs/06-backlog.md'
roda aprova  'lista vazia'                 ''

# Os dois casos abaixo morderam de verdade: a primeira versao do script
# reprovava a documentacao que discute caminhos de proposito.
printf '\nCaminho absoluto — o que conta e onde ele esta\n'

criar() { mkdir -p "$AREA/$(dirname "$1")" && printf '%s\n' "$2" > "$AREA/$1" && printf '%s' "$1"; }

pushd "$AREA" > /dev/null || exit 1
mkdir -p src docs .claude/hooks
printf 'const caminho = "/home/fulano/Desktop/projeto/x"\n' > src/vaza.ts
printf 'o marcador /home/usuario/ e generico\n'              > docs/marcador.md
printf 'blocks "git diff --output=/tmp/../home/vazamento.txt"\n' > .claude/hooks/test-guard.sh
printf 'const s = "C:\\Users\\fulano\\OneDrive"\n'           > src/windows.ts
popd > /dev/null || exit 1

cd "$AREA" || exit 1
cp "$OLDPWD/$ALVO" ./verifica.sh 2>/dev/null || cp /home/*/Desktop/CronosComex/"$ALVO" ./verifica.sh
mkdir -p .github/scripts && mv verifica.sh .github/scripts/verifica-dados-sensiveis.sh

roda_local() {
  local esperado="$1" descricao="$2" lista="$3"
  local saida codigo
  saida="$(ARQUIVOS_PARA_VERIFICAR="$lista" USER=fulano bash .github/scripts/verifica-dados-sensiveis.sh 2>&1)"
  codigo=$?
  local obtido='aprova'
  [ "$codigo" -ne 0 ] && obtido='reprova'
  if [ "$obtido" = "$esperado" ]; then
    passou=$((passou + 1)); printf '  ok    %-52s (%s)\n' "$descricao" "$esperado"
  else
    falhou=$((falhou + 1)); printf '  FALHA %-52s esperava %s, obteve %s\n' "$descricao" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/          /'
  fi
}

roda_local reprova 'caminho de usuario em src/'          'src/vaza.ts'
roda_local reprova 'caminho Windows em src/'             'src/windows.ts'
roda_local aprova  'marcador generico em docs/'          'docs/marcador.md'
roda_local aprova  'payload de ataque no test-guard'     '.claude/hooks/test-guard.sh'

# A isencao existe porque uma regressao de guard carrega os proprios padroes
# que o guard detecta. Ela vale SO para caminho absoluto — o caso abaixo prova
# que o nome real do dono da maquina continua reprovando mesmo nesses arquivos.
# O payload usa um nome DIFERENTE do usuario simulado: senao este caso mediria
# o check do nome, nao o da isencao.
mkdir -p .github/scripts
printf 'payload: "/home/beltrano/Desktop/x"\n' > .github/scripts/test-verifica-dados-sensiveis.sh
roda_local aprova  'regressao de guard com payload de caminho'  '.github/scripts/test-verifica-dados-sensiveis.sh'

printf '\nNome real do usuario do sistema\n'
printf 'o operador fulano rodou o painel\n' > docs/nota.md
printf 'o operador rodou o painel\n'        > docs/limpo.md
roda_local reprova 'nome do usuario em documento'        'docs/nota.md'
roda_local aprova  'documento sem o nome'                'docs/limpo.md'

# A isencao NAO cobre o nome real: ali nao existe payload legitimo.
printf 'o operador fulano trabalhou aqui\n' > .github/scripts/test-verifica-dados-sensiveis.sh
roda_local reprova 'nome do usuario numa regressao de guard' '.github/scripts/test-verifica-dados-sensiveis.sh'

printf '\n%d passaram, %d falharam\n' "$passou" "$falhou"
[ "$falhou" -eq 0 ] || exit 1
