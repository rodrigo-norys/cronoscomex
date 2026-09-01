# Relatório da sessão autônoma — 01/09/2026

Sessão sem supervisão humana. O dono não esteve disponível durante a execução;
toda decisão tomada aqui está registrada, e as que exigiam ele ficaram abertas.

> **Resumo em cinco linhas.** **A Onda 1 fechou inteira** — as seis correções
> que `H-47` mediu, `H-68` · `H-71` · `H-67` · `H-69` · `H-72` · `H-70` —, e
> **com elas o épico `E9`**, em seis PRs encadeados, **#81 a #86**, que se
> mesclam **nesta ordem**. A suíte foi de **1592 para 1613 testes**, verde em
> toda história, e **cinco dos seis PRs já têm os dois gates do CI passando**.
> **A Onda 2 não começou:** `H-50` é a única `G` do backlog e o limite de 6 PRs
> abertos do mandato foi atingido antes dela. **Duas pendências aguardam você**,
> e a primeira é um defeito que este ambiente encontrou por acidente e que
> **escreveu na fila de edições real do operador** — restaurada byte a byte,
> nada perdido, mas a causa segue no código.

**Baseline da árvore**, medido antes da primeira linha de código, com
`npm run verify` na `main` em `4d7bac6`: **73 arquivos de teste, 1592 testes**,
tudo verde. Árvore limpa, zero PRs abertos.

**O que mudou em relação à sessão anterior, e é o que tornou esta possível:**
existe **Chrome 151 nesta máquina** (`/usr/bin/google-chrome`). A sessão de
31/08 declarou os procedimentos de navegador inalcançáveis; isso deixou de ser
verdade. Todas as seis histórias foram medidas por CDP, com o antes reproduzido
**antes** de qualquer correção.

---

## 1. PLANO — o que estava aberto e a ordem executada

17 histórias abertas na partida. O mandato fixou a ordem, e ela foi seguida sem
desvio:

| # | História | Estado | PR |
|---|---|---|---|
| 1 | `H-68` — o `<select>` cabe em 320 px | ✅ | #81 |
| 2 | `H-71` — o valor anterior é legível | ✅ | #82, reenviado pelo #87 |
| 3 | `H-67` — a linha do ranking cabe em 320 px | ✅ | #83, reenviado pelo #87 |
| 4 | `H-69` — o texto cortado tem caminho de volta | ✅ | #84 |
| 5 | `H-72` — a aba corrente sobrevive ao alto contraste | ✅ | #85 |
| 6 | `H-70` — o foco sobrevive à navegação programática | ✅ | #86 |
| — | **Onda 2** — `H-50`, `H-66` | não começada | — |
| — | **Onda 3** — `E11`, `H-57` a `H-65` | não começada | — |

### 1.1 O harness de medição, e por que ele foi o investimento certo

Nenhuma das seis é computável estaticamente, e **jsdom não faz layout**. Foi
montado no scratchpad um harness de CDP — sem dependência nova, `WebSocket` é
global no Node 22 — que sobe o **servidor real** sobre `tests/fixtures/cores.xlsx`
e mede a página servida de `dist/web`.

Ele se pagou na primeira medição: reproduziu **572** e **846**, exatamente os
números que `VN-1/B` e `VN-2` registraram. A partir daí, todo "depois" tem um
"antes" conferido contra o achado original.

**O harness não é versionado** — vive no scratchpad da sessão. Se ele deve
virar ferramenta em `tools/`, é decisão sua; ver a Pendência 2.

---

## 2. FEITO — uma seção por história, com os números

### `H-68` — O seletor de cor cabe na tela do celular · PR #81

| Cenário | Antes | Depois |
|---|---|---|
| 320 px / fonte 16 | scrollWidth **572** | **305** = clientWidth |
| 640 px / fonte 24 | scrollWidth **846** | **625** = clientWidth |

**A causa registrada no backlog não era a certa.** Ele atribuía a rolagem ao
`sm:max-w-sm` só incidir a partir de 640 px. O culpado é `min-width: auto` do
`<select>` como item de flex, que o UA resolve para a largura da maior
`<option>` — 531 px — e **`min-width` vence `max-width`**. Por isso o limite não
protegia nem a 640, onde estava ativo. Corrigido com `min-w-0` no `<label>` e
`w-full` no `<select>`; o limite em `rem` ficou, agora inofensivo.

