#!/usr/bin/env bash
#
# Verifica que nenhum dado real do operador entrou no repositorio.
#
# E o guard-dados-sensiveis.sh do lado que nao da para contornar: o hook local
# e PreToolUse e so ve o que o agente faz. Este roda sobre o que efetivamente
# esta versionado, independente de quem commitou e com qual ferramenta.
#
# Recusa: planilha fora de tests/fixtures/, config/app.json, artefato de data/,
# imagem, perfilamento bruto, caminho absoluto de usuario em codigo ou
# configuracao (A-05), e — so onde ha usuario real — o nome do dono da maquina
# em qualquer arquivo.
#
# Falha FECHADO: qualquer achado devolve 1. Aqui o dano de deixar passar e
# publicar dado de cliente, e o custo de um falso positivo e uma conversa.
#
# Roda tambem na maquina, sobre a arvore atual:
#   bash .github/scripts/verifica-dados-sensiveis.sh

set -uo pipefail

achados=0
ESTE_SCRIPT='.github/scripts/verifica-dados-sensiveis.sh'

# Arquivos de regressao de guard carregam, por natureza, os proprios padroes
# que os guards detectam — sem eles nao ha como provar que o guard pega o caso.
# A isencao vale SO para o check de caminho absoluto. O nome real do dono da
# maquina continua valendo para eles: ali nao existe payload legitimo.
eh_regressao_de_guard() {
  case "$1" in
    "$ESTE_SCRIPT" | '.github/scripts/test-verifica-dados-sensiveis.sh' | '.claude/hooks/test-guard.sh')
      return 0 ;;
    *) return 1 ;;
  esac
}

reportar() {
  achados=$((achados + 1))
  printf '\n[FALHA] %s\n' "$1"
  printf '%s\n' "$2" | sed 's/^/  /'
}

# A lista sai do indice do git. ARQUIVOS_PARA_VERIFICAR existe para a
# regressao em .github/scripts/test-verifica-dados-sensiveis.sh: o hook
# guard-dados-sensiveis.sh — corretamente — impede montar um indice com
# planilha e config/app.json, mesmo em repositorio descartavel.
#
# Sem os dois-pontos de proposito: `${VAR-default}` distingue "nao definida" de
# "definida e vazia". Com `${VAR:-default}`, testar a lista vazia cairia no
# `git ls-files` e analisaria a arvore inteira.
versionados="${ARQUIVOS_PARA_VERIFICAR-$(git ls-files)}"

# 1. Planilhas fora das fixtures. As 9 de tests/fixtures/ sao derivadas do
#    arquivo real com nomes trocados, e versiona-las e exigencia da regra 7.
#    guard-dados-sensiveis.sh faz a MESMA excecao no `git add`, desde 13/08/2026.
#
#    A excecao e por CAMINHO, e ate 01/09/2026 nada olhava DENTRO delas — nem
#    aqui, nem no hook, e o check 6 pula binario por construcao. Um comentario
#    da planilha do operador, com nome de duas pessoas, sobreviveu meses assim.
#    Quem olha para dentro e tests/repo/fixtures-anonimas.test.ts, que roda no
#    `npm run verify` e no verify.yml. Esta excecao so se sustenta com ela.
planilhas="$(printf '%s\n' "$versionados" | grep -iE '\.xlsx$' | grep -v '^tests/fixtures/' || true)"
[ -n "$planilhas" ] &&
  reportar "Planilha versionada fora de tests/fixtures/." "$planilhas"

# 2. Configuracao com o caminho real da pasta sincronizada do OneDrive.
config="$(printf '%s\n' "$versionados" | grep -xE 'config/app\.json' || true)"
[ -n "$config" ] &&
  reportar "config/app.json versionado — ele carrega o caminho real do OneDrive." "$config"

# 3. Artefatos de execucao: quarentena, historico, backups e logs.
dados="$(printf '%s\n' "$versionados" | grep -E '^data/' || true)"
[ -n "$dados" ] &&
  reportar "Arquivo de data/ versionado — sao artefatos de execucao." "$dados"

