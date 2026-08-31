# 03 — Modelo de Dados e Tabelas de Decisão

Não há banco de dados. O estado autoritativo é o `.xlsx`; a aplicação mantém
uma projeção em memória e três arquivos locais de apoio.

---

## 1. Modelo lógico em memória

### 1.1. `Process` — projeção de uma linha da planilha

```ts
// src/domain/types.ts

/** Categorias canônicas. Mutuamente exclusivas (§2.1 e §2.2 da spec). */
export type StatusCategory =
  | 'desembaracado'
  | 'em_desembaraco'
  | 'em_andamento'
  | 'fechado_aguardando_draft'

export type Responsible =
  | 'colaborador1'
  | 'colaborador2'
  | 'colaborador1_outros_clientes'
  | 'indefinido'

export type CustomsChannel = 'verde' | 'vermelho' | 'indefinido'

export interface Process {
  /** Número da linha na planilha (1-based, como o Excel exibe). Chave de escrita. */
  readonly sourceRow: number

  // ---- Colunas lidas, cruas (trim aplicado, nada mais) ----
  readonly ref: string                    // A  — chave natural
  readonly clientRaw: string              // B  — CLT
  readonly importerRaw: string            // C  — IMPORTADOR
  readonly billOfLading: string           // D  — BL
  readonly agentRaw: string               // E  — AGENTE (P-01)
  readonly container: string              // F  — CNTR
  readonly vesselRaw: string              // G  — NAVIO
  readonly portRaw: string                // H  — ETA (porto, não data)
  readonly goodsRaw: string               // J  — MERCADORIA
  readonly statusRaw: string              // L  — texto original, preservado
  readonly boletoRaw: string              // M  — Coluna 13, fora de escopo
  readonly paymentRaw: string             // N  — R$ ENVIADO, fora de escopo
  readonly columnPRaw: string             // P  — não documentada (P-02)

  // ---- Datas convertidas ----
  readonly eta2: Date | null              // I  — chegada prevista/realizada
  readonly registrationDate: Date | null  // K  — RG, conclusão do desembaraço
  readonly docsSentDate: Date | null      // O  — DOCS ENVIADOS

  // ---- Chaves normalizadas, para agrupamento ----
  readonly clientKey: string              // cliente CONSOLIDADO (H-49, TD-04.1)
  readonly clientProcessKey: string       // chave da célula CLT — o processo do cliente
  readonly clientLabel: string            // rótulo do consolidado: label do mapa, ou a grafia da célula
  readonly clientGroupKey: string         // grupo do filtro (H-55, TD-04.2); '' fora de grupo
  readonly importerKey: string
  readonly agentKey: string
  readonly vesselKey: string
  readonly portKey: string
  readonly goodsKey: string

  // ---- Derivados ----
  readonly statusCategory: StatusCategory
  readonly responsible: Responsible
  readonly customsChannel: CustomsChannel
  readonly importerOutsideRj: boolean | null   // null = cor indefinida
  readonly styleKey: string                    // chave de estilo bruta da célula A

  /** Divergências detectadas nesta linha. Vazio = linha limpa. */
  readonly anomalies: readonly AnomalyCode[]
}

export type AnomalyCode =
  | 'RG_SEM_DESEMBARACO'        // A-05
  | 'INTERVALO_DOCUMENTAL_NEGATIVO' // A-30
  | 'CANAL_EM_TEXTO_STATUS'     // A-06
  | 'DATA_SEM_ANO'              // A-10
  | 'COR_NAO_MAPEADA'           // A-17
  | 'VARIANTE_STATUS_PROXIMA'   // A-03
```

**Chave natural:** `ref`. **Chave de escrita:** `sourceRow` — é a linha que a
escrita cirúrgica endereça, e é estável enquanto ninguém inserir ou remover
linhas no Excel entre a leitura e a gravação; a defesa de hash (`H-25`) cobre
exatamente esse caso.

### 1.2. Mapeamento coluna → campo

| Letra | Cabeçalho | Campo | Tipo | Nulável | Observação |
|---|---|---|---|---|---|
| A | REF | `ref` | string | não | Linha sem REF é ignorada, ver TD-06 |
| B | CLT | `clientRaw` | string | sim (vazio) | |
| C | IMPORTADOR | `importerRaw` | string | sim | |
| D | BL | `billOfLading` | string | sim | Consulta apenas |
| E | AGENTE | `agentRaw` | string | sim | **P-01** — confirmar em `H-01` |
| F | CNTR | `container` | string | sim | Consulta apenas |
| G | NAVIO | `vesselRaw` | string | sim | |
| H | ETA | `portRaw` | string | sim | **Porto**, não data |
| I | ETA2 | `eta2` | Date | sim | Ver TD-03 |
| J | MERCADORIA | `goodsRaw` | string | sim | |
| K | RG | `registrationDate` | Date | sim | Extremidade **final** do intervalo |
| L | STATUS | `statusRaw` | string | sim | Texto preservado, exibido só no detalhe |
| M | Coluna 13 | `boletoRaw` | string | sim | Fora de escopo — lido como texto puro |
| N | R$ ENVIADO | `paymentRaw` | string | sim | Fora de escopo — tipo misto (A-45) |
| O | DOCS ENVIADOS | `docsSentDate` | Date | sim | Vazio = documentação pendente |
| P | (não documentada) | `columnPRaw` | string | sim | **P-02** — confirmar em `H-01` |

