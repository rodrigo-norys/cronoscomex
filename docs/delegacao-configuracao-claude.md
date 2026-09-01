# Diagnóstico de infraestrutura de delegação — CronosComex

**Data:** 04/08/2026 · **Objeto:** `.claude/` e `CLAUDE.md` da raiz, sob a
ótica do **custo de supervisão**, não de segurança.
**Nada foi aplicado.** Este documento é o único arquivo escrito. Nenhum arquivo
de configuração foi criado, editado ou removido; nenhum comando alterou o estado
do repositório.

**Caminhos negados pela configuração vigente** (`config/app.json` e `data/**`)
**não foram inspecionados por nenhuma via, inclusive shell.** O que dependia
deles virou pergunta na seção 11.

> **Janela de medição — o alvo se moveu durante a análise.** `H-11` foi fechada
> no meio deste diagnóstico: o `CLAUDE.md` passou de 246 para **261 linhas** e o
> bloco `## Estado` de *"`H-09` e `H-10` fechadas, próximo `H-11`, 252 testes"*
> para *"`H-09` a `H-11` fechadas, próximo `H-12`, 279 testes"*. **Todos os
> números e todas as referências de linha deste documento são os do estado final
> medido**, com `CLAUDE.md` em 261 linhas. O fato de o alvo ter se movido dentro
> de uma sessão é, ele próprio, medida da cadência que este diagnóstico trata.

---

> ## ⚠ Correção de 05/08/2026 — o diagnóstico da LAC-1 está incompleto
>
> **O texto original abaixo foi preservado**, conforme a regra inviolável 1 do
> projeto. Este documento foi **aplicado em 05/08/2026**, em três commits.
>
> **A DIV-3 (l. 31) está certa:** `nvm` existe no shell do agente, e a auditoria
> anterior errou ao afirmar o contrário.
>
> **Mas a LAC-1 (l. 352) para na metade.** Ela diz que *"o que não existe é
> persistência de estado entre chamadas de Bash"*. Verdadeiro — e insuficiente.
> A não-persistência só machuca porque **o estado herdado está errado**.
>
> Medido em 05/08/2026:
> - `systemctl --user show-environment` **não declara** `NVM_BIN` nem caminho do
>   nvm no `PATH` — a sessão gráfica está limpa;
> - `~/.zshenv` não existe e o `.zshrc` não força versão alguma;
> - o `default` do nvm já era `22.23.2`;
> - um login zsh com ambiente zerado seleciona **`v22.23.2`**.
>
> A contaminação entra **no lançamento do VSCode**, a partir de um shell que
> tinha `nvm use 20` ativo; daí todo processo filho herda. **Numa sessão lançada
> limpa, nenhum prefixo `nvm use &&` é necessário.**
>
> **Consequência para o roteiro:** o item 1 da §7.1 não é o conserto, é o
> seguro. O conserto custa zero e não é configuração — é relançar o editor de um
> terminal do sistema. `Bash(nvm use)` foi aplicado assim mesmo, porque o
> lançamento pode vir sujo de novo e o sintoma (`node: bad option`) não se parece
> com problema de ambiente.
>
> **Duas incertezas da §10 foram resolvidas na prática:**
> 1. **`$ARGUMENTS` é substituído antes** de o comando `` !`…` `` executar. O
>    plano B da §8.2 é desnecessário e não foi aplicado.
> 2. Armadilha nova, não prevista: **`$0` em corpo de skill vira o primeiro
>    argumento**, então um `awk` que use `$0` quebra. A extração da seção do
>    backlog foi feita com `sed`, e com limite de seção em vez de janela fixa —
>    o `-A 95` do artefato original trazia **47 linhas da história seguinte**.
>
> Ver `docs/governance-tooling-claude.md`, adendo de execução.

---

## 0. Divergências entre o enunciado e o que foi medido

O enunciado manda registrar divergência e fazê-la prevalecer. Três.

| # | O enunciado diz | Medido | Consequência |
|---|---|---|---|
| **DIV-1** | *"Infraestrutura de agente hoje: `.claude/settings.json` com apenas um bloco de permissões."* | Correto — mas existe também **`docs/auditoria-configuracao-claude.md`, 1413 linhas, datada de 04/08/2026**, que já auditou o mesmo objeto sob a ótica de **segurança**, produziu 11 achados (A-01 a A-11), 7 decisões de usuário (D-1 a D-7) e artefatos prontos — **nenhum aplicado** | Este diagnóstico **não reabre** nada decidido lá. Onde há sobreposição, cito e me subordino. Onde discordo, digo em qual ponto e por quê (ver LAC-2 e §6) |
| **DIV-2** | *"há caminhos negados à leitura do agente"* | Dois, e ambos **deixam de casar em qualquer outra máquina**: são caminhos absolutos `//home/usuario/...` (já é o achado A-05 da auditoria anterior) | A instalação em `H-30` desprotege os dois em silêncio. Não é lacuna minha; é a A-05, ainda aberta |
| **DIV-3** | — | **`nvm` está disponível no shell do agente** e `nvm use` funciona (medido: leva a `v22.23.2`). A auditoria anterior afirma que *"`nvm` é função de shell e não existe como binário no shell não interativo do agente"* | **Correção factual.** O defeito real não é ausência do `nvm`, é **não-persistência de estado entre chamadas de Bash**. Isso muda a recomendação: não é para remover a linha do `CLAUDE.md`, é para acrescentar uma regra de permissão e uma linha de explicação. É o movimento nº 1 deste diagnóstico |

---

## 1. Sumário — os três movimentos de maior redução de supervisão

### M-1 · `Bash(nvm use)` no `allow` + uma linha no `CLAUDE.md`

**Tarefa:** qualquer comando que execute Node — o portão `npm run verify`
(obrigatório em toda história) e `npm run dev` (conferência contra o arquivo
real).

**Medido, nesta máquina, hoje:**

```
$ node --version                                            → v20.19.5
$ node --experimental-strip-types -e "1"                    → node: bad option
$ nvm use >/dev/null && node --version                      → v22.23.2
$ node --experimental-strip-types -e "1"   (após nvm use)   → OK
$ node --version   (chamada Bash seguinte, shell novo)      → v20.19.5
```

`package.json` declara `"engines": { "node": ">=22.12.0 <23" }` e os scripts
`dev` e `start` usam `--experimental-strip-types`. **Na versão que o shell do
agente carrega por padrão, `npm run dev` e `npm start` falham** com
`node: bad option`, que não se parece com um problema de ambiente — parece
problema de código.

**Elimina:** 1 diálogo de permissão **por chamada** que precise de Node 22
(hoje `nvm use && npm run verify` **pede permissão**, porque cada subcomando de
um comando composto precisa casar uma regra própria e `nvm use` não casa
nenhuma, nem está no conjunto somente-leitura embutido), **e** uma classe
inteira de diagnóstico errado. Com 20 histórias restantes e ao menos uma
execução do portão por história, o piso é **20 diálogos** e o teto é uma
sessão inteira perdida investigando um `bad option`.

**Custo:** duas linhas — uma no `allow`, uma no bloco de comandos do
`CLAUDE.md`. Ramo **R6** (atrito sobre operação segura, frequente, de escopo
estreito) + **R5** (fato invariante que muda decisão em qualquer sessão).

### M-2 · Skill `/fatia` — abrir uma história

**Tarefa:** o protocolo de fatia, obrigatório antes da primeira linha de código
de **cada** história (`CLAUDE.md:192-237`; `docs/10-governanca.md:79`, primeiro
item da *definition of done*).

**Elimina:** a ida-e-volta de abertura em cada uma das **20 histórias
restantes** — o usuário deixa de precisar dizer onde está o contrato, quais
casos-limite são obrigatórios e qual é o gabarito. A skill injeta os três por
contexto dinâmico, com o número da história como argumento.

