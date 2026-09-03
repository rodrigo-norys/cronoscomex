# Proposta de redesenho da casca — "Cronos Console"

**Origem:** mockup navegável apresentado em 31/08/2026, publicado como artifact
(`claude.ai/code/artifact/45a1ddcd-d467-4a2d-afba-5bd82be693be`). Este documento
é a **transcrição versionada** dele: o artifact vive fora do repositório e pode
mudar sem aviso, e o épico `E11` de `../06-backlog.md` cita esta página, não
aquela URI.

**Não é auditoria.** `../estilizacao/RESULTADO.md` mediu conformidade contra um
corpus normativo e `../uso/RESULTADO.md` registrou o que apareceu na tela em uso;
os dois descrevem o que **está errado**. Este descreve o que se decidiu que a
interface **passa a ser** — proposta de desenho, aceita pelo operador em
31/08/2026 (`D-21` e `D-22`, em `../10-governanca.md §5`).

**Escopo:** a casca, a forma e a cor. Nenhum indicador muda de valor, nenhuma
rota muda de contrato, nenhuma regra de negócio é tocada. Se alguma história do
épico precisar de campo novo na API, ela está mal fatiada.

---

## 1. O que muda, em uma linha por eixo

| Eixo | Hoje | Proposta |
|---|---|---|
| Estrutura | Quatro faixas horizontais antes do primeiro dado — título e ações, navegação, filtros, faixa de estado | Navegação lateral de 216 px, topo de uma linha (46 px), filtros como chips que abrem em popover |
| Cor | Um esquema, acento neutro (`slate-800`) | Dois esquemas, acento indigo, e canal separado de severidade **por forma**, não só por matiz |
| Tipografia | Pilha do sistema, numérico sem alinhamento | IBM Plex Sans na interface, IBM Plex Mono em REF, data, contagem e rótulo; numérico à direita |
| Forma | 81 ocorrências de raio, 77 delas no mesmo valor | Dois raios — 6 px em controle, 12 px em contentor — e nada entre eles |
| Elevação | Duas sombras | Zero sombra; a separação de superfície é borda de 1 px |
| Densidade | Linha de tabela por `py-2`, sem altura declarada | Linha de 40 px, sem faixa alternada, ações da linha só sob cursor ou foco |
| Movimento | Zero transições | Duas durações — 110 ms para cursor, 170 ms para troca de tela — e uma curva só, tudo sob `prefers-reduced-motion` |

---

## 2. A paleta proposta, e as seis correções que a medição obriga

O vocabulário de `H-39` é mantido **inteiro**: muda o valor, nunca o nome. É
por isso que o épico anterior não vira retrabalho — ele é exatamente a camada
que torna esta troca barata.

### 2.1. Os valores do mockup

