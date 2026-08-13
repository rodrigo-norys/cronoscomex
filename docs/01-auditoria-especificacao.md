# 01 — Auditoria da Especificação Funcional

Auditoria da especificação funcional original — documento do cliente, **não
versionado** —, aplicando os três cruzamentos exigidos. Nenhum defeito foi
corrigido em silêncio: cada achado tem trecho citado, impacto e destino, então
este documento é autossuficiente sem o original.

**Evidência secundária:** as fotos `planilha1.jpeg` e `planilha2.jpeg` mostram
as linhas 475–484 da planilha real (colunas A–K e K–R, respectivamente; a foto
2 é a continuação lateral da foto 1, mesmas linhas). Elas foram usadas para
**confirmar ou contestar** a especificação. **Não** foram usadas para inferir
volumetria, distribuição ou qualquer número.

**Legenda de tipo:** CONTRADIÇÃO (duas partes da spec se anulam) ·
AMBIGUIDADE (regra admite mais de uma leitura) · LACUNA (regra exige dado ou
definição que não existe).

**Legenda de destino:** `PREMISSA P-NN` (default assumido, registrado em
`00-visao-escopo.md`) · `RESOLVIDO` (decisão de arquitetura tomada aqui) ·
`RESPONDIDO` (decisão do usuário na rodada de perguntas bloqueantes).

---

## Cruzamento (a) — Vocabulário de status

### Conjunto canônico

Extraído da regra de classificação (§2.1) somada à categoria de §2.2:

| # | Categoria canônica | Definição |
|---|---|---|
| 1 | **Desembaraçado** | STATUS igual a "DESEMBARAÇADA" |
| 2 | **Em desembaraço** | STATUS em branco |
| 3 | **Em andamento** | Qualquer outro texto em STATUS |
| 4 | **Fechado — aguardando draft** | Apenas REF preenchido, demais colunas vazias (§2.2) |

A especificação é explícita: *"As três categorias são mutuamente exclusivas e
não devem ser somadas entre si em nenhum indicador."*

### Termos de status usados fora do conjunto canônico

| ID | Tipo | Seção | Trecho citado | Impacto | Destino |
|---|---|---|---|---|---|
| **A-01** | CONTRADIÇÃO | §7 | `"Status classificado (Desembaraçado / Em desembaraço / Aguardando desembaraço / Fechado — aguardando draft)"` | "Aguardando desembaraço" **não existe** no conjunto canônico, e "Em andamento" — que existe — **está ausente**. O filtro, como escrito, não consegue selecionar a categoria 3 e oferece uma opção que nada retorna | **RESOLVIDO**: o filtro usa exatamente as 4 categorias canônicas. "Aguardando desembaraço" é descartado como termo órfão |
| **A-13** | AMBIGUIDADE | §3 | `"Branco (sem cor) | Processo em desembaraçamento."` | "em desembaraçamento" é forma lexical distinta de "Em desembaraço". Sendo a spec explícita sobre exclusividade mútua, variação de nome cria dúvida sobre ser uma 5ª categoria | **RESOLVIDO**: tratado como sinônimo de "Em desembaraço". Nenhuma categoria nova |
| **A-14** | CONTRADIÇÃO | §4 | Objetivo de "Processos em andamento": `"fora do fluxo padrão de branco→verde"` | Define uma categoria de status por **cor**, misturando os dois vocabulários. A cor não é fonte de status (ver A-04) | **RESOLVIDO**: o objetivo é descritivo, não normativo. A regra de cálculo (`Categoria = "Em andamento"`) prevalece |
| **A-15** | AMBIGUIDADE | §4 | Indicador "Canal Vermelho", origem: `"STATUS ou cor da linha (Vermelho)"` | Sugere que "Canal Vermelho" seria um valor de STATUS. Mas pela regra §2.1, um STATUS com o texto "CANAL VERMELHO" classifica como **"Em andamento"** — Canal Vermelho **não é** uma categoria de status, é um atributo independente | **RESOLVIDO**: canal e categoria de status são dimensões ortogonais. Ver A-06 para a fonte |
| **A-16** | LACUNA | §6 | Página Operacional: `"Tabela detalhada dos processos ativos"` | "Processo ativo" nunca é definido. Não se sabe se exclui "Desembaraçado", se exclui "Fechado — aguardando draft", ou se é sinônimo de "todos" | **RESOLVIDO**: "ativo" := categoria ≠ "Desembaraçado". Definição registrada no glossário e usada em `H-17` |
| **A-17** | LACUNA | §8 | `"Processo sem responsável identificado (linha sem cor reconhecida)"` | A própria spec reconhece a existência de linhas sem cor reconhecida, mas nenhuma seção define o que fazer com elas nos indicadores de responsável | **RESOLVIDO**: valor `indefinido` no domínio de `responsible`, contado e exibido separadamente. Linha vai também para quarentena (`H-07`) |
| **A-18** | AMBIGUIDADE | §3 | `"Bege | Processos do Colaborador 1 pertencentes a outros clientes."` | Bege é subcategoria de Colaborador 1. Não se define se o "Ranking por responsável" soma bege com azul ou os separa | **RESOLVIDO**: domínio de `responsible` tem 4 valores — `colaborador1`, `colaborador2`, `colaborador1_outros_clientes`, `indefinido`. O ranking exibe os 4; o filtro "Responsável = Colaborador 1" seleciona `colaborador1` **e** `colaborador1_outros_clientes` |

---

## Cruzamento (b) — Rastreabilidade de dados

Para cada indicador e alerta: as colunas exigidas pela regra de cálculo
existem? O papel atribuído bate com o significado declarado da coluna?

### Colunas declaradas (§2) versus colunas observadas nas fotos

