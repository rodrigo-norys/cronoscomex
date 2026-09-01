# Relatório da sessão autônoma — 01/09/2026, segunda sessão

Sessão sem supervisão humana. O dono não esteve disponível durante a execução;
toda decisão tomada aqui está registrada, e as que exigiam ele ficaram abertas.

> **Resumo em seis linhas.** **`E10` fechou inteiro** — `H-50`, a única `G` do
> backlog, e `H-66` —, e **`E11` avançou três das nove**: `H-57`, `H-59` e
> `H-60`. O harness de medição no navegador foi **versionado** em
> `tools/medir-navegador.mjs`, fechando a Pendência 2 da sessão anterior. São
> **seis PRs encadeados, #89 a #94**, que se mesclam **nesta ordem**; a suíte foi
> de **1616 para 1678 testes**, verde em toda história. **`H-58` está bloqueada**
> e não pôde ser feita: as fontes IBM Plex exigem rede, e `curl`/`wget` são
> negados. **Uma pendência aguarda você**, e três achados de número ou de
> acessibilidade foram corrigidos com o "antes" reproduzido.

**Baseline da árvore**, medido antes da primeira linha de código, com
`npm run verify` na `main` em `9badb7e`: **73 arquivos de teste, 1616 testes**,
tudo verde. Árvore limpa, zero PRs abertos.

---

## ⚠️ A regra de merge, em letra grande

**Mescle apenas o PR que mostrar `base: main`.** Confira sempre com:

```bash
gh pr list --state open --json number,baseRefName \
  --jq '.[] | "#\(.number) base=\(.baseRefName)"'
```

`delete_branch_on_merge` está **ligado**, e com ele a cascata se corrige a cada
merge — **mas ela propaga a base do PR mesclado**: se essa base for uma branch,
o filho herda a branch. Mesclar fora de ordem põe o PR seguinte na branch
errada, que foi o que custou dois merges no lugar errado em 01/09 pela manhã.

**A ordem, e ela não é sugestão:**

| # | PR | Base | História |
|---|---|---|---|
| 1 | **#89** | `main` | `H-50` — Responsável pelo importador |
| 2 | **#90** | `H-50/…` | `H-66` — O filtro da cor de responsável · **fecha `E10`** |
| 3 | **#91** | `H-66/…` | `chore` — o harness de medição no navegador |
| 4 | **#92** | `chore/…` | `H-57` — O par escuro da camada de tema |
| 5 | **#93** | `H-57/…` | `H-59` — Navegação lateral e topo de uma linha |
| 6 | **#94** | `H-59/…` | `H-60` — Os filtros como chips em popover |

Depois de cada merge, rode o comando acima: o próximo da fila deve ter passado a
`base: main`. Se não passou, **pare** — mesclar assim mesmo é o defeito.

---

## 1. PLANO — o que estava aberto e a ordem executada

O mandato fixou duas ondas. A execução seguiu a ordem, com **uma adaptação
declarada** (§4).

| Ordem | História | Resultado |
|---|---|---|
| 1 | `H-50` — Responsável pelo importador, com a cor desempatando (`G`) | ✅ PR #89 |
| 2 | `H-66` — O filtro da cor de responsável na tela | ✅ PR #90 — **fecha `E10`** |
| — | `chore` — versionar o harness de navegador | ✅ PR #91 |
| 3 | `H-57` — O par escuro da camada de tema | ✅ PR #92 |
| 4 | `H-58` — As duas famílias de fonte | ❌ **bloqueada**, ver §5 |
| 5 | `H-59` — Navegação lateral e topo de uma linha | ✅ PR #93 |
| 6 | `H-60` — Os filtros como chips em popover | ✅ PR #94 |
| — | `H-61` a `H-65` | não iniciadas: **limite de 6 PRs abertos** |

---

## 2. FEITO, por história, com os números medidos

### `H-50` — Responsável pelo importador (PR #89)

A única `G` do backlog. O campo Responsável deixa de sair da cor e passa a
nomear **quem responde**, atribuído pelo importador contra `config/team-map.json`
com a cor desempatando. A cor vira campo próprio, `colorResponsible`.

**Medido contra a planilha real**, com `quarantinePath`, `historyPath` e
`queuePath` redirecionados ao scratchpad e `data/` conferida por `sha256sum -c`
depois:

| Medida | Valor | Critério |
|---|---|---|
| Atribuição pelo importador | **559** | exato |
| Desempate pela cor | **48** | exato |
| Sem responsável | **42** | exato |
| Divergências importador ↔ cor | **0** | como `H-48` mediu |
| IND-20, ranking | 405 · 202 · 42 | — |
| IND-22 por responsável | deixa de ser dominado por `indefinido`, que tinha **484** de 649 | — |

**29 testes próprios.** Contrato de três rotas alterado. Quatro divergências de
fiação, todas resolvidas e registradas no bloco `✅ CONCLUÍDA` — a mais
importante: **`colorResponsible` teve de entrar no `ProcessDto`**, porque
`ProcessDetail` monta o `ColorTarget` atual a partir do processo, e sem o campo
passaria a chave da **pessoa** como se fosse cor. O `typecheck` pegou.

### `H-66` — O filtro da cor de responsável (PR #90) — fecha `E10`

O 11º controle de múltipla escolha, e a ressalva de A-31 na Página Performance
**invertida, não removida**: ela dizia "o responsável vem da cor da linha", o
que `H-50` tornou falso. **Fecha o quinto critério de `H-53`**, que era o único
critério aberto de uma história já concluída. **6 testes próprios.**

Medido no navegador: zero estouro em 1280, 1024, 768 e 360 px, e também a 360
com a fonte-base em 24 px — o cenário "Muito grande".

### `chore` — o harness de medição (PR #91)

`tools/medir-navegador.mjs`, versionado. **Fecha a Pendência 2 da sessão
anterior.** Sobe a aplicação sobre uma fixture com os três caminhos de escrita
num diretório temporário — **as duas defesas, não uma** — e mede por CDP:
largura, contraste com `oklch` resolvido pelo próprio compositor, paradas de
tabulação, `forced-colors`, `prefers-color-scheme` e `Page.setFontSizes`.

**Só a conta da WCAG entra na suíte** — 5 testes. Prova por mutação: trocar o
expoente `2.4` da curva sRGB por `2.2` reprova o caso de `#767676`, o limiar de
4,5:1 de `SC 1.4.3` AA.

**Ele se pagou nesta sessão**: mediu `H-66`, `H-57`, `H-59` e `H-60`.

### `H-57` — O par escuro da camada de tema (PR #92)

Abre `E11`. **44 tokens de cor, todos com par**, mais cinco sem par por não
serem cor. **Nenhum `.tsx` mudou** — o quarto critério de aceite.

**74 medições de contraste no navegador — 37 pares × 2 esquemas, zero
reprovações.** Os seis valores corrigidos de `PROPOSTA §2.2` bateram com o
previsto: `text-muted` 5,06 e 5,04; `border-control` 3,32 e 3,03;
`border-strong` 5,06 e 5,04.

**O controle foi rodado, e é o que dá crédito ao número.** Com os hexadecimais
crus do mockup, a mesma medição devolve **3,35 · 1,59** no claro e **3,82 ·
1,65** no escuro — as quatro reprovações que `PROPOSTA §2.2` previu,
reproduzidas por um caminho independente do documento. **`R-16` fecha.**

### `H-59` — Navegação lateral e topo de uma linha (PR #93)

**42 medições de largura** — sete rotas × seis viewports de 320 a 1440 px: **um
`<header>` acima do conteúdo em cada, zero estouros**. **6 testes próprios.**

**`router.ts` não foi tocado e continua em 97 linhas de código** — o gatilho de
`D-16` tem três linhas de folga, e a separação entre destino e rodapé é
apresentação. `D-16` registra a observação com o número medido.

O canal não-cromático de `H-72` **sobreviveu à migração de eixo**: da borda
inferior das abas para a esquerda da lateral, medido sob `forced-colors` em 4 px
contra 2 px. A primeira tentativa o pôs nos sete itens, e o teste de `H-72`
pegou.

### `H-60` — Os filtros como chips em popover (PR #94)

**11 testes próprios.** A barra cai de **200 px para 83 px**, e o `<main>` sobe
de **321 px** — casca de quatro faixas — para **143 px**: **178 px liberados**
por `H-59` e `H-60` juntas.

`VN-3` medido e limpo: nenhum ancestral recorta o popover, e `elementFromPoint`
no centro do painel devolve um nó de dentro dele.

---

## 3. PENDÊNCIA PARA VOCÊ — uma, e ela tem opções

