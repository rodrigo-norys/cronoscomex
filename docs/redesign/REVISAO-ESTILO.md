# Revisão de estilo da casca e das sete páginas — 01/09/2026

Segunda invocação do subagente `revisor-estilo`, contra o corpus verificável de
`docs/estilizacao/corpus-estilo.md`. A primeira produziu
`docs/estilizacao/RESULTADO.md`, de onde nasceu `E9`.

**Executada antes de `H-64`**, e a ordem tinha razão: achado de forma encontrado
depois do movimento custaria animar o que ia mudar. Conferido item a item —
**nenhum dos 14 achados toca os pontos onde `H-64` prendeu movimento**, e por
isso `H-64` seguiu.

**Entrada:** a casca — `App.tsx`, `AppSidebar.tsx`, `TopBar.tsx`,
`FilterBar.tsx`, `FilterChip.tsx` — mais as sete páginas e os nove componentes
de dado, **de uma vez**, porque 12 das 40 regras são composicionais: a violação
delas não existe dentro de um arquivo, é a diferença entre arquivos.

**Estado revisado:** o topo da cascata em `H-63`, com a camada CSS de `H-64` já
em disco e sem consumidores. O revisor declarou isso por conta própria, o que é
o comportamento correto.

> **Os 14 estão fechados, e este documento é o registro de como.**
>
> **Três fecharam em `H-65`**, por caírem em arquivo que a história estava
> tocando — `ACHADO 3` (faixa do alerta sob `forced-colors`), `ACHADO 8` (glifo
> do chip, 4,38:1) e `ACHADO 13` (o popover a 320 px, que virou o procedimento
> `VN-1/POPOVER`). O registro está em `docs/redesign/VERIFICACAO.md`.
>
> **Dez viraram `E12`**, executado em 01/09/2026 nas quatro ondas que o plano
> abaixo desenha — `H-73` a `H-76`. **`ACHADO 14` não virou história**: o
> próprio revisor o marca como não normativo, e aposentar dois degraus de
> espaçamento com 2 e 3 ocorrências é arrumação, não correção.
>
> **Três correções propostas estavam certas no diagnóstico e erradas no
> remédio**, e a medição de cada uma está no bloco `✅ CONCLUÍDA` da história:
>
> | Achado | O que a medição mudou |
> |---|---|
> | **2** | `<SeverityIcon tone="warning"/>` renderiza o **círculo**, e colapsaria os dois glifos da fila de alertas — urgente e não urgente com o mesmo desenho. O triângulo ficou; só a faixa mudou, de 1,60:1 para **5,92:1** e **8,93:1** |
> | **6** | Alinhar os nomes por `aria-label` violaria `SC 2.5.3`, que exige que o nome acessível **contenha** o texto visível. Quem se acomodou ao rótulo canônico foi a frase |
> | **12** | Não era "a tabela trunca": dos **3591** valores de texto livre, **81** eram cortados e **80 estavam numa coluna só**. Alargar o teto de Navio resolveu sem desfazer a densidade de 40 px que `break-words` teria custado |

## Aferição do método, executada pelo revisor antes de qualquer razão

```
red-500  oklch(63.7% 0.237 25.331)  -> #fb2c36   (esperado #fb2c36) OK
blue-600 oklch(54.6% 0.245 262.881) -> #155dfc   (esperado #155dfc) OK
```

A cadeia `oklch` → sRGB → luminância WCAG está válida. As cores do alvo, porém,
não são passos de paleta: são hexadecimais literais em `@theme static`, e as
razões saem deles diretamente.

## Passo zero

- **`Z1` — há conjunto de páginas.** Oito URIs distintas em `router.ts:31-47`,
  resolvidas por `parseRoute` sobre `location.pathname`. **`SC 3.2.3` e
  `SC 3.2.4` incidem, e `C04`, `C05`, `C06` e `C10` estão ativas como
  normativas.**
- **`Z2` — um bloco `@theme static`, zero `@custom-variant`, `color-scheme`
  presente.** 44 tokens de cor com par escuro. `C01` e `D01` não estão violadas
  por construção.