| Token | Claro | Escuro | Situação |
|---|---|---|---|
| `surface-base` | `#fbfbfc` | `#0b0c0e` | valor novo |
| `surface-raised` | `#ffffff` | `#131519` | valor novo no escuro |
| `surface-sunken` | `#f4f5f7` | `#0f1114` | valor novo |
| `surface-hover` | `#f0f2f5` | `#1b1e24` | **token novo** |
| `text-primary` | `#14161a` | `#eaecef` | valor novo |
| `text-secondary` | `#545a63` | `#9ba2ac` | valor novo |
| `text-muted` | `#868d97` | `#6c737d` | valor novo — **reprova, ver 2.2** |
| `border-subtle` | `#e4e6ea` | `#23262c` | valor novo |
| `border-control` | `#c9cdd4` | `#383c44` | valor novo — **reprova, ver 2.2** |
| `border-strong` | `#9aa0a9` | `#565c66` | valor novo — **reprova, ver 2.2** |
| `action-bg` | `#3d4eac` | `#4c5fc9` | valor novo — de neutro para indigo |
| `action-bg-hover` | `#34449a` | `#5c6ed6` | valor novo |
| `action-fg` | `#ffffff` | `#ffffff` | mantido |
| `action-soft` | `#eceefa` | `#1c2140` | **token novo** — fundo do item ativo |
| `state-error-fg` · `-bg` | `#b03028` · `#fdf2f1` | `#f08a80` · `#2a1614` | valor novo |
| `state-warning-fg` · `-bg` | `#8a5a06` · `#fdf7ec` | `#e0ad4e` · `#261c0c` | valor novo |
| `state-info-fg` · `-bg` | `#1f5c9e` · `#eef5fc` | `#74b3ee` · `#101f2d` | valor novo |
| `state-success-fg` | `#1a7444` | `#58c98a` | valor novo |
| `channel-green-bg` · `-fg` | `#e3f4e9` · `#14653a` | `#12291d` · `#63d296` | **token novo** — coincide com `H-51` |
| `channel-amber-bg` · `-fg` | `#fbeed4` · `#7a4e05` | `#2b2110` · `#e2b25f` | **token novo** |
| `channel-red-bg` · `-fg` | `#fbe3e1` · `#99271f` | `#2e1815` · `#f0908a` | valor novo |
| `chart-1` | `#3d4eac` | `#8c9bf0` | valor novo |
| `chart-grid` | `#e4e6ea` | `#23262c` | valor novo |
| `radius-control` · `radius-container` | `6px` · `12px` | idem | **tokens novos**, sem par por esquema |
| `speed-fast` · `speed-base` · `ease` | `110ms` · `170ms` · `cubic-bezier(0.32, 0.72, 0, 1)` | idem | **tokens novos**, sem par por esquema |

O mockup **não** declara `state-*-border`, que existe em `web/src/index.css`
desde `H-39`, porque ali a severidade é faixa lateral e não contentor com borda.
O token não é removido: `IngestionHealth` e as três `@utility` de painel o
consomem, e retirá-lo seria mudança de comportamento disfarçada de troca de
valor.

### 2.2. As seis reprovações, medidas em 31/08/2026

As razões abaixo foram calculadas sobre os hexadecimais da tabela pela fórmula
de contraste da WCAG 2.2 — luminância relativa em sRGB linearizado —, e são
reconferíveis com qualquer calculadora que implemente `SC 1.4.3`.

**Adotar a paleta como está reintroduz três dos defeitos que `H-39` e `H-40`
removeram.** Não é detalhe: é o mesmo par de tokens, pelo mesmo motivo.

| Par | Piso | Proposto | Veredito | Candidato corrigido |
|---|---|---|---|---|
| `text-muted` sobre `surface-raised`, claro | 4,5 | **3,35:1** | reprova | `#6a6f77` → 5,06:1 (e 4,51:1 no pior fundo, `surface-hover`) |
| `text-muted` sobre `surface-raised`, escuro | 4,5 | **3,82:1** | reprova | `#81878f` → 5,04:1 (4,61:1 no pior fundo) |
| `border-control` sobre `surface-raised`, claro | 3,0 | **1,59:1** | reprova | `#8b8d92` → 3,32:1 (3,04:1 no pior fundo) |
| `border-control` sobre `surface-raised`, escuro | 3,0 | **1,65:1** | reprova | `#606369` → 3,03:1 |
| `border-strong` sobre `surface-raised`, claro | 3,0 | **2,63:1** | reprova | `#6a6f77` → 5,06:1, mantendo o degrau acima de `border-control` |
| `border-strong` sobre `surface-raised`, escuro | 3,0 | **2,71:1** | reprova | `#81878f` → 5,04:1, idem |

> **`text-muted` a 3,35:1 é literalmente o defeito de `H-39`.** Aquela história
> mediu 2,63:1 no valor anterior e o levou a 4,77:1, citando o piso de 4,5. Um
> redesenho que o devolve a 3,35 desfaz a correção sem que nada no repositório
> reclame — a guarda de `tests/repo/estilo.test.ts` proíbe passo bruto de
> paleta, não valor de token com contraste insuficiente.
>
> **`border-control` a 1,59:1 é o defeito irmão**, também de `H-39`: a borda que
> informa onde o campo começa media 1,35:1 e foi para 4,77:1. O piso aqui é
> `SC 1.4.11`, 3:1, porque é limite de componente.

