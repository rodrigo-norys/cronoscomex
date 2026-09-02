---
paths:
  - "scripts/**"
---

# A partida na máquina do operador — `PD-06`

**O único ambiente onde a aplicação roda de verdade é o único que a suíte não
cobre.** Esta régua carrega ao abrir `scripts/`, que é onde a partida mora.

## A lição que já se pagou

A aplicação **nunca subiu em Windows** entre `H-30` e 19/08/2026, porque o
disparo de `main()` comparava `import.meta.url` com `file://` concatenado a
`process.argv[1]` — verdadeiro em Linux por acidente da barra inicial, falso em
todo caminho `C:\...`. O processo carregava os módulos e saía com código
**zero**: sem erro, sem escutar. Modo de falha mudo, num trecho que nenhum teste
alcançava. Guardado desde então por `tests/http/partida.test.ts`.

**Ao mexer em `scripts/`, pergunte primeiro o que só falha em Windows:**
separador de caminho, `file://`, code page, aspas, `%~dp0`, e o `PATH` de uma
janela aberta antes de instalar o Node.

## Teste de UI por SSH não vale — a Sessão 0

**Processo iniciado por SSH no Windows cai na Sessão 0**, a sessão de serviços,
que **não tem desktop por design**. A sessão gráfica do operador é outra —
medido em 31/08/2026: `services` na 0, `console rodrigo` na 2, ativa.

O efeito é que **qualquer diálogo do Windows falha** com "Mostrar um formulário
ou uma caixa de diálogo restrita quando o aplicativo não está no modo
UserInteractive não é uma operação válida" — e isso **não é defeito da
aplicação**. `[System.Windows.Forms.SystemInformation]::UserInteractive` devolve
`False`, e é o que o passo 3 de `scripts/diagnostico-seletor.mjs` mede.

**Pior: um servidor deixado no ar por SSH contamina o teste do operador.** Em
31/08/2026 o operador abriu o painel, falou com um `node` da Sessão 0 esquecido
por uma sessão SSH, clicou no seletor e recebeu o erro — que parecia o defeito de
`H-37` e era a Sessão 0. **Mate o `node` antes de pedir teste de tela**, e confira
a sessão antes de concluir qualquer coisa:

```powershell
Get-Process node | Select-Object Id, SessionId    # tem de ser a sessao do console, nunca 0
query session                                     # mostra qual e a interativa
```

O que **dá** para testar por SSH direto: a partida, a leitura da planilha, os
caminhos de erro do `.cmd`, as rotas. O que **não** dá: seletor de arquivo,
navegador, foco, `:hover` e qualquer coisa que precise de tela.

## Mas a sessão gráfica é alcançável — por tarefa agendada

**Medido em 02/09/2026, e revisa parcialmente o que está acima.** O que não sai
por SSH **direto** sai por `schtasks` com `/it`, que roda na sessão do operador,
onde há desktop. Foi assim que um `.xlsx` produzido por `appendRow` foi aberto
no **Excel de verdade**, com a saída lida por arquivo.

```powershell
# O comando vai num .cmd. NUNCA inline.
schtasks /create /tn Tarefa /tr C:\caminho\rodar.cmd /sc once /st 23:58 /ru <usuario> /it /f
schtasks /run    /tn Tarefa
# espere o arquivo de saida aparecer, leia, e entao:
schtasks /delete /tn Tarefa /f
```

**Os dois erros que custam tempo, e cujas mensagens apontam para o lado errado:**

1. **`/create` sem `/ru`** não cria a tarefa, e o sintoma só aparece no `/query`
   seguinte, como *"O sistema não pode encontrar o arquivo especificado"* — que
   fala do **nome da tarefa**, e faz procurar o executável.
2. **`/tr` com aspas aninhadas** quebra: `schtasks` executa o programa **sem
   shell**, então `>` vira argumento literal e as opções do programa interno são
   lidas como opções dele — *"Argumento/opção inválido - '-NoProfile'"*. O `.cmd`
   absorve redireção e opções, e o `/tr` fica sem uma aspa sequer.

