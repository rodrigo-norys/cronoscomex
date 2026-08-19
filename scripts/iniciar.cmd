@echo off
setlocal EnableDelayedExpansion

rem  CronosComex - atalho de execucao (H-30, reescrito em H-44).
rem
rem  O operador nao usa linha de comando: este arquivo e o unico ponto de
rem  partida da aplicacao na maquina dele (RNF-26, Windows).
rem
rem  FICA AQUI SOMENTE o que impede o servidor de subir ou a tela de existir:
rem  Node ausente, Node abaixo da 22, e a interface nao compilada. Os tres sao
rem  anteriores ao navegador por natureza, e nenhuma interface pode reporta-los.
rem  Todo o resto migrou para a tela em H-44 — inclusive `config\app.json`
rem  ausente, que ate entao PARAVA a partida e mandava o operador copiar um
rem  arquivo e editar JSON a mao, enquanto a tela que resolve isso existia desde
rem  H-34 e nunca chegava a ser exibida.
rem
rem  Cada verificacao que sobrou traz a RECEITA, e nao so o diagnostico: o que
rem  baixar, de onde, o que executar e o que fazer depois. Mensagem que diz o
rem  problema sem ensinar a sanar deixa o operador com a janela aberta e o
rem  telefone na mao.
rem
rem  O CMD fecha a janela ao terminar, entao um erro sem `pause` some antes de
rem  ser lido. Toda saida por erro passa por :erro.
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
  echo   O Node.js nao esta instalado nesta maquina, e a aplicacao nao roda
  echo   sem ele.
  echo.
  echo   COMO RESOLVER, em 3 passos:
  echo.
  echo   1. Abra o site   https://nodejs.org
  echo   2. Baixe o instalador do Windows ^(.msi^) da versao 22 LTS.
  echo      A versao usada no desenvolvimento e a 22.23.2; qualquer 22.x serve.
  echo   3. Execute o arquivo baixado e va clicando em Avancar ate o fim.
  echo      Nao ha nenhuma opcao a marcar: os padroes servem.
  echo.
  echo   Leva poucos minutos, e precisa de internet.
  echo   Terminada a instalacao, de duplo clique NESTE MESMO atalho outra vez.
  goto :erro
)

rem  A aplicacao roda TypeScript direto, com --experimental-strip-types, que
rem  so existe a partir do Node 22. Versao menor falha com "bad option", que
rem  nao diz o que fazer.
for /f "usebackq tokens=1 delims=." %%v in (`node -p "process.versions.node"`) do set "MAJOR=%%v"
if !MAJOR! LSS 22 (
  echo.
  echo   O Node.js instalado nesta maquina e a versao !MAJOR!, e a aplicacao
  echo   exige a 22.
  echo.
  echo   COMO RESOLVER:
  echo.
  echo   1. Abra o site   https://nodejs.org
  echo   2. Baixe o instalador do Windows ^(.msi^) da versao 22 LTS.
  echo      A versao usada no desenvolvimento e a 22.23.2; qualquer 22.x serve.
  echo   3. Execute o arquivo baixado e va clicando em Avancar ate o fim.
  echo.
  echo   NAO e preciso desinstalar a versao !MAJOR!: o instalador coloca a 22
  echo   por cima, e a aplicacao passa a usar a nova.
  echo   Terminada a instalacao, de duplo clique NESTE MESMO atalho outra vez.
  goto :erro
)