**O que passou, e por isso não se re-litiga:** os três pares de severidade
(5,55 a 6,20:1 no claro; 7,07 a 8,18:1 no escuro), os três de canal (6,23 a
6,45:1 no claro; 7,20 a 8,22:1 no escuro), `action-fg` sobre `action-bg` (7,28
e 5,54:1), `text-primary` e `text-secondary` sobre as quatro superfícies (6,20
a 18,11:1), e `chart-1` sobre `surface-raised` (7,28 e 7,02:1).

**Um alarme falso, registrado para não ser reaberto:** `action-bg` sobre
`action-soft` mede 2,82:1 no escuro, e **esse par não é renderizado** — o item
ativo do menu pinta o rótulo com `text-primary` (13,23:1) e o ícone com
`chart-1` (6,01:1). Medir tokens aos pares sem olhar o que a folha de estilo
combina produz reprovação inexistente.

**`border-subtle` não tem piso**, e a 1,25:1 está correto: é separação de
superfície, não limite de componente. Quem delimita controle é `border-control`,
e é ele que carrega o 3:1.

---

## 3. As sete decisões, e de onde cada uma vem

Transcritas do mockup, com a referência que cada uma cita.

**Estrutura — uma faixa no topo, não quatro.** A navegação sai para a lateral,
o topo guarda só contexto e ação, e os filtros viram chips que abrem em popover:
o recorte ativo continua visível, mas ocupa uma linha em vez de uma faixa de
controles. Sobra altura para cerca de oito linhas de tabela a mais na mesma
janela, e a lateral escala além de sete itens, coisa que abas horizontais não
fazem.

**Cor — canal e severidade nunca se confundem.** Verde, amarelo e vermelho são
dado aduaneiro aqui, não gravidade, e a **regra inviolável 4** diz que cor não
infere status. Por isso os dois sistemas se separam por **forma**: canal é chip
preenchido com rótulo escrito; severidade é faixa lateral com ícone. Um acento
só — indigo —, em botão primário e item ativo, e nunca em título, borda ou
ícone.

**Tipografia — mono onde há número.** IBM Plex Sans na interface, IBM Plex Mono
em REF, data, contagem e rótulo. Numérico alinhado à direita em largura fixa,
porque `1.111,11` parece menor que `999,99` em fonte proporcional. Pesos param
em 600; a hierarquia vem de cor e espaço.

**Forma — dois raios, zero sombra.** 6 px em controle, 12 px em contentor, e
nada entre os dois. Elevação é borda, não sombra.

**Densidade — linha de 40 px, sem zebra.** Em tabela interativa a faixa
alternada colide com os estados de cursor, seleção e desabilitado; a separação
fica por divisória de 1 px. As ações da linha só aparecem sob o cursor ou com
foco de teclado, para a coluna não carregar ícone repetido 649 vezes.

**Movimento — curto, e sempre informando.** Duas durações e uma curva só. Botão
recua 2,5% ao ser pressionado. Tudo cai sob `prefers-reduced-motion`, e a
redução nasce junto porque, no instante em que entra a primeira transição, três
regras do corpus que hoje estão dispensadas passam a incidir.

**Tema — os dois, com o sistema decidindo.** Cada token ganha par claro/escuro,
nenhum componente cita cor diretamente, e o esquema vem de
`prefers-color-scheme`.

---

## 4. O estado medido do conjunto, em 31/08/2026

O "antes" contra o qual as histórias de `E11` medem. Recorte:
`web/src/**/*.tsx`, 24 arquivos entre `components/` e `pages/`, 6.048 linhas em
`web/src` no total. Cada número é reconferível em um comando.

