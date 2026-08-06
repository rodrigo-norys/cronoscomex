# 05 — Contratos de API

API HTTP local, servida por Fastify em `http://127.0.0.1:5173`. Consumida
apenas pela SPA da própria aplicação. Todos os corpos são `application/json;
charset=utf-8`.

Sem autenticação (RNF-32): o processo escuta somente em loopback (RNF-29).

---

## 1. Convenções

### 1.1. Filtros globais

Onze parâmetros de consulta, todos opcionais, aplicáveis às rotas marcadas
**[F]**. Quando ausentes, nenhum filtro é aplicado. Valores múltiplos são
repetidos (`?client=A&client=B`) e combinados em **OU** dentro do mesmo
parâmetro, **E** entre parâmetros distintos.

| Parâmetro | Tipo | Domínio |
|---|---|---|
| `etaFrom` | `string` | Data ISO `AAAA-MM-DD`. Compara com ETA2, inclusivo |
| `etaTo` | `string` | Data ISO `AAAA-MM-DD`. Compara com ETA2, inclusivo |
| `client` | `string[]` | Chave normalizada de CLT |
| `importer` | `string[]` | Chave normalizada de IMPORTADOR |
| `vessel` | `string[]` | Chave normalizada de NAVIO |
| `agent` | `string[]` | Chave normalizada de AGENTE |
| `goods` | `string[]` | Chave normalizada de MERCADORIA |
| `category` | `string[]` | `desembaracado` · `em_desembaraco` · `em_andamento` · `fechado_aguardando_draft` |
| `responsible` | `string[]` | `colaborador1` · `colaborador2` · `colaborador1_outros_clientes` · `indefinido`. O valor `colaborador1` seleciona **também** `colaborador1_outros_clientes` (A-18) |
| `channel` | `string[]` | `vermelho` · `nenhum` · `indefinido` |
| `port` | `string[]` | Chave normalizada de ETA. Domínio aberto (A-36) |
| `importerOutsideRj` | `boolean` | `true` · `false` |

Parâmetro com valor fora do domínio → `400 FILTRO_INVALIDO`.

### 1.2. Envelope de erro

```jsonc
{
  "error": {
    "code": "EXCEL_ABERTO",
    "message": "O arquivo está aberto no Excel. Feche-o e tente novamente.",
    "detail": { "lockFile": "~$planilha.xlsx" }
  }
}
```

| Código | HTTP | Quando |
|---|---|---|
| `FILTRO_INVALIDO` | 400 | Valor de filtro fora do domínio |
| `CORPO_INVALIDO` | 400 | Corpo não satisfaz o schema |
| `CAMPO_NAO_EDITAVEL` | 400 | Tentativa de editar campo derivado ou fora da lista editável |
| `PROCESSO_NAO_ENCONTRADO` | 404 | REF inexistente na leitura corrente |
| `EDICAO_NAO_ENCONTRADA` | 404 | `id` de edição inexistente na fila |
| `EXCEL_ABERTO` | 409 | Existe `~$<arquivo>.xlsx` |
| `ARQUIVO_MUDOU` | 409 | Hash difere do da última leitura |
| `NADA_A_APLICAR` | 409 | Fila de edições vazia |
| `ESCRITA_EM_ANDAMENTO` | 409 | Já existe uma aplicação em curso |
| `ARQUIVO_INDISPONIVEL` | 503 | Aplicação em estado `Degradado` |
| `ESCRITA_INVALIDA` | 500 | Validação pós-escrita falhou; **backup restaurado** |
| `ERRO_INTERNO` | 500 | Demais falhas |

### 1.3. Tipos compartilhados

