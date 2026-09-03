# 08 — Qualidade e Operação

## 1. Estratégia de testes

### 1.1. Pirâmide e alvo por camada

| Camada | Alvo | O que cobre | Ferramenta |
|---|---|---|---|
| **Unidade — domínio** | ~70% da suíte · cobertura **≥ 90%** de linhas (RNF-35, alvo não verificado) | Normalização, classificação, mapeamento de cor, os 21 indicadores, os 6 alertas, filtros | Vitest 4.1.10 |
| **Integração — I/O** | ~25% da suíte · cobertura **≥ 80%** (RNF-36, alvo não verificado) | Leitura de `.xlsx`, cirurgia no XML, defesas de escrita, histórico, fila de edições | Vitest + fixtures `.xlsx` |
| **Ponta a ponta** | ~5% da suíte | Fluxo completo: ler → filtrar → editar → aplicar → reler | Vitest + servidor Fastify em processo |
| **Interface** | ~25% da suíte — medido em 03/09/2026: o projeto `interface` responde por 460 dos 1842 testes | Casca, navegação, faixa de estado, filtros e as oito páginas | Vitest + Testing Library 16.3.2 + jsdom 30.0.1 |

**Os dois números de cobertura são alvo, e nada os verifica.**
`vitest.config.ts` declara `coverage.thresholds` como
`{ lines: 0, functions: 0, branches: 0, statements: 0 }` nos dois projetos, e
`npm test` é `vitest run` **sem** `--coverage` — então nem o percentual é medido,
nem limiar nenhum reprova. Isto está registrado desde `PR-10` em
`docs/governance-tooling-claude.md`, e a decisão de 03/09/2026 foi **corrigir a
afirmação e não ligar a cobertura**: percentual de linha não verifica o que a
lacuna de fato pede — que os 43 casos-limite obrigatórios de §1.3 tenham virado
teste — e ligar limiar por camada é mudança de código, com o backlog fechado.
Quem quiser o número roda `npx vitest run --coverage`; ele não é portão.

**O paralelismo do Vitest fica ligado.** Desligá-lo foi tentado contra a corrida
do leitor de `.xlsx` e nunca foi o caminho: dava 0 falhas em 6 rodadas
localmente e mesmo assim reprovava no runner do GitHub. Reduzir probabilidade
não é corrigir causa — a correção foi na origem, fechando o descritor da aba
fora de escopo (`discardWorksheetStream`, medido em 0 falhas em 55 rodadas).

A camada de interface **não constava do plano original** e foi acrescentada em
06/08/2026, antes da primeira história de tela — ver decisão D-17. As três
primeiras rodam no projeto `servidor` do `vitest.config.ts`, em ambiente `node`;
a quarta roda no projeto `interface`, em `jsdom`.

**O cliente não calcula**, então o que se testa aqui é comportamento, não regra:
qual página o endereço resolve, qual faixa aparece em cada estado, se o filtro
sobrevive a recarregar. Toda regra de negócio continua em `src/domain/`, coberta
pela primeira camada.

**Regra absoluta:** nenhum teste aponta para a planilha real (RNF-37). Toda a
suíte roda sobre fixtures versionadas em `tests/fixtures/`.

### 1.2. Fixtures obrigatórias

**Já geradas**, por `tools/build_fixtures.py`, derivando do arquivo real — com
duas exceções, ambas produzidas pelo próprio script no fim da execução padrão:
`formulas.xlsx`, derivada de `basico.xlsx`, e `formatado.xlsx`, que passa por
`enriquecer_formatado` para ganhar os cinco elementos que vivem dentro do
`sheet1.xml` (autofiltro, formatação condicional, validação de dados, a coluna P
oculta e a fórmula de N9). Até 02/09/2026 esse passo só existia no modo manual, e
quem regenerasse perdia os cinco em silêncio.

