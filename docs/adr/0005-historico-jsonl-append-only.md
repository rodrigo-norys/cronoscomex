# ADR-0005 — Histórico de mudanças de status em arquivo JSONL append-only

**Status:** Aceito · 03/08/2026

## Contexto

Dois itens da especificação são declarados **bloqueados por falta de histórico**
pela própria especificação:

- **Alerta "Processos parados"** (§5): *"Categoria sem alteração por um número
  de dias definido pelo negócio (depende do histórico de leituras)"*.
- **Página Histórico** (§6): *"Evolução mensal de volume, desembaraçados e
  Canal Vermelho (depende do histórico de leituras)"*.

A planilha guarda apenas o **estado atual** de cada processo. Ela não registra
quando um processo entrou na categoria em que está, nem quantos processos
estavam em cada categoria no mês passado. Nenhuma coluna existente responde a
essas perguntas, e o usuário determinou que não haverá colunas novas — o que
descarta a coluna `DATA_ÚLTIMA_ATUALIZAÇÃO` sugerida em §8.

Ao mesmo tempo, a aplicação lê a planilha inteira a cada alteração do arquivo.
Ela **observa** as transições no momento em que acontecem. A informação existe;
falta apenas persisti-la.

## Decisão

**A cada leitura, comparar a categoria de cada processo com a última conhecida
e gravar as diferenças em `data/history.jsonl`, um arquivo append-only.**

Uma linha JSON por evento:

```jsonc
{"ts":"2026-08-03T14:22:31.004Z","ref":"FT498.26","from":"em_andamento","to":"desembaracado","sourceRow":475}
```

- `from: null` na primeira vez que um REF é visto.
- Nenhum evento é gravado quando nada mudou — o arquivo cresce por **mudança**,
  não por leitura.
- A ausência de um REF numa leitura **não** gera evento: sumir da planilha não
  é uma mudança de categoria.

### O que isso destrava

| Item | Como |
|---|---|
| **ALE-06 · Processos parados** | Dias corridos entre o `ts` do último evento do REF e hoje. Limiar padrão de 15 dias, configurável (A-32) |
| **Página Histórico** | Agregação mensal dos eventos, produzindo volume, desembaraçados e Canal Vermelho por mês |

Ambos saem de "bloqueado por lacuna" para "implementável" na matriz de
rastreabilidade — resolvendo o achado A-33.

### Honestidade sobre o alcance

A série **começa quando a aplicação começa a rodar**. Não há retroatividade: o
que aconteceu antes da primeira execução não existe e não será inventado. A
interface declara `historyStartedAt` explicitamente, e a Página Histórico avisa
quando a janela pedida excede o histórico existente (A-43).

Um processo sem nenhum evento registrado tem `daysInCurrentCategory` igual a
`null`, e **não** gera alerta de parado. Contagem sem base não vira alerta.

## Consequências

### Positivas

- **Dois itens da especificação saem do limbo** sem tocar na planilha e sem
  criar colunas.
- **Custo de armazenamento proporcional a mudanças**, não a leituras. Um
  processo estável nunca gera linha.
- **Formato trivial de inspecionar.** JSONL abre em qualquer editor de texto;
  uma linha corrompida não invalida o arquivo — é ignorada, registrada em log,
  e o restante continua válido (`H-28`).
- **Descartável sem consequência.** Apagar o arquivo zera a série e nada mais.
  Nenhum dado de negócio vive ali; tudo que ele guarda é observação da
  aplicação sobre a planilha.
- **Consistente com o ADR-0001.** O histórico é derivado, não autoritativo.
- **Append-only elimina uma classe de bug:** não há atualização a corromper,
  não há registro a sobrescrever.

### Negativas

- **Sem retroatividade.** A Página Histórico é inútil nas primeiras semanas, e
  ALE-06 não dispara até o histórico amadurecer. É uma limitação estrutural,
  não um defeito.
- **Depende da aplicação rodar.** Se ficar semanas desligada, as transições
  ocorridas nesse período são perdidas: ao voltar, ela vê apenas o estado final
  e grava uma transição só, do último estado conhecido para o atual. Estados
  intermediários não observados **não são inventados** (`H-28`).
- **Precisão limitada ao intervalo entre leituras.** Se um processo mudar duas
  vezes entre duas leituras, apenas a diferença observável é registrada.
- **Crescimento indefinido.** Sem expurgo (RNF-20). Aceitável porque o volume é
  proporcional a mudanças reais de status; se algum dia incomodar, o expurgo é
  truncar o arquivo por data, sem migração.
- **O limiar de 15 dias é premissa**, não regra de negócio conhecida — a
  especificação nunca o define (A-32). Fica configurável e marcado como
  premissa na própria interface.

## Alternativas descartadas

### A1 — Manter os itens fora de escopo

Aceitar a declaração da especificação e entregar ALE-06 e a Página Histórico
como bloqueados. Descartada porque a lacuna é resolvível a custo baixo: uma
história M (`H-28`) e uma P (`H-29`). Deixar dois itens do catálogo de fora
quando o dado está disponível seria desperdício.

### A2 — Coluna `DATA_ÚLTIMA_ATUALIZAÇÃO` na planilha

Sugerida em §8 da especificação. Descartada por dois motivos independentes: o
usuário vetou colunas novas; e a coluna dependeria de alguém preenchê-la
manualmente a cada alteração, o que é exatamente o tipo de disciplina que
falha. O histórico automático é mais confiável que uma coluna manual, e por isso
esta coluna é a única de §8 marcada como **descartada por desnecessária**, e não
como adiada.

### A3 — SQLite local

Traria consulta em SQL e integridade. Descartada por instrução do usuário
("esqueça banco de dados") e porque o padrão de acesso é trivial: anexar
eventos e ler o último por REF. SQLite resolveria um problema que não existe,
ao custo de uma dependência nativa a compilar.

### A4 — Versionar cópias da planilha e reconstruir o histórico lendo as antigas

Oferecida ao usuário e por ele descartada. Uniria backup e histórico num
mecanismo só, mas consumiria muito mais disco e tornaria a Página Histórico
lenta, exigindo reparse de vários arquivos a cada abertura.

### A5 — Guardar um instantâneo completo a cada leitura

Simples de implementar, mas o arquivo cresceria proporcionalmente ao número de
leituras multiplicado pelo número de processos — inclusive quando nada muda.
Descartada em favor do registro por diferença.

## Referências

- `03-modelo-dados.md §3.1` — formato e semântica do arquivo
- A-32, A-33, A-43 em `01-auditoria-especificacao.md`
- H-28, H-29, H-21 em `06-backlog.md`
- ALE-06 e Página Histórico em `09-rastreabilidade.md`