| Letra na foto | Cabeçalho visível | Coluna na spec | Situação |
|---|---|---|---|
| A | REF | REF | confere |
| B | CLT | CLT | confere |
| C | IMPORTADOR | IMPORTADOR | confere |
| D | BL | BL | confere |
| **E** | **(colapsada, ilegível)** | AGENTE (por eliminação) | **A-09** |
| F | CNTR | CNTR | confere |
| G | NAVIO | NAVIO | confere |
| H | ETA | ETA (porto) | confere — valores `RIO`, `SC` |
| I | ETA2 | ETA2 (data) | confere — valores `29/jul`, `04/ago` |
| J | MERCADORIA | MERCADORIA | confere — `BAZAR` predominante nas linhas visíveis |
| K | RG | RG | confere |
| L | STATUS | STATUS | confere |
| M | Coluna 13 | Coluna 13 | confere — valores `BOLETO`, `N/A` |
| N | R$ ENVIADO | R$ ENVIADO | confere — valores `OK 23/07`, `28/jul` |
| O | DOCS ENVIADOS | DOCS ENVIADOS | confere |
| **P** | **"Colun…" (truncado)** | **não documentada** | **A-09** |

### Achados de rastreabilidade

| ID | Tipo | Alvo | Trecho citado | Impacto | Destino |
|---|---|---|---|---|---|
| **A-02** | CONTRADIÇÃO | Indicador "Tempo médio de envio documental" | §4: `"Diferença entre DOCS ENVIADOS e RG"` · §6: `"Tempo médio de envio documental (RG − DOCS ENVIADOS)"` | As duas seções descrevem subtrações **opostas**. §2.1.1 estabelece que RG é a extremidade **final** do intervalo; logo `DOCS ENVIADOS − RG` produziria valor **negativo** | **RESOLVIDO**: fixado `RG − DOCS_ENVIADOS`, resultado em dias inteiros. A redação de §4 é o defeito; a de §6 está correta |
| **A-06** | LACUNA | Indicador e alerta "Canal Vermelho" | §4: `"Cor = Vermelho (fonte preferencial) ou texto correspondente em STATUS"` | "Texto correspondente" nunca é definido. Não há lista de textos que caracterizariam Canal Vermelho, e STATUS é campo livre | **RESOLVIDO**: **apenas a cor** é fonte do canal. Ocorrências textuais são detectadas e listadas no relatório de divergências (`H-07`) para revisão humana, mas **não** classificam |
| **A-07** | AMBIGUIDADE | Indicador "Containers chegando esta semana" | §4: `"ETA2 entre hoje e fim da semana corrente"` | Não define o início da semana (domingo ou segunda), nem o fuso. Muda o resultado do indicador em até 2 dias de processos | **RESOLVIDO**: semana ISO-8601 (segunda a domingo), fuso `America/Sao_Paulo`. Registrado em P-10 |
| **A-08** | LACUNA | Indicador e alerta "Documentos pendentes" | §4: `"DOCS ENVIADOS vazio E ETA2 a 10 dias ou menos de hoje"` | Não exclui processos já **desembaraçados**. Um processo concluído com DOCS ENVIADOS vazio apareceria como pendência urgente eternamente, poluindo o alerta | **RESOLVIDO**: acrescentado `E categoria ≠ "Desembaraçado"`. Também exclui "Fechado — aguardando draft", que por definição tem ETA2 vazio e não satisfaz a condição de data |
| **A-19** | AMBIGUIDADE | Indicador "Processos atrasados" e alerta "ETA vencida" | §4: `"ETA2 < hoje E categoria ≠ 'Desembaraçado'"` | Indicador e alerta têm **regra idêntica**, mas são itens distintos do catálogo. Não se sabe se são o mesmo conceito com duas apresentações | **RESOLVIDO**: mesma função de cálculo, duas apresentações (cartão numérico e lista ordenada). Uma única fonte de verdade em código |
| **A-20** | LACUNA | Indicador "Processos atrasados" | idem | Não define o tratamento de ETA2 **vazio**. Um processo sem data prevista não pode estar atrasado nem em dia | **RESOLVIDO**: ETA2 nulo **nunca** satisfaz comparação de data. Fica fora de todo indicador de calendário e atraso |
| **A-21** | AMBIGUIDADE | Indicador "Quantidade de processos" | §4: `"Contagem de linhas com REF preenchido"` | Não define o tratamento de REF **duplicado**. A spec declara REF como "identificador único da linha", mas planilha manual não tem restrição de unicidade | **RESOLVIDO**: REF duplicado → a **primeira ocorrência** (menor número de linha) é a válida; as demais vão para quarentena com motivo `REF_DUPLICADA`, e são contadas no relatório. Ver tabela de decisão em `03-modelo-dados.md` |
| **A-22** | CONTRADIÇÃO | §2.2 versus §2.1 | §2.2: `"Linhas com REF preenchido e as demais colunas vazias"` | Uma linha só com REF tem STATUS vazio, o que pela regra §2.1 a classificaria como **"Em desembaraço"**. As duas regras colidem na mesma linha | **RESOLVIDO**: a verificação de §2.2 **precede** a de §2.1 na ordem de classificação. Ordem explícita na tabela de decisão TD-01 |
| **A-23** | AMBIGUIDADE | §2.2 | `"e as demais colunas vazias"` | Não define se "demais colunas" inclui as fora de escopo (Coluna 13, R$ ENVIADO) nem se uma célula com espaço em branco conta como vazia | **RESOLVIDO**: "vazia" := após `trim`, string de comprimento zero. "Demais colunas" := **todas** as colunas lidas, incluindo as fora de escopo. Casos concretos em TD-01 |
| **A-24** | LACUNA | Indicador "Navios previstos" | §4: `"Lista de navios com ETA2 futura, ordenada por data"` | "Futura" não define se inclui hoje. Sobrepõe-se parcialmente a "Containers chegando hoje" | **RESOLVIDO**: `ETA2 >= hoje` (inclui hoje), ordenado crescente por ETA2, depois por nome de navio normalizado |
| **A-25** | LACUNA | Indicadores de ranking (clientes, importadores, agentes) | §4: `"ordenada decrescente"` · §6: `"Ranking visual (Top N)"` | "Top N" nunca define N. Nem o critério de desempate | **RESOLVIDO**: N = 10, configurável na tela. Desempate alfabético pelo valor normalizado, ascendente |
| **A-26** | AMBIGUIDADE | Indicadores de agrupamento | §4, colunas CLT / IMPORTADOR / AGENTE / NAVIO | Campos de texto livre digitados à mão. A spec não define normalização, então `"RSASSI"`, `"rsassi"` e `"RSASSI "` seriam três grupos distintos | **RESOLVIDO**: função de normalização determinística fixada (`trim` → maiúsculas → remoção de acentos → colapso de espaços). Não corrige digitação — isso é §8, fora de escopo. O rótulo exibido é a primeira grafia encontrada |
| **A-27** | LACUNA | Indicador "Ranking de agentes" | §4, objetivo: `"Identificar concentração de volume/atraso por agente"` | O objetivo menciona **atraso**, mas a regra de cálculo é apenas `"Contagem agrupada por AGENTE"` — não calcula atraso algum | **RESOLVIDO**: implementado conforme a **regra** (contagem), com uma coluna adicional de processos atrasados no mesmo agrupamento, que satisfaz o objetivo sem inventar regra nova |
| **A-28** | LACUNA | Indicador "Ranking por responsável" | §4: `"Contagem agrupada pela cor da linha"` | Contempla apenas Azul e Roxo. Não define o destino de bege, verde, vermelho, branco e amarelo no ranking de responsável | **RESOLVIDO**: `responsible` é derivado **apenas** de azul, roxo e bege. Verde, vermelho, branco e amarelo não carregam responsável → `indefinido`. Consequência aceita e registrada: a cor codifica dimensões concorrentes e uma linha vermelha perde a informação de responsável (ver A-31) |
| **A-29** | LACUNA | Indicador "Processos desembaraçados hoje" | §4: `"RG = data de hoje"` | Não cruza com a categoria. A foto 2 mostra RG preenchido em linha **não** desembaraçada (ver A-05), o que faria o indicador contar processo não concluído | **RESOLVIDO**: acrescentado `E categoria = "Desembaraçado"` |
| **A-30** | LACUNA | Indicador "Tempo médio de envio documental" | §4 | Não define o tratamento de intervalo **negativo** (RG anterior a DOCS ENVIADOS), nem de linhas com apenas um dos dois campos preenchidos | **RESOLVIDO**: pares incompletos são excluídos do cálculo. Intervalo negativo é excluído da média e listado no relatório de divergências. O denominador exibido informa quantos processos entraram |
| **A-31** | CONTRADIÇÃO | §3 (dicionário de cores) | A tabela atribui a **uma única propriedade** — a cor de preenchimento — quatro significados de dimensões diferentes: responsável (azul, roxo, bege), status (verde, branco), canal (vermelho) e localização do importador (amarelo) | Uma linha só tem uma cor. Um processo do Colaborador 1 que entre em Canal Vermelho **perde** a informação de responsável, e vice-versa. A informação é estruturalmente lossy na origem | **RESOLVIDO**: os três campos derivados são independentes e admitem `indefinido`. A aplicação **não** infere um a partir do outro. Registrado como risco R-04 |
| **A-32** | LACUNA | Alerta "Processos parados" | §5: `"Categoria sem alteração por um número de dias definido pelo negócio"` | O número de dias **não** é definido em lugar nenhum da especificação | **RESOLVIDO**: limiar padrão de **15 dias**, configurável na tela sem recompilar. Valor é premissa, marcado como tal na interface |
| **A-33** | LACUNA | Alerta "Processos parados" e Página Histórico | §5 e §6: `"depende do histórico de leituras"` | A especificação declara ambos bloqueados por falta de histórico | **RESOLVIDO**: destravado por ADR-0005 (histórico JSONL append-only). Ver `03-modelo-dados.md` |
| **A-34** | AMBIGUIDADE | Indicador "Mercadorias" | §4: `"Contagem agrupada por texto (ciente de que 'BAZAR' domina a base)"` | A própria spec declara o indicador de baixo valor, mas o mantém no catálogo sem definir o que fazer com a distorção | **RESOLVIDO**: implementado como especificado, com "BAZAR" exibido em destaque separado do restante, e a limitação declarada na própria tela. Nenhuma categorização é inventada (isso seria CATEGORIA_MACRO, de §8, fora de escopo). **Medido em `H-11`:** 210 processos, **35,47%** dos que têm mercadoria preenchida — a maior fatia com folga, 5,7× o segundo colocado real, mas **não** maioria absoluta. A especificação afirmava o domínio sem número; agora ele tem um, exposto em `meta.bazarShare` |
| **A-35** | AMBIGUIDADE | Indicador "Containers chegando em 15 dias" | §4: `"ETA2 entre hoje e hoje + 15 dias"` | Não define se os extremos são inclusivos | **RESOLVIDO**: intervalo fechado nos dois extremos, `hoje <= ETA2 <= hoje+15`. Mesma regra para o alerta de 7 dias e para o limiar de 10 dias de documentação |
| **A-36** | LACUNA | Coluna ETA (porto) | §2: `"Porto de chegada (ex.: RIO, SC, MULTI, MULTIRIO)"` | "ex.:" indica lista **aberta**. O filtro de porto em §7 lista os mesmos 4 valores como se fossem fechados | **RESOLVIDO**: domínio aberto. Os valores do filtro são derivados dos dados presentes no arquivo, não de lista fixa |

