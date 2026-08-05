**Especificação Funcional — Dashboard Operacional de Desembaraço Aduaneiro**

*Documento técnico-funcional para desenvolvimento do painel*

# 1. Objetivo

Este documento especifica os dados de origem, regras de negócio e indicadores para a construção de um painel operacional. Ele traduz uma planilha de controle interno usada manualmente pela equipe em um conjunto de regras claras para o desenvolvedor, que não conhece a operação da empresa.

## Finalidade do painel

Dar visibilidade em tempo real sobre o andamento dos processos de importação/desembaraço aduaneiro: o que chegou, o que está pendente, o que está atrasado e quem é responsável por cada processo.

## Público-alvo

Equipe operacional e gestão da empresa de desembaraço aduaneiro — todos já usam a planilha-fonte hoje.

## Benefícios

- Reduzir esquecimentos de processos parados ou com documentação pendente.
- Antecipar problemas (ETA vencida, Canal Vermelho, atrasos) antes que virem urgência.
- Padronizar a leitura da operação — hoje depende de abrir e interpretar a planilha manualmente.

# 2. Estrutura da planilha (fonte de dados única)

Cada linha da planilha representa um processo de importação (um container). O painel deve ser alimentado exclusivamente por esta planilha.

| **Coluna** | **Significado** | **Como deve ser utilizada** |
| --- | --- | --- |
| REF | Referência interna do processo. Identificador único da linha. | Chave primária de todos os indicadores e do drill-down por processo. |
| CLT | Nome/código do cliente. | Agrupamento e ranking de clientes. |
| IMPORTADOR | Empresa importadora responsável pela carga. | Agrupamento e ranking de importadores. |
| BL | Número do conhecimento de embarque (Bill of Lading). | Campo de referência/consulta; não usar para agrupamento (é praticamente único por processo). |
| AGENTE | Agente de carga responsável pelo transporte. | Agrupamento e ranking de agentes. |
| CNTR | Número do container. | Campo de referência/consulta. |
| NAVIO | Nome da embarcação. | Agrupamento por navio; base do calendário de chegadas. |
| ETA | Porto de chegada (ex.: RIO, SC, MULTI, MULTIRIO). | Campo categórico de porto. "SC" = Santa Catarina. Usar como filtro de porto — não confundir com data. |
| ETA2 | Data prevista/realizada de chegada. | Base de todos os indicadores de calendário e de atraso (comparar com a data atual). |
| MERCADORIA | Descrição resumida da carga. | Quando há muitos itens, o campo recebe "BAZAR" — nesse caso o valor não representa um produto específico, apenas indica carga variada. Tratar como texto livre, não como categoria confiável de produto. |
| RG | Data de Registro do processo — na prática, é a data em que o desembaraço foi concluído. | Marca a CONCLUSÃO do processo, não o início. Usar como data final para indicadores de tempo/SLA (ver seção 2.1.1). |
| STATUS | Situação operacional do processo. Ver regra de classificação abaixo. | Ver seção 2.1 — não usar o texto bruto para contagem, aplicar a classificação em 3 categorias. |
| Coluna 13 (sem nome) | Campo de controle de boleto (ex.: "BOLETO OK"). | Fora de escopo nesta versão do painel — não utilizar. |
| R$ ENVIADO | Indicação/data de pagamento confirmado. | Fora de escopo nesta versão do painel — não utilizar. |
| DOCS ENVIADOS | Data de envio da documentação ao setor de desembaraço. | Campo vazio = documentação pendente. |

## 2.1. Regra de classificação do campo STATUS

O campo STATUS é preenchido de forma livre e não deve ser lido literalmente. Aplicar a seguinte regra de classificação em 3 categorias, sempre nesta ordem:

| **Condição no campo STATUS** | **Categoria resultante** |
| --- | --- |
| Texto igual a "DESEMBARAÇADA" | Desembaraçado |
| Célula vazia (em branco) | Em desembaraço |
| Qualquer outro texto (ex.: anotações, datas de DUIMP, "AG BL ORIGINAL", etc.) | Em andamento |

*As três categorias são mutuamente exclusivas e não devem ser somadas entre si em nenhum indicador. Em particular, "Em andamento" refere-se apenas à 3ª linha da tabela (texto preenchido, diferente de "DESEMBARAÇADA") — não inclui os processos "Em desembaraço" (célula em branco), que são contados separadamente.*

*O texto original (quando existir) deve ser preservado e exibido apenas na tela de detalhe do processo, nunca usado para agrupar, contar ou gerar gráfico.*

## 2.1.1. Papel da coluna RG nos indicadores de tempo

RG é a data de registro do processo e, na prática, representa o momento em que o desembaraço foi concluído — não a data de abertura. Todo indicador de tempo/SLA que usa RG deve tratá-la como a extremidade final do intervalo (data de conclusão), nunca como ponto de partida.

## 2.2. Processos com apenas a coluna REF preenchida

