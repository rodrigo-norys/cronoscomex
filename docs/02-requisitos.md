# 02 — Requisitos

## 1. Requisitos funcionais

Cada requisito referencia a seção de origem na especificação funcional e as
histórias que o realizam. `IND-NN` e `ALE-NN` são os identificadores usados na
matriz de rastreabilidade (`09-rastreabilidade.md`).

### 1.1. Ingestão

| ID | Requisito | Origem | Histórias |
|---|---|---|---|
| RF-01 | Ler o arquivo `.xlsx` no caminho configurado e extrair as colunas A–P de todas as linhas de dados | §2 | H-03 |
| RF-02 | Extrair a chave de estilo de preenchimento da célula da coluna A de cada linha | §3 | H-04 |
| RF-03 | Traduzir a chave de estilo em `responsible`, `customs_channel` e `importer_outside_rj` conforme `color-map.json` | §3 | H-04 |
| RF-04 | Normalizar textos de agrupamento e converter células de data em datas | §2, A-26 | H-05 |
| RF-05 | Classificar cada linha em uma das 4 categorias canônicas | §2.1, §2.2 | H-06 |
| RF-06 | Registrar em quarentena, com motivo estruturado, toda linha não interpretável, sem descartá-la silenciosamente | A-03, A-21 | H-07 |
| RF-07 | Detectar alteração externa do arquivo e reprocessar automaticamente | "tempo real", §1 | H-08 |
| RF-08 | Emitir relatório de divergências: RG em processo não desembaraçado, intervalo documental negativo, texto de canal no STATUS, variante de grafia não catalogada | A-05, A-30, A-06, A-03 | H-07 |

### 1.2. Indicadores (§4)

| ID | Indicador | Regra formalizada | Histórias |
|---|---|---|---|
| IND-01 | Quantidade de processos | `count(REF ≠ vazio)`, incluindo "Fechado — aguardando draft" | H-09 |
| IND-02 | Processos em andamento | `count(categoria = "Em andamento")` | H-09 |
| IND-03 | Processos em desembaraço | `count(categoria = "Em desembaraço")` | H-09 |
| IND-04 | Processos desembaraçados | `count(categoria = "Desembaraçado")` | H-09 |
| IND-05 | Fechado — aguardando draft | `count(categoria = "Fechado — aguardando draft")` | H-09 |
| IND-06 | Canal Vermelho | `count(customs_channel = "vermelho")` | H-12 |
| IND-07 | Containers chegando hoje | `count(ETA2 = hoje)` | H-10 |
| IND-08 | Containers chegando esta semana | `count(hoje <= ETA2 <= domingo da semana ISO corrente)` | H-10 |
| IND-09 | Containers chegando em 15 dias | `count(hoje <= ETA2 <= hoje+15)` | H-10 |
| IND-10 | Clientes com mais processos | `count agrupado por norm(CLT)`, desc | H-11 |
| IND-11 | Importadores com mais processos | `count agrupado por norm(IMPORTADOR)`, desc | H-11 |
| IND-12 | Navios previstos | `lista de (NAVIO, ETA2) onde ETA2 >= hoje`, asc por ETA2 | H-10 |
| IND-13 | Mercadorias | `count agrupado por norm(MERCADORIA)`, desc, com "BAZAR" destacado | H-11, H-18 |
| IND-14 | Documentos pendentes | `count(DOCS_ENVIADOS vazio E ETA2 <= hoje+10 E categoria ≠ "Desembaraçado")` | H-12 |
| IND-15 | Processos atrasados | `count(ETA2 < hoje E categoria ≠ "Desembaraçado")` | H-12 |
| IND-16 | Processos desembaraçados hoje | `count(RG = hoje E categoria = "Desembaraçado")` | H-13 |
| IND-17 | Ranking de agentes | `count agrupado por norm(AGENTE)`, desc, com coluna de atrasados | H-11, H-19 |
| IND-18 | Ranking de clientes | Top 10 de IND-10 | H-11 |
| IND-19 | Ranking de importadores | Top 10 de IND-11 | H-11 |
| IND-20 | Ranking por responsável | `count` agrupado por `responsible` — uma chave por pessoa do mapa de equipe, mais a chave vazia. Eram 4 valores fixos, vindos da cor, até `H-50` | H-11, H-19, H-50 |
| IND-21 | Tempo médio até desembaraço | **Fora de escopo.** Exige data de presença de carga, que não existe e não será criada | — |
| IND-22 | Tempo médio de envio documental | `avg(RG − DOCS_ENVIADOS)` em dias, pares completos, intervalos negativos excluídos | H-13 |