---

## Cruzamento (c) — Filtros e telas

### Filtros globais (§7)

| Filtro | Campo de origem | Situação |
|---|---|---|
| Período (ETA2) | ETA2 | OK — depende de P-03 |
| Cliente (CLT) | CLT | OK, com normalização (A-26) |
| Importador | IMPORTADOR | OK, com normalização (A-26) |
| Navio | NAVIO | OK, com normalização (A-26) |
| Agente | AGENTE | **A-09** — coluna E não confirmada |
| Mercadoria | MERCADORIA | OK, com limitação declarada (A-34) |
| Status classificado | STATUS derivado | **A-01** — vocabulário inválido |
| Responsável | cor da linha | **A-18** — bege sem tratamento definido |
| Canal | cor da linha | **A-37** abaixo |
| Porto (ETA) | ETA | **A-36** — domínio aberto |

| ID | Tipo | Seção | Trecho citado | Impacto | Destino |
|---|---|---|---|---|---|
| **A-11** | CONTRADIÇÃO | §3 × §7 | §3: `"Amarelo forte | Importador localizado fora do RJ. | Usar como valor do filtro 'Importador fora do RJ'"` | §3 **define** o filtro; §7, que lista os filtros globais, **não o inclui**. O filtro existe ou não existe | **RESPONDIDO**: o usuário confirmou que amarelo forte = importador fora do RJ. Filtro incluído na lista global, totalizando 11 filtros |
| **A-37** | AMBIGUIDADE | §7 | `"Canal (cor da linha: Vermelho / demais)"` | "demais" não é um valor de domínio; é a negação do primeiro. Além disso, a foto 2 mostra a existência real de Canal Amarelo no texto do STATUS, sem representação estruturada | **RESOLVIDO**: domínio do filtro = `vermelho`, `nenhum`, `indefinido`. Canal Amarelo **não** é campo estruturado — não há cor que o represente, já que amarelo significa outra coisa (A-38). Registrado como limitação conhecida na matriz de rastreabilidade |
| **A-38** | CONTRADIÇÃO | §3 × evidência | §3: `"Amarelo forte | Importador localizado fora do RJ"` × foto 2, linha amarela: `"DUIMP: 26BR0001247418-6 - CANAL AMARELO"` | A única linha amarela visível nas fotos tem, no seu STATUS, o texto "CANAL AMARELO" — o que sugeriria que amarelo codifica canal, não localização | **RESPONDIDO**: o usuário decidiu que amarelo = **importador fora do RJ**, e que a coincidência com Canal Amarelo naquela linha é acidental. Consequência aceita: Canal Amarelo não é rastreável de forma estruturada |
| **A-39** | LACUNA | §2 × §6/§7 | §2 declara BL e CNTR como `"Campo de referência/consulta"` | Nenhuma tela de §6 e nenhum filtro de §7 oferece meio de consultar por BL ou CNTR. O papel declarado da coluna não tem realização na interface | **RESOLVIDO**: campo de busca textual livre na Página Operacional, cobrindo REF, BL e CNTR. Não é filtro global — é busca, e está em `H-17` |