Linhas com REF preenchido e as demais colunas vazias representam processos já fechados comercialmente, aguardando apenas o recebimento do Draft/BL do agente. Não são linhas reservadas ou lixo de planilha — devem ser contabilizadas no total de processos ativos, na categoria "Fechado — aguardando draft" (distinta das 3 categorias da seção 2.1).

# 3. Convenção de cores

A cor de preenchimento da linha na planilha é uma regra operacional da empresa e carrega informação de negócio que não existe em nenhuma coluna de texto. Deve ser lida e disponibilizada como filtro/segmentação no painel.

| **Cor** | **Significado** | **Comportamento esperado no painel** |
| --- | --- | --- |
| Azul | Processos da Samira. | Usar como valor do filtro "Responsável = Samira". |
| Roxo | Processos do Hugo. | Usar como valor do filtro "Responsável = Hugo". |
| Verde | Processo desembaraçado. | Deve ser coerente com STATUS = "DESEMBARAÇADA" (seção 2.1); usar como confirmação visual, não como fonte primária. |
| Vermelho | Processo em Canal Vermelho. | Usar como valor do filtro "Canal = Vermelho" e disparar alerta correspondente (seção 5). |
| Branco (sem cor) | Processo em desembaraçamento. | Coerente com STATUS vazio = "Em desembaraço" (seção 2.1). |
| Amarelo forte | Importador localizado fora do RJ. | Usar como valor do filtro "Importador fora do RJ". |
| Bege | Processos da Samira pertencentes a outros clientes. | Usar como subcategoria do filtro "Responsável = Samira". |

# 4. Indicadores do Dashboard

| **Indicador** | **Origem dos dados** | **Regra de cálculo** | **Objetivo** |
| --- | --- | --- | --- |
| Quantidade de processos | Toda a base | Contagem de linhas com REF preenchido (incluir categoria "Fechado — aguardando draft") | Mostrar volume operacional total |
| Processos em andamento | STATUS (classificado) | Categoria = "Em andamento" (ver seção 2.1 — não somar com "Em desembaraço") | Volume de processos com alguma movimentação registrada, fora do fluxo padrão de branco→verde |
| Processos em desembaraço | STATUS (classificado) | Categoria = "Em desembaraço" (célula em branco) | Volume de processos no fluxo padrão, ainda sem conclusão |
| Processos desembaraçados | STATUS (classificado) | Categoria = "Desembaraçado" | Volume já concluído |
| Fechado — aguardando draft | Linhas com apenas REF preenchido | Ver seção 2.2 | Volume de trabalho já garantido, ainda sem documentação |
| Canal Vermelho | STATUS ou cor da linha (Vermelho) | Cor = Vermelho (fonte preferencial) ou texto correspondente em STATUS | Acompanhar processos em fiscalização |
| Containers chegando hoje | ETA2 | ETA2 = data de hoje | Planejamento diário |
| Containers chegando esta semana | ETA2 | ETA2 entre hoje e fim da semana corrente | Planejamento semanal |
| Containers chegando em 15 dias | ETA2 | ETA2 entre hoje e hoje + 15 dias | Planejamento de médio prazo |
| Clientes com mais processos | CLT | Contagem de linhas agrupada por CLT, ordenada decrescente | Identificar concentração de carteira |
| Importadores com mais processos | IMPORTADOR | Contagem agrupada por IMPORTADOR | Identificar concentração por importador |
| Navios previstos | NAVIO + ETA2 | Lista de navios com ETA2 futura, ordenada por data | Base do calendário de chegadas |
| Mercadorias | MERCADORIA | Contagem agrupada por texto (ciente de que "BAZAR" domina a base — ver seção 2) | Visão geral de carga, com limitação conhecida |
| Documentos pendentes | DOCS ENVIADOS + ETA2 | DOCS ENVIADOS vazio E ETA2 a 10 dias ou menos de hoje (chegada iminente ou já ocorrida) | Sinalizar apenas os casos urgentes de documentação não enviada — processos com chegada distante não entram no indicador |
| Processos atrasados | ETA2 + STATUS (classificado) | ETA2 < hoje E categoria ≠ "Desembaraçado" | Priorização de urgência |
| Processos desembaraçados hoje | RG | RG = data de hoje | Acompanhar produtividade diária — não depende de histórico de leituras, pois RG já é a data de conclusão |
| Ranking de agentes | AGENTE | Contagem agrupada por AGENTE, ordenada decrescente | Identificar concentração de volume/atraso por agente |
| Ranking de clientes | CLT | Igual ao indicador "Clientes com mais processos" | Ranking visual (Top N) |
| Ranking de importadores | IMPORTADOR | Igual ao indicador "Importadores com mais processos" | Ranking visual (Top N) |
| Ranking por responsável | Cor da linha (Azul = Samira, Roxo = Hugo) | Contagem agrupada pela cor da linha | Distribuição de carga de trabalho entre responsáveis |
| Tempo médio até desembaraço | — | FORA DE ESCOPO por enquanto (ver observação abaixo) | Medir performance real de desembaraço, a partir da presença de carga |
| Tempo médio de envio documental | RG + DOCS ENVIADOS | Diferença entre DOCS ENVIADOS e RG (tempo entre o envio da documentação e a conclusão do desembaraço) | Medir agilidade da etapa documental até a conclusão |