| Arquivo | Linhas | Propósito |
|---|---|---|
| `basico.xlsx` | 3 | Uma linha por categoria de status |
| `cores.xlsx` | 11 | As **9 chaves reais** medidas por `H-01`, mais 1 cor real fora do mapa (`argb:FFB7E1CD`) e 1 linha **sem preenchimento** — os dois estados que `D-25` separou (02/09/2026) |
| `datas.xlsx` | 8 | Data real do Excel, texto `dd/MM/yyyy`, texto sem ano (`29/jul`), e as fronteiras de 15 dias (`hoje+15` e `hoje+16`) |
| `sujeira.xlsx` | 11 | REF duplicada por caixa e espaço, REF ausente com outras colunas preenchidas, linha totalmente vazia, `DESEMBARÇADA`, `DESEMBARAÇADO`, `DESEMBARAÇADA 03/02`, STATUS só com espaços, canal em texto, nomes parecidos |
| `so-ref.xlsx` | 4 | Linha só com REF; linha com REF e só `boletoRaw`; linha com REF e colunas só com espaços |
| `formatado.xlsx` | 9 | **Teste de preservação byte a byte** — carrega tema, `styles.xml` completo, comentários encadeados, `vmlDrawing`, `persons` e 3 itens `customXml` do arquivo real |
| `data-vazia.xlsx` | 4 | Célula de data **vazia e com estilo Geral** (`numFmtId=0`), para `H-27`: gravar data nela tem de exibir `29/ago`, não `46263` — o estilo é composto por TD-05.1, preservando fonte, borda e preenchimento (A-56) |
| `formulas.xlsx` | 3 | **Cadeia de cálculo declarada** — 3 fórmulas encadeadas na coluna `I`, com `xl/calcChain.xml` em `[Content_Types].xml` e relacionada nos rels. Exercita a remoção de entrada da cadeia em `H-25`. Ver `PD-05`, que continua aberta: **fixture nossa não substitui arquivo salvo pelo Excel** |
| `vazio.xlsx` | 0 | Cabeçalho sem nenhuma linha de dados |

### Como foram geradas, e por que assim

`tools/build_fixtures.py` **deriva do `.xlsx` real** em vez de construir do
zero. Isso resolve um problema que o plano original não tinha percebido:
gerar fixtures programaticamente (ExcelJS) ou pelo LibreOffice produziria
sempre `argb` explícito, e **nunca** reproduziria a estrutura real de
`styles.xml`, `theme1.xml`, comentários encadeados e `customXml`. Testar
preservação contra um arquivo sintético provaria pouco.

O gerador usa **a mesma técnica da escrita cirúrgica do ADR-0004** —
descompactar, alterar apenas as entradas necessárias, recompactar preservando
o resto. Ele é, na prática, uma prova de conceito de `H-24` executada antes da
implementação.

**Nenhum dado real vaza:** `xl/sharedStrings.xml` é reconstruído do zero com
apenas os textos fictícios que as fixtures usam; as abas `2025`, `2024` e
`CNPJ` têm o `sheetData` esvaziado; e-mails, nomes de autor e textos de
comentário são substituídos por marcadores. Os `styleId` usados são **reais**,
medidos por `H-01`, o que garante que `fillId`, fonte e borda sejam os do
arquivo verdadeiro.

**Regenerar:**

```bash
python3 tools/build_fixtures.py "CONTROLE DOS EMBARQUE.xlsx"
```

Necessário apenas se a planilha mudar de estrutura — por exemplo, na virada de
ano (R-14).

### 1.3. Cobertura obrigatória por regra

Toda regra classificatória e todo indicador precisa de teste com dado
concreto. Os **43 casos** abaixo são obrigatórios e derivam das tabelas de
decisão de `03-modelo-dados.md`. A contagem foi verificada sobre a própria
tabela.

