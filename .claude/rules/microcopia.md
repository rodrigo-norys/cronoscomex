---
paths:
  - "web/src/**/*.tsx"
---

# O texto que o operador lê

Régua da microcópia da interface — subtítulo de painel, apoio de controle, nota
de rodapé, estado vazio. **Não cobre comentário de código:** isso é
`.claude/rules/comentarios.md`, que carrega num glob maior e trata de outro eixo.

## As três regras

1. **Começa com maiúscula.** Determinação do usuário em 21/09/2026, tomada ao
   corrigir à mão as duas frases do painel "Registros por mês", que nasceram
   minúsculas. Vale para a frase solta de apoio, não para item de lista dentro
   de período.

2. **Identificador de auditoria não aparece na tela.** `A-NN`, `D-NN`, `TD-NN`,
   `H-NN`, `IND-NN`, `RF-NN` e `ADR-NNNN` são vocabulário do repositório e não
   dizem nada a quem usa o painel. Medido em 21/09/2026: a ressalva do checkbox
   de categoria dizia *"recorte pela categoria — A-05 mede RG lançado em linha
   ainda não concluída"*. O fato é verdadeiro e o rótulo é interno — o porquê
   vai no comentário ao lado do código, que o operador não lê.

3. **Nome de coluna da planilha é o vocabulário DELE.** `RG`, `ETA2`, `STATUS`,
   `CLT` são o que ele vê no arquivo todo dia. "Pela data da coluna RG"
   comunica; "extremidade final do intervalo" não. Jargão de método — "recorte",
   "não acumulada", "série derivada" — pede que ele aprenda a régua antes de ler
   o número.

## O que custou mais, e não é regra de redação

**Termo que sai do produto deixa resto em outro ponto da mesma tela.** `D-58`
tirou a distinção observado/reconstruído do Histórico, e a nota de cobertura
continuou abrindo com *"A série reconstruída é derivada... e não do que a
aplicação observou"*. Quem achou foi o usuário, olhando o painel, **depois de a
entrega ter sido declarada pronta**; o nome do componente carregava o mesmo
conceito morto.

**Ao remover um conceito do produto, `grep` o termo em `web/src/` antes de
fechar** — o texto visível, o nome do componente, o `caption` da tabela e o
cabeçalho do módulo. Nenhuma guarda alcança isso, e a ausência é estrutural: o
léxico muda a cada decisão, e o que hoje é resto ontem estava correto.