---

## 2. Tabelas de decisão

Toda regra classificatória tem tabela com entradas concretas e saída esperada,
incluindo célula vazia, célula só com espaços, variação de caixa e de
acentuação, e valor inesperado. Estas tabelas são a especificação dos testes.

### TD-01 — Classificação da categoria de status

**Ordem de avaliação obrigatória.** A primeira regra que casar decide; as
demais não são avaliadas. A verificação de §2.2 **precede** a de §2.1 (A-22).

| # | Condição | Categoria |
|---|---|---|
| 1 | `ref` vazio após trim | *linha ignorada* — ver TD-06 |
| 2 | `ref` preenchido **e** todas as demais colunas lidas (B–P) vazias após trim | `fechado_aguardando_draft` |
| 3 | `norm(statusRaw)` presente em `status-aliases.json` | `desembaracado` |
| 4 | `statusRaw` vazio após trim | `em_desembaraco` |
| 5 | qualquer outro caso | `em_andamento` |

**Casos concretos:**

| `ref` | outras colunas | `statusRaw` | Saída | Regra |
|---|---|---|---|---|
| `FT498.26` | preenchidas | `DESEMBARAÇADA` | `desembaracado` | 3 |
| `FT498.26` | preenchidas | `DESEMBARÇADA` | `desembaracado` | 3 — variante catalogada (A-03) |
| `FT498.26` | preenchidas | `desembaraçada` | `desembaracado` | 3 — normalização de caixa |
| `FT498.26` | preenchidas | `  DESEMBARAÇADA  ` | `desembaracado` | 3 — trim |
| `FT498.26` | preenchidas | `DESEMBARACADA` | `desembaracado` | 3 — sem acento |
| `FT498.26` | preenchidas | *(vazio)* | `em_desembaraco` | 4 |
| `FT498.26` | preenchidas | `"   "` (3 espaços) | `em_desembaraco` | 4 — trim antes do teste |
| `FT533.26` | preenchidas | `DUIMP: 26BR0001273903-1 - CONFERIDO 29.07` | `em_andamento` | 5 |
| `FT481.26` | preenchidas | `DUIMP: 26BR0001247418-6 - CANAL AMARELO` | `em_andamento` | 5 — e anomalia `CANAL_EM_TEXTO_STATUS` |
| `FT600.26` | *(todas vazias)* | *(vazio)* | `fechado_aguardando_draft` | 2 — **não** `em_desembaraco` |
| `FT600.26` | apenas `boletoRaw = "N/A"` | *(vazio)* | `em_desembaraco` | 4 — "demais colunas" inclui as fora de escopo (A-23) |
| `FT600.26` | apenas `clientRaw = "   "` | *(vazio)* | `fechado_aguardando_draft` | 2 — espaços contam como vazio |
| *(vazio)* | preenchidas | `DESEMBARAÇADA` | *linha ignorada* | 1 |

### TD-02 — Reconhecimento de "Desembaraçada"

`norm(s)` = `s.trim().toUpperCase()` → remoção de diacríticos (NFD, descarte de
`\u0300-\u036f`) → colapso de espaços internos em um único espaço.

`config/status-aliases.json` contém a lista de formas normalizadas aceitas:

```json
{
  "desembaracado": ["DESEMBARACADA", "DESEMBARCADA"]
}
```

- `DESEMBARACADA` — forma canônica de §2.1, após normalização.
- `DESEMBARCADA` — variante observada na foto 2 (A-03).

| Entrada | `norm()` | No dicionário? | Categoria | Anomalia |
|---|---|---|---|---|
| `DESEMBARAÇADA` | `DESEMBARACADA` | sim | `desembaracado` | — |
| `DESEMBARÇADA` | `DESEMBARCADA` | sim | `desembaracado` | — |
| `Desembaraçada` | `DESEMBARACADA` | sim | `desembaracado` | — |
| `DESEMBARAÇADO` | `DESEMBARACADO` | não | `em_andamento` | `VARIANTE_STATUS_PROXIMA` |
| `DESEMBARAÇAD` | `DESEMBARACAD` | não | `em_andamento` | `VARIANTE_STATUS_PROXIMA` |
| `DESEMBARAÇADA EM 30/07` | `DESEMBARACADA EM 30/07` | não | `em_andamento` | `VARIANTE_STATUS_PROXIMA` |
| `AG BL ORIGINAL` | `AG BL ORIGINAL` | não | `em_andamento` | — |

