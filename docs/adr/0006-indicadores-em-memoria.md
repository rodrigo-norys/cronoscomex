# ADR-0006 — Indicadores como funções puras sobre o conjunto em memória

**Status:** Aceito · 03/08/2026

## Contexto

Sem banco de dados (ADR-0002), não há SQL. Os 21 indicadores em escopo e os 6
alertas precisam ser calculados em algum lugar, e três lugares são possíveis:
no servidor, no cliente, ou distribuídos entre os dois.

A especificação define regras com muitos casos de fronteira — datas
inclusivas, categorias mutuamente exclusivas, exclusões condicionais, semana
ISO, valores nulos que nunca satisfazem comparação. A auditoria produziu 65
achados, e a maioria virou uma decisão fina sobre um desses limites. Cada uma
dessas decisões precisa ser verificável com dado concreto, sem ambiguidade
sobre onde ela vive.

Há também um fato de escala: **o volume da planilha era desconhecido quando este ADR foi escrito** — `H-01` o mediu em 03/08/2026: 649 linhas, parse em 104 ms contra o teto de 10 s (RNF-13), 117 MB contra o teto de 512 MB (RNF-16). A decisão se sustenta com folga de duas ordens de grandeza (RNF-01,
pendente de `H-01`). A decisão precisa declarar o gatilho objetivo que a
invalidaria.

## Decisão

**Todo cálculo de indicador e alerta é uma função pura, em TypeScript, sobre um
array de `Process` já filtrado, dentro de `src/domain/`.**

Quatro regras decorrentes, todas obrigatórias:

1. **`src/domain/` não importa nada de `src/io/`, `src/app/`, `src/http/` ou
   `web/`.** A regra é verificada pelo lint, e a build falha se violada
   (critério de aceite de `H-02`).
2. **Nenhum cálculo de regra de negócio no cliente** (RNF-38). A interface
   apresenta o que a API devolve; não soma, não filtra por regra, não
   reclassifica.
3. **Nenhum cálculo nas rotas.** As rotas de `src/http/` apenas serializam o
   que `src/domain/` produziu.
4. **O conjunto inteiro vive em memória**, mantido por `process-store`, e é
   recalculado a cada leitura.

### Assinaturas fixadas

```ts
// entrada: sempre um array já filtrado; saída: sempre valor, nunca efeito
export function countByCategory(p: Process[]): CategoryCounts
export function arrivingToday(p: Process[], today: Date): number
export function overdueCount(p: Process[], today: Date): number
export function documentaryLeadTime(p: Process[]): LeadTime
export function groupCount(p: Process[], key: (x: Process) => string,
                           label: (x: Process) => string, topN: number): GroupCount[]
export function buildAlerts(p: Process[], today: Date,
                            stalledDays: Map<string, number>, threshold: number): Alert[]
```

`today` é **parâmetro**, nunca lido de dentro da função. Sem isso, nenhum
indicador de calendário seria testável de forma determinística.

## Consequências

### Positivas

- **Testabilidade total sem infraestrutura.** Testar "processo que chega em
  hoje + 15 conta, hoje + 16 não conta" é montar dois objetos e chamar uma
  função. Sem servidor, sem arquivo, sem banco. É essa propriedade que torna
  viável o alvo de cobertura de 90% (RNF-35) e os 43 casos-limite obrigatórios
  de `08-qualidade-operacao.md §1.3`.
- **Fonte única da regra.** Cada decisão da auditoria existe em exatamente um
  lugar. IND-15 e ALE-01 compartilham a mesma função porque têm a mesma regra
  (A-19) — o que impede que divirjam ao longo do tempo.
- **`today` como parâmetro elimina teste dependente de relógio.** Nenhum teste
  de calendário é intermitente.
- **Desempenho adequado por construção.** O dado já está em memória; não há
  travessia de rede nem de disco no caminho de uma requisição de indicadores.
  Isso sustenta RNF-11 (p95 ≤ 2 s) e RNF-12 (filtros ≤ 300 ms).
- **A camada de domínio é portável.** Se um dia a persistência mudar, as regras
  não mudam junto: elas não sabem de onde vêm os dados.

### Negativas

- **Consumo de memória proporcional ao volume.** Todo o conjunto reside em
  memória o tempo todo. O gatilho de reavaliação está declarado: memória do
  processo acima de **512 MB** (RNF-16) ou parse acima de **10 s** (RNF-13),
  ambos registrados pelos logs de `H-31` no evento `read.done`.
- **Recálculo integral a cada leitura.** Não há cache incremental. Aceitável
  para o volume esperado de uma planilha mantida à mão; se deixar de ser, a
  contingência é R-10, e **exigiria revisar este ADR** — é a única contingência
  do plano com essa consequência.
- **Agregação em código, não em SQL.** Agrupar e ordenar em JavaScript é mais
  verboso que `GROUP BY`, e cada agregação precisa de teste próprio. O ganho de
  testabilidade compensa a verbosidade.
- **A regra de fronteira precisa ser policiada.** Sem o lint, é fácil alguém
  importar um módulo de I/O dentro do domínio "só para pegar a configuração", e
  a propriedade se perde silenciosamente. Por isso a verificação é automática e
  quebra a build.

## Alternativas descartadas

### A1 — Calcular no cliente, a partir da lista bruta de processos

A API devolveria os processos e a interface calcularia tudo. Descartada porque
espalharia 27 regras de negócio pela camada de apresentação, tornaria os testes
dependentes de ambiente de navegador, e faria a lógica ser reimplementada em
qualquer outro consumidor futuro da API. Além disso, transferir o conjunto
inteiro a cada mudança de filtro é desperdício.

### A2 — SQLite em memória, com os indicadores em SQL

Traria `GROUP BY` e uma linguagem de consulta madura. Descartada por instrução
do usuário ("esqueça banco de dados"), e porque testar uma regra passaria a
exigir montar um banco e popular tabelas — trocando um teste de duas linhas por
um de vinte, sem ganho de correção.

### A3 — Cálculo incremental com cache por indicador

Recalcular apenas o que mudou desde a última leitura. Descartada por
otimização prematura: não há medição de volume (RNF-01 pendente) que a
justifique, e o cache invalidado incorretamente é uma das fontes de bug mais
difíceis de diagnosticar. Se R-10 se materializar, esta é a primeira
alternativa a reconsiderar.

### A4 — Classes com estado em vez de funções puras

Um objeto `IndicatorEngine` guardando o conjunto e expondo métodos. Descartada
porque estado interno reintroduz a dependência de ordem de chamada nos testes,
e não traz nenhuma vantagem: o conjunto já é passado como argumento.

## Referências

- ADR-0002 — a decisão de não ter banco
- `04-arquitetura.md §4` — estrutura de diretórios e a regra de dependência
- `08-qualidade-operacao.md §1` — pirâmide de testes e casos obrigatórios
- H-09 a H-14 em `06-backlog.md`
- RNF-13, RNF-16, RNF-38 em `02-requisitos.md`
- R-10 em `07-plano-entrega.md`
