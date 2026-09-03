---
name: sugerir-commits
description: Analisa a árvore de trabalho do CronosComex (git status + diff) e devolve um plano de entrega — se necessário, a branch a criar antes — e os commits atômicos, cada um com seu `git add` e a mensagem pronta, usando os escopos da cadeia canônica (domain, io, app, http, web, tools, config, docs, claude). Use quando o usuário pedir para sugerir ou montar commits, agrupar mudanças pendentes, ou perguntar "o que preciso commitar". Apresenta o plano com os comandos literais e aguarda um único aceite, que vale como permissão para executar — nunca commita sem aprovação. Push não entra aqui.
when_to_use: Quando o usuário disser "sugere os commits", "monta os commits", "agrupa o que está pendente", "o que preciso commitar" ou invocar /sugerir-commits.
---

# Sugerir commits

Lê o estado do repositório, **decide em que branch os commits devem cair**, agrupa as
mudanças em commits atômicos e devolve, para cada um, o par `git add` + mensagem pronta.

## Fluxo de execução — regra deste repositório

Esta skill **propõe e, com autorização, executa** — não é só apresentação.
A ordem é fixa, e **há um portão humano, não dois** — o portão duplo saiu em
**07/08/2026**, porque a segunda pergunta não acrescentava informação:

1. **Eu sugiro** o plano — a ação de branch (se houver) e cada commit atômico com seu
   `git add` de caminhos exatos e a mensagem pronta.
2. **Você aprova ou rejeita.** A aprovação **vale como permissão para executar**.
3. **Eu executo** `git switch`, `git add` e `git commit`, na ordem do plano.

Portões inegociáveis:

- **Sem aprovação explícita, não rodo nada.** O que satisfaz a regra do `~/.claude/CLAUDE.md`
  — *"você não irá commitar automaticamente"* — é o plano ter mostrado **os comandos literais**
  antes: cada `git add` com os caminhos exatos e cada mensagem inteira. Aprovar um plano assim é
  aprovar a execução, e perguntar de novo depois disso não acrescenta informação nenhuma — só
  gasta uma rodada. **A obrigação real é do plano, não da segunda pergunta:** plano vago não
  autoriza nada, por mais "sim" que receba.
- **O prompt de permissão da ferramenta continua sendo a última barreira.** `git add` está em
  `ask` nas regras do projeto, e é ele que dá o direito de veto no último instante.
- **`git push` não entra aqui.** Push é para fora; esta skill para nos commits locais. Quem
  empurra a branch e abre o PR é `/sugerir-prs`.
- **Nenhum dado real no commit.** Antes de agrupar, confira que nenhum diff carrega valor de
  célula da planilha, `.xlsx` ou `.jpeg` da raiz, conteúdo de `config/app.json`, ou caminho
  absoluto com o nome de usuário do SO. O commit é o primeiro passo para o GitHub público, e o
  histórico do git não esquece. Se carregar, **pare e reporte**; não commite.
- **Nunca `git add .` nem `git add -A`** — o agrupamento se perde. Só os caminhos exatos de cada
  commit. Aqui isso não é só disciplina: o hook `guard-dados-sensiveis.sh` **bloqueia** as duas
  formas, e `Bash(git add *)` está em `ask`.
- Se um commit falhar no meio da sequência, **pare e reporte** — não contorne nem siga para o
  próximo.

## Convenção da mensagem — vem do arquivo global, não daqui

O **formato** da mensagem (header `<tipo>(<escopo>): <descrição>`, tipos válidos, quando o body
é obrigatório) está em **`~/.claude/CLAUDE.md`, seção "Commits (Conventional Commits)"**, e vale
para qualquer projeto. **Siga de lá.** Esta skill não redefine nem resume o formato: duplicar
aqui criaria duas fontes de verdade que divergem na primeira vez que você mudar de ideia.

**Idioma:** pt-br, como no global. Este projeto **não** tem a exceção em inglês do projeto Samba.

**Conjunto de tipos:** exatamente o do global — `feat`, `fix`, `chore`, `refactor`, `docs`,
`style`, `perf`. **Sem `test`**, deliberadamente: aqui a *definition of done* exige teste com
valor concreto dentro da própria fatia, então commit só-de-teste é raro por construção.

