# Verificação no navegador — `VN-1` a `VN-6`, nos dois esquemas

**Executado em 01/09/2026 (`H-65`).** Segunda passada dos seis procedimentos de
`docs/estilizacao/RESULTADO.md`, agora com a superfície dobrada pelo par escuro
de `H-57` e com a casca de `H-59` a `H-64` no lugar.

`H-47` é a linha de base. Metade dos procedimentos mede **cor resolvida**, e cor
resolvida depende do esquema: rodá-los só no claro deixaria o escuro sem
verificação nenhuma.

## Método

`tools/medir-navegador.mjs`, Chrome 151 headless por CDP, sobre `dist/web` e a
fixture `tests/fixtures/cores.xlsx`, com os três caminhos de escrita num
diretório temporário. Nada aqui toca a planilha do operador, `data/` nem
`config/app.json`.

Os dois esquemas vêm de `Emulation.setEmulatedMedia` com
`prefers-color-scheme`, e `forced-colors: active` do mesmo mecanismo. **A
emulação é legítima e isso foi determinado, não suposto** (31/08/2026): o que os
procedimentos perguntam não é que cor o tema do sistema pinta, e sim se o
desenho sobrevive quando as cores do autor são descartadas — e o agente de
usuário substitui a paleta do mesmo jeito no Linux e no Windows.

> **O `hover:` era inobservável, e o diagnóstico anterior estava errado.** O
> Tailwind v4 envolve **todo** `hover:` em `@media (hover: hover)`, e o Chrome
> headless declara `hover: none` e `pointer: none`: nenhum utilitário de cursor
> entra na cascata, ainda que `:hover` **case** normalmente por
> `Input.dispatchMouseEvent`. `Emulation.setEmulatedMedia` não alcança essas
> duas features — são capacidade do dispositivo, não preferência do usuário —, e
> a saída é a flag de lançamento `--blink-settings`, exposta como
> `apontadorFino`. Medido em `H-64`. Isso corrige a suspeita registrada no item
> (3) de `PD-07`.

**O que a emulação continua não alcançando:** alternar o tema do sistema
operacional com a aplicação **aberta**, que é o caminho real do operador. Fica
declarado aberto ao fim deste documento.

---

## `VN-1` — Reflow (`SC 1.4.10`, AA)

**Procedimento traduzido.** Viewport de 320 px CSS — equivalente de layout a
1280 px com zoom de 400% —, as sete rotas, e toda rolagem horizontal que não
seja da `<table>` dentro do invólucro de `R01` nem do `ResponsiveContainer`.
Critério: `scrollWidth > clientWidth` na raiz, e o culpado é o elemento mais
externo que ultrapassa **sem ancestral que contenha a rolagem**.

**Resultado — APROVADO nos dois esquemas.** `clientWidth` de 305 px (320 menos a
barra de rolagem), `scrollWidth − clientWidth = 0` nas **sete rotas × dois
esquemas**, e **zero** elementos culpados. A lateral de `H-59` não produz
rolagem horizontal: abaixo do `sm` ela vira faixa superior, e o conteúdo ocupa a
largura inteira.

### `VN-1/POPOVER` — 1 ACHADO, corrigido nesta história

A medição de "zero estouros de 320 a 1440" de `H-63` foi feita com os treze
popovers **fechados**. O painel é `absolute` e posicionado, então contribui para
o overflow — e o revisor de estilo o levantou como procedimento próprio.

Medido a 320 px, abrindo um a um os treze chips, nos dois esquemas: **6 dos 13
faziam a página rolar**, com números idênticos no claro e no escuro.

| Chip | rolagem antes | `right` do painel antes |
|---|---|---|
| Canal · Porto | **135 px** | 440 |
| Responsável | 88 px | 393 |
| Período (ETA2) | 86 px | 391 |
| Cliente | 75 px | 380 |
| Agente | 51 px | 356 |

**Causa.** O painel tem `w-64` — 256 px — e nasce ancorado no `left` do chip. Um
chip no meio de uma linha do `flex-wrap` o lança para fora: `left: 184` mais 256
dá 440, contra 305 de largura útil.

