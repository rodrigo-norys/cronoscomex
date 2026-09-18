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

## Record não fica em `docs/`

**Documento datado que descreve um evento passado** — relatório de sessão,
auditoria executada, medição — nunca fica obsoleto por construção, então nenhum
critério de obsolescência o alcança e ele acumula para sempre. O histórico do
git é o arquivo dele. Remova, e deixe uma linha no log da §5 de
`docs/10-governanca.md` com o comando que recupera — `D-46` é o exemplo.

**Fica o que é referência ou explicação do estado atual**, com consumidor.

**`docs/06-backlog.md` é o sumidouro, e não é candidato a limpeza.** É lá que o
conteúdo dos outros sobrevive: foi o bloco `✅ CONCLUÍDA` que tornou os números
da revisão de estilo de 01/09/2026 (`D-48`) redundantes. Esvaziá-lo destrói o destino
das extrações.

**Extraia antes de remover**, e o destino depende do tipo:

| O que é | Vai para |
|---|---|
| decisão tomada, e decisão **recusada** | `docs/10-governanca.md` §5, ou um ADR |
| medição de que o código depende | o cabeçalho do módulo em `src/` |
| fato de configuração do repositório | `CLAUDE.md` |
| achado ainda aberto | `docs/06-backlog.md` |

**Medido em 18/09/2026**, para a próxima passada comparar. Saíram **5.713
linhas** em dois lotes, e a densidade decidiu a forma de cada um:

- os quatro relatórios de `docs/sessao-autonoma/` — 1.786 linhas, **3,4%** de
  fato inédito — viraram **três linhas** espalhadas onde são consultadas
  (`D-46`);
- as três auditorias de configuração — 3.927 linhas, **14,2%** — precisaram de
  **um documento**, e viraram `ADR-0007` (`D-47`).

**Densidade baixa extrai para linhas; densidade alta pede documento.** E o
destino de um consolidado é `adr/`, não a raiz de `docs/`: os três removidos
nasceram justamente como documento de configuração fora da numeração, sem
consumidor mecânico, e foi por isso que ninguém os revisitou em seis semanas.
A ferramenta que mede é a skill global `desinchar-docs`.