rem  --- Interface compilada? ----------------------------------------------
rem  `dist\` esta no .gitignore, entao numa extracao nova ela NUNCA existe:
rem  isto nao e caso-limite, e o estado de toda instalacao. Por isso o atalho
rem  OFERECE compilar em vez de so mandar: "abra o Prompt na pasta certa" e o
rem  passo que quebra para quem nao usa linha de comando (RNF-26).
if not exist "%RAIZ%\dist\web\index.html" (
  echo.
  echo   A interface ainda nao foi compilada.
  echo.
  echo   Este atalho pode compilar agora, por voce. O que vai acontecer:
  echo     - a janela vai mostrar MUITAS linhas de texto tecnico. E normal,
  echo       e nao precisa ser lido;
  echo     - costuma levar alguns minutos;
  echo     - precisa de internet na primeira vez;
  echo     - NAO FECHE esta janela enquanto estiver rodando.
  echo.
  set "RESPOSTA="
  set /p "RESPOSTA=  Compilar agora? Digite S e tecle Enter, ou N para sair: "
  if /i not "!RESPOSTA!"=="S" (
    echo.
    echo   Nada foi feito. Para compilar mais tarde, chame quem instalou a
    echo   aplicacao e mostre estas duas linhas, executadas nesta pasta:
    echo       npm ci
    echo       npm run build
    echo.
    echo   A pasta e   "%RAIZ%"
    goto :erro
  )

  rem  `npm ci` SO quando falta `node_modules`: e o que salva a maquina sem
  rem  internet e com as dependencias ja baixadas. Rodado a toa, ele apaga a
  rem  pasta e volta a exigir rede.
  if not exist "%RAIZ%\node_modules" (
    echo.
    echo   [1 de 2] Baixando as dependencias. Isto precisa de internet.
    echo.
    rem  `call` e obrigatorio: `npm` e ele proprio um .cmd, e sem o `call` o
    rem  controle nao volta para este arquivo — ele simplesmente termina aqui.
    call npm ci
    if errorlevel 1 goto :falha_dependencias
  ) else (
    echo.
    echo   [1 de 2] As dependencias ja estao instaladas. Nada a baixar.
  )

  echo.
  echo   [2 de 2] Compilando a interface.
  echo.
  call npm run build
  if errorlevel 1 goto :falha_compilacao
  rem  Confere o ARQUIVO, e nao so o codigo de saida: build que termina em zero
  rem  sem produzir a pasta deixaria o servidor subir para uma tela vazia.
  if not exist "%RAIZ%\dist\web\index.html" goto :falha_compilacao

  echo.
  echo   Interface compilada. Seguindo para a aplicacao.
)

rem  --- A porta, lida da MESMA fonte que o servidor le --------------------
rem  Por `scripts\porta.mjs`, e nao por um `node -p` embutido: dentro de
rem  `for /f`, parenteses e aspas simples no comando quebram o parser do CMD, e
rem  um `JSON.parse` inline tem os dois. O porque completo esta no cabecalho do
rem  proprio script.
rem
rem  Arquivo AUSENTE devolve a porta padrao e sai com zero — e o caso normal da
rem  primeira execucao. Saida 1 significa "existe e nao e JSON".
set "PORTA="
for /f "usebackq delims=" %%p in (`node scripts\porta.mjs`) do set "PORTA=%%p"
if not defined PORTA (
  echo.
  echo   O arquivo config\app.json existe, mas esta corrompido: ele nao e um
  echo   JSON valido, e a aplicacao nao consegue ler nem a porta do painel.
  echo.
  echo   COMO RESOLVER, sem precisar entender o arquivo:
  echo.
  echo   1. Abra a pasta   "%RAIZ%\config"
  echo   2. Apague o arquivo   app.json
  echo   3. De duplo clique neste atalho outra vez.
  echo.
  echo   Nao ha risco de perder a planilha: o arquivo apagado guarda apenas
  echo   configuracao. A aplicacao volta aos valores padrao e abre a tela de
  echo   configuracao, onde voce aponta a planilha de novo. Se alguem tinha
  echo   ajustado a porta ou os limiares ali, esses ajustes se perdem - a tela
  echo   mostra quais valores estao em uso.
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
rem  Ausencia de `config\app.json` NAO barra mais a partida (H-44). Ela e
rem  apenas informada: quem cria o arquivo e a tela, ao salvar o caminho da
rem  planilha, e o operador nunca edita JSON.
echo.
if not exist "%RAIZ%\config\app.json" (
  echo   O arquivo config\app.json ainda nao existe - e normal na primeira vez.
  echo   Ele sera criado sozinho quando voce informar o caminho da planilha na
  echo   tela que vai abrir. Nao ha nada a copiar nem a editar.
  echo.
)
echo   Iniciando o CronosComex em http://127.0.0.1:!PORTA!/
echo   O navegador abre sozinho quando estiver pronto. Pode levar alguns
echo   segundos na primeira vez.
echo   FECHE ESTA JANELA para encerrar a aplicacao.
echo.

rem  O navegador abre em paralelo, e SO quando a porta responde.
rem
rem  Ate 19/08/2026 aqui havia `timeout /t 4`, e a primeira execucao real em
rem  Windows mediu o defeito: a partida demorou mais que os 4 segundos e o
rem  operador recebeu ERR_CONNECTION_REFUSED com o servidor subindo atras. O
rem  tempo nao e previsivel — `--experimental-strip-types` transpila os modulos
rem  a cada execucao, e a primeira, logo apos um `npm ci`, e a mais lenta.
rem  Numero maior so trocaria quem falha; perguntar a porta responde na hora.
rem
rem  A URL vai SEM aspas de proposito: dentro de `cmd /c "..."` nao ha forma
rem  portavel de aninhar aspas, e endereco http nao tem espaco que as exija.
rem  O `&` e incondicional: estourando a espera, o navegador abre assim mesmo —
rem  a janela ja tera o erro do servidor, que diz mais do que nao abrir nada.
start "" /b cmd /c "node scripts\esperar-porta.mjs !PORTA! & start http://127.0.0.1:!PORTA!/"

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

:falha_dependencias
echo.
echo   O download das dependencias falhou.
echo.
echo   A causa mais comum e a maquina estar sem internet: abra o navegador e
echo   veja se algum site carrega. Estando a internet funcionando, chame quem
echo   instalou a aplicacao e mostre as linhas acima desta mensagem.
goto :erro

:falha_compilacao
echo.
echo   A compilacao da interface falhou.
echo.
echo   Isto nao se resolve daqui: chame quem instalou a aplicacao e mostre as
echo   linhas acima desta mensagem.
goto :erro

:erro
echo.
pause
exit /b 1
