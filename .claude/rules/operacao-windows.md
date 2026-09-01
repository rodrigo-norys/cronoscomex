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

## O que a primeira execução real já fechou (19/08/2026)

Duplo clique · primeira execução sem `config/app.json` — que agora só informa e
a partida segue · compilação sob demanda aceita. Com ela caíram também as três
correções que estavam sem reexecução: o disparo de `main()` por `pathToFileURL`,
a espera pela porta em `scripts/esperar-porta.mjs`, e o abridor com `/min` em vez
de `start /b`.

## Os sete itens que sobram

**Um tem falha conhecida:** o diálogo de escolha de arquivo de `H-37` **não
abriu** — o cursor girou sem janela nenhuma. A correção (o `Form` dono passou a
ser exibido e a opção `windowsHide` saiu) **ainda não foi testada**, e
`scripts/diagnostico-seletor.mjs` isola as quatro causas possíveis em quatro
passos. **Comece por ele.**

Os outros seis nunca foram exercidos:

- Node ausente
- Node abaixo da 22
- janela fechada sem processo órfão
- porta ocupada
- segunda execução com a aplicação no ar
- caminho com espaços e acentos
- os três caminhos infelizes da compilação: recusar, máquina sem internet,
  `node_modules` ausente

## Suspeitas abertas, cada uma virando correção no `.cmd`

- A detecção de "já está no ar" depende do **espaçamento de colunas** do
  `netstat`.
- O `PATH` de uma janela aberta **antes** de instalar o Node não enxerga o
  executável novo.
- O caminho do projeto com acento aparece em algumas mensagens, em code page 850.

**Cada falha é correção no `.cmd`, não história nova.**
