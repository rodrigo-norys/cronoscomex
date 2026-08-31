# 05 — Contratos de API

API HTTP local, servida por Fastify em `http://127.0.0.1:5173`. Consumida
apenas pela SPA da própria aplicação. Todos os corpos são `application/json;
charset=utf-8`.

Sem autenticação (RNF-32): o processo escuta somente em loopback (RNF-29).

---

## 1. Convenções

### 1.1. Filtros globais

Treze parâmetros de consulta, todos opcionais, aplicáveis às rotas marcadas
**[F]**. Quando ausentes, nenhum filtro é aplicado. Valores múltiplos são
repetidos (`?client=A&client=B`) e combinados em **OU** dentro do mesmo
parâmetro, **E** entre parâmetros distintos.

| Parâmetro | Tipo | Domínio |
|---|---|---|
| `etaFrom` | `string` | Data ISO `AAAA-MM-DD`. Compara com ETA2, inclusivo |
| `etaTo` | `string` | Data ISO `AAAA-MM-DD`. Compara com ETA2, inclusivo |
| `client` | `string[]` | Chave do **cliente consolidado** (`H-49`), resolvida contra `client-map.json`. Sem mapa, ou sem regra que case, é a própria chave de CLT |
| `clientProcess` | `string[]` | Chave normalizada da célula CLT — o processo daquele cliente (`H-49`). Domínio aberto |
| `clientGroup` | `string[]` | Chave de um grupo de clientes (`H-55`). Recorta todos os membros de uma vez; `''` seleciona quem não está em grupo nenhum |
| `importer` | `string[]` | Chave normalizada de IMPORTADOR |
| `vessel` | `string[]` | Chave normalizada de NAVIO |
| `agent` | `string[]` | Chave normalizada de AGENTE |
| `goods` | `string[]` | Chave normalizada de MERCADORIA |
| `category` | `string[]` | `desembaracado` · `em_desembaraco` · `em_andamento` · `fechado_aguardando_draft` |
| `responsible` | `string[]` | `colaborador1` · `colaborador2` · `colaborador1_outros_clientes` · `indefinido`. O valor `colaborador1` seleciona **também** `colaborador1_outros_clientes` (A-18) |
| `channel` | `string[]` | `verde` · `vermelho` · `indefinido` |
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
| `EDICAO_OBSOLETA` | 409 | Hash **confere**, mas o que a edição sobrescreveria mudou — o valor, ou a própria linha, que pode ter sumido |
| `NADA_A_APLICAR` | 409 | Fila de edições vazia |
| `ESCRITA_EM_ANDAMENTO` | 409 | Já existe uma aplicação em curso |
| `ARQUIVO_INDISPONIVEL` | 503 | Aplicação em estado `Degradado`, ou arquivo ilegível na hora de gravar |
| `ESCRITA_INVALIDA` | 500 | Escrita recusada ou desfeita; ver §3 para distinguir os casos |
| `ERRO_INTERNO` | 500 | Demais falhas |

> `EDICAO_OBSOLETA` e o alcance maior de `ARQUIVO_INDISPONIVEL` entraram em
> `H-25`, cujo contrato no backlog declarava cinco recusas. As duas estão
> justificadas em §3; a divergência está registrada no bloco de conclusão da
> história em `docs/06-backlog.md`.

### 1.3. Tipos compartilhados

```ts
type StatusCategory = 'desembaracado' | 'em_desembaraco' | 'em_andamento'
                    | 'fechado_aguardando_draft'
type Responsible    = 'colaborador1' | 'colaborador2' | 'colaborador1_outros_clientes' | 'indefinido'
type CustomsChannel = 'vermelho' | 'nenhum' | 'indefinido'

interface ProcessDto {
  ref: string
  sourceRow: number
  client: string          // cliente consolidado (H-49)
  clientProcess: string   // valor da célula CLT — o processo daquele cliente
  importer: string; billOfLading: string; agent: string
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
  segments?: GroupCount[] // H-56: a composição de um grupo de clientes
}
```

### Estado `degradado` nunca esvazia o painel

As rotas de dado devolvem `200` com a última leitura válida;
`503 ARQUIVO_INDISPONIVEL` fica reservado ao caso em que `lastReadAt === null`
— nunca houve leitura, não há o que congelar. O aviso de dado congelado é uma
faixa persistente no topo de **todas** as páginas, entregue por `H-15` na casca
da aplicação (achado A-57).

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
  "conflictFiles": [],            // H-32 — arquivos de conflito do OneDrive
  "today": "2026-08-07"           // H-15 — dia civil do servidor, no fuso configurado
}
```

`externalLock` e `conflictFiles` são **sinal, nunca ação** (A-58): a leitura
acontece igual e o painel continua servindo o dado. A recusa de escrita com
`409 EXCEL_ABERTO` é outra coisa, e vive em `H-25`.

`today` existe por **A-62**: indicadores de calendário e alertas dependem do dia
corrente, e nenhum arquivo muda à meia-noite — o watcher não dispara, e uma tela
aberta atravessa a virada exibindo a fila do dia anterior. A casca compara este
campo com o dia sob o qual renderizou e revalida quando diferem.
`GET /api/indicators` já expunha o dia em `meta.today`, mas a casca não o
consome: ela consome este health, e o dia precisa vir de **uma** fonte. É a
mesma `today(tz)` de `src/domain/date-window.ts`, resolvida a cada requisição.

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
| `sort` | `string` | `eta2` | `ref` · `eta2` · `registrationDate` · `client` · `vessel`. `client` ordena pelo **cliente consolidado**; a coluna do processo do cliente não tem ordem própria (`H-49`) |
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
  "anomalies": [ { "code": "RG_SEM_DESEMBARACO", "detail": "RG preenchido com categoria em_andamento" } ],
  "pendingEdits": [ { "id": "01J...", "field": "eta2", "value": "2026-08-06", "previous": "2026-08-04", "ts": "..." } ],
  "statusHistory": [ { "ts": "2026-07-30T...", "from": "em_andamento", "to": "desembaracado" } ],
  "daysInCurrentCategory": null
}
```

