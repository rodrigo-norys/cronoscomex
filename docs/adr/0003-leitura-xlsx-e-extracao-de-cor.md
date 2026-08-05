# ADR-0003 — Extrair a cor como chave de estilo literal, sem resolver RGB

**Status:** Aceito · 03/08/2026

## Contexto

A especificação (§3) define três regras de negócio que **não existem em
nenhuma coluna de texto** — existem apenas como cor de preenchimento da linha:

| Cor | Significado |
|---|---|
| Azul | Processos da Samira |
| Roxo | Processos do Hugo |
| Bege | Processos da Samira, de outros clientes |
| Vermelho | Canal Vermelho |
| Amarelo forte | Importador fora do RJ |
| Verde | Desembaraçado (confirmação visual) |
| Branco | Em desembaraçamento (confirmação visual) |

Ler essa formatação é condição de existência do produto — é o critério
eliminatório do ADR-0002. Duas descobertas moldam esta decisão:

**Primeira: a biblioteca nem sempre devolve a cor resolvida.** ExcelJS retorna
`fgColor` ora como `{ argb: 'FF92D050' }`, ora como
`{ theme: 4, tint: -0.249977111117893 }`, dependendo de como a cor foi aplicada
na planilha. O defeito está aberto desde 27/04/2021
([issue #1690](https://github.com/exceljs/exceljs/issues/1690)). Converter
`theme + tint` em RGB exigiria reimplementar o algoritmo de modulação de
luminância do OOXML e resolver a paleta do tema em `xl/theme/theme1.xml` — uma
cadeia de conversão com muitas oportunidades de errar por pouco.

**Segunda: a cor não é uniforme ao longo da linha.** A foto 2 da planilha real
mostra que as colunas M, N e O têm preenchimento próprio, independente da cor
da linha: N é ciano fixo e O é cinza fixo, enquanto K e L acompanham a cor.
Ler a cor de uma coluna arbitrária produziria o valor errado (achado A-44).

## Decisão

### 1. A chave de estilo é literal, e nunca convertida em RGB

Qualquer que seja a forma devolvida pela biblioteca, ela é **serializada como
está** e usada como chave opaca:

| Forma devolvida | Chave gerada |
|---|---|
| `{ argb: 'FF00B050' }` | `argb:FF00B050` |
| `{ theme: 4, tint: -0.249977111117893 }` | `theme:4\|tint:-0.2500` |
| `{ indexed: 43 }` | `indexed:43` |
| ausente, não-padrão, ou `pattern: 'none'` | `none` |

Um arquivo versionado, `config/color-map.json`, traduz chave → significado. Ele
é preenchido com as chaves **reais** produzidas por `H-01` sobre a planilha
verdadeira.

O `tint` é arredondado a **4 casas decimais** para que a chave seja estável
entre leituras, sem sofrer com ruído de ponto flutuante.

### 2. A célula da coluna A é a âncora da cor da linha

A cor do processo é lida da célula de REF. As demais colunas são ignoradas para
esse fim.

### 3. Cor não reconhecida vai para quarentena, nunca é aproximada

Não há tolerância, limiar de distância entre cores nem correspondência por
proximidade. `argb:FF00B051`, a um bit do verde `argb:FF00B050`, é
**não reconhecida**. A linha entra nos indicadores de volume com os campos
derivados em `indefinido`, e aparece no relatório de quarentena com o motivo
`COR_NAO_MAPEADA` e a chave literal, para que a correção seja um acréscimo ao
JSON.

## Validação empírica (H-01, 03/08/2026)

O perfilamento sobre o arquivo real testou esta decisão e produziu três
resultados relevantes.

**1. O defeito do ExcelJS quase não é exercitado.** Das 9 chaves da aba `2026`,
**8 são `argb` explícito** e apenas 1 é de tema (`theme:0|tint:0.0000`,
1 linha), com tint zero. R-05 cai de score 12 para 4. A decisão continua
correta — e passou a ser barata.

**2. A ausência de tolerância se provou necessária.** O arquivo tem **dois tons
de verde** (`FF00FF00`, 258 linhas · `FF00FF0D`, 219) e **dois de roxo**
(`FFA74F7B`, 31 · `FFA64D79`, 5), visualmente indistinguíveis. Um limiar de
proximidade os teria unificado sozinho — e teria unificado também qualquer cor
nova que alguém introduzisse com outro significado. Sob esta decisão, os quatro
tons apareceram no relatório, foram levados ao usuário, e viraram **quatro
entradas explícitas** no mapa. Duas linhas de JSON custam menos que uma
heurística silenciosa (achado A-48).

**3. A chave precisa derivar do `fillId`, não do `styleId`.** Medição: uma
mesma cor é produzida por vários `styleId` — `argb:FF00FF00` vem dos styleIds
199, 165 e 189, que compartilham `fillId=2` mas diferem em **borda**. Para a
leitura isso é exatamente o desejado: os três colapsam na mesma chave. Para a
**escrita**, obrigou a corrigir `H-27`, que trocava o `styleId` inteiro e
destruiria bordas — ver TD-05.1 e o achado A-49.

**Cobertura resultante:** as 9 entradas de `config/color-map.json` cobrem
**649 de 649 linhas (100%)**. Taxa esperada de `COR_NAO_MAPEADA`: **0%**.

## Consequências

### Positivas

- **O defeito #1690 do ExcelJS deixa de importar.** Uma chave
  `theme:4|tint:-0.2500` é tão mapeável quanto `argb:FF00B050`. O que seria um
  bloqueio vira uma linha de configuração. É por isso que R-05 tem impacto 4 e
  não 5.
- **Determinismo total.** A mesma célula produz sempre a mesma chave; o mesmo
  mapa produz sempre a mesma classificação. Não há aritmética de cor, logo não
  há resultado de fronteira.
- **Nenhuma regra de negócio é adivinhada.** Uma cor nova é uma pendência
  visível, não uma classificação silenciosamente errada.
- **Correção sem recompilar.** Ajustar o mapeamento é editar um JSON.
- **A chave serve também para escrever.** Cada entrada guarda o **`fillId`**
  correspondente, o que permite a `H-27` trocar a cor de uma linha substituindo
  apenas o preenchimento dentro do `cellXf` e **preservando borda, fonte e
  formato numérico** de cada célula (TD-05.1). Guardar `styleId` teria sido o
  erro — ver A-49.

### Negativas

- **`H-01` era obrigatória antes de qualquer coisa** — o mapa não pode ser
  escrito sem conhecer as chaves reais, e sem o mapa toda linha cairia em
  quarentena. ✅ Executada em 03/08/2026; `config/color-map.json` cobre 100%.
- **Uma cor visualmente idêntica mas tecnicamente distinta exige entrada
  própria.** ⚠️ **Confirmado na prática:** o arquivo tem dois verdes e dois
  roxos indistinguíveis a olho, e o mapa precisou de 4 entradas para 2
  significados. O relatório de `H-01` tornou isso visível de imediato, mas
  resolver exigiu decisão humana.
- **Alterar a cor de um estilo dentro do Excel** — mudando a definição do
  estilo, não a célula — mudaria a chave e invalidaria o mapeamento em massa. O
  sintoma seria um pico de `COR_NAO_MAPEADA` na quarentena, detectável na
  primeira leitura seguinte.
- **A âncora depende de P-05** — ✅ confirmada: 649 de 649 linhas com REF têm
  chave de estilo na célula A.
- **A cor codifica dimensões concorrentes** (A-31): uma linha tem uma cor, mas
  a especificação lhe atribui quatro significados de dimensões diferentes. Um
  processo da Samira em Canal Vermelho perde o responsável. Esta decisão **não
  resolve** esse problema — ele é da origem do dado, e está registrado como
  R-02, com a contingência sendo criar as colunas de texto que §8 sugere.

## Alternativas descartadas

### A1 — Resolver `theme + tint` para RGB

Exigiria ler `xl/theme/theme1.xml`, extrair a paleta, aplicar a modulação de
luminância do OOXML em espaço HLS e, então, comparar cores. Descartada por três
razões: introduz uma cadeia de conversão inteira só para produzir uma chave que
já se tinha; qualquer erro de arredondamento vira classificação errada de
processo; e não traz nenhum benefício, já que o destino da cor é sempre uma
tabela de tradução — resolver para RGB apenas troca a chave do mapa por uma
menos confiável.

### A2 — Correspondência por proximidade de cor

Converter tudo em RGB e classificar pela cor mais próxima dentro de um limiar.
Descartada porque transformaria uma regra de negócio em heurística: o limiar
seria arbitrário, e uma cor nova seria absorvida pela vizinha mais próxima sem
que ninguém percebesse. Sob esta decisão, cor nova é pendência visível; sob
aquela, seria erro invisível.

### A3 — Ler a cor da linha inteira e votar pela cor majoritária

Descartada pela evidência de A-44: as colunas M, N e O têm preenchimento fixo
próprio, independente do processo. A cor majoritária de uma linha poderia ser o
cinza da coluna O.

### A4 — Ler a cor pelo atributo de estilo do `<row>` em vez das células

O OOXML permite estilo em nível de linha. Descartada porque a planilha aplica
cor por seleção de intervalo de células — visível nas fotos, em que a cor
termina na coluna L — e não por formatação de linha inteira.

### A5 — Exigir colunas de texto `RESPONSÁVEL` e `CANAL`

É a solução correta do ponto de vista de modelagem, e a própria especificação a
sugere em §8. Descartada por decisão do usuário: não haverá colunas novas. O
custo dessa decisão está quantificado em `03-modelo-dados.md §5` e em R-02.

## Referências

- `03-modelo-dados.md` TD-05 — a tabela de decisão completa
- A-31, A-44 em `01-auditoria-especificacao.md`
- `docs/assets/color-map.exemplo.json` — esqueleto do mapa
- H-01, H-04, H-27 em `06-backlog.md`
- R-02, R-05 em `07-plano-entrega.md`
