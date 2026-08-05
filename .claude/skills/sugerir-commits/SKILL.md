---
name: sugerir-commits
description: Analisa a árvore de trabalho do CronosComex (git status + diff) e devolve um plano de entrega — se necessário, a branch a criar antes — e os commits atômicos, cada um com seu `git add` e a mensagem pronta, usando os escopos da cadeia canônica (domain, io, app, http, web, tools, config, docs, claude). Use quando o usuário pedir para sugerir ou montar commits, agrupar mudanças pendentes, ou perguntar "o que preciso commitar". Apresenta o plano, aguarda aceite, e SÓ ENTÃO pede permissão para executar — nunca cria branch nem commita sem aprovação do plano E permissão explícita. Push não entra aqui.
when_to_use: Quando o usuário disser "sugere os commits", "monta os commits", "agrupa o que está pendente", "o que preciso commitar" ou invocar /sugerir-commits.
---

# Sugerir commits

Lê o estado do repositório, **decide em que branch os commits devem cair**, agrupa as
mudanças em commits atômicos e devolve, para cada um, o par `git add` + mensagem pronta.

## Fluxo de execução — regra deste repositório

Esta skill **propõe e, com dupla autorização, executa** — não é só apresentação.
A ordem é fixa e cada seta é um portão humano:

1. **Eu sugiro** o plano — a ação de branch (se houver) e cada commit atômico com seu
   `git add` e a mensagem pronta.
2. **Você aprova ou rejeita** o plano (agrupamento, mensagens, branch).
3. Com o aceite, **eu peço permissão para executar** antes de rodar qualquer comando `git`.
4. Com a permissão, **eu executo** `git switch`, `git add` (caminhos exatos) e `git commit`,
   na ordem do plano.

Portões inegociáveis:

- **Sem aprovação do plano E sem permissão explícita, não rodo nada.** Aprovar o plano não é
  permissão para executar — são dois passos distintos. Isso decorre da regra do
  `~/.claude/CLAUDE.md`: *"você não irá commitar automaticamente"*.
- **`git push` não entra aqui.** Push é para fora e fica com você — hoje nem é possível, porque
  não há remote configurado. Para PR, veja `/sugerir-prs`.
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

5. **Ordene por dependência, seguindo a cadeia canônica.** Aqui ela não é convenção: o Biome
   **quebra a build** se `src/domain/` importar `io`, `app`, `http` ou `web`.

   ```
   domain → io → app → http → web
   ```

   O que é fundação vem primeiro. E o contrato antes do código que o implementa: se a fatia
   mudou `docs/05-contratos-api.md` ou uma tabela de decisão de `docs/03-modelo-dados.md`, esse
   commit precede o que a implementa.

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

Ao voltar para a `main`, use `git merge --no-ff <branch>`: sem isso o merge some e o histórico
volta a ser um acúmulo linear, que é justamente o que a branch existe para evitar.

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

Depois de apresentar o plano, **pare e aguarde o aceite**. Com o aceite, **peça permissão** e só
então execute os comandos na ordem (branch → `add`/`commit` de cada grupo). Não pule o pedido de
permissão, não junte tudo num `git add` amplo, e não faça `push`.