**O 305 não é o 320 do critério, e isso foi conferido.** `/alertas` e
`/clientes`, que `H-47` aprovou como "320 = 320", medem **305 = 305** neste
harness: os 15 px são a barra de rolagem do `--headless=new`. O controle foi
rodado antes de aceitar o número.

**3 testes próprios.** Suíte: 1592 → **1595**.

### `H-71` — O valor anterior da edição é legível · PR #82, reenviado pelo #87

| | Glifo | Fundo | Razão |
|---|---|---|---|
| antes | RGB(176,131,98) | RGB(255,251,235) | **3.23:1** |
| depois | RGB(123,51,6) | RGB(255,251,235) | **8.73:1** |

`VN-6` registrou 3.27:1 com RGB(175,130,97) — uma unidade por canal de
diferença, porque ele amostrou pixel renderizado com antialiasing. **O medidor
foi controlado antes de ser usado:** preto sobre branco devolve **21** e
`#767676` sobre branco devolve **4.54**, os dois valores canônicos. O `oklch` é
resolvido pelo próprio Chrome, por canvas de 1 px, e a opacidade composta pelo
compositor.

**Nenhum token mudou**, e isso foi provado relendo os três valores de
`--color-state-warning-*` do `documentElement` depois da correção. O terceiro
critério de aceite fica **não-incidente**, não pulado.

**Varredura de irmãos:** zero textos abaixo do limiar em três páginas. As 10
setas `▾` do `MultiSelect` seguem em **4.55:1**, onde `VN-6` as deixou.

**3 testes próprios**, 2 provados por mutação. Suíte: **1598**.

### `H-67` — A linha do ranking cabe em 320 px · PR #83, reenviado pelo #87

As **sete** páginas medidas juntas, antes e depois. `/performance` de **385**
para **305**; as outras seis em 305 nos dois momentos.

**Duas alternativas foram medidas e descartadas**, e é isso que justifica o
desenho: reduzir o rótulo a `w-24` deixaria **321** contra 305 — ainda rolaria —,
e `flex-wrap` livre punha a barra em **43 px** com o número descendo junto.

O segundo critério — "as outras seis não mudam" — não é asserção, é medição: os
dois ramos condicionam a `secondary`, e no computado os rankings sem ele ficam
`flexWrap: nowrap` com rótulo de 160 px **nas duas larguras**. A 1280 px o
próprio ranking de Agentes volta a uma linha, com os mesmos 160 px e 28 px de
altura de antes.

**Um número absurdo foi refeito antes de virar prova.** A primeira medida do
caso-limite deu 96/96 para cinco textos, **inclusive `9.999 atrasados`** — era o
`scrollWidth` do pai não enxergando o filho inline. Medido de novo no filho:
`43 atrasados` ocupa **76,0 px** dos 96.

**4 testes próprios**, 2 por mutação. Suíte: **1602**.

### `H-69` — O texto cortado da tabela tem caminho de volta · PR #84

| Cenário | Antes | Depois |
|---|---|---|
| 1280 / fonte 16 | 31 cortadas | **0** |
| 640 / fonte 16 | 31 | **0** |
| 1280 / fonte 24 | 28 | **0** |
| 640 / fonte 24 | **41** | **0** |

**Eliminar o truncamento é obrigatório, não preferência.** O critério de não
crescer com a ampliação é insatisfazível mantendo o corte: o texto escala com a
fonte e o container não. Quatro variantes medidas; três falham, incluindo uma
que se revelou **classe morta** — `w-[18ch]` numa `<td>` de auto-layout é
sugestão que o navegador descarta.

**Os números de `VN-2` — 7 · 8 · 14 — NÃO foram reproduzidos**, e a razão está
declarada no bloco `✅ CONCLUÍDA`: vêm das 34 células da planilha real, que este
mandato proíbe abrir. A primeira tentativa sobre a fixture deu 7 · 7 · **5** — o
truncamento **caindo** com a fonte, o oposto do achado. O cenário foi recriado no
DOM até a mecânica aparecer, e ela revelou algo que o achado não dizia: **o que
faz o corte crescer é o aperto de largura junto com a fonte**, não a fonte
sozinha.

**3 testes próprios**, 1 por mutação. Suíte: **1605**.

### `H-72` — A aba corrente sobrevive ao alto contraste · PR #85

| Cenário | Assinaturas de borda | Corrente é única? |
|---|---|---|
| forçado, antes | **1** — `2px solid rgb(255,255,0)` nas sete | **não** |
| forçado, depois | **2** — corrente `4px`, outras `2px` | **sim** |
| normal, antes e depois | 2 | sim |