### Pendência 1 — `H-60` não cabe em uma linha, e o número está medido

**O que aconteceu.** O segundo critério de aceite de `H-60` diz: *"Dado nenhum
recorte, então a barra ocupa uma linha"*. Medido em Chrome 151:

| Viewport | Linhas de chips | Altura da barra |
|---|---:|---:|
| 1280 px | **2** | 83 px |
| 1440 px | **2** | 83 px |
| 1600 px | **2** | 83 px |
| 1800 px | **1** | 47 px |
| 1920 px | **1** | 47 px |

Os treze chips somam **1437 px** de largura contra **1064** disponíveis a 1280 px
com a lateral de 216 px.

**O que eu fiz, e por quê.** Entreguei com duas linhas e registrei. O
**objetivo** da história — *o recorte ativo ocupar uma linha em vez de uma faixa
de controles* — está cumprido: o recorte fica visível sem abrir nada, e a faixa
de treze controles abertos deixou de existir. Cortar rótulo para caber trocaria
altura por ambiguidade: "Cor do responsável" e "Importador fora do RJ" precisam
do que dizem.

**As opções, se você quiser uma linha a 1280 px:**

| Opção | Custo | Efeito |
|---|---|---|
| **A — deixar como está** (o que fiz) | zero | 2 linhas até 1600 px, 83 px de barra. Já é 117 px melhor que antes |
| **B — só os chips ativos, mais um "+ N filtros"** | história nova, ~1 arquivo | 1 linha sempre; o filtro inativo passa a exigir dois cliques |
| **C — abreviar rótulos** ("Fora do RJ", "Cor resp.") | 1 linha de código | 1 linha a ~1500 px; ambiguidade nova, e `H-53` depende dos mesmos rótulos |
| **D — mover a barra para dentro da lateral** | redesenho, contradiz `PROPOSTA §3` | — |

**Recomendação: A.** O ganho de altura já foi capturado, e B é uma decisão de
produto — esconder filtro atrás de contagem é exatamente o que o critério
"o recorte ativo continua visível" existe para evitar.

---

## 4. AS DECISÕES QUE TOMEI SOZINHO — uma linha cada, para conferência

| # | Decisão | Onde está registrada |
|---|---|---|
| 1 | `ColorTarget` **não** foi renomeado: só o tipo virou `ColorResponsible`, para não mexer numa quarta rota e em `config/color-map.json` | `H-50`, bloco ✅ |
| 2 | `colorResponsible` entrou no `ProcessDto` contra o previsto — o `typecheck` mostrou que sem ele o menu de cor marcaria a opção errada | `H-50`, bloco ✅ |
| 3 | `AnomalyCode` novo `RESPONSAVEL_DIVERGENTE`, porque nenhum existente servia | `H-50`, bloco ✅ |
| 4 | O mapa de equipe chega às rotas por parâmetro de `buildServer`, pelo precedente de `clientGroups` | `H-50`, bloco ✅ |
| 5 | **`157` → `165`**: o documento de origem errou a aritmética; corrigido em três lugares, como achado | `docs/uso/RESULTADO.md §3`, TD-05, `D-23` |
| 6 | O filtro `responsible` passa de domínio fechado a **aberto** — `?responsible=xyz` devolve 200 vazio, não 400 | `docs/05-contratos-api.md` §1.1 |
| 7 | A linha do ranking de responsáveis **não** virou clicável, embora o impedimento de A-18 tenha acabado | `H-66`, bloco ✅ |
| 8 | `--ease` do mockup virou `--ease-brand`: `--ease-*` é namespace do Tailwind | `H-57`, bloco ✅ |
| 9 | Derivei par escuro para **nove tokens** que `PROPOSTA §2.1` não declara, e medi cada um | `H-57`, bloco ✅ |
| 10 | `chart-series-2` e `-3` mudaram de valor no claro: os herdados medem abaixo de 3:1 contra a superfície nova | `H-57`, bloco ✅ |
| 11 | `state-*-border` **não** carrega piso de 3:1 — é reforço de contentor, não limite de controle | `H-57`, bloco ✅ |
| 12 | `router.ts` **não** foi tocado em `H-59`, para não disparar `D-16` por um dado de apresentação | `D-16`, com o número medido |
| 13 | Corrigi `lg:grid-cols-[1fr_20rem]` na Página Operacional — defeito preexistente, fora da lista de arquivos | `H-59`, bloco ✅ |
| 14 | Entrou o salto para o conteúdo (`SC 2.4.1`), que já faltava antes de `H-59` | `H-59`, bloco ✅ |
| 15 | O `h1` passou de nome do produto a nome da página (`SC 2.4.6`) | `H-59`, bloco ✅ |
| 16 | Sem contagem ao lado do item da lateral: o único número servido ignora o recorte | `H-59`, bloco ✅ |
| 17 | **`H-59` foi feita sem `H-58`**, contra o grafo do épico: a dependência é de onda, e `H-59` exclui tipografia explicitamente | este relatório, §5 |
| 18 | `aria-label` explícito no chip: o nome acessível saía `"ClienteACME"` | `H-60`, bloco ✅ |
| 19 | `H-60` entregue com duas linhas a 1280 px — ver Pendência 1 | `H-60`, bloco ✅ |

