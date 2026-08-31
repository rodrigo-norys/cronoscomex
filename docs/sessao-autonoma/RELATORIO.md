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
