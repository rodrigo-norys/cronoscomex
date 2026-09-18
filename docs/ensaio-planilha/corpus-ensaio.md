# Corpus do ensaio mecânico sobre a planilha

O material verificável para forçar erro na aplicação **contra o arquivo real**, e
saber se o que ela promete se sustenta.

Ele destila as **54 histórias** do backlog que tocam `src/io/`, `src/domain/` ou
`src/app/` — as únicas falsificáveis no arquivo. As outras 47 são interface e
tooling, e "o contrário" delas não se exerce numa planilha.

**Este documento não substitui o backlog.** Cada item traz a âncora; quando o
ensaio contradisser o que está escrito lá, vale a regra inviolável 1 — o arquivo
vence, e a divergência vira achado documentado, nunca correção silenciosa.

---

## Os dois sentidos da medição

O ensaio corre nas duas direções, e cada uma encontra defeito de natureza
diferente. Medir só uma delas deixa metade do sistema sem exercício.

**Planilha → aplicação.** Mutar o arquivo e observar a reação — §1.3 (esquema),
§3 (mutação estrutural), §4 (o que as fixtures não cobrem). É o sentido que pega
leitura, classificação, quarentena e o aviso de divergência. O erro aqui produz
**número errado na tela**.

**Aplicação → planilha.** Agir pela tela e observar o arquivo — §1.1 (escrita no
XML), §1.2 (guardas de integridade). É o sentido que exercita a escrita
cirúrgica, e o único cujo erro alcança **o arquivo da empresa**.

### O ciclo fecha, e é onde mora o veredicto final

```
aplicação escreve → Excel abre → Excel salva → aplicação relê
```

Cada seta é um ponto de medição, e as duas do meio **só existem na máquina do
operador**:

1. **A aplicação escreve → o Excel abre sem pedir reparo?** É o veredicto último
   da escrita cirúrgica, e nenhuma suíte o dá: `xlsx-surgeon` valida o XML que
   ele mesmo produziu, o que é a definição de juiz em causa própria. Só o Excel
   de verdade responde.
2. **O Excel salva por cima → a aplicação relê sem quarentena nova?** O Excel
   reescreve `styles.xml`, `sharedStrings.xml` e o `calcChain` à maneira dele, e
   nenhuma fixture tem essa forma (§4).
3. **Desfazer a edição devolve a aba ao estado original?** É a relação do §5, e
   ela fecha o ciclo. O critério é o do ADR-0004 — entrada a entrada, pelo
   conteúdo descomprimido —, e **não** o hash do arquivo: medido em `E-10`, a aba
   volta byte a byte enquanto o hash não volta, porque o pool de strings guarda
   uma órfã.

> **A ordem importa.** Comece pelo sentido planilha → aplicação, que é
> **somente-leitura** e não arrisca nada. Só depois de a leitura estar
> caracterizada é que se escreve — porque escrita com leitura mal compreendida é
> como se corrompe um arquivo sem perceber.

---

## 0. O protocolo, antes de qualquer coisa

1. **Nunca sobre o arquivo do operador.** Só sobre cópia, em diretório próprio,
   com SHA256 conferido antes e depois de cada rodada.
2. **Um gesto por rodada.** Duas mutações simultâneas produzem reação que não se
   atribui a nenhuma das duas.
3. **A reação se registra antes de se julgar.** Em boa parte dos casos não há
   comportamento correto declarado — ver §2.
4. **Regra inviolável 10 continua valendo em teste:** nada processa, indexa ou
   registra as abas fora de escopo. A aba de CNPJ é credencial de terceiro.
5. **Regra inviolável 8:** nenhum valor de célula em log. Processo se referencia
   por `ref` e `sourceRow`.

> **Modo binário obrigatório ao copiar `.xlsx` no Windows.** `copy` do `cmd` com
> curinga na origem entra em concatenação, que é modo texto, e **trunca no
> primeiro `0x1A`**. Medido: uma cópia de 293.386 bytes saiu com **698**. Use
> `Copy-Item` do PowerShell, ou `copy /B`.