---

## 5. NÃO FEITO, com o motivo exato

### `H-58` — As duas famílias de fonte: **bloqueada, e não adiada**

**O motivo é ambiental, não de plano.** A história pede seis `.woff2` da IBM
Plex Sans e Mono, versionados em `web/public/fonts/`, mais o arquivo de licença
OFL. Verificado nesta máquina:

- `fc-list | grep -i plex` → **vazio**; a fonte não está instalada
- `find . -name "*.woff2"` → **vazio**; não há cópia no repositório
- `.claude/settings.json` **nega** `Bash(curl *)` e `Bash(wget *)`
- `@fontsource` é dependência que o próprio backlog recusa, e `npm install` pede
  confirmação que ninguém pode dar

**Entregar meia história seria pior:** um `@font-face` apontando para arquivos
inexistentes falha calado, e a tipografia cai para a pilha do sistema sem erro
nenhum — exatamente o modo de falha que a história existe para evitar.

**O que você precisa fazer:** baixar de `github.com/IBM/plex` (OFL) os pesos 400,
500 e 600 de IBM Plex Sans e IBM Plex Mono, subconjunto latino, em `.woff2`, e
pô-los em `web/public/fonts/` com o `LICENSE.txt`. Depois disso a história é
`P` e sai numa fatia.

**Ela não bloqueia o resto de `E11`.** O grafo do épico põe `H-57` e `H-58` como
onda 1, mas a dependência é de **onda**, não de conteúdo: `H-59` e `H-60`
excluem tipografia no próprio texto — *"Fora desta história: qualquer mudança de
raio, densidade ou tipografia nos arquivos tocados"*. `H-61` a `H-65` seguem no
mesmo caso, exceto `H-63`, que aplica mono a REF, data e contagem e **precisa**
das famílias.

### `H-61` a `H-65` — não iniciadas

**Limite de 6 PRs abertos**, que o mandato fixou e a sessão de 01/09 pela manhã
já tinha atingido. `H-61` e `H-62` podem sair em paralelo assim que a pilha
descer; `H-63` depende de `H-58`.

---

## 6. OS TRÊS ACHADOS, e o "antes" reproduzido em cada um

O mandato manda reproduzir o "antes" antes de corrigir. Os três abaixo têm.

### 6.1 — O documento de origem afirmava 157, e o número é 165

`docs/uso/RESULTADO.md §3` dizia *"apenas **157** carregam cor de responsável e
**492** ficam em `indefinido`"*. A **tabela do próprio §3** sempre somou
36+72+9+13+35 = **165**, e TD-05 conta as mesmas 165 por chave de estilo desde
`H-01`. Medido contra a planilha real em 01/09: `colaborador1` 120 ·
`colaborador2` 36 · `colaborador1_outros_clientes` 9 · `indefinido` 484.

**Erro de aritmética no texto, não de medição** — nenhuma conclusão da seção
muda. Corrigido em três lugares, como achado documentado (regra inviolável 1).
`D-23` o repetia de segunda mão.

### 6.2 — `config/team-map.json` nos comentários: passou aqui, reprovou no CI

Cinco comentários de `H-50` citavam `config/team-map.json`. O arquivo está no
`.gitignore`: existe nesta máquina e **não** no CI, e a guarda de âncora morta
reprovou o PR #89.

