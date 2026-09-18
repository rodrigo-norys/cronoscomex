#!/usr/bin/env bash
#
# O andaime da sessao Linux -> maquina Windows do operador, para o ensaio
# mecanico sobre a planilha (docs/ensaio-planilha/corpus-ensaio.md).
#
# Existe pela lesson que tools/medir-navegador.mjs ja registra em outro contexto:
# montar o preambulo a mao custou oito scripts iguais em 04 e 08/09/2026, e dois
# deles falharam no ANDAIME, nao na medida. Aqui o andaime e um so.
#
# Tres coisas que ele resolve, e que custaram uma rodada cada na primeira sessao:
#
#  1. **-EncodedCommand em vez de aspas.** `ssh host 'powershell -Command "..."'`
#     atravessa duas camadas de quoting e some com barras invertidas: a primeira
#     tentativa voltou vazia, e a segunda entregou um JSON invalido porque `\\`
#     virou `\`. Em base64 UTF-16LE nada e reinterpretado.
#  2. **UTF8Encoding($false).** `[System.Text.Encoding]::UTF8` do .NET escreve
#     BOM, e `loadConfig` recusa o app.json com `nao e um JSON valido`.
#  3. **schtasks com /ru e /it.** Sem /ru a tarefa nem e criada, e o sintoma so
#     aparece no /query seguinte falando do NOME da tarefa.
#
# O host vem de ENSAIO_HOST, e o padrao esta em [[envio-para-a-maquina-windows]]:
# o IP ja mudou uma vez por DHCP, e a identidade se verifica FORA DE BANDA — se
# o SSH recusar com REMOTE HOST IDENTIFICATION HAS CHANGED, nao remova a chave.
#
# Uso:
#   tools/ensaio-windows.sh ps                      < bloco.ps1
#   tools/ensaio-windows.sh gesto                   < gesto.json
#   tools/ensaio-windows.sh gesto '<base.xlsx>'      < gesto.json   # copia antes
#   tools/ensaio-windows.sh medir '<alvo.xlsx>' E07     # aponta e mede as rotas
#   tools/ensaio-windows.sh baixar E07-digest.json  <destino local>
set -euo pipefail

# Os dois vem do ambiente e NAO tem default: um default util aqui seria o host
# e o perfil de uma maquina real, e este arquivo e versionado num repositorio
# publico (A-05). O `:?` falha na partida com a mensagem, em vez de tentar um
# alvo errado. O host esta na rule de envio para a maquina Windows.
HOST_WIN="${ENSAIO_HOST:?defina ENSAIO_HOST — usuario@host da maquina Windows}"
AREA="${ENSAIO_AREA:?defina ENSAIO_AREA — a pasta do ensaio no perfil do Windows}"
TEMPO="${ENSAIO_TIMEOUT:-300}"

# O CLIXML e o stream de progresso do PowerShell remoto. Ele se mistura a saida
# util e nao carrega informacao nenhuma para quem le — e precisa sair INLINE, e
# nao por linha: o bloco vem grudado na primeira linha de saida verdadeira, e
# descartar a linha inteira levaria o conteudo junto.
# Em modo slurp, e nao linha a linha: o bloco atravessa varias linhas E vem
# grudado na primeira linha de saida verdadeira, entao filtrar por linha ou
# apaga conteudo util ou nao casa nada. O CRLF cai antes, senao `$` nao ancora.
limpar() {
  perl -0777 -pe 's/\r\n/\n/g; s/^#< CLIXML\n//mg; s/<Objs .*?<\/Objs>//sg'
}

executar_ps() {
  local encoded
  encoded=$(iconv -f UTF-8 -t UTF-16LE | base64 -w0)
  # `2>&1` e obrigatorio: o PowerShell remoto manda o stream de progresso — o
  # CLIXML — pelo stderr, entao um pipe so de stdout nunca o alcanca. Junto vem
  # o erro de verdade, que e o que se quer ver quando um gesto falha.
  timeout "$TEMPO" ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST_WIN" \
    "powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" 2>&1 | limpar
}