```ts
type StatusCategory = 'desembaracado' | 'em_desembaraco' | 'em_andamento'
                    | 'fechado_aguardando_draft'
type Responsible    = 'colaborador1' | 'colaborador2' | 'colaborador1_outros_clientes' | 'indefinido'
type CustomsChannel = 'vermelho' | 'nenhum' | 'indefinido'

interface ProcessDto {
  ref: string
  sourceRow: number
  client: string; importer: string; billOfLading: string; agent: string
  container: string; vessel: string; port: string; goods: string
  eta2: string | null            // AAAA-MM-DD
  registrationDate: string | null
  docsSentDate: string | null
  statusRaw: string              // texto original, exibido só no detalhe
  statusCategory: StatusCategory
  responsible: Responsible
  customsChannel: CustomsChannel
  importerOutsideRj: boolean | null
  boletoRaw: string              // fora de escopo, apenas exibição
  paymentRaw: string             // fora de escopo, apenas exibição
  columnPRaw: string             // não documentada (P-02)
  anomalies: string[]
  hasPendingEdits: boolean
}

interface GroupCount {
  key: string        // chave normalizada
  label: string      // primeira grafia encontrada
  count: number
  overdueCount?: number   // presente apenas no ranking de agentes (A-27)
}
```

---

## 2. Rotas de leitura

### `GET /api/health`

Estado do processo. Nunca falha enquanto o servidor responder.

```jsonc
{
  "state": "pronto",              // partindo | lendo | pronto | escrevendo | degradado
  "workbookPath": "C:\\...\\planilha.xlsx",
  "lastReadAt": "2026-08-03T14:22:31.004Z",
  "lastReadOk": true,
  "lastReadDurationMs": 0,        // null enquanto não houve leitura
  "sourceFileHash": "sha256:9f2c...",
  "rowsRead": 0,
  "rowsAccepted": 0,
  "rowsQuarantined": 0,
  "pendingEditsCount": 0,
  "degradedReason": null,
  "externalLock": false,          // H-32 — existe ~$<nome>.xlsx na pasta
  "conflictFiles": []             // H-32 — arquivos de conflito do OneDrive
}
```

`externalLock` e `conflictFiles` são **sinal, nunca ação** (A-58): a leitura
acontece igual e o painel continua servindo o dado. A recusa de escrita com
`409 EXCEL_ABERTO` é outra coisa, e vive em `H-25`.

Os contadores aparecem zerados por serem preenchidos em execução; nenhum valor
é afirmado aqui.

| Código | Situação |
|---|---|
| 200 | Sempre, inclusive em estado `degradado` |

---

### `GET /api/processes` **[F]**

Lista de processos, já filtrada.

| Parâmetro adicional | Tipo | Padrão | Significado |
|---|---|---|---|
| `search` | `string` | — | Busca por substring, sem acento e sem caixa, em REF, BL e CNTR (A-39) |
| `activeOnly` | `boolean` | `false` | `true` restringe a `statusCategory ≠ desembaracado` (A-16) |
| `sort` | `string` | `eta2` | `ref` · `eta2` · `registrationDate` · `client` · `vessel` |
| `order` | `string` | `asc` | `asc` · `desc`. Nulos sempre por último |
| `limit` | `number` | `200` | 1 a 1000 |
| `offset` | `number` | `0` | ≥ 0 |

```jsonc
{ "items": [ /* ProcessDto[] */ ], "total": 0, "limit": 200, "offset": 0 }
```

| Código | Situação |
|---|---|
| 200 | Sucesso, inclusive lista vazia |
| 400 | `FILTRO_INVALIDO` |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

### `GET /api/processes/:ref`

Detalhe de um processo. Inclui o texto original de STATUS e os campos fora de
escopo, exibidos mas não usados em cálculo.

```jsonc
{
  "process": { /* ProcessDto */ },
  "pendingEdits": [ { "id": "01J...", "field": "eta2", "value": "2026-08-06", "previous": "2026-08-04", "ts": "..." } ],
  "statusHistory": [ { "ts": "2026-07-30T...", "from": "em_andamento", "to": "desembaracado" } ],
  "daysInCurrentCategory": 0
}
```

| Código | Situação |
|---|---|
| 200 | Sucesso |
| 404 | `PROCESSO_NAO_ENCONTRADO` |

---

### `GET /api/indicators` **[F]**

Os 21 indicadores em escopo, sobre o conjunto filtrado. IND-21 não aparece:
está fora de escopo por lacuna de dado (§4 da especificação).