**Correção, em `web/src/components/FilterChip.tsx`.** O painel se recolhe para
dentro da tela ao abrir, por `useLayoutEffect` — medir depois da pintura
mostraria o painel fora da tela por um quadro, que é o defeito que se corrige. O
deslocamento vai em `margin-left` e **não** em `transform`: a animação de
`motion-surface` escreve `transform`, e a origem de cascata da animação vence a
do estilo em linha, então durante os 170 ms o deslocamento sumiria.

**Não há solução só de CSS.** Posicionamento por âncora (`position-try`) ainda é
do Chrome, e o navegador não recolhe elemento absoluto sozinho.

**Depois: 6 → 0 estouros**, nos dois esquemas. Os seis painéis que estouravam
param em `right: 297`, dentro dos 305 com a folga de 8 px declarada; **os sete
que já cabiam não se moveram** (`left: 24` intacto). A correção é cirúrgica, e
tem teste com os valores concretos medidos aqui — `left: 184`, tela de 305,
deslocamento de `-143px` — que **reprova sob mutação**.

---

## `VN-2` — Resize text (`SC 1.4.4`, AA)

**Procedimento traduzido.** Duas passadas: viewport de 640 px, equivalente a
1280 px a 200%; e `Page.setFontSizes {standard: 24}`, que é o mecanismo por trás
de `chrome://settings/appearance` em "Muito grande" — e não um zoom, porque o
que `SC 1.4.4` cobra é a fonte-base que o `rem` resolve.

**Resultado a 640 px — APROVADO nos dois esquemas.** Zero rolagem horizontal e
zero culpados nas sete rotas.

**Resultado com fonte-base de 24 px — 1 ACHADO, corrigido nesta história.** Zero
rolagem, e um texto truncado **sem o valor completo em lugar nenhum**:
`/performance`, o rótulo do `RankingBar`.

**O achado corrige a descrição de `VN-2/A`, de `H-47`.** Aquele registro dizia
que "o truncamento cresce com a ampliação". Medido agora a 1280 px:

| fonte-base | visível | necessário |
|---|---|---|
| 16 px (padrão) | 160 px | 200 px |
| 24 px ("Muito grande") | 240 px | 300 px |

A proporção é **a mesma nos dois** — 80% —, porque `w-40` e `text-sm` são ambos
relativos e escalam juntos. O que cresce é o **déficit absoluto**, de 40 para 60
px. **O truncamento existe já no tamanho padrão**, e não nasce da ampliação.

**Correção, em `web/src/components/RankingBar.tsx`:** `title` com o rótulo
inteiro, que é a regra que `ProcessTable` já fixava — texto livre que trunca
guarda o valor completo. **Depois: zero** truncamentos sem recurso nas sete
rotas × dois esquemas.

---

## `VN-3` — Foco visível (`SC 2.4.7` e `SC 2.4.11`, AA)

**Procedimento traduzido.** `Tab` real por `Input.dispatchKeyEvent`, do primeiro
controle até dar a volta, nas sete rotas. Por parada: existe indicador
(`outline-style` diferente de `none` e `outline-width` acima de zero), e o anel
— folgado pela própria espessura mais o `outline-offset` — cabe na área visível
do ancestral que rola.

**Resultado — APROVADO nos dois esquemas. 193 paradas por esquema, 386 no
total.**

| Rota | paradas | sem anel | anel recortado | parada em `aria-hidden` |
|---|---|---|---|---|
| `/` | 23 | 0 | 0 | 0 |
| `/operacional` | 39 | 0 | 0 | 0 |
| `/clientes` | 36 | 0 | 0 | 0 |
| `/performance` | 24 | 0 | 0 | 0 |
| `/alertas` | 32 | 0 | 0 | 0 |
| `/historico` | 26 | 0 | 0 | 0 |
| `/processo/<ref>` | 13 | 0 | 0 | 0 |

O conjunto tem **zero** anel autoral: o que se verificou é o anel padrão do
agente de usuário sobrevivendo à cascata, inclusive sobre `bg-action-bg` e
dentro do `overflow-x-auto` das tabelas.

**O popover de `H-60`, aberto — o item que o critério de aceite nomeia.**
Tabulando para dentro do chip Cliente, que é o único com árvore de grupos:
**11 paradas dentro do painel**, nos dois esquemas, **zero sem anel e zero
recortadas** pelo `overflow-auto` do painel.