### 1.3. Alertas (§5)

| ID | Alerta | Condição formalizada | Histórias |
|---|---|---|---|
| ALE-01 | ETA vencida | `ETA2 < hoje E categoria ≠ "Desembaraçado"` | H-14 |
| ALE-02 | Documentação pendente | `DOCS_ENVIADOS vazio E ETA2 <= hoje+10 E categoria ≠ "Desembaraçado"` | H-14 |
| ALE-03 | Canal Vermelho | `customs_channel = "vermelho"` | H-14 |
| ALE-04 | Chegadas hoje | `ETA2 = hoje` | H-14 |
| ALE-05 | Chegadas nos próximos 7 dias | `hoje <= ETA2 <= hoje+7` | H-14 |
| ALE-06 | Processos parados | `categoria inalterada há >= 15 dias` (limiar configurável), a partir do histórico | H-29 |

### 1.4. Telas (§6)

| ID | Requisito | Histórias |
|---|---|---|
| RF-09 | Página Inicial com cartões-resumo das 4 categorias, total, Canal Vermelho, chegadas hoje/semana/15 dias, atrasados e documentos pendentes | H-16 |
| RF-10 | Página Operacional: tabela de processos ativos com busca por REF/BL/CNTR e calendário de chegadas por navio | H-17 |
| RF-11 | Página Clientes: ranking e distribuição por CLT e IMPORTADOR | H-18 |
| RF-12 | Página Performance: tempo médio de envio documental por cliente, agente, navio e responsável, com denominador visível | H-19 |
| RF-13 | Página Alertas: lista dos 6 alertas ordenada por severidade fixa | H-20 |
| RF-14 | Página Histórico: evolução mensal de volume, desembaraçados e Canal Vermelho | H-21 |
| RF-15 | Tela de detalhe do processo, exibindo o texto original de STATUS e todos os campos, inclusive os fora de escopo | H-22 |
| RF-16 | Painel de saúde da ingestão: última leitura, linhas lidas, quarentena e divergências | H-16, H-31 |

### 1.5. Filtros globais (§7, com as correções da auditoria)

| ID | Requisito | Histórias |
|---|---|---|
| RF-17 | Aplicar simultaneamente 14 filtros: Período (ETA2), Cliente, **Processo do cliente**, **Grupo de clientes**, Importador, Navio, Agente, Mercadoria, Categoria de status, Responsável, **Cor do responsável**, Canal, Porto e Importador fora do RJ. Eram 11 até `H-49`, que separou o cliente consolidado do valor da célula CLT, 12 até `H-55`, que acrescentou o grupo, e 13 até `H-50`, que separou a pessoa responsável do que a cor diz. **Um não tem controle próprio** na barra: o grupo é o primeiro nível da árvore dentro de Cliente. São 13 controles para 14 filtros | H-15, H-49, H-55, H-50, H-66 |
| RF-18 | Todo indicador e todo alerta respeita os filtros ativos | H-15 |
| RF-19 | Os valores disponíveis em cada filtro são derivados do arquivo, não de lista fixa | H-15 |

### 1.6. Edição e escrita

| ID | Requisito | Histórias |
|---|---|---|
| RF-20 | Editar campos de texto e data de um processo, gravando a edição em fila local e refletindo-a imediatamente na interface | H-23 |
| RF-21 | Aplicar as edições pendentes no arquivo `.xlsx` apenas sob comando explícito | H-26 |
| RF-22 | Preservar integralmente formatação, cores, filtros, comentários, validações e larguras do arquivo ao gravar | H-24 |
| RF-23 | Recusar a gravação quando o Excel estiver com o arquivo aberto | H-25 |
| RF-24 | Recusar a gravação e exibir o conflito quando o arquivo tiver mudado desde a última leitura | H-25 |
| RF-25 | Gravar backup do arquivo antes de cada escrita | H-25 |
| RF-26 | Validar o arquivo após a escrita e restaurar o backup automaticamente em caso de falha | H-25 |
| RF-27 | Editar os campos codificados em cor (responsável, canal, importador fora do RJ) | H-27 |
| RF-28 | Descartar edições pendentes individualmente ou em bloco, antes da aplicação | H-23 |

