# Relatório da sessão autônoma — 31/08/2026

Sessão sem supervisão humana. O dono não esteve disponível durante a execução;
toda decisão tomada aqui está registrada, e as que exigiam ele ficaram abertas.

**Baseline da árvore**, medido antes da primeira linha de código, com
`npm run verify` na `main` em `0c3a2bc`: **73 arquivos de teste, 1474 testes,
tudo verde** — lint, `strip-types`, `typecheck`, `test` e `build`.

> O arquivo de permissões de `.claude/` está modificado e **não commitado** na
> `main` desde antes desta sessão: é a configuração que o dono deixou para ela.
> Não foi tocado, não foi commitado, e nenhuma branch o carrega.

---

## 1. PLANO — a ordem derivada

### 1.1 As 19 histórias abertas, e o grafo

O marcador de concluída é a linha `> ✅ **CONCLUÍDA em ...` sob o título.
**46 das 65 fechadas**, 19 abertas, distribuídas em três épicos:

| Épico | Abertas | Dependências |
|---|---|---|
| `E9` — Estilização | `H-43` `H-44` `H-45` `H-46` `H-47` | `H-43`←∅ · `H-44`←`H-43` · `H-45`←`H-42`✅ · `H-46`←`H-45` · `H-47`←todas as oito |
| `E10` — Melhorias de uso | `H-50` `H-51` `H-52` `H-53` `H-54` | `H-50`←`H-48`✅ · `H-51`←∅ · `H-52`←∅ · `H-53`←`H-50` · `H-54`←∅ |
| `E11` — Casca redesenhada | `H-57`…`H-65` | o épico inteiro depende de `E9` **e** `E10` inteiros |

### 1.2 O bloqueio estrutural — as duas de navegador

Este ambiente não tem navegador, e é **proibido** instalar um.

| História | O que ela é | Efeito |
|---|---|---|
| `H-47` — Percorrer os cinco procedimentos de navegador | Executa `VN-1`, `VN-2`, `VN-3`, `VN-4` e `VN-6` e escreve o desfecho de cada um em `docs/estilizacao/RESULTADO.md`. Nenhum deles é computável estaticamente: zoom de 400 %, indicador de foco visível, ordem de tabulação real e razão de contraste **sob alfa**, medida por conta-gotas sobre o pixel | **Inalcançável.** Fica aberta |
| `H-65` — Percorrer os procedimentos de navegador nos dois esquemas | Mesma natureza, em `E11` | **Inalcançável** |

**`H-47` é dependência declarada de `E11` inteiro** — o cabeçalho do épico a
nomeia como linha de base da verificação no navegador. Logo as nove histórias de
`E11` — `H-57` a `H-65` — ficam **inalcançáveis por transitividade**, e o
mandato já as excluía da partida.

Nada foi contornado: nenhum navegador headless, nenhum Playwright, nenhuma
dependência nova, nenhuma história marcada concluída por raciocínio. O
procedimento exato que falta ao dono está na seção **3. Pendências**.

### 1.3 A ordem que executo, e por quê

Partida fixada pelo mandato: **`E10` inteiro — ou o alcançável dele — antes de
`E9`**.

| # | História | Épico | Base da branch | Motivo da posição |
|---|---|---|---|---|
| 1 | `H-51` — Canal verde | E10 | `main` | Sem dependência; toca domínio, contrato e uma página |
| 2 | `H-52` — Cartões declaram o período | E10 | `H-51` | Sem dependência **de plano**, mas colide com `H-51` em `indicators.ts`, `routes/indicators.ts` e `Home.tsx` |
| 3 | `H-54` — Histórico reconstruído | E10 | `H-52` | Sem dependência de plano; encadeada só pelos três documentos de fecho |
| 4 | `H-50` — Responsável pelo importador | E10 | `H-54` | Depende de `H-48` ✅. **Acima do teto da régua** — corte proposto em 3.1 |
| 5 | `H-53` — Performance diz a métrica | E10 | `H-50` | Último critério depende de `H-50` |
| 6 | `H-43` — Live regions da casca | E9 | `H-53` | Sem dependência |
| 7 | `H-44` — Live regions das páginas | E9 | `H-43` | Depende de `H-43` |
| 8 | `H-45` — Papéis de UI | E9 | `H-44` | Depende de `H-42` ✅; encadeada por colisão de arquivos |
| 9 | `H-46` — Responsividade | E9 | `H-45` | Depende de `H-45` |
| — | `H-47` | E9 | — | **Navegador** |
| — | `H-57`…`H-65` | E11 | — | **Transitivo de `H-47`** |