**Regra de aproximação:** um valor cuja distância de Levenshtein até qualquer
forma do dicionário seja **≤ 3** recebe a anomalia `VARIANTE_STATUS_PROXIMA` e
entra no relatório de divergências. Ele **não** é reclassificado
automaticamente — a decisão de acrescentá-lo ao dicionário é humana e se
materializa editando `status-aliases.json`. Isso evita que um texto legítimo
seja convertido em "desembaraçado" por adivinhação.

### TD-03 — Conversão de célula em data

| # | Tipo devolvido pelo leitor | Ação | Resultado |
|---|---|---|---|
| 1 | `Date` | Usar direto, truncando a hora. **Data civil, ancorada em UTC — nunca converter fuso** | `Date` |
| 2 | `number` (serial do Excel) | Converter pelo epoch 1900 do Excel, **respeitando o bug do ano bissexto de 1900** (serial 60 não existe) | `Date` |
| 3 | `string` que casa `^\d{1,2}/\d{1,2}/\d{4}$` | Parse `dd/MM/yyyy` | `Date` |
| 4 | `string` que casa `^\d{1,2}/\d{1,2}/\d{2}$` | Parse `dd/MM/yy`, século 2000 | `Date` |
| 5 | `string` **sem ano** (ex.: `29/jul`, `04/ago`, `29/07`) | **Não inferir o ano** | `null` + anomalia `DATA_SEM_ANO` |
| 6 | `string` vazia ou só espaços | — | `null` |
| 7 | qualquer outro | — | `null` + anomalia `DATA_SEM_ANO` |
| 8 | fórmula com resultado de data | Usar `cell.result` | trata pelas regras 1–2 |

**Casos concretos:**

| Entrada | Saída | Anomalia |
|---|---|---|
| `Date(2026-07-29)` | `2026-07-29` | — |
| `45867` (serial) | data correspondente | — |
| `"29/07/2026"` | `2026-07-29` | — |
| `"29/07/26"` | `2026-07-29` | — |
| `"29/jul"` | `null` | `DATA_SEM_ANO` |
| `"29/07"` | `null` | `DATA_SEM_ANO` |
| `""` | `null` | — |
| `"   "` | `null` | — |
| `"OK 23/07"` | `null` | `DATA_SEM_ANO` |
| `"N/A"` | `null` | `DATA_SEM_ANO` |

> **Sobre fuso horário (corrigido em `H-05`):** o Excel **não armazena fuso** —
> `01/ago` é 01/ago em qualquer lugar do mundo. O leitor interpreta o serial
> como meia-noite **UTC**; converter para `America/Sao_Paulo` (UTC−3) empurra a
> data para o **dia anterior**. Medido: `2026-08-01T00:00:00Z` devolve `31` em
> `getDate()`. As datas da planilha são portanto **datas civis sem fuso**,
> ancoradas em UTC. O `timezone` da configuração vale apenas para determinar o
> que é **"hoje"** (`H-10`), única noção que de fato depende de fuso.

> **A regra 5 é deliberada.** Inferir o ano corromperia silenciosamente todos
> os indicadores de calendário, atraso e tempo. Uma data ausente é um buraco
> visível; uma data errada é um buraco invisível. `H-01` determinará se este
> caminho é exercitado na prática (P-03).

### TD-04 — Normalização de texto para agrupamento

`normKey(s)` = `trim` → maiúsculas → remoção de diacríticos → colapso de
espaços internos. Não corrige digitação (isso é §8, fora de escopo).

| Entrada | `normKey()` | Agrupa com |
|---|---|---|
| `ACME LOG` | `ACME LOG` | — |
| `acme log` | `ACME LOG` | linha 1 |
| `  ACME LOG  ` | `ACME LOG` | linha 1 |
| `ACME  LOG LTDA` | `ACME LOG LTDA` | grupo distinto |
| `ACME - SC` | `ACME - SC` | grupo distinto de `ACME` |
| `NAVIO ALFA` | `NAVIO ALFA` | — |
| `NAVIO ALFHA` | `NAVIO ALFHA` | **grupo distinto** — nomes parecidos não são unificados |
| `""` | `""` | agrupado como `(sem valor)` na exibição |

O rótulo exibido para cada grupo é a **primeira grafia encontrada** na ordem de
linha, não a chave normalizada.

