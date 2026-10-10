---
paths:
  - "scripts/**"
---

# A partida na máquina do operador — `PD-06`

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> o agente lê arquivo do `paths:` com `Read` e, conforme a versão do Claude Code,
> também quando o escreve, o edita ou o lê pelo shell (ADR-0007) — mas, medido,
> nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** o disparo de `main()` por `pathToFileURL` é imposto por
> `tests/http/partida.test.ts`, que cita esta rule ao reprovar. O resto só se
> prova em Windows: `verify-windows.yml`, que não é obrigatório, e a máquina do
> operador.

**O único ambiente onde a aplicação roda de verdade é o único que a suíte não
cobre.** Esta régua carrega ao abrir `scripts/`, que é onde a partida mora.

**Ao mexer em `scripts/`, pergunte primeiro o que só falha em Windows:**
separador de caminho, `file://`, code page, aspas, `%~dp0`, e o `PATH` de uma
janela aberta antes de instalar o Node.

## Teste de tela por SSH não vale — a Sessão 0

**Processo iniciado por SSH no Windows cai na Sessão 0**, a sessão de serviços,
que **não tem desktop por design**. Qualquer diálogo do Windows falha ali com
"Mostrar um formulário ou uma caixa de diálogo restrita quando o aplicativo não
está no modo UserInteractive não é uma operação válida" — e isso **não é defeito
da aplicação**. O passo 3 de `scripts/diagnostico-seletor.mjs` mede exatamente
isso.

**Um `node` esquecido na Sessão 0 responde ao operador**, e o erro dele parece
defeito da aplicação. Mate o `node` antes de pedir teste de tela, e confira a
sessão antes de concluir qualquer coisa:

```powershell
Get-Process node | Select-Object Id, SessionId    # tem de ser a sessao do console, nunca 0
query session                                     # mostra qual e a interativa
```

Por SSH direto **dá** para testar a partida, a leitura da planilha, os caminhos de
erro do `.cmd` e as rotas. **Não dá** para testar seletor de arquivo, navegador,
foco, `:hover` e nada que precise de tela.

## A sessão gráfica, por tarefa agendada

O que não sai por SSH direto sai por `schtasks` com `/it`, que roda na sessão do
operador, onde há desktop:

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

**O ID da sessão gráfica muda entre logons.** Descubra com `query session`;
nunca fixe.

## Testar a partida sem mão humana

`schtasks /it` abre a aplicação com janela na sessão gráfica, e **`taskkill` sem
`/F`** envia o mesmo `WM_CLOSE` do clique no X. Duas armadilhas no caminho:

1. **Da Sessão 0, `MainWindowHandle` vem `0` para todo processo da sessão
   gráfica** — isolamento de sessão, não ausência de janela. Quem procura a
   janela precisa **rodar dentro** da sessão, por uma segunda tarefa `/it`.
2. **`taskkill` sem `/F` recusa entre sessões** — *"só pode ser forçada"*. Na
   mesma sessão, funciona e devolve *"sinal de encerramento enviado"*.

**O cache do npm engana o teste de "sem internet":** com o cache quente, `npm ci`
instala sem rede. Para exercer o caminho, aponte `npm_config_cache` para um
diretório vazio.

## Saber se o Excel reparou o arquivo, sem ver a tela

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

## Erros de método que já custaram tempo

- **A identidade do host se verifica fora de banda.** Se o SSH recusar com
  `REMOTE HOST IDENTIFICATION HAS CHANGED`, compare a chave pública com a da
  própria máquina antes de qualquer coisa — o DHCP já deu o endereço antigo a outro
  aparelho. Remover a chave para "destravar" rodaria os testes no aparelho errado.
- **No `cmd`, o pipe tem precedência menor que `&&`.**
  `cmd /c "set A=1 && echo S| x.cmd"` vira `(set A=1 && echo S) | x.cmd`: a
  variável fica do lado esquerdo e o script roda sem ela. Use
  `[Environment]::SetEnvironmentVariable(...,'Process')` e deixe o filho herdar.
- **Não mate todos os `cmd.exe` da Sessão 0** — um deles hospeda a sua própria
  sessão SSH.
- **`iniciar.cmd` não retorna**, por construção: ele fica no ar servindo. Em
  foreground, pendura o comando. Use `Start-Process`.
- **Acento "quebrado" no log do `.cmd` lido como UTF-8 não é defeito:** o console
  usa a code page 850, e nela a saída está certa.

**`.ps1` enviado para cá vai em ASCII puro**, e roda com
`-ExecutionPolicy Bypass` — a política da máquina é restritiva, e o `Bypass` vale
só para o processo. O PS 5.1 lê UTF-8 sem BOM como ANSI, e um travessão dentro de
string já quebrou o parser de um script inteiro.

**Cada falha é correção no `.cmd`, não história nova.**
