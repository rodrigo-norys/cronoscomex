---
paths:
  - "src/io/xlsx-surgeon.ts"
  - "src/app/write-guard.ts"
  - "tests/io/**/*.ts"
  - "tests/app/write-guard*.ts"
---

# Escrita cirúrgica no `.xlsx`

**É o ponto onde errar custa a planilha da empresa.** Esta régua carrega ao
abrir os arquivos que reescrevem bytes do arquivo do operador — e é por isso
que ela existe aqui e não no `CLAUDE.md`: lá era um parágrafo entre 6400
palavras, e o gatilho dependia de alguém lembrar dele.

## Invoque o `revisor-xml` antes de commitar

Vale para qualquer mudança em `src/io/xlsx-surgeon.ts`, em
`src/app/write-guard.ts` ou em código que reescreva bytes do `.xlsx`.

**O histórico dele é o argumento.** Em `H-24` reprovou na primeira invocação;
em `H-25`, **três das quatro**; em `H-26`, **seis das sete**; em `H-27`, **três
das quatro**. Vários defeitos foram introduzidos pelas correções dos anteriores
— então **reinvoque depois de corrigir**, não só antes de commitar.

**Ele acha defeito em código já commitado.** Em `H-27` pegou uma leitura de
atributo que varria o elemento inteiro em vez da tag de abertura — defeito
silencioso em `writeCell` desde `H-24`. **Mande o módulo inteiro**, não só o
trecho novo.

**Ele revisa a interface também.** Quatro dos seis defeitos de `H-26` estavam na
tela: mensagens que afirmavam o que o código não sabia. Ao mudar o que a
aplicação **diz** ao operador sobre a escrita, mande a tela junto.

Ele não tem `Edit` nem `Write`, e é invocado **sem** o raciocínio de quem
escreveu o código: começar cego é o mecanismo, não efeito colateral.

## A cadeia de cálculo, e a premissa que foi REFUTADA — `PD-05`, fechada em 01/09/2026

A pendência supunha que o Excel emite o atributo `i` apenas na **primeira**
entrada de `xl/calcChain.xml`, com as seguintes herdando a aba — o que a
especificação OOXML permite, e o que a fixture `formulas.xlsx` reproduz.

**Medido em dois arquivos que o Excel gerou sozinho, e os dois refutam:**

| Origem | entradas | com `i` | índices de aba |
|---|---|---|---|
| `Microsoft Excel` (desktop) | **705** | **705** | `1` e `3`, com `l` e `s` misturados |
| `Microsoft Excel Online` | 2 | 2 | `1` |

O Excel **repete `i` em toda entrada**. A omissão é permitida pela
especificação, não praticada por ele.

**`removeFromCalcChain` nunca dependeu da premissa, e é o que salva.** Ela só
injeta o índice quando a entrada seguinte **não** tem o seu — a conferência que o
`revisor-xml` pediu. Sem ela, a forma real do Excel produziria `i` **duplicado**:
XML malformado, e o arquivo abriria pedindo reparo. `tests/io/xlsx-surgeon.test.ts`
cobre as duas formas, e a mutação que remove a conferência reprova as duas.

**Nenhuma fixture nova foi versionada, e a razão é dado pessoal.** O arquivo do
Excel Online que teria servido — saída da nossa própria fixture, reaberta e
salva pelo Excel — carrega comentário encadeado com nome de pessoa. A evidência
está na medição e no teste de regressão, não num artefato novo.

**A fixture `formulas.xlsx` continua com a forma de herança de propósito**: é
ela que exercita o repasse do índice ponta a ponta, e a especificação a permite.
O que mudou é que agora se sabe que ela **não** é a forma que o Excel emite.