### TD-04.1 — Consolidação do cliente (`H-49`)

A chave de CLT sai de `normKey` e passa por mais uma etapa, **só ela**: a célula
guarda a referência do processo *daquele* cliente, não o cliente. Medido em
31/08/2026: 649 processos produzem **509** valores distintos
(`docs/uso/RESULTADO.md` §2).

`resolveClient` compara a chave contra as entradas de `config/client-map.json`,
na ordem do arquivo, e **a primeira que casa vence** — a ordem é a ferramenta de
desempate do operador.

| Regra | Casa quando | Existe porque |
|---|---|---|
| `prefix` | a chave começa com `value` | é a forma do sufixo numérico crescente |
| `contains` | a chave contém `value` | dois grupos levam o nome do cliente dentro do texto |
| `exact` | a chave é igual a `value` | grupo de valor único |
| `importer` (qualificador, opcional) | além da regra, o importador é o declarado | medido: um prefixo de **62** processos cobre **três** clientes, separáveis só pelo importador |

Resultado, com o mapa real do operador: as 509 chaves caem para **124** — **466**
processos consolidados em **11** clientes, e **183** permanecem com a chave da
célula (62 do prefixo de três clientes, 121 ainda sem regra declarada).

| Situação | `clientKey` | `clientProcessKey` | `clientLabel` |
|---|---|---|---|
| Regra casou | chave do mapa | chave da célula | `label` do mapa |
| Nenhuma regra casou | chave da célula | chave da célula | **primeira grafia** da célula (A-26) |
| Célula vazia | `""` | `""` | `""` |
| Mapa ausente | chave da célula | chave da célula | primeira grafia da célula |

**Não consolidar é resultado legítimo**, não falha: a regra é do negócio e não é
derivável do dado — dois prefixos podem ser o mesmo cliente, e um prefixo pode
ser vários. Inferir aqui seria adivinhar (regra inviolável 3).

**O rótulo do não coberto é a grafia da célula, nunca a chave normalizada.**
`resolveClient` devolve a chave nos dois campos quando nada casa; quem escolhe a
grafia é `process-builder.ts`, para não trocar `zeta comércio` por
`ZETA COMERCIO` na tela.

### TD-04.2 — Grupo de clientes, só no filtro (`H-55`)

A seção `groups` de `client-map.json` reúne clientes **já declarados** em
`clients` num nível de árvore do filtro Cliente. `clientGroupKey` é o grupo do
cliente consolidado, ou `''` quando ele não pertence a nenhum.

| Situação | `clientKey` | `clientGroupKey` |
|---|---|---|
| Cliente membro de um grupo | inalterado | a chave do grupo |
| Cliente fora de qualquer grupo | inalterado | `''` |
| Sem `groups` no arquivo | inalterado | `''` |

**`clientKey` nunca muda por causa do grupo**, e é isso que separa esta tabela
de TD-04.1: o grupo não consolida, ele agrupa a *seleção*. Ranking (IND-10,
IND-18) e tempo documental por cliente (IND-22) seguem contando cada membro
separado — decisão do operador em 31/08/2026, ao escolher entre a árvore que
muda os indicadores e a que não muda.

Erros de carga, todos verificados contra a lista de clientes: membro que aponta
para cliente inexistente, cliente declarado em dois grupos, chave de grupo
repetida, grupo sem membros. Um membro pode declarar `label` próprio — é o que
distingue o cliente que dá nome ao grupo do grupo em si.

### TD-05 — Chave de estilo e mapeamento de cor

A chave de estilo é derivada de `cell.fill` da célula da **coluna A**, sem
qualquer conversão para RGB (ADR-0003).

| Formato de `fill.fgColor` | Chave gerada |
|---|---|
| `{ argb: 'FF00B050' }` | `argb:FF00B050` |
| `{ theme: 4, tint: -0.249977111117893 }` | `theme:4\|tint:-0.2500` (tint arredondado a 4 casas) |
| `{ theme: 0 }` — **sem `tint`** | `theme:0\|tint:0.0000` — **`tint` ausente equivale a zero** |
| `{ indexed: 43 }` | `indexed:43` |
| `fill` ausente, ou `fill.type !== 'pattern'`, ou `pattern === 'none'` | `none` |

**A chave deriva do `fillId`, não do `styleId`.** O perfilamento mediu que uma
mesma cor é produzida por vários `styleId` — `argb:FF00FF00` vem dos styleIds
199, 165 e 189, que compartilham `fillId=2` mas diferem em borda. Para a
**leitura** isso é irrelevante: os três colapsam na mesma chave, que é o
objetivo. Para a **escrita**, é decisivo — ver TD-05.1 (achado A-49).

