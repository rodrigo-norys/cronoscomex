# H-01 — Resultado do Perfilamento

**Arquivo:** `CONTROLE DOS EMBARQUE.xlsx` · 293.386 bytes
**Executado em:** 03/08/2026, por `tools/profile_workbook.py` (Python stdlib)
**Relatório completo:** [perfilamento-20260803.json](perfilamento-20260803.json)

Todos os números abaixo têm origem **medido** — vêm de execução real de código
sobre o arquivo real. Nenhum é estimativa.

> **Sanitização:** o relatório JSON teve as amostras de colunas identificáveis
> (cliente, importador, agente, navio, mercadoria, BL, CNTR, REF) e o conteúdo
> inteiro da aba `CNPJ` removidos antes de ser gravado no repositório. O perfil
> bruto não foi versionado.

---

## 1. Estrutura do arquivo

O `.xlsx` contém **30 entradas** no zip, entre elas:

| Entrada | Significado |
|---|---|
| `xl/worksheets/sheet1..4.xml` | **4 abas**, não uma |
| `xl/tables/table1.xml` | Uma Tabela do Excel (ListObject) |
| `xl/comments1.xml`, `xl/threadedComments/`, `xl/persons/` | Comentários encadeados |
| `xl/drawings/vmlDrawing1.vml` | Desenho legado dos comentários |
| `customXml/item1..3.xml` | Metadados de SharePoint |

**Consequência direta:** reserializar o workbook destruiria tabela, comentários
encadeados e os metadados de SharePoint. O ADR-0004 (escrita cirúrgica) deixa
de ser precaução teórica e passa a ter evidência no próprio arquivo.

---

## 2. Abas

| Aba | Linhas de dados | Colunas | Cabeçalho | Escopo |
|---|---|---|---|---|
| **2026** | **649** | 16 (A–P) | linha 1 | **Única no escopo** |
| 2025 | 665 | 14 (A–N) | linha 1 | Fora — decisão do usuário |
| 2024 | 191 | 12 (A–L) | linha 1 | Fora — decisão do usuário |
| CNPJ | 28 | — | linha 2 | **Excluída — dado sensível** |

### Divergência de esquema entre as abas

| Aspecto | 2026 | 2025 | 2024 |
|---|---|---|---|
| Coluna A | `REF` | `REF. FAITH` | `REF` |
| IMPORTADOR | sim (C) | sim (C) | **ausente** |
| DOCS ENVIADOS | sim (O) | **ausente** | **ausente** |
| Coluna de status | `STATUS` (L) | `STATUS` (L) | `ANDAMENTO` (L) |
| Colunas chamadas "ETA" | 1 (H) + `ETA2` (I) | **2** (H e I) | **2** (G e I) |
| Extra | `Coluna1` (P) | — | `ARMAD` (H) |

A especificação funcional descreve **apenas** o esquema de 2026.

### Aba CNPJ — fora de escopo por conter dado sensível

Contém 28 linhas de dado cadastral e de acesso de terceiros. O inventário
detalhado das colunas **não é versionado**: descrever a estrutura de um dado
sensível é descrever onde ele está.

A aplicação **não lê, não exibe e não registra** essa aba — decisão de escopo
D-10, motivada pelo achado A-47. A exposição em si é anterior a este projeto e
independe dele, mas fica registrada.

---

## 3. Aba 2026 — colunas

649 linhas de dados. `emptyRatio` = fração de linhas com a célula vazia.

| Col | Cabeçalho | Preenchidas | Distintos | Vazio | Observação |
|---|---|---|---|---|---|
| A | REF | 649 | **649** | 0,0% | **Zero duplicatas, zero vazios** |
| B | CLT | 611 | 508 | 5,9% | |
| C | IMPORTADOR | 614 | 25 | 5,4% | Cardinalidade baixa |
| D | BL | 585 | 583 | 9,9% | Quase único, como a spec previa |
| **E** | **AGENTE** | **576** | **35** | 11,2% | **P-01 confirmada** |
| F | CNTR | 585 | 584 | 9,9% | |
| G | NAVIO | 585 | 74 | 9,9% | |
| H | ETA (porto) | 607 | **5** | 6,5% | `RIO`, `MULTIRIO`, `MULTI`, `SC`, **`RO`** |
| I | ETA2 | 585 | 90 | 9,9% | **585 datas reais** |
| J | MERCADORIA | 592 | 221 | 8,8% | |
| K | RG | 483 | 102 | 25,6% | **483 datas reais** |
| L | STATUS | 583 | 63 | 10,2% | |
| M | Coluna 13 | 532 | 6 | 18,0% | Fora de escopo |
| N | R$ ENVIADO | 369 | 123 | 43,1% | Tipo misto: 44 datas + texto |
| O | DOCS ENVIADOS | **134** | 35 | **79,3%** | 133 datas + 1 número |
| P | **`Coluna1`** | **1** | 1 | **99,9%** | Coluna de tabela vazia |