| Caso-limite | Valor concreto | Resultado esperado | História |
|---|---|---|---|
| STATUS canônico | `"DESEMBARAÇADA"` | `desembaracado` | H-06 |
| STATUS com grafia variante | `"DESEMBARÇADA"` | `desembaracado` | H-06 |
| STATUS sem acento | `"DESEMBARACADA"` | `desembaracado` | H-06 |
| STATUS em caixa baixa | `"desembaraçada"` | `desembaracado` | H-06 |
| STATUS com espaços ao redor | `"  DESEMBARAÇADA  "` | `desembaracado` | H-06 |
| STATUS variante próxima não catalogada | `"DESEMBARAÇADO"` | `em_andamento` + `VARIANTE_STATUS_PROXIMA` | H-06 |
| STATUS vazio | `""` | `em_desembaraco` | H-06 |
| STATUS só com espaços | `"   "` | `em_desembaraco` | H-06 |
| STATUS com texto livre | `"AG BL ORIGINAL"` | `em_andamento` | H-06 |
| STATUS com canal em texto | `"DUIMP: ... - CANAL AMARELO"` | `em_andamento` + `CANAL_EM_TEXTO_STATUS` | H-06 |
| Linha só com REF | REF preenchido, B–P vazias | `fechado_aguardando_draft` | H-06 |
| Linha só com REF e coluna fora de escopo | REF + `boletoRaw = "N/A"` | `em_desembaraco` | H-06 |
| Linha só com REF e espaços | REF + `clientRaw = "   "` | `fechado_aguardando_draft` | H-06 |
| Cor não reconhecida | `"theme:9\|tint:0.3999"` | `indefinido` + quarentena `COR_NAO_MAPEADA` | H-04, H-07 |
| Cor próxima mas distinta | `"argb:FF00B051"` vs verde `FF00B050` | **não** mapeada | H-04 |
| Data ausente | `eta2 = null` | fora de todos os indicadores de calendário | H-10 |
| Data como texto sem ano | `"29/jul"` | `null` + `DATA_SEM_ANO` | H-05 |
| Data fora de faixa | `"32/13/2026"` | `null` + `DATA_SEM_ANO` | H-05 |
| Data no extremo do intervalo | hoje = `2026-08-03`, `eta2 = 2026-08-18` | conta em "15 dias" | H-10 |
| Data logo além do extremo | `eta2 = 2026-08-19` | não conta | H-10 |
| Fim de semana ISO | hoje = segunda `2026-08-03`, `eta2 = 2026-08-09` | conta em "esta semana" | H-10 |
| Início da semana seguinte | `eta2 = 2026-08-10` | não conta | H-10 |
| REF duplicada | `FT498.26` nas linhas 10 e 20 | linha 10 aceita, linha 20 em quarentena | H-07 |
| REF duplicada por caixa | `FT498.26` e `ft498.26 ` | mesmo REF, segunda em quarentena | H-07 |
| REF ausente com dado | REF vazio, CLT preenchido | quarentena `REF_AUSENTE` | H-07 |
| Linha totalmente vazia | todas as células vazias | ignorada, não contada | H-07 |
| RG em processo não desembaraçado | RG = hoje, categoria `em_andamento` | **não** conta em IND-16 | H-13 |
| Intervalo documental negativo | RG `2026-07-20`, DOCS `2026-07-30` | excluído, `excludedNegative++` | H-13 |
| Par documental incompleto | RG preenchido, DOCS `null` | `excludedIncomplete++` | H-13 |
| Média de conjunto vazio | nenhum par válido | `averageDays: null`, não `0` | H-13 |
| Documento pendente no limite | `eta2 = hoje+10`, DOCS `null`, `em_andamento` | conta em IND-14 | H-12 |
| Documento pendente além do limite | `eta2 = hoje+11` | não conta | H-12 |
| Documento pendente em processo concluído | `desembaracado`, DOCS `null` | **não** conta | H-12 |
| Canal em texto sem cor vermelha | STATUS com `CANAL VERMELHO`, cor azul | **não** conta em IND-06 | H-12 |
| Agrupamento por caixa e espaço | `ACME LOG`, `acme log`, `  ACME LOG  ` | um grupo, `count: 3` | H-11 |
| Nomes parecidos | `NAVIO ALFA` e `NAVIO ALFHA` | dois grupos distintos | H-11 |
| Processo parado no limite | 15 dias, limiar 15 | gera alerta | H-29 |
| Processo parado abaixo do limite | 14 dias, limiar 15 | não gera | H-29 |
| Preservação do arquivo | `formatado.xlsx`, uma célula alterada | todas as demais entradas do zip idênticas por hash | H-24 |
| Data gravada em célula sem formato | célula com `numFmtId=0`, gravar `2026-08-29` | `cellXf` composto com `numFmt` de data; Excel exibe `29/ago`, não `46263` | H-24 |
| Data gravada em célula já formatada | célula com `numFmtId=16`, gravar data | estilo **preservado**, nenhum `cellXf` novo criado | H-24 |
| Escrita com Excel aberto | `~$planilha.xlsx` presente | recusa `EXCEL_ABERTO`, arquivo intocado | H-25 |
| Escrita com arquivo alterado | hash divergente | recusa `ARQUIVO_MUDOU`, fila preservada | H-25 |
| Validação pós-escrita falha | arquivo resultante ilegível | backup restaurado, `restored: true` | H-25 |

