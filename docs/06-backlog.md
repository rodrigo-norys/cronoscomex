# 06 — Backlog Executável

Toda história é uma **fatia vertical**: entrega comportamento observável ponta
a ponta. Nenhuma história é "criar a camada X".

**Tamanho** (critério objetivo): **P** = até 3 arquivos e nenhum contrato novo ·
**M** = até 8 arquivos ou 1 contrato novo · **G** = acima disso.

Nenhuma história contém verbo de decisão em aberto. Onde houver alternativa,
ela já foi decidida — em ADR ou nas tabelas de decisão de `03-modelo-dados.md`.

---

## Épico E1 — Fundação e perfilamento

### H-01 — Perfilar a planilha real e emitir relatório de estrutura

> ✅ **CONCLUÍDA em 03/08/2026.** Implementada em `tools/profile_workbook.py`
> (Python stdlib, sem dependências). Resultado em
> [`docs/perfilamento/RESULTADO.md`](perfilamento/RESULTADO.md) e no JSON
> sanitizado ao lado. Premissas P-01 a P-07 resolvidas; RNF-01 e RNF-03 a
> RNF-07 passaram a origem `medido`; achados A-46 a A-55 registrados.
>
> A especificação original desta história previa TypeScript em
> `src/profiling/`. Foi implementada em Python por ser executável de imediato,
> antes de existir projeto Node. Reimplementar em TypeScript **não é
> necessário**: o perfilamento é uma tarefa de uma vez, e a ferramenta fica
> versionada em `tools/` para reexecução na virada de ano.

**Objetivo:** produzir, por execução de código sobre o arquivo verdadeiro, os
fatos que hoje são premissas — colunas, tipos de data, cores em uso e volume.

**Arquivos:**
- `src/profiling/profile-workbook.ts` (novo)
- `src/io/xlsx-reader.ts` (novo, versão mínima de leitura)
- `package.json` (script `profile`)

**Contrato fixado:**

```ts
// src/profiling/profile-workbook.ts
export interface WorkbookProfile {
  filePath: string
  fileSizeBytes: number
  sheets: { name: string; rowCount: number; columnCount: number }[]
  headerRow: number
  columns: {
    letter: string          // 'A'..'P'
    header: string          // texto do cabeçalho, '' se vazio
    hidden: boolean         // resolve P-01
    widthChars: number | null
    nonEmptyCount: number
    emptyRatio: number      // 0..1
    valueTypes: Record<'string'|'number'|'date'|'formula'|'null', number>
    sampleValues: string[]  // até 20, distintos
    distinctCount: number
  }[]
  dateColumns: {
    letter: string
    excelDateCount: number      // células tipo Date/serial — P-03 confirmada
    textWithYearCount: number
    textWithoutYearCount: number // P-03 refutada; risco R-02 materializado
  }[]
  styleKeys: { styleKey: string; styleId: number; rowCount: number; sampleRows: number[] }[]
  refColumn: { total: number; empty: number; duplicates: { ref: string; rows: number[] }[] }
  statusValues: { normalized: string; raw: string; count: number }[]
  generatedAt: string
}

export async function profileWorkbook(filePath: string): Promise<WorkbookProfile>
```

Executável por `npm run profile -- "<caminho do .xlsx>"`, gravando
`docs/perfilamento-<AAAAMMDD>.json` e um resumo em Markdown ao lado.

**Critérios de aceite:**
- **Dado** o `.xlsx` real, **quando** `npm run profile` roda, **então** o JSON é
  gravado com uma entrada por coluna de A até a última coluna com cabeçalho ou
  dado.
- **Dado** que a coluna E está oculta ou colapsada, **quando** o perfil é
  gerado, **então** `columns[E].hidden` é `true` e `columns[E].header` traz o
  texto real do cabeçalho, resolvendo **P-01**.
- **Dado** que existe uma coluna P não documentada, **quando** o perfil é
  gerado, **então** `columns[P].header` e `sampleValues` permitem identificá-la,
  resolvendo **P-02**.
- **Dado** as colunas I, K e O, **quando** o perfil é gerado, **então**
  `dateColumns` informa quantas células são data do Excel e quantas são texto
  sem ano, resolvendo **P-03**.
- **Dado** as cores em uso, **quando** o perfil é gerado, **então** `styleKeys`
  lista cada chave distinta com seu `styleId` e a contagem de linhas,
  fornecendo os valores reais para `config/color-map.json` (P-06).
- **Dado** o perfil concluído, **quando** `02-requisitos.md` é atualizado,
  **então** RNF-01 a RNF-07 deixam de estar pendentes e passam a ter origem
  `medido`.

**Casos-limite:**
- Coluna com largura zero → `hidden: true`, `widthChars: 0`.
- Célula de data como texto `"29/jul"` → conta em `textWithoutYearCount`.
- Célula `"OK 23/07"` na coluna N → conta em `valueTypes.string`, não em data.
- Duas linhas com `FT498.26` e `ft498.26 ` → uma entrada em `duplicates` com os
  dois números de linha.
- Arquivo protegido por senha → falha com mensagem explícita citando P-12.
- Linha totalmente vazia no meio da planilha → não conta em `nonEmptyCount` de
  nenhuma coluna.

**Dependências:** nenhuma. É a primeira história.
**Tamanho:** M

---

### H-02 — Levantar o esqueleto do projeto com servidor, interface e testes

> ✅ **CONCLUÍDA em 03/08/2026.** `npm run verify` passa inteiro: lint,
> typecheck, 12 testes, build. A regra de fronteira quebra a build (validada
> com arquivo de violação proposital). O servidor escuta apenas em
> `127.0.0.1:5173`, confirmado por `ss`. Os três casos-limite saem com código 1.
>
> **Desvios do plano, todos registrados:** ferramenta de lint era lacuna e
> virou D-13 (Biome 2.5.6); Node fixado em 22.23.2 por D-14;
> `@vitejs/plugin-react` teve de subir de 5.1.2 para **6.0.5** (5.1.2 não
> aceita Vite 8 — versão que eu havia fixado sem verificar);
> `@fastify/static` de 8.3.0 para **10.1.2** pelo mesmo motivo. O `.gitignore`
> já existia desde a geração das fixtures.

**Objetivo:** ter `npm run dev` subindo servidor e interface, e `npm test`
executando a suíte, sobre um projeto com a regra de dependência aplicada.

**Arquivos:**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- `src/http/server.ts`, `src/app/config.ts`
- `web/index.html`, `web/src/main.tsx`, `web/vite.config.ts`
- `config/app.json.exemplo`
- `tests/domain/.gitkeep`

**Contrato fixado:**

```ts
// src/app/config.ts
export interface AppConfig {
  workbookPath: string
  sheetName: string | null
  headerRow: number
  firstDataRow: number
  port: number
  stalledDaysThreshold: number
  topN: number
  timezone: string
}
export function loadConfig(path?: string): AppConfig  // lança se workbookPath não existir
```

Rota `GET /api/health` conforme `05-contratos-api.md`, devolvendo
`state: "partindo"` enquanto não houver leitura.

Versões exatas, verificadas em 03/08/2026: `fastify@5.11.2`,
`typescript@7.0.2`, `vitest@4.1.10`, `react@19.2.8`, `vite@8.2.0`,
`tailwindcss@4.3.3`, `recharts@3.10.1`, `exceljs@4.4.0`, `fflate@0.8.3`,
`chokidar@5.0.0`. Node 22.x LTS.

**Critérios de aceite:**
- **Dado** o repositório recém-clonado, **quando** `npm install && npm run dev`
  roda, **então** o servidor responde `200` em
  `http://127.0.0.1:5173/api/health`.
- **Dado** o servidor no ar, **quando** uma requisição chega de um endereço que
  não seja `127.0.0.1`, **então** a conexão não é aceita, porque o servidor faz
  `listen` apenas no loopback (RNF-29).
- **Dado** `npm test`, **quando** executado sem nenhum teste escrito, **então**
  termina com código de saída 0.
- **Dado** um arquivo em `src/domain/`, **quando** ele importa qualquer módulo
  de `src/io/`, `src/app/` ou `src/http/`, **então** o lint falha a build
  (regra de fronteira do ADR-0006).
- **Dado** que `typescript@7.0.2` não compile o projeto, **então** a versão é
  fixada em `5.9.3`, registrada no `package.json`, e o gatilho fica anotado em
  R-07. Não há avaliação a fazer: o critério é a build passar.

**Casos-limite:**
- `config/app.json` ausente → mensagem citando `config/app.json.exemplo` e saída
  com código 1.
- `workbookPath` apontando para caminho inexistente → erro na partida, não em
  tempo de requisição.
- Porta 5173 ocupada → mensagem indicando a porta e saída com código 1.

**Dependências:** nenhuma.
**Tamanho:** M

---

## Épico E2 — Leitura da planilha e normalização

### H-03 — Ler a planilha e expor as linhas cruas com a célula-âncora de estilo

> ✅ **CONCLUÍDA em 03/08/2026.** 23 testes próprios; suíte total em 35.
> Validada contra o **arquivo real**: 649 linhas com REF (bate com `H-01`),
> **9 chaves de estilo, cobertura 100%**, 585 células de data em ETA2 (bate
> com `H-01`). Parse em **104 ms** e **117 MB** de RSS — folga de 96× sobre
> RNF-13 e 4× sobre RNF-16.
>
> **Divergências resolvidas:** a regra inviolável 10 era inatingível e foi
> reformulada (D-15); `extractStyleKey` normaliza `tint` ausente para `0.0000`
> — sem isso a linha branca cairia em `COR_NAO_MAPEADA`; e os tipos do ExcelJS
> não declaram `name` em `WorksheetReader`, resolvido com cast documentado
> (R-09).

**Objetivo:** transformar o `.xlsx` em uma lista de linhas cruas com o valor de
cada coluna e a chave de estilo da coluna A.

**Arquivos:**
- `src/io/xlsx-reader.ts`
- `src/io/style-extractor.ts`
- `tests/io/xlsx-reader.test.ts`
- `tests/fixtures/basico.xlsx`

**Contrato fixado:**

```ts
// src/io/xlsx-reader.ts
export interface RawCell { value: string | number | Date | null; type: 'string'|'number'|'date'|'formula'|'null' }
export interface RawRow { sourceRow: number; cells: Record<string, RawCell>; styleKey: string }
export interface ReadResult {
  rows: RawRow[]; fileHash: string; readAt: Date
  sheetName: string
  sheetPath: string   // ex.: 'xl/worksheets/sheet1.xml' — consumido por H-24
}

export async function readWorkbook(config: AppConfig): Promise<ReadResult>

// src/io/style-extractor.ts
export function extractStyleKey(cell: unknown): string   // TD-05
```

`cells` é indexado por letra de coluna (`'A'`..`'P'`). `fileHash` é
`sha256:<hex>` do conteúdo binário.

**Critérios de aceite:**
- **Dado** `tests/fixtures/basico.xlsx` com 3 linhas de dados, **quando**
  `readWorkbook` roda, **então** `rows.length === 3` e `rows[0].sourceRow === 2`
  (a linha 1 é cabeçalho).
- **Dado** uma célula com `fill.fgColor.argb = 'FF00B050'`, **quando**
  `extractStyleKey` roda, **então** devolve `"argb:FF00B050"`.
- **Dado** uma célula com `fill.fgColor = { theme: 4, tint: -0.249977111117893 }`,
  **então** devolve `"theme:4|tint:-0.2500"`.
- **Dado** uma célula sem preenchimento, **então** devolve `"none"`.
- **Dado** o mesmo arquivo lido duas vezes sem alteração, **então** `fileHash`
  é idêntico.
- **Dado** `config.sheetName = "2026"`, **então** apenas essa aba é lida, e
  `sheetPath` é o caminho dela dentro do zip, resolvido por `xl/workbook.xml`
  cruzado com `xl/_rels/workbook.xml.rels` — nunca presumido como
  `sheet1.xml`, porque o nome do arquivo interno não acompanha a ordem das abas.
- **Dado** que o arquivo tem 4 abas (medido em `H-01`), **então** as abas
  `2025`, `2024` e `CNPJ` são **ignoradas por completo** — não lidas, não
  contadas, não registradas em log. A aba `CNPJ` contém credenciais em texto
  claro (A-47), e lê-la seria carregá-las em memória sem necessidade.
- **Dado** `config.sheetName` apontando para aba inexistente, **então** a
  partida falha com mensagem listando os nomes de aba disponíveis.

**Casos-limite:**
- `fill.type === 'gradient'` → `"none"`, porque o dicionário de cores da
  especificação só contempla preenchimento sólido.
- `fill.pattern === 'none'` → `"none"`.
- `fill.fgColor = { indexed: 43 }` → `"indexed:43"`.
- `tint` com muitas casas decimais → arredondado a 4 casas, garantindo chave
  estável entre leituras.
- Linha em branco entre linhas de dados → devolvida com todas as células
  `null`; o descarte é decidido em `H-06`, não aqui.
- Célula de fórmula com resultado de data → `type: 'date'`, `value` = resultado.

**Dependências:** H-02
**Tamanho:** M

---

### H-04 — Traduzir a chave de estilo em responsável, canal e localização do importador

> ✅ **CONCLUÍDA em 03/08/2026.** 28 testes próprios; suíte total em 63.
> Primeira história de `src/domain/` — função pura, sem I/O, com o carregador
> em `src/app/color-map-loader.ts` pela regra de fronteira.
>
> Validada contra o **arquivo real**: 649 linhas, **0 não mapeadas**. Produz
> IND-20 (Colaborador 1 120 · Colaborador 2 36 · Colaborador 1-outros 9 · indefinido 484),
> IND-06 (5 em Canal Vermelho) e 1 importador fora do RJ.
>
> **Divergência resolvida:** `ColorMapEntry` usa **`fillId`**, não `styleId` —
> propagação do achado A-49.
>
> **O número que confirma A-31 e R-02:** 484 das 649 linhas ficam com
> `responsible: indefinido`, porque estão pintadas de verde ou vermelho. A cor
> codifica dimensões concorrentes e uma linha só tem uma cor — o ranking por
> responsável cobre 165 processos, não 649. Limitação da origem do dado, não do
> código, e a contingência continua sendo criar a coluna `RESPONSÁVEL` em texto.

**Objetivo:** materializar em campos explícitos as três regras de negócio que
hoje só existem como cor.

**Arquivos:**
- `src/domain/color-mapper.ts`
- `config/color-map.json`
- `tests/domain/color-mapper.test.ts`

**Contrato fixado:**

```ts
// src/domain/color-mapper.ts
export interface ColorMapEntry {
  styleKey: string; label: string
  responsible: Responsible; customsChannel: CustomsChannel
  importerOutsideRj: boolean; styleId: number
}
export interface ColorResolution {
  responsible: Responsible; customsChannel: CustomsChannel
  importerOutsideRj: boolean | null; mapped: boolean; label: string
}
export function resolveColor(styleKey: string, map: ColorMapEntry[]): ColorResolution
```

Chave ausente do mapa → `{ responsible: 'indefinido', customsChannel:
'indefinido', importerOutsideRj: null, mapped: false, label: styleKey }`.

**Critérios de aceite:**
- **Dado** `color-map.json` com a entrada azul, **quando** `resolveColor("argb:FF0070C0")`
  roda, **então** devolve `responsible: 'colaborador1'` e `mapped: true`.
- **Dado** a entrada bege, **quando** resolvida, **então** devolve
  `responsible: 'colaborador1_outros_clientes'` — subcategoria de Colaborador 1 (A-18).
- **Dado** a entrada vermelha, **então** `customsChannel: 'vermelho'`.
- **Dado** a entrada amarela, **então** `importerOutsideRj: true` — e
  `customsChannel: 'nenhum'`, conforme decisão do usuário sobre A-38.
- **Dado** `"none"` (branco), **então** todos os derivados neutros e
  `mapped: true`.
- **Dado** uma chave ausente do mapa, **então** `mapped: false` e nenhuma
  aproximação por proximidade de cor é tentada.

**Casos-limite:**
- `"argb:FF00B051"` (um bit distante do verde `FF00B050`) → **não mapeado**. A
  ausência de tolerância é deliberada (TD-05).
- `"theme:9|tint:0.3999"` → não mapeado, `label` recebe a própria chave para
  aparecer legível no relatório de quarentena.
- `color-map.json` com duas entradas para a mesma `styleKey` → a build de
  configuração falha na partida com mensagem indicando a chave repetida.
- `color-map.json` vazio → toda linha resulta em `mapped: false`; o serviço sobe
  e o relatório de quarentena mostra 100% de linhas não mapeadas.

**Dependências:** H-03
**Tamanho:** P

---

### H-05 — Normalizar textos de agrupamento e converter células em datas

> ✅ **CONCLUÍDA em 03/08/2026.** 25 testes próprios; suíte total em 88.
>
> Validada contra o **arquivo real**: ETA2 585 datas · RG 483 · DOCS ENVIADOS
> 134, todas batendo com `H-01`, e **zero `DATA_SEM_ANO` em toda a base** —
> P-03 confirmada de ponta a ponta.
>
> **A normalização unificou duplicatas reais:** NAVIO caiu de 74 para **69**
> grupos e AGENTE de 35 para **34**, apenas por caixa e espaço. São 6 grupos
> que apareceriam duplicados nos rankings de IND-12 e IND-17.
>
> **Duas divergências corrigidas:**
> 1. `RawCell`/`RawRow` migraram para `src/domain/types.ts` — o contrato os
>    punha em `src/io/`, e o lint bloqueia até `import type` no domínio.
> 2. **TD-03 mandava truncar a hora "no fuso `America/Sao_Paulo`", o que
>    corromperia todas as datas.** O ExcelJS devolve meia-noite UTC; em UTC−3
>    `getDate()` retorna o **dia anterior** (medido: `2026-08-01T00:00Z` → 31).
>    A data da planilha passa a ser tratada como **data civil sem fuso**,
>    ancorada em UTC. O `timezone` da configuração vale só para definir "hoje"
>    (`H-10`).

**Objetivo:** ter chaves de agrupamento estáveis e datas confiáveis, sem
inventar o ano quando ele não existe.

**Arquivos:**
- `src/domain/normalizer.ts`
- `tests/domain/normalizer.test.ts`

**Contrato fixado:**

```ts
// src/domain/normalizer.ts
export function normKey(value: string): string                    // TD-04
export interface DateParse { date: Date | null; anomaly: 'DATA_SEM_ANO' | null }
export function parseCellDate(raw: RawCell, timezone: string): DateParse  // TD-03
export function levenshtein(a: string, b: string): number
```

**Critérios de aceite:**
- **Dado** `"  rsassi  "`, **quando** `normKey` roda, **então** devolve
  `"ACME LOG"`.
- **Dado** `"ACME LOG  LTDA"` (dois espaços), **então** devolve `"ACME LOG LTDA"`.
- **Dado** `"DESEMBARAÇADA"`, **então** devolve `"DESEMBARACADA"`.
- **Dado** uma célula `Date`, **então** `date` é a mesma data com hora truncada
  no fuso `America/Sao_Paulo` e `anomaly` é `null`.
- **Dado** o serial `45867`, **então** converte pelo epoch 1900 respeitando a
  inexistência do serial 60.
- **Dado** `"29/jul"`, **então** `date` é `null` e `anomaly` é `'DATA_SEM_ANO'`
  — **o ano não é inferido** (TD-03, regra 5).

**Casos-limite:**
- `""` e `"   "` → `date: null`, `anomaly: null` (vazio não é anomalia).
- `"29/07/2026"` → `2026-07-29`.
- `"29/07/26"` → `2026-07-29` (século 2000).
- `"29/07"` → `null` + `DATA_SEM_ANO`.
- `"OK 23/07"` → `null` + `DATA_SEM_ANO`.
- `"32/13/2026"` → `null` + `DATA_SEM_ANO` (data inválida).
- `normKey("")` → `""`.
- `levenshtein("DESEMBARACADA", "DESEMBARCADA")` → `1`.

**Dependências:** H-03
**Tamanho:** P

---

### H-06 — Classificar cada linha em uma das quatro categorias canônicas

> ✅ **CONCLUÍDA na Fase 1.** Bloco acrescentado retroativamente em 07/08/2026,
> ao conferir o alinhamento dos documentos.
>
> Era a **única** história de `H-03` a `H-08` sem ele, enquanto a rastreabilidade
> e o `CLAUDE.md` já a davam por concluída — a mesma inconsistência que a
> `/fechar-historia` cita como sua razão de existir, e que seguia aberta no
> próprio caso que a motivou.
>
> **Sem contagem de testes:** o total da suíte na época não ficou registrado, e
> transcrevê-lo agora seria inventá-lo.

**Objetivo:** aplicar TD-01 e TD-02, com a verificação de "Fechado — aguardando
draft" precedendo a regra de STATUS.

**Arquivos:**
- `src/domain/status-classifier.ts`
- `config/status-aliases.json`
- `tests/domain/status-classifier.test.ts`

**Contrato fixado:**

```ts
// src/domain/status-classifier.ts
export interface Classification {
  category: StatusCategory
  anomalies: AnomalyCode[]
}
export function classify(row: RawRow, aliases: string[]): Classification
```

`aliases` são as formas já normalizadas de `config/status-aliases.json`.

**Critérios de aceite:**
- **Dado** `STATUS = "DESEMBARAÇADA"`, **então** `desembaracado`.
- **Dado** `STATUS = "DESEMBARÇADA"` (grafia da foto 2), **então**
  `desembaracado` — variante catalogada, sem anomalia.
