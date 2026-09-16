---
paths:
  - "docs/**/*.md"
  - "*.md"
---

# Números afirmados na documentação

Medido em 13/08/2026: **242 linhas** de `docs/` e `CLAUDE.md` afirmam um número.
Quatro estavam erradas, e as quatro eram do mesmo tipo — contagem sobre o
próprio repositório, escrita sem dizer o que contava.

## Duas classes, dois tratamentos

**Contagem sobre o repositório** — achados, histórias, premissas, riscos,
indicadores. Diga o **recorte** e **onde o conjunto vive**:

> os 65 achados (`A-NN`, em `docs/01-auditoria-especificacao.md`)
> os 21 indicadores **em escopo** — 22 definidos, `IND-21` fora

Sem o recorte a frase não é reconferível, e o erro é invisível: `IND-NN` tem 22
entradas e a afirmação correta é 21. Contar a família daria 22 e estaria errado.

**Medição sobre a planilha** — 649 linhas, 9 chaves de cor, 20,7% de
`DOCS ENVIADOS`. Teste nenhum confere: a regra inviolável 7 proíbe a suíte de
tocar o arquivo real. Cite **fonte e data**:

> 649 linhas de dados (medido em `H-01`, 03/08/2026)

## Ao editar uma linha que afirma número

Reconferir é obrigação de quem edita, não de quem lê depois. **Se não der para
reconferir em um comando, a frase está mal escrita** — conserte a frase, não
só o número.

## O `revisor-docs` existe, e quem o invoca é o dono

**Não há gatilho, e a ausência é decisão de 11/09/2026, não esquecimento.**
Nenhuma skill o chama, nenhum hook o dispara, e esta rule **não** manda
invocá-lo — ela diz o que ele faz, para a decisão ser informada.

O que ele pega, e o portão não: `tests/repo/documentacao.test.ts` cobra o que é
computável — índice, contagens, matriz, requisito revogado. Medido em
11/09/2026, **zero das 5.458 citações de ID em prosa apontam para identificador
inexistente**: o defeito não é o ID que sumiu, é o ID que existe e **diz outra
coisa**. Isso é semântica, e nenhuma asserção a alcança.

**O que a medição diz sobre quando ele se paga**, para quem for decidir:

- o retorno cresce com o **tamanho** e com a **densidade de citação cruzada** —
  23 achados em 584 linhas de épico novo, 15 em 231 de um agente; emenda de três
  linhas não tem o que ele ache;
- ele custa **~200 mil tokens e ~20 minutos** por invocação;
- **não é reprodutível**: três execuções sobre o mesmo diff concordaram em 23%,
  e metade dos achados apareceu uma vez só. Uma execução limpa **não** é prova
  de que não há defeito.