**Ganho estrutural que só a skill tem:** o corpo de uma skill invocada é
**reinjetado após a compactação** (até 5.000 tokens por skill, 25.000 no total);
a saída da ferramenta `Read` **não é** — ela é resumida junto com o resto do
histórico ([Janela de contexto → O que sobrevive à
compactação](https://code.claude.com/docs/pt/context-window#what-survives-compaction),
04/08/2026). Numa cadeia de 18 sessões, o contrato da história é hoje a
instrução crítica mais frágil do projeto (§2.1).

**Custo:** um arquivo de ~55 linhas **e a remoção das 25 linhas do gabarito
markdown do `CLAUDE.md`** (`CLAUDE.md:202-226`) — sem essa remoção o item vira
anti-padrão de duplicação e piora o problema. Saldo de contexto fixo:
**negativo** (§7.3). Ramo **R2**.

### M-3 · Skill `/fechar-historia` — fechar uma história

**Tarefa:** a *definition of done* de história — 8 itens, 3 documentos
(`docs/06-backlog.md`, `docs/09-rastreabilidade.md`, bloco `## Estado` do
`CLAUDE.md`), repetida 12 vezes até aqui e mais **20 vezes** pela frente.

**Elimina:** a conferência manual de 8 itens em 3 arquivos, 20 vezes. O critério
de aceite não é a promessa da skill: são **três `grep` que a própria skill
imprime no fim**, e que o usuário lê em segundos em vez de reabrir três
documentos.

**E fecha um defeito medido:** das 12 histórias concluídas, **11 carregam o
bloco `> ✅ **CONCLUÍDA em …**` na própria seção e `H-06` não carrega** — ela
aparece como concluída na tabela-resumo do mesmo arquivo e em
`docs/09-rastreabilidade.md:164`, mas a seção `### H-06` não tem o bloco. É o
item 7 da *definition of done* aplicado de forma inconsistente, uma vez em doze.

**Custo:** um arquivo de ~45 linhas, carregado só quando invocado. Ramo **R3**
(ação disparada pelo usuário, repetidamente, com parâmetro variável).

---

## 2. Documentação consultada

Todas em **04/08/2026**, a partir do ponto de entrada obrigatório
`https://code.claude.com/docs/pt/sessions` e do índice referenciado no cabeçalho
de cada página (`https://code.claude.com/docs/llms.txt`).

| Mecanismo | URL | Onde vive | Quando carrega | Contexto | O que devolve à sessão |
|---|---|---|---|---|---|
| **Sessões** | `/docs/pt/sessions` | transcritos em `~/.claude/projects/<projeto>/<id>.jsonl` | — | — | `--continue`, `--resume [nome]`, `/resume`, `/branch`, `--fork-session`; `/clear`, `/compact [instruções]`, `/context`, `/export` |
| **Janela de contexto** | `/docs/pt/context-window` | — | — | — | A tabela do que sobrevive à compactação (§2.1) |
| **Checkpointing** | `/docs/pt/checkpointing` | snapshots por prompt, 100 mais recentes | automático | — | `/rewind` (ou `Esc Esc`): restaurar código, conversa ou ambos. **Rastreia só as ferramentas de edição** — alterações feitas por comando bash **não** são desfazíveis |
| **Memória / CLAUDE.md** | `/docs/pt/memory` | `./CLAUDE.md`, `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`, `./CLAUDE.local.md`, `.claude/rules/*.md` | **toda sessão**, no lançamento; subdiretórios sob demanda | compartilhado | Instruções. Alvo declarado: **< 200 linhas por arquivo**. Importa com `@caminho`, profundidade máxima 4 |
| **Memória automática** | `/docs/pt/memory#auto-memory` | `~/.claude/projects/<projeto>/memory/` | `MEMORY.md`: primeiras 200 linhas ou 25 KB, toda sessão. Arquivos de tópico: sob demanda | compartilhado | Aprendizados que o Claude escreve. `autoMemoryEnabled`, `autoMemoryDirectory` |
| **Subagents** | `/docs/pt/sub-agents` | `.claude/agents/*.md` (projeto) · `~/.claude/agents/*.md` (usuário) | por delegação (automática pela `description`, ou explícita) | **próprio** | Só o resultado final. Frontmatter: `name` e `description` **obrigatórios**; opcionais `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt` |
| **Skills** | `/docs/pt/skills` | `.claude/skills/<nome>/SKILL.md` · `~/.claude/skills/...` · `.claude/commands/<nome>.md` | **sob demanda**: `/nome` ou o modelo decide pela `description`. Só a `description` (+`when_to_use`, truncadas em 1.536 caracteres) fica sempre no contexto | inline por padrão; `context: fork` roda em subagent | O corpo renderizado entra **uma vez** e permanece pelo resto da sessão; **reinjetado após compactação**, primeiros 5.000 tokens por skill, 25.000 no total. Todos os campos são opcionais; `description` é recomendada. Demais: `name`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `shell` |
| **Slash commands** | (ver §10) | `.claude/commands/<nome>.md` | idem skills | idem | **Comandos personalizados foram mescladas em skills**: `.claude/commands/deploy.md` e `.claude/skills/deploy/SKILL.md` criam ambos `/deploy` e usam a **mesma referência de frontmatter**. Fonte: `/docs/pt/skills`, nota de abertura e §"Como uma skill obtém seu nome de comando" |
| **Hooks** | `/docs/pt/hooks` | `hooks` em `settings.json` (usuário/projeto/local/gerenciado) ou no frontmatter de skill/agent | por **evento de ciclo de vida**, como código | não consome contexto | Eventos: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Stop`, `SubagentStart/Stop`, `PreCompact`/`PostCompact`, `FileChanged`, `InstructionsLoaded`, entre outros. Tipos: `command`, `http`, `mcp_tool`, `prompt`, `agent`. Saída 0 = ok, **2 = bloqueio**, outros = aviso. JSON estruturado: `permissionDecision`, `additionalContext`, `decision`, `continue`, `systemMessage` |
| **Settings e permissões** | `/docs/pt/settings` · `/docs/pt/permissions` | `managed` > CLI > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json` | imediato para `permissions`, `hooks`, `env` | — | Avaliação **deny → ask → allow**, primeira correspondência decide, especificidade não altera a ordem. Regras de projeto em `allow` só valem **após aceitar o diálogo de confiança do workspace** |
| **MCP** | `/docs/pt/mcp` | `.mcp.json` (projeto) · `~/.claude.json` (local e usuário) | por escopo; conectores claude.ai entram por último | — | `enableAllProjectMcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers`, `allowedMcpServers`/`deniedMcpServers` (gerenciados) |

### 2.1 O que a página de sessões determina sobre persistência de instrução

Consolidado de `/docs/pt/sessions` e da tabela de
[`/docs/pt/context-window#what-survives-compaction`](https://code.claude.com/docs/pt/context-window#what-survives-compaction):

| Mecanismo | Após compactação |
|---|---|
| Prompt do sistema e estilo de saída | Inalterado — não faz parte do histórico |
| **`CLAUDE.md` da raiz** e regras sem escopo | **Reinjetado do disco** |
| Memória automática (`MEMORY.md`) | **Reinjetado do disco** |
| Regras com frontmatter `paths:` | Perdidas até um arquivo correspondente ser lido de novo |
| `CLAUDE.md` aninhado em subdiretório | Perdido até um arquivo daquele subdiretório ser lido de novo |
| **Corpos de skills invocadas** | **Reinjetado**, 5.000 tokens por skill, 25.000 no total; os mais antigos caem primeiro; o truncamento **mantém o início do arquivo** |
| Hooks | Não se aplica — rodam como código |
| **Tudo o mais** — mensagens do chat, **saídas das ferramentas `Read`, `Grep`, `Bash`** | **Resumido.** *"Se uma instrução desapareceu após compactação, ela foi dada apenas em conversa"* (`/docs/pt/memory#instructions-seem-lost-after-/compact`) |

**Conclusão obrigatória — instrução que precisa sobreviver ao ciclo de vida da
sessão não pode depender de ter sido dita no chat.** Neste projeto, o que está
hoje nessa condição frágil:

| Instrução recorrente | Onde vive hoje | Sobrevive? | O que resolve |
|---|---|---|---|
| **O contrato fixado da história em execução** (assinaturas, rota, schema) — `docs/06-backlog.md` | Saída de `Read` no histórico | **Não.** Vira resumo | **M-2** (`/fatia` injeta e é reinjetada) |
| **Os casos-limite obrigatórios da história** — `docs/08-qualidade-operacao.md:60-115`, 43 casos com valor concreto | Saída de `Read` no histórico | **Não** | **M-2** |
| **Correções que o usuário dá no meio da fatia** (a classe do erro de `H-27`, `styleId` × `fillId`) | Só no chat | **Não** | Escrever no `CLAUDE.md` (foi o que o projeto fez) ou na memória automática. Não há mecanismo que salve isso sozinho |
| As 10 regras invioláveis, a tabela de stack, os fatos medidos, o bloco `## Estado`, as 5 regras do protocolo | `CLAUDE.md` da raiz | **Sim** — reinjetado do disco | Nada a fazer |
| A regra de fronteira de `src/domain/` | `biome.json` (override) + `npm run verify` | **Sim** — é código, não contexto | Nada a fazer. **É o modelo a imitar** |

Ponto operacional derivado do mesmo mecanismo: o `CLAUDE.md` em contexto é o
**snapshot do lançamento**. Foi observado nesta própria sessão, duas vezes — o
bloco `## Estado` recebido em contexto dizia *"`H-09` fechada, próximo passo
`H-10`, 209 testes"*; o arquivo em disco às 13:42 dizia *"`H-09` e `H-10`
fechadas, próximo `H-11`, 252 testes"*; e às 14:05 dizia *"`H-09` a `H-11`
fechadas, próximo `H-12`, 279 testes"*. Não é defeito: é a mecânica documentada,
somada à cadência real do projeto. Mas implica que **o passo de fechamento de
história tem de reler o arquivo do disco antes de editar o bloco `Estado`** —
instrução que entra no artefato de M-3.

---

## 3. Estado atual — inventário

### 3.1 `.claude/`

```
.claude/
└── settings.json        844 bytes · 30 linhas · mtime 03/08/2026 15:45
```

Não existem: `.claude/agents/`, `.claude/skills/`, `.claude/commands/`,
`.claude/hooks/`, `.claude/rules/`, `.claude/settings.local.json`, `.mcp.json`,
`CLAUDE.local.md`, nem `CLAUDE.md` em subdiretório. Verificado por `find` sobre
a árvore, excluindo `node_modules/` e `dist/`. Não há `.git`.

`settings.json` na íntegra — **19 entradas em `allow`, 2 em `deny`, nada mais**:

| # | Entrada | Tipo |
|---|---|---|
| 1–7 | `Bash(npm run verify)` · `Bash(npm test)` · `Bash(npm test -- *)` · `Bash(npm run lint)` · `Bash(npm run typecheck)` · `Bash(npm run build)` · `Bash(npm run dev)` | allow |
| 8–9 | `Bash(npm ci)` · `Bash(npm install)` | allow |
| 10–12 | `Bash(npx vitest *)` · `Bash(npx tsc *)` · `Bash(node --version)` | allow |
| 13–14 | `Bash(python3 tools/profile_workbook.py *)` · `Bash(unzip -l *)` | allow |
| 15–18 | `Bash(git status)` · `Bash(git diff *)` · `Bash(git log *)` · `Bash(git add *)` | allow |
| 19 | `Read(//home/usuario/Desktop/CronosComex/**)` | allow |
| 20–21 | `Read(//…/config/app.json)` · `Read(//…/data/**)` | **deny** |

A auditoria de segurança anterior já emitiu veredito entrada a entrada
(`docs/auditoria-configuracao-claude.md` §5). **Não repito esse trabalho.**
Aqui as entradas aparecem só como base de cálculo da coluna AUTORIZAR.

### 3.2 Scripts e ferramentas de qualidade

| Script | Comando | No `allow`? | Escreve? |
|---|---|---|---|
| `verify` | `lint && typecheck && test && build` | **Sim**, casamento exato | `dist/` |
| `lint` | `biome check .` | Sim, exato | não |
| `lint:fix` | `biome check --write .` | **Não** → pede permissão | **sim**, em `src/`, `web/`, `tests/`, `*.json` |
| `typecheck` | `tsc --noEmit` | Sim, exato | não |
| `test` | `vitest run` | Sim, exato (+ `npm test -- *`) | — |
| `build` | `tsc --noEmit && vite build` | Sim, exato | `dist/` |
| `dev` | `node --watch --experimental-strip-types src/http/server.ts` | Sim, exato | não termina |
| `start` | `node --experimental-strip-types src/http/server.ts` | **Não** | não termina |
| `profile` / `fixtures` | `python3 tools/*.py` | `profile` sim (curinga); `fixtures` **não** | sim |

**Existe um comando único de verificação: `npm run verify`, e está autorizado
por casamento exato.** Duas ressalvas medidas:

1. **Ele roda na versão errada de Node se ninguém disser o contrário** (M-1).
   A forma correta, `nvm use && npm run verify`, **pede permissão**.
2. **A saída de falha é legível o bastante para o agente agir sozinho** — Biome,
   `tsc` e Vitest emitem diagnóstico com `arquivo:linha` e regra. Isso é
   **inferência a partir da configuração**, não observação: não executei a suíte
   (o build escreve em `dist/` e o teste de log plausivelmente escreve em
   `data/`, caminho negado — ambos alterariam o estado do repositório, o que o
   enunciado proíbe).

A regra de fronteira de `src/domain/` **é imposta pela ferramenta**:
`biome.json` tem override em `src/domain/**` com `noRestrictedImports` sobre
`**/io/**`, `**/app/**`, `**/http/**`, `**/web/**`, `node:fs`, `node:path`,
`fastify`, `exceljs`, `fflate`, `chokidar`, nível `error`, com a mensagem
apontando o ADR. Confirmado em `src/domain/.fronteira.md`.

### 3.3 `CLAUDE.md`

**261 linhas** — acima do alvo declarado na documentação (< 200 linhas por
arquivo; `/docs/pt/memory#write-effective-instructions`, 04/08/2026). Eram 246
no início desta análise; o bloco que cresceu foi o `## Estado`.

| Bloco | Linhas | Natureza |
|---|---|---|
| Antes de escrever código | 12–24 | ordem de leitura |
| Regras invioláveis (10) | 26–59 | invariante |
| Stack — versões fixadas | 61–78 | invariante |
| Estrutura de diretórios | 80–91 | invariante |
| Fatos medidos sobre a planilha | 93–104 | invariante medido |
| **Estado** | 106–180 | **muda a cada história** — 75 linhas, 29% do arquivo, e o único bloco que cresce monotonicamente |
| Comandos | 182–190 | operacional (`nvm use` na l. 185) |
| **Protocolo de fatia** | **192–237** | **procedimento** — 46 linhas, 18% do arquivo; destas, **as l. 202–226 são o gabarito markdown puro** |
| Marcos de tooling | 239–251 | política, com gatilhos objetivos (l. 247, 248, 251) |
| Convenções | 253–261 | invariante |

### 3.4 `docs/` e demais artefatos de procedimento

22 arquivos, **8.913 linhas** de markdown (incluído este). Os que descrevem
procedimento:

| Arquivo | Linhas | O que prescreve |
|---|---|---|
| `06-backlog.md` | 1.904+ | **32 histórias**, cada uma com objetivo, arquivos, contrato fixado, critérios de aceite e casos-limite |
| `auditoria-configuracao-claude.md` | 1.413 | a auditoria de segurança do mesmo objeto (DIV-1) |
| `08-qualidade-operacao.md` | 334 | §1.3: **43 casos-limite obrigatórios**, com valor concreto e história atribuída |
| `07-plano-entrega.md` | 390 | 5 fases, grafo de dependências, **caminho crítico de 18 sessões** (l. 145) |
| `09-rastreabilidade.md` | 243 | matriz indicador/alerta → história → teste → status |
| `10-governanca.md` | 178 | **definition of done** de história (l. 79–86), fase e projeto |

### 3.5 Tarefas recorrentes — derivadas, com evidência

Tarefa sem evidência não entra na matriz. Entram sete.

| ID | Tarefa | Evidência de que é recorrente | Repetições restantes |
|---|---|---|---|
| **T-1** | Abrir uma história: apresentar o checklist do protocolo de fatia e aguardar | `CLAUDE.md:192` — *"obrigatório ao iniciar qualquer história"*, com gabarito exato; `docs/10-governanca.md:79`, primeiro item da DoD | **20** |
| **T-2** | Implementar a fatia: editar `src/`, `tests/`, `web/` | 23 arquivos em `src/`, 20 arquivos de teste, estrutura fixada em `docs/04-arquitetura.md`; `docs/06-backlog.md` lista os arquivos de cada história | **20** |
| **T-3** | Rodar o portão de qualidade | script `verify` em `package.json`; `CLAUDE.md:186` *"portão obrigatório"*; DoD item 4 | ≥ 20 |
| **T-4** | Conferir o resultado contra o arquivo real (servidor + rota) | notas de fecho de `H-09`, `H-10` e `H-11` no backlog: *"Verificado no servidor real"*, *"confirmados em produção"*; `CLAUDE.md:116` transcreve a resposta de `GET /api/indicators` | ≥ 3 (H-12…H-14), mais as rotas de E4/E5 |
| **T-5** | Cobrir os casos-limite obrigatórios com valor concreto | `docs/08-qualidade-operacao.md` §1.3, 43 casos, cada um com história atribuída; DoD item 3 | 20 |
| **T-6** | Fechar a história: backlog + rastreabilidade + bloco `Estado` | `CLAUDE.md` manda em dois lugares (l. 179 e l. 236); DoD itens 7 e 8; **11 blocos "✅ CONCLUÍDA em…" já escritos no backlog provam a repetição — e a ausência do 12º, em `H-06`, prova que o passo escapa** | **20** |
| **T-7** | Reperfilar a planilha na virada de ano | `CLAUDE.md:250`; `tools/profile_workbook.py`; risco R-14 | 1, anual |
| **T-8** | Revisar adversarialmente a manipulação de XML | `CLAUDE.md:248`; `docs/06-backlog.md` H-24 lista **8 casos-limite**; `docs/08` §1.3 traz 3 deles | 4 (H-24 a H-27) |

**Não entram na matriz, por falta de evidência de recorrência:** commits e
versionamento (não há `.git`; `docs/10-governanca.md` §6 descreve o padrão mas
nada o exercita), geração de fixtures (`tools/build_fixtures.py`, uso anual),
empacotamento (`H-30`, uma vez).

**Estado do backlog, medido:** 12 histórias concluídas (H-01 a H-11 e H-31),
**20 restantes**. 20 arquivos de teste, **273 chamadas `it(`/`test(`** contadas
estaticamente (método: `grep -rhoE "\b(it|test)\(" tests --include='*.test.ts'`;
zero ocorrências de `.each`, `.skip`, `.only`, `.todo`). O `CLAUDE.md:112`
afirma 279 — divergência de 6 não resolvida (§10).

**Defeito medido no ritual de fechamento.** Das 12 histórias concluídas,
**11 carregam o bloco `> ✅ **CONCLUÍDA em …**` na própria seção; `H-06` não
carrega.** Ela consta como concluída na tabela-resumo do próprio
`docs/06-backlog.md` e em `docs/09-rastreabilidade.md:164` (*"✅ **Concluída.**
Classificação canônica"*), e `src/domain/status-classifier.ts` existe com
25 casos de teste — mas a seção `### H-06` vai direto do título para
`**Objetivo:**`. Método: `awk '/^### H-/{h=$2} /^> ✅/{print h}'` sobre o
backlog devolve `H-01 H-02 H-03 H-04 H-05 H-07 H-08 H-09 H-10 H-11 H-31` —
sem `H-06`.

---

## 4. Matriz de custo de supervisão

Só a coluna **AUTORIZAR** admite verificação objetiva; foi feita comando a
comando contra o `allow` vigente. Nas outras três, **[obs]** marca observação e
**[inf]** marca inferência, com a base declarada.

Semântica aplicada, de `/docs/pt/permissions` (04/08/2026): avaliação
**deny → ask → allow**; comandos compostos são divididos por `&&`, `||`, `;`,
`|`, `|&`, `&` e quebra de linha, e **cada subcomando precisa casar sozinho**;
o conjunto somente-leitura embutido é fechado — `ls`, `cat`, `echo`, `pwd`,
`head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd` e
formas somente-leitura de `git`; leitura dentro do diretório de trabalho não
pede aprovação; **modificação de arquivo pede** (o "não pergunte novamente"
vale até o fim da sessão).

| Tarefa | ESPECIFICAR | AUTORIZAR (verificado, comando a comando) | CORRIGIR | VERIFICAR | Dominante |
|---|---|---|---|---|---|
| **T-1** Abrir história | O gabarito está no `CLAUDE.md` e é carregado sempre — **este ponto está resolvido**. O que o usuário ainda precisa dizer: onde está o contrato (`06-backlog.md`), quais casos-limite se aplicam (`08` §1.3) e a ordem de leitura (`CLAUDE.md:12-24`). São 3 documentos que a configuração não conecta ao número da história **[obs: nenhum mecanismo hoje faz esse vínculo — nem `argument-hint`, nem regra de caminho, nem script]** | **0 diálogos.** Só `Read`/`Grep` dentro do diretório de trabalho, que não pedem aprovação | O contrato é lido uma vez e vira saída de ferramenta; **após compactação, sobra o resumo** **[obs: documentado em §2.1]**. O erro previsível é implementar contra a assinatura lembrada, não a fixada **[inf: apoiada na tabela de compactação, não em falha observada neste repositório]** | O usuário lê o checklist e compara com o backlog à mão **[obs: é literalmente o que o protocolo pede — "apresente ao usuário o checklist e aguarde"]** | **ESPECIFICAR** |
| **T-2** Implementar | Estrutura, fronteira e convenções estão no `CLAUDE.md`; os arquivos de cada história, no backlog. **Bem coberto** | `Edit`/`Write` **não** estão no `allow` → **pede aprovação**. Piso: 1 diálogo por sessão. Se o "não pergunte novamente" for por arquivo, 3 a 5 por história **[não verificado — §10]**. `npm run lint:fix` **não casa nenhuma regra** → 1 diálogo cada vez que a formatação precisa de correção mecânica | A fronteira de `src/domain/` é imposta por Biome e quebra o portão **[obs: `biome.json` override + `.fronteira.md`]** — este erro **não chega** ao usuário. Fora dela, o `CLAUDE.md` cobre bem | O portão existe e é único **[obs]** | **AUTORIZAR** |
| **T-3** Portão de qualidade | `CLAUDE.md:186` já diz o comando. Falta a única coisa que o arquivo não diz: **o shell reinicia a cada chamada de Bash, então `nvm use` precisa prefixar todo comando Node** **[obs: medido — v20.19.5 → `nvm use` → v22.23.2 → chamada seguinte v20.19.5]** | `npm run verify` sozinho: **0 diálogos** (casamento exato). **`nvm use && npm run verify`: 1 diálogo** — `nvm use` não casa regra e não está no conjunto somente-leitura. Subconjuntos: `npm test -- <padrão>` e `npx vitest run <arq>` **0 diálogos**; `npm run lint:fix` **1 diálogo** | **Erro concreto e medido:** na versão padrão do shell, `node --experimental-strip-types` responde `node: bad option` — `npm run dev` e `npm start` **falham** **[obs]**. O `CLAUDE.md` não conecta esse sintoma à causa; o agente tende a investigar código **[inf: apoiada em que a mensagem não menciona versão]** | **Este é o laço bem resolvido do projeto**: `verify` roda sozinho e reprova com `arquivo:linha` **[obs quanto a existir e estar autorizado; inf quanto à legibilidade da falha — não executei a suíte, §10]** | **AUTORIZAR + CORRIGIR** |
| **T-4** Conferir contra o arquivo real | O usuário precisa dizer: suba o servidor, chame a rota, compare com o número anterior. **Nada na configuração descreve isso** **[obs: o procedimento só existe como prosa nas notas de fecho de H-09, H-10 e H-11]** | `npm run dev` **casa** (exato) mas nunca retorna. A consulta — `curl …` — **não casa nenhuma regra e `curl` não é somente-leitura embutido → 1 diálogo por chamada**. Encerrar o processo (`kill`/`pkill`) idem | O agente pode consultar antes de o servidor subir e ler recusa de conexão como erro da aplicação **[inf: apoiada em que `dev` usa `--watch` e não há checagem de prontidão]** | **Lacuna real:** não existe laço que o agente rode sozinho. Hoje o número medido aparece na nota de fecho porque **alguém o leu e o transcreveu** **[obs: `CLAUDE.md:116` e as notas de H-09 a H-11]** | **VERIFICAR** |
| **T-5** Casos-limite obrigatórios | O usuário precisa apontar quais das 43 linhas de `08` §1.3 pertencem à história **[obs: a tabela tem coluna "História", mas nada a filtra automaticamente]** | **0 diálogos** | Cobrir menos casos do que a tabela exige **[inf: apoiada em que a tabela vive num documento de 334 linhas que não é lido em toda sessão; não observei falha]** | Ninguém confere que os N casos da história viraram N testes. **Confirmado como ausência**: nenhum script, nenhuma regra de lint, nenhum campo de cobertura faz esse vínculo — `vitest.config.ts` tem `thresholds` em **0** | **VERIFICAR** |
| **T-6** Fechar história | O `CLAUDE.md` manda marcar o backlog e conferir a rastreabilidade, mas **não** manda atualizar o próprio bloco `## Estado` — que na prática é atualizado a cada história **[obs: o bloco cita H-09 a H-11, 279 testes, medições de recarga]** | `Edit` nos 3 documentos → mesma situação de T-2. `nvm use && npm run verify` → 1 diálogo | **Uma falha observada, uma em doze:** `H-06` está concluída (rastreabilidade l. 164, tabela-resumo do backlog, código e 25 testes existem) mas **não tem o bloco `✅ CONCLUÍDA` na própria seção**, ao contrário das outras 11 **[obs: `awk '/^### H-/{h=$2} /^> ✅/{print h}' docs/06-backlog.md` não devolve `H-06`]**. A rastreabilidade, essa, está em dia — conferida para H-10 e H-11 | 8 itens de DoD × 3 documentos, conferidos à mão, 12 vezes até agora e 20 pela frente **[obs: `docs/10-governanca.md:79-86`]** | **VERIFICAR** |
| **T-7** Reperfilar | `CLAUDE.md:250` descreve o gatilho e a ordem | **0 diálogos** — `Bash(python3 tools/profile_workbook.py *)` está no `allow`. **É exatamente o problema**: a auditoria anterior classifica isso como o achado **crítico A-01** (o perfilador emite amostras de todas as abas, inclusive `CNPJ`) | — | — | **Aqui a recomendação é aumentar a supervisão, não reduzir.** Ver §7.4 |
| **T-8** Review de XML | Os 8 casos-limite estão no backlog (H-24) e 3 na tabela de qualidade **[obs]** | `unzip -l *` casa. A comparação entrada a entrada por hash (`unzip -p … \| sha256sum`) **não casa** → 1 diálogo por entrada, ou 1 por pipeline | — | O critério de aceite exige *"todas as entradas do zip byte a byte idênticas, verificado por hash entrada a entrada"*. É verificável por teste **[obs: o critério já está escrito assim]** | **VERIFICAR** — e o próprio projeto já decidiu o mecanismo (`CLAUDE.md:248`) |

---

## 5. Lacunas

Uma por bloco. Toda recomendação cita o ramo da árvore e, havendo empate, a
alternativa descartada.

### LAC-1 — O comando prescrito para rodar Node pede permissão; o que não pede roda na versão errada

**Componente:** AUTORIZAR (primário) + CORRIGIR + ESPECIFICAR.
**Tarefas:** T-3, T-4, T-2.
**Ramo:** **R6** para a regra de permissão; **R5** para a linha de contexto —
é fato invariante que muda decisão em qualquer sessão que execute Node, e cabe
em uma linha.

**Evidência:** medida nesta sessão, reproduzida acima. `nvm` **existe** no shell
do agente; o que não existe é persistência de estado entre chamadas de Bash.

**Mecanismo:** `"Bash(nvm use)"` no `allow` (casamento exato, sem curinga) +
uma linha no bloco de comandos do `CLAUDE.md`.

**Redução esperada:** desaparece o diálogo em `nvm use && npm run verify` —
piso de 20 interações, uma por história restante. E desaparece a classe de
diagnóstico `node: bad option`.

**Custo:** duas linhas. Manutenção zero.
**Dependências:** nenhuma.
**Sinal de que funcionou:** o agente passa a prefixar `nvm use &&` sem ser
mandado, e nenhum diálogo aparece; `npm run dev` sobe na primeira tentativa.

**Alternativa descartada:** pôr `nvm use` num hook `SessionStart`. Não funciona
— o hook roda num processo próprio e o shell da ferramenta Bash é reiniciado a
cada chamada; o `PATH` não atravessa. **Registrado, não proposto.**

### LAC-2 — O contrato da história não sobrevive à compactação

**Componente:** ESPECIFICAR (primário) + CORRIGIR.
**Tarefa:** T-1 (e, por consequência, T-2 e T-5).
**Ramo:** **R2** — procedimento longo, condicional, acionado pelo tipo de
tarefa e não por toda sessão.

**Evidência:** `CLAUDE.md:192-237` (46 linhas carregadas em **toda** sessão,
inclusive nas de leitura e depuração, para um procedimento que só se aplica ao
iniciar história); a tabela de sobrevivência à compactação (§2.1); o caminho
crítico de 18 sessões (`docs/07-plano-entrega.md:145`).

**Mecanismo:** skill `.claude/skills/fatia/SKILL.md`, com injeção de contexto
dinâmico trazendo (a) a seção da história em `06-backlog.md`, (b) as linhas de
`08` §1.3 atribuídas àquela história, (c) as linhas de `09-rastreabilidade.md`
que a citam. **Condição inseparável:** remover as l. 202–226 do `CLAUDE.md` no
mesmo movimento, mantendo lá as 5 regras do protocolo (l. 228–237) e a frase de
gatilho — são elas que garantem que a skill seja invocada.

**Redução esperada:** 20 aberturas de história em que o usuário deixa de
apontar três documentos; e o contrato passa a ser reinjetado após compactação
em vez de resumido.

**Custo:** ~55 linhas de arquivo, criadas uma vez. Manutenção: só se o formato
das seções do backlog mudar.
**Dependências:** nenhuma técnica. Depende de o usuário aceitar editar o
`CLAUDE.md`.
**Sinal de que funcionou:** o checklist sai completo na primeira tentativa, com
contrato e casos-limite corretos, sem o usuário ter dito onde procurar; e, após
uma compactação no meio da história, o agente ainda cita as assinaturas exatas
sem reler o arquivo.

**Alternativa descartada (empate R2 × R5):** manter tudo no `CLAUDE.md`. Perde
por custo fixo — 46 linhas em ~18 sessões, a maioria das quais não abre
história. **Alternativa descartada (proposta da auditoria anterior, §7(c)):**
mover o gabarito para `docs/gabarito-fatia.md`. É melhor que o status quo, mas
inferior à skill em dois pontos verificáveis: um documento comum **não é
reinjetado após compactação**, e depende de o agente lembrar de lê-lo. A
ressalva daquela auditoria — *"uma skill pode não ser invocada, enquanto o
`CLAUDE.md` sempre é lido"* — é válida e está endereçada mantendo a frase de
gatilho e as 5 regras no `CLAUDE.md`.

### LAC-3 — Não existe laço de fechamento que o agente rode sozinho

**Componente:** VERIFICAR.
**Tarefa:** T-6 (e T-5, carona).
**Ramo:** **R3** — ação que o usuário dispara, repetidamente, com parâmetro
variável (`H-NN`).

**Evidência:** `docs/10-governanca.md:79-86` (8 itens); 3 documentos a tocar;
12 execuções já feitas, 20 restantes; o `CLAUDE.md` repete a ordem em dois
lugares distintos (l. 179 e l. 236) — e mesmo assim `H-06` ficou sem o bloco de
fecho na sua seção (§3.5).

**Mecanismo:** skill `.claude/skills/fechar-historia/SKILL.md`, com o critério
de aceite embutido: a skill **termina imprimindo três `grep`** que provam o
estado final dos três arquivos. Sem esses três `grep`, o item seria capacidade
sem conferência — e a lei de conservação da supervisão o reprovaria.

**Redução esperada:** 20 fechamentos em que a conferência passa de "abrir três
documentos e percorrer 8 itens" para "ler três linhas de saída". E zero
repetições do caso `H-06`.

**Custo:** ~45 linhas. Manutenção: acompanha a DoD.
**Dependências:** LAC-1 (a skill manda rodar `nvm use && npm run verify`).
**Sinal de que funcionou:** o usuário para de reabrir `09-rastreabilidade.md`
para conferir; e o bloco `## Estado` do `CLAUDE.md` nunca mais diverge do
backlog.

**Alternativa descartada:** hook `Stop` que bloqueia o fim do turno enquanto a
DoD não fechar. Reprovada em §6 — bloqueia trabalho legítimo (turnos de
conversa, sessões de leitura, fatias parciais) e o custo previsível é o usuário
desligar tudo.

### LAC-4 — A conferência contra o arquivo real não tem como ser fechada pelo agente

**Componente:** VERIFICAR + AUTORIZAR.
**Tarefa:** T-4.
**Ramo:** **R6** — atrito de autorização sobre operação segura, frequente e de
escopo estreito.

**Evidência:** as notas de fecho de `H-09`, `H-10` e `H-11` no backlog registram
*"Verificado no servidor real"* e *"confirmados em produção"*, com números;
`CLAUDE.md:116` transcreve a resposta de `GET /api/indicators`. Restam ao menos
H-12 a H-14 com o mesmo padrão, mais as rotas de E4 e E5.

**Mecanismo:** **três regras de permissão de casamento exato**, uma por rota
somente-leitura, sobre o loopback:

```
"Bash(curl -s http://127.0.0.1:<porta>/api/indicators)"
"Bash(curl -s http://127.0.0.1:<porta>/api/health)"
"Bash(curl -s http://127.0.0.1:<porta>/api/quarantine)"
```

`src/http/server.ts:18` fixa `LOOPBACK = '127.0.0.1'` e `:67` liga a esse host.
**`POST /api/reload` fica de fora** — muta estado.

**Por que casamento exato e não curinga:** a documentação alerta que padrões
Bash que tentam restringir argumentos de `curl` são frágeis
(`/docs/pt/permissions#bash`). Testei a forma com curinga na porta —
`Bash(curl -s http://127.0.0.1:*/api/indicators)` — e ela casa também
`curl -s http://127.0.0.1:1 -o src/domain/indicators.ts http://externo/api/indicators`,
porque `*` abrange espaços. **Escrever curinga aqui seria comprar conveniência
com ampliação de permissão; está descartado.**

**Bloqueio:** a porta real vive em `config/app.json`, **caminho negado** — não
inspecionado. O `app.json.exemplo` traz `"port": 5173`. Vira a pergunta **P-2**
(§11).

**Redução esperada:** 1 diálogo por consulta, ≥ 6 nas três histórias de
indicador restantes (H-12 a H-14); e o número medido passa a ser produzido pelo
laço em vez de transcrito por leitura humana.

**Custo:** três linhas. **Dependências:** P-2.
**Sinal:** as notas de fecho passam a trazer o número sem o usuário ter aberto
o navegador.

**Alternativa descartada:** uma skill `/verificar-rota` que suba o servidor,
espere a prontidão, consulte e encerre. **Cortada na autoavaliação como
invólucro fino** — depois das regras de permissão, o que sobra cabe em uma frase
de instrução.

### LAC-5 — Edições de arquivo pedem aprovação apesar de serem a classe reversível

**Componente:** AUTORIZAR.
**Tarefas:** T-2, T-6.
**Ramo:** **R6**.

**Evidência e o argumento:** o checkpointing rastreia **todas** as alterações
feitas pelas ferramentas de edição e permite `/rewind` para restaurar o código;
alterações feitas por **comando bash não são rastreadas**
(`/docs/pt/checkpointing#limitations`, 04/08/2026). A configuração vigente trata
as duas classes igual — nenhuma está no `allow`. Mas só uma delas tem desfazer.

**Mecanismo:** `"Edit(/src/**)"`, `"Edit(/tests/**)"`, `"Edit(/web/**)"`,
`"Edit(/docs/**)"`. Âncora `/` em configuração de projeto resolve para
`<raiz do projeto>/…` (`/docs/pt/permissions#read-and-edit`). **Fora:** raiz do
projeto (`CLAUDE.md`, `package.json`, `.gitignore`, `biome.json`,
`tsconfig.json`), `config/**`, `data/**`, `*.xlsx`, `*.jpeg`.

**Redução esperada:** piso de 1 diálogo por sessão × ~18 sessões restantes;
teto desconhecido, porque **não está documentado se o "não pergunte novamente"
de modificação de arquivo vale por arquivo ou por sessão** (§10). É essa
incerteza que põe o item em quarto lugar, não em primeiro.

**Custo:** quatro linhas. **Dependências:** os `deny` de `Edit` propostos pela
auditoria anterior (`Edit(/config/app.json)`, `Edit(/data/**)`) devem entrar
**antes** ou junto — `deny` vence `allow`, mas a ordem de aplicação evita uma
janela em que `docs/` esteja permitido e `config/` não esteja negado. Depende
também do diálogo de confiança do workspace ter sido aceito, sem o qual regras
`allow` de projeto não são aplicadas.

**Sinal:** a fase de implementação de uma história transcorre sem diálogo de
permissão de arquivo.

**Alternativa descartada:** `"defaultMode": "acceptEdits"`. Aceita também
`mkdir`, `touch`, `mv` e `cp` no diretório de trabalho — e `mv`/`cp` alcançam
`CONTROLE DOS EMBARQUE.xlsx`. Amplitude desproporcional ao ganho.

### LAC-6 — Correção mecânica de formatação pede aprovação

**Componente:** AUTORIZAR. **Tarefa:** T-2/T-3. **Ramo:** R6.
**Mecanismo:** `"Bash(npm run lint:fix)"`, casamento exato.
**Condição:** `npm run lint:fix` escreve arquivos **por subprocesso**, e
subprocesso está fora do alcance do checkpointing. Sem `git`, uma reformatação
indesejada é irreversível. **Só entra depois de `git init`** — decisão D-1 da
auditoria anterior. Enquanto não houver git, o caminho correto é o agente
corrigir formatação com `Edit` (reversível) e pagar o custo.
**Sinal:** deixa de aparecer diálogo quando o portão reprova só por formatação.

### LAC-7 — Review adversarial da escrita cirúrgica (H-24)

**Componente:** VERIFICAR. **Tarefa:** T-8. **Ramo:** **R4** — trabalho com
muitas leituras exploratórias (XML de planilha, entradas de zip) cujo produto
útil é um veredito condensado.

**Isto não é recomendação minha: é decisão já tomada pelo projeto**
(`CLAUDE.md:248`, com gatilho objetivo *"antes de iniciar a Fase 3 (H-24)"*).
Registro o artefato pronto (§8.4) e a data de acionamento. A fase atual é a 2,
com H-12 em seguida — **não criar ainda**.

---

## 6. Anti-padrões

### 6.1 No que já existe

| Anti-padrão | Ocorre hoje? |
|---|---|
| Subagent devolvendo texto longo | **Não** — não há subagent |
| Subagent para trabalho dependente do histórico | **Não** |
| Skill duplicando ou contradizendo o `CLAUDE.md` | **Não** — não há skill |
| Comando que é uma frase disfarçada de arquivo | **Não** — não há comando |
| Hook que bloqueia trabalho legítimo ou falha em silêncio | **Não** — não há hook |
| **Instrução crítica que só existe no chat** | **Sim.** O contrato da história e os casos-limite obrigatórios (§2.1). É a LAC-2 |
| **Atrito reduzido por ampliação de permissão sobre versionamento, dado sensível ou instalação** | **Sim, e é grave.** `Bash(git add *)`, `Bash(npm ci)`, `Bash(npm install)` e `Bash(python3 tools/profile_workbook.py *)` estão pré-autorizados. **Já são os achados A-01, A-02 e A-07 da auditoria anterior** — não são minha recomendação e não os reabro; registro que a auditoria de supervisão **concorda** que essas quatro entradas devem sair do `allow` |
| Capacidade nova sem critério de aceite | **Não se aplica** — não há capacidade nova |
| **Contexto fixo acima do alvo** | **Sim, e piorando.** `CLAUDE.md` com 261 linhas contra o alvo documentado de < 200 — eram 246 no início desta análise. 46 dessas linhas são um procedimento condicional |

### 6.2 Nas propostas deste documento — o que foi evitado, e o que foi cortado

| Risco | Como foi tratado |
|---|---|
| `/fatia` duplicar o `CLAUDE.md` | A proposta **é** mover, não copiar. A remoção das l. 193–217 é **condição de adoção**, não sugestão. Adotar a skill sem remover o gabarito torna o item **net-negativo** — está escrito assim no artefato |
| `/fechar-historia` virar capacidade sem conferência | A skill **termina imprimindo três `grep`** que são o critério de aceite. Sem eles o item não passaria na lei de conservação |
| `/verificar-rota` como invólucro fino | **Cortada.** Sobraram só as três regras de permissão (LAC-4) |
| Skill `novo-indicador` antecipada | **Cortada.** O gatilho do projeto (`CLAUDE.md:247`) é a conclusão de `H-13`; observadas 3 das 5 repetições |
| Subagent de review criado agora | **Adiado** ao gatilho do próprio projeto. O artefato exige **retorno condensado em tabela, com teto de linhas**, não transcrição |
| Hook `Stop` exigindo DoD | **Rejeitado.** Dispararia em turno de conversa, em sessão de leitura e em fatia deliberadamente parcial. O modo de falha previsto — o usuário desliga todos os hooks — custa mais do que o item vale |
| Hook `PostToolUse` rodando lint a cada `Edit` | **Rejeitado.** Biome já está no portão; rodar a cada edição é ruído e latência sem informação nova |
| Ampliar permissão para comprar conveniência | `curl` só com **casamento exato** em três rotas de loopback, com o caso de escape do curinga demonstrado (LAC-4). `Edit` só em `src/`, `tests/`, `web/`, `docs/`. `lint:fix` **condicionado a existir git**. Nada sobre `git`, `npm install`/`ci` ou o perfilador |

---

## 7. Roteiro priorizado

### 7.1 Ordem

Fatores declarados: **R** = interações humanas eliminadas, estimadas pelo método
de cada linha · **C** = custo de criar e manter, em linhas de arquivo ·
**Razão** = R/C, arredondada.

| # | Item | Componente | Ramo | R (método) | C | Razão | Depende de |
|---|---|---|---|---|---|---|---|
| **1** | `Bash(nvm use)` + 1 linha no `CLAUDE.md` (LAC-1) | AUTORIZAR + CORRIGIR + ESPECIFICAR | R6 + R5 | **≥ 20** diálogos (1 por história restante) + 1 classe de diagnóstico errado | 2 | ~10 | — |
| **2** | Skill `/fatia` (LAC-2) | ESPECIFICAR | R2 | **20** aberturas × (3 documentos que o usuário deixa de apontar) + sobrevivência à compactação | 55 (e **−25** no `CLAUDE.md`) | ~0,7 | edição do `CLAUDE.md` |
| **3** | Skill `/fechar-historia` (LAC-3) | VERIFICAR | R3 | **20** fechamentos × 8 itens conferidos à mão, mais o defeito observado em `H-06` | 45 | ~3,6 (por item de DoD) | item 1 |
| **4** | 3 regras de `curl` em loopback (LAC-4) | VERIFICAR + AUTORIZAR | R6 | **≥ 6** diálogos + fecha o laço de conferência contra o arquivo real | 3 | ~2,0 | **P-2** (porta real) |
| **5** | 4 regras de `Edit` em código, teste e docs (LAC-5) | AUTORIZAR | R6 | **≥ 18** diálogos (piso); teto desconhecido | 4 | ≥ 4,5, mas **com incerteza declarada** | `deny Edit` da auditoria anterior; confiança de workspace |
| **6** | `Bash(npm run lint:fix)` (LAC-6) | AUTORIZAR | R6 | poucas, mecânicas | 1 | — | **`git init` (D-1)** |
| **7** | Subagent `revisor-xml` (LAC-7) | VERIFICAR | R4 | 4 histórias de escrita, cada uma com 8 casos-limite | 40 | — | **gatilho do projeto: antes de H-24** |

Os itens 1, 4, 5 e 6 são entradas em `.claude/settings.json`. **Devem ser
aplicados como acréscimo ao arquivo revisado da auditoria de segurança**
(`docs/auditoria-configuracao-claude.md` §8.1), não sobre o arquivo atual —
aplicar sobre o atual preservaria `Bash(git add *)` e o perfilador no `allow`.

### 7.2 Como se sabe que cada um funcionou

| Item | Sinal observável | É hipótese? |
|---|---|---|
| 1 | Nenhum diálogo em `nvm use && npm run verify`; `npm run dev` sobe na primeira tentativa | **Não** — verificável na primeira execução |
| 2 | Checklist completo e correto sem o usuário apontar documento; após compactação, o agente cita as assinaturas exatas sem reler | **Não**, quanto à primeira metade. **Sim**, quanto à segunda, até a primeira compactação real ocorrer no meio de uma história |
| 3 | Os três `grep` finais saem verdes; o bloco `Estado` nunca diverge do backlog | **Não** |
| 4 | O número medido aparece na nota de fecho sem o usuário abrir o navegador | **Não** |
| 5 | A fase de implementação transcorre sem diálogo de arquivo | **Parcialmente hipótese** — o piso é certo, a magnitude não (§10) |
| 6 | Some o diálogo quando o portão reprova só por formatação | **Não** |
| 7 | O relatório do subagent cabe numa tabela e aponta `arquivo:linha`; o critério de hash entrada a entrada do backlog fecha | **Sim, até H-24** |

### 7.3 Saldo de contexto fixo

Autoavaliação: a soma das propostas **não** aumenta o contexto carregado em toda
sessão.

| Movimento | Δ contexto fixo |
|---|---|
| Remover o gabarito do `CLAUDE.md` (l. 202–226) | **−25 linhas** |
| Acrescentar 1 linha no bloco de comandos (LAC-1) | +1 linha |
| `description` de `/fatia` na listagem de skills | +1 linha (teto de 1.536 caracteres somando `description` e `when_to_use`) |
| `description` de `/fechar-historia` | +1 linha |
| Corpos das duas skills | **0** — carregam sob demanda |
| Regras de permissão | **0** — não são contexto |
| Subagent | **0** — contexto próprio |
| **Saldo** | **≈ −22 linhas** |

### 7.4 O que **não** fazer — e por quê

Esta lista é entrega, não sobra.

| Mecanismo | Veredito | Motivo |
|---|---|---|
| **Skill `novo-indicador`** | **Não adotar agora** | O gatilho do próprio projeto (`CLAUDE.md:247`) é a conclusão de `H-13`. Observadas **3 de 5** repetições (H-09, H-10, H-11). Antecipar contraria a política escrita e produz um formato ainda não estabilizado — `H-11` já divergiu do ciclo previsto ao extrair `isOverdue()` para atender `H-12`, o que mostra que o padrão ainda está se assentando |
| **Skill `nova-pagina`** | **Não adotar** | Gatilho: conclusão de `H-20`. Zero das cinco páginas existe |
| **Hook `Stop` exigindo a DoD** | **Não adotar** | §6.2. Bloqueia trabalho legítimo; modo de falha é o usuário desligar tudo |
| **Hook `PostToolUse` de lint por edição** | **Não adotar** | §6.2. Redundante com o portão |
| **Hook `SessionStart` para `nvm use`** | **Não adotar** | Não funciona: o `PATH` do hook não atravessa para o shell da ferramenta Bash, que é reiniciado a cada chamada |
| **Novo hook `PreToolUse`** | **Não adotar** | O único que este projeto precisa **já está especificado** em `docs/auditoria-configuracao-claude.md` §8.2, por motivo de segurança. Acrescentar um segundo seria duplicação |
| **`.claude/rules/` com `paths:`** | **Não adotar** | Regras com `paths:` **não sobrevivem à compactação** (§2.1). O que este projeto tem de invariante já cabe no `CLAUDE.md` da raiz, que sobrevive. Adotar seria trocar um mecanismo persistente por um frágil |
| **`CLAUDE.md` aninhado em `src/domain/`** | **Não adotar** | Mesmo motivo — não é reinjetado. E `src/domain/.fronteira.md` já documenta a fronteira que o **Biome impõe**. Instrução onde já há imposição é custo sem ganho |
| **Servidor MCP de projeto (`.mcp.json`)** | **Não adotar** | Aplicação local, sem integração externa por definição (ADR-0002). Acrescentar servidor amplia superfície sem tarefa recorrente por trás — **R8** |
| **Plugins, marketplaces, configuração gerenciada** | **Não adotar** | Máquina única, um desenvolvedor. As chaves de contenção só são lidas de configuração gerenciada |
| **Subagents para paralelizar o backlog** | **Não adotar** | O `CLAUDE.md:251` já diz "Nunca", e a razão é correta e verificável: o caminho crítico é uma cadeia **sequencial** de 18 sessões (`docs/07-plano-entrega.md:145`). Fan-out não encurta cadeia sequencial |
| **Ampliar `Bash(git *)`, `npm install`, `npm ci` ou o perfilador** | **Proibido** | Versionamento, instalação de dependência e dado sensível. A auditoria anterior recomenda o movimento **contrário**, e este diagnóstico concorda: em T-7 o diálogo de permissão **é** o controle |
| **`autoMemoryEnabled: false`** | **Não adotar** | A memória automática é reinjetada do disco após compactação (§2.1) — é um dos poucos lugares persistentes que existem. Numa cadeia de 18 sessões isso tem valor. A decisão D-5 da auditoria anterior chega à mesma conclusão por outro caminho |
| **`defaultMode` diferente de `default`** | **Não adotar** | `acceptEdits` alcança `mv`/`cp` sobre a planilha real; `auto`, `dontAsk` e `bypassPermissions` mudam o regime inteiro num projeto sem git. LAC-5 entrega o ganho relevante com escopo estreito |

> **SUPERADO EM 31/08/2026 — `.claude/rules/` foi adotado.** A linha acima
> recomendava não adotar, e o argumento central — regra com `paths:` não
> sobrevive à compactação — **é falso, e a documentação oficial o desmente**:
> rules com `paths:` recarregam quando o Claude volta a ler arquivo que casa o
> glob, e o hook `InstructionsLoaded` expõe `load_reason: compact`. A
> recomendação de 04/08/2026 foi construída sobre uma premissa errada. O outro
> lado
> da conta também mudou: o `CLAUDE.md` chegou a 6400 palavras carregadas em **toda** sessão,
> e três assuntos dele só interessam a quem abre arquivos específicos. Hoje há
> cinco rules, e elas valem ~1750 palavras que deixaram de ser carregadas
> sempre. **A fragilidade foi aceita conscientemente, não esquecida:** rule é
> contexto e não configuração aplicada, e quem garante continua sendo a asserção
> em `tests/repo/`, que cobra uma menção no `CLAUDE.md` para cada peça de
> `.claude/`. Regra inviolável não migrou.


---

## 8. Anexo — artefatos prontos para colar

> **Nada aqui foi aplicado.** Nenhum arquivo de configuração foi criado,
> editado ou removido. Os caminhos de destino estão em cada cabeçalho.

### 8.1 Acréscimo a `.claude/settings.json`

**Destino:** `.claude/settings.json`, array `permissions.allow`.
**Pré-requisito:** aplicar sobre o arquivo revisado de
`docs/auditoria-configuracao-claude.md` §8.1, **não** sobre o arquivo atual.
Substitua `5173` pela porta real de `config/app.json` (pergunta **P-2**).

```jsonc
// Acrescentar a permissions.allow — cada linha justificada:

// LAC-1 · O shell do agente reinicia a cada chamada de Bash e carrega
// Node v20.19.5, abaixo de engines (>=22.12.0). Casamento exato, sem curinga.
"Bash(nvm use)",

// LAC-4 · Conferencia contra o arquivo real. Casamento EXATO por rota.
// Curinga na porta e proibido: "curl -s http://127.0.0.1:*/api/indicators"
// casa "curl -s http://127.0.0.1:1 -o src/x.ts http://externo/api/indicators",
// porque * abrange espacos. POST /api/reload fica de fora: muta estado.
"Bash(curl -s http://127.0.0.1:5173/api/health)",
"Bash(curl -s http://127.0.0.1:5173/api/indicators)",
"Bash(curl -s http://127.0.0.1:5173/api/quarantine)",

// LAC-5 · Edicoes por ferramenta sao rastreadas por checkpoint e desfazeis
// com /rewind; escritas por subprocesso nao sao. Ancora "/" resolve para a
// raiz do projeto em settings de projeto. Fora: raiz, config/, data/, *.xlsx.
"Edit(/src/**)",
"Edit(/tests/**)",
"Edit(/web/**)",
"Edit(/docs/**)",

// LAC-6 · SO DEPOIS DE `git init` (decisao D-1 da auditoria de seguranca).
// biome --write escreve por subprocesso, fora do alcance do checkpoint.
"Bash(npm run lint:fix)"
```

### 8.2 `.claude/skills/fatia/SKILL.md`

**Destino:** `.claude/skills/fatia/SKILL.md` (o nome do comando vem do nome do
**diretório**: `/fatia`).
**Condição de adoção — inseparável:** remover as linhas **202–226** do
`CLAUDE.md` (o bloco ` ```markdown … ``` `), mantendo lá o cabeçalho da seção
(l. 192), a frase de gatilho e as 5 regras do protocolo (l. 228–237),
acrescentando à regra 1 a menção a `/fatia`. **Adotar a skill sem remover o
gabarito produz duplicação entre skill e `CLAUDE.md` — o anti-padrão — e piora
o problema.**

````markdown
---
name: fatia
description: Abre uma história do backlog do CronosComex montando o checklist do protocolo de fatia, com o contrato fixado, os critérios de aceite e os casos-limite obrigatórios já embutidos. Use ao iniciar qualquer história H-NN, antes de escrever a primeira linha de código.
when_to_use: Quando o usuário disser "vamos para a H-11", "iniciar H-12", "próxima história" ou invocar /fatia H-NN.
argument-hint: [H-NN]
---

## A história, direto do backlog

!`grep -m1 -A 95 "^### $ARGUMENTS " docs/06-backlog.md`

## Casos-limite obrigatórios atribuídos a esta história

Extraídos de `docs/08-qualidade-operacao.md` §1.3 — os 43 casos obrigatórios.
Cada linha abaixo precisa virar um teste com o **valor concreto** que aparece
nela.

!`grep -F "| $ARGUMENTS |" docs/08-qualidade-operacao.md`

## Linhas da matriz de rastreabilidade que citam esta história

!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`

## O que fazer agora

Monte o checklist abaixo e **aguarde**. Não escreva código antes da resposta.
Todos os itens vêm do material acima, copiados — não inventados. O que não
estiver lá é divergência, e divergência **para** a implementação.

```markdown
## H-NN — <título>

**Objetivo:** <a frase do backlog>
**Tamanho:** P/M/G · **Depende de:** H-XX ✅ · **Fase:** N

### Contrato (já fixado — não redefinir)
<assinatura, rota ou schema, copiado do backlog>

### A fazer
- [ ] `caminho/do/arquivo.ts` — o que muda
- [ ] `caminho/do/teste.test.ts` — o que cobre

### Critérios de aceite
- [ ] Dado ... Quando ... Então ...

### Casos-limite a cobrir com teste
- [ ] `<valor concreto>` → `<resultado esperado>`

### Fora desta fatia
- <o que NÃO fazer aqui, e em qual história vai>

### Divergências encontradas no plano
- <nenhuma | descrição + o que proponho>
```

### Regras que valem durante toda a fatia

- Use `TodoWrite` em paralelo, para acompanhamento.
- Todo comando que execute Node vai prefixado por `nvm use &&` — o shell
  reinicia a cada chamada e carrega uma versão abaixo de `engines`.
- Ao terminar, invoque `/fechar-historia H-NN`.
````

**Se o bloco "A história" vier vazio:** `$ARGUMENTS` não foi substituído antes
da execução do comando (comportamento não confirmado na documentação — §10).
Solução: trocar as três linhas `!` por `!`grep -n "^### H-" docs/06-backlog.md``
e ler o intervalo de linhas com a ferramenta `Read`. O ganho de sobrevivência à
compactação cai; o resto da skill continua valendo.

### 8.3 `.claude/skills/fechar-historia/SKILL.md`

**Destino:** `.claude/skills/fechar-historia/SKILL.md` → comando
`/fechar-historia`.

````markdown
---
name: fechar-historia
description: Fecha uma história do CronosComex (H-NN) — roda o portão de qualidade, percorre a definition of done, atualiza backlog, rastreabilidade e o bloco Estado do CLAUDE.md, e imprime a prova de que os três ficaram consistentes. Use quando a implementação de uma história terminar.
when_to_use: Quando o usuário disser "fechar H-11", "história concluída", "marque como pronta" ou invocar /fechar-historia H-NN.
argument-hint: [H-NN]
---

## Estado atual dos três arquivos, antes de mexer

!`grep -m1 -A 4 "^### $ARGUMENTS " docs/06-backlog.md`
!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`
!`sed -n '106,112p' CLAUDE.md`

## Passos

1. **Portão.** Rode `nvm use && npm run verify`. Sem o `nvm use` o comando roda
   em Node v20.19.5, abaixo de `engines`. Se reprovar, **pare aqui** e conserte
   — não marque nada.
2. **Definition of done** (`docs/10-governanca.md:79-86`). Percorra os 8 itens e
   diga, para cada, se passou e com base em quê:
   - [ ] O protocolo de fatia foi apresentado e aprovado
   - [ ] Todos os critérios de aceite passam
   - [ ] Todos os casos-limite têm teste com **valor concreto**
   - [ ] `npm run verify` passa
   - [ ] Nenhuma regra de negócio fora de `src/domain/`
   - [ ] Nenhum teste aponta para a planilha real
   - [ ] História marcada em `06-backlog.md`
   - [ ] `09-rastreabilidade.md` conferido, se algum status mudou
3. **Backlog.** Acrescente o bloco `> ✅ **CONCLUÍDA em DD/MM/AAAA.** …` logo
   abaixo do título da história, no mesmo formato dos 11 já existentes: número
   de testes próprios, total da suíte, divergências resolvidas.
4. **Rastreabilidade.** Atualize o `Status` de cada linha de
   `09-rastreabilidade.md` que cite a história, e a linha correspondente da
   tabela de §4.
5. **`CLAUDE.md`, bloco `## Estado`.** **Releia o arquivo do disco antes de
   editar** — a cópia em contexto é o snapshot do início da sessão e pode estar
   defasada. Atualize a frase de fase, a próxima história e o total de testes
   **exatamente como o Vitest reportou**. Não estime número.
6. **Marcos de tooling** (`CLAUDE.md:239-251`). Se esta história for `H-13`,
   `H-20` ou a última antes de `H-24`, avise que o gatilho de tooling foi
   atingido.

## Prova — imprima isto no final, sem editar

O fechamento só está concluído quando as três saídas abaixo forem consistentes
entre si. É o critério de aceite desta skill: o usuário lê três linhas em vez
de reabrir três documentos.

```bash
grep -m1 -A 2 "^### $ARGUMENTS " docs/06-backlog.md
grep -c "$ARGUMENTS" docs/09-rastreabilidade.md
sed -n '106,112p' CLAUDE.md
```

Se a próxima história citada no `CLAUDE.md` não for a sucessora declarada em
`docs/07-plano-entrega.md`, diga isso em vez de corrigir por conta própria.
````

### 8.4 `.claude/agents/revisor-xml.md` — **não criar ainda**

**Destino:** `.claude/agents/revisor-xml.md`.
**Quando criar:** antes de iniciar a Fase 3 (`H-24`), conforme
`CLAUDE.md:248`. A fase atual é a 2, com `H-12` em seguida.

```markdown
---
name: revisor-xml
description: Revisa adversarialmente alterações de escrita cirúrgica no XML do .xlsx (H-24 a H-27). Use antes de fechar qualquer história que altere bytes do arquivo da planilha.
tools: Read, Grep, Glob, Bash
model: inherit
color: red
---

Você revisa código de escrita cirúrgica em OOXML. O custo de errar é a planilha
operacional da empresa. Assuma que o código está errado e tente provar.

## Os 8 casos-limite fixados em H-24 (docs/06-backlog.md)

1. Célula que não existe no XML → nó `<c>` novo inserido na posição correta pela
   ordem de coluna.
2. String já presente em `xl/sharedStrings.xml` → reutiliza o índice, sem
   duplicar.
3. String nova → acrescentada ao fim, com `count` e `uniqueCount` atualizados.
4. Célula que continha fórmula → o nó `<f>` é removido junto com a substituição
   do valor, para não deixar fórmula órfã.
5. Data na coluna O (DOCS ENVIADOS), 79,3% vazia no arquivo real → o formato de
   data é **garantido**, não presumido (A-56).
6. Texto com `&`, `<` e `"` → escapado corretamente.
7. Texto com quebra de linha → preservado, com `xml:space="preserve"`.
8. Lista de edições vazia → devolve o buffer original inalterado,
   `cellsWritten: 0`.

## Invariantes que não podem ser violadas

- `workbook.xlsx.writeFile()` do ExcelJS **não é usado** (ADR-0004).
- O atributo `s=` da célula alterada é **preservado**: mudar valor não muda cor.
- Cor se troca por `fillId`, **nunca** por `styleId` — uma mesma cor vem de
  vários `styleId` (A-49, TD-05.1).
- Todas as entradas do zip que não sejam a aba alvo e `sharedStrings.xml` ficam
  **byte a byte idênticas**, verificado por hash entrada a entrada.
- Nada fora da aba `2026` é processado, indexado, exposto ou registrado.

## Formato do retorno — obrigatório

Devolva **somente** a tabela abaixo, no máximo 15 linhas. Nada de transcrição
do que você leu, nada de resumo do código, nada de sugestão de refatoração.

| # | Caso ou invariante | `arquivo:linha` | Veredito | Como reproduzir |
|---|---|---|---|---|

Veredito é `OK`, `FALHA` ou `NÃO COBERTO`. `FALHA` exige a entrada concreta que
produz o erro. Se tudo passar, devolva a tabela com todas as linhas `OK` —
não devolva prosa.
```

### 8.5 Alteração pontual no `CLAUDE.md` (LAC-1)

**Destino:** `CLAUDE.md`, bloco `## Comandos` (l. 182–190). Uma linha
acrescentada; nada removido.

````markdown
```bash
nvm use             # Node 22.23.2, conforme .nvmrc
npm run verify      # lint + typecheck + test + build — portão obrigatório
npm test            # Vitest
npm run dev         # servidor + interface
python3 tools/profile_workbook.py "<caminho.xlsx>" saida.json   # reperfilar
```

O shell do agente reinicia a cada chamada de ferramenta e carrega **Node
v20.19.5**, abaixo de `engines`. Prefixe `nvm use &&` em **todo** comando que
execute Node — sem isso, `npm run dev` e `npm start` falham com
`node: bad option: --experimental-strip-types`, que não se parece com erro de
ambiente.
````

---

## 9. Automação sem usuário presente

Só um item defensável, e ainda assim fraco: uma execução diária de
`nvm use && npm run verify` detectaria deriva de ambiente (versão de Node,
`node_modules` alterado) antes da próxima sessão. **Não recomendo adotar
agora:** sem `git`, um resultado vermelho não tem contra o que ser comparado,
não há histórico para bissecar e a máquina é única — o sinal chegaria sem
diagnóstico junto. Reavaliar depois de `git init` (decisão D-1 da auditoria de
segurança). Nada mais deste projeto se beneficia de execução sem o usuário.

---

## 10. Não verificado

| Item | Por quê | O que deixa em aberto |
|---|---|---|
| Conteúdo de `config/app.json` — em particular a **porta real** | **Não inspecionado por política vigente** (`deny Read` em `settings.json:26`). Respeitado por toda via, inclusive shell | Bloqueia as três regras de `curl` da LAC-4. Vira a pergunta **P-2** |
| Conteúdo de `data/**` | **Não inspecionado por política vigente** (`settings.json:27`). Nem o conteúdo, nem a listagem de nomes | Nada deste diagnóstico depende disso |
| Conteúdo de `CONTROLE DOS EMBARQUE.xlsx`, `planilha1.jpeg`, `planilha2.jpeg` | **Não abertos por decisão** — nenhuma regra os protege, mas contêm dado de cliente | Nada aqui depende disso |
| A suíte não foi executada | O build escreve em `dist/` e o teste de log plausivelmente escreve em `data/` — o enunciado proíbe alterar o estado do repositório | (a) A legibilidade da saída de falha do portão é **inferida** da configuração das três ferramentas, não observada. (b) A divergência de **6 casos** entre a contagem estática (273) e o `CLAUDE.md:112` (279) fica sem explicação. A mesma diferença de 6 aparecia antes de `H-11` (246 × 252), o que sugere origem estrutural — provavelmente casos gerados por laço ou `describe` aninhado — e não deriva de nenhuma história |
| Se `$ARGUMENTS` é substituído **antes** de o comando de contexto dinâmico `` !`…` `` executar | A página de skills descreve as duas mecânicas separadamente e não declara a ordem entre elas | Afeta o artefato 8.2. **Teste de 30 segundos:** criar a skill e rodar `/fatia H-11`. Se o bloco vier vazio, aplicar o plano B escrito no próprio artefato |
| Se o "não pergunte novamente" de modificação de arquivo vale por arquivo ou por sessão | A tabela de `/docs/pt/permissions#permission-system` diz apenas *"Até o final da sessão"* | Afeta a magnitude da LAC-5 — por isso ela está em 5º e não em 2º |
| Se as regras `allow` de `.claude/settings.json` estão **em vigor hoje** | Dependem de o diálogo de confiança do workspace ter sido aceito. Sem `.git`, a confiança é indexada pelo diretório de lançamento. Não é observável de dentro da sessão | Se não foram aceitas, **nenhuma** das 19 entradas está valendo e todo o custo AUTORIZAR medido está subestimado. Verificável pelo usuário com `/permissions` |
| Páginas `/docs/pt/slash-commands` e `/docs/pt/commands` | **Duas tentativas de leitura falharam** (`Command failed with no output`) | Os fatos sobre comandos personalizados vêm da página de skills, que declara a fusão e a referência de frontmatter comum. Nenhuma afirmação sobre comandos depende exclusivamente das páginas não lidas |
| Configuração global em `~/.claude` | **Fora de escopo** por definição do enunciado | Ver §10.1 |
| Versão exata do Claude Code em uso | Não medida nesta sessão. A auditoria anterior registra 2.1.220 em 04/08/2026 | Alguns comportamentos citados têm versão mínima (`disable-model-invocation` em tarefas agendadas: 2.1.196; `deny Read` cobrindo `Edit`: 2.1.208). Nenhuma proposta depende de recurso posterior a 2.1.208 |

### 10.1 O que só se resolve na configuração global (fora de escopo)

Não auditei `~/.claude`. Dois pontos deste projeto, porém, só se resolvem lá, e
registro sem entrar no diretório:

1. **Conectores MCP de nível de usuário estão ativos nesta sessão** — entre eles
   ferramentas de envio e upload. Isso **aumenta** o custo de supervisão: o
   usuário precisa vigiar um canal que o projeto não usa. Negá-los é possível no
   projeto (regra `deny` de qualquer escopo se aplica) e já é a decisão **D-3**
   da auditoria de segurança; desligar os conectores em si é ação global.
2. **Preferências pessoais em `~/.claude/CLAUDE.md`** são carregadas antes do
   `CLAUDE.md` do projeto. Se alguma contradisser uma regra inviolável, o Claude
   pode escolher arbitrariamente entre as duas
   (`/docs/pt/memory#write-effective-instructions`). Conferível com `/memory`,
   sem auditar o diretório.

---

## 11. Decisões do usuário

Cada uma muda o roteiro. Em ordem de impacto.

### P-1 — Aplicar este roteiro **antes** ou **depois** dos itens da auditoria de segurança?

- **Recomendado: depois, e sobre o arquivo revisado dela.** Os itens 1, 4, 5 e 6
  deste roteiro são acréscimos a `permissions.allow`. Aplicá-los sobre o
  `settings.json` **atual** consolidaria `Bash(git add *)`, `Bash(npm ci)`,
  `Bash(npm install)` e `Bash(python3 tools/profile_workbook.py *)` no arquivo —
  exatamente as quatro entradas que a auditoria de segurança manda tirar.
- **Exceção:** o item 1 (`Bash(nvm use)` + a linha do `CLAUDE.md`) é
  independente e pode ir hoje, sozinho. É o de maior razão do roteiro.
- **Se aplicar antes:** funciona, mas o próximo movimento de segurança terá de
  reescrever o mesmo arquivo, e a chance de perder uma entrada no meio do
  caminho é real — não há git para comparar.

### P-2 — Qual é a porta real em `config/app.json`?

- Não inspecionei o arquivo: está no `deny`. O `config/app.json.exemplo` traz
  `"port": 5173`.
- **Se for 5173:** as três regras de `curl` de §8.1 entram como estão.
- **Se for outra:** substitua o número. **Não use curinga na posição da porta** —
  §5 demonstra que ele abre escrita em caminho arbitrário.
- **Consequência de não responder:** o item 4 do roteiro fica bloqueado, e T-4
  continua sendo a única tarefa do projeto sem laço de verificação próprio.

### P-3 — Aceita mover as 25 linhas do gabarito do `CLAUDE.md` para a skill `/fatia`?

- **Recomendado: sim**, mantendo no `CLAUDE.md` a frase de gatilho e as 5 regras
  do protocolo. O `CLAUDE.md` cai de 261 para ~236 linhas, mais perto do alvo
  documentado de 200, e o gabarito passa a chegar **com a história já embutida**
  e a sobreviver à compactação. Vale notar que o arquivo **cresceu 15 linhas
  durante esta análise**, todas no bloco `## Estado` — sem uma poda, o alvo de
  200 fica cada vez mais distante.
- **Se preferir a proposta da auditoria anterior** (`docs/gabarito-fatia.md`):
  também melhora o contexto fixo, mas perde a sobrevivência à compactação e
  depende de o agente lembrar de ler o documento.
- **Se preferir não mexer:** o item 2 do roteiro cai inteiro. O protocolo
  continua funcionando — ele já funciona — só continua custando 46 linhas em
  toda sessão e deixando o contrato da história exposto à compactação.

### P-4 — O diálogo de confiança do workspace já foi aceito nesta pasta?

- Sem isso, **nenhuma** das 19 regras de `allow` está em vigor, e todo o custo
  AUTORIZAR medido neste documento está subestimado.
- **Como verificar:** rode `/permissions` e confira se as entradas aparecem como
  ativas, com a origem `.claude/settings.json`.
- **Recomendado:** conferir **antes** de aplicar qualquer item do roteiro —
  senão o sinal de "funcionou" da §7.2 não é interpretável.

### P-5 — `Bash(npm run lint:fix)` entra agora ou depois de `git init`?

- **Recomendado: depois.** `biome --write` escreve por subprocesso, fora do
  alcance do checkpointing; sem git, uma reformatação indesejada é permanente.
- **Se entrar agora:** ganha-se pouco (o agente pode formatar com `Edit`, que é
  reversível) e aceita-se um risco desproporcional.
