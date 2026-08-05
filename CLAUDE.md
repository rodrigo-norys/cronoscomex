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
achados (A-NN) explicam **por que** cada regra é como é. A especificação
original (`especificacao-dashboard-comex.md`) tem defeitos conhecidos e
documentados — não a siga literalmente sem checar a auditoria.

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
tools/         profile_workbook.py — o perfilador, para a virada de ano
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

**Fases 0 e 1 concluídas. Fase 2 em andamento: `H-09` a `H-11` fechadas.**
Próximo passo: **`H-12`** — indicadores de risco.
As fases estão em `docs/07-plano-entrega.md`.

A cadeia de ingestão foi validada contra o arquivo real, dentro do limite de
quarentena de RNF-24. **Não transcreva número medido para cá** — a contagem de
testes vem do Vitest, os totais vêm da rota, e cópia manual diverge.

`GET /api/indicators` **nasce parcial**: devolve só os blocos já calculados, e
cresce a cada história de `H-12` a `H-13`. Zerar campo não calculado o tornaria
indistinguível de zero medido.

**`isOverdue(process, today)` é a regra única de atraso**, em
`src/domain/indicators.ts`. IND-15, ALE-01 e o `overdueCount` do ranking de
agentes são apresentações dela — nunca reimplementar.

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

**Interferência externa é sinal, nunca ação** (achado A-58). `H-32` detecta
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
ou, fora de história, `<tipo>/<escopo>-<descrição>`. Merge sempre com `--no-ff`.
Escopos: `domain`, `io`, `app`, `http`, `web`, `tools`, `config`, `docs`,
`claude`, `repo`. Mensagem em pt-br, sem o tipo `test`.

**Permissões** (`.claude/settings.json`). `git add`, `git push`, `npm install` e
`npm ci` pedem confirmação. `curl`, `wget`, force-push e leitura ou escrita de
`*.xlsx` e `*.jpeg` da raiz estão negados. O modo bypass está desabilitado.

**Hooks** (`.claude/hooks/`). `guard-dados-sensiveis.sh` (`PreToolUse`) bloqueia
`git add -A/-f`, redirecionamento para caminho protegido, `git diff --output=`,
remoção recursiva em diretório versionado, e o perfilador gravando dentro do
repositório — falha **fechado**, porque ali o dano é publicar dado de cliente.
`conferir-alinhamento.sh` (`ConfigChange`) avisa quando existe skill ou hook que
este arquivo não menciona — falha **aberto**, porque travar trabalho por
documentação atrasada inverte a prioridade.

**Skills** (`.claude/skills/`). `/fatia H-NN` abre a história com contrato e
casos-limite embutidos · `/fechar-historia H-NN` roda o portão, percorre a
*definition of done* e imprime a prova · `/sugerir-commits` monta os commits e
decide a branch · `/sugerir-prs` fatia a entrega em PRs. As duas últimas exigem
aprovação do plano **e** permissão para executar.

**Ao acrescentar skill, hook ou regra de permissão, atualize este bloco.** O
hook de alinhamento avisa; quem escreve é você.

## Comandos

```bash
nvm use             # Node 22.23.2, conforme .nvmrc
npm run verify      # lint + typecheck + test + build — portão obrigatório
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
| **Ao concluir `H-13`** | Skill `novo-indicador` | Ali você terá feito `H-09` a `H-13` — cinco histórias com o mesmo ciclo: função pura em `src/domain/indicators.ts` → teste com os valores da tabela de decisão → campo no schema de `GET /api/indicators` → cartão na interface. A skill sai da repetição real, com o formato já estabilizado |
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