---

## 1. Garantias COM oráculo — falsificação com veredicto

A história declara o que deve acontecer sob violação. Aqui o ensaio é teste de
verdade: força a violação, a garantia tem que segurar. **Passa ou falha.**

### 1.1 Escrita no XML

| Forçar | Reação declarada | Âncora |
|---|---|---|
| Editar célula **mestre** de fórmula compartilhada (`<f t="shared" ref="…" si="N">`) | **recusa com erro** — a dependente, sem `ref`, é permitida | `H-24` |
| `fillId` além de `<fills>`, ou `s=` além de `cellXfs` | **recusa antes de gravar** — índice pendurado faz o Excel pedir reparo | `H-27` |
| Pedir combinação de cor que já é a atual | aceita e **nada é gravado**: nenhum `xf` novo, nenhum byte, `rowsRepainted` zero | `H-27` |
| Inserir linha com `values` vazio | **recusa** — diferente da fila vazia, que devolve buffer intacto | `H-78` |
| Endereçar coluna `ZZZ` | casa `[A-Z]{1,3}` e aponta a coluna 18.278, que não existe | `H-78` |
| Lista de edições vazia | buffer original inalterado, `cellsWritten: 0` | `H-24` |

### 1.2 Guardas de integridade

| Forçar | Reação declarada | Âncora |
|---|---|---|
| Arquivo somente-leitura | `ESCRITA_INVALIDA` **antes** do backup | `H-25` |
| Backup falhar | escrita abortada antes de tocar no original | `H-25` |
| Interromper no meio da gravação do temporário | original intacto — a renomeação não chegou a ocorrer | `H-25` |
| Fila vazia | `NADA_A_APLICAR`, sem backup e sem tocar no arquivo | `H-25` |
| Passar de 30 backups, ou 90 dias | `prune` remove os excedentes pelo critério **mais permissivo** dos dois | `H-25`, RNF-21 |
| Planilha aberta no Excel | `409 EXCEL_ABERTO` na escrita; o sinal é de `H-32`, a recusa é de `H-25` | `H-32`, `H-25` |

### 1.3 Esquema da aba

| Forçar | Reação declarada | Âncora |
|---|---|---|
| Deslocar coluna | `DESLOCADO`; leitura **segue**, escrita **recusa** | `H-96` |
| Renomear cabeçalho | `AUSENTE` | `H-96` |
| Apagar o texto do cabeçalho | `CABECALHO_VAZIO`, e **bloqueia escrita** | `H-96` |
| Repetir cabeçalho | uma linha só, dizendo de quem é o nome; **uma divergência por letra, no máximo** | `H-96` |
| Trocar caixa, espaço ou acento no cabeçalho | **não recusa nada** — `normKey` é a mesma normalização do agrupamento | `H-96` |
| Inserir coluna (gesto único do operador) | desloca 14 e sai **um** aviso agrupado, com o tamanho do bloco | `H-96` |

> **O que está em jogo, medido em `D-43`:** deslocar **uma** coluna faz **616 dos
> 650** processos lerem o dado do vizinho e **580 categorias** saírem erradas —
> com quarentena zero. É a corrupção silenciosa que `H-96` existe para matar.
>
> **Exercido contra o arquivo real em 17/09/2026 (`E-03`, `E-04`), e o dano é
> maior: 100% dos 649 processos**, com 87 números divergindo nas rotas —
> `desembaracados` 480 → 0, `atrasados` 105 → 0. A quarentena confirma-se em
> zero. Mas **"nenhuma anomalia" é falso**: a taxa salta de **0,6% para 93,5%**,
> e o tipo dominante — `DATA_SEM_ANO`, em 607 linhas — **não existe** na planilha
> íntegra. Há um sinal, e ninguém olhava para ele.

### 1.4 Configuração e partida

