# Ensaio mecânico sobre a planilha — resultado

O **estado** do ensaio. Ele vive aqui, e não na conversa, para que uma sessão
nova retome sem ninguém recontar nada.

**Para retomar:** leia este arquivo e `corpus-ensaio.md`, nesta ordem. O primeiro
diz onde o ensaio parou; o segundo diz o que medir e por quê.

---

## Estado

**O corpus foi percorrido inteiro.** As cinco fases concluídas; o ciclo fechou
nos três pontos; os quatro caminhos de escrita cirúrgica abertos no Excel real;
`§1.1` a `§1.6`, `§2`, `§3`, `§4` e as catorze relações do `§5` exercidos. O que
resta é o que não se mede: `ALE-06`, que exige gravar no histórico do operador, e
`PD-07` item 1, a paleta nominal do Windows.

| Item | Estado |
|---|---|
| Corpus | Escrito — `corpus-ensaio.md` |
| Ferramenta de medição | `tools/medir-numeros.mjs` |
| Cópia de trabalho (Windows) | `C:\Users\<usuario>\ensaio-planilha\base.xlsx` — SHA256 idêntico ao original |
| Planilha do operador | **Intocada** — conferida por hash ao fim da rodada de 17/09 |
| Medição de referência | Executada nas duas máquinas |
| Área de ensaio (Windows) | `C:\Users\<usuario>\ensaio-planilha\app\` — árvore da `main`, `node_modules` próprio |

---

## A área de ensaio é isolada, e precisou ser

**A instalação do operador não serve para medir.** Ela é de **03/09/2026** e não
tem `src/domain/sheet-schema.ts` nem `loadCellFills` — ou seja, não tem `H-94`,
`H-95` nem `H-96`, que é justamente o que o corpus manda exercer. Rodar o ensaio
contra ela mediria código que a `main` já substituiu.

O ensaio roda então em `C:\Users\<usuario>\ensaio-planilha\app\`, que é a árvore da
`main` enviada por `scp`, com `npm ci --omit=dev` próprio — `chokidar 5.0.0`,
`fastify 5.12.1`, `fflate 0.8.3`, as versões do `CLAUDE.md`. A instalação do
operador tinha `fastify 5.11.2`, anterior ao commit de CVEs.

**O isolamento é o ponto.** `config/app.json`, `data/` e a fila de edições da
área são próprios; backup, aplicadas e histórico vão para diretório temporário a
cada execução. Ao fim da rodada, o `app.json` do operador continuava apontando
para a planilha dele, `data/history.jsonl` continuava com a data de 04/09/2026, e
`data/edit-queue.json` não existia.

> **Isto é `PD-08` cobrando.** A pendência previa reconciliar os dois mapas de
> negócio antes de copiar; o que a medição mostra é maior — a árvore inteira está
> um épico atrás, e `E15` fechou em 17/09/2026 sem chegar à máquina.

---

## Fases

A ordem não é arbitrária: o sentido somente-leitura vem primeiro, porque escrita
com leitura mal compreendida é como se corrompe um arquivo sem perceber.

| # | Fase | Sentido | Risco | Estado |
|---|---|---|---|---|
| 1 | Medição de referência dos números | leitura | nenhum | **concluída** |
| 2 | Mutação estrutural da cópia | planilha → aplicação | nenhum ao original | **concluída** — os 10 do §3 e os 6 do §1.3 · **RESOLVIDO** |
| 3 | Filtro e visualização | leitura | nenhum | **concluída** — §1.6, §1.7 e as 8 relações · **RESOLVIDO** — medido e reescrito |
| 4 | Escrita pela aplicação, sobre cópia | aplicação → planilha | **sobre cópia** | **concluída** — 4 caminhos, §1.2 inteiro |
| 5 | Ciclo com o Excel real | ambos | **sobre cópia** | **concluída** — os três pontos · **RESOLVIDO** |

---

## Checkpoints

Um por fase concluída.

| Fase | Data | Gestos | Divergências | Tempo | Tokens |
|---|---|---|---|---|---|
| 1 — Medição de referência | 17/09/2026 | 9 rotas | 0 | 0,2s | — |
| 1 — Referência na máquina do operador | 17/09/2026 | 9 rotas | 0 | 0,2s | — |
| 2, 4 e 5 — primeira rodada em Windows | 17/09/2026 | 6 | 1 (de redação) | ~11 min | — |
| 2, 4 e 5 — segunda rodada, com as ferramentas versionadas | 17/09/2026 | 16 | 3 (2 de redação, 1 inalcançável) | ~14 min | — |
| Terceira rodada — escrita, guardas, watcher e os ramos de XML | 17/09/2026 | 23 | 1 defeito de código, 3 de redação | ~30 min | — |
| Quarta rodada — config, rotas, filtros, caracterização e navegador | 17/09/2026 | 48 | 2 divergências, 4 de escopo | ~40 min | — |
| Quinta rodada — as sete meias-linhas que sobraram | 17/09/2026 | 7 | 1 de redação | ~10 min | — |

**Fase 1 concluída.** As 9 rotas responderam `200`. O relatório foi gravado em
`medicao-referencia.md` — que saiu de `docs/` em 21/09/2026 (`D-59`) e se
regenera por `tools/medir-numeros.mjs` —, e o estado da planilha é **limpo**: 650 lidas, 650
aceitas, **0 em quarentena**, **0 divergências de esquema**. É a linha de base
ideal — qualquer mutação da fase 2 aparece contra um fundo sem ruído.

Confirmado na planilha real: `A-12` fecha — 103 + 33 + 480 + 34 = **650**.

**650, e não 649**, pela linha sintética `FT5555.28` de `D-28` (§6 do corpus).

**`ALE-06` não foi medido.** `processos_parados: 0` e `stalledMeasurable: false`
são artefato do histórico temporário, não medição. Está declarado no relatório.

**A mesma medição na máquina do operador deu 649**, e a diferença é exatamente a
linha sintética: `total` −1, `emDesembaraco` −1, `indefinido` −1, e **todos os
outros 14 campos de `counts` e `channelDistribution` idênticos**. `A-12` fecha
também lá — 103 + 32 + 480 + 34 = **649**. É a relação metamórfica "duplicar e
ler as duas" exercida entre máquinas diferentes, e ela segurou.

> **Tokens só aparecem onde o harness os mede** — trabalho em subagente. Na
> sessão principal não há contador exposto, e estimativa apresentada como medida
> é o que a regra inviolável 3 proíbe. Célula vazia significa "não medido", nunca
> "zero".

---

## Entradas

Uma por gesto, no formato do §8 do corpus.

Todas as medições abaixo saíram da área isolada, sobre cópias em
`C:\Users\<usuario>\ensaio-planilha\trabalho\`. O SHA256 da base, e portanto do
original, é `CE2FE89B…1835`.

### E-01 — abrir a cópia da planilha real no Excel, sem tocar em nada

**Âncora:** §"o ciclo fecha", ponto 1 · **Natureza:** caracterização
**Gesto:** `Workbooks.Open` pelo Excel 16.0 na sessão gráfica, por `schtasks /it`; `Close($false)`
**Hash antes/depois:** `CE2FE89B…1835` → inalterado
**Reação observada:** `Saved = True` logo após o `Open`. Quatro abas. Aba `2026` com `UsedRange` de **745 linhas × 16 colunas**, uma `ListObject` chamada `Tabela1` cobrindo **`A1:P997`**. Cabeçalho da linha 1: `REF|CLT|IMPORTADOR|BL|AGENTE|CNTR|NAVIO|ETA|ETA2|MERCADORIA|RG|STATUS|Coluna 13|R$ ENVIADO|DOCS ENVIADOS|Coluna1`
**Veredicto:** conforme
**Custo:** 1,0s de Excel
**Desdobramento:** confirma o §4 item 2 — **a `Tabela1` existe no arquivo real** e nenhuma fixture a tem. Confirma também `AGENTE` em E e `Coluna1` em P, do `CLAUDE.md`. Fica registrado que o Excel vê **745** linhas de `UsedRange` onde a aplicação lê **649** processos, sem quarentena: as demais são linhas em branco dentro do intervalo da Tabela. `H-01` (649) e `H-27` (744) medem coisas diferentes, e nenhuma das duas está errada

### E-02 — inserir coluna vazia depois de `P`

**Âncora:** §5, relação metamórfica · **Natureza:** oráculo (relação)
**Gesto:** `Columns(17).Insert` pelo Excel, na aba `2026`, e `Save`
**Hash antes/depois:** `CE2FE89B…1835` → `F4E85ECC…9B7D`
**Reação observada:** 649 lidas, 649 aceitas, **0 em quarentena**, `schemaDivergences` **vazio**, e as **9 rotas idênticas à base em todos os números** — zero diferenças. Mas o digest do conjunto mudou: `00dac5ac8b5316a0` → `937b989c6125cc5c`, por **7 processos** em `cellStyleKeys` e **3** em `fills`. Todas as diferenças estão na **coluna Q**, a nova: quatro linhas ganharam `none` e três ganharam `theme:0|tint:0.0000`. **Nenhuma das 16 colunas `A`–`P` mudou**, e `colorResponsible` e `importerOutsideRj` ficaram idênticos nos sete
**Veredicto:** **diverge da letra da relação, conforme no comportamento**
**Custo:** 1,0s de Excel · 0,3s de medição
**Desdobramento:** **a relação do §5 está mal redigida, e o código está certo.** Ela diz "os 649 processos saem idênticos, campo a campo. Qualquer diferença é defeito" — mas `cellStyleKeys` e `fills` são mapas indexados por letra de coluna, e por construção ganham a letra nova quando o arquivo ganha coluna. A redação precisa excluí-los, ou a relação acusa defeito onde não há. Achado de documento, não de produto. Fica registrado de passagem que o Excel materializou célula em `Q` para apenas **7 das 649** linhas, e **sem consistência** entre elas

### E-03 — inserir coluna no meio, na posição `C`

**Âncora:** `H-96`, §1.3 e §3 · **Natureza:** oráculo
**Gesto:** `Columns(3).Insert` pelo Excel, na aba `2026`, e `Save`
**Hash antes/depois:** `CE2FE89B…1835` → `1C9E432E…9085`
**Reação observada:** **uma** divergência, agrupada:
`{"kind":"DESLOCADO","column":"D","expectedColumn":"C","expected":"IMPORTADOR","found":"IMPORTADOR","span":14,"duplicateOf":null}`.
A leitura **seguiu** — 649 lidas, 649 aceitas, 0 em quarentena
**Veredicto:** conforme
**Custo:** 1,0s de Excel · 0,2s de medição
**Desdobramento:** `H-96` **nasceu de defeito simulado e agora está exercida contra o arquivo real**, pelo caminho que o §4 item 1 declarava nunca ter rodado — *Excel altera → zip → `sharedStrings` → reader → `sheet-schema`*. O `span: 14` bate com o previsto no §1.3. Registrado também que o Excel nomeou a coluna nova como **`Column1`**, por ela cair dentro da `Tabela1` — comportamento de Tabela que nenhuma fixture exerce

### E-04 — o que a coluna deslocada faz com os números

**Âncora:** `D-43` · **Natureza:** caracterização
**Gesto:** o mesmo arquivo de `E-03`, medido pelas 9 rotas
**Hash antes/depois:** `1C9E432E…9085` → inalterado (medição é leitura)
**Reação observada:** **649 dos 649 processos** mudaram — **100%**. Nas rotas, **87** números divergem da base. Entre eles: `desembaracados` **480 → 0**, `atrasados` **105 → 0**, `documentosPendentes` **72 → 0**, `emAndamento` **103 → 483**, `emDesembaraco` **32 → 132**, `documentaryLeadTime.averageDays` **12,5 → `null`** com `sampleSize` **101 → 0**, e os alertas **179 → 5**. E `rowsQuarantined` permaneceu **0**
**Veredicto:** sem comportamento declarado — é a caracterização do dano
**Custo:** 0,2s
**Desdobramento:** **`D-43` está confirmado e era conservador.** Ele previu 616 de 650 processos (94,8%) e 580 categorias erradas; o arquivo real deu **100%**. Um gesto de operador zera três indicadores e mais que quadruplica um quarto, **sem uma linha em quarentena**. O único anteparo é o aviso de `H-96` — que apareceu. Uma diferença a registrar: `D-43` afirma "nenhuma anomalia", e a medição mostra o primeiro processo com **uma** anomalia; a forma redigida da rota não diz quantos ao todo, e o número fica em aberto

### E-05 — escrever pela aplicação, com e sem coluna deslocada

**Âncora:** `H-96` (§1.3, "escrita recusa") e `H-25` · **Natureza:** oráculo, com controle
**Gesto:** `POST /api/edits` de `statusRaw` no primeiro processo, seguido de `POST /api/edits/apply`, sobre duas cópias — uma íntegra e a de `E-03`
**Hash antes/depois:** controle `CE2FE89B…1835` → `FDD8D41B…4840`; deslocada `1C9E432E…9085` → **inalterado**
**Reação observada:** no **controle**, `201` na fila e `200` ao aplicar, com `applied: 1`, `cellsWritten: 1`, `rowsRepainted: 0`, `validated: true` e backup gravado. Na **deslocada**, `201` na fila e **`409 CABECALHO_DESLOCADO`** ao aplicar, com a mensagem *"Uma coluna mudou de lugar na planilha, e gravar agora escreveria na coluna errada… nada foi gravado, e sua fila está intacta"* e o detalhe *"14 colunas andaram 1 coluna à direita, a partir de C — a primeira é «IMPORTADOR»"*. O hash **não mudou**
**Veredicto:** conforme
**Custo:** 244ms a gravação do controle
**Desdobramento:** a garantia segura, **e o controle prova que a recusa não é falso positivo** — a mesma edição, sobre o arquivo íntegro, grava. Mas o ensaio expôs um degrau: **a fila ACEITA a edição nos dois casos**, e no arquivo deslocado ela registrou como `previous` de `statusRaw` um valor **de data**, que é o conteúdo da coluna vizinha. A recusa mora só em `apply`. Para o operador o efeito é benigno — nada é gravado e a fila fica intacta, como a mensagem promete —, mas quem ler a fila arquivada verá um `previous` que nunca esteve naquele campo

### E-06 — o Excel abre o que a escrita cirúrgica gravou

**Âncora:** §"o ciclo fecha", ponto 1 · **Natureza:** oráculo
**Gesto:** `Workbooks.Open` sobre o arquivo de `E-05` controle, gravado pela aplicação
**Hash antes/depois:** `FDD8D41B…4840` → inalterado
**Reação observada:** **`Saved = True` logo após o `Open`**. Quatro abas, `Tabela1` intacta em `A1:P997`, cabeçalho intacto, `UsedRange` de 745 × 16. Nenhum log de reparo em `%TEMP%` — zero `*.log`, zero `*repair*`, zero `.xml` recentes; os arquivos novos são `.tmp` de 0 byte do próprio COM
**Veredicto:** conforme
**Custo:** 2,0s de Excel
**Desdobramento:** **é o veredicto que nenhuma suíte podia dar.** `xlsx-surgeon` valida o XML que ele mesmo produziu, o que o corpus chama de juiz em causa própria; aqui o Excel de verdade aceitou o arquivo sem alterar um byte. O sinal usado é o do `.claude/rules/operacao-windows.md` — reparar é modificar em memória, então a pasta abriria suja

### E-07 — `app.json` com BOM

**Âncora:** §1.4 · **Natureza:** caracterização
**Gesto:** gravar `config/app.json` por `[System.Text.Encoding]::UTF8` do .NET, que **inclui BOM**
**Hash antes/depois:** não se aplica
**Reação observada:** `ConfigError: config/app.json nao e um JSON valido: Unexpected token`, e a partida morre
**Veredicto:** sem comportamento declarado
**Custo:** desprezível
**Desdobramento:** apareceu por acidente de método, não por gesto planejado, e fica registrado porque o caminho é real: o `app.json` é escrito pela aplicação em `H-34`, mas nada impede o operador de abri-lo à mão, e editores do Windows gravam UTF-8 **com** BOM sem avisar. §1.4 lista o JSON malformado dos mapas de negócio e não cobre este. Decidir se vale tolerar o BOM na leitura é história, não correção de ensaio

### E-08 — o Excel salva por cima do que a escrita cirúrgica gravou

**Âncora:** §"o ciclo fecha", ponto 2 · **Natureza:** oráculo (relação)
**Gesto:** `Workbooks.Open` seguido de `Save`, sobre o arquivo de `E-05` controle
**Hash antes/depois:** `FDD8D41B…4840` → `E50C05CD…4058`
**Reação observada:** `Saved = True` antes do save. Depois dele a aplicação releu **649 lidas, 649 aceitas, 0 em quarentena, 0 divergências**, e o **`digestGlobal` saiu idêntico** — `ecf75c5e73edf48f` nas duas leituras. As 9 rotas: **zero** números diferentes
**Veredicto:** conforme
**Custo:** 1,5s de Excel · 0,3s de medição
**Desdobramento:** fecha o ponto 2. O Excel reescreveu o arquivo à maneira dele — hash novo — e a aplicação leu os mesmos 649 processos **campo a campo**. O §4 item 5 dizia que `styles.xml` depois de um save real do Excel tem forma diferente da das fixtures; tem, e a leitura não se abala

### E-09 — desfazer a edição sem reler antes

**Âncora:** §5, e `PD-07` item 2 · **Natureza:** caracterização
**Gesto:** aplicar `statusRaw`, e aplicar de novo o valor anterior **sem** `POST /api/reload` no meio
**Hash antes/depois:** `CE2FE89B…1835` → `AAFCC89C…3EED`, e a segunda aplicação **não mudou nada**
**Reação observada:** a segunda aplicação recusou com **`409 ARQUIVO_MUDOU`** — *"A planilha mudou desde a ultima leitura… nada foi gravado"* — trazendo `expectedHash`, `actualHash` e um `conflicts` com `valueWhenEdited`, `yourValue` e **`valueNow` já apontando o valor recém-gravado**
**Veredicto:** conforme, e revela o que faltava a `PD-07`
**Custo:** 0,5s
**Desdobramento:** **é a fixture do `ConflictDialog`, e ela não é uma fixture.** O §4 item 3 e `PD-07` item 2 dão o diálogo como inalcançável porque "nenhuma das nove fixtures produz o conflito" — mas o conflito não se produz por arquivo, e sim por **sequência**: gravar pela própria aplicação e aplicar de novo sem reler basta. O bloqueio que resta é só a tela, que pede navegador

### E-10 — desfazer a edição, relendo entre as duas

**Âncora:** §5 — "aplicar edição e desfazê-la devolve o hash original" · **Natureza:** oráculo (relação)
**Gesto:** aplicar `statusRaw`, `POST /api/reload`, aplicar de volta o `previous` devolvido pela própria fila
**Hash antes/depois:** `CE2FE89B…1835` → `BD76CC5D…3367` → `0C477982…D4DB`
**Reação observada:** as duas aplicações em `200`, com `cellsWritten: 1` e `validated: true`. O hash **não** voltou ao original. Mas a comparação do zip entrada a entrada — o critério do ADR-0004 — diz **29 das 30 idênticas**, e a única diferente é `xl/sharedStrings.xml`: **`xl/worksheets/sheet1.xml` voltou byte a byte ao original**. Só a ida deixa 28 de 30, mudando `sheet1.xml` e o pool
**Veredicto:** **diverge da letra da relação, conforme no comportamento**
**Custo:** 0,5s
**Desdobramento:** **o 28 de 30 confirma o `CLAUDE.md` contra o arquivo real** — "editar uma célula de texto deixa 28 das 30 entradas byte a byte idênticas". O resíduo da volta é uma string **órfã** no pool global: o valor novo entra em `sharedStrings.xml` e não sai, porque removê-lo exigiria reindexar todas as referências do arquivo. A relação do §5 pede o hash, e o hash é o critério errado — o ADR-0004 já diz qual é o certo

### E-11 — o pool de strings cresce, e quem o recolhe é o Excel

**Âncora:** decorrente de `E-10` · **Natureza:** caracterização
**Gesto:** medir `xl/sharedStrings.xml` na base, depois da ida, depois da volta, e depois de um `Save` do Excel
**Hash antes/depois:** `0C477982…D4DB` → `3E530CCE…2D4E`
**Reação observada:** base **6.986 `<si>`, 196.048 bytes**; depois da edição **6.987 e 196.070** — **+1 string, +22 bytes**; depois de desfazer, **inalterado**, com a órfã ainda lá; depois de um `Save` do Excel, **6.986 e 196.048 de novo** — exatamente os números da base. Nesse mesmo save o Excel mudou **15 das 30** entradas do zip, incluindo `sheet2`, `sheet3` e `sheet4`
**Veredicto:** sem comportamento declarado
**Custo:** 2,0s
**Desdobramento:** o resíduo é **transitório** — o próximo save do Excel o limpa —, e o crescimento só seria ilimitado se o operador digitasse texto sempre novo; em domínio fechado como STATUS o pool satura. E o contraste mede o ADR-0004 num número: **a escrita cirúrgica toca 1 ou 2 entradas das 30; um único save do Excel toca 15, e reescreve as três abas fora de escopo** — que a aplicação nunca encosta

### E-12 — renomear o cabeçalho

**Âncora:** `H-96`, §1.3 · **Natureza:** oráculo
**Gesto:** `C1` de `IMPORTADOR` para `CLIENTE FINAL`, pelo Excel
**Hash antes/depois:** `CE2FE89B…1835` → arquivo próprio
**Reação observada:** `{"kind":"AUSENTE","column":"C","expectedColumn":"C","expected":"IMPORTADOR","found":"Column1","span":1}`, leitura seguindo com 649/649/0
**Veredicto:** conforme
**Custo:** 1,2s
**Desdobramento:** o `found` veio `Column1`, e não `CLIENTE FINAL` — ver `E-13`

### E-13 — apagar o texto do cabeçalho

**Âncora:** `H-96`, §1.3 — esperado `CABECALHO_VAZIO`, e bloquear escrita · **Natureza:** oráculo
**Gesto:** `ClearContents` em `C1`, pelo Excel
**Reação observada:** **`AUSENTE`**, com `found: "Column1"` — **não** `CABECALHO_VAZIO`. O Excel **renomeou a coluna sozinho**, porque `C` está dentro da `Tabela1` e uma Tabela do Excel não admite cabeçalho vazio
**Veredicto:** **a garantia não é alcançável por este gesto**
**Custo:** 1,3s
**Desdobramento:** **`CABECALHO_VAZIO` existe no código e não se produz pelo caminho do operador** enquanto a `Tabela1` cobrir a coluna. Só se alcança editando o XML por fora. A divergência **foi** detectada — por outro `kind` —, então o operador fica protegido; o que está errado é o §1.3 prometer uma reação que o arquivo real não produz

### E-14 — repetir um cabeçalho que já existe

**Âncora:** `H-96`, §1.3 — esperado "uma linha só, dizendo de quem é o nome" · **Natureza:** oráculo
**Gesto:** `D1` de `BL` para `IMPORTADOR`, pelo Excel
**Reação observada:** o Excel gravou **`IMPORTADOR2`**, e a divergência saiu `AUSENTE` em `D` com `found: "IMPORTADOR2"`. `duplicateOf` ficou `null`
**Veredicto:** **a garantia não é alcançável por este gesto**
**Custo:** 1,2s
**Desdobramento:** mesmo padrão de `E-13`, e a consequência é mais forte: **`duplicateOf` nunca se preenche pelo caminho real**, porque Tabela do Excel não aceita dois cabeçalhos iguais. O ramo de código existe para um arquivo que o Excel não produz

### E-15 — trocar caixa, espaço e acento no cabeçalho

**Âncora:** `H-96`, §1.3 — "não recusa nada" · **Natureza:** oráculo
**Gesto:** `C1` de `IMPORTADOR` para `" importador "`, com espaços nas pontas e em minúsculas
**Reação observada:** `schemaDivergences` **vazio**, 649/649/0
**Veredicto:** conforme
**Custo:** 1,2s
**Desdobramento:** `normKey` é mesmo a mesma normalização do agrupamento, como o §1.3 afirma

### E-16 — apagar uma coluna

**Âncora:** §3 — "provável `DESLOCADO` + `AUSENTE`; confirmar o agrupamento" · **Natureza:** caracterização
**Gesto:** `Columns(3).Delete` pelo Excel
**Reação observada:** **duas** divergências, exatamente como o corpus previu:
`AUSENTE` em `C` (esperado `IMPORTADOR`, `found` `BL`) e `DESLOCADO` em `C` com **`span: 13`**. Leitura seguindo, 649/649/0
**Veredicto:** conforme à previsão
**Custo:** 1,2s
**Desdobramento:** o agrupamento funciona também na remoção — 13 colunas num aviso só

### E-17 — mover uma coluna de lugar

**Âncora:** §3 — "`DESLOCADO`; ordem em que as divergências saem" · **Natureza:** caracterização
**Gesto:** recortar `C` e inserir em `H`, que é o gesto de quem arrasta a coluna
**Reação observada:** dois `DESLOCADO` — primeiro o da coluna **movida** (`G`, esperado `C`, `span: 1`), depois o do **bloco** que correu para trás (`C`, esperado `D`, `span: 4`)
**Veredicto:** sem comportamento declarado — a ordem fica caracterizada
**Custo:** 1,3s
**Desdobramento:** a coluna movida é reportada antes do bloco, e não em ordem de letra

### E-18 — empurrar a última coluna para além de `P`

**Âncora:** §3 — o defeito de `indexOfLetter` que devolvia `-1` e produzia um `EXTRA` falso · **Natureza:** oráculo
**Gesto:** `Columns(16).Insert`, que empurra `Coluna1` de `P` para `Q`
**Reação observada:** **uma** divergência, `DESLOCADO` em `Q` (esperado `P`, `span: 1`) — e **nenhum `EXTRA`**. Entre os processos, 138 mudaram em `cellStyleKeys`, 10 em `fills`, e **exatamente 1** em `columnPRaw`
**Veredicto:** conforme — **a correção de `H-96` segura contra inserção real**
**Custo:** 1,2s · 0,3s
**Desdobramento:** o único processo com dado perdido é coerente com `Coluna1` ser 99,9% vazia. Os 138 são o mesmo efeito de `E-02` — a coluna nova entrando nos mapas indexados por letra —, agora com a coluna no meio do intervalo usado, o que alcança mais linhas

### E-19 — inserir uma linha no meio

**Âncora:** §3 e §5 · **Natureza:** oráculo (relação)
**Gesto:** `Rows(300).Insert` pelo Excel
**Reação observada:** **`digestGlobal` idêntico ao da base** — `00dac5ac8b5316a0`. 649 processos, zero quarentena, zero divergência, **zero** campo alterado, e **351 `sourceRow`** mudaram
**Veredicto:** conforme
**Custo:** 1,2s · 0,3s
**Desdobramento:** a relação do §5 — "o conjunto é o mesmo; só `sourceRow` muda" — **segura exatamente**. A linha em branco inserida não virou processo nem foi para a quarentena

### E-20 — apagar uma linha

**Âncora:** §3 — "reação da fila com edição pendente naquela linha" · **Natureza:** caracterização
**Gesto:** `Rows(300).Delete` pelo Excel
**Reação observada:** **648** processos. A `ref` da linha apagada sumiu, **nenhuma** outra mudou de conteúdo, e **350 `sourceRow`** andaram. Zero quarentena
**Veredicto:** sem comportamento declarado, e coerente com `D-25`
**Custo:** 1,2s · 0,3s
**Desdobramento:** a metade da pergunta do §3 que falta — o que a **fila** faz com uma edição pendente naquela linha — não foi exercida, porque exige enfileirar antes de apagar

### E-21 — renomear a aba `2026`

**Âncora:** §3, e `H-34` · **Natureza:** oráculo
**Gesto:** renomear a aba em escopo para `2027`
**Reação observada:** **`degradado`**, com `degradedReason: 'Aba "2026" nao existe na planilha.'`, zero processos, zero quarentena
**Veredicto:** conforme
**Custo:** 1,2s
**Desdobramento:** confirma o que `H-34` declara para arquivo sem a aba, agora pelo gesto real

### E-22 — acrescentar uma aba `2027`

**Âncora:** §3, risco `R-14`, e a regra inviolável 10 · **Natureza:** oráculo (relação)
**Gesto:** `Worksheets.Add` depois da última aba, nomeada `2027`, pelo Excel
**Reação observada:** cinco abas no arquivo, e o **`digestGlobal` idêntico ao da base** — `00dac5ac8b5316a0`. 649 processos, zero quarentena, zero divergência de esquema
**Veredicto:** conforme
**Custo:** 1,3s · 0,3s
**Desdobramento:** a aba a mais é **ignorada por completo** — nem um campo de um processo se move. É a regra inviolável 10 confirmada pelo lado positivo. Quando a `2027` aparecer de verdade, o gatilho de `R-14` continua sendo reexecutar `H-01`; o que este gesto mostra é que **nada quebra antes disso**

### E-23 — comparar uma medição velha com uma nova

**Âncora:** método · **Natureza:** caracterização, de erro próprio
**Gesto:** comparar um digest gerado pela versão anterior da ferramenta de digest, sem detalhe por campo, com um gerado pela versão atual
**Reação observada:** o comparador reportou **34 campos alterados em 138 processos**, e o relatório dizia que inserir uma coluna na posição `P` corrompia o registro inteiro. A inspeção direta mostrou os campos de dado **idênticos**: só `cellStyleKeys` havia crescido de 16 para 17 entradas
**Veredicto:** achado de método, não do produto
**Custo:** uma investigação inteira
**Desdobramento:** o lado sem `campos` fazia toda chave aparecer como diferença. O comparador passou a **recusar** a comparação quando um dos lados não trazia o detalhe, dizendo qual arquivo regerar — e a lição fica aqui, já que a ferramenta não foi versionada. A lição é a do próprio corpus, do outro lado: medição velha comparada com nova mente — e desta vez mentiu para o lado alarmante

### E-24 — gravar data em célula que não existe no XML

**Âncora:** TD-05.1 passo 5b · **Natureza:** oráculo (relação)
**Gesto:** `docsSentDate = 2026-09-17` no primeiro processo, cuja célula `O2` **não existe** no arquivo
**Hash antes/depois:** `CE2FE89B…1835` → `69EE1916…69AD`
**Reação observada:** `cellsWritten: 1`, `validated: true`. **29 das 30 entradas idênticas** — só `sheet1.xml`, `+34 bytes`. **`xl/styles.xml` NÃO mudou**: 76.973 bytes e `cellXfs=290` nos dois. O surgeon criou `<c r="O2" s="163"><v>46282</v></c>`, **reusando** o `s=163` que as outras 125 células da coluna já usam. O Excel abriu com `Saved = True`
**Veredicto:** conforme, e **melhor** que o declarado
**Custo:** 0,4s · 2,0s de Excel
**Desdobramento:** **o passo 5b é condicional, e a condição não ocorre no arquivo real.** O `CLAUDE.md` afirma que gravar data em célula sem formato altera `styles.xml` de forma aditiva; medido, ele não altera, porque a coluna `O` já tem 138 células com formato de data e o surgeon reaproveita o `xf`. A afirmação não é falsa — é inalcançável enquanto a coluna tiver ao menos uma data. Medido de passagem: `I` e `K` têm **zero** células ausentes em 744 linhas; `O` tem **606**

### E-25 e E-26 — gravar data em célula que já tem data

**Âncora:** §1.1 · **Natureza:** caracterização
**Gesto:** `eta2` e `registrationDate`, cujas células existem com formato
**Reação observada:** `200`, `cellsWritten: 1`, `validated: true`. `previous` veio `2025-12-30`, no formato `AAAA-MM-DD` que `previousValue` promete
**Veredicto:** conforme
**Custo:** 0,4s cada
**Desdobramento:** nenhum — é o caminho comum, e serve de controle para `E-24`

### E-27 — pintar a linha

**Âncora:** `H-27`, §1.1 · **Natureza:** oráculo
**Gesto:** `PATCH /api/processes/FT051.26/color` de Verde (tom A) para Roxo (tom A), e aplicar
**Hash antes/depois:** `CE2FE89B…1835` → `26F27001…7AE6`
**Reação observada:** `201` na fila com `previousStyleKey: "argb:FF00FF00"`; ao aplicar, **`rowsRepainted: 1`, `cellsWritten: 0`, `validated: true`**. No zip, **28 das 30 idênticas**: `xl/styles.xml` **+796 bytes** e `xl/worksheets/sheet1.xml` **+0** — o tamanho da aba não muda, que é a assinatura de trocar o índice do estilo e não o conteúdo. **O Excel abriu com `Saved = True`**
**Veredicto:** conforme
**Custo:** 149ms a gravação · 2,0s de Excel
**Desdobramento:** **bate com o que `H-27` mediu** — 28 de 30, `sheet1.xml` e `styles.xml`. E é o veredicto que faltava: a pintura é a cirurgia de maior consequência do projeto, e **nunca havia sido aberta no Excel real** neste ensaio

### E-28 — pedir a cor que a linha já tem

**Âncora:** `H-27`, §1.1 — "aceita e nada é gravado" · **Natureza:** oráculo
**Gesto:** `PATCH` com a combinação **atual** da linha
**Hash antes/depois:** `CE2FE89B…1835` → **inalterado**
**Reação observada:** `201` na fila, e ao aplicar `applied: 1` com **`rowsRepainted: 0`, `cellsWritten: 0`** e **`backupPath: null`** — nem backup foi criado. Hash idêntico
**Veredicto:** conforme, ponto a ponto
**Custo:** 123ms
**Desdobramento:** registrado um tropeço próprio: `process.responsible` e o `responsible` do `color-map.json` são **espaços de nomes diferentes** — o primeiro vem do `team-map.json` e traz o nome consolidado (`membro1`), o segundo é `colorResponsible` (`colaborador2`). Pedir a cor "atual" com o campo errado devolve `CORPO_INVALIDO` dizendo que a combinação não tem cor, sobre a cor que a linha está usando

### E-29 — criar linha nova

**Âncora:** `H-78`, §1.1 · **Natureza:** oráculo
**Gesto:** `POST /api/edits/row` com `FT9001.26`, mais uma segunda com `values: {}`, e aplicar
**Hash antes/depois:** `CE2FE89B…1835` → `32E2D623…0DEB`
**Reação observada:** `rowsInserted: 2`, `validated: true`. **28 das 30 idênticas** — `sheet1.xml` +186 e `sharedStrings.xml` +89. **O Excel abriu com `Saved = True`**, com a `Tabela1` intacta em `A1:P997`. A aplicação releu **651** processos, zero em quarentena
**Veredicto:** conforme na escrita; **a recusa por `values` vazio não é alcançável pela rota**
**Custo:** 233ms · 2,0s de Excel
**Desdobramento:** o §1.1 declara que inserir linha com `values` vazio **recusa**. A recusa existe e está viva — `appendRow` lança `insercao sem celula alguma` quando `columns.length === 0` —, mas a **rota** devolve `201` e a linha é gravada: o write-guard injeta a REF na coluna A, então `values` nunca chega vazio à cirurgia. Mesmo padrão de `E-13` e `E-14`: garantia na camada certa, inalcançável pelo gesto

### E-30 — escrever com a planilha aberta no Excel

**Âncora:** §1.2, `H-32`; §4 item 4; `PD-09` · **Natureza:** oráculo
**Gesto:** o Excel abre e **segura** o arquivo por 45s enquanto outra conexão tenta escrever
**Hash antes/depois:** `CE2FE89B…1835` → **inalterado**
**Reação observada:** o lock **`~$E30.xlsx` existe** — 165 bytes, `Hidden, Archive, NotContentIndexed` —, o arquivo está travado para escrita, e `/api/health` responde **`externalLock: true`**. A leitura **segue normal**: 649 lidas, 649 aceitas, 0 em quarentena, as 9 rotas em `200`. A escrita recusa com **`409 EXCEL_ABERTO`** — *"A planilha esta aberta no Excel. Feche-a e aplique de novo — suas alteracoes continuam na fila."*
**Veredicto:** conforme
**Custo:** 45s de janela
**Desdobramento:** **fecha a parte de `PD-09` que esta instalação permite responder.** O `~$` é criado pelo Excel local, a aplicação o detecta, a leitura não se abala e a escrita recusa. O que segue sem resposta é se o `~$` **viaja entre máquinas** — e isso não é falta de medição: a planilha do operador está fora do OneDrive, como o `CLAUDE.md` registra, então a leitura forte de `P-15` é falsa por construção aqui

### E-31 — o watcher durante um save real do Excel

**Âncora:** §4 item 6 · **Natureza:** caracterização
**Gesto:** subir o watcher real sobre uma cópia e salvar pelo Excel no meio
**Reação observada:** leitura inicial de 649. O salvamento produziu **exatamente um disparo**, a `t=13659ms` — cerca de 2s depois do save, que é o debounce —, e a releitura dentro do handler devolveu **649 processos**, sem erro
**Veredicto:** conforme
**Custo:** 50s de janela
**Desdobramento:** **é o único ponto do ensaio em que o caminho de PRODUÇÃO foi exercido** — todo o resto rodou por `carregarPlanilha` e `server.inject`, sem observador. Um salvamento do Excel é temporário + rename e produz vários eventos de sistema de arquivos; o debounce os agrupou em um, e o arquivo já estava inteiro quando ele liberou. Confirma de passagem que o defeito de `samePath` de 16/09/2026 não voltou: se `C:/` e `C:\` divergissem, o watcher não teria emitido nada

### E-32 — aplicar uma edição cuja linha o Excel apagou

**Âncora:** §3 — "reação da fila com edição pendente naquela linha" · **Natureza:** caracterização
**Gesto:** enfileirar `statusRaw` em `FT051.26`, apagar a linha 2 pelo Excel, e só então aplicar
**Hash antes/depois:** inalterado pela aplicação
**Reação observada:** **`409 EDICAO_OBSOLETA`** — *"O que voce editou mudou na planilha depois da sua alteracao"* — com `conflicts: [{ref: "FT051.26", valueNow: "", refMissing: true}]`. Nada gravado
**Veredicto:** conforme
**Custo:** 1,2s de Excel · 0,4s
**Desdobramento:** fecha a metade que faltava de `E-20`. E o detalhe importa: `expectedHash` e `actualHash` eram **iguais** — a recusa veio do **`refMissing`**, não do hash. A aplicação confere a REF no arquivo, e não confia só na impressão digital

### E-33 — cor nova introduzida pelo operador durante a sessão

**Âncora:** §2, `H-94` · **Natureza:** caracterização
**Gesto:** pintar `A3:L3` de laranja `FF9900`, cor fora das 9 chaves, pelo Excel
**Reação observada:** **`rowsQuarantined: 1`**, com o item
`{"ref":"FT052.26","sourceRow":3,"reason":"COR_NAO_MAPEADA"}`. As 649 linhas continuam aceitas
**Veredicto:** conforme
**Custo:** 1,3s de Excel · 0,3s
**Desdobramento:** regras invioláveis 2 e 3 funcionando juntas contra o arquivo real — a cor desconhecida **não** vira a mais próxima, vai para a quarentena com motivo estruturado, e a linha é referenciada por `ref` e `sourceRow`, nunca por conteúdo

### E-34 — o rótulo de uma coluna apagado, pelo XML

**Âncora:** `H-96`, §1.3 · **Natureza:** oráculo
**Gesto:** `<c r="C1" s="193" t="s"><v>2</v></c>` vira `<c r="C1" s="193"/>` — o estado que o Excel se recusa a produzir (`E-13`)
**Reação observada:** `{"kind":"AUSENTE","column":"C","expected":"IMPORTADOR","found":null}`, leitura seguindo com 649/649/0. Na escrita, **`409 CABECALHO_VAZIO`** — *"A planilha tem coluna sem nome na linha 1, e sem o nome nao ha como conferir se cada dado vai para a coluna certa"* —, nada gravado
**Veredicto:** **conforme, e o §1.3 estava certo**
**Custo:** 0,3s
**Desdobramento:** **corrige o achado 6.** O `kind` da divergência é `AUSENTE` com `found` nulo, mas o **código de erro da escrita** é `CABECALHO_VAZIO` — `write-guard.ts:800` escolhe entre `CABECALHO_DESLOCADO` e `CABECALHO_VAZIO`. O corpus fala do que o operador vê, e acerta. O que `E-13` mostrou continua valendo: pelo **gesto** do Excel esse estado não se alcança, e o que se alcança (`Column1`) **não** bloqueia a escrita

### E-35 — a linha 1 inteira sem rótulo

**Âncora:** `H-96` · **Natureza:** oráculo
**Gesto:** remover o conteúdo de **todas** as células da linha 1, pelo XML
**Reação observada:** `{"kind":"CABECALHO_VAZIO","column":null,"expectedColumn":null,"expected":null,"found":null}` — uma divergência só, com `column` nulo exatamente como o tipo documenta. Leitura seguindo, 649/649/0
**Veredicto:** conforme
**Custo:** 0,3s
**Desdobramento:** é a condição real do `kind` — `found.length === 0` em `sheet-schema`, a linha inteira e não uma célula. Confirma também a decisão de 17/09/2026 registrada no código: **nenhuma divergência impede a leitura**

### E-36 — cabeçalho repetido, pelo XML

**Âncora:** `H-96`, §1.3 — "uma linha só, dizendo de quem é o nome" · **Natureza:** oráculo
**Gesto:** `D1` passa a apontar para a mesma entrada do pool que `C1`
**Reação observada:** **uma** divergência: `{"kind":"DUPLICADO","column":"D","expected":"BL","found":"IMPORTADOR","duplicateOf":"C"}`. A escrita **grava** — `200`, `cellsWritten: 1`
**Veredicto:** conforme
**Custo:** 0,3s · 0,2s
**Desdobramento:** `duplicateOf` preenchido, dizendo de quem é o nome, como o §1.3 promete. Que a escrita não recuse é deliberado e está escrito em `blocksWritingOne`: o `found` de um duplicado é o nome de outra coluna, **presente** — ler e gravar por letra seguem acertando

### E-37 — `<sheetData/>` vazio

**Âncora:** §3, `H-78` · **Natureza:** caracterização
**Gesto:** substituir todo o `<sheetData>` por `<sheetData/>`, pelo XML — `sheet1.xml` de 416.050 para 2.425 bytes
**Reação observada:** **0 processos, sem falhar**. `degradedReason: null`, zero em quarentena, e uma divergência `CABECALHO_VAZIO`, já que não há linha 1
**Veredicto:** conforme
**Custo:** 0,3s
**Desdobramento:** `lastRowOf` devolve zero e não lança, como `H-78` exige. Fecha o último gesto do §3 — e ele **não** se produz pelo Excel, que mantém a linha de cabeçalho enquanto a `Tabela1` existir

### E-38 — o arquivo somente-leitura

**Âncora:** §1.2, `H-25` — "`ESCRITA_INVALIDA` **antes** do backup" · **Natureza:** oráculo
**Gesto:** `IsReadOnly = true` no alvo, e aplicar
**Hash antes/depois:** `CE2FE89B…1835` → **inalterado**
**Reação observada:** **`ESCRITA_INVALIDA`** — *"A gravacao nao pode ser concluida com seguranca. Nada foi perdido."* — e, com o diretório de backup apontado para um lugar inspecionável, **zero backups gerados**
**Veredicto:** conforme, inclusive na ordem
**Custo:** 0,4s
**Desdobramento:** o "antes do backup" do §1.2 é observável, e foi observado

### E-39 — aplicar com a fila vazia

**Âncora:** §1.2, `H-25` · **Natureza:** oráculo
**Gesto:** `POST /api/edits/apply` sem nada enfileirado
**Reação observada:** **`409 NADA_A_APLICAR`**, hash intacto, **zero backups**
**Veredicto:** conforme
**Custo:** 0,3s

### E-40 — o backup falhando

**Âncora:** §1.2, `H-25` — "escrita abortada antes de tocar no original" · **Natureza:** oráculo
**Gesto:** apontar o diretório de backup para um **arquivo**, e aplicar
**Reação observada:** **`ESCRITA_INVALIDA`**, e o original **intacto**
**Veredicto:** conforme
**Custo:** 0,3s

### E-41 — o `prune` de backups

**Âncora:** §1.2, RNF-21 — "remove os excedentes pelo critério **mais permissivo** dos dois" · **Natureza:** caracterização
**Gesto:** 40 backups — 35 com até 35 dias e 5 com mais de 100 —, e uma gravação
**Reação observada:** sobraram **36**: os 35 recentes **mais** o novo. Os **5 velhos saíram**, e os 35 recentes **não** foram cortados para o teto de 30
**Veredicto:** conforme
**Custo:** 0,4s
**Desdobramento:** "mais permissivo" fica caracterizado com número: o teto de 30 **não** corta o que ainda está dentro dos 90 dias

### E-42 — interromper a gravação no meio

**Âncora:** §1.2, `H-25` — "original intacto; a renomeação não chegou a ocorrer" · **Natureza:** oráculo
**Gesto:** matar o processo durante o `apply`, em **oito** instantes entre 40ms e 320ms, refazendo a cópia a cada vez
**Reação observada:** nas oito, o original ficou **byte a byte idêntico** ao esperado, **legível** — o zip abre com as 30 entradas — e **nenhum arquivo temporário** ficou para trás
**Veredicto:** conforme
**Custo:** ~8s
**Desdobramento:** a substituição é atômica, e o arquivo nunca aparece pela metade. Registrado um erro de método: a primeira leitura reportou `ZIP_QUEBRADO` nas oito, e era o `[IO.Compression.ZipFile]` sem `Add-Type` — não o arquivo. Um hash idêntico ao da base já provava que o arquivo era a base

### E-43 — reordenar duas linhas

**Âncora:** §5 · **Natureza:** oráculo (relação)
**Gesto:** recortar a linha 300 e inseri-la na 50, pelo Excel
**Reação observada:** **`digestGlobal` idêntico ao da base** — `00dac5ac8b5316a0`. **Zero** processos alterados, **251 `sourceRow`** mudaram, zero quarentena, zero divergência
**Veredicto:** conforme
**Custo:** 1,3s · 0,3s
**Desdobramento:** a relação do §5 — "o conjunto é o mesmo; só `sourceRow` muda" — segura exatamente

### E-44 — duplicar a planilha e ler as duas

**Âncora:** §5 · **Natureza:** oráculo (relação)
**Gesto:** copiar a base e medir a cópia
**Reação observada:** mesmo hash, mesmo `digestGlobal`, mesmos 649
**Veredicto:** conforme
**Custo:** 0,3s

### E-45 e E-46 — o arquivo some debaixo do watcher

**Âncora:** §2, `H-08` · **Natureza:** caracterização
**Gesto:** com o watcher no ar, apagar o arquivo; 12s depois, criar um **diretório** com o mesmo nome
**Reação observada:** a apagada produziu **um disparo**, a `t=12007ms`, e a releitura devolveu **0 processos, sem erro**. A criação do diretório de mesmo nome **não produziu evento nenhum**
**Veredicto:** sem comportamento declarado
**Custo:** 50s de janela
**Desdobramento:** o painel entraria em degradado sem travar, que é o desejável. O silêncio do segundo caso fica registrado: o estado passa a ser "0 processos" e nada o revisa até que um arquivo volte a existir ali

### E-47 — o que a aba real tem, e o que não tem

**Âncora:** §1.1 · **Natureza:** medição
**Gesto:** contar estruturas especiais no `sheet1.xml` do arquivo real
**Reação observada:** **zero** fórmulas `<f>`, zero compartilhadas, **sem `xl/calcChain.xml`**, zero formatação condicional, zero validação de dados, zero células mescladas, zero autofiltro próprio da aba, **uma** tabela referenciada, 30 entradas no zip
**Veredicto:** confirma o medido em 02/09/2026
**Custo:** 0,3s
**Desdobramento:** **o gesto da célula mestre de fórmula compartilhada (§1.1) não é exercível no arquivo real** — não há fórmula para editar. Ele exige `tests/fixtures/formulas-editada.xlsx`, e roda em qualquer máquina. Deixa de ser citação e passa a ser fato medido

### E-50 — os doze gestos de configuração e partida (§1.4)

**Âncora:** §1.4 · **Natureza:** oráculo · **Harness descartado** — de execução única, e o resultado está aqui
**Gesto:** cada loader chamado com um arquivo montado em temporário — nada toca `config/` real
**Reação observada:**

| Gesto | Esperado | Obtido |
|---|---|---|
| `color-map.json` com `styleKey` repetida | falha nomeando a chave | `ColorMapError: styleKey repetida … "argb:FF00FF00"` ✓ |
| `color-map.json` vazio | o serviço sobe | sem erro, 0 entradas ✓ |
| `status-aliases.json` sem `desembaracado` | partida falha | `StatusAliasesError` nomeando a chave ✓ |
| mapa de negócio malformado | mata a partida | `ClientMapError: … nao e um JSON valido` ✓ |
| mapa ausente | sem erro | 0 clientes ✓ |
| `clients: []` | idêntico ao ausente | 0 clientes ✓ |
| `rules: []` num cliente | — | `ClientMapError: clients[0].rules esta vazia` |
| `match: "prefix"` com valor vazio | recusada | `ClientMapError` nomeando `clients[0].rules[0].value` ✓ |
| membro de grupo órfão | erro nomeando membro **e posição** | `groups[0].members[1] aponta para "NAO-EXISTE"` ✓ |
| cliente em dois grupos | erro de carga | `Cliente em mais de um grupo … "ALFA"` ✓ |
| importador em dois membros, na **carga** | recusado | **sem erro, 2 membros** |
| importador em dois membros, pela **tela** | recusado | `planTeamMember` devolve rejeição com `importer` e `ownerLabel` ✓ |
| `app.json` somente-leitura (Linux) | erro explicando | **gravou** |
| `app.json` com o **diretório** travado | erro explicando | `ConfigWriteError: EACCES` ✓ |
| arquivo sem a aba pedida | degradado com a razão | `WorkbookReadError: Aba "…" nao existe na planilha.` ✓ |

**Veredicto:** dez conformes, três achados
**Desdobramento:** três coisas ficam registradas. **(a)** O §1.4 diz "mapa ausente ou `rules: []` → idêntico entre si, sem erro"; o par real do ausente é `clients: []`, e `rules: []` **num cliente** é recusado — com razão, porque um cliente que nunca casaria é engano de quem escreveu. A frase do corpus é ambígua e a leitura literal é falsa. **(b)** A recusa do importador duplicado está na **tela**, não na carga: um `team-map.json` editado à mão com o mesmo importador em dois membros **passa**, e `IND-20` conta duas vezes. O `.exemplo` já dizia "a tela recusa"; o §1.4 generaliza. **(c)** `saveWorkbookPath` grava por temporário + rename, então o atributo somente-leitura do **arquivo** não bloqueia nada no Linux — ver `E-49`

### E-51 — os cinco gestos de rota (§1.5)

**Âncora:** §1.5 · **Natureza:** oráculo · **Harness descartado** — de execução única, e o resultado está aqui
**Reação observada:** `statusRaw` com 1001 caracteres → **`400 CORPO_INVALIDO`** ✓ · processo inexistente → **`404 PROCESSO_NAO_ENCONTRADO`** ✓ · `channel=nenhum` → **`400 FILTRO_INVALIDO`** ✓ · `limit=1001` → **`400 FILTRO_INVALIDO`**, *"limit deve ser inteiro entre 1 e 1000"*
**Veredicto:** três conformes, **uma divergência**
**Desdobramento:** **o §1.5 atribui à rota o comportamento do cliente.** Ele diz que `limit=1001` "cai no padrão"; a **rota** recusa com `400`, e quem cai no padrão é a **tela** — `web/src/hooks/useProcessQuery.ts:187` devolve `DEFAULT_PAGE_SIZE` para valor fora de `PAGE_SIZES`, e o comentário de `SORT_FIELDS` logo acima diz por quê: *"cai no padrao em vez de chegar a rota e voltar 400"*. O backlog tem os dois lados — a linha 9634 fala da **tela**, a 11680 (`H-100`) repete "continua caindo no padrão" **sem dizer onde**, e lida como rota é falsa. O contrato em `docs/05` §250 já dizia `1 a 1000`

### E-52 — os oito gestos de filtro (§1.6)

**Âncora:** §1.6 · **Natureza:** oráculo · **Harness descartado** — de execução única, e o resultado está aqui
**Reação observada:** `etaFrom` posterior a `etaTo` → **vazio, `200`** ✓ · cliente inexistente → vazio, `200` ✓ · filtro que exclui tudo → **todas as contagens `0`, `200`** ✓ · busca com termo vazio e com só espaço → **não filtra**, 650 ✓
**Veredicto:** conforme
**Desdobramento:** **um dos gestos não é discriminável no arquivo real.** O §1.6 diz que `importerOutsideRj=false` "inclui apenas `false`, **não** `null`". Medido: a planilha tem **649 `false` e 1 `true`**, e **zero `null`** — o filtro devolve 649 e 1, somando o total. A garantia existe e o dado não a exercita

### E-53 — as quatro relações de filtro (§5)

**Âncora:** §5 · **Natureza:** oráculo (relação) · **Harness descartado** — de execução única, e o resultado está aqui
**Reação observada:** todas **sustentadas**, comparando o conjunto de `ref` e não o total —
comutatividade (`category`+`channel` nas duas ordens: 477, mesmo digest) ·
idempotência (o mesmo filtro duas vezes: 480, mesmo digest) ·
domínio fechado em `category`, em `channel` e em `colorResponsible` (os três devolvem **650**, o mesmo digest de não filtrar)
**Veredicto:** conforme
**Desdobramento:** registrado um teste mal formulado meu — acrescentei `importerOutsideRj` à exaustividade, e ele é `boolean` no contrato, não `string[]`: repetir o parâmetro **não** faz OU, e o último vence. Fica como caracterização, porque o contrato declara o OU só para os parâmetros de lista

### E-54 — o filtro sob coluna deslocada, e o que ele revela sobre o método

**Âncora:** §5, o cruzamento com o §3 · **Natureza:** caracterização
**Gesto:** as mesmas relações de `E-53`, sobre a cópia deslocada de `E-03`
**Reação observada:** **todas as relações continuam sustentadas** — comutatividade, idempotência e domínio fechado (649 = 649, mesmo digest) — enquanto `category=desembaracado` devolve **0** processos, contra 480 na planilha íntegra
**Veredicto:** confirma o §5, e o estende
**Desdobramento:** **o corpus estava certo e é pior do que ele diz.** Ele prevê que "o filtro continua correto e passa a filtrar dado errado, sem sintoma nenhum", e que teste de unidade não alcança isso. Medido: **as próprias relações metamórficas do §5 também não alcançam** — elas são invariantes sobre o conjunto lido, e o conjunto lido está errado de forma consistente, então passam com nota máxima sobre dado corrompido. O único sinal em todo o sistema é `schemaDivergences`, de `H-96`

### E-55 — os dez casos de caracterização (§2)

**Âncora:** §2 · **Natureza:** caracterização · **Harness descartado** — de execução única, e o resultado está aqui
**Reação observada:**

| Caso | Registrado |
|---|---|
| `patternType="darkGrid"` (`H-03`) | a cor é lida assim mesmo; surge a chave `argb:FFB7E1CD` entre as demais |
| serial `99999999` (`H-05`) | vira `Date` do ano **275690** — aceito, sem quarentena |
| serial `-500` (`H-05`) | vira `16/08/1898` — data anterior a 1900, aceita |
| REF com caractere de controle (`H-07`) | o `\u0001` **atravessa** para o valor: `"\u0001FT001.26"` |
| REF com 500 caracteres (`H-07`) | comprimento **500** preservado |
| emoji fora do plano básico (`H-24`) | round-trip **perfeito**: gravou e releu `"ENSAIO 😀 fim"`, 12 pontos de código |
| byte `0xFF` no pool (`H-24`) | vira o caractere de substituição, **sem falhar** |
| `history.jsonl` truncado (`H-28`) | a linha cortada é **ignorada**; os dois eventos íntegros sobrevivem, `truncated: true` |
| zip sem `xl/worksheets/` (`H-33`) | `WorkbookReadError` nomeando o caminho que falta ✓ |
| `[Content_Types].xml` ausente (`H-33`) | **lê normalmente** — a leitura não depende dele |

**Veredicto:** sem comportamento declarado; é a linha de base
**Desdobramento:** os dois casos de data são os que mais pedem decisão: um serial absurdo vira uma data do ano 275690 **sem ir para a quarentena**, e a regra inviolável 3 diz que buraco visível é melhor que valor errado invisível

### E-56 — os quatro gestos restantes do §1.1

**Âncora:** §1.1 · **Natureza:** oráculo · **Harness descartado** — de execução única, e o resultado está aqui
**Reação observada:** célula **mestre** de fórmula compartilhada → **recusa**: *"M2 e a celula mestre de uma formula compartilhada; sobrescreve-la invalidaria as dependentes"* ✓ · a **dependente** → permitida, `cellsWritten=1` ✓ · lista de edições vazia → **o mesmo buffer**, por identidade de referência, `cellsWritten=0`, 28 entradas ✓ · `fillId` 99999 → **recusa**: *"fillId 99999 nao existe em xl/styles.xml"* ✓ · `values` vazio em `appendRow` → **recusa**: *"insercao sem celula alguma"* ✓ · coluna `ZZZ` → **aceita e grava**
**Veredicto:** conforme
**Desdobramento:** **a fórmula compartilhada precisou ser construída.** Nem a fixture `formulas.xlsx` a tem — ela traz três `<f>` simples e um `calcChain` — nem o arquivo real, que tem zero fórmulas (`E-47`). Sem construí-la, a garantia mais citada do §1.1 não era exercível em lugar nenhum do repositório. E a coluna `ZZZ` grava: o eixo de linha tem `MAX_ROW` e **o de coluna não tem teto**, que é exatamente o que o caso-limite de `H-78` antecipa ao chamá-lo de "o par dele"

### E-57 — as quatro relações de visualização (§1.7 e §5)

**Âncora:** §1.7, §5 · **Natureza:** oráculo (relação) · **Ferramenta:** `medirCenarios`, sobre a planilha real num Chrome
**Reação observada:**

- **Filtro que exclui tudo → ausência declarada, nunca gráfico em branco.** Zero `<svg>` e zero elementos Recharts nas quatro páginas. A Inicial zera os cartões com o rótulo "ETA2 · sem data"; a Performance mostra **"— sobre 0 processos medidos"** e explica o traço; o Histórico diz **"Um gráfico zerado aqui afirmaria que não há processos, o que é diferente de não haver passado gravado"**
- **Soma dos segmentos ≤ total exibido.** Sem filtro, total **650** e os rankings somam 124, 528 e 380. Sob `channel=verde`, total **477** e os rankings somam 80, 396, 262 e 421
- **Travessia.** `channel=verde` dá **477** na Inicial e **477** no ranking de Responsáveis da Performance
- **Domínio fechado sob recorte.** No período 01/01 a 31/03: 191 + 1 + 0 + 0 = **192**, o total exibido

**Veredicto:** conforme
**Desdobramento:** a Página Clientes mostra **509 valores sob um filtro que exclui tudo**, e **não é divergência**: `ClientDeclaration` ignora os filtros globais por determinação 2 de `D-32`, declarado no cabeçalho do componente — "o que ele mostra é dívida de configuração, não recorte; seguindo o filtro, filtrar por um cliente faria a dívida sumir e o operador concluiria que declarou tudo"

### E-58 — o `ConflictDialog` na tela

**Âncora:** §4 item 3, `PD-07` item 2 · **Natureza:** oráculo
**Gesto:** enfileirar uma edição, alterar a planilha **por fora** durante a sessão, esperar o watcher reler, e clicar em "Aplicar alterações" num Chrome real
**Reação observada:** a tela pediu `POST /api/edits/apply` e recebeu **`409 ARQUIVO_MUDOU`** — confirmado por interceptação do `fetch` da própria página. O diálogo **abriu em 200 ms**, com `role="alertdialog"`, `aria-modal="true"`, título **"As alterações não foram gravadas"**, a mensagem do servidor e a tabela *Processo · Campo · Quando você editou · Na planilha agora · Você queria gravar*, preenchida com `FT051.26 · STATUS`. **O foco NÃO entrou no diálogo**: `document.activeElement` seguiu em `BODY`, e `dialogo.contains(activeElement)` deu `false`
**Veredicto:** o diálogo **conforme**; a gestão de foco **diverge**
**Desdobramento:** **fecha `PD-07` item 2, e com o achado que a pendência esperava.** Ela dizia que o item fecharia "junto da gestão de foco do diálogo, que está no mesmo bloqueio" — a gestão de foco está medida, e um `alertdialog` modal que não recebe foco ao abrir deixa quem navega por teclado ou leitor de tela fora do aviso. Registrado também um erro de método próprio: as duas primeiras execuções reportaram "o diálogo não abriu" porque o seletor procurava `role="dialog"`, e o componente usa **`alertdialog`**. Trinta segundos de espera ativa e uma interceptação de rede depois, o defeito era do seletor — e teria virado um falso positivo grave contra o produto

### E-59 — arquivo protegido por senha, cifrado pelo Excel

**Âncora:** §1.4, `P-12` · **Natureza:** oráculo
**Gesto:** `SaveAs` com senha pelo Excel real, produzindo um container **OLE2** — assinatura `D0 CF 11 E0 A1 B1 1A E1`, que nenhuma fixture do repositório tem
**Reação observada:** `degradedReason: "invalid zip data"`, 0 linhas
**Veredicto:** **diverge**
**Desdobramento:** o §1.4 pede "falha explícita citando `P-12`". A mensagem vem do `fflate`, não cita `P-12`, não diz que o arquivo está protegido por senha, e não diz ao operador o que fazer. É o único caminho do §1.4 em que a mensagem não orienta

### E-60 — `app.json` somente-leitura, no Windows

**Âncora:** §1.4, `H-34` · **Natureza:** oráculo
**Gesto:** `IsReadOnly = true` no `app.json` e `saveWorkbookPath`, na máquina do operador
**Reação observada:** **`ConfigWriteError`**, com `EPERM: operation not permitted, rename`
**Veredicto:** conforme **no alvo**
**Desdobramento:** fecha o par de `E-50`. A gravação é temporário + rename, e o Windows **respeita** o atributo ReadOnly no destino do rename, enquanto o Linux só olha a permissão do diretório. A mensagem — *"Confira se o arquivo nao esta somente-leitura"* — está certa no Windows, que é o alvo por RNF-26, e seria enganosa no Linux

### E-61 — as sete meias-linhas que sobraram

**Âncora:** §1.1, §1.4, §1.5, §1.6 · **Harness descartado** — de execução única, e o resultado está aqui
**Gesto:** sete itens que os harnesses anteriores contaram como fechados exercendo **metade** da linha da tabela

| Gesto | Esperado | Obtido |
|---|---|---|
| `s=` além do fim de `<cellXfs>` (§1.1) | recusa antes de gravar | `Error: styleId 99999 nao existe em cellXfs` ✓ |
| `color-map.json` vazio — o **efeito** (§1.4) | 100% das linhas na quarentena | **649 de 650 — 99,8%**, todas por `COR_NAO_MAPEADA` |
| `PUT /api/config/workbook` sem a aba (§1.4) | **salva o caminho** e entra em degradado | `200`, `state: "degradado"`, `degradedReason` listando as abas disponíveis, e o `app.json` **apontando para o arquivo novo** ✓ |
| conjunto num nome que já é filho (§1.5) | recusa | `400 CORPO_INVALIDO` — *"Esse nome ja esta dentro de outro. Declare no nome de cima, ou tire-o de la primeiro."* ✓ |
| `eta2 = null` sob filtro de período (§1.6) | excluído | 65 processos sem `eta2`; sem filtro **650**, período amplíssimo **585** — diferença **exatamente 65** ✓ |
| grupo e membro juntos (§1.6) | OU dentro do parâmetro, sem repetido | `client=AV` 304 + `client=CHUN` 20 = 324; juntos no mesmo parâmetro, **total 324 e zero repetidos** ✓ |
| mapa de equipe ausente + filtro Responsável (§1.6) | a agregação migrou para `colorResponsible` | **os 650 processos ficam com `responsible: ""`**; o filtro oferece só `[""]`; `responsible=colaborador1` devolve **0** |

**Veredicto:** cinco conformes, um número a precisar, **uma linha do corpus desatualizada**
**Custo:** ~10 min, incluindo três correções de método próprias
**Desdobramento:** três coisas. **(a)** O `color-map.json` vazio quarentena **99,8%**, não 100%: a linha que escapa é a única com `styleKey: "none"` — sem preenchimento não há cor a mapear. **(b)** O §1.6 diz que, sem mapa de equipe, "a agregação de A-18 migrou para `colorResponsible` — consequência declarada de `D-23`". Medido: **não migra para nada**. Todo processo fica em "Sem responsável", e `colorResponsible` não serve de reserva — `H-93` e `D-40` derrubaram o fallback pela cor, e o `team-map.json.exemplo` já o diz: *"Sem este arquivo NENHUM processo tem responsável… Desde `H-93` isso é o desejado"*. A linha do corpus descreve o comportamento **anterior** a `H-93`. **(c)** Fica registrado, de passagem, que entre parâmetros **diferentes** a combinação é interseção — `clientGroup` (384) com `client=AV` (304) devolve 304 —, o que o contrato declara só para o OU dentro do parâmetro

> **A lição desta rodada é de método, e vale mais que os gestos.** Seis dos sete
> eram **metade** de uma linha da tabela: `fillId` exercido e `s=` não; o mapa
> vazio carregado e o efeito dele não medido; a aba inexistente lida e o "salva o
> caminho" não. Uma linha do corpus pode declarar **duas** reações, e exercer a
> primeira não fecha a linha. As três correções de método desta rodada foram do
> mesmo tipo: `vazio.xlsx` **tem** a aba `2026` apesar do nome, a rota de
> configuração pede `path` e não `workbookPath`, e medir o Responsável sem mapa
> exige reinicializar o **store**, não só montar outro servidor — quem projeta o
> campo é o store, e a primeira leitura deu 202 dos dois lados.

---

## O ferramental que sobreviveu ao ensaio

**Três peças ficaram versionadas, e todo o resto foi descartado** — decisão do
dono em 18/09/2026, depois de duas rodadas de corte. O critério apertou a cada
uma: primeiro saíram os harnesses de execução única; depois, os de medição que
se reescrevem em minutos.

**O que ficou é o andaime da máquina do operador** — `tools/ensaio-windows.sh`,
`tools/ensaio-excel.ps1` e `tools/ensaio-excel.cmd` —, e ficou porque **o código
não é o valor: o valor é o que está codificado nele.** Montá-lo custou, nesta
sessão: duas tentativas de quoting até o `-EncodedCommand`; o BOM do `.NET`
matando a partida; três tentativas até descobrir que o CLIXML vem pelo *stderr*;
o `schtasks` que não cria tarefa sem `/ru`; e **seis gestos perdidos** numa
corrida entre conexões SSH, que só some com a cópia dentro do mesmo bloco. Cada
uma virou comentário no arquivo.

É o mesmo argumento que o `CLAUDE.md` já registra para `medirCenarios` —
"montar o preâmbulo à mão custou oito scripts iguais em 04 e 08/09/2026, e dois
deles falharam no andaime, não na medida".

**Descartados:** os harnesses de `§1.1`, `§1.4`, `§1.5`, `§1.6` e `§2`, o das
sete meias-linhas, e as ferramentas de digest, comparação, escrita, watcher e
mutação de XML. Rodaram o que tinham de rodar; os números estão neste documento,
e **o que neles merecia guarda permanente virou teste** — as sete correções
abaixo saíram deles e hoje rodam no portão, sem depender de ninguém invocar nada.

**Absorvido:** o comparador de zip virou o campo `detalhes` de `compararZip`, em
`tools/carregar-planilha.mjs`. As duas respondiam à mesma pergunta, e o que a
segunda acrescentava era o **tamanho** por entrada — que é o que torna
"estritamente aditivo" (TD-05.1, passo 5b) conferível sem reabrir os zips à mão.

**`tools/medir-numeros.mjs` fica**, e não por ser do ensaio: ele gera o
relatório de medição — em `data/` desde 21/09/2026, fora do versionamento
(`D-59`) — e mede o **produto**, não o exercício. O §7 o cita como o
caminho de conferir todo número que a tela mostra.

> **O que se perde, declarado.** Nada do registro: as 61 entradas abaixo têm
> gesto, hash, número e veredicto, e valem sozinhas. O que se perde é a
> capacidade de **refazer** as medições sem reescrever o ferramental — e há data
> marcada para isso, porque a virada de ano dispara `R-14` e reexecuta `H-01`. O
> andaime foi mantido justamente para que aquela sessão comece na medida, e não
> no preâmbulo.

---

## O que foi corrigido — 17/09/2026

Onze dos dezesseis achados viraram código ou documento na mesma sessão. Nenhum
foi corrigido **durante** o gesto que o produziu: a regra inviolável 1 manda que
divergência vire achado, e a correção veio depois, por decisão do dono.

| # | Correção | Guarda |
|---|---|---|
| 3 | O bloco de `D-43` no corpus deixa de afirmar "nenhuma anomalia" e passa a registrar o salto de **0,6% para 93,5%**, com `DATA_SEM_ANO` em 607 linhas | — |
| 5 | `readJsonConfig` tolera o BOM, e os **cinco** loaders de configuração passam por ele — uma fonte, não uma cópia por arquivo | `tests/app/config.test.ts` |
| 9 | `buildServer` repassa o `queuePath` a `registerProcessColorRoute` | `tests/http/edits.test.ts` · **RESOLVIDO** |
| 11 | O `ConflictDialog` usa `useModalFocus`, como os outros dois modais — o mesmo mecanismo que `H-83` exige, e não uma segunda implementação | `web/tests/ConflictDialog.test.tsx` · **RESOLVIDO** |
| 12 | A assinatura OLE2 é detectada antes da descompactação, e a mensagem cita `P-12` e diz o que fazer. **Validado contra o arquivo cifrado pelo Excel real** | `tests/io/xlsx-reader.test.ts` · **RESOLVIDO** |
| 13 | `loadTeamMap` recusa o mesmo importador em dois membros, pelo mesmo critério da tela (`overlaps`, que trata sufixo de filial) | `tests/app/team-map-loader.test.ts` · **RESOLVIDO** |
| 2, 7, 14, 16 | As quatro linhas do corpus reescritas, cada uma citando o gesto que a mediu | `tests/repo/documentacao.test.ts` |
| 10 | O `CLAUDE.md` passa a dizer que o passo 5b de TD-05.1 **não ocorre no arquivo real**, e por quê | idem · **RESOLVIDO** |
| — | A linha de `PD-08` no `CLAUDE.md` descrevia como aberta uma parte documental fechada em 04/09/2026. Conferido na branch e corrigido | idem |

> **Duas correções foram refeitas depois de erradas na primeira tentativa, e as
> duas pelo mesmo motivo: a peça já existia.** A gestão de foco começou como
> implementação própria — que é exatamente a "segunda implementação" que o
> critério de `H-83` proíbe — e virou `useModalFocus`. E a tolerância ao BOM
> começou em `config.ts` e virou `readJsonConfig`, compartilhado, quando os
> outros quatro loaders apareceram no mesmo `grep`. **Procurar antes de escrever
> teria poupado as duas.**

> **Um teste-âncora pegou um defeito na própria correção.** A recusa do
> importador duplicado tratava como conflito o mesmo importador repetido
> **dentro** de um membro — o que não é conflito, e mataria a partida por uma
> linha duplicada inócua. Quem flagrou foi a âncora escrita junto com o caso
> principal.

---

## Achados em aberto

**Nenhum segue aberto, dos dezesseis.** Eles foram resolvidos no código,
emendados nos documentos ou movidos para os cabeçalhos — conferido item a item
contra o código em 22/09/2026, e o destino de cada um está em `D-60`. Cada
achado que saiu desta tabela conserva sua seção `E-NN` acima.

**O último a cair foi o #4**, em 22/09/2026, por `D-65`: a fila aceitava a
edição sobre planilha deslocada, e só o `apply` recusava. As três rotas que
enfileiram passaram a recusar com o mesmo código — o `previous` lido da coluna
vizinha some junto, porque nada chega a ser enfileirado. **Sem história**, e a
decisão que ele aguardava foi tomada na conversa: enfileirar com o cabeçalho
bloqueado é enfileirar para nada.

*(Esta tabela chegou a ter 16 linhas marcando só 3 como resolvidas, enquanto 12
já estavam. Lida sem abrir o código, ela produziu duas afirmações falsas em
21/09/2026, em `D-59` e no PR #144. A regra inviolável 1 continua: a divergência
vira achado, e o achado decide se vira história.)*

---

## O que falta

**O corpus foi percorrido inteiro.** O que sobra não é gesto — é decisão.

- **`ALE-06`** segue não medido, e continua sendo o mesmo impasse da fase 1:
  medi-lo exige `historyPath` real, e portanto gravar no estado do operador
- **`PD-07` item 1** — a paleta nominal do Windows sob `forced-colors` — é a
  única coisa que ainda pede a máquina do operador, e é confirmação de segunda
  ordem
- **Os quinze achados** acima esperam decisão. Nenhum virou correção: a regra
  inviolável 1 manda que divergência vire achado, e que o achado decida se vira
  história
