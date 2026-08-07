# CronosComex

Painel operacional de desembaraço aduaneiro. Aplicação **local**: lê a planilha
`.xlsx` do OneDrive, calcula indicadores, e grava de volta no arquivo sob
comando explícito. Sem banco, sem nuvem, sem autenticação.

**O plano está completo em `docs/`. Nenhuma decisão de arquitetura está em
aberto — a implementação é execução, não escolha.** Se você se pegar
escolhendo entre alternativas, a resposta já existe em algum documento; procure
antes de decidir.

## Antes de escrever código

Leia, nesta ordem:

1. `docs/README.md` — índice e estado atual
2. `docs/perfilamento/RESULTADO.md` — os fatos **medidos** sobre a planilha real
3. `docs/06-backlog.md` — a história que você vai implementar (H-NN)
4. `docs/03-modelo-dados.md` — as tabelas de decisão TD-01 a TD-06 e TD-05.1

Para regra de negócio, consulte `docs/01-auditoria-especificacao.md`: os 55
achados (A-NN) explicam **por que** cada regra é como é, cada um citando o
trecho de origem. A especificação original é documento do cliente e **não é
versionada** — a auditoria é autossuficiente, e é ela que vale.

## Regras invioláveis

1. **A planilha é a referência prioritária**, acima da especificação. Quando o
   documento e o arquivo divergirem, o arquivo vence, e a divergência vira
   achado documentado — nunca correção silenciosa.
2. **Nada é descartado em silêncio.** Toda linha não interpretada vai para o
   relatório de quarentena com motivo estruturado.
3. **Nada é adivinhado.** Cor não reconhecida não vira a cor mais próxima; data
   sem ano não recebe ano inventado. Buraco visível é melhor que valor errado
   invisível.
4. **A cor nunca infere o status.** São campos independentes. Medido: 66 linhas
   com STATUS vazio, 1 linha branca.
5. **`src/domain/` não importa `src/io/`, `src/app/`, `src/http/` nem `web/`.**
   O lint verifica e quebra a build.
6. **Nenhuma regra de negócio no cliente ou nas rotas.** Só em `src/domain/`.
7. **Nenhum teste toca a planilha real.** A suíte roda sobre
   `tests/fixtures/*.xlsx`, versionadas.
8. **Nenhum dado pessoal em log.** Processos são referenciados por `ref` e
   `sourceRow` — nunca por nome de cliente, importador ou mercadoria.
9. **Nunca use `workbook.xlsx.writeFile()` do ExcelJS.** Ele perde formatação
   condicional e validações silenciosamente, e pode corromper o arquivo. A
   escrita é cirúrgica no XML — ver ADR-0004.
10. **Nunca processe, indexe, exponha nem registre dados das abas fora de
    escopo.** Só a aba `2026`. A leitura usa fluxo e **pula** as demais abas
    sem consumir suas linhas; nenhuma célula delas vira `RawRow`, chega à API,
    à interface ou ao log. A aba `CNPJ` contém credenciais de terceiros.

    > Redação anterior — "nunca leia as abas" — era tecnicamente inatingível:
    > a aba `CNPJ` tem 250 células que referenciam o pool **global**
    > `xl/sharedStrings.xml`, então nenhuma leitura de texto do arquivo é
    > possível sem carregá-lo inteiro. Limitação do formato OOXML, não da
    > biblioteca. O isolamento real está no processamento e na escrita —
    > **provado**: editar uma célula da aba `2026` deixa 28 das 30 entradas do
    > zip byte a byte idênticas, incluindo as três abas fora de escopo.

## Stack — versões fixadas, verificadas em 03/08/2026

| Camada | Versão |
|---|---|
| Node | **22.23.2** LTS — fixado em `.nvmrc` e `engines` |
| TypeScript | 7.0.2 (fallback declarado: 5.9.3, se a build falhar) |
| Fastify | 5.11.2 |
| ExcelJS | 4.4.0 — **somente leitura** |
| fflate | 0.8.3 — escrita cirúrgica no zip |
| chokidar | 5.0.0 |
| React · Vite | 19.2.8 · 8.2.0 |
| Tailwind | 4.3.3 |
| Recharts | 3.10.1 |
| Vitest | 4.1.10 |
| Biome (lint + format) | 2.5.6 |

