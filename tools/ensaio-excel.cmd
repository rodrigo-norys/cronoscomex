@echo off
REM Lancador de tools/ensaio-excel.ps1 para o schtasks.
REM
REM O comando precisa estar num .cmd: /tr executa o programa SEM shell, entao
REM aspas aninhadas quebram e o redirecionador vira argumento literal. O .cmd
REM absorve as duas coisas, e o /tr fica sem uma aspa sequer.
REM
REM %~dp0 resolve o diretorio deste arquivo, com barra final -- o script e o
REM gesto.json viajam juntos para a area de ensaio, e nenhum caminho absoluto
REM da maquina do operador fica gravado aqui.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensaio-excel.ps1"