**A parada órfã do `ACHADO 12` não existe mais:** zero paradas dentro de
subárvore `aria-hidden`, o que confirma `H-46` em campo.

> **A contagem de paradas difere de `H-47`** — 193 aqui contra 467 lá — e a
> razão é o dado, não a casca: a fixture tem 11 processos e a planilha real tem
> 649. Os treze filtros de `H-60` também deixaram de ser controles sempre
> abertos.

### O item que continua devendo

O `ConflictDialog` só abre com a planilha alterada durante a sessão, e **nenhuma
fixture versionada produz isso**. Segue sem exercício: para onde vai o foco ao
abrir, se a tabulação escapa do `role="alertdialog" aria-modal="true"`, e para
onde o foco volta ao fechar. Leitura do código diz que **não há `.focus()` nem
prisão de foco** em `web/src/components/ConflictDialog.tsx` — é achado de
leitura, e vira história própria, não correção aqui: prender foco é
comportamento novo, e `H-65` é verificação.

---

## `VN-4` — Ordem de leitura (`SC 1.3.2` e `SC 2.4.3`, A)

**Procedimento traduzido.** A mesma tabulação de `VN-3`, com a posição de cada
parada em coordenada de tela, e toda parada cuja posição **sobe** em relação à
anterior sinalizada.

**Resultado — APROVADO nos dois esquemas.** As regressões encontradas são
**todas** transição de coluna, e o próprio `VN-4` manda aceitá-las:

- **Sete rotas:** `Configuração` (`y: 852`, rodapé da lateral) → `Atualizar`
  (`y: 12`, topo do conteúdo). É a passagem da lateral para o principal, e a
  ordem lateral-antes-de-conteúdo é a correta.
- **`/clientes` e `/alertas`:** uma regressão a mais cada, dentro de grid de
  duas colunas — desce a primeira coluna e sobe para o topo da segunda.

O conjunto continua com **zero** `order-*`, `flex-*-reverse`, `grid-flow-*` e
`tabIndex` positivo: a ordem do DOM é a ordem de tabulação por construção.

---

## `VN-5` — Forced colors

**Procedimento traduzido.** `forced-colors: active` emulado, nos dois esquemas —
que sob o modo forçado são **duas paletas de sistema realmente distintas**, e
não uma variação: branco com azul `rgb(0, 0, 159)` no claro, preto com amarelo
`rgb(255, 255, 0)` no escuro. É o "par de temas claro e escuro" do item 4 do
procedimento, que `PD-07` deixou em aberto.

**A lateral — APROVADO, nos dois temas.** O item corrente mede
`border-left: 4px` contra `2px` dos demais, e a espessura é o canal que
sobrevive: o agente de usuário pinta `border-transparent` como pinta qualquer
borda. Confirma `H-72` em campo.

**Os cartões-resumo — APROVADO, nos dois temas.** Dos 13 cartões, **2 são de
variante `urgencia`, e os 2 carregam o texto "Pede ação"**. Sob o modo forçado
os fundos **colapsam num só valor** — `rgb(255, 255, 255)` no claro,
`rgb(0, 0, 0)` no escuro, contra dois valores no modo normal —, o que confirma
que o canal cromático morre; o textual de `H-45` sobrevive por ser texto.

### 1 ACHADO, corrigido nesta história

`web/src/components/AlertRow.tsx` declarava `forced-colors:border-l-4` **na
base**, que já era `border-l-4`. A variante repetia o valor e era **inerte**: sob
o modo forçado urgentes e não urgentes ficariam com a mesma faixa. O comentário
do arquivo afirmava que ela engrossava.

**O teste que existia provava o contrário do que o nome dele dizia.** Ele se
chamava "engrossa a faixa sob forced-colors, **nas duas severidades**" e cobrava
a mesma classe nas duas — e classe igual nas duas é exatamente a definição de
não distinguir.

**Correção.** Quem muda sob o modo forçado passa a ser o ramo **não urgente** —
o urgente já está no máximo —, com `forced-colors:border-l-0` mais
`forced-colors:pl-1`, que devolve os 4 px do desenho. É a técnica de `H-59`, que
compensa a espessura na mesma variante.

**Isto não repara perda de informação:** o prefixo "Pede ação · " de `H-45` é
texto e sobrevive ao modo forçado em qualquer caso. É o canal **redundante** que
o comentário prometia e não entregava.