### 1.7. Histórico

| ID | Requisito | Histórias |
|---|---|---|
| RF-29 | Registrar, a cada leitura, um evento por processo cuja categoria mudou desde a leitura anterior | H-28 |
| RF-30 | Calcular há quantos dias cada processo está na categoria atual | H-29 |

---

## 2. Requisitos não-funcionais

**Origem** de cada número: `medido` (execução real de código), `informado`
(dito pelo usuário), `premissa` (default assumido por este plano), `derivado`
(consequência lógica de uma decisão de arquitetura) ou `verificado`
(documentação oficial de terceiro, com fonte e data).

Nenhum número de volumetria é afirmado. As fotos da planilha são evidência
secundária e não servem para contagem; o perfilamento (`H-01`) é a única fonte
admissível.

### 2.1. Volume e crescimento

`H-01` foi executada em **03/08/2026** sobre `CONTROLE DOS EMBARQUE.xlsx`.
Todos os valores abaixo, exceto RNF-02, têm origem **medido**. Detalhe em
[perfilamento/RESULTADO.md](perfilamento/RESULTADO.md).

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-01 | Linhas de dados na aba em escopo (`2026`) | **649** | **medido** |
| RNF-02 | Crescimento de linhas por mês | **pendente** — depende de informação do usuário | P-14 |
| RNF-03 | Número de colunas | **16** (A–P) | **medido** |
| RNF-04 | Tamanho do arquivo `.xlsx` | **293.386 bytes** | **medido** |
| RNF-05 | Cardinalidade dos campos de agrupamento | CLT **508** · IMPORTADOR **25** · AGENTE **35** · NAVIO **74** · MERCADORIA **221** · porto **5** | **medido** |
| RNF-06 | Preenchimento por coluna | REF 100% · ETA2 90,1% · RG 74,4% · STATUS 89,8% · **DOCS ENVIADOS 20,7%** · Coluna1 0,2% | **medido** |
| RNF-07 | Chaves de estilo (cores) em uso | **9**, cobrindo 649 de 649 linhas (100%) | **medido** |
| RNF-39 | Abas no arquivo | **4** — `2026`, `2025`, `2024`, `CNPJ`. Apenas `2026` em escopo | **medido** |
| RNF-40 | Células de data | **1.201** (ETA2 585 · RG 483 · DOCS ENVIADOS 133), **zero** texto sem ano | **medido** |
| RNF-41 | REF duplicadas ou vazias | **0** de cada | **medido** |

> **RNF-01 valida a arquitetura.** 649 linhas × 16 colunas cabem folgadamente
> em memória. R-10 (volume acima do previsto) torna-se residual, e o ADR-0006
> permanece confortável mesmo se o arquivo triplicar.

> **RNF-06 tem uma consequência de produto:** DOCS ENVIADOS está preenchida em
> apenas 20,7% das linhas. IND-22 (tempo médio de envio documental) terá amostra
> pequena, e IND-14 (documentos pendentes) tende a acusar volume alto. Ambos
> exibem o denominador na tela justamente por isso (A-42).

### 2.2. Usuários

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-08 | Usuários nomeados | 1 | Informado |
| RNF-09 | Usuários simultâneos | 1 | Informado |
| RNF-10 | Sessões simultâneas do navegador | até 3 abas da mesma máquina | Premissa |