`config/color-map.json` traduz chave → campos. **O arquivo real, gerado por
`H-01`, está em `config/color-map.json`; o exemplo abaixo é ilustrativo da
estrutura:**

```json
{
  "version": 1,
  "anchorColumn": "A",
  "entries": [
    { "styleKey": "argb:FF0070C0", "label": "Azul",         "responsible": "colaborador1",                 "customsChannel": "indefinido", "importerOutsideRj": false, "styleId": 12 },
    { "styleKey": "argb:FF7030A0", "label": "Roxo",         "responsible": "colaborador2",                   "customsChannel": "indefinido", "importerOutsideRj": false, "styleId": 13 },
    { "styleKey": "argb:FF00B050", "label": "Verde",        "responsible": "indefinido",             "customsChannel": "verde",      "importerOutsideRj": false, "styleId": 14 },
    { "styleKey": "argb:FFFF0000", "label": "Vermelho",     "responsible": "indefinido",             "customsChannel": "vermelho",   "importerOutsideRj": false, "styleId": 15 },
    { "styleKey": "argb:FFFFFF00", "label": "Amarelo forte","responsible": "indefinido",             "customsChannel": "indefinido", "importerOutsideRj": true,  "styleId": 16 },
    { "styleKey": "argb:FFF5F0DC", "label": "Bege",         "responsible": "colaborador1_outros_clientes", "customsChannel": "indefinido", "importerOutsideRj": false, "styleId": 17 },
    { "styleKey": "none",          "label": "Branco",       "responsible": "indefinido",             "customsChannel": "indefinido", "importerOutsideRj": false, "styleId": 0  }
  ]
}
```

### TD-05 — valores reais medidos (H-01, 03/08/2026)

As 9 chaves presentes na aba `2026`, cobrindo **649 de 649 linhas (100%)**.
Taxa de `COR_NAO_MAPEADA` esperada: **0%**.

| Chave de estilo | `fillId` | Linhas | `responsible` | `customsChannel` | `importerOutsideRj` |
|---|---|---|---|---|---|
| `argb:FF00FF00` | 2 | 258 | indefinido | **verde** | false |
| `argb:FF00FF0D` | 12 | 219 | indefinido | **verde** | false |
| `argb:FF5B9BD5` | 8 | 120 | **colaborador1** | indefinido | false |
| `argb:FFA74F7B` | 27 | 31 | **colaborador2** | indefinido | false |
| `argb:FFFFE599` | 9 | 9 | **colaborador1_outros_clientes** | indefinido | false |
| `argb:FFFF0000` | 7 | 5 | indefinido | **vermelho** | false |
| `argb:FFA64D79` | 11 | 5 | **colaborador2** | indefinido | false |
| `argb:FFFFFF00` | 10 | 1 | indefinido | indefinido | **true** |
| `theme:0\|tint:0.0000` | 13 | 1 | indefinido | indefinido | false |

**O canal foi revisto por `H-51` em 31/08/2026.** A cor é um canal de informação
único, disputado por três significados: linha azul diz responsável, e por isso
**não** diz canal. Registrar `nenhum` nela afirmava que se sabia não ter havido
canal — o valor saiu do domínio, e `indefinido` tomou o lugar. Distribuição
medida: **verde 477 · vermelho 5 · indefinido 167**, somando as 649. O amarelo
**mantém** `importerOutsideRj` e não vira canal amarelo (D-02, A-38): um canal
que não existe no dado seria coluna vazia prometendo informação.

Um efeito na **escrita**, que nenhum `fillId` sofreu: o branco compartilhava a
tupla `indefinido|nenhum|false` com os dois verdes e colapsava neles em
`representableTargets`. Com o verde declarando canal, os dois deixaram de
coincidir, e o branco virou o **sétimo** alvo gravável — gravando `fillId` 13,
que é o branco do tema. Nenhuma combinação já alcançável mudou de `fillId`.

Os dois verdes e os dois roxos são **entradas separadas apontando para o mesmo
significado** (A-48) — não há limiar de distância, apenas duas linhas no mapa.

| Chave lida | No mapa? | Resultado |
|---|---|---|
| `argb:FF5B9BD5` | sim | `responsible = colaborador1` |
| `argb:FF00FF0D` | sim | mesmo significado do tom A |
| `theme:9\|tint:0.3999` | não | `responsible/customsChannel = indefinido`, `importerOutsideRj = null`, anomalia `COR_NAO_MAPEADA`, linha no relatório de quarentena |
| `argb:FF00B051` (um bit do verde) | não | idem — **nenhuma aproximação por proximidade é feita** |