Não troque versão sem registrar o motivo. Não acrescente dependência que o
plano não prevê.

## Estrutura

```
src/domain/    funções puras — indicadores, alertas, classificação. Sem I/O
src/io/        leitura e escrita de .xlsx, watcher, histórico, fila de edições
src/app/       process-store, write-guard, config
src/http/      rotas Fastify (só serializam; não calculam)
web/           SPA React (só apresenta; não calcula)
tools/         o perfilador (virada de ano) e o verificador de strip-types
config/        app.json, color-map.json, status-aliases.json
tests/         domain/, io/, fixtures/
```

## Fatos medidos sobre a planilha (H-01, 03/08/2026)

Não re-derive isto; está medido.

- Aba em escopo: **`2026`**, 649 linhas de dados, colunas A–P
- **Todas as datas são seriais reais do Excel.** Zero texto sem ano
- Coluna E = `AGENTE` · Coluna P = `Coluna1`, 99,9% vazia
- **9 chaves de cor**, cobrindo 100% das linhas — em `config/color-map.json`
- Zero REF duplicada, zero REF vazia
- `DOCS ENVIADOS` preenchida em apenas **20,7%** das linhas
- Uma mesma cor vem de **vários `styleId`** — por isso a escrita de cor troca
  `fillId`, nunca `styleId` (ver A-49 e TD-05.1)

## Estado

**Fases 0 e 1 concluídas. Fase 2 em andamento: `H-09` a `H-14` fechadas** — o
épico E3 (indicadores e alertas) está inteiro —, **mais `H-32`, antecipada**
porque é dependência declarada de `H-15` e não existia. Próximo passo:
**`H-15`**, a casca da aplicação com os onze filtros globais, que abre o épico
de interface. As fases estão em `docs/07-plano-entrega.md`.

**`H-15` sai em três entregas**, decidido em 06/08/2026: o tamanho `M` do plano
estava subestimado — domínio de filtros, rota de opções, alteração de duas rotas
existentes, casca React inteira, `FilterBar` de 11 controles, faixa com 3 sinais
e as 3 frentes de A-62. A história continua sendo uma; a execução é ① backend de
filtros · ② casca, faixa e A-62 · ③ `FilterBar`.

A cadeia de ingestão foi validada contra o arquivo real, dentro do limite de
quarentena de RNF-24. **Não transcreva número medido para cá** — a contagem de
testes vem do Vitest, os totais vêm da rota, e cópia manual diverge.

`GET /api/indicators` **está completo desde `H-13`** — os 21 indicadores em
escopo. Ele nasceu parcial em `H-09` e cresceu bloco a bloco, nunca preenchendo
com zero o que ainda não calculava: zero em campo não implementado seria
indistinguível de zero medido. O teste que assegurava a ausência dos últimos
dois campos virou o inverso — fixa a lista completa das chaves, e campo que
entre sem passar pelo contrato quebra a suíte.

**`diffDays` não arredonda, e isso é deliberado.** Toda data do domínio é
meia-noite UTC — `serialToDate` trunca o serial do Excel com `Math.floor`, e
`today` monta a âncora a partir do dia civil —, então a diferença é inteira
**por construção**. Um `Math.round` ali mascararia o dia em que a invariante
quebrasse. A média de IND-22 é que leva uma casa decimal.

**As exclusões de IND-22 são contadas, nunca silenciadas** (A-30). Medido na
planilha real: 1 intervalo negativo e 547 pares incompletos, para 101 válidos —
amostra de 15,6% da base, o que torna `sampleSize` parte do número, não enfeite.
Pela mesma razão `averageDays` é `null` com amostra vazia: zero dias afirmaria
documento enviado no mesmo dia do registro.

**O cruzamento de IND-16 com a categoria é necessário na prática, não em tese.**
A-29 acrescentou `∧ category = 'desembaracado'` a partir de uma única linha da
foto 2; o arquivo real tem **3** linhas com RG preenchido em processo não
desembaraçado. Sem o cruzamento, elas contariam como concluídas.

**IND-14 tem teto e não tem piso:** `eta2 <= hoje+10`, nunca
`hoje <= eta2 <= hoje+10`. Usar `isWithin` ali — o reflexo natural, já que ele
existe para IND-09 — excluiria toda carga que já chegou sem documento, o caso
mais grave. Há teste com `eta2 = 2025-01-01` fixando isso.