- **Dado** `STATUS = ""`, **então** `em_desembaraco`.
- **Dado** `STATUS = "   "`, **então** `em_desembaraco`.
- **Dado** `STATUS = "DUIMP: 26BR0001273903-1 - CONFERIDO 29.07"`, **então**
  `em_andamento`.
- **Dado** REF preenchido e **todas** as colunas B–P vazias, **então**
  `fechado_aguardando_draft` — a regra 2 precede a regra 4 (A-22).
- **Dado** REF preenchido, STATUS vazio e `boletoRaw = "N/A"`, **então**
  `em_desembaraco`, porque "demais colunas" inclui as fora de escopo (A-23).
- **Dado** `STATUS = "DESEMBARAÇADO"` (masculino, fora do dicionário), **então**
  `em_andamento` **mais** a anomalia `VARIANTE_STATUS_PROXIMA` — não é
  reclassificado por adivinhação.

**Casos-limite:**
- `STATUS = "DUIMP: 26BR0001247418-6 - CANAL AMARELO"` → `em_andamento` mais
  `CANAL_EM_TEXTO_STATUS`.
- `STATUS = "desembaraçada"` → `desembaracado` (caixa).
- `STATUS = "DESEMBARACADA"` (sem cedilha) → `desembaracado`.
- `STATUS = "DESEMBARAÇADA EM 30/07"` → `em_andamento` + `VARIANTE_STATUS_PROXIMA`.
- REF preenchido, todas as demais colunas com apenas espaços →
  `fechado_aguardando_draft`.
- `status-aliases.json` sem a chave `desembaracado` → a partida falha com
  mensagem explícita; sem dicionário, nenhum processo seria classificado como
  concluído, e falhar alto é preferível a contar errado.

**Dependências:** H-03, H-05
**Tamanho:** P

---

### H-07 — Compor os processos e emitir o relatório de quarentena e divergências

> ✅ **CONCLUÍDA em 03/08/2026.** 21 testes próprios; suíte total em 143.
>
> **Critério de saída da Fase 1 atendido com folga:** sobre as 649 linhas
> reais, 649 aceitas e **quarentena 0%** — o limite de RNF-24 é 2%.
>
> **5 divergências reais encontradas na planilha**, todas em linhas aceitas:
> 3 `RG_SEM_DESEMBARACO`, 1 `INTERVALO_DOCUMENTAL_NEGATIVO`, 1
> `CANAL_EM_TEXTO_STATUS`.
>
> **Divergências resolvidas:** `BuildDeps` não existia no plano, definido como
> `{ colorMap, statusAliases }`; a rota `GET /api/quarantine` lê
> `data/quarantine.json` em vez de depender do `process-store` de `H-08`.
>
> **Defeito de processo corrigido:** um import órfão passou pelo lint e pelo
> typecheck. `noUnusedImports`, `noUnusedVariables` e `noUnusedLocals` foram
> ativados — o portão agora pega esse caso.

**Objetivo:** produzir a lista de `Process` aceitos e um relatório auditável de
tudo que não entrou ou que entrou com ressalva.

**Arquivos:**
- `src/domain/process-builder.ts`
- `src/io/quarantine-reporter.ts`
- `src/http/routes/quarantine.ts`
- `tests/domain/process-builder.test.ts`
- `tests/fixtures/sujeira.xlsx`

**Contrato fixado:**

```ts
// src/domain/process-builder.ts
export type QuarantineReason = 'REF_AUSENTE' | 'REF_DUPLICADA' | 'COR_NAO_MAPEADA'
export interface QuarantineItem { sourceRow: number; ref: string; reason: QuarantineReason; detail: string }
export interface AnomalyItem   { sourceRow: number; ref: string; code: AnomalyCode; detail: string }
export interface BuildResult {
  processes: Process[]
  quarantine: QuarantineItem[]
  anomalies: AnomalyItem[]
  totalDataRows: number
}
export function buildProcesses(rows: RawRow[], deps: BuildDeps): BuildResult
```

Rota `GET /api/quarantine` conforme `05-contratos-api.md`.

**Critérios de aceite:**
- **Dado** uma linha com REF e cor não mapeada, **então** ela entra em
  `quarantine` com `COR_NAO_MAPEADA` **e também** em `processes`, com
  `responsible: 'indefinido'` — a linha é contada nos indicadores de volume, e a
  pendência fica visível (A-17).
- **Dado** duas linhas com o mesmo REF, **então** a de menor `sourceRow` entra
  em `processes` e a outra em `quarantine` com `REF_DUPLICADA` (TD-06).
- **Dado** uma linha sem REF mas com CLT preenchido, **então** entra apenas em
  `quarantine` com `REF_AUSENTE`, e **não** em `processes`.
- **Dado** uma linha inteiramente vazia, **então** não entra em `processes` nem
  em `quarantine`, e não conta em `totalDataRows`.
- **Dado** RG preenchido em processo de categoria diferente de `desembaracado`,
  **então** gera `RG_SEM_DESEMBARACO` em `anomalies` (A-05).
- **Dado** `RG < DOCS ENVIADOS`, **então** gera
  `INTERVALO_DOCUMENTAL_NEGATIVO` (A-30).
- **Dado** `GET /api/quarantine`, **então** devolve `quarantineRate` como
  `quarantinedRows / totalDataRows`, com 4 casas decimais.

**Casos-limite:**
- REF `"FT498.26"` e `"ft498.26 "` → tratados como o mesmo REF; a segunda vira
  `REF_DUPLICADA`.
- Três linhas com o mesmo REF → uma aceita, duas em quarentena.
- `totalDataRows === 0` → `quarantineRate` é `0`, não divisão por zero.
- Linha com REF e ETA2 `"29/jul"` → aceita, com anomalia `DATA_SEM_ANO`, e
  `eta2: null`.

**Dependências:** H-04, H-05, H-06
**Tamanho:** M

---

### H-08 — Recarregar automaticamente quando a planilha for alterada por fora

> ✅ **CONCLUÍDA em 03/08/2026.** 32 testes próprios; suíte total em 175.
>
> **RNF-14 medido**, sobre cópia do arquivo real, três rodadas de alteração de
> conteúdo: 2034 · 2092 · 2032 ms. Pior caso **2092 ms** para um limite de
> 5000 ms — folga de 2,4×. O custo é quase todo debounce; o parse mede 120 ms.
>
> **Casos-limite verificados no arquivo real:** salvar sem editar produziu 1
> disparo com hash estável e nenhuma recomposição; 5 alterações em rajada
> produziram 1 releitura; arquivo corrompido levou a `degradado` **preservando
> as 649 linhas** da última leitura boa; arquivo restaurado voltou a `pronto`.
>
> **Divergências resolvidas:** o backlog não declarava arquivo para
> `POST /api/reload` — criado `src/http/routes/reload.ts`, no padrão de uma
> rota por arquivo; `StoreState` ganhou `rowsRead`, `rowsAccepted`,
> `rowsQuarantined` e `sheetName`, sem os quais `GET /api/health` não teria de
> onde tirar seus campos; `initStore(options)` foi acrescentado como ponto de
> injeção, já que `getState`/`reload` são singletons e testá-los exigiria a
> planilha real; o guarda de `409 ESCRITA_EM_ANDAMENTO` foi implementado
> mesmo sendo inalcançável até `H-25` produzir o estado `escrevendo`.
>
> **Decisão de projeto registrada:** `resume()` reagenda a releitura quando
> houve alteração durante a pausa. Descartar o evento deixaria o painel
> desatualizado até a próxima alteração — que pode não vir — e quebraria a
> sequência de 04-arquitetura.md §3.2, onde o watcher dispara a releitura
> logo após o write-guard retomá-lo.
>
> **`GET /api/quarantine` passou a ter dado.** Até aqui `writeReport` não tinha
> chamador em produção; `reload()` grava o relatório a cada leitura que muda o
> hash, fechando o laço aberto em `H-07`.

**Objetivo:** o painel refletir, em até 5 segundos, o que o operador salvou no
Excel.

**Arquivos:**
- `src/io/watcher.ts`
- `src/app/process-store.ts`
- `src/http/routes/health.ts`
- `tests/io/watcher.test.ts`

**Contrato fixado:**

```ts
// src/io/watcher.ts
export interface Watcher {
  start(): void
  stop(): void
  pause(): void      // usado pelo write-guard durante a escrita própria
  resume(): void
  onChange(handler: () => Promise<void>): void
}
export function createWatcher(filePath: string, debounceMs: number): Watcher

// src/app/process-store.ts
export interface StoreState {
  state: 'partindo'|'lendo'|'pronto'|'escrevendo'|'degradado'
  processes: Process[]; fileHash: string | null
  lastReadAt: Date | null; lastReadOk: boolean; degradedReason: string | null
}
export function getState(): StoreState
export async function reload(): Promise<void>
```

Debounce fixado em **2000 ms**. Rota `POST /api/reload`.

**Critérios de aceite:**
- **Dado** o servidor pronto, **quando** o arquivo é modificado, **então** uma
  releitura ocorre e `lastReadAt` avança em até 5 s (RNF-14).
- **Dado** cinco alterações em 1 s, **então** apenas **uma** releitura acontece,
  disparada 2 s após a última.
- **Dado** que o watcher está pausado, **quando** o arquivo muda, **então**
  nenhuma releitura ocorre até `resume()`.
- **Dado** que o arquivo foi removido, **então** o estado vira `degradado`, a
  **última leitura válida é preservada** em memória, e `degradedReason` é
  preenchido.
- **Dado** o estado `degradado`, **quando** o arquivo reaparece, **então** a
  releitura ocorre e o estado volta a `pronto`.
- **Dado** um arquivo ilegível, **então** o estado vira `degradado` sem
  descartar os processos já carregados — o painel nunca exibe zero em lugar de
  "sem dado" (§5 de `04-arquitetura.md`).

**Casos-limite:**
- Arquivo salvo pelo Excel, que grava por substituição atômica: o watcher
  observa o diretório, não o inode, para não perder o evento.
- Arquivo temporário `~$planilha.xlsx` criado na mesma pasta → ignorado pelo
  watcher.
- Alteração que não muda o hash (salvar sem editar) → releitura ocorre e é
  encerrada cedo, sem regravar histórico.
- Duas releituras simultâneas → a segunda aguarda a primeira; nunca há duas
  leituras concorrentes.

**Dependências:** H-07
**Tamanho:** M

---

## Épico E3 — Indicadores e alertas

### H-09 — Entregar as contagens por categoria de status

> ✅ **CONCLUÍDA em 04/08/2026.** 14 testes próprios; suíte total em 209.
> Abre a Fase 2.
>
> **Verificado no servidor real**, sobre as 649 linhas da aba `2026`:
> `total 649 · desembaracados 480 · emAndamento 103 · fechadoAguardandoDraft 34
> · emDesembaraco 32`. A soma das quatro categorias fecha com o total.
>
> **Divergências resolvidas:** `503 ARQUIVO_INDISPONIVEL` passa a valer apenas
> quando **nunca** houve leitura bem-sucedida (`lastReadAt === null`) — em
> estado `degradado` com leitura anterior a rota devolve **200 com o dado
> congelado**, porque devolver 503 apagaria o painel a cada sincronização do
> OneDrive e contradiria `04-arquitetura.md §5` (ver A-57); a rota nasce
> parcial, devolvendo só os blocos já calculados, em vez de zerar os campos das
> histórias seguintes — zero é indistinguível de "não calculado";
> `CategoryCounts` foi derivado literalmente do bloco `counts` de
> `05-contratos-api.md`; teste de rota acrescentado em
> `tests/http/indicators.test.ts`.
>
> **Achado A-57 registrado.** A faixa de aviso de dado congelado existia em
> `08-qualidade-operacao.md §3.3` como requisito de **todas** as páginas, mas
> só `H-16` a implementava, e apenas na Página Inicial. Virou critério de aceite
> de `H-15`, que monta a casca. Levantado pelo usuário.

**Objetivo:** IND-01 a IND-05 disponíveis na API sobre o conjunto filtrado.

**Arquivos:**
- `src/domain/indicators.ts`
- `src/http/routes/indicators.ts`
- `tests/domain/indicators-counts.test.ts`

**Contrato fixado:** bloco `counts` de `GET /api/indicators`, campos `total`,
`emAndamento`, `emDesembaraco`, `desembaracados`, `fechadoAguardandoDraft`.

```ts
export function countByCategory(processes: Process[]): CategoryCounts
```

**Critérios de aceite:**
- **Dado** 10 processos — 4 `desembaracado`, 3 `em_andamento`, 2
  `em_desembaraco`, 1 `fechado_aguardando_draft` — **então** `total` é `10` e
  cada contagem bate.
- **Dado** o mesmo conjunto, **então** `emAndamento + emDesembaraco +
  desembaracados + fechadoAguardandoDraft === total`, porque as categorias são
  mutuamente exclusivas (§2.1).
- **Dado** que `fechado_aguardando_draft` existe, **então** ele é incluído em
  `total` (IND-01 exige explicitamente).
- **Dado** conjunto vazio, **então** todas as contagens são `0`.

**Casos-limite:**
- Um único processo `fechado_aguardando_draft` → `total: 1`,
  `emDesembaraco: 0`. Nunca somar as duas categorias (§2.1).
- Filtro que exclui tudo → todas as contagens `0`, resposta `200`.

**Dependências:** H-07
**Tamanho:** P

---

### H-10 — Entregar os indicadores de calendário

> ✅ **CONCLUÍDA em 04/08/2026.** 43 testes próprios; suíte total em 252.
>
> **Verificado no servidor real**, com `today = 2026-08-04` (terça) e
> `weekEnd = 2026-08-09` (domingo): `chegandoHoje 1 · chegandoSemana 16 ·
> chegando15Dias 74`, e **19 chegadas previstas** somando 104 processos. A
> ordem `1 ≤ 16 ≤ 74` confere, e a soma de `processCount` excede
> `chegando15Dias` porque `expectedVessels` não tem teto de dias.
>
> **Divergências resolvidas:** `today(tz)` devolve **data civil ancorada em
> UTC** — resolve o fuso uma vez e devolve a mesma âncora das datas da planilha;
> sem isso, toda consulta feita entre 21h e meia-noite compararia contra o dia
> seguinte, e há teste com `2026-08-04T02:30Z → 2026-08-03`. O parâmetro `tz`
> saiu de `isoWeekEnd` e de `arrivingThisWeek`: depois que `today` resolveu o
> fuso, ele só poderia ser usado errado. `date-window` ganhou teste próprio, com
> os sete dias da semana. `ExpectedVessel` foi derivado do contrato da API e
> agrupa pelo par **(navio, data)** — o mesmo navio em duas datas são duas
> chegadas. Processo **sem navio** fica fora de `expectedVessels`, que responde
> "que navios chegam"; ele continua contando nos indicadores de container.
>
> **`meta` entra parcial** — `today`, `timezone`, `weekEnd`. `topN` e
> `bazarShare` chegam em `H-11`, pela regra de `H-09` de não zerar o que ainda
> não foi calculado.

**Objetivo:** IND-07, IND-08, IND-09 e IND-12, com fronteiras de data
explícitas.

**Arquivos:**
- `src/domain/indicators.ts`
- `src/domain/date-window.ts`
- `tests/domain/indicators-calendar.test.ts`

**Contrato fixado:**

```ts
// src/domain/date-window.ts
export function today(tz: string): Date
export function isoWeekEnd(ref: Date, tz: string): Date   // domingo, ISO-8601
export function addDays(d: Date, n: number): Date

// src/domain/indicators.ts
export function arrivingToday(p: Process[], today: Date): number
export function arrivingThisWeek(p: Process[], today: Date, tz: string): number
export function arrivingIn15Days(p: Process[], today: Date): number
export function expectedVessels(p: Process[], today: Date): ExpectedVessel[]
```

Intervalos **fechados nos dois extremos** (A-35). Semana ISO, segunda a
domingo, fuso `America/Sao_Paulo` (A-07).

**Critérios de aceite:**
- **Dado** hoje = `2026-08-03` (segunda) e um processo com `eta2 = 2026-08-03`,
  **então** ele conta em `chegandoHoje`, `chegandoSemana` e `chegando15Dias`.
- **Dado** hoje = `2026-08-03` e `eta2 = 2026-08-09` (domingo), **então** conta
  em `chegandoSemana`.
- **Dado** hoje = `2026-08-03` e `eta2 = 2026-08-10` (segunda seguinte),
  **então** **não** conta em `chegandoSemana`.
- **Dado** hoje = `2026-08-03` e `eta2 = 2026-08-18` (hoje + 15), **então**
  conta em `chegando15Dias` — extremo inclusivo.
- **Dado** hoje = `2026-08-03` e `eta2 = 2026-08-19`, **então** não conta.
- **Dado** `eta2 = null`, **então** não conta em nenhum indicador de calendário
  (A-20).
- **Dado** `expectedVessels`, **então** inclui `eta2 >= hoje` (hoje inclusive,
  A-24), ordenado por `eta2` ascendente e depois por `vesselKey`.

**Casos-limite:**
- Hoje = domingo `2026-08-09` → `isoWeekEnd` é o próprio dia; `chegandoSemana`
  equivale a `chegandoHoje`.
- `eta2` no passado → não conta em nenhum dos três; conta em IND-15.
- Dois navios com a mesma `eta2` → desempate alfabético por `vesselKey`.
- Processo `fechado_aguardando_draft` com `eta2 = null` → ausente de todos.

**Dependências:** H-09
**Tamanho:** M

---

### H-11 — Entregar os agrupamentos e rankings

> ✅ **CONCLUÍDA em 04/08/2026.** 27 testes próprios; suíte total em 279.
>
> **A-34 ganhou número.** A especificação afirmava que `BAZAR` "domina a base"
> sem medir. Medido: **210 processos, 35,47%** dos que têm mercadoria
> preenchida. É a maior fatia com folga — o segundo colocado real tem 37, ou
> **5,7× menos** —, mas não é maioria absoluta. `meta.bazarShare` expõe a
> fração para a tela declarar a limitação.
>
> **A-31 e R-02 confirmados em produção:** `responsibleRanking` devolve
> `indefinido 484 · colaborador1 120 · colaborador2 36 · colaborador1_outros_clientes 9`, somando
> 649. Os 484 são exatamente a medição de `H-04` — 74,6% da planilha não tem
> responsável identificável pela cor. O ranking mostra isso em vez de escondê-lo.
>
> **Nada foi descartado em silêncio.** As chaves vazias aparecem nos rankings:
> 38 clientes, 35 importadores, 73 agentes e 57 mercadorias em branco.
>
> **Divergências resolvidas:** `isOverdue(process, today)` foi extraído nesta
> fatia, porque `agentRanking` já precisava da regra de IND-15 e `H-12` só
> chegaria depois — `overdueCount` passa a ser construído sobre ele, uma regra
> num lugar só. `bazarShare(processes): number | null` ganhou assinatura, com
> `null` quando nenhum processo tem mercadoria (mesmo princípio de A-42) e base
> restrita aos processos **com** mercadoria, para não diluir a distorção que
> A-34 denuncia. O rótulo `(sem valor)` saiu do domínio: `label` fica vazio e a
> apresentação decide em `H-18`. `GroupCount` foi derivado do contrato da API.

**Objetivo:** IND-10, IND-11, IND-13, IND-17, IND-18, IND-19 e IND-20.

**Arquivos:**
- `src/domain/indicators.ts`
- `tests/domain/indicators-rankings.test.ts`

**Contrato fixado:**

```ts
export function groupCount(p: Process[], key: (x: Process) => string,
                           label: (x: Process) => string, topN: number): GroupCount[]
export function agentRanking(p: Process[], today: Date, topN: number): GroupCount[]  // com overdueCount
export function responsibleRanking(p: Process[]): GroupCount[]                        // 4 valores, sem topN
```

Ordenação: `count` decrescente, desempate por `key` ascendente. `topN` padrão
`10` (A-25).

**Critérios de aceite:**
- **Dado** `CLT` com valores `ACME LOG`, `acme log` e `  ACME LOG  `, **então**
  produzem **um** grupo com `count: 3` e `label` igual à primeira grafia
  encontrada (A-26).
- **Dado** dois grupos com contagem igual, **então** a ordem entre eles é
  alfabética ascendente por `key`.
- **Dado** o ranking de agentes, **então** cada entrada traz `overdueCount` com
  os processos daquele agente que satisfazem IND-15 (A-27).
- **Dado** o ranking por responsável, **então** devolve as **quatro** chaves —
  `colaborador1`, `colaborador2`, `colaborador1_outros_clientes`, `indefinido` — inclusive as com
  contagem zero (A-28).
- **Dado** `MERCADORIA` dominada por `BAZAR`, **então** o grupo `BAZAR` aparece
  normalmente e `meta.bazarShare` traz sua fração do total (A-34).

**Casos-limite:**
- `CLT` vazio → agrupado sob a chave `""`, exibido como `(sem valor)`.
- `NAVIO ALFA` e `NAVIO ALFHA` → **dois** grupos distintos; nomes parecidos não
  são unificados (TD-04).
- `ACME` e `ACME - SC` → dois grupos distintos.
- Conjunto vazio → listas vazias; `responsibleRanking` ainda devolve as 4
  chaves com `count: 0`.
- `topN` maior que o número de grupos → devolve todos, sem preenchimento.

**Dependências:** H-09
**Tamanho:** M

---

### H-12 — Entregar os indicadores de risco

