# 00 — Visão, Escopo e Premissas

## 1. Problema

A operação de desembaraço aduaneiro é controlada numa planilha Excel mantida
manualmente. Cada linha é um processo de importação (um container). A leitura
da situação operacional depende de abrir o arquivo e interpretá-lo à mão, o
que produz três sintomas: processos parados passam despercebidos, problemas
(ETA vencida, Canal Vermelho, documentação pendente) só viram urgência quando
já são urgência, e não há leitura padronizada da operação.

## 2. Produto

Uma aplicação **local** que lê a planilha, calcula os indicadores e alertas
definidos na especificação funcional, e permite editar os processos gravando
de volta no próprio arquivo.

A planilha **continua sendo o artefato canônico**. A aplicação não a substitui;
ela a interpreta e a edita.

## 3. Escopo

### 3.1. Dentro do escopo

| Item | Detalhe |
|---|---|
| Leitura da planilha | Parse do `.xlsx` sincronizado pelo OneDrive, incluindo a cor de preenchimento da linha |
| Recarga automática | Detecção de alteração externa do arquivo e reprocessamento |
| Classificação de STATUS | As 4 categorias canônicas (§2.1 e §2.2 da especificação) |
| Campos derivados de cor | Responsável, Canal e Importador fora do RJ |
| Indicadores | 21 dos 22 do catálogo (§4). O 22º está fora de escopo por decisão da própria especificação — ver 3.2 |
| Alertas | Os 6 do catálogo (§5), incluindo "Processos parados" |
| Telas | As 6 páginas de §6, mais a tela de detalhe do processo |
| Filtros globais | Os 10 de §7, com as correções da auditoria |
| Edição | Campos de texto e data (Fase 2); campos que vivem na cor (Fase 4) |
| Escrita na planilha | Sob comando explícito, com seis defesas de integridade |
| Histórico | Registro append-only das mudanças de categoria |
| Quarentena | Relatório de toda linha não interpretada, com motivo |

### 3.2. Fora do escopo

| Item | Motivo |
|---|---|
| Indicador "Tempo médio até desembaraço" | A especificação (§4, observação) o coloca fora de escopo por falta da data de presença de carga. O usuário confirmou que **não haverá colunas novas**, então a lacuna permanece. Registrado na matriz de rastreabilidade como bloqueado |
| Colunas novas de qualquer natureza | Decisão do usuário: a aplicação reproduz apenas as colunas existentes |
| Banco de dados, nuvem, Supabase | Decisão do usuário: a aplicação roda inteiramente local |
| Autenticação e controle de acesso | Um único usuário, servidor ligado apenas em `127.0.0.1` |
| Acesso remoto (celular, outra máquina) | Consequência aceita da arquitetura local |
| Multiusuário e edição concorrente | Um único usuário |
| Indicadores sobre "Coluna 13" e "R$ ENVIADO" | A especificação os declara fora de escopo (§2). Os campos são **lidos e exibidos**, mas não alimentam indicador nem alerta |
| Automações de §8 (e-mail, Teams, notificação) | Melhorias futuras na própria especificação |
| Indicadores preditivos e métricas de SLA de §8 | Melhorias futuras na própria especificação |
| Normalização automática de nomes com correção de digitação | §8. A normalização implementada é determinística (caixa, acento, espaço), não corretiva |

### 3.3. Fronteira explícita

A aplicação **não** infere dado que não existe. Onde a planilha não tem a
informação, o indicador correspondente é declarado bloqueado na matriz de
rastreabilidade — não é aproximado por um campo parecido.

## 4. Premissas

**`H-01` foi executada em 03/08/2026** sobre o arquivo real
`CONTROLE DOS EMBARQUE.xlsx`. As premissas P-01 a P-07 deixaram de ser
suposição. Resultado completo em
[perfilamento/RESULTADO.md](perfilamento/RESULTADO.md).

### 4.1. Premissas resolvidas pelo perfilamento

