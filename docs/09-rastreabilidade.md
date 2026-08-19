# 09 — Matriz de Rastreabilidade

Uma linha por indicador (22) e por alerta (6) da especificação funcional.
**Cobertura total: 28 linhas.** Nenhum item da especificação fica de fora, e
nenhuma história existe sem aparecer em ao menos uma linha (verificado na
seção 4).

**Cadeia base**, pré-requisito de todos os itens e omitida das linhas para
legibilidade: `H-02` → `H-03` → `H-05` → `H-06` → `H-07` → `H-08`.

**Legenda de status:**
- ✅ **Backend entregue** — a regra está calculada e servida pela API, com teste.
  A apresentação pode continuar pendente da história de interface.
- ✅ **Implementável** — todos os campos existem, a regra está formalizada e as
  premissas foram confirmadas por medição.
- **Bloqueado** — falta dado na origem; nenhuma implementação é possível sem
  mudar a planilha.

> **`H-01` foi executada em 03/08/2026.** Os 16 itens antes marcados como
> "Condicionado" passaram a **Implementável**: P-01, P-03 e P-06 foram
> confirmadas por medição sobre `CONTROLE DOS EMBARQUE.xlsx`, aba `2026`
> (649 linhas). Resultado em [perfilamento/RESULTADO.md](perfilamento/RESULTADO.md).

---

## 1. Indicadores (§4)