**A ausência de aproximação é deliberada.** Um limiar de distância entre cores
transformaria uma decisão de negócio em heurística silenciosa. Repare que os
tons duplicados encontrados (`FF00FF00` × `FF00FF0D`) estão a 13 unidades de
distância em um canal — um limiar os teria unificado "sozinho", e teria
unificado também qualquer cor nova que alguém introduzisse com outro
significado. Duas linhas no mapa custam menos que uma heurística.

### TD-05.1 — Escrita de estilo: trocar um campo da tupla, nunca o `styleId`

Aplicável a **`H-24`** (campo `numFmtId`, ao gravar data) e a **`H-27`** (campo
`fillId`, ao pintar). Medido em A-49: uma mesma cor vem de vários `styleId`, que
diferem em borda e fonte — trocar o `styleId` inteiro destrói o que não estava
em questão. O mesmo raciocínio vale para formato de data (A-56): a célula
precisa ganhar `numFmt` sem perder fonte, borda e preenchimento.

| Passo | Ação |
|---|---|
| 1 | Ler o `s=` atual da célula → `styleId` original |
| 2 | Obter `cellXfs[styleId]` → `(fillId, fontId, borderId, numFmtId)` |
| 3 | Substituir **apenas o campo em questão** — `numFmtId` em `H-24`, `fillId` (do `color-map.json`) em `H-27`. Os outros três são copiados intactos |
| 4 | Procurar em `cellXfs` um `xf` com a tupla resultante já existente |
| 5a | Se existir → usar o índice dele como novo `s=` |
| 5b | Se não existir → **acrescentar** um `xf` novo ao final de `cellXfs`, incrementar `count`, e usar o índice novo |

O passo 5b é a única situação em que `xl/styles.xml` é modificado, e é
**estritamente aditiva**: nenhum `xf` existente é alterado, então nenhuma célula
não envolvida na edição muda de aparência.

| Caso concreto | Resultado |
|---|---|
| Linha com `styleId 199` = `(fill 2, font 1, border 34)`, pintar de azul (`fillId 8`) | Procura `(8, 1, 34, 0)`; existe como `styleId 181` → usa 181 |
| Linha com `styleId 165` = `(fill 2, font 1, border 5)`, pintar de azul | Procura `(8, 1, 5, 0)`; **não existe** → acrescenta `xf` novo, preservando a borda 5 |
| Trocar o `styleId` inteiro por 181, como o plano previa antes | ❌ **Destruiria a borda 5**, substituindo-a pela 34 |
| Célula com `numFmtId 0` (Geral), gravar data (`H-24`) | Procura a tupla com o `numFmtId` de data e os outros três intactos; se não existir → acrescenta `xf` novo. É o caso de `tests/fixtures/data-vazia.xlsx` |
| Célula com `numFmtId 16` (já é data), gravar data (`H-24`) | A tupla não muda → **nenhum `xf` novo**, `s=` preservado, `xl/styles.xml` idêntico |

### TD-06 — REF vazia e REF duplicada

| Situação | Ação | Motivo em quarentena |
|---|---|---|
| `ref` vazio e **toda** a linha vazia | Ignorada, não contada, não reportada | — (linha de preenchimento da planilha) |
| `ref` vazio mas alguma outra coluna preenchida | Quarentena | `REF_AUSENTE` |
| `ref` repetido | A ocorrência de **menor** `sourceRow` é a válida; as demais vão para quarentena | `REF_DUPLICADA` |
| `ref` que difere de outro apenas por caixa ou espaço (`FT498.26` × `ft498.26 `) | Tratados como **o mesmo** REF; segue a regra de duplicidade | `REF_DUPLICADA` |

A comparação de REF usa `normKey()` (TD-04). O valor exibido é a grafia
original da ocorrência válida.

---

## 3. Arquivos locais

Todos ficam sob o diretório de dados da aplicação, ao lado do executável.
Nenhum deles é autoritativo: apagar qualquer um degrada função, não corrompe
dado de negócio.

### 3.1. `data/history.jsonl` — histórico de mudanças de categoria

Append-only, uma linha JSON por evento. Escrito ao final de cada leitura, para
os processos cuja categoria **ou canal** diferiram do último estado conhecido.

```jsonc
{"ts":"2026-08-03T14:22:31.004Z","ref":"FT498.26","from":"em_andamento","to":"desembaracado","channel":"verde","sourceRow":475}
{"ts":"2026-08-03T14:22:31.004Z","ref":"FT533.26","from":null,"to":"em_desembaraco","channel":"vermelho","sourceRow":483}
```