### Telas (§6)

| ID | Tipo | Seção | Trecho citado | Impacto | Destino |
|---|---|---|---|---|---|
| **A-12** | LACUNA | §6, Página Inicial | `"Cartões-resumo: total de processos, desembaraçados, em andamento, aguardando draft, Canal Vermelho, chegadas hoje/semana/15 dias."` | Omite **"Em desembaraço"**, que é categoria canônica e indicador do catálogo (§4). A soma dos cartões não fecha com o total | **RESOLVIDO**: cartão incluído. A Página Inicial passa a exibir as 4 categorias, e o rodapé confere a soma contra o total |
| **A-40** | LACUNA | §6, Página Inicial | idem | Omite "Processos atrasados" e "Documentos pendentes" — os dois indicadores de urgência do catálogo. A tela de entrada não mostra o que exige ação | **RESOLVIDO**: ambos incluídos como cartões de alerta, visualmente distintos dos cartões de volume |
| **A-41** | LACUNA | §6, Página Alertas | `"Lista dos alertas da seção 5, ordenada por urgência."` | "Urgência" não é definida. Seis tipos de alerta heterogêneos não têm ordem natural entre si | **RESOLVIDO**: ordenação por severidade fixa (1 ETA vencida · 2 Canal Vermelho · 3 Documentação pendente · 4 Processos parados · 5 Chegadas hoje · 6 Chegadas 7 dias), e dentro de cada grupo por ETA2 ascendente, nulos por último. Ordem registrada em `H-20` |
| **A-42** | LACUNA | §6, Página Performance | `"quebrado por cliente/agente/navio/responsável"` | Não define o tratamento de grupos com poucos processos, onde a média é estatisticamente inútil | **RESOLVIDO**: o denominador (nº de processos) é exibido ao lado de cada média. Nenhum corte mínimo é imposto — omitir grupo seria inventar regra |
| **A-43** | LACUNA | §6, Página Histórico | `"Evolução mensal de volume, desembaraçados e Canal Vermelho"` | Além de depender de histórico (A-33), não define o ponto de partida da série nem o comportamento antes de existir histórico acumulado | **RESOLVIDO**: a série começa na data da primeira execução da aplicação. A tela declara explicitamente que não há retroatividade anterior a isso |

---

## Achados por evidência da planilha real

