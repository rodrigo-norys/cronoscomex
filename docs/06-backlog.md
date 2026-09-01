# 06 — Backlog Executável

Toda história é uma **fatia vertical**: entrega comportamento observável ponta
a ponta. Nenhuma história é "criar a camada X".

**Tamanho** (critério objetivo): **P** = até 3 arquivos e nenhum contrato novo ·
**M** = até 8 arquivos ou 1 contrato novo · **G** = acima disso.

Nenhuma história contém verbo de decisão em aberto. Onde houver alternativa,
ela já foi decidida — em ADR ou nas tabelas de decisão de `03-modelo-dados.md`.

---

<a id="resumo"></a>

## Resumo do backlog

| Épico | Histórias | P | M | G |
|---|---|---|---|---|
| E1 — Fundação e perfilamento ✅ | H-01, H-02 | 0 | 2 | 0 |
| E2 — Leitura e normalização ✅ | H-03 … H-08 | 3 | 3 | 0 |
| E3 — Indicadores e alertas ✅ | H-09 … H-14 | 3 | 3 | 0 |
| E4 — Interface ✅ | H-15 … H-22 | 6 | 2 | 0 |
| E5 — Edição e escrita ✅ | H-23 … H-27 | 0 | 5 | 0 |
| E6 — Histórico ✅ | H-28, H-29 | 1 | 1 | 0 |
| E7 — Operação ✅ | H-30 … H-36 | 3 | 4 | 0 |
| E8 — A configuração alcançável ✅ | H-37, H-38 | 0 | 2 | 0 |
| E9 — Estilização ✅ | **H-39 … H-47 e H-67 … H-72, todas concluídas** | 7 | 8 | 0 |
| E10 — As melhorias de uso ✅ | **H-48 … H-56 e H-66, todas concluídas.** `H-50` é a única G do backlog | 2 | 7 | 1 |
| E11 — A casca redesenhada ✅ | **H-57 … H-65, todas concluídas** | 3 | 6 | 0 |
| E12 — Os achados da revisão de estilo ✅ | **H-73 … H-76, todas concluídas** | 2 | 1 | 1 |
| **Total** | **76** — 76 concluídas, nenhuma aberta | **30** | **44** | **2** |

**O ✅ marca o épico e, desde 31/08/2026, também cada história do índice.**
Marcar uma a uma já foi tentado e falhou: as marcas congelaram em 07/08/2026, com
`H-17`, e o índice seguiu afirmando que `H-13` estava aberta até 18/08/2026 —
a única coisa no repositório dizendo isso, contra o bloco `✅ CONCLUÍDA` da
própria história. **O defeito era ser manual e não verificado**, e é isso que
mudou: `tests/repo/contratos.test.ts` compara cada marca do índice com o bloco da
história e reprova na primeira divergência. A fonte de verdade continua sendo o
bloco; o índice agora é obrigado a concordar com ele.

`H-30` teve a ressalva do bloco dela **levantada em 31/08/2026**: o
`iniciar.cmd` foi executado na máquina do operador, sobe e carrega a planilha.
`PD-06` guarda os três itens que ainda faltam.

**Uma história é G, e o rótulo é deliberado** — `H-50`, desde `D-24`. As três
candidatas naturais anteriores foram quebradas: a
escrita no `.xlsx` virou `H-24` (cirurgia), `H-25` (defesas) e `H-26` (comando
ponta a ponta); os indicadores viraram cinco histórias por natureza de cálculo;
e o épico E10 separou os mapas (`H-48`) dos dois campos que os consomem
(`H-49`, `H-50`), que de outro modo seriam uma fatia só de 25 arquivos. `H-50`
foi cortada de novo em 31/08/2026, e `H-66` saiu dela (`D-24`).

---

<a id="indice"></a>

## Índice

**[Épico E1 — Fundação e perfilamento](#e1)**

- [H-01 — Perfilar a planilha real e emitir relatório de estrutura](#h-01) ✅
- [H-02 — Levantar o esqueleto do projeto com servidor, interface e testes](#h-02) ✅

**[Épico E2 — Leitura da planilha e normalização](#e2)**

- [H-03 — Ler a planilha e expor as linhas cruas com a célula-âncora de estilo](#h-03) ✅
- [H-04 — Traduzir a chave de estilo em responsável, canal e localização do importador](#h-04) ✅
- [H-05 — Normalizar textos de agrupamento e converter células em datas](#h-05) ✅
- [H-06 — Classificar cada linha em uma das quatro categorias canônicas](#h-06) ✅
- [H-07 — Compor os processos e emitir o relatório de quarentena e divergências](#h-07) ✅
- [H-08 — Recarregar automaticamente quando a planilha for alterada por fora](#h-08) ✅

**[Épico E3 — Indicadores e alertas](#e3)**

- [H-09 — Entregar as contagens por categoria de status](#h-09) ✅
- [H-10 — Entregar os indicadores de calendário](#h-10) ✅
- [H-11 — Entregar os agrupamentos e rankings](#h-11) ✅
- [H-12 — Entregar os indicadores de risco](#h-12) ✅
- [H-13 — Entregar os indicadores de tempo](#h-13) ✅
- [H-14 — Entregar os cinco alertas derivados do estado atual](#h-14) ✅

**[Épico E4 — Interface do painel](#e4)**

- [H-15 — Montar a casca da aplicação com os onze filtros globais](#h-15) ✅
- [H-16 — Entregar a Página Inicial com os cartões-resumo](#h-16) ✅
- [H-17 — Entregar a Página Operacional com tabela, busca e calendário](#h-17) ✅
- [H-18 — Entregar a Página Clientes](#h-18) ✅
- [H-19 — Entregar a Página Performance](#h-19) ✅
- [H-20 — Entregar a Página Alertas](#h-20) ✅
- [H-21 — Entregar a Página Histórico](#h-21) ✅
- [H-22 — Entregar a tela de detalhe do processo](#h-22) ✅

**[Épico E5 — Edição e escrita na planilha](#e5)**

- [H-23 — Editar campos na tela, enfileirando sem tocar no arquivo](#h-23) ✅
- [H-24 — Alterar células dentro do `.xlsx` preservando o arquivo byte a byte](#h-24) ✅
- [H-25 — Proteger a escrita com as seis defesas de integridade](#h-25) ✅
- [H-26 — Aplicar as edições pendentes sob comando explícito](#h-26) ✅
- [H-27 — Editar os campos codificados em cor](#h-27) ✅

**[Épico E6 — Histórico](#e6)**

- [H-28 — Registrar as mudanças de categoria a cada leitura](#h-28) ✅
- [H-29 — Entregar o alerta de processos parados](#h-29) ✅

**[Épico E7 — Operação](#e7)**

- [H-30 — Entregar a aplicação empacotada com atalho de execução](#h-30) ✅
- [H-31 — Entregar logs estruturados e métricas de ingestão](#h-31) ✅
- [H-32 — Sinalizar interferência externa no arquivo](#h-32) ✅
- [H-33 — Trocar o leitor de `.xlsx` do ExcelJS para `fflate`](#h-33) ✅
- [H-34 — Configurar o caminho da planilha pela tela, sem editar JSON](#h-34) ✅
- [H-35 — Chegar ao painel na primeira execução, sem linha de comando](#h-35) ✅
- [H-36 — O painel diz onde a partida parou, e revalida sem reexecutar o atalho](#h-36) ✅

**[Épico E8 — A configuração alcançável](#e8)**

- [H-37 — Escolher a planilha pelo diálogo do sistema](#h-37) ✅
- [H-38 — A tela de configuração deixa de ser inalcançável](#h-38) ✅

**[Épico E9 — Estilização](#e9)**

- [H-39 — Declarar a camada de tema e migrar a casca](#h-39) ✅
- [H-40 — Migrar os componentes de dado](#h-40) ✅
- [H-41 — Migrar a superfície de edição](#h-41) ✅
- [H-42 — Migrar as sete páginas e fechar a guarda de cor](#h-42) ✅
- [H-43 — Live regions da casca e dos componentes](#h-43) ✅
- [H-44 — Live regions das páginas, gráfico e forced-colors](#h-44) ✅
- [H-45 — Unificar papéis de UI e tirar a informação só-cor](#h-45) ✅
- [H-46 — Responsividade e contenção de rolagem](#h-46) ✅
- [H-47 — Percorrer os cinco procedimentos de navegador](#h-47) ✅
- [H-67 — A linha do ranking cabe em 320 px](#h-67) ✅
- [H-68 — O seletor de cor cabe na tela do celular](#h-68) ✅
- [H-69 — O texto cortado da tabela tem caminho de volta](#h-69) ✅
- [H-70 — O foco sobrevive à navegação programática](#h-70) ✅
- [H-71 — O valor anterior da edição é legível](#h-71) ✅
- [H-72 — A aba corrente sobrevive ao alto contraste](#h-72) ✅

**[Épico E10 — As melhorias de uso](#e10)**

- [H-48 — Os dois mapas de negócio, fora do repositório](#h-48) ✅
- [H-49 — Cliente consolidado, separado do processo do cliente](#h-49) ✅
- [H-50 — Responsável pelo importador, com a cor desempatando](#h-50) ✅
- [H-51 — Canal verde, e a distribuição à vista](#h-51) ✅
- [H-52 — Os cartões declaram o período, e ele é editável ali](#h-52) ✅
- [H-53 — A Página Performance diz a métrica e mostra o recorte](#h-53) ✅
- [H-54 — O histórico reconstrói os meses da planilha](#h-54) ✅
- [H-55 — Grupo de clientes no filtro](#h-55) ✅
- [H-56 — O ranking de clientes mostra o grupo com a composição](#h-56) ✅
- [H-66 — O filtro da cor de responsável na tela](#h-66) ✅

**[Épico E11 — A casca redesenhada](#e11)**

- [H-57 — O par escuro da camada de tema](#h-57) ✅
- [H-58 — As duas famílias de fonte, servidas do repositório](#h-58) ✅
- [H-59 — Navegação lateral e topo de uma linha](#h-59) ✅
- [H-60 — Os quatorze filtros como chips em popover](#h-60) ✅
- [H-61 — Forma, densidade e número nos componentes de dado](#h-61) ✅
- [H-62 — Forma e número na superfície de edição e no detalhe](#h-62) ✅
- [H-63 — Forma e número nas sete páginas, e a guarda de forma](#h-63) ✅
- [H-64 — Movimento curto, com a redução nascendo junto](#h-64) ✅
- [H-65 — Percorrer os procedimentos de navegador nos dois esquemas](#h-65) ✅

**[Épico E12 — Os achados da revisão de estilo](#e12)**

- [H-73 — A faixa de severidade no token certo](#h-73) ✅
- [H-74 — As quatro correções locais](#h-74) ✅
- [H-75 — Um papel de UI, uma forma e um nome](#h-75) ✅
- [H-76 — A coluna Navio cabe no que ela mostra](#h-76) ✅


---

<a id="e1"></a>

## Épico E1 — Fundação e perfilamento

<a id="h-01"></a>

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

[↑ Índice](#indice)

---

<a id="h-02"></a>

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

[↑ Índice](#indice)

---

<a id="e2"></a>

## Épico E2 — Leitura da planilha e normalização

<a id="h-03"></a>

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

[↑ Índice](#indice)

---

<a id="h-04"></a>

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

[↑ Índice](#indice)

---

<a id="h-05"></a>

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
- **Dado** `"  acme  "`, **quando** `normKey` roda, **então** devolve
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

[↑ Índice](#indice)

---

<a id="h-06"></a>

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

[↑ Índice](#indice)

---

<a id="h-07"></a>

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

[↑ Índice](#indice)

---

<a id="h-08"></a>

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

[↑ Índice](#indice)

---

<a id="e3"></a>

## Épico E3 — Indicadores e alertas

<a id="h-09"></a>

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

[↑ Índice](#indice)

---

<a id="h-10"></a>

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

[↑ Índice](#indice)

---

<a id="h-11"></a>

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

[↑ Índice](#indice)

---

<a id="h-12"></a>

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

[↑ Índice](#indice)

---

<a id="h-13"></a>

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

[↑ Índice](#indice)

---

<a id="h-14"></a>

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

[↑ Índice](#indice)

---

<a id="e4"></a>

## Épico E4 — Interface do painel

<a id="h-15"></a>

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
- **Dado** `client=ACME LOG&client=BETA`, **então** o resultado satisfaz
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

[↑ Índice](#indice)

---

<a id="h-16"></a>

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

[↑ Índice](#indice)

---

<a id="h-17"></a>

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

[↑ Índice](#indice)

---

<a id="h-18"></a>

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
> Desatualizado desde 17/08/2026, e mantido como registro do que se sabia aqui:
> o Recharts **estreou em `H-21`**, na Página Histórico, com a mesma limitação de
> `jsdom` contornada por uma tabela acessível ao lado do gráfico. `H-19` acabou
> usando `div` também.
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

[↑ Índice](#indice)

---

<a id="h-19"></a>

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

[↑ Índice](#indice)

---

<a id="h-20"></a>

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

[↑ Índice](#indice)

---

<a id="h-21"></a>

### H-21 — Entregar a Página Histórico

> ✅ **CONCLUÍDA em 17/08/2026.** 18 testes próprios em 1 arquivo; suíte total
> em **1123**. Última página do menu — as sete estão montadas.
>
> **A lista tinha 2 arquivos e a fatia precisou de 6.** Faltava a camada web
> inteira — `getMonthlyHistory`, `useHistory`, o ramo em `App.tsx`, o teste da
> página e a rota no stub. E `src/http/routes/history.ts`, que a lista trazia,
> **não mudou uma linha**: `H-28` a entregou completa, com 14 testes cobrindo os
> três casos-limite desta história. Resíduo de quando `H-21` vinha antes.
>
> **O caso-limite "sem histórico → gráfico com um único ponto" contradizia o
> contrato**, que serve `series: []` e `historyStartedAt: null` sem histórico
> algum. São dois estados, não um: arquivo vazio não tem ponto a desenhar e
> recebe estado vazio afirmativo; um ponto só existe depois da primeira leitura
> gravar. Ambos com teste.
>
> **O volume do histórico não é o total da planilha, e a tela passou a dizer
> isso.** `aggregateMonthly` acumula os REF observados e nunca remove — sumir da
> planilha não gera evento (ADR-0005) —, então a diferença cresce com o tempo.
> Sem a nota, o operador compara com o cartão da Página Inicial e desconfia dos
> dois números certos. Achado da conferência, não do plano.
>
> A conferência de 17/08/2026 mediu 650 no histórico contra 649 na planilha, mas
> **a REF a mais não é processo removido**: é `FT999.26`, `sourceRow` 11,
> resíduo de conferência manual no `data/history.jsonl` de desenvolvimento. A
> divergência que a nota explica é real e o mecanismo é o descrito; o caso que a
> produziu nesta máquina, não. Quem quiser reconferir precisa de um arquivo
> limpo — a planilha real não perdeu REF nenhuma até aqui.
>
> **Recharts estreou aqui**, fixado na stack desde o plano e nunca usado: as
> barras de `H-18` e `H-19` são `div`. A paleta passou pelos seis testes de
> contraste e daltonismo — pior par adjacente com ΔE 13,1 em deuteranopia. O
> gráfico é `aria-hidden` e a tabela ao lado carrega os mesmos números: o SVG
> não é legível por leitor de tela, e em `jsdom` o `ResponsiveContainer` mede
> zero e não desenha — a asserção precisa da tabela de qualquer forma.
>
> **O Recharts responde por 374 dos 634 kB do pacote**, medido comparando a
> build com e sem ele, e a Página Histórico é a única que o importa. Ela passou
> a ser carregada sob demanda: o pacote inicial voltou a 262,22 kB (77,99 kB
> comprimido) e o gráfico virou um segundo arquivo, buscado ao abrir a página. O
> aviso de 500 kB do Vite sumiu **sem ser silenciado** — o limite continua onde
> estava, para avisar do próximo salto. Numa aplicação local o ganho de tempo é
> nulo; o que se ganhou foi o aviso de volta à condição de sinal.
>
> **A divisão cegou a guarda de página montada, e isso precisou de conserto
> junto.** `paginas-montadas.test.tsx` consultava o marcador de forma síncrona,
> e com a página sob demanda a consulta acontecia com o fallback do `Suspense`
> na tela — passaria sem nunca tê-la renderizado. Agora espera o módulo chegar.
> Verificado por mutação: quebrando o ramo de propósito, a guarda reprova com a
> mensagem certa.
>
> **A guarda de âncora morta tinha um buraco, e ele apareceu ao ser usado.**
> `REPO_PATH` não cobria `src/` nem `web/`, e o `\b` casava o `tests` de
> `web/tests/paginas-montadas.test.tsx` no meio da palavra — cobrava um caminho
> que nunca existiu. Corrigida: os caminhos conferidos passaram de 18 para 54,
> sem nenhuma âncora morta nova.
>
> **A janela é seletor local de 12, 24 ou 60 meses**, e não filtro global: sem
> ele o `months` do contrato nunca sairia de 12, e o caso-limite dos 60 meses
> não teria como ser exercido pela tela.

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

[↑ Índice](#indice)

---

<a id="h-22"></a>

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

[↑ Índice](#indice)

---

<a id="e5"></a>

## Épico E5 — Edição e escrita na planilha

<a id="h-23"></a>

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

[↑ Índice](#indice)

---

<a id="h-24"></a>

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

[↑ Índice](#indice)

---

<a id="h-25"></a>

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

[↑ Índice](#indice)

---

<a id="h-26"></a>

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

[↑ Índice](#indice)

---

<a id="h-27"></a>

### H-27 — Editar os campos codificados em cor

> ✅ **CONCLUÍDA em 17/08/2026.** 80 testes próprios — 23 em
> `tests/io/xlsx-surgeon-style.test.ts`, 13 em `tests/http/process-color.test.ts`,
> 12 em `web/tests/ColorFieldsForm.test.tsx`, mais 32 acrescentados a
> `write-guard`, `color-mapper`, `edit-queue`, `color-map-loader` e
> `AplicarAlteracoes`; suíte total em **1040**. Oito divergências do plano
> resolvidas na abertura, **duas bloqueantes**.
>
> **A primeira bloqueante: a fila não comportava edição de cor.** `EditCommand`
> era tipado `field: EditableField`, e nenhum dos três campos está em
> `EDITABLE_FIELDS` — a admissibilidade de `H-25` recusaria a fila **inteira**
> com `ESCRITA_INVALIDA`, inclusive as edições de texto legítimas. Resolvido com
> registro discriminado por `kind` na mesma fila; `kind` ausente vale `'field'`,
> então o `.jsonl` gravado antes desta história segue válido sem migração. Mesma
> fila, e não uma segunda, porque a aplicação é atômica: um backup, uma
> gravação, uma validação, uma rotação.
>
> **A segunda: "exatamente uma entrada do mapa" era impossível de satisfazer.**
> O mapa real tem **9 entradas para 6 combinações** — `indefinido/nenhum/false`
> casa com verde tom A, verde tom B e branco; `colaborador2/nenhum/false`, com
> os dois roxos (A-48). A regra literal recusaria 3 das 9, entre elas o verde,
> que cobre 477 das 649 linhas. Passou a ser **"pelo menos uma, e a primeira na
> ordem do arquivo vence"** — o tom canônico, o mesmo critério que o caso-limite
> do verde tom B já pressupunha. **Consequência aceita pelo usuário:** a
> interface oferece as **6** combinações representáveis, rotuladas pela cor que
> será gravada; branco e os tons B ficam legíveis e **não graváveis**.
>
> `GET /api/color-options` nasceu daí, fora do contrato fixado: sem ela a
> interface carregaria uma cópia das combinações, que divergiria de
> `config/color-map.json` no primeiro ajuste — oferecendo cor que a escrita não
> grava. `rowsRepainted` entrou em `WriteResult` pelo mesmo motivo de honestidade:
> uma troca de cor toca 12 células (A-44) sem gravar valor, e somá-la a
> `cellsWritten` diria ao operador que ele gravou doze coisas.
>
> **O `revisor-xml` foi invocado quatro vezes e reprovou três.** Cinco defeitos
> reais, **um deles herdado de `H-24`**, e nenhum pego pela suíte.
>
> (1) **A leitura de `s=` varria o elemento inteiro, não a tag de abertura.**
> Numa célula de texto inline cujo conteúdo contenha ` s="`, `readAttribute`
> casava o valor de dentro do **texto**, e a repintura partia do estilo errado —
> trocando fonte e borda, que é a classe de dano de A-49. Eu havia protegido a
> escrita (`withStyleAttribute`) e esquecido a leitura. **O mesmo defeito existia
> em `writeCell` desde `H-24`**, silencioso; os dois passaram a usar `openTagOf`.
>
> (2) **A aplicação reescrevia a planilha inteira sem mudar um byte.** O
> operador reconfirma a cor que a linha já tem — o caminho **mais provável**,
> porque o formulário chega na combinação corrente — e o guard gravava assim
> mesmo: mesmo XML recomprimido, ~2% maior, hash e `mtime` novos, um slot de
> backup gasto, OneDrive reenviando o arquivo e o observador relendo. A promessa
> "nada é gravado" era **emenda minha ao backlog que não estava no código**.
> Resolvido invertendo cirurgia e backup — ela é pura, opera em memória —, com
> ramo que devolve sucesso, `fileState: 'intacto'` e `backupPath: null`.
> `docs/04-arquitetura.md §3.2` traz a emenda do diagrama.
>
> (3) **Criar célula ausente produzia linha colorida sem bordas.** A célula
> criada herdaria `<col style="162">`, com `borderId="0"`. Medido antes de
> decidir: **744 linhas de dados, zero células ausentes em A–L** — o ramo era
> inalcançável em produção e danoso quando alcançável. Deixou de criar.
>
> (4) `rowsRepainted` contava linhas **pedidas**, não pintadas. (5) `hasFill`
> contava `<fill>` no arquivo inteiro, e `<dxf>` inflaria o limite. Ambos com
> teste.
>
> **Quatro pontos do plano estavam errados e foram emendados**, cada um com a
> medição e a data (regra inviolável 1): a herança de estilo — que é
> célula → linha com `customFormat` → **coluna** → `cellXfs[0]`, e não
> "`styleId 0`" —, a combinação já vigente que **não** grava, a célula ausente
> que não é criada, e o `400 CORPO_INVALIDO` para entrada sem `fillId`, que é
> **inalcançável**: `loadColorMap` derruba a partida antes.
>
> **Conferido contra a planilha real, sobre cópia:** 30 entradas no zip, **28
> idênticas** — só `sheet1.xml` e `styles.xml` mudam, e as três abas fora de
> escopo saem byte a byte iguais. `styleId 165` → 290 novo, com `fillId` 2 → 8 e
> **borda 5 e fonte 1 preservadas**; `cellXfs` 290 → 294, `count` conferindo e
> todos os anteriores intactos; M a P inalteradas (A-44).

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
- Célula sem atributo `s=` → o atributo é acrescentado com o `xf` resultante,
  partindo do estilo que **já governa a célula**: célula → linha com
  `customFormat="1"` → **coluna** → `cellXfs[0]`.

  > **Emenda de `H-27` (17/08/2026).** Esta linha dizia "tratada como
  > `styleId 0`", e isso está **errado** — a precedência acima é a do OOXML, e é
  > a que o Excel aplica. Medido em `tests/fixtures/cores.xlsx`: `cellXfs[0]` é
  > `(numFmt 0, font 0, fill 0, border 0)` sem alinhamento, enquanto as 16
  > `<col>` declaram `style="162"` = `fontId 1` + `alignment center`. Partir do
  > `xf` zero trocaria **fonte e alinhamento** de uma célula que só deveria
  > mudar de preenchimento — a classe de dano que A-49 existe para impedir. É a
  > mesma herança que `writeCell` usa desde `H-24`.
- Combinação que já é a atual → aceita, e **nada é gravado**: nenhum `xf` novo,
  nenhum byte alterado, `rowsRepainted` zero.

  > **Emenda de `H-27` (17/08/2026).** Dizia "aceita e **gravada**; o resultado
  > é idêntico". Gravar produziria backup, mudança de hash e disparo do
  > observador para uma alteração que não altera nada. A aplicação aceita a
  > edição — não é erro pedi-la — e a cirurgia não escreve.
- **Célula ausente em A–L → não é criada.** Ela já é governada pelo estilo da
  coluna, cujo `borderId` é zero: criá-la com o preenchimento novo deixaria a
  linha colorida e **sem as bordas da tabela** nessas colunas. Medido em
  17/08/2026 sobre a planilha real: **744 linhas de dados, zero células ausentes
  em A–L** — nenhuma coluna fica sem pintar no uso real.
- Linha auto-fechada (`<row r="N" .../>`) → não é expandida: não tem célula, a
  repintura não cria nenhuma, e abri-la produziria diferença no arquivo sem uma
  única célula pintada.
- `fillId` além de `<fills>`, ou `s=` além de `cellXfs` → **recusa antes de
  gravar**. Índice pendurado faz o Excel pedir reparo, e silêncio aqui só seria
  pego pela validação pós-escrita, ao preço de restaurar o backup.
- Duas células da mesma linha com `styleId` diferentes (caso real: borda de
  fim de bloco) → cada uma resolve seu próprio `xf` alvo; a linha pode terminar
  com dois `styleId` distintos, e isso é **correto**.
- Pintar de verde uma linha que já é verde do tom B (`fillId 12`) → o alvo do
  mapa é o tom A (`fillId 2`); a gravação ocorre e unifica o tom. Comportamento
  aceito: a aplicação escreve o tom canônico do mapa.
- `color-map.json` sem `fillId` na entrada escolhida → **não chega à rota**:
  `loadColorMap` a rejeita na **partida**, e o processo não sobe.

  > **Emenda de `H-27` (17/08/2026).** Esta linha prescrevia `400
  > CORPO_INVALIDO`. A guarda anterior é mais estrita e mais cedo — a validação
  > de `H-04` já exige `fillId` inteiro não negativo em toda entrada —, então o
  > `400` é inalcançável. Documentá-lo no contrato seria afirmar resposta que o
  > servidor não produz; `docs/05-contratos-api.md` registra a ausência.

**Dependências:** H-26, H-04
**Tamanho:** M

[↑ Índice](#indice)

---

<a id="e6"></a>

## Épico E6 — Histórico

<a id="h-28"></a>

### H-28 — Registrar as mudanças de categoria a cada leitura

> ✅ **CONCLUÍDA em 17/08/2026.** 66 testes próprios — 20 em
> `tests/domain/history.test.ts`, 24 em `tests/io/history-store.test.ts`, 17 em
> `tests/http/history.test.ts`, 3 no detalhe de `tests/http/processes.test.ts` e
> 2 em `web/tests/ProcessDetail.test.tsx`; suíte total em **1105**. Nove
> divergências do plano resolvidas na abertura, **uma bloqueante**.
>
> **A bloqueante: `canalVermelho` não era derivável do arquivo.** O contrato de
> `GET /api/history/monthly` serve três medidas por mês, e o ADR-0005 afirmava
> que o histórico destravava as três — mas o `StatusEvent` de §3.1 carregava só
> `from` e `to`, ambos `StatusCategory`. O canal vem da **cor da linha**
> (IND-06) e é campo independente do status (regra inviolável 4): nenhuma
> agregação daqueles dois campos o produz, e servir `0` afirmaria ausência de
> Canal Vermelho sobre dado que ninguém registrou.
>
> **Era a única divergência desta fatia cujo custo de adiar não é retrabalho, e
> sim dado perdido:** o arquivo é append-only e sem retroatividade, então cada
> mês rodando sem gravar o canal seria um mês que a série nunca teria. Resolvido
> acrescentando `channel` ao evento e emitindo evento quando a categoria **ou** o
> canal mudam — emenda registrada no ADR-0005 e em §3.1.
>
> **A consequência que a emenda obriga, e que é o defeito silencioso que ela
> quase introduziu:** um evento pode ter `from` igual a `to` (mudou só o canal),
> e `daysInCategory` conta **apenas** as mudanças de categoria. Se contasse
> todas, trocar a cor de uma linha reiniciaria o contador e ALE-06 deixaria de
> disparar — falha na direção de silenciar o alerta, que é a pior das duas.
> `LastSeen.categoryChangedAt` existe só para isso.
>
> **A suíte passou a escrever em `data/` real, e ninguém teria notado.** O
> `process-store` grava o histórico a cada leitura, e o caminho padrão caía em
> `data/history.jsonl`: na primeira execução, `tests/http/processes.test.ts`
> reprovou por histórico que a própria suíte acabara de criar. Duas defesas, e a
> segunda é a que dura: `tests/setup.ts` dá um diretório temporário por arquivo
> de teste, e `resolvePath` **recusa o padrão** sob `NODE_ENV=test`, para que
> esquecer as duas coisas falhe alto em vez de contaminar a máquina do operador.
> Fora de teste a variável não é sequer consultada.
>
> **Onde a regra ficou.** `monthlySeries` e `daysInCurrentCategory` agregam, e a
> regra inviolável 6 vale: o cálculo puro foi para `src/domain/history.ts` e
> `src/io/history-store.ts` ficou com persistência e índice. O precedente de
> `quarantine-reporter` — `buildReport` ao lado de `writeReport` — não estica
> até uma agregação deste tamanho.
>
> **A rota é [F], e o recorte por filtro tem limite declarado.** O evento carrega
> só `ref`; cliente, navio e agente vivem na planilha. Com filtro ativo os REF
> são resolvidos contra a leitura **atual**, então a série recortada descreve o
> passado de quem casa hoje. Sem filtro ela sai inteira do arquivo — e é por isso
> que `hasAnyFilter` existe: tratar "sem filtro" como "filtro que casa tudo"
> faria uma linha removida da planilha apagar o próprio passado da série.
>
> **A agregação lê em blocos e não materializa lista de eventos.** `eachLine` é
> generator, não callback, justamente para `aggregateMonthly` consumir um
> iterável — a primeira versão acumulava tudo num array antes de agregar, que é
> exatamente o que o caso-limite das 100 mil linhas proíbe.
>
> **Conferido contra a planilha real:** 649 processos → **649 eventos** na
> primeira leitura, todos com `from: null`; **zero** na releitura sem mudança.
> Alterando duas linhas, 2 eventos — 1 de categoria e 1 só de canal, separados
> corretamente. A série reproduz a leitura: **481** desembaraçados e **6** de
> Canal Vermelho, contra os mesmos 481 e 6 medidos nos processos, com
> `truncated: true` para a janela de 12 meses sobre 1 mês de histórico.

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

[↑ Índice](#indice)

---

<a id="h-29"></a>

### H-29 — Entregar o alerta de processos parados

> ✅ **CONCLUÍDA em 18/08/2026.** 19 testes próprios — 11 em
> `tests/domain/alerts.test.ts`, 4 em `tests/http/alerts.test.ts` e 4 em
> `web/tests/Alerts.test.tsx`, mais 2 reescritos; suíte total em **1146**.
> Cinco divergências do plano resolvidas na abertura, **uma delas um defeito já
> em produção**.
>
> **A regra já existia; o que faltava era a tela.** `buildAlerts` recebia
> `stalledDays` e `threshold` desde `H-14`, e a rota já os alimentava com o
> histórico real desde `H-28`. A lista de arquivos da história não citava
> `web/src/pages/Alerts.tsx`, onde a decisão estava escrita como
> `type !== 'processos_parados'` — literal, por tipo. Sem tocá-la, o alerta
> dispararia na API e a tela exibiria traço para sempre, ainda dizendo ao
> operador que o histórico "só passa a ser gravado em `H-28`". `AlertRow.tsx`,
> o único arquivo de interface que a história citava, **não mudou**: já
> suportava o tipo inteiro desde `H-20`.
>
> **O defeito herdado: `historyStartedAt` é instante ISO completo, e a tela o
> fatiava como `AAAA-MM-DD`.** `formatDay` fazia `split('-')` sobre o `ts` do
> primeiro evento e renderizava `17T12:00:00.000Z/08/2026`. Passou por `H-28`
> porque o stub de `web/tests/support/api-stub.ts` servia `null`, e o único caso
> com data usava `'2026-08-01'` — data pura, que o `split` aceita. **Stub que
> não imita o formato do servidor não é teste do contrato**, e este custou uma
> tela errada por um dia inteiro de produção.
>
> **O zero de ALE-06 tem dois sentidos opostos, e a interface não podia escolher
> entre eles.** Com histórico de 3 dias e limiar de 15, nenhum processo teve
> tempo de disparar: exibir `0` afirmaria ausência de problema que ninguém
> mediu, que é o que a regra inviolável 3 proíbe. Decidir isso exige comparar
> instante com dia civil no fuso da aplicação — regra, e o cliente nem conhece
> fuso (regra 6). Resolvido com `stalledCoverage` no domínio e dois campos
> aditivos em `GET /api/alerts`: `stalledCoverageDays` e `stalledMeasurable`. A
> tela passou a ter três estados em vez de um texto fixo, e o do meio é o que
> A-43 pedia: *"o histórico tem 1 dia e o limiar é de 15 dias — nenhum processo
> teve tempo de atingi-lo"*.
>
> **Medido na planilha real em 18/08/2026:** 649 processos, **todos com base no
> histórico** — `refSemBase: 0`, porque `H-28` gravou as 649 na primeira
> leitura. Histórico iniciado em 17/08/2026, cobertura de **1 dia** contra
> limiar de 15, `stalledMeasurable: false`, e a maior contagem de dias parados é
> **1**. Nenhum alerta gerado, como o critério de aceite previa. Com o limiar
> forçado a `0`, **169 dos 169 processos ativos** disparam — os 480
> desembaraçados ficam de fora (A-59), e é essa simulação que prova a fiação
> ponta a ponta enquanto o tempo real não passa.
>
> `daysSince` foi extraída em `src/domain/history.ts` e `daysInCategory` passou
> a usá-la: a conversão de instante para dia civil no fuso passa a ter **uma**
> definição, e não duas que divergiriam na primeira correção.

**Objetivo:** ALE-06, destravado pelo histórico.

**Arquivos:**
- `src/domain/alerts.ts`
- `src/domain/history.ts` — `daysSince` extraída *(divergência 3)*
- `src/http/routes/alerts.ts` — os dois campos novos *(divergência 3)*
- `web/src/pages/Alerts.tsx` — a tela *(divergências 1 e 2)*
- `web/src/components/AlertRow.tsx` — **não mudou** *(divergência 4)*
- `docs/05-contratos-api.md` · `tests/domain/alerts.test.ts` ·
  `tests/http/alerts.test.ts` · `web/tests/Alerts.test.tsx` ·
  `web/tests/support/api-stub.ts` *(divergências 3 e 5)*

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

[↑ Índice](#indice)

---

<a id="e7"></a>

## Épico E7 — Operação

<a id="h-30"></a>

### H-30 — Entregar a aplicação empacotada com atalho de execução

> ✅ **CONCLUÍDA em 18/08/2026, com uma ressalva declarada abaixo — leia-a
> antes de tratar a história como encerrada.** 11 testes próprios em
> `tests/http/static.test.ts`; suíte total em **1157**. Seis divergências
> resolvidas na abertura, mais uma descoberta durante a implementação.
>
> **A ressalva foi levantada em 31/08/2026, e o que sobrou é pequeno.** Era
> batch do Windows (RNF-26) escrito em Linux, e nada tinha sido exercido. Na
> máquina do operador, com a distribuição refeita do zero: **duplo clique, Node
> ausente, Node abaixo da 22, `app.json` ausente, porta ocupada e segunda
> execução passaram**, e a planilha real foi lida — 649 aceitas, 0 em quarentena.
> Sobram **janela fechada sem processo órfão**, que precisa de janela, e
> **caminho com espaços e acentos**. O que foi testado de verdade está listado adiante. **Esta história
> só está encerrada de fato depois da primeira instalação na máquina do
> operador**, e é lá que as duas pendências restantes fecham.
>
> **`GET /*` entregue e conferida contra o build real.** Sete casos pelo
> servidor inteiro, com as rotas de API registradas antes do catch-all: `/`,
> `/alertas`, `/processo/FT001.26` e `/relatorios` devolvem o mesmo
> `index.html` de 397 bytes; `/assets/History-D6QRrgof.js` devolve os 372 KB do
> chunk real com `application/javascript`; `/api/health` responde `200` JSON e
> `/api/inexistente` responde `404` — nenhum dos dois capturado pelo `/*`.
>
> **O registro não pode depender da pasta existir, e é isso que quase quebrou o
> CI.** `npm run verify` roda `test` **antes** de `build`, e no CI o checkout é
> limpo: `dist/web` não existe no instante em que `tests/repo/contratos.test.ts`
> monta o servidor e exige a rota. `@fastify/static` lança no registro quando o
> `root` não existe. Resolvido registrando `GET /*` sempre e consultando a pasta
> por requisição — o que também faz o `build` rodado com o servidor no ar valer
> sem reiniciar, e dá o caso-limite do backlog de graça: sem `dist/web`, a
> resposta é `503` com **página HTML em pt-br** dizendo o que falta, e não o
> envelope JSON de erro, que numa janela de navegador seria tela em branco.
>
> **A divergência que só apareceu implementando: `H-30` era a última rota
> pendente, e a guarda não previa o fim do plano.** `contratos.test.ts` tinha
> como âncora anti-vacuidade `DOCUMENTED.some(route => route.pendingStory !==
> null)` — retirar o último marcador `Pendente de` reprovou a suíte por o plano
> ter terminado, que é o oposto do que a âncora existe para detectar. O parser
> do marcador foi extraído para `pendingStoryOf` e passou a ser exercido com
> entrada sintética.
>
> **O servidor compilado não existe, e não deveria.** O contrato pedia `dist/`
> com o servidor compilado; a aplicação roda com `--experimental-strip-types`, e
> `npm run test:strip` está no portão exatamente para garantir isso. Compilar
> criaria um segundo modo de execução, e o que roda na máquina do operador
> deixaria de ser o que os testes exercitam. `scripts/build.mjs` **não foi
> criado**: `npm run build` já produz o necessário. Uma peça a menos.
>
> **`scripts/porta.mjs` nasceu de uma limitação do CMD, não de lógica.** Dentro
> de `for /f`, parênteses e aspas simples no comando quebram o parser — e um
> `node -p` com `JSON.parse` e `readFileSync` tem os dois. Chamar um arquivo pelo
> nome não tem nenhum. Os quatro cenários foram conferidos à mão: porta
> declarada devolve o valor, campo ausente devolve `5173`, JSON inválido sai com
> código `1`, arquivo ausente devolve `5173`. A porta continua com **uma** fonte.
>
> **O documento dizia `web/dist`; o Vite escreve em `dist/web`.** Invertido em
> `05-contratos-api.md §4` desde o início. Nada dependia da frase enquanto a
> rota não existia.
>
> **O `README.md` afirmava "12 de 32 histórias concluídas · 279 testes".**
> Medido no fechamento: 34 histórias no backlog, 32 concluídas, 1157 testes.
> Reescrito com a seção **Instalação** que a história pedia, e é ela que fecha
> **PD-03**: o projeto vai **fora** da pasta sincronizada, porque `data/` é
> relativo à raiz dele e `data/backups/` guarda cópias integrais do `.xlsx` —
> dentro do OneDrive, a pasta de segurança local replicaria na nuvem exatamente
> o dado que existe para proteger.

**Objetivo:** o operador iniciar a aplicação sem linha de comando.

**Arquivos:**
- `scripts/iniciar.cmd`
- `scripts/porta.mjs` — a porta, sem parênteses no comando *(divergência 7)*
- ~~`scripts/build.mjs`~~ — **não criado** *(divergência 1)*
- `README.md` (raiz do repositório)
- `config/app.json.exemplo`
- `src/http/routes/static.ts` — a rota `GET /*` *(divergência 4)*
- `src/http/server.ts` — o registro
- `tests/http/static.test.ts` — obrigatório pela guarda rota↔teste *(divergência 4)*
- `tests/repo/contratos.test.ts` — a âncora que supunha o plano inacabado *(divergência 7)*
- `docs/05-contratos-api.md` — marcador retirado, caminho corrigido *(divergências 2 e 4)*

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

[↑ Índice](#indice)

---

<a id="h-31"></a>

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

[↑ Índice](#indice)

---

<a id="h-32"></a>

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

[↑ Índice](#indice)

---

<a id="h-33"></a>

### H-33 — Trocar o leitor de `.xlsx` do ExcelJS para `fflate`

> ✅ **CONCLUÍDA em 18/08/2026.** 25 testes próprios — 24 em
> `tests/io/xlsx-parts.test.ts`, 1 em `tests/io/xlsx-reader.test.ts`; suíte
> total em **1183**. Seis divergências resolvidas na abertura, e o `exceljs`
> saiu do projeto.
>
> **O que era conjectura virou medição.** O leitor antigo, sobre
> `formatado.xlsx`: **4 arquivos em `/tmp`** (`tmp-<pid>-*`) e **5
> `FSReqCallback` mais 2 `PipeWrap`** vivos depois da promise resolver. O novo,
> no mesmo arquivo: **zero e zero**. O filtro nominal do `unzipSync` inflaciona
> só o workbook, os rels, o pool de texto, os estilos e a **única** aba em
> escopo — as três de fora não são descomprimidas, e a regra inviolável 10
> passa a valer por construção.
>
> **A troca foi provada por comparação, não por argumento.** Os dois leitores
> rodaram lado a lado, com o `exceljs` ainda instalado, sobre as 9 fixtures e
> sobre a planilha real. Serialização idêntica — valor, tipo, chave de estilo,
> `sheetPath` e hash — em 8 das 9 fixtures, e na planilha real: **744 linhas
> cruas, 649 processos compostos, 9 chaves de cor com as contagens exatas de
> `H-01`** (258, 219, 120, 31, 9, 5, 5, 1, 1). Zero divergência.
>
> **A nona fixture achou um defeito do leitor antigo.** Em `formulas.xlsx` as
> três células de fórmula com formato de data saíam como `number`, e agora saem
> como `date`. O leitor **em fluxo** do ExcelJS nunca convertia resultado de
> fórmula: a conversão mora em `cell-xform.js`, e o caminho de streaming tem um
> ramo próprio que só chama `parseFloat`. Uma célula sem fórmula, com o mesmo
> formato, virava `Date`. **A diferença não atravessa o domínio** — TD-03 trata
> serial pela regra 2 e `Date` pela regra 1, com o mesmo resultado —, e isso foi
> conferido: `buildProcesses` devolve saída byte a byte igual com os dois
> leitores.
>
> **O critério de "formato de data" NÃO foi unificado com o da escrita, de
> propósito.** `collectDateFormatIds`, em `src/io/xlsx-surgeon.ts`, casa
> `/[dy]/i` sobre o `formatCode` para **escolher** um formato ao gravar;
> `DATE_FORMAT_TOKEN`, no leitor, casa `/[ymdhMsb]/` para **classificar** o que
> já está no arquivo. Compartilhar faria `prevailingDateNumFmtId` eleger um
> formato de **hora** para gravar data. Dois critérios corretos, em lugares
> diferentes.
>
> **`date1904` entrou sem estar no plano.** O ExcelJS o honrava, e ignorá-lo
> erraria toda data por 4 anos e 1 dia num arquivo salvo pelo Excel para Mac
> antigo. O dado está em `<workbookPr>`, no mesmo XML que já era aberto para
> resolver o `sheetPath` — ler não é adivinhar.
>
> **`exceljs` saiu de `package.json`**, com **1.084 linhas a menos** em
> `package-lock.json`, e com ele as transitivas `archiver`, `unzipper` e
> `jszip`. **R-09 fechou**; **R-05 foi reformulado**: `theme` mais `tint` é como
> o OOXML guarda a cor de tema, não defeito de biblioteca. Oito documentos
> acompanharam, incluindo uma nota de atualização no ADR-0003.
>
> **A regra inviolável 9 do `CLAUDE.md` ficou citando um pacote que não existe
> mais** — `workbook.xlsx.writeFile()` do ExcelJS. A substância continua válida
> para qualquer biblioteca que reserialize a planilha, e reescrever regra
> inviolável não é decisão de história. Fica registrado aqui.

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

[↑ Índice](#indice)

---

<a id="h-34"></a>

### H-34 — Configurar o caminho da planilha pela tela, sem editar JSON

> ✅ **CONCLUÍDA em 18/08/2026.** 39 testes próprios — 13 em
> `tests/app/config-write.test.ts`, 9 em `tests/http/config.test.ts`, 9 em
> `web/tests/WorkbookSetup.test.tsx`, 6 acrescentados a
> `tests/app/process-store.test.ts` e 2 a `web/tests/App.test.tsx`; suíte total
> em **1224**. Seis divergências resolvidas na abertura, e duas delas paravam a
> implementação.
>
> **A história era impossível como escrita, e a fatia pegou isso antes do
> código.** `loadConfig` lançava `ConfigError` quando o arquivo de configuração
> não existia **ou** quando `workbookPath` apontava para arquivo ausente, e
> `main` respondia com `process.exit(1)`. Como o `app.json` não é versionado,
> numa instalação nova o processo morria **antes** de servir a tela que existe
> para consertar o caminho. A partida passou a tolerar exatamente essas duas
> condições; JSON malformado, `port` fora de faixa e `firstDataRow ≤ headerRow`
> continuam matando a partida, porque nenhuma delas é consertável pela tela. As
> três asserções que fixavam o comportamento antigo foram **invertidas, não
> apagadas**.
>
> **O watcher é o único consumidor que guarda cópia do caminho**, e por isso é o
> único recriado na troca. Todos os demais — store, write-guard, as onze rotas —
> leem `config.workbookPath` por referência do mesmo objeto, e
> `reconfigureWorkbook` o **muta**. Trocar o objeto deixaria a rota de saúde
> respondendo o caminho velho enquanto a leitura usa o novo. O `write-guard`
> ganhou `retargetWatcher` pelo mesmo motivo: segurando o observador antigo, ele
> pausaria um watcher que não observa mais nada, e o novo dispararia releitura no
> meio da gravação.
>
> **A serialização mora no store, não na rota**, porque é lá que reconfigurar no
> meio de uma leitura gravaria o estado do arquivo antigo por cima do novo.
>
> **Conferido contra a planilha real:** 649 processos e 0 em quarentena pelo
> caminho configurado; troca com o processo no ar devolvendo o mesmo hash e os
> mesmos 649; caminho inválido recusado **antes** da gravação, com o estado
> seguindo `pronto`; e planilha ilegível produzindo `degradado` com `lastReadAt`
> nulo, que é exatamente o gatilho da tela.
>
> **Um erro de implementação escreveu no arquivo de configuração do operador, e
> a correção não foi só consertar o erro.** Um caminho de configuração foi
> passado como sexto argumento de `buildServer`, que só tinha cinco: o argumento
> foi ignorado em silêncio e o teste gravou no arquivo real. Restaurado — as 8
> chaves estavam intactas, porque a gravação preserva os demais campos.
> `saveWorkbookPath` passou a **recusar o caminho padrão sob `NODE_ENV=test`**,
> como `history-store` faz desde `H-28`: é a regra inviolável 7, e sem a recusa
> o mesmo engano volta a ser silencioso.
>
> **A guarda de âncora de `tests/repo/contratos.test.ts` tinha falso positivo.**
> Ela lia a URL da rota nova como caminho de repositório, porque o primeiro
> segmento é homônimo de um diretório real, e cobrava um arquivo que nunca
> existiria. O `REPO_PATH` passou a excluir o que vem precedido de barra:
> caminho de repositório é citado relativo, URL não. Sem isso, o nome da rota
> seria empurrado para fora do comentário que a documenta.
>
> **`CONFIG_NAO_GRAVAVEL` entrou no catálogo de erros**, além do
> `CAMINHO_INVALIDO` que a história nomeia: o caso-limite do arquivo de
> configuração somente-leitura pede 400, e reaproveitar `CAMINHO_INVALIDO` diria
> que o problema é o caminho quando ele está correto.

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

[↑ Índice](#indice)

---

<a id="h-35"></a>

### H-35 — Chegar ao painel na primeira execução, sem linha de comando

> ✅ **CONCLUÍDA em 19/08/2026.** 25 testes próprios — 10 em
> `tests/app/config.test.ts`, 8 em `tests/http/config.test.ts` e 7 em
> `web/tests/WorkbookSetup.test.tsx`; suíte total de 1226 para **1251**. Duas
> divergências decididas na abertura, e uma terceira aberta pelo usuário depois,
> que quebrou a história em duas.
>
> **A história inteira é uma divisão de camadas, e ela se paga na primeira
> instalação.** O `.cmd` tinha quatro verificações; ficou com três, e a que saiu
> — `config/app.json` ausente — era a única que já tinha tela desde `H-34`. Numa
> extração nova o arquivo **nunca** existe, porque está no `.gitignore`: a
> verificação não era defesa, era a garantia de que a tela jamais seria vista.
>
> **`dist/` também está no `.gitignore`, e isso mudou a decisão.** "Interface não
> compilada" não é caso-limite: é o estado de toda instalação nova. Por isso o
> atalho passou a **oferecer compilar**, com confirmação — e `npm ci` roda
> **apenas** quando `node_modules` falta, que é o que preserva a máquina sem
> internet e com as dependências já baixadas. Rodá-lo à toa apaga a pasta e volta
> a exigir rede.
>
> **`restartPending` nasceu de um buraco que o inventário abriria.** O valor
> efetivo vem do objeto em memória e a origem vem do arquivo, relido a cada
> requisição — então um `port` editado à mão depois da partida apareceria como se
> estivesse valendo. Ele diz que arquivo e memória divergem, e não afirma que o
> próximo início aceitará o valor: são coisas diferentes, e prometer a segunda
> exigiria repetir a validação de `loadConfig` numa segunda regra.
>
> **`ausente` é a quarta origem porque `workbookPath` é o único dos oito campos
> sem padrão.** Marcá-lo como `padrao` afirmaria um padrão que `DEFAULTS` não
> tem. Mesma família de `sheetPresent`, que é `null` inclusive quando a última
> leitura **falhou**: "não se sabe" e "não tem" são respostas diferentes, e
> deduzir a presença da aba a partir do caminho seria adivinhar.
>
> **A guarda de caminho padrão sob teste passou a valer para a leitura.** Era só
> da gravação desde `H-34`; `describeConfig` lê, e um teste que caísse no padrão
> leria o `app.json` da máquina — passando ou reprovando pelo estado dela, que é
> exatamente o defeito que `H-28` mediu. `tests/http/config.test.ts` só voltou a
> passar depois de `serverWith` passar o sexto argumento de `buildServer`.
>
> **Um falso positivo do hook de dados sensíveis apareceu ao escrever o
> documento:** o blockquote markdown `> ` seguido de um caminho de configuração é
> lido como redirecionamento de shell para caminho protegido. O hook falha
> fechado, que é o comportamento certo; o texto foi reescrito.
>
> **Conferido contra a planilha e a configuração reais:** 649 processos lidos
> pelo caminho configurado, os oito campos do inventário com origem `arquivo`,
> `sheetPresent` verdadeiro, e `GET /api/config/workbook` respondendo `200` com o
> caminho no corpo — que é o esperado, porque a **tela** o mostra. O log do
> Fastify saiu com `method` e `url` apenas: a regra inviolável 8 conferida em
> execução, e não só pela asserção de código.
>
> **`scripts/iniciar.cmd` NÃO FOI EXECUTADO.** É batch do Windows e o
> desenvolvimento é em Linux. Tudo o que ele passou a fazer — a compilação sob
> demanda, o aviso de configuração ausente, a receita do JSON corrompido — está
> em `PD-06`, a conferir na primeira instalação na máquina do operador.
>
> **A história foi quebrada durante a execução.** O usuário pediu, depois do
> aceite, o checklist das etapas de partida no painel, o botão de revalidação e
> um `config/app.json.exemplo` fiel ao real. Isso levaria a lista a nove
> arquivos, e nenhuma história do plano é G: o diagnóstico virou `H-36`.

**Objetivo:** numa máquina limpa, o operador dá duplo clique no atalho e chega ao
painel — ou a uma tela que diz exatamente o que fazer em seguida — sem editar
arquivo nenhum e sem abrir prompt.

> **Nasceu como proposta de fim de fila e foi movida para o início.** É por isso
> que ela vive em `E7 — Operação`, ao lado de `H-30` a `H-34`, e não em `E9`:
> o assunto é operação, não estilização. A precedência sobre `H-39` … `H-47` é
> **ordem de trabalho**, não dependência técnica.
>
> **O defeito que ela corrige é de camada, não de código.** Numa máquina limpa o
> `scripts/iniciar.cmd` para com "Falta o arquivo de configuracao:
> config\app.json" e manda copiar um arquivo e editar JSON à mão — enquanto a
> tela que `H-34` entregou resolve exatamente isso e **nunca chega a ser
> exibida**, porque o batch morre antes de o Node subir. `config/app.json` está
> no `.gitignore`: numa instalação nova ele **nunca** existe.
>
> **A medida de sucesso é uma frase, e todo critério serve a ela:** instalar numa
> máquina limpa, sair da sala, e o operador chegar ao painel sem mandar mensagem.
>
> **`dist/` também está no `.gitignore`**, então "interface não compilada" não é
> caso-limite: é o estado garantido de toda extração nova.

**Arquivos:**
- `scripts/iniciar.cmd` — fica só o que impede o servidor de subir; as três
  mensagens viram receita completa
- `scripts/porta.mjs` — o comentário: a ausência do `app.json` deixou de ser
  barrada antes e virou o caso normal
- `src/app/config.ts` — `describeConfig`, o inventário dos oito campos
- `src/http/routes/config.ts` — os campos aditivos no `GET`
- `web/src/pages/WorkbookSetup.tsx` — a tela vira inventário
- `docs/05-contratos-api.md` — o contrato estendido
- `README.md` — passos 3, 4 e 5 da Instalação
- `tests/app/config.test.ts`, `tests/http/config.test.ts`,
  `web/tests/WorkbookSetup.test.tsx`

**Contrato fixado:**

```jsonc
// GET /api/config/workbook — aditivo; os três campos de H-34 permanecem
{
  "workbookPath": "C:\\...\\planilha.xlsx",
  "defined": true, "exists": true, "readable": true, "sheetPresent": true,
  "configFile": { "path": "config/app.json", "present": true, "parseable": true },
  "fields": [ { "key": "port", "value": 5173, "source": "arquivo", "restartPending": false } ]
}
// source: 'arquivo' | 'padrao' | 'ausente' | 'desconhecida'
```

**A divisão de camadas é a história.** Fica no `.cmd` **somente** o que impede o
servidor de subir ou a tela de existir — Node ausente, Node abaixo da 22 e
`dist/web/index.html` ausente. Os três são anteriores ao navegador por natureza,
e nenhuma interface pode reportá-los. Todo o resto migra para a tela.

**Duas decisões do usuário, tomadas na abertura da fatia:**

| Situação | Decisão | Por quê |
|---|---|---|
| `config/app.json` existe e é JSON inválido | **Continua matando a partida, com mensagem no `.cmd`** | Não é uma quarta verificação: é o tratamento de erro da leitura da porta, que continua acontecendo porque o `.cmd` precisa dela para abrir o navegador. Tolerar no servidor aplicaria padrão por cima de configuração que existe — valor errado invisível — e a tela ficaria **incapaz de salvar**, porque `saveWorkbookPath` relê antes de gravar |
| `dist/web/index.html` ausente | **O `.cmd` oferece compilar**, com confirmação | "Abra o Prompt na pasta certa" é o passo que quebra para quem não usa linha de comando (RNF-26). `npm ci` roda **só** se `node_modules` faltar — é o que salva a máquina sem internet e com dependências já baixadas |

**Critérios de aceite:**
- **Dado** máquina limpa sem `config/app.json`, **então** o servidor sobe na
  porta padrão e a tela de configuração aparece; nenhuma mensagem manda copiar
  arquivo nem editar JSON.
- **Dado** o salvamento nessa tela, **então** o `app.json` é criado com os demais
  campos íntegros.
- **Dado** `GET /api/config/workbook`, **então** os **oito** campos vêm com valor
  efetivo e origem, e `padrao` nunca é confundido com `arquivo` quando o valor
  coincide.
- **Dado** um caminho configurado, **então** `defined`, `exists`, `readable` e
  `sheetPresent` são quatro respostas distintas.
- **Dado** que a tela mostra o caminho, **então** ele não aparece em log algum
  (regra inviolável 8).
- **Dado** o épico `E9`, **então** nenhum dos zeros dispensados é reaberto: 0
  `dark:`, 0 `sticky`, 0 `animate-*`/`transition-*`, 0 `outline-none`, 0
  `tabIndex`, 0 `onClick` em elemento não interativo.

**Casos-limite:**
- `config/app.json` ausente → oito campos com origem `padrao`, exceto
  `workbookPath` com `ausente`.
- `{ "port": 5173 }` declarado → `arquivo`; `topN` omitido → `padrao`. Mesmo
  valor de padrão, origens diferentes.
- Arquivo corrompido **depois** da partida → `parseable: false`, os oito com
  origem `desconhecida`, valores em uso preservados.
- Caminho com espaços e acentos, e caminho UNC (`\\servidor\pasta`) → seguem
  sendo configuração, e não ausência dela.
- Caminho definido apontando para arquivo inexistente → o inventário mostra o
  caminho **e** o fato de não existir.
- `NODE_ENV=test` sem caminho injetado → `describeConfig` lança, como
  `saveWorkbookPath` desde `H-34` (regra inviolável 7).

**Sem teste automatizado, por serem do `.cmd`:** porta ocupada, segunda execução
com a aplicação no ar, `dist/web` ausente, máquina sem internet, duplo clique,
janela fechada sem processo órfão. `scripts/iniciar.cmd` é batch do Windows e o
desenvolvimento é em Linux — **nada aqui foi executado**, e o que ele passa a
fazer virou item de `PD-06`, no `CLAUDE.md`.

**Fora desta história:** qualquer código de `H-39` a `H-47` — alterar a contagem
de arquivos e o tamanho delas é entrega desta fatia; abrir os arquivos delas, não.
Também fora: vocabulário de tema (é `H-39`, e antecipá-lo tira dela a decisão que
a justifica), modo escuro, campo de configuração novo, editar os outros sete
campos pela tela, e seletor de aba (regra inviolável 10).

**Dependências:** H-30, H-34 — e **precede** H-39 … H-47, por ordem de trabalho
**Tamanho:** M (8 arquivos, 1 contrato estendido — `GET /api/config/workbook`
ganha campos aditivos; nenhuma rota nova)

[↑ Índice](#indice)

---

<a id="h-36"></a>

### H-36 — O painel diz onde a partida parou, e revalida sem reexecutar o atalho

> ✅ **CONCLUÍDA em 19/08/2026.** 13 testes próprios — 5 em
> `tests/http/config.test.ts` e 8 em `web/tests/WorkbookSetup.test.tsx`; suíte
> total de 1300 para **1313**. Quatro divergências abertas no protocolo de
> fatia, todas confirmadas pelo usuário.
>
> **A lista de arquivos foi de 5 para 8, e as três que faltavam eram fiação.**
> `useWorkbookConfig.ts`, porque o botão *Atualizar* precisa da recarga e
> `reloadToken` era estado interno; `api-stub.ts`, porque a fixture monta a
> resposta inteira e o `typecheck` quebra assim que o contrato ganha campo — a
> mesma omissão que mordeu em `H-19`, e ela **quebrou de fato**, na primeira
> compilação depois de estender o contrato; e `server.ts`, pela regra
> inviolável 7.
>
> **`webBuilt` lê o disco, e por isso precisou de ponto de injeção.** O portão
> roda `test` **antes** de `build`, e no CI o checkout é limpo: um teste que
> lesse `dist/web` direto ficaria verde na máquina de quem acabou de compilar e
> vermelho no CI, sem nada ter mudado no código. `registerStaticRoute` já tinha
> resolvido isso com `root` injetável em `H-30`; a rota de configuração passou a
> receber a **mesma** raiz, pela mesma via — duas fontes divergiriam no dia em
> que alguém mudasse uma delas.
>
> **O critério do `config/app.json.exemplo` já passava como estava escrito.**
> Medido: as oito chaves estão na mesma ordem de `FIELD_ORDER`, `loadConfig`
> aceita o arquivo, e os `_comentario` sobrevivem à gravação — `saveWorkbookPath`
> reserializa e preserva tudo. A única diferença de forma são as linhas em
> branco, que o `JSON.stringify` remove. O que de fato divergia era o **texto**:
> o comentário do topo mandava *"Copie para config/app.json e ajuste
> workbookPath"*, procedimento que `H-35` eliminou. O critério foi reescrito para
> o que faltava.
>
> **`runtime` traz só o que o navegador consegue conferir.** Node instalado e
> Node ≥ 22 ficaram de fora do contrato: a página é servida **pelo** Node, então
> exibi-la já é a prova das duas, e reportá-las como pendentes seria impossível
> por construção. Elas aparecem no checklist como cumpridas, com a versão real ao
> lado — o que transforma "deu certo até aqui" em fato conferível.
>
> **A planilha não entrou no checklist.** Os quatro fatos dela são o inventário
> logo abaixo, e repeti-los criaria dois lugares para manter o mesmo estado.
>
> Conferido no servidor real, sem `webRoot` injetado: `nodeVersion` bate com
> `process.versions.node` (22.23.2), `webBuilt` responde `true` lendo o
> `dist/web` de verdade, e os oito campos saem na ordem de `FIELD_ORDER`.

**Objetivo:** o operador ver, no próprio painel, quais etapas da partida foram
cumpridas e qual falta — e poder reconferir depois de resolver, sem fechar a
janela e dar duplo clique de novo.

> **Nasceu do corte de `H-35`**, que chegou a nove arquivos e foi quebrada. O que
> ficou aqui é a camada de diagnóstico: `H-35` faz a aplicação subir e criar o
> arquivo de configuração sozinha; esta faz o painel **dizer em que ponto ela
> está**.
>
> **Três etapas aparecem sempre cumpridas, e isso não é decoração.** Node
> instalado, Node ≥ 22 e interface compilada são pré-condição de a página
> existir — ela é servida *pelo* Node, a partir de `dist/web`. Vê-las verdes é a
> prova de que o operador passou delas, e mostrar a versão real do Node ao lado
> transforma "deu certo até aqui" em fato conferível. Quem reporta a **falha**
> das três continua sendo `scripts/iniciar.cmd`, e não há outra camada possível.
>
> **O botão *Atualizar* serve às etapas que mudam sem reiniciar:** o arquivo de
> configuração aparecer, a planilha voltar a existir na pasta sincronizada, a
> permissão de leitura mudar. É o caso real — o operador sincroniza o OneDrive
> no Explorer e reconfere ali mesmo.

**Arquivos:**
- `web/src/pages/WorkbookSetup.tsx` — o checklist e o botão *Atualizar*
- `web/src/hooks/useWorkbookConfig.ts` — expõe a recarga *(a conferência da fatia acrescentou)*
- `src/http/routes/config.ts` — os campos de ambiente no `GET`
- `src/http/server.ts` — repassa a raiz de `dist/web` *(idem, pela regra inviolável 7)*
- `docs/05-contratos-api.md` — o contrato estendido
- `config/app.json.exemplo` — fiel à forma que a aplicação grava
- `tests/http/config.test.ts`, `web/tests/WorkbookSetup.test.tsx`
- `web/tests/support/api-stub.ts` — a fixture *(idem; quebrou o `typecheck` de fato)*

**Contrato fixado:**

```jsonc
// GET /api/config/workbook — aditivo sobre H-35
{
  "runtime": {
    "nodeVersion": "22.23.2",  // process.versions.node, o real
    "webBuilt": true           // dist/web/index.html existe
  }
}
```

**Critérios de aceite:**
- **Dado** o painel aberto, **então** o checklist mostra as etapas na ordem em
  que `scripts/iniciar.cmd` as percorre, cada uma cumprida ou pendente.
- **Dado** que a página está sendo exibida, **então** as três etapas anteriores
  ao navegador aparecem cumpridas, e a do Node traz a **versão real**.
- **Dado** o botão *Atualizar*, **então** ele refaz `GET /api/config/workbook` e
  o checklist muda sem recarregar a página nem reexecutar o atalho.
- **Dado** `config/app.json.exemplo`, **então** ele descreve o procedimento que
  existe hoje e deixa de instruir cópia manual — as oito chaves e a ordem **já**
  batiam com o que a aplicação grava, e o que divergia era o texto.

**Casos-limite:**
- `dist/web/index.html` apagado com o servidor no ar → `webBuilt: false`, e o
  checklist o mostra pendente mesmo com a SPA carregada em memória.
- Clique em *Atualizar* durante um salvamento → a carga é a mesma do
  `reloadToken` de `useWorkbookConfig`; não há segunda regra.
- Etapa pendente **não** vira erro: o checklist é informação de estado, e um
  painel vermelho na primeira execução afirmaria falha onde há só ausência.

**Fora desta história:** reportar Node ausente ou abaixo da 22 pelo navegador —
é impossível por construção, e a mensagem do `.cmd` é a única camada que alcança
esses dois casos. Também fora: gravar pela tela qualquer campo além do caminho.

**Dependências:** H-35
**Tamanho:** M (8 arquivos, 1 contrato estendido)

[↑ Índice](#indice)

---

<a id="e8"></a>

## Épico E8 — A configuração alcançável

Duas histórias que nascem do mesmo relato, em 19/08/2026, na primeira máquina
Windows: *"o botão de carregar esta planilha não está funcionando"*. O botão
funcionava — o servidor gravava e relia. O que faltava era o caminho entre a
intenção do operador e a tela, nas duas pontas: informar **qual** arquivo sem
digitar um caminho, e **voltar** à tela depois da primeira vez.

Não vêm de auditoria nem do plano original. Vêm de uso.

---

<a id="h-37"></a>

### H-37 — Escolher a planilha pelo diálogo do sistema

> ✅ **CONCLUÍDA em 19/08/2026.** 20 testes próprios — 11 em
> `tests/app/file-dialog.test.ts`, 5 em `tests/http/config.test.ts` e 6 em
> `web/tests/WorkbookSetup.test.tsx`; suíte total de 1267 para **1296**, junto
> de `H-38`. Nenhuma divergência.
>
> **O gesto pedido era impossível pela via óbvia, e medir isso foi metade da
> história.** `<input type="file">` não entrega caminho — o `value` vira
> `C:\fakepath\<nome>` —, e a File System Access API também não. Como a
> aplicação grava cirurgicamente no arquivo do OneDrive, um upload seria uma
> cópia solta com a escrita voltando ao lugar errado. A saída é o servidor abrir
> o diálogo, e ela só existe porque o processo roda na máquina do operador.
>
> **O caminho volta em base64 de UTF-8, e isso não é zelo.** O console do
> Windows do operador está em code page 850, e `PD-06` já mediu o acento sendo
> corrompido em mensagem do `.cmd`. Transportar bytes tira a code page da conta.
> A conferência de ida e volta veio junto: `Buffer.from(…, 'base64')` **não**
> rejeita entrada inválida, decodifica lixo em silêncio — sem ela, um aviso
> escrito no stdout do PowerShell viraria um caminho inventado (regra 3).
>
> **Cancelar tem desfecho próprio, e é o mais comum depois do acerto.**
> `path: null` com `200`; o campo fica intacto e nada é dito. Um erro ali
> acusaria problema onde o operador só mudou de ideia.
>
> **O ponto de injeção atravessa as três camadas** — módulo, `registerConfigRoutes`
> e `buildServer` — de propósito. O diálogo em si exige Windows com sessão
> gráfica e é o único trecho que nenhum teste alcança; tudo ao redor dele fica
> coberto. É a lição de `PD-06` aplicada **antes** do fato, e não depois: a
> aplicação nunca subiu em Windows desde `H-30` por um defeito num trecho que
> nenhum teste tocava. **O diálogo é o item 10 de `PD-06`.**
>
> Conferido no servidor real em Linux: `POST /api/config/workbook/browse`
> responde `501 SELETOR_INDISPONIVEL` com a frase que manda digitar o caminho, e
> o campo de texto continua sendo via de primeira classe.

**Objetivo:** o operador clica em *Escolher arquivo*, o seletor do Windows abre,
ele seleciona o `.xlsx` e o caminho chega ao campo — sem digitar nem colar.

> **O navegador não entrega caminho, e isso não tem contorno.**
> `<input type="file">` devolve o conteúdo e o nome; o `value` vira literalmente
> `C:\fakepath\<nome>`. A File System Access API também não expõe caminho. É
> isolamento de segurança do navegador, e a aplicação precisa do caminho no
> disco: ela **grava cirurgicamente** naquele arquivo do OneDrive, e um upload
> seria uma cópia solta com a escrita voltando para o lugar errado.
>
> **Quem abre o diálogo é o servidor**, que roda na máquina do operador
> (RNF-29: só loopback). Ele invoca o seletor do próprio sistema e devolve o
> caminho escolhido. É a única via que entrega o gesto pedido.
>
> **O diálogo preenche o campo; não aplica.** `PUT /api/config/workbook` segue
> sendo a única porta de gravação, com a conferência que já existe — o operador
> vê o que escolheu antes de trocar a planilha da empresa. Dois passos por
> desenho, não por omissão.

**Arquivos:**
- `src/app/file-dialog.ts` — invoca o seletor do sistema
- `src/http/routes/config.ts` — a rota, que só serializa
- `src/http/server.ts` — passa o invocador de produção
- `web/src/api-client.ts` — `browseWorkbookPath()`
- `web/src/pages/WorkbookSetup.tsx` — o botão, ao lado do campo
- `docs/05-contratos-api.md`
- `tests/app/file-dialog.test.ts`, `tests/http/config.test.ts`,
  `web/tests/WorkbookSetup.test.tsx`

**Contrato fixado:**

```jsonc
// POST /api/config/workbook/browse — sem corpo
200 { "path": "C:\\Users\\...\\CONTROLE DOS EMBARQUE.xlsx" }
200 { "path": null }            // o operador cancelou
501 SELETOR_INDISPONIVEL        // esta máquina não abre diálogo
500 SELETOR_FALHOU              // o diálogo abriu e terminou mal
```

`POST` e não `GET`: abre uma janela na máquina — tem efeito, não é leitura.

**Critérios de aceite:**
- **Dado** o botão *Escolher arquivo*, **quando** o operador seleciona um
  `.xlsx`, **então** o caminho absoluto aparece no campo e **nada é gravado**.
- **Dado** que o operador cancela, **então** o campo fica **intacto** e nenhuma
  mensagem de erro aparece — cancelar é uma escolha, não uma falha.
- **Dado** uma máquina sem como abrir o diálogo, **então** a resposta é `501`, a
  tela diz para digitar o caminho, e o campo de texto continua funcionando.
- **Dado** um caminho com acento e espaço, **então** ele volta íntegro.

**Casos-limite:**
- Operador cancela → `path: null`, campo intacto (o caso mais provável depois do
  acerto, e o único em que "sem resposta" é a resposta correta).
- Linux, ou Windows sem PowerShell → `501`, e o campo de texto segue como via.
- `C:\Users\ana\OneDrive - Comércio Exterior\CONTROLE DOS EMBARQUE.xlsx` → volta com
  o acento e os três espaços preservados.
- O diálogo devolve algo que não é `.xlsx` → o `PUT` recusa como sempre; o
  seletor **não** vira uma segunda regra de validação.
- Dois cliques seguidos → um diálogo só.
- Diálogo deixado aberto → limite de tempo, em vez de requisição pendurada.

**Fora desta história:** arrastar e soltar o arquivo na página; lembrar a última
pasta usada; editar os outros sete campos de configuração.

**Dependências:** H-34, H-35
**Tamanho:** M (8 arquivos, 1 contrato novo)

[↑ Índice](#indice)

---

<a id="h-38"></a>

### H-38 — A tela de configuração deixa de ser inalcançável

> ✅ **CONCLUÍDA em 19/08/2026.** 9 testes próprios em `web/tests/App.test.tsx`;
> suíte total de 1267 para **1296**, junto de `H-37`. Nenhuma divergência.
>
> **O defeito era um link ausente, e ele durou desde `H-34`.** Medido antes de
> escrever qualquer linha: `grep` por `/configuracao` em `web/src/` devolvia
> apenas comentários. Nem menu, nem painel de saúde, nem faixa de estado — o
> único acesso era digitar o endereço, e depois de apontar a planilha uma vez o
> operador perdia a tela. A troca já funcionava e relia sem reiniciar; estava
> inalcançável.
>
> **E o comentário afirmava o contrário.** `web/src/router.ts` documentava
> *"Chega-se a ela pelo painel de saúde"* desde `H-34`, descrevendo um caminho
> que nenhuma linha construiu. É o mesmo modo de falha de `PD-06`: a afirmação
> que ninguém reconfere porque parece verificada.
>
> **`WORKBOOK_SETUP_PAGE` passou a derivar de `NAV_PAGES`** em vez de declarar
> os próprios campos. Ela continua exportada porque a casca desvia para a tela na
> primeira execução, quando o menu ainda não existe — mas duas declarações do
> mesmo endereço divergiriam na primeira vez que uma delas mudasse, e
> `parseRoute` perdeu o desvio dedicado pelo mesmo motivo.
>
> **O teste da casca deixou de contar seis.** `toHaveLength(6)` virou
> `toHaveLength(NAV_PAGES.length)`: o literal só avisaria reprovando, sem dizer
> se a página nova entrou ou se outra sumiu.

**Objetivo:** depois da primeira vez, o operador chega à troca de planilha por
três caminhos, sem digitar endereço no navegador.

> **A tela existe desde `H-34` e ninguém consegue chegar nela.** Medido em
> 19/08/2026: `/configuracao` não aparece em lugar nenhum de `web/src/` — nem no
> menu, nem no painel de saúde, nem na faixa de estado. O único acesso é digitar
> o endereço. Depois que a planilha é apontada uma vez, o operador **perde** a
> tela, e a troca — que já funciona, e relê sem reiniciar — fica inalcançável.
>
> **E o código afirmava o contrário.** `web/src/router.ts` documentava
> *"Chega-se a ela pelo painel de saúde"* desde `H-34`. Nunca se chegou: o
> comentário descrevia um caminho que nenhuma linha construiu. É o modo de falha
> de `PD-06` outra vez — a afirmação que ninguém reconfere porque parece
> verificada.
>
> **Três caminhos, e não um**, porque são três momentos: o menu para quem
> procura, o painel de saúde para quem está olhando o estado da planilha, e a
> faixa vermelha para quando ela não pôde ser lida — o momento em que o conserto
> é urgente e o operador não deveria ter de procurar onde ele fica.

**Arquivos:**
- `web/src/router.ts` — a página entra no menu, e o comentário passa a descrever
  o código
- `web/src/App.tsx` — item de menu e link no painel de saúde
- `web/src/components/StatusBanner.tsx` — o botão na faixa
- `web/tests/App.test.tsx`, `web/tests/StatusBanner.test.tsx`,
  `web/tests/paginas-montadas.test.tsx`

**Critérios de aceite:**
- **Dado** o painel com a planilha lida, **então** existe um item de menu que
  leva a `/configuracao`, e ele marca `aria-current="page"` como os outros seis.
- **Dado** o painel de saúde, **então** há um link para a mesma tela.
- **Dado** o estado `degradado`, **então** a faixa traz o botão que leva ao
  conserto — inclusive quando há leitura anterior (dado congelado).
- **Dado** a tela de configuração aberta, **então** a barra de filtros **não**
  aparece: ela não é uma visão do dado.

**Casos-limite:**
- Primeira execução → o menu segue escondido, e a casca continua desviando para
  a tela; um menu ali ofereceria seis páginas vazias.
- `degradado` **com** `lastReadAt` preenchido → o botão aparece igual; dado
  congelado também se conserta apontando a planilha certa.
- A guarda de `web/tests/paginas-montadas.test.tsx` passa a cobrir a página, que
  entra em `NAV_PAGES` — e `H-34` está `✅ CONCLUÍDA`, então ela é exigida.

**Fora desta história:** reordenar ou reagrupar o menu; qualquer estilização de
E9 — o item novo herda a forma dos seis existentes.

**Dependências:** H-34
**Tamanho:** M (6 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="e9"></a>

## Épico E9 — Estilização

Nasce da revisão de `docs/estilizacao/RESULTADO.md` (18/08/2026), que percorreu
a casca e as sete páginas contra o corpus verificável de
`docs/estilizacao/corpus-estilo.md` e registrou **21 achados** sobre **25
arquivos** de `web/src/`. As nove histórias abaixo são as ondas daquele plano
convertidas em fatias; a ordem entre elas é a dependência técnica que ele
declara, não a gravidade do achado.

**Duas determinações do passo zero valem para o épico inteiro** e não se
re-litigam: há roteamento com URIs distintas (`web/src/router.ts:30-45`), logo
as sete telas são um *set of web pages* e **SC 3.2.3 e SC 3.2.4 incidem** — as
regras `C04`, `C05`, `C06` e `C10` são normativas aqui, não preferência. E
`web/src/index.css` tem uma linha (`@import "tailwindcss";`), sem bloco
`@theme` e sem `color-scheme`: `C01` e `D01` estão violadas por construção, e é
isso que `H-39` fecha primeiro.

**As 23 regras do corpus avaliadas e dispensadas não geram história, e não
devem ser reabertas.** Sem achado: `A03` (0 `outline-none`), `A04` (0 `onClick`
em elemento não interativo), `A05` (os 2 alvos abaixo de 24 px satisfazem a
exceção *Spacing*), `A08`, `A13` (`web/index.html:2` já declara
`lang="pt-BR"`), `A14` (é navegação de links, não híbrido de abas — o APG Tabs
não incide), `A15` (0 `sticky`), `A16` (0 `tabIndex` escrito), `C03` (o único
`style={{}}` é a largura dinâmica de `RankingBar.tsx:96`), `C06`, `C07`, `C08`
(um `<h1>` só, nenhum salto de nível), `R02`, `R05`, `D01`. Não aplicáveis:
`A07`, `A09`, `A10` (0 `animate-*`, 0 `transition-*`) e `D03`–`D07`
(**0 ocorrências de `dark:` no conjunto**). O `ACHADO 14` foi emitido e
**dispensado no próprio corpus**: é `[NÃO NORMATIVO]`, e o anel de foco padrão
do navegador atende `SC 2.4.7` — adotar anel autoral criaria obrigação que hoje
não existe.

**A onda 6 do plano (modo escuro) não virou história.** Ela existe lá para
registrar a condicionalidade, e fecha vazia: `D03`–`D07` exigem ao menos uma
ocorrência de `dark:`, e há zero. O único item de modo escuro com trabalho real
é `D02` (`color-scheme`), que está em `H-39`. Introduzir a variante `dark:` é
funcionalidade nova, fora deste épico e fora do plano.

<a id="h-39"></a>

### H-39 — Declarar a camada de tema e migrar a casca

> ✅ **CONCLUÍDA em 19/08/2026.** Nenhum teste próprio — a guarda de cor é de
> `H-42`, por decisão do próprio épico, e nenhum teste do conjunto assere classe
> de cor. Suíte total **inalterada em 1313**, sem um caso ajustado para
> acomodar a migração. Nove divergências abertas no protocolo, todas resolvidas.
>
> **O vocabulário nasceu com 32 tokens em treze grupos, não com os 24 do
> contrato.** As quatro famílias que faltavam saíram da conferência da fatia, e
> cada uma teria reaberto `web/src/index.css` numa história seguinte:
> `--color-state-info-*` (o sinal `arquivoAberto` de `StatusBanner.tsx:95`,
> único local em `sky`), `--color-state-success-fg` (`emerald`, em três locais,
> dois deles fora desta fatia), `--color-action-{bg,bg-hover,fg}` (o botão
> primário `bg-slate-800` + `text-white`, em **oito** locais) e
> `--color-overlay-scrim` (o véu do diálogo). Nenhuma delas casava o `grep` do
> critério de aceite — `sky`, `emerald` e `white` não estão na expressão —, e
> por isso teriam sobrevivido como passo bruto sem reprovar nada.
>
> **Medido antes:** 71 ocorrências do padrão do critério em 41 linhas dos sete
> `.tsx`. Depois: **zero**, e zero também para `sky`, `emerald`, `bg-white` e
> `text-white`.
>
> **`@theme static`, e não `@theme`.** O Tailwind só emite a variável que vê
> usada num utilitário: na primeira build, `--color-chart-*` e `--color-meter-*`
> saíram do CSS servido por ainda não terem consumidor. Os de gráfico serão
> lidos por `var()` dentro das props do Recharts, onde ele não enxerga uso — o
> token existiria no fonte e não no CSS, e a cor sumiria sem erro nenhum.
> `static` os mantém; conferido no `.css` da build, os 32 estão lá.
>
> **Um par de contraste que a auditoria não varreu.** `StatusBanner.tsx:111`, o
> botão *Conferir a planilha configurada*, tinha `border-amber-400` sobre
> `bg-amber-50` = **1.66:1**, contra o piso de 3:1 de `SC 1.4.11` — é botão, e a
> borda é o que o delimita. O `ACHADO 6` não o pegou porque procurava
> `border-slate-300`. Passou a `--color-state-warning-fg`, 8.77:1.
>
> **O desabilitado ficou com um padrão só.** `RefreshButton.tsx:17` usava
> `disabled:opacity-60`, um terceiro padrão que `ACHADO 22` não enumera, e
> adotou `--color-control-disabled-*` junto do `ApplyChangesButton`: o controle
> inativo tem a mesma aparência no conjunto, seja o ativo sólido ou de borda.
>
> **O portão precisou de uma linha de configuração.** O Biome recusava `@theme`,
> `@utility` e `@apply` com *"Tailwind-specific syntax is disabled"* — o
> `index.css` tinha uma linha só até aqui, e o parser nunca tinha visto a
> sintaxe. `css.parser.tailwindDirectives` em `biome.json`.
>
> **Duas razões da auditoria não reproduziram**, ambas envolvendo `slate-600`:
> `ACHADO 5` afirmava 6.92:1 e `ACHADO 7`, 4.53:1 — são 7.56:1 e 6.90:1.
> Corrigidas em `docs/estilizacao/RESULTADO.md`, junto da reconferência das
> outras seis, que reproduzem. Nenhuma decisão muda: os pares passavam e
> passam.

**Objetivo:** existir um vocabulário semântico de cor, com os valores já
corrigidos para contraste, e a casca inteira consumindo só ele.

> **É a única história do épico que decide vocabulário.** As oito seguintes são
> substituição mecânica, e só são mecânicas porque os nomes e os valores foram
> fixados aqui. Token que faltar nesta fatia reabre `web/src/index.css` em todas
> as outras — o defeito que o plano de ondas existe para evitar.
>
> **Os valores dos tokens já embutem as correções de contraste.** `ACHADO 6`
> mede `border-slate-300` a **1.36:1** contra `bg-slate-100`, para um piso de
> 3:1 em `SC 1.4.11`; `ACHADO 3` mede `text-slate-400` a **2.63:1** sobre
> branco, para um piso de 4.5:1 em `SC 1.4.3`. Definir
> `--color-border-control` e `--color-text-muted` já no valor que passa faz a
> correção viajar com a substituição, em vez de virar uma segunda passada pelos
> mesmos 24 arquivos.

**Arquivos:**
- `web/src/index.css` — o bloco `@theme`, o `color-scheme` e as três `@utility`
- `web/src/App.tsx` — casca, navegação, faixa de erro; adota `panel-loading`
- `web/src/components/FilterBar.tsx` — bordas de controle, faixa de erro
- `web/src/components/StatusBanner.tsx` — severidades erro e aviso
- `web/src/components/RefreshButton.tsx` — borda de controle
- `web/src/components/ApplyChangesButton.tsx` — superfícies e estado
- `web/src/components/ConflictDialog.tsx` — os dois desviantes de severidade
- `web/src/components/MultiSelect.tsx` — `text-slate-400` e bordas de controle

**Contrato fixado:**

```css
/* web/src/index.css */
@theme static {
  --color-surface-base:    /* fundo da aplicacao      — era bg-slate-100 */
  --color-surface-raised:  /* cartoes e secoes        — era bg-white     */
  --color-surface-sunken:  /* barra de filtros        — era bg-slate-50  */
  --color-text-primary:    /* era text-slate-900 e text-slate-800 */
  --color-text-secondary:  /* era text-slate-600 e text-slate-700 */
  --color-text-muted:      /* ACHADO 3 e 4: substitui slate-500, -400 e -300 */
  --color-border-subtle:   /* era border-slate-200 */
  --color-border-strong:   /* era border-slate-800 */
  --color-border-control:  /* ACHADO 6: substitui border-slate-300 */
  --color-action-bg / -bg-hover / -fg         /* divergencia 3 */
  --color-state-error-bg / -border / -fg      /* ACHADO 9  */
  --color-state-warning-bg / -border / -fg    /* ACHADO 10 */
  --color-state-info-bg / -border / -fg       /* divergencia 1 */
  --color-state-success-fg                    /* divergencia 2 */
  --color-meter-track / --color-meter-fill    /* ACHADO 7  */
  --color-control-disabled-bg / -fg           /* ACHADO 22 */
  --color-overlay-scrim                       /* divergencia 6 */
  --color-chart-series-1 / -2 / -3
  --color-chart-axis / --color-chart-grid     /* ACHADO 8  */
}
:root { color-scheme: light; }               /* ACHADO 2 */

@utility panel-loading { }   /* ACHADO 17 (a) */
@utility panel-error   { }   /* ACHADO 17 (b) */
@utility panel-no-read { }   /* ACHADO 17 (c) */
```

`color-scheme` vai em `web/src/index.css`, **não** em `web/index.html`: a camada
de tema já vive no CSS, e nenhuma outra fatia do épico toca o HTML.

> **`ACHADO 22` — o estado desabilitado, medido em 19/08/2026.** Não veio da
> auditoria de `docs/estilizacao/RESULTADO.md`: apareceu na primeira instalação
> em Windows, quando o botão *Carregar esta planilha* — o único chamado à ação da
> tela de primeira execução — **desapareceu** numa sessão de acesso remoto. O
> canal com perda de cor foi o revelador, não a causa; a causa é o contraste
> estar no limiar.
>
> Há **dois padrões convivendo**, e nenhum dos dois serve como está:
>
> | Padrão | Onde | Texto sobre o botão | Botão sobre a página |
> |---|---|---|---|
> | `disabled:opacity-40` | `EditProcessForm`, `ColorFieldsForm`, `WorkbookSetup` | 2,40:1 | **2,32:1** |
> | `disabled:bg-slate-300` | `ApplyChangesButton` | 5,10:1 | **1,36:1** |
>
> Para comparar: o mesmo botão **habilitado** está em 14,63:1. A `opacity-40`
> compõe fundo **e** texto contra a página, e por isso derruba os dois de uma vez.
>
> **Não é violação normativa** — `SC 1.4.3` isenta componente inativo, e a guarda
> de `H-42` já isenta `disabled:*`. É consistência de papel de UI (`C04`) somada a
> robustez de canal, e por isso a decisão é aqui: o token nasce em `H-39` e
> `H-41` o adota nos três arquivos que ainda usam `opacity-40`.
>
> **Não vai para `H-45`**, apesar de ser unificação de papel: os quatro arquivos
> com `disabled` não estão na lista dela, e somá-los a levaria de 7 para 11 —
> nenhuma história do plano é G. `ApplyChangesButton` já está **aqui**, e a linha
> dele nesta fatia já diz "superfícies e **estado**".

**Critérios de aceite:**
- **Dado** `web/src/index.css`, **quando** o épico abre, **então** ele contém um
  bloco `@theme` com os treze grupos de token acima — **32 tokens**, contados
  ao fechar — e `:root { color-scheme: light; }` — hoje o arquivo tem uma linha
  só.
- **Dado** os oito arquivos desta fatia, **então** `grep -E '(text|bg|border)-(slate|red|amber)-[0-9]'`
  não encontra ocorrência em nenhum deles.
- **Dado** `--color-border-control`, **então** sua razão contra
  `--color-surface-base` é ≥ 3:1, medida pela conta de `SC 1.4.11` — hoje o par
  `border-slate-300`/`bg-slate-100` está em 1.36:1 (`ACHADO 6`).
- **Dado** `--color-text-muted`, **então** sua razão contra
  `--color-surface-raised` é ≥ 4.5:1 — hoje `text-slate-400` sobre branco está
  em 2.63:1 (`ACHADO 3`).
- **Dado** `--color-control-disabled-*`, **então** o botão desabilitado tem
  **≥ 3:1 contra `--color-surface-base`** e texto legível sobre si mesmo, e
  `ApplyChangesButton.tsx` passa a consumi-lo (`ACHADO 22`, abaixo).
- **Dado** `ConflictDialog.tsx:97` e `FilterBar.tsx:63`, **então** ambos usam o
  mesmo trio `--color-state-error-*` dos outros onze locais de severidade
  "erro", fechando os dois desviantes que `ACHADO 9` nomeia.
- **Dado** `npm run verify`, **então** passa inteiro — suíte e build — sem
  nenhum teste ajustado para acomodar a migração; a aplicação não pode ficar
  com token declarado e nenhum consumidor.

**Casos-limite:**
- Token declarado e não consumido por nenhum dos oito arquivos → é vocabulário
  para as fatias seguintes e **fica**; o critério de "nenhum consumidor" é sobre
  a camada, não sobre cada token.
- `@utility` criada aqui e adotada em `App.tsx:142` apenas → as outras seis
  adoções são de `H-41` e `H-42`, e a `@utility` não pode depender delas.
- `MultiSelect.tsx:85` usa `opacity-80` sobre dois fundos distintos → o alfa
  fica como está; `VN-6` o mede, e trocar cor sob alfa sem medir seria inventar
  número (regra inviolável 3).
- Utilitário de paleta bruta que sobreviver em arquivo **fora** desta fatia →
  não é regressão; a guarda automática só entra em `H-42`, quando os 24 já
  migraram.

**Fora desta história:** introduzir a variante `dark:` — `D03`–`D07` estão
declaradas não aplicáveis no cabeçalho do épico. Também não entra o anel de
foco autoral (`ACHADO 14`, `[NÃO NORMATIVO]`), nem `web/index.html`.

**Dependências:** nenhuma.
**Tamanho:** M (8 arquivos, 0 contrato novo — token de tema é *custom
property* de build, não rota, campo de resposta nem formato de arquivo)

[↑ Índice](#indice)

---

<a id="h-40"></a>

### H-40 — Migrar os componentes de dado

> ✅ **CONCLUÍDA em 19/08/2026.** Nenhum teste próprio — mesma razão de `H-39`:
> a guarda de cor é de `H-42`, e nenhum teste do conjunto assere classe de cor.
> Suíte total **inalterada em 1313**. Quatro divergências abertas no protocolo,
> todas resolvidas.
>
> **Medido antes:** 46 linhas com passo bruto nos seis arquivos. Depois: zero,
> incluindo `bg-white`, que o `grep` de `H-39` não alcançava.
>
> **Três tokens acrescentados, e a camada foi a 35.** A fatia era substituição
> mecânica, e não foi inteiramente:
> - **`--color-channel-red-{bg,fg}`** — o badge *Canal Vermelho* de
>   `ProcessTable.tsx:107` é **dado** (IND-06), não severidade: o `ACHADO 9` não
>   o lista entre os onze locais de erro nem entre os desviantes. Reusar
>   `state-error-*` faria o badge do canal seguir uma futura mudança no vermelho
>   de erro sem motivo. 8.24:1.
> - **`--color-meter-fill-hover`** — a correção do `ACHADO 7` consumiu o que era
>   o realce: a barra ia de slate-400 para slate-600 sob o cursor, e slate-600
>   virou o estado normal. Sem um passo além, o `group-hover` viraria no-op.
>
> **Dois passos brutos não tinham destino no vocabulário**, e ambos colapsaram
> em token existente em vez de virar token novo: `border-slate-100` (divisória
> de linha, em dois arquivos) foi para `--color-border-subtle`, e o par
> `text-slate-800` → `hover:text-slate-950` do link da REF virou
> `text-secondary` → `hover:text-primary`, o mesmo par que `RankingBar` já
> usava.
>
> **Os três contrastes reprovados da fatia:** a barra do ranking de 2.40 para
> **6.90:1**, o traço de "sem leitura" do `StatCard` de 1.49 para **4.77:1**, e
> `IngestionHealth.tsx:55` ganhou a borda que os outros onze locais de erro têm.

**Objetivo:** os seis componentes que desenham dado passarem a consumir os
tokens, com os três contrastes reprovados deles corrigidos.

**Arquivos:**
- `web/src/components/AlertRow.tsx` — `text-slate-400`, badge de urgência
- `web/src/components/ArrivalCalendar.tsx` — superfícies e bordas
- `web/src/components/ProcessTable.tsx` — badge `bg-amber-200` desviante
- `web/src/components/RankingBar.tsx` — trilho e preenchimento da barra
- `web/src/components/StatCard.tsx` — `text-slate-300` e a variante urgência
- `web/src/components/IngestionHealth.tsx` — severidade "erro" sem borda

**Critérios de aceite:**
- **Dado** os seis arquivos, **então** nenhum referencia passo bruto de paleta.
- **Dado** `RankingBar.tsx:93-95`, **então** o preenchimento usa
  `--color-meter-fill` e o trilho `--color-meter-track`, com razão ≥ 3:1 entre
  os dois — hoje o par `bg-slate-400`/`bg-slate-100` está em 2.40:1
  (`ACHADO 7`), e a barra é o único canal visual da comparação entre linhas.
- **Dado** `StatCard.tsx:43`, **então** o traço de "sem leitura" usa
  `--color-text-muted` — hoje `text-slate-300` sobre branco está em 1.49:1 para
  um piso de 3:1, e é justamente o traço que precisa ser legível (`ACHADO 4`).
- **Dado** `AlertRow.tsx:78` e `ProcessTable.tsx:92`, **então** ambos usam
  `--color-state-warning-*`, fechando dois dos quatro desviantes de `ACHADO 10`.
- **Dado** `IngestionHealth.tsx:54`, **então** recebe a borda que os outros onze
  locais de severidade "erro" têm (`ACHADO 9`).
- **Dado** `npm run verify`, **então** passa inteiro.

**Casos-limite:**
- `AlertRow.tsx:78` distingue urgência **só** por cor → a troca por token não
  resolve isso; o canal textual é `ACHADO 18`, em `H-45`, e esta fatia não pode
  fingir que fechou `A11`.
- `ProcessTable.tsx:45` usa `border-slate-300` como seção vazia, não como
  controle → vai para `--color-border-subtle` junto com o `ACHADO 15` em
  `H-45`, e **não** para `--color-border-control`.
- Componente que não tenha nenhuma cor de estado → migra só superfície, borda e
  texto; ausência de estado não é omissão.

**Fora desta história:** o rótulo textual da urgência (`ACHADO 18`) e a
unificação de papel de UI (`ACHADO 15`) — ambos são onda 4, em `H-45`.

**Dependências:** H-39
**Tamanho:** M (6 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-41"></a>

### H-41 — Migrar a superfície de edição

> ✅ **CONCLUÍDA em 21/08/2026.** Nenhum teste próprio; **duas asserções
> atualizadas** — a única alteração de teste do épico até aqui, e o porquê está
> abaixo. Suíte total **inalterada em 1313**. Cinco divergências abertas no
> protocolo, todas resolvidas.
>
> **Medido antes:** 91 linhas com passo bruto nos cinco arquivos — a maior fatia
> do épico. Depois: zero. **Nenhum token novo**, o que é o sinal de que a camada
> de `H-39` estabilizou: `H-40` ainda precisou de dois.
>
> **A história se contradizia, e a contradição foi resolvida a favor do mais
> recente.** O caso-limite dizia que `disabled:opacity-40` **não migra**; o
> último critério de aceite, acrescentado com o `ACHADO 22` em 19/08, mandava
> trocá-lo por `--color-control-disabled-*`. Venceu o critério — a nota de
> `H-39` confirma a intenção —, e o caso-limite foi reescrito: o que continua
> verdadeiro nele é a **isenção na guarda** de `H-42`, não a proibição de
> migrar. **Eram seis botões, não três:** além dos três de submissão,
> `PendingEditsPanel` tem dois e `WorkbookSetup:162` um sétimo padrão
> (`opacity-60`). Os seis adotaram o token — o conjunto inteiro passa a ter
> **uma** aparência de controle inativo, que era o ponto de `C04`.
>
> **Duas asserções teriam ficado verdes por vacuidade.**
> `web/tests/WorkbookSetup.test.tsx:456-457` guardam que o checklist de partida
> não pinta etapa pendente de vermelho — regra inviolável 3 — casando `/red/` e
> `/text-red|bg-red/`. Depois da migração nenhuma classe do arquivo contém
> "red": as duas passariam a ser **inquebráveis**, e alguém poderia pintar o
> checklist com `bg-state-error-bg` sem o teste notar. Os padrões passaram a
> `/state-error/`, e a asserção foi **provada por mutação**: injetando
> `bg-state-error-bg` na lista, o teste reprova; removendo, volta a passar. Não
> é teste ajustado para acomodar migração — é o oposto.
>
> **Primeira adoção das `@utility` fora da casca.** `ProcessDetail` assume as
> três de uma vez — `panel-error`, `panel-no-read`, `panel-loading` —, o que
> `H-39` deixou preparado e não pôde exercer. `:61` ficou de fora: "processo não
> encontrado" não é nenhum dos três papéis do `ACHADO 17`.
>
> **Fechados aqui:** três dos treze controles de `ACHADO 6`, a terceira e última
> ocorrência de `ACHADO 3` (`ProcessDetail:298`, 2.63 → 4.77:1), e os quatro
> papéis de estado de `WorkbookSetup` que o corpus nunca varreu — a tela nasceu
> depois dele.

**Objetivo:** os três formulários da fila de edições e a Página Detalhe
consumirem os tokens, com as bordas de controle corrigidas.

**Arquivos:**
- `web/src/components/ColorFieldsForm.tsx` — borda de controle, faixa de erro
- `web/src/components/EditProcessForm.tsx` — bordas de controle, faixa de erro
- `web/src/components/PendingEditsPanel.tsx` — severidade "aviso"
- `web/src/pages/ProcessDetail.tsx` — `text-slate-400`, adota `panel-*`
- `web/src/pages/WorkbookSetup.tsx` — bordas de controle, faixa de erro, painel
  do inventário (**alocada por `H-35`**: a tela nasceu depois do corpus e não
  aparecia em nenhuma das nove histórias)

**Critérios de aceite:**
- **Dado** os **cinco** arquivos, **então** nenhum referencia passo bruto de paleta.
- **Dado** `EditProcessForm.tsx:93` e `:110` e `ColorFieldsForm.tsx:141`,
  **então** usam `--color-border-control`, fechando três dos treze controles de
  `ACHADO 6`.
- **Dado** `ProcessDetail.tsx:298`, **então** o valor ausente usa
  `--color-text-muted` — terceira e última ocorrência de `ACHADO 3`.
- **Dado** `ProcessDetail.tsx:49`, `:74` e `:83`, **então** adotam
  `panel-error`, `panel-no-read` e `panel-loading` (`ACHADO 17`).
- **Dado** `npm run verify`, **então** passa inteiro, incluindo
  `web/tests/ProcessDetail.test.tsx` e `web/tests/ColorFieldsForm.test.tsx`
  **sem alteração** — a migração é de cor, não de comportamento.

**Casos-limite:**
- `disabled:opacity-40` e `disabled:bg-slate-300` **não entram na guarda** de
  `H-42`: `SC 1.4.3` e `SC 1.4.11` isentam componente de interface inativo, e o
  corpus registra a isenção. **Migram, porém** — a redação anterior dizia que
  não, e envelheceu quando o `ACHADO 22` entrou, em 19/08/2026: isenção
  normativa não é o mesmo que proibição de unificar, e o critério de aceite
  abaixo manda trocar pelo token. Foram **seis** botões, não três.
- `PendingEditsPanel.tsx:90` usa `line-through opacity-60` sobre `bg-amber-50` →
  o alfa fica; `VN-6` mede.
- `ProcessDetail.tsx:195` é painel `border-dashed` de ressalva, papel distinto
  do cartão → migra para os tokens, mas **não** é unificado com os cartões.

**Fora desta história:** os três painéis `border-dashed` continuarem distintos
é decisão do corpus (`ACHADO 15`, nota), e não se re-litiga aqui.

> **`WorkbookSetup.tsx` entra aqui, e não em `H-42`, por duas razões que se
> somam.** É formulário que grava, com estado de salvamento e de erro: a mesma
> borda de controle e a mesma faixa de erro dos outros três arquivos desta fatia.
> E é a única alocação possível **dentro da onda 2** — `H-42` já está em 8
> arquivos, e é ela que fecha a guarda `tests/repo/estilo.test.ts`, que varre
> `web/src/**/*.tsx`. Deixar a tela fora da onda faria a guarda nascer vermelha,
> exatamente o que o bloco de `H-42` existe para evitar.

- **Dado** `EditProcessForm.tsx`, `ColorFieldsForm.tsx` e `WorkbookSetup.tsx`,
  **então** os três botões de submissão trocam `disabled:opacity-40` pelo
  `--color-control-disabled-*` que `H-39` fixa — hoje o botão desabilitado fica
  em 2,32:1 contra o fundo da página e some em canal com perda de cor
  (`ACHADO 22`, medido em 19/08/2026 na primeira instalação em Windows).

**Dependências:** H-39
**Tamanho:** M (5 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-42"></a>

### H-42 — Migrar as sete páginas e fechar a guarda de cor

> ✅ **CONCLUÍDA em 21/08/2026.** 9 testes próprios — 4 em
> `tests/repo/estilo.test.ts` e 5 em `tests/http/static.test.ts`, estes últimos
> de uma correção fora do plano, abaixo. Suíte de 1313 para **1322**. Três
> divergências abertas no protocolo, todas resolvidas.
>
> **A onda 2 fechou:** 77 linhas de passo bruto nas sete páginas para zero, e os
> **24 arquivos** consumidores estão migrados. `Operational:123` e `:134` saem
> de 4.35 para **6.90:1** contra a casca (`ACHADO 5`), e `Alerts:145` de 1.49
> para **4.77:1** (`ACHADO 4`).
>
> **A guarda tem duas asserções, não uma.** `C01` cobre o utilitário de passo
> bruto, que era o contrato; `C02` cobre **literal hexadecimal**, acrescentada
> porque o defeito que esta mesma história consertou em `History.tsx` — seis
> valores passados direto às props do Recharts — não é utilitário e nenhuma
> regex de classe o alcançaria. Migrados hoje, voltariam amanhã sem nada
> reprovar. **As duas foram provadas por mutação:** `text-slate-600`
> reintroduzido reprova `C01` citando arquivo e linha; `const COR = '#4f46e5'`
> reprova `C02`. O escopo passou a `.ts` além de `.tsx` — hoje nenhum `.ts` de
> `web/src/` tem cor, e nada impedia que passasse a ter.
>
> **`var()` em atributo de apresentação SVG foi MEDIDO, não suposto.** A fatia
> abriu com a suspeita de que não funcionaria, o que teria mudado a
> implementação inteira. Renderizado no Chrome, um `stroke="var(--x)"` sai
> idêntico ao literal; e o gráfico real foi conferido na tela, com as três
> séries, a legenda e o tooltip coloridos. **Quatro caminhos de automação
> falharam antes disso** — headless com `virtual-time-budget` não monta o React,
> porque o scheduler usa `MessageChannel`; por CDP com espera real o `#root`
> fica vazio; e em jsdom o `ResponsiveContainer` do Recharts não renderiza SVG
> nenhum, por medir zero. **A Página Histórico não é verificável por automação
> neste projeto**, e quem quiser conferi-la olha a tela.
>
> ---
>
> **A tentativa de verificar achou um defeito de `H-30`, e ele foi corrigido
> aqui por decisão do usuário — a fatia cresceu de propósito.**
>
> `GET /*` servia **`text/html` para `/assets/*.js` e `*.css`**, e a tela ficava
> branca sem erro nenhum. A causa é o `@fastify/static` com `wildcard: false`,
> que **enumera o diretório uma vez, no registro** — a documentação do plugin
> avisa que ele *"will not serve newly added files"*. Dois caminhos rotineiros
> caíam nisso: servidor no ar antes de `dist/web` existir, e **recompilação com
> o servidor no ar**, que troca o hash dos nomes. O `index.html` era servido, e
> apontava para arquivos que caíam no próprio `/*`.
>
> **O teste que afirmava cobrir o caso media apenas o HTML** — `passa a servir
> assim que a pasta aparece` pedia `/alertas`, nunca um asset. É o mesmo modo de
> falha de `PD-06`: a afirmação existia, a verificação não a alcançava.
>
> O plugin saiu do projeto e os arquivos passaram a ser servidos à mão, com
> guarda de travessia própria — o preço de largar o plugin. **Os dois cenários
> reprovam contra o código anterior e passam com a correção.** Um dos testes
> novos precisou ser corrigido: escrevendo o arquivo antes do primeiro `inject`,
> ele passava contra a implementação antiga também, porque o glob do plugin
> ainda não tinha rodado — teste que não reproduz o defeito que nomeia é pior
> que teste nenhum.

**Objetivo:** encerrar a onda 2 com as páginas migradas e uma guarda automática
que impeça o passo bruto de voltar.

> **A guarda entra aqui, e não em `H-39`, porque só aqui ela pode passar.**
> Declarada antes, reprovaria a suíte enquanto `H-40` e `H-41` não tivessem
> migrado — e uma guarda que nasce vermelha é desligada, não obedecida. Ao fim
> desta fatia os 24 arquivos consumidores da onda 2 estão migrados, e a asserção
> passa a valer sobre o conjunto inteiro.

**Arquivos:**
- `web/src/pages/Home.tsx` — cartões, faixa de erro, adota `panel-*`
- `web/src/pages/Operational.tsx` — paginação, bordas, adota `panel-*`
- `web/src/pages/Clients.tsx` — severidade "aviso", adota `panel-*`
- `web/src/pages/Performance.tsx` — `text-amber-800` desviante, adota `panel-*`
- `web/src/pages/Alerts.tsx` — `text-slate-300`, adota `panel-*`
- `web/src/pages/History.tsx` — os seis literais do Recharts, adota `panel-*`
- `web/src/pages/Placeholders.tsx` — superfícies e bordas
- `tests/repo/estilo.test.ts` (novo) — a guarda de passo bruto

**Contrato fixado:**

```ts
// tests/repo/estilo.test.ts — mesma forma das sete guardas de contratos.test.ts
// Varre web/src/**/*.tsx e reprova se encontrar utilitario de passo bruto de
// paleta — (text|bg|border|ring|fill|stroke)-(slate|red|amber|green|blue|...)-[0-9]
// Isenta: disabled:* (SC 1.4.3 isenta componente inativo).
```

**Critérios de aceite:**
- **Dado** `tests/repo/estilo.test.ts`, **quando** `npm run verify` roda,
  **então** ele passa — e **então** nenhum dos 24 arquivos consumidores da onda
  2 referencia passo bruto de paleta.
- **Dado** um utilitário de passo bruto reintroduzido em qualquer arquivo de
  `web/src/`, **então** a suíte reprova, citando arquivo e linha.
- **Dado** `Operational.tsx:123` e `:134`, **então** usam
  `--color-text-secondary` — hoje `text-slate-500` resolvido contra o
  `bg-slate-100` da casca está em 4.35:1 para um piso de 4.5:1 (`ACHADO 5`), e
  o mesmo utilitário aprova dentro de cartão branco.
- **Dado** `History.tsx:46-48`, `:179`, `:183`, `:185`, `:189` e `:191`,
  **então** os seis literais hexadecimais são lidos de `var(--color-chart-*)` —
  hoje dois dos três literais de grade e eixo já divergem da paleta da 4.3.3
  (`ACHADO 8`, prova de deriva).
- **Dado** `Alerts.tsx:145`, **então** o traço usa `--color-text-muted`
  (`ACHADO 4`, segunda ocorrência).
- **Dado** as sete páginas, **então** cada uma adota `panel-loading`,
  `panel-error` e `panel-no-read` onde hoje repete a string literal
  (`ACHADO 17`); `web/tests/paginas-montadas.test.tsx` continua passando.

**Casos-limite:**
- `Placeholders.tsx` não aparece em `ACHADO 17` → migra cor e **não** adota as
  `@utility`; forçá-las ali acoplaria papéis distintos.
- `History.tsx` é a única página com Recharts, e o gráfico é carregado sob
  demanda → a guarda varre o arquivo em disco, não a árvore renderizada, e o
  `lazy` não a afeta.
- A guarda encontrar passo bruto em arquivo legítimo de teste (`web/tests/`) →
  o escopo é `web/src/`, declarado no próprio teste.
- `#e2e8f0` coincide com `slate-200` da 4.3.3 e os outros dois não → todos os
  seis viram token do mesmo jeito; coincidência não é motivo para manter literal.

**Fora desta história:** a contenção de rolagem da tabela irmã do gráfico
(`ACHADO 19`) e o `fontSize: 12` dos eixos (`ACHADO 21`) — são onda 5, em
`H-46`, e entram lá para não abrir `History.tsx` uma vez a mais.

**Dependências:** H-39
**Tamanho:** M (8 arquivos, 0 contrato novo — o teste de guarda é asserção
sobre o repositório, não contrato de API)

[↑ Índice](#indice)

---

<a id="h-43"></a>

### H-43 — Live regions da casca e dos componentes

> ✅ **CONCLUÍDA em 31/08/2026.** **10 testes próprios** em quatro arquivos —
> três em `App.test.tsx`, dois em `FilterBar.test.tsx`, dois em
> `IngestionHealth.test.tsx`, dois em `ColorFieldsForm.test.tsx` e um em
> `StatusBanner.test.tsx`. Suíte total de **1556 para 1566**. **Nove casos
> existentes mudaram de forma, nenhum de força** — a razão está três parágrafos
> abaixo. Uma divergência no protocolo, resolvida.
>
> **O padrão adotado já existia no repositório, e não foi inventado aqui.**
> `WorkbookSetup.tsx` faz isso desde `H-34`: o nó fica sempre no DOM e alterna
> entre `sr-only` e o estilo visível. `H-43` o estendeu aos sete arquivos da
> casca, que é o que o próprio `ACHADO 11` descreve como um defeito repetido, e
> não como uma coleção de descuidos.
>
> **`StatusBanner` foi o único que mudou de estrutura, e não só de condicional.**
> Ele montava um `role` por sinal, cada um já populado. Agora há **duas** regiões
> — uma `alert` e uma `status` —, porque os papéis são dois: `arquivoAberto` é
> contexto, e os demais interrompem. Os sinais entram dentro delas, e **o estilo
> mora no filho**: sem sinal, os dois contêineres são nós vazios sem borda, fundo
> nem espaçamento. O critério do caso-limite não é ausência do nó, é ausência de
> caixa vazia na tela.
>
> **Nove testes existentes mudaram de forma porque a forma era o defeito.** Eles
> consultavam `getByRole('alert')` — no singular, e a região vazia agora existe
> desde a montagem, então "existe algum alert" resolve no primeiro render, antes
> de a mensagem chegar. Passaram a esperar pelo **texto** e a verificar em que
> região ele caiu. Nenhuma asserção foi afrouxada: duas delas **ganharam** força,
> porque agora provam a identidade do nó — o elemento que recebe o texto é o
> mesmo objeto que já estava no DOM, que é exatamente o que o leitor de tela
> compara.
>
> **Divergência 1 — a região persistente das páginas precisa de endereço, e o
> plano não diz qual.** O critério exige que ela seja "alcançável por elas, sem
> que a casca conheça nenhuma página". A casca expõe um `id` estável,
> `PAGE_LIVE_REGION_ID`, exportado como constante: um `id` escrito duas vezes
> vira dois `id` diferentes no primeiro ajuste, e o portal falharia **em
> silêncio** — `getElementById` devolveria `null` e a mensagem simplesmente não
> apareceria. `H-44` é quem escreve nela.
>
> **Nada de cor foi tocado**, como a fatia manda: os quatro arquivos que `H-39`
> já migrou seguem com os mesmos tokens.

**Objetivo:** as regiões de estado da casca existirem no DOM antes de receberem
mensagem, para que o leitor de tela as anuncie.

> **Um defeito, 23 pontos.** `ACHADO 11` não é uma coleção de descuidos: é o
> mesmo padrão — `{erro && <p role="alert">{erro}</p>}` — repetido em toda a
> aplicação. A MDN é explícita: *"Do not try to dynamically add/generate an
> element with `role='alert'` that is already populated"*. O nó nasce já com o
> texto, e o leitor de tela não tem o que comparar; a mensagem não é anunciada.
>
> **Esta fatia decide onde mora o contêiner que sobrevive.** As sete páginas de
> `H-44` fazem `return` antecipado no estado de erro, e por isso precisam de uma
> região que não desmonte junto — ela é criada aqui, em `App.tsx`. Por isso
> `H-44` depende desta, e não o contrário.

**Arquivos:**
- `web/src/App.tsx` — a região persistente e a faixa de `healthError`
- `web/src/components/StatusBanner.tsx` — `role="alert"` condicional
- `web/src/components/FilterBar.tsx` — erro de opções de filtro
- `web/src/components/ApplyChangesButton.tsx` — `role="status"` condicional
- `web/src/components/IngestionHealth.tsx` — `role="alert"` condicional
- `web/src/components/EditProcessForm.tsx` — erro de enfileiramento
- `web/src/components/ColorFieldsForm.tsx` — os dois `role` condicionais

**Critérios de aceite:**
- **Dado** os sete arquivos, **então** nenhum monta um elemento com `role="alert"`
  ou `role="status"` já populado: a região existe no DOM desde a montagem, e só
  o texto dentro dela muda.
- **Dado** a casca sem erro, **quando** `healthError` passa a ter valor,
  **então** o elemento que recebe o texto **é o mesmo nó** que já estava no DOM
  — verificável por `web/tests/App.test.tsx` guardando a referência antes e
  depois.
- **Dado** `App.tsx:114`, **então** a região persistente para as páginas existe
  e é alcançável por elas, sem que a casca conheça nenhuma página (a casca não
  calcula — regra inviolável 6).
- **Dado** `web/tests/StatusBanner.test.tsx`, `FilterBar.test.tsx`,
  `IngestionHealth.test.tsx`, `AplicarAlteracoes.test.tsx` e
  `ColorFieldsForm.test.tsx`, **então** continuam passando.

**Casos-limite:**
- Região vazia montada permanentemente → não pode ficar com borda, fundo ou
  espaçamento visíveis quando não há mensagem; o critério é ausência de caixa
  vazia na tela, não ausência do nó.
- `Home.tsx:114` acrescenta `role: 'alert'` por *spread* condicional a um nó já
  populado — variante do mesmo defeito, mas está em `H-44`.
- Duas mensagens simultâneas na mesma região → a última vence; empilhar
  anúncios não é requisito de `SC 4.1.3`.

**Fora desta história:** as sete páginas — são `H-44`. E qualquer troca de cor:
esta fatia é independente de tema e não deve tocar utilitário de cor, mesmo nos
quatro arquivos que `H-39` já migrou.

**Dependências:** nenhuma — o plano declara a onda 3 paralelizável à onda 1.
**Tamanho:** M (7 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-44"></a>

### H-44 — Live regions das páginas, gráfico e forced-colors

> ✅ **CONCLUÍDA em 31/08/2026.** **5 testes próprios** — três em
> `History.test.tsx` e dois em `Home.test.tsx`. Suíte total de **1566 para
> 1571**. **Doze casos existentes mudaram de forma, nenhum de força**, e a
> mudança deles **é** a verificação do primeiro critério: eles passaram a
> consultar a região viva da casca, que é onde a mensagem agora é anunciada.
> Três divergências no protocolo, e **dois pontos que a lista de arquivos não
> nomeava**.
>
> **Por que um portal, e não um `role` na própria página.** Uma região declarada
> dentro da página nasceria **junto** com o `return` antecipado, no mesmo commit
> em que o texto chega — o `ACHADO 11` de novo, uma camada acima. Quem sobrevive
> à troca de estado da página é o nó da casca, e é por isso que `H-43` o criou lá.
>
> **O texto é lido uma vez só.** O bloco visível é `aria-hidden`, e o conteúdo
> acessível vai pelo portal. Sem isso o operador ouviria a mesma frase duas
> vezes, uma no fluxo e outra na região viva. É por isso que os testes agora
> contam **duas** ocorrências do mesmo texto — uma delas escondida de propósito.
>
> **Divergência 1 — a região da casca nasceu sem `role`.** `H-43` a criou como
> endereço (`<div id=…>`), e um `div` sem papel não é região viva nenhuma. Um
> defeito da própria onda, corrigido aqui. Nasceu também a **segunda** região,
> `role="status"`: "a planilha ainda não foi lida" é contexto, e anunciá-lo como
> `alert` cortaria o que o leitor de tela estivesse falando — a mesma razão pela
> qual `StatusBanner` tem duas.
>
> **Divergência 2 — `PAGE_LIVE_REGION_ID` mudou de casa.** Vivia em `App.tsx`, e
> as páginas importando de lá fechariam um ciclo: a casca importa as sete
> páginas. A constante e o componente `PageAlert` vivem agora em
> `web/src/components/PageAlert.tsx`, que não importa nada do projeto.
>
> **Divergência 3 — as suítes de página montam uma página sozinha**, sem casca em
> volta, e o portal não encontra alvo. `web/tests/support/live-region.ts` monta
> as duas regiões no `beforeEach` das sete. **Não é contornar a ausência:** é
> reproduzir o ambiente real, onde a página sempre vive dentro da casca. Sem
> isso, cada suíte verificaria uma árvore que não existe em execução.
>
> **Dois pontos fora da lista, e ambos são o primeiro critério.**
> `History.tsx` — a nota de janela truncada — e `WorkbookSetup.tsx` — o
> "Carregando a configuração atual…" — montavam `role="status"` já populado,
> exatamente como as sete. A lista de arquivos nomeava outros trechos dos mesmos
> arquivos; o critério fala das páginas inteiras.
>
> **`ACHADO 12` fechado com `accessibilityLayer={false}`.** Sem ele,
> `recharts/es6/container/RootSurface.js:45` dá `tabIndex={0}` e
> `role="application"` ao `<svg>` — **dentro** de uma subárvore `aria-hidden`. O
> operador tabulava para um elemento que a árvore de acessibilidade não expõe, e
> que por isso não tem nome nenhum a anunciar. O gráfico segue `aria-hidden` e a
> tabela irmã segue com os mesmos números: a correção remove a parada, nunca a
> alternativa textual.
>
> **`ACHADO 13` fechado pela espessura**, não pela cor: sob `forced-colors:
> active` o agente de usuário substitui a cor da borda e não a espessura, e o
> botão selecionado ficaria indistinguível dos outros dois. O `aria-pressed` já
> resolvia o eixo programático.
>
> **A fatia introduziu uma corrida, e ela foi fechada antes do commit.** O portal
> monta num **efeito**, então `findByRole('alert')` passou a resolver na região
> vazia — que agora existe desde a montagem — antes de a mensagem chegar. Sete
> casos ficaram não-determinísticos, e o portão reprovou de forma intermitente.
> A correção é esperar pelo **conteúdo**, e não pelo nó: `findLiveRegion` faz
> isso, e o portão foi executado **três vezes seguidas** verde para confirmar.
> Não confundir com o intermitente conhecido de `src/io/`, que devolve `exit=1`
> com zero testes falhando — este tinha teste nomeado na saída, e era meu.

**Objetivo:** fechar o restante de `ACHADO 11` nas sete páginas e tirar do
caminho de tabulação o gráfico que a árvore de acessibilidade não expõe.

**Arquivos:**
- `web/src/pages/Home.tsx` — o `role` por *spread* de `:114`
- `web/src/pages/Operational.tsx` — `role` no `return` antecipado
- `web/src/pages/Clients.tsx` — idem
- `web/src/pages/Performance.tsx` — idem
- `web/src/pages/Alerts.tsx` — idem
- `web/src/pages/History.tsx` — idem, mais o gráfico e o seletor de janela
- `web/src/pages/ProcessDetail.tsx` — idem
- `web/src/pages/WorkbookSetup.tsx` — o bloco de erro da carga da configuração,
  renderizado condicionalmente e sem `role` (**alocada por `H-35`**)

**Critérios de aceite:**
- **Dado** as sete páginas, **então** nenhuma monta `role="alert"` ou
  `role="status"` já populado; as que hoje fazem `return` antecipado escrevem
  na região persistente que `H-43` criou.
- **Dado** `History.tsx:176-210`, **então** o `<LineChart>` recebe
  `accessibilityLayer={false}` — hoje `node_modules/recharts/es6/container/RootSurface.js:45`
  dá `tabIndex={0}` e `role="application"` ao `<svg>` **dentro** de uma subárvore
  `aria-hidden="true"`, e o operador tabula para um elemento sem nome acessível
  (`ACHADO 12`).
- **Dado** o gráfico, **então** ele continua `aria-hidden="true"` e a tabela
  irmã de `History.tsx:212-240` continua carregando os mesmos números — a
  correção remove a parada órfã, não a alternativa textual.
- **Dado** `History.tsx:150-158`, **então** o botão de janela selecionado ganha
  um canal não-cromático (`border-2` contra `border`), porque sob
  `forced-colors: active` o agente de usuário substitui a cor da borda e não a
  espessura; o `aria-pressed` de `:151` já resolve o eixo programático
  (`ACHADO 13`).
- **Dado** `web/tests/History.test.tsx` e as outras seis suítes de página,
  **então** passam.

**Casos-limite:**
- `MultiSelect.tsx:86` troca `▾` pelo número de itens marcados sob o mesmo par
  `bg-slate-800`/branco → é `A17` **satisfeita**, padrão a preservar; não tocar.
- Página cujo estado de erro nunca ocorre em teste → a região ainda precisa
  existir; ausência de caminho de teste não dispensa a montagem.
- `accessibilityLayer={false}` alterar o comportamento de tooltip do Recharts →
  o gráfico já é `aria-hidden`, e o tooltip é ponteiro; se houver regressão
  visual, ela aparece em `VN-3`.

**Fora desta história:** o `fontSize: 12` dos eixos (`ACHADO 21`) e a contenção
de rolagem da tabela (`ACHADO 19`) — onda 5, `H-46`.

> **`WorkbookSetup.tsx` tem o defeito das páginas, não o da casca.** O bloco
> `state.status === 'erro'` é renderizado condicionalmente e não tem `role` — o
> mesmo `return` antecipado das sete. A região `role="alert"` persistente da tela
> **já está correta desde `H-34`**: é padrão a preservar, nunca a "corrigir".

**Dependências:** H-43
**Tamanho:** M (8 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-45"></a>

### H-45 — Unificar papéis de UI e tirar a informação só-cor

> ✅ **CONCLUÍDA em 31/08/2026.** **11 testes próprios** — seis em
> `Alerts.test.tsx`, dois em `Home.test.tsx` e três em `tests/repo/estilo.test.ts`.
> Suíte total de **1571 para 1582**. Três casos existentes reapontados para o
> papel novo. Uma divergência no protocolo, resolvida.
>
> **O primeiro critério já vinha satisfeito, e o trabalho foi travá-lo.** Os
> quatro desviantes de `ACHADO 15` usavam `border-slate-300`; `H-42` migrou o
> conjunto inteiro para tokens e, ao fazê-lo, alinhou os quatro em
> `--color-border-subtle` **de passagem**. Confirmar isso e seguir deixaria o
> desvio livre para voltar no primeiro arquivo novo — que é exatamente a razão de
> `tests/repo/estilo.test.ts` existir. A guarda ganhou `C04`, com duas asserções
> de conjunto e **prova por mutação**: trocar a borda de `Placeholders.tsx:33`
> reprova a suíte.
>
> **O sinal sintático que separa os dois papéis é o `p-` uniforme.** A primeira
> versão da regex pegava `input` e `select`, que também são
> `rounded border … bg-surface-raised` — mas com `px-`/`py-` assimétricos e
> `--color-border-control`. Papel diferente, token diferente, e a guarda tem de
> saber disso.
>
> **`ACHADO 16` — a mesma ação tinha dois papéis e dois nomes.** Abrir o detalhe
> era `<a href>` na tabela e `<button>` no alerta. `SC 3.2.4` incide porque a
> determinação `Z1` mediu URIs distintas, então a consistência deixa de ser
> preferência. O `AlertRow` passou a usar o **mesmo** interceptador da tabela —
> modificador pressionado abre em aba nova, como qualquer link — e ganhou
> `aria-label` explícito: sem ele o nome acessível seria o bloco inteiro
> concatenado, contra `"NBSC260"` na tabela.
>
> **`ACHADO 18` — a urgência era só cor, em dois lugares.** O badge urgente
> ganhou o prefixo "Pede ação"; `data-severity` continua onde estava e **não**
> conta como canal, porque não é exposto ao usuário. E os dois cartões de
> urgência passaram a usar a `hint` que `StatCard` já oferecia desde `H-16` e que
> nenhum cartão usava.
>
> **Divergência 1 — `tests/repo/estilo.test.ts` não estava na lista.** A história
> nomeia sete arquivos de `web/src/`, e nenhum lugar onde travar um critério
> composicional. A guarda do épico é o lugar natural: ela já existe para `C01` e
> `C02`, roda no `verify` e no CI, e não tem lista fixa — acrescentar arquivo
> muda a expectativa sozinho.
>
> **Os três painéis `border-dashed` continuam distintos**, e a segunda asserção
> guarda isso: papel "ressalva" é legítimo **porque** os três são consistentes
> entre si. Um quarto com outra borda quebraria o papel, e agora reprova.

**Objetivo:** o mesmo papel de UI ter a mesma forma nas sete telas, a mesma ação
ter o mesmo nome e papel, e nenhuma urgência ser transmitida apenas por cor.

> **`SC 3.2.4` incide aqui porque há roteamento.** A determinação `Z1` do passo
> zero mediu URIs distintas em `web/src/router.ts:30-45`: as sete telas são um
> *set of web pages*, e a consistência entre elas deixa de ser preferência.
> Fosse URI única, `C04` e `C05` seriam reportadas sem incidência normativa.

**Arquivos:**
- `web/src/components/AlertRow.tsx` — vira link; badge ganha rótulo textual
- `web/src/components/ProcessTable.tsx` — seção vazia alinhada ao papel
- `web/src/components/StatCard.tsx` — a `hint` da variante urgência
- `web/src/pages/Home.tsx` — passa a `hint` nos dois cartões de urgência
- `web/src/pages/History.tsx` — `EmptyHistory` alinhado ao papel
- `web/src/pages/ProcessDetail.tsx` — "processo não encontrado" alinhado
- `web/src/pages/Placeholders.tsx` — `NotFoundPage` alinhado

**Critérios de aceite:**
- **Dado** os quatro desviantes de `ACHADO 15` — `History.tsx:119`,
  `ProcessDetail.tsx:61`, `Placeholders.tsx:33`, `ProcessTable.tsx:45` —
  **então** usam `--color-border-subtle`, como os catorze locais do papel
  majoritário; nenhum dos quatro codifica estado, logo o contraexemplo de `C04`
  não os cobre.
- **Dado** `AlertRow.tsx:45`, **então** abrir o detalhe é um `<a href>` com o
  mesmo interceptador de clique de `ProcessTable.tsx:79-83`, e não um
  `<button>` — hoje a mesma ação tem dois papéis e dois nomes acessíveis
  (`ACHADO 16`).
- **Dado** `AlertRow.tsx`, **então** o link tem `aria-label` explícito — hoje o
  nome acessível é o conteúdo concatenado do bloco inteiro (REF, linha, ETA2,
  rótulos e mensagem), contra `"NBSC260"` na tabela.
- **Dado** `Home.tsx:37-38`, **então** os dois cartões de urgência passam a
  `hint` já existente de `StatCard.tsx:17` com texto que marca a distinção —
  hoje ela é só `border-amber-300`/`bg-amber-50` (`ACHADO 18`, `SC 1.4.1`).
- **Dado** `AlertRow.tsx:81`, **então** o badge urgente traz prefixo textual;
  `data-severity` não é exposto ao usuário e não conta como canal.
- **Dado** os três painéis `border-dashed` de `Alerts.tsx:181`,
  `Performance.tsx:248` e `ProcessDetail.tsx:195`, **então** continuam
  distintos — são papel "ressalva", consistentes entre si.

**Casos-limite:**
- `Placeholders.tsx:19` usa a mesma tripla com `p-8` em vez de `p-4` → `C04`
  fala de raio, borda e sombra, não de espaçamento; **não é achado**.
- "Descartar" contra "Esvaziar a fila inteira" em `PendingEditsPanel.tsx` →
  escopos realmente distintos, cobertos pelo contraexemplo de `C05`; não
  unificar.
- O dado de negócio codificado por cor na origem e já convertido em rótulo —
  `ProcessDetail.tsx:24-42`, `ProcessTable.tsx:105-110`,
  `ColorFieldsForm.tsx:41-48`, `AlertRow.tsx:27-34` — é `SC 1.4.1`
  **satisfeito** e padrão a preservar: verificar que se mantém, nunca "corrigir".
- Trocar `<button>` por `<a>` em `AlertRow` mudar o teclado (Enter/Espaço) → é
  a mudança pretendida; link ativa com Enter, e é o comportamento da tabela.

**Fora desta história:** extrair as três `@utility` — já foi feito em `H-39` e
adotado em `H-41` e `H-42`, para não abrir os mesmos oito arquivos duas vezes.

**Dependências:** H-42
**Tamanho:** M (7 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-46"></a>

### H-46 — Responsividade e contenção de rolagem

> ✅ **CONCLUÍDA em 31/08/2026.** **5 testes próprios**, todos em
> `tests/repo/estilo.test.ts`. Suíte total de **1582 para 1586**. Nenhum caso
> existente ajustado. Uma divergência no protocolo, resolvida.
>
> **As três correções são estáticas, e por isso foram travadas em guarda, não
> só aplicadas.** Cada uma reprova sob mutação: tirar o `overflow-x-auto` do
> diálogo, tirar a base de um grid, ou devolver `fontSize: 12` — as três
> derrubam a suíte, e a reversão a devolve ao verde. Sem isso, a próxima tabela
> ou grid nasceria com o mesmo defeito e ninguém saberia.
>
> **Três tabelas contidas**, pelo padrão que `ProcessTable` já usava: `History`,
> as quatro quebras de `Performance` e as cinco colunas de `ConflictDialog`. A
> exceção bidimensional de `SC 1.4.10` cobre a **tabela**, e não a página — sem o
> invólucro ela arrasta as notas irmãs e a barra de filtros junto, que é
> exatamente a rolagem que o critério proíbe.
>
> **Sete grids ganharam `grid-cols-1` explícito.** O valor implícito é o inicial
> do CSS, e escrevê-lo é o que faz a intenção aparecer no código: sem ele, quem
> lê não sabe se uma coluna é decisão ou esquecimento. Os **quatro** que já
> tinham base — `FilterBar`, `Alerts`, `Home` e `IngestionHealth` — não foram
> tocados.
>
> **`fontSize` dos eixos passou de `12` para `'0.75rem'`.** O React converte o
> número para pixel, e pixel não acompanha a fonte-base que o operador escolheu
> no navegador (`SC 1.4.4`). `width={48}` e `margin={{…}}` continuam numéricos de
> propósito: são **geometria** do Recharts, não tipografia — o caso-limite do
> backlog.
>
> **Divergência 1 — o comentário JSX não cabe onde eu o pus.** Um `{/* … */}`
> logo depois de `{condicao && (` é sintaxe inválida, e o `typecheck` pegou. O
> comentário do `ConflictDialog` foi para **antes** do condicional, que é onde
> ele descreve a decisão inteira em vez de metade dela.
>
> **A guarda de tabela procura o invólucro nas três linhas ACIMA**, e não na
> mesma. O JSX quebra a linha, e exigir os dois no mesmo texto reprovaria o
> padrão que `ProcessTable` já usava antes desta história — a guarda teria
> nascido vermelha, e guarda que nasce vermelha é desligada, não obedecida.
>
> **O quarto critério não é desta fatia, e o backlog diz isso.** A verificação
> visual a 320 px é `VN-1`, em `H-47`: o que se pode afirmar aqui é que nada no
> código **produz** aquela rolagem, e é isso que as guardas garantem.

**Objetivo:** a página nunca rolar na horizontal por causa de uma tabela, e o
texto do gráfico acompanhar a fonte-base do operador.

> **A exigência de 320 px não vem do telefone.** Vem de `SC 1.4.10 Reflow`, e o
> *Understanding* explica: *"320 CSS pixels is equivalent to a starting viewport
> width of 1280 CSS pixels wide at 400% zoom."* O alvo é desktop, e é o zoom de
> 400% numa janela de 1280 que alcança o operador — não há dispositivo móvel no
> escopo, e o corpus corta breakpoint de telefone com fonte na mão.

**Arquivos:**
- `web/src/pages/History.tsx` — tabela contida, `fontSize` relativo
- `web/src/pages/Performance.tsx` — as quatro tabelas de quebra, grids
- `web/src/components/ConflictDialog.tsx` — tabela de cinco colunas
- `web/src/pages/Clients.tsx` — grid sem contraparte de base
- `web/src/pages/Operational.tsx` — idem
- `web/src/pages/ProcessDetail.tsx` — três grids sem contraparte

**Critérios de aceite:**
- **Dado** `History.tsx:212`, `Performance.tsx:178` e `ConflictDialog.tsx:105`,
  **então** cada tabela está dentro de um `<div className="overflow-x-auto">`,
  como `ProcessTable.tsx:54` já faz — hoje a exceção bidimensional da tabela não
  está contida e arrasta as notas irmãs e a barra de filtros para a rolagem
  horizontal (`ACHADO 19`, e `R06` na Página Histórico).
- **Dado** os sete grids de `Clients.tsx:105`, `Performance.tsx:86` e `:99`,
  `Operational.tsx:50`, `ProcessDetail.tsx:143`, `:166` e `:201`, **então** cada
  um tem contraparte sem prefixo (`grid-cols-1`) — hoje o valor abaixo do
  breakpoint é implícito (`ACHADO 20`).
- **Dado** `History.tsx:183` e `:189`, **então** o `fontSize` dos eixos é
  `'0.75rem'` e não o número `12`, que o React converte para pixel e que não
  acompanha a fonte-base (`ACHADO 21`, `SC 1.4.4`).
- **Dado** `npm run verify`, **então** passa; a verificação visual em 320 px é
  `VN-1`, em `H-47`, e **não** é critério desta fatia.

**Casos-limite:**
- Os três `sm:max-w-md`/`sm:max-w-sm` de `Operational.tsx:85`,
  `EditProcessForm.tsx:103` e `ColorFieldsForm.tsx:133` → **não entram**:
  `max-width: none` é o valor inicial do CSS, mesma forma do contraexemplo
  `lg:sticky` que `R04` admite.
- Os quatro grids que já têm base explícita — `FilterBar.tsx:68`,
  `Alerts.tsx:130`, `Home.tsx:79`, `IngestionHealth.tsx:33` → já cumprem `R04`;
  não tocar.
- `width={48}` e `margin={{...}}` em `History.tsx` → geometria do Recharts, não
  tipografia; fora de `R03`.
- Contêiner de rolagem recortar o anel de foco de um controle interno → é o que
  `VN-3` procura; se aparecer, é achado novo, não regressão desta fatia.

**Fora desta história:** qualquer mudança de largura de contêiner ou de
breakpoint que o corpus não sustente — o corpus corta, com fonte, número de
breakpoints e sistema de grid como requisito.

**Dependências:** H-45
**Tamanho:** M (6 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-47"></a>

### H-47 — Percorrer os cinco procedimentos de navegador

> ✅ **CONCLUÍDA em 31/08/2026.** **Zero testes próprios** — a história produz
> registro, não código, e a suíte fica em **1586**, a mesma de `H-46`. Cinco dos
> seis procedimentos percorridos em Chrome 151 por CDP, com desfecho escrito em
> cada bloco de `docs/estilizacao/RESULTADO.md`. **Cinco achados novos**, um por
> história: `H-67` a `H-71`. Quatro divergências no protocolo, todas resolvidas.
>
> **Duas correções anteriores confirmadas em campo, e é isso que a história
> comprou.** `H-44`: zero paradas de `Tab` dentro de `aria-hidden` e zero no
> `<svg>` em `/historico`, nas **467** paradas percorridas — a parada órfã do
> `ACHADO 12` não existe mais. `H-46`: o tick do eixo mede **12 px** com
> fonte-base 16 e **18 px** com fonte-base 24 — o `'0.75rem'` escala, e o
> `fontSize: 12` numérico anterior mediria 12 nas duas. Nenhuma das duas era
> computável estaticamente, e era exatamente por isso que elas fecharam devendo.
>
> **O que passou, e o número importa tanto quanto o achado:** indicador de foco
> visível em **467 de 467** paradas, com forma única (`outline auto 1px`) e
> nenhum recortado por `overflow`; a ordem de tabulação é a do DOM nas sete
> páginas; as três tabelas contidas por `H-46` não fazem página nenhuma rolar —
> em `/operacional` 1368 elementos ultrapassam a borda e a página fica em 320,
> que é a exceção bidimensional de `SC 1.4.10` funcionando; e a barra de
> filtros, **suspeito nº 1 do roteiro**, não reprovou em lugar nenhum.
>
> **Divergência 1 — o roteiro apontava para código que não existe mais.** As
> oito fatias de `E9` moveram tudo sob os procedimentos: das seis referências
> conferidas, **cinco** apontavam para outro código — `MultiSelect.tsx:85` virou
> um `addEventListener`, `PendingEditsPanel.tsx:90` virou um `<strong>`,
> `FilterBar.tsx:68` virou o botão "Limpar". O critério de aceite de `VN-6`
> **nomeia as três linhas antigas**, então reancorar era condição para o critério
> ser verificável, não higiene. Os endereços velho → novo estão no desfecho.
>
> **Divergência 2 — colisão em `PD-07`.** A história reserva esse número para
> `VN-5`, e ele havia sido usado no mesmo dia para a pendência dos mapas de
> negócio. Os mapas passaram a `PD-08`.
>
> **Divergência 3 — o método é emulação, e a equivalência foi declarada item a
> item.** Viewport de 320 px em vez de zoom 400% (equivalente de layout, não de
> tamanho aparente) e `Page.setFontSizes` em vez de `chrome://settings/appearance`
> (o mesmo mecanismo). Onde a equivalência não valia, o item ficou **não
> exercido** em vez de aprovado: o escape de `Tab` do `ConflictDialog` exigiria
> aplicar edições com a planilha real alterada, e nada aqui grava na planilha do
> operador.
>
> **Divergência 4 — a lista de um arquivo virou dois**, com as cinco histórias
> dos achados. Era previsto no protocolo e o caso-limite manda: achado vira
> história própria, não correção embutida.
>
> **Duas medições minhas estavam erradas e foram refeitas antes de virarem
> registro.** A primeira leitura de ordem de tabulação acusou 35 inversões nas
> sete páginas — todas artefato de coordenada de viewport sob a rolagem que o
> próprio `Tab` provoca; com coordenada de documento sobra **uma**, e ela é
> correta. E a primeira amostragem de pixel usou "o mais escuro da caixa", que
> devolve o **fundo** quando o texto é claro sobre escuro: deu 1.00:1 no
> `MultiSelect`, que é impossível. As duas notas de método estão no documento,
> porque quem repetir o procedimento vai cair nas mesmas.

**Objetivo:** executar no navegador o que não é computável estaticamente, e
registrar o resultado de cada procedimento ao lado do achado que o gerou.

> **Silêncio sobre item de execução é lido como aprovação, e o corpus chama isso
> de erro grave.** Os procedimentos não são código, mas são trabalho com dono, e
> vêm depois das oito fatias anteriores: as ondas 2, 4 e 5 mudam cor resolvida,
> contêiner e rolagem — verificar antes verificaria um estado que vai deixar de
> existir.
>
> **`VN-5` sai daqui e vira pendência.** Ele exige Windows → Configurações →
> Acessibilidade → Temas de Contraste, e o desenvolvimento é em Linux. É
> exatamente a situação de `PD-06`, que já espera a primeira instalação na
> máquina do operador — e deixar `VN-5` amarrado a uma história que fecha antes
> disso repetiria o que aconteceu com `PD-05`, sem dono entre 14 e 17/08/2026.
> Os outros cinco rodam em qualquer navegador e ficam nesta fatia.

**Arquivos:**
- `docs/estilizacao/RESULTADO.md` — o desfecho de cada procedimento, ao lado do
  bloco que o emitiu

**Critérios de aceite:**
- **Dado** `VN-1`, **quando** a aplicação é aberta em janela de 1280 px CSS com
  zoom em 400%, **então** as sete URIs são percorridas e toda rolagem horizontal
  que não seja da tabela contida nem do `ResponsiveContainer` é registrada, com
  a página e o elemento.
- **Dado** `VN-2`, **então** o mesmo percurso em 200% registra texto cortado ou
  controle fora da tela, e é repetido com a fonte padrão do navegador em "Muito
  grande" — é onde o `fontSize` corrigido em `H-46` deixa de escalar se a
  correção falhar.
- **Dado** `VN-3`, **então** cada parada de `Tab` nas sete páginas tem indicador
  visível registrado, incluindo os botões sobre fundo escuro e os controles
  dentro de contêiner com `overflow`, e é confirmado que a parada órfã do
  gráfico deixou de existir depois de `H-44`.
- **Dado** `VN-4`, **então** a sequência de `Tab` é comparada com a ordem visual;
  o inventário estático já mediu 0 `order-*`, 0 `flex-*-reverse`, 0
  `grid-flow-*` e 0 `tabIndex` positivo, então o que se procura é divergência
  por grid e a posição do foco após navegação programática.
- **Dado** `VN-6`, **então** as três ocorrências com alfa —
  `ConflictDialog.tsx:73`, `MultiSelect.tsx:85`, `PendingEditsPanel.tsx:90` —
  têm razão medida por conta-gotas sobre o pixel do texto e do fundo, e o número
  é registrado; nenhuma delas foi computada estaticamente, e inventar valor sob
  alfa violaria a regra inviolável 3.
- **Dado** os cinco procedimentos, **então** cada um tem desfecho escrito:
  aprovado com o que foi observado, ou achado novo com arquivo e linha. Nenhum
  fica sem linha.

**Casos-limite:**
- Procedimento que revele achado novo → vira história própria, não correção
  embutida aqui; esta fatia mede e registra, não conserta.
- `VN-1` acusar rolagem numa tabela **já contida** → é rolagem legítima da
  exceção bidimensional de `SC 1.4.10`, e não é achado.
- Navegador sem os temas de contraste do Windows → é precisamente por isso que
  `VN-5` não está aqui.
- Aplicação servida por `npm run dev` em vez do `dist/web` real → o percurso
  vale igual; o que muda entre os dois é a rota `GET /*`, coberta por `H-30`.

**Fora desta história:** `VN-5` (forced colors), que vira `PD-07` e fecha na
primeira instalação na máquina do operador, junto de `PD-01`, `PD-05` e `PD-06`.
E qualquer correção de código: os cinco procedimentos produzem registro.

**Dependências:** H-39, H-40, H-41, H-42, H-43, H-44, H-45, H-46
**Tamanho:** P (1 arquivo, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-67"></a>

### H-67 — A linha do ranking cabe em 320 px

> ✅ **CONCLUÍDA em 31/08/2026.** **4 testes próprios**, suíte em **1602**.
> `/performance` vai de **385** para **305 = 305** num viewport de 320, e as
> **sete** páginas foram medidas juntas, antes e depois: as outras seis estavam
> em 305 e continuam em 305. O antes reproduz `VN-1/A` exatamente, culpado
> incluído — o `<span class="w-24 shrink-0">` em `right: 385`.
>
> **A correção empilha em vez de encolher, e a escolha é o achado.** Duas
> alternativas foram medidas e descartadas: reduzir o rótulo a `w-24` deixaria
> a soma em 321 contra 305 — ainda rolaria —, e deixar o `flex-wrap` livre
> punha a barra em **43 px** com o número descendo junto. O que ficou dá ao
> rótulo a linha inteira abaixo de 640: linha 1 com o nome em 215 px, linha 2
> com barra 47 + contagem 48 + secundário 96. **Nada é cortado em nenhum dos
> dois.**
>
> **O segundo critério não é asserção, é medição.** Os dois ramos condicionam a
> `secondary`, que só `Performance.tsx` passa. Medido no computado: o ranking
> Responsáveis e o de Clientes ficam `flexWrap: nowrap` com rótulo de 160 px
> **nas duas larguras**, e a 1280 px o próprio ranking de Agentes volta a uma
> linha só, com os mesmos 160 px e 28 px de altura de antes. A correção não
> alcança tela nenhuma que não tivesse o defeito.
>
> **O caso-limite fechou com folga maior que a esperada.** `43 atrasados`, o
> texto mais longo medido, ocupa **76,0 px** dos 96 do slot; `9.999 atrasados`
> — acima de qualquer valor possível nas 649 linhas — ocupa 93,1 e ainda cabe,
> sem a página rolar. A primeira medição deu 96/96 para todos os cinco textos,
> inclusive o impossível: era o `scrollWidth` do pai não enxergando o filho
> inline. **O número absurdo foi refeito antes de virar prova.**
>
> **Divergências:** nenhuma. A lista de arquivos estava completa, e
> `Performance.tsx` acabou não sendo tocada — o backlog já a condicionava a "se
> a correção for do lado de quem passa". `/nova-pagina` foi invocada pelo
> despacho textual da fatia e **não incide**: nenhum dos caminhos que ela
> obriga — `api-client.ts`, `web/src/hooks/`, `api-stub.ts`, `App.tsx`,
> `App.test.tsx` — entra numa correção de CSS de página já montada.

**Objetivo:** a Página Performance parar de rolar horizontalmente na largura que
`SC 1.4.10` exige.

> **Medido por `VN-1` em 31/08/2026, no navegador.** A 320 px CSS efetivos a
> página tem `scrollWidth` **385**, e o culpado é o `<span class="w-24 shrink-0">`
> do slot `secondary` — 10 ocorrências, uma por linha do ranking. As larguras
> fixas somam antes da barra: `w-40` do rótulo (160) + `w-12` da contagem (48) +
> `w-24` do secundário (96) + três `gap-3` (36) = **340**, e o `shrink-0` proíbe
> o colapso.
>
> **`RankingBar` não é culpada sozinha**, e é isso que decide a correção:
> `Performance.tsx:127` é a **única** página que passa `secondary`, e as outras
> seis usam o mesmo componente e passam a 320 px. Consertar o componente para
> todos mudaria seis telas que não têm defeito.

**Arquivos:**
- `web/src/components/RankingBar.tsx` — a largura do slot `secondary`
- `web/src/pages/Performance.tsx` — se a correção for do lado de quem passa
- `web/tests/Performance.test.tsx`

**Critérios de aceite:**
- **Dado** viewport de 320 px CSS, **quando** `/performance` é aberta, **então**
  `document.scrollingElement.scrollWidth` é 320 — o valor medido hoje é 385.
- **Dado** as outras seis páginas, **então** nenhuma muda de largura: elas já
  passavam, e a correção não pode alcançá-las.
- **Dado** a linha do ranking a 320 px, **então** o secundário continua legível —
  esconder o número resolveria a rolagem descartando informação.

**Casos-limite:**
- Secundário com o texto mais longo medido (`43 atrasados`) → é o que produz os
  96 px de hoje; a correção precisa caber com ele, não com o menor.
- Ranking sem `secondary` → nada muda, e as seis páginas provam.

**Fora desta história:** os outros quatro achados de navegador — `H-68` a `H-71`.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-68"></a>

### H-68 — O seletor de cor cabe na tela do celular

> ✅ **CONCLUÍDA em 31/08/2026.** **3 testes próprios**, suíte em **1595**.
> Os dois números de `VN-1` e `VN-2` foram **reproduzidos antes de corrigir** —
> 572 num viewport de 320 e 846 num de 640 com fonte-base 24 —, e é isso que
> torna a medição do depois confiável. Depois: **305 = 305** e **625 = 625**,
> zero elementos ultrapassando a borda sem ancestral que contenha a rolagem.
>
> **A causa não era `sm:max-w-sm` incidir tarde demais; era `min-width` vencer
> `max-width`.** O `<select>` tem `min-width: auto` como item de flex, e o UA
> resolve isso para a largura da maior `<option>` — 531 px. Nenhum `max-width`
> contém um elemento cujo mínimo já é maior que ele, e por isso o limite não
> protegia nem a 640 px, onde estava ativo. A correção são duas classes:
> `min-w-0` no `<label>`, que o deixa encolher abaixo do conteúdo, e `w-full`
> no `<select>`, que o prende ao rótulo em vez de ao texto. **O limite em `rem`
> ficou** — teto estético em tela larga, e agora inofensivo.
>
> **O critério de aceite fala em 320 e o harness devolve 305, e isso não é
> divergência.** As páginas que `H-47` aprovou como "320 = 320" medem **305 =
> 305** aqui: os 15 px são a barra de rolagem vertical clássica do
> `--headless=new`. `/alertas` e `/clientes` foram medidas como controle antes
> de aceitar o número — o mandato desta sessão pede exatamente isso, e sem o
> controle o 305 teria sido lido como achado.
>
> **O terceiro critério passa por construção, não por sorte.** A caixa fechada
> trunca, e quem a mantém identificável é o nome da cor vir primeiro: as 7
> opções servidas têm 7 prefixos distintos, e o texto completo continua no DOM
> para a lista aberta, que o UA desenha. Um teste fixa isso, para que reordenar
> o rótulo para "sem responsável · Canal Verde — Verde (tom A)" reprove.
>
> **Divergência 1 (fiação, resolvida):** a lista de arquivos está correta e
> completa, mas o critério é medido em px e **jsdom não faz layout** — os testes
> próprios ancoram a contenção declarada (`min-w-0`, `w-full`), e a largura foi
> medida por CDP num harness de scratchpad que sobe o servidor real sobre
> `tests/fixtures/cores.xlsx`. Alternativa descartada: fechar só com teste de
> classe, que prova intenção e não resultado — foi assim que `sm:max-w-sm`
> pareceu suficiente por oito fatias.

**Objetivo:** a Página Detalhe parar de rolar 572 px num viewport de 320.

> **Medido por `VN-1` em 31/08/2026.** É a pior das duas rolagens: `scrollWidth`
> **572** contra 320 — o controle rompe a borda do próprio cartão, e a prova
> visual está no desfecho de `VN-1` em `docs/estilizacao/RESULTADO.md`.
>
> **A causa não é uma classe errada, é a largura que o navegador impõe.** O
> `<select>` é dimensionado pela maior `<option>` — "Verde (tom A) — sem
> responsável · Canal Verde" —, e nenhum CSS de largura foi declarado abaixo do
> breakpoint: `sm:max-w-sm` só incide a partir de 640 px.
>
> **E o limite existente não protege nem onde incide.** `VN-2` mediu a mesma
> página com a fonte-base em 24 px: `scrollWidth` **846** contra 640, com o
> `sm:max-w-sm` **ativo** — porque `max-w-sm` é 24rem, e rem acompanha a fonte.
> Um limite em `rem` não contém um controle cuja largura vem do texto.

**Arquivos:**
- `web/src/components/ColorFieldsForm.tsx` — a largura do `<label>` e do `<select>`
- `web/tests/ColorFieldsForm.test.tsx`

**Critérios de aceite:**
- **Dado** viewport de 320 px CSS, **quando** `/processo/<ref>` é aberta, **então**
  `scrollWidth` é 320 — hoje é 572.
- **Dado** viewport de 640 px com fonte-base de 24 px, **então** `scrollWidth` é
  640 — hoje é 846.
- **Dado** o rótulo mais longo do mapa de cores, **então** ele continua
  selecionável e identificável: truncar a opção a ponto de duas ficarem iguais
  trocaria uma rolagem por uma escolha errada na planilha.

**Casos-limite:**
- Mapa de cores com rótulo mais longo que os nove de hoje → a correção não pode
  depender do comprimento atual.
- `<select>` fechado e aberto → a lista aberta é desenhada pelo UA e não obedece
  ao CSS da página; o critério é sobre a caixa fechada.

**Fora desta história:** os outros quatro achados — `H-67`, `H-69`, `H-70`, `H-71`.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (2 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-69"></a>

### H-69 — O texto cortado da tabela tem caminho de volta

> ✅ **CONCLUÍDA em 31/08/2026.** **3 testes próprios**, suíte em **1605**.
> **Zero células cortadas nos quatro cenários de ampliação**, contra 31 a 100%
> e 41 a 640 px com fonte 24 na mesma amostra. O rótulo passa a quebrar em
> linhas e a coluna toma o espaço que as três numéricas não usam.
>
> **A correção elimina o truncamento em vez de dar reflexo a ele, e isso é
> obrigatório, não preferência.** O primeiro critério — o truncamento não
> crescer com a ampliação — **não é satisfazível mantendo o corte**: o texto
> escala com a fonte e o container não, então em algum aperto de largura sempre
> sobra menos coluna. Quatro variantes foram medidas, e as outras três falham:
> `max-w-0 break-words` deixa 27 cortadas a 640/24 e a linha em 193 px de
> altura; `w-[18ch] truncate` zera o corte mas faz a **tabela** rolar; e
> `w-[18ch] break-words` mede idêntico à escolhida, porque `width` numa `<td>`
> de tabela auto-layout é sugestão que o navegador descartou — classe morta.
>
> **O segundo critério fica satisfeito de forma mais forte do que pedia.** Ele
> queria o texto completo alcançável sem mouse; agora ele está **na tela**, e
> nenhuma célula precisa de `title` — que o Chrome não revela por teclado — nem
> de parada de tabulação, que somaria uma por linha à ordem que `H-47` aprovou
> em 467 de 467. O terceiro critério é o mesmo fato: **0 `title` e 0 focáveis**,
> medidos, em toda célula.
>
> **O número de `VN-2` não foi reproduzido, e o motivo fica registrado.** `VN-2`
> mediu 7 · 8 · 14 sobre as 34 células da planilha real, que o mandato desta
> sessão proíbe abrir. A primeira tentativa com a fixture deu 7 · 7 · **5** — o
> truncamento **caindo** com a fonte, o oposto do achado —, porque 16 células com
> números de um dígito não fazem a coluna do rótulo encolher. O cenário foi
> recriado no DOM com 68 células, rótulos de 3 a 40 caracteres e números de três
> dígitos, e aí a mecânica apareceu: 31 · 31 · 28 · **41**. **O que reproduz o
> achado é o aperto de largura junto com a fonte**, não a fonte sozinha — a
> 1280 px com fonte 24 a coluna dobra e o corte até diminui.
>
> **Divergências:** nenhuma. A lista de arquivos estava completa e `H-67`, que
> tocou a mesma página, não colidiu — ela mexeu em `RankingBar.tsx`.

**Objetivo:** o conteúdo que a tabela de tempo documental trunca deixar de ser
inalcançável, e parar de crescer quando o operador amplia.

> **Medido por `VN-2` em 31/08/2026, nos três cenários.** Das 34 células
> `.max-w-0.truncate`, ficam truncadas **7** a 100%, **8** a 200% e **14** com a
> fonte do navegador em "Muito grande". Nenhuma delas tem atributo `title`.
>
> **São duas coisas, e só a segunda é violação.** Truncar a 100% é o design da
> tabela e continua legítimo; o que `SC 1.4.4` cobra é que ampliar até 200% não
> custe conteúdo — e aqui o conteúdo perdido dobra, e os valores cortados não
> têm recurso nenhum: `title` não existe em nenhuma das 34 células.
>
> **A Página Clientes não tem o defeito, e serve de contraprova:** o
> `.w-40.truncate` de lá corta 1 de 33 células nos três cenários — constante, não
> degrada.

**Arquivos:**
- `web/src/pages/Performance.tsx` — o caminho para o texto completo
- `web/tests/Performance.test.tsx`

**Critérios de aceite:**
- **Dado** a fonte-base em 24 px, **então** o número de células truncadas não
  cresce em relação a 100% — hoje vai de 7 para 14.
- **Dado** uma célula truncada, **então** o texto completo é alcançável sem
  mouse: `title` sozinho não é lido por teclado e não basta.
- **Dado** uma célula que cabe, **então** nada é acrescentado a ela.

**Casos-limite:**
- Valor vazio na célula → não ganha rótulo de "texto completo" para conteúdo que
  não existe.
- Valor exatamente na largura da coluna → não é truncado, e o teste usa a
  medição, não a classe declarada.

**Fora desta história:** os outros quatro achados — `H-67`, `H-68`, `H-70`, `H-71`.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (2 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-70"></a>

### H-70 — O foco sobrevive à navegação programática

> ✅ **CONCLUÍDA em 01/09/2026.** **4 testes próprios**, suíte em **1613**.
> Depois de abrir um recorte pelo ranking o foco ia para o `<body>`; agora vai
> para a landmark da página nova, medido em Chrome 151: `main` com
> `aria-label="Operacional"`, `tabIndex -1` e `outline auto 1px` casando
> `:focus-visible` — a **mesma forma única** que `H-47` aprovou em 467 de 467.
>
> **Mover o foco virou o padrão, e a exceção é quem declara.** `VN-4` mediu o
> defeito numa origem, mas há **seis** navegações programáticas — `Clients`,
> `Performance`, `ProcessTable`, `AlertRow`, `IngestionHealth` e
> `StatusBanner` —, todas com o mesmo problema. Inverter o padrão em
> `navigate()` cobre as seis sem tocar nenhuma, e deixa `keepFocus: true` num
> lugar só: o link da casca, onde o foco já está onde o usuário o pôs.
>
> **O alvo é a landmark da casca, e não um nó da página** — o que resolve o
> caso-limite da rota `lazy` por construção, em vez de por verificação: o
> `<main>` existe mesmo enquanto o `Suspense` mostra o fallback, então nunca há
> nó ausente para focar.
>
> **Um falso achado morreu no controle.** A primeira medição do "voltar"
> devolveu `moveuOFoco: true`, o que reprovaria o caso-limite. O teste é que
> estava errado: `document.body.focus()` **não move o foco** — o `<body>` não é
> focável —, então a medida leu o foco que já estava no `<main>`. Refeito com um
> elemento focável de verdade, o `popstate` deixa o foco **intacto**.
>
> **Zero paradas de tabulação novas**, medido nas oito rotas: 26 · 38 · 34 · 23
> · 32 · 25 · 16 · 13, e `mainEhParada: false` em todas. Os números são menores
> que as 196 que `VN-4` registrou em `/operacional` porque a fixture tem 10
> processos e a planilha real tem 649 — o que muda a magnitude do prejuízo, não
> o defeito.
>
> **O terceiro critério é o rótulo, não um segundo texto.** Quem anuncia é o
> `aria-label` da landmark, lido quando ela recebe o foco. Escrever também na
> região viva faria o leitor de tela dizer a mesma coisa duas vezes, que é
> exatamente o que `H-43` evitou ao pôr o bloco visível em `aria-hidden`.
>
> **Divergência 1 (fiação, resolvida):** a lista de arquivos cita `Clients.tsx`
> como "a origem da navegação", e são **seis**. Resolvido invertendo o padrão em
> `router.ts` — e `Clients.tsx` acabou **não sendo modificada**. Alternativa
> descartada: marcar as seis origens uma a uma, que tocaria seis arquivos e
> deixaria a sétima origem futura nascendo com o defeito.
>
> **Divergência 2 (fiação, resolvida):** `docs/10-governanca.md` não estava na
> lista, e o registro de `D-16` afirmava **79 linhas de código** em `router.ts`.
> A fatia levou a 97, de ~100 — três de folga. O número foi atualizado: a
> guarda de `tests/repo/contratos.test.ts` mede o limiar e continua verde, mas o
> texto teria envelhecido em silêncio, que é o modo de falha que ela existe para
> impedir.

**Objetivo:** quem navega por teclado não recomeçar do zero ao abrir um recorte
pelo ranking.

> **Medido por `VN-4` em 31/08/2026.** Com o foco numa linha do ranking de
> `/clientes`, o clique dispara `navigate('/operacional')`: a rota troca e
> `document.activeElement` passa a ser o **`<body>`**. O procedimento previa
> exatamente isto — "a navegação programática não move o foco, e a página troca
> sob o cursor de teclado".
>
> **O custo é medido, não estimado:** `/operacional` tem **196** paradas de
> tabulação, e é onde o operador cai. É `SC 2.4.3`.
>
> **Não é defeito do roteiro de `D-16`**, e sim de uma decisão que ele nunca
> tomou: mover o foco depois de uma troca de rota é comportamento que nem o
> `react-router` dá de graça.

**Arquivos:**
- `web/src/pages/Clients.tsx` — a origem da navegação
- `web/src/router.ts` ou `web/src/App.tsx` — onde o foco passa a ser posto
- `web/tests/App.test.tsx`

**Critérios de aceite:**
- **Dado** o foco numa linha do ranking, **quando** ela é acionada, **então**
  depois da troca de rota o foco está num elemento identificável da página nova,
  e não no `<body>`.
- **Dado** a navegação pelos links da casca, **então** nada muda: ali o foco já
  está onde o usuário o pôs.
- **Dado** um leitor de tela, **então** a mudança de página é anunciada — mover o
  foco em silêncio troca um defeito por outro.

**Casos-limite:**
- Rota que falha ao carregar (`lazy`) → o foco não pode ser posto num nó que
  ainda não existe.
- Navegação pelo botão "voltar" do navegador → é `popstate`, não navegação
  programática, e o critério não incide.

**Fora desta história:** os outros quatro achados — `H-67` a `H-69` e `H-71`.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-71"></a>

### H-71 — O valor anterior da edição é legível

> ✅ **CONCLUÍDA em 31/08/2026.** **3 testes próprios**, suíte em **1598**.
> **3.23:1 → 8.73:1**, medido em Chrome 151 com o `oklch` dos tokens resolvido
> pelo próprio navegador e a opacidade composta pelo compositor, não por
> aritmética escrita à mão. O antes reproduz `VN-6` — glifo `RGB(176,131,98)`
> sobre `RGB(255,251,235)`, contra os `RGB(175,130,97)` que a amostragem de
> pixel registrou; 1 unidade por canal de diferença, e o número daqui é o mais
> conservador dos dois.
>
> **A correção é tirar `opacity-60`, e nada mais.** Nenhum token muda, e é isso
> que torna o terceiro critério de aceite **não-incidente em vez de pulado**:
> os três valores de `state-warning-*` foram lidos do `documentElement` depois
> da mudança e estão idênticos ao `index.css`. `web/src/index.css` não foi
> tocado — a lista de arquivos já o condicionava a "se a correção for no token".
>
> **O segundo critério passa por dois canais, nenhum deles cor.** Anterior e
> novo ficam na mesma cor; o que os separa é `line-through` num e peso 700 no
> outro, medidos no computado. Cor sozinha violaria `ACHADO 18`, e forma
> sozinha era o risco que o critério nomeava.
>
> **Varredura de irmãos, porque o achado podia não ser único.** Nas três páginas
> medidas — Detalhe com o painel aberto, Inicial e Operacional — **zero** textos
> abaixo do limiar. Os únicos com `opacity < 1` que restam são as 10 setas `▾`
> do `MultiSelect`, em **4.55:1**: `VN-6` as registrou em 4.60:1 e elas seguem
> passando, intactas, como convinha a quem não mexeu no token delas.
>
> **Divergência 1 (fiação, resolvida):** o backlog lista
> `web/tests/PendingEditsPanel.test.tsx`, **que não existe** — o painel é coberto
> por `web/tests/ProcessDetail.test.tsx`, e foi lá que os três testes entraram.
> Alternativa descartada: criar o arquivo que o plano nomeia, o que espalharia a
> cobertura do mesmo componente por dois lugares sem ganho.
>
> **Divergência 2 (fiação, resolvida), e ela custou uma restauração à mão.** O
> harness de medição precisava de edição enfileirada, e `POST /api/edits` gravou
> em `data/pending-edits.jsonl` **da raiz**: `buildServer` não repassa
> `queuePath` a `registerEditsRoutes`, cujo default é relativo ao cwd. A fila do
> operador foi restaurada byte a byte — 247 bytes, uma edição de 14/08 já
> descartada em 14/08, então nada se perdeu —, e o harness passou a rodar com o
> **cwd** numa área própria. A suíte nunca esteve exposta: `tests/http/edits.test.ts`
> registra a rota direto, com `queuePath` injetado. **O buraco é de quem monta
> por `buildServer`**, e virou pendência para o dono no relatório da sessão.

**Objetivo:** o texto que o operador confere antes de gravar na planilha alcançar
o contraste que `AA` exige.

> **Medido por `VN-6` em 31/08/2026, por amostragem do pixel renderizado.** O
> `line-through opacity-60` de `PendingEditsPanel.tsx:92` mede **3.27:1** — glifo
> `RGB(175,130,97)` sobre o painel `RGB(255,251,235)`. O texto é `text-sm`, 14 px,
> então o limiar é **4.5:1**: faltam 1.23.
>
> **O número é conservador.** A amostra foi feita com o glifo ampliado, que reduz
> antialiasing; a 14 px reais a razão medida é igual ou pior.
>
> **É o valor ANTERIOR de uma edição enfileirada** — o que o operador lê para
> conferir o que vai ser gravado no arquivo da empresa. Ilegível aqui não é
> incômodo estético.
>
> **Os outros dois alvos de alfa passaram**, e ficam registrados porque um deles
> quase não passa: `MultiSelect.tsx:133` mede 8.60:1 sobre o gatilho escuro e
> **4.60:1** sobre o fundo claro — margem de 0.10 sobre o limiar.

**Arquivos:**
- `web/src/components/PendingEditsPanel.tsx` — o par de classes do valor anterior
- `web/src/index.css` — se a correção for no token de aviso
- `web/tests/PendingEditsPanel.test.tsx`

**Critérios de aceite:**
- **Dado** o valor anterior sobre o painel de aviso, **então** a razão medida é
  ≥ 4.5:1 — hoje é 3.27:1.
- **Dado** o valor **novo**, ao lado dele, **então** ele continua distinguível do
  anterior: os dois legíveis e iguais entre si apagariam qual é qual.
- **Dado** o token de aviso, **se** ele mudar, **então** os outros consumidores
  dele são medidos junto — `H-40` já provou que token compartilhado muda mais
  tela do que a lista da história prevê.

**Casos-limite:**
- `opacity` removida em favor de cor sólida → o `line-through` sozinho precisa
  seguir dizendo "anterior", porque a distinção não pode ficar só na cor
  (`ACHADO 18`).
- Edição cujo valor anterior é vazio → não há texto a contrastar, e a linha diz
  outra coisa.

**Fora desta história:** os outros quatro achados — `H-67` a `H-70`. E o
contraste do conteúdo **sob** o scrim do `ConflictDialog`, medido por `VN-6` em
7.04:1 sobre a tabela e 3.29:1 sobre o gráfico: conteúdo obscurecido por diálogo
modal é inativo, e mexer nele é decisão que `H-47` deixou registrada, não aberta.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-72"></a>

### H-72 — A aba corrente sobrevive ao alto contraste

> ✅ **CONCLUÍDA em 31/08/2026.** **4 testes próprios**, suíte em **1609**.
> Sob `forced-colors: active` as sete abas tinham **uma** assinatura de borda —
> `2px solid rgb(255,255,0)` em todas, reproduzido antes de corrigir — e agora
> têm duas: a corrente em **4 px** contra 2 px das outras seis. O canal é a
> espessura, a mesma técnica que `H-44` usou no botão de janela e que `VN-5`
> mediu sobrevivendo.
>
> **O modo normal não regride, e isso é medição.** A borda e a compensação de
> `padding` viajam na variante `forced-colors:`, então fora do modo forçado o
> computado é o mesmo de antes: duas assinaturas, corrente única, alturas e
> linhas de base iguais. Sem condicionar o `padding` junto, a linha de base do
> texto se mexeria sempre — e há teste fixando que os dois andam na mesma
> variante.
>
> **Um falso achado morreu no controle.** A 320 px a medição devolveu "bases
> diferentes", que pareceria desalinhamento causado pela correção. O controle
> mostrou o contrário: as abas quebram em **3 linhas** de `flex-wrap` desde
> antes, e a base é igual **dentro de cada linha** nos quatro cenários — normal
> e forçado, 320 e 1280. O caso-limite da rolagem também fecha: 305 = 305 sob
> modo forçado, e a contenção de `H-46` segue de pé.
>
> **`aria-current` permanece, em exatamente uma das sete** — `Configuração`
> nasceu em `H-38` e conta. O canal novo se soma ao eixo programático, e o teste
> ancora a contagem em `NAV_PAGES`, não num número escrito à mão.
>
> **Divergências:** nenhuma. `PD-07` **não fecha com esta história**: os itens
> (2) e (3) dela — o `ConflictDialog` e o realce de linha — continuam abertos,
> por exigirem respectivamente uma planilha alterada e um cursor real, e o item
> (1), a paleta nominal do Windows, segue sendo confirmação de segunda ordem.

**Objetivo:** o operador que usa tema de alto contraste enxergar em que página
está.

> **Medido por `VN-5` em 31/08/2026, por emulação de `forced-colors`.** Fora do
> modo forçado, as abas de `App.tsx:196` têm duas cores de borda — a corrente com
> o token, as outras `rgba(0,0,0,0)`. Dentro dele há **uma**: as sete ficam com
> `border-bottom: 2px solid rgb(255,255,0)`, porque o UA pinta `border-transparent`
> como pinta qualquer outra borda.
>
> **É a pergunta que o procedimento declarava em aberto**, e a resposta é a pior
> das duas: "se substituir, as abas ficam idênticas e só o `aria-current` resta".
> Ele serve o leitor de tela e não serve quem enxerga.
>
> **`H-44` já resolveu este problema uma vez, no botão de janela**, trocando o
> canal de cor pela espessura da borda — e `VN-5` mediu que aquela correção
> **sobrevive** ao alto contraste. A mesma técnica se aplica aqui.

**Arquivos:**
- `web/src/App.tsx` — o estado visual da aba corrente
- `web/tests/App.test.tsx`

**Critérios de aceite:**
- **Dado** `forced-colors: active`, **então** a aba corrente é distinguível das
  outras seis por um canal que sobrevive à substituição de paleta — espessura,
  posição ou texto, nunca só cor.
- **Dado** o modo normal, **então** a aparência de hoje não regride: a barra de
  navegação continua com o mesmo peso visual.
- **Dado** o leitor de tela, **então** o `aria-current="page"` permanece — o canal
  novo se soma a ele, não o substitui.

**Casos-limite:**
- As sete abas, e não seis: `Configuração` nasceu em `H-38` e conta.
- Aba corrente em viewport estreito → o canal novo não pode reintroduzir a
  rolagem que `H-46` tirou.

**Fora desta história:** os outros alvos de `VN-5`. O item (d) do
`ConflictDialog` e o item (e) do realce de linha continuam em `PD-07`, por
exigirem respectivamente a planilha alterada e um cursor real.

**Dependências:** `H-47`, que mediu.
**Tamanho:** P (2 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="e10"></a>

## Épico E10 — As melhorias de uso

Nasce de `docs/uso/RESULTADO.md` (31/08/2026), levantado depois de o operador
usar o painel contra a planilha real com a intenção de trabalhar. **Não é
auditoria de documento nem de código:** é o que apareceu na tela.

**Quatro das doze observações não viraram história**, e não devem virar: eram
perguntas sobre o que a aplicação faz — o predicado de atraso, a origem de "em
desembaraço", a fórmula do tempo documental e a existência do filtro na Página
Performance —, e as quatro estavam corretas. Três eram comportamento certo mal
comunicado, e a quarta era funcionalidade existente e invisível; a resposta às
duas últimas é `H-53`, que muda o que a tela **diz**, não o que ela calcula.

**Três decisões do operador valem para o épico inteiro e não se re-litigam:**

1. **O amarelo continua significando "importador fora do RJ"** (A-38, D-02). O
   épico acrescenta canal verde, e **não** canal amarelo. Perguntado
   explicitamente em 31/08/2026, com a alternativa à vista.
2. **O cliente consolidado não substitui o valor da célula** — os dois campos
   coexistem, e o antigo passa a se chamar pelo que sempre foi.
3. **Os nomes reais são configuração, nunca código.** O repositório vai a
   público, e a regra inviolável 8 já proíbe nome de cliente em log; nome de
   pessoa da equipe cai na mesma regra, pelo mesmo motivo. É o que `H-48` fecha
   antes de qualquer outra história do épico começar.

**A regra inviolável 4 não é tocada em nenhuma das sete.** `H-50` usa a cor para
desempatar **responsável**, que ela já codifica desde TD-05, e `H-51` a usa para
**canal**, que ela já codifica desde IND-06. Nenhuma delas faz a cor inferir
status, em lugar nenhum.

---

<a id="h-48"></a>

### H-48 — Os dois mapas de negócio, fora do repositório

> ✅ **CONCLUÍDA em 31/08/2026.** **47 testes próprios** em quatro arquivos —
> dois de domínio e dois de carga. Suíte total de **1322 para 1369**, sem um
> caso ajustado para acomodar a fatia. Três divergências no protocolo, todas
> resolvidas.
>
> **A lista de arquivos omitia o ponto de partida, e o objetivo não fecharia
> sem ele.** "Validação na partida" exige que alguém chame o loader, e quem
> chama é `main()` em `src/http/server.ts` — que passa a `initStore`. Sem os três
> arquivos acrescentados, os loaders existiriam sem consumidor. É a lição da
> regra inviolável 7 aplicada antes de morder: ponto de injeção que a assinatura
> de `buildServer` não tem falha em silêncio. Os campos entraram **opcionais** em
> `StoreOptions`, e por isso nenhuma fábrica de estado dos testes precisou mudar.
>
> **A guarda de âncora morta reprovou o portão, e estava certa.** Os cabeçalhos
> citavam `config/client-map.json`, que o `.gitignore` cobre: num checkout limpo
> o arquivo não existe, e a guarda cobra existência em disco. O próprio
> `tests/repo/contratos.test.ts` já documentava a convenção — arquivo de execução
> não versionado se nomeia **sem** o prefixo de diretório, como `app.json` desde
> `H-34` — com um "não conserte de volta" no comentário. A correção foi seguir a
> convenção, não afrouxar a guarda.
>
> **A conferência contra a planilha real corrigiu um número que dois documentos
> já afirmavam.** A cobertura do mapa de clientes fora escrita como "528 dos 649
> processos"; o mapa real consolida **466**. A diferença são os 62 processos do
> prefixo que cobre três clientes — contados como cobertos pela lista do
> operador quando a decisão dele foi justamente **não** consolidá-los. Duas
> decisões diferentes tinham virado uma só na prosa.
>
> **O desempate por cor não foi escolhido, foi derivado.** Roxo ocorre
> exclusivamente em importador de uma pessoa, azul e bege exclusivamente em
> importador da outra — **zero contradições em 649 linhas**. Medido antes de a
> regra existir; sem essa medição, usar a cor como segunda fonte seria supor que
> ela concorda. O campo `conflict` existe para a primeira divergência, que hoje
> não há e que ninguém veria acontecer.
>
> **Uma pendência nasce aqui e é de `H-49`:** o operador informou que dois
> clientes menores também respondem a um terceiro, "mas mantendo separado".
> Cliente dentro de cliente exige hierarquia, que este formato não tem. Os três
> ficam como clientes irmãos até `H-49` decidir a forma — acrescentar o campo
> agora seria projetar o consumo antes de ele existir.

**Objetivo:** existir um lugar para os nomes reais de cliente e de equipe que
não seja o código nem o histórico do git, com validação na partida e exemplo
versionado.

> **Por que uma história só para dois arquivos de configuração.** `H-49` e
> `H-50` são as duas histórias caras do épico, e ambas consomem estes mapas. Sem
> esta fatia primeiro, cada uma inventaria o seu formato de carga, e o segundo
> a escrever herdaria o formato do primeiro por acidente — foi assim que
> `color-map.json` e `status-aliases.json` ganharam dois loaders com validações
> desalinhadas.
>
> **O gatilho é publicação, não zelo.** Uma decisão já tomada põe este
> repositório em público. `config/app.json` já está no `.gitignore` pelo mesmo
> motivo, e o par `.exemplo` versionado é o padrão que `H-34` estabeleceu:
> quem clona recebe a forma, nunca o conteúdo.

**Arquivos:**
- `config/client-map.json.exemplo` — versionado, nomes fictícios
- `config/team-map.json.exemplo` — versionado, nomes fictícios
- `.gitignore` — as duas entradas reais
- `src/app/client-map-loader.ts` — carga e validação
- `src/app/team-map-loader.ts` — carga e validação
- `src/domain/client-mapper.ts` — a função pura de consolidação
- `src/domain/team-mapper.ts` — a função pura de atribuição
- `tests/app/client-map-loader.test.ts`, `tests/app/team-map-loader.test.ts`
- `tests/domain/client-mapper.test.ts`, `tests/domain/team-mapper.test.ts`

**Critérios de aceite:**
- **Dado** `config/client-map.json` ausente, **quando** a aplicação sobe,
  **então** ela sobe: o mapa vazio é legítimo, e todo cliente permanece como
  está na célula. Ausência de mapa não é erro — é a instalação que ainda não
  configurou, e ela precisa chegar ao painel (mesma regra de `H-34`).
- **Dado** um mapa com regra cujo `match` não é `prefix` nem `contains`,
  **então** a carga lança erro nomeando a entrada e os valores aceitos, como
  `ColorMapError` faz.
- **Dado** duas regras que casam a mesma chave, **então** vence a **primeira**
  na ordem do arquivo, e a ordem é documentada no próprio JSON. Exigir
  correspondência única recusaria o mapa real: o mesmo cliente aparece por
  prefixo e por texto contido.
- **Dado** `src/domain/client-mapper.ts` e `team-mapper.ts`, **então** nenhum
  dos dois faz I/O — recebem o mapa já carregado, como `color-mapper.ts`
  (ADR-0006).
- **Dado** os dois `.exemplo`, **então** nenhum contém nome real de cliente,
  importador ou pessoa, e `.github/scripts/verifica-dados-sensiveis.sh` continua
  passando — a guarda é aquele script, rodado por `dados-sensiveis.yml`, e não um
  teste de `tests/repo/` *(divergência 2 da fatia)*.

**Casos-limite:**
- Mapa presente e vazio (`rules: []`) → idêntico a mapa ausente, sem erro.
- Regra com `match: "prefix"` e valor vazio → recusada na carga: casaria tudo.
- Chave de cliente vazia → nenhuma regra casa, e ela permanece vazia; a chave
  vazia é valor legítimo (TD-04) e continua filtrável.
- JSON malformado → mata a partida, como `loadConfig` faz. Diferente de ausente:
  arquivo escrito errado é engano que a tela não conserta.
- Nome com acento no `label` → preservado; o mapa é apresentação, e `normKey`
  não é aplicado ao rótulo.

**Fora desta história:** consumir os mapas. Nenhum campo de `Process` muda
aqui, nenhuma rota muda, e nenhuma tela muda — são `H-49` e `H-50`.

**Dependências:** nenhuma.
**Tamanho:** M (10 arquivos, 0 contrato de rota novo)

[↑ Índice](#indice)

---

<a id="h-49"></a>

### H-49 — Cliente consolidado, separado do processo do cliente

> ✅ **CONCLUÍDA em 31/08/2026.** **30 testes próprios** em dez arquivos — quatro
> de domínio, três de rota, um de estado e dois de interface. Suíte total de
> **1400 para 1430**, com três casos existentes ajustados: os dois que fixam
> lista de chaves de contrato e o que conta os controles da barra. Oito
> divergências no protocolo, três levadas ao usuário.
>
> **Faltava o campo que carrega o rótulo, e sem ele o objetivo não fechava.**
> `clientKey` normalizado agrupa, mas não rotula: `optionsOf`, `groupCount` e
> `leadTimeByGroup` rotulam pela primeira grafia da célula, e o grupo de 304
> processos apareceria com a referência de um processo no lugar do nome do
> cliente. Nasceu `clientLabel`, e com ele a regra que `resolveClient` sozinho
> não dá: sem regra que case, o rótulo é a **grafia da célula**, nunca a chave
> normalizada que a função devolve — `zeta comércio` não vira `ZETA COMERCIO`
> (A-26).
>
> **`src/http/routes/indicators.ts` não estava na lista, e é onde o defeito da
> história mora.** IND-10, IND-18 e a quebra de IND-22 por cliente agrupam por
> `clientKey`: a consolidação chegaria sozinha à chave e deixaria o rótulo para
> trás. A lista descrevia a fiação do filtro e esquecia os dois indicadores que o
> `docs/uso/RESULTADO.md` §2 cita como motivo da história.
>
> **O par antigo manteve o nome, contra a letra do plano.** `clientProcessRaw`
> não nasceu: `clientRaw` já *é* ele, e é chave de `EDITABLE_FIELDS` (coluna B) e
> o nome gravado em `data/pending-edits.jsonl` na máquina do operador. Renomear
> faria `isEditableField('clientRaw')` devolver `false` e o write-guard recusar a
> fila **inteira** — o modo de falha que a fatia de `H-27` pegou. Nasceram só
> `clientProcessKey` e `clientLabel`; o DTO expõe `client` (consolidado) e
> `clientProcess` (célula).
>
> **A projeção precisava do mapa tanto quanto a ingestão**, e isso não estava em
> critério nenhum. `applyEdits` refaz o processo por `buildProcesses`: sem
> `clientMap` em `BuildDeps`, editar **qualquer** campo devolveria o processo à
> chave da célula, em silêncio — o cliente consolidado sumiria da tela sem
> ninguém pedir. `BuildDeps` ganhou o campo opcional, e os três pontos do store
> passam a injetá-lo, `rebuildProcesses` inclusive: a comparação da escrita
> precisa descrever o disco com os mesmos mapas da leitura.
>
> **O filtro passou de onze para doze**, e o número estava escrito em nove
> lugares — RF-17, o §1.1 do contrato e sete comentários de código. Cliente
> consolidado e processo do cliente são controles distintos porque são perguntas
> distintas; acumular as duas no mesmo parâmetro faria o recorte da carteira
> mudar de resposta.
>
> **Medido contra a planilha real, e os cinco números do critério bateram
> exatos:** 649 processos, **509** valores distintos em CLT, **124** chaves
> consolidadas — **466** processos em **11** clientes declarados e **183**
> intactos, dos quais 38 de célula vazia. Rótulo: 466 de 466 com o `label` do
> mapa, 183 de 183 com a grafia da célula. O recorte por chave consolidada bate
> com o ranking nos **11** grupos, sem uma divergência.
>
> **A primeira medição errou, e o erro era da métrica.** Contar consolidação por
> `clientKey !== clientProcessKey` deu 393 processos em 9 clientes: dois clientes
> do mapa têm `key` igual à chave da célula que casam, e a comparação os
> classificava como intactos. A fonte é o `mapped` de `resolveClient` — 393 + 73
> = 466, 9 + 2 = 11. Nenhum defeito de código; um defeito de régua, do tipo que
> teria virado número errado em três documentos.
>
> **O ranking de clientes deixou de ter um buraco no topo.** Medido antes:
> `(sem valor)` era o maior grupo, com 38. Agora o topo tem **304** processos —
> 47% da base num cliente só —, e `(sem valor)` cai para a terceira posição, com
> os mesmos 38. A quebra de IND-22 por cliente sai de 509 grupos para **124**,
> dos quais 18 têm amostra e 106 não.
>
> **A guarda de âncora morta reprovou o CI, e o portão local não a reproduz.**
> `src/domain/types.ts` citava `config/client-map.json`; o arquivo está no
> `.gitignore`, então existe na máquina de quem já o configurou e **não** no
> checkout limpo do CI. `H-48` aprendeu isso e o cabeçalho da própria guarda o
> documenta — o comentário nomeia o arquivo **sem** o prefixo de diretório. A
> lição que faltava é outra: `npm run verify` verde não é prova de CI verde
> quando a asserção depende de arquivo não versionado.
>
> **A pendência que `H-48` deixou aqui não vira campo.** Dois clientes menores
> que "também respondem a um terceiro, mas mantendo separado" continuam clientes
> irmãos: hierarquia exige uma pergunta que nenhuma tela faz hoje, e acrescentar
> `parent` agora seria projetar consumo antes de ele existir — o mesmo argumento
> que adiou a decisão de `H-48` para cá. Quando existir ranking por grupo
> econômico, é história própria.

**Objetivo:** o campo Cliente responder "quem é o cliente" em vez de "qual o
processo dele", sem perder o valor da célula.

> **Medido: 649 processos produzem 509 valores distintos em CLT** — o campo
> guarda a referência do processo daquele cliente, não o cliente
> (`docs/uso/RESULTADO.md §2`). O ranking de clientes (IND-10) e a quebra de
> tempo documental por cliente (IND-22) contam processos e chamam o resultado
> de cliente; a Página Clientes apresenta isso como distribuição de carteira.
>
> **O antigo não é descartado, é renomeado.** Ele continua sendo a única forma
> de achar um processo específico na Operacional, e sumir com ele trocaria um
> defeito por outro.

**Arquivos:**
- `src/domain/types.ts` — `clientProcessRaw` e `clientProcessKey` nascem;
  `clientKey` passa a ser o consolidado
- `src/domain/process-builder.ts` — aplica o mapa na composição
- `src/domain/filters.ts` — o filtro novo e o rótulo do antigo
- `src/http/routes/filter-options.ts` — a opção nova
- `src/http/routes/processes.ts` — projeção
- `src/domain/process-projection.ts`
- `src/app/process-store.ts` — injeção do mapa
- `web/src/components/FilterBar.tsx` — o controle novo
- `web/src/pages/ProcessDetail.tsx` — os dois campos lado a lado
- `web/src/components/ProcessTable.tsx`
- `docs/05-contratos-api.md`, `docs/03-modelo-dados.md` — TD-04 ganha a etapa
- os testes correspondentes em `tests/domain/`, `tests/http/` e `web/tests/`

**Critérios de aceite:**
- **Dado** o mapa real do operador, **quando** os 649 processos são compostos,
  **então** `clientKey` produz **124 chaves** em vez de 509: **466 processos
  consolidados em 11 clientes**, e **183 permanecem com a chave da célula** —
  medido em `H-48`, contra a planilha real. Não consolidar não é erro, é a
  decisão registrada em `docs/uso/RESULTADO.md §2`, e vale para dois conjuntos
  distintos: 62 processos de um prefixo que cobre três clientes, e 121 ainda sem
  regra declarada.
- **Dado** um processo cuja célula CLT vale `X-29`, **então** `clientProcessRaw`
  vale `X-29` e `clientKey` vale a chave consolidada — os dois presentes na
  mesma resposta, nunca um derivado no cliente (regra inviolável 6).
- **Dado** `GET /api/filters/options`, **então** a resposta traz `clients` já
  consolidados **e** `clientProcesses` com os valores de célula, cada um com a
  própria contagem.
- **Dado** `?client=<chave consolidada>`, **então** o recorte inclui todos os
  processos daquele cliente, e a contagem bate com o ranking.
- **Dado** mapa ausente, **então** `clientKey` é idêntico ao de hoje e a
  aplicação se comporta como antes desta história.

**Casos-limite:**
- Prefixo que corresponde a mais de um cliente — medido: um prefixo de 62
  processos cobre três clientes, distinguíveis só pelo importador
  (`docs/uso/RESULTADO.md §2`) → a regra do mapa aceita qualificar por
  importador; sem qualificação, o grupo permanece como está.
- Célula vazia → nenhuma regra casa; `clientKey` e `clientProcessKey` ficam
  vazios, e os 38 processos seguem filtráveis pela chave vazia.
- Valor que casa duas regras → a primeira do arquivo vence (`H-48`).
- Rótulo exibido: para o consolidado é o `label` do mapa; para os não cobertos
  segue a primeira grafia encontrada (A-26).

**Fora desta história:** o responsável — é `H-50`, e as duas tocam
`process-builder.ts`. Ordem sugerida: esta primeiro, porque o campo dela é
lido pelo desempate daquela.

**Dependências:** `H-48`.
**Tamanho:** M (13 arquivos, contrato de duas rotas alterado)

[↑ Índice](#indice)

---

<a id="h-50"></a>

### H-50 — Responsável pelo importador, com a cor desempatando

> ✅ **CONCLUÍDA em 01/09/2026.** **29 testes próprios** em oito arquivos — três
> de domínio, três de rota, um de estado e um de interface. Suíte total de
> **1616 para 1645**, com seis casos existentes ajustados: os dois que fixam
> lista de chaves de contrato, os dois de A-18 que migraram de campo, o de mapa
> vazio em `resolveTeam` e o do domínio fechado em `parseFilters`. **Os três
> números do primeiro critério de aceite bateram exatamente** contra a planilha
> real: **559** pelo importador, **48** pelo desempate da cor, **42** sem
> responsável, com **zero** divergências entre as duas fontes — o mesmo que
> `H-48` mediu, agora pelo caminho que a aplicação percorre.
>
> **O documento de origem afirmava 157, e o número é 165.** O objetivo desta
> história dizia "cobrir as 649 em vez de 157", copiado de
> `docs/uso/RESULTADO.md §3`. A medição de 01/09/2026 deu `colaborador1` 120 ·
> `colaborador2` 36 · `colaborador1_outros_clientes` 9 · `indefinido` 484 —
> **165 preenchidos**, e a tabela do próprio §3 sempre somou 165 (36+72+9+13+35),
> como TD-05 desde `H-01`. Erro de aritmética no texto, não de medição, e
> **nenhuma conclusão dele muda**. Corrigido em `docs/uso/RESULTADO.md`, em
> TD-05 e em `D-23`, que o repetia de segunda mão. Achado documentado, não
> correção silenciosa (regra inviolável 1).
>
> **Quatro divergências de fiação, todas resolvidas.** (1) O 2º critério pede
> que a divergência importador↔cor "vire anomalia registrada" e nenhum
> `AnomalyCode` servia: nasceu `RESPONSAVEL_DIVERGENTE`, com o texto citando as
> duas chaves impessoais. (2) `src/http/server.ts` não estava na lista, e as
> duas rotas passaram a precisar do mapa de equipe para A-28 — parâmetro extra,
> pelo precedente de `clientGroups`; descartado expor `teamMembers` em
> `StoreState`, que viaja no health. (3) `ColorTarget.responsible` **não** foi
> renomeado: ele descreve a cor a gravar, e renomeá-lo mudaria uma **quarta**
> rota (`PATCH .../color`) e `config/color-map.json` — só o tipo virou
> `ColorResponsible`, e nenhum `fillId` mudou. (4) **`colorResponsible` teve de
> entrar no `ProcessDto`**, contra o que a fatia planejara: `ProcessDetail`
> monta o `ColorTarget` atual a partir do processo, e sem o campo passaria a
> chave da **pessoa** como se fosse cor — o menu marcaria a opção errada. Quem
> pegou foi o `typecheck`, e o teste que fixa isso está em
> `web/tests/ProcessDetail.test.tsx`.
>
> **As quatro guardas novas foram provadas por mutação:** remover a anomalia de
> divergência, remover a queda para a cor sem mapa (`D-23`), derivar
> `knownResponsibles` dos processos em vez do mapa, e tirar a agregação de A-18
> do filtro de cor — cada uma reprova exatamente os testes que a cobrem, e
> nenhuma passa despercebida.
>
> **A ressalva de A-31 na Página Performance fica errada até `H-66`.** Ela diz
> "o responsável vem da cor da linha, e linha vermelha ou verde não o carrega",
> e a partir daqui isso é falso. Reescrevê-la aqui era o que `D-24` cortou para
> `H-66`, e o intervalo é de um PR.
>
> **Fora do que o backlog previa, e deliberado:** `responsible` deixou de ser
> editável por rota nenhuma — ele deriva do mapa, e mudá-lo é editar o mapa. O
> filtro dele passou de fechado a aberto, então `?responsible=xyz` devolve
> conjunto vazio com `200` em vez de `400 FILTRO_INVALIDO`; `colorResponsible`
> herdou a validação.

**Objetivo:** o campo Responsável cobrir as 649 linhas em vez de 165, e nomear
quem de fato responde pelo processo.

> **O achado que dispensou a decisão arbitrária.** A cor e a lista de
> importadores do operador **concordam nas 649 linhas**: roxo ocorre
> exclusivamente em importador de uma pessoa, azul e bege exclusivamente em
> importador da outra, e não há uma única contradição
> (`docs/uso/RESULTADO.md §3`). Por isso os 90 processos que a lista de
> importadores não alcança — 55 num importador sem regra declarada e 35 com o
> campo em branco — **não precisam de escolha**: os 48 que têm cor de
> responsável recebem o que a cor já afirma, e os 42 restantes ficam sem
> responsável, visíveis.
>
> **A cor não é descartada, vira campo próprio.** O que ela codifica hoje passa
> a se chamar `colorResponsible`, com filtro próprio, porque é informação
> diferente: uma diz quem responde, a outra diz o que o operador pintou.

**Arquivos:**
- `src/domain/types.ts` — `Responsible` deixa de ser o domínio da cor;
  `ColorResponsible` assume as quatro chaves atuais
- `src/domain/team-mapper.ts` — a atribuição e o desempate (de `H-48`)
- `src/domain/process-builder.ts`
- `src/domain/filters.ts` — dois filtros, e `matchesResponsible` migra
- `src/domain/indicators.ts` — IND-20 e a quebra de IND-22 por responsável
- `src/http/routes/indicators.ts`, `filter-options.ts`, `processes.ts`
- `src/app/process-store.ts`
- `web/src/pages/ProcessDetail.tsx` — obrigado pelo `typecheck`, porque o
  domínio de `Responsible` deixa de ser fechado
- `docs/05-contratos-api.md`, `docs/03-modelo-dados.md` (TD-05)
- os testes correspondentes

**Critérios de aceite:**
- **Dado** o mapa real, **quando** os 649 processos são compostos, **então**
  a atribuição por importador cobre **559**, o desempate pela cor cobre mais
  **48**, e **42** ficam sem responsável — os três números aparecem no ranking,
  incluindo o último (A-28: chave zerada não se esconde).
- **Dado** um processo cujo importador está na lista de uma pessoa **e** cuja
  cor aponta a outra, **então** a divergência vira anomalia registrada, e a
  atribuição segue o importador. Medido: **zero ocorrências** hoje, e é
  exatamente por isso que a regra precisa existir antes da primeira.
- **Dado** `A-18`, **então** a subcategoria de cor continua sendo selecionada
  junto com a principal **no filtro de `colorResponsible`** — a regra migra com
  o campo, não desaparece. O controle na barra é `H-66`; aqui a
  regra migra no domínio e na rota de opções.
- **Dado** a quebra de tempo documental por responsável na Página Performance,
  **então** ela deixa de ser dominada por `indefinido` — por efeito do campo,
  sem trabalho de tela. **A ressalva de A-31 é `H-66`**, e com ela o quinto
  critério de `H-53`.
- **Dado** mapa de equipe ausente — arquivo inexistente ou sem membros —,
  **então** `responsible` recebe a chave de cor da linha e a resolução declara
  `source: 'cor'`: o campo mostra o que mostra hoje, **165** preenchidos, e o
  domínio é a união das chaves de membro com as de cor, habitada só neste
  estado (`D-23`).

**Casos-limite:**
- Importador com sufixo de filial — medido: três importadores aparecem também
  com sufixo (`docs/uso/RESULTADO.md §3`) → a regra casa o importador base, e o
  sufixo não cria pessoa nova.
- Importador em branco **e** sem cor de responsável → sem responsável, contado.
- Pessoa declarada no mapa sem nenhum processo → aparece no ranking com zero,
  pela mesma razão de A-28.
- Uma pessoa marcada como destino do "todo o resto" → é regra do mapa, não do
  código; duas pessoas marcadas assim é erro de carga (`H-48`).
- Mapa ausente **e** filtro Responsável em uso → a agregação de A-18 migrou
  para `colorResponsible`, então `colaborador1` deixa de trazer
  `colaborador1_outros_clientes` enquanto não houver mapa. Consequência
  declarada de `D-23`, não defeito.

**Fora desta história:** o controle do filtro `colorResponsible` na barra e a
ressalva de A-31 na Página Performance — são `H-66`. E trocar o significado das
cores na escrita: `H-27` continua gravando o que grava, e o `fillId` de cada
combinação não muda.

> **A história é G, e o rótulo é deliberado.** Ela declarava `M (15 arquivos,
> contrato de três rotas alterado)` desde que nasceu, e isso é G pela régua do
> topo deste arquivo. `H-66` tira dela os três de tela e a deixa em 12 —
> **ainda acima do teto**. Os cortes que a fariam caber em `M` foram tentados e
> custam mais do que economizam: separar o campo do indicador é impossível,
> porque IND-20 e IND-22 leem `process.responsible` e mudam junto; e fatiar o
> domínio antes das rotas deixaria um intervalo com o Responsável fora da tela,
> entre dois PRs, ou com o campo duplicado no contrato. **É a primeira G do
> backlog**, e a régua está fazendo o trabalho dela: avisar que a fatia é longa,
> não forçar um corte pior (`D-24`).

**Dependências:** `H-48`. Convive com `H-49`, que toca os mesmos três arquivos
de composição. O quinto critério está decidido em `D-23`.
**Tamanho:** G (12 arquivos, contrato de três rotas alterado)

[↑ Índice](#indice)

---

<a id="h-51"></a>

### H-51 — Canal verde, e a distribuição à vista

> ✅ **CONCLUÍDA em 31/08/2026.** **20 testes próprios** em seis arquivos —
> sete de domínio, quatro na rota de indicadores, dois nas opções de filtro, dois
> no `history-store`, um em `color-mapper` e quatro na Página Inicial. Suíte
> total de **1474 para 1494**. Nenhuma asserção foi afrouxada: os casos
> existentes que mudaram de texto mudaram porque o domínio mudou sob eles — o
> valor `nenhum` deixou de existir —, e o único que trocou de sinal, a exclusão
> do branco dos alvos graváveis, ganhou em troca a asserção positiva com o
> `fillId` medido. Conferido contra a planilha real: **verde 477 ·
> vermelho 5 · indefinido 167**, somando as 649, denominador **482**, e IND-06
> intacto em **5** — os quatro números do critério de aceite, medidos e não
> derivados. Três divergências no protocolo, todas resolvidas.
>
> **O valor `nenhum` saiu do domínio inteiro, e não só das linhas verdes.** O
> critério de aceite fixa `indefinido = 167`, e 167 é a soma de tudo que não é
> verde nem vermelho — azul, roxo, bege, amarelo e branco. A cor é um canal de
> informação único disputado por três significados: uma linha azul diz
> responsável, e por isso **não** diz canal. `nenhum` afirmava saber que não
> houve canal.
>
> **Divergência 1 — dois consumidores fora da lista de arquivos.**
> `web/src/pages/ProcessDetail.tsx` e `web/src/components/ColorFieldsForm.tsx`
> têm cada um a sua tabela de rótulos de canal, com o literal `nenhum`. A lista
> da história previa `filters.ts` e mais nada; trocar o tipo exportado alcança
> todo consumidor, que é exatamente a pergunta que o protocolo de fatia manda
> fazer.
>
> **Divergência 2 — o branco virou o sétimo alvo gravável, sem ninguém pedir.**
> `representableTargets` colapsa entradas pela tupla
> `responsible|customsChannel|importerOutsideRj`, e o branco compartilhava
> `indefinido|nenhum|false` com os dois verdes. Com o verde declarando canal, os
> dois deixaram de coincidir e o branco passou a ser oferecido no seletor de cor,
> gravando `fillId` 13 — o branco do tema, rotulado pelo que é. **Nenhum `fillId`
> já alcançável mudou**, que é o que o critério de aceite exige. É consequência
> aritmética dos números da história, não escolha: o teste que afirmava a
> exclusão do branco virou teste afirmando a inclusão, com o `fillId` medido.
>
> **Divergência 3 — o histórico gravado, que é append-only e não estava na
> lista.** `src/io/history-store.ts` duplicava o domínio numa lista literal, e o
> arquivo do operador tem `channel: "nenhum"` em toda linha já escrita. Recusá-lo
> como valor fora do domínio esvaziaria o índice, e **cada REF voltaria a ser
> visto pela primeira vez** — o que reiniciaria `categoryChangedAt` em todos e
> desarmaria ALE-06, o alerta de processos parados, justamente no dia da
> mudança. A leitura passa a traduzir o valor legado para `indefinido`; nada é
> gravado com ele. Efeito medido em três pontos: a série mensal não o vê, porque
> cada ponto dela é o **estado ao fim do mês** e não a contagem de eventos; a
> tela de detalhe já filtra evento com `from` igual a `to`; e `nextSeen` só move
> `categoryChangedAt` quando a categoria muda. Sobram as 477 linhas verdes, que
> geram um evento cada — invisível nas três superfícies.
>
> **A distribuição é bloco próprio na resposta, e não campo em `counts`.**
> `counts` é a lista dos indicadores do catálogo, e `counts.canalVermelho` —
> IND-06 — continua lá com o mesmo valor: a história acompanha o indicador, não
> o redefine. As duas frações vêm resolvidas do servidor porque `null` com
> denominador zero é regra de dado (A-42), não formatação; deixar a tela dividir
> produziria `0%` no primeiro recorte vazio, afirmando que nenhum processo é
> verde.

**Objetivo:** o canal deixar de ser um campo binário sobre 5 linhas e passar a
descrever as 482 que a cor de fato classifica.

> **Medido: 477 verdes, 5 vermelhas, 1 amarela e 166 sem cor de canal**
> (`docs/uso/RESULTADO.md §4`). O mapa hoje registra `nenhum` para as 166, o que
> **afirma** que não houve canal — quando a verdade é que a cor daquela linha
> está ocupada dizendo outra coisa. É a regra inviolável 3 aplicada ao próprio
> mapa de cores.
>
> **O amarelo não vira canal amarelo.** Decisão do operador em 31/08/2026, com
> a alternativa à vista: ele mantém o significado de D-02 e A-38. Um canal
> amarelo que não existe no dado seria coluna vazia prometendo informação.

**Arquivos:**
- `src/domain/types.ts` — `CustomsChannel` ganha `verde`
- `config/color-map.json` — as nove entradas revistas
- `src/app/color-map-loader.ts` — o domínio validado
- `src/domain/indicators.ts` — a distribuição, ao lado de IND-06
- `src/http/routes/indicators.ts`, `filter-options.ts`
- `src/domain/filters.ts` — `CHANNEL_LABELS`
- `web/src/pages/Home.tsx` — o painel de distribuição
- `docs/03-modelo-dados.md` (TD-05), `docs/05-contratos-api.md`
- os testes correspondentes

**Critérios de aceite:**
- **Dado** a planilha real, **então** `verde` = 477, `vermelho` = 5 e
  `indefinido` = 167 — e a soma é 649, verificada em teste.
- **Dado** o painel da Página Inicial, **então** ele exibe contagem **e**
  percentual, com o denominador escrito ao lado: o percentual é sobre as **482**
  com canal conhecido, e as 167 restantes aparecem contadas fora do percentual
  (A-42 — fração de conjunto vazio não é zero, e denominador não sai do lado da
  fração).
- **Dado** a linha amarela, **então** seu canal é `indefinido` e
  `importerOutsideRj` permanece `true`.
- **Dado** IND-06, **então** ele continua contando só o vermelho e seu valor não
  muda — o indicador existente não é redefinido por esta história.
- **Dado** `PATCH .../color`, **então** as combinações graváveis continuam
  resolvendo para o mesmo `fillId` de hoje.

**Casos-limite:**
- Cor não mapeada → `indefinido`, como hoje, e entra na quarentena. Não saber a
  cor e saber que a cor não diz canal produzem o mesmo valor, e a distinção
  vive na quarentena, não no campo.
- Denominador zero (nenhum processo com canal conhecido no recorte) → o painel
  mostra as contagens e omite o percentual, nunca `0%`.
- Filtro `channel=nenhum` em URL salva antes desta história → o valor sai do
  domínio e a rota responde `400 FILTRO_INVALIDO`, que é o comportamento
  correto; a barra de filtros não oferece mais a opção.

**Fora desta história:** canal amarelo, e qualquer mudança no significado do
verde para status — a categoria continua vindo de TD-01 (regra inviolável 4).

**Dependências:** nenhuma.
**Tamanho:** M (10 arquivos, contrato de duas rotas alterado)

[↑ Índice](#indice)

---

<a id="h-52"></a>

### H-52 — Os cartões declaram o período, e ele é editável ali

> ✅ **CONCLUÍDA em 31/08/2026.** **32 testes próprios** em quatro arquivos — 15
> de domínio, 6 na rota, 4 no `useFilters` e 7 na Página Inicial. Suíte total de
> **1494 para 1526**. Os cinco casos existentes que mudaram são contagens de
> cartão — de doze para treze —, não asserções afrouxadas. Duas divergências no
> protocolo, ambas resolvidas.
>
> **Conferido contra a planilha real**, e os quatro números do critério de aceite
> bateram: `ETA2` de **30/12/2025 a 09/09/2026**, `RG` de **05/01/2026 a
> 31/07/2026**, **64** dos 649 sem `ETA2` e **166** sem `RG`. Sem janela,
> `desembaracadosNoPeriodo` é **480** — igual a `desembaracados`, porque todos os
> 480 da categoria têm data de registro; em fevereiro, **58**.
>
> **A janela incide sobre o conjunto já filtrado, e não sobre a base.** O texto
> da história — "quantos desembaraçamos desde fevereiro" — admitia duas leituras:
> aplicar a janela sobre `registrationDate` **ignorando** o filtro de `ETA2`, ou
> sobre o recorte que a página inteira já usa. **RF-18 decide**: todo indicador
> desta rota responde sobre o conjunto filtrado, e um cartão que ignorasse um
> filtro global visível na barra exibiria um número que a tela não explica. Sem
> filtro de período — o estado do critério de aceite — as duas leituras
> coincidem. O rótulo do cartão diz qual data ele conta, e a linha de período diz
> qual janela.
>
> **`meta.dataRange` traz `missing`, e não só os extremos.** Data ausente não está
> dentro nem fora de janela nenhuma (A-20): esses processos somem de qualquer
> recorte por período, e sumir sem contagem seria descarte silencioso. `from` e
> `to` são `null` quando o conjunto não tem a data, e a tela diz "sem data" —
> nunca uma faixa inventada.
>
> **Divergência 1 — a rota precisava da janela, e `filteredProcesses` não a
> devolve.** Nasceu `filteredWithPeriod` em `src/http/filter-request.ts`, arquivo
> fora da lista. Ao lado do existente, e não no lugar dele: alargar aquele
> alcançaria as seis rotas **[F]**, e cinco não têm uso para a janela; reparsear
> a query dentro da rota duplicaria o tratamento de `400 FILTRO_INVALIDO` que o
> módulo existe para concentrar.
>
> **Divergência 2 — `web/tests/FilterBar.test.tsx` e `web/tests/support/api-stub.ts`.**
> A fábrica de `Filters` do primeiro e a fixture de `IndicatorsResponse` do
> segundo quebraram no `typecheck` ao ganharem campo obrigatório. É o modo de
> falha que `H-32` já tinha medido, e que a conferência da fatia pergunta.
>
> **`setPeriod` escreve os dois extremos numa chamada só**, e não é conveniência:
> duas chamadas a `setRange` derivariam o rascunho da **mesma** leitura de
> `query`, e a segunda perderia a primeira. O seletor da página escreve nos
> mesmos `etaFrom`/`etaTo` da barra de filtros — um estado só, na URL.

**Objetivo:** cada cartão da Página Inicial dizer que janela está contando, e a
janela poder ser mudada sem ir à barra de filtros.

> **Doze números sem janela à vista.** O período existe — é o filtro global
> sobre `ETA2` (RF-17) — mas vive noutra região da tela, e um cartão zerado por
> recorte é indistinguível de um cartão zerado por ausência de dado.
>
> **Duas datas respondem a duas perguntas.** "Quantos chegaram desde fevereiro"
> é `ETA2`; "quantos desembaraçamos desde fevereiro" é `registrationDate`. O
> cartão de desembaraçados responde a primeira e é lido como a segunda
> (`docs/uso/RESULTADO.md §5`).
>
> **O cartão novo é adicional, não substituto**, e é o que preserva A-12: a soma
> das quatro categorias continua fechando com o total, e a conferência que a
> página exibe continua válida.

**Arquivos:**
- `src/domain/indicators.ts` — a contagem por data de registro e a faixa dos dados
- `src/http/routes/indicators.ts` — os dois blocos novos em `meta`
- `web/src/pages/Home.tsx` — a janela em cada cartão e o seletor
- `web/src/components/StatCard.tsx` — a linha de período
- `web/src/hooks/useFilters.ts` — o atalho de período
- `docs/05-contratos-api.md`
- os testes correspondentes

**Critérios de aceite:**
- **Dado** nenhum filtro de período, **então** cada cartão declara a faixa
  **real dos dados** para a data que ele usa — medido em 31/08/2026: `ETA2` de
  30/12/2025 a 09/09/2026, `RG` de 05/01/2026 a 31/07/2026
  (`docs/uso/RESULTADO.md §5`). A faixa vem do servidor: derivá-la no cliente
  seria cálculo na tela.
- **Dado** o seletor de período na Página Inicial, **quando** o operador o
  altera, **então** ele escreve nos **mesmos** parâmetros `etaFrom`/`etaTo` da
  barra de filtros — um estado só, nunca dois períodos que divergem.
- **Dado** o cartão "Desembaraçados no período", **então** ele conta por
  `registrationDate` dentro da janela, e o cartão diz isso no próprio rótulo.
- **Dado** os quatro cartões de categoria, **então** a soma continua igual ao
  total e a linha de conferência de A-12 segue presente.
- **Dado** um recorte sem nenhum processo, **então** o cartão exibe zero **com**
  a janela ao lado — que é exatamente o que hoje falta para distinguir os dois
  zeros.

**Casos-limite:**
- Processo sem `ETA2` (64 de 649) → fora de qualquer janela, e o cartão de total
  diz quantos ficaram fora. Data ausente não está dentro nem fora (A-20), e
  omitir a contagem seria descarte silencioso.
- `etaFrom` posterior a `etaTo` → conjunto vazio sem erro, como hoje.
- Janela que não cobre nenhum RG → o cartão novo mostra zero com a janela ao
  lado, nunca traço: zero medido é diferente de não medido.
- Base sem nenhuma data preenchida → a faixa é nula e o cartão diz "sem data",
  não uma faixa inventada.

**Fora desta história:** as outras seis páginas. O período segue global e
continua valendo para todas; o que nasce aqui é a **declaração** dele, e o
atalho, na Inicial.

**Dependências:** nenhuma.
**Tamanho:** M (7 arquivos, contrato de uma rota alterado)

[↑ Índice](#indice)

---

<a id="h-53"></a>

### H-53 — A Página Performance diz a métrica e mostra o recorte

> ✅ **CONCLUÍDA em 31/08/2026, com o quinto critério declarado não-incidente.**
> **8 testes próprios** em `web/tests/Performance.test.tsx`. Suíte total de
> **1548 para 1556**. Nenhum caso existente ajustado. Uma divergência no
> protocolo, resolvida.
>
> **O quinto critério não foi cumprido porque a premissa dele é falsa.** Ele diz
> "**Dado** `H-50` fechada, **então** a ressalva de A-31 descreve o campo novo".
> `H-50` **não** foi executada — a Pendência 1 que a travava foi decidida em
> 31/08/2026 (`D-23`), e a Pendência 2 a cortou (`D-24`) —, e a ressalva de
> `A-31` continua descrevendo a limitação que **ainda existe**: o responsável
> vem da cor, e linha verde ou vermelha não o carrega. Reescrevê-la agora
> afirmaria que a limitação acabou. **A linha que sobra é `H-66`**, dois
> parágrafos em `ResponsibleCaveat`, e ela nasceu do corte justamente por ser
> isto: o resto de tela de uma história de servidor.
>
> **Nenhum dos dois defeitos era de cálculo, e é isso que os torna caros.** A
> métrica está correta desde IND-22 e o filtro funciona desde `H-15`; o que
> faltava era a tela dizer. Aplicação certa e muda é a variante mais barata de
> defeito e a mais fácil de deixar aberta para sempre.
>
> **Conferido contra a planilha real:** média de **12,5 dias** sobre amostra de
> **101**, com **547** sem uma das duas datas e **1** com intervalo negativo —
> e 101 + 547 + 1 = **649**, o total. Um recorte que zera a amostra devolve
> `averageDays: null`, nunca zero.
>
> **A fórmula vai junto do agregado, e na ordem de A-02.** `RG − DOCS ENVIADOS`,
> em dias inteiros; a ordem invertida produziria valor negativo, porque RG é a
> extremidade final do intervalo. Nota de rodapé foi descartada pelo próprio
> critério de aceite.
>
> **As duas exclusões de A-30 ganharam o que significam**, não só o número: um
> número sem explicação é descarte que parece medição. E a amostra zerada passou
> a dizer **por que** exibe traço — sem isso o traço parece falha de
> carregamento, e não "nenhum processo do recorte tem o par completo".
>
> **Divergência 1 — os rótulos dos filtros viviam só na barra.** O painel de
> recorte precisa nomear cada filtro ativo, e copiar as onze strings criaria dois
> mapas que divergem no primeiro filtro renomeado. `MULTI_FILTER_LABELS` nasceu
> em `web/src/hooks/useFilters.ts`, ao lado de `MULTI_FILTERS`, e
> `web/src/components/FilterBar.tsx` passou a consumi-lo — os dois arquivos
> estavam fora da lista da história. `clientGroup` entrou no mapa embora não
> tenha caixa própria na barra: ele **tem** nome, e sem ele um recorte por grupo
> apareceria sem dizer o que é.
>
> **Nada passou a ser calculado no cliente.** A fórmula é texto de uma regra do
> domínio, e a lista de filtros ativos é leitura da URL — que já é o único estado
> dos filtros desde `H-15`.

**Objetivo:** a página explicar o que mede e tornar visível o filtro que ela já
respeita.

> **Duas das quatro perguntas do levantamento morrem aqui, e nenhuma delas era
> defeito de cálculo.** O operador perguntou qual é a métrica — está correta
> (IND-22, A-02) — e se dava para filtrar por importador e cliente — dá, desde
> `H-15`, pelos filtros globais (RF-18). A aplicação estava certa e muda; é a
> variante mais barata de defeito, e a mais fácil de deixar aberta para sempre.
>
> **A quebra por responsável fica útil por efeito de `H-50`**, não por trabalho
> desta fatia: com o responsável vindo do importador, ela deixa de ser dominada
> por `indefinido`. O que esta história faz é reescrever a ressalva de A-31, que
> hoje explica uma limitação que terá deixado de existir.

**Arquivos:**
- `web/src/pages/Performance.tsx` — a fórmula, o recorte ativo e a ressalva
- `web/tests/Performance.test.tsx`

**Critérios de aceite:**
- **Dado** a Página Performance, **então** a fórmula do tempo documental aparece
  escrita — a diferença entre as duas datas, na ordem de A-02 — junto do
  agregado, e não em nota de rodapé.
- **Dado** um filtro ativo, **então** a página declara **quais** filtros estão
  recortando os números que ela exibe, sem recalcular nada (regra inviolável 6).
- **Dado** nenhum filtro ativo, **então** a página diz que os números cobrem a
  base inteira, e oferece o caminho para filtrar.
- **Dado** as duas exclusões de A-30, **então** elas continuam contadas e
  visíveis, com a explicação do que cada uma significa.
- **Dado** `H-50` fechada, **então** a ressalva de A-31 descreve o campo novo.
  **O trabalho é `H-66`**, que nasceu do corte de `H-50` e carrega este critério.

**Casos-limite:**
- Amostra de tamanho 1 → a média aparece com a amostra ao lado, como hoje
  (A-42). Explicar a métrica não afrouxa a exibição do denominador.
- Filtro ativo que zera a amostra → traço, nunca zero dia, e a página diz que o
  recorte não tem par completo de datas.
- Texto da fórmula → é apresentação de uma regra do domínio, não a regra: nenhum
  número desta página passa a ser calculado no cliente.

**Fora desta história:** mudar IND-22, e acrescentar dimensão de quebra. A
quinta dimensão possível — por importador — só existiria por `H-49`; se for
desejada, é história própria.

**Dependências:** `H-66` — e, por trás dela, `H-50` —, para o último critério.
Os demais fecham sem as duas.
**Tamanho:** P (2 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-54"></a>

### H-54 — O histórico reconstrói os meses da planilha

> ✅ **CONCLUÍDA em 31/08/2026.** **22 testes próprios** em três arquivos — 10 de
> domínio, 5 na rota e 7 na Página Histórico. Suíte total de **1526 para 1548**.
> Oito casos existentes mudaram de forma, nenhum de força: passaram a servir a
> série reconstruída **vazia**, para continuarem medindo o que o nome deles diz.
> Uma divergência no protocolo, resolvida, e um defeito de acessibilidade que a
> própria fatia criou e fechou.
>
> **Conferido contra a planilha real:** a série cobre **10 meses**, de
> **dez/2025 a set/2026**, com **zero** meses ausentes no intervalo; **64** dos
> 649 sem `ETA2` e **166** sem `RG`; e **18** processos com `ETA2` em set/2026, o
> único mês marcado como previsão. Os quatro números são os que
> `docs/uso/RESULTADO.md` §6 e os casos-limite declaram.
>
> **As duas medidas reconstruídas são estoque ao fim do mês**, e não fluxo. Sem
> isso as séries não seriam comparáveis no mesmo eixo: a observada é estado
> acumulado, e uma contagem mensal ao lado dela pareceria despencar todo mês.
> `chegados` acumula os processos com `ETA2` até o fim do mês; `desembaracados`,
> os com data de registro.
>
> **Não há `canalVermelho` na reconstruída, e a ausência é a regra 3 aplicada.**
> A cor é o estado de **hoje** e não carrega data: projetá-la para trás afirmaria
> que a linha já era vermelha naquele mês. Buraco visível é melhor que valor
> errado invisível.
>
> **A reconstrução não revoga A-43**, e a separação é o que garante isso: bloco
> próprio na resposta, traçado tracejado no gráfico, colunas próprias na tabela,
> e o nome de cada série dizendo "observado" ou "reconstruído". O que A-43 proíbe
> é apresentar reconstrução como histórico observado — não derivá-la.
>
> **`months` não recorta a reconstruída.** A janela é da série observada; cortar
> a outra por ela esconderia justamente o passado que a história existe para
> mostrar. Está declarado no contrato e coberto por teste.
>
> **Divergência 1 — `filteredRefs` devolvia só as chaves.** A reconstrução sai
> das **datas** dos processos, não dos eventos, então precisa das linhas. O
> retorno passou a carregar `selected` junto; `src/http/filter-request.ts` não
> estava na lista de arquivos. Mudança segura porque a função tem um consumidor
> só — a própria rota de histórico, como o cabeçalho dela já declarava.
>
> **O defeito que a fatia criou, e fechou.** Com a reconstruída acompanhando o
> estado vazio de `H-21`, as duas seções passaram a existir ao mesmo tempo com o
> mesmo `aria-label` — **duas landmarks homônimas na mesma página**, e o leitor de
> tela sem como distingui-las. `EmptyHistory` passou a receber `alone`: sozinha
> mantém o nome que `H-21` fixou, acompanhada vira "Histórico observado". Pego
> por um teste que reprovou com "Found multiple elements with the role region".
>
> **`formatMonth` passou a escrever quatro dígitos.** `ago/26` foi lido pelo
> operador como dia 26 de agosto — em pt-br a forma `26/08` é data. Quatro
> dígitos também tornam legível a virada de ano, que a reconstruída atravessa.

**Objetivo:** o gráfico mostrar os meses que a planilha datou, sem passar
reconstrução por observação.

> **Dois defeitos independentes, somados numa leitura errada.** `formatMonth`
> produz `ago/26` para `2026-08`, e em pt-br `26/08` é dia — o operador leu o
> rótulo como uma data. E a série tem um ponto só, porque ela vem dos eventos
> gravados desde a primeira execução (ADR-0005, A-43).
>
> **A planilha tem passado datado:** `registrationDate` cobre sete meses de 2026
> e `ETA2` cobre dez meses a partir de dez/2025 (`docs/uso/RESULTADO.md §6`).
>
> **A reconstrução não revoga A-43.** O que A-43 proíbe é apresentar
> reconstrução como histórico observado. Ela não inventa o estado de cada mês:
> usa as datas que a planilha carrega, diz na tela que é derivação, e as duas
> séries aparecem distintas — nunca somadas, nunca emendadas numa linha só.

**Arquivos:**
- `src/domain/history.ts` — a série reconstruída, ao lado de `aggregateMonthly`
- `src/http/routes/history.ts` — o bloco novo na resposta
- `web/src/pages/History.tsx` — as duas séries, o rótulo e a legenda
- `web/src/hooks/useHistory.ts`
- `docs/05-contratos-api.md`
- `tests/domain/history.test.ts`, `tests/http/history.test.ts`,
  `web/tests/History.test.tsx`

**Critérios de aceite:**
- **Dado** a planilha real, **então** a série reconstruída tem ponto para cada
  mês entre a primeira e a última data presente, e nenhum mês do intervalo fica
  ausente — mês sem processo é ponto em zero, não buraco.
- **Dado** o gráfico, **então** as duas séries são visualmente distintas e a
  legenda diz qual é observada e qual é reconstruída. Emendá-las numa linha só
  afirmaria continuidade que não existe.
- **Dado** `2026-08`, **então** o rótulo é `ago/2026` — no eixo, na tabela e no
  `tooltip`.
- **Dado** um filtro ativo, **então** a ressalva existente continua valendo para
  a série observada, e a reconstruída é recortada pelos mesmos filtros, que
  incidem sobre a leitura de hoje.
- **Dado** histórico gravado vazio, **então** a reconstruída aparece sozinha e a
  tela diz que ainda não há observação — o estado vazio de `H-21` não é
  substituído, é acompanhado.

**Casos-limite:**
- Processo sem nenhuma das duas datas (64 sem `ETA2`, 166 sem `RG`) → fora da
  reconstrução, e a tela diz quantos ficaram fora (regra inviolável 2).
- Mês futuro com `ETA2` — medido: 18 processos em set/2026 → a série vai até o
  último mês datado, e o trecho futuro é marcado como previsão, não realizado.
- Virada de ano na série → o rótulo com quatro dígitos torna a transição legível,
  que é metade do motivo de trocá-lo.
- Reconstrução e observação divergindo no mesmo mês → **as duas aparecem**. A
  divergência é informação sobre a planilha, e escolher uma esconderia o que
  `docs/uso/RESULTADO.md §6` documenta.

**Fora desta história:** retroatividade do arquivo de eventos. Nada é escrito em
`data/history.jsonl` por esta fatia — ADR-0005 continua valendo, e a
reconstrução é derivada a cada leitura, nunca gravada.

**Dependências:** nenhuma.
**Tamanho:** M (8 arquivos, contrato de uma rota alterado)

[↑ Índice](#indice)

---

<a id="h-55"></a>

### H-55 — Grupo de clientes no filtro

> ✅ **CONCLUÍDA em 31/08/2026.** **31 testes próprios** em sete arquivos — dois
> de domínio, um de carga, três de rota e um de interface. Suíte total de
> **1430 para 1461**, com quatro casos existentes ajustados: os três que fixam
> contrato ou retorno de carga, e o que conta os controles da barra.
>
> **A decisão que `H-49` registrou foi revista pelo operador, e a fatia
> registrou a revisão em vez de contradizê-la em silêncio.** Hierarquia deixou
> de ser "campo sem pergunta" no instante em que ele pediu a árvore olhando a
> barra de filtros.
>
> **O grupo NÃO virou `clientKey`, e essa é a história inteira.** Fundir os
> membros entregaria a árvore e mudaria IND-10, IND-18 e IND-22 de quebra; o
> operador escolheu a alternativa que não mexe em número nenhum, e o teste que
> fixa isso é o de `GET /api/indicators`: os membros do grupo aparecem como
> clientes separados no ranking, **e** o grupo funciona como recorte.
>
> **O retorno de `loadClientMap` mudou de lista para `{ clients, groups }`.** A
> validação cruzada obriga: membro que aponta para cliente inexistente só é
> detectável com as duas listas em mãos, e é o erro provável — o operador
> renomeia a chave de um cliente e o grupo passa a apontar para o nada, sem
> sintoma na tela. Três chamadores acompanharam, `tools/carregar-planilha.mjs`
> incluído.
>
> **`buildServer` ganhou o nono parâmetro, com default VAZIO e não a leitura do
> arquivo.** Um default que lesse `client-map.json` faria toda montagem de
> servidor em teste depender do estado real do operador — a regra inviolável 7
> aplicada antes de morder, e a mesma lição de `H-34`.
>
> **Medido contra a planilha real:** o grupo reúne **321** processos — 304 + 15
> + 2 —, o recorte por grupo devolve os mesmos 321, o recorte de um membro
> devolve 15, e as **124** chaves de cliente seguem intactas. No ranking, o topo
> continua com **304** e os membros aparecem em linhas separadas: nenhum
> indicador mudou de valor.
>
> **Um membro pode declarar `label` próprio**, e sem isso a árvore diria
> "Vivi > Vivi" para o cliente que dá nome ao grupo.

**Objetivo:** o filtro Cliente oferecer um nível de agrupamento — marcar o grupo
seleciona todos os membros, e cada membro continua marcável sozinho —, sem que
nenhum indicador mude de valor.

> **A decisão de `H-49` foi revista, e por quem podia revê-la.** Aquela história
> fechou dizendo que hierarquia não viraria campo, porque nenhuma tela a exigia.
> Em 31/08/2026 o operador pediu a árvore no filtro, olhando a barra: o cliente
> de 304 processos precisa abrir em três subdivisões selecionáveis. A pergunta
> passou a existir, e o campo passa a ter razão de ser.
>
> **O grupo vale SÓ no filtro, e isso é decisão registrada.** Ranking (IND-10,
> IND-18) e tempo documental por cliente (IND-22) seguem contando cada membro
> separado. Fundir as chaves mudaria o valor de três indicadores para entregar
> uma árvore de apresentação — e o operador escolheu explicitamente a alternativa
> que não mexe em número nenhum.
>
> **O membro aponta para um cliente que já existe.** Nada de mover regra de
> lugar: `groups` é uma seção irmã de `clients`, e um membro sem entrada
> correspondente é erro de carga — o modo de falha provável é o operador renomear
> a chave de um cliente e o grupo passar a apontar para o nada, sem sintoma na
> tela.

**Arquivos:**
- `src/domain/client-mapper.ts` — `ClientGroup`, `indexClientGroups`,
  `resolveClientGroup`, `normalizeClientGroups`
- `src/domain/types.ts` — `clientGroupKey`
- `src/domain/process-builder.ts` — `BuildDeps.clientGroups`
- `src/domain/filters.ts` — o filtro `clientGroup`, décimo terceiro
- `src/app/client-map-loader.ts` — a seção `groups` e a validação cruzada; o
  retorno passa a ser `{ clients, groups }`
- `src/app/process-store.ts` — indexa uma vez, como o mapa de cor
- `src/http/server.ts` — ponto de injeção dos grupos em `buildServer`
- `src/http/routes/filter-options.ts` — `clientGroups` com a contagem dos dois
  níveis
- `web/src/components/MultiSelect.tsx` — o segundo nível
- `web/src/components/FilterBar.tsx`, `web/src/hooks/useFilters.ts`
- `config/client-map.json.exemplo`
- `docs/05-contratos-api.md`, `docs/03-modelo-dados.md`, `docs/02-requisitos.md`
- os testes correspondentes

**Critérios de aceite:**
- **Dado** o mapa real, **quando** o filtro Cliente é aberto, **então** o grupo
  aparece com a soma dos membros e cada membro aparece indentado com a contagem
  própria — medido: 321 no grupo, 304 · 15 · 2 nos três membros.
- **Dado** o grupo marcado, **então** o recorte traz os processos dos três
  membros, e a contagem bate com a soma exibida.
- **Dado** um membro marcado, **então** o recorte é só dele, por `?client=`.
- **Dado** `GET /api/indicators`, **então** nenhum valor muda em relação a antes
  desta história — o grupo não agrupa indicador.
- **Dado** mapa sem `groups`, **então** o filtro é idêntico ao de `H-49`.

**Casos-limite:**
- Membro que aponta para cliente inexistente em `clients` → erro na carga,
  nomeando o membro e a posição.
- Cliente declarado em dois grupos → erro na carga; um cliente, no máximo um
  grupo.
- Grupo sem processo nenhum → aparece com zero, pela razão de A-28.
- Membro sem `label` → usa o rótulo do cliente; com `label`, o do grupo vence —
  é o que distingue o cliente que dá nome ao grupo do grupo em si.
- Grupo e membro marcados juntos → OU dentro do parâmetro, sem processo repetido.

**Fora desta história:** ranking, tempo documental e cartões, que seguem por
cliente; segundo nível de hierarquia.

**Dependências:** `H-48`, `H-49`.
**Tamanho:** M (14 arquivos, contrato de uma rota alterado)

[↑ Índice](#indice)

---

<a id="h-56"></a>

### H-56 — O ranking de clientes mostra o grupo com a composição

> ✅ **CONCLUÍDA em 31/08/2026.** **13 testes próprios** em três arquivos — um de
> domínio, um de rota e um de interface. Suíte total de **1461 para 1474**, com
> dois casos de `H-55` reescritos: eles fixavam que o grupo não tocava indicador,
> e é exatamente isso que esta história revê.
>
> **O desenho mudou depois de ver a tela, e a barra empilhada foi descartada.**
> A primeira entrega segmentou a barra do grupo e pôs os nomes acima dela; no
> painel real ficou ilegível, porque as proporções são **304 · 15 · 2** — o menor
> componente ocupa **0,6%** da largura, cerca de 4px, e nenhum texto cabe ali. A
> pesquisa de referência convergiu: a orientação corrente é esconder rótulo de
> segmento abaixo de ~5% e agrupar o resto em "Outros", o que apagaria justamente
> os dois componentes que o operador queria ver.
>
> **O desenho final é a árvore indentada:** o grupo é uma linha com o total, cada
> componente é uma linha própria com nome, contagem e mini-barra **na mesma
> escala do ranking** — o que mantém a comparação com os outros clientes válida.
> A hierarquia é estrutural, não visual: os componentes vivem numa `<ul>`
> aninhada, e há teste para isso.
>
> **A soma das barras volta a bater com o total.** O grupo entra no lugar dos
> membros, nunca ao lado deles: exibir os dois níveis contaria os mesmos
> processos duas vezes.
>
> **Medido contra a planilha real:** o topo do ranking passa a ser o grupo com
> **321**, composto de **304 · 15 · 2**; nenhum membro aparece como linha própria;
> e `leadTimeByGroup.clients` segue com os três separados, porque IND-22 não
> entrou na revisão.
>
> **Uma observação que ficou para `H-45`:** o nome acessível de qualquer linha de
> ranking sai grudado — `"Alfa304"` —, e isso vale desde `H-18`, não desta fatia.

**Objetivo:** o gráfico de clientes ter uma barra do grupo, segmentada
proporcionalmente pelos membros e com os nomes deles acima — sem contar nenhum
processo duas vezes.

> **Terceira formulação da mesma pergunta, e a que fecha as duas anteriores.**
> `H-49` decidiu que hierarquia não viraria campo; `H-55` a trouxe **só para o
> filtro**, com o operador escolhendo explicitamente a alternativa que não mexia
> em indicador. Ao ver a tela pronta, ele apontou o que faltava: o grupo existia
> no filtro e não existia no gráfico, e o cliente que dá nome ao maior prefixo
> aparecia rotulado com o nome do grupo. **O pedido registrado é a barra do grupo com os componentes
> nomeados acima dela.**
>
> **Colapsar é o que impede a dupla contagem.** O grupo entra no lugar dos
> membros, e não ao lado deles: exibir os dois níveis somaria 642 barras para 321
> processos. A composição não se perde — ela vira segmento dentro da própria
> barra, que é o que o operador pediu ao dizer "proporcionalmente".
>
> **A revisão é só do ranking de clientes.** IND-22 segue por cliente: lá a
> pergunta é sobre prazo de documento, e agrupar por carteira não a responde.

**Arquivos:**
- `src/domain/indicators.ts` — `groupCountWithGroups` e o campo `segments`
- `src/http/routes/indicators.ts`, `src/http/server.ts` — os grupos chegam à rota
- `web/src/components/RankingBar.tsx` — a barra segmentada e a legenda acima
- `web/src/pages/Clients.tsx` — o clique do grupo e o do componente
- `docs/05-contratos-api.md`, `docs/09-rastreabilidade.md`
- os testes correspondentes

**Critérios de aceite:**
- **Dado** o mapa real, **quando** a Página Clientes carrega, **então** o grupo
  aparece como **uma** barra com 321, segmentada em 304 · 15 · 2, e nenhum membro
  tem barra própria.
- **Dado** o ranking inteiro, **então** a soma das contagens exibidas iguala o
  total de processos do recorte — nenhum processo em duas barras.
- **Dado** um clique na barra do grupo, **então** o recorte é `clientGroup`; num
  nome da legenda, é `client`.
- **Dado** `leadTimeByGroup.clients`, **então** nada muda: os membros seguem
  separados.
- **Dado** mapa sem grupos, **então** o ranking é o de `H-49`.

**Casos-limite:**
- Grupo com um membro só → barra de um segmento, idêntica visualmente à barra
  simples, e a legenda com um nome.
- Membro com contagem zero no recorte → não vira segmento: segmento de largura
  zero é linha invisível, e a legenda mentiria sobre o que a barra mostra.
- Grupo cujo rótulo não está no mapa carregado → usa a própria chave, como
  `resolveClient` faz com cliente não mapeado.
- Corte de `topN` → o grupo ocupa **uma** posição, não três.

**Fora desta história:** IND-22, os cartões, e grupo nos rankings de importador e
mercadoria — grupo é conceito de cliente.

**Dependências:** `H-55`.
**Tamanho:** M (7 arquivos, contrato de uma rota alterado)

[↑ Índice](#indice)

---

<a id="h-66"></a>

### H-66 — O filtro da cor de responsável na tela

> ✅ **CONCLUÍDA em 01/09/2026.** **6 testes próprios** em três arquivos de
> interface. Suíte total de **1645 para 1651**, com dois casos existentes
> ajustados: o que conta os controles da barra e o que fixava o texto da
> ressalva. **Fecha `E10`** e o quinto critério de `H-53`, que era o único
> critério aberto de uma história já concluída.
>
> **Uma divergência de fiação:** `web/src/hooks/useFilters.ts` não estava na
> lista, e é onde `MULTI_FILTERS` e `MULTI_FILTER_LABELS` vivem — o painel de
> recorte de `H-53` é dirigido por eles, então o filtro novo aparece lá de
> graça, com nome próprio. Sem esse arquivo o `typecheck` nem compila.
>
> **Medido num Chrome real**, com `tools/medir-navegador.mjs` sobre a fixture e
> caminhos isolados: os **11** controles de múltipla escolha aparecem na ordem
> declarada, `Responsável` e `Cor do responsável` lado a lado, e o layout **não
> estoura** em nenhum dos quatro viewports — 1280, 1024, 768 e 360 —, nem a 360
> com a fonte-base do navegador em 24 px, o cenário "Muito grande"
> (`scrollWidth == clientWidth` nos cinco). 24 paradas de tabulação.
>
> **A ressalva de A-31 foi invertida, não removida.** Ela dizia "o responsável
> vem da cor da linha, e linha vermelha ou verde não o carrega", e `H-50` tornou
> isso falso. O texto novo diz de onde o campo vem, explica `Sem responsável`, e
> **mantém A-31** — apontando-a para o filtro de cor, que é onde a limitação
> continua real: uma linha vermelha não diz responsável.
>
> **A linha do ranking continua sem virar botão, e o motivo mudou.** O
> impedimento era A-18 — o filtro `colaborador1` arrastava
> `colaborador1_outros_clientes`, e clicar numa linha de 120 caía numa tela de
> 129. Com `H-50` o filtro recorta a pessoa e a contagem bate, então **o
> impedimento acabou**. Torná-la clicável é funcionalidade nova, nenhum critério
> a pede, e fica registrado aqui como possibilidade, não como pendência.

**Objetivo:** o operador recortar por *o que a linha está pintada*, e a Página
Performance dizer qual campo a quebra usa.

> **Nasce do corte de `H-50`**, decidido em 31/08/2026 (`D-24`). `H-50` faz o
> campo mudar de fonte no servidor inteiro e é G; o que sobra de tela cabe em
> **P** e fecha sozinho. O campo `colorResponsible` já existe quando esta começa
> — ela só o expõe.
>
> **Ela fecha o quinto critério de `H-53`**, que ficou declarado não-incidente
> em 31/08/2026 por depender do campo novo. É o único critério aberto de uma
> história já concluída.

**Arquivos:**
- `web/src/components/FilterBar.tsx` — o controle de `colorResponsible`, que
  leva os filtros globais de 13 a 14
- `web/src/pages/Performance.tsx` — a ressalva de A-31 reescrita para descrever
  o campo novo
- os testes correspondentes

**Critérios de aceite:**
- **Dado** a barra de filtros, **quando** ela é montada, **então** há **14**
  controles, e o novo recorta por cor de responsável sem tocar o filtro
  Responsável, que agora recorta por pessoa.
- **Dado** `A-18`, **quando** a cor principal é selecionada no controle novo,
  **então** a subcategoria vem junto — a regra viaja com o campo, e o teste usa
  os valores concretos de TD-05.
- **Dado** a Página Performance, **então** a ressalva de A-31 descreve o campo
  novo em vez da limitação que `H-50` removeu, fechando o quinto critério de
  `H-53`.

**Casos-limite:**
- Nenhum processo com cor de responsável no recorte → o controle aparece com as
  opções vazias, e não some: controle que desaparece esconde que o recorte
  zerou (A-28).
- Os dois filtros ativos ao mesmo tempo, apontando pessoas diferentes →
  interseção, sem tratamento especial: são campos independentes.

**Fora desta história:** o campo, o domínio e as rotas — são `H-50`, e esta não
começa antes dela.

**Dependências:** `H-50`.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="e11"></a>

## Épico E11 — A casca redesenhada

Nasce de `docs/redesign/PROPOSTA.md` (31/08/2026), transcrição versionada do
mockup *Cronos Console*. **Não é auditoria:** `E9` mediu conformidade contra um
corpus e `E10` registrou o que apareceu na tela em uso; este épico executa uma
proposta de desenho, aceita pelo operador em 31/08/2026 e registrada em `D-21` e
`D-22`.

**Nenhum indicador muda de valor, nenhuma rota muda de contrato.** As nove
histórias abaixo tocam `web/src/` e `web/public/`, e nada mais. História deste
épico que precise de campo novo na API está mal fatiada.

**Quatro determinações valem para o épico inteiro e não se re-litigam:**

1. **O modo escuro entra** (`D-21`). O cabeçalho de `E9` diz que introduzir a
   variante é "funcionalidade nova, fora deste épico e fora do plano" — a
   primeira metade segue verdadeira e a segunda deixou de valer. As regras
   `D03`–`D07` do corpus saem da condicionalidade e passam a incidir; as outras
   23 dispensas de `E9` continuam de pé.
2. **O sistema decide o esquema.** `prefers-color-scheme`, sem alternância
   manual — os botões *Claro* / *Escuro* do mockup são moldura da proposta, não
   produto. Consequência direta: `D04` **não** incide, porque a variante `dark:`
   da v4 já resolve para a media query sem `@custom-variant`.
3. **Toda história posterior a `H-57` que acrescentar token de cor declara os
   dois esquemas.** Sem esta regra, `H-51` e qualquer fatia futura nasceriam com
   metade da paleta, e o buraco só apareceria na máquina de quem usa o tema
   escuro.
4. **A fonte-base não é reduzida.** A densidade vem de espaçamento e altura de
   linha; encolher o texto abaixo do que o operador configurou contraria `R03` e
   `SC 1.4.4`, e desfaria `H-46`.

**`E11` vem depois de `E9` e de `E10` inteiros, por dependência de arquivo e não
por gosto.** `H-45` e `H-46` tocam os mesmos 25 arquivos que este épico
reescreve: corrigir acessibilidade sobre a casca antiga e depois redesenhá-la
paga duas vezes, e redesenhar antes faz a casca nova nascer com os defeitos que
`E9` estava fechando. `H-47` é a linha de base — os procedimentos de navegador
precisam ter rodado uma vez no esquema claro antes de o escuro dobrar a
superfície a verificar. E `E10` ainda muda o que três telas **dizem** (`H-52`,
`H-53`, `H-54`): forma assentada sobre conteúdo que ainda se move é retrabalho.

**A medição já reprovou seis pares da paleta proposta**, e três deles são
exatamente os defeitos que `H-39` e `H-40` removeram — `text-muted` volta a
3,35:1 e `border-control` a 1,59:1. Os valores corrigidos estão calculados em
`docs/redesign/PROPOSTA.md §2.2`, e `H-57` nasce com eles, pelo mesmo motivo que
`H-39` nasceu com as três correções dela: substituição que carrega o defeito
junto vira segunda passada pelos mesmos arquivos.

**Duas coisas do mockup não viraram história, e a proposta declara as duas em
aberto:** a busca por `⌘K` — cujo comportamento é decisão à parte — e o detalhe
do processo em painel lado a lado, que mexe no roteador e toca o gatilho de
reavaliação de `D-16`. Nenhuma das duas entra aqui.

**As cinco ondas, pela dependência técnica:**

| Onda | Histórias | Arquivos | Por que vem aqui |
|---|---|---|---|
| 1 | `H-57`, `H-58` | 3 + 3 | Todo componente lê token e herda pilha de fonte. Sem as duas, cada história seguinte declararia valor por conta própria |
| 2 | `H-59`, `H-60` | 7 + 5 | A casca muda de eixo, e o chip de filtro só existe dentro do topo que `H-59` cria |
| 3 | `H-61`, `H-62`, `H-63` | 6 + 6 + 8 | Raio, elevação, densidade e número aplicados **por grupo de arquivo**, todas as propriedades de uma vez — o corte por propriedade abriria cada arquivo quatro vezes |
| 4 | `H-64` | 4 | O movimento anima a forma final; animar antes animaria o que vai deixar de existir |
| 5 | `H-65` | 1 | Verificação no navegador, nos dois esquemas |

---

<a id="h-57"></a>

### H-57 — O par escuro da camada de tema

> ✅ **CONCLUÍDA em 01/09/2026.** **5 testes próprios** em `tests/repo/estilo.test.ts`.
> Suíte total de **1656 para 1661**, sem nenhum caso existente ajustado — e
> **nenhum `.tsx` mudou**, que é o quarto critério de aceite: `git diff` contra a
> branch anterior devolve `web/src/index.css` e o teste, mais nada.
>
> **44 tokens de cor, todos com par**, mais cinco sem par por não serem cor —
> dois raios, duas velocidades e uma curva. Sete tokens nasceram aqui:
> `surface-hover`, `action-soft`, `channel-green-*`, `channel-amber-*`,
> `radius-control`, `radius-container`, `speed-fast`, `speed-base` e
> `--ease-brand`.
>
> **Medido no navegador, e não calculado à mão** (`tools/medir-navegador.mjs`):
> 37 pares de contraste × 2 esquemas = **74 medições, zero reprovações**. Os
> seis valores corrigidos de `PROPOSTA §2.2` bateram exatamente com o previsto —
> `text-muted` 5,06 e 5,04; `border-control` 3,32 e 3,03; `border-strong` 5,06 e
> 5,04 —, e o pior fundo de `text-muted` (`surface-hover`) mede 4,51 e 4,61,
> ambos acima do piso.
>
> **O controle foi rodado, e é o que dá crédito à medição.** Com os
> hexadecimais crus do mockup no lugar dos corrigidos, a mesma medição devolve
> **3,35 · 1,59** no claro e **3,82 · 1,65** no escuro — os quatro números que
> `PROPOSTA §2.2` previu, reproduzidos por um caminho independente do
> documento. Sem esse passo, "zero reprovações" não distinguiria uma paleta boa
> de um medidor quebrado.
>
> **Um achado falso, registrado para não ser reaberto.** A primeira leitura deu
> `body` branco no escuro, com o título a 1,18:1 — e era artefato: `body` e
> `html` são `rgba(0,0,0,0)`, e compor transparente sobre branco devolve branco.
> O título vive dentro de `header.bg-surface-raised`, que mede `rgb(19,21,25)`,
> e o contraste real é 15,44:1. O wrapper `min-h-screen bg-surface-base` cobre a
> viewport; do resto cuida `color-scheme: light dark`, que é para isso que ele
> existe.
>
> **Três divergências de fiação.** (1) `--ease` do mockup virou `--ease-brand`:
> `--ease-*` é namespace do Tailwind, e sem sufixo não gera utilitário nenhum.
> (2) `PROPOSTA §2.1` não declara par escuro para nove tokens que existem desde
> `H-39` — `state-*-border`, `control-disabled-*`, `overlay-scrim`,
> `chart-series-2`, `chart-series-3`, `chart-axis` e `meter-*` —, e o primeiro
> critério exige que **todo** token de cor tenha par: derivei os nove dentro do
> mesmo sistema e medi cada um. (3) `chart-series-2` e `-3` saíram de `#0d9488`
> e `#dc2626` para `#0d7d72` e `#c2261c` no claro: os valores herdados medem
> abaixo de 3:1 contra a superfície nova, que é mais clara que a anterior.
>
> **`state-*-border` não carrega piso de 3:1**, e mede 1,5 a 1,8:1 nos dois
> esquemas. É reforço de contentor, não limite de controle — quem carrega o
> `SC 1.4.11` é `border-control`, pelo mesmo argumento que `PROPOSTA §2.2` usa
> para dispensar `border-subtle`. O painel já se distingue pelo fundo e pelo
> texto, os dois acima de 4,5:1.

**Objetivo:** todo token de cor ter valor nos dois esquemas, com o navegador
escolhendo qual vale, sem que nenhum componente mude de linha.

> **Esta é a `H-39` do épico**, e pela mesma razão: é a única história que decide
> vocabulário e valor. As oito seguintes são substituição mecânica, e só são
> baratas porque esta as antecede.
>
> **Os seis pares reprovados nascem corrigidos.** `docs/redesign/PROPOSTA.md
> §2.2` traz a conta e o candidato de cada um. Adotar o hexadecimal do mockup e
> corrigir depois repetiria o erro que `H-39` evitou.
>
> **O override por esquema exige `@theme static`, não `inline`.** O arquivo já
> está assim desde `H-39`: com `inline`, o utilitário grava o valor em vez de
> referenciar a variável, e a redefinição sob a media query não teria efeito
> nenhum — regra `D05` do corpus.

**Arquivos:**
- `web/src/index.css` — o par por esquema de cada token de cor, os seis valores
  corrigidos, e os tokens novos: `surface-hover`, `action-soft`,
  `channel-green-*`, `channel-amber-*`, `radius-control`, `radius-container`,
  `speed-fast`, `speed-base`, `ease`
- `tests/repo/estilo.test.ts` — a asserção de par completo
- `docs/02-requisitos.md` — RNF-42

**Critérios de aceite:**
- **Dado** `web/src/index.css`, **então** `:root` declara
  `color-scheme: light dark`, e todo token de **cor** tem valor sob
  `@media (prefers-color-scheme: dark)`. Os tokens de raio, velocidade e curva
  não têm par: não são cor.
- **Dado** os seis pares de `PROPOSTA.md §2.2`, **então** cada um mede ao menos
  o piso da sua regra em **ambos** os esquemas — 4,5:1 para texto, 3:1 para
  limite de controle.
- **Dado** `tests/repo/estilo.test.ts`, **então** uma asserção nova reprova
  token de cor declarado em um esquema e ausente no outro, provada por mutação.
- **Dado** `npm run verify`, **então** passa, e nenhum `.tsx` mudou.

**Casos-limite:**
- `state-*-border` **não** é removido: `IngestionHealth` e as três `@utility` o
  consomem, e o mockup não o declarar é consequência de ali a severidade ser
  faixa lateral. Retirá-lo aqui seria mudança de comportamento disfarçada de
  troca de valor.
- `channel-green-*` colide com `H-51`, que também o introduz. Quem chegar
  primeiro declara os dois esquemas; a segunda encontra o token pronto.
- `overlay-scrim` é cor com transparência: o par escuro precisa de valor
  próprio, porque o mesmo `oklch(… / 0.4)` sobre fundo escuro não escurece nada.
- `meter-track` e `meter-fill` são o único canal de comparação entre linhas do
  ranking (`H-40`): a razão entre os dois é medida nos dois esquemas, não só
  contra a superfície.
- Token de raio ou de velocidade duplicado sob a media query → reprova: par por
  esquema é para cor.

**Fora desta história:** qualquer `.tsx`. Nenhum componente muda aqui.

**Dependências:** `H-47`.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-58"></a>

### H-58 — As duas famílias de fonte, servidas do repositório

> ✅ **CONCLUÍDA em 01/09/2026.** **5 testes próprios** em
> `tests/repo/estilo.test.ts`. Suíte total de **1678 para 1683**, sem nenhum
> caso existente ajustado. **Sete arquivos versionados** em
> `web/public/fonts/` — seis `.woff2` e o `LICENSE.txt` —, **347 KB**.
>
> **Ela ficou bloqueada por um dia, e o motivo era ambiental.** `curl` e `wget`
> estão no `deny` de `.claude/settings.json`, a IBM Plex não está instalada
> nesta máquina, e `@fontsource` é dependência que o backlog recusa — não havia
> caminho para obter os binários. **O dono os baixou**, e a história saiu como
> `P`, no tamanho declarado. Contornar a negação por `node -e "fetch(…)"` teria
> funcionado e foi recusado: a negação existe para que nenhuma via de rede passe
> sem portão (`D-19`), e escolher qual respeitar a esvazia.
>
> **Os dois casos-limite já eram verdade, e foram medidos:** o conjunto tem
> **zero** `font-bold` e **zero** `italic`. O teto de 600 e a ausência de
> itálico não custam nada hoje — e declarar só os pesos que existem em arquivo
> evita que o navegador **sintetize** o que falta, engordando o traço.
>
> **Medido no navegador, com a aplicação servindo a build:**
>
> - **zero requisições externas** — todas as `.woff2` saem do próprio origin
> - servidas com `Content-Type: font/woff2` e a assinatura `wOF2` nos quatro
>   primeiros bytes, isto é, o arquivo chega íntegro e não é HTML de erro
> - `document.fonts` reporta as seis faces; o `h1` computa
>   `font-family: "IBM Plex Sans"`
> - a largura de `CronosComex 0123456789` mede **199,87 px** na Plex contra
>   **195,69 px** na reserva — se a fonte não tivesse carregado, as duas seriam
>   iguais
> - `IBM Plex Mono` 500 e 600 ficam `unloaded`, e isso está **certo**: nenhum
>   elemento os usa ainda. O 400 já carrega, porque `Placeholders.tsx` e
>   `WorkbookSetup.tsx` usam `font-mono`. `H-61` a `H-63` acordam os outros dois
>
> **Uma mutação revelou falha na própria guarda, e é o achado desta fatia.**
> Trocar o `url()` local por `fonts.gstatic.com` reprovou — mas **pelo teste
> errado**, o de existência do arquivo. A razão: `interfaceFiles()` só coleta
> `.ts` e `.tsx`, e o `@font-face` mora em `web/src/index.css`. A guarda de
> origem externa **não cobria o CSS**, que é justamente onde um CDN entraria.
> Corrigida, ela passou a reprovar pelos dois.
>
> **O `grep` do primeiro critério devolve uma linha, e ela é prosa.** É o
> comentário de `index.css` explicando que o mockup carrega de
> `fonts.googleapis.com` e o produto não pode. Não é requisição, e a guarda
> distingue: ela exige `https?://`.
>
> **O 200 em `/fonts/NaoExiste.woff2` não é defeito**, e foi conferido com
> controle: `.js` inexistente e rota de SPA devolvem o mesmo. É o catch-all de
> `static.ts`, deliberado — *"o servidor não conhece as rotas do cliente, e não
> deve conhecer"*. O efeito prático está correto: a fonte ausente chega como
> `text/html`, o navegador recusa decodificar, e o `font-display: swap` cai na
> reserva.

**Objetivo:** IBM Plex Sans e IBM Plex Mono disponíveis sem rede, com a pilha
declarada em token e nenhuma requisição externa.

> **O mockup carrega de `fonts.googleapis.com`, e o produto não pode.**
> **RNF-34** proíbe CDN e telemetria, **RNF-31** diz que nenhum dado sai da
> máquina em tempo de execução, e a máquina do operador pode estar sem internet
> — é um dos caminhos infelizes de `PD-06`. Fonte por CDN falharia calada, com a
> tipografia caindo para a pilha do sistema sem erro nenhum.
>
> **Sem dependência npm.** Os `.woff2` entram versionados em
> `web/public/fonts/`, e o `@font-face` é escrito à mão. `@fontsource` resolveria
> o mesmo com uma dependência que o plano não prevê.

**Arquivos:**
- `web/public/fonts/` — os `.woff2` das duas famílias, pesos 400, 500 e 600,
  subconjunto latino
- `web/src/index.css` — `@font-face` das seis faces, `--font-sans` e
  `--font-mono` com pilha de reserva real
- `tests/repo/estilo.test.ts` — a asserção de ausência de origem externa

**Critérios de aceite:**
- **Dado** o conjunto servido, **então** `grep -r 'fonts.googleapis\|fonts.gstatic\|https://' web/src web/index.html` não devolve requisição de fonte.
- **Dado** cada `@font-face`, **então** declara `font-display: swap` e uma pilha
  de reserva que não é `sans-serif` sozinha — a fonte pode não carregar, e o
  fallback é o que o operador vê.
- **Dado** `npm run build`, **então** os `.woff2` saem em `dist/web` e são
  servidos por `GET /*` com o tipo correto — o mesmo defeito que `H-42`
  corrigiu em `H-30`, agora para fonte.
- **Dado** `tests/repo/estilo.test.ts`, **então** reprova origem externa em
  `web/`, provado por mutação.

**Casos-limite:**
- Peso 700 pedido por algum componente → não existe arquivo; o teto de 600 é
  decisão da proposta, e hoje já é verdade (0 `font-bold` medidos em
  31/08/2026).
- Itálico → não entra: nenhuma tela do conjunto usa.
- `font-display: block` → cairia em texto invisível durante a carga, que é
  regressão de percepção sem ganho.
- Licença — IBM Plex é OFL; o arquivo de licença acompanha os `.woff2`, porque
  o repositório vai a público.

**Fora desta história:** aplicar mono a REF, data ou contagem — isso é `H-61` a
`H-63`, arquivo por arquivo. Aqui só as famílias existem.

**Dependências:** nenhuma. Pode rodar em paralelo a `H-57`.
**Tamanho:** P (3 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-59"></a>

### H-59 — Navegação lateral e topo de uma linha

> ✅ **CONCLUÍDA em 01/09/2026.** **6 testes próprios** em `web/tests/App.test.tsx`
> e `tests/repo/estilo.test.ts`. Suíte total de **1661 para 1667**, com quatro
> casos existentes ajustados: o do cabeçalho, os dois de `forced-colors` e o do
> traço.
>
> **Uma faixa horizontal acima do conteúdo, e zero estouro.** Medido em Chrome
> 151 nas **sete rotas × seis larguras** — 320, 360, 768, 1024, 1280 e 1440 px:
> **42 medições, um `<header>` em cada, zero estouros**.
>
> **`router.ts` NÃO foi tocado, e continua em 97 linhas de código.** O backlog
> mandava `NAV_PAGES` ganhar "o que a lateral precisa exibir", e a separação
> entre destino de dado e rodapé é **apresentação**: ela vive em
> `AppSidebar.tsx`. Acrescentá-la ao roteador teria disparado o gatilho de
> `D-16` — três linhas de folga — por causa de um dado que não é de roteamento.
>
> **O defeito que a fatia revelou é preexistente, e foi medido nos dois lados.**
> `lg:grid-cols-[1fr_20rem]` na Página Operacional estourava o documento entre
> 1024 px, onde `lg:` liga, e ~1240 px: `1fr` é `minmax(auto,1fr)`, e o `auto`
> mínimo é a largura intrínseca da tabela. A casca lateral estreitou a coluna em
> 216 px e levou o estouro até 1440 — **revelando**, não criando. O
> `overflow-x-auto` de `R01` não alcança isto: quem se recusa a encolher é a
> trilha do grid, acima da tabela. Corrigido com `minmax(0,1fr)`, e
> `tests/repo/estilo.test.ts` passa a reprovar a trilha rígida.
>
> **O canal não-cromático de `H-72` sobreviveu à migração de eixo.** Ele estava
> na borda INFERIOR das abas e passou para a ESQUERDA da lateral. Medido sob
> `forced-colors: active` emulado: a corrente em **4 px**, as outras seis em
> **2 px**. A primeira tentativa o pôs em todos os sete itens, e o teste de
> `H-72` pegou — o canal só distingue se for exclusivo da corrente.
>
> **O salto para o conteúdo entrou, e ele já faltava antes desta história.**
> `SC 2.4.1`: são **20 paradas de tabulação** até o primeiro dado — sete da
> lateral, duas do topo, onze dos filtros —, repetidas nas sete telas. Medido no
> navegador: o salto é a primeira parada, mede 122×20 px ao receber foco, e leva
> ao `main` com o rótulo da página.
>
> **O `h1` mudou de significado, e é melhoria.** Era o nome do PRODUTO, repetido
> nas sete telas; passou a ser o nome da PÁGINA, que é o que `SC 2.4.6` pede de
> um cabeçalho. O produto continua visível, na lateral, onde não compete com o
> conteúdo por hierarquia.
>
> **Sem contagem ao lado do item**, e o caso-limite autoriza: o único número
> servido à casca é `rowsAccepted`, que ignora o recorte — exibi-lo ao lado de
> Operacional afirmaria 649 com o filtro em 12. Contagem por página exigiria
> campo novo na API, que o épico proíbe.

**Objetivo:** o operador ver dado sem descer quatro faixas — a navegação vai
para a lateral, e o topo guarda contexto e ação numa linha só.

> **A casca hoje empilha quatro faixas antes do `<main>`:** título com ações,
> `MainNav`, `FilterBar` e `StatusBanner` (`web/src/App.tsx:76-101`). A proposta
> mede o ganho em cerca de oito linhas de tabela a mais na mesma janela.
>
> **A lateral escala além de sete itens; abas horizontais não.** É o argumento
> estrutural, e vale independentemente da estética: o menu tem sete destinos
> hoje, e `E10` não fechou sem propor mais nenhum.

**Arquivos:**
- `web/src/App.tsx` — o eixo passa a ser lateral + coluna de conteúdo
- `web/src/components/AppSidebar.tsx` (novo) — navegação, contagens e o rodapé
  com Configuração
- `web/src/components/TopBar.tsx` (novo) — título da página, data do dado e as
  duas ações
- `web/src/components/StatusBanner.tsx` — passa a viver na coluna de conteúdo
- `web/src/components/ApplyChangesButton.tsx`, `RefreshButton.tsx` — forma de
  controle no topo
- `web/src/router.ts` — `NAV_PAGES` ganha o que a lateral precisa exibir
- os testes correspondentes

**Critérios de aceite:**
- **Dado** qualquer das sete páginas, **então** existe **uma** faixa horizontal
  acima do conteúdo, e a navegação está numa coluna à esquerda.
- **Dado** a página corrente, **então** o item da lateral tem
  `aria-current="page"` — o mesmo contrato que `MainNav` cumpre hoje.
- **Dado** a lateral, **então** ela é `<nav aria-label="Páginas">` e os destinos
  seguem sendo links com `href` real: o roteamento não muda, e `D-16` não é
  reaberta.
- **Dado** `web/tests/paginas-montadas.test.tsx`, **então** as sete páginas
  seguem montadas e alcançáveis.
- **Dado** a primeira execução, **então** o desvio para a tela de configuração
  continua valendo (`H-34`), e a lateral não aparece sem dado — hoje é
  `firstRun` que a esconde.

**Casos-limite:**
- Janela estreita — a 320 px CSS a lateral não pode empurrar o conteúdo para
  fora; `SC 1.4.10` já é obrigação desde `H-46`, e aqui o alvo é novo.
- A contagem ao lado do item ("649", "6" em Alertas) é dado servido, nunca
  calculado no cliente (**regra inviolável 6**); enquanto não houver o número,
  o item aparece sem contagem, não com zero.
- `healthError` e a faixa de estado degradado continuam visíveis em todas as
  páginas (A-57) — mudar de lugar não pode ser deixar de existir.
- Foco de teclado: a ordem passa a ser lateral → topo → conteúdo, e a lateral
  precisa de salto para o conteúdo se ficar antes dele no DOM.
- O link de Configuração vive no rodapé da lateral e **não** some (`H-38`
   fechou justamente a tela inalcançável).

**Fora desta história:** os filtros, que seguem na faixa antiga até `H-60`;
qualquer mudança de raio, densidade ou tipografia nos arquivos tocados; a busca
`⌘K`.

**Dependências:** `H-57`, `H-58`.
**Tamanho:** M (7 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-60"></a>

### H-60 — Os quatorze filtros como chips em popover

> ✅ **CONCLUÍDA em 01/09/2026.** **11 testes próprios** em
> `web/tests/FilterBar.test.tsx`. Suíte total de **1667 para 1678**, com seis
> casos existentes ajustados — os que abriam controles que agora vivem em
> popover, e o do contador, que virou o rótulo do botão de limpar.
>
> **A barra caiu de 200 px para 83 px, medido em Chrome 151.** O `<main>`
> começava em **321 px** na casca de quatro faixas, foi a 260 com `H-59` e está
> em **143** — **178 px liberados**, 61 pela lateral e 117 pelos chips. A 1280 px
> a casca original exibia 10 linhas de tabela e a nova exibe 11; a fixture só
> tem 11 processos, então o ganho real se mede pela altura, não pela contagem.
>
> **O critério "uma linha" não é atingível a 1280 px, e o número está medido.**
> Os treze chips somam **1437 px** de largura, contra 1064 disponíveis com a
> lateral: são **duas linhas** de 1280 a 1600, e **uma** a partir de ~1800.
> Cortar rótulo para caber trocaria altura por ambiguidade — "Cor do
> responsável" e "Importador fora do RJ" precisam do que dizem. O objetivo da
> história — *o recorte ativo ocupar uma linha em vez de uma faixa de
> controles* — é cumprido: o recorte fica visível **sem abrir nada**, e a faixa
> de treze controles abertos deixou de existir.
>
> **Um defeito de acessibilidade que o teste pegou:** o nome acessível do chip
> saía `"ClienteACME"`, porque o `gap` do flex é espaço visual e não textual —
> um leitor de tela anunciaria isso. O chip passou a declarar `aria-label`
> explícito, `Cliente: Acme Logística`, e o `title` cobre o outro lado do mesmo
> caso-limite: o valor completo quando o rótulo trunca.
>
> **`VN-3` medido e limpo:** com o popover aberto, **nenhum** ancestral tem
> `overflow` que o recorte, e `elementFromPoint` no centro do painel devolve um
> nó de dentro dele. O popover não é engolido por contêiner de rolagem.
>
> **`MultiSelect` perdeu o gatilho, o popover e a sombra**, e virou só a lista.
> O comportamento de abrir, fechar e devolver o foco vive uma vez em
> `FilterChip` — antes estava duplicado ali e **faltava** nos outros dois
> controles: os dois campos de data e o seletor de três estados nunca tiveram
> popover nenhum.
>
> **`Esc` passou a devolver o foco ao chip.** `MultiSelect` fechava e deixava o
> foco no `<body>`, e o operador de teclado recomeçava a tabulação do topo — o
> mesmo defeito que `VN-4` mediu na navegação (`SC 2.4.3`).
>
> **`useFilters.ts` não foi tocado.** A lista de arquivos previa "se precisar de
> contagem de ativos para o chip", e `activeCount` já existe desde `H-15`; o
> resumo por filtro é apresentação e vive na barra.

**Objetivo:** o recorte ativo ocupar uma linha em vez de uma faixa de controles,
sem perder nenhum dos quatorze filtros nem o estado na URL.

> **São quatorze, não onze.** `H-15` montou onze, `H-49` levou a doze com o
> cliente consolidado, `H-55` a treze com o grupo e `H-50` a quatorze com a cor
> do responsável. O mockup diz "onze" e está desatualizado em três —
> divergência 1 de `PROPOSTA.md §5`. **São treze CHIPS**, porque o grupo de
> clientes vive dentro do de Cliente.
>
> **A URL continua sendo o único estado** (`useFilters.ts:5`). O chip é
> apresentação do que já está lá; recarregar a página tem de reconstruir o mesmo
> recorte, e é isso que separa esta fatia de uma reescrita do filtro.

**Arquivos:**
- `web/src/components/FilterBar.tsx` — a linha de chips
- `web/src/components/FilterChip.tsx` (novo) — o gatilho, o valor ativo e o
  popover
- `web/src/components/MultiSelect.tsx` — passa a viver dentro do popover; perde
  a sombra
- `web/src/hooks/useFilters.ts` — se precisar de contagem de ativos para o chip
- os testes correspondentes

**Critérios de aceite:**
- **Dado** qualquer recorte ativo, **então** o chip correspondente mostra o
  filtro e o valor sem abrir o popover — o recorte ativo continua visível.
- **Dado** nenhum recorte, **então** a barra ocupa uma linha e nenhum popover
  está aberto.
- **Dado** um popover aberto, **então** `Esc` fecha, o foco volta ao chip, e o
  clique fora fecha — o padrão que `MultiSelect` já implementa hoje.
- **Dado** a URL com os quatorze parâmetros, **então** os treze chips refletem
  o recorte, e nenhum filtro ficou inalcançável.
- **Dado** o filtro Cliente, **então** o segundo nível de `H-55` continua
  dentro do popover, com a árvore intacta.

**Casos-limite:**
- Filtro de período: são dois `input type="date"`, e o chip precisa exibir
  intervalo, não um valor.
- Tri-estado de "Importador fora do RJ" (`H-15`): três estados, e o chip não
  pode reduzi-los a marcado/desmarcado.
- Rótulo longo — nome de cliente real chega a estourar a linha; o chip trunca
  com o valor completo acessível, nunca corta em silêncio.
- Erro ao carregar opções (`optionsError`) continua anunciado, e `H-43` já lhe
  deu live region.
- Duas abas do mesmo navegador (RNF-10): o estado é a URL, então nada a
  sincronizar.
- O popover não pode ser recortado por contêiner de rolagem — é o que `VN-3`
  procura.

**Fora desta história:** mudar quais filtros existem, o que cada um recorta, ou
o contrato de `GET /api/filter-options`.

**Dependências:** `H-59`.
**Tamanho:** M (5 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-61"></a>

### H-61 — Forma, densidade e número nos componentes de dado

> ✅ **CONCLUÍDA em 01/09/2026.** **8 testes próprios** em
> `web/tests/Operational.test.tsx` e `Alerts.test.tsx`. Suíte total de **1683
> para 1691**, com dois casos existentes ajustados — os que consultavam texto que
> passou a viver em dois elementos por causa do mono.
>
> **A fatia é de seis arquivos e tocou 15, e a razão é `C04`.** O critério 4 pede
> `radius-control`/`radius-container` nos seis; mas o papel "seção de conteúdo"
> existe em **13** arquivos, e `C04` — de `H-45`, `SC 3.2.4` — é guarda **de
> conjunto**: converter 4 e deixar 9 daria duas formas para o mesmo papel, e ela
> reprovaria com razão. Converti **todo** raio nos seis, e **só a linha do papel
> de seção** nos outros nove — 19 linhas, uma expressão por ocorrência. A regex
> de `C04` passou a exigir `rounded-container`, e agora **reprova o valor
> antigo**: é o que impede um arquivo novo de nascer com o raio de antes.
>
> **A guarda de "dois raios e nada entre eles" NÃO entra aqui, e o número diz por
> quê.** Escrita e rodada, ela nasce **vermelha**: sobram **47 `rounded`, 2
> `rounded-sm` e 1 `rounded-lg` em 17 arquivos** fora da fatia. `H-45` já fixou o
> precedente — *"guarda que nasce vermelha é desligada, não obedecida"* —, então
> ela vai para `H-63`, onde os arquivos convergem e ela pode passar.
>
> **O segundo critério é não-incidente, e não foi reduzido.** Ele pede que as
> ações da linha apareçam sob cursor e foco; `ProcessTable` **não tem ações de
> linha** — o único controle é o link da REF, e escondê-lo seria esconder o
> acesso ao detalhe. Criar ação nova é funcionalidade que nenhum critério pede.
> Mesmo tratamento que `H-53` deu ao quinto critério dela.
>
> **O caso-limite de valor longo era real, e foi medido antes de corrigir.** A
> linha tinha `h-10`, mas `height` numa `<tr>` é **mínimo**: medido em Chrome
> 151, a célula de Categoria quebrava em **seis retângulos de texto** — o rótulo
> mais o chip de canal não cabiam juntos — e esticava a linha de 40 para **57
> px**. Texto livre passou a truncar com o valor completo no `title`; valor curto
> usa `nowrap` e alarga a coluna, que a tabela já sabe rolar (`R01`). Depois:
> **todas as linhas em 40 px**, contentor em **12 px**.
>
> **A razão trilho/preenchimento do medidor, nos dois esquemas:** **5,57** no
> claro e **5,89** no escuro, contra um piso de 3:1. É o único canal da
> comparação entre linhas do ranking (`H-40`), e por isso o caso-limite manda
> medi-la nos dois.
>
> **Severidade e canal deixam de se distinguir por matiz.** Canal é pílula
> preenchida com rótulo escrito — a **única exceção declarada** aos dois raios;
> severidade é faixa lateral mais ícone SVG inline, sem dependência nova. **O
> prefixo textual de `H-45` fica**, e a prova por mutação mostra por quê: removê-lo
> reprova os testes de `ACHADO 18`, que já existiam. O ícone se soma ao texto,
> nunca o substitui.
>
> **"Sem faixa alternada" já era verdade** quando a fatia começou; virou asserção
> para não voltar.

**Objetivo:** os seis componentes que apresentam dado adotarem os dois raios, a
linha de 40 px, o mono onde há número e o alinhamento à direita.

> **O corte é por arquivo, não por propriedade.** Raio, elevação, densidade e
> largura de fonte aplicados em passadas separadas abririam cada arquivo quatro
> vezes — é a razão que a onda 5 de `estilizacao/RESULTADO.md` deu para juntar o
> `ACHADO 21` com os outros dois.
>
> **São os mesmos seis arquivos de `H-40`**, deliberadamente: o agrupamento já
> foi exercido uma vez e o épico não inventa um segundo.

**Arquivos:**
- `web/src/components/ProcessTable.tsx` — linha de 40 px, sem zebra, ações sob
  cursor e foco, REF e datas em mono, numérico à direita
- `web/src/components/RankingBar.tsx` — raio de contentor, contagem em mono
- `web/src/components/StatCard.tsx` — raio de contentor, número em mono
- `web/src/components/ArrivalCalendar.tsx` — raio de controle nos dias,
  contagem em mono
- `web/src/components/AlertRow.tsx` — severidade como faixa lateral com ícone
- `web/src/components/IngestionHealth.tsx` — idem, e o contador em mono
- os testes correspondentes

**Critérios de aceite:**
- **Dado** `ProcessTable`, **então** a linha tem altura declarada de 40 px em
  unidade relativa, não há faixa alternada, e a divisória é de 1 px.
- **Dado** uma linha sem cursor e sem foco, **então** as ações dela não estão
  visíveis; **quando** o foco de teclado entra na linha, **então** aparecem —
  `tr:focus-within`, e o controle nunca sai da ordem de tabulação.
- **Dado** REF, data, contagem e número, **então** cada um usa a família mono e
  `tabular-nums`; **e** toda coluna numérica está alinhada à direita, cabeçalho
  incluído.
- **Dado** os seis arquivos, **então** todo raio é `radius-control` ou
  `radius-container` — nenhum valor intermediário —, e a pílula do rótulo de
  canal é a única exceção, declarada.
- **Dado** `AlertRow` e `IngestionHealth`, **então** a severidade aparece como
  faixa lateral **mais** ícone, e o canal, quando houver, como chip preenchido
  com rótulo escrito: forma diferente, não só matiz diferente (**regra
  inviolável 4**).

**Casos-limite:**
- Célula com valor longo — a linha de 40 px não pode crescer nem cortar dado
  sem que o valor completo continue alcançável.
- `opacity: 0` nas ações mantém o controle clicável por engano: a transição é de
  opacidade, e o alvo só é interativo quando visível.
- Zoom de 400% (`SC 1.4.10`): a altura fixa é em `rem`, então acompanha; medir
  em `VN-1` de `H-65`.
- A barra do ranking é o único canal da comparação entre linhas (`H-40`): a
  razão trilho/preenchimento é conferida nos **dois** esquemas.
- Dia sem chegada no calendário segue vazio, não zero (**regra inviolável 3**).

**Fora desta história:** os outros dezenove arquivos; movimento, que é `H-64`.

**Dependências:** `H-57`, `H-58`.
**Tamanho:** M (6 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-62"></a>

### H-62 — Forma e número na superfície de edição e no detalhe

> ✅ **CONCLUÍDA em 01/09/2026.** **2 testes próprios**, mais uma asserção de
> papel em `tests/repo/estilo.test.ts`. Suíte total de **1691 para 1693**, com um
> caso existente ajustado. **O primeiro critério devolve zero:**
> `grep -r 'shadow-' web/src` não encontra nada — a última sombra do conjunto
> saiu.
>
> **O critério 2 REPROVOU na primeira medição, e é o achado da fatia.** Sem a
> sombra, o que separa o diálogo do véu é a borda; medido em Chrome 151 contra o
> véu **composto** — alfa resolvido pelo compositor, não multiplicado à mão —,
> `border-border-strong` deu **1,91:1** no claro, contra o piso de **3:1** que o
> critério pede. O motivo é geométrico, não de escolha: um cinza médio fica
> **entre** o painel branco e o véu, e não contrasta com os dois.
>
> **Nasceu daí o único token que existe por causa do que está ATRÁS do
> elemento:** `--color-border-modal`, escuro no claro e claro no escuro. Medido
> depois: **4,12:1** no claro e **5,66:1** no escuro. `D-21` obriga os dois
> esquemas, e a guarda de `H-57` cobra — a prova por mutação mostra isso:
> remover o par escuro do token novo reprova a asserção de `H-57`.
>
> **O painel modal virou papel declarado em `C04`.** Ele passou a casar
> `SECTION_ROLE` e usa borda diferente, então a guarda de `H-45` reprovou — com
> razão. O sinal sintático é `max-h-[`: só o modal limita a própria altura à
> viewport, porque só ele não rola com a página. E a asserção não o deixa sem
> regra: ele **tem** de usar `border-border-modal`.
>
> **O padrão de severidade virou componente, e isso não estava na lista.**
> `H-61` pôs faixa lateral mais ícone em dois lugares; esta fatia precisava dele
> em mais quatro — os painéis de erro de `EditProcessForm`, `ColorFieldsForm`,
> `WorkbookSetup` e `ConflictDialog`. Copiar doze linhas de `path` seis vezes
> garante que a sexta divirja, então nasceu `web/src/components/SeverityMark.tsx`
> e os dois de `H-61` passaram a consumi-lo.
>
> **Os 21 raios crus foram classificados pelo que o elemento É**, e não pelo
> espaçamento: `<input>`, `<select>` e `<button>` viram `rounded-control` — 12
> ocorrências —, painel e mensagem viram `rounded-container` — 9. O critério de
> `px-`/`py-` assimétrico do corpus não decidia os painéis de mensagem, que são
> blocos de texto com espaçamento de controle.
>
> **Três coisas já eram verdade** e viraram asserção: as três colunas fora de
> escopo do detalhe já estavam em mono, a sombra do `MultiSelect` já tinha saído
> em `H-60`, e os botões desabilitados seguem em `control-disabled-*`.

**Objetivo:** os seis arquivos onde o operador escreve e confere adotarem os
dois raios, a elevação por borda e o mono onde há número.

> **É aqui que a última sombra do conjunto sai.** São duas em 31/08/2026 —
> `MultiSelect.tsx:141`, que `H-60` já terá tratado, e
> `ConflictDialog.tsx:78` —, e o diálogo é o caso em que a sombra parecia
> indispensável: sem ela, o que separa o painel do véu é a borda mais o
> `overlay-scrim`.

**Arquivos:**
- `web/src/components/ConflictDialog.tsx` — `shadow-xl` sai, borda entra;
  tabela de cinco colunas na densidade nova
- `web/src/components/EditProcessForm.tsx` — raio de controle nos campos
- `web/src/components/ColorFieldsForm.tsx` — idem, e as seis combinações de cor
- `web/src/components/PendingEditsPanel.tsx` — raio de contentor, contagem em
  mono
- `web/src/pages/ProcessDetail.tsx` — REF, datas e as três colunas fora de
  escopo em mono
- `web/src/pages/WorkbookSetup.tsx` — campos, caminho de arquivo em mono
- os testes correspondentes

**Critérios de aceite:**
- **Dado** os seis arquivos, **então** `grep -r 'shadow-' web/src` devolve zero.
- **Dado** o diálogo de conflito, **então** ele continua distinguível do fundo
  sem sombra — borda em contraste ao menos 3:1 contra o que estiver atrás, nos
  dois esquemas.
- **Dado** todo controle de formulário, **então** o raio é `radius-control`, e
  todo contentor, `radius-container`.
- **Dado** REF, data, caminho de arquivo e valor monetário, **então** aparecem
  em mono com `tabular-nums`.
- **Dado** os seis botões desabilitados que `H-41` corrigiu, **então** seguem
  em `control-disabled-*`, agora medidos também no esquema escuro.

**Casos-limite:**
- `ColorFieldsForm` oferece as seis combinações representáveis (`H-27`): o
  seletor de cor mostra **dado**, e a amostra precisa ser identificável nos dois
  esquemas sem virar severidade.
- Campo com erro de validação: a faixa de erro é severidade — faixa lateral e
  ícone, nunca só a borda vermelha.
- `WorkbookSetup` é a primeira tela numa máquina limpa (`H-35`): se a fonte não
  carregar, ela ainda precisa estar legível.
- O véu do diálogo (`overlay-scrim`) tem valor próprio por esquema desde
  `H-57`; conferir que o painel não se dissolve no fundo escuro.

**Fora desta história:** o que a aplicação **diz** sobre a escrita — mensagem de
`H-26` não muda de texto aqui.

**Dependências:** `H-57`, `H-58`.
**Tamanho:** M (6 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-63"></a>

### H-63 — Forma e número nas sete páginas, e a guarda de forma

> ✅ **CONCLUÍDA em 01/09/2026.** **6 asserções próprias** em
> `tests/repo/estilo.test.ts` — as quatro que a história pede, mais a âncora de
> regex e a de densidade. Suíte total de **1693 para 1698**. **A onda 3 fecha
> aqui.**
>
> **Os dois raios, medidos no navegador e não no código.** Percorridas as sete
> rotas em Chrome 151, `getComputedStyle` sobre todo elemento de `main`, `nav` e
> `header`: **os raios distintos do conjunto inteiro são `6px` e `12px`** —
> contra as 81 ocorrências que `docs/estilizacao/RESULTADO.md` mediu, 77 delas
> no mesmo valor de 4 px. **Zero sombras e zero estouros** nas mesmas sete.
>
> **A guarda entra aqui porque só aqui pode passar.** Ela foi escrita em `H-61`
> e nascia vermelha: sobravam 47 `rounded`, 2 `rounded-sm` e 1 `rounded-lg` em
> 17 arquivos. Esta fatia converteu os últimos **26**, em 11 arquivos, e as
> quatro asserções **reprovam sob mutação** — raio solto, sombra, peso acima de
> 600 e fonte em unidade absoluta, cada uma injetada em `Home.tsx` e cada uma
> reprovando a sua.
>
> **O único `font-bold` do conjunto era um comentário meu**, de `H-58`,
> afirmando que havia zero. A guarda passou a exigir o contexto de utilitário —
> `className=` ou `@apply` —, porque contar prosa faria ela reprovar a própria
> documentação. É a segunda vez na sessão que um `grep` de critério casa a
> explicação em vez do defeito.
>
> **A densidade não tinha chegado a Performance e History**, e a medição
> mostrou: **29 px** contra os 40 de `H-61`. Corrigido, as **seis** tabelas do
> conjunto medem 40 px, todas dentro do invólucro de rolagem de `R01`.
>
> **Um erro meu que a medição pegou, e que vale registrar:** rodei
> `npm run build >/dev/null 2>&1`, o build **falhou** com erro de sintaxe — um
> comentário JSX posto como primeiro filho de um `map` —, e eu continuei medindo
> a build anterior por três rodadas. O sintoma era `h-10` no código e 29 px na
> tela. **Silenciar a saída de um comando que pode falhar é o que transformou um
> erro de dois minutos em três medições enganosas.**
>
> **Os quatro casos-limite conferidos:** o `style={{}}` de `RankingBar`
> sobreviveu — a guarda olha utilitário, não atributo —; a pílula de canal segue
> exceção declarada, reconhecida pelo nome do utilitário; o gráfico lê os tokens
> por `var()`, como `H-42` deixou; e as páginas vazias seguem com estado vazio
> afirmativo.

**Objetivo:** fechar a onda 3 com as sete páginas na forma nova, e impedir que o
raio solto e a sombra voltem.

> **A guarda é o que faz a onda durar.** `tests/repo/estilo.test.ts` nasceu em
> `H-42` para impedir o passo bruto de paleta de voltar, e a mesma mecânica vale
> aqui: raio fora dos dois valores, sombra, peso acima de 600 e tamanho de fonte
> em unidade absoluta reprovam a suíte.

**Arquivos:**
- `web/src/pages/Home.tsx` — cartões e a faixa de erro
- `web/src/pages/Operational.tsx` — paginação e a tabela
- `web/src/pages/Clients.tsx` — os três rankings
- `web/src/pages/Performance.tsx` — as quatro tabelas de quebra
- `web/src/pages/Alerts.tsx` — a fila agrupada
- `web/src/pages/History.tsx` — o gráfico, cujos literais já saíram em `H-42`
- `web/src/pages/Placeholders.tsx` — superfícies e bordas
- `tests/repo/estilo.test.ts` — as quatro asserções novas
- os testes correspondentes

**Critérios de aceite:**
- **Dado** `web/src/**/*.tsx`, **então** toda ocorrência de raio é
  `rounded-control`, `rounded-container` ou a pílula declarada — contra as 81
  ocorrências medidas em 31/08/2026, 77 delas no mesmo valor de 4 px.
- **Dado** o mesmo recorte, **então** zero `shadow-*`, zero `font-bold`, e zero
  tamanho de fonte em unidade absoluta.
- **Dado** cada uma das quatro asserções novas, **então** ela reprova sob
  mutação — asserção que não erra quando o defeito é injetado não guarda nada.
- **Dado** as tabelas de `Performance` e `History`, **então** adotam a densidade
  de `H-61`, e as tabelas seguem dentro do invólucro de rolagem de `H-46`.
- **Dado** o Recharts, **então** os eixos leem os tokens por `var()` — o caminho
  que `H-42` mediu no navegador em vez de supor.

**Casos-limite:**
- `RankingBar` usa o único `style={{}}` do conjunto, para largura dinâmica
  (`C03` dispensou): a guarda não pode passar a reprová-lo.
- A pílula de canal é exceção **declarada**, e a guarda a conhece pelo nome do
  utilitário — não por lista de arquivos.
- Gráfico em `forced-colors` já é obrigação de `H-44`; a forma nova não pode
  desfazê-la.
- Página vazia continua com estado vazio afirmativo, não contentor em branco.

**Fora desta história:** movimento; qualquer mudança de largura de contêiner ou
de breakpoint que o corpus não sustente — o mesmo corte de `H-46`.

> **Herda de `H-61` a guarda de "dois raios, e nada entre eles".** Ela foi
> escrita e rodada em `H-61`, e nasce **vermelha** enquanto houver raio antigo:
> medido em 01/09/2026, sobravam **47 `rounded`, 2 `rounded-sm` e 1
> `rounded-lg` em 17 arquivos**. `H-45` fixou o precedente — guarda que nasce
> vermelha é desligada, não obedecida —, e é aqui que os arquivos convergem.

**Dependências:** `H-61`, `H-62`.
**Tamanho:** M (8 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-64"></a>

### H-64 — Movimento curto, com a redução nascendo junto

> ✅ **CONCLUÍDA em 01/09/2026.** **8 asserções próprias** — 5 em
> `tests/repo/estilo.test.ts` e 3 de componente. Suíte total de **1698 para
> 1706**. O movimento inteiro foi medido em Chrome 151, nos dois estados da
> preferência.
>
> **As quatro medidas, e nenhum terceiro valor.** `motion-tint` resolve
> `color, background-color, border-color` em `0.11s` com
> `cubic-bezier(0.32, 0.72, 0, 1)`; o popover resolve `surface-appear 0.17s`
> com a mesma curva; o controle pressionado mede `matrix(0.975, 0, 0, 0.975,
> 0, 0)` com o botão **realmente pressionado** por `Input.dispatchMouseEvent`.
> Sob `prefers-reduced-motion: reduce` o botão vai a `transition: none` e
> `transform: none`, e o popover a `animation: none` — enquanto a cor **fica**
> em `0.11s` nos dois estados, que é `A10` cumprida e não esquecida.
>
> **O movimento não é utilitário de `.tsx`, e a razão é do Tailwind.**
> `--radius-*` e `--ease-*` são namespaces da v4 e geram `rounded-control` e
> `ease-brand`; **`--speed-*` não é namespace nenhum** — `duration-fast` não
> existe, e a alternativa seria `duration-[var(--speed-fast)]` repetido em cada
> consumidor. Duas `@utility` em `index.css` resolvem, no idioma que
> `panel-loading` já usava, e tornam o critério de aceite verificável na forma
> forte: **zero** utilitário de movimento fora do CSS.
>
> **A guarda achou um buraco anterior a esta história, e ele estava em `D-22`.**
> `EM_UTILITARIO` exigia `className` ou `@apply` **na mesma linha**, e
> `AppSidebar.tsx` extrai as classes para `ITEM_BASE`, `ITEM_CURRENT` e
> `ITEM_REST` — constantes sem `className` nenhum. Um `shadow-lg` plantado ali
> **passava** por todas as asserções de `H-63`. O critério aproximado virou o
> exato: prosa é comentário, e `semComentarios` o apaga preservando as linhas.
> **Quatro mutações, quatro reprovações**, incluindo a que só o critério novo
> pega.
>
> **A âncora reprovou a própria guarda duas vezes, antes do conjunto.**
> `DECLARA_MOVIMENTO` via a propriedade sendo declarada e **não** a `transition`
> que a nomeia no valor — deixaria passar exatamente a regra de recuo, o único
> movimento real da fatia. E o passo de `@keyframes` era acusado de não ter
> contraparte, quando quem a tem é a regra que **usa** a animação.
>
> **Três divergências de fiação, resolvidas e registradas.**
>
> 1. **`ProcessTable` não tem ações de linha a revelar.** A linha tem o link da
>    REF, sempre visível, e o selo de edição pendente, condicional ao dado.
>    Nenhuma ação escondida existe, e o caso-limite da opacidade ficou sem alvo.
>    **Descartado:** inventar uma ação de linha para justificar a revelação.
> 2. **O Recharts honra a preferência sozinho, e isso foi medido — não
>    raciocinado.** `Line` tem `isAnimationActive: 'auto'` por padrão em 3.10.1,
>    e `'auto'` passa por `usePrefersReducedMotion`. No navegador: sem redução as
>    cinco linhas nascem com `strokeDasharray: 0px 0px` — traço oculto, meio da
>    revelação — e só depois chegam ao estado final; **com redução nascem já no
>    estado final**. Nenhuma prop é necessária, e passá-la mudaria o
>    comportamento de quem não pediu redução.
> 3. **`tools/medir-navegador.mjs` não alcançava nem a preferência nem o
>    cursor**, e sem os dois a história não teria como ser verificada. Entraram
>    `movimentoReduzido` e `apontadorFino` — o segundo descrito abaixo.
>
> **O `hover:` era inobservável no headless, e o diagnóstico registrado estava
> errado.** O Tailwind v4 envolve **todo** `hover:` em `@media (hover: hover)`,
> e o Chrome headless declara `hover: none` e `pointer: none`: nenhum utilitário
> de cursor entra na cascata. `:hover` **casa** normalmente — medido por
> `Input.dispatchMouseEvent`, `matches(':hover')` responde `true` —, e
> `Emulation.setEmulatedMedia` **não** alcança essas duas features, que são
> capacidade do dispositivo e não preferência do usuário. A flag de lançamento
> `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`
> resolve, e o realce da linha vai de `rgba(0, 0, 0, 0)` a `rgb(240, 242, 245)`.
> Isso **corrige a suspeita do item (3) de `PD-07`**, que atribuía a falha à
> ausência de cursor real: a falha era a ausência de apontador **declarado**.


**Objetivo:** a interface responder ao cursor e à troca de tela com duas
durações e uma curva, e desligar tudo isso sob `prefers-reduced-motion`.

> **A redução nasce junto, e não depois.** O conjunto tem **zero** `transition-*`
> e **zero** `animate-*` em 31/08/2026, e é por isso que `A07`, `A09` e `A10` do
> corpus estão dispensadas por inaplicabilidade. A primeira transição as torna
> aplicáveis todas de uma vez: entregar movimento sem a contraparte seria criar
> três achados no mesmo commit.
>
> **`SC 2.3.3` é AAA**, e a Fase 2 declarou o nível AAA dispensável. A obrigação
> aqui não vem dele: vem de `A10`, que o corpus manteve com o sinal sintático
> limpo e custo baixo, e de a alternativa ser mais cara depois.

**Arquivos:**
- `web/src/index.css` — o bloco `@media (prefers-reduced-motion: reduce)` e a
  regra de recuo do controle pressionado
- `web/src/components/AppSidebar.tsx` — realce do item sob cursor
- `web/src/components/ProcessTable.tsx` — realce da linha e a revelação das
  ações
- `web/src/components/FilterChip.tsx` — abertura do popover
- os testes correspondentes

**Critérios de aceite:**
- **Dado** qualquer elemento com transição, **então** a duração é `speed-fast`
  ou `speed-base`, e a curva é `ease` — nenhum terceiro valor.
- **Dado** `prefers-reduced-motion: reduce`, **então** toda transição de
  **movimento** é anulada; transição de cor pode permanecer, porque `A10` trata
  de movimento e o contraexemplo do corpus é explícito nisso.
- **Dado** um controle pressionado, **então** ele recua 2,5%, e esse recuo cai
  sob redução de movimento.
- **Dado** `tests/repo/estilo.test.ts`, **então** transição de movimento sem
  contraparte de redução reprova.

**Casos-limite:**
- A revelação das ações da linha é opacidade: sob redução, o estado final é o
  mesmo, sem a interpolação.
- Troca de página não usa a View Transition API — o roteamento é próprio
  (`D-16`), e trazer a API para dentro dele é dependência de comportamento que a
  fatia não paga.
- Gráfico do Recharts anima por conta própria: conferir se a biblioteca honra a
  preferência, e desligar por prop se não honrar.
- Duração declarada em `.tsx` em vez de token → reprova pela guarda.

**Fora desta história:** animação de entrada de página, esqueleto de carga, e
qualquer movimento que não responda a uma ação do operador.

**Dependências:** `H-63`.
**Tamanho:** M (4 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-65"></a>

### H-65 — Percorrer os procedimentos de navegador nos dois esquemas

> ✅ **CONCLUÍDA em 01/09/2026, e com ela `E11` e o backlog inteiro.**
> **4 asserções próprias**, suíte de **1706 para 1708**. O registro datado está
> em `docs/redesign/VERIFICACAO.md`; aqui fica só o que ele não é o lugar de
> guardar.
>
> **Os seis procedimentos, duas vezes cada — e quatro achados, todos
> corrigidos.** Nenhum virou nota solta, e os quatro caíram em arquivo já tocado
> por `E11`, que é o que o critério de aceite manda.
>
> **`VN-1` — o popover era o buraco da medição anterior.** "Zero estouros de 320
> a 1440", de `H-63`, foi medido com os treze popovers **fechados**; o painel é
> `absolute` e contribui para o overflow. Abrindo um a um a 320 px, **6 dos 13**
> faziam a página rolar, com números idênticos nos dois esquemas — **135 px** no
> pior caso, quase metade da largura útil. Não há solução só de CSS:
> posicionamento por âncora ainda é do Chrome. O painel passou a se recolher por
> `useLayoutEffect`, e o deslocamento vai em `margin-left` e **não** em
> `transform` — a animação de `H-64` escreve `transform`, e a origem de cascata
> dela vence a do estilo em linha. **6 → 0**, e os sete que já cabiam não se
> moveram.
>
> **`VN-2` corrigiu a descrição de `VN-2/A`, de `H-47`.** Aquele registro dizia
> que o truncamento "cresce com a ampliação". Medido: **160 px visíveis para 200
> necessários** no tamanho padrão e **240 para 300** em "Muito grande" — a
> proporção é **a mesma**, porque `w-40` e `text-sm` escalam juntos. O que cresce
> é o déficit absoluto. O truncamento já existia no padrão, e o rótulo do
> ranking ganhou `title`, pela regra que `ProcessTable` fixava.
>
> **`VN-3` e `VN-4` aprovados com 193 paradas por esquema, 386 no total** — zero
> sem anel, zero recortadas, zero em subárvore `aria-hidden`, o que confirma
> `H-46` em campo. **Dentro do popover aberto: 11 paradas, zero recortadas.**
> As regressões de ordem são todas transição de coluna, que `VN-4` manda aceitar.
>
> **`VN-5` fechou o item 4 de `PD-07` por medição:** sob o modo forçado os dois
> esquemas são **paletas de sistema realmente distintas** — branco com
> `rgb(0, 0, 159)` e preto com `rgb(255, 255, 0)` —, e a lateral distingue o item
> corrente por `4px` contra `2px` nas duas. Os cartões: **13 no total, 2 de
> urgência, os 2 com o texto "Pede ação"**, e os fundos **colapsam num só valor**
> sob o modo forçado, o que prova que o canal cromático morre e o textual não.
>
> **O `forced-colors:border-l-4` de `AlertRow` era inerte, e o teste provava o
> contrário do que o nome dele dizia.** A variante repetia o valor da base, então
> urgentes e não urgentes ficariam com a mesma faixa; o teste se chamava
> "engrossa a faixa **nas duas severidades**" e cobrava a mesma classe nas duas —
> classe igual nas duas é a definição de não distinguir. Quem muda passou a ser o
> ramo **não urgente**, com `forced-colors:border-l-0` mais `forced-colors:pl-1`,
> técnica de `H-59`. **Não repara perda de informação:** o prefixo "Pede ação" de
> `H-45` é texto e sempre sobreviveu.
>
> **`VN-6` ficou com um alvo só, e é do tema.** `MultiSelect` com `opacity-80` e
> `PendingEditsPanel` com `opacity-60` deixaram de existir; sobrou
> `--color-overlay-scrim`, já medido em `H-62`. O achado adjacente foi o glifo
> `▾` do chip, que sobre `bg-action-soft` media **4,38:1** no claro contra o piso
> de 4,5:1 — corrigido e remedido no navegador em **6,02:1** e **6,08:1**.
>
> **Três limitações declaradas, e nenhuma é de código.** (1) A emulação por CDP
> fixa a media query na abertura do alvo, então **alternar o tema do sistema com
> a aplicação aberta** exige a máquina do operador. (2) O `ConflictDialog` só
> abre com a planilha alterada, e **nenhuma fixture versionada produz isso** —
> continua devendo o foco ao abrir, a prisão de tabulação e o véu amostrado. (3)
> A correção de `AlertRow` **não foi medida no navegador**: as 10 linhas de
> `/alertas` sobre `cores.xlsx` são **todas urgentes**, e nenhuma das nove
> fixtures produz severidade acima de `URGENT_SEVERITY`. Uma medição
> compararia urgentes com urgentes e não diria nada; o ramo ficou coberto por
> teste de componente com as duas classes concretas.
>
> **Uma divergência de execução, resolvida:** os endereços dos procedimentos
> envelheceram — `VN-1` a `VN-6` citam abas, `shadow-lg` e `bg-slate-*` que `E9`
> e `E11` substituíram. O que sobrevive é a **pergunta**, e a tradução de cada
> item para o código atual está registrada no documento.


**Objetivo:** provar no navegador o que a estática não alcança, agora com a
superfície dobrada pelo segundo esquema.

> **`H-47` é a linha de base, e esta história é a segunda passada.** Metade dos
> procedimentos de `estilizacao/RESULTADO.md` mede cor **resolvida**, e cor
> resolvida depende do esquema: rodá-los só no claro deixaria o escuro sem
> verificação nenhuma.
>
> **O que a suíte não alcança:** contraste do que é pintado por cima de
> `overlay-scrim`, foco visível recortado por contêiner de rolagem, e reflow a
> 320 px com a lateral nova. Os três são de execução, não de código.

**Arquivos:**
- `docs/redesign/VERIFICACAO.md` (novo) — o registro datado de cada
  procedimento, nos dois esquemas, com o que foi observado

**Critérios de aceite:**
- **Dado** cada procedimento de `VN-1` a `VN-6`, **então** ele foi executado
  **duas** vezes — uma por esquema — e o resultado está registrado com data.
- **Dado** `VN-1` (reflow a 320 px), **então** a lateral de `H-59` não produz
  rolagem horizontal, e o que rolar é a tabela dentro do próprio invólucro.
- **Dado** `VN-3` (foco visível), **então** nenhum anel de foco é recortado pelo
  popover de `H-60` nem pelo contêiner de rolagem das tabelas.
- **Dado** qualquer achado, **então** ele vira correção nesta história se for de
  um arquivo já tocado pelo épico, ou história nova se não for — nunca nota
  solta.

**Casos-limite:**
- Esquema forçado pelo sistema operacional durante a execução: alternar o tema
  do Windows com a aplicação aberta é o caminho real do operador, e a página
  precisa acompanhar sem recarregar.
- `forced-colors` é um terceiro modo, e não o escuro: `H-44` já o cobre, e aqui
  só se confere que a forma nova não o desfez.
- Impressão não está no escopo de nenhuma tela.

**Fora desta história:** qualquer redesenho novo. É verificação.

**Dependências:** `H-64`.
**Tamanho:** P (1 arquivo, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="e12"></a>

## Épico E12 — Os achados da revisão de estilo

Nasce de `docs/redesign/REVISAO-ESTILO.md` (01/09/2026), segunda invocação do
subagente `revisor-estilo` contra o corpus de 40 regras. **A primeira produziu
`docs/estilizacao/RESULTADO.md`, de onde nasceu `E9`** — este épico é o mesmo
mecanismo, uma passada depois.

**Catorze achados. Três já fecharam em `H-65`**, por caírem em arquivo que a
história estava tocando: a faixa do alerta sob `forced-colors`, o glifo do chip
a 4,38:1, e o popover que estourava a 320 px. **Um não vira história** —
`ACHADO 14` é declarado não normativo pelo próprio revisor, e aposentar dois
degraus de espaçamento com 2 e 3 ocorrências é arrumação, não correção. **Restam
dez, em quatro histórias.**

**Nenhum indicador muda de valor, nenhuma rota muda de contrato.** As quatro
histórias tocam `web/src/` e nada mais.

**Três determinações valem para o épico e não se re-litigam:**

1. **`ACHADO 12` se resolve alargando a coluna, não trocando o truncamento.**
   Medido contra a planilha real em 01/09/2026: dos **3591** valores de texto
   livre das seis colunas, **81 são cortados** — e **80 deles estão numa coluna
   só**, Navio. Não é "a tabela trunca": é uma coluna estreita demais. Trocar
   `truncate` por `break-words`, como `H-69` fez na Performance, desfaria a
   densidade de 40 px que `H-61` mediu, e para 2,3% das células.
2. **`ACHADO 11` restaura a camada de acessibilidade, em vez de registrar
   exceção.** Sem `aria-hidden` a parada de tabulação deixa de ser **órfã** —
   passa a ser legítima e nomeada —, então isso **não** reintroduz o defeito que
   `H-46` fechou: o problema de lá era a orfandade, não a existência da parada.
3. **`ACHADO 2` tem precedência sobre os outros nove.** É o único com razão de
   contraste **abaixo do piso**: a faixa de `AlertRow` mede **1,60:1** no claro e
   **1,94:1** no escuro contra os 3:1 de `SC 1.4.11`.

**As quatro ondas, pela dependência técnica**, na forma que o revisor devolveu:

| Onda | História | Arquivos | Por que vem aqui |
|---|---|---|---|
| 1 | `H-73` | 2 | Consumir `severityBand` fixa o token antes de qualquer unificação de papel |
| 2 | `H-74` | 5 | Nível de título, altura de alvo, região viva e prop do gráfico não referenciam token nenhum |
| 3 | `H-75` | 9 | A `@utility` do botão primário grava o conjunto final de tokens; extraí-la antes da onda 1 congelaria um par de cor que ainda ia mudar |
| 4 | `H-76` | 1 | A largura da coluna segue o contêiner que a onda 3 unifica |

> **A ordem é linear, e não é gosto.** `App.tsx` aparece em `H-74` e em `H-75`,
> e `IngestionHealth.tsx` em `H-73` e em `H-75`. Fatiar em PRs paralelos poria
> os dois arquivos em duas branches ao mesmo tempo.

---

<a id="h-73"></a>

### H-73 — A faixa de severidade no token certo

> ✅ **CONCLUÍDA em 01/09/2026.** **5 asserções próprias** — 4 em
> `tests/repo/estilo.test.ts` e 1 de componente. Suíte de **1708 para 1713**.
> **Abre `E12`.**
>
> **A razão medida no navegador, e não copiada:** a faixa urgente vai de
> **1,60:1** para **5,92:1** no claro e de **1,94:1** para **8,93:1** no escuro,
> contra o piso de 3:1 de `SC 1.4.11`. A espessura segue em `4px` — a composição
> com `severityBand` não dobrou nada.
>
> **A correção do revisor estava certa na faixa e errada no ícone.** Ela mandava
> `<SeverityIcon tone="warning"/>` junto de `severityBand('warning')`, e o glifo
> de `warning` é o **círculo**: adotá-la faria urgente e não urgente mostrarem o
> mesmo desenho, **perdendo um canal em vez de ganhar consistência**. O glifo
> segue o tom, e o tom do urgente é `error` — o triângulo fica. Zero mudança
> visual, uma definição só do desenho.
>
> **`severityBand` tinha o mesmo defeito que `H-65` corrigiu em `AlertRow`.**
> `BAND.error` declarava `border-l-4` e `forced-colors:border-l-4` juntos: a
> variante repetia o valor da própria base e **não podia diferir em situação
> nenhuma**. Código morto que alcançava os quatro consumidores, e saiu.
>
> **O cabeçalho de `SeverityMark` já afirmava seis consumidores desde `H-62`.**
> Aparecia em seis; quatro consumiam. A guarda nova é o que impede a afirmação
> de voltar a ser intenção — ela cobra **um** arquivo desenhando o triângulo, e
> ao menos seis consumindo `severityBand`.
>
> **Três mutações, três reprovações:** o triângulo copiado de volta reprova
> nomeando o arquivo; a faixa voltando ao token de borda reprova nomeando a
> linha; e apagar todas as chamadas de `severityBand` reprova a âncora — sem
> ela, as duas primeiras passariam por vacuidade.
>
> **A composição pedia um ajuste que o plano não previa:** `severityBand` já
> traz `border-l-4`, então a base do `<li>` perdeu o seu. O ramo não urgente
> mantém o dele, com a compensação de `forced-colors` que `H-65` mediu.


**Objetivo:** um nível de severidade usar um par de cor só, em todo o conjunto,
e o ícone existir uma vez.

> **`ACHADO 2`, e é o único do épico abaixo de um piso normativo.** `AlertRow`
> pinta a faixa com `state-warning-border`, que mede **1,60:1** no claro e
> **1,94:1** no escuro contra `surface-raised`. `severityBand('warning')` usa
> `state-warning-fg` e mede **5,92** e **8,93**. O piso de `SC 1.4.11` é 3:1.
>
> **O ícone existe em três cópias:** `SeverityMark.tsx`, `AlertRow.tsx:55` e
> `IngestionHealth.tsx`. Copiar doze linhas de `path` três vezes garante que a
> terceira divirja — é o mesmo argumento que criou `SeverityMark` em `H-62`.

**Arquivos:**
- `web/src/components/AlertRow.tsx` — consome `severityBand` e `SeverityIcon`
- `web/src/components/IngestionHealth.tsx` — idem, e perde a cópia inline
- `web/tests/Alerts.test.tsx` e `web/tests/IngestionHealth.test.tsx`

**Critérios de aceite:**
- **Dado** qualquer faixa de severidade do conjunto, **então** ela vem de
  `severityBand`, e nenhum arquivo declara `border-l-state-*-border`.
- **Dado** o ícone de severidade, **então** existe **uma** definição de `path`
  em `web/src/`, e os três consumidores a importam.
- **Dado** o modo forçado, **então** a distinção de `H-65` sobrevive: o ramo não
  urgente continua com `forced-colors:border-l-0` e a compensação de `pl`.
- **Dado** o prefixo textual de `H-45`, **então** ele permanece — o ícone se
  soma a ele, nunca o substitui.

**Casos-limite:**
- `state-warning-fg` sobre `surface-raised`: **5,92:1** no claro e **8,93:1** no
  escuro — medir, não copiar do documento.
- `IngestionHealth` usa tom `error` **e** `warning`; trocar só um deixaria o
  outro divergente.
- A faixa de `AlertRow` é `border-l-4` na base, e `severityBand` também declara
  `border-l-4` — a composição não pode dobrar a espessura.

**Fora desta história:** a unificação do botão primário, que é `H-75`.

**Dependências:** `H-65`.
**Tamanho:** P (2 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-74"></a>

### H-74 — As quatro correções locais

> ✅ **CONCLUÍDA em 01/09/2026.** **10 asserções próprias**, suíte de **1713
> para 1723**. Os quatro achados fechados, e os quatro medidos.
>
> **`ACHADO 1` — zero saltos nas sete rotas, e um `h1` em cada.** Medido em
> Chrome 151 sobre a sequência de títulos de cada página: `1` seguido só de `2`,
> nas sete. Antes, `StatCard` e o cartão de contagem de `/alertas` desciam do
> `h1` da `TopBar` direto para `h3` — falha `F43` de `SC 1.3.1`. **A guarda é
> composicional e mora em `web/tests/paginas-montadas.test.tsx`**: o defeito não
> existe dentro de um arquivo, e é o único teste que monta as sete páginas
> **dentro da casca** — as irmãs montam a página sozinha, sem o `h1` que faz o
> salto existir.
>
> **`ACHADO 9` — `min-h-6`, e não `py-1`.** A caixa aninhada media **20 px** com
> `py-0.5` sobre `text-xs`, e o `<ul>` não tem `gap`: dois vizinhos a 20 px de
> centro a centro, e círculos de 24 px se intersectam. `min-h-6` resolve
> `calc(0.25rem * 6)` = **24 px** no CSS servido, e é **relativo** — acompanha a
> ampliação. `py-1` também resolveria, com 28 px, mas apagaria o recuo menor que
> distingue o aninhado da linha de topo.
>
> **`ACHADO 11` — o defeito era a orfandade, não a parada.** Medido: `/historico`
> vai de **26 para 27 paradas**, com **zero órfãs e zero sem nome** nos dois
> esquemas, e o `<svg>` respondendo `role="application"` e "Gráfico da evolução
> mensal". `H-46` matou a parada desligando a camada; com o `aria-hidden` fora e
> um nome no gráfico, ela deixa de ser órfã e passa a ser legítima. A tabela irmã
> nunca esteve em jogo.
>
> **Dois testes provavam o comportamento que esta história reverte**, e foram
> reescritos: um cobrava que o gráfico estivesse dentro de `aria-hidden`, o outro
> que não houvesse `role="application"` nenhum.
>
> **`ACHADO 10` custou uma lição de fiação.** Tirar o `role="status"` do nó que
> nasce populado é uma linha; anunciar pela região viva da casca duplicou o texto
> na tela e **reprovou 17 testes** de uma vez, todos por
> `Found multiple elements`. O padrão do projeto já resolvia: `WorkbookSetup`
> deixa o bloco visível `aria-hidden` e dá ao anúncio uma **frase**, não o
> rótulo. Os dois textos passam a diferir de propósito.
>
> **O `fallback` só existe em `/historico`.** A asserção nasceu em `/`, onde ele
> nunca aparece — é a única rota carregada sob demanda, porque o Recharts
> responde por 374 dos 634 kB do pacote.
>
> **Uma limitação declarada:** o `<svg>` do Recharts **não existe em jsdom** —
> `ResponsiveContainer` mede o pai, e ali todo retângulo é zero. O teste de
> componente afirma o invólucro; a parada nomeada foi medida no navegador. Pelo
> mesmo motivo, o alvo aninhado do ranking é afirmado por classe: nenhuma fixture
> versionada produz grupo de clientes, então o ramo não renderiza.


**Objetivo:** fechar os quatro achados que não referenciam token nenhum e não
dependem uns dos outros.

> **`ACHADO 1`, `ACHADO 9`, `ACHADO 10` e `ACHADO 11`.** Vêm juntos porque a
> onda 2 do revisor os agrupa por **ausência** de dependência, não por
> semelhança: nível de título, altura de alvo, região viva e prop do gráfico.

**Arquivos:**
- `web/src/components/StatCard.tsx` — `h3` vira `h2` (`ACHADO 1`)
- `web/src/pages/Alerts.tsx` — idem, no cartão de contagem
- `web/src/components/RankingBar.tsx` — a linha aninhada chega a 24 px
  (`ACHADO 9`)
- `web/src/App.tsx` — a tela de carregamento deixa de nascer populada
  (`ACHADO 10`)
- `web/src/pages/History.tsx` — o gráfico recupera nome acessível (`ACHADO 11`)
- os testes correspondentes

**Critérios de aceite:**
- **Dado** cada uma das sete páginas, **então** há um `h1` e nenhum salto de
  nível — `h1` da `TopBar` desce para `h2`, nunca para `h3`.
- **Dado** a linha aninhada do ranking, **então** o alvo mede ao menos 24 px de
  altura, ou os vizinhos ficam a 24 px de centro a centro.
- **Dado** a tela de carregamento de `App.tsx`, **então** ela **não** declara
  `role="status"` no nó que já nasce com a mensagem; o anúncio vai pela região
  viva já montada.
- **Dado** o gráfico do Histórico, **então** ele tem nome acessível e
  `accessibilityLayer` no padrão, e a parada de tabulação **não** é órfã.

**Casos-limite:**
- `py-0.5` sobre `text-xs` dá caixa de **20 px**, e o `<ul>` não tem `gap`: 20 px
  de centro a centro. `py-1` resolve 28 px, `min-h-6` resolve 24.
- A linha de topo do ranking já usa `py-1` e **passa** — mexer nela é regressão
  de densidade, não correção.
- O `role="status"` de `App.tsx` é o fallback do `<Suspense>`: o nó nasce
  populado, que é exatamente o que a MDN diz para não fazer.
- Removido o `aria-hidden` do gráfico, `/historico` ganha **uma** parada de
  tabulação — 26 vira 27, medido em `H-65`.
- A `<table>` irmã continua sendo a alternativa textual; ela não sai.

**Fora desta história:** qualquer mudança de tipografia do cartão de contagem —
`C04` só alcança forma, e a divergência de `text-3xl`/`font-mono` contra
`text-2xl` está registrada em `REVISAO-ESTILO.md` sem virar achado.

**Dependências:** `H-65`. Independente de `H-73` por conteúdo; sequencial por
compartilhar `App.tsx` com `H-75`.
**Tamanho:** M (5 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-75"></a>

### H-75 — Um papel de UI, uma forma e um nome

> ✅ **CONCLUÍDA em 01/09/2026.** **7 asserções próprias** — 5 em
> `tests/repo/estilo.test.ts` e 2 de componente. Suíte de **1723 para 1730**.
>
> **`ACHADO 4` — o que divergia não era detalhe.** A borda existia em **3 dos
> 5** botões primários e o `hover` em **2 dos 5**: o mesmo papel com dois
> desenhos e dois comportamentos sob o cursor. Medido depois da extração, em
> Chrome 151 nos dois esquemas: **uma forma só** — `1px` de borda, peso `500`,
> raio `6px` —, com a cor variando apenas entre habilitado e `:disabled`.
>
> **O espaçamento ficou de fora da `@utility`, e é decisão.** `C04` alcança
> forma — raio, borda, sombra —, e o botão do diálogo usa `px-4 py-2` por ser
> confirmação de painel modal. Engolir o `padding` redimensionaria um controle
> sem que regra nenhuma pedisse.
>
> **`ACHADO 6` — alinhar por `aria-label` estava fora, e a razão é normativa.**
> `SC 2.5.3` exige que o nome acessível **contenha** o texto visível, então dar
> `aria-label="Configuração"` a um link que diz "a planilha configurada" seria
> trocar uma falha por outra. **A frase é que se acomodou ao rótulo canônico**:
> "Lendo a planilha apontada em **Configuração**". Medido: dois acessos
> alcançáveis, os **dois** `<a href>`, **um único nome**, e zero botões
> navegando. O terceiro só aparece em estado degradado.
>
> **Três links com o mesmo nome na mesma página é a consequência, e é o que
> `SC 3.2.4` pede.** O efeito colateral apareceu no teste: `findAllByRole`
> passou a devolver o da lateral, que monta primeiro, e os outros dois dependem
> da resposta de `/api/health`. O que os distingue passou a ser o **contexto no
> DOM**, e o teste ganhou um auxiliar para isso.
>
> **`ACHADO 7` — o nome contém o texto visível**, medido: `aria-label` responde
> "Abrir o detalhe de FT101.26" sobre o texto "FT101.26".
>
> **A guarda de `C04` não precisa de lista de exceção**, e isso foi projetado.
> Dois elementos usam `bg-action-bg` com `text-action-fg` e **não** são o papel —
> o link de salto, que é link, e o seletor de janela, que é controle de seleção
> com `aria-pressed`. Nenhum dos dois traz `font-medium` **na mesma linha**: o do
> seletor vive na base do template, fora do ramo de cor. A assinatura é a
> **tripla**, e a mutação reprova as duas asserções de uma vez.
>
> **Quatro testes provavam os nomes antigos** e foram atualizados — dois pelo
> nome do link de configuração, dois pelo nome acessível da REF.
>
> **Duas limitações declaradas, e as duas são da fixture:** a faixa de estado
> degradado e o terceiro acesso à configuração **só existem quando a planilha
> não pode ser lida**, e nenhuma fixture versionada produz isso. Os dois ficam
> cobertos por teste de componente, com o estado montado à mão.


**Objetivo:** o mesmo papel de interface ter a mesma forma e o mesmo nome
acessível nas sete páginas.

> **`ACHADO 4`, `ACHADO 5`, `ACHADO 6` e `ACHADO 7`** — os quatro composicionais
> que sobraram. `SC 3.2.4` incide porque as sete telas têm URIs distintas
> (determinação `Z1` da revisão), então a consistência deixa de ser preferência.
>
> **O `hover` do botão primário existe em 2 de 5**, e some junto na extração.

**Arquivos:**
- `web/src/index.css` — a `@utility` do botão primário
- `web/src/components/ApplyChangesButton.tsx`, `ConflictDialog.tsx`,
  `EditProcessForm.tsx`, `ColorFieldsForm.tsx` e `web/src/pages/WorkbookSetup.tsx`
  — os cinco consumidores
- `web/src/App.tsx` — a faixa de estado passa a `border-y` (`ACHADO 5`)
- `web/src/components/StatusBanner.tsx` — o `<button>` vira `<a href>`
  (`ACHADO 6`)
- `web/src/components/ProcessTable.tsx` — nome acessível do link da REF
  (`ACHADO 7`)
- `tests/repo/estilo.test.ts` e os testes de componente

**Critérios de aceite:**
- **Dado** os cinco botões de ação primária, **então** todos usam a mesma
  `@utility`, e nenhum declara a composição à mão.
- **Dado** as duas faixas de largura total da casca, **então** as duas usam
  `border-y` — elas empilham no mesmo lugar.
- **Dado** navegar para `/configuracao`, **então** os três acessos são `<a href>`
  e convergem para o rótulo canônico de `router.ts`.
- **Dado** abrir `/processo/<ref>`, **então** o nome acessível é o mesmo na
  tabela e na linha de alerta.
- **Dado** `tests/repo/estilo.test.ts`, **então** botão primário com a
  composição escrita à mão reprova.

**Casos-limite:**
- O `<a>` de salto de `App.tsx:114` usa `bg-action-bg` e **não** é botão — fica
  de fora do papel.
- O `WindowPicker` de `History.tsx:257` usa `border-2 border-action-bg` e é
  controle de seleção, não ação primária — também fica de fora.
- Os cinco botões têm estado desabilitado com tokens próprios; a `@utility` não
  pode engoli-lo nem duplicá-lo.
- `StatusBanner` virando `<a href>` precisa do interceptador de modificador de
  `ProcessTable` — clique com `Ctrl` continua abrindo em outra aba.
- `ProcessTable` já contém o texto visível da REF: o `aria-label` tem de
  **conter** esse texto, ou `SC 2.5.3` reprova.

**Fora desta história:** `ACHADO 14`, não normativo por declaração do próprio
revisor.

**Dependências:** `H-73` (o token da faixa) e `H-74` (`App.tsx`).
**Tamanho:** G (9 arquivos, 0 contrato novo)

[↑ Índice](#indice)

---

<a id="h-76"></a>

### H-76 — A coluna Navio cabe no que ela mostra

> ✅ **CONCLUÍDA em 01/09/2026, e com ela `E12`.** **1 asserção própria**, suíte
> de **1730 para 1731**. A fatia inteira é **uma classe** — e a medição é o que
> justifica qual.
>
> **81 → 0 valores cortados na planilha real.** Dos **3591** valores de texto
> livre das seis colunas servidas por `<Text>`, 81 eram cortados pelo teto de
> `max-w-48`, que deixa 168 px de orçamento. Com `max-w-56` são 200 px, e o
> corte vai a zero. As larguras máximas por coluna, medidas com a fonte
> computada da própria célula pelo `measureText` do navegador:
>
> | Coluna | maior valor | cortados antes |
> |---|---|---|
> | **Navio** | **196 px** | **80** |
> | Processo do cliente | 173 px | 1 |
> | BL · Cliente · Contêiner · Importador | 134 · 116 · 108 · 98 | 0 |
>
> **Subir o teto não alarga as outras quatro, e é por isso que a fatia é uma
> classe só.** `max-w` é **teto**, e o algoritmo de tabela dimensiona pelo
> conteúdo: as colunas que já cabiam renderizam na mesma largura com ou sem o
> valor novo. Só muda quem estava sendo cortado — a remedição confirma, com as
> seis larguras idênticas às de antes.
>
> **A densidade de `H-61` não se desfez**, e é o que descarta `break-words`:
> `truncate` traz `white-space: nowrap`, e é ele que segura a altura. Medido nos
> dois esquemas: **40 px** a 1280 e a 320 px, e **60 px** com fonte-base 24 —
> que é 40 × 1,5, e prova que a altura é relativa.
>
> **A 320 px a página não rola**, e a tabela continua contida: rolagem da raiz
> em **0**, invólucro presente, e a rolagem acontecendo dentro dele (`R01`,
> `VN-1`).
>
> **Um resultado absurdo morreu na conferência.** A remedição devolveu o maior
> valor de Navio como **202 px**, contra 196 antes — impossível, porque o
> conjunto de strings é o mesmo. O seletor do script caía no `td` da REF, que é
> `font-mono`, depois que a classe da célula mudou. Com o seletor certo, os seis
> números voltaram aos originais.
>
> **Duas mutações, duas reprovações:** o teto voltando a `max-w-48` reprova, e
> `truncate` virando `break-words` reprova duas vezes.


**Objetivo:** o texto que a tabela corta caber na célula, sem desfazer a
densidade de 40 px.

> **`ACHADO 12`, e a medição reenquadra o achado.** Contra a planilha real,
> 01/09/2026: dos **3591** valores de texto livre das seis colunas servidas por
> `<Text>`, **81 são cortados** — 2,3% —, e **80 deles estão em Navio**. O
> restante é um valor em Processo do cliente. Nenhum passa de **2 linhas** se
> quebrasse.
>
> **Por isso não se troca `truncate` por `break-words`.** `H-69` fez essa troca
> na Performance e mediu o ganho lá; aqui ela desfaria a linha de 40 px que
> `H-61` estabeleceu, e para 2,3% das células. A coluna é que está estreita.

**Arquivos:**
- `web/src/components/ProcessTable.tsx` — a largura por coluna
- `web/tests/Operational.test.tsx`

**Critérios de aceite:**
- **Dado** a coluna Navio, **então** o número de valores cortados na planilha
  real cai a **zero ou perto disso**, medido e registrado.
- **Dado** qualquer linha da tabela, **então** ela continua medindo **40 px** na
  fonte-base padrão — a densidade de `H-61` não se desfaz.
- **Dado** 320 px de viewport, **então** a tabela continua rolando dentro do
  próprio invólucro, e a página não rola (`R01`, `VN-1`).
- **Dado** o valor que ainda não couber, **então** ele continua com o valor
  inteiro em `title`.

**Casos-limite:**
- A soma das larguras não pode fazer a página rolar a 1280 px — a tabela rola
  dentro do invólucro, e é isso que precisa continuar valendo.
- `max-w` é obrigatório: `truncate` sozinho não tem sobre o que incidir numa
  célula que o algoritmo de tabela dimensiona pelo conteúdo.
- A fixture `cores.xlsx` tem **zero** células cortadas — a medição do efeito
  exige a planilha real, e sai dela apenas contagem.

**Fora desta história:** trocar o mecanismo de truncamento, que a determinação 1
do épico descarta.

**Dependências:** `H-75`.
**Tamanho:** P (1 arquivo, 0 contrato novo)

[↑ Índice](#indice)

---

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