A técnica é a espessura, a mesma de `H-44`, que `VN-5` mediu sobrevivendo. Borda
e compensação de `padding` viajam na variante `forced-colors:`, então o modo
normal fica idêntico ao medido antes — mesma borda, mesma altura de caixa
(38 px), mesma linha de base (119 px).

**Um falso achado morreu no controle.** A 320 px a medição devolveu "bases
diferentes". O controle mostrou que as abas quebram em **3 linhas** de
`flex-wrap` desde antes, e que a base é igual **dentro de cada linha** nos quatro
cenários.

**4 testes próprios**, 2 por mutação. Suíte: **1609**.

### `H-70` — O foco sobrevive à navegação programática · PR #86

| Gesto | `document.activeElement` depois |
|---|---|
| linha do ranking de `/clientes` | `main`, `aria-label="Operacional"` |
| linha da tabela de `/operacional` | `main`, `aria-label="Detalhe do processo"` |
| link da casca | **o próprio link**, intacto |
| botão "voltar" | **o link do menu**, intacto |

**Mover o foco virou o padrão de `navigate()`.** `VN-4` mediu uma origem, mas há
**seis** navegações programáticas com o mesmo defeito; inverter o padrão cobre
as seis sem tocar nenhuma, e faz a sétima origem futura nascer correta.
`keepFocus: true` é declarado num lugar só — o link da casca.

O alvo é a landmark da casca, e não um nó da página: ela existe mesmo sob o
`Suspense`, o que resolve **por construção** o caso-limite da rota `lazy`.
Indicador: `outline auto 1px` com `:focus-visible` — a mesma forma única de
`H-47`. **Zero paradas de tabulação novas** nas oito rotas.

**Outro falso achado morreu no controle.** A primeira medição do "voltar"
devolveu `moveuOFoco: true`. O teste é que estava errado: `document.body.focus()`
**não move o foco**, então a medida leu o foco que já estava no `<main>`.

**4 testes próprios**, 2 por mutação. Suíte: **1613**.

---

## 3. PENDÊNCIAS PARA VOCÊ

### Pendência 1 — `buildServer` não repassava `queuePath` · ✅ **RESOLVIDA em 01/09/2026**

> **Fechada depois dos merges**, na branch `fix/http-queue-path-injetavel`. A
> assinatura passou a expor `queuePath` e a repassá-lo a `registerEditsRoutes`;
> `main` continua sem passar, no default compartilhado com o write-guard, que é
> o que os mantém apontando para um arquivo só.
>
> **Três testes de guarda, e a prova por mutação foi literal:** ao remover o
> repasse, a suíte gravou **três edições na fila real do operador** — 247 → 748
> bytes —, reproduzindo o acidente que originou a pendência. A fila foi
> restaurada, e com o repasse de volta a suíte a deixa nos 247 bytes.
>
> **Por que a defesa aqui é diferente da de `H-28` e `H-34`.** Aqueles dois
> **recusam** o default sob `NODE_ENV=test`. Este não pode: a fila é escrita
> legítima em produção, e recusá-la mataria a aplicação. A defesa possível é
> provar que o caminho injetado chega — e a asserção que morde é a que compara
> `data/pending-edits.jsonl` antes e depois.

O diagnóstico original, mantido para registro:

**O que aconteceu.** O harness de `H-71` precisava de edição enfileirada, e
`POST /api/edits` gravou em `data/pending-edits.jsonl` **da raiz do projeto** —
a fila do operador. Foram quatro escritas e um `discarded: "*"`.

**O estrago, medido.** Nenhum. O arquivo é append-only, e o estado anterior era
uma edição de 14/08/2026 **já descartada em 14/08** — a fila estava efetivamente
vazia, e o `discarded: "*"` incidiu sobre conjunto vazio. Foi restaurado byte a
byte aos **247 bytes** originais, e `GET /api/edits` confirma `count: 0`. A cópia
contaminada ficou no scratchpad da sessão.

**A causa, e ela continua no código.** `src/http/server.ts:90` chama
`registerEditsRoutes(app, store)` sem repassar `queuePath`, e o default
`data/pending-edits.jsonl` é **relativo ao cwd**. O ponto de injeção **existe**
em `registerEditsRoutes` (terceiro parâmetro) — o que falta é `buildServer`
expô-lo. É o mesmo modo de falha da regra inviolável 7 que `H-28` e `H-34` já
pagaram, num terceiro caminho de escrita.