**`isOverdue(process, today)` é a regra única de atraso**, em
`src/domain/indicators.ts`. IND-15, ALE-01 e o `overdueCount` do ranking de
agentes são apresentações dela — nunca reimplementar. **`hasPendingDocs` é o
par equivalente para A-08**, extraído em `H-14` pelo mesmo motivo: IND-14 e
ALE-02 são a mesma condição, e ALE-02 precisa da lista, não da contagem.

**A Página Alertas é fila de trabalho, não panorama** (A-59). Por isso
`≠ desembaracado` vale nos **cinco** alertas, e não só em ALE-01 e ALE-02, onde
a especificação era explícita: processo concluído não pede ação, e são 480 de
649 na base. Medido — sem o filtro, 5 dos 14 alertas seriam sobre processos
encerrados, e em Canal Vermelho a maioria. Cada alerta é identificado só por
`ref` e `sourceRow`, nunca por nome de cliente (regra 8); o operador clica e cai
no detalhe.

**Um processo gera um alerta por tipo que satisfaz, e ALE-04 está contido em
ALE-05 por construção** (A-60). O achatamento é do contrato — é o que permite
contar por tipo e ordenar por severidade. **`H-20` agrupa por processo na
exibição**, decisão do usuário: medido, são 40 linhas para 25 processos.

**A fila também muda pela passagem do dia, sem a planilha mudar** (A-62). Nenhum
arquivo muda à meia-noite, então o watcher não dispara e uma tela aberta segue
no dia anterior. `H-15` resolve com três frentes: revalidar no
`visibilitychange` — um timer agendado **não** serve, máquina suspensa não o
executa —, comparar o dia do servidor com o do cliente, e um botão de
atualização que chama `POST /api/reload` antes de refazer as requisições.

**O fuso é resolvido em um único ponto:** `today(tz)` em
`src/domain/date-window.ts` converte o instante corrente para o dia civil no
fuso e o devolve **ancorado em UTC**, igual às datas da planilha. Daí para baixo
nada mais sabe de fuso — por isso `isoWeekEnd` e `arrivingThisWeek` **não**
recebem `tz`. Converter para `America/Sao_Paulo` empurraria toda data para o dia
anterior. Ver a nota de fuso em TD-03.

A recarga automática atende ao limite de 5 s de RNF-14. Arquivo corrompido leva
a `degradado` **preservando as linhas da última leitura boa**.

O log estruturado grava em `data/logs/app-<AAAAMMDD>.jsonl`, com retenção de 30
dias expurgada na partida. **RNF-33 é garantido pelo tipo:** `LogEntry` não tem
campo de texto livre, e a serialização só copia as chaves catalogadas — não há
por onde vazar nome de cliente ou conteúdo de célula.

**Estado `degradado` nunca esvazia o painel.** As rotas de dado devolvem `200`
com a última leitura válida; `503 ARQUIVO_INDISPONIVEL` fica reservado ao caso
em que `lastReadAt === null` — nunca houve leitura, não há o que congelar. O
aviso de dado congelado é uma faixa persistente no topo de **todas** as
páginas, entregue por `H-15` na casca da aplicação (achado A-57).

**Ao pular uma aba fora de escopo, feche o descritor dela** —
`discardWorksheetStream` em `src/io/xlsx-reader.ts`. Não é zelo: quando
`xl/sharedStrings.xml` vem depois das worksheets no zip — o caso de **todos** os
arquivos aqui —, o ExcelJS despeja cada aba num temporário do pacote `tmp` e
abre um `ReadStream` sobre ele antes de emitir a worksheet. Um `continue` puro
deixa esse `open` em voo; a biblioteca apaga o temporário logo em seguida, o
`open` resolve em `ENOENT`, e um stream que emite `error` **sem ouvinte** vira
exceção não tratada — derrubando o exit code **sem reprovar teste nenhum**.

**As duas metades são necessárias.** `destroy()` sozinho foi medido em 3 de 20
rodadas com erro, igual ao baseline: o `open` já está em voo e vai falhar de
qualquer jeito. Com o ouvinte de `error` junto, 0 em 55. Fechar é também **mais**
aderente à regra 10 que pular: em vez de manter aberto um descritor sobre o
conteúdo integral de uma aba fora de escopo, encerra-o de propósito. Nenhuma
célula é materializada nos dois casos.