# 4. Imagens. Os prints da planilha chegaram como .jpeg; web/ ainda nao tem
#    nenhuma imagem legitima. Quando tiver, abra a excecao aqui, nomeada.
imagens="$(printf '%s\n' "$versionados" | grep -iE '\.(jpe?g|png|gif|bmp|webp)$' || true)"
[ -n "$imagens" ] &&
  reportar "Imagem versionada — prints da planilha nunca entram no repositorio." "$imagens"

# 5. Perfilamento bruto: o RESULTADO.md e sanitizado, o JSON cru nao.
bruto="$(printf '%s\n' "$versionados" | grep -E '^docs/perfilamento/.*\.json$' | grep -v 'sanitizad' || true)"
[ -n "$bruto" ] &&
  reportar "Perfilamento bruto versionado — so a versao sanitizada entra." "$bruto"

# 6. Caminho absoluto de usuario em arquivo EXECUTAVEL ou de configuracao.
#
#    Nao vale para docs/ nem CLAUDE.md: ali discutir caminho e o trabalho, e a
#    documentacao usa marcadores de proposito (`<usuario>`, `/home/usuario/`,
#    `C:\Users\...`). Em configuracao a coisa muda de figura — um caminho
#    absoluto deixa de casar em qualquer outra maquina, **em silencio**, o que
#    e exatamente o achado A-05 da auditoria de configuracao.
alvos_config="$(printf '%s\n' "$versionados" |
  grep -E '^(\.claude/|\.github/|config/|src/|web/|tools/|tests/)|^(package\.json|biome\.json|tsconfig\.json|vitest\.config\.ts)$' || true)"

absolutos=''
while IFS= read -r arquivo; do
  [ -z "$arquivo" ] && continue
  eh_regressao_de_guard "$arquivo" && continue
  grep -Iq . "$arquivo" 2>/dev/null || continue
  # A barra final e o que distingue diretorio de usuario (`/home/fulano/`) de
  # um caminho qualquer sob /home — o test-guard.sh usa `/home/vazamento.txt`
  # como payload de ataque, de proposito.
  encontrado="$(grep -nE '/home/[a-z0-9][a-z0-9._-]*/|/Users/[A-Za-z0-9][A-Za-z0-9._-]*/|[A-Za-z]:.Users.' "$arquivo" 2>/dev/null || true)"
  if [ -n "$encontrado" ]; then
    absolutos="${absolutos}${arquivo}
$(printf '%s' "$encontrado" | sed 's/^/    /')
"
  fi
done <<< "$alvos_config"

[ -n "$absolutos" ] &&
  reportar "Caminho absoluto de usuario em arquivo de codigo ou configuracao (A-05)." "$absolutos"

# 7. O nome real do usuario do sistema, em QUALQUER arquivo — inclusive docs.
#    So roda onde ha um usuario real: no runner do GitHub, \$USER e 'runner'.
#    Este e o unico check sem falso positivo, porque compara com o nome de
#    verdade em vez de adivinhar formato.
dono="${USER:-}"
case "$dono" in
  '' | runner | root | nobody) dono='' ;;
esac

if [ -n "$dono" ]; then
  vazamentos=''
  while IFS= read -r arquivo; do
    [ -z "$arquivo" ] && continue
    [ "$arquivo" = "$ESTE_SCRIPT" ] && continue
    grep -Iq . "$arquivo" 2>/dev/null || continue
    encontrado="$(grep -n -- "$dono" "$arquivo" 2>/dev/null || true)"
    if [ -n "$encontrado" ]; then
      vazamentos="${vazamentos}${arquivo}
$(printf '%s' "$encontrado" | sed 's/^/    /')
"
    fi
  done <<< "$versionados"

  [ -n "$vazamentos" ] &&
    reportar "Nome do usuario do sistema ('$dono') aparece em arquivo versionado." "$vazamentos"
fi

printf '\n'
if [ "$achados" -gt 0 ]; then
  printf 'Reprovado: %d verificacao(oes) encontrou(ram) dado sensivel.\n' "$achados"
  printf 'Remova o arquivo do controle de versao e confira o .gitignore.\n'
  printf 'Se o blob ja foi empurrado, remover na branch NAO basta: o historico guarda.\n'
  exit 1
fi

printf 'Aprovado: nenhum dado sensivel versionado.\n'
exit 0