| Forçar | Reação declarada | Âncora |
|---|---|---|
| `color-map.json` com duas entradas para a mesma `styleKey` | build falha na partida, nomeando a chave repetida | `H-04` |
| `color-map.json` vazio | serviço **sobe**; as linhas não mapeadas vão para a quarentena — **649 de 650**, e a que escapa é a única sem preenchimento | `H-04` |
| `status-aliases.json` sem a chave `desembaracado` | partida falha — falhar alto é preferível a contar errado | `H-06` |
| Mapa de negócio com JSON malformado | mata a partida, como `loadConfig` | `H-48` |
| Mapa de negócio ausente ou `rules: []` | idêntico entre si, **sem erro** | `H-48` |
| Regra `match: "prefix"` com valor vazio | recusada na carga — casaria tudo | `H-48` |
| Membro de grupo apontando para cliente inexistente | erro de carga, nomeando membro e posição | `H-55` |
| Cliente declarado em dois grupos | erro de carga | `H-55` |
| Importador atribuído a dois membros da equipe | **recusado** — `IND-20` conta por pessoa, e a soma deixaria de fechar | `H-91` |
| `config/app.json` somente-leitura | `400` explicando, sem perder o estado | `H-34` |
| Apontar para arquivo sem a aba `2026` | **salva o caminho** e entra em `degradado` com a razão | `H-34` |
| Arquivo protegido por senha | falha explícita citando `P-12` | `H-01` |

### 1.5 Rotas

| Forçar | Reação declarada | Âncora |
|---|---|---|
| `statusRaw` com 1001 caracteres | `400 CORPO_INVALIDO` | `H-23` |
| Editar processo inexistente | `404` | `H-23` |
| `channel=nenhum` em URL salva antes de `H-51` | `400 FILTRO_INVALIDO` | `H-51` |
| Declarar conjunto num nome que já é filho | **recusa** — pai dentro de pai não é representável | `H-88` |
| `limit=1001` | **a rota recusa** com `400 FILTRO_INVALIDO`; quem cai no padrão é a **tela** | `H-100` |

### 1.6 Filtros

O `FilterSet` tem **15 campos**. `H-15` nasceu com onze filtros globais, e o
conjunto cresceu com `H-49`, `H-50` e `H-55`.

| Forçar | Reação declarada | Âncora |
|---|---|---|
| `etaFrom` posterior a `etaTo` | conjunto vazio, **sem erro** | `H-15` |
| Filtro de cliente com valor inexistente | vazio, `200` | `H-15` |
| Processo com `eta2 = null` sob filtro de período | **excluído** | `H-15` |
| `importerOutsideRj=false` | inclui apenas `false`, **não** `null` — cor indefinida não é o mesmo que "dentro do RJ" | `H-15` |
| Filtro que exclui tudo | todas as contagens `0`, resposta `200` | `H-09` |
| Grupo e membro marcados juntos | OU dentro do parâmetro, **sem processo repetido** | `H-55` |
| Mapa de equipe ausente **e** filtro Responsável em uso | **todo processo fica em "Sem responsável"**, e a cor não serve de reserva — `H-93` e `D-40` derrubaram o fallback | `H-50`, `H-93` |
| Busca com termo vazio ou só espaço | não filtra nada | `H-90` |

> **Filtro já tem cobertura de unidade densa** — 57 blocos em
> `tests/domain/filters.test.ts` e 36 em `tests/domain/process-query.test.ts`. O
> ensaio **não repete** isso. O que ele acrescenta é a combinação sobre as 649
> linhas reais, as relações do §5, e o cruzamento com o §3.

### 1.7 O filtro é global — e o efeito dele na visualização NÃO é medido

O filtro atravessa a navegação e vale até o operador limpar. `H-99` separou os
**catorze filtros globais** dos parâmetros de página, e `web/tests/App.test.tsx`
cobre a travessia.

O que nenhum teste de interface alcança é o passo seguinte: **o gráfico desenhar
o conjunto filtrado**. A causa é estrutural, não descuido —
`web/tests/support/api-stub.ts` faz