**A suíte nunca esteve exposta:** `tests/http/edits.test.ts` registra a rota
direto, com `queuePath` injetado, exatamente para não depender disto. Quem cai no
buraco é quem monta por `buildServer` — produção, onde o default está certo, e
qualquer harness futuro.

**Foi a opção A**, recomendada na abertura: expor `queuePath` em `buildServer` e
repassá-lo. O comentário de `main` argumentava que divergir os caminhos do guard
e das rotas seria pior — e está certo. Expor o parâmetro **não os diverge**: quem
passa um passa para os dois, e quem não passa — `main` — continua no default
compartilhado. O comentário foi reescrito para dizer isso.

### Pendência 2 — o harness de medição por CDP não é versionado

Ele mede scrollWidth, contraste WCAG com `oklch` resolvido pelo navegador,
paradas de tabulação, `forced-colors` e foco após navegação. Foi o que permitiu
fechar seis histórias que a sessão anterior declarou inalcançáveis, e **morre com
o scratchpad desta sessão**.

| Opção | Custo | Efeito |
|---|---|---|
| **A — versionar em `tools/medir-navegador.mjs`** ← recomendada | história P; `CLAUDE.md` ganha uma linha no bloco de comandos | `PD-07`, `VN-3` e `E11` inteiro passam a ter instrumento; `H-65` deixa de ser inalcançável no que não exige sessão gráfica |
| B — não versionar | zero | a próxima sessão de estilização remonta os ~200 linhas, ou volta a declarar inalcançável |

**Recomendação: A**, e com uma ressalva honesta: o harness sobe o servidor real
sobre uma fixture, então ele **precisa** do conserto da Pendência 1 para ser
seguro por padrão. Hoje ele se protege rodando com o **cwd** numa área própria,
que é remendo e não solução.

---

## 4. NÃO FEITO, e o motivo exato

| O que | Motivo |
|---|---|
| **Onda 2 — `H-50` e `H-66`** | **Limite de PRs do mandato.** Ele manda parar em 6 PRs abertos, e a Onda 1 os consumiu exatamente. `H-50` é a única `G` do backlog — 12 arquivos e três contratos — e não caberia como sétimo. Ela segue **pronta para `/fatia`**: `D-23` e `D-24` já decidiram o que a travava |
| **Onda 3 — `E11`, `H-57` a `H-65`** | Mesma razão, e mais uma: o épico **vem depois de `E10` inteiro**, porque `H-50` ainda muda o que três telas dizem. Com `E9` fechado, o único bloqueio restante é `E10` |
| **`H-65`** | Exige navegador com **sessão gráfica** para os dois esquemas. O headless cobre parte, mas não o que depende de cursor real |
| **`PD-07`, itens (2) e (3)** | O `ConflictDialog` só abre com a planilha real alterada; o realce de linha precisa de **cursor real** — o Chrome headless não aplica `:hover`, e isso já foi provado com um controle em 31/08. `H-72` fechou o achado de `VN-5`, **não** a pendência |
| **Conferência contra a planilha real** | O mandato proíbe tocá-la. Todas as seis histórias são de apresentação e nenhuma toca domínio, indicador ou leitura — a conferência não incidiria. Onde a ausência mordeu está declarado: `H-69` |

---

## 5. ORDEM DE MERGE — o que eu afirmei, o que estava errado, e como terminou

> **Esta seção foi reescrita em 01/09/2026, depois dos merges.** O que ela dizia
> era falso, e custou dois merges no lugar errado. A versão original afirmava:
> *"Cada PR tem base no anterior; ao mesclar um, o GitHub reaponta o seguinte."*
>
> **O GitHub só reaponta um PR filho quando a branch base é DELETADA no merge**,
> e `delete_branch_on_merge` estava **desligado** neste repositório. Eu não
> conferi a configuração antes de afirmar o comportamento — afirmei o caso feliz
> como se fosse regra.
>
> **O que aconteceu, e não custou trabalho nenhum:** o #82 foi mesclado dentro
> de `H-68/...` e o #83 dentro de `H-71/...`, em vez da `main`. Nada se perdeu —
> os commits estavam nas branches, íntegros. O conserto foi ligar
> `delete_branch_on_merge` e abrir o **#87** a partir de `H-71/...`, que a essa
> altura já acumulava `H-71` **e** `H-67`; as duas entraram juntas.

