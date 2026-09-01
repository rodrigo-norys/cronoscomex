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

## A premissa de formato que ainda não foi confirmada — `PD-05`

Falta observar que o Excel emite o atributo `i` apenas na **primeira** entrada
de `xl/calcChain.xml`, com as seguintes herdando a aba. É o que a especificação
OOXML descreve e o que `removeFromCalcChain` pressupõe ao repassar o índice, mas
nunca foi visto num arquivo que o Excel tenha gerado sozinho — as três entradas
de `tests/fixtures/formulas.xlsx` foram escolhidas por nós.

**O resto já está coberto:** a fixture leva `l="1"` na segunda entrada desde
14/08/2026 — a forma com atributo além de `r`, que era exatamente o que escondia
o defeito de repasse do `i` —, os outros 18 componentes do zip vêm do Excel real,
e `removeFromCalcChain` **não enumera atributos**: preserva o bloco inteiro,
então `s`, `t` e `a` viajam junto sem tratamento. A saída foi aberta no Excel
real em 13/08/2026, sem aviso de reparo e com o recálculo produzindo as datas
dependentes.

**Risco baixo, e medido:** em 17/08/2026 a planilha real não tem
`xl/calcChain.xml` — o Excel só emite a parte quando há fórmula, e nenhuma das
quatro abas tem uma. O código é hoje inalcançável em produção, e passa a ser
alcançável no dia em que alguém escrever uma fórmula na aba `2026`.

**Como fechar**, em dois minutos e em qualquer máquina com Excel: planilha nova,
uma fórmula, salvar, copiar para `tests/fixtures/`. Se a via for o Excel Online,
**confira a forma da cadeia** antes de tratar o arquivo como representativo —
supor representatividade é o que produziu o defeito anterior.