---

## 2. Ingestão

A ingestão é contínua, não uma migração única. Ainda assim, os critérios de
carga se aplicam a cada leitura.

### 2.1. Idempotência

Ler o mesmo arquivo duas vezes produz **exatamente** o mesmo conjunto de
processos, o mesmo relatório de quarentena e **nenhum** evento novo de
histórico. Verificado por teste em `H-28`.

A releitura é sempre integral: não há estado incremental a corromper. O custo
de reconstruir tudo é um parse (RNF-13).

### 2.2. Relatório de cada leitura

Produzido em `data/quarantine.json` e exposto em `GET /api/quarantine`:

| Métrica | Significado |
|---|---|
| `totalDataRows` | Linhas com ao menos uma célula preenchida |
| `acceptedRows` | Linhas que viraram `Process` |
| `quarantinedRows` | Linhas rejeitadas ou aceitas com ressalva |
| `quarantineRate` | `quarantinedRows / totalDataRows`, 4 casas decimais |
| `items` | Uma entrada por linha rejeitada, com `sourceRow`, `ref`, `reason` e `detail` |
| `anomalies` | Divergências em linhas aceitas, com `code` e `detail` |

Categorias de saída: **aceita** · **aceita com ressalva** (entra nos
indicadores, aparece em `anomalies`) · **rejeitada** (não entra, aparece em
`items`).

### 2.3. Critério objetivo de aprovação

Uma leitura é considerada **aprovada** quando, cumulativamente:

1. `quarantineRate ≤ 0.02` (RNF-24);
2. 100% das linhas com REF preenchido foram aceitas ou rejeitadas com motivo
   registrado — nenhuma linha desaparece sem rastro (RNF-25);
3. a soma das quatro categorias de status iguala `acceptedRows`;
4. nenhuma linha aceita tem `styleKey` fora de `color-map.json`.

Reprovação **não** derruba a aplicação: o painel opera e exibe o alerta de
saúde. O critério existe para bloquear o **avanço de fase**, não o uso diário.

### 2.4. Conciliação contra a planilha origem

Após a Fase 1, uma conferência manual assistida: o relatório de `H-01` traz a
contagem de linhas por coluna preenchida; o painel traz `acceptedRows` e as
contagens por categoria. Os dois têm de bater. Divergência é defeito de
mapeamento, não de dado.

A cadeia de ingestão foi validada contra o arquivo real, dentro do limite de
quarentena de RNF-24. **Não transcreva número medido para documento** — a
contagem de testes vem do Vitest, os totais vêm da rota, e cópia manual
diverge.

### 2.5. Rollback

| Situação | Procedimento |
|---|---|
| Leitura errada | Nenhum rollback necessário — nada foi escrito. Corrigir a configuração e reler |
| Escrita que corrompeu o arquivo | Restauração automática do backup por `H-25`; o caminho é informado na resposta e no log |
| Escrita correta mas indesejada | Restaurar manualmente de `data/backups/`, seguindo o procedimento do `README.md` da raiz |
| Histórico corrompido | Apagar `data/history.jsonl`. A série reinicia; nenhum dado de negócio é perdido |
| Fila de edições em estado ruim | `DELETE /api/edits`. As edições aplicadas já estão em `data/applied/` |

---

## 3. Observabilidade

### 3.1. Logs estruturados

JSON por linha, em `data/logs/app-<AAAAMMDD>.jsonl`, retenção de 30 dias
(`H-31`), expurgada na partida.

