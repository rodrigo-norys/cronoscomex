@echo off
rem  CronosComex - atalho de partida.
rem
rem  Este arquivo existe para que o ponto de partida esteja na PRIMEIRA pasta
rem  que o operador abre: quem extrai o zip ve a raiz, nao `scripts\`.
rem
rem  Ele NAO repete verificacao nenhuma. Node instalado, Node 22 ou maior,
rem  interface compilada, porta, servidor - tudo continua em
rem  `scripts\iniciar.cmd`, que e o arquivo exercido na maquina do operador e o
rem  unico que `PD-06` acompanha. Duplicar a logica aqui criaria duas copias, e
rem  a segunda envelheceria em silencio.
rem
rem  `call` e obrigatorio: sem ele o controle nao volta para ca, e o `pause` das
rem  mensagens de erro do script chamado nao chega a rodar nesta janela - o
rem  operador veria a janela fechar antes de ler o que fazer.
rem
rem  `%~dp0` e a pasta DESTE arquivo, com barra final, e por isso o caminho
rem  abaixo nao leva separador extra. O `cd` do script chamado continua
rem  resolvendo a raiz por conta propria, a partir de onde ele mesmo esta.

call "%~dp0scripts\iniciar.cmd"
exit /b %ERRORLEVEL%