```js
const [path = url] = url.split('?')
```

e **descarta a query string**. A resposta do stub é idêntica com ou sem filtro.
Os testes provam que a URL foi montada — `expect(api.calls).toContain('GET
/api/history/monthly?client=ACME&months=12')` — e **nunca** que o número mudou.

As quatro visualizações e o que cada uma arrisca:

| Página | Visualização | Menções a filtro nos testes |
|---|---|---|
| Inicial | `ArrivalCalendar` | 11 |
| Clientes | `RankingBar` | 15 |
| Desempenho | `RankingBar` | 12 |
| Histórico | `LineChart` (Recharts) | **2** |

O Histórico é a única página com gráfico de biblioteca **e** a que menos
exercita filtro. É por onde começar.

---

## 2. O que NÃO tem oráculo — caracterização (*characterization testing*, ou *golden master*)

A história declara o caminho feliz e **não** diz o que acontece sob violação.
Forçar o contrário aqui **não produz veredicto**: produz observação. Registra-se
a reação; o que for inaceitável vira achado, e achado vira história.

**Tratar estes como "teste falhou" seria erro de método** — não há comportamento
correto escrito para contradizer.

A técnica é a de Michael Feathers em *Working Effectively with Legacy Code*:
registrar o comportamento **atual** como linha de base, para que a mudança futura
apareça como diferença em vez de passar despercebida. A ferramenta já está na
stack — `toMatchSnapshot()` do Vitest —, e não há dependência a acrescentar.

Exemplos do conjunto, com o que a história garante e o que fica em aberto:

| História | Garante | Fica a caracterizar |
|---|---|---|
| `H-03` | `fill.type === 'gradient'` → `"none"` | preenchimento com padrão (`patternType` diferente de `solid` e `none`) |
| `H-05` | `"29/07"` → `null` + `DATA_SEM_ANO` | serial fora do calendário do Excel; data anterior a 1900 |
| `H-07` | três linhas com mesmo REF → uma aceita, duas em quarentena | REF com caractere de controle; REF com 500 caracteres |
| `H-08` | `~$planilha.xlsx` ignorado pelo watcher | arquivo substituído por diretório de mesmo nome; arquivo apagado com o painel aberto |
| `H-24` | texto com `&`, `<`, `"` escapado | texto com byte inválido em UTF-8; caractere fora do plano básico |
| `H-28` | linha corrompida no `history.jsonl` é ignorada | arquivo truncado no meio de um registro |
| `H-33` | aba inexistente → `WorkbookReadError` com a lista | zip válido sem `xl/worksheets/`; `[Content_Types].xml` ausente |
| `H-94` | 13 cores distintas, 9 conhecidas | cor nova introduzida pelo operador durante a sessão |

---

## 3. Mutação estrutural — o eixo que o plano não cobre

Os **44 casos obrigatórios** de `docs/08-qualidade-operacao.md` §1.3 são todos
sobre **valor** — STATUS, cor, data, REF. Conferido: **nenhum** é estrutural.
Esta seção é o eixo que falta.

| Mutação | Esperado (onde declarado) | A caracterizar |
|---|---|---|
| Inserir coluna no meio | `DESLOCADO` agrupado, escrita recusa (`H-96`) | o que o Excel faz com `Tabela1` — ver §4 |
| Inserir coluna **no fim**, depois de `P` | — | relação metamórfica: os 649 processos devem ficar **idênticos** |
| Empurrar coluna **além de `P`** | defeito já medido: saía do bloco **mais** um `EXTRA` falso, porque `indexOfLetter` devolvia `-1` (`H-96`) | se a correção segura contra inserção real |
| Apagar coluna | — | provável `DESLOCADO` + `AUSENTE`; confirmar o agrupamento |
| Mover coluna para outra posição | `DESLOCADO` (`H-96`) | ordem em que as divergências saem |
| Inserir linha no meio | — | `sourceRow` de todas as posteriores muda; `H-89` mediu 271/650 mudando por outra causa |
| Apagar linha | fora de escopo por `D-25` | reação da fila com edição pendente naquela linha |
| Aba `2027` nova | reexecutar `H-01` (risco `R-14`); seletor de aba recusado por regra inviolável 10 | o que a leitura faz com a aba a mais |
| Renomear a aba `2026` | — | `H-34` diz que arquivo sem a aba entra em `degradado`; confirmar |
| `<sheetData/>` vazio | `lastRowOf` devolve zero, não falha (`H-78`) | leitura completa sobre aba sem linha |