Isso encerra a dívida que vivia em `tests/support/exceljs-cleanup.ts`, removido.
**`H-33` continua de pé, com outro motivador:** os temporários ainda são
escritos, e o objetivo dela passa a ser que nenhuma aba fora de escopo toque o
disco — regra 10 por construção. O urgente saiu, o estrutural ficou.

**Desligar o paralelismo do Vitest nunca foi o caminho** — foi tentado, dava 0
em 6 localmente e mesmo assim reprovou no runner do GitHub. Reduzir
probabilidade não é corrigir causa; o `vitest.config.ts` mantém o paralelismo
ligado de propósito.

**Interferência externa é sinal, nunca ação** (achado A-58, entregue por `H-32`
em 06/08/2026). A detecção roda num `finally` dentro de `runReload`, então
acontece **mesmo quando a leitura falha** — é justamente com arquivo de conflito
na pasta, ou com o Excel segurando o arquivo, que ela tende a falhar. O sinal
nunca fica preso: deriva do estado da pasta a cada leitura. `H-32` detecta
`~$<nome>.xlsx` (alguém com a planilha aberta) e `*Cópia em conflito*` (o
OneDrive não conseguiu mesclar) e expõe `externalLock`/`conflictFiles` em
`GET /api/health`; a faixa de `H-15` exibe. A leitura acontece igual. **Não é
detectável** quem edita, nem edição em andamento no Excel Online — a coautoria
trava no servidor do SharePoint, e consultar o Graph violaria RNF-31.

### Pendências abertas

Não bloqueiam a implementação. Fechar antes da entrega ao operador.

| # | Pendência | Quando fechar |
|---|---|---|
| **PD-01** | `config/app.json` aponta para `CONTROLE DOS EMBARQUE.xlsx` na **raiz do projeto**, usado para validar a partida em `H-02`. Na máquina Windows precisa do caminho real da pasta sincronizada (`C:\Users\...\OneDrive - <org>\...`). O arquivo está no `.gitignore`, então o caminho de desenvolvimento não vaza | Ao instalar na máquina do operador (`H-30`) |
| **PD-02** | `tests/fixtures/formatado.xlsx` foi aberto no Excel real e **não deu aviso de reparo**, mas isso foi antes da correção do formato de data (A-56). Falta reabrir e confirmar que ETA2 mostra `29/ago`, não `46236` | Antes de `H-24`, que depende dessa fixture |
| **PD-03** | `data/` passou a ser criado em execução por `H-08`, na primeira releitura que grava `quarantine.json` (`H-28` acrescenta o histórico). Está no `.gitignore`. Falta o `README.md` da raiz instruir a criá-lo **fora** da pasta sincronizada do OneDrive, para não replicar backups na nuvem | `H-30` |

Ao fechar uma pendência, remova a linha.

Ao concluir uma história, marque-a em `docs/06-backlog.md` e verifique se algum
status de `docs/09-rastreabilidade.md` mudou.

## Infraestrutura de agente

**Versionamento.** Há repositório git, com remote **privado** em `origin`.
Nunca commite direto na `main`: branch por história (`H-NN/<tipo>-<descrição>`)
ou, fora de história, `<tipo>/<escopo>-<descrição>`. Escopos: `domain`, `io`,
`app`, `http`, `web`, `tools`, `config`, `docs`, `claude`, `repo`. Mensagem em
pt-br, sem o tipo `test`.

**O merge acontece no GitHub, não localmente.** `branch → commits → push da
branch → PR → merge por lá`. Mesclar na `main` antes do push **mata o PR**: a
branch chega ao GitHub já mesclada e não há o que revisar.

**Permissões** (`.claude/settings.json`). `git add`, `git push`, `npm install` e
`npm ci` pedem confirmação. `curl`, `wget`, force-push e leitura ou escrita de
`*.xlsx` e `*.jpeg` da raiz estão negados. O modo bypass está desabilitado.

**`mcp__*` está negado — todo MCP, de todo servidor.** Conector é caminho de
saída que **não passa** pelas regras de `Bash` nem de arquivo: negar `curl` e
deixar `sharepoint_upload_file` aberto seria o inverso do modelo de ameaça. O
glob no nome da ferramenta cobre conector que ainda nem foi criado, e o cliente
remove as ferramentas negadas do contexto. `deny` vence `allow`, então **não há
exceção parcial**: para usar um conector, remova a linha deliberadamente.

