---
name: sugerir-prs
description: Propõe como fatiar o trabalho não mesclado do CronosComex em 1 ou mais Pull Requests (agrupados por preocupação, ordenados pela cadeia canônica, com uma branch sugerida por PR) E escreve título e corpo de cada um em seções markdown. Descrever um único PR é o caso N=1 desta skill. Use ao preparar ou abrir PR. Apresenta o plano e o corpo, aguarda aceite, e SÓ ENTÃO pede permissão para executar o passo para fora (push da branch + `gh pr create`) — nunca faz push nem abre PR sem aprovação do plano E permissão explícita.
argument-hint: [branch-base]
---

# Sugerir PRs

Decide a **estrutura de entrega** de uma pilha de mudanças: quantos PRs, o que vai em cada um, e
a descrição de cada. **Descrever 1 PR é o caso N=1** — uma pilha coesa vira um PR só.
**Propõe e, com dupla autorização, executa** o passo para fora (push da branch + `gh pr create`).
Os **commits** locais são da `/sugerir-commits`; esta aqui cuida de abrir o PR.

**Argumento opcional:** a branch base (padrão `main`).

> **Esta skill publica.** Push e PR são irreversíveis na prática — o objeto de commit persiste no
> GitHub mesmo depois de um force-push. Ela pode ser carregada automaticamente, mas o portão
> duplo abaixo não é opcional: **planejar é livre, executar não**. Nenhum push ou `gh` roda sem
> aceite do plano E permissão explícita, e ambos ainda passam pelo prompt de permissão da
> ferramenta.

## Pré-requisitos — confira, não presuma

Esta skill não afirma o estado do repositório: estado descrito em prosa envelhece, e uma
afirmação errada aqui faz você parar quando podia seguir, ou seguir quando devia parar.
**Meça na hora**, em paralelo:

```bash
git rev-parse --is-inside-work-tree     # repositório inicializado
git config --get remote.origin.url      # remote configurado
gh auth status                          # gh autenticado
```

Faltando qualquer um, **pare e diga qual** — não há como abrir PR, e configurar remote ou
autenticar `gh` é decisão do usuário, não sua.

## Fluxo de execução — regra deste repositório

Mesma disciplina da `/sugerir-commits`, mas aqui o passo executável é **para fora** (torna branch
e PR visíveis no GitHub, para quem tiver acesso) — por isso os portões valem em dobro:

1. **Eu sugiro** o plano — quantos PRs, o escopo de cada um, a branch, o título, e o corpo em
   markdown (escrito num arquivo `.md` no scratchpad, pré-requisito do `--body-file`).
2. **Você aprova ou rejeita** o plano e o texto de cada PR.
3. Com o aceite, **eu peço permissão para executar** antes de qualquer push ou `gh`.
4. Com a permissão, **eu executo** por PR, em ordem de dependência: `git push -u origin <branch>`
   e `gh pr create --base <base> --title … --body-file …`.

Portões inegociáveis:

- **Sem aprovação do plano E sem permissão explícita, não faço push nem abro PR.** São dois passos.
- **Push e PR são para fora** — no GitHub não desfazem limpo. Confirmo o destino (remote, branch
  base) antes de rodar.
- **Nenhum dado real no que vai para fora.** Título, corpo e os arquivos do diff **não** podem
  revelar valor de célula da planilha, `.xlsx` ou `.jpeg`, conteúdo de `config/app.json`, nem
  caminho absoluto com o nome de usuário do SO. Confira antes; se revelar, **pare**.
- **Pré-requisitos:** repositório git inicializado, remote do GitHub configurado, e `gh`
  autenticado. Faltando qualquer um, **pare e diga** — não há como abrir PR.
- Escrever o corpo do PR num `.md` **não é** executar — é preparação, e pode acontecer antes da
  permissão. Push e `gh pr create` é que exigem o portão.
- Se um push ou `gh` falhar no meio da sequência, **pare e reporte** — não contorne.

## Convenção de header — vem do global

O header segue o padrão do `~/.claude/CLAUDE.md`, seção "Commits (Conventional Commits)". Não
redefina aqui. Os **escopos** do projeto estão na skill `/sugerir-commits` (tabela da cadeia
canônica) — reaproveite, não invente vocabulário paralelo.

**Idioma: pt-br**, título e corpo. Este projeto não tem a exceção em inglês do projeto Samba.

## Passos

### 1. Levante o diff

- `git rev-parse --abbrev-ref HEAD` — branch atual.
- `git log --oneline main..HEAD` — os commits da branch.
- `git diff main...HEAD --stat` e `git diff main...HEAD` — escopo e conteúdo.

Se a branch ainda não tiver commits (mudanças só na árvore de trabalho), use `git status` +
`git diff` e diga isso no fim. Se o repositório não estiver inicializado, ou não houver remote,
pare e diga — não há pilha para fatiar nem destino para onde enviar.

### 2. Decida o número de PRs

Pergunta central: **a pilha é uma preocupação coesa, ou várias sem relação?**