`anomalies` traz o **texto** da divergência, e não só o código: o critério de
aceite de `H-22` pede a explicação ao lado, e ela nasce em
`describeAnomaly`, no domínio. `ProcessDto.anomalies` continua sendo apenas os
códigos — a tabela da Página Operacional não precisa do texto.

`daysInCurrentCategory` é **`number | null`**, e não `0`. Zero afirma que a
categoria mudou hoje, indistinguível de "não há histórico para saber" — e até
`H-28` gravar o primeiro evento seria sempre zero, mentindo em todos os
processos. Mesmo princípio de `documentaryLeadTime.averageDays` (A-42).

`pendingEdits` fica vazio até `H-23`, `statusHistory` até `H-28`. **Vazio de
verdade**, nunca preenchido com valor de espera.

A REF é resolvida por `normKey`, como TD-06 define a identidade — uma URL em
caixa diferente encontra o mesmo processo. A unicidade está garantida na
ingestão: REF repetida vai para quarentena e não chega ao estado.

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
    "desembaracadosHoje": 0,       // IND-16
    "desembaracadosNoPeriodo": 0   // H-52 — por RG, adicional a desembaracados
  },
  "channelDistribution": {         // H-51 — acompanha IND-06, não o redefine
    "verde": 0,
    "vermelho": 0,
    "indefinido": 0,
    "known": 0,
    "verdeShare": null,
    "vermelhoShare": null
  },
  "rankings": {
    "clients":     [ /* GroupCount[] — grupos com `segments` (H-56) */ ],  // IND-10 e IND-18
    "importers":   [ /* GroupCount[] */ ],  // IND-11 e IND-19
    "agents":      [ /* GroupCount[] com overdueCount */ ], // IND-17
    "goods":       [ /* GroupCount[] */ ],  // IND-13
    "responsible": [ /* GroupCount[] */ ]   // IND-20
  },
  "expectedVessels": [                       // IND-12
    { "vesselKey": "EVER FAIR", "vesselLabel": "EVER FAIR", "eta2": "2026-08-06", "processCount": 0 }
  ],
  "arrivalCalendar": [                       // H-17 — recorte de expectedVessels
    { "eta2": "2026-08-13", "processCount": 0, "vessels": [ /* ExpectedVessel[] */ ] }
  ],
  "documentaryLeadTime": {                   // IND-22 — o agregado
    "averageDays": null,
    "sampleSize": 0,
    "excludedNegative": 0,
    "excludedIncomplete": 0
  },
  "leadTimeByGroup": {                       // H-19 — IND-22 por dimensão
    "clients":     [ /* LeadTimeGroup[] */ ],  // cortada em meta.topN
    "agents":      [ /* LeadTimeGroup[] */ ],  // cortada em meta.topN
    "vessels":     [ /* LeadTimeGroup[] */ ],  // cortada em meta.topN
    "responsible": [ /* LeadTimeGroup[] */ ],  // inteira — 4 chaves fixas (A-28)
    "groupTotals": { "clients": 0, "agents": 0, "vessels": 0, "responsible": 0 }
  },
  "meta": {
    "topN": 10,
    "today": "2026-08-03",
    "timezone": "America/Sao_Paulo",
    "weekEnd": "2026-08-09",
    "bazarShare": null,
    "period": { "from": null, "to": null },          // H-52 — a janela aplicada
    "dataRange": {                                   // H-52 — a faixa real
      "eta2":         { "from": "2025-12-30", "to": "2026-09-09", "missing": 64 },
      "registration": { "from": "2026-01-05", "to": "2026-07-31", "missing": 166 }
    }
  }
}
```

Em `rankings.clients`, um grupo de clientes (`H-55`) entra **no lugar** dos
membros: `count` é a soma e `segments` traz a composição, ordenada como o ranking.
Exibir os dois níveis contaria os mesmos processos duas vezes, e a soma das barras
deixaria de bater com o total. `segments` não aparece em nenhum outro ranking —
grupo é conceito de cliente —, nem em `leadTimeByGroup.clients`, que segue por
cliente (`H-56`).

`documentaryLeadTime.averageDays` é `null` quando `sampleSize` é zero — média
de conjunto vazio não é zero, e apresentá-la como zero seria mentir sobre o
dado (A-42). `bazarShare` acompanha IND-13 para tornar visível a distorção
declarada em A-34.

`counts.desembaracadosNoPeriodo` (`H-52`) é **adicional** a `desembaracados`,
nunca substituto: aquele conta a categoria sobre o recorte de `ETA2`, este conta
a data de **registro** dentro da janela — duas datas, duas perguntas. A soma das
quatro categorias continua fechando com o total, e a linha de conferência de A-12
segue válida. Como todo indicador desta rota, ele responde sobre o conjunto
**filtrado** (RF-18): a janela incide sobre o recorte ativo, não sobre a base.

`meta.period` ecoa a janela que o servidor de fato aplicou, e `meta.dataRange`
traz a faixa real das duas datas **no conjunto filtrado**, com quantos processos
não têm cada uma. Os dois existem para o cartão distinguir zero por recorte de
zero por ausência de dado: derivar a faixa no cliente seria cálculo na tela, e
`missing` está lá porque data ausente não está dentro nem fora de janela nenhuma
(A-20) — some de qualquer recorte por período, e sumir sem contagem seria
descarte silencioso. `from` e `to` são `null` quando nenhum processo do conjunto
tem a data; a tela diz "sem data", nunca uma faixa inventada. Medido em
31/08/2026 sobre a planilha real: 64 dos 649 sem `ETA2`, 166 sem `RG`.

`channelDistribution` (`H-51`) é bloco próprio, e não um campo em `counts`:
`counts.canalVermelho` é IND-06 e continua com o mesmo valor. `known` é
`verde + vermelho` — o denominador das duas frações, escrito ao lado delas —, e
`indefinido` fica **fora** do percentual, contado: a cor daquelas linhas está
ocupada dizendo responsável ou localização do importador, e por isso não diz
canal. `verdeShare` e `vermelhoShare` são `null` quando `known` é zero, pela
mesma razão de `averageDays` (A-42). Medido em 31/08/2026 sobre a planilha
real: 477, 5 e 167, somando as 649 linhas.

`arrivalCalendar` é o calendário da Página Operacional (`H-17`): as chegadas de
**hoje a hoje + 15 dias**, agrupadas por dia e, dentro do dia, por navio. É um
**recorte** de `expectedVessels`, não um indicador novo — IND-12 não tem teto
por definição (A-24) e segue intacto. O teto vem do servidor porque cortar no
cliente seria regra de negócio fora de `src/domain/`. Dia sem chegada não
aparece.

**Ele e `counts.chegando15Dias` respondem perguntas diferentes**, e podem
divergir: o calendário exclui processo sem navio (A-24), IND-09 não. Medido em
07/08/2026 os dois valem **60**, porque nenhum processo da janela está sem
navio — coincidência de dado, não identidade.

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
  "historyStartedAt": "2026-08-17T12:00:00.000Z",
  "stalledCoverageDays": 1,
  "stalledMeasurable": false
}
```