### 2.3. Desempenho

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-11 | Latência p95 do carregamento de qualquer página do painel | **≤ 2 s** | Premissa. Dado já reside em memória; a rota apenas serializa |
| RNF-12 | Latência p95 de aplicação de filtros | **≤ 300 ms** | Premissa |
| RNF-13 | Tempo de parse completo da planilha na inicialização | **≤ 10 s** · **medido: 104 ms** sobre as 649 linhas reais (`H-03`) | Premissa, agora com folga de 96× |
| RNF-14 | Tempo entre o Excel salvar o arquivo e o painel refletir a mudança | **≤ 5 s** · **medido: 2092 ms no pior caso** de três rodadas (2034 · 2092 · 2032 ms) sobre cópia do arquivo real (`H-08`) | Premissa, agora com folga de 2,4×. Esta é a definição operacional de "tempo real" de §1, que a especificação usa sem definir. O custo é quase todo debounce: o parse mede 120 ms |
| RNF-15 | Tempo de gravação das edições pendentes no `.xlsx` | **≤ 15 s** para até 100 células alteradas | Premissa |
| RNF-16 | Consumo de memória do processo Node | **≤ 512 MB** · **medido: 117 MB** após ler o arquivo real (`H-03`) | Premissa, agora com folga de 4×. Gatilho de reavaliação em R-10 |

### 2.4. Atualização e disponibilidade

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-17 | Frequência de verificação do arquivo | Orientada a evento (`chokidar`), com debounce de **2 s** | Premissa |
| RNF-18 | Disponibilidade | Enquanto a máquina estiver ligada e o processo em execução. **Sem compromisso formal** | Derivado da arquitetura local |
| RNF-19 | Tempo de partida da aplicação até a primeira tela útil | **≤ 20 s** (partida do processo + parse inicial) | Premissa |

### 2.5. Retenção, recuperação e integridade

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-20 | Retenção do histórico de mudanças de status | **Indefinida.** O arquivo cresce por evento de mudança, não por leitura | Derivado do ADR-0005 |
| RNF-21 | Retenção de backups do `.xlsx` | **30 backups** ou **90 dias**, o que for maior; expurgo automático do excedente mais antigo | Premissa |
| RNF-22 | RPO — perda máxima de dado aceitável | **0.** O `.xlsx` é a fonte da verdade e não é alterado sem comando | Derivado do ADR-0001 |
| RNF-23 | RTO — tempo de retomada | **Imediato.** Perder o estado da aplicação custa um reparse; perder o arquivo custa restaurar o backup mais recente | Derivado do ADR-0001 |
| RNF-24 | Taxa aceitável de linhas em quarentena após `H-01` | **≤ 2%** das linhas. Acima disso, a carga é reprovada e o mapeamento é corrigido antes de prosseguir | Premissa — critério objetivo de aprovação, ver `08-qualidade-operacao.md` |
| RNF-25 | Conciliação da leitura contra a planilha origem | **100%** das linhas com REF preenchido devem ser lidas ou explicitamente quarentenadas. Nenhuma linha pode desaparecer | Derivado de RF-06 |

### 2.6. Portabilidade e ambiente

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-26 | Sistema operacional alvo | Windows (máquina do usuário) | Informado — P-08 |
| RNF-27 | Runtime | Node.js **22.x LTS** | Decisão, ADR-0002 |
| RNF-28 | Navegador alvo | Edge ou Chrome, versão corrente | Premissa |
| RNF-29 | Interface de rede do servidor | Apenas `127.0.0.1`. O processo **não** escuta em interface externa | Decisão de segurança, ADR-0002 |
| RNF-30 | Fuso horário de todo cálculo de data | `America/Sao_Paulo` | Decisão, A-07 — P-10 |
| RNF-42 | Esquemas de cor da interface | **Dois** — claro e escuro, escolhidos por `prefers-color-scheme`. Sem alternância manual. Entregue em `H-57`: **44 tokens de cor**, todos com par, e `tests/repo/estilo.test.ts` reprova quem declarar um só. Medido no navegador nos dois esquemas, **zero reprovações** de contraste | **medido**, D-21 |
| RNF-43 | Origem das fontes da interface | **O próprio repositório** (`web/public/fonts/`), com `@font-face` local. Nenhuma requisição a CDN | Derivado de RNF-34 e RNF-31 |