| ID | Premissa | Situação | Fato medido |
|---|---|---|---|
| P-01 | A coluna **E** é AGENTE | ✅ **Confirmada** | Cabeçalho literal `AGENTE`; 576 valores preenchidos, 35 distintos. A coluna não está oculta — apenas estreita |
| P-02 | A coluna **P** não é usada por indicador | ✅ **Confirmada** | Cabeçalho `Coluna1`; **1** valor preenchido em 649 linhas (99,9% vazia). Coluna residual de Tabela do Excel. Lida e exibida no detalhe, sem uso em cálculo |
| P-03 | As datas são seriais reais do Excel | ✅ **Confirmada** | 1.201 células de data (585 em ETA2, 483 em RG, 133 em DOCS ENVIADOS), **zero** texto sem ano. O formato `dd/mmm` das fotos era exibição, não conteúdo |
| P-04 | A planilha tem **uma** aba | ❌ **Refutada** | **4 abas**: `2026`, `2025`, `2024` e `CNPJ`, com três esquemas de coluna distintos. Resolvido por decisão de escopo — ver 4.2 |
| P-05 | A coluna A ancora a cor da linha | ✅ **Confirmada** | 649 de 649 linhas com REF têm chave de estilo na célula A |
| P-06 | As cores são as sete do dicionário de §3 | ⚠️ **Parcialmente refutada** | **9 chaves reais**. Há dois tons de verde e dois de roxo, visualmente idênticos; "branco" existe em 1 linha, não como categoria. Resolvido — ver A-48 |
| P-07 | Volume e crescimento | ✅ **Medido (parcial)** | **649 linhas** na aba 2026, 16 colunas, 293.386 bytes. O **crescimento mensal** continua pendente de informação sua |

### 4.2. Escopo de abas — decisão

Apenas a aba **`2026`** entra no escopo, por decisão do usuário. As demais:

| Aba | Motivo da exclusão |
|---|---|
| `2025` (665 linhas) | Esquema diferente: coluna A é `REF. FAITH`, **não tem DOCS ENVIADOS**, e tem duas colunas chamadas `ETA` |
| `2024` (191 linhas) | Esquema mais divergente ainda: **sem IMPORTADOR**, tem `ARMAD`, e a coluna de situação chama-se `ANDAMENTO` |
| `CNPJ` (28 linhas) | **Dado sensível** — cadastral e de acesso, de terceiros. O inventário das colunas não é versionado. Não é lida, não é exibida, não é registrada em log — ver A-47 |

A aba em uso é configurável em `config/app.json` (`sheetName: "2026"`). Na
virada do ano, alterar essa linha aponta a aplicação para a aba nova.

### 4.3. Premissas ainda em aberto

| ID | Premissa | Impacto se errada |
|---|---|---|
| P-08 | A máquina do operador roda **Windows** com OneDrive sincronizando a pasta localmente | Se o arquivo for acessado por caminho de rede em vez de pasta sincronizada, o watcher (`chokidar`) pode não receber eventos; passa a exigir polling. Alteração pontual em `H-08` |
| P-09 | O operador fecha o Excel antes de aplicar alterações | Sem isso, o comando "Aplicar alterações" é recusado pela detecção de lock. Não corrompe nada; apenas exige o fechamento |
| P-10 | Fuso horário `America/Sao_Paulo` para toda noção de "hoje", "semana" e "dias" | Datas de fronteira (processo chegando hoje às 23h) podem cair no dia errado |
| P-11 | A propagação da pasta local para o SharePoint é responsabilidade do OneDrive/do operador; a aplicação escreve apenas no arquivo local | A aplicação não valida se a versão do SharePoint está atualizada |
| P-12 | O arquivo `.xlsx` não é protegido por senha | ✅ **Confirmada** pelo perfilamento: o arquivo foi lido sem credencial |
| P-13 | Taxa de conversão de esforço: 1 história P ≈ 1 sessão de implementação, M ≈ 2, G ≈ 4 | Erro na taxa altera proporcionalmente a faixa de esforço em `07-plano-entrega.md`, não o sequenciamento |
| P-14 | Crescimento mensal de linhas | **Pendente.** Depende de informação sua. Com 649 linhas em ~8 meses de 2026, a ordem de grandeza é confortável para a arquitetura em memória, mas o número não é afirmado |
| P-15 | O OneDrive sincroniza o arquivo de lock `~$<nome>.xlsx` entre as máquinas | **Pendente — não afirmada.** O OneDrive mantém listas de exclusão para arquivos temporários, e não houve como medir. Se sincronizar, `H-32` avisa que **qualquer pessoa** tem o arquivo aberto; se não, o aviso cobre apenas quem o abrir na própria máquina do operador — ainda útil, porque impede gravar por cima do próprio Excel aberto. **Verificação em `H-30`:** abrir o arquivo numa segunda máquina e observar se o `~$` aparece na pasta sincronizada. A detecção de arquivo de conflito **não** depende desta premissa |

## 5. Glossário do domínio