**Antes de concluir que um arquivo produzido aqui está corrompido, faça o
controle.** Excel por COM na Sessão 0 falha em tudo, inclusive no `SaveAs` de
uma pasta que ele mesmo acabou de criar. Peça a ele para criar e reabrir um
arquivo próprio: se isso falhar, o problema é o ambiente, e não o que você
produziu. Sem esse controle, `appendRow` teria sido declarada defeituosa.

**O ID da sessão gráfica muda entre logons** — era 2 em 31/08/2026 e 1 em
02/09/2026. Descubra com `query session`; nunca fixe.

## Como saber se o Excel REPAROU o arquivo, sem ver a tela

O banner amarelo de reparo não existe em execução headless. O sinal que o
substitui é **`Workbook.Saved`, lido logo depois do `Open`**: reparar é modificar
em memória, e a pasta abre **suja**. `Saved = True` sem ninguém ter editado
significa que o Excel carregou o arquivo sem alterar um byte.

Confirmam junto: nenhum arquivo novo em `%TEMP%` — o log de reparo cai lá — e a
leitura de volta das células, porque reparo com remoção de registros apaga a
linha nova.

**Não mate `EXCEL` por PID sem conferir `StartTime` e `SessionId`.** O `Quit()`
é assíncrono o bastante para o processo ainda aparecer depois de encerrado, e a
sessão gráfica pode ter o Excel do operador aberto com trabalho não salvo.

## O que a primeira execução real já fechou (19/08/2026)

Duplo clique · primeira execução sem `config/app.json` — que agora só informa e
a partida segue · compilação sob demanda aceita. Com ela caíram também as três
correções que estavam sem reexecução: o disparo de `main()` por `pathToFileURL`,
a espera pela porta em `scripts/esperar-porta.mjs`, e o abridor com `/min` em vez
de `start /b`.

## O que 31/08/2026 fechou

**O diálogo de arquivo de `H-37` funciona.** Era o único defeito conhecido da
pendência: em 19/08 o cursor girava sem janela. A correção — o `Form` dono
exibido e o `windowsHide` fora — foi verificada pelo operador, na sessão gráfica
dele: o botão abre o diálogo e a planilha carrega.

Fechados por medição na máquina, na mesma data:

- **a aplicação sobe** — `Server listening at http://127.0.0.1:5173`. É o bug do
  `pathToFileURL`, e não volta
- **Node ausente** → a mensagem com as instruções de instalação
- **Node abaixo da 22** → *"O Node.js instalado nesta maquina e a versao 18, e a
  aplicacao exige a 22"*
- **segunda execução com a aplicação no ar** → *"O CronosComex ja esta em
  execucao. Abrindo o navegador."*
- **primeira execução sem `config/app.json`** → `degradado`, informa e segue
- **a planilha real lida em Windows** → 649 lidas, 649 aceitas, 0 em quarentena,
  hash idêntico ao da máquina de desenvolvimento

## O que ainda não foi exercido

- janela fechada sem processo órfão — **precisa de janela**, não sai por SSH
- caminho com espaços e acentos
- os três caminhos infelizes da compilação: recusar, máquina sem internet,
  `node_modules` ausente

## Suspeitas, e o que restou delas

- ~~A detecção de "já está no ar" depende do espaçamento de colunas do
  `netstat`~~ — **descartada em 31/08/2026**: a regex casa a saída real. O falso
  negativo da primeira medição era método, não script.
- O `PATH` de uma janela aberta **antes** de instalar o Node não enxerga o
  executável novo — segue aberta.
- O caminho do projeto com acento aparece em algumas mensagens, em code page
  850 — segue aberta, e o `ver` do Windows já sai truncado por ela.

**Cada falha é correção no `.cmd`, não história nova.**