> **A correção não foi medida no navegador, e a razão é a fixture.** As **10**
> linhas de `/alertas` sobre `cores.xlsx` são **todas urgentes**, e nenhuma das
> nove fixtures versionadas produz alerta com severidade acima de
> `URGENT_SEVERITY`. Uma medição de "todas com 4 px" compararia urgentes com
> urgentes e não diria nada. O ramo não urgente fica coberto por teste de
> componente, com as duas classes concretas.

---

## `VN-6` — Contraste com alfa

**Procedimento traduzido.** O conjunto tem **zero** gradiente e **zero**
utilitário de alfa em `.tsx`. Sobrou **um** valor com alfa, e é do tema:
`--color-overlay-scrim`, `rgb(20 22 26 / 0.4)` no claro e `rgb(0 0 0 / 0.62)` no
escuro, consumido só pelo véu do `ConflictDialog`. Os alvos originais do
procedimento — `MultiSelect` com `opacity-80` e `PendingEditsPanel` com
`opacity-60` — deixaram de existir em `E9` e `E11`.

**A borda do painel contra o véu já está medida, em `H-62`: 4,12:1 no claro e
5,66:1 no escuro**, com o alfa resolvido pelo compositor e não multiplicado à
mão. Não foi remedida aqui.

**1 ACHADO adjacente, corrigido nesta história.** O glifo `▾` do chip usava
`text-text-muted`, e sobre `bg-action-soft` — o fundo do ramo **ativo** — media
**4,38:1** no claro e **4,32:1** no escuro, contra o piso de 4,5:1 de
`SC 1.4.3`. `text-xs` são 12 px, então não há isenção de texto grande. Trocado
por `text-text-secondary` e medido no navegador, com o alfa composto pelo
próprio compositor:

| esquema | glifo | fundo efetivo | razão |
|---|---|---|---|
| claro | `rgb(84, 90, 99)` | `rgb(236, 238, 250)` | **6,02:1** |
| escuro | `rgb(155, 162, 172)` | `rgb(28, 33, 64)` | **6,08:1** |

### O item que continua devendo

O véu amostrado **com o diálogo aberto sobre cada uma das sete páginas**. É o
mesmo bloqueio de `VN-3`: nenhuma fixture versionada produz o conflito que abre
o diálogo.

---

## Placar

| Procedimento | Claro | Escuro | Achados |
|---|---|---|---|
| `VN-1` reflow | ✅ | ✅ | 1, corrigido — 6 popovers em 13 |
| `VN-2` resize text | ✅ | ✅ | 1, corrigido — rótulo do ranking |
| `VN-3` foco visível | ✅ | ✅ | 1 item devendo — o diálogo |
| `VN-4` ordem de leitura | ✅ | ✅ | nenhum |
| `VN-5` forced colors | ✅ | ✅ | 1, corrigido — faixa do alerta |
| `VN-6` contraste com alfa | ✅ | ✅ | 1, corrigido — glifo do chip |

**Quatro achados, quatro corrigidos**, todos em arquivo já tocado por `E11` —
que é o que o critério de aceite manda. Nenhum virou nota solta.

## O que fica aberto, e por quê

| # | O que | Por que não foi feito aqui |
|---|---|---|
| 1 | **Alternar o tema do sistema operacional com a aplicação aberta.** A página precisa acompanhar sem recarregar | A emulação por CDP fixa a media query na abertura do alvo. Exige a máquina do operador, e vai junto de `PD-06` — como o item 4 desta mesma tabela |
| 2 | **O `ConflictDialog`, três vezes:** foco ao abrir e ao fechar, prisão de tabulação, e o véu amostrado sobre as sete páginas | Nenhuma fixture versionada produz o conflito. É o mesmo item que `VN-3` e `PD-07` já deviam |
| 3 | **Prender o foco no diálogo** | Achado de leitura, não de execução: não há `.focus()` no arquivo. Comportamento novo, e `H-65` é verificação — vira história própria |
| 4 | **A paleta nominal do Windows** (Aquático e as demais) | Confirmação de segunda ordem: os dois temas forçados medidos aqui já são paletas de sistema distintas, e o que o procedimento pergunta é se o desenho sobrevive à substituição |
