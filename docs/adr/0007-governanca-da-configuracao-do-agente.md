# ADR-0007 — Governança da configuração do agente

**Status:** Aceito · 04/08/2026, consolidado em 18/09/2026

> **Consolida três relatórios de 04/08/2026** — a auditoria de segurança, o
> diagnóstico de custo de supervisão e o blueprint de governance — que somavam
> **3.927 linhas** e foram removidos em `D-47`. Medido antes de remover: **558
> linhas com fato inédito (14,2%)**, e a maior parte delas já superada pelo
> próprio tempo. O que restou está aqui. Os originais seguem em
> `git log --diff-filter=D -- docs/auditoria-configuracao-claude.md`.

## Contexto

Em 04/08/2026 a configuração do agente foi auditada por três ângulos
independentes — segurança, custo de supervisão e prática de mercado —, sobre o
Claude Code **2.1.220**. Nada foi aplicado na auditoria; a execução veio no dia
seguinte, em três commits: `86f931a`, `139f4db`, `4262de4`.

**Três medições de ambiente sustentam decisões até hoje, e não existem em outro
lugar:**

1. **O Node v20.19.5 que aparecia nas sessões era herdado do processo que lançou
   o VSCode**, não uma falha do `nvm`. Medido: `systemctl --user show-environment`
   não declara `NVM_BIN`, o `.zshrc` não força versão, o `default` do `nvm` já era
   `22.23.2`, e um login zsh com ambiente zerado seleciona `v22.23.2`. **A correção
   principal custa zero e não é configuração** — é relançar o editor de um
   terminal do sistema. A linha `nvm use` no `CLAUDE.md` ficou como seguro.
2. **`nvm` existe no shell do agente.** A primeira auditoria afirmou o contrário
   e recomendou remover a linha; estava errada, e a correção é o inverso da
   recomendação. `type nvm` devolve `nvm`.
3. **O sandbox nunca foi exercido nesta máquina.** `bwrap` e `socat` presentes,
   mas `apparmor_restrict_unprivileged_userns = 1`; subir o perfil exigiria
   `sudo` e alteraria o sistema.

## Decisão

A configuração do agente é **versionada, estreita por padrão, e protegida por
pares** — não por diálogo de permissão.

O que vigora está em `.claude/settings.json` e no bloco de infraestrutura do
`CLAUDE.md`, e **este ADR não os duplica**: duas cópias que divergem é o defeito
que este repositório mais registra. O inventário da auditoria original dizia 19
entradas de `allow` e 2 de `deny`; hoje são outras, e era essa duplicação que
tornava os três relatórios falsos com o tempo.

**O princípio que rege o conjunto:** o que hoje é local e inofensivo, no push
vira público e permanente. É dele que saem a guarda de dados sensíveis, o
`.gitignore` do perfilamento bruto e a conferência a cada PR.

## Consequências

- **Sem prompt, o que não pode acontecer precisa ser impossível**, não apenas
  desaconselhado. Foi a troca de 31/08/2026: a confirmação em `git add` e
  `git push` saiu, e entraram as negações de comando que perde trabalho ou
  reescreve história.
- **Quem protege passou a ser o par** — o portão antes do commit e a `main`
  protegida depois dele.
- **Regra inviolável não migra para `.claude/rules/`**: rule é contexto, não
  configuração aplicada.

## O que foi recusado, e continua recusado

Decisão negativa é a que mais se perde e mais se re-litiga. Esta tabela existe
para que a proposta volte sabendo o que já foi respondido.

| Mecanismo | Motivo |
|---|---|
| **Hook `Stop`/`TaskCompleted` exigindo a *definition of done*** | A premissa "toda parada é uma entrega" falha: dispararia em turno de conversa, em sessão de leitura e em fatia deliberadamente parcial. **O modo de falha é o pior possível** — o usuário liga `disableAllHooks` e perde junto a guarda de dados sensíveis |
| **Hook `SessionStart` para `nvm use`** | **Não funciona.** O hook roda em processo próprio e o shell da ferramenta Bash reinicia a cada chamada: o `PATH` não atravessa. Registrado para não ser reinventado |
| **Hook `PostToolUse` rodando lint a cada `Edit`** | O Biome já está no portão. A cada edição é ruído e latência sem informação nova |
| **`CLAUDE.md` aninhado em `src/domain/`** | A fronteira já é **imposta pelo Biome**, que quebra a build. Instrução onde já há imposição é custo sem ganho |
| **Agent teams e fan-out para paralelizar o backlog** | O caminho crítico é cadeia **sequencial**. Fan-out não encurta cadeia sequencial — a premissa falha de forma verificável |
| **Dev container** | A aplicação depende de arquivo em pasta sincronizada do OneDrive no host. O container obrigaria a montar justamente o artefato mais sensível |
| **Plugins, marketplaces, configuração gerenciada** | As chaves de contenção só são lidas de configuração **gerenciada**, que exige `/etc/claude-code/` e administrador. É "não é configurável neste contexto", não "está mal configurado" |
| **`autoMemoryEnabled: false`** | A memória automática é reinjetada do disco após compactação, e grava **fora** do repositório. Numa cadeia longa tem valor |
| **`defaultMode` ≠ `default`** | `acceptEdits` alcança `mv`/`cp` sobre a planilha real; `auto`, `dontAsk` e `bypassPermissions` mudam o regime inteiro |
| **`AGENTS.md` como fonte compartilhada** | Todas as fontes localizadas eram T4. E a premissa falharia: uma ferramenta, um desenvolvedor |
| **Ampliar permissão sobre `npm install`/`ci` ou o perfilador** | Instalação de dependência e dado sensível. Aqui o diálogo de permissão **é** o controle. **Medido em 23/09/2026: o controle não alcançava `npm install <pacote>`.** O `ask` do projeto casa só o comando sem argumento, e um `allow` de `Bash(npm install *)` no `~/.claude/settings.json` global liberava o resto sem prompt — o controle vale enquanto nenhum settings de escopo mais amplo liberar o comando |