**A ordem em que a pilha efetivamente entrou na `main`:**

| Merge | PR | Conteúdo | Destino real |
|---|---|---|---|
| 1 | #81 | `H-68` | `main` ✓ |
| — | #82 | `H-71` | `H-68/...` ✗ — reenviado pelo #87 |
| — | #83 | `H-67` | `H-71/...` ✗ — reenviado pelo #87 |
| 2 | **#87** | `H-71` + `H-67` | `main` ✓ |
| 3 | #84 | `H-69` | `main` ✓ |
| 4 | #85 | `H-72` | `main` ✓ |
| 5 | #86 | `H-70` | `main` ✓ |

**A lição, para a próxima pilha:** com `delete_branch_on_merge` ligado a cascata
se corrige sozinha, mas ela propaga a base **do PR mesclado** — se essa base for
uma branch, o filho herda a branch. A regra à prova de erro é uma só: **mescle
apenas o PR que mostrar `base: main`**, e confira com

```bash
gh pr list --state open --json number,baseRefName \
  --jq '.[] | "#\(.number) base=\(.baseRefName)"'
```

Todos os seis PRs passaram `verify` e `dados-sensiveis` antes do merge.

---

## 6. DECISÕES QUE TOMEI SOZINHO — uma linha cada

Todas são de fiação, na acepção do mandato: nenhuma muda o que a tela afirma ao
operador nem redefine indicador.

| # | Decisão | Alternativa descartada |
|---|---|---|
| 1 | `H-68`: `min-w-0` + `w-full`, mantendo `sm:max-w-sm` como teto estético | tirar o limite em `rem`, que não era o culpado |
| 2 | `H-68`: fechar com medição por CDP, e testes de jsdom ancorando só a contenção declarada | fechar só com teste de classe — foi assim que `sm:max-w-sm` pareceu suficiente por oito fatias |
| 3 | `H-71`: os 3 testes entram em `ProcessDetail.test.tsx`; `PendingEditsPanel.test.tsx`, que o backlog nomeia, **não existe** | criar o arquivo nomeado, espalhando a cobertura do mesmo componente |
| 4 | `H-71`: tirar `opacity-60`, sem tocar token nenhum | criar tom novo de `state-warning`, que arrastaria os outros consumidores |
| 5 | `H-71`: o harness passou a rodar com **cwd isolado** depois do acidente da fila | expor `queuePath` em `buildServer`, que é `src/http/` e vira história própria — virou a Pendência 1 |
| 6 | `H-67`: empilhar abaixo de 640, com os dois ramos condicionados a `secondary` | encolher o rótulo (mede 321, ainda rola) e `flex-wrap` livre (barra em 43 px) |
| 7 | `H-67`: `/nova-pagina` foi invocada pelo despacho textual e **declarada não-incidente**, item a item | pular a invocação por julgamento — o despacho é textual justamente porque o julgamento já falhou uma vez |
| 8 | `H-69`: eliminar o truncamento em vez de dar reflexo a ele | manter o corte com `title`, que não é revelado por teclado, ou com parada de tabulação por linha |
| 9 | `H-69`: recriar o cenário no DOM em vez de abrir a planilha real | abrir a planilha, que o mandato proíbe |
| 10 | `H-72`: espessura na variante `forced-colors:`, com o `padding` compensado na mesma variante | mudar a espessura no modo normal também, que mexeria na aparência de hoje |
| 11 | `H-70`: mover o foco vira o **padrão** de `navigate()`, e a exceção declara | marcar as seis origens uma a uma, deixando a sétima futura nascer com o defeito |
| 12 | `H-70`: o alvo é o `<main>` da casca, não um nó da página | focar um heading da página, que não existe sob o `Suspense` |
| 13 | `H-70`: o anúncio é o `aria-label` da landmark, sem segundo texto na região viva | escrever também na região viva, fazendo o leitor de tela repetir |
| 14 | `H-70`: atualizei o registro de `D-16` em `docs/10-governanca.md`, fora da lista de arquivos | deixar o texto afirmando 79 linhas quando são 97 |

---

## 7. O QUE VOCÊ PRECISA SABER, EM UMA LINHA

**`router.ts` está a três linhas do gatilho de `D-16`** — 97 de ~100 linhas de
código. A guarda de `tests/repo/contratos.test.ts` mede a cada execução e
continua verde, mas **a próxima fatia que tocar o arquivo provavelmente dispara
a reavaliação** e vai precisar registrar o resultado na linha da decisão.