**Hooks** (`.claude/hooks/`). `guard-dados-sensiveis.sh` (`PreToolUse`) bloqueia
`git add -A/-f`, redirecionamento para caminho protegido, `git diff --output=`,
remoção recursiva em diretório versionado, e o perfilador gravando dentro do
repositório — falha **fechado**, porque ali o dano é publicar dado de cliente.
Testa por **subcomando**, não sobre a linha inteira: sem isso um `grep "git add"`
casaria como staging real. `conferir-alinhamento.sh` (`ConfigChange`) avisa
quando existe skill ou hook que este arquivo não menciona — falha **aberto**,
porque travar trabalho por documentação atrasada inverte a prioridade.

**`npm run test:strip` roda logo depois do guard, e existe por um defeito real.**
`tools/verificar-strip-types.mjs` importa os 28 módulos de `src/` sob
`--experimental-strip-types`, que é como a aplicação roda de verdade
(`npm start`, `npm run dev`). O modo strip-only apenas **remove** anotações de
tipo e recusa sintaxe que gere código: `parameter property`, `enum`, `namespace`,
decorators. Uma `parameter property` num construtor passou por `lint`,
`typecheck`, 441 testes e `build` — e teria derrubado a aplicação no primeiro
`npm start`. **Nenhuma outra etapa executa `src/` com a flag:** `tsc --noEmit`
não emite, o Vitest usa transformador próprio, e `vite build` só compila `web/`.
Provado que pega: reintroduzir o defeito faz o passo sair com `1`.

**`test-guard.sh` é a regressão do guard**, e roda **primeiro** no
`npm run verify`. O guard é a única camada mecânica de autoria nossa — regra de
permissão é do cliente, skill é instrução —, e uma regex quebrada nele falha em
silêncio: continuaria saindo `0`. Metade dos casos são falsos positivos que
precisam **passar**; dois deles já morderam de verdade. Exige `bash` e `jq`.

**Skills** (`.claude/skills/`). `/fatia H-NN` abre a história com contrato e
casos-limite embutidos · `/novo-indicador IND-NN` conduz um indicador pelo ciclo
das quatro camadas · `/fechar-historia H-NN` roda o portão, percorre a
*definition of done* e imprime a prova · `/sugerir-commits` monta os commits e
decide a branch · `/sugerir-prs` fatia a entrega em PRs. As duas últimas exigem
aprovação do plano **e** permissão para executar.

**`/novo-indicador` existe por causa de uma omissão que se repetiu cinco vezes.**
`src/http/routes/indicators.ts` ficou de fora da lista de arquivos de `H-09` a
`H-13`, sempre — indicador calculado e não servido não existe para o usuário. A
skill fixa os quatro passos (domínio → teste → rota → conferência contra a
planilha real) e carrega as armadilhas já medidas: `null` não é `0`, exclusão se
conta, `eta2 = null` nunca satisfaz calendário, e `isWithin` está errado onde a
janela não tem piso.

**Gates no GitHub** (`.github/workflows/`), em `pull_request` e em `push` na
`main`. `verify.yml` roda o portão inteiro com o Node de `.nvmrc` —
`node-version-file` resolve no CI o mesmo problema que `nvm use` resolve na
máquina. `dados-sensiveis.yml` roda `verifica-dados-sensiveis.sh`, que recusa
planilha fora de `tests/fixtures/`, `config/app.json`, artefato de `data/`,
imagem, perfilamento bruto, caminho absoluto de usuário em código ou
configuração (A-05), e — só onde há usuário real — o nome do dono da máquina em
qualquer arquivo.

**Por que existe, se o hook já cobre:** `guard-dados-sensiveis.sh` é
`PreToolUse` — ele vê o que **o agente** faz. Não roda em commit feito pelo
terminal fora do Claude Code, nem pela interface web do GitHub, nem com o hook
desabilitado. O gate é a única camada que roda sempre.

`test-verifica-dados-sensiveis.sh` é a regressão desse guard, com 19 casos, e
roda **primeiro** no workflow — mesma razão de `test-guard.sh` rodar primeiro no
`verify`. A lista de arquivos vem de `git ls-files`, com
`ARQUIVOS_PARA_VERIFICAR` como ponto de injeção: sem ele a regressão seria
impossível, porque o hook — corretamente — impede montar um índice de teste
contendo planilha e `config/app.json`.