---

## 4. O que as nove fixtures NÃO cobrem

É aqui que o ensaio sobre o arquivo real paga. Conferido no repositório:

1. **Nenhuma fixture tem coluna deslocada.** Os cinco tipos de divergência de
   `sheet-schema` são testados a partir de **arrays de cabeçalho sintéticos**,
   não de um `.xlsx` que o Excel de fato mexeu. O caminho
   *Excel altera → zip → `sharedStrings` → reader → `sheet-schema`* nunca rodou.

2. **Nenhuma fixture tem `xl/tables/`.** `tools/build_fixtures.py` remove a
   `Tabela1` de propósito, porque o `ref` dela cobre `A1:P997` e o Excel reclama
   numa fixture de 3 a 11 linhas. **O arquivo real tem a Tabela.** Inserir coluna
   dentro do intervalo de uma Tabela do Excel é comportamento distinto — ele
   estende a tabela e reescreve `table1.xml`. **Nada no projeto exerceu isso.**

3. **`ConflictDialog` não abre com fixture nenhuma** — exige a planilha alterada
   durante a sessão (`PD-07` item 2).

4. **O lock `~$` real** só existe com Excel aberto de verdade (`PD-09`).

5. **`styles.xml` depois de um save real do Excel** tem forma diferente da das
   fixtures, que são geradas por `zipfile`.

6. **O save do Excel é temporário + rename**, e o watcher observa o diretório por
   causa disso (`H-08`). A sequência real de eventos nunca foi observada.

> `H-96` **nasce de defeito simulado, não observado** — está escrito no backlog.
> É a história do repositório que mais precisa deste ensaio.

---

## 5. Relações metamórficas (*metamorphic testing*) — o oráculo de quem não tem oráculo

Quando não se sabe a saída correta, ainda se sabe a **relação** entre saídas. São
asserções comuns, sem biblioteca nenhuma.

- **Coluna vazia inserida depois de `P`** → os 649 processos saem idênticos campo
  a campo, **exceto `cellStyleKeys` e `fills`**, que são mapas indexados por
  letra de coluna e ganham a letra nova por construção. Qualquer outra diferença
  é defeito, sem precisar saber qual seria o certo.

  > A ressalva não é teórica: medido em `E-02`, sete processos ganharam a coluna
  > `Q` nesses dois campos — e em `E-18`, com a coluna inserida no meio do
  > intervalo usado, foram 138. Sem excluí-los, a relação acusa defeito onde o
  > comportamento está certo.
- **Reordenar duas linhas de dados** → o conjunto de processos é o mesmo; só
  `sourceRow` muda. Indicadores, contagens e rankings ficam iguais.
- **Duplicar a planilha inteira e ler as duas** → mesma saída, byte a byte no JSON.
- **Aplicar edição e desfazê-la para o valor anterior** → a aba volta **byte a
  byte**, e o critério é o do ADR-0004 — entrada a entrada, pelo conteúdo
  descomprimido —, nunca o hash do arquivo.

  > Medido em `E-10`: `xl/worksheets/sheet1.xml` volta idêntico e **29 das 30**
  > entradas ficam intactas, mas o hash **não** volta. O que sobra é uma string
  > órfã em `xl/sharedStrings.xml`, que o pool global não recolhe — e que o
  > próximo save do Excel limpa (`E-11`). Pedir o hash aqui é usar o critério que
  > o ADR-0004 rejeita, e reprovar uma escrita correta.