| Campo | Tipo | Significado |
|---|---|---|
| `ts` | ISO 8601 UTC | Instante da leitura que detectou a mudança |
| `ref` | string | REF do processo |
| `from` | `StatusCategory \| null` | Categoria anterior. `null` na primeira vez que o REF é visto |
| `to` | `StatusCategory` | Categoria nova |
| `channel` | `CustomsChannel` | Canal no instante do evento |
| `sourceRow` | number | Linha na planilha no momento do evento |

**Por que `channel` está aqui**, decidido em `H-28`: a Página Histórico pede
evolução mensal de Canal Vermelho (RF-14, A-43), e o canal vem da **cor da
linha** (IND-06), nunca do STATUS — nenhuma agregação de `from`/`to` o produz.
Sem gravá-lo, a terceira medida da série seria inderivável, e o arquivo é
append-only: mês que passa sem registro não se recupera depois.

**Um evento pode ter `from` igual a `to`**: é o caso em que só o canal mudou. A
contagem de dias parados (ALE-06) considera apenas os eventos em que a categoria
de fato mudou — se considerasse todos, trocar a cor de uma linha zeraria o
contador e o alerta deixaria de disparar.

**A leitura aceita um valor que a escrita não produz.** Linhas gravadas antes de
`H-51` (31/08/2026) dizem `channel: "nenhum"`, e o arquivo é append-only: nenhuma
delas pode ser reescrita. Elas são lidas como `indefinido`, que é o que o
domínio novo produz para as mesmas cores. Recusá-las esvaziaria o índice, e cada
REF voltaria a ser visto pela primeira vez — o que reiniciaria a contagem de dias
parados em todos os processos, desarmando ALE-06 justamente no dia da mudança. As
linhas verdes, essas, geram **um** evento com `from` igual a `to`, porque o canal
delas de fato passou a ser conhecido; a série mensal não o vê, já que cada ponto
dela é o estado ao fim do mês, e a tela de detalhe já filtra esse formato.

**Destrava:** ALE-06 ("Processos parados", via `ts` do último evento de cada
REF) e a Página Histórico (série mensal por agregação dos eventos). Resolve
A-33.

**Crescimento:** proporcional ao número de **mudanças**, não ao número de
leituras. Um processo estável não gera evento algum.

**Semântica de "parado":** dias corridos entre `ts` do último evento do REF e
hoje. Um REF sem nenhum evento desde a primeira leitura conta a partir da
primeira leitura — e a interface declara isso, para não sugerir histórico
retroativo que não existe (A-43).

### 3.2. `data/pending-edits.jsonl` — fila de edições não aplicadas

Append-only. A projeção corrente é a **última** entrada por par
`(ref, field)`.

> **Corrigido em `H-23`.** Este parágrafo dizia que `value: null` cancelava a
> edição anterior. Não cancela: **`null` é célula vazia**, e o operador precisa
> dele para limpar uma data. O cancelamento ganhou rotas próprias
> (`DELETE /api/edits/:id` e `DELETE /api/edits`), e o append-only é preservado
> por uma **lápide** — um registro `{"ts":"…","discarded":"<id>"}`, ou
> `"discarded":"*"` para o esvaziamento. Nada é reescrito.
>
> Com `null` valendo cancelamento, o operador ficaria **sem meio** de esvaziar
> uma célula.

```jsonc
{"id":"9f1c2a7e-…","ts":"2026-08-03T14:30:00.000Z","ref":"FT533.26","sourceRow":483,"field":"eta2","value":"2026-08-06","previous":"2026-08-04"}
{"id":"9f1c2a7e-…","ts":"2026-08-03T14:31:12.000Z","ref":"FT533.26","sourceRow":483,"field":"statusRaw","value":"AG BL ORIGINAL","previous":""}
```

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | Identificador único da edição |
| `ts` | ISO 8601 UTC | Momento da edição na tela |
| `ref` | string | Processo alvo |
| `sourceRow` | number | Linha alvo no momento da edição |
| `field` | string | Nome do campo de `Process` |
| `value` | string \| null | Valor novo, já serializado como irá para a célula. `null` cancela |
| `previous` | string | Valor anterior, para exibir o conflito caso o arquivo mude |

Após uma aplicação bem-sucedida, o arquivo é rotacionado para
`data/applied/pending-edits-<timestamp>.jsonl` e recriado vazio. A fila nunca
é apagada sem registro.

### 3.3. `data/quarantine.json` — linhas não interpretadas

Sobrescrito a cada leitura; retrata o estado da leitura corrente.

```jsonc
{
  "generatedAt": "2026-08-03T14:22:31.004Z",
  "sourceFileHash": "sha256:9f2c...",
  "totalDataRows": 0,
  "acceptedRows": 0,
  "quarantinedRows": 0,
  "items": [
    { "sourceRow": 512, "ref": "FT501.26", "reason": "COR_NAO_MAPEADA", "detail": "styleKey=theme:9|tint:0.3999" },
    { "sourceRow": 530, "ref": "",         "reason": "REF_AUSENTE",     "detail": "colunas preenchidas: CLT, NAVIO" }
  ]
}
```