Os seis alertas exigem `category ≠ 'desembaracado'` (A-59). A condição está
explícita apenas em ALE-01 e ALE-02 na especificação, mas vale nos seis: a
página é **fila de trabalho**, e processo concluído não pede ação.

`historyStartedAt` informa desde quando existe histórico, para que a interface
não sugira retroatividade inexistente (A-43). É `string | null` — **instante ISO
completo**, o `ts` do primeiro evento, não `AAAA-MM-DD` —, e vale `null` até a
primeira leitura ser gravada: não há data a informar antes disso, e inventá-la
afirmaria histórico inexistente (A-61).

`stalledCoverageDays` e `stalledMeasurable` existem porque o zero de
`processos_parados` tem dois sentidos opostos, e a interface não pode escolher
entre eles (regra inviolável 6). Com histórico de 3 dias e limiar de 15, nenhum
processo teve tempo de disparar, e exibir `0` afirmaria ausência de problema que
ninguém mediu — `stalledMeasurable` é `false`, e `H-20` exibe **traço**;
`stalledCoverageDays` dá o número que a ressalva da tela cita (A-43).
`stalledMeasurable` vira `true` quando a cobertura alcança o limiar. Servidos
desde `H-29`.

Um processo aparece em `items` uma vez **por tipo** que satisfaz, e ALE-04 está
contido em ALE-05 por construção. O achatamento é do contrato; **`H-20` agrupa
por processo na exibição** (A-60).

| Código | Situação |
|---|---|
| 200 | Sucesso |
| 400 | `FILTRO_INVALIDO` |
| 503 | `ARQUIVO_INDISPONIVEL` |

---

### `GET /api/history/monthly` **[F]**

Série mensal da Página Histórico, derivada de `data/history.jsonl`. Servida
desde `H-28`; a tela que a consome é `H-21`.

| Parâmetro | Tipo | Padrão |
|---|---|---|
| `months` | `number` | `12`. De 1 a 60. Fora da faixa devolve `400 FILTRO_INVALIDO` |

```jsonc
{
  "series": [
    { "month": "2026-08", "total": 0, "desembaracados": 0, "canalVermelho": 0 }
  ],
  "reconstructed": {                          // H-54 — derivada das datas da planilha
    "points": [
      { "month": "2025-12", "chegados": 0, "desembaracados": 0, "forecast": false }
    ],
    "missingEta2": 64,
    "missingRegistration": 166
  },
  "historyStartedAt": "2026-08-03T14:22:31.004Z",
  "truncated": true
}
```

Cada ponto é o **estado ao fim do mês**, não a contagem de eventos dele: um mês
sem evento algum repete os valores do anterior, porque ausência de mudança não é
ausência de processos.

`reconstructed` (`H-54`) é **bloco separado, e nunca somado a `series`**. As duas
têm origem diferente: `series` sai dos eventos que a aplicação observou desde a
primeira execução (ADR-0005), e `reconstructed` sai das datas que a planilha
carrega. Emendá-las numa série só afirmaria continuidade que não existe — que é o
que A-43 proíbe; o que ele proíbe é apresentar reconstrução como histórico
observado, não derivá-la.

As duas medidas de `reconstructed` são **estoque ao fim do mês**, a mesma
grandeza de `series`: `chegados` acumula os processos com `ETA2` até o fim do mês,
e `desembaracados` os com data de registro. **Não há `canalVermelho`** ali — a cor
é o estado de hoje e não carrega data, e projetá-la para trás afirmaria que a
linha já era vermelha naquele mês (regra inviolável 3).

`points` cobre **todo** mês entre a primeira e a última data presente, inclusive
os vazios: mês sem processo repete o acumulado, e não abre buraco. `forecast` é
`true` no mês posterior ao corrente — a data já está na planilha, o mês ainda não
aconteceu; medido em 31/08/2026, 18 processos têm `ETA2` em set/2026.
`missingEta2` e `missingRegistration` contam quem não entra em cada medida: data
ausente não pertence a mês nenhum (A-20), e sumir sem contagem seria descarte
silencioso. Medido: 64 dos 649 sem `ETA2` e 166 sem `RG`.