| # | Indicador | Campos de origem | Regra de cálculo formalizada | Histórias | Testes | Status |
|---|---|---|---|---|---|---|
| IND-01 | Quantidade de processos | REF | `count(ref ≠ '')`, incluindo `fechado_aguardando_draft` | H-09, H-16 | `indicators-counts.test.ts` · `process-builder.test.ts` | ✅ **Entregue** — backend em `H-09`, cartão em `H-16`. Medido: 649 |
| IND-02 | Processos em andamento | STATUS | `count(category = 'em_andamento')`. Não somar com `em_desembaraco` (§2.1) | H-09, H-16 | `indicators-counts.test.ts` · `status-classifier.test.ts` | ✅ **Entregue** — backend em `H-09`, cartão em `H-16`. Medido: 649 |
| IND-03 | Processos em desembaraço | STATUS | `count(category = 'em_desembaraco')` — STATUS vazio após trim | H-09, H-16 | `indicators-counts.test.ts` · `status-classifier.test.ts` | ✅ **Entregue** — backend em `H-09`, cartão em `H-16`, acrescentado por A-12. Medido: 32 |
| IND-04 | Processos desembaraçados | STATUS | `count(category = 'desembaracado')`, via dicionário de variantes (TD-02) | H-09, H-16 | `indicators-counts.test.ts` · `status-classifier.test.ts` | ✅ **Entregue** — backend em `H-09`, cartão em `H-16`. Grafia `DESEMBARÇADA` tratada (A-03). Medido: 480 |
| IND-05 | Fechado — aguardando draft | REF + todas as demais colunas | `count(category = 'fechado_aguardando_draft')`. Regra §2.2 precede §2.1 (A-22) | H-09, H-16 | `status-classifier.test.ts` · `process-builder.test.ts` | ✅ **Entregue** — backend em `H-09`, cartão em `H-16`. Medido: 649 |
| IND-06 | Canal Vermelho | Cor da linha (célula A) | `count(customsChannel = 'vermelho')`. **Só a cor é fonte**; texto em STATUS vira anomalia (A-06) | H-04, H-12, H-16, H-27 | `color-mapper.test.ts` · `indicators-risk.test.ts` | ✅ **Entregue** — backend em `H-12`, cartão em `H-16`. As 9 chaves reais mapeadas, cobertura 100%. Medido: 5 |
| IND-07 | Containers chegando hoje | ETA2 | `count(eta2 = hoje)`, fuso `America/Sao_Paulo` | H-10, H-16 | `indicators-calendar.test.ts` | ✅ **Entregue** — backend em `H-10`, cartão em `H-16`. P-03 confirmada: 585 datas reais, zero texto sem ano. Medido: 0 |
| IND-08 | Containers chegando esta semana | ETA2 | `count(hoje ≤ eta2 ≤ domingo ISO)`. Semana segunda–domingo (A-07) | H-10, H-16 | `indicators-calendar.test.ts` | ✅ **Entregue** — backend em `H-10`, cartão em `H-16`. P-03 confirmada |
| IND-09 | Containers chegando em 15 dias | ETA2 | `count(hoje ≤ eta2 ≤ hoje+15)`, extremos inclusivos (A-35) | H-10, H-16 | `indicators-calendar.test.ts` | ✅ **Entregue** — backend em `H-10`, cartão em `H-16`. P-03 confirmada |
| IND-10 | Clientes com mais processos | CLT | `count` agrupado por `normKey(CLT)`, desc; desempate alfabético (A-25, A-26) | H-11, H-18 | `indicators-rankings.test.ts` · `normalizer.test.ts` · `Clients.test.tsx` | ✅ **Entregue** — backend em `H-11`, ranking em `H-18`. Medido: o maior grupo é `(sem valor)`, com 38 — o topo do ranking é um buraco de preenchimento |
| IND-11 | Importadores com mais processos | IMPORTADOR | `count` agrupado por `normKey(IMPORTADOR)`, desc | H-11, H-18 | `indicators-rankings.test.ts` · `Clients.test.tsx` | ✅ **Entregue** — backend em `H-11`, ranking em `H-18`. Medido: o maior importador tem 77 processos |
| IND-12 | Navios previstos | NAVIO + ETA2 | `lista(vessel, eta2)` onde `eta2 ≥ hoje`, asc por `eta2` e depois por `vesselKey` (A-24) | H-10, H-17 | `indicators-calendar.test.ts` · `Operational.test.tsx` | ✅ **Entregue** — backend em `H-10`, calendário em `H-17`. `arrivalCalendar` é um **recorte** dele com teto de 15 dias; IND-12 segue sem teto, por definição. Medido: 16 grupos (navio, dia), 8 dentro do horizonte |
| IND-13 | Mercadorias | MERCADORIA | `count` agrupado por `normKey(MERCADORIA)`, desc, com `bazarShare` exposto (A-34) | H-11, H-18 | `indicators-rankings.test.ts` · `Clients.test.tsx` | ✅ **Entregue** — backend em `H-11`, ranking em `H-18`, atribuído por **A-65**: antes nenhuma página o exibia. **Limitação medida:** `BAZAR` são 210 processos, 35,47% dos que têm mercadoria — 5,7× o segundo colocado real. Exposta em `meta.bazarShare` (A-34), e exibida **dentro** da seção que ela qualifica, acima da lista. Medido: o segundo colocado real tem 37 |
| IND-14 | Documentos pendentes | DOCS ENVIADOS + ETA2 + STATUS | `count(docsSent = null ∧ eta2 ≤ hoje+10 ∧ category ≠ 'desembaracado')` (A-08) | H-12, H-16 | `indicators-risk.test.ts` | ✅ **Entregue** — backend em `H-12`, cartão de urgência em `H-16` (A-40), visualmente distinto dos de volume |
| IND-15 | Processos atrasados | ETA2 + STATUS | `count(eta2 < hoje ∧ category ≠ 'desembaracado')`. `eta2 = null` nunca satisfaz (A-20) | H-12, H-16 | `indicators-risk.test.ts` | ✅ **Entregue** — backend em `H-12`, cartão de urgência em `H-16` (A-40), visualmente distinto dos de volume |
| IND-16 | Processos desembaraçados hoje | RG + STATUS | `count(rg = hoje ∧ category = 'desembaracado')`. Cruzamento acrescentado por A-05 e A-29 | H-13, H-16 | `indicators-time.test.ts` · `Home.test.tsx` | ✅ **Entregue** — backend em `H-13`, cartão em `H-16`. **O cartão faltava na lista dos 11 e foi acrescentado por A-64:** esta linha o atribuía a `H-16` e o backlog não o previa. **O cruzamento de A-29 é necessário na prática:** medidas 3 linhas com RG preenchido em processo não desembaraçado |
| IND-17 | Ranking de agentes | AGENTE | `count` agrupado por `normKey(AGENTE)`, desc, com `overdueCount` para atender ao objetivo declarado (A-27) | H-11, H-19 | `indicators-rankings.test.ts` · `Performance.test.tsx` | ✅ **Entregue** — backend em `H-11`, ranking em `H-19`, atribuído por **A-65**: antes nenhuma página o exibia, e o `overdueCount` de A-27 não chegava ao operador. Exibido ao lado da contagem, e **zero atraso aparece como `0`**, nunca como coluna vazia. P-01 confirmada: coluna E é `AGENTE`, 576 valores, 35 distintos. Medido: `B&M` tem 246 processos e 7 atrasados |
| IND-18 | Ranking de clientes | CLT | Top 10 de IND-10, apresentação visual (A-25) | H-11, H-18 | `indicators-rankings.test.ts` · `Clients.test.tsx` | ✅ **Entregue** — backend em `H-11`, barras horizontais em `H-18`. O corte vem de `meta.topN`, e a página o anuncia em vez de fixar 10 |
| IND-19 | Ranking de importadores | IMPORTADOR | Top 10 de IND-11, apresentação visual | H-11, H-18 | `indicators-rankings.test.ts` · `Clients.test.tsx` | ✅ **Entregue** — backend em `H-11`, barras horizontais em `H-18` |
| IND-20 | Ranking por responsável | Cor da linha (célula A) | `count` agrupado por `responsible`, com as 4 chaves sempre presentes, inclusive `indefinido` (A-17, A-18, A-28) | H-04, H-11, H-19, H-27 | `color-mapper.test.ts` · `indicators-rankings.test.ts` · `Performance.test.tsx` | ✅ **Entregue** — backend em `H-11`, ranking em `H-19`, atribuído por **A-65**. 9 chaves mapeadas, e o rótulo passou a ser o legível (`Indefinido`, não `indefinido`), resolvido no domínio. **A linha não é clicável**: A-18 faz o filtro `colaborador1` arrastar `colaborador1_outros_clientes`, e o recorte não bateria com a contagem. Limitação estrutural mantida (A-31, R-02): 477 linhas verdes sem responsável |
| IND-21 | Tempo médio até desembaraço | — | Exigiria `DATA_PRESENÇA_DE_CARGA − RG`. A coluna **não existe** e o usuário determinou que não haverá colunas novas | — | — | **Bloqueado por lacuna.** A própria especificação (§4, observação) já o declara fora de escopo. Custo da decisão registrado em `03-modelo-dados.md §5` |
| IND-22 | Tempo médio de envio documental | RG + DOCS ENVIADOS | `avg(rg − docsSent)` em dias. Ordem da subtração corrigida por A-02; negativos e pares incompletos excluídos e contados (A-30) | H-13, H-19 | `indicators-time.test.ts` · `Performance.test.tsx` | ✅ **Entregue** — agregado em `H-13`, quebras por cliente, agente, navio e responsável em `H-19`. **Ordenadas por tamanho da amostra, não por volume:** dos 509 grupos de cliente, 425 não têm par completo, e por volume o topo da tabela seria só traço. A soma das quebras reproduz o agregado (101, 1, 547). P-03 confirmada. **Medido:** média 12,5 dias sobre amostra de 101 (15,6% da base), com 1 negativo e 547 pares incompletos. A exclusão de A-30 não era hipótese |