```jsonc
{
  "counts": {
    "total": 0,                    // IND-01
    "emAndamento": 0,              // IND-02
    "emDesembaraco": 0,            // IND-03
    "desembaracados": 0,           // IND-04
    "fechadoAguardandoDraft": 0,   // IND-05
    "canalVermelho": 0,            // IND-06
    "chegandoHoje": 0,             // IND-07
    "chegandoSemana": 0,           // IND-08
    "chegando15Dias": 0,           // IND-09
    "documentosPendentes": 0,      // IND-14
    "atrasados": 0,                // IND-15
    "desembaracadosHoje": 0        // IND-16
  },
  "rankings": {
    "clients":     [ /* GroupCount[] */ ],  // IND-10 e IND-18
    "importers":   [ /* GroupCount[] */ ],  // IND-11 e IND-19
    "agents":      [ /* GroupCount[] com overdueCount */ ], // IND-17
    "goods":       [ /* GroupCount[] */ ],  // IND-13
    "responsible": [ /* GroupCount[] */ ]   // IND-20
  },
  "expectedVessels": [                       // IND-12
    { "vesselKey": "EVER FAIR", "vesselLabel": "EVER FAIR", "eta2": "2026-08-06", "processCount": 0 }
  ],
  "documentaryLeadTime": {                   // IND-22
    "averageDays": null,
    "sampleSize": 0,
    "excludedNegative": 0,
    "excludedIncomplete": 0
  },
  "meta": {
    "topN": 10,
    "today": "2026-08-03",
    "timezone": "America/Sao_Paulo",
    "weekEnd": "2026-08-09",
    "bazarShare": null
  }
}
```

`documentaryLeadTime.averageDays` é `null` quando `sampleSize` é zero — média
de conjunto vazio não é zero, e apresentá-la como zero seria mentir sobre o
dado (A-42). `bazarShare` acompanha IND-13 para tornar visível a distorção
declarada em A-34.

| Código | Situação |
|---|---|
| 200 | Sucesso |
| 400 | `FILTRO_INVALIDO` |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

### `GET /api/alerts` **[F]**

Os 6 alertas, achatados em lista única e ordenados por severidade fixa (A-41),
depois por ETA2 ascendente com nulos por último.

```jsonc
{
  "items": [
    { "type": "eta_vencida", "severity": 1, "ref": "FT400.26", "sourceRow": 300,
      "eta2": "2026-07-20", "daysOverdue": 14,
      "message": "ETA vencida há 14 dias" }
  ],
  "countsByType": {
    "eta_vencida": 0,            // ALE-01
    "documentacao_pendente": 0,  // ALE-02
    "canal_vermelho": 0,         // ALE-03
    "chegadas_hoje": 0,          // ALE-04
    "chegadas_7_dias": 0,        // ALE-05
    "processos_parados": 0       // ALE-06
  },
  "stalledThresholdDays": 15,
  "historyStartedAt": "2026-08-03T14:22:31.004Z"
}
```

`historyStartedAt` informa desde quando existe histórico, para que a interface
não sugira retroatividade inexistente (A-43).

| Código | Situação |
|---|---|
| 200 | Sucesso |
| 400 | `FILTRO_INVALIDO` |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

### `GET /api/history/monthly` **[F]**

Série mensal da Página Histórico, derivada de `data/history.jsonl`.

| Parâmetro | Tipo | Padrão |
|---|---|---|
| `months` | `number` | `12`. De 1 a 60 |

```jsonc
{
  "series": [
    { "month": "2026-08", "total": 0, "desembaracados": 0, "canalVermelho": 0 }
  ],
  "historyStartedAt": "2026-08-03T14:22:31.004Z",
  "truncated": true
}
```

`truncated: true` indica que a janela pedida excede o histórico existente — a
série começa quando a aplicação começou, não antes.

---

### `GET /api/filters/options`

Valores disponíveis para cada filtro, derivados do arquivo, não de lista fixa
(RF-19, A-36).