case "${1:-}" in
  ps)
    executar_ps
    ;;

  gesto)
    # A copia da base para o alvo acontece DENTRO deste bloco, e nao numa chamada
    # anterior. Fazer as duas em conexoes SSH separadas e em sequencia rapida
    # custou seis gestos de um lote em 17/09/2026: o `Copy-Item` reportava
    # sucesso — com `Test-Path` True e o arquivo aberto e fechado para conferir o
    # tamanho —, e o Excel da sessao grafica abria dizendo que o arquivo nao
    # existe. Isolado, ou com minutos de intervalo, o mesmo par sempre funcionou.
    # Uma conexao so remove a corrida sem precisar explica-la.
    gesto_b64=$(base64 -w0)
    origem="${2:-}"
    executar_ps <<PS
\$ErrorActionPreference = 'Continue'
\$base = '$AREA\excel'
\$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$gesto_b64'))
[System.IO.File]::WriteAllText((Join-Path \$base 'gesto.json'), \$json, (New-Object System.Text.UTF8Encoding(\$false)))
Remove-Item (Join-Path \$base 'resultado.txt') -Force -ErrorAction SilentlyContinue

if ('$origem' -ne '') {
  \$destino = (\$json | ConvertFrom-Json).arquivo
  Copy-Item '$origem' \$destino -Force
  Write-Output "copiou=\$((Get-Item \$destino).Length)"
}

schtasks /create /tn EnsaioExcel /tr $AREA\excel\ensaio-excel.cmd /sc once /st 23:59 /ru rodrigo /it /f | Out-Null
schtasks /run /tn EnsaioExcel | Out-Null

\$alvo = Join-Path \$base 'resultado.txt'
for (\$i = 0; \$i -lt 180; \$i++) {
  Start-Sleep -Seconds 2
  if ((Test-Path \$alvo) -and ((Get-Content \$alvo -Raw) -match 'fim=')) { break }
}
schtasks /delete /tn EnsaioExcel /f | Out-Null
if (Test-Path \$alvo) { Get-Content \$alvo } else { Write-Output 'SEM RESULTADO' }
exit 0
PS
    ;;

  medir)
    # Aponta o `app.json` da area para o alvo e mede as nove rotas.
    #
    # **So `medir-numeros.mjs`**: as ferramentas de digest e comparacao do ensaio
    # nao ficaram versionadas — rodaram o que tinham de rodar, e o resultado esta
    # em `docs/ensaio-planilha/RESULTADO.md`. Quem precisar de outra medida usa o
    # subcomando `ps` com o bloco proprio, que e o que este andaime existe para
    # tornar barato.
    alvo="$2"; rotulo="$3"
    alvo_escapado=$(printf '%s' "$alvo" | sed 's/\\/\\\\/g')
    executar_ps <<PS
\$ErrorActionPreference = 'Continue'
\$app = '$AREA\app'
[System.IO.File]::WriteAllText(
  (Join-Path \$app 'config\app.json'),
  '{ "workbookPath": "$alvo_escapado" }',
  (New-Object System.Text.UTF8Encoding(\$false)))
"hash=" + (Get-FileHash '$alvo' -Algorithm SHA256).Hash
Set-Location \$app
\$env:LOG_LEVEL = 'silent'
\$log = '$AREA\relatorios\\$rotulo-saida.txt'
cmd /c "node --experimental-strip-types tools\medir-numeros.mjs ""$AREA\relatorios\\$rotulo-rotas.md"" > ""\$log"" 2>&1"
Get-Content \$log
exit 0
PS
    ;;

  baixar)
    timeout 120 scp -o BatchMode=yes "$HOST_WIN:${AREA//\\//}/relatorios/$2" "$3"
    ;;

  *)
    echo 'uso: ensaio-windows.sh <ps|gesto|medir|baixar> [...]' >&2
    exit 1
    ;;
esac