> ✅ **CONCLUÍDA em 05/08/2026.** 28 testes próprios; suíte total em 307.
>
> **Verificado contra a planilha real** com `today = 2026-08-05`, sobre as 649
> linhas: `canalVermelho 5 · documentosPendentes 14 · atrasados 4`, com 169
> processos não desembaraçados. A validação usou `app.inject()` do Fastify, e
> não HTTP: exercita a rota inteira sem abrir socket, o que dispensa afrouxar a
> negação de `curl` nas permissões.
>
> **Divergências resolvidas:** a dependência declarada era `H-10`, mas `H-11` já
> havia extraído `isOverdue(process, today)` para o `overdueCount` do ranking de
> agentes — `overdueCount` desta fatia é apresentação dela, e a dependência
> efetiva passa a ser `H-11`; `src/http/routes/indicators.ts` não constava da
> lista de arquivos, e sem ele os três indicadores ficariam calculados mas
> invisíveis na API, mesma situação de `H-09` a `H-11`.
>
> **Armadilha registrada em código e teste: IND-14 tem teto e não tem piso.**
> A condição é `eta2 <= hoje+10`, nunca `hoje <= eta2 <= hoje+10`. Usar
> `isWithin` — o reflexo natural, já que ele existe desde `H-10` para IND-09 —
> excluiria toda carga que já chegou sem documento, exatamente o caso mais
> grave. O teste com `eta2 = 2025-01-01` fixa isso.
>
> **O segundo critério de aceite já estava satisfeito desde `H-07`:**
> `CANAL_EM_TEXTO_STATUS` é gerado pelo classificador. Esta fatia verificou
> apenas o outro lado — que a cor, e só a cor, alimenta IND-06 (A-06).

**Objetivo:** IND-06, IND-14 e IND-15, com as exclusões definidas na auditoria.

**Arquivos:**
- `src/domain/indicators.ts`
- `tests/domain/indicators-risk.test.ts`

**Contrato fixado:**

```ts
export function redChannelCount(p: Process[]): number                 // IND-06
export function pendingDocsCount(p: Process[], today: Date): number   // IND-14
export function overdueCount(p: Process[], today: Date): number       // IND-15
```

- IND-06: `customsChannel === 'vermelho'`. **Apenas a cor é fonte** (A-06).
- IND-14: `docsSentDate === null && eta2 !== null && eta2 <= hoje+10 &&
  category !== 'desembaracado'` (A-08).
- IND-15: `eta2 !== null && eta2 < hoje && category !== 'desembaracado'`.

**Critérios de aceite:**
- **Dado** um processo com `customsChannel = 'vermelho'`, **então** conta em
  IND-06.
- **Dado** um processo cujo STATUS contém o texto `CANAL VERMELHO` mas cuja cor
  não é vermelha, **então** **não** conta em IND-06, e a ocorrência aparece em
  `anomalies` como `CANAL_EM_TEXTO_STATUS` (A-06).
- **Dado** hoje = `2026-08-03`, `docsSentDate = null`, `eta2 = 2026-08-13`
  (hoje + 10) e categoria `em_andamento`, **então** conta em IND-14.
- **Dado** o mesmo com `eta2 = 2026-08-14`, **então** **não** conta.
- **Dado** o mesmo com categoria `desembaracado`, **então** **não** conta
  (A-08).
- **Dado** `eta2 = 2026-08-02` e categoria `em_desembaraco`, **então** conta em
  IND-15.
- **Dado** `eta2 = null`, **então** não conta em IND-14 nem em IND-15 (A-20).

**Casos-limite:**
- `eta2` muito no passado (`2025-01-01`) e categoria `em_andamento` → conta em
  IND-15 e também em IND-14, pois `eta2 <= hoje+10` é satisfeito. Os dois
  indicadores se sobrepõem por definição da especificação, e isso é intencional.
- Processo `fechado_aguardando_draft` → `eta2` é `null` por definição, logo
  ausente de ambos.
- `customsChannel = 'indefinido'` (cor não mapeada) → não conta em IND-06.

**Dependências:** H-11 — corrigido de `H-10` no fechamento: `overdueCount`
apoia-se em `isOverdue`, extraído por `H-11`
**Tamanho:** P

---

### H-13 — Entregar os indicadores de tempo

> ✅ **CONCLUÍDA em 06/08/2026.** 28 testes próprios; suíte total em 335.
>
> **`GET /api/indicators` deixou de nascer parcial.** Esta era a última das
> cinco histórias que construíram a rota (`H-09` a `H-13`), e com ela o contrato
> de `05-contratos-api.md` está completo: os 21 indicadores em escopo. O teste
> que assegurava a **ausência** de `desembaracadosHoje` e `documentaryLeadTime`
> foi invertido, não apagado — agora fixa a lista completa das 12 chaves de
> `counts` e das 5 do corpo, com `toEqual` sobre as chaves ordenadas. Campo que
> entre sem passar pelo contrato quebra o teste.
>
> **Verificado contra a planilha real** com `today = 2026-08-06`, sobre as 649
> linhas, 0 em quarentena: `desembaracadosHoje 0` · `averageDays 12,5 ·
> sampleSize 101 · excludedNegative 1 · excludedIncomplete 547`.
>
> **O zero de IND-16 é medido, e isso foi provado, não presumido.** O RG mais
> recente da planilha é `2026-07-31`, seis dias antes da medição; passando esse
> dia como `today`, a mesma função devolve `3`. Zero medido e defeito de
> comparação são indistinguíveis pelo resultado — a distinção exigiu a segunda
> execução.
>
> **Duas previsões da auditoria se confirmaram como fato no arquivo.** Existe
> **1 intervalo negativo real** (DOCS ENVIADOS posterior ao RG): sem a exclusão
> de A-30 ele entraria na média puxando-a para baixo, invisível. E existem
> **3 linhas com RG preenchido em processo não desembaraçado** — o caso da foto
> 2 de A-05, reproduzido três vezes. O cruzamento com a categoria acrescentado
> por A-29 não é zelo defensivo: sem ele, essas três contariam como concluídas
> no dia em que o RG delas fosse hoje.
>
> **A-52 se confirma com folga, e `sampleSize` deixa de ser enfeite.** 134 de
> 649 linhas têm DOCS ENVIADOS (20,6%), e a amostra válida de 101 é **15,6% da
> base**. A ressalva prevista para `H-19` será necessária.
>
> **Divergências resolvidas:** `src/http/routes/indicators.ts` não constava da
> lista de arquivos pela **quarta vez consecutiva** — a omissão é sistemática,
> não acidente, e aqui vinha agravada por um teste que assere a ausência dos
> campos e reprovaria; a lista abaixo foi corrigida. A tensão entre "dias
> inteiros" (A-02) e a média `10.5` do caso-limite era aparente: cada
> **intervalo** é inteiro, a **média** deles carrega uma casa decimal.
>
> **`diffDays` entrou em `date-window.ts`, e não arredonda de propósito.** É o
> quinto arquivo da fatia: `DAY_MS` é privado do módulo, e duplicar a constante
> em `indicators.ts` seria pior. O resultado é inteiro **por construção** —
> `serialToDate` trunca o serial do Excel com `Math.floor`, e `today` monta a
> âncora a partir do dia civil. Um `Math.round` ali mascararia o dia em que essa
> invariante quebrasse.

**Objetivo:** IND-16 e IND-22, com a ordem de subtração corrigida.

**Arquivos:**
- `src/domain/indicators.ts`
- `src/domain/date-window.ts` — `diffDays`, acrescentado no fechamento
- `src/http/routes/indicators.ts` — omitido do plano original; ver divergências
- `tests/domain/indicators-time.test.ts`
- `tests/domain/date-window.test.ts`
- `tests/http/indicators.test.ts`

**Contrato fixado:**

```ts
export function clearedTodayCount(p: Process[], today: Date): number  // IND-16
export interface LeadTime {
  averageDays: number | null; sampleSize: number
  excludedNegative: number; excludedIncomplete: number
}
export function documentaryLeadTime(p: Process[]): LeadTime           // IND-22
```

- IND-16: `registrationDate === hoje && category === 'desembaracado'` (A-29).
- IND-22: média de `registrationDate − docsSentDate`, em dias inteiros
  (A-02). Pares incompletos e intervalos negativos são excluídos e contados
  (A-30).

**Critérios de aceite:**
- **Dado** hoje = `2026-08-03`, `registrationDate = 2026-08-03` e categoria
  `desembaracado`, **então** conta em IND-16.
- **Dado** o mesmo com categoria `em_andamento` — o caso da linha amarela da
  foto 2 — **então** **não** conta (A-05, A-29).
- **Dado** `docsSentDate = 2026-07-20` e `registrationDate = 2026-07-30`,
  **então** o intervalo é `10` dias, positivo.
- **Dado** `docsSentDate = 2026-07-30` e `registrationDate = 2026-07-20`,
  **então** o par é excluído e `excludedNegative` incrementa.
- **Dado** `docsSentDate = null` e `registrationDate` preenchido, **então**
  `excludedIncomplete` incrementa.
- **Dado** nenhum par válido, **então** `averageDays` é `null` e `sampleSize`
  é `0` — média de conjunto vazio **não** é zero.

**Casos-limite:**
- `docsSentDate === registrationDate` → intervalo `0`, incluído no cálculo.
- Ambas as datas `null` → conta em `excludedIncomplete`.
- Média não inteira (`10` e `11` dias) → `averageDays` é `10.5`, com uma casa
  decimal.
- Processo `fechado_aguardando_draft` → ambas `null`, conta em
  `excludedIncomplete`.

**Dependências:** H-10
**Tamanho:** P

---

### H-14 — Entregar os cinco alertas derivados do estado atual

> ✅ **CONCLUÍDA em 06/08/2026.** 38 testes próprios; suíte total em 373.
>
> **Verificado contra a planilha real** com `today = 2026-08-06`, sobre as 649
> linhas: **40 linhas de alerta para 25 processos distintos** —
> `eta_vencida 17 · documentacao_pendente 14 · chegadas_7_dias 7 ·
> canal_vermelho 2 · chegadas_hoje 0 · processos_parados 0`. Os números batem
> **exatamente** com a projeção feita na fatia, antes de existir código.
>
> **A fatia rendeu quatro achados novos**, todos decididos antes da primeira
> linha — A-59, A-60, A-61 e A-62. Foi o retorno mais alto do protocolo até
> agora: A-59 sozinho evitaria 5 alertas errados em 14.
>
> **A-59 mudou a regra dos três alertas silenciosos.** ALE-03, ALE-04 e ALE-05
> não declaravam condição de status; lidos ao pé da letra, alertariam sobre
> processo já concluído. A decisão de que a página é **fila de trabalho** — e
> não panorama — fechou a questão: `≠ desembaracado` vale nos cinco. Sem isso,
> 3 dos 5 alertas de Canal Vermelho seriam sobre processos encerrados.
>
> **`historyStartedAt` é `null`, não uma data inventada** (A-61). O campo existe
> para a interface não sugerir retroatividade inexistente, e preenchê-lo antes
> de `H-28` faria exatamente o oposto.
>
> **ALE-06 já funciona — falta o dado, não o código.** `buildAlerts` recebe
> `stalledDays` e o limiar, e há teste provando que gera o alerta quando o mapa
> traz o processo no limiar. `H-29` passa a alimentá-lo; até lá a chave fica em
> `0`, que é diferente de ausente.
>
> **Divergências resolvidas:** faltavam `src/http/server.ts` e
> `tests/http/alerts.test.ts` na lista de arquivos — a rota constava, mas rota
> não registrada não existe. E ALE-02 duplicaria a condição de A-08, que vivia
> dentro de `pendingDocsCount`: `hasPendingDocs` foi extraído no mesmo padrão de
> `isOverdue`, pelo mesmo motivo.
>
> **Detalhe de texto que vale registro:** as mensagens pluralizam (`1 dia`,
> nunca `1 dias`), e carga que já chegou sem documento ganha frase própria —
> a janela de IND-14 não tem piso, então o intervalo fica negativo, e
> `ETA em -3 dias` seria ilegível. Medido: 13 alertas caem no singular.

**Objetivo:** ALE-01 a ALE-05 numa lista única ordenada por severidade fixa.
ALE-06 depende de histórico e é entregue em `H-29`.

> **Decidido em 06/08/2026, antes da implementação** — três achados novos:
>
> - **A-59:** `category ≠ 'desembaracado'` vale nos **cinco** alertas, não só em
>   ALE-01 e ALE-02. A página é fila de trabalho; processo concluído não pede
>   ação. Sem o filtro, 5 de 14 alertas seriam sobre processos encerrados.
> - **A-61:** `historyStartedAt` é `string | null`, e vale `null` até `H-28`.
> - **A-62:** a fila também muda pela passagem do dia, sem a planilha mudar.
>   Tela aberta atravessando a meia-noite exibe o dia anterior. **Em aberto,
>   endereçado a `H-15`** — não bloqueia esta história, porque o domínio já
>   recebe `today` como parâmetro.

**Arquivos:**
- `src/domain/alerts.ts`
- `src/domain/indicators.ts` — `hasPendingDocs`, extraído no fechamento
- `src/http/routes/alerts.ts`
- `src/http/server.ts` — registro da rota; omitido do plano original
- `tests/domain/alerts.test.ts`
- `tests/http/alerts.test.ts` — omitido do plano original

**Contrato fixado:**

```ts
export type AlertType = 'eta_vencida' | 'documentacao_pendente' | 'canal_vermelho'
                      | 'chegadas_hoje' | 'chegadas_7_dias' | 'processos_parados'
export interface Alert {
  type: AlertType; severity: number; ref: string; sourceRow: number
  eta2: string | null; daysOverdue: number | null; message: string
}
export function buildAlerts(p: Process[], today: Date, stalledDays: Map<string, number>,
                            threshold: number): Alert[]
```

Severidade fixa (A-41): `eta_vencida` 1 · `canal_vermelho` 2 ·
`documentacao_pendente` 3 · `processos_parados` 4 · `chegadas_hoje` 5 ·
`chegadas_7_dias` 6. Ordenação: severidade ascendente, depois `eta2`
ascendente, nulos por último.

**Critérios de aceite:**
- **Dado** um processo que satisfaz ETA vencida e Canal Vermelho, **então**
  gera **dois** alertas distintos; um processo pode aparecer em mais de um tipo.
- **Dado** alertas de tipos diferentes, **então** a lista sai ordenada por
  severidade ascendente.
- **Dado** dois alertas do mesmo tipo, **então** o de `eta2` menor vem primeiro.
- **Dado** um alerta com `eta2 = null`, **então** vem por último dentro do seu
  grupo.
- **Dado** ALE-01, **então** `daysOverdue` é a diferença em dias corridos entre
  hoje e `eta2`.
- **Dado** `countsByType`, **então** traz as **seis** chaves, com
  `processos_parados` em `0` até `H-29` existir.

**Casos-limite:**
- Nenhum processo em risco → `items: []` e todas as contagens `0`, resposta
  `200`.
- Processo com `eta2 = hoje` → gera `chegadas_hoje` e `chegadas_7_dias`, mas
  não `eta_vencida` (a condição é `< hoje`, estrita).
- `daysOverdue` de um processo vencido ontem → `1`.
- Processo `desembaracado` com `eta2` no passado → nenhum alerta (A-08, A-19).

**Dependências:** H-12, H-13
**Tamanho:** M

---

## Épico E4 — Interface do painel

### H-15 — Montar a casca da aplicação com os onze filtros globais