- **Editar célula de texto da aba `2026`** → 28 das 30 entradas do zip ficam byte
  a byte idênticas, incluindo as três abas fora de escopo (regra inviolável 10).
- **Gravar data em célula sem formato** → `xl/styles.xml` muda de forma
  **estritamente aditiva** (TD-05.1, passo 5b); as abas fora de escopo seguem
  idênticas.

Sobre filtros, onde a relação substitui o oráculo com vantagem:

- **Comutatividade** → filtrar por A e depois por B devolve o mesmo conjunto que
  filtrar por B e depois por A.
- **Idempotência** → aplicar o mesmo filtro duas vezes não muda o conjunto.
- **Exaustividade de domínio fechado** → marcar **todos** os valores de
  `category`, `channel` ou `colorResponsible` devolve o mesmo total que não
  filtrar nenhum. Se não devolver, existe valor fora do domínio declarado.
- **Filtro sob coluna deslocada** → é o cruzamento com o §3, e o mais perigoso
  dos dois lados: a coluna desloca, o filtro continua **correto** e passa a
  filtrar **dado errado**, sem sintoma nenhum. Teste de unidade não alcança isso
  por construção — o filtro recebe o `Process` já montado, e o erro nasceu antes,
  na leitura.

Sobre filtro e visualização — o que o stub de interface não alcança (§1.7), e que
só o servidor real sobre a planilha real responde:

- **Filtro que exclui tudo** → toda visualização mostra ausência **declarada**,
  nunca gráfico em branco nem eixo com série vazia (`H-18`).
- **Soma dos segmentos** → num `RankingBar` sob filtro, a soma das barras não
  excede o total filtrado exibido na mesma tela.
- **Travessia** → o mesmo recorte aplicado na Inicial e depois em Clientes
  devolve o mesmo total nas duas; divergir significa que uma das telas não
  recebeu o filtro.
- **Domínio fechado sob recorte** → a soma das quatro `category` dentro de um
  período é o total daquele período. É `A-12` aplicado ao recorte, e vale em
  toda tela que mostre as quatro.

---

## 6. Fatos medidos que ancoram o ensaio

Não re-derive. Cite fonte e data ao usar.

- **649 linhas** de dados, colunas **A–P**, aba `2026` (`H-01`, 03/08/2026)
- **Zero REF duplicada, zero REF vazia** (`H-01`)
- **Todas as datas são seriais reais** — zero texto sem ano (`H-01`)
- **9 chaves de cor** cobrem 100% das linhas; a tabela mostra **13 cores
  distintas** em A–P, e as outras quatro pintam **1.237 células** (`H-94`,
  11/09/2026)
- **87,4% das células têm cor** — 9.080 de 10.384 (`H-94`)
- **36 das 649 linhas divergem internamente** em A–L, o que **contradiz `A-44`**
  (`H-94`)
- **`DOCS ENVIADOS` em 20,6%** — 134 de 649 (`H-95`, 11/09/2026), contra os
  **20,7%** que `H-01` afirma. Divergência registrada, nenhum lado corrigido
- **A coluna H tem cabeçalho `ETA` e conteúdo de PORTO** — o cabeçalho mente, e a
  tabela mostra o que o arquivo diz (`H-95`)
- **A tabela tem 17 colunas** — as 16 da aba mais a Categoria (`H-95`)
- **A planilha de desenvolvimento tem uma linha sintética** (`FT5555.28`,
  `sourceRow` 746, de `D-28`); agregado que a inclua erra por um
- **744 linhas de dados, zero células ausentes em A–L** (`H-27`, 17/08/2026)

---

## 7. Os números exibidos — medição de referência

**Todo número que a tela mostra é medido contra a planilha real, com data.**
Teste de unidade com valor concreto prova a **regra**; não prova o **valor** que
o operador está vendo hoje. São coisas diferentes, e só a segunda diz se o painel
está certo agora.

