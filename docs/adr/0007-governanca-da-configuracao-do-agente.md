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
- **O gatilho da rule é `Read`, não `Write`** — limitação medida, não escolha:
  criar arquivo novo em `scripts/` não carrega `operacao-windows.md` (issue
  #23478 do `claude-code`). Editar carrega, porque o harness exige `Read` antes de
  `Edit`. Quem garante a regra é a asserção em `tests/repo/`, e não a rule.
- **Mudar permissão ou ruleset é do dono**: o classificador do modo automático
  bloqueia o agente nos dois casos (medido em 23/09/2026). O agente entrega o
  JSON ou o comando literal, e confere depois de aplicado.
- **`git switch -f` e `--discard-changes` negados têm par no repositório:**
  `scripts/sincronizar-distribuicao.ts` recusa árvore suja antes do próprio
  `git switch`. Os dois defendem a mesma coisa — mudança não commitada não
  atravessa troca de branch — por caminhos diferentes.

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
| Conferir se cada rule dispara, aos 20 `session_id` — **critério insuficiente, refeito por `D-71`** | 04/09/2026 | 28 sessões no log, e as cinco rules dispararam — `documentacao` 19 vezes, `comentarios` 13, `operacao-windows` 7, `escrita-xlsx` 4, `distribuicao` 2 —; o hook virou só observabilidade. O log é TSV, e não JSON: a primeira contagem leu 0 por supor o formato errado |
| Guarda `documentacao.test.ts` e subagente `revisor-docs` | 11/09/2026 | 51 defeitos numa passada de ~490 linhas, um achado a olho depois de a suíte passar. A guarda cobra o computável, o revisor o que não é; ela precisou nascer depois de backlog e `README.md` concordarem. **Foi o primeiro marco registrado DEPOIS do evento** — os quatro anteriores declararam o gatilho antes de ele ser atingido |

## O registro do ferramental

**O porquê datado das ferramentas de `tools/` e das guardas de `tests/repo/` que
nenhuma história registra.** Ferramenta e guarda ficam fora de história pela convenção
do repositório (`D-69`), e o cabeçalho de cada peça diz o porquê no presente; o que
aconteceu, e quando, mora aqui.

| Peça | Data | O que aconteceu |
|---|---|---|
| `tools/verificar-strip-types.mjs` | 06/08/2026 | Uma `parameter property` num construtor passou por `lint`, `typecheck`, `test` e `build`, e teria derrubado a aplicação no primeiro `npm start`: nenhuma etapa do portão executava `src/` com `--experimental-strip-types` |
| `tools/verificar-strip-types.mjs` | 02/09/2026 | O cabeçalho afirmava o ordinal do passo no portão, e ele envelheceu na inserção seguinte, a de `test:dados` |
| `tools/medir-navegador.mjs` | 01/09/2026 | O mesmo harness foi reconstruído do zero em duas sessões: a de 31/08/2026 declarou os procedimentos de navegador inalcançáveis e estava errada; a de 01/09/2026 os executou, mediu seis histórias, e o harness morreu com o scratchpad dela — a Pendência 2 do relatório daquele dia. No mesmo dia, `ENOTEMPTY` voltou depois de uma medição que já tinha dado certo, e `maxRetries` não bastou |
| `tools/medir-navegador.mjs` | 02/09/2026 | A cópia da fixture e o `app.json` passaram ao temporário, depois de um harness de medição gravar na fila do operador duas vezes em 01/09/2026: sem a cópia, "Aplicar alterações" numa medição gravaria na fixture do repositório; sem o `app.json`, `PUT /api/config/workbook` gravava na configuração do operador. O `AppConfig` incompleto — sem `headerRow`, `firstDataRow` e `stalledDaysThreshold` — apareceu como `linha invalida: NaN` na primeira medição de "Aplicar alterações", pego pela validação de `appendRow` |
| `tools/medir-navegador.mjs`, `medirCenarios` | 08/09/2026 | O preâmbulo foi reescrito oito vezes em 04 e 08/09/2026, e duas delas custaram uma execução extra por defeito no andaime. Provando a função, em 08/09/2026, uma espera que só procurasse "Carregando" retornaria no ato: o esqueleto de `H-85` não põe texto no `<main>`, e a Página Alertas devolveu 900 px, a altura da janela, contra os 9.248 reais |
| `tools/carregar-planilha.mjs` | 02/09/2026 | Passou a escrever no temporário por padrão: antes, sobrescrevia `data/quarantine.json` e fazia append em `data/history.jsonl`, estado do operador. E a lista de módulos de `src/domain/`, escrita à mão, envelheceu pela segunda vez (6 → 8): quatro dos cinco módulos alterados no dia — `color-mapper`, `process-query`, `process-builder` e `process-projection` — estavam fora do pacote, e passaram a ser enumerados do diretório |
| `tools/conferir-portas-dev.mjs` | 17/09/2026 | O aviso de não rodar o portão com o `dev` no ar existia em prosa no `CLAUDE.md`; foi lembrado, e ainda assim custou o mesmo preâmbulo de guarda colado à mão em oito invocações do portão |
| `tools/levantar-retroativo.mjs` | 30/09/2026 | O levantamento feito à mão na sessão custou uns quinze comandos, e a redação das 13 histórias de `E17` e `E18`, cerca de 630 mil tokens, a maior parte relendo diffs e decisões inteiras |
| `tools/abrir-historia.mjs` | 01/10/2026 | As seções da `/abrir-historia` viviam em shell injetado na skill, sem teste, e três defeitos passaram em silêncio: o `$0` do `awk` virava o argumento da skill e o contrato saía vazio; o `grep -F` pela célula de `H-04` perdia a linha de `H-04, H-07`; e o de `H-10` trazia as linhas de `H-100` a `H-114` |
| `tools/abrir-historia.mjs` | 02/10/2026 | A seção de identificadores buscava só em `src/`, e todo nome da interface saía como ausente: na `H-101`, a única aberta em 01/10/2026, os três listados existiam em `web/src/` |
| `tools/contar-documentacao.mjs` | 01/10/2026 | O levantamento de 01/10/2026 achou seis de 41 números de estado atual velhos — 96 histórias com 114 no backlog, seis ADRs com sete, "sete passos" com oito no `verify` —, e os formatos que o contador precisa ler: história cujo bloco seguinte é um épico, linha de tabela sem a barra vertical final, e o balde "DE EXECUCAO" em duas variantes |
| `tests/repo/contratos.test.ts`, peças de `.claude/` no `CLAUDE.md` | 07/08/2026 | `/nova-pagina` foi criada em 07/08/2026, e a tabela de marcos do `CLAUDE.md` seguiu mandando criá-la por quatro dias: `conferir-alinhamento.sh` roda em `ConfigChange`, e editar o `CLAUDE.md` não é mudança de configuração |
| `tests/repo/contratos.test.ts`, a guarda de âncora | 21/09/2026 | Conferia o caminho citado por `existsSync`, e `config/app.json`, no `.gitignore`, existe na máquina do dono: o comentário que o citava passava no portão local e reprovava no CI. Custou o PR #131 e reprovou de novo em 21/09/2026, nos dois gates, `verify` e `verify-windows`; a guarda passou a consultar o git |
| `tests/repo/documentacao.test.ts` | 11/09/2026 | Medido ao criá-la, em 11/09/2026: 220 dos 445 commits não-merge da `main` tocavam apenas `docs/`, `CLAUDE.md` ou `README.md`. No mesmo dia, as quatro histórias de `E15` entraram sob o cabeçalho de `E14` com as cinco asserções de índice verdes, e quem achou foi o olho do usuário |
| `tests/repo/documentacao.test.ts` | 16/09/2026 | As quatro histórias de `E15` estavam rotuladas abaixo da régua de tamanho — `H-94` dizia `M` com 18 arquivos —, e a régua passou a ter guarda |
| `tests/repo/documentacao.test.ts` | 06/10/2026 | O total de histórias afirmado em prosa saiu desta guarda: desde as regiões de 01/10/2026 o regex não casava linha nenhuma, e quem o cobre é `tests/repo/contagens.test.ts` |

## A rule não garante nada, e a guarda garante (`D-71`)

**O critério de 04/09/2026 media se cada rule disparava ao menos uma vez, e não se
disparava quando era necessária.** O log de `registrar-instrucoes.sh` só registra o
que carregou; a carga que faltou não gera linha. Medido nas transcrições do projeto,
só a linha principal e só depois da criação de cada rule:

| rule | sessões que tocaram arquivo do glob | carregou | nunca carregou |
|---|---|---|---|
| `comentarios` | 19 | 10 | 9 |
| `documentacao` | 23 | 14 | 9 |
| `operacao-windows` | 16 | 4 | 12 |
| `distribuicao` | 13 | 4 | 9 |
| `escrita-xlsx` | 12 | 1 | 11 |
| `microcopia` | 3 | 0 | 3 |

**A documentação diz que a rule carrega quando `Read`, `Edit` ou `Write` tocam arquivo
do `paths:`, nunca pelo shell, e o comportamento real é mais estreito.** Quatro
sessões tocaram arquivo do glob por essas ferramentas sem carga registrada — uma só
com `Edit`, outra só com `Write`, duas com `Read` —, e no mesmo dia uma leitura por
`Read` de `scripts/sincronizar-distribuicao.ts` não carregou `distribuicao.md`. Rule
já lida ou escrita na sessão também não é anexada de novo.

**O "nunca pelo shell" acima é o registro de 06/10/2026, e o gatilho da rule muda
com a versão do Claude Code.** Pelo
[changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) e pela
seção [Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
da documentação, os dois consultados em 10/10/2026:

| Versão do Claude Code | A rule com `paths:` carrega quando o arquivo do glob é | Fonte |
|---|---|---|
| até a 2.1.287 | lido por `Read` | changelog da 2.1.288: *"previously only Read loaded them"* |
| a partir da 2.1.288 | também criado ou alterado por `Write` ou `Edit` | changelog da 2.1.288: *"Fixed path-scoped `.claude/rules` and nested CLAUDE.md files not loading when Write or Edit creates or changes a file in their scope"* |
| a partir da 2.1.293 | também lido pelo shell, com `cat`, `head`, `tail`, `sed -n` ou `grep` de um arquivo só | changelog da 2.1.293; e a documentação: *"A path-scoped rule loads when Claude uses the Read, Write, or Edit tool on a matching file. It also loads when Claude views a matching file with a Bash command that counts as a read, such as `cat` or `head` on a single file."* |

**Isso explica as sessões da medição de 06/10/2026 que tocaram o glob só com `Edit`
ou só com `Write` sem carga:** nenhuma transcrição da linha principal até aquele dia
roda versão posterior à 2.1.287 (campo `version`). As de `Read` seguem sem
explicação, porque `Read` carrega em todas as versões. Pelo mesmo changelog, "o
gatilho da rule é `Read`, não `Write`", em Consequências, valia até a 2.1.287.

**O efeito apareceu na tela:** a `microcopia.md` proíbe identificador de auditoria no
texto que o operador lê, e sete estavam lá, em três páginas.

**A decisão foi não forçar a carga.** Um hook que bloqueasse a ferramenta até a rule
ser lida foi desenhado e recusado: complexidade alta, e ainda aproximado no shell. O
que se adotou é a prática comum — a rule é orientação, e o que nela não pode falhar
tem **guarda que reprova e cita a rule**. Cada guarda foi provada por mutação: as sete
reprovam quando a regra é quebrada de propósito. A mutação da âncora achou um defeito
da própria guarda: `H-\d{2}` não casava `H-100`, e citação de três dígitos passava
sem conferência desde que o backlog passou de `H-99`.

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