> ✅ **CONCLUÍDA em 07/08/2026.** 125 testes próprios em 8 arquivos; suíte total
> em **517**. Abre o épico E4 e a primeira interface do projeto.
>
> **Saiu em três entregas**, decididas em 06/08/2026 porque o tamanho `M` do
> plano estava subestimado — a história continua sendo uma, só a execução foi
> fatiada: ① backend de filtros (PR #10) · ② casca, faixa e A-62 (PR #13) ·
> ③ `FilterBar` (esta).
>
> **Conferido contra a planilha real**, com os dois processos no ar: OU dentro
> do parâmetro devolve **135** para `em_andamento` + `em_desembaraco`, que é
> 103 + 32; E entre parâmetros devolve **2** para `em_andamento ∧ vermelho`,
> dos 5 vermelhos; `port=RO` devolve **2**, confirmando A-36 — domínio fechado
> os teria escondido; `responsible=colaborador1` devolve **129** com ou sem
> `colaborador1_outros_clientes` junto, provando A-18 sobre dado real; valor
> fora do domínio devolve `400 FILTRO_INVALIDO`.
>
> **Um caso-limite não é exercível contra o arquivo real, e isso é resultado.**
> `importerOutsideRj` mede `true`=1 e `false`=648, somando exatamente 649 —
> **zero** processos com `null`. Coerente com o fato de `H-01` de que as 9
> chaves de cor cobrem 100% das linhas. A regra "`false` inclui apenas `false`,
> nunca `null`" tem teste de domínio, mas nenhuma linha real a exercita hoje;
> uma cor nova na planilha mudaria isso.
>
> **A URL é o único estado dos filtros**, sem cópia em `useState`: duas fontes
> divergiriam no primeiro `popstate`, e um critério de aceite exige que
> recarregar preserve o recorte. A escrita usa `replaceState`, não `pushState` —
> filtro é visualização, não navegação: marcar cinco clientes empilharia cinco
> entradas, e "voltar" viraria "desmarcar o último".
>
> **Dois defeitos encontrados por rodar a aplicação, não por teste.** A casca
> inteira caía com tela branca se o `health` viesse sem `today` —
> `undefined.split` derrubava faixa e navegação junto; o tipo descreve o
> contrato, não a resposta que chegou. Corrigido com teste de regressão. E o
> `node --watch` servia código **anterior ao `git switch`**: o arquivo em disco
> tinha o campo, o processo não, e um `touch` resolveu. Como o projeto usa
> branch por história, trocar de branch com o `dev` no ar é rotina.
>
> **Divergências resolvidas:** A-63 (`GET /*` especificada e sem dono no mapa
> rota → história, atribuída a `H-30`) e D-18 (o cliente importando tipos das
> próprias rotas). `H-34` nasceu daqui, pedida pelo usuário ao ver a casca
> rodando.

**Objetivo:** navegação entre as páginas e filtros que se aplicam a todos os
indicadores e alertas simultaneamente.

> **A-62 chega aqui, já decidido.** Indicadores de calendário e alertas dependem
> do **dia corrente**, resolvido a cada requisição. Uma tela deixada aberta
> atravessando a meia-noite segue exibindo a fila do dia anterior: nenhum
> arquivo muda à meia-noite, então o watcher não dispara. Três frentes:
>
> - **revalidar no `visibilitychange`** — o gatilho principal. Sobrevive à
>   máquina suspensa, ao contrário de um timer agendado para a meia-noite
> - **comparar o dia do servidor com o do cliente** — rede para o painel que
>   nunca perde o foco. Só `GET /api/indicators` expõe `meta.today` hoje; a
>   casca já consome `GET /api/health` e é o candidato a fonte única
> - **botão de atualização manual**, que chama `POST /api/reload` **antes** de
>   refazer as requisições — quem clica acabou de mexer na planilha
>
> A correção é inteiramente de apresentação: o domínio já recebe `today` por
> parâmetro.
>
> **Roteamento à mão (D-16).** `History API` para trocar de página, `popstate`
> para o botão "voltar", `URLSearchParams` para os filtros na URL. Sem
> `react-router`: são sete páginas planas numa aplicação local, e o plano proíbe
> dependência não prevista. A decisão registra os gatilhos de reavaliação.

**Arquivos:**
- `web/src/App.tsx`, `web/src/components/FilterBar.tsx`
- `web/src/hooks/useFilters.ts`, `web/src/api-client.ts`
- `src/http/routes/filter-options.ts`
- `src/domain/filters.ts`
- `tests/domain/filters.test.ts`
- **Omitidos do plano original**, e necessários: `web/src/router.ts` (D-16),
  `web/src/hooks/useAppData.ts` e `useFilterOptions.ts`,
  `web/src/components/StatusBanner.tsx`, `RefreshButton.tsx` e
  `MultiSelect.tsx`, `web/src/pages/Placeholders.tsx`,
  `src/http/routes/health.ts` (o campo `today`, por A-62),
  `tests/http/filter-options.test.ts` e as 6 suítes de `web/tests/`

**Contrato fixado:** `GET /api/filters/options` e os 11 parâmetros de consulta
de `05-contratos-api.md §1.1`.

```ts
// src/domain/filters.ts
export interface FilterSet { /* os 11 campos */ }
export function applyFilters(p: Process[], f: FilterSet): Process[]
```

**Critérios de aceite:**
- **Dado** os filtros `client=ACME LOG` e `category=em_andamento`, **então** o
  resultado satisfaz **ambos** (E entre parâmetros).
- **Dado** `client=ACME LOG&client=YRD`, **então** o resultado satisfaz
  **qualquer um** dos dois (OU dentro do parâmetro).
- **Dado** `responsible=colaborador1`, **então** o resultado inclui também os
  processos `colaborador1_outros_clientes` (A-18).
- **Dado** nenhum filtro, **então** o resultado é o conjunto completo.
- **Dado** um filtro com valor fora do domínio, **então** a API devolve `400
  FILTRO_INVALIDO`.
- **Dado** os filtros aplicados, **então** o estado é refletido na URL, e
  recarregar a página os preserva.
- **Dado** `GET /api/filters/options`, **então** os valores vêm dos dados
  carregados, não de lista fixa (A-36).
- **Dado** o estado `degradado`, **então** uma **faixa persistente no topo de
  todas as páginas** informa que o dado está congelado, com o motivo
  (`degradedReason`) e o horário da última leitura bem-sucedida. A faixa vive na
  casca, não nas páginas (A-57). Some sozinha quando o estado volta a `pronto`.
- **Dado** `externalLock: true`, **então** a mesma faixa informa que alguém está
  com a planilha aberta no Excel (A-58).
- **Dado** `conflictFiles` não vazio, **então** a faixa informa que o OneDrive
  gerou arquivo de conflito e **lista os nomes**. Este aviso é o mais severo dos
  três: significa que duas versões da planilha coexistem na pasta (A-58).

**Casos-limite:**
- Estado `degradado` em qualquer página que não a inicial → a faixa aparece
  igual. Nenhuma página pode exibir número desatualizado sem aviso (A-57).
- Mais de um sinal ativo ao mesmo tempo → todos aparecem; nenhum encobre o
  outro. Ordem de severidade: conflito, degradado, arquivo aberto.
- `etaFrom` posterior a `etaTo` → resultado vazio, sem erro.
- Filtro de cliente com valor inexistente → resultado vazio, `200`.
- Processo com `eta2 = null` e filtro de período ativo → excluído.
- Filtro `importerOutsideRj=false` → inclui apenas `false`, **não** `null`;
  cor indefinida não é o mesmo que "dentro do RJ".

**Dependências:** H-09, H-32
**Tamanho:** M

---

### H-16 — Entregar a Página Inicial com os cartões-resumo

> ✅ **CONCLUÍDA em 07/08/2026.** 18 testes próprios em 2 arquivos; suíte total
> em **536**. Primeira página de dado do projeto.
>
> **Conferido contra a planilha real:** os doze cartões batem com
> `GET /api/indicators` — 649 · 480 · 103 · 32 · 34 · 5 · 0 · 2 · 60 · 0 · 17 ·
> 14 —, e a soma das quatro categorias fecha: **103 + 32 + 480 + 34 = 649**. Com
> `category=em_andamento` o total cai para 103 e **atrasados e documentos
> pendentes não mudam** (17 e 14): todos eles já eram `em_andamento`, coerente
> com `isOverdue` e `hasPendingDocs` excluírem desembaraçado.
>
> **A-64 nasceu desta história, e só apareceu porque o tipo obriga.** A
> rastreabilidade atribuía `IND-16` a `H-16`, o backlog listava 11 cartões, e
> nenhum era `desembaracadosHoje` — indicador calculado e invisível, a mesma
> omissão que motivou a skill `/novo-indicador`, um degrau adiante. Descoberto
> quando `IndicatorsCounts` recusou a fixture do teste sem o campo; um tipo
> parcial teria escondido.
>
> **Quatro estados, e nenhum deles é zero.** `GET /api/indicators` responde
> `503` enquanto `lastReadAt` é `null`, e o cliente transforma isso em
> `semLeitura` — doze traços e uma frase dizendo que traço não é zero. Painel de
> zeros ali afirmaria que a planilha tem zero processos, indistinguível do caso
> em que ela realmente tem (regra inviolável 3).
>
> **A conferência de A-12 é exibida, não presumida.** Somar as quatro categorias
> no cliente não deriva indicador nem classifica nada: evidencia uma invariante
> que o domínio garante, e é o único lugar onde a quebra fica visível antes de
> alguém conferir na mão. Há teste com a soma divergindo de propósito.
>
> **O limiar de RNF-24 ficou no servidor.** `quarantineRate` vem calculado de
> `GET /api/quarantine` — a terceira rota, que o contrato da história não
> previa. Dividir `rowsQuarantined` por `rowsRead` no cliente e comparar com 2%
> seria regra de negócio fora de `src/domain/`.
>
> **Divergências resolvidas:** cinco. A lista de arquivos omitia toda a fiação
> de dados (`useIndicators`, os dois métodos do `api-client`), o `App.tsx` sem o
> qual a página é inalcançável, e **zero testes** — sétima, oitava e nona
> ocorrências do mesmo padrão. Mais a terceira rota, e o aval para a soma no
> cliente. `src/http/routes/quarantine.ts` ganhou `QuarantineResponse`: o corpo
> tem `generatedAt` e `sourceFileHash` nulos quando não houve leitura, e o
> `QuarantineReport` do disco os tipa como `string` — a mesma classe de defeito
> do `today` ausente em `H-15`.

**Objetivo:** a tela de entrada mostrar volume, as 4 categorias, urgências e
saúde da ingestão.

**Arquivos:**
- `web/src/pages/Home.tsx`
- `web/src/components/StatCard.tsx`
- `web/src/components/IngestionHealth.tsx`
- **Omitidos do plano original**, e necessários: `web/src/hooks/useIndicators.ts`
  (com `useQuarantine`), `web/src/api-client.ts`, `web/src/App.tsx`,
  `src/http/routes/quarantine.ts` (o tipo de resposta),
  `web/tests/{Home,IngestionHealth}.test.tsx` e `web/tests/support/api-stub.ts`

**Contrato fixado:** consome `GET /api/indicators` e `GET /api/health`.

Cartões, nesta ordem: Total · Desembaraçados · Em andamento · **Em desembaraço**
(A-12) · Fechado — aguardando draft · Canal Vermelho · Chegando hoje · Chegando
esta semana · Chegando em 15 dias · **Desembaraçados hoje** (A-64) ·
**Atrasados** · **Documentos pendentes** (A-40).

> **Eram 11, e A-64 fez doze.** A rastreabilidade sempre atribuiu `IND-01` a
> `IND-09` e `IND-14` a `IND-16` a esta história, mas a lista tinha 11 cartões e
> nenhum era `desembaracadosHoje` — `IND-16` ficava calculado e invisível.
> Mesmo precedente de A-12 e A-40. Encontrado ao implementar, porque
> `IndicatorsCounts` obriga o campo e a fixture do teste não compilou sem ele.

**Critérios de aceite:**
- **Dado** a Página Inicial carregada, **então** exibe os 12 cartões acima.
- **Dado** os cartões das 4 categorias, **então** a soma deles é exibida junto
  do total, e as duas conferem.
- **Dado** os cartões de Atrasados e Documentos pendentes, **então** eles são
  visualmente distintos dos cartões de volume, por serem urgências (A-40).
- **Dado** o estado `degradado`, **então** um aviso indica que o dado está
  congelado, com o horário da última leitura bem-sucedida.
- **Dado** linhas em quarentena, **então** o painel de saúde mostra a contagem
  e liga para o relatório.
- **Dado** filtros ativos, **então** todos os cartões os respeitam.

**Casos-limite:**
- Conjunto vazio → todos os cartões em `0`, sem erro.
- `quarantineRate` acima de 2% (RNF-24) → o painel de saúde destaca o valor.
- Nenhuma leitura concluída ainda → cartões exibem estado de carregamento, não
  zero.

**Dependências:** H-15, H-12
**Tamanho:** P

---

### H-17 — Entregar a Página Operacional com tabela, busca e calendário

> ✅ **CONCLUÍDA em 07/08/2026.** 72 testes próprios em 3 arquivos; suíte total
> em **617**.
>
> **Saiu em duas entregas**, porque `M` estava subestimado pelo mesmo padrão de
> `H-15`: três camadas, rota nova com sete parâmetros além dos onze filtros
> globais, e três componentes de interface. ① domínio, rota e calendário
> (PR #17) · ② página, tabela e calendário na tela. A ① tinha valor sozinha —
> `H-22` também depende de `GET /api/processes`.
>
> **Conferido contra a planilha real:** 169 ativos, que é exatamente 649 − 480
> desembaraçados; `search=NBSC` devolve 61 no conjunto todo e **7** entre os
> ativos; incluindo desembaraçados são 649 em 4 páginas, a última com 49; o
> filtro global `category=em_desembaraco` derruba para 32. O calendário traz
> **5 dias** e 8 grupos (navio, dia).
>
> **O caso-limite da ordenação foi provado sobre dado real**, não só em teste: a
> planilha tem **64 processos sem ETA2**, e eles ficam no índice **585 de 649**
> tanto em `asc` quanto em `desc` — verificado que do 585 em diante são *todos*
> nulos, nas duas ordens. É o caso que a implementação ingênua erra: inverter o
> comparador inteiro jogaria os 64 para o topo, e quem clicasse para inverter
> ETA2 veria uma tela de traços.
>
> **`matchesSearch` não reaproveita `normKey`, de propósito.** Aquele colapsa
> espaço interno porque existe para **agrupar** — `EVER  FAIR` e `EVER FAIR` são
> o mesmo navio. Na busca o espaço importa: quem digita um trecho de container
> espera casar o que vê. Há teste fixando a diferença nos dois sentidos.
>
> **O padrão de `activeOnly` difere entre página e rota, e isso é desenho.** A
> página parte de `true` (A-16); a rota, de `false`, porque serve também `H-22`,
> que precisa achar qualquer processo pela REF.
>
> **`arrivalCalendar` não mexeu em `expectedVessels`.** IND-12 não tem teto por
> definição (A-24) e está entregue desde `H-10`. O teto de 15 dias é da
> apresentação e vive em função nova — e veio para o servidor porque o corte é
> grande: dos 16 grupos da planilha real, só 8 caem dentro do horizonte.
>
> **Divergências resolvidas: seis.** A lista de arquivos não tinha
> `src/domain/` — busca e ordenação são regra —, nem `src/http/server.ts`, nem
> a fiação do cliente, nem teste algum. Mais a fonte do calendário, que não
> existia, e `hasPendingEdits`, que não é exercível até `H-23`.

**Objetivo:** listar processos ativos com busca por REF, BL e CNTR, e ver as
chegadas por navio.

**Arquivos:**
- `web/src/pages/Operational.tsx`
- `web/src/components/ProcessTable.tsx`
- `web/src/components/ArrivalCalendar.tsx`
- `src/http/routes/processes.ts`
- **Omitidos do plano original**, e necessários: `src/domain/process-query.ts` e
  `arrivalCalendar` em `src/domain/indicators.ts` (busca e ordenação são regra),
  `src/http/server.ts`, `src/http/routes/indicators.ts`,
  `web/src/api-client.ts`, `web/src/hooks/{useProcessQuery,useProcesses}.ts`,
  `web/src/App.tsx`, e os testes de `tests/domain/`, `tests/http/` e
  `web/tests/`

**Contrato fixado:** `GET /api/processes` com `search`, `activeOnly`, `sort`,
`order`, `limit`, `offset`.

"Processo ativo" := `statusCategory !== 'desembaracado'` (A-16).

**Critérios de aceite:**
- **Dado** a página carregada, **então** `activeOnly=true` é o padrão, e um
  controle permite incluir os desembaraçados.
- **Dado** a busca `"NBSC260"`, **então** retorna processos cujo REF, BL **ou**
  CNTR contenham o trecho, sem sensibilidade a caixa ou acento (A-39).
- **Dado** a coluna ETA2 clicada, **então** a ordenação alterna entre ascendente
  e descendente, com nulos sempre por último.
- **Dado** o calendário de chegadas, **então** agrupa por `eta2` e, dentro do
  dia, por navio, cobrindo de hoje a hoje + 15 dias.
- **Dado** um processo com edições pendentes, **então** a linha o indica
  visualmente (`hasPendingEdits`).
- **Dado** mais de 200 processos, **então** a paginação funciona e `total`
  reflete o conjunto filtrado inteiro.

**Casos-limite:**
- Busca vazia → nenhum filtro de busca aplicado.
- Busca com acento (`"MERCADORIA"` × `"mercadoría"`) → casa mesmo assim.
- Processo `fechado_aguardando_draft` → aparece na tabela com as demais colunas
  vazias e a categoria explícita.
- `eta2 = null` → linha exibida com traço, e no fim da ordenação por data.
- Dia sem chegadas → omitido do calendário, sem espaço vazio.

**Dependências:** H-15
**Tamanho:** M

---

### H-18 — Entregar a Página Clientes

> ✅ **CONCLUÍDA em 07/08/2026.** 24 testes próprios em 4 arquivos; suíte total
> em **641**.
>
> **A divergência que parou a fatia era um defeito já em produção.** A chave
> vazia é valor legítimo nos filtros de domínio aberto: `optionsOf` a oferece de
> propósito — "permitir filtrar por ele é o que torna o buraco investigável" — e
> `applyFilters` a casa desde `H-15`. Mas ela morria no meio, em `parseFilters`:
> `asList` descartava `''`, e `?goods=` virava lista vazia. O operador marcava
> "(em branco)" e recebia a base inteira, **sem erro nem aviso**, em nove
> filtros. `asKeyList` distingue parâmetro ausente de parâmetro presente e
> vazio, e vale só para os seis de domínio aberto — `?category=` continua sendo
> ausência, porque categoria em branco não existe.
>
> Sem a correção, o critério de aceite do clique seria insatisfazível
> justamente no grupo mais interessante, e falharia em silêncio: valor errado
> invisível, que é o que a regra inviolável 3 proíbe.
>
> **Conferido contra a planilha real:** `BAZAR` são 210 processos e 35,47% dos
> 592 com mercadoria preenchida — 5,7× o segundo colocado real, com 37. O grupo
> `(sem valor)` é o **segundo** maior de mercadoria, com 57, e o **maior** de
> clientes, com 38: o topo do ranking de clientes é um buraco de
> preenchimento. O recorte pela chave vazia devolve 57 e 38 sobre a base de 649
> — antes devolvia 649 nos dois casos.
>
> **`bazarShare` fica dentro da seção de mercadoria, acima da lista.** Ressalva
> lida depois do ranking não ressalva nada, e há teste que a procura dentro da
> seção certa e confirma a ausência na errada.
>
> **O clique aplica, não alterna.** `toggle` puro desmarcaria o valor já
> selecionado e levaria à Operacional com o filtro que o clique acabou de tirar.
> A ordem também é regra: `replaceState` antes de `navigate`, senão a página
> troca antes de o filtro existir.
>
> **Barras em `div`, não Recharts.** Ele segue instalado e sem uso; em `jsdom` o
> `ResponsiveContainer` mede 0×0 e não renderiza, o que obrigaria a mockar
> largura para testar o clique — que é o comportamento que importa aqui. A
> primeira dependência de gráfico de verdade é `H-19`.
>
> **Divergências resolvidas: três.** A lista de arquivos não tinha
> `web/src/App.tsx` — página que ninguém monta não existe, o precedente de
> `H-14` — nem teste algum; e os dois testes da casca que usavam `/clientes`
> como exemplo de marcador pendente migraram para `/performance`.

**Objetivo:** ranking e distribuição por CLT, IMPORTADOR e MERCADORIA.

> **`IND-13` entrou por A-65.** Ele era calculado desde `H-11`, servido em
> `rankings.goods`, e **nenhuma página o exibia** — junto com ele se perdia o
> `bazarShare` de A-34, que existe para o operador não ler o ranking de
> mercadorias como se fosse real. Mercadoria é a terceira dimensão do mesmo
> painel de distribuição, então cabe aqui sem história nova.

**Arquivos:**
- `web/src/pages/Clients.tsx`
- `web/src/components/RankingBar.tsx`
- **Omitidos do plano original**, e necessários: `web/src/App.tsx` (a página
  precisa ser montada em `PageOutlet`), `src/domain/filters.ts` (a chave vazia
  não sobrevivia à query), e os testes de `tests/domain/`, `tests/http/` e
  `web/tests/` — inclusive `web/tests/App.test.tsx`, que usava `/clientes` como
  exemplo de página pendente

**Contrato fixado:** consome `rankings.clients`, `rankings.importers`,
`rankings.goods` e `meta.bazarShare` de `GET /api/indicators`.

**Critérios de aceite:**
- **Dado** a página, **então** exibe três rankings Top 10 — por CLT, por
  IMPORTADOR e por MERCADORIA —, em barras horizontais ordenadas decrescentes.
- **Dado** um item do ranking clicado, **então** o filtro global correspondente
  é aplicado e a navegação leva à Página Operacional.
- **Dado** o rótulo de cada grupo, **então** exibe a primeira grafia encontrada,
  não a chave normalizada (A-26).
- **Dado** grupos empatados, **então** a ordem entre eles é alfabética.

- **Dado** o ranking de MERCADORIA, **então** `meta.bazarShare` é exibido
  **junto dele**, nunca em separado: o número qualifica o ranking, e lê-lo à
  parte não avisa ninguém (A-34, A-65). Medido: `BAZAR` são 210 processos,
  35,47% dos que têm mercadoria — 5,7× o segundo colocado.

**Casos-limite:**
- Menos de 10 grupos → exibe os existentes, sem espaços vazios.
- Grupo com chave vazia → rotulado `(sem valor)`. Medido: é o **segundo** maior
  grupo de mercadoria, com 57 processos.
- Conjunto vazio → mensagem de ausência de dados, não gráfico em branco.
- `bazarShare` é `null` → nenhum processo tem mercadoria preenchida; exibir a
  ressalva mesmo assim afirmaria distorção que não foi medida (A-34).

**Dependências:** H-11, H-15
**Tamanho:** P

---

### H-19 — Entregar a Página Performance

> ✅ **CONCLUÍDA em 07/08/2026.** 36 testes próprios em 4 arquivos; suíte total
> em **693**.
>
> **A ordenação foi a decisão que fez a página servir.** Os outros rankings
> ordenam por volume, porque respondem "quem tem mais"; a quebra de IND-22
> responde "onde dá para comparar", e as duas divergem na prática. Medido: dos
> **509** grupos de cliente, **425 não têm nenhum par completo** — ordenar por
> volume encheria o topo da tabela de traços e empurraria a informação para fora
> do corte. Ordenando por tamanho da amostra, **as 10 linhas exibidas em cada
> uma das três quebras abertas têm média de verdade**, verificado no arquivo
> real.
>
> **`leadTimeByGroup` não corta, e isso é o desenho.** Quem corta não pode ser
> quem conta: a rota precisa do total de grupos para dizer quantos ficaram de
> fora, e um teto no domínio apagaria esse número antes de alguém poder
> exibi-lo (regra inviolável 2). O corte acontece na rota, com `config.topN`, e
> o rodapé de cada tabela anuncia o que sobrou. Por isso a assinatura fixada no
> plano ficou **intacta** — a divergência que eu havia proposto deixou de
> existir.
>
> **A quebra por responsável não leva teto** — quatro chaves fixas, e A-28 exige
> as quatro. Sujeitá-la ao `topN` deixaria uma mudança de configuração quebrar
> um critério de aceite sem teste nenhum acusando. Mesmo tratamento que
> `rankings.responsible` já recebia.
>
> **Ela também é degenerada no dado real, e a tela diz isso.** Os 101 pares
> completos estão **todos** em `indefinido` — média 12,5, que é a global; os três
> responsáveis identificados têm amostra **zero**. Não é defeito: é A-31 e R-02
> medidos, com 477 linhas verdes que perdem o responsável. Sem a ressalva, ler
> "Colaborador 1: —" ao lado de "Indefinido: 12,5" leva à conclusão oposta.
>
> **O ranking por responsável não é clicável, de propósito.** A-18 faz o filtro
> `colaborador1` selecionar **junto** `colaborador1_outros_clientes`, enquanto o
> ranking os exibe separados por serem perguntas diferentes. Clicar numa linha
> de 120 e cair numa tela de 129 faria o operador desconfiar do número certo. O
> de agentes é clicável — lá não há a armadilha.
>
> **Conferido contra a planilha real:** 509 grupos de cliente, 35 de agente, 70
> de navio, 4 de responsável. O maior agente tem 246 processos e 7 atrasados, e
> há agente com **zero** atraso — o caso-limite não era hipótese. A soma das
> quebras reproduz o agregado exatamente: amostra 101 = 101, negativos 1 = 1,
> incompletos 547 = 547.
>
> **Divergências resolvidas: cinco** (a sexta se dissolveu, acima). A lista de
> arquivos não tinha `src/http/routes/indicators.ts` — **sexta ocorrência** da
> mesma omissão, e a que motivou a guarda de contrato —, nem o teste da rota,
> nem `docs/05-contratos-api.md`, nem `web/src/App.tsx`, nem teste algum. O
> formato do bloco na resposta não estava fixado em lugar nenhum. E
> `responsibleRanking` devolvia `label: 'colaborador1'`, que a primeira tela a
> exibi-lo imprimiria cru.
>
> **A fixture do stub quebrou no `typecheck`**, como em `H-32`: `IndicatorsResponse`
> passou a obrigar o bloco novo. É o argumento de D-18 em uso — tipo parcial
> teria escondido.

**Objetivo:** tempo médio de envio documental, quebrado por cliente, agente,
navio e responsável, com o denominador visível — e os rankings de volume por
agente e por responsável.

> **`IND-17` e `IND-20` entraram por A-65.** Os dois eram calculados desde
> `H-11`, servidos em `rankings.agents` e `rankings.responsible`, e **nenhuma
> página os exibia**. Com `IND-17` se perdia o `overdueCount` de A-27, que foi
> acrescentado justamente porque contagem por agente não atendia ao objetivo
> declarado: o que importa é quem acumula atraso. Esta página já agrupa por
> agente e por responsável — contagem é outra métrica sobre os mesmos grupos, e
> vive ao lado do tempo médio sem página nova.

**Arquivos:**
- `web/src/pages/Performance.tsx`
- `src/domain/indicators.ts` (função de quebra)
- **Omitidos do plano original**, e necessários: `src/http/routes/indicators.ts`
  (sexta ocorrência da omissão), `tests/http/indicators.test.ts`,
  `docs/05-contratos-api.md`, `web/src/App.tsx`,
  `web/src/components/RankingBar.tsx`, `web/tests/support/api-stub.ts`, e os
  testes de `tests/domain/` e `web/tests/` — inclusive `web/tests/App.test.tsx`,
  que usava `/performance` como exemplo de página pendente

**Contrato fixado:**

```ts
export function leadTimeByGroup(p: Process[], key: (x: Process) => string,
                                label: (x: Process) => string): (GroupCount & LeadTime)[]
```

**Critérios de aceite:**
- **Dado** a página, **então** exibe quatro quebras: por cliente, agente, navio
  e responsável.
- **Dado** cada linha, **então** mostra a média em dias **e** o `sampleSize` ao
  lado (A-42).
- **Dado** um grupo sem nenhum par completo, **então** a média é exibida como
  traço, não como zero.
- **Dado** o indicador "Tempo médio até desembaraço", **então** a página exibe
  uma nota declarando-o fora de escopo por ausência da data de presença de
  carga, com referência a §4 da especificação.
- **Dado** intervalos negativos, **então** a contagem de excluídos é exibida.
- **Dado** o ranking de agentes (`IND-17`), **então** cada linha exibe a
  contagem **e** o `overdueCount` ao lado — sem ele o ranking responde a
  pergunta errada (A-27, A-65). Medido: `B&M` tem 246 processos e 7 atrasados.
- **Dado** o ranking por responsável (`IND-20`), **então** as **quatro** chaves
  aparecem, inclusive `indefinido` e com contagem zero (A-17, A-28). Medido:
  `indefinido` é o maior grupo, com 484 de 649 — a limitação estrutural de A-31
  precisa ficar visível, não escondida.

**Casos-limite:**
- Grupo com `sampleSize: 1` → média exibida com o denominador `1`, sem corte
  mínimo; omitir seria inventar regra (A-42).
- Todos os pares incompletos → todas as médias em traço.
- Média fracionária → uma casa decimal.
- Agente com processos e **zero** atrasados → `overdueCount` exibido como `0`,
  não omitido: zero atraso é resultado, e a coluna em branco pareceria falta de
  dado.

**Dependências:** H-11, H-13, H-15
**Tamanho:** P

---

### H-20 — Entregar a Página Alertas

> ✅ **CONCLUÍDA em 07/08/2026.** 15 testes próprios em 1 arquivo; suíte total
> em **708**.
>
> **O backlog se contradizia, e o critério de aceite venceu.** Ele manda o
> processo aparecer **uma única vez** agrupando tipos — decisão do usuário em
> 06/08/2026, A-60 —, enquanto o caso-limite mandava o oposto: "aparece três
> vezes, uma por tipo". Era texto anterior à decisão, que ficou. Corrigido
> abaixo.
>
> **O agrupamento preserva a ordem de primeira aparição, e isso não é detalhe.**
> A lista chega ordenada por severidade, depois `eta2` com nulos por último, e
> `sourceRow` no desempate. Como o primeiro alerta de um processo é o mais
> severo dele, a posição de primeira aparição **já é** a posição correta do
> grupo — a ordenação do servidor é herdada inteira, sem reordenar nada no
> cliente (regra inviolável 6). Verificado no arquivo real: as 40 linhas viram
> 25 grupos e a sequência de severidade **não quebra em nenhum ponto**.
>
> **Os dois zeros da planilha significam coisas opostas, e a tela os separa.**
> `chegadas_hoje: 0` é medido — nada chega hoje. `processos_parados: 0` é **não
> mensurável**: a rota passa histórico vazio até `H-28`. Exibi-los igual
> afirmaria que nada está parado, quando o que se sabe é que ainda não dá para
> saber. O de parados vira traço, com a nota explicando o porquê, o limiar de 15
> dias declarado como premissa (A-32) e a ausência de retroatividade (A-43).
>
> **Conferido contra a planilha real:** 40 linhas achatadas para **25**
> processos; 12 com um tipo, 11 com dois, **2 com três** — o backlog dizia "um
> deles", e são dois. Contagens: `eta_vencida` 17, `documentacao_pendente` 14,
> `chegadas_7_dias` 7, `canal_vermelho` 2, os outros dois zerados. **Zero
> processos concluídos na fila**, que é o filtro de A-59 funcionando. E **zero
> alertas com `eta2` nulo** — o caso-limite não é observável no arquivo hoje, e
> por isso é coberto por fixture.
>
> **Divergências resolvidas: quatro.** ① a contradição do backlog · ② a regra de
> posição do grupo, que ninguém tinha escrito · ③ seis arquivos fora da lista,
> entre eles `web/tests/support/api-stub.ts` — o stub **rejeita** rota não
> prevista, então sem `/api/alerts` toda tela em `/alertas` quebraria, inclusive
> as três asserções da casca herdadas da `H-19` · ④ o zero não mensurável de
> ALE-06.

**Objetivo:** lista única dos alertas, ordenada por severidade.

**Arquivos:**
- `web/src/pages/Alerts.tsx`
- `web/src/components/AlertRow.tsx`
- **Omitidos do plano original**, e necessários: `web/src/api-client.ts`
  (`getAlerts` não existia), `web/src/hooks/useAlerts.ts`, `web/src/App.tsx`,
  `web/tests/support/api-stub.ts`, `web/tests/Alerts.test.tsx` e
  `web/tests/App.test.tsx`

**Contrato fixado:** consome `GET /api/alerts`.

**Critérios de aceite:**
- **Dado** a página, **então** os alertas aparecem na ordem de severidade
  definida em `H-14`.
- **Dado** um processo com mais de um alerta, **então** ele aparece **uma única
  vez**, agrupando seus tipos — decisão do usuário em 06/08/2026, achado A-60.
  A rota continua achatada; o agrupamento é de apresentação. Medido na planilha
  real: 40 linhas para 25 processos distintos, com um deles em 3 tipos.
- **Dado** o cabeçalho, **então** exibe a contagem por tipo, incluindo os
  seis tipos.
- **Dado** um alerta clicado, **então** abre o detalhe do processo.
- **Dado** `historyStartedAt = null`, **então** a ressalva de que ainda não há
  histórico é exibida, em vez de data vazia (A-61).
- **Dado** o alerta "Processos parados", **então** o limiar em uso é exibido, e
  marcado como premissa (A-32).
- **Dado** que o histórico começou recentemente, **então** `historyStartedAt` é
  exibido, para não sugerir retroatividade inexistente (A-43).

**Casos-limite:**
- Nenhum alerta → mensagem afirmativa de ausência de pendências, não tela vazia.
- Um processo em três tipos de alerta → aparece **uma vez, com os três tipos**.
  ⚠️ O texto original dizia "aparece três vezes, uma por tipo" — anterior à
  decisão de 06/08/2026 (A-60), e contraditório com o critério de aceite acima.
  Corrigido ao fechar `H-20`. Medido: 2 processos em 3 tipos.
- Alerta com `eta2 = null` → exibido por último em seu grupo.

**Dependências:** H-14, H-15
**Tamanho:** P

---

### H-21 — Entregar a Página Histórico

**Objetivo:** evolução mensal de volume, desembaraçados e Canal Vermelho.

**Arquivos:**
- `web/src/pages/History.tsx`
- `src/http/routes/history.ts`

**Contrato fixado:** `GET /api/history/monthly`.

**Critérios de aceite:**
- **Dado** a página, **então** exibe uma série mensal com as três medidas.
- **Dado** que o histórico começou em determinada data, **então** a página
  declara explicitamente que não há dado anterior a ela (A-43).
- **Dado** `truncated: true`, **então** um aviso indica que a janela pedida
  excede o histórico existente.
- **Dado** um mês sem evento algum, **então** aparece na série com os valores do
  mês anterior mantidos, não com zero — ausência de mudança não é ausência de
  processos.

**Casos-limite:**
- Primeiro dia de uso, sem histórico → gráfico com um único ponto e aviso
  explicando o motivo.
- `history.jsonl` ausente ou apagado → a série reinicia; nenhum erro.
- `months=60` com histórico de 1 mês → `truncated: true`.

**Dependências:** H-28, H-15
**Tamanho:** P

---

### H-22 — Entregar a tela de detalhe do processo

> ✅ **CONCLUÍDA em 07/08/2026.** 23 testes próprios em 3 arquivos; suíte total
> em **731**.
>
> **A rota do contrato não existia.** O backlog dizia "Contrato fixado:
> `GET /api/processes/:ref`" e listava **um único arquivo**, a página. Mas só
> `GET /api/processes` estava registrada: o `:ref` estava documentado em
> `docs/05-contratos-api.md` desde o plano e **nunca fora implementado**. É a
> maior omissão de lista até aqui — faltava o lado servidor inteiro. Por isso a
> história saiu em duas entregas, como `H-15`, `H-17` e `H-19`.
>
> **A REF é resolvida por `normKey`, não por igualdade literal.** TD-06 define a
> identidade de REF assim, e é por essa chave que a ingestão detecta duplicata.
> Igualdade literal daria `404` para uma URL em caixa diferente, num processo que
> o domínio considera existente. A unicidade está garantida na origem: REF
> repetida vai para quarentena e não chega ao estado. Medido: 649 REFs, todas
> distintas, **zero caractere fora de `[A-Za-z0-9._-]`** — nenhuma barra, nenhum
> espaço —, então `:ref` como parâmetro de caminho é seguro.
>
> **`daysInCurrentCategory` virou `number | null`.** O contrato documentado
> trazia `0`, e zero ali **afirma** que a categoria mudou hoje — indistinguível
> de "não há como saber". Sem histórico gravado seria sempre zero, mentindo em
> 649 processos. Mesmo argumento de `averageDays` em IND-22 e do traço de
> ALE-06. O documento foi corrigido.
>
> **A explicação da anomalia estava trancada.** `describeAnomaly` produzia
> exatamente o texto que o critério pede e era **privada**, alimentando só o
> relatório de quarentena. Foi exportada, e a rota enriquece cada anomalia com a
> descrição. `ProcessDto.anomalies` continua sendo apenas os códigos — a tabela
> da Operacional não precisa do texto, e engordá-la para servir uma tela custaria
> em todas as outras.
>
> **O hook tem cinco estados, não quatro.** `naoEncontrado` existe porque `404` é
> resposta legítima do servidor: a REF pode ter saído da planilha entre a leitura
> que montou o link e a atual. Tratá-la como erro genérico daria "algo deu
> errado" onde a resposta certa é "esta REF não existe" — mesma família da
> distinção que `NoReadYetError` faz.
>
> **Primeira história conduzida pela `/nova-pagina`, e o passo 1 dela pagou
> sozinho:** os três comandos de conferência mostraram que faltavam `getProcessDetail`
> e o hook, e que o stub casava `path === '/api/processes'` — que **não** casa com
> `/api/processes/FT074.26`. Sem a extensão, toda renderização do detalhe falharia.
>
> **A guarda `paginas-montadas` passou a cobrir o detalhe**, a única página que
> ficava fora dela por viver em `PROCESS_DETAIL_PAGE` e não em `NAV_PAGES`.
>
> **Conferido contra a planilha real:** `FT074.26` devolve a anomalia com o texto
> `"RG preenchido com categoria em_andamento"`; a mesma REF em minúscula resolve
> para o mesmo processo; REF inexistente devolve `404`. **4 processos de 649** têm
> anomalia — as 3 de A-29 mais o intervalo negativo de A-30. O
> `fechado_aguardando_draft` `FT616.26` tem **9 campos vazios** mais `eta2` e
> `registrationDate` nulos: 11 traços numa tela. **547 de 649** têm algum campo
> fora de escopo preenchido, e a Coluna P tem **exatamente 1**, confirmando A-50.
>
> **Divergências resolvidas: quatro.** ① a rota inexistente · ② três campos do
> contrato dependendo de `H-23` e `H-28`, servidos vazios de verdade · ③
> `describeAnomaly` privada · ④ toda a fiação de cliente fora da lista.

**Objetivo:** ver todos os campos de um processo, incluindo o texto original de
STATUS e os campos fora de escopo.

**Arquivos:**
- `web/src/pages/ProcessDetail.tsx`
- **Omitidos do plano original**, e necessários: `src/http/routes/processes.ts`
  (a rota `:ref` **não existia**), `tests/http/processes.test.ts`,
  `src/domain/process-builder.ts` (`describeAnomaly` exportada),
  `docs/05-contratos-api.md`, `web/src/api-client.ts`,
  `web/src/hooks/useProcessDetail.ts`, `web/src/App.tsx`,
  `web/tests/support/api-stub.ts`, `web/tests/ProcessDetail.test.tsx`,
  `web/tests/App.test.tsx` e `web/tests/paginas-montadas.test.tsx`

**Contrato fixado:** `GET /api/processes/:ref`.

**Critérios de aceite:**
- **Dado** o detalhe aberto, **então** exibe o `statusRaw` original — que §2.1
  determina ser exibido apenas aqui, nunca usado para agrupar ou contar.
- **Dado** o detalhe, **então** exibe `boletoRaw`, `paymentRaw` e `columnPRaw`
  como texto puro, rotulados como fora de escopo para indicadores.
- **Dado** o detalhe, **então** exibe a categoria classificada ao lado do texto
  original, deixando visível a regra aplicada.
- **Dado** anomalias na linha, **então** elas são listadas com a explicação
  correspondente.
- **Dado** o histórico de mudanças de categoria daquele REF, **então** é
  exibido em ordem cronológica.

**Casos-limite:**
- REF inexistente → `404` e tela de não encontrado.
- Processo `fechado_aguardando_draft` → campos vazios exibidos como traço, com
  a categoria explicada.
- Processo sem nenhum evento de histórico → seção exibida vazia com explicação.
  ⚠️ Até `H-28` a ausência é **sempre** por não haver histórico gravado, nunca
  por o processo não ter mudado. A tela diz qual das duas, e há teste afirmando
  que ela **não** diz a segunda.

**Dependências:** H-17
**Tamanho:** P

---

## Épico E5 — Edição e escrita na planilha

### H-23 — Editar campos na tela, enfileirando sem tocar no arquivo

> ✅ **CONCLUÍDA em 07/08/2026.** 64 testes próprios em 5 arquivos; suíte total
> em **812**. Saiu em três entregas — ① fila e rotas · ② projeção · ③ interface —,
> pelo mesmo padrão de `H-15`, `H-17`, `H-19` e `H-22`.
>
> **A projeção era o coração da história e não estava na lista de arquivos.**
> Os arquivos previstos cobriam persistência, rotas e dois componentes; nada
> aplicava a fila sobre os processos lidos, e sem isso o critério "a tabela e os
> indicadores refletem o valor novo" não existiria. `pendingEditsCount` e
> `hasPendingEdits` estavam **fixos em zero e `false`** desde `H-02`.
>
> **A re-derivação reconstrói a linha crua e reusa `buildProcesses`.** Editar um
> campo mexe em três coisas derivadas: `clientRaw` muda `clientKey` — sem isso
> os rankings agrupariam pelo valor velho —, `statusRaw` muda a categoria por
> TD-01, e `registrationDate` cria `RG_SEM_DESEMBARACO` (A-05). Reimplementar
> TD-01 e a normalização sobre `Process` daria **duas implementações da mesma
> regra**, que é o que o precedente de `isOverdue` proíbe. `toRawRow` vive ao
> lado do mapa de colunas, então ida e volta não se separam.
>
> **A ida e volta pela data quebrou, e o teste pegou.** `toRawRow` emitia
> `AAAA-MM-DD` como texto, e `parseCellDate` aceita `Date`, serial numérico e
> `dd/MM/yyyy` — **não** ISO. Duas asserções reprovaram com `DATA_SEM_ANO`.
> Corrigido para emitir `Date`, que é o que o leitor produz; a volta é exata
> porque toda data do domínio já é meia-noite UTC.
>
> **A projeção é aplicada em `getState()`, lendo a fila a cada chamada.** Ela
> muda **sem releitura do arquivo** — um `POST /api/edits` não dispara o
> watcher —, e um cache aqui precisaria de invalidação vinda das rotas. O
> arquivo tem alguns KB; a alternativa custa um modo de falha em que a tela
> mostra edição que já não existe.
>
> **O descarte virou lápide.** O desenho original usava `value: null` **como**
> lápide, e era por isso que `03-modelo-dados.md` dizia que ele cancelava a
> edição anterior. Ao dar a `null` o sentido de célula vazia, a divergência
> removeu o mecanismo sem repor outro. Reescrever o arquivo violaria o
> **append-only** que o mesmo parágrafo declara. Então o descarte anexa
> `{"ts":"…","discarded":"<id>"}`, e `"*"` para o esvaziamento.
>
> **`StoreState` ganhou campo obrigatório e o `typecheck` expôs nove fábricas
> de estado**, exatamente como em `H-32`. É o argumento de D-18 em uso.
>
> **Conferido contra a planilha real:** editar `statusRaw` de `FT074.26` para
> `DESEMBARAÇADA` leva a categoria de `em_andamento` a `desembaracado`, e os
> indicadores acompanham — desembaraçados **480 → 481**, em andamento
> **103 → 102**. **Um único objeto muda** entre os 649, e nada é gravado no
> `.xlsx`.
>
> **Divergências resolvidas: quatro.** ① a projeção ausente da lista · ②
> `03-modelo-dados.md` contradizendo o backlog sobre `value: null` · ③ sete
> arquivos de fiação, entre eles o registro no `server.ts` e os quatro
> marcadores de pendência do contrato · ④ os dois componentes sem página, que
> foram para o detalhe do processo.
>
> **Duas decisões:** `crypto.randomUUID()` em vez de ULID, sem dependência nova
> — o exemplo do contrato foi corrigido —, e o painel de pendências mostra só as
> do REF aberto, com o esvaziamento global rotulado pelo alcance que tem.

**Objetivo:** o operador altera um processo, vê o efeito imediatamente, e nada
é gravado no `.xlsx`.

**Arquivos:**
- `src/io/edit-queue.ts`
- `src/http/routes/edits.ts`
- `web/src/components/EditProcessForm.tsx`
- `web/src/components/PendingEditsPanel.tsx`
- `tests/io/edit-queue.test.ts`
- **Omitidos do plano original**, e necessários: `src/domain/editable-fields.ts`
  e `src/domain/process-projection.ts` (regra, então domínio), `toRawRow` em
  `src/domain/process-builder.ts`, `src/app/process-store.ts` (a projeção),
  `src/http/server.ts`, `src/http/routes/{health,processes}.ts`,
  `docs/05-contratos-api.md`, `docs/03-modelo-dados.md`, `web/src/api-client.ts`,
  `web/src/hooks/useProcessDetail.ts`, `web/src/pages/ProcessDetail.tsx`,
  `web/tests/support/api-stub.ts` e os testes de `tests/domain/`, `tests/http/`
  e `web/tests/`

**Contrato fixado:** `POST /api/edits`, `GET /api/edits`, `DELETE /api/edits/:id`,
`DELETE /api/edits`, com a lista de campos editáveis de
`05-contratos-api.md §3`.

```ts
export interface PendingEdit { id: string; ts: string; ref: string; sourceRow: number
                               field: string; value: string | null; previous: string }
export function enqueue(cmd: EditCommand): PendingEdit
export function consolidated(): PendingEdit[]   // última entrada por (ref, field)
export function discard(id: string): boolean
export function discardAll(): number
```

**Critérios de aceite:**
- **Dado** uma edição enviada, **então** ela é anexada a
  `data/pending-edits.jsonl` e o `.xlsx` **não** é modificado.
- **Dado** duas edições do mesmo `(ref, field)`, **então** `consolidated()`
  devolve apenas a última.
- **Dado** uma edição enfileirada, **então** a tabela e os indicadores refletem
  o valor novo, com marcação de pendência.
- **Dado** o campo `statusCategory`, **quando** se tenta editá-lo, **então** a
  API devolve `400 CAMPO_NAO_EDITAVEL` — é derivado.
- **Dado** `DELETE /api/edits`, **então** a fila é esvaziada e a interface volta
  a mostrar os valores do arquivo.
- **Dado** o servidor reiniciado, **então** a fila persiste, porque está em
  disco.

**Casos-limite:**
- Editar `eta2` para `null` (limpar a data) → aceito; `value: null` significa
  célula vazia, e não cancelamento — o cancelamento é `DELETE`.
  ⚠️ `docs/03-modelo-dados.md` §3.2 dizia o oposto até `H-23`. Corrigido lá, com
  a lápide documentada como o mecanismo que substituiu o `null`.
- Editar um campo para o mesmo valor atual → aceito e enfileirado; a decisão de
  não gravar nada é do `xlsx-surgeon`, não da fila.
- Editar processo inexistente → `404`.
- `statusRaw` com 1001 caracteres → `400 CORPO_INVALIDO`.
- Editar `statusRaw` para `"DESEMBARAÇADA"` → a categoria exibida muda para
  `desembaracado` imediatamente, pela reclassificação da projeção.

**Dependências:** H-08
**Tamanho:** M

---

### H-24 — Alterar células dentro do `.xlsx` preservando o arquivo byte a byte

> ✅ **CONCLUÍDA em 06/08/2026.** 25 testes próprios; suíte total em 855.
> Seis divergências do plano resolvidas **antes** da primeira linha de código,
> duas delas bloqueantes: o critério de entradas idênticas contradizia o de
> composição de `cellXf` (`xl/styles.xml` tem de mudar no passo 5b), e TD-05.1
> estava escrita só para `H-27`. `ADR-0004` carregava três trechos superados,
> emendados sem apagar o original. A `formatado.xlsx` **não tinha** formatação
> condicional, validação, autofiltro, coluna oculta nem fórmula — o primeiro
> critério de aceite passaria vazio; `tools/build_fixtures.py --enriquecer`
> injeta os cinco sem depender do arquivo real.
>
> **O `revisor-xml` reprovou na primeira invocação, por dois defeitos reais.**
> (1) `<row/>` auto-fechada: o ponto de inserção caía entre a `/` e o `>`,
> gerando XML malformado — o Excel descartaria a aba `2026` ao "reparar".
> (2) Célula ausente recebendo data saía sem `s=`, caía em `cellXfs[0]` (Geral)
> e o Excel exibiria `46263` — o defeito de A-56 no caso que o próprio backlog
> chama de mais provável. A suíte anterior gravava texto em célula ausente e
> data em célula existente, e nunca cruzava os dois eixos.
>
> Também da revisão: `count` de `sharedStrings` conta **referências**, não
> entradas; `toExcelSerial` trunca no dia em UTC, senão `18:30` viraria o dia
> seguinte; o `numFmt` de data vem do **próprio arquivo**, não de um embutido;
> `xl/calcChain.xml` virou a quarta entrada tocada, com repasse do atributo `i`;
> e a célula mestre de fórmula compartilhada é **recusada com erro**, porque
> reescrevê-la exigiria traduzir a fórmula.
>
> Um defeito próprio apareceu no teste: a regex de `findCell` tratava `/>` como
> sufixo opcional e varria até o `</c>` da célula seguinte, atravessando linhas.
> O mesmo erro estava no helper do teste, o que quase o escondeu.
>
> **PD-02 fechada**: a saída foi aberta no Excel real — sem aviso de reparo,
> `29/ago` nos três casos, cores, autofiltro, validação e coluna oculta
> intactos. Abriu **PD-04** (célula ausente herda `fillId=0` da coluna) e
> **PD-05** (`calcChain` só tem teste sintético).
>
> > **`PD-05` continua aberta — e a tentativa de fechá-la, em 13 e 14/08/2026,
> > encontrou um defeito real.** Fica registrada aqui porque é o melhor exemplo
> > que o projeto tem de prova que não prova.
> >
> > Faltava uma fixture com cadeia de cálculo: `tools/build_fixtures.py
> > --formulas` passou a gerar `tests/fixtures/formulas.xlsx` de `basico.xlsx`,
> > com três fórmulas encadeadas na coluna `I` e `xl/calcChain.xml` declarada em
> > `[Content_Types].xml` e relacionada em `xl/_rels/workbook.xml.rels`. Editar
> > a célula da primeira entrada mudou **duas** entradas do zip — a aba e a
> > cadeia. **Aberta no Excel real: sem aviso de reparo, e o recálculo produziu
> > as datas dependentes da célula editada.**
> >
> > **O `revisor-xml` reprovou assim mesmo, e estava certo.** A primeira versão
> > da fixture usava entradas só com `r` — a **mesma forma** do teste sintético
> > que ela deveria superar. O que ela acrescentava era embalagem, não
> > cobertura. E era justamente a forma não coberta que escondia o defeito: o
> > repasse do `i` casava apenas `<c r="…"/>`, e o Excel emite também `l`, `s`,
> > `t` e `a` nessas entradas. Em toda cadeia produzida pelo Excel de verdade o
> > `i` era **perdido**, deixando a cadeia sem índice de aba — a entrada órfã
> > que a própria `PD-05` chama de hipótese mais provável de aviso de reparo.
> > Corrigido, com a segunda entrada da fixture levando `l="1"` e um teste que
> > **reprova o código anterior**, conferido revertendo-o.
> >
> > O critério da pendência tinha sido reescrito no ato de fechá-la — ela pede
> > arquivo "produzido pelo próprio Excel", e o entregue foi produzido por nós e
> > apenas **aberto** no Excel. A diferença não era formal: era exatamente a
> > forma de cadeia do defeito. `PD-05` segue aberta, com o critério original.
> >
> > **Achado junto:** o cache de valor das células **dependentes** não é
> > invalidado — não se marca `fullCalcOnLoad` em `<calcPr>` —, e elas exibiram
> > o valor antigo até um recálculo manual. Não é corrupção, é o cache do Excel
> > funcionando como projetado, mas é enganoso. Inalcançável na planilha real:
> > medido em 13/08/2026, lendo o arquivo em memória, a aba `2026` tem **zero**
> > células com fórmula e nenhuma `calcChain` no zip. Registrado no cabeçalho de
> > `src/io/xlsx-surgeon.ts` em vez de virar pendência sem gatilho.

**Objetivo:** trocar o valor de células específicas sem reserializar o
workbook, mantendo cores, filtros, comentários, validações e larguras.

**Arquivos:**
- `src/io/xlsx-surgeon.ts`
- `tests/io/xlsx-surgeon.test.ts`
- `tests/fixtures/formatado.xlsx`
- `tests/fixtures/data-vazia.xlsx`

**Contrato fixado:**

```ts
export interface CellEdit { sourceRow: number; column: string; value: string | number | Date | null }
export interface SurgeryResult { buffer: Uint8Array; cellsWritten: number; entriesPreserved: number }
export function applyCellEdits(original: Uint8Array, edits: CellEdit[],
                               sheetPath: string): SurgeryResult
```

`sheetPath` é o caminho da aba dentro do zip (ex.: `xl/worksheets/sheet1.xml`).
Ele é resolvido pelo chamador, não descoberto aqui: `readWorkbook` (`H-03`)
devolve `sheetName`, e o mapeamento nome → caminho vem de `xl/workbook.xml`
(elemento `<sheet>`, atributo `r:id`) cruzado com
`xl/_rels/workbook.xml.rels`. `H-03` passa a expor esse caminho em
`ReadResult.sheetPath`.

Implementação fixada: descompactar com `fflate@0.8.3`, alterar apenas os nós
`<c>` alvo em `xl/worksheets/<sheet>.xml`, acrescentar entradas novas a
`xl/sharedStrings.xml` quando necessário, recompactar mantendo todas as demais
entradas do zip inalteradas. **`workbook.xlsx.writeFile()` do ExcelJS não é
usado** (ADR-0004).

`entriesPreserved` conta as entradas do zip cujo hash bate com o original. O
total depende do arquivo — **não fixe número literal no teste**: derive da
contagem de entradas da fixture menos as efetivamente tocadas, senão o teste
quebra ao regenerar a fixture.

**Critérios de aceite:**
- **Dado** `tests/fixtures/formatado.xlsx` com cores, autofiltro, comentário,
  validação de dados e formatação condicional, **quando** uma célula de texto é
  alterada, **então** o arquivo resultante mantém **todos** esses elementos.
- **Dado** o arquivo resultante, **então** todas as entradas do zip que não
  sejam a planilha alvo, `xl/sharedStrings.xml`, `xl/styles.xml` e
  `xl/calcChain.xml` são **byte a byte idênticas** às originais, verificado por
  hash entrada a entrada. A igualdade vale sobre o **conteúdo descomprimido**:
  recompactar reproduz o conteúdo, não o fluxo deflate do Excel.
- **Dado** que uma fórmula foi removida, **então** a entrada correspondente sai
  de `xl/calcChain.xml`, e o atributo `i` — o índice da aba, herdado da entrada
  anterior — é repassado à seguinte. Entrada órfã na cadeia de cálculo é a
  hipótese mais provável de aviso de reparo ao abrir.
- **Dado** que `xl/styles.xml` só pode diferir quando o passo 5b de TD-05.1
  dispara, **então** a diferença é **estritamente aditiva**: todo `xf` que já
  existia permanece idêntico, e mudam apenas `count` e o `xf` acrescentado. Numa
  edição de texto — ou de data em célula que já tem formato de data —
  `xl/styles.xml` também é byte a byte idêntico.
- **Dado** uma célula alterada, **então** o atributo `s=` (estilo) dela é
  **preservado** — mudar valor não muda cor.
- **Dado** uma data, **então** é gravada como serial numérico do Excel **e** a
  célula recebe um `cellXf` com `numFmt` de data. Se o estilo atual já tiver
  formato de data, é preservado; se não, um estilo é composto pelo algoritmo de
  TD-05.1 — mantendo fonte, borda e preenchimento, trocando apenas o
  `numFmtId` (A-56).
- **Dado** uma célula de data que estava vazia e com estilo Geral
  (`numFmtId=0`), **quando** `2026-08-29` é gravada nela, **então** o Excel
  exibe `29/ago`, **não** `46263`. A fixture do cenário é
  `tests/fixtures/data-vazia.xlsx`.
- **Dado** `value: null`, **então** a célula fica vazia, preservando o estilo.
- **Dado** o arquivo resultante, **então** o Excel o abre sem aviso de reparo.

**Casos-limite:**
- Célula que não existe no XML (linha com célula ausente) → nó `<c>` novo é
  inserido na posição correta pela ordem de coluna.
- String já presente em `sharedStrings.xml` → reutiliza o índice, sem duplicar.
- String nova → acrescentada ao fim, com `count` e `uniqueCount` atualizados.
- Célula que continha fórmula → o nó `<f>` é removido junto com a substituição
  do valor, para não deixar fórmula órfã apontando para valor fixo.
- Gravar data em célula da coluna O (DOCS ENVIADOS), que tem **79,3% de células
  vazias** no arquivo real → o formato de data precisa ser garantido, não
  presumido (A-56). É o caso mais provável de ocorrer na prática.
- Texto com `&`, `<` e `"` → escapado corretamente no XML.
- Texto com quebra de linha → preservado, com `xml:space="preserve"`.
- Lista de edições vazia → devolve o buffer original inalterado e
  `cellsWritten: 0`.
- Linha auto-fechada (`<row r="3" .../>`, a forma que o Excel emite para linha
  formatada sem célula) → é aberta antes de inserir. Calcular a posição sem
  reescrever o XML faz o ponto de inserção cair entre a `/` e o `>`, e o arquivo
  deixa de ser bem-formado.
- Célula ausente do XML recebendo **data** → sem `s=` para preservar, o estilo é
  herdado da linha (`customFormat="1"`) ou da coluna (`<cols>`), e o `numFmt` de
  data é composto por TD-05.1 sobre ele. Emitir `<c>` sem estilo a jogaria em
  `cellXfs[0]` (Geral), reproduzindo o defeito de A-56 justamente no caso mais
  provável.

  > O estilo da coluna pode trazer `fillId=0`, e então a célula criada sai sem
  > preenchimento. Conferido no Excel em 06/08/2026 sobre `data-vazia.xlsx`: a
  > data aparece como `29/ago`, correta, e a célula fica branca — o que ali
  > combina com as vizinhas, também ausentes. Mantido assim porque é o que o
  > próprio Excel faz ao digitar numa célula vazia, e herdar do irmão seria
  > inferir intenção. **PD-04** foi fechada em `H-25`, contra o arquivo real — ver o bloco de conclusão acima.
- Célula **mestre** de fórmula compartilhada (`<f t="shared" ref="…" si="N">`) →
  **recusada com erro**. Ela carrega a definição que as dependentes do mesmo
  `si` referenciam; reescrevê-la noutra âncora exigiria traduzir a fórmula, o
  que a regra inviolável 3 proíbe. A **dependente** (`<f t="shared" si="N"/>`,
  sem `ref`) afeta só a si mesma e é permitida.

**Dependências:** H-03
**Tamanho:** M

---

### H-25 — Proteger a escrita com as seis defesas de integridade

> ✅ **CONCLUÍDA em 13/08/2026.** 42 testes próprios — 31 em
> `tests/app/write-guard.test.ts`, 11 em `tests/io/backup-manager.test.ts` —,
> mais 6 acrescentados a arquivos já existentes; suíte total em **903**. Seis divergências do plano resolvidas na abertura: `hashFile` e
> `hashBytes` exportados do leitor, o estado `escrevendo` ganhando quem o
> produza — a guarda de `409` em `POST /api/reload` era código morto desde
> `H-08` —, `backupPath` e `edits` no `LogEntry`, `initWriteGuard` como ponto de
> injeção espelhando `initStore`, arquivo de teste próprio para o
> `backup-manager`, e o tipo `Conflict`, que não existia em lugar nenhum.
>
> **O `revisor-xml` foi invocado quatro vezes e reprovou três.** Nenhum dos
> quatro defeitos foi pego pela suíte, e **dois deles foram introduzidos pelas
> correções dos anteriores** — o argumento mais forte a favor do revisor começar
> cego.
>
> (1) **A escrita endereçava a célula pelo `sourceRow` congelado na fila.**
> `docs/03-modelo-dados.md` atribuía esse caso à defesa de hash, e ela não o
> cobre: o watcher relê o arquivo alterado e o hash guardado passa a ser o
> **novo**, então a conferência aprova e a gravação vai para a linha de outro
> processo, com `ok: true` e `conflicts: []`. Corrigido na raiz — a célula é
> resolvida pela **REF**, casada por `normKey`, e o `previous` de cada edição é
> conferido contra o valor atual **sempre**, não só quando o hash diverge.
>
> (2) **Os dois lados do conflito usavam formatadores diferentes.** `previous`
> vinha de `currentValue`, sobre o `Process`; `valueNow` de um formatador
> próprio, sobre a célula crua. Em data-como-texto davam `2026-07-29` contra
> `29/07/2026` para o mesmo dia, recusando a fila **inteira**, de forma
> permanente. Os dois lados passaram a usar `currentValue`.
>
> (3) **`wrote(null, '')` condenava escrita correta.** `validateEdit` aceita
> `''` nos campos de texto; a cirurgia gravava; `classify` relia `null`; a
> validação restaurava o backup e informava corrupção. Corrigido na tradução:
> texto vazio vira célula vazia.
>
> (4) **`previous` guardava valor que nunca esteve na célula.** A rota tira o
> processo de `getState()`, que vem **projetado com a fila** — editar o mesmo
> campo duas vezes gravava como `previous` o valor da edição anterior. Corrigido
> em `src/http/routes/edits.ts`: a segunda edição de um par herda o `previous` da
> pendente, e só a primeira calcula sobre a projeção.
>
> Ainda da revisão: a consolidação da fila passou a usar `normKey` — duas
> entradas diferindo só na caixa da REF resolviam para a mesma célula e a
> validação condenava a escrita; `fsync` antes do `rename`; o temporário é
> removido também quando a **renomeação** falha; a aba resolvida é conferida
> contra a lida antes de gravar bytes; o backup é gravado do **mesmo buffer**
> que a cirurgia recebe, fechando o TOCTOU; e o `catch` geral registra
> `ERRO_INTERNO` com `level: error`, para que programa quebrado não saia no log
> como arquivo que recusou.
>
> **Divergências de contrato, registradas e não resolvidas em silêncio.**
> `WriteRefusal` tem **sete** membros contra os cinco fixados aqui:
> `ARQUIVO_INDISPONIVEL`, exigido por `docs/05-contratos-api.md` §3, sem o qual
> o arquivo sumido virava exceção carregando `workbookPath` na mensagem; e
> `EDICAO_OBSOLETA`, decisão explícita do usuário — o hash confere, e mandar
> reler a planilha, que é o que `ARQUIVO_MUDOU` instrui, não muda nada.
> `WriteResult` ganhou `expectedHash` e `actualHash`, que o corpo do `409` pede
> e o guard descartava; `Conflict` ganhou `refMissing`, porque `valueNow: ''`
> afirmaria célula vazia onde a linha inteira sumiu. `backup-manager` ganhou
> `backupFrom(bytes)`, fora do contrato daqui. `WriteGuardStore.rebuild` e
> `rebuildProcesses` existem para os dois lados do conflito usarem o mesmo
> formatador. `resolveSheetPath` **voltou a ser privada**: o guard usa o
> `sheetPath` da leitura canônica.
>
> **Medido sobre cópia da planilha real em 13/08/2026** — o original nunca foi
> aberto para escrita —, em cinco execuções: escrita de uma célula em **181 a
> 284 ms**, contra os 15 s de RNF-15 para cem; **29 das 30** entradas do zip
> idênticas, só `xl/worksheets/sheet1.xml` mudou, e `xl/styles.xml` intacto;
> backup byte a byte igual ao original; nenhum `.tmp` remanescente. O caso do
> `sourceRow` deslocado gravou na linha da REF e deixou a vizinha intacta.
>
> **PD-04 fechada, contra o que se temia.** Medido em 13/08/2026 sobre a mesma
> cópia, nas 649 linhas de dados da aba `2026`: a célula de `DOCS ENVIADOS`
> (coluna `O`) **está ausente do XML** em **511** linhas e presente em **138**;
> a coluna `P` está ausente em **641**; as colunas `A`–`N`, em nenhuma. Das 138
> em que `O` existe, **128 têm `fillId=0`** — a coluna é branca por desenho. A
> célula nova saiu com `fillId=0` e `numFmtId=16`, **igual às 128**: não há
> buraco branco, e herdar da coluna, como `H-24` decidiu, reproduz o que a
> planilha já faz. Herdar do irmão da linha teria posto o `fillId` da coluna `N`
> nas **117** linhas em que ela vale `4`.
>
> **Limites conhecidos, para `H-26`:** o `fileHash` do store envelhece após o
> sucesso, e dentro dos 2000 ms de debounce uma edição nova ainda sai
> `ARQUIVO_MUDOU` com `conflicts: []` — quem fecha é a rotação da fila.
> `data/pending-edits.jsonl` gravado **antes** desta história carrega o
> `previous` projetado, e não há migração: fila anterior a 13/08/2026 precisa ser
> esvaziada. E o critério de aceite diz que o watcher "não dispara releitura pela
> própria escrita", enquanto o diagrama de `docs/04-arquitetura.md` §3.2 termina
> em `fileChanged → releitura`: o código segue o diagrama, e a contradição fica
> registrada aqui em vez de absorvida.

**Objetivo:** tornar impossível corromper ou sobrescrever silenciosamente a
planilha de produção.

**Arquivos:**
- `src/app/write-guard.ts`
- `src/io/backup-manager.ts`
- `tests/app/write-guard.test.ts`

**Contrato fixado:**

```ts
export type WriteRefusal = 'EXCEL_ABERTO' | 'ARQUIVO_MUDOU' | 'NADA_A_APLICAR'
                         | 'ESCRITA_EM_ANDAMENTO' | 'ESCRITA_INVALIDA'
export interface WriteResult {
  ok: boolean; refusal: WriteRefusal | null
  applied: number; cellsWritten: number; backupPath: string | null
  conflicts: Conflict[]; restored: boolean; durationMs: number
}
export async function applyPendingEdits(): Promise<WriteResult>

// src/io/backup-manager.ts
export async function backup(filePath: string): Promise<string>
export async function restore(backupPath: string, filePath: string): Promise<void>
export async function prune(keepCount: number, keepDays: number): Promise<number>
```

Sequência obrigatória, na ordem de `04-arquitetura.md §3.2`: pausar watcher →
verificar lock → conferir hash → backup → cirurgia → gravação atômica →
validação → retomar watcher.

**Critérios de aceite:**
- **Dado** que existe `~$planilha.xlsx` na mesma pasta, **então** a escrita é
  recusada com `EXCEL_ABERTO` e o arquivo não é tocado.
- **Dado** que o hash do arquivo difere do da última leitura, **então** a
  escrita é recusada com `ARQUIVO_MUDOU`, e `conflicts` lista campo a campo o
  valor de quando se editou, o valor atual e o valor pretendido.
- **Dado** uma recusa de qualquer natureza, **então** a fila de edições
  **não** é descartada.
- **Dado** uma escrita, **então** um backup é gravado **antes** de qualquer
  modificação.
- **Dado** que a validação pós-escrita falha, **então** o backup é restaurado
  automaticamente, `restored: true`, e o erro é `ESCRITA_INVALIDA`.
- **Dado** que a escrita está em curso, **então** o watcher está pausado e não
  dispara releitura pela própria escrita.
- **Dado** duas chamadas simultâneas, **então** a segunda recebe
  `ESCRITA_EM_ANDAMENTO`.
- **Dado** uma escrita bem-sucedida, **então** a gravação foi atômica: arquivo
  temporário no mesmo volume, seguido de renomeação.

**Casos-limite:**
- Falha de disco no meio da gravação do temporário → o original permanece
  intacto, porque a renomeação não chegou a ocorrer.
- Backup falha → a escrita é abortada antes de tocar no original.
- Mais de 30 backups ou backups com mais de 90 dias → `prune` remove os
  excedentes mais antigos, mantendo o critério mais permissivo dos dois
  (RNF-21).
- Arquivo somente-leitura → recusa com `ESCRITA_INVALIDA` antes do backup.
- Fila vazia → `NADA_A_APLICAR`, sem backup e sem tocar no arquivo.

**Dependências:** H-24, H-23
**Tamanho:** M

---

### H-26 — Aplicar as edições pendentes sob comando explícito

> ✅ **CONCLUÍDA em 14/08/2026.** 32 testes próprios — 17 em
> `tests/http/apply.test.ts`, 15 em `web/tests/AplicarAlteracoes.test.tsx` —,
> mais os acrescentados a `edit-queue`, `process-store`, `write-guard` e
> `edits`; suíte total em **954**. Dez divergências do plano resolvidas na
> abertura, seis delas só de fiação: `server.ts`, `api-client.ts`, `App.tsx`,
> testes de interface, o marcador de pendência em `docs/05-contratos-api.md`, e
> `validated`, que a rota deriva de `ok` em vez de existir em `WriteResult`.
>
> **`rotate()` fechou o primeiro critério de aceite**, que não tinha
> implementação: a fila vai para `data/applied/pending-edits-<AAAAMMDD-HHmmss>.jsonl`
> por **renomeação**, preservando as lápides de descarte. **`settle()` fechou o
> caso-limite da releitura**, que `H-25` deixou declaradamente em aberto —
> `watcher.pause()` cancela o agendamento, não a leitura já iniciada.
>
> **O `revisor-xml` foi invocado sete vezes e reprovou seis.** Seis defeitos
> reais, quatro deles na interface, e **nenhum pego pela suíte**.
>
> (1) **Edição digitada durante a escrita sumia sem ser gravada.** O guard tira
> o instantâneo da fila no início e arquivava o arquivo inteiro no fim; o que
> entrava no meio era arquivado sem chegar ao `.xlsx`, e o painel passava a
> mostrar zero pendências. Fechado por duas metades que só funcionam juntas: as
> três rotas que **escrevem** na fila recusam com `409 ESCRITA_EM_ANDAMENTO`, e
> o arquivamento passou para dentro do guard, antes de `finishWriting`. Na rota
> ele estaria fora da janela.
>
> (2) **`restored: false` tinha duas origens, e a rota tratava as duas como
> "nada foi gravado".** A segunda — validação reprovada **e** restauração
> falhada — deixa o arquivo gravado no lugar do original, e o backup é a única
> saída, que era justamente o que a resposta omitia. Corrigido no guard, não na
> rota: `WriteResult.fileState` (`intacto` · `gravado` · `restaurado` ·
> `incerto`), porque inferir o estado do arquivo na rota é a decisão que a regra
> inviolável 6 tira dela.
>
> (3) **`write.done` saía duas vezes** numa aplicação bem-sucedida, uma delas
> parecendo erro de escrita. `queue.archived` virou evento próprio, fora do
> catálogo fechado de `H-31`.
>
> (4) **O título do diálogo dizia "Nada foi gravado"** no desfecho em que a
> planilha ficou possivelmente inválida — e ele é o `aria-labelledby`, o nome
> que o leitor de tela anuncia. Eu havia corrigido a mensagem, o aviso e o
> rodapé, e parado em três dos quatro pontos.
>
> (5) **A tela afirmava "nada foi gravado" em falha de rede**, quando o cliente
> não sabe se a requisição chegou (regra inviolável 3). (6) **Mensagem vazia
> passava pelo `??`**, abrindo diálogo sem explicação.
>
> **A regra da tela, que o revisor arrancou em três rodadas:** decide primeiro
> por `conflicts.length` — vazio **não** é diálogo de conflito —, e só depois,
> linha a linha, por `refMissing`. Nunca pelo código: são **três** ramos de 409,
> e `ARQUIVO_MUDOU` com lista vazia é o caso mais comum de todos.
>
> **Medido sobre cópia da planilha real em 14/08/2026** — o original nunca foi
> aberto para escrita —, em três execuções: **100 células em 380, 399 e 430 ms**,
> contra os 15 s de RNF-15, com 35× de folga no pior caso. O campo escolhido foi
> `docsSentDate` de propósito: a célula está ausente do XML em 511 das 649
> linhas, então a maioria exercita a inserção de célula nova, o caminho mais caro
> da cirurgia. O revisor conferiu o zip entrada a entrada no caminho fim a fim:
> **27 das 28 entradas byte a byte idênticas**, só a aba alvo mudou.
>
> **Divergências de contrato registradas:** `queue.archived` fora do catálogo de
> `H-31`; `fileState` e `archivedQueuePath` fora do `WriteResult` fixado em
> `H-25`; `409 ESCRITA_EM_ANDAMENTO` nas três rotas da fila; e `FILA_AUSENTE`,
> primeiro `errorCode` de log que não é código de resposta HTTP — documentado em
> `docs/08-qualidade-operacao.md` §3.1, porque `LogEntry.errorCode` é `string` e
> nenhuma guarda de compilação o protege.
>
> **Limite conhecido, não corrigido:** entre `buildServer` e `initWriteGuard` há
> uma janela em que a rota existe e o guard não. `applyPendingEdits` lança antes
> de tocar em arquivo, fila ou watcher — nenhum byte em risco —, e o cliente
> degrada sem afirmar nada falso. Mover a inicialização mexeria na ordem de
> partida por um caso sem consequência de integridade.

**Objetivo:** o operador clica em "Aplicar alterações", o arquivo é atualizado e
o painel relê.

**Arquivos:**
- `src/http/routes/apply.ts`
- `web/src/components/ApplyChangesButton.tsx`
- `web/src/components/ConflictDialog.tsx`
- `tests/http/apply.test.ts`

**Contrato fixado:** `POST /api/edits/apply` conforme `05-contratos-api.md §3`.

**Critérios de aceite:**
- **Dado** três edições pendentes, **quando** o comando é acionado, **então** as
  três células são gravadas e a fila é rotacionada para `data/applied/`.
- **Dado** a escrita concluída, **então** o watcher retoma e uma releitura
  ocorre, deixando o painel coerente com o arquivo.
- **Dado** `EXCEL_ABERTO`, **então** a interface instrui a fechar o Excel, e as
  edições continuam enfileiradas.
- **Dado** `ARQUIVO_MUDOU`, **então** a interface exibe o diálogo de conflito
  com os três valores por campo, e nada é gravado.
- **Dado** `ESCRITA_INVALIDA`, **então** a interface informa que o arquivo foi
  restaurado do backup, com o caminho do backup.
- **Dado** fila vazia, **então** o botão fica desabilitado.

**Casos-limite:**
- Edição de um processo que sumiu do arquivo (linha removida no Excel) → o hash
  já terá mudado, e a recusa é `ARQUIVO_MUDOU`.

  > **Divergência registrada em 14/08/2026 — o mesmo fato produz DOIS códigos,
  > conforme o instante.** Este caso-limite foi escrito antes de
  > `EDICAO_OBSOLETA` existir (`H-25`). Se uma releitura já pousou quando o
  > operador aplica — o caminho mais provável, porque o watcher espera
  > `DEFAULT_DEBOUNCE_MS` (RNF-17) e relê em seguida —, o hash **confere**, e a
  > recusa é `EDICAO_OBSOLETA` com `conflicts[].refMissing: true`. Mandar reler
  > a planilha, que é o que `ARQUIVO_MUDOU` instrui, não mudaria nada. Se
  > nenhuma releitura pousou — janela de debounce, watcher pausado, ou evento
  > que não chega em caminho de rede (P-08) —, o hash diverge e a recusa é
  > `ARQUIVO_MUDOU` mesmo. O código não foi alterado para devolver
  > `ARQUIVO_MUDOU` nos dois casos: seria piorar a mensagem ao operador para
  > casar com um documento anterior ao código.
  >
  > **Consequência para a tela, em duas decisões e nesta ordem.** São **três**
  > os ramos de 409 de uma aplicação, não dois:
  >
  > | Ramo | Código | `conflicts` |
  > |---|---|---|
  > | Hash divergente na leitura canônica | `ARQUIVO_MUDOU` | preenchido **ou vazio** |
  > | Valor ou linha mudou, hash conferindo | `EDICAO_OBSOLETA` | sempre preenchido |
  > | Hash divergente na **segunda** conferência, entre a leitura e os bytes | `ARQUIVO_MUDOU` | sempre vazio |
  >
  > O primeiro ramo sai **vazio** quando o arquivo mudou fora das células
  > enfileiradas — o caso mais comum de todos, porque o `fileHash` do store
  > envelhece após uma aplicação e uma edição nova dentro do debounce cai
  > exatamente aqui (registrado no bloco de `H-25`). Sai preenchido quando a
  > mudança alcançou alguma célula da fila.
  >
  > O terceiro existe desde `H-25`: o arquivo mudou **depois** de a aplicação já
  > ter conferido que estava tudo certo, então não há nada a comparar campo a
  > campo, e `conflicts: []` é a resposta honesta.
  >
  > **Não se infere o ramo pelo conteúdo.** `ARQUIVO_MUDOU` com lista vazia vem
  > dos dois ramos de hash, e a resposta não os distingue — nem precisa: a
  > instrução ao operador é a mesma, releia a planilha.
  >
  > 1. **`conflicts` vazio → não é diálogo de conflito.** É a mensagem do
  >    código, e só. Abrir a tabela de três colunas sem nenhuma linha deixaria o
  >    operador com um diálogo em branco no lugar da explicação.
  > 2. **`conflicts` preenchido → cada linha decide por `refMissing`**, nunca
  >    pelo código: a linha que sumiu chega pelos dois códigos, conforme o
  >    instante, e é `refMissing` que diz "esta linha não existe mais" em vez de
  >    "esta célula está vazia".
  >
  > Levantado pelo `revisor-xml`, incluindo a correção de que eu havia contado
  > dois ramos onde há três.

- Aplicação com 100 células → concluída em até 15 s (RNF-15).
- Aplicação disparada durante uma releitura → aguarda a releitura terminar.

**Dependências:** H-25
**Tamanho:** M

---

### H-27 — Editar os campos codificados em cor

**Objetivo:** alterar responsável, canal e localização do importador, gravando a
mudança como troca de estilo da linha.

**Arquivos:**
- `src/io/xlsx-surgeon.ts` (função nova)
- `src/http/routes/process-color.ts`
- `web/src/components/ColorFieldsForm.tsx`
- `tests/io/xlsx-surgeon-style.test.ts`

**Contrato fixado:**

```ts
export interface RowFillEdit { sourceRow: number; fillId: number; columns: string[] }
export function applyRowFill(original: Uint8Array, edits: RowFillEdit[],
                             sheetPath: string): SurgeryResult
```

Rota `PATCH /api/processes/:ref/color`. O `fillId` vem da entrada
correspondente de `config/color-map.json`.

> **Correção obrigatória, medida por `H-01` (achado A-49).** A versão anterior
> desta história trocava o `styleId` inteiro da célula. Isso está **errado**: o
> perfilamento mediu que uma mesma cor é produzida por vários `styleId` —
> `argb:FF00FF00` vem dos styleIds 199, 165 e 189, que compartilham `fillId=2`
> mas diferem em **borda** (34, 5, 48). Trocar o `styleId` inteiro destruiria a
> borda e a fonte da linha.

Algoritmo fixado (TD-05.1 em `03-modelo-dados.md`), por célula:

1. ler o `s=` atual → `styleId` original;
2. obter `cellXfs[styleId]` → `(fillId, fontId, borderId, numFmtId)`;
3. substituir **apenas** o `fillId` pelo alvo;
4. procurar em `cellXfs` um `xf` com a tupla resultante;
5. se existir, usar o índice dele; se não, **acrescentar** um `xf` novo ao final
   de `cellXfs`, incrementar `count`, e usar o índice novo.

O passo 5 é a única modificação de `xl/styles.xml` em todo o projeto, e é
**estritamente aditiva**: nenhum `xf` existente é alterado, logo nenhuma célula
fora da edição muda de aparência.

`columns` é fixado em `['A','B','C','D','E','F','G','H','I','J','K','L']` — as
colunas que acompanham a cor da linha, conforme A-44. M, N, O e P têm
preenchimento próprio e **não** são alteradas.

**Critérios de aceite:**
- **Dado** a combinação `responsible: 'colaborador2'`, `customsChannel: 'nenhum'`,
  `importerOutsideRj: false`, **então** as células recebem um `xf` com
  `fillId = 27` (roxo), preservando `fontId`, `borderId` e `numFmtId` de cada
  célula.
- **Dado** uma célula com `styleId 199` = `(fill 2, font 1, border 34)`,
  **quando** pintada de azul (`fillId 8`), **então** recebe `styleId 181`, que
  já existe como `(8, 1, 34, 0)` — nenhum `xf` novo é criado.
- **Dado** uma célula com `styleId 165` = `(fill 2, font 1, border 5)`,
  **quando** pintada de azul, **então** um `xf` novo `(8, 1, 5, 0)` é
  acrescentado ao final de `cellXfs`, e a **borda 5 é preservada**.
- **Dado** que um `xf` foi acrescentado, **então** o atributo `count` de
  `cellXfs` é incrementado e **nenhum `xf` anterior é modificado**.
- **Dado** uma combinação sem entrada correspondente no mapa, **então** a API
  devolve `400 CORPO_INVALIDO` com a lista das combinações válidas —
  decorrência direta de A-31, já que a cor codifica dimensões concorrentes.
- **Dado** a troca aplicada, **então** apenas o atributo `s=` das colunas A a L
  muda; os **valores** das células permanecem intactos.
- **Dado** as colunas M a P, **então** seus estilos permanecem inalterados
  (A-44).
- **Dado** a releitura após a gravação, **então** `responsible` reflete o valor
  novo.

**Casos-limite:**
- Célula sem atributo `s=` → tratada como `styleId 0`; o atributo é
  acrescentado com o `xf` resultante.
- Combinação que já é a atual → aceita e gravada; o resultado é idêntico, e
  nenhum `xf` novo é criado.
- Duas células da mesma linha com `styleId` diferentes (caso real: borda de
  fim de bloco) → cada uma resolve seu próprio `xf` alvo; a linha pode terminar
  com dois `styleId` distintos, e isso é **correto**.
- Pintar de verde uma linha que já é verde do tom B (`fillId 12`) → o alvo do
  mapa é o tom A (`fillId 2`); a gravação ocorre e unifica o tom. Comportamento
  aceito: a aplicação escreve o tom canônico do mapa.
- `color-map.json` sem `fillId` na entrada escolhida → `400 CORPO_INVALIDO`,
  indicando que o mapa precisa do `fillId` obtido em `H-01`.

**Dependências:** H-26, H-04
**Tamanho:** M

---

## Épico E6 — Histórico

### H-28 — Registrar as mudanças de categoria a cada leitura

**Objetivo:** acumular a série de eventos que destrava o alerta de processos
parados e a Página Histórico.

> **Herda de `H-14` (A-61):** `historyStartedAt`, em `GET /api/alerts`, vale
> `null` desde `H-14` porque não havia histórico. **É esta história que passa a
> devolver a data** — a da primeira leitura registrada. Enquanto continuar
> `null`, `H-20` exibe a ressalva em vez de data vazia.

**Arquivos:**
- `src/io/history-store.ts`
- `src/http/routes/history.ts`
- `tests/io/history-store.test.ts`

**Contrato fixado:**

```ts
export interface StatusEvent { ts: string; ref: string
                               from: StatusCategory | null; to: StatusCategory; sourceRow: number }
export function recordChanges(processes: Process[]): StatusEvent[]
export function daysInCurrentCategory(ref: string, today: Date): number | null
export function monthlySeries(months: number): MonthlyPoint[]
export function historyStartedAt(): string | null
```

Formato de `data/history.jsonl` conforme `03-modelo-dados.md §3.1`.

**Critérios de aceite:**
- **Dado** a primeira leitura, **então** cada processo gera um evento com
  `from: null`.
- **Dado** uma segunda leitura sem mudanças, **então** **nenhum** evento novo é
  gravado.
- **Dado** um processo que muda de `em_andamento` para `desembaracado`,
  **então** um evento é gravado com `from` e `to` corretos.
- **Dado** o arquivo apagado, **então** a próxima leitura o recria e trata todos
  os processos como vistos pela primeira vez, sem erro.
- **Dado** `monthlySeries(12)`, **então** devolve um ponto por mês desde
  `historyStartedAt`, e `truncated` indica se a janela pedida excede o
  histórico.
- **Dado** um REF que sumiu do arquivo, **então** nenhum evento é gravado por
  isso; a ausência não é uma mudança de categoria.

**Casos-limite:**
- Processo que muda duas vezes entre leituras → apenas a diferença observável é
  registrada; o estado intermediário não foi visto e não é inventado.
- `history.jsonl` com uma linha corrompida → a linha é ignorada, registrada em
  log, e o restante do arquivo é usado.
- Arquivo com 100 mil linhas → a leitura só carrega o último evento por REF em
  memória.
- `daysInCurrentCategory` de um REF sem evento algum → `null`.

**Dependências:** H-08
**Tamanho:** M

---

### H-29 — Entregar o alerta de processos parados

**Objetivo:** ALE-06, destravado pelo histórico.

**Arquivos:**
- `src/domain/alerts.ts`
- `web/src/components/AlertRow.tsx`

**Contrato fixado:** o tipo `processos_parados` de `buildAlerts`, com limiar
vindo de `config/app.json` (`stalledDaysThreshold`, padrão **15**, A-32).

**Critérios de aceite:**
- **Dado** um processo cuja categoria não muda há 20 dias e limiar de 15,
  **então** gera o alerta com `daysOverdue: 20`.
- **Dado** um processo com 14 dias e limiar de 15, **então** **não** gera.
- **Dado** um processo de categoria `desembaracado`, **então** **não** gera —
  processo concluído não está parado.
- **Dado** o limiar alterado na configuração, **então** o alerta responde ao
  valor novo sem recompilar.
- **Dado** que o histórico começou há 3 dias, **então** nenhum processo atinge
  o limiar, e a interface explica o motivo (A-43).

**Casos-limite:**
- Processo com exatamente 15 dias e limiar 15 → **gera** (comparação `>=`).
- Processo sem evento no histórico → não gera; contagem sem base não vira
  alerta.
- Limiar configurado como `0` → todo processo não desembaraçado gera alerta;
  comportamento aceito e previsível.

**Dependências:** H-28, H-14
**Tamanho:** P

---

## Épico E7 — Operação

### H-30 — Entregar a aplicação empacotada com atalho de execução

**Objetivo:** o operador iniciar a aplicação sem linha de comando.

**Arquivos:**
- `scripts/iniciar.cmd`
- `scripts/build.mjs`
- `README.md` (raiz do repositório)
- `config/app.json.exemplo`
- `src/http/server.ts` — a rota estática `GET /*`, acrescentada por A-63

**Contrato fixado:** `npm run build` produz `dist/` com o servidor compilado e
a SPA. `scripts/iniciar.cmd` verifica a presença do Node, sobe o servidor e
abre o navegador em `http://127.0.0.1:5173`.

> **`GET /*` chega aqui, por A-63.** `05-contratos-api.md §4` a especifica desde
> o início — qualquer caminho fora de `/api/` devolve `index.html`, para que a
> recarga direta de URL funcione —, mas ela nunca constou do mapa rota →
> história, e `@fastify/static` estava em `dependencies` desde `H-02` sem
> chamador. É desta história porque é aqui que `dist/web` passa a existir na
> máquina do operador; antecipá-la obrigaria o servidor a lidar com a pasta
> inexistente, que é o estado normal antes do `build`. Até então, o fallback de
> SPA do Vite cobre `npm run dev`.

**Critérios de aceite:**
- **Dado** o duplo clique em `iniciar.cmd`, **então** o servidor sobe e o
  navegador abre na Página Inicial.
- **Dado** a aplicação empacotada e o endereço `/alertas` recarregado
  diretamente no navegador, **então** o servidor devolve `index.html` e a casca
  resolve a rota — não `404` (A-63).
- **Dado** que o Node não está instalado, **então** a janela exibe instrução de
  instalação e não fecha imediatamente.
- **Dado** que `config/app.json` não existe, **então** a janela indica o arquivo
  de exemplo a copiar.
- **Dado** o `README.md` da raiz, **então** ele descreve instalação,
  configuração do caminho da planilha, preenchimento do `color-map.json` a
  partir da saída de `H-01`, e o procedimento de restauração de backup.
- **Dado** a janela do terminal fechada, **então** o servidor encerra e nenhum
  processo órfão permanece.

**Casos-limite:**
- Porta 5173 ocupada → mensagem clara indicando a porta e como alterá-la em
  `config/app.json`.
- Caminho da planilha com espaços e acentos → tratado corretamente.
- Segunda execução com a aplicação já no ar → detecta e apenas abre o navegador.
- `dist/web` inexistente → mensagem indicando que falta rodar o `build`, nunca
  `404` cru vindo do `@fastify/static`.
- Caminho fora do mapa da casca, como `/relatorios` → devolve `index.html`
  igual, e é a casca quem exibe "página não encontrada". O servidor não conhece
  as rotas do cliente, e passar a conhecê-las duplicaria o mapa.

**Dependências:** H-26
**Tamanho:** P

---

### H-31 — Entregar logs estruturados e métricas de ingestão

> ✅ **CONCLUÍDA em 04/08/2026.** 20 testes próprios; suíte total em 195.
> **Fecha a Fase 1.**
>
> **Verificado no servidor real**, duas leituras sobre a planilha de 649 linhas:
>
> ```jsonc
> {"ts":"...","level":"info","event":"read.start"}
> {"ts":"...","level":"info","event":"read.done","durationMs":144,"rowsRead":649,"rowsAccepted":649,"rowsQuarantined":0}
> {"ts":"...","level":"info","event":"quarantine.reported","rowsQuarantined":0,"quarantineRate":0}
> ```
>
> A segunda leitura emitiu `read.start` e `read.done`, **sem**
> `quarantine.reported` — o hash não mudou, então nada foi regravado. O
> comportamento de `H-08` aparece no log sem precisar de instrumentação extra.
>
> **RNF-33 é garantido pelo tipo, não por filtro.** `LogEntry` não tem campo de
> texto livre — sem `message`, sem `detail`. A serialização ainda copia apenas
> as chaves catalogadas, então um chamador que force `client` ou `message` por
> cast não consegue gravá-los; há teste para isso. O motivo legível da falha vai
> para a interface via `degradedReason`, nunca para o log: ele carrega o caminho
> do arquivo, e há teste verificando que o caminho não aparece no log.
>
> **Divergências resolvidas:** os emissores não estavam na lista de arquivos —
> `read.*` e `quarantine.reported` nascem no `process-store`, que passou a ser
> tocado; `lastReadDurationMs` foi acrescentado a `HealthResponse` e ao contrato
> em `05-contratos-api.md`, sem o qual `RF-16` não fechava, já que
> `08-qualidade-operacao.md §3.2` pede "tempo da última leitura" na rota;
> `read.failed` ganhou catálogo de `errorCode` reaproveitando o envelope de erro
> — `ARQUIVO_INDISPONIVEL` para falha na leitura do arquivo, `ERRO_INTERNO` para
> falha na composição, distinção feita por estágio e não por inspeção de
> mensagem; o expurgo de 30 dias ganhou ponto de chamada em `server.ts`, antes
> da primeira leitura.
>
> **Divergência encontrada durante a execução:**
> `08-qualidade-operacao.md §3.1` exige `quarantineRate` no evento
> `quarantine.reported`, mas o `LogEntry` fixado nesta história não tem esse
> campo. Acrescentado — sem ele o evento não carrega o número que dispara o
> alerta de RNF-24. Mesma resolução dada a `lastReadDurationMs`.

**Objetivo:** poder diagnosticar uma leitura ou escrita sem depender de
lembrança.

**Arquivos:**
- `src/app/logger.ts`
- `src/http/routes/health.ts`

**Contrato fixado:**

```ts
export interface LogEntry {
  ts: string; level: 'info'|'warn'|'error'; event: string
  durationMs?: number; rowsRead?: number; rowsAccepted?: number
  rowsQuarantined?: number; cellsWritten?: number; ref?: string; sourceRow?: number
  errorCode?: string
}
```

Eventos fixados: `read.start`, `read.done`, `read.failed`, `write.start`,
`write.refused`, `write.done`, `write.restored`, `history.appended`,
`quarantine.reported`.

> `H-26` acrescentou um décimo, `queue.archived`, fora deste catálogo fechado.
> O motivo está em `docs/08-qualidade-operacao.md` §3.1: sem ele, a falha ao
> arquivar a fila saía como uma segunda linha `write.done`, e uma aplicação
> bem-sucedida contava duas vezes no log.

Saída em JSON por linha, em `data/logs/app-<AAAAMMDD>.jsonl`, com retenção de
30 dias.

**Critérios de aceite:**
- **Dado** uma leitura, **então** `read.done` registra `durationMs`,
  `rowsRead`, `rowsAccepted` e `rowsQuarantined`.
- **Dado** uma escrita recusada, **então** `write.refused` registra o
  `errorCode`.
- **Dado** qualquer entrada de log, **então** ela **não** contém nome de
  cliente, importador, agente, navio nem descrição de mercadoria — processos
  são referenciados por `ref` e `sourceRow` (RNF-33).
- **Dado** `GET /api/health`, **então** devolve os contadores da última leitura.
- **Dado** logs com mais de 30 dias, **então** são removidos na partida.

**Casos-limite:**
- Falha ao escrever o log → a aplicação continua funcionando; log não é crítico.
- Erro contendo um valor de célula na mensagem → o valor é omitido, e apenas
  `sourceRow` e a coluna são registrados (RNF-33).
- Diretório de logs inexistente → criado na partida.

**Dependências:** H-08
**Tamanho:** P

---

### H-32 — Sinalizar interferência externa no arquivo

> ✅ **CONCLUÍDA em 06/08/2026.** 18 testes próprios; suíte total em 391.
>
> **Antecipada para destravar `H-15`.** Ela é dependência declarada da casca, e
> três critérios de aceite de `H-15` pedem `externalLock` e `conflictFiles` em
> `GET /api/health` — que não existiam. Descoberto pelo protocolo de fatia da
> `H-15`, antes de escrever qualquer código de interface.
>
> **A detecção roda num `finally`, então acontece mesmo quando a leitura falha.**
> O contrato dizia "a cada leitura" sem dizer o que fazer no erro. É justamente
> com arquivo de conflito na pasta, ou com o Excel segurando o arquivo, que a
> leitura tende a falhar — suprimir o sinal ali o esconderia exatamente quando
> ele mais importa.
>
> **O sinal nunca fica preso** porque é derivado do estado da pasta a cada
> leitura, nunca acumulado. Há teste criando e removendo o arquivo de lock.
>
> **A limitação do idioma virou teste, não nota de rodapé.** O padrão ancora em
> `onflito` e **não** cobre `-Conflicted copy`. Um teste nomeado
> `NAO reconhece a forma em ingles, por decisao` fixa isso: se alguém "consertar"
> sem entender, a suíte reprova e aponta para RNF-26.
>
> **Divergências resolvidas:** `tests/http/health.test.ts` não constava da lista
> de arquivos — sétima ocorrência do padrão, desta vez com a rota listada. E as
> fábricas de estado de três outros testes de rota precisaram dos campos novos:
> foi o `typecheck` que apontou, não revisão manual, que é o comportamento
> desejado de um tipo obrigatório.
>
> **Conferido contra a pasta real:** sem lock e sem conflito no momento da
> medição, e pasta inexistente devolvendo os sinais em branco sem lançar.

**Objetivo:** o operador saber que outra pessoa está com a planilha aberta, ou
que o OneDrive gerou um arquivo de conflito, em vez de descobrir depois.

**Arquivos:**
- `src/io/interference-detector.ts`
- `src/app/process-store.ts`
- `src/http/routes/health.ts`
- `tests/io/interference-detector.test.ts`
- `tests/http/health.test.ts` — omitido do plano original
- `tests/http/{alerts,indicators,reload}.test.ts` — fábricas de estado, por
  exigência do tipo

**Contrato fixado:**

```ts
// src/io/interference-detector.ts
export interface Interference {
  externalLock: boolean       // existe ~$<nome>.xlsx na pasta
  conflictFiles: string[]     // nomes de arquivo, sem caminho
}
export function detectInterference(workbookPath: string): Interference
```

`GET /api/health` ganha os dois campos. Padrões de nome, sobre o **basename** da
planilha configurada:

| Padrão | Significado |
|---|---|
| `~$<nome>.xlsx` | Alguém tem o arquivo aberto no Excel |
| `<nome sem extensão>*onflito*.xlsx` | O OneDrive não conseguiu mesclar |

A detecção acontece a cada leitura, dentro de `reload()`. O watcher **não** passa
a disparar releitura por causa desses arquivos — o filtro de `H-08` permanece.

**Critérios de aceite:**
- **Dado** `~$CONTROLE DOS EMBARQUE.xlsx` na pasta, **então** `externalLock` é
  `true` em `GET /api/health`.
- **Dado** que o arquivo de lock some, **então** a leitura seguinte devolve
  `externalLock: false`. O sinal nunca fica preso.
- **Dado** um arquivo `CONTROLE DOS EMBARQUE-Cópia em conflito de PC-01
  2026-08-04.xlsx`, **então** ele aparece em `conflictFiles`.
- **Dado** dois arquivos de conflito, **então** ambos aparecem, em ordem
  alfabética.
- **Dado** nenhuma interferência, **então** `externalLock` é `false` e
  `conflictFiles` é `[]`.
- **Dado** qualquer resultado, **então** os campos são **sinal, nunca ação**: a
  leitura acontece igual e o painel continua servindo o dado.

**Casos-limite:**
- Pasta inacessível na hora da checagem → `externalLock: false`,
  `conflictFiles: []`. A detecção nunca derruba a leitura.
- Arquivo de outra planilha na mesma pasta (`~$outra.xlsx`) → ignorado; o
  padrão é ancorado no nome do arquivo configurado.
- Nome de conflito em inglês (`-Conflicted copy`) → o padrão `*onflito*` **não**
  cobre. Documentado como limitação: o Windows do operador é pt-br (RNF-26).
- `conflictFiles` traz **apenas o nome do arquivo**, nunca o caminho completo —
  o caminho já está em `workbookPath`, e repeti-lo poluiria a interface.

**Fora desta fatia:** a faixa que exibe o aviso é de `H-15`; a recusa de escrita
com `409 EXCEL_ABERTO` é de `H-25`. Esta história produz o sinal, não a reação.

**Dependências:** H-08
**Tamanho:** P

---

### H-33 — Trocar o leitor de `.xlsx` do ExcelJS para `fflate`

**Objetivo:** eliminar os arquivos temporários que a leitura deixa em `/tmp`.

> ⚠️ **O motivador mudou em 06/08/2026, e a história encolheu.** O erro não
> determinístico do portão **já foi corrigido na origem**, fora desta história —
> ver o bloco *Correção do `ENOENT`* abaixo. O que resta aqui é o objetivo
> maior, e independente: **nenhuma aba fora de escopo deve tocar o disco**. Isso
> é regra inviolável 10 valendo por construção, não mais conserto de portão.
> Reavaliar o tamanho e a prioridade — o urgente saiu, o estrutural ficou.

**Diagnóstico medido em 06/08/2026** — não re-derive:

- Em **todos** os arquivos, inclusive a planilha real, `xl/sharedStrings.xml`
  fica na posição **10** do zip e a primeira worksheet na posição **4**. O
  ExcelJS então grava **cada aba** num arquivo temporário e a reparseia depois
  (`workbook-reader.js`, linhas 113–129).
- A regra inviolável 10 manda pular as abas fora de escopo sem consumir suas
  linhas. Com isso `tempFileCleanupCallback()` nunca roda, e `readWorkbook`
  **retorna com trabalho pendente**: medido, **5 `FSReqCallback` + 1
  `PipeWrap`** vivos depois da promise resolver, e **4 temporários** em `/tmp`.
- `tmp.setGracefulCleanup()` registra um listener de `process.exit` que apaga
  esses arquivos. As operações pendentes tentam abri-los e falham com `ENOENT`
  — erro **não tratado**, que derruba o exit code sem reprovar teste algum.
- **Não é vazamento:** a limpeza conclui sozinha em menos de 200 ms. O que
  falha é a corrida — se o processo sai nessa janela, os temporários já foram
  apagados e as operações pendentes morrem.
- Efeito no portão: **1 reprovação em 8** execuções. Desligar o paralelismo do
  Vitest dava **0 em 6** localmente e **mesmo assim reprovou no runner do
  GitHub** — reduzir probabilidade não é corrigir causa. A espera passou a
  viver em `tests/support/exceljs-cleanup.ts`, e com ela o portão deu **10 de
  10** com paralelismo ligado.
- Efeito em produção: **nenhum**. O servidor fica vivo e a limpeza conclui;
  estabiliza em 4 temporários ao longo de 6 releituras no mesmo processo, modo
  `600`, apagados no encerramento.
- A causa de fundo está no ExcelJS: o `read()` dele faz `await value.read()` em
  cada aba, **drenando** antes de seguir. A regra inviolável 10 obriga a pular
  as abas fora de escopo, e é esse drain que fica faltando.

**Correção do `ENOENT` — feita em 06/08/2026, fora desta história:**

O diagnóstico acima estava certo no mecanismo e **errado no ponto de conserto**.
Ele conclui que a causa exige trocar o leitor; não exigia.

O que faltava não era o *drain* das abas fora de escopo, e sim **fechar o
descritor delas**. Ao pular uma aba, o `ReadStream` que o ExcelJS abriu sobre o
temporário fica com o `open` em voo; `tempFileCleanupCallback()` apaga o arquivo
logo em seguida, o `open` resolve em `ENOENT`, e um stream que emite `error`
**sem ouvinte** vira exceção não tratada. `discardWorksheetStream` em
`src/io/xlsx-reader.ts` instala o ouvinte e destrói o stream — sem materializar
célula alguma, portanto **mais** aderente à regra 10 que o `continue` puro, que
deixava aberto um descritor sobre o conteúdo integral de uma aba fora de escopo.

**`destroy()` sozinho não resolve** — foi medido: **3 em 20**, estatisticamente
igual ao baseline. O `open` já está em voo e vai falhar de qualquer forma; sem o
ouvinte, continua virando exceção. As duas metades são necessárias.

| Configuração | Rodadas com `ENOENT` |
|---|---|
| `main` em 4837da3, **com** `exceljs-cleanup.ts` | **1 em 15** |
| Mesma coisa, após `H-13` (335 testes) | **2 em 15** |
| `destroy()` sozinho | **3 em 20** |
| `destroy()` + ouvinte de `error`, **com** a mitigação | **0 em 25** |
| `destroy()` + ouvinte de `error`, **sem** a mitigação | **0 em 30** |

A mitigação foi removida: `tests/support/exceljs-cleanup.ts` e os dois `afterAll`
que o chamavam. O terceiro critério de aceite desta história — "o portão passa
10 vezes seguidas sem a espera" — está **cumprido por outra via**, com folga de
3×.

Não há teste determinístico para uma corrida; a evidência é empírica, em 55
rodadas. O que **está** coberto por teste é o comportamento observável, e ele
não mudou: `nao materializa nenhuma linha das abas fora de escopo`, em
`tests/io/xlsx-reader.test.ts`.

**Arquivos:**
- `src/io/xlsx-reader.ts`
- `tests/io/xlsx-reader.test.ts`

**Contrato fixado:** `readWorkbook(config)` mantém a assinatura e o `ReadResult`
atuais. A troca é interna; nenhum chamador muda.

**Critérios de aceite:**
- **Dado** uma leitura completa, **então** `/tmp` não recebe arquivo algum, e
  `process.getActiveResourcesInfo()` não cresce depois que a promise resolve.
- **Dado** as 7 fixtures, **então** todos os testes de `H-03` a `H-07`
  continuam passando **sem alteração** — a troca é transparente.
- ✅ **Cumprido fora desta história.** `tests/support/exceljs-cleanup.ts` já foi
  removido, e o portão passou **30 vezes seguidas** sem ele.
- **Dado** a planilha real, **então** as 649 linhas são lidas com os mesmos
  valores, chaves de estilo e hash de hoje.

**Casos-limite:**
- Célula com `t="s"` apontando para `sharedStrings` — o pool é global ao
  arquivo e precisa ser carregado inteiro (limitação OOXML, regra 10).
- Célula com fórmula → vale o resultado, não a expressão.
- `richText` → concatenar os fragmentos.
- Aba inexistente → `WorkbookReadError` com a lista de abas, como hoje.

**Ganho colateral:** nenhuma aba fora de escopo chega a tocar o disco. A regra
inviolável 10 passa a valer **por construção**, não por convenção. E o
`ExcelJS` sai do caminho de leitura, restando apenas como dependência histórica
— avaliar a remoção.

**Dependências:** H-07
**Tamanho:** M

---

### H-34 — Configurar o caminho da planilha pela tela, sem editar JSON

**Objetivo:** o operador apontar a aplicação para a planilha dele — e nunca mais
precisar apontar de novo.

> **Pedida pelo usuário em 07/08/2026**, ao ver a casca de `H-15` rodando contra
> a planilha real. Não é conveniência: é a **saída de PD-01**. Hoje o caminho
> vive em `config/app.json`, um arquivo que o operador teria de editar à mão,
> com aspas, vírgulas e barras invertidas do Windows — num painel cujo usuário
> final, por decisão registrada, **não é técnico**. Um JSON malformado hoje mata
> a partida com `ConfigError` e uma janela que fecha.
>
> **A persistência já existe e não é o trabalho.** `config/app.json` é arquivo
> em disco, lido na partida; salvar ali já significa "no dia seguinte está lá".
> O trabalho real é outro: **trocar o caminho com o processo no ar.** Hoje
> `initStore` roda uma vez e o watcher observa um caminho fixo — trocar exige
> parar o watcher, reconfigurar o store, reler e observar o diretório novo. Sem
> isso, salvar o caminho só valeria no reinício seguinte, e o botão "carregar"
> mentiria.
>
> **Nem o botão é necessário no caso normal**, e isso é a favor: com o caminho
> salvo, a aplicação lê na partida sozinha. O botão existe para a primeira
> execução e para a troca de arquivo — na virada de ano, quando a aba `2027`
> aparecer (risco R-14).

**Arquivos:**
- `web/src/pages/WorkbookSetup.tsx`
- `web/src/App.tsx` — desviar para a configuração na primeira execução
- `src/http/routes/config.ts`
- `src/app/config.ts` — gravação preservando os demais campos
- `src/app/process-store.ts` — reconfiguração em execução
- `tests/http/config.test.ts`, `tests/app/config-write.test.ts`

**Contrato fixado:**

```jsonc
// GET /api/config/workbook
{ "workbookPath": "C:\\...\\planilha.xlsx", "exists": true, "readable": true }

// PUT /api/config/workbook  →  { "path": "..." }
// 200: o corpo de GET /api/health, já com a leitura nova
// 400 CAMINHO_INVALIDO — inexistente, sem permissão, ou não é .xlsx
```

**A tela aparece sozinha quando `state = degradado` **e** `lastReadAt = null`** —
que é exatamente "nunca houve leitura", o estado de primeira execução. Nos
demais casos ela é alcançável pelo painel de saúde da Página Inicial. O critério
reaproveita a distinção que `H-08` já fazia entre dado congelado e ausência de
dado, sem inventar estado novo.

**Critérios de aceite:**
- **Dado** nenhuma planilha configurada, **então** a aplicação abre na tela de
  configuração, não num painel de zeros — zero medido e zero por falta de
  arquivo são coisas diferentes (regra inviolável 3).
- **Dado** um caminho válido salvo, **então** a leitura acontece **sem
  reiniciar** o processo, e o watcher passa a observar o diretório novo.
- **Dado** a aplicação reaberta no dia seguinte, **então** o caminho já está lá
  e a leitura acontece na partida, sem clique nenhum.
- **Dado** um caminho inválido, **então** `400 CAMINHO_INVALIDO` com a razão em
  pt-br, e o caminho anterior **continua valendo** — uma tentativa falha nunca
  derruba a configuração que funcionava.
- **Dado** a gravação, **então** os demais campos de `config/app.json` — `port`,
  `sheetName`, `timezone`, limiares — chegam intactos ao arquivo.

**Casos-limite:**
- Caminho com espaços e acentos, e caminho UNC (`\\servidor\pasta`) → aceitos.
- Arquivo existente mas sem a aba `2026` → salva o caminho e entra em
  `degradado` com a razão, como qualquer leitura falha. Recusar o salvamento
  esconderia do operador o motivo real.
- Planilha aberta no Excel no momento do salvamento → salva e lê igual; o sinal
  de `H-32` aparece na faixa (A-58).
- `config/app.json` somente-leitura → `400` explicando, sem perder o estado.
- Duas requisições concorrentes → a segunda espera; o store nunca é
  reconfigurado no meio de uma leitura.

**Fora desta história:** escolher a **aba** pela tela — a regra inviolável 10
fixa `2026`, e a virada de ano é `H-01` reexecutada, não um seletor. Também não
entra navegador de arquivos do sistema: o campo é texto, porque o servidor é
Node e não tem diálogo nativo, e `<input type="file">` no navegador entrega o
conteúdo, **nunca o caminho** — e é o caminho que o watcher precisa.

**Dependências:** H-15, H-16
**Tamanho:** M

---

## Resumo do backlog

| Épico | Histórias | P | M | G |
|---|---|---|---|---|
| E1 — Fundação e perfilamento ✅ | H-01 ✅, H-02 ✅ | 0 | 2 | 0 |
| E2 — Leitura e normalização ✅ | **H-03 ✅ H-04 ✅ H-05 ✅ H-06 ✅ H-07 ✅ H-08 ✅** | 3 | 3 | 0 |
| E3 — Indicadores e alertas | **H-09 ✅ H-10 ✅ H-11 ✅ H-12 ✅**, H-13, H-14 | 3 | 3 | 0 |
| E4 — Interface | **H-15 ✅ H-16 ✅ H-17 ✅**, H-18 … H-22 | 6 | 2 | 0 |
| E5 — Edição e escrita | H-23 … H-27 | 0 | 5 | 0 |
| E6 — Histórico | H-28, H-29 | 1 | 1 | 0 |
| E7 — Operação | H-30, **H-31 ✅**, H-32, H-33, H-34 | 3 | 2 | 0 |
| **Total** | **34** | **16** | **18** | **0** |

**Nenhuma história é G.** As duas candidatas naturais foram quebradas: a
escrita no `.xlsx` virou `H-24` (cirurgia), `H-25` (defesas) e `H-26` (comando
ponta a ponta); os indicadores viraram cinco histórias por natureza de cálculo.

### Varredura de verbos de decisão em aberto

Os textos das 34 histórias foram varridos em busca de "escolher", "avaliar",
"definir", "decidir" e "ver qual". As ocorrências encontradas foram eliminadas:

| Onde estava | Como foi fechado |
|---|---|
| Versão do TypeScript em `H-02` | Fixada em 7.0.2 com fallback objetivo 5.9.3, disparado pela build falhar. Registrado em R-07 |
| Limiar de "processo parado" em `H-29` | Fixado em 15 dias, configurável, marcado como premissa (A-32) |
| Valor de `Top N` em `H-11` | Fixado em 10 (A-25) |
| Colunas que acompanham a cor em `H-27` | Fixadas em A–L, por evidência de A-44 |
| Ordem de severidade dos alertas em `H-14` | Fixada explicitamente (A-41) |
| Tratamento de cor não reconhecida em `H-04` | Fixado: sem tolerância, vai para quarentena (TD-05) |
| Inferência de ano em datas sem ano em `H-05` | Fixado: não infere, gera anomalia (TD-03) |

Nenhum verbo de decisão em aberto permanece.