**`months` não recorta `reconstructed`.** A janela é da série observada; a
reconstruída cobre o intervalo das datas, porque cortá-la pela janela esconderia
justamente o passado que ela existe para mostrar.

`truncated: true` indica que a janela pedida excede o histórico existente — a
série começa quando a aplicação começou, não antes. Sem histórico algum,
`series` é `[]` e `historyStartedAt` é `null`: a Página Histórico precisa
distinguir "ainda não há dado" de "há dado, e ele é zero" (A-43).

**Limite do recorte por filtro.** A rota é marcada **[F]**, mas o evento gravado
carrega apenas `ref` — cliente, navio, agente e ETA vivem na planilha, não no
histórico. Com filtro ativo, os REF são resolvidos contra a **leitura atual**,
então a série recortada descreve o passado dos processos que casam hoje; um
processo cujo navio mudou aparece sob o navio de agora, e um que saiu da planilha
não aparece sob filtro algum. **Sem filtro a série sai inteira do arquivo**, e é
essa forma que é estável no tempo.

---

### `GET /api/filters/options`

Valores disponíveis para cada filtro, derivados do arquivo, não de lista fixa
(RF-19, A-36).

`clients` traz os clientes **consolidados**, rotulados pelo `label` do mapa;
`clientProcesses` traz os valores de célula, com contagem própria. São perguntas
distintas — quem é o cliente, e qual o processo dele —, e por isso duas listas
(`H-49`).

`clientGroups` é o nível de árvore do filtro Cliente (`H-55`): o `count` do
grupo vem de `clientGroupKey`, o de cada membro é o do próprio cliente, e o
`label` do membro — quando o mapa o declara — vence o do cliente. **Os membros
continuam em `clients`**: o grupo é camada do filtro, e nenhum indicador agrupa
por ele. Lista vazia quando o mapa não declara grupo nenhum.

```jsonc
{
  "clients":         [ { "key": "ACME", "label": "ACME", "count": 0 } ],
  "clientGroups":    [ { "key": "ACME-GRUPO", "label": "Acme", "count": 0,
                         "members": [ { "key": "ACME", "label": "Matriz", "count": 0 } ] } ],
  "clientProcesses": [ { "key": "ACME-29", "label": "ACME-29", "count": 0 } ],
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

### `GET /api/config/workbook`

O **inventário da configuração**: o que está configurado, não só o que falta.
**Nunca responde `503`** — é a única rota de leitura que existe justamente para o
estado em que não houve leitura nenhuma.

```jsonc
{
  "workbookPath": "C:\\...\\planilha.xlsx",
  "defined": true,      // há caminho configurado
  "exists": true,       // existe no disco
  "readable": true,     // o painel consegue lê-lo
  "sheetPresent": true, // a aba configurada apareceu na última leitura

  "configFile": { "path": "config/app.json", "present": true, "parseable": true },

  "runtime": {                 // as etapas de partida que o navegador confere
    "nodeVersion": "22.23.2",  // process.versions.node, o real
    "webBuilt": true           // dist/web/index.html existe AGORA
  },

  "fields": [
    { "key": "port", "value": 5173, "source": "arquivo", "restartPending": false },
    { "key": "topN", "value": 10,   "source": "padrao",  "restartPending": false }
    // … os oito campos de config/app.json.exemplo, nessa ordem
  ]
}
```

**Os quatro fatos do caminho são quatro campos**, e não um `ok`/`não ok`:
`defined`, `exists`, `readable` e `sheetPresent`. Agrupá-los perderia justamente
a informação que diz o que fazer em seguida — caminho não configurado, arquivo
que sumiu do OneDrive e arquivo sem permissão levam a três ações diferentes.

`workbookPath` vem **vazio** na primeira execução — ausência de configuração, que
é diferente de caminho configurado e inexistente (`exists: false`).

`sheetPresent` é `null` enquanto **não houve leitura bem-sucedida**, inclusive
quando a última falhou: a presença da aba não é deduzida do caminho, e abrir o
arquivo só para responder isto duplicaria o leitor numa segunda regra.

**`runtime` traz só o que o navegador consegue conferir** (`H-36`). Node
instalado e Node ≥ 22 **não** estão ali: a página é servida *pelo* Node, então
chegar a exibi-la já é a prova das duas, e reportá-las como pendentes seria
impossível por construção. Quem alcança a falha delas é `scripts/iniciar.cmd`, e
não há outra camada.

`webBuilt` é consultado **a cada requisição**, e não na partida — é o que faz o
botão *Atualizar* da tela valer alguma coisa depois de o operador compilar com o
servidor no ar. E é o `index.html` que decide: a pasta existir não basta.

| `source` | Significa |
|---|---|
| `arquivo` | O campo está declarado em `config/app.json` |
| `padrao` | Não está declarado; o padrão de `src/app/config.ts` foi aplicado |
| `ausente` | Só `workbookPath`: é o único dos oito **sem** padrão |
| `desconhecida` | O arquivo existe e não pôde ser lido agora (`parseable: false`) |

**`arquivo` e `padrao` existem para separar duas situações que mostram o mesmo
número.** `port: 5173` declarado e `port: 5173` omitido são visualmente
idênticos e significam coisas diferentes — uma foi decidida por alguém. É a regra
inviolável 3 aplicada à própria configuração.

`value` é o valor **efetivo**, o que a aplicação está usando agora;
`restartPending` diz que o arquivo declara outro, que só passa a valer no próximo
início. Apenas `workbookPath` é trocável com o processo no ar (`H-34`).

`config/app.json` **ausente não é erro** desde `H-34`: os padrões valem, a
aplicação sobe e o operador resolve por esta tela — `scripts/iniciar.cmd` deixou
de barrar a partida por causa dele em `H-35`.

### `PUT /api/config/workbook`

Aponta a aplicação para outra planilha, **com o processo no ar**: grava o caminho
em `config/app.json`, relê e passa a observar o diretório novo. É a saída de
`PD-01` — o operador nunca edita JSON à mão.

Corpo: `{ "path": "C:\\...\\planilha.xlsx" }`

Resposta `200`: **o corpo de `GET /api/health`**, já com a leitura nova.

| Código | Situação |
|---|---|
| 200 | Caminho gravado e planilha relida |
| 400 | `CAMINHO_INVALIDO` — não é `.xlsx`, não existe, é pasta, ou sem permissão de leitura |
| 400 | `CONFIG_NAO_GRAVAVEL` — `config/app.json` somente-leitura |

**A conferência acontece antes da gravação**, e é por isso que uma tentativa
falha nunca derruba o caminho que funcionava.

**O `path` é aceito como o Explorer do Windows o entrega**: espaço em volta e um
par de aspas duplas envolvendo o texto inteiro são removidos antes da
conferência. "Copiar como caminho" — a única forma de copiar um caminho sem
digitá-lo — sempre acrescenta as aspas, e `"` é caractere proibido em nome de
arquivo no Windows, então um par envolvente nunca faz parte do nome. Sem isso, o
caminho colado chegava com a extensão valendo `.xlsx"` e a resposta era
`CAMINHO_INVALIDO` dizendo que o arquivo precisa ser `.xlsx` — sobre um arquivo
que é. Medido na primeira instalação em Windows (`PD-06`).