---

## 4. P-03 — as datas têm ano. **R-03 não se materializa.**

O achado de maior impacto do perfilamento.

| Coluna | Data real do Excel | Texto com ano | **Texto sem ano** |
|---|---|---|---|
| I · ETA2 | **585** | 0 | **0** |
| K · RG | **483** | 0 | **0** |
| O · DOCS ENVIADOS | **133** | 0 | **0** |

Todas as células de data são **seriais numéricos** (`46021`, `46027`), apenas
*exibidos* como `dd/mmm`. O ano está no dado e sempre esteve — o que as fotos
mostravam era formato de exibição, não conteúdo.

**Faixa real de ETA2:** 2025-12-30 a 2026-09-09.

**Consequência:** os 12 indicadores e 4 alertas que estavam "Condicionados a
P-03" passam a **Implementável**. A regra 5 de TD-03 (não inferir ano) continua
no código como defesa, mas não será exercitada por esta aba.

---

## 5. P-06 — as cores reais. O dicionário da especificação não bate.

Chave de estilo extraída da célula da coluna A, para as 649 linhas com REF.
`fillId` é o índice em `xl/styles.xml` — o valor que a escrita usa.

| Chave de estilo | fillId | Linhas | Significado (§3 da spec) |
|---|---|---|---|
| `argb:FF00FF00` | 2 | 258 | Verde — desembaraçado |
| `argb:FF00FF0D` | 12 | 219 | **Verde, segundo tom — não previsto** |
| `argb:FF5B9BD5` | 8 | 120 | Azul — Colaborador 1 |
| `argb:FFA74F7B` | 27 | 31 | Roxo — Colaborador 2 |
| `argb:FFFFE599` | 9 | 9 | Bege — Colaborador 1, outros clientes |
| `argb:FFFF0000` | 7 | 5 | Vermelho — Canal Vermelho |
| `argb:FFA64D79` | 11 | 5 | **Roxo, segundo tom — não previsto** |
| `argb:FFFFFF00` | 10 | 1 | Amarelo forte — importador fora do RJ |
| `theme:0\|tint:0.0000` | 13 | 1 | Branco (do tema) |
| | | **649** | |

Três achados:

1. **Dois tons por cor.** `FF00FF00`/`FF00FF0D` e `FFA74F7B`/`FFA64D79` são
   visualmente indistinguíveis e ocupam **blocos contíguos** — verde A nas
   linhas 2–263, verde B nas 264–483. Padrão de quem pintou em momentos
   diferentes. Por decisão do usuário, cada par é unificado.
2. **"Branco" praticamente não existe:** 1 linha em 649. O dicionário de §3
   trata branco como categoria operacional relevante.