| ID | Tipo | Evidência | Impacto | Destino |
|---|---|---|---|---|
| **A-03** | CONTRADIÇÃO | Foto 2 mostra, na coluna STATUS, tanto `DESEMBARAÇADA` quanto **`DESEMBARÇADA`** (sem o segundo "A"). §2.1 exige `"Texto igual a 'DESEMBARAÇADA'"` | Sob a regra literal, a linha com a grafia variante seria classificada como **"Em andamento"** — um processo concluído contado como pendente. Erro silencioso e direcional | **RESOLVIDO**: dicionário explícito de variantes aceitas em `config/status-aliases.json`, contendo as duas grafias observadas. Valores próximos mas ausentes do dicionário são **listados para aprovação humana**, nunca classificados por adivinhação. Ver TD-02 |
| **A-04** | CONTRADIÇÃO | §3: `"Branco (sem cor) | Processo em desembaraçamento. | Coerente com STATUS vazio"`. Foto 1, linha 483 (`FT533.26`), é **branca**; foto 2, mesma linha, tem STATUS `"DUIMP: 26BR0001273903-1 - CONFERIDO 29.07"` — **preenchido** | A coerência afirmada entre cor e status **não se sustenta no dado real**. Se a cor fosse usada para inferir status, essa linha seria classificada errado | **RESOLVIDO**: cor e STATUS são campos **independentes**. A cor nunca infere, confirma ou sobrepõe a categoria de status. Vale também para verde (§3 já o chamava de "confirmação visual, não fonte primária") |
| **A-05** | CONTRADIÇÃO | §2.1.1: RG `"representa o momento em que o desembaraço foi concluído"`. Foto 2: a linha amarela tem `RG = 31/jul` **e** STATUS `"DUIMP: 26BR0001247418-6 - CANAL AMARELO"` — categoria "Em andamento" | RG preenchido em processo não concluído contradiz a semântica declarada. O indicador "Processos desembaraçados hoje" (`RG = hoje`) contaria esse processo como concluído | **RESOLVIDO**: indicador cruzado com a categoria (ver A-29). Ocorrências de RG preenchido em processo não desembaraçado entram no relatório de divergências |
| **A-09** | LACUNA | Foto 1: entre as colunas **D** e **F** existe uma coluna **E colapsada**, com largura mínima e cabeçalho ilegível. Foto 2: existe uma coluna **P** com cabeçalho truncado (`"Colun…"`), posterior a DOCS ENVIADOS e não documentada em §2 | A spec descreve 15 colunas; a planilha real tem ao menos 16. AGENTE — exigido por um indicador e um filtro — é a única coluna da spec sem letra visível, portanto presumivelmente E | **PREMISSA P-01 e P-02**, resolvidas por `H-01`. Enquanto não resolvidas, "Ranking de agentes" e o filtro Agente ficam marcados como dependentes de perfilamento na matriz de rastreabilidade |
| **A-10** | RISCO | Fotos 1 e 2 exibem todas as datas no formato `29/jul`, `04/ago`, `30/jul`, `10/jul` — **sem ano** | Se as células forem **datas reais** do Excel, o ano existe no serial e apenas não é exibido: nenhum problema. Se forem **texto**, o ano é irrecuperável e todo indicador de calendário, atraso e tempo fica sem base | **PREMISSA P-03**, resolvida por `H-01`. Se o perfilamento indicar texto, é o cenário de maior impacto do projeto — risco R-02, com contingência definida em `07-plano-entrega.md` |
| **A-44** | LACUNA | Foto 2: a coluna **N (R$ ENVIADO)** tem preenchimento ciano fixo e a coluna **O (DOCS ENVIADOS)** tem preenchimento cinza fixo, **independentes** da cor da linha. As colunas K e L acompanham a cor da linha; M não | A "cor da linha" **não é uniforme** ao longo da linha. Ler a cor de uma coluna arbitrária produziria o valor errado | **RESOLVIDO**: a cor é lida da célula da **coluna A (REF)**, definida como âncora. Registrado em P-05 e no ADR-0003 |
| **A-45** | AMBIGUIDADE | Foto 2: a coluna N (R$ ENVIADO) contém tanto datas (`28/jul`, `27/jul`) quanto texto (`OK 23/07`); a coluna M contém `BOLETO` e `N/A` | §2 descreve R$ ENVIADO como `"Indicação/data de pagamento confirmado"` — tipo misto confirmado pelo dado | Sem impacto: ambas as colunas estão fora de escopo para indicadores. São lidas e exibidas **como texto puro**, sem tentativa de parse de data |

---

## Achados do perfilamento (H-01, 03/08/2026)

Produzidos por execução real de código sobre `CONTROLE DOS EMBARQUE.xlsx`.
Todos com origem **medido**. Ver [perfilamento/RESULTADO.md](perfilamento/RESULTADO.md).