| Termo | Significado neste projeto |
|---|---|
| **Processo** | Uma linha da planilha. Um container em processo de importação. Identificado por REF |
| **REF** | Referência interna do processo. Identificador único da linha. Ex.: `FT498.26` |
| **BL** | *Bill of Lading*, conhecimento de embarque. Praticamente único por processo; usado para consulta, nunca para agrupar |
| **CNTR** | Número do container. Campo de consulta |
| **CLT** | Cliente. Base de agrupamento e ranking |
| **IMPORTADOR** | Empresa importadora responsável pela carga |
| **AGENTE** | Agente de carga responsável pelo transporte |
| **ETA** | **Porto de chegada**, não data. Valores observados: RIO, SC, MULTI, MULTIRIO. "SC" = Santa Catarina |
| **ETA2** | Data prevista ou realizada de chegada. Base de todos os indicadores de calendário e atraso |
| **RG** | Data de Registro. Na prática, a data em que o desembaraço foi **concluído**. Extremidade **final** de todo intervalo de tempo |
| **DOCS ENVIADOS** | Data de envio da documentação ao setor de desembaraço. Vazio = documentação pendente |
| **STATUS** | Texto livre. Nunca lido literalmente; sempre classificado nas 4 categorias canônicas |
| **BAZAR** | Valor de MERCADORIA que indica carga variada, não um produto. Domina a base e torna MERCADORIA pouco confiável como categoria |
| **DUIMP** | Declaração Única de Importação. Aparece como texto dentro de STATUS. Tratado como texto opaco — o sistema não interpreta seu conteúdo |
| **Canal Vermelho** | Processo selecionado para fiscalização física. No dado, existe apenas como cor vermelha da linha |
| **Categoria canônica** | Uma das 4: Desembaraçado, Em desembaraço, Em andamento, Fechado — aguardando draft. Mutuamente exclusivas |
| **Chave de estilo** | Identificador literal da cor de preenchimento extraído do arquivo, sem conversão para RGB. Ver ADR-0003 |
| **Quarentena** | Destino de toda linha que a aplicação não conseguiu interpretar com segurança. Nunca é descarte silencioso |
| **Escrita cirúrgica** | Alteração dos nós XML das células modificadas dentro do zip do `.xlsx`, preservando todo o restante byte a byte. Ver ADR-0004 |

## 6. Restrições dadas pelo usuário

Estas não são decisões de arquitetura; são entradas fixas do projeto.

1. A aplicação roda **numa máquina local**, sem banco de dados e sem nuvem.
2. O `.xlsx` no OneDrive é a fonte da verdade e continua sendo editado por fora.
3. **Nenhuma coluna nova.** A aplicação reproduz apenas as colunas existentes.
4. **Um único usuário.**
5. Amarelo forte significa **importador fora do RJ** — a linha amarela das
   fotos é Canal Amarelo por coincidência, não por regra.
6. A planilha de produção **não é escrita automaticamente**; só sob comando.
7. Entrega como aplicação aberta no navegador, servida por um processo Node
   local.
8. **Apenas a aba `2026`** entra no escopo.

### 6.1. Princípio da planilha como referência prioritária

> *"Sua prioridade é tomar com referência prioritária a planilha. Seja em cor
> ou em qualquer outra coisa. Essa planilha vem de um ambiente compartilhado,
> ou seja, precisa seguir o padrão que está na aba 2026."*

Esta regra é **hierarquicamente superior** à especificação funcional. Quando o
documento e o arquivo divergirem, **o arquivo vence** — e a divergência vira
achado registrado em `01-auditoria-especificacao.md`, nunca correção silenciosa.

Consequências já aplicadas, todas confirmadas pelo perfilamento:

| Situação | O que a especificação dizia | O que a planilha mostra | Decisão |
|---|---|---|---|
| Grafia de status | Só `DESEMBARAÇADA` | Também `DESEMBARÇADA` (1 ocorrência) | Ambas aceitas |
| Cores | 7 cores, uma por significado | **9 chaves**, com tons duplicados | As 9 mapeadas |
| Branco = em desembaraçamento | Categoria operacional | **1 linha em 649** | Cor nunca infere status |
| Porto (ETA) | `RIO, SC, MULTI, MULTIRIO` | Também **`RO`** | Domínio derivado do arquivo |
| Estrutura | 15 colunas, uma aba | 16 colunas, **4 abas** | Aba `2026`, colunas A–P |

Como a planilha vem de ambiente compartilhado, a aplicação **não impõe padrão
novo**: ela se adapta ao que existe. Nenhuma edição feita pelo painel altera
convenção, layout ou estrutura do arquivo — é o que a escrita cirúrgica do
ADR-0004 garante.

### 6.2. Objetivo declarado

> *"A ideia desse dashboard é trazer qualidade de vida para o meu amigo
> trabalhar melhor."*

Critério de projeto, não retórica. Onde houver escolha entre rigor técnico e o
fluxo de trabalho de quem usa, o fluxo vence — desde que o dado não seja
corrompido. É o que justifica manter a edição pelo Excel plenamente suportada
(ADR-0001) em vez de forçar a adoção do painel, e é o que torna R-07
(painel não adotado para edição) um risco aceitável por desenho.

## 7. Documentos relacionados

Ordem de leitura em [README.md](README.md). Resultado do perfilamento em
[perfilamento/RESULTADO.md](perfilamento/RESULTADO.md).