| Sinal | Medido | Comando |
|---|---|---|
| Ocorrências de raio | **81** — 77 `rounded`, 2 `rounded-sm`, 1 `rounded-lg`, 1 `rounded-full` | `grep -ro 'rounded[a-z-]*' web/src --include='*.tsx'` |
| Arquivos com raio | **24 de 24** | `grep -rl 'rounded' web/src --include='*.tsx'` |
| Sombras | **2** — `MultiSelect.tsx:141` e `ConflictDialog.tsx:78` | `grep -rn 'shadow-' web/src --include='*.tsx'` |
| Transições e animações | **0** | `grep -ro 'transition-[a-z]*\|animate-[a-z]*' web/src --include='*.tsx'` |
| Ocorrências de `dark:` | **0** | `grep -ro 'dark:' web/src` |
| Peso de fonte | **0** `font-bold`, 55 `font-semibold`, 36 `font-medium` | `grep -ro 'font-bold\|font-semibold\|font-medium' web/src --include='*.tsx'` |
| Largura fixa e alinhamento | 18 `font-mono` em 7 arquivos, 20 `tabular-nums`, 10 `text-right` | `grep -ro 'font-mono' web/src --include='*.tsx'` |

**O teto de peso 600 já é verdade hoje:** zero `font-bold`. A decisão não custa
substituição nenhuma — custa uma guarda, para que não volte.

---

## 5. Divergências entre o mockup e o repositório

Levantadas em 31/08/2026, ao alinhar a proposta. Nenhuma é impeditiva; todas
mudam o texto de alguma história.

1. **"os onze filtros"** — são **catorze** desde `H-66`, que expôs
   `colorResponsible` na barra. `H-15` foi titulada com onze, `H-49` levou a
   doze, `H-55` a treze e `H-66` a catorze. Os **chips** continuam treze:
   `clientGroup` não tem chip próprio. A história que reorganizar a barra parte
   de catorze controles, não de onze.
2. **A tarja diz "Épico E10"** — `E10` é *As melhorias de uso*, `H-48` a `H-56`,
   e nenhuma delas toca a casca. A proposta é `E11`.
3. **O mockup carrega as fontes de `fonts.googleapis.com`** — proibido em
   produção por **RNF-34** ("nenhuma telemetria, nenhum CDN") e inútil na
   máquina do operador, que pode estar sem internet (`PD-06`). As duas famílias
   são servidas do próprio repositório, em `web/public/fonts/`, com `.woff2`
   versionados e `@font-face` local. Sem dependência npm nova.
4. **O chip de canal usa `border-radius: 999px`** — que não é nenhum dos dois
   raios. A regra dos dois raios vale para **controle e contentor**; a pílula é
   uma terceira forma, declarada, e usada só em rótulo de dado. O repositório já
   tem uma ocorrência de `rounded-full`.
5. **A base tipográfica do mockup é 13 px.** O produto **não reduz a
   fonte-base**: densidade vem de espaçamento e altura de linha, não de encolher
   texto abaixo do que o operador configurou. `R03` do corpus e `SC 1.4.4`
   obrigam unidade relativa, e `H-46` já corrige o último tamanho absoluto do
   conjunto.
6. **`opacity: 0` nas ações da linha** mantém o controle no foco de teclado
   enquanto invisível, e o mockup resolve com `tr:focus-within`. Correto, e é
   condição de aceite — não efeito colateral.

---

## 6. O que a proposta declara em aberto

Duas coisas, e o mockup diz que não as decide. **Nenhuma vira história de
`E11`.**

- **A busca por `⌘K`** aparece como afordância, mas o comportamento — buscar só
  REF, ou também cliente e ação — é decisão à parte.
- **O detalhe do processo em painel lado a lado**, em vez de página. É a
  evolução natural desta estrutura e mexe no roteador — o que toca diretamente
  o gatilho de reavaliação de `D-16`, hoje em **97** linhas de código de um
  limiar de 100 — medido em 02/09/2026 pela mesma contagem que
  `tests/repo/contratos.test.ts` usa.