| ID | Tipo | Achado | Impacto | Destino |
|---|---|---|---|---|
| **A-46** | CONTRADIÇÃO | A especificação descreve **uma** planilha com 15 colunas. O arquivo tem **4 abas** com **três esquemas distintos**: `2026` (16 colunas), `2025` (14 — coluna A é `REF. FAITH`, **sem DOCS ENVIADOS**, duas colunas chamadas `ETA`) e `2024` (12 — **sem IMPORTADOR**, tem `ARMAD`, situação em `ANDAMENTO` e não `STATUS`) | A spec descreve apenas o esquema de 2026. Ler as demais com o mesmo mapeamento produziria campos trocados | **RESPONDIDO**: apenas a aba `2026` entra no escopo. A aba é configurável em `config/app.json`, para a virada de ano |
| **A-47** | LACUNA / RISCO | A aba `CNPJ` contém **dado cadastral e de acesso de terceiros**, num arquivo sincronizado com a nuvem da organização. O inventário das colunas não é versionado: descrever a estrutura de um dado sensível é descrever onde ele está | Exposição de dado pessoal e de acesso. A especificação nunca menciona esta aba | **RESOLVIDO**: aba **excluída** do escopo — não lida, não exibida, não registrada em log. O relatório de perfilamento versionado foi sanitizado. A exposição em si antecede este projeto; fica registrada em `08-qualidade-operacao.md §4` |
| **A-48** | CONTRADIÇÃO | O dicionário de cores de §3 lista 7 cores. O arquivo tem **9 chaves de estilo**, incluindo **dois tons de verde** (`FF00FF00` 258 linhas, `FF00FF0D` 219) e **dois de roxo** (`FFA74F7B` 31, `FFA64D79` 5), visualmente indistinguíveis, em blocos contíguos de linhas | 224 linhas (34,5% da base) usam tons não previstos. Sem tratamento, cairiam em quarentena | **RESPONDIDO**: cada par é unificado — os dois verdes e os dois roxos são o mesmo significado. Entradas **separadas** no `color-map.json` apontando para o mesmo valor; **nenhuma tolerância por proximidade** é introduzida (ADR-0003) |
| **A-49** | LACUNA | Uma mesma cor é produzida por **vários `styleId`**: `argb:FF00FF00` vem dos styleIds 199, 165 e 189, que compartilham `fillId=2` mas diferem em **borda** (34, 5, 48). O mesmo ocorre com os demais | Para a **leitura**, nenhum impacto — os styleIds colapsam na mesma chave, como ADR-0003 pretende. Para a **escrita**, `H-27` estava **errada**: trocar o `styleId` inteiro destruiria borda e fonte da linha | **RESOLVIDO**: `H-27` corrigida. A escrita troca apenas o **`fillId`** dentro do `cellXf`, preservando `fontId`, `borderId` e `numFmtId` originais. O `color-map.json` guarda `fillId`, não `styleId` |
| **A-50** | LACUNA | A coluna **P** tem cabeçalho `Coluna1` e **1 valor preenchido em 649 linhas** (99,9% vazia) | Coluna residual da Tabela do Excel (`xl/tables/table1.xml`), sem significado de negócio | **RESOLVIDO**: P-02 confirmada. Lida e exibida na tela de detalhe, sem uso em indicador. Editável, para não impedir uso futuro |
| **A-51** | CONTRADIÇÃO | §2 lista o porto (ETA) como `RIO, SC, MULTI, MULTIRIO`; §7 repete os mesmos 4 no filtro. O arquivo tem **5 valores**, incluindo **`RO`**, não documentado | Um filtro de domínio fixo omitiria os processos com porto `RO` | **RESOLVIDO**: confirma A-36. O domínio do filtro é derivado do arquivo, nunca de lista fixa |
| **A-52** | LACUNA | **DOCS ENVIADOS está preenchida em apenas 134 de 649 linhas (20,7%)** | IND-22 (tempo médio de envio documental) opera sobre amostra pequena; IND-14 e ALE-02 (documentos pendentes) tendem a acusar volume alto, que pode ser preenchimento faltante e não pendência real | **RESOLVIDO**: IND-22 já exibe `sampleSize` (A-42). A Página Performance e o alerta declaram o percentual de preenchimento da coluna, para que o número seja lido com a ressalva correta |
| **A-53** | CONTRADIÇÃO (evidência) | Existem os valores `DESEMBARAÇADA 03/02` e `DESEMBARAÇADA 28/01` — processos concluídos com a data anexada ao texto. Pela regra de §2.1 (igualdade exata), seriam classificados como **"Em andamento"** | 2 processos concluídos contados como pendentes | **RESOLVIDO**: são o caso `VARIANTE_STATUS_PROXIMA` de TD-02, agora com valores concretos. Distância de Levenshtein 6 — acima do limiar 3, portanto **nem geram a anomalia**. Ficam registrados em `config/status-aliases.json`, seção `_naoIncluidas`, para que a omissão seja consciente. Alargar o dicionário aceitaria qualquer sufixo; a correção correta é limpar o texto na planilha |
| **A-54** | CONTRADIÇÃO (evidência) | A-04 fica **quantitativamente comprovado**: há **66 linhas com STATUS vazio** mas apenas **1 linha branca**; e a soma dos verdes (477) não bate com `DESEMBARAÇADA` (479) | Se a cor determinasse o status, haveria 66 linhas brancas. A "coerência" que §3 afirma entre cor e status não existe no dado | **RESOLVIDO**: confirma a decisão de A-04. Cor e STATUS são campos independentes; a cor nunca infere, confirma ou sobrepõe a categoria |
| **A-55** | LACUNA | O arquivo contém `xl/tables/table1.xml` (Tabela do Excel), `xl/comments1.xml` + `threadedComments` + `persons` (comentários encadeados), `vmlDrawing1.vml` e **3 itens `customXml/`** (metadados de SharePoint) | Reserializar o workbook destruiria todos esses elementos, silenciosamente | **RESOLVIDO**: é a justificativa empírica do ADR-0004. A fixture de teste `formatado.xlsx` passa a ser derivada deste arquivo, para exercitar exatamente esses elementos |

| **A-56** | RISCO (evidência) | Gravar um serial de data numa célula cujo `cellXf` tem `numFmtId=0` faz o Excel exibir **`46236`** em vez de `2/ago` — o serial `46236` é 02/08/2026, e está hoje em `I2` e `K2` de `formatado.xlsx`. Descoberto ao montar `formatado.xlsx`: aplicar o `styleId` da coluna A (Geral) às colunas de data produziu exatamente isso, confirmado em captura de tela do Excel real | `H-24` grava datas como serial numérico. Se o operador preencher ETA2, RG ou DOCS ENVIADOS numa célula que estava vazia **e** sem formato de data herdado, o valor aparecerá como número cru na planilha. `DOCS ENVIADOS` tem 79,3% de células vazias, o que torna o caso provável | **RESOLVIDO**: `H-24` passa a garantir o formato ao gravar data — se o `cellXf` da célula não tiver `numFmt` de data, compor um estilo pelo algoritmo de TD-05.1, mantendo fonte, borda e preenchimento e trocando apenas o `numFmtId`. O algoritmo foi validado em `tools/build_fixtures.py`, que compôs 8 estilos e reutilizou 19 |

| **A-57** | LACUNA (plano) | `08-qualidade-operacao.md §3.3` exige faixa persistente de estado `degradado` no topo de **todas** as páginas, mas nenhuma história a implementava globalmente: `H-16` cobre o aviso apenas na Página Inicial, deixando as outras seis páginas sem indicativo algum de que o dado está congelado | O operador poderia ficar horas olhando um número desatualizado sem qualquer sinal, em qualquer página que não a inicial. Levantado pelo usuário em 04/08/2026 | **RESOLVIDO**: a faixa passa a ser critério de aceite de `H-15`, que monta a casca da aplicação (`web/src/App.tsx`) e portanto envolve todas as páginas. Fonte única do estado: `GET /api/health`, que já expõe `state`, `degradedReason`, `lastReadAt` e `lastReadDurationMs` desde `H-08` e `H-31`. `H-16` mantém o painel de saúde detalhado, que é outra coisa: métrica de ingestão, não aviso de frescor |