**RNF-33 é garantido pelo tipo, não por disciplina:** `LogEntry` não tem campo
de texto livre, e a serialização só copia as chaves catalogadas na tabela
abaixo — não há por onde vazar nome de cliente ou conteúdo de célula.

| Evento | Campos relevantes |
|---|---|
| `read.start` | `ts` |
| `read.done` | `durationMs`, `rowsRead`, `rowsAccepted`, `rowsQuarantined` |
| `read.failed` | `errorCode` |
| `write.start` | `ts`, número de edições |
| `write.refused` | `errorCode` |
| `write.done` | `durationMs`, `cellsWritten`, `backupPath` |
| `write.restored` | `backupPath` |
| `queue.archived` | `archivedQueuePath` quando arquivou; `errorCode` quando não |
| `history.appended` | `events` quando gravou; `errorCode` e `skippedLines` quando descartou linha ilegível |
| `quarantine.reported` | `rowsQuarantined`, `quarantineRate` |

> `queue.archived` entrou em `H-26`, fora do catálogo fechado que `H-31` fixou.
> Evento próprio, e não uma segunda linha de `write.done`, porque `write.done`
> significa "a planilha foi gravada e validada" e tem os três campos acima:
> reusá-lo para a falha do arquivamento fazia uma aplicação bem-sucedida emitir
> **duas** linhas `write.done`, uma delas parecendo erro de escrita — o inverso
> do que `H-25` corrigiu ao separar `ERRO_INTERNO` de recusa. Levantado pelo
> `revisor-xml`.
>
> `history.appended` ganhou dois campos em `H-28`, `events` e `skippedLines`, e
> ambos são **contagem**. A linha de `data/history.jsonl` que não pôde ser
> interpretada **não** vai para o log: ela pode ser qualquer coisa, inclusive
> metade de um evento legível, e registrar o texto cru é exatamente a porta que
> RNF-33 fecha. A emissão de descarte usa nível `warn` e `errorCode`
> `LINHA_INVALIDA`.
>
> `archivedQueuePath` é relativo e derivado do nome do arquivo de fila
> (`data/applied/pending-edits-<AAAAMMDD-HHmmss>.jsonl`): não carrega `ref` nem
> valor de célula, que vivem no **conteúdo** do arquivo, nunca no caminho.
>
> O evento tem **três** emissões, não duas: `info` com o caminho quando
> arquivou; `warn` com `errorCode: FILA_AUSENTE` quando o arquivo de fila já não
> estava lá — nada se perdeu, a gravação aconteceu, mas o silêncio faria a
> resposta afirmar que a fila continua no lugar; e `error` com
> `errorCode: ERRO_INTERNO` quando a rotação falhou de fato.
>
> **`FILA_AUSENTE` é o primeiro `errorCode` de log que não vem de
> `05-contratos-api.md` §1.2**, e fica fora de lá de propósito: aquela tabela
> casa código de envelope com status HTTP, e este valor nunca sai numa resposta
> — sai num log de um caminho `200`. Documentado aqui porque `H-31` existe para
> que ninguém precise de lembrança ao ler `data/logs/`. Registrado junto o que
> essa escolha custa: `LogEntry.errorCode` é `string`, e não união como
> `ReadErrorCode`, então nenhuma guarda de compilação protege contra erro de
> digitação neste valor.

### 3.2. Métricas mínimas

Expostas em `GET /api/health` e visíveis no painel de saúde da Página Inicial:
linhas lidas, aceitas e em quarentena, tempo da última leitura, horário da
última leitura bem-sucedida, número de edições pendentes e estado do processo.

### 3.3. Alerta de falha de ingestão

Não há e-mail nem integração externa — a aplicação não faz chamada de rede
(RNF-31), e as automações de §8 da especificação estão fora de escopo.

O canal de alerta é a própria interface, para o único destinatário existente
(o operador):