**Uma planilha válida sem a aba em escopo é aceita**, e a aplicação entra em
`degradado` com a razão. Recusar aqui esconderia do operador o motivo real — a
regra é a mesma da leitura: buraco visível, nunca valor errado invisível.

---

### `POST /api/config/workbook/browse`

Abre o **seletor de arquivos do sistema** na máquina onde o processo roda — que
é a do operador (RNF-29: só loopback) — e devolve o caminho escolhido. `H-37`.

Sem corpo.

| Código | Corpo | Situação |
|---|---|---|
| 200 | `{ "path": "C:\\…\\planilha.xlsx" }` | O operador escolheu |
| 200 | `{ "path": null }` | O operador cancelou |
| 501 | `SELETOR_INDISPONIVEL` | Esta máquina não abre diálogo — não é Windows, ou não tem `powershell.exe` |
| 500 | `SELETOR_FALHOU` | O diálogo abriu e terminou mal |

**`POST`, e não `GET`:** abre uma janela na máquina, o que é efeito — não
leitura. E **não grava nada**: `PUT /api/config/workbook` continua sendo a única
porta de gravação, com a conferência de `checkWorkbookPath` inteira. O operador
vê o que escolheu antes de trocar a planilha da empresa.

**Cancelar responde 200, não erro.** É uma escolha, e o desfecho mais comum
depois do acerto; um código de erro faria a tela acusar problema onde o operador
só mudou de ideia.

**`501` não é falha, é ausência de recurso.** A saída do operador é digitar o
caminho — o campo de texto continua sendo via de primeira classe, e é a única na
máquina de desenvolvimento, que é Linux.

> **O caminho volta do PowerShell em base64 de UTF-8.** O console do Windows do
> operador está em code page 850 e o caminho do OneDrive corporativo tem acento
> por natureza; transportar bytes tira a code page da conta. A conferência de ida
> e volta rejeita saída que não seja base64 — `Buffer.from(…, 'base64')` decodifica
> lixo em silêncio, e um aviso escrito no stdout viraria um caminho inventado.

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
`importerOutsideRj`) são editáveis pela rota dedicada abaixo, e **não** por
`POST /api/edits`: eles não têm coluna própria, e a gravação é troca de estilo
da linha, não de valor de célula (`H-27`).

---

### `POST /api/edits`

Enfileira uma edição. **Não toca no `.xlsx`.**

```jsonc
{ "ref": "FT533.26", "field": "eta2", "value": "2026-08-06" }
```