```jsonc
{
  "clients":   [ { "key": "RSASSI", "label": "RSASSI", "count": 0 } ],
  "importers": [], "vessels": [], "agents": [], "goods": [], "ports": [],
  "categories":  [ { "key": "desembaracado", "label": "Desembaraçado", "count": 0 } ],
  "responsible": [ { "key": "colaborador1", "label": "Colaborador 1", "count": 0 } ],
  "channels":    [ { "key": "vermelho", "label": "Canal Vermelho", "count": 0 } ]
}
```

---

### `GET /api/quarantine`

Relatório de linhas não interpretadas e de divergências (RF-06, RF-08).

```jsonc
{
  "generatedAt": "2026-08-03T14:22:31.004Z",
  "sourceFileHash": "sha256:9f2c...",
  "totalDataRows": 0,
  "acceptedRows": 0,
  "quarantinedRows": 0,
  "quarantineRate": 0,
  "items": [
    { "sourceRow": 512, "ref": "FT501.26", "reason": "COR_NAO_MAPEADA",
      "detail": "styleKey=theme:9|tint:0.3999" }
  ],
  "anomalies": [
    { "sourceRow": 482, "ref": "FT481.26", "code": "CANAL_EM_TEXTO_STATUS",
      "detail": "STATUS contém 'CANAL AMARELO'" }
  ]
}
```

`reason` ∈ `REF_AUSENTE` · `REF_DUPLICADA` · `COR_NAO_MAPEADA`.
`code` ∈ `RG_SEM_DESEMBARACO` · `INTERVALO_DOCUMENTAL_NEGATIVO` ·
`CANAL_EM_TEXTO_STATUS` · `DATA_SEM_ANO` · `COR_NAO_MAPEADA` ·
`VARIANTE_STATUS_PROXIMA`.

---

### `POST /api/reload`

Força releitura imediata, sem esperar o watcher.

Corpo: vazio.

```jsonc
{ "reloaded": true, "lastReadAt": "...", "rowsRead": 0, "rowsQuarantined": 0 }
```

| Código | Situação |
|---|---|
| 200 | Releitura concluída |
| 409 | `ESCRITA_EM_ANDAMENTO` |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

## 3. Rotas de edição

### Campos editáveis

Somente estes. Qualquer outro → `400 CAMPO_NAO_EDITAVEL`.

| Campo | Coluna | Tipo aceito | Validação |
|---|---|---|---|
| `clientRaw` | B | string | ≤ 255 caracteres |
| `importerRaw` | C | string | ≤ 255 |
| `billOfLading` | D | string | ≤ 255 |
| `agentRaw` | E | string | ≤ 255 |
| `container` | F | string | ≤ 255 |
| `vesselRaw` | G | string | ≤ 255 |
| `portRaw` | H | string | ≤ 255 |
| `eta2` | I | `AAAA-MM-DD` ou `null` | data válida |
| `goodsRaw` | J | string | ≤ 1000 |
| `registrationDate` | K | `AAAA-MM-DD` ou `null` | data válida |
| `statusRaw` | L | string | ≤ 1000 |
| `boletoRaw` | M | string | ≤ 255 |
| `paymentRaw` | N | string | ≤ 255 |
| `docsSentDate` | O | `AAAA-MM-DD` ou `null` | data válida |
| `columnPRaw` | P | string | ≤ 255 |

**Não editáveis** por serem derivados: `statusCategory`, `clientKey` e demais
chaves, `anomalies`, `sourceRow`, `ref`.

`ref` não é editável porque é a chave natural; alterá-la equivaleria a criar
outro processo, o que a aplicação não faz — criação de linha nova está fora de
escopo (§3.2 de `00-visao-escopo.md`).

Os campos derivados de cor (`responsible`, `customsChannel`,
`importerOutsideRj`) tornam-se editáveis na Fase 4, por `H-27`, através da
rota dedicada abaixo.

---

### `POST /api/edits`

Enfileira uma edição. **Não toca no `.xlsx`.**

```jsonc
{ "ref": "FT533.26", "field": "eta2", "value": "2026-08-06" }
```

```jsonc
{
  "id": "01J8ZQ...",
  "ref": "FT533.26", "sourceRow": 483,
  "field": "eta2", "value": "2026-08-06", "previous": "2026-08-04",
  "ts": "2026-08-03T14:30:00.000Z",
  "pendingEditsCount": 1
}
```