3. **Nenhuma cor de tema com tint** apareceu. O defeito
   [#1690 do ExcelJS](https://github.com/exceljs/exceljs/issues/1690) **não é
   exercitado** por este arquivo, o que reduz R-05 na prática. A decisão de
   ADR-0003 continua correta e agora é barata.

### A cor não confirma o status — comprovado com número

| | Linhas |
|---|---|
| Cor verde (soma dos dois tons) | 477 |
| STATUS = `DESEMBARAÇADA` (grafia exata) | 479 |
| STATUS vazio | 66 |
| Cor branca | **1** |

Se a cor determinasse o status, haveria 66 linhas brancas. Há uma.
**O achado A-04 fica quantitativamente comprovado:** cor e STATUS são campos
independentes, e a cor nunca infere a categoria.

### Uma cor é produzida por vários `styleId`

| Chave | styleIds que a produzem |
|---|---|
| `argb:FF00FF00` | 199 (236 linhas), 165 (21), 189 (1) |
| `argb:FF00FF0D` | 201 (213), 227 (4), 207 (2) |
| `argb:FF5B9BD5` | 181, 282, 283 |
| `argb:FFFF0000` | 202, 171, 212 |

Os `cellXf` diferem em **borda e fonte**, não em preenchimento — por exemplo,
`styleId 199 = (fill 2, font 1, border 34)` contra
`styleId 165 = (fill 2, font 1, border 5)`.

**Consequência para a leitura:** nenhuma. Os três styleIds colapsam na mesma
chave, que é exatamente o que ADR-0003 pretende.

**Consequência para a escrita:** `H-27` estava errada. Trocar o `styleId`
inteiro por um valor fixo **destruiria a borda e a fonte** da linha. A história
foi corrigida para trocar apenas o `fillId`, preservando os demais atributos do
`cellXf`.

---

## 6. STATUS — 63 valores distintos

| Valor | Ocorrências |
|---|---|
| `DESEMBARAÇADA` | 479 |
| *(vazio)* | 66 |
| `AG BL ORIGINAL` | 17 |
| `NCM 28/07` | 14 |
| `DOCS APROVADOS  - AG CONFECÇÃO DE DUIMP` | 8 |
| `NCM 23/07` | 5 |
| `AG APROVAÇÃO DE DOCS` | 2 |
| `DRAFT RECEBIDO 30/07` | 2 |
| **`DESEMBARÇADA`** | **1** |
| `DESEMBARAÇADA 03/02` | 1 |
| `DESEMBARAÇADA 28/01` | 1 |
| `DUIMP: 26BR…- CANAL AMARELO` | 1 |
| `DUIMP: 26BR…- CONFERIDO …` | 5 (valores distintos) |

**A-03 confirmado com o dado real:** a grafia `DESEMBARÇADA`, sem o segundo
"A", existe de fato — 1 ocorrência. O dicionário de variantes de TD-02 tinha
razão de existir.

**Achado novo:** `DESEMBARAÇADA 03/02` e `DESEMBARAÇADA 28/01` — dois processos
concluídos com a data anexada ao texto. Pela regra de §2.1, seriam classificados
como **"Em andamento"**. São o caso `VARIANTE_STATUS_PROXIMA` de TD-02, agora
com valores concretos.

---

## 7. Premissas — situação após o perfilamento

| Premissa | Situação | Resultado |
|---|---|---|
| **P-01** · coluna E é AGENTE | ✅ **Confirmada** | Cabeçalho literal `AGENTE`, 576 valores, 35 distintos |
| **P-02** · coluna P irrelevante | ✅ **Confirmada** | `Coluna1`, 1 valor em 649 linhas (99,9% vazia) |
| **P-03** · datas têm ano | ✅ **Confirmada** | 1.201 células de data, **zero** texto sem ano |
| **P-04** · uma aba | ❌ **Refutada** | 4 abas, 3 com esquemas distintos |
| **P-05** · coluna A ancora a cor | ✅ **Confirmada** | 649 de 649 linhas com chave de estilo em A |
| **P-06** · cores do dicionário §3 | ⚠️ **Parcialmente refutada** | 9 chaves reais; dois tons por cor; branco quase inexistente |
| **P-07** · volume e crescimento | ✅ **Medido** | 649 linhas na aba corrente; crescimento ainda a informar |

---

## 8. Requisitos não-funcionais — agora medidos

| RNF | Valor | Origem |
|---|---|---|
| RNF-01 · linhas de dados | **649** (aba 2026) | medido |
| RNF-02 · crescimento mensal | **pendente** — ainda depende de você | — |
| RNF-03 · colunas | **16** (A–P) | medido |
| RNF-04 · tamanho do arquivo | **293.386 bytes** | medido |
| RNF-05 · cardinalidade | CLT 508 · IMPORTADOR 25 · AGENTE 35 · NAVIO 74 · porto 5 | medido |
| RNF-06 · vazios por coluna | tabela da seção 3 | medido |
| RNF-07 · chaves de estilo | **9** | medido |

**O volume valida a arquitetura.** 649 linhas × 16 colunas cabem
folgadamente em memória: R-10 (volume acima do previsto) cai de score 6 para
praticamente nulo, e o ADR-0006 (indicadores em memória) fica confortável mesmo
se o arquivo triplicar.

---

## 9. O que mudou no plano

| Documento | Mudança |
|---|---|
| `00-visao-escopo.md` | P-01 a P-07 resolvidas; escopo de abas fixado; princípio "planilha é referência prioritária" |
| `02-requisitos.md` | RNF-01 a RNF-07 com origem `medido` |
| `01-auditoria-especificacao.md` | Achados **A-46 a A-55**, todos por evidência do arquivo |
| `03-modelo-dados.md` | TD-05 passa a operar por `fillId`; `status-aliases.json` com as variantes reais |
| `06-backlog.md` | **H-27 corrigida** (fillId, não styleId); H-01 concluída |
| `09-rastreabilidade.md` | 16 itens saem de "Condicionado" para "Implementável" |
| `07-plano-entrega.md` | R-03 encerrado; R-05 e R-10 reduzidos; riscos novos R-13 e R-14 |
| `config/color-map.json` | Deixa de ser esqueleto: 9 entradas reais |