**Por que a pilha é linear e não um leque.** Nenhum merge acontece nesta sessão,
e `/fechar-historia` escreve em `docs/06-backlog.md`,
`docs/09-rastreabilidade.md` e no bloco Estado do `CLAUDE.md` — **os três
arquivos, em toda história**. Branches paralelas a partir da `main` colidiriam
nos três, mesmo entre histórias que o plano declara independentes. A pilha
linear troca esse conflito garantido por uma ordem de merge, que está na
seção 5.

---

## 2. FEITO

### `H-51` — Canal verde, e a distribuição à vista · [PR #69](https://github.com/rodrigo-norys/cronoscomex/pull/69)

**Branch:** `H-51/feat-canal-verde`, saindo da `main`. Posição 1 da pilha.

**O que mudou.** O canal deixou de ser binário sobre 5 linhas: `verde` entrou no
domínio e `nenhum` saiu dele. A Página Inicial ganhou o painel de distribuição,
com o denominador escrito ao lado da fração e as linhas sem canal conhecido
contadas fora dela.

**Arquivos** — 43 no total, 5 commits. Servidor: `src/domain/types.ts`,
`filters.ts`, `indicators.ts`, `src/app/color-map-loader.ts`,
`src/io/history-store.ts`, `src/http/routes/indicators.ts`,
`config/color-map.json`. Interface: `web/src/pages/Home.tsx`,
`ProcessDetail.tsx`, `web/src/components/ColorFieldsForm.tsx`. Documentos:
`docs/03-modelo-dados.md`, `docs/05-contratos-api.md`, e os três de fecho. O
resto são testes.

**Verify.** Verde. A última execução imprimiu `Test Files 73 passed (73)` e
`Tests 1494 passed (1494)`, contra **1474** na `main` — 20 testes próprios em
seis arquivos.

**Conferência contra a planilha real**, por `tools/carregar-planilha.mjs`, que é
o passo obrigatório antes de fechar:

| Medida | Valor | Critério de aceite |
|---|---:|---|
| `verde` | 477 | 477 ✅ |
| `vermelho` | 5 | 5 ✅ |
| `indefinido` | 167 | 167 ✅ |
| soma | 649 | 649 ✅ |
| `known` (denominador) | 482 | 482 ✅ |
| IND-06, não redefinido | 5 | inalterado ✅ |

**Commits**, provados verdes um a um — o commit 2 rodou a suíte com o resto da
pilha guardado e imprimiu `1490 passed`:

1. `docs(docs): TD-05 passa a registrar o canal verde`
2. `feat(domain): o canal verde entra no dominio e \`nenhum\` sai dele`
3. `feat(web): a Pagina Inicial mostra a distribuicao por canal`
4. `docs(docs): fecha H-51 no backlog, na rastreabilidade e no estado`
5. `docs(docs): abre o relatório da sessão autônoma`

**Por que a troca de domínio virou um commit só.** O tipo exportado alcança
`domain`, `app`, `io`, `http` e `web` de uma vez, e o `typecheck` não admite meio
caminho: qualquer corte menor deixaria um commit vermelho, e commit vermelho no
meio quebra o `git bisect` que o corte atômico existe para preservar.

### `H-52` — Os cartões declaram o período, e ele é editável ali · [PR #70](https://github.com/rodrigo-norys/cronoscomex/pull/70)

**Branch:** `H-52/feat-periodo-nos-cartoes`, saindo de `H-51/feat-canal-verde`.
Posição 2 da pilha.

**O que mudou.** Cada cartão da Página Inicial declara a janela que está
contando e **qual data** ela recorta. Nasceu o cartão "Desembaraçados no período
(por registro)", contado por `registrationDate`, e um seletor de período na
própria página, que escreve nos mesmos parâmetros da barra de filtros.