```jsonc
{
  "id": "9f1c2a7e-...",   // crypto.randomUUID()
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
| 409 | `ESCRITA_EM_ANDAMENTO` — uma aplicação está em curso |
| 503 | `ARQUIVO_INDISPONIVEL` — nunca houve leitura, não há processo a editar |

> As quatro rotas que ESCREVEM na fila — `POST /api/edits`,
> `DELETE /api/edits/:id`, `DELETE /api/edits` e
> `PATCH /api/processes/:ref/color` — recusam com `409 ESCRITA_EM_ANDAMENTO`
> enquanto uma aplicacao estiver em curso. Mexer na fila nesse intervalo a
> faria sumir sem ser gravada: o `write-guard` tira o instantaneo do que vai
> gravar no inicio e arquiva o arquivo inteiro no fim. `GET /api/edits`
> continua servindo — ler nao mexe na fila.

---

### `GET /api/color-options`

As combinações que a aplicação sabe **gravar**, na ordem do mapa. É o menu do
formulário de cor.

```jsonc
{ "options": [
    { "label": "Verde (tom A)", "responsible": "indefinido",
      "customsChannel": "nenhum", "importerOutsideRj": false }
] }
```

Existe porque a alternativa é a interface carregar uma cópia das combinações —
e uma segunda lista diverge de `config/color-map.json` no primeiro ajuste,
oferecendo ao operador uma cor que a escrita não grava. Sempre `200`: mapa vazio
devolve `options: []`, e o formulário diz que não há cor configurada.

---

### `PATCH /api/processes/:ref/color`

Enfileira alteração dos campos codificados em cor. Os três são gravados como
**uma única** mudança de estilo da linha, porque compartilham a mesma
célula-âncora.

```jsonc
{ "responsible": "colaborador2", "customsChannel": "nenhum", "importerOutsideRj": false }
```

A combinação enviada precisa corresponder a **pelo menos uma** entrada de
`config/color-map.json`; caso contrário → `400 CORPO_INVALIDO` com a lista de
combinações representáveis. Isso decorre de A-31: a cor codifica dimensões
concorrentes, e nem toda combinação é representável.

**Quando mais de uma entrada casa, o alvo é a primeira na ordem do arquivo** —
o tom canônico. As entradas do mapa real (medido em `H-01`, 03/08/2026) não são
uma bijeção com as combinações: `indefinido/nenhum/false` casa com verde tom A,
verde tom B e branco; `colaborador2/nenhum/false` casa com os dois roxos.
Exigir correspondência única recusaria três das nove entradas, entre elas o
verde, que cobre 477 das 649 linhas. A regra do tom canônico é a mesma que o
caso-limite de `H-27` já fixa para a linha verde tom B repintada de verde.

**Consequência, e ela é visível ao operador:** as combinações representáveis são
**seis**, e cada uma grava uma cor só. Branco e os tons B são **legíveis, não
graváveis** — a interface oferece as seis, rotuladas pela cor que de fato será
gravada, em vez de deixar o operador escolher um alvo que a aplicação não
escreve.

| `responsible` | `customsChannel` | `importerOutsideRj` | Cor gravada | `fillId` |
|---|---|---|---|---|
| `indefinido` | `nenhum` | `false` | Verde (tom A) | 2 |
| `colaborador1` | `nenhum` | `false` | Azul | 8 |
| `colaborador2` | `nenhum` | `false` | Roxo (tom A) | 27 |
| `colaborador1_outros_clientes` | `nenhum` | `false` | Bege | 9 |
| `indefinido` | `vermelho` | `false` | Vermelho | 7 |
| `indefinido` | `nenhum` | `true` | Amarelo forte | 10 |

A tabela é **derivada** de `config/color-map.json`, não uma segunda fonte: o
`fillId` vem da entrada, e mudar o mapa muda o que a rota aceita.

> **Entrada do mapa sem `fillId` não chega a esta rota.** O backlog previa `400`
> para esse caso; `loadColorMap` o rejeita na **partida** — `fillId` obrigatório,
> inteiro, não negativo —, e o processo não sobe. Documentar aqui um `400` que o
> servidor não emite seria afirmar resposta que o código não produz.

| Código | Situação |
|---|---|
| 201 | Enfileirada |
| 400 | `CORPO_INVALIDO` — combinação sem cor correspondente |
| 404 | `PROCESSO_NAO_ENCONTRADO` |
| 409 | `ESCRITA_EM_ANDAMENTO` — uma aplicação está em curso |
| 503 | `ARQUIVO_INDISPONIVEL` — nunca houve leitura, não há processo a editar |

---

### `GET /api/edits`

```jsonc
{ "items": [ /* edições consolidadas */ ], "count": 0 }
```

A fila tem **dois** tipos de item, distinguidos por `kind`. Uma edição de campo
é consolidada por `(ref, field)`; uma de cor, por `ref` — a linha tem uma cor
só, então a última escolha vence.

```jsonc
{ "kind": "field", "id": "…", "ref": "FT533.26", "sourceRow": 483,
  "field": "eta2", "value": "2026-08-06", "previous": "2026-08-04", "ts": "…" }

{ "kind": "color", "id": "…", "ref": "FT533.26", "sourceRow": 483,
  "target": { "responsible": "colaborador2", "customsChannel": "nenhum",
              "importerOutsideRj": false },
  "label": "Roxo (tom A)", "previousLabel": "Verde (tom A)",
  "previousStyleKey": "argb:FF00FF00", "ts": "…" }