**Falta ligar branch protection na `main`**, exigindo os dois checks e PR. É
configuração do GitHub, não arquivo versionado.

**Ao acrescentar skill, hook, workflow ou regra de permissão, atualize este
bloco.** O hook de alinhamento avisa; quem escreve é você.

## Comandos

```bash
nvm use             # Node 22.23.2, conforme .nvmrc
npm run verify      # guard + strip-types + lint + typecheck + test + build
npm test            # Vitest
npm run dev         # servidor + interface
python3 tools/profile_workbook.py "<caminho.xlsx>" saida.json   # reperfilar
```

> `node: bad option` **não é erro de código**: o shell herdou um Node abaixo de
> `engines`. Prefixe `nvm use &&` — o `nvm use` não persiste entre chamadas.

## Protocolo de fatia — obrigatório ao iniciar qualquer história

**Antes de escrever a primeira linha de código de uma história, apresente ao
usuário o checklist abaixo e aguarde.** Não é formalidade: é o momento em que
um defeito do plano ainda custa uma conversa em vez de um retrabalho. Foi
assim que o erro de `H-27` (trocar `styleId` em vez de `fillId`) apareceu antes
de virar código.

Use **`/fatia H-NN`**: a skill monta o gabarito já com o contrato da história,
os casos-limite obrigatórios e as linhas da rastreabilidade.

Regras do protocolo:

1. **Todos os itens vêm do plano**, copiados, não inventados. Se algo não
   estiver lá, é divergência — reporte na última seção.
2. **A seção "Divergências" nunca é omitida.** Se não houver, escreva
   "nenhuma". Se houver, **pare e aguarde decisão** — não implemente contornando.
3. **"Fora desta fatia" é obrigatório.** Impede que a história cresça e vire G.
4. Use `TodoWrite` em paralelo, para o acompanhamento durante a execução.
5. Ao concluir, invoque **`/fechar-historia H-NN`** — ele roda o portão, percorre
   a *definition of done*, atualiza os três documentos e imprime a prova.

## Marcos de tooling — o que criar, e quando

A estrutura `.claude/` foi deliberadamente mantida mínima. Skill e subagent
escritos antes de existir repetição observada viram adivinhação do próprio
processo e são abandonados. Os gatilhos abaixo são objetivos.

| Gatilho | O que criar | Por quê agora e não antes |
|---|---|---|
| ~~**Ao concluir `H-13`**~~ | ~~Skill `novo-indicador`~~ | ✅ **Criada em 06/08/2026**, ao fechar `H-13`. Saiu da repetição real de `H-09` a `H-13`, com o formato já estabilizado — e com a omissão sistemática da rota como motivo principal |
| **Antes de iniciar a Fase 3** (`H-24`) | Subagent de review para manipulação de XML | `H-24` tem 8 casos-limite (escapes, `sharedStrings`, fórmula órfã, `xml:space`, ordem dos nós) e o custo de errar é a planilha da empresa. É o único ponto do projeto onde revisão adversarial se paga |
| **Ao concluir `H-20`** | Skill `nova-pagina` | Após `H-16` a `H-20` haverá cinco páginas com o mesmo padrão: consumir rota → respeitar filtros globais → estado vazio explícito → nunca calcular no cliente |
| **Se aparecer a aba `2027`** | Reexecutar `H-01` | `python3 tools/profile_workbook.py`, depois `tools/build_fixtures.py`. As abas `2025` e `2024` provam que **o esquema muda entre anos**. Risco R-14 |
| **Nunca** | Subagents para paralelizar o backlog | O caminho crítico é uma cadeia sequencial de 18 sessões (`docs/07-plano-entrega.md §3`). Fan-out não encurta |

## Convenções

- Identificadores em **inglês**; textos de interface e mensagens de erro em
  **pt-br** (o usuário final é brasileiro e não é técnico).
- Comentário no código só onde houver complexidade real — manipulação de XML,
  ordem de avaliação das tabelas de decisão. Código comum se explica.
- Toda regra classificatória precisa de teste com os valores concretos das
  tabelas de decisão. Os 41 casos obrigatórios estão em
  `docs/08-qualidade-operacao.md §1.3`.
