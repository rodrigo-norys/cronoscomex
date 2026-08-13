---
paths:
  - "src/**/*.ts"
  - "web/**/*.{ts,tsx}"
  - "tests/**/*.ts"
---

# Comentários

Régua derivada da literatura, não de gosto. A derivação com as fontes está em
`docs/08-qualidade-operacao.md §6` — abra só se for discutir a régua em si.

## As quatro regras

1. **Diz o que não é óbvio no código.** Comentário que repete a linha ao lado é
   ruído. Se o código não está claro, o conserto é renomear ou extrair — não
   comentar.
2. **Diz o porquê, não o quê.** Exceção admitida: regex e algoritmo denso, onde
   o "o quê" também não é óbvio.
3. **Cabeçalho de módulo define a invariante** — o que o módulo garante e o que
   ele nunca faz — sem descrever implementação que quem chama não precisa saber.
4. **Todo fato medido cita a fonte:** `A-NN`, `TD-NN`, `H-NN`, `IND-NN` ou o
   caminho do documento. "Medido: 40 linhas para 25 processos (A-60)", nunca
   "medido: 40 linhas". `tests/repo/contratos.test.ts` verifica que a âncora
   existe — número sem âncora é afirmação que ninguém consegue reconferir.

## Convenções deste repositório

- **Sem acento nos comentários de `src/` e `web/`**: medido em 1.837 linhas de
  comentário, 96% sem acento. O markdown de `docs/` usa acento normalmente.
- Cabeçalho vem **depois dos imports**, em bloco `/** */`.
- Comentário em JSON de `config/` usa chave prefixada — `_comentario`,
  `_origem`, `_evidencia`. Elas são lidas em execução: não remova nem renomeie.

## Ao editar código que já tem comentário

O comentário que descreve o que você mudou é **parte da mudança**. Mudança
inconsistente entre código e comentário tem ~1,5× mais chance de introduzir bug
(Wen et al., ICPC 2019). O defeito medido não é o comentário ausente — é o que
ficou para trás.