*Observação importante sobre "Tempo médio até desembaraço": o cálculo correto começaria na data de presença de carga (marco oficial de início da contagem do desembaraço), e terminaria em RG (conclusão). A planilha não possui a data de presença de carga — ETA2 não é equivalente a ela. Por isso, este indicador deve ficar fora de escopo até que essa data passe a existir como coluna (ver seção 8). Os demais indicadores baseados em RG (ex.: "Processos desembaraçados hoje") já são calculáveis diretamente, sem necessidade de histórico de leituras, pois RG é preenchido exatamente na conclusão.*

# 5. Alertas automáticos

| **Alerta** | **Origem** | **Condição** |
| --- | --- | --- |
| ETA vencida | ETA2 + STATUS (classificado) | ETA2 < hoje E categoria ≠ "Desembaraçado" |
| Documentação pendente | DOCS ENVIADOS + ETA2 | Campo vazio E ETA2 a 10 dias ou menos de hoje |
| Canal Vermelho | Cor da linha (Vermelho) ou STATUS correspondente | Cor = Vermelho (fonte preferencial) |
| Chegadas hoje | ETA2 | ETA2 = hoje |
| Chegadas nos próximos 7 dias | ETA2 | ETA2 entre hoje e hoje + 7 dias |
| Processos parados | STATUS (classificado) + histórico de leituras | Categoria sem alteração por um número de dias definido pelo negócio (depende do histórico de leituras — mesma observação da seção 4) |

# 6. Sugestão de layout

| **Página** | **Conteúdo esperado** |
| --- | --- |
| Página Inicial | Cartões-resumo: total de processos, desembaraçados, em andamento, aguardando draft, Canal Vermelho, chegadas hoje/semana/15 dias. |
| Página Operacional | Tabela detalhada dos processos ativos com filtros; visão de calendário de chegadas por navio. |
| Página Clientes | Ranking e distribuição por CLT e IMPORTADOR. |
| Página Performance | Tempo médio de envio documental (RG − DOCS ENVIADOS), quebrado por cliente/agente/navio/responsável. "Tempo médio até desembaraço" fica fora de escopo por enquanto (ver seção 4). |
| Página Alertas | Lista dos alertas da seção 5, ordenada por urgência. |
| Página Histórico | Evolução mensal de volume, desembaraçados e Canal Vermelho (depende do histórico de leituras). |

# 7. Filtros globais

- Período (ETA2)
- Cliente (CLT)
- Importador (IMPORTADOR)
- Navio (NAVIO)
- Agente (AGENTE)
- Mercadoria (MERCADORIA)
- Status classificado (Desembaraçado / Em desembaraço / Aguardando desembaraço / Fechado — aguardando draft)
- Responsável (cor da linha: Samira / Hugo)
- Canal (cor da linha: Vermelho / demais)
- Porto (ETA: RIO / SC / MULTI / MULTIRIO)

# 8. Melhorias futuras

## Novas colunas sugeridas

| **Coluna sugerida** | **Motivo** |
| --- | --- |
| RESPONSÁVEL (texto) | Hoje só existe como cor da linha; uma coluna de texto reduz dependência de leitura de formatação |
| CANAL (texto) | Mesma razão acima, para o Canal Vermelho |
| DATA_PRESENÇA_DE_CARGA | Destrava o cálculo de "Tempo médio até desembaraço" (hoje fora de escopo — ver seção 4); RG já cobre a data de conclusão |
| DATA_ÚLTIMA_ATUALIZAÇÃO | Permite calcular "processo parado há quantos dias" sem depender de histórico externo |
| CATEGORIA_MACRO (mercadoria) | Resolve a limitação do campo MERCADORIA dominado por "BAZAR" |

## Automações possíveis

- alerta diário por e-mail/Teams com os itens da seção 5.
- notificação imediata quando uma linha muda para Canal Vermelho.
- normalização automática de nomes de navio/porto/agente (correção de digitação).

## Indicadores preditivos sugeridos

- Probabilidade de atraso por agente/navio, baseada em histórico de atrasos passados.
- Estimativa de dias até desembaraço, baseada em processos semelhantes já concluídos.

## Alertas automáticos adicionais sugeridos

- Boleto/pagamento pendente com ETA já vencida (quando a Coluna 13 / R$ ENVIADO entrarem em escopo).
- Processo sem responsável identificado (linha sem cor reconhecida).

## Métricas de SLA sugeridas

- Meta de dias entre ETA2 e conclusão do desembaraço, com % de processos dentro/fora da meta.
- Meta de dias entre RG e envio de documentos.
