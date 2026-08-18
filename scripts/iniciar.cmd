@echo off
setlocal EnableDelayedExpansion

rem  CronosComex - atalho de execucao (H-30).
rem
rem  O operador nao usa linha de comando: este arquivo e o unico ponto de
rem  partida da aplicacao na maquina dele (RNF-26, Windows).
rem
rem  Cada verificacao abaixo existe porque a falha correspondente e silenciosa
rem  ou ilegivel sem ela — o CMD fecha a janela ao terminar, entao um erro sem
rem  `pause` some antes de ser lido. Toda saida por erro passa por :erro.
rem
rem  As mensagens sao SEM ACENTO de proposito: o CMD herda a code page do
rem  sistema, e acento em code page 850 vira caractere trocado. Trocar por
rem  `chcp 65001` resolveria na maioria das maquinas e quebraria nas demais.

cd /d "%~dp0.."
if errorlevel 1 (
  echo Nao foi possivel entrar na pasta do projeto.
  goto :erro
)

rem  Aspas em tudo que toca caminho: a pasta do operador tem espacos e acentos.
set "RAIZ=%CD%"

rem  --- Node instalado? ---------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   O Node.js nao esta instalado nesta maquina.
  echo.
  echo   Baixe a versao 22 LTS em https://nodejs.org e instale.
  echo   Depois execute este atalho de novo.
  goto :erro
)

rem  A aplicacao roda TypeScript direto, com --experimental-strip-types, que
rem  so existe a partir do Node 22. Versao menor falha com "bad option", que
rem  nao diz o que fazer.
for /f "usebackq tokens=1 delims=." %%v in (`node -p "process.versions.node"`) do set "MAJOR=%%v"
if !MAJOR! LSS 22 (
  echo.
  echo   O Node.js instalado e a versao !MAJOR!, e a aplicacao exige a 22.
  echo.
  echo   Baixe a versao 22 LTS em https://nodejs.org e instale por cima.
  goto :erro
)

rem  --- Configuracao existe? ----------------------------------------------
if not exist "%RAIZ%\config\app.json" (
  echo.
  echo   Falta o arquivo de configuracao: config\app.json
  echo.
  echo   Copie o exemplo e ajuste o caminho da planilha:
  echo     copy config\app.json.exemplo config\app.json
  echo.
  echo   O passo a passo esta no README.md, secao "Instalacao".
  goto :erro
)

rem  --- Interface compilada? ----------------------------------------------
rem  O servidor tambem responde a isso, com uma pagina explicando o que falta
rem  (contrato secao 4). Avisar aqui poupa a ida ao navegador.
if not exist "%RAIZ%\dist\web\index.html" (
  echo.
  echo   A interface ainda nao foi compilada.
  echo.
  echo   Execute uma vez, nesta pasta:
  echo     npm ci
  echo     npm run build
  goto :erro
)

rem  --- A porta, lida da MESMA fonte que o servidor le --------------------
rem  Por `scripts\porta.mjs`, e nao por um `node -p` embutido: dentro de
rem  `for /f`, parenteses e aspas simples no comando quebram o parser do CMD, e
rem  um `JSON.parse` inline tem os dois. O porque completo esta no cabecalho do
rem  proprio script.
set "PORTA="
for /f "usebackq delims=" %%p in (`node scripts\porta.mjs`) do set "PORTA=%%p"
if not defined PORTA (
  echo.
  echo   config\app.json existe, mas nao pode ser lido como JSON.
  echo   Confira se nao ha virgula sobrando ou aspas faltando.
  goto :erro
)

rem  --- Ja esta no ar? -----------------------------------------------------
rem  Segunda execucao nao sobe um segundo servidor: o primeiro morreria com
rem  EADDRINUSE, e o operador leria um erro tendo feito a coisa certa.
netstat -ano | findstr /r /c:"127.0.0.1:!PORTA! .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo   O CronosComex ja esta em execucao. Abrindo o navegador.
  start "" "http://127.0.0.1:!PORTA!/"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

rem  --- Sobe -------------------------------------------------------------
echo.
echo   Iniciando o CronosComex em http://127.0.0.1:!PORTA!/
echo   FECHE ESTA JANELA para encerrar a aplicacao.
echo.

rem  O navegador abre em paralelo, com atraso: o servidor le a planilha antes
rem  de escutar, e abrir de imediato mostraria "nao foi possivel conectar".
rem
rem  A URL vai SEM aspas de proposito: dentro de `cmd /c "..."` nao ha forma
rem  portavel de aninhar aspas, e endereco http nao tem espaco que as exija.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://127.0.0.1:!PORTA!/"

rem  Em PRIMEIRO PLANO, e `node` direto em vez de `npm start`: fechar a janela
rem  precisa matar o servidor, e o `npm` interporia um processo intermediario
rem  que sobreviveria como orfao, segurando a porta ate o proximo reinicio.
node --experimental-strip-types "%RAIZ%\src\http\server.ts"
set "CODIGO=%ERRORLEVEL%"

if not "%CODIGO%"=="0" (
  echo.
  echo   O servidor encerrou com erro ^(codigo %CODIGO%^).
  echo   A causa esta nas linhas acima.
  goto :erro
)

exit /b 0

:erro
echo.
pause
exit /b 1