```

`kind` ausente vale `"field"`: a fila é append-only em disco e sobrevive ao
reinício, então os registros gravados antes de `H-27` continuam válidos sem
migração.

---

### `DELETE /api/edits/:id`

Descarta uma edição enfileirada.

| Código | Situação |
|---|---|
| 204 | Descartada |
| 404 | `EDICAO_NAO_ENCONTRADA` |
| 409 | `ESCRITA_EM_ANDAMENTO` |

---

### `DELETE /api/edits`

Descarta **todas** as edições enfileiradas.

```jsonc
{ "discarded": 0 }
```

| Código | Situação |
|---|---|
| 200 | Descartadas |
| 409 | `ESCRITA_EM_ANDAMENTO` |

---

### `POST /api/edits/apply`

Grava a fila no `.xlsx`, executando a sequência de defesas de `04-arquitetura.md §3.2`.

A rota **só traduz** `WriteResult` em código HTTP: não lê a planilha, não mexe
na fila e não decide se pode gravar. Toda a decisão vive em
`src/app/write-guard.ts` (regra inviolável 6).

Corpo: vazio.

**200 — sucesso:**

```jsonc
{
  "applied": 0,
  "cellsWritten": 0,
  "rowsRepainted": 0,
  "backupPath": "data/backups/planilha-20260803-143512.xlsx",
  "archivedQueuePath": "data/applied/pending-edits-20260803-143512.jsonl",
  "durationMs": 0,
  "validated": true
}
```

> **`rowsRepainted` entrou em `H-27`** e é contado **à parte** de
> `cellsWritten`, nunca somado a ele: uma troca de cor toca 12 células (A-44)
> sem gravar valor algum, e somá-las diria ao operador que ele gravou doze
> coisas quando mudou a cor de uma linha. `cellsWritten` conta células que
> receberam **valor**; `rowsRepainted`, linhas em que ao menos uma célula mudou
> de estilo — **medido pela cirurgia**, não pedido pela fila.
>
> **`applied` maior que zero com as duas contagens em zero é desfecho válido**,
> e não erro: a fila resolvia para o que a planilha já tinha. Nesse caso
> `backupPath` é `null` e nada foi gravado — ver a emenda de `H-27` em
> `04-arquitetura.md §3.2`. A interface diz "a planilha já estava assim", em vez
> de afirmar uma gravação que não houve.

> `archivedQueuePath` entrou em `H-26`, fora do contrato fixado de `H-25`, junto
> com `expectedHash` e `actualHash`. **`null` no 200 significa que a planilha foi
> gravada e validada, mas a fila não foi arquivada** — por falha ao movê-la
> (qualquer erro de `mkdir`, `rename` ou `write`; no Windows, tipicamente o
> `.jsonl` segurado pelo OneDrive ou pelo antivírus), ou porque o arquivo de
> fila já não existia. A escrita não é desfeita em nenhum dos dois: o arquivo em
> disco está correto, e mandar o operador restaurar um backup já obsoleto seria
> pior. A interface avisa que a fila pode ter ficado para trás e precisa ser
> conferida. O log distingue os dois casos em `queue.archived`; a resposta, não.
>
> `validated` **não** existe em `WriteResult`: a rota o deriva de `ok === true`.
> Um segundo campo dizendo o mesmo seria ruído que pode divergir.
>
> **Emenda de `H-27` (17/08/2026).** Esta nota dizia "se a resposta é 200, a
> validação passou". Deixou de ser exata no ramo em que nada foi gravado: não se
> valida o que não se escreveu, e ali `validated: true` afirma que **o arquivo
> em disco corresponde ao que a fila pedia** — que é verdade, e é o que o campo
> sempre significou para o operador. O que ele não afirma mais é que houve uma
> releitura de conferência. `backupPath: null` e `cellsWritten` e
> `rowsRepainted` em zero distinguem o caso.

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

**409 `EDICAO_OBSOLETA` — o arquivo não mudou, a edição envelheceu:**

```jsonc
{
  "error": {
    "code": "EDICAO_OBSOLETA",
    "message": "O valor mudou desde que você editou. As edições foram preservadas.",
    "detail": {
      "conflicts": [
        { "ref": "FT533.26", "field": "eta2",
          "valueWhenEdited": "2026-08-04", "valueNow": "2026-08-05", "yourValue": "2026-08-06" }
      ]
    }
  }
}
```

> **Código próprio, acrescentado em `H-25`.** O contrato fixado no backlog tinha
> cinco recusas, e `ARQUIVO_MUDOU` cobria as duas situações. São diferentes: aqui
> os dois hashes **conferem**, e reler a planilha — que é o que `ARQUIVO_MUDOU`
> instrui — não muda nada. Sem a separação o corpo do 409 sairia dizendo que a
> planilha mudou e provando o contrário na mesma resposta.
>
> A recusa acontece quando o valor atual de qualquer campo da fila difere do
> `valueWhenEdited` registrado no enfileiramento, **mesmo com o hash conferindo**:
> alteração de terceiro seguida de releitura automática deixa o hash em dia, e a
> gravação passaria por cima dela em silêncio. Uma única edição obsoleta recusa a
> fila inteira — aplicação parcial deixaria o operador sem saber o que foi gravado.

`conflicts` ganha `"refMissing": true` quando a `ref` não está mais no arquivo.
Sem essa marca, `valueNow: ""` afirmaria que a célula está vazia, quando a linha
inteira desapareceu (regra inviolável 3).

**Conflito de cor** sai com `"field": "cor"`, e os três valores são o **rótulo**
da cor, não conteúdo de célula — `"Verde (tom A)"`, `"Roxo (tom A)"`. A troca de
cor não altera valor nenhum, então descrevê-la como valor mentiria sobre o que
mudou. Ela envelhece pelo mesmo motivo que a de campo: alguém repintou a linha no
Excel desde que o operador escolheu.

```jsonc
{ "ref": "FT533.26", "field": "cor",
  "valueWhenEdited": "Verde (tom A)", "valueNow": "Vermelho", "yourValue": "Roxo (tom A)" }