**Reproduzido ocultando o arquivo:** a guarda reprova antes e passa depois, e
`config/team-map.json` foi restaurado byte a byte (`sha256sum -c` OK). A
convenção correta é `team-map.json` sem prefixo — é o que `H-48` já fazia em
`team-map-loader.ts`, pelo mesmo motivo. Corrigido e propagado por merge pela
pilha inteira.

### 6.3 — `lg:grid-cols-[1fr_20rem]` já estourava a página, e `H-59` revelou

`1fr` é `minmax(auto,1fr)`, e o `auto` mínimo é a largura **intrínseca** da
tabela. Medido nos dois lados, com espera determinística pela tabela:

| Viewport | Antes (`H-57`) | Depois de `H-59` | Corrigido |
|---|---|---|---|
| 1024 px | **ESTOURA** | ESTOURA | ok |
| 1064 px | **ESTOURA** | ESTOURA | ok |
| 1280 px | ok | **ESTOURA** | ok |
| 1440 px | ok | **ESTOURA** | ok |

O defeito é **preexistente** — estourava entre 1024, onde `lg:` liga, e ~1240 px.
A coluna 216 px mais estreita o levou até 1440. O `overflow-x-auto` de `R01` não
alcança: quem se recusa a encolher é a **trilha do grid**, acima da tabela.
Corrigido com `minmax(0,1fr)`, e `tests/repo/estilo.test.ts` passa a reprovar a
trilha rígida.

---

## 7. O QUE NÃO É ACHADO — resultados absurdos que morreram na conferência

O mandato manda desconfiar do próprio resultado. Dois morreram assim.

**`body` branco no modo escuro, título a 1,18:1.** Artefato de medição: `body` e
`html` são `rgba(0,0,0,0)`, e compor transparente sobre branco devolve branco. O
título vive dentro de `header.bg-surface-raised`, `rgb(19,21,25)`, e o contraste
real é **15,44:1**. O wrapper `min-h-screen bg-surface-base` cobre a viewport;
do resto cuida `color-scheme: light dark`.

**Alturas de barra oscilando entre execuções.** Eu esperava o seletor errado —
`main` em vez de `main table` —, e media a página antes de a tabela chegar. Com
espera determinística, os números ficaram estáveis e a comparação antes/depois
passou a significar alguma coisa.

---

## 8. Dois testes que não mordiam, e foram refeitos

Prova por mutação em toda guarda nova, como o mandato exige. **Duas falharam em
morder na primeira versão:**

1. **`H-66`** — a asserção de que Configuração fica no rodapé verificava só que
   ela é o último link, e ela já é a última em `NAV_PAGES`. Virou uma asserção
   **estrutural**: seis filhos diretos do `<nav>`, um dentro do rodapé.
2. **`H-60`** — a asserção de que o chip mostra o rótulo e não a chave usava uma
   fixture onde os dois são iguais. Passou a usar `key: 'ACME LOG'` /
   `label: 'Acme Logística'`.

As demais mordem: **13 mutações aplicadas, 13 reprovando exatamente os testes
que as cobrem.**

---

## 9. Suíte, e o que cada história acrescentou

| Ponto | Testes | Δ |
|---|---:|---:|
| `main` em `9badb7e` | 1616 | — |
| `H-50` | 1645 | +29 |
| `H-66` | 1651 | +6 |
| `chore` — harness | 1656 | +5 |
| `H-57` | 1661 | +5 |
| `H-59` | 1667 | +6 |
| `H-60` | **1678** | +11 |

**Cada commit foi provado no seu ponto**, com o resto da pilha em `git stash` —
o `git bisect` continua utilizável.

---

## 10. O que a próxima sessão deve saber

1. **Mescle na ordem de §0**, conferindo `base: main` a cada passo.
2. **`H-58` precisa dos `.woff2`** antes de qualquer coisa; sem eles, `H-63`
   também trava.
3. **O harness está versionado** e é o caminho para toda medição de `E11`. Rode
   com `LOG_LEVEL=silent` e depois de `npm run build`.
4. **`H-61` e `H-62` podem sair em paralelo** assim que a pilha descer — nenhuma
   depende de tipografia.
5. **A Pendência 1 é sua**, e a recomendação é não fazer nada: o ganho de altura
   já foi capturado.
6. `PD-01`, `PD-05`, `PD-06`, `PD-07` e `PD-08` seguem abertas e **nenhuma foi
   tocada** — todas dependem da máquina do operador ou de um Excel à mão.