| **A-58** | LACUNA (plano) | A aplicação detecta que o arquivo mudou por fora — o watcher recarrega em ~2 s —, mas **não distingue** alteração externa de alteração própria, e não sinaliza nada ao operador. Duas evidências de interferência ficam invisíveis: o arquivo de lock `~$<nome>.xlsx`, que indica alguém com a planilha aberta, e o arquivo `...-Cópia em conflito de <máquina> <data>.xlsx`, que o OneDrive cria quando **não consegue mesclar** — ou seja, quando alguém já perdeu trabalho. A defesa de `~$` prevista em `H-25` só age no momento da escrita; até lá, nada aparece | O arquivo é compartilhado por sincronização do SharePoint, então edição paralela é possível por desenho. Um arquivo de conflito não notado significa duas verdades convivendo na pasta, e a aplicação lendo uma delas sem saber da outra. Levantado pelo usuário em 04/08/2026 | **RESOLVIDO**: nova história `H-32` detecta os dois arquivos — o watcher **já observa o diretório**, então o custo é um padrão de nome a mais — e expõe `externalLock` e `conflictFiles` em `GET /api/health`. O aviso vai para a mesma faixa de `H-15` (A-57). **Limite declarado:** edição em andamento no Excel Online **não** é detectável — a coautoria trava no servidor do SharePoint, e consultar o Microsoft Graph violaria RNF-31 e reintroduziria autenticação. O aviso possível é "o arquivo mudou por fora" ou "alguém o tem aberto", nunca a identidade de quem edita. A sincronização do `~$` entre máquinas é **premissa P-15**, a medir em `H-30` |

| **A-59** | LACUNA | ALE-01 e ALE-02 excluem processo `desembaracado` explicitamente. **ALE-03, ALE-04 e ALE-05 não dizem nada sobre categoria** — lidos ao pé da letra, alertam sobre processo já concluído. Medido na planilha real em 06/08/2026: seriam **5 de 14** alertas sobre processos encerrados, e em Canal Vermelho a maioria (3 de 5) | A Página Alertas é **fila de trabalho**, não panorama: cada linha existe para pedir uma ação, e o alerta é identificado só por `ref` (regra inviolável 8), sem os campos que fariam dele um resumo. Processo concluído não pede ação, e são 480 de 649 na base. Levantado pelo usuário em 06/08/2026 | **RESOLVIDO**: `∧ category ≠ 'desembaracado'` passa a valer nos **cinco** alertas, uniformemente. Mesma natureza de A-29, que acrescentou o cruzamento com categoria a IND-16. Medido depois do filtro: 40 linhas para 25 processos distintos — fila que se pode zerar. `fechado_aguardando_draft` **não** polui: os 34 do arquivo têm zero canal vermelho e zero ETA2, logo não geram alerta algum |
| **A-60** | LACUNA | ALE-04 (`eta2 = hoje`) está **contido** em ALE-05 (`hoje ≤ eta2 ≤ hoje+7`): toda chegada de hoje gera duas linhas, severidade 5 e 6. O plano manda gerar as duas, com caso-limite explícito em `H-14`. Some-se a isso que um processo pode satisfazer até três tipos — medido: 13 de 25 processos aparecem mais de uma vez, um deles 3× | Na API a duplicação é correta: cada linha é uma pendência distinta, e o critério de aceite exige. Na **tela**, 40 linhas para 25 processos confundem quem lê. Levantado pelo usuário em 06/08/2026 | **RESOLVIDO na apresentação, não no contrato**: `GET /api/alerts` continua achatado, com uma entrada por par (processo, tipo) — é o formato que permite contar por tipo e ordenar por severidade. **`H-20` agrupa por processo na exibição**, decisão do usuário em 06/08/2026. Nenhuma mudança em `H-14` |
| **A-61** | LACUNA | `historyStartedAt`, no corpo de `GET /api/alerts`, existe para a interface não sugerir retroatividade inexistente (A-43) — mas o histórico só passa a existir em `H-28`, e o contrato tipa o campo como string ISO. Entre `H-14` e `H-28` não há data possível | Preencher com a data da partida do processo afirmaria histórico que não foi coletado, exatamente o que A-43 quer evitar. Levantado pelo usuário em 06/08/2026 | **RESOLVIDO**: o campo passa a ser `string \| null`, e vale `null` até `H-28` gravar a primeira leitura. Mesmo princípio de `averageDays` em IND-22 (A-42): buraco visível é melhor que valor inventado. `H-28` é responsável por passar a devolver a data, e `H-20` por exibir a ressalva quando for `null` |
| **A-62** | LACUNA | Os alertas são derivados do estado atual **e do dia corrente**, e `hoje` é resolvido a cada requisição. Uma tela deixada aberta atravessando a meia-noite continua exibindo a fila do dia anterior — `daysOverdue` desatualizado, chegada de amanhã ainda como futura — até que algo dispare nova requisição | O operador tende a deixar o painel aberto. A parte que depende da planilha se atualiza sozinha pelo watcher em menos de 5 s (RNF-14), mas a que depende do **calendário** não tem gatilho algum: nenhum arquivo muda à meia-noite. Levantado pelo usuário em 06/08/2026 | **DECIDIDO em 06/08/2026, a implementar em `H-15`:** revalidar no evento de a aba voltar ao foco (`visibilitychange`), com a comparação entre o dia do servidor e o dia do cliente como rede para o painel que nunca perde foco, **e um botão de atualização manual** — decisão do usuário. O botão deve chamar `POST /api/reload` **antes** de refazer as requisições: quem clica acabou de mexer na planilha e quer ver o resultado sem esperar o watcher, e a rota já existe desde `H-08`. O botão é também a saída explícita para qualquer caso que os dois gatilhos automáticos não cubram. **Timer agendado para a meia-noite não serve** — máquina suspensa não executa `setTimeout`, e acordaria de manhã ainda no dia anterior, que é exatamente a falha a evitar. Recarga em intervalo fixo funciona e é mais simples, ao custo de centenas de requisições para acertar uma transição; numa aplicação local o custo é baixo, então segue defensável. **Ponta técnica:** a comparação exige uma fonte do dia do servidor, e hoje só `GET /api/indicators` a expõe, em `meta.today` — `/api/alerts` não tem campo equivalente. A casca já consome `GET /api/health` para a faixa de A-57, e é o candidato natural a fonte única. Não bloqueia `H-14`: o domínio recebe `today` por parâmetro, então a correção é inteiramente de apresentação |