```

> **A linha que sumiu chega pelos dois códigos.** Se uma releitura já pousou
> quando o operador aplica, o hash confere e a recusa é `EDICAO_OBSOLETA`; se
> não pousou, o hash diverge e é `ARQUIVO_MUDOU`. O mesmo fato físico, dois
> códigos, conforme o instante.
>
> **A interface decide em duas etapas, nesta ordem.** Primeiro por
> `conflicts.length`: **vazio não é diálogo de conflito**, é a mensagem do
> código. Abrir a tabela sem linhas deixaria o operador com um diálogo em
> branco.
>
> `ARQUIVO_MUDOU` sai com `conflicts: []` sempre que a mudança não alcançou
> nenhuma célula da fila — inclusive no caso mais comum de todos, o de alguém
> ter salvado a planilha entre a última leitura e a aplicação. **A resposta não
> diz qual das duas conferências de hash recusou, e não precisa:** a instrução
> ao operador é a mesma, releia a planilha.
>
> Só depois, com `conflicts` preenchido, cada linha decide por `refMissing` —
> **nunca pelo código**, que não distingue linha removida de valor alterado.

A fila **não** é descartada em nenhum caminho de erro. O operador relê e decide.

| Código | Situação |
|---|---|
| 200 | Gravado e validado |
| 409 | `EXCEL_ABERTO` · `ARQUIVO_MUDOU` · `EDICAO_OBSOLETA` · `NADA_A_APLICAR` · `ESCRITA_EM_ANDAMENTO` |
| 500 | `ESCRITA_INVALIDA` — três desfechos, distinguidos pelo `detail`; ver a nota abaixo |
| 503 | `ARQUIVO_INDISPONIVEL` |

> `ESCRITA_INVALIDA` cobre desfechos **opostos**, e a presença de `backupPath` no
> `detail` é o que os separa:
>
> | `detail` | O que aconteceu com o arquivo | O que o operador faz |
> |---|---|---|
> | ausente | Nada foi gravado — somente-leitura, aba diferente da lida, fila inadmissível, backup que falhou, ou cirurgia que abortou | Corrige a causa e aplica de novo |
> | `restored: true` + `backupPath` | Gravou, a conferência reprovou, e o backup **foi reposto** | Nada; a planilha está como antes |
> | `restored: false` + `backupPath` | Gravou, a conferência reprovou, e a restauração **também falhou** | **Repõe o arquivo à mão** a partir do backup |
>
> A terceira linha é a mais grave e a menos óbvia: `restored: false` aparece
> **também** quando nada foi gravado, e a rota não consegue distinguir os dois
> casos por ele. Quem decide é o guard, por `WriteResult.fileState`
> (`intacto` · `gravado` · `restaurado` · `incerto`) — inferir o estado do arquivo na rota
> seria decidir sobre a planilha fora do write-guard (regra inviolável 6).
> Levantado pelo `revisor-xml` em `H-26`, sobre uma primeira versão que omitia o
> caminho do backup exatamente no desfecho em que ele é a única saída.
>
> **A interface nunca afirma o que não sabe.** Quando o `fetch` rejeita, o
> cliente não tem como saber se a gravação chegou a acontecer, e a mensagem diz
> isso em vez de garantir que nada foi gravado (regra inviolável 3).

---

## 4. Rota estática

### `GET /*`

Serve a SPA compilada, em **`dist/web`** — o `outDir` declarado em
`web/vite.config.ts`. Qualquer caminho não iniciado por `/api/` devolve
`index.html`, para que o roteamento do cliente funcione em recarga direta de
URL. Servida desde `H-30`.

> O documento dizia `web/dist` até 18/08/2026, invertido em relação ao que o
> Vite escreve. Nada dependia da frase enquanto a rota não existia.

**Caminho fora do mapa da casca responde igual** — `/relatorios` recebe o mesmo
`index.html`, e quem exibe "página não encontrada" é o cliente. O servidor não
conhece as rotas dele, e passar a conhecê-las duplicaria o mapa de
`web/src/router.ts`.

`GET /api/…` inexistente **não** cai aqui: segue com o `404` do Fastify. Sem
essa exceção, um erro de digitação na URL de API devolveria o HTML da casca com
`200`, e o diagnóstico apontaria para o cliente.

| Código | Situação |
|---|---|
| 200 | `index.html`, ou o arquivo pedido quando ele existe em `dist/web` |
| 503 | `dist/web` inexistente — página em pt-br dizendo que falta rodar o `build`, e não `404` cru |

O `503` é **HTML, não o envelope de erro de §1.2**: quem lê é o operador num
navegador, e JSON técnico ali seria tela em branco. A pasta é consultada por
requisição, então rodar o `build` com o servidor no ar dispensa reiniciá-lo.

> **A frase acima valia só para o `index.html` até 21/08/2026**, e a metade que
> faltava era justamente a que o operador vê. Os arquivos vinham do
> `@fastify/static` com `wildcard: false`, que enumera o diretório **uma vez, no
> registro** — a documentação do plugin avisa que ele "will not serve newly
> added files". Dois caminhos rotineiros davam a mesma tela branca, sem erro
> nenhum: servidor no ar antes de `dist/web` existir, e recompilação com o
> servidor no ar, que troca o hash dos nomes. Em ambos o `index.html` era
> servido e apontava para arquivos que caíam no próprio `/*`, devolvendo HTML
> onde o navegador esperava JavaScript. Corrigido em `H-42`, servindo os
> arquivos à mão: o plugin saiu do projeto, e cada requisição passa a consultar
> o disco. O teste que afirmava cobrir o caso media apenas o HTML.

---

## 5. Mapa rota → história

| Rota | Histórias |
|---|---|
| `GET /api/health` | H-02, H-31, H-32, H-15 |
| `GET /api/processes` | H-17, H-49 |
| `GET /api/processes/:ref` | H-22 |
| `GET /api/indicators` | H-09, H-10, H-11, H-12, H-13, H-16, H-17, H-49, H-56 |
| `GET /api/alerts` | H-14, H-29 |
| `GET /api/history/monthly` | H-21, H-28 |
| `GET /api/filters/options` | H-15, H-49, H-55 |
| `GET /api/quarantine` | H-07 |
| `POST /api/reload` | H-08 |
| `POST /api/edits`, `GET`, `DELETE` | H-23 |
| `GET /api/color-options`, `PATCH /api/processes/:ref/color` | H-27 |
| `POST /api/edits/apply` | H-26 |
| `GET /*` (rota estática) | H-30 |

> `GET /*` ficou **sem dono até 07/08/2026** — especificada em §4 e ausente
> deste mapa (A-63). Ela é de `H-30`, que é quando `dist/web` existe na máquina
> do operador. Até lá o fallback de SPA do Vite cobre `npm run dev`, e recarga
> direta de URL em produção não é exercível.
