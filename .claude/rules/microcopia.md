---
paths:
  - "web/src/**/*.tsx"
---

# O texto que o operador lê

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> o agente lê arquivo do `paths:` com `Read` e, conforme a versão do Claude Code,
> também quando o escreve, o edita ou o lê pelo shell (ADR-0007) — mas, medido,
> nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** a regra 2 — identificador de auditoria não aparece na tela — é imposta
> por `tests/repo/microcopia.test.ts`, que cita esta rule ao reprovar. As regras 1
> e 3 são julgamento, e quem as cobra é a revisão.

Régua da microcópia da interface — subtítulo de painel, apoio de controle, nota
de rodapé, estado vazio. **Não cobre comentário de código:** isso é
`.claude/rules/comentarios.md`, que carrega num glob maior e trata de outro eixo.

## As três regras

1. **Começa com maiúscula**, por determinação do usuário. Vale para a frase solta
   de apoio, não para item de lista dentro de período.

2. **Identificador de auditoria não aparece na tela.** `A-NN`, `D-NN`, `TD-NN`,
   `H-NN`, `IND-NN`, `RF-NN` e `ADR-NNNN` são vocabulário do repositório e não
   dizem nada a quem usa o painel. Exemplo: a ressalva do checkbox de categoria
   dizia *"recorte pela categoria — A-05 mede RG lançado em linha
   ainda não concluída"*. O fato é verdadeiro e o rótulo é interno — o porquê
   vai no comentário ao lado do código, que o operador não lê.

3. **Nome de coluna da planilha é o vocabulário DELE.** `RG`, `ETA2`, `STATUS`,
   `CLT` são o que ele vê no arquivo todo dia. "Pela data da coluna RG"
   comunica; "extremidade final do intervalo" não. Jargão de método — "recorte",
   "não acumulada", "série derivada" — pede que ele aprenda a régua antes de ler
   o número.

## O que custou mais, e não é regra de redação

**Termo que sai do produto deixa resto em outro ponto da mesma tela.** Quando
`D-58` tirou a distinção observado/reconstruído do Histórico, a nota de cobertura e
o nome do componente continuaram com ela — e quem achou foi o usuário, depois de a
entrega ter sido declarada pronta.

**Ao remover um conceito do produto, `grep` o termo em `web/src/` antes de
fechar** — o texto visível, o nome do componente, o `caption` da tabela e o
cabeçalho do módulo. Nenhuma guarda alcança isso, e a ausência é estrutural: o
léxico muda a cada decisão, e o que hoje é resto ontem estava correto.