---

## 2. Alertas (§5)

| # | Alerta | Campos de origem | Condição formalizada | Histórias | Testes | Status |
|---|---|---|---|---|---|---|
| ALE-01 | ETA vencida | ETA2 + STATUS | `eta2 < hoje ∧ category ≠ 'desembaracado'`. Severidade 1. Mesma regra de IND-15, duas apresentações (A-19) | H-14, H-20 | `alerts.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — backend em `H-14`, fila em `H-20`. Apresentação de `isOverdue`, nunca reimplementada. **Medido:** 17 na planilha real |
| ALE-02 | Documentação pendente | DOCS ENVIADOS + ETA2 + STATUS | `docsSent = null ∧ eta2 ≤ hoje+10 ∧ category ≠ 'desembaracado'`. Severidade 3 | H-14, H-20 | `alerts.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — backend em `H-14`, fila em `H-20`. Apresentação de `hasPendingDocs`, extraído de `pendingDocsCount` para não duplicar A-08. **Medido:** 14 |
| ALE-03 | Canal Vermelho | Cor da linha (célula A) | `customsChannel = 'vermelho'`. Severidade 2. Só a cor é fonte (A-06) | H-04, H-14, H-20 | `alerts.test.ts` · `color-mapper.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — backend em `H-14`, fila em `H-20`. **Medido:** 2 — eram 5 antes do filtro de A-59, e 3 estavam em processo já concluído. Conferido em `H-20`: zero processos concluídos na fila |
| ALE-04 | Chegadas hoje | ETA2 | `eta2 = hoje`. Severidade 5 | H-14, H-20 | `alerts.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — backend em `H-14`, fila em `H-20`. Contido em ALE-05 por construção (A-60). **Medido:** 0 — zero **medido**, distinto na tela do zero não mensurável de ALE-06 |
| ALE-05 | Chegadas nos próximos 7 dias | ETA2 | `hoje ≤ eta2 ≤ hoje+7`, extremos inclusivos. Severidade 6 | H-14, H-20 | `alerts.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — backend em `H-14`, fila em `H-20`. **Medido:** 7 |
| ALE-06 | Processos parados | STATUS + histórico de leituras | `dias desde o último evento de mudança ≥ 15` (limiar configurável, A-32). Severidade 4 | H-28, H-29, H-20 | `history-store.test.ts` · `alerts.test.ts` · `Alerts.test.tsx` | ✅ **Entregue** — dado em `H-28`, alerta em `H-29`. A contagem ignora os eventos que só trocaram o canal — senão trocar a cor de uma linha reiniciaria o contador e o alerta deixaria de disparar. O zero **não é medido enquanto o histórico for mais novo que o limiar**, e `stalledMeasurable` é o campo que faz `H-20` exibir **traço** em vez de `0` (regra 3); `stalledCoverageDays` dá o número que a ressalva da tela cita. Limiar de 15 dias declarado como premissa (A-32) e ausência de retroatividade também (A-43, A-61). A especificação o declara dependente de histórico inexistente (A-33); o ADR-0005 o fornece. **Medido em 18/08/2026:** 1 dia de cobertura contra limiar de 15, 0 alertas; com o limiar forçado a `0`, 169 dos 169 processos ativos disparam |

---

## 3. Cobertura complementar da especificação

A matriz obrigatória cobre indicadores e alertas. Os demais itens da
especificação são rastreados aqui, para que **nenhum** fique fora.

### 3.1. Telas (§6)

| Tela | Requisito | Histórias | Status |
|---|---|---|---|
| Página Inicial | RF-09 | H-16 | ✅ **Entregue.** 12 cartões: "Em desembaraço" por A-12, os dois de urgência por A-40, "Desembaraçados hoje" por A-64. A soma das 4 categorias é exibida e confere (649) |
| Página Operacional | RF-10 | H-17, H-22 | ✅ **Entregue.** Tabela de 8 colunas com ordenação por clique e paginação, busca por REF/BL/CNTR (A-39), e o calendário de chegadas. "Processo ativo" (A-16) é o padrão da página, não da rota. Medido: 169 ativos de 649 |
| Página Clientes | RF-11 | H-18 | ✅ **Entregue.** Três rankings em barras horizontais — CLT, IMPORTADOR e MERCADORIA (A-65) —, cada item aplicando o filtro global e abrindo a Operacional. `bazarShare` exibido dentro da seção de mercadoria (A-34) |
| Página Performance | RF-12 | H-19 | ✅ **Entregue.** Quatro quebras de IND-22 com denominador ao lado (A-42), os rankings de agente com `overdueCount` e de responsável, e a nota de IND-21 fora de escopo. Medido: a quebra por responsável é degenerada — os 101 pares completos estão todos em `indefinido` (A-31) |
| Página Alertas | RF-13 | H-20 | ✅ **Entregue.** Fila agrupada por processo (A-60), preservando a ordem de primeira aparição — a severidade de A-41 vem do servidor e não é refeita no cliente. Medido: 40 linhas para 25 processos |
| Página Histórico | RF-14 | H-21, H-28 | ✅ **Concluída.** Rota em `H-28`, tela em `H-21`. `GET /api/history/monthly` serve as três medidas — as duas de status por agregação dos eventos, e Canal Vermelho porque `H-28` passou a gravar o canal no evento, sem o que ele seria inderivável. Sem retroatividade anterior à primeira execução (A-43), e a tela declara isso. Declara também que o volume conta os REF já observados, e não os que a planilha tem hoje |
| Detalhe do processo | RF-15 | H-22 | ✅ **Entregue.** `statusRaw` ao lado da categoria classificada, as três colunas fora de escopo rotuladas, e as anomalias com o texto que vem de `describeAnomaly`. A rota `GET /api/processes/:ref` **não existia** e foi construída aqui |

### 3.2. Filtros globais (§7)

| Filtro | Campo | Histórias | Status |
|---|---|---|---|
| Período | ETA2 | H-15 | ✅ **Entregue.** `eta2 = null` nunca satisfaz quando há limite (A-20) |
| Cliente | CLT | H-15 | ✅ **Entregue.** Domínio aberto; medidos 509 valores na planilha real |
| Importador | IMPORTADOR | H-15 | ✅ **Entregue.** Domínio aberto; medidos 26 valores |
| Navio | NAVIO | H-15 | ✅ **Entregue.** Domínio aberto; medidos 70 valores |
| Agente | AGENTE | H-15 | ✅ **Entregue.** Domínio aberto; medidos 35 valores |
| Mercadoria | MERCADORIA | H-15 | ✅ **Entregue.** Domínio aberto; medidos 217 valores. Limitação de "BAZAR" mantida (A-34) |
| Categoria de status | STATUS derivado | H-15 | ✅ **Entregue.** Domínio fechado, as 4 chaves sempre exibidas. Vocabulário de A-01 aplicado |
| Responsável | Cor | H-04, H-15 | ✅ **Entregue.** A-18 provado sobre dado real: `colaborador1` devolve 129 com ou sem `colaborador1_outros_clientes` junto |
| Canal | Cor | H-04, H-15 | ✅ **Entregue.** Domínio fechado de A-37, as 3 chaves sempre exibidas |
| Porto | ETA | H-15 | ✅ **Entregue.** A-36 confirmado na prática: o porto `RO` existe com 2 processos, e domínio fechado o teria escondido |
| Importador fora do RJ | Cor | H-04, H-15 | ✅ **Entregue.** Tri-estado, não caixa de marcar: `false` inclui apenas `false`, nunca `null`. Medido: `true`=1 e `false`=648 somam 649, então nenhuma linha real exercita o `null` hoje |

### 3.3. Colunas da planilha (§2)

| Coluna | Uso | Histórias | Status |
|---|---|---|---|
| REF | Chave natural, IND-01 | H-03, H-07 | Implementável. Duplicidade tratada (TD-06) |
| CLT | IND-10, IND-18, filtro | H-03, H-11 | Implementável |
| IMPORTADOR | IND-11, IND-19, filtro | H-03, H-11 | Implementável |
| BL | Consulta | H-03, H-17 | ✅ **Entregue.** Busca por substring, sem caixa e sem acento. Medido: `search=NBSC` devolve 61 no conjunto todo, 7 entre os ativos |
| AGENTE | IND-17, filtro | H-03, H-11 | ✅ Implementável (P-01 confirmada) |
| CNTR | Consulta | H-03, H-17 | ✅ **Entregue.** Mesma busca do BL; a coluna aparece na tabela para o operador ver por que a linha casou |
| NAVIO | IND-12, filtro | H-03, H-10 | Implementável |
| ETA (porto) | Filtro | H-03, H-15 | ✅ **Entregue** com o filtro de porto |
| ETA2 | 9 indicadores e 4 alertas | H-03, H-05 | ✅ Implementável (P-03 confirmada) |
| MERCADORIA | IND-13, filtro | H-03, H-11 | Implementável, com limitação |
| RG | IND-16, IND-22 | H-03, H-05 | ✅ Implementável (P-03 confirmada) |
| STATUS | Classificação, detalhe | H-03, H-06, H-22 | ✅ **Entregue.** O texto original é exibido **apenas** no detalhe (§2.1), ao lado da categoria, para a regra aplicada ficar auditável |
| Coluna 13 | Somente exibição | H-03, H-22 | ✅ **Entregue.** Fora de escopo para indicadores (§2), exibido como texto puro e **rotulado** como tal |
| R$ ENVIADO | Somente exibição | H-03, H-22 | ✅ **Entregue.** Fora de escopo (§2), tipo misto (A-45), exibido como texto puro. Medido: 547 de 649 processos têm algum campo fora de escopo preenchido |
| DOCS ENVIADOS | IND-14, IND-22, ALE-02 | H-03, H-05 | ✅ Implementável (P-03 confirmada) |
| Coluna P | Somente exibição | H-01, H-03, H-22 | ✅ **Entregue.** Não documentada em §2. P-02 resolvida: cabeçalho `Coluna1`, **1 valor em 649 linhas** (A-50), reconfirmado em `H-22` |

### 3.4. Convenção de cores (§3)

| Cor | Significado | Campo derivado | Histórias | Status |
|---|---|---|---|---|
| Azul | Colaborador 1 | `responsible = colaborador1` | H-04, H-27 | ✅ **Entregue em `H-27`** — a combinação vira `fillId`, e a repintura troca só o `fillId` do `cellXf` de A a L, preservando fonte, borda e formato de cada célula (TD-05.1) |
| Roxo | Colaborador 2 | `responsible = colaborador2` | H-04, H-27 | ✅ **Entregue em `H-27`** — a combinação vira `fillId`, e a repintura troca só o `fillId` do `cellXf` de A a L, preservando fonte, borda e formato de cada célula (TD-05.1). **Os dois tons roxos casam a mesma combinação**; a gravação usa o tom A (A-48) |
| Bege | Colaborador 1, outros clientes | `responsible = colaborador1_outros_clientes` | H-04, H-27 | ✅ **Entregue em `H-27`** — a combinação vira `fillId`, e a repintura troca só o `fillId` do `cellXf` de A a L, preservando fonte, borda e formato de cada célula (TD-05.1) (A-18) |
| Vermelho | Canal Vermelho | `customsChannel = vermelho` | H-04, H-27 | ✅ **Entregue em `H-27`** — a combinação vira `fillId`, e a repintura troca só o `fillId` do `cellXf` de A a L, preservando fonte, borda e formato de cada célula (TD-05.1) |
| Amarelo forte | Importador fora do RJ | `importerOutsideRj = true` | H-04, H-27 | ✅ **Entregue em `H-27`** — a combinação vira `fillId`, e a repintura troca só o `fillId` do `cellXf` de A a L, preservando fonte, borda e formato de cada célula (TD-05.1). Decisão do usuário sobre A-38 |
| Verde | Desembaraçado | **Nenhum** — confirmação visual apenas | H-04 | Por decisão de A-04, a cor nunca infere status |
| Branco | Em desembaraçamento | **Nenhum** — idem | H-04 | Idem. A foto 2 refuta a coerência afirmada (A-04) |

### 3.5. Melhorias futuras (§8)

| Item | Destino |
|---|---|
| Coluna RESPONSÁVEL | Adiada por decisão do usuário. Custo em `03-modelo-dados.md §5` |
| Coluna CANAL | Adiada por decisão do usuário. Custo idem |
| Coluna DATA_PRESENÇA_DE_CARGA | Adiada por decisão do usuário. Mantém IND-21 bloqueado |
| Coluna DATA_ÚLTIMA_ATUALIZAÇÃO | **Descartada por desnecessária** — resolvida pelo ADR-0005 |
| Coluna CATEGORIA_MACRO | Adiada por decisão do usuário. Mantém a limitação de IND-13 |
| Alerta por e-mail/Teams | Fora de escopo — a aplicação não faz chamada de rede (RNF-31) |
| Notificação imediata de Canal Vermelho | Fora de escopo — idem |
| Normalização automática de nomes | Fora de escopo — a normalização implementada é determinística, não corretiva (TD-04) |
| Indicadores preditivos | Fora de escopo |
| Alerta de boleto pendente com ETA vencida | Fora de escopo — Coluna 13 e R$ ENVIADO não alimentam indicadores (§2) |
| Alerta de processo sem responsável | **Atendido parcialmente** — `responsible = indefinido` é contado e exibido em IND-20, e a linha aparece na quarentena (A-17) |
| Métricas de SLA | Fora de escopo |

---

## 4. Verificação de histórias órfãs

As 33 histórias, e onde cada uma aparece nesta matriz. **Nenhuma órfã.**

| História | Aparece em | Papel |
|---|---|---|
| H-01 | IND-06, IND-17, IND-20, ALE-03, §3.3 (coluna P), e todas as linhas antes "Condicionadas" | ✅ **Concluída.** Resolveu P-01 a P-07 e produziu os valores reais de `config/color-map.json` e `config/status-aliases.json` |
| H-02 | Cadeia base | ✅ **Concluída.** Sem ela nada compila nem executa |
| H-03 | Cadeia base, §3.3 (todas as colunas) | ✅ **Concluída.** Fonte de todo campo lido |
| H-04 | IND-06, IND-20, ALE-03, §3.2 (3 filtros), §3.4 (7 cores) | ✅ **Concluída.** Origem dos campos derivados de cor |
| H-05 | Cadeia base, §3.3 (ETA2, RG, DOCS ENVIADOS) | ✅ **Concluída.** Datas e chaves de agrupamento |
| H-06 | Cadeia base, IND-02 a IND-05, §3.3 (STATUS) | ✅ **Concluída.** Classificação canônica |
| H-07 | Cadeia base, IND-01, IND-05 | ✅ **Concluída.** Composição e quarentena |
| H-08 | Cadeia base | ✅ **Concluída.** Recarga automática, base de RF-07. RNF-14 medido em 2092 ms no pior caso |
| H-09 | IND-01 a IND-05 | ✅ **Concluída.** Contagens por categoria. Medido: 649 = 480 + 103 + 34 + 32 |
| H-10 | IND-07, IND-08, IND-09, IND-12 | ✅ **Concluída.** Indicadores de calendário. O fuso é resolvido num único ponto: `today()` |
| H-11 | IND-10, IND-11, IND-13, IND-17, IND-18, IND-19, IND-20 | ✅ **Concluída.** Agrupamentos e rankings. `bazarShare` medido em 35,47% |
| H-12 | IND-06, IND-14, IND-15 | ✅ **Concluída.** Indicadores de risco. `overdueCount` é apresentação de `isOverdue`, nunca reimplementação |
| H-13 | IND-16, IND-22 | ✅ **Concluída.** Indicadores de tempo. Fecha o contrato de `GET /api/indicators`, que nasceu parcial em `H-09`. Medido: `averageDays 12,5` sobre amostra de 101 |
| H-14 | ALE-01 a ALE-05 | ✅ **Concluída.** Alertas do estado atual. Fila de trabalho: `≠ desembaracado` nos cinco (A-59). Medido: 40 linhas para 25 processos |
| H-15 | §3.2 (os 11 filtros) | ✅ **Concluída.** Filtros globais, casca com navegação, faixa de estado (A-57) e as três frentes de A-62. Saiu em três entregas. Medido: `port=RO` devolve 2 processos, confirmando A-36 |
| H-16 | IND-01 a IND-09, IND-14 a IND-16, §3.1 (Página Inicial) | ✅ **Concluída.** Cartões-resumo — **12**, não 11: `IND-16` faltava na lista e entrou por A-64 |
| H-17 | IND-12, §3.1 (Página Operacional), §3.3 (BL, CNTR) | ✅ **Concluída.** Tabela, busca e calendário. Saiu em duas entregas. Entrega também `GET /api/processes`, de que `H-22` depende |
| H-18 | IND-10, IND-11, **IND-13**, IND-18, IND-19, §3.1 (Página Clientes) | ✅ **Concluída.** Rankings visuais. `IND-13` entrou por A-65: mercadoria é a terceira dimensão do mesmo painel de distribuição. Corrigiu também o descarte da chave vazia em `parseFilters`, que tornava inócua a opção "(em branco)" nos nove filtros da barra desde `H-15` |
| H-19 | **IND-17**, **IND-20**, IND-22, §3.1 (Página Performance) | ✅ **Concluída.** Quebras do tempo documental. `IND-17` e `IND-20` entraram por A-65: a página já agrupa por agente e por responsável, e contagem com `overdueCount` é outra métrica sobre os mesmos grupos |
| H-20 | ALE-01 a ALE-06, §3.1 (Página Alertas) | ✅ **Concluída.** Fila de trabalho, não panorama (A-59). Corrigiu a contradição do backlog entre o critério de aceite e o caso-limite do agrupamento |
| H-21 | §3.1 (Página Histórico) | ✅ **Concluída.** Série mensal com as três medidas, janela de 12 a 60 meses e os três avisos de A-43. Última página do menu. A rota já vinha de `H-28` e não mudou |
| H-22 | §3.1 (Detalhe), §3.3 (STATUS, Coluna 13, R$ ENVIADO, Coluna P) | ✅ **Concluída.** Única tela onde `statusRaw` é exibido. Construiu a rota `:ref`, que o plano dava como fixada e nunca fora implementada |
| H-23 | §5 abaixo (RF-20, RF-28) | ✅ **Concluída.** Fila de edições em disco, projetada sobre os processos lidos: o painel inteiro reflete a edição sem que o `.xlsx` seja tocado. Corrigiu a contradição de `03-modelo-dados.md` sobre `value: null` |
| H-24 | §5 abaixo (RF-22) | ✅ **Concluída.** Quatro entradas do zip podem mudar, e só elas: a aba alvo, `sharedStrings`, `styles` (aditivo, passo 5b de TD-05.1) e `calcChain`. Reprovada pelo `revisor-xml` na primeira invocação, por dois defeitos reais |
| H-25 | §5 abaixo (RF-23 a RF-26) | ✅ **Concluída.** Seis defesas de integridade. A célula é endereçada pela **REF**, nunca pelo `sourceRow` da fila, e o `previous` é conferido sempre: reprovada três vezes pelo `revisor-xml`, por quatro defeitos reais, dois deles introduzidos pelas correções dos anteriores. Fechou `PD-04` |
| H-26 | §5 abaixo (RF-21) | ✅ **Concluída.** Comando de aplicação, com a fila arquivada em `data/applied/` e a releitura em voo aguardada. Reprovada seis vezes pelo `revisor-xml`, por seis defeitos reais — quatro na interface, incluindo um que omitia o caminho do backup no único desfecho em que ele é a saída |
| H-27 | IND-06, IND-20, §3.4 (as 5 cores com significado) | ✅ **Concluída.** Torna editáveis os campos de cor, trocando `fillId` e nunca `styleId` (A-49). A interface oferece as 6 combinações representáveis: o mapa tem 9 entradas para elas, e a primeira na ordem do arquivo vence. Reprovada três vezes pelo `revisor-xml`, por cinco defeitos reais — um herdado de `H-24` |
| H-28 | ALE-06, §3.1 (Página Histórico) | ✅ **Concluída.** Histórico append-only, com o evento gravando também o **canal**: sem ele a série mensal de Canal Vermelho seria inderivável, e o arquivo não tem retroatividade. Entrega `GET /api/history/monthly` e preenche `daysInCurrentCategory`, `statusHistory` e `historyStartedAt`, que serviam valor de espera desde `H-14` |
| H-29 | ALE-06 | ✅ **Concluída.** Fecha ALE-06 — a regra existia desde `H-14`, o dado desde `H-28`, e faltava a tela, que decidia por tipo literal. `GET /api/alerts` ganha `stalledCoverageDays` e `stalledMeasurable`, para que o zero da contagem só apareça quando o histórico já cobrir o limiar (A-43). Corrige de passagem a formatação de `historyStartedAt`, que a Página Alertas fatiava como se fosse `AAAA-MM-DD` |
| H-30 | §5 abaixo (operação), `GET /*` | ⚠️ **Entregue, com verificação pendente.** Serve `GET /*`, a última rota documentada sem dono (A-63), registrada **sempre** e consultando `dist/web` por requisição — o portão roda `test` antes de `build`, e condicionar o registro à pasta reprovaria a guarda no CI. O `iniciar.cmd` não foi executado: só a instalação em Windows o exerce |
| H-31 | §5 abaixo (RF-16, observabilidade) | ✅ **Concluída.** Logs e métricas. Fecha a Fase 1 |
| H-32 | §5 abaixo (RF-16, observabilidade) | ✅ **Concluída.** Sinal de interferência externa no arquivo (A-58). Antecipada para destravar `H-15`. Sinal, nunca ação: a leitura acontece igual |
| H-33 | Cadeia base | ✅ **Concluída.** Leitor sobre `fflate`: nenhuma aba fora de escopo é descomprimida, `/tmp` fica intocado e o `exceljs` saiu do projeto. O erro não determinístico do portão já tinha sido corrigido fora dela, em 06/08/2026 |
| H-34 | Cadeia base | ✅ **Concluída.** Caminho da planilha configurável pela tela, com troca em execução — o operador nunca edita JSON. A partida deixou de exigir planilha válida: sem ela a aplicação sobe e abre na tela de configuração |
| H-44 | Cadeia base | ✅ **Concluída.** A partida numa máquina limpa chega ao painel: o atalho deixou de barrar por `config/app.json` ausente — ele apenas informa, e a tela cria o arquivo ao salvar o caminho. `GET /api/config/workbook` virou o inventário dos oito campos, com a origem de cada valor. `scripts/iniciar.cmd` **não foi executado**: é batch do Windows, e o que ele passou a fazer está em `PD-06` |
| H-45 | Cadeia base | ⬜ **Aberta.** O checklist das etapas de partida no painel, o botão de revalidação sem reexecutar o atalho, e o `config/app.json.exemplo` fiel à forma que a aplicação grava. Nasceu do corte de `H-44`, que chegaria a nove arquivos |

---

## 5. Requisitos funcionais sem indicador correspondente

Itens que não derivam do catálogo de §4/§5, e que existem por decorrência da
virada de escopo (edição) ou por necessidade operacional.

| Requisito | Origem | Histórias | Status |
|---|---|---|---|
| RF-06 · Quarentena sem descarte silencioso | A-03, A-21, decisão de arquitetura | H-07 | Implementável |
| RF-08 · Relatório de divergências | A-05, A-06, A-30 | H-07 | Implementável |
| RF-16 · Painel de saúde da ingestão | Necessidade operacional | H-16, H-31 | ✅ **Entregue.** Linhas lidas, aceitas, quarentena, taxa, última leitura e duração. O limiar de 2% (RNF-24) é destacado, e `quarantineRate` vem calculado do servidor |
| RF-20, RF-28 · Editar e descartar edições | Decisão do usuário | H-23 | ✅ **Entregue.** Formulário e painel de pendências no detalhe do processo; a re-derivação refaz categoria, chaves e anomalias. Medido: editar `statusRaw` move o processo de `em_andamento` para `desembaracado` e os indicadores acompanham |
| RF-21 · Aplicar sob comando explícito | Decisão do usuário (D7) | H-26 | ✅ **Entregue.** `POST /api/edits/apply` traduzindo as sete recusas, botão no cabeçalho com a contagem, e diálogo que decide por `conflicts.length` antes de `refMissing`. RNF-15 medido: 100 células em 380–430 ms contra o limite de 15 s |
| RF-22 · Preservar formatação na escrita | ADR-0004 | H-24 | ✅ **Entregue.** Formatação condicional, validação de dados, autofiltro, coluna oculta e comentários sobrevivem à edição, conferido por hash entrada a entrada e aberto no Excel real sem aviso de reparo. `PD-05` registra que a cadeia de cálculo só tem teste sintético |
| RF-23 a RF-26 · Defesas de integridade | D7 | H-25 | ✅ **Entregue.** Lock, hash, backup antes de qualquer modificação, gravação atômica com `fsync`, validação pós-escrita com restauração automática, e expurgo por RNF-21. Sete recusas contra as cinco do contrato fixado — `ARQUIVO_INDISPONIVEL` e `EDICAO_OBSOLETA`, ambas justificadas no bloco da história |
| RF-27 · Editar campos de cor | Decorrência de RF-20 | H-27 | ✅ **Entregue.** `PATCH /api/processes/:ref/color` enfileira, e a aplicação repinta A–L trocando o `fillId` (A-49). A interface oferece as **6 combinações representáveis** contra as 9 entradas do mapa: branco e os tons B são legíveis e não graváveis, porque a escrita usa o tom canônico |
| Empacotamento e execução | Necessidade operacional | H-30 | ⚠️ **Entregue, com verificação pendente.** `GET /*` serve a SPA e foi conferida contra o `dist/web` real; o `README.md` ganhou a seção de instalação e fecha `PD-03`. O `scripts/iniciar.cmd` **nunca foi executado** — é batch do Windows (RNF-26) e o desenvolvimento é em Linux. Quatro critérios de aceite e três casos-limite dependem da primeira instalação na máquina do operador |

---

## 6. Fechamento

| Métrica | Valor |
|---|---|
| Indicadores da especificação | 22 |
| Alertas da especificação | 6 |
| **Linhas na matriz obrigatória** | **28** |
| ✅ Implementáveis de imediato | **21 indicadores + 6 alertas** |
| Condicionados a perfilamento | **0** — `H-01` concluída em 03/08/2026 |
| Bloqueados por lacuna de dado | 1 (IND-21) |
| Destravados por decisão de arquitetura | 2 (ALE-06 e Página Histórico, via ADR-0005) |
| Histórias no backlog | 31 |
| Histórias órfãs | **0** |

**A Fase 0 está concluída.** `H-01` rodou sobre o arquivo real e resolveu as
sete premissas que condicionavam 16 itens desta matriz. O saldo:

| Item | Antes | Depois |
|---|---|---|
| P-03 · datas com ano | risco R-03, impacto 5 | ✅ confirmada — 1.201 datas reais, zero texto sem ano. **R-03 encerrado** |
| P-01 · coluna E | IND-17 sem fonte | ✅ confirmada — `AGENTE`, 576 valores |
| P-06 · cores | `color-map.json` era esqueleto | ✅ 9 chaves reais, cobertura **100%** das 649 linhas |
| P-04 · uma aba | assumida | ❌ refutada — 4 abas; escopo fixado na `2026` |
| A-49 · escrita de cor | `H-27` trocava `styleId` | ✅ corrigida para trocar `fillId` — a versão anterior destruiria bordas. **Verificado em `H-27`** contra a planilha real: `styleId 165` → `xf` novo com `fillId` 8 e a **borda 5 preservada** |

**O único item bloqueado continua sendo IND-21**, por ausência da data de
presença de carga — lacuna de origem, não de plano.

A Fase 1 pode começar. Nenhuma premissa de dado permanece aberta; a única
pendência é **P-14** (crescimento mensal), que depende de informação do usuário
e não bloqueia implementação alguma.