| Condição | Manifestação |
|---|---|
| Estado `degradado` | Faixa persistente no topo de todas as páginas, com o motivo e o horário da última leitura válida. Entregue por `H-15`, na casca (A-57) |
| `conflictFiles` não vazio | Mesma faixa, com os nomes dos arquivos. **O mais severo dos avisos:** duas versões da planilha coexistem na pasta (A-58) |
| `externalLock: true` | Mesma faixa: alguém está com a planilha aberta no Excel. Não impede a leitura (A-58) |
| `quarantineRate > 2%` | Destaque no painel de saúde, com ligação para o relatório |
| Escrita recusada | Diálogo modal com o motivo e a instrução correspondente |
| Escrita restaurada do backup | Diálogo modal com o caminho do backup |
| Anomalias novas desde a leitura anterior | Contador no painel de saúde |

---

## 4. Acesso e LGPD

### 4.1. Papéis e permissões

Há **um** papel: o operador, na própria máquina. Não há autenticação
(RNF-32), porque não há superfície de acesso: o servidor escuta apenas em
`127.0.0.1` (RNF-29).

O controle de acesso efetivo é o do sistema operacional e o do OneDrive sobre a
pasta sincronizada. A aplicação não amplia nem reduz esse controle — ela lê o
mesmo arquivo que o operador já pode abrir no Excel.

### 4.2. Dados pessoais tratados

| Dado | Natureza | Onde vive |
|---|---|---|
| Nome de cliente (CLT) | Pode ser pessoa jurídica ou identificar pessoa natural | No `.xlsx`, em memória **e em disco**: `config/client-map.json` guarda a grafia da célula e o nome consolidado, e a aplicação **grava** nele por `saveClientRule` (`src/app/client-map-loader.ts`) quando o operador declara o cliente de uma linha |
| Nome de importador | Idem | Somente no `.xlsx` e em memória |
| Nome de agente de carga | Idem | Idem |
| Nome do responsável interno (Colaborador 1, Colaborador 2) | Pessoa natural identificada | Derivado de cor, em memória, **e em disco**: `config/team-map.json` guarda o nome real de cada pessoa da equipe. A aplicação só o lê — o arquivo chega por cópia manual (`PD-08`) |

**Os dois arquivos de `config/` acima estão no `.gitignore`** e nunca vão para o
repositório nem para a branch `distribuicao`, que leva apenas os `.exemplo` de
nomes fictícios — guardado por `tests/repo/distribuicao.test.ts`. **A frase
"somente no `.xlsx` e em memória" valeu até `H-48`**, que criou os dois mapas, e
seguiu escrita aqui até 03/09/2026; a retenção deles não é governada pela
planilha, e sim pelo `config/` da máquina do operador — ao contrário do que
§4.3 afirma para o resto.

### 4.3. Base legal e minimização

| Princípio | Aplicação |
|---|---|
| **Base legal** | Legítimo interesse do controlador na gestão da própria operação aduaneira. Os dados já são tratados hoje na planilha; a aplicação não amplia a finalidade, apenas apresenta o mesmo dado |
| **Minimização** | A aplicação **não coleta nada novo**. Nenhuma coluna é criada (decisão do usuário). Nenhum dado é enriquecido, cruzado com fonte externa ou inferido |
| **Finalidade** | Exclusivamente operacional: acompanhar o andamento dos processos de importação |
| **Retenção** | Governada pela planilha, que não é gerenciada pela aplicação. Os artefatos próprios seguem RNF-20 e RNF-21 |
| **Transferência** | **Nenhuma.** Não há tráfego para fora da máquina (RNF-31), nem provedor de nuvem, nem telemetria (RNF-34) |
| **Compartilhamento** | Nenhum. A aplicação não exporta, não envia e não publica |

### 4.4. Proibição de dado sensível em log

Regra fixada em RNF-33 e verificada por teste em `H-31`:

**Proibido em log:** nome de cliente, importador, agente ou navio; descrição de
mercadoria; conteúdo de células; texto de STATUS.

**Permitido em log:** `ref`, `sourceRow`, letra de coluna, código de anomalia,
código de erro, contagens e durações.

O teste de `H-31` verifica que uma mensagem de erro contendo valor de célula
tem o valor suprimido, restando apenas a coordenada.

### 4.5. Backups e dado pessoal

`data/backups/` contém cópias integrais do `.xlsx`, logo contém os mesmos dados
pessoais do original. Consequências:

- ficam na mesma máquina, sob o mesmo controle de acesso;
- o expurgo de RNF-21 limita a janela de retenção a 90 dias ou 30 cópias;
- a pasta `data/` **não** deve ser sincronizada pelo OneDrive, para não
  replicar cópias do arquivo na nuvem da organização. O `README.md` da raiz
  instrui a criar a pasta fora do diretório sincronizado.

---

## 5. Build, versionamento e ambientes

### 5.1. Ambientes

| Ambiente | Onde | Planilha usada |
|---|---|---|
| **Desenvolvimento** | Máquina do desenvolvedor | Somente fixtures de `tests/fixtures/` |
| **Homologação** | Máquina do operador, com `config/app.json` apontando para uma **cópia** da planilha | Cópia, nunca a de produção |
| **Produção** | Máquina do operador | O `.xlsx` da pasta sincronizada |

A separação entre homologação e produção é apenas o caminho em
`config/app.json`. O `README.md` da raiz instrui a validar toda versão nova
contra uma cópia antes de apontar para a planilha de produção.

### 5.2. Pipeline

**Há CI, e ele é obrigatório desde 06/08/2026.** `.github/workflows/verify.yml`
roda o portão inteiro com o Node de `.nvmrc`, e `dados-sensiveis.yml` roda
`verifica-dados-sensiveis.sh`; os dois disparam em `pull_request` e em `push` na
`main`, e o ruleset `main protegida` os exige como checks obrigatórios, com
`bypass_actors` vazio. **É a única camada que roda sempre** — o hook local é
`PreToolUse` e não vê commit feito fora do Claude Code. Não há implantação
remota: a aplicação roda numa máquina só.

O portão local é o mesmo comando, e é obrigatório antes de qualquer entrega:

```
npm run test:hooks  # regressao de .claude/hooks/guard-dados-sensiveis.sh
npm run test:dados  # .github/scripts/verifica-dados-sensiveis.sh, sobre o indice
npm run test:strip  # importa src/ sob --experimental-strip-types
npm run lint        # inclui a regra de fronteira: domain/ não importa io/, app/, http/
npm run typecheck
npm test            # Vitest — `vitest run`, SEM cobertura (ver a ressalva de §1.1)
npm run build       # servidor + SPA em dist/
```

`npm run verify` encadeia os **sete** e é o comando único do portão. As duas
regressões de guarda vêm primeiro de propósito: verificar a proteção antes de
verificar o código.

### 5.3. Gestão de segredos

**Não há segredos.** Sem banco, sem nuvem, sem API externa, sem autenticação,
não existe credencial a guardar. `config/app.json` contém apenas caminhos e
parâmetros de negócio.

O que **não** vai para o controle de versão: `config/app.json` (contém o caminho
local, que revela estrutura de pastas e nome de organização), `config/client-map.json`
e `config/team-map.json` (nome real de cliente e de pessoa da equipe, regra
inviolável 8 — `H-48`), `data/` inteiro, `docs/perfilamento/*.json` não
sanitizado, e qualquer `.xlsx` ou imagem que não seja fixture. `.gitignore` é a
fonte; `verifica-dados-sensiveis.sh` é quem recusa.

O repositório traz `config/app.json.exemplo` com o caminho substituído por um
marcador.

### 5.4. Backup e restauração testada

| Item | Estratégia | Teste |
|---|---|---|
| Planilha | Backup automático antes de cada escrita, em `data/backups/` | `H-25` testa backup e restauração no mesmo caso |
| Histórico | Nenhum backup automático. Descartável por natureza (RNF-20) | Teste de `H-28`: arquivo apagado é recriado sem erro |
| Configuração | Versionada como `.exemplo` no repositório | Teste de `H-02`: ausência de `app.json` produz mensagem clara |
| Código | Controle de versão | — |

**A restauração é testada, não presumida:** o critério de aceite de `H-25`
exige que uma validação pós-escrita falha resulte em arquivo restaurado e
verificado — o mesmo caminho de código que o operador usaria manualmente.

## 6. Régua de comentários

A régua operacional está em `.claude/rules/comentarios.md`, que carrega sozinha
ao tocar `src/`, `web/` ou `tests/`. **Esta seção é a derivação** — por que a
régua é essa e não outra. Abra apenas para discutir a régua; para escrever
código, a rule basta.