## Os 11 achados que sobraram para `E12` — todos fechados

| # | Regra | Onde | O quê |
|---|---|---|---|
| **1** | `C08` — um `<h1>` por página, sem salto de nível | `StatCard.tsx:48` (via `Home.tsx:169`) e `Alerts.tsx:134,144` | Descem de `h1` para `h3`. As outras cinco páginas descem para `h2` sem salto. Falha `F43` de `SC 1.3.1` |
| **2** | `C10` — um nível de severidade, um par de cor | `AlertRow.tsx:100-101`, contra `SeverityMark.tsx:27-28` | A faixa usa `state-warning-border`, que mede **1,60:1** no claro e **1,94:1** no escuro contra `surface-raised`, sob piso de 3:1 de `SC 1.4.11`. `severityBand('warning')` usa `state-warning-fg` e mede 5,92 e 8,93. Há **três cópias** do ícone: `SeverityMark`, `AlertRow.tsx:55` e `IngestionHealth.tsx:69,75-87` |
| **4** | `C04` — um papel de UI, uma combinação de forma | 5 botões de ação primária | `EditProcessForm.tsx:121`, `ColorFieldsForm.tsx:156` e `WorkbookSetup.tsx:212` têm `border border-action-bg`; `ApplyChangesButton.tsx:105` e `ConflictDialog.tsx:195` não têm borda. O `hover` existe em **2 de 5** |
| **5** | `C04` — idem, papel "faixa de estado da casca" | `App.tsx:148` contra `StatusBanner.tsx:154` | `border-b` contra `border-y`, mesmos tokens de cor. As duas empilham no mesmo lugar |
| **6** | `C05` — mesmo controle, mesmo nome acessível | `StatusBanner.tsx:108-114` | Navegar para `/configuracao` é `<a href>` em `AppSidebar` e `IngestionHealth`, e `<button>` aqui. Três nomes diferentes para a mesma ação |
| **7** | `C05` — idem, ação "abrir `/processo/{ref}`" | `ProcessTable.tsx:89-99` contra `AlertRow.tsx:118-125` | Nome acessível é o texto da REF numa, e "Abrir o detalhe de REF" na outra |
| **9** | `A05` — alvo abaixo de 24×24 px satisfaz a exceção Spacing | `RankingBar.tsx:152-154`, linha aninhada | `py-0.5` sobre `text-xs` dá caixa de **20 px**, e o `<ul>` não tem `gap`: 20 px de centro a centro, círculos de 24 px se intersectam. A linha de topo, com `py-1`, resolve 28 px e passa |
| **10** | `A06` — região viva montada antes da mensagem | `App.tsx:215-221` | O único `role` do conjunto que **nasce populado**: é o fallback do `<Suspense>`. MDN é explícita — não gere o elemento já preenchido |
| **11** | `A12` — gráfico com nome acessível | `History.tsx:343-347` | `accessibilityLayer={false}` **e** contêiner `aria-hidden`. A decisão está justificada no próprio arquivo e há alternativa textual real — a `<table>` irmã —, mas o corpus não tem contraexemplo que cubra "`aria-hidden` + tabela irmã", então a exceção está sem registro |
| **12** | `R05` — contêiner não impede aumento de espaçamento | `ProcessTable.tsx:194-204` | `max-w-48 truncate` com o recurso em `title`, que não é alcançável por teclado. `Performance.tsx:345` resolveu o mesmo caso com `break-words`, e o comentário de lá registra a medição |
| **14** | `N03` — **não normativo** | 30 arquivos de `web/src` | 10 degraus de espaçamento em uso; o sinal do corpus é "acima de ~8 a escala virou espectro". Sem respaldo normativo, **não é reprovação** |

## Achado de leitura, fora do corpus

`ConflictDialog.tsx` declara `role="alertdialog" aria-modal="true"` e **não tem
`useRef`, `useEffect` nem `.focus()`**: o diálogo provavelmente abre sem receber
foco e sem prender a tabulação. É o mesmo componente que `VN-3` e `VN-6` não
conseguem exercer — nenhuma fixture versionada produz o conflito que o abre.