| **A-63** | LACUNA (plano) | `05-contratos-api.md §4` especifica a rota estática `GET /*` — "serve a SPA compilada; qualquer caminho não iniciado por `/api/` devolve `index.html`, para que o roteamento do cliente funcione em recarga direta de URL" —, mas ela **não aparece no mapa rota → história** da mesma seção, e `src/http/server.ts` não a registra. `@fastify/static` está em `dependencies` desde `H-02`, o que mostra que a peça foi prevista e nunca agendada | O roteamento à mão de D-16 usa `History API`: com a casca de `H-15`, `/alertas` é um endereço real que o operador pode marcar como favorito ou recarregar com F5. Em `npm run dev` o Vite cobre com o fallback de SPA e o buraco fica invisível; em produção, a mesma URL responde `404`, e a descoberta acontece na instalação. Levantado ao implementar a casca em 07/08/2026 | **RESOLVIDO**: a rota passa a ser de `H-30`, que é quando `dist/web` existe na máquina do operador — a mesma história do `iniciar.cmd` e da instalação. Registrada no mapa rota → história. **Fora de `H-15`**: a casca não depende dela para nada em desenvolvimento, e antecipá-la obrigaria o servidor a lidar com `dist/web` inexistente, que é o estado normal antes do `build` |

| **A-64** | LACUNA (plano) | `09-rastreabilidade.md` atribui a `H-16` os indicadores **`IND-01` a `IND-09` e `IND-14` a `IND-16`**, e a linha de `IND-16` diz "cartão pendente de `H-16`" — mas a lista de cartões de `06-backlog.md` tem **11**, e nenhum deles é `desembaracadosHoje`. Mapeando um a um, os 11 cobrem `IND-01` a `IND-09`, `IND-14` e `IND-15`. **`IND-16` fica de fora**, e nenhuma outra história o reivindica | Indicador calculado e não servido ao operador não existe para ele — é exatamente a omissão que motivou a skill `/novo-indicador`, e aqui ela reapareceu um degrau adiante, entre a rota e a tela. Encontrado ao implementar `H-16` em 07/08/2026: só apareceu porque `IndicatorsCounts` obriga o campo, e a fixture do teste não compilou sem ele. Um tipo parcial teria escondido | **RESOLVIDO**: cartão **"Desembaraçados hoje"** acrescentado, e a Página Inicial passa a ter **12**. Mesmo precedente de A-12, que acrescentou "Em desembaraço", e de A-40, que acrescentou os dois de urgência — nos três casos a especificação original omitia cartão que o catálogo de indicadores já previa. Posicionado ao fim do bloco temporal, depois de "Chegando em 15 dias": os anteriores dizem o que o dia trouxe ou trará, este diz o que ele concluiu. **Medido:** vale `0` na planilha real, e é zero **provado** — o RG mais recente é 31/07, e passando esse dia a função devolve 3 |

| **A-65** | LACUNA (plano) | **Três indicadores são calculados, servidos e não exibidos por página nenhuma.** `GET /api/indicators` devolve **cinco** blocos de ranking; `H-18` consome dois (`clients`, `importers`), e `goods`, `agents` e `responsible` não são consumidos por história alguma. `02-requisitos.md` atribui `IND-13`, `IND-17` e `IND-20` a **`H-11` apenas**, que é backend. Encontrado por varredura sistemática em 07/08/2026, feita porque A-64 foi a terceira ocorrência do padrão "regra pronta, apresentação esquecida" | Pior que A-64, porque dois deles carregam **correção de auditoria que se perde inteira sem tela**. `bazarShare` existe por A-34 para tornar visível uma distorção medida — `BAZAR` são 210 processos, 35,47% dos que têm mercadoria, **5,7× o segundo colocado** —, e serve para o operador não ler o ranking como se fosse real. `overdueCount` foi acrescentado a `IND-17` por A-27 porque contagem por agente não atendia ao objetivo declarado: o que importa é quem acumula atraso (medido: `B&M` tem 246 processos e 7 atrasados). Sem apresentação, as duas correções não chegam a lugar nenhum | **RESOLVIDO**: `IND-17` e `IND-20` vão para **`H-19`**, que já agrupa por agente e por responsável — contagem e `overdueCount` entram no mesmo eixo do tempo médio, que é outra métrica sobre os mesmos grupos. `IND-13` vai para **`H-18`**, que já é "ranking e distribuição": mercadoria é uma terceira dimensão do mesmo painel, e `bazarShare` é exibido junto, nunca separado do ranking que ele qualifica. **História nova foi descartada:** um ranking só não sustenta uma página, e o épico E4 já tem sete |

## Fechamento

**65 achados** — A-01 a A-65, sem lacunas na numeração — todos com destino.
Nenhum ficou sem resolução.

| Destino | Quantidade | Quais |
|---|---|---|
| RESOLVIDO por decisão de arquitetura | 58 | todos os demais |
| RESPONDIDO pelo usuário | 5 | A-11, A-38, A-46, A-48, A-62 |
| PREMISSA pendente | **0** | A-09 e A-10 foram resolvidas por `H-01` |

### Situação de A-09 e A-10 após o perfilamento

| Achado | Era | Virou |
|---|---|---|
| **A-09** · coluna E colapsada e coluna P não documentada | Premissa P-01 e P-02 | ✅ **Resolvido.** E = `AGENTE` (576 valores, 35 distintos); P = `Coluna1`, 99,9% vazia (ver A-50) |
| **A-10** · datas exibidas sem ano | Premissa P-03 · risco R-03 | ✅ **Resolvido.** 1.201 células de data são seriais reais do Excel; **zero** texto sem ano. R-03 encerrado |

**Nenhum achado gerou correção silenciosa.** Onde a especificação e o dado real
divergem, o dado real prevaleceu e a divergência está registrada acima — o que
agora é regra explícita do projeto (`00-visao-escopo.md §6.1`).