### 6.1. O que a literatura afirma

| Fonte | O que sustenta |
|---|---|
| Ousterhout, *A Philosophy of Software Design* | Princípio-guia: comentário descreve o que **não é óbvio no código**. Dois *red flags* nomeados: *Comment Repeats Code* e *Implementation Documentation Contaminates Interface*. Critério de suficiência: entender a abstração lendo só as declarações visíveis mais os comentários |
| Google, *eng-practices* | Comentário explica **por quê**, não **o quê**; se o código não está claro, refatore em vez de comentar. Exceções admitidas: regex e algoritmo complexo. Decisão tomada em review vira comentário, *for posterity* |
| Fluri et al., *Do Code and Comments Co-Evolve?* | ~90% das mudanças de comentário co-evoluem com o código no mesmo commit; código **novo** entra frequentemente sem comentário |
| Wen et al., ICPC 2019 — 1,3 bi de mudanças de AST em 1.500 sistemas | Mudança **inconsistente** entre código e comentário tem **~1,5× mais chance** de ser commit que introduz bug |
| Rani et al., *A Decade of Code Comment Quality Assessment*, JSS 2023 — 47 de 2.353 papers | 21 atributos de qualidade catalogados; a literatura se concentra em quatro, **predominantemente consistência entre comentário e código** |
| Pascarella & Bacchelli, MSR 2017 | Taxonomia empírica de 6 categorias de topo e 16 internas sobre >2.000 comentários — régua única não serve para todas |

### 6.2. A linha que separa mecanismo de julgamento

A conclusão operacional das fontes acima: **o defeito medido não é ausência de
comentário, nem comentário feio — é divergência.** E divergência é a única
propriedade da lista que um script decide.

| Regra | Computável? | Onde vive |
|---|---|---|
| Não repete o código | Não | `.claude/rules/comentarios.md` |
| Diz o porquê, não o quê | Não | idem |
| Interface não vaza implementação | Não | idem |
| Cabeçalho define a invariante | Não | idem |
| **Âncora citada é definida** — ID em título ou primeira célula de tabela, caminho existindo em disco | **Sim** | `tests/repo/contratos.test.ts` |
| **Identificador em camelCase citado existe** | **Sim** | idem |
| **Peça de `.claude/` mencionada no `CLAUDE.md`** | **Sim** | idem |

É por isso que a régua **não virou hook**: hook exige decisão computável, e a
metade de cima não é. E é por isso que a metade de baixo **não ficou só na
rule**: rule é contexto, não garantia — não é reinjetada depois do `/compact`, e
o gatilho dela é leitura de arquivo, não escrita.

### 6.3. Estado medido em 12/08/2026

Antes de escrever qualquer mecanismo, o repositório foi medido:

- **76 de 83** arquivos `.ts`/`.tsx` de `src/` e `web/` têm bloco de comentário
  antes do primeiro `export`
- **331 citações** de ID do plano em comentários de `src/` e `web/src`, nas onze
  famílias vigiadas (`H-NN`, `IND-NN`, `A-NN`, `TD-NN`, `ADR-NNNN`, `RF-NN`,
  `RNF-NN`, `ALE-NN`, `D-NN`, `P-NN`, `R-NN`) — **zero âncoras mortas**
- **18 caminhos** de arquivo citados em comentários — **zero inexistentes**
- **120 citações** de identificador em camelCase, 70 distintos — **zero ausentes**

> Os três números contam **apenas linhas de comentário** de `src/` e `web/src`,
> que é o recorte da asserção. Contagens sobre o arquivo inteiro, ou incluindo
> `web/tests/`, dão valores maiores e não são comparáveis — foi assim que a
> primeira redação desta seção registrou 385 onde o certo era 281.
- **1.837 linhas** de comentário em `src/` e `web/src`, **96% sem acento**

A asserção nasce, portanto, **verde**: ela não conserta dívida, impede que a
dívida entre. O único desalinhamento encontrado estava em prosa, não em
comentário — o `CLAUDE.md` dizia "55 achados" contra 65 reais na auditoria.