**Arquivos** — 16, em 5 commits. Domínio: `src/domain/indicators.ts`. Servidor:
`src/http/filter-request.ts`, `src/http/routes/indicators.ts`. Interface:
`web/src/pages/Home.tsx`, `web/src/components/StatCard.tsx`,
`web/src/hooks/useFilters.ts`. Documentos: `docs/05-contratos-api.md` e os três
de fecho. O resto são testes.

**Verify.** Verde. A última execução imprimiu `Test Files 73 passed (73)` e
`Tests 1526 passed (1526)`, contra 1494 ao fim de `H-51` — 32 testes próprios.

**Conferência contra a planilha real**, e os quatro números do critério de aceite
bateram:

| Medida | Valor | Critério de aceite |
|---|---|---|
| faixa de `ETA2` | 30/12/2025 a 09/09/2026 | idem ✅ |
| faixa de `RG` | 05/01/2026 a 31/07/2026 | idem ✅ |
| sem `ETA2` | 64 de 649 | 64 ✅ (caso-limite) |
| sem `RG` | 166 de 649 | — |
| `desembaracadosNoPeriodo` sem janela | 480 | igual a `desembaracados` |
| o mesmo, em fevereiro | 58 | — |

**Commits**, provados verdes um a um: `1508` depois do primeiro, `1514` depois do
segundo.

1. `feat(domain): a contagem por data de registro e a faixa real das datas`
2. `feat(http): a rota declara a janela aplicada e a faixa real dos dados`
3. `feat(web): cada cartao diz que janela conta, e o atalho a edita ali`
4. `docs(docs): fecha H-52 no backlog, na rastreabilidade e no estado`
5. `docs(docs): o relatorio registra H-52`

### `H-54` — O histórico reconstrói os meses da planilha · [PR #71](https://github.com/rodrigo-norys/cronoscomex/pull/71)

**Branch:** `H-54/feat-historico-reconstruido`, saindo de
`H-52/feat-periodo-nos-cartoes`. Posição 3 da pilha.

**O que mudou.** A Página Histórico ganhou uma segunda série, derivada das datas
que a planilha carrega, ao lado da observada e **nunca emendada** nela. E o
rótulo do mês passou a levar o ano com quatro dígitos.

**Arquivos** — 10, em 5 commits. Domínio: `src/domain/history.ts`. Servidor:
`src/http/routes/history.ts`, `src/http/filter-request.ts`. Interface:
`web/src/pages/History.tsx`. Documentos: `docs/05-contratos-api.md` e os três de
fecho. O resto são testes.

**Verify.** Verde. A última execução imprimiu `Test Files 73 passed (73)` e
`Tests 1548 passed (1548)`, contra 1526 ao fim de `H-52` — 22 testes próprios.

**Conferência contra a planilha real:**

| Medida | Valor | Origem do número |
|---|---|---|
| intervalo da série | dez/2025 a set/2026 | `docs/uso/RESULTADO.md` §6 diz "dez meses a partir de dez/2025" ✅ |
| meses cobertos | 10 | idem ✅ |
| meses ausentes no intervalo | 0 | critério de aceite ✅ |
| sem `ETA2` | 64 de 649 | caso-limite ✅ |
| sem `RG` | 166 de 649 | caso-limite ✅ |
| `ETA2` em set/2026 | 18 | caso-limite ✅ |
| meses de previsão | só set/2026 | derivado |

**Commits**, provados verdes um a um: `1535` depois do primeiro, `1540` depois do
segundo.

1. `feat(domain): a serie reconstruida das datas da planilha`
2. `feat(http): a rota serve a reconstruida ao lado da observada`
3. `feat(web): as duas series na tela, e o ano com quatro digitos`
4. `docs(docs): fecha H-54 no backlog, na rastreabilidade e no estado`
5. `docs(docs): o relatorio registra H-54`

**Um defeito que a fatia criou e fechou.** Com a reconstruída acompanhando o
estado vazio de `H-21`, as duas seções passaram a coexistir com o **mesmo
`aria-label`** — duas landmarks homônimas na mesma página, e o leitor de tela sem
como distingui-las. Pego por um teste que reprovou com "Found multiple elements
with the role region"; `EmptyHistory` passou a receber `alone`.

---

## 3. PENDÊNCIAS PARA O DONO