- **1 PR** — tudo serve ao mesmo objetivo. É o caso comum.
- **N PRs** — separe quando há preocupações independentes misturadas, ou quando uma parte é
  fundação da outra e ganha em ser revisada e mesclada antes.

Critérios de corte: **preocupação** (uma por PR), **dependência** (a base antes de quem a
consome — siga `domain → io → app → http → web`), **revisabilidade**. Na dúvida, prefira
**menos** PRs — não fatie por fatiar.

Neste projeto há um critério natural que costuma bastar: **uma história do backlog, um PR.** O
plano de entrega já define a unidade, e o caminho crítico é sequencial
(`docs/07-plano-entrega.md`), então PRs paralelos raramente fazem sentido.

### 3. Para cada PR

- **Branch sugerida** — `H-NN/<tipo>-<descrição>` para trabalho de história;
  `<tipo>/<escopo>-<descrição>` fora dela.
- **Escopo** — quais arquivos e áreas entram; o bastante para delimitar, sem listar o diff todo.
- **Título** — header no padrão do global, em **pt-br**.
- **Corpo** — estruturado em **seções markdown (`##`)**, escolhidas pelo que o PR contém, não um
  conjunto fixo. Sempre um resumo; verificação, risco e notas **só quando houver**.

```markdown
<tipo>(<escopo>): <descrição>

## Resumo
- <um marcador por mudança técnica relevante; cite arquivo ou módulo quando ajudar>

## Verificação        ← o que foi de fato conferido
- <comando real> → PASSOU/FALHOU

## Risco e notas      ← quando houver ressalva
- <mudança de contrato, invalidação de cache, fixture a regenerar, nova pendência>
```

> As seções são **ilustrativas** — adapte ao conteúdo. O que importa é a estrutura em seções,
> não um gabarito rígido.

### 4. Sequenciamento e handoff

- Se **mais de um PR**, dê a **ordem de abertura** (por dependência) e a relação entre eles.
- **Escreva o corpo de cada PR num arquivo `.md`** (um por PR, no scratchpad da sessão)
  **antes** do passo de push/`gh` — o `--body-file` exige que o arquivo **já exista** na hora.
- Por PR, depois do aceite e da permissão, execute em ordem de dependência:

```
git push -u origin H-12/feat-indicadores-risco

gh pr create --base main \
  --title "feat(domain): entrega os indicadores de risco" \
  --body-file "<scratchpad>/pr-h12-indicadores-risco.md"
```

> `<scratchpad>` = diretório de scratchpad da sessão, caminho **absoluto**.

- Os **commits** de cada PR são planejados pela `/sugerir-commits` (execução local, com portão);
  esta aqui cuida do nível do PR — push da branch e abertura no GitHub, também com portão.

### 5. Regras de conteúdo

- **Um marcador por mudança técnica relevante** no resumo; prefixe pela área quando ajudar
  (`Domain:`/`IO:`/`HTTP:`/`Web:`). Não despeje o diff.
- **Verificação: só o que existe, e aqui existe portão de verdade.** O projeto tem
  `npm run verify` = teste do hook + lint + typecheck + test + build. Informe o resultado **real**,
  com o número que o Vitest devolveu naquela execução. **Nunca copie contagem de teste de outro
  documento** — a contagem muda a cada fatia, e cópia manual diverge em silêncio.

  Se `node --version` não devolver `v22.23.2`, prefixe `nvm use &&`: o shell herda a versão do
  processo que lançou o editor, e `npm run dev` falha com `node: bad option`.

  Complemente com o que mais foi conferido de fato: conferência contra o arquivo real via
  `GET /api/indicators`, casos-limite de `docs/08-qualidade-operacao.md` §1.3 cobertos com valor
  concreto, revisão pelo agente `revisor-xml` (quando existir, a partir de `H-24`).
- **Ancore no diff real.** Não invente passos nem marcadores de exemplo.
- **Itens transversais vão em risco e notas:** mudança de contrato de rota (`docs/05-contratos-api.md`),
  mudança em tabela de decisão (`docs/03-modelo-dados.md`), fixture a regenerar
  (`tools/build_fixtures.py`), pendência aberta ou fechada no `CLAUDE.md`.

## O que o push tem de irreversível

O perigo não é o push, é o **commit**: o histórico do git é cumulativo, então um segredo
commitado localmente viaja em todo push futuro, e continua alcançável pelo hash mesmo depois
de removido do topo. Por isso a varredura acontece **antes** de commitar (`/sugerir-commits`) e
de novo aqui, sobre `git diff <base>...HEAD`.

O princípio que rege a decisão **D-2** de `docs/governance-tooling-claude.md`: o que hoje é
local e inofensivo, no push vira público e permanente. `docs/perfilamento/*.json` está no
`.gitignore` por isso; o restante de `docs/` não está, e por isso é conferido a cada PR.

> Antes de abrir: rode `/fechar-historia H-NN` se o PR fecha uma história, e `/sugerir-commits`
> para o plano de commits.
