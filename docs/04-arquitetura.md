# 04 — Arquitetura

## 1. Contexto do sistema

```mermaid
graph LR
    U["Operador<br/>(usuário único)"]
    APP["CronosComex<br/>aplicação local"]
    XLSX[("planilha.xlsx<br/>pasta OneDrive local")]
    OD["OneDrive<br/>(agente do Windows)"]
    SP["SharePoint<br/>(cópia da organização)"]
    XL["Microsoft Excel"]

    U -->|"consulta indicadores<br/>e edita processos"| APP
    APP -->|"lê a cada alteração"| XLSX
    APP -->|"grava sob comando explícito"| XLSX
    U -->|"edita diretamente"| XL
    XL -->|"salva"| XLSX
    XLSX <-->|"sincroniza"| OD
    OD <-->|"replica"| SP

    classDef sistema fill:#1f6feb,stroke:#0d419d,color:#fff
    classDef externo fill:#30363d,stroke:#484f58,color:#fff
    classDef dado fill:#8957e5,stroke:#6e40c9,color:#fff
    class APP sistema
    class U,OD,SP,XL externo
    class XLSX dado
```

**Fronteira do sistema:** apenas o bloco `CronosComex`. OneDrive, SharePoint e
Excel são atores externos que a aplicação não controla e sobre os quais não faz
suposição de disponibilidade. A aplicação não realiza nenhuma chamada de rede
externa (RNF-31).

---

## 2. Containers

```mermaid
graph TB
    subgraph maquina["Máquina Windows do operador"]
        subgraph app["CronosComex"]
            SRV["Servidor Node<br/>Fastify 5.11.2 · TypeScript<br/>127.0.0.1:5173"]
            WEB["Interface web<br/>React 19.2.8 · Vite 8.2.0<br/>SPA servida pelo próprio Node"]
        end

        XLSX[("planilha.xlsx")]
        DATA[("data/<br/>history.jsonl<br/>pending-edits.jsonl<br/>quarantine.json<br/>backups/")]
        CFG[("config/<br/>app.json<br/>color-map.json<br/>status-aliases.json")]
        BROWSER["Edge / Chrome"]
    end

    BROWSER -->|"HTTP · JSON"| SRV
    WEB -.->|"carregada em"| BROWSER
    SRV -->|"lê e vigia"| XLSX
    SRV -->|"grava sob comando"| XLSX
    SRV -->|"lê e escreve"| DATA
    SRV -->|"lê na partida"| CFG

    classDef proc fill:#1f6feb,stroke:#0d419d,color:#fff
    classDef dado fill:#8957e5,stroke:#6e40c9,color:#fff
    classDef externo fill:#30363d,stroke:#484f58,color:#fff
    class SRV,WEB proc
    class XLSX,DATA,CFG dado
    class BROWSER externo
```