Motivos possíveis: `REF_AUSENTE`, `REF_DUPLICADA`, `COR_NAO_MAPEADA`.

> `totalDataRows`, `acceptedRows` e `quarantinedRows` aparecem zerados acima
> porque são **preenchidos em execução**. Nenhum valor de contagem é afirmado
> neste documento.

### 3.4. `data/backups/` — cópias do `.xlsx`

Nome: `planilha-<AAAAMMDD-HHmmss>.xlsx`. Gravado imediatamente antes de cada
escrita. Expurgo conforme RNF-21.

### 3.5. Configuração

| Arquivo | Conteúdo |
|---|---|
| `config/app.json` | Caminho do `.xlsx`, nome da aba, linha do cabeçalho, porta HTTP, limiar de "processo parado" |
| `config/color-map.json` | TD-05 |
| `config/status-aliases.json` | TD-02 |

`config/app.json`:

```jsonc
{
  "workbookPath": "C:\\Users\\<usuario>\\OneDrive - <org>\\<pasta>\\planilha.xlsx",
  "sheetName": null,          // null = primeira aba (P-04)
  "headerRow": 1,
  "firstDataRow": 2,
  "port": 5173,
  "stalledDaysThreshold": 15, // A-32
  "topN": 10,                 // A-25
  "timezone": "America/Sao_Paulo"
}
```

---

## 4. Normalização de entidades — decisão

Entidades hoje em texto livre (CLT, IMPORTADOR, AGENTE, NAVIO, ETA/porto)
**não** viram tabela de referência com chave estrangeira.

**Motivo:** a fonte da verdade é um arquivo `.xlsx` sem restrição de
integridade. Criar uma tabela de referência exigiria manter o vínculo
sincronizado com um texto que muda a cada digitação, e produziria uma segunda
verdade — exatamente o que o ADR-0001 evita.

**Decisão:** normalização determinística em memória (TD-04), com chave
calculada por linha. O agrupamento acontece pela chave; a exibição usa a
primeira grafia encontrada. A deduplicação por sinônimo conhecido (por
exemplo, unificar `NAVIO ALFA` e `NAVIO ALFHA`) é explicitamente **fora de
escopo** — §8 da especificação a lista como melhoria futura, e implementá-la
sem dicionário de negócio seria inventar regra.

---

## 5. Colunas listadas como melhoria futura (§8) — avaliação individual

O usuário determinou que **não haverá colunas novas**. A avaliação abaixo
registra o custo dessa decisão, item a item, para que a escolha fique
documentada e possa ser revista no futuro com os fatos à mão.

| Coluna sugerida em §8 | Resolve lacuna atual? | Recomendação técnica | Decisão |
|---|---|---|---|
| `RESPONSÁVEL` (texto) | Sim — elimina a dependência de ler formatação e resolve a colisão de dimensões da cor (A-31) | Incluir seria o maior ganho de robustez do projeto por menor custo | **Adiada** por decisão do usuário. Custo: responsável continua ilegível quando a linha é vermelha ou verde |
| `CANAL` (texto) | Sim — hoje Canal Amarelo é irrecuperável (A-37, A-38) | Incluir | **Adiada** por decisão do usuário. Custo: nenhum indicador de Canal Amarelo é possível |
| `DATA_PRESENÇA_DE_CARGA` | Sim — é a única lacuna que bloqueia IND-21 | Incluir destravaria o indicador para processos novos | **Adiada** por decisão do usuário. Custo: IND-21 permanece fora de escopo |
| `DATA_ÚLTIMA_ATUALIZAÇÃO` | **Não** — resolvida por outra via | Desnecessária: `history.jsonl` (ADR-0005) já fornece "parado há quantos dias" sem tocar na planilha | **Descartada** com justificativa técnica, não por restrição |
| `CATEGORIA_MACRO` (mercadoria) | Sim — resolve a distorção de "BAZAR" em IND-13 | Incluir melhoraria IND-13, que hoje tem valor analítico baixo | **Adiada** por decisão do usuário. Custo: IND-13 entregue com a limitação declarada na própria tela (A-34) |

Nenhuma foi copiada como "backlog futuro" sem análise: duas têm custo alto
declarado (RESPONSÁVEL, CANAL), uma bloqueia um indicador inteiro
(DATA_PRESENÇA_DE_CARGA), uma foi **descartada por ser desnecessária**
(DATA_ÚLTIMA_ATUALIZAÇÃO) e uma degrada um indicador entregue
(CATEGORIA_MACRO).