O que **é** específico deste projeto, e por isso mora aqui, é o vocabulário de escopos, a ordem
de dependência e a decisão de branch.

## Escopos do CronosComex

Derivados da estrutura real e da fronteira que o Biome impõe — use o mais específico que couber:

| Escopo | Cobre |
|---|---|
| `(domain)` | `src/domain/` — funções puras: indicadores, classificação, datas, cores, normalização |
| `(io)` | `src/io/` — leitura e escrita de `.xlsx`, watcher, quarentena, extração de estilo |
| `(app)` | `src/app/` — process-store, config, logger, carregadores de mapa e alias |
| `(http)` | `src/http/` — rotas Fastify, servidor, erros |
| `(web)` | `web/` — SPA React, componentes, tema |
| `(tools)` | `tools/` — perfilador, gerador de fixtures |
| `(config)` | `config/`, `package.json`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `.nvmrc`, `.gitignore` |
| `(docs)` | `docs/`, `CLAUDE.md` |
| `(claude)` | `.claude/` — skills, hooks, settings |
| `(repo)` | versionamento e estrutura do repositório em si |

## Procedimento

1. **Levante o estado completo do repositório** (em paralelo — todos são somente-leitura e não
   pedem aprovação):
   - `git branch --show-current` — branch atual, e se é a padrão.
   - `git status --porcelain` — modificados, novos (`??`), removidos (`D`).
   - `git diff` — não preparado.
   - `git diff --cached` — já preparado.
   - Para arquivos novos, leia o conteúdo relevante para entender o que vai entrar.

2. **Entenda cada mudança.** Não trate a árvore como um bloco só. Leia os diffs o bastante para
   classificar tipo e escopo corretamente.

3. **Decida a branch** — antes de agrupar, ver abaixo.

4. **Agrupe em commits atômicos.** Cada commit com uma única preocupação coerente. Separe
   mudanças não relacionadas mesmo dentro do mesmo arquivo ou pasta. Critérios: por **escopo**
   (tabela acima) e por **preocupação** (uma feature, um fix, um refactor — não misture). Uma
   deduplicação não vai junto com uma feature nova.

   **O corte é o ponto verde: a preocupação fecha E o portão passa.** Não é tempo nem tamanho.
   É isso que faz o commit atômico pagar em vez de virar cerimônia — `git bisect` pressupõe que
   todo ponto do histórico é testável, e um commit vermelho no meio quebra a busca binária.
   Dentro de uma história os pontos verdes caem sozinhos na cadeia canônica: contrato fechado,
   domínio verde, rota verde, interface verde.

   **Quando o agrupamento for não óbvio, prove — e prove DURANTE, não no fim.** Depois de
   cada commit de código, guarde o resto da pilha e rode a suíte sobre o ponto que acabou de
   criar:

   ```bash
   git stash push -u -q -m "resto" && npx vitest run; git stash pop -q
   ```

   O `;` antes do `pop` é deliberado: a suíte reprovando não pode deixar a pilha guardada.
   Informe a contagem de cada ponto no plano.

   **Percorrer `HEAD` destacado no fim também funciona, e descobre tarde.** Foi como `H-12`
   mediu que um `exit=1` intermitente não era defeito do agrupamento. Em `H-34` a forma
   incremental pegou o **primeiro** commit reprovando — um comentário citava identificador que
   só nasceria dois commits adiante, e a guarda de âncora estava certa. Custou um `--amend`;
   no fim da pilha teria custado `git reset HEAD~4`.

   Um arquivo tocado por duas preocupações **não** se divide aqui: `git add -p` é interativo e
   não roda neste ambiente. Escolha o commit onde ele cabe melhor e **diga por quê** — foi o caso
   de `docs/06-backlog.md` em `H-24`, tocado pelo contrato e pelo fechamento.