| Container | Responsabilidade | Tecnologia |
|---|---|---|
| **Servidor Node** | Ler a planilha, calcular indicadores e alertas, servir a API e a SPA, gravar no `.xlsx` sob comando | Node 22 · Fastify 5.11.2 · TypeScript 7.0.2 |
| **Interface web** | Apresentar as **sete páginas** — as seis do menu, mais o detalhe do processo, que vive fora dele (`web/src/router.ts`) —, os filtros globais e o formulário de edição. **Nenhuma regra de negócio** (RNF-38) | React 19.2.8 · Vite 8.2.0 · Tailwind 4.3.3 · Recharts 3.10.1 |
| **planilha.xlsx** | Fonte da verdade. Não pertence ao sistema | Arquivo OOXML |
| **data/** | Histórico, fila de edições, quarentena e backups. Descartável sem perda de dado de negócio | JSONL, JSON, XLSX |
| **config/** | Caminho do arquivo, mapa de cores, dicionário de grafias | JSON |

O servidor escuta exclusivamente em `127.0.0.1` (RNF-29): não há superfície de
rede, e por isso não há autenticação (RNF-32).

### As duas portas de desenvolvimento são distintas e fixas

A API atende em **5173** e o Vite em **5174**. **Isso foi um defeito real:**
`5173` estava escrito em `DEFAULTS.port`, no proxy do Vite **e** era o padrão do
próprio Vite — os três coincidiam, e a cadeia só funcionava por acidente de
ordem. Subindo a API primeiro, o Vite achava a porta ocupada e deslizava para
`5174`; na ordem inversa o Vite tomava a `5173`, a API morria com `EADDRINUSE`,
e o proxy passava a apontar para o próprio Vite — que devolve HTML onde a casca
espera JSON, produzindo "Sem contato com o servidor" e apontando para a causa
errada. Agora `web/vite.config.ts` lê a porta da API de `config/app.json` (fonte
única) e usa `strictPort`, que falha alto em vez de escolher outra em silêncio.

`npm run dev` sobe os dois por `scripts/dev.mjs`, sem dependência nova — o `&`
do shell não serve porque a máquina do operador é Windows (RNF-26), onde o `npm`
invoca `cmd`. Um processo caindo derruba o outro: meia aplicação no ar parece
saudável e não é.

---

## 3. Componentes do módulo de ingestão e cálculo

```mermaid
graph TB
    WATCH["watcher"]
    READER["xlsx-reader"]
    PARTS["xlsx-parts"]
    STYLE["style-extractor"]
    COLOR["color-mapper"]
    NORM["normalizer"]
    CLASS["status-classifier"]
    BUILD["process-builder"]
    QUAR["quarantine-reporter"]
    STORE["process-store"]
    HIST["history-store"]
    IND["indicators"]
    ALERT["alerts"]
    API["http-api"]

    WATCH -->|"caminho do arquivo"| READER
    READER -->|"XML das partes em escopo"| PARTS
    PARTS -->|"RawRow[]"| BUILD
    PARTS -->|"preenchimento da célula A"| STYLE
    STYLE -->|"styleKey"| COLOR
    COLOR -->|"campos derivados de cor"| BUILD
    NORM -->|"normKey, parseDate"| BUILD
    CLASS -->|"StatusCategory"| BUILD
    BUILD -->|"Process[]"| STORE
    BUILD -->|"itens rejeitados"| QUAR
    STORE -->|"Process[]"| HIST
    STORE -->|"Process[] filtrados"| IND
    STORE -->|"Process[] filtrados"| ALERT
    HIST -->|"dias na categoria"| ALERT
    HIST -->|"série mensal"| IND
    IND --> API
    ALERT --> API
    QUAR --> API
    STORE --> API

    classDef io fill:#8957e5,stroke:#6e40c9,color:#fff
    classDef puro fill:#1f6feb,stroke:#0d419d,color:#fff
    classDef borda fill:#238636,stroke:#1a7f37,color:#fff
    class WATCH,READER,HIST,QUAR io
    class PARTS,STYLE,COLOR,NORM,CLASS,BUILD,IND,ALERT puro
    class STORE,API borda
```

Azul = função pura, sem I/O, testável isoladamente. Roxo = componente com
efeito colateral em disco. Verde = fronteira.

| Componente | Responsabilidade (uma frase) | Entrada | Saída |
|---|---|---|---|
| `watcher` | Detectar alteração do `.xlsx` e disparar reprocessamento com debounce | Caminho do arquivo, sinal de pausa | Evento `fileChanged` |
| `xlsx-reader` | Abrir o arquivo, resolver qual aba está em escopo e descomprimir **somente** as partes dela — as demais abas nunca são infladas (regra inviolável 10) | Caminho do arquivo | `RawRow[]`, hash SHA-256 do arquivo |
| `xlsx-parts` | Interpretar as partes XML — pool de texto, estilos e `sheetData` — em célula, tipo e chave de estilo. Puro: recebe string, devolve dado | XML de `sharedStrings`, `styles` e da aba | `RawRow[]` |
| `style-extractor` | Converter o preenchimento da célula na chave de estilo literal, sem resolver cor | `fgColor` de `xl/styles.xml` | `styleKey: string` |
| `color-mapper` | Traduzir a chave de estilo em responsável, canal e localização do importador | `styleKey`, `color-map.json` | `{ responsible, customsChannel, importerOutsideRj }` ou não-mapeado |
| `normalizer` | Normalizar texto para agrupamento e converter célula em data | `string \| number \| Date` | `string` normalizada, `Date \| null`, anomalias |
| `status-classifier` | Aplicar TD-01 e devolver a categoria canônica | `RawRow`, `status-aliases.json` | `StatusCategory`, anomalias |
| `process-builder` | Compor o `Process` a partir dos anteriores e decidir aceite ou quarentena | `RawRow[]` e os módulos acima | `Process[]`, `QuarantineItem[]` |
| `quarantine-reporter` | Persistir o relatório de linhas não interpretadas e de divergências | `QuarantineItem[]` | `data/quarantine.json` |
| `process-store` | Guardar o conjunto corrente em memória e aplicar os filtros globais | `Process[]`, `FilterSet` | `Process[]` filtrado |
| `history-store` | Detectar mudanças de categoria, gravá-las e responder há quantos dias cada processo está parado | `Process[]` | `data/history.jsonl`, `Map<ref, dias>`, série mensal |
| `indicators` | Calcular os 21 indicadores em escopo sobre um conjunto já filtrado | `Process[]` | `IndicatorSet` |
| `alerts` | Calcular os 6 alertas e ordená-los por severidade | `Process[]`, dias parados | `Alert[]` |
| `http-api` | Expor os contratos de `05-contratos-api.md` e servir a SPA | Requisição HTTP | Resposta JSON |

### 3.1. Componentes de escrita

```mermaid
graph LR
    UI["interface"]
    QUEUE["edit-queue"]
    GUARD["write-guard"]
    ZIP["xlsx-surgeon"]
    BAK["backup-manager"]
    WATCH["watcher"]
    XLSX[("planilha.xlsx")]

    UI -->|"PATCH edição"| QUEUE
    QUEUE -->|"data/pending-edits.jsonl"| QUEUE
    UI -->|"POST aplicar"| GUARD
    QUEUE -->|"edições consolidadas"| GUARD
    GUARD -->|"1. pausa"| WATCH
    GUARD -->|"2. backup"| BAK
    GUARD -->|"3. hash e lock conferem"| ZIP
    ZIP -->|"4. escreve arquivo temporário e renomeia"| XLSX
    GUARD -->|"5. valida releitura"| ZIP
    GUARD -->|"6. falhou: restaura"| BAK
    GUARD -->|"7. retoma"| WATCH

    classDef proc fill:#1f6feb,stroke:#0d419d,color:#fff
    classDef dado fill:#8957e5,stroke:#6e40c9,color:#fff
    class UI,QUEUE,GUARD,ZIP,BAK,WATCH proc
    class XLSX dado
```

| Componente | Responsabilidade (uma frase) | Entrada | Saída |
|---|---|---|---|
| `edit-queue` | Registrar, consolidar e descartar edições ainda não aplicadas | `EditCommand` | `data/pending-edits.jsonl`, projeção consolidada |
| `write-guard` | Orquestrar a sequência de defesas e abortar ao primeiro sinal de risco | Edições consolidadas | `WriteResult` com motivo em caso de recusa |
| `xlsx-surgeon` | Alterar somente os nós `<c>` das células afetadas dentro do zip, preservando todo o resto byte a byte | Buffer do `.xlsx`, `CellEdit[]` | Buffer do `.xlsx` novo |
| `backup-manager` | Copiar o arquivo antes da escrita, restaurá-lo em caso de falha e expurgar backups vencidos | Caminho do arquivo | Caminho do backup |

### 3.2. Sequência de aplicação de edições

```mermaid
sequenceDiagram
    participant U as Operador
    participant API as http-api
    participant G as write-guard
    participant W as watcher
    participant B as backup-manager
    participant S as xlsx-surgeon
    participant Q as edit-queue
    participant F as planilha.xlsx

    U->>API: POST /api/edits/apply
    API->>G: aplicar edições consolidadas
    G->>W: pausar
    G->>G: aguardar releitura em voo
    G->>F: existe ~$planilha.xlsx?
    alt Excel está com o arquivo aberto
        F-->>G: lock presente
        G->>W: retomar
        G-->>U: 409 EXCEL_ABERTO
    else livre
        G->>F: SHA-256 atual
        alt hash difere do da última leitura
            G->>W: retomar
            G-->>U: 409 ARQUIVO_MUDOU + diferenças
        else confere
            G->>S: aplicar CellEdit[] e RowFillEdit[] no buffer
            alt nenhum byte mudaria
                G->>Q: arquivar fila em data/applied/
                G->>W: retomar
                G-->>U: 200 + resumo (arquivo intacto)
            else há o que gravar
                G->>B: copiar para data/backups/
                S->>F: gravar .tmp e renomear
                G->>S: reabrir e conferir células e cores alteradas
                alt validação falhou
                    G->>B: restaurar backup
                    G->>W: retomar
                    G-->>U: 500 ESCRITA_INVALIDA (arquivo restaurado)
                else validação passou
                    G->>Q: arquivar fila em data/applied/
                    G->>W: retomar
                    G-->>U: 200 + resumo
                    W->>API: fileChanged → releitura
                end
            end
        end
    end
```

> **Emenda de `H-27` (17/08/2026): a cirurgia passou a vir ANTES do backup**, e
> um ramo novo devolve sucesso sem gravar. O diagrama trazia backup → cirurgia
> desde `H-25`.
>
> A cirurgia é **pura** — opera sobre o buffer em memória e não toca o disco —,
> então adiá-la não muda o que o backup guarda: ele continua saindo do mesmo
> buffer conferido por hash, e nada é gravado antes dele. O que a inversão
> compra é o caso em que a fila resolve para o que a planilha **já tem**: o
> operador reconfirma a cor corrente, e gravar substituiria o arquivo por uma
> cópia recomprimida — mesmo XML, hash e `mtime` novos —, gastando um slot de
> retenção de backup, forçando o OneDrive a reenviar a planilha e o observador a
> reler. Reproduzido pelo `revisor-xml` em `H-27`.
>
> Nesse ramo não há backup, não há gravação e **não há validação** — não se
> valida o que não se escreveu. A resposta sai com `fileState: 'intacto'` e
> `backupPath: null`, e a fila é arquivada assim mesmo: deixá-la para trás faria
> a próxima tentativa repetir o mesmo nada.

---

## 4. Estrutura de diretórios

```
cronoscomex/
├─ config/
│  ├─ app.json
│  ├─ color-map.json
│  └─ status-aliases.json
├─ data/                      # gerado em execução, fora do controle de versão
│  ├─ history.jsonl
│  ├─ pending-edits.jsonl
│  ├─ quarantine.json
│  ├─ applied/
│  └─ backups/
├─ src/
│  ├─ domain/                 # funções puras — nenhum I/O
│  │  ├─ types.ts
│  │  ├─ normalizer.ts
│  │  ├─ status-classifier.ts
│  │  ├─ color-mapper.ts
│  │  ├─ process-builder.ts
│  │  ├─ process-projection.ts
│  │  ├─ process-query.ts
│  │  ├─ indicators.ts
│  │  ├─ alerts.ts
│  │  ├─ history.ts
│  │  ├─ date-window.ts
│  │  ├─ editable-fields.ts
│  │  └─ filters.ts
│  ├─ io/
│  │  ├─ xlsx-reader.ts
│  │  ├─ xlsx-parts.ts
│  │  ├─ style-extractor.ts
│  │  ├─ xlsx-surgeon.ts
│  │  ├─ backup-manager.ts
│  │  ├─ watcher.ts
│  │  ├─ interference-detector.ts
│  │  ├─ history-store.ts
│  │  ├─ edit-queue.ts
│  │  └─ quarantine-reporter.ts
│  ├─ app/
│  │  ├─ process-store.ts
│  │  ├─ write-guard.ts
│  │  ├─ color-map-loader.ts
│  │  ├─ status-aliases-loader.ts
│  │  ├─ logger.ts
│  │  └─ config.ts
│  └─ http/
│     ├─ server.ts
│     ├─ errors.ts
│     ├─ filter-request.ts
│     └─ routes/              # 12 rotas — ver 05-contratos-api.md
├─ web/
│  ├─ src/
│  │  ├─ pages/               # 8 arquivos: as 7 páginas + Placeholders.tsx
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ App.tsx
│  │  ├─ router.ts
│  │  ├─ index.css
│  │  └─ api-client.ts
│  ├─ public/fonts/          # .woff2 versionados (H-58) — RNF-43, nenhum CDN
│  └─ index.html
├─ tests/                     # projeto `servidor`, ambiente node
│  ├─ domain/ · io/ · app/ · http/ · repo/
│  └─ fixtures/               # 9 .xlsx versionados — nunca a planilha real
├─ web/tests/                 # projeto `interface`, ambiente jsdom
├─ tools/                     # perfilador, gerador de fixtures e conferências
├─ scripts/
│  ├─ iniciar.cmd             # atalho do operador, Windows (H-30, RNF-26)
│  ├─ dev.mjs
│  └─ porta.mjs
├─ config/                    # app.json não é versionado; há um .exemplo
└─ package.json
```

> **A árvore é conferível:** `ls src/domain src/io src/app src/http` devolve
> exatamente os arquivos acima. A pasta `src/profiling/`, que este documento
> listou até 18/08/2026, **nunca existiu** — o perfilador de `H-01` é Python e
> mora em `tools/`.

**Regra de dependência:** `domain/` não importa nada de `io/`, `app/`, `http/`
ou `web/`. A seta aponta sempre para dentro. Isso é o que torna os testes de
regra de negócio independentes de arquivo e de servidor (RNF-38).

---

## 5. Ciclo de vida

```mermaid
stateDiagram-v2
    [*] --> Partindo
    Partindo --> Lendo: config carregada
    Lendo --> Pronto: parse concluído
    Lendo --> Degradado: arquivo ausente ou ilegível
    Pronto --> Lendo: watcher detectou alteração
    Pronto --> Escrevendo: operador aplicou edições
    Escrevendo --> Lendo: escrita concluída
    Escrevendo --> Pronto: escrita recusada
    Degradado --> Lendo: arquivo reapareceu
    Pronto --> [*]: encerramento
    Degradado --> [*]: encerramento
```

**Estado `Degradado`:** o arquivo sumiu, está bloqueado ou não pôde ser
interpretado. A aplicação **mantém em memória a última leitura válida** e a
exibe com aviso visível de que o dado está congelado, junto do horário da
última leitura bem-sucedida. Ela não apresenta tela vazia nem número zerado —
um indicador em zero é indistinguível de um indicador sem dado, e essa
confusão é justamente o que o painel existe para eliminar.