| Código | Situação |
|---|---|
| 201 | Enfileirada |
| 400 | `CORPO_INVALIDO`, `CAMPO_NAO_EDITAVEL` |
| 404 | `PROCESSO_NAO_ENCONTRADO` |

---

### `PATCH /api/processes/:ref/color`

Enfileira alteração dos campos codificados em cor. Disponível a partir da
Fase 4 (`H-27`). Os três são gravados como **uma única** mudança de estilo da
linha, porque compartilham a mesma célula-âncora.

```jsonc
{ "responsible": "colaborador2", "customsChannel": "nenhum", "importerOutsideRj": false }
```

A combinação enviada precisa corresponder a exatamente uma entrada de
`color-map.json`; caso contrário → `400 CORPO_INVALIDO` com a lista de
combinações válidas. Isso decorre de A-31: a cor codifica dimensões
concorrentes, e nem toda combinação é representável.

| Código | Situação |
|---|---|
| 201 | Enfileirada |
| 400 | `CORPO_INVALIDO` — combinação sem cor correspondente |
| 404 | `PROCESSO_NAO_ENCONTRADO` |

---

### `GET /api/edits`

```jsonc
{ "items": [ /* edições consolidadas, uma por (ref, field) */ ], "count": 0 }
```

---

### `DELETE /api/edits/:id`

Descarta uma edição enfileirada.

| Código | Situação |
|---|---|
| 204 | Descartada |
| 404 | `EDICAO_NAO_ENCONTRADA` |

---

### `DELETE /api/edits`

Descarta **todas** as edições enfileiradas.

```jsonc
{ "discarded": 0 }
```

---

### `POST /api/edits/apply`

Grava a fila no `.xlsx`, executando a sequência de defesas de `04-arquitetura.md §3.2`.

Corpo: vazio.

**200 — sucesso:**

```jsonc
{
  "applied": 0,
  "cellsWritten": 0,
  "backupPath": "data/backups/planilha-20260803-143512.xlsx",
  "durationMs": 0,
  "validated": true
}
```

**409 `ARQUIVO_MUDOU` — corpo com o conflito:**

```jsonc
{
  "error": {
    "code": "ARQUIVO_MUDOU",
    "message": "A planilha mudou desde a última leitura. As edições foram preservadas.",
    "detail": {
      "expectedHash": "sha256:9f2c...",
      "actualHash": "sha256:1ab7...",
      "conflicts": [
        { "ref": "FT533.26", "field": "eta2",
          "valueWhenEdited": "2026-08-04", "valueNow": "2026-08-05", "yourValue": "2026-08-06" }
      ]
    }
  }
}
```

A fila **não** é descartada em nenhum caminho de erro. O operador relê e decide.

| Código | Situação |
|---|---|
| 200 | Gravado e validado |
| 409 | `EXCEL_ABERTO` · `ARQUIVO_MUDOU` · `NADA_A_APLICAR` · `ESCRITA_EM_ANDAMENTO` |
| 500 | `ESCRITA_INVALIDA` — **backup restaurado automaticamente** |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

## 4. Rota estática

### `GET /*`

Serve a SPA compilada (`web/dist`). Qualquer caminho não iniciado por `/api/`
devolve `index.html`, para que o roteamento do cliente funcione em recarga
direta de URL.

---

## 5. Mapa rota → história

| Rota | Histórias |
|---|---|
| `GET /api/health` | H-02, H-31 |
| `GET /api/processes` | H-17 |
| `GET /api/processes/:ref` | H-22 |
| `GET /api/indicators` | H-09, H-10, H-11, H-12, H-13 |
| `GET /api/alerts` | H-14, H-29 |
| `GET /api/history/monthly` | H-21, H-28 |
| `GET /api/filters/options` | H-15 |
| `GET /api/quarantine` | H-07 |
| `POST /api/reload` | H-08 |
| `POST /api/edits`, `GET`, `DELETE` | H-23 |
| `PATCH /api/processes/:ref/color` | H-27 |
| `POST /api/edits/apply` | H-26 |