5. **Ordene por dependência, seguindo a cadeia canônica.** Aqui ela não é convenção: o Biome
   **quebra a build** se `src/domain/` importar `io`, `app`, `http` ou `web`.

   ```
   domain → io → app → http → web
   ```

   O que é fundação vem primeiro. E o contrato antes do código que o implementa: se a fatia
   mudou `docs/05-contratos-api.md` ou uma tabela de decisão de `docs/03-modelo-dados.md`, esse
   commit precede o que a implementa.

   **Exceção, e é a única:** o marcador `> **Pendente de \`H-NN\`.**` em
   `docs/05-contratos-api.md` só pode sair **no mesmo commit que serve a rota**, ou depois.
   `tests/repo/contratos.test.ts` reprova rota documentada, sem marcador e não servida — então
   o contrato indo na frente deixa o commit **vermelho**, e commit vermelho no meio quebra o
   `git bisect` que o corte atômico existe para preservar. As demais mudanças do documento vão
   antes normalmente; só o marcador viaja com a rota.

   **E a exceção é MAIOR do que o marcador**, medido em 02/09/2026: para uma rota **nova** —
   que nasce sem marcador nenhum — a seção `### \`MÉTODO /rota\`` inteira reprova se entrar
   antes do código que a serve. A regra prática é uma só: **a seção do contrato de uma rota
   viaja com o commit que a serve, ou depois dele.**

   Medido em `H-26`: os dois primeiros commits reprovaram e precisaram de `git reset HEAD~2`.
   Em 02/09/2026 aconteceu de novo, com rota nova, e custou um `git reset HEAD~1`.
   **Não resta nenhuma rota com o marcador** — `docs/05-contratos-api.md` tem zero ocorrências
   de "Pendente de" desde `H-30` —, então o que reaparece é o caso da rota nova.

6. **Para cada commit, devolva:**
   - O `git add` com os caminhos **exatos** daquele commit.
   - A mensagem no padrão do `~/.claude/CLAUDE.md`.

## Decisão de branch

- **Nunca commite direto na branch padrão (`main`).** Se o HEAD estiver em `main`, sugira criar
  uma branch de trabalho **antes** dos commits.
- **Nomenclatura: `H-NN/<tipo>-<descrição-curta>`.** A unidade de trabalho deste projeto é a
  história do backlog, e a branch precisa ser rastreável até ela. Exemplos:
  `H-12/feat-indicadores-risco`, `H-24/feat-escrita-cirurgica`.
- **Trabalho fora de história** (tooling, correção de documento, ajuste de configuração) usa
  `<tipo>/<escopo>-<descrição>`: `chore/claude-tooling`, `docs/governanca-correcoes`.
- **Reaproveite a branch atual** se ela já for de trabalho e a preocupação bater com o que está
  pendente — não troque à toa. Diga explicitamente "permanece na branch atual (`<nome>`)".
- **Branch nova** se a preocupação for diferente da branch atual.
- **Várias preocupações independentes:** proponha **uma branch por grupo** e aponte
  `/sugerir-prs` para o fatiamento completo da entrega.

**Não mescle na `main` por conta própria.** Havendo remote configurado — e há —, o merge local
**mata o PR**: quando a branch chega ao GitHub ela já está mesclada, e não há o que revisar. A
sequência correta termina fora daqui:

```
branch → commits (esta skill para aqui) → /sugerir-prs empurra e abre o PR → merge no GitHub
```

Merge local com `git merge --no-ff` só se aplica a trabalho que **não** vai virar PR. Neste
projeto isso é a exceção, não a regra.

## Formato de saída

Apresente **a ação de branch primeiro** (se houver), depois os commits em ordem de execução —
tudo em blocos de shell copiáveis.

```bash
# branch (só se a atual não servir — por exemplo, você está na main)
git switch -c H-12/feat-indicadores-risco

# 1 — o contrato antes do código que o implementa
git add docs/09-rastreabilidade.md
git commit -m "docs(docs): fixa o contrato de IND-06, IND-14 e IND-15"

# 2 — a implementação
git add src/domain/indicators.ts tests/domain/indicators-risk.test.ts
git commit -m "feat(domain): entrega os indicadores de risco"
```

Para mensagens com body, use vários `-m` ou um here-doc, mantendo a lista do body com `-`.

## Pré-requisito

O passo 1 depende de repositório git inicializado. Se `git status` responder
`fatal: not a git repository`, **pare e diga** — sem repositório não há árvore de trabalho para
agrupar, e `git init` é decisão do usuário, não sua.

Depois de apresentar o plano, **pare e aguarde o aceite**. Com o aceite, execute os comandos na
ordem (branch → `add`/`commit` de cada grupo) — **sem uma segunda pergunta**. Não junte tudo num
`git add` amplo, e não faça `push`.