## O que foi recusado e depois adotado — e é a parte que ensina

Três recusas de 04/08/2026 foram revertidas. **Nenhuma caiu por mudança de
gosto: todas caíram porque a premissa era falsa ou envelheceu**, e é isso que
torna a tabela acima utilizável em vez de dogma.

| Recusado então | O que derrubou |
|---|---|
| **`.claude/rules/` com `paths:`** — "não sobrevive à compactação" | **A premissa era falsa, e a documentação a desmente:** rules com `paths:` recarregam quando o Claude volta a ler arquivo que casa o glob, e `InstructionsLoaded` expõe `load_reason: compact`. O outro lado da conta também mudou — o `CLAUDE.md` chegou a 6.400 palavras carregadas em toda sessão. Adotado em 31/08/2026 |
| **Hook `ConfigChange`** — "zero evidência de rotatividade" | O `settings.json` estava sem alteração desde 03/08/2026. Passou a mudar, e o hook de alinhamento nasceu |
| **Skills `novo-indicador` e `nova-pagina`** — "formato ainda não estabilizado" | Eram *adiar*, não *nunca*, e os gatilhos escritos pelo próprio projeto foram atingidos em 06 e 07/08/2026 |

## Os marcos de tooling já atingidos

A tabela "Marcos de tooling" do `CLAUDE.md` guarda só os gatilhos em aberto
desde 30/09/2026; os cumpridos vivem aqui, com o que cada um ensinou.

| Marco | Criado | O que ficou |
|---|---|---|
| Skill `novo-indicador`, ao concluir `H-13` | 06/08/2026 | Saiu da repetição real de `H-09` a `H-13`, com o formato estável; o motivo principal foi a omissão sistemática da rota |
| Subagente `revisor-xml`, antes de `H-24` | 11/08/2026 | `H-24` tinha 11 casos-limite, e errar custa a planilha da empresa. Pagou-se na primeira invocação: reprovou por dois defeitos reais, um gerando XML malformado |
| Skill `nova-pagina`, ao concluir `H-20` | 07/08/2026 | Cinco páginas com o mesmo padrão e as mesmas omissões; `H-22` foi a primeira conduzida por ela |
| Conferir se cada rule dispara, aos 20 `session_id` | 04/09/2026 | 28 sessões no log, e as cinco rules dispararam; o hook virou só observabilidade. O log é TSV, e não JSON |
| Guarda `documentacao.test.ts` e subagente `revisor-docs` | 11/09/2026 | 51 defeitos numa passada de ~490 linhas, um achado a olho depois de a suíte passar. A guarda cobra o computável, o revisor o que não é; ela precisou nascer depois de backlog e `README.md` concordarem |

## O que nunca foi verificado

Registrado porque some sem deixar rastro, e porque duas destas ainda decidem
coisas.

| Item | O que deixa em aberto |
|---|---|
| **Se o sandbox sobe nesta máquina** | Nunca exercido — `apparmor_restrict_unprivileged_userns = 1`, e instalar o perfil exige `sudo`. Continua desligado |
| **Se `deny Edit` cobre integralmente `Write`** | A documentação implica cobertura sem afirmá-la. Se não cobrir, o caminho de escrita fica coberto só pelo hook |
| **Conteúdo de `config/app.json` e de `data/**`** | Nunca inspecionados, por política vigente e por decisão de integridade da auditoria. A caracterização veio dos `.exemplo` |

## Método — como uma prática de mercado foi aceita

Vale para qualquer proposta futura de tooling: **consenso exige duas fontes
independentes**, e duas páginas do mesmo fornecedor não são independentes entre
si. As camadas são T1 (documentação e engenharia do fornecedor), T2 (relato de
engenharia de organização **identificável**) e T3 (repositório aberto com adoção
verificável); T4 — lista de dicas sem contexto de aplicação — serve como pista e
não sustenta afirmação.

Pela régua, "allowlist estreita em vez de modo amplo" e "git como rede de
segurança" **não atingiram quórum** e entraram como orientação do fornecedor,
não como consenso de mercado. Estão em vigor mesmo assim, por decisão própria —
o que a régua muda é o peso do argumento, não o direito de decidir.