## As 40 regras — o que passou

O revisor emitiu desfecho para as 40. **Não aplicáveis por construção:** `A07`
(zero `aria-live` explícito), `A14` (zero `role="tab"`; é `<nav>` com
`aria-current`), `A15` (zero `sticky`/`fixed` na casca), `D03`, `D04` e `D06`
(zero `dark:`), `D07` (zero sombras).

**Passaram com medição:** `A02` — `border-control`/`surface-raised` 3,32 e 3,03;
`border-strong` 5,06 e 5,04; `action-bg`/`surface-raised` 7,28 e 3,30;
`meter-fill`/`meter-track` 5,57 e 5,89. `A03` (zero `outline-none`), `A04` (zero
`onClick` em elemento não interativo), `A08` (27 `aria-label` conferidos), `A11`
(urgência com prefixo textual, canal com rótulo escrito, séries com legenda e
traçado), `A13`, `A16`, `C01`, `C02`, `C03`, `C06`, `C07`, `C09` (o limiar é 3
arquivos e o máximo medido é 2), `R02`, `R03`, `R04`, `R06`, `D01`, `D02`, `D05`.

**`A10` sem achado**, com a nota de que a regra volta a valer quando os
consumidores chegarem — o que aconteceu em `H-64`, no mesmo dia.

## Duas notas factuais que o revisor levantou

1. O comentário de `ConflictDialog.tsx:78-86` afirma `border-border-strong`, e a
   classe em `:88` é `border-border-modal`.
2. Fora do predicado de `C04`, que só alcança `rounded`/`border`/`shadow`: o
   cartão de contagem diverge em tipografia entre `StatCard.tsx:48,54`
   (`uppercase tracking-wide`, `font-mono text-3xl`) e `Alerts.tsx:144,146`
   (`text-2xl`, sem mono).

## Plano de ondas, para quem for executar

Do próprio revisor, por dependência técnica. **Ondas 1, 6 e 7 tocam zero
arquivos** — a camada de tema já declara todo destino de cor de que os achados
precisam, e o par escuro já está guardado por teste.

| Onda | Depende de | Arquivos | Achados |
|---|---|---|---|
| 2 — cor e canal de estado no token certo | — | 1 (`AlertRow.tsx`) | 2 |
| 3 — correções locais, independentes de tema | nada; corre em paralelo à 2 | 5 | 1, 9, 10, 11 |
| 4 — consistência composicional | onda 2 | 9 | 4, 5, 6, 7, 14 |
| 5 — responsividade e reflow | onda 4 | 0 novos | 12 |

`ACHADO 4` recomenda extrair `@utility button-primary`, e o revisor observa que
extraí-la antes da onda 2 congelaria um par de cor que ainda vai mudar.

## Recomendação — executada em 01/09/2026

**Virou o épico `E12`, uma história por onda**, na ordem que a tabela acima
desenha. É a forma que `E9`, `E10` e `E11` já tiveram, e o plano de ondas era a
fatiação pronta.

| Onda | História | Achados |
|---|---|---|
| 2 | `H-73` — a faixa de severidade no token certo | 2 |
| 3 | `H-74` — as quatro correções locais | 1, 9, 10, 11 |
| 4 | `H-75` — um papel de UI, uma forma e um nome | 4, 5, 6, 7 |
| 5 | `H-76` — a coluna Navio cabe no que ela mostra | 12 |

**A ordem virou linear na execução**, e não por gosto: `App.tsx` aparece em duas
histórias e `IngestionHealth.tsx` em duas, então ondas paralelas poriam os dois
arquivos em duas branches ao mesmo tempo.

**`ACHADO 2` teve precedência**, por ser o único com razão de contraste abaixo
do piso — 1,60:1 contra 3:1 —, e a correção eliminou de quebra as três cópias do
ícone.

**`ACHADO 14` não foi executado**, e a decisão fica registrada: o próprio
revisor o marca como não normativo, e aposentar dois degraus de espaçamento com
2 e 3 ocorrências é arrumação, não correção.