O conjunto a medir:

- **21 indicadores em escopo** — `IND-01` a `IND-22`, menos `IND-21`, que está
  fora por exigir data de presença de carga que não existe e não será criada
  (`docs/02-requisitos.md`)
- **6 alertas** — `ALE-01` a `ALE-06`
- Os números **de tela que não são indicador**: taxa de quarentena, saúde da
  ingestão, contagem de divergências de esquema, o denominador de cada média
  (`sampleSize`), `groupTotals`, e o total de cada cartão

### Como medir

`tools/carregar-planilha.mjs` é o caminho oficial: ela evita repetir o preâmbulo
de `initStore` e **grava em temporário por padrão** desde 02/09/2026. Antes
disso, a conferência sobrescrevia `data/quarantine.json` e fazia append em
`data/history.jsonl` — os dois são estado do operador, e o segundo alimenta a
Página Histórico.

Rode da raiz do projeto, com `node --experimental-strip-types`.

### A referência se mede sem filtro; os recortes ficam com as relações

Medir 21 indicadores contra as combinações de catorze filtros é combinatório e
não se faz à mão. A referência se mede **uma vez, sobre o conjunto inteiro**. Os
recortes ficam por conta das relações do §5 — travessia entre telas, soma dos
segmentos, domínio fechado somando o total do período.

### A referência envelhece, e isso é declarado

A planilha é viva, e os números do §6 foram medidos em datas diferentes. Dois
deles **já divergem entre si**: `DOCS ENVIADOS` em **20,7%** (`H-01`, 03/08/2026)
contra **20,6%** (`H-95`, 11/09/2026) — registrado sem correção, pela regra
inviolável 1.

Toda linha da medição de referência carrega **fonte e data**. Sem isso ela vira
exatamente o que `.claude/rules/documentacao.md` proíbe: número que ninguém
consegue reconferir em um comando.

---

## 8. Como registrar o resultado

Uma entrada por gesto, em `docs/ensaio-planilha/RESULTADO.md`:

```
### E-NN — <o gesto, em uma linha>

**Âncora:** H-NN · **Natureza:** oráculo | caracterização
**Gesto:** <o que foi feito no Excel, exatamente>
**Hash antes/depois:** <sha256 do arquivo de trabalho>
**Reação observada:** <o que a aplicação fez — rota, tela, log, recusa>
**Veredicto:** conforme | diverge | sem comportamento declarado
**Custo:** <tempo real> · <tokens, SÓ se o harness os mediu>
**Desdobramento:** <achado, história nova, ou nada>
```

### O custo se mede, e o veredicto é sobre ele

Cada fase fecha com uma linha em `RESULTADO.md`, e a pergunta é direta: **valeu a
pena?** O critério não é gosto — é achado confirmado por unidade de custo.

| Campo | Como se obtém |
|---|---|
| Tempo | Wall clock, sempre medível |
| Gestos | Quantos foram exercidos na fase |
| Divergências | Quantas reprovaram contra garantia declarada |
| Caracterizações | Quantas registraram comportamento não declarado |
| Tokens | **Só quando o harness os mede** — trabalho em subagente |

**Token estimado não entra.** Na sessão principal não há contador exposto, e
número estimado apresentado como medido é o que a regra inviolável 3 proíbe.
Célula vazia significa "não medido", nunca "zero".

> **O precedente de como se declara custo está no `CLAUDE.md`**, no bloco do
> `revisor-docs`: ~200 mil tokens e ~20 minutos por invocação, para ~30% das
> divergências conhecidas, e **não reprodutível** — três execuções sobre o mesmo
> diff concordaram em 23%. É essa forma de declaração que o ensaio deve produzir:
> custo, retorno, e o que o número **não** garante.

Divergência **não** vira correção no mesmo gesto. Ela vira achado, e o achado
decide se vira história — é o que a regra inviolável 1 manda, e é o que impede o
ensaio de virar improviso sobre o arquivo da empresa.
