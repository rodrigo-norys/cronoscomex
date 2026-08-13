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