*(preenchido a cada checkpoint)*

---

## 4. NÃO FEITO

*(preenchido no fechamento)*

---

## 5. ORDEM DE MERGE

**A pilha é linear. Mesclar fora de ordem gera conflito**, porque cada branch sai
da anterior e todas escrevem em `docs/06-backlog.md`,
`docs/09-rastreabilidade.md` e no bloco Estado do `CLAUDE.md`.

| # | PR | Branch | Base |
|---|---|---|---|
| 1 | [#69](https://github.com/rodrigo-norys/cronoscomex/pull/69) — `H-51` | `H-51/feat-canal-verde` | `main` |
| 2 | [#70](https://github.com/rodrigo-norys/cronoscomex/pull/70) — `H-52` | `H-52/feat-periodo-nos-cartoes` | `H-51/feat-canal-verde` |
| 3 | [#71](https://github.com/rodrigo-norys/cronoscomex/pull/71) — `H-54` | `H-54/feat-historico-reconstruido` | `H-52/feat-periodo-nos-cartoes` |

Depois do último merge, a branch `distribuicao` fica para trás e precisa ser
sincronizada — `node --experimental-strip-types scripts/sincronizar-distribuicao.ts`.
**Esta sessão não a tocou**, porque a regra do projeto manda sincronizar apenas a
partir da `main` mesclada, e nenhum merge aconteceu aqui.

---

## 6. O QUE EU DECIDI SOZINHO

Uma linha por decisão, para conferência por amostragem. As três primeiras são de
`H-51`.

1. **`nenhum` sai do domínio inteiro, e não só das linhas verdes.** O critério de
   aceite fixa `indefinido = 167`, e 167 é a soma de tudo que não é verde nem
   vermelho. Aritmética da história, não escolha.
2. **A distribuição é bloco de topo na resposta, não campo em `counts`.**
   Alternativa descartada: campo em `counts`, que é a lista dos indicadores do
   catálogo e faria a história parecer redefinir IND-06.
3. **O histórico legado é traduzido na leitura, não recusado.** Alternativa
   descartada: recusar `nenhum` como valor fora do domínio — é o que o código já
   fazia, e teria reiniciado `categoryChangedAt` em 649 processos, desarmando
   ALE-06. A tradução é uma linha e se remove numa linha.

As três seguintes são de `H-52`.

4. **A janela de `desembaracadosNoPeriodo` incide sobre o conjunto filtrado, não
   sobre a base.** O texto da história admitia as duas leituras; **RF-18 decide**
   — todo indicador da rota responde sobre o recorte ativo. Alternativa
   descartada: ignorar o filtro de `ETA2` para responder literalmente "quantos
   concluímos desde fevereiro", o que faria um cartão desobedecer um filtro
   global visível na barra. Sem filtro de período as duas coincidem, que é o
   estado do critério de aceite.
5. **`meta.dataRange` é medido sobre o conjunto filtrado**, e não sobre a base.
   Mesma razão de RF-18. Consequência declarada: com janela ativa, `missing` é
   necessariamente 0 — dentro do recorte nenhum processo está sem a data.
6. **`filteredWithPeriod` nasceu ao lado de `filteredProcesses`**, e não no lugar
   dele. Alternativa descartada: alargar o existente, que alcançaria as seis
   rotas **[F]** — cinco delas sem uso para a janela.

As três seguintes são de `H-54`.

7. **As medidas reconstruídas são estoque ao fim do mês, não fluxo mensal.**
   Alternativa descartada: contagem por mês, que ao lado da série observada —
   que é acumulada — pareceria despencar todo mês, e as duas não seriam
   comparáveis no mesmo eixo.
8. **A reconstruída não tem `canalVermelho`.** A cor é o estado de hoje e não
   carrega data; projetá-la para trás afirmaria que a linha já era vermelha
   naquele mês. Alternativa descartada: reconstruí-la com a cor atual, que é
   exatamente o que a regra inviolável 3 proíbe.
9. **`months` não recorta a reconstruída.** A janela é da série observada.
   Alternativa descartada: aplicá-la às duas, que esconderia justamente o passado
   que a história existe para mostrar — a janela padrão é 12 meses e o intervalo
   das datas é 10, mas a coincidência não é garantia.