### 2.7. Segurança e privacidade

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-31 | Dados em trânsito para fora da máquina | **Nenhum.** A aplicação não faz requisição de rede externa em tempo de execução | Derivado da arquitetura local |
| RNF-32 | Autenticação | **Não aplicável.** Usuário único, servidor restrito a loopback | Derivado de RNF-08 e RNF-29 |
| RNF-33 | Dado pessoal ou de cliente em log | **Proibido.** Logs referenciam processos por REF e por número de linha, nunca por nome de cliente, importador ou conteúdo de mercadoria | Decisão, ver `08-qualidade-operacao.md` |
| RNF-34 | Dependências de terceiros em tempo de execução | Apenas as listadas na stack. Nenhuma telemetria, nenhum CDN | Decisão |

### 2.8. Manutenibilidade e qualidade

| ID | Requisito | Valor | Origem |
|---|---|---|---|
| RNF-35 | Cobertura de teste do módulo de domínio (classificação, normalização, indicadores, alertas) | **≥ 90%** de linhas | Premissa — alvo, ver pirâmide em `08-qualidade-operacao.md` |
| RNF-36 | Cobertura de teste dos módulos de leitura e escrita de `.xlsx` | **≥ 80%** de linhas, com fixtures versionadas | Premissa |
| RNF-37 | Testes que tocam a planilha real | **Zero.** Toda a suíte roda sobre fixtures do repositório | Decisão, D7 |
| RNF-38 | Regras de negócio implementadas fora do módulo de domínio | **Zero.** Nenhum cálculo de indicador no cliente ou nas rotas | Decisão, ADR-0006 |

---

## 3. Fatos externos verificados

Versões e capacidades consultadas em **03/08/2026**. Nenhuma foi citada de
memória.

| Fato | Valor | Fonte |
|---|---|---|
| Node.js | 22.x LTS | — |
| TypeScript | 7.0.2 (`latest`); fallback 5.9.3 | registro npm, `dist-tags` |
| Fastify | 5.11.2 | registro npm |
| fflate | 0.8.3 | registro npm |
| chokidar | 5.0.0 (exige Node ≥ 20.19.0) | registro npm |
| React | 19.2.8 | registro npm |
| Vite | 8.2.0 (exige Node ^20.19.0 \|\| ≥22.12.0) | registro npm |
| Tailwind CSS | 4.3.3 | registro npm |
| Recharts | 3.10.1 (aceita React 19) | registro npm |
| Vitest | 4.1.10 | registro npm |
| ExcelJS lê preenchimento de célula | Sim — `cell.fill` com `type: 'pattern'`, `fgColor` | [README oficial](https://github.com/exceljs/exceljs/blob/master/README.md) |
| ExcelJS retorna `{theme, tint}` em vez de `argb` para cores de tema | Sim — defeito aberto desde 27/04/2021 | [issue #1690](https://github.com/exceljs/exceljs/issues/1690) |
| ExcelJS perde formatação condicional em ida e volta | Sim | [issue #1024](https://github.com/exceljs/exceljs/issues/1024) |
| ExcelJS perde validação de dados de template | Sim | [issue #1184](https://github.com/exceljs/exceljs/issues/1184) |
| ExcelJS pode gerar arquivo corrompido ao combinar validação e formatação condicional | Sim | [issue #1118](https://github.com/exceljs/exceljs/issues/1118), [#1305](https://github.com/exceljs/exceljs/issues/1305) |
| SheetJS Community não lê estilos de célula de forma confiável | Sim — recurso de estilos é da edição Pro | [issue #3214](https://git.sheetjs.com/sheetjs/sheetjs/issues/3214) |
| CSV não preserva formatação de célula | Sim — formato texto puro, sem estilos | [README oficial do ExcelJS](https://github.com/exceljs/exceljs/blob/master/README.md) |

> **As cinco linhas sobre o ExcelJS são registro histórico, não stack.** Ele foi
> a biblioteca de leitura até `H-33` (18/08/2026), quando o leitor passou a
> interpretar o XML direto com `fflate` e a dependência saiu do projeto. As
> linhas ficam porque são a evidência que sustenta o ADR-0004 e a regra
> inviolável 9: reserializar a planilha com uma biblioteca de `.xlsx` perde
> formatação condicional e validações.

> **Consequência registrada em voz alta:** qualquer fonte que perca formatação
> — CSV, export simplificado, cópia como texto — **invalida** a extração de
> responsável, canal e localização do importador, porque esses três campos só
> existem como cor. A aplicação exige o `.xlsx` original.
