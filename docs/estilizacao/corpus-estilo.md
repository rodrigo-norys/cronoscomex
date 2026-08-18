# Corpus de estilização verificável — painel operacional interno

**Stack alvo:** React 19.2.8 · TypeScript 7.0.2 · Vite 8.2.0 · Tailwind CSS 4.3.3 (`@tailwindcss/vite`) · Recharts 3.10.1 · Vitest 4.1.10 · Testing Library 16.3.2 · jsdom 30.0.1 · Biome 2.5.6
**Data de todas as consultas:** 2026-08-18
**Escopo:** casca comum (cabeçalho, abas, barra de filtros globais, faixa de estado) + 7 páginas (Início, Operacional, Clientes, Desempenho, Alertas, Histórico, Detalhe do Processo)

---

## FASE 1 — LEVANTAMENTO

### 1.1 Documentos consultados

| # | Documento | Identificador / versão | Status na data | Nível |
|---|---|---|---|---|
| F1 | [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) | WCAG 2.2 | **W3C Recommendation**, 05/10/2023, atualizada 12/12/2024 | 1 |
| F2 | [WCAG 2.2 aprovada como ISO/IEC](https://www.w3.org/press-releases/2025/wcag22-iso-pas/) | ISO/IEC 40500:2025 | Norma ISO/IEC vigente; texto idêntico ao de out/2023 | 1 |
| F3 | [W3C Accessibility Guidelines (WCAG) 3.0](https://www.w3.org/TR/wcag-3.0/) | WCAG 3.0 | **W3C Working Draft, 03/03/2026** — "inappropriate to cite this document as other than a work in progress" | rascunho |
| F4 | [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) | WAI-ARIA 1.2 | **W3C Recommendation**, 06/06/2023 | 2 |
| F5 | [ARIA Authoring Practices Guide — Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | APG Tabs | Nota do W3C/WAI, mantida | 2 |
| F6 | [CSS Color Adjustment Module Level 1](https://www.w3.org/TR/css-color-adjust-1/) | css-color-adjust-1 | **W3C Candidate Recommendation Snapshot, 16/12/2025** | 2 |
| F7 | [CSS Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/) | mediaqueries-5 | **W3C Working Draft, 19/02/2026** | 2 |
| F8 | [CSS Color Module Level 4](https://www.w3.org/TR/css-color-4/) | css-color-4 | **W3C Candidate Recommendation Draft, 06/08/2026** | 2 |
| F9 | [CSS Color Module Level 5](https://www.w3.org/TR/css-color-5/) | css-color-5 | **W3C Working Draft, 31/07/2026** — define `light-dark()` (§7) | 2 |
| F10 | [Tailwind CSS — Dark mode](https://tailwindcss.com/docs/dark-mode) | docs v4 | Documentação oficial da v4 | 3 |
| F11 | [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme) | docs v4 | Documentação oficial da v4 | 3 |
| F12 | [Tailwind CSS — Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles) | docs v4 | Documentação oficial da v4 | 3 |
| F13 | [Tailwind CSS — Responsive design](https://tailwindcss.com/docs/responsive-design) | docs v4 | Documentação oficial da v4 | 3 |
| F14 | [Tailwind CSS — Colors](https://tailwindcss.com/docs/colors) e [`color-scheme`](https://tailwindcss.com/docs/color-scheme) | docs v4 | Documentação oficial da v4 | 3 |
| F15 | [`packages/tailwindcss/theme.css`](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/theme.css) | branch `main` ≡ npm `tailwindcss@4.3.3` (verificado no registry) | Fonte do tema padrão, 19.586 bytes | 3 |
| F16 | [React DOM — Common components](https://react.dev/reference/react-dom/components/common) | react.dev | Documentação oficial | 3 |
| F17 | [Recharts and accessibility (wiki oficial)](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility) | wiki do projeto | Documentação oficial do projeto | 3 |
| F18 | [MDN — `role="alert"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role), [`role="status"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role), [`@media (forced-colors)`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors) | MDN | Documentação de referência | 3 |
| F19 | [GOV.UK Design System — Focus states](https://design-system.service.gov.uk/get-started/focus-states/) | GOV.UK DS | Design system institucional mantido | 4 |
| F20 | [U.S. Web Design System — Design tokens](https://designsystem.digital.gov/design-tokens/) | USWDS | Design system institucional mantido | 4 |
| F21 | [Design Tokens Format Module](https://www.designtokens.org/TR/drafts/format/) | versão 2025.10, 30/07/2026 | **Draft Community Group Report** | 5 |

### 1.2 As quatro verificações obrigatórias

**(a) Versão vigente da WCAG e status da WCAG 3.0.**
A norma vigente é a **WCAG 2.2**, publicada como *W3C Recommendation* em 05/10/2023, com atualização editorial em 12/12/2024 (F1), e aprovada como **ISO/IEC 40500:2025** (F2). WCAG 2.2 não deprecia 2.1 nem 2.0; conteúdo que atende 2.2 atende as anteriores.
A **WCAG 3.0 é um W3C Working Draft datado de 03/03/2026** (F3). O próprio documento diz: *"This is a draft document and may be updated, replaced, or obsoleted by other documents at any time"* e *"it is inappropriate to cite this document as other than a work in progress"*. **Nenhuma regra deste corpus deriva da WCAG 3.**

**(b) APCA é normativo em algum padrão vigente?**
**Não.** O algoritmo APCA (*Advanced Perceptual Contrast Algorithm*) nunca passou de conteúdo *exploratory* dentro do trabalho da WCAG 3 e foi **removido do Working Draft da WCAG 3 em julho de 2023** por falta de consenso do grupo de trabalho. Verificação direta no WD atual (F3, 03/03/2026): o documento **não menciona APCA** e as exigências de contraste aparecem como marcadores de posição (`@@[non-text-contrast]`), isto é, o algoritmo da WCAG 3 ainda não está decidido.
**O que É normativo hoje para contraste:** WCAG 2.2 **SC 1.4.3 Contrast (Minimum)**, nível AA — razão ≥ 4.5:1 para texto e ≥ 3:1 para texto grande — e **SC 1.4.11 Non-text Contrast**, nível AA — razão ≥ 3:1 (F1). A razão é calculada por `(L1 + 0.05) / (L2 + 0.05)` sobre a *relative luminance* definida no glossário da WCAG (ver §3.2). Qualquer resultado expresso em `Lc` (unidade do APCA) deve ser tratado como **fora do corpus**.

**(c) O Design Tokens Format Module é padrão W3C?**
**Não.** O documento (F21, versão 2025.10, 30/07/2026) declara literalmente: *"This specification was published by the Design Tokens Community Group. It is not a W3C Standard nor is it on the W3C Standards Track."* Traz ainda o aviso *"This is a preview draft of in progress changes. Do not refer to this document directly, and do not implement anything in this document."*
**Consequência para o peso no corpus:** a *ideia* de uma camada de tokens permanece no corpus principal, mas **ancorada em F11/F12** — a documentação oficial do Tailwind v4, que define `@theme` e a emissão de custom properties `--color-*` em `:root` como o mecanismo do próprio ferramental. O **formato de arquivo** DTCG (`$value`, `$type`) vai para a tabela não normativa. Não recomendo adotá-lo aqui.

**(d) "Responsividade" tem norma?**
Tem, e **exatamente por uma via**: o requisito normativo de responsividade em padrão publicado é **SC 1.4.10 Reflow**, nível AA (F1):
> *"Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions for: Vertical scrolling content at a width equivalent to **320 CSS pixels**; Horizontal scrolling content at a height equivalent to **256 CSS pixels**."*

A largura nomeada é **320 pixels CSS**, e o *Understanding* explica a origem: *"320 CSS pixels is equivalent to a starting viewport width of 1280 CSS pixels wide at 400% zoom."* Ou seja — e isto é decisivo para um painel desktop — **a exigência de 320px não vem do telefone, vem do zoom de 400% numa janela de 1280px.** Ela alcança o operador desta aplicação.
Adjacentes, também normativos: **SC 1.4.4 Resize Text** (AA, texto redimensionável até 200% sem perda) e **SC 1.4.12 Text Spacing** (AA).
O SC 1.4.10 traz exceção explícita: *"A section of content that requires two-dimensional layout for understanding or functionality, such as a table or map, has an exception... However, sections of content within the two-dimensional layout... would still need to meet this success criterion."*
**Com todas as letras: fora de 1.4.10, 1.4.4 e 1.4.12, não há norma de responsividade.** Número de breakpoints, sistema de grid, "mobile-first", larguras de contêiner — nada disso tem requisito normativo. Os breakpoints padrão do Tailwind v4 (`sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem, `2xl` 96rem — F13/F15) são **documentação de ferramenta**, não norma. Tudo que for além dos três SC acima está na tabela separada.

### 1.3 Achado adicional que muda o alcance de duas regras — "web page" e SPA

O *Understanding Conformance* (F1) define *web page* como *"a non-embedded resource obtained from a single URI"* e dá o exemplo explícito de um webmail AJAX que *"lives entirely at http://example.com/mail, but includes an inbox, a contacts area and a calendar. Links or buttons are provided that cause the inbox, contacts, or calendar to display, but do not change the URI of the page as a whole."*

**Consequência:** se as sete telas vivem sob uma única URI sem roteamento, elas são **uma** *web page*, e **SC 3.2.3 Consistent Navigation** e **SC 3.2.4 Consistent Identification** — que falam de *set of web pages* — não se aplicam formalmente. Se houver roteador com caminhos distintos (`/operacional`, `/clientes`, …), há um *set of web pages* e os dois SC se aplicam.
**O agente deve verificar isto uma vez, no início, e declarar o resultado.** As regras C04, C05 e C06 carregam essa condicionalidade explícita.

---

## FASE 2 — O QUE NÃO SE APLICA

Painel interno, local, um operador, desktop Windows, sem autenticação, sem público, sem tráfego.

### 2.1 Cortado, com a fonte na mão

| O que | Por que não se aplica aqui | Fonte |
|---|---|---|
| **Breakpoints de telefone como meta de design** (`sm:` pensado como "no celular", layouts de 375px, menu hambúrguer) | Não há dispositivo móvel no alvo. O único requisito de largura estreita é o de zoom (§1.2d), e ele se satisfaz refluindo em 320px CSS — não desenhando para telefone. F13 alerta que `sm:` não significa "telas pequenas": *"Don't think of `sm:` as meaning 'on small screens', think of it as 'at the small breakpoint'."* | F13, F1 (SC 1.4.10) |
| **Otimização para toque / alvos de 44×44** (SC 2.5.5 Target Size (Enhanced)) | É nível **AAA**, e o W3C declara: *"It is not recommended that Level AAA conformance be required as a general policy for entire sites."* O ponteiro aqui é mouse; o piso aplicável é o de nível AA. | F1 (Understanding Conformance) |
| **Desempenho em rede móvel** (orçamento de bytes, imagens responsivas, `srcset`, prefetch por conexão) | Aplicação servida localmente. O *lazy loading* já existente do Recharts é escolha de engenharia legítima, mas **não é regra de estilização** e sai do corpus. | contexto medido |
| **Internacionalização e RTL** (`dir="rtl"`, `ps-*`/`pe-*` no lugar de `pl-*`/`pr-*`, formatação por locale, SC 3.1.2 Language of Parts) | Interface monolíngue pt-BR, operador único. Permanece apenas o custo de uma linha: `<html lang="pt-BR">` (SC 3.1.1, nível A, técnica H57) — mantido como regra A13. | F1 (SC 3.1.1 / H57) |
| **Conformidade legal de site público** | A exclusão aqui é **factual, não jurídica**: regimes legais de acessibilidade digital alcançam serviços publicados; esta aplicação não é publicada, não tem URL externa e não tem público. Não abri texto de lei nenhum nesta sessão e por isso **não cito número de lei**. Se a aplicação for publicada um dia, esta linha se invalida. | — |
| **SC 1.2.x (mídia sincronizada: legendas, audiodescrição, transcrição)** | Ausência factual de áudio e vídeo na aplicação. Não é dispensa, é não incidência. | F1 |
| **Contrast (Enhanced) 7:1 (SC 1.4.6) e Focus Appearance (SC 2.4.13)** | Ambos **nível AAA**. Defesa com fonte: o W3C não recomenda exigir AAA como política geral (F1, Understanding Conformance). Ficam como *upgrade opcional*, não como regra. O piso 2.4.13 (perímetro de 2px CSS, 3:1 entre estado focado e não focado) é bom guia de implementação para A03 — mas A03 é cobrada em 2.4.7 (AA), não em 2.4.13. | F1 |
| **Formato de arquivo DTCG** (`$value`/`$type`, tooling de transformação) | Não é padrão W3C, e a própria especificação diz "do not implement anything in this document" (F21). Introduzir tooling de tokens aqui adiciona dependência sem resolver nada que `@theme` (F11) não resolva. | F21, F11 |
| **APCA / valores `Lc`** | Não normativo em padrão vigente (§1.2b). **Proibido como critério de aprovação.** | F3 |

### 2.2 O que NÃO é cortado, e por quê — acessibilidade não é requisito de público

Acessibilidade aqui não é conformidade regulatória: é ergonomia do único usuário, que fica oito horas por dia diante desta tela. Todos os SC abaixo produzem benefício direto para **uma** pessoa e permanecem obrigatórios:

| Critério | Nível | Por que permanece com público zero |
|---|---|---|
| SC 1.4.3 Contrast (Minimum) | AA | Fadiga visual em jornada longa é o custo direto de contraste baixo; independe de quantos usam. |
| SC 1.4.11 Non-text Contrast | AA | Bordas, limites de campo e indicadores de estado são o que distingue "campo vazio" de "campo desabilitado" às 17h. |
| SC 1.4.1 Use of Color | A | O operador pode ter deficiência de percepção de cor — a mais comum das condições visuais. O padrão já existente de converter o dado codificado por cor em rótulo textual **é a implementação correta deste SC e deve ser preservado**. |
| SC 1.4.4 Resize Text · SC 1.4.10 Reflow · SC 1.4.12 Text Spacing | AA | Zoom de navegador é o ajuste de acessibilidade mais usado por quem tem baixa visão. 400% em 1280px = 320px CSS (§1.2d). |
| SC 2.1.1 Keyboard · SC 2.4.3 Focus Order · SC 2.4.7 Focus Visible · SC 2.4.11 Focus Not Obscured | A/AA | Operação por teclado em painel operacional é ganho de produtividade antes de ser acessibilidade. Perder o foco na tela é perder o lugar. |
| SC 2.5.8 Target Size (Minimum) — 24×24 CSS px | AA | O SC fala em *"target for pointer inputs"*; **mouse é pointer input**. Não há dispensa por ser desktop. |
| SC 4.1.2 Name, Role, Value · SC 4.1.3 Status Messages | A/AA | 13 `role="alert"` e 11 `role="status"` já existentes só cumprem sua função se a região viver no DOM antes da mensagem (F18). |
| SC 2.2.2 Pause, Stop, Hide | A | Animação persistente em periferia de tela, em jornada de 8h, é distração mensurável. |
| SC 1.3.1 Info and Relationships · SC 1.3.2 Meaningful Sequence · SC 3.1.1 Language of Page | A | Custo próximo de zero, e é o que sustenta qualquer leitor de tela ou modo de leitura futuro. |

**Dispensas de acessibilidade que eu defendo:** apenas as de **nível AAA** (SC 1.4.6, 2.4.13, 2.3.3, 2.5.5), com base na declaração do próprio W3C de que AAA não deve ser exigido como política geral (F1). Nada de nível A ou AA é dispensado neste contexto.

---

## FASE 3 — A FRONTEIRA DO DECIDÍVEL

### 3.1 Os três baldes

- **LOCAL** — decidível lendo um único componente; o veredito não muda com o resto do conjunto. Ex.: `focus:outline-none` sem substituto no mesmo `className`.
- **COMPOSICIONAL** — só decidível vendo **as sete páginas mais a casca ao mesmo tempo**. Consistência vive quase toda aqui: "o mesmo papel de UI usa o mesmo trio de utilitários" é indecidível com um arquivo na mão, porque a violação é a *diferença* entre arquivos. É por isso que este agente recebe o conjunto.
- **DE EXECUÇÃO** — só decidível renderizando: contraste efetivo depois da cascata, foco realmente pintado, comportamento sob redimensionamento e zoom, ordem de leitura resultante.

### 3.2 A parte do balde DE EXECUÇÃO que vira estática

Contraste **se torna decidível estaticamente** se o agente resolver o utilitário até o valor final de cor e aplicar a fórmula normativa. A cadeia completa, com fonte:

1. **De onde vêm os valores.** Tailwind v4 emite as variáveis de tema como *custom properties* reais em `:root` (F11). Os valores padrão estão em `node_modules/tailwindcss/theme.css`, num bloco `@theme default` (F15 — arquivo verificado, 19.586 bytes, branch `main` correspondente ao `tailwindcss@4.3.3` publicado). Todos em `oklch()`. Famílias existentes na 4.3.3:
   `amber · blue · cyan · emerald · fuchsia · gray · green · indigo · lime · mauve · mist · neutral · olive · orange · pink · purple · red · rose · sky · slate · stone · taupe · teal · violet · yellow · zinc`
   Passos: `50 100 200 300 400 500 600 700 800 900 950`.
2. **Como converter.** `oklch()` é definido em CSS Color Module Level 4 (F8, CR Draft 06/08/2026), que também especifica a conversão Oklab↔sRGB (§10.10 e §10.11) e traz código de exemplo (§19). Cores fora do gamut precisam de *gamut mapping* para exibição em sRGB.
3. **A fórmula normativa.** WCAG 2.2 (F1) define **contrast ratio** = `(L1 + 0.05) / (L2 + 0.05)`, com L1 a *relative luminance* da cor mais clara e L2 a da mais escura. **Relative luminance** = `0.2126·R + 0.7152·G + 0.0722·B`, com cada canal normalizado por `c = c8bit/255` e linearizado por `c/12.92` se `c ≤ 0.03928`, senão `((c+0.055)/1.055)^2.4`. A errata do W3C registra que o limiar IEC correto é `0.04045`, com diferença desprezível em 8 bits.

**Verificação executada nesta sessão.** Implementei a cadeia acima e a validei contra os hexadecimais publicados do Tailwind v4 antes de usá-la:

```
sanity check — oklch do theme.css → sRGB 8 bits
  red-500    oklch(63.7% 0.237 25.331)   → (251, 44, 54)    #fb2c36
  blue-600   oklch(54.6% 0.245 262.881)  → (21, 93, 252)    #155dfc
  gray-400   oklch(70.7% 0.022 261.325)  → (153, 161, 175)  #99a1af
  slate-500  oklch(55.4% 0.046 257.417)  → (98, 116, 142)   #62748e
  amber-500  oklch(76.9% 0.188 70.08)    → (254, 154, 0)    #fe9a00
  green-600  oklch(62.7% 0.194 149.214)  → (0, 166, 62)     #00a63e
```

Razões calculadas (fg sobre bg), com o veredito nos dois pisos normativos:

| par | hex fg | hex bg | razão | ≥4.5:1 (1.4.3) | ≥3:1 (1.4.11 / texto grande) |
|---|---|---|---|---|---|
| `text-gray-400` / `bg-white` | #99a1af | #ffffff | **2.60** | FALHA | FALHA |
| `text-gray-500` / `bg-white` | #6a7282 | #ffffff | 4.84 | passa | passa |
| `text-gray-600` / `bg-white` | #4a5565 | #ffffff | 7.56 | passa | passa |
| `text-slate-400` / `bg-white` | #90a1b9 | #ffffff | **2.63** | FALHA | FALHA |
| `text-slate-500` / `bg-white` | #62748e | #ffffff | 4.76 | passa | passa |
| `text-amber-500` / `bg-white` | #fe9a00 | #ffffff | **2.13** | FALHA | FALHA |
| `text-amber-600` / `bg-white` | #e17100 | #ffffff | **3.20** | FALHA | passa |
| `text-amber-700` / `bg-white` | #bb4d00 | #ffffff | 5.03 | passa | passa |
| `text-green-500` / `bg-white` | #00c950 | #ffffff | **2.22** | FALHA | FALHA |
| `text-green-600` / `bg-white` | #00a63e | #ffffff | **3.22** | FALHA | passa |
| `text-green-700` / `bg-white` | #008236 | #ffffff | 4.95 | passa | passa |
| `text-red-500` / `bg-white` | #fb2c36 | #ffffff | **3.81** | FALHA | passa |
| `text-red-600` / `bg-white` | #e7000b | #ffffff | 4.77 | passa | passa |
| `text-blue-500` / `bg-white` | #2b7fff | #ffffff | **3.76** | FALHA | passa |
| `text-blue-600` / `bg-white` | #155dfc | #ffffff | 5.25 | passa | passa |
| `text-white` / `bg-amber-500` | #ffffff | #fe9a00 | **2.13** | FALHA | FALHA |
| `text-white` / `bg-green-500` | #ffffff | #00c950 | **2.22** | FALHA | FALHA |
| `text-white` / `bg-blue-500` | #ffffff | #2b7fff | **3.76** | FALHA | passa |
| `text-red-700` / `bg-red-100` | #c10007 | #ffe2e2 | 5.27 | passa | passa |
| `text-amber-700` / `bg-amber-100` | #bb4d00 | #fef3c6 | 4.52 | passa | passa |
| `text-green-700` / `bg-green-100` | #008236 | #dcfce7 | 4.50 | passa | passa |
| `text-gray-400` / `bg-gray-900` | #99a1af | #101828 | 6.82 | passa | passa |
| `text-slate-400` / `bg-slate-900` | #90a1b9 | #0f172b | 6.78 | passa | passa |

Leia a última linha do bloco claro contra as duas últimas do bloco escuro: **`gray-400` reprova em fundo branco (2.60) e aprova em fundo `gray-900` (6.82)**. É o mesmo utilitário. Isto é a prova de que contraste é decidível estaticamente **apenas** com o par resolvido, e é a razão pela qual o mesmo passo de paleta não pode ser reaproveitado entre esquemas claro e escuro (regra D06).

### 3.3 O que NÃO vira estático — reportar VERIFICAR NO NAVEGADOR

O agente **não aprova nem reprova** os itens abaixo; reporta com procedimento manual.

| Situação | Por que escapa | Procedimento manual |
|---|---|---|
| Utilitário de cor com alfa (`bg-black/40`, `text-white/70`) | A cor efetiva depende do que está pintado atrás, que depende da árvore renderizada | DevTools → Elements → pipeta no pixel do texto e no do fundo → calcular a razão com os dois valores lidos |
| Gradientes (`bg-gradient-to-r`, `from-*`/`via-*`/`to-*`) | Não há um par único; o contraste varia ao longo do eixo | Amostrar 3 pontos (início, meio, fim) sob o texto e reportar o pior |
| Cor vinda de `style={}` calculado, ou de `fill`/`stroke` de série do Recharts | Valor só existe em tempo de execução | Renderizar a página Histórico e amostrar cada série |
| Foco efetivamente pintado | Depende de cascata, `outline` do UA, `z-index` e recorte por `overflow` | Tab por todos os controles focáveis de cada página; capturar tela de cada parada |
| Reflow real a 320px CSS | Depende do layout resolvido, não das classes | Janela em 1280px CSS → zoom do navegador em 400% → percorrer as 7 páginas verificando ausência de rolagem horizontal fora de tabela/gráfico |
| Redimensionamento de texto a 200% | Depende de altura de linha, `overflow` e recortes | Ctrl+`+` até 200% → verificar corte de texto, sobreposição e perda de controle |
| `forced-colors: active` (Temas de Contraste do Windows) | O UA substitui `color`, `background-color`, `border-color`, `outline-color` e força `box-shadow: none` (F18) | Windows → Configurações → Acessibilidade → Temas de Contraste → ativar → percorrer as 7 páginas verificando se estado ainda é distinguível |
| Ordem de leitura resultante | `order-*`, `flex-row-reverse`, `grid-flow-*` desacoplam a ordem visual da ordem do DOM (SC 1.3.2) | Percorrer com Tab e comparar com a ordem visual |

---

## FASE 4, PEÇA A — CORPUS

Critério de **CUSTO**, declarado: medido em **quantos arquivos precisam mudar**, contra a base medida de ≈25 arquivos (casca + 7 páginas + 17 componentes).
`baixo` = 1 a 3 arquivos · `médio` = 4 a 10 arquivos · `alto` = mais de 10 arquivos **ou** exige criar/alterar a camada de tema no CSS de entrada, o que atravessa todos os consumidores.

### Eixo ACESSIBILIDADE

| ID | EIXO | PREDICADO | BALDE | SINAL NO CÓDIGO | CONTRAEXEMPLO | FONTE | CUSTO |
|---|---|---|---|---|---|---|---|
| A01 | acessibilidade | Não existe par texto/fundo resolvido com razão de contraste < 4.5:1 (ou < 3:1 quando o texto é ≥ 24px, ou ≥ 18.66px em `font-bold`) | EXECUÇÃO → estático via §3.2 | `text-gray-400`, `text-slate-400`, `text-amber-500`, `text-amber-600`, `text-green-500`, `text-green-600`, `text-red-500`, `text-blue-500`, `text-*-300`, `text-*-400` em elemento cujo `bg-` mais próximo (próprio ou ancestral) seja `bg-white`/`bg-*-50`/`bg-*-100` | `text-gray-400` dentro de um contêiner `bg-gray-900` → 6.82:1, aprova. O utilitário sozinho não é o achado; o par resolvido é | [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum), AA | alto |
| A02 | acessibilidade | Toda borda, contorno ou ícone que identifica um componente ou seu estado tem razão ≥ 3:1 contra a cor adjacente | EXECUÇÃO → estático via §3.2 | `border-gray-200`, `border-slate-200`, `ring-gray-200`, `divide-gray-200`, `bg-gray-200` como trilho de barra, `text-gray-300` em ícone informativo | `border-gray-200` puramente decorativa entre dois blocos que já se distinguem por `bg-` diferente — o SC diz que não exige contorno indicando área de clique | [SC 1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast), AA | médio |
| A03 | acessibilidade | Toda ocorrência de `outline-none` vem acompanhada, no mesmo `className`, de um indicador de foco autoral | LOCAL | `outline-none`, `focus:outline-none`, `focus-visible:outline-none` sem nenhum de `focus-visible:ring-*` / `focus-visible:outline-*` / `focus-visible:border-*` / `focus:ring-*` no mesmo elemento | `focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2` → o substituto existe e é mais visível que o padrão | [SC 2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible), AA | médio |
| A04 | acessibilidade | Todo elemento não interativo que recebe `onClick` tem `role`, `tabIndex={0}` e handler de teclado | LOCAL | `<div onClick=`, `<span onClick=`, `<li onClick=`, `<td onClick=` sem `role=` **e** sem `tabIndex` no mesmo elemento | `<div onClick={close}>` que é o *backdrop* de um diálogo, quando existe um `<button aria-label="Fechar">` com a mesma ação — a função é operável por teclado por outro caminho | [SC 4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) (A, falha F59) + [SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard) (A) | médio |
| A05 | acessibilidade | Todo alvo de ponteiro menor que 24×24 CSS px tem folga que satisfaça a exceção *Spacing* | LOCAL | `<button>`/`<a>` cujo box resolve abaixo de 24px: `h-4 w-4` (16px), `h-5 w-5` (20px), `p-0`/`p-0.5` em botão de ícone. Escala base verificada: `--spacing: 0.25rem` (F15), logo `h-6 w-6` = 24px é o piso | Botão `h-5 w-5` com `m-1.5` em todos os lados: círculo de 24px de diâmetro centrado no seu box não intersecta outro alvo → exceção *Spacing* satisfeita | [SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), AA | médio |
| A06 | acessibilidade | Todo `role="alert"` / `role="status"` está montado no DOM antes de receber a mensagem | LOCAL | `{error && <div role="alert">{error}</div>}`, `{isLoading && <p role="status">…</p>}` — o nó nasce já populado | `<div role="alert">{error ?? ""}</div>` sempre montado, com string vazia quando não há erro — o leitor de tela já está observando o nó | [SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) (AA) + [MDN `role="alert"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role): *"Do not try to dynamically add/generate an element with `role="alert"` that is already populated"* | médio |
| A07 | acessibilidade | Nenhum `aria-live` explícito contradiz o valor implícito do `role` do mesmo elemento | LOCAL | `role="status" aria-live="assertive"`, `role="alert" aria-live="polite"` | `role="status" aria-live="polite"` — redundante, não conflitante; não é achado | [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) (REC 06/06/2023) + MDN: `status` ⇒ `aria-live="polite"`, `aria-atomic="true"`; `alert` ⇒ `aria-live="assertive"`, `aria-atomic="true"` | baixo |
| A08 | acessibilidade | Todo `aria-label` aplicado a controle que já exibe texto visível contém esse texto visível | LOCAL | Entre os 27 `aria-label`: qualquer um em `<button>`/`<a>` cujo children inclua texto, com string divergente. Ex.: `<button aria-label="Remover item">Excluir</button>` | `<button aria-label="Filtrar por período">` num botão só de ícone, sem texto visível — não há rótulo visível a conter | [SC 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html), A (falha F96) | baixo |
| A09 | acessibilidade | Nenhuma animação que inicia automaticamente e dura mais de 5s corre sem mecanismo de pausar, parar ou ocultar | LOCAL | `animate-spin`, `animate-pulse`, `animate-bounce` em elemento cuja montagem não é limitada por um estado de curta duração — esqueleto de carregamento persistente, faixa de estado, badge de "ao vivo" | `animate-spin` num spinner montado só enquanto `isSubmitting` de uma chamada local — não passa de 5s e a exceção "essential" cobre feedback de progresso | [SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), A | baixo |
| A10 | acessibilidade | Toda animação ou transição que produz **movimento** tem contraparte `motion-reduce:` | LOCAL | `animate-*`, `transition-transform`, `transition-all`, `translate-*` com `transition-*`, `duration-*` sem `motion-reduce:animate-none` / `motion-reduce:transition-none` no mesmo elemento | `transition-colors duration-150` — mudança de cor não é movimento; `prefers-reduced-motion` trata de *motion* (F7) | [Media Queries L5 `prefers-reduced-motion`](https://www.w3.org/TR/mediaqueries-5/) (**WD 19/02/2026** — mecanismo) + [Tailwind `motion-reduce`](https://tailwindcss.com/docs/hover-focus-and-other-states) ⇒ `@media (prefers-reduced-motion: reduce)`. Obrigação correspondente é SC 2.3.3, **nível AAA** | baixo |
| A11 | acessibilidade | Nenhuma informação é transmitida apenas por cor | COMPOSICIONAL | Badge/pílula com só `bg-red-100 text-red-700` e um número dentro; linha de tabela colorida sem coluna de estado; ponto colorido sem `title`/texto; séries do Recharts distintas só por `stroke` sem `<Legend>` ou `name` | **O padrão já existente da aplicação**: o dado de negócio codificado por cor na origem é convertido em rótulo de texto na interface. Isto é o SC 1.4.1 satisfeito — **preservar, não "corrigir"** | [SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), A | médio |
| A12 | acessibilidade | Nenhum gráfico do Recharts desliga `accessibilityLayer`, e todo gráfico tem nome acessível | LOCAL | `accessibilityLayer={false}` em `<LineChart>`/`<BarChart>`/`<AreaChart>`; contêiner do gráfico sem `aria-label` nem `aria-labelledby` apontando para o título visível | **Ausência** da prop em Recharts 3.10.1 não é achado: o padrão é `true` a partir da 3.0 (era `false` na 2.x) | [Recharts wiki oficial — accessibility](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility) | baixo |
| A13 | acessibilidade | O elemento `<html>` declara `lang="pt-BR"` | LOCAL | `index.html` com `<html lang="en">` ou sem `lang`, enquanto o conteúdo é pt-BR | `lang="pt-br"` em minúsculas — tag de idioma é *case-insensitive*, não é achado | [SC 3.1.1](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html), A (técnica H57) | baixo |
| A14 | acessibilidade | A navegação por abas ou implementa o padrão APG Tabs por inteiro, ou é navegação de links — nunca um híbrido | COMPOSICIONAL | Híbrido: `role="tab"` sem `aria-controls`; `role="tabpanel"` sem `aria-labelledby`; todos os `role="tab"` com `tabIndex={0}` (ausência de *roving tabindex*); `role="tablist"` sem handler de seta esquerda/direita | Navegação implementada como `<nav>` + `<a aria-current="page">`, sem nenhum `role="tab"` — é navegação, não o padrão Tabs; o APG não incide. O `aria-current` já presente no código é o sinal correto deste caminho | [APG Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) + [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) | médio |
| A15 | acessibilidade | Nenhum elemento `sticky`/`fixed` da casca esconde inteiramente um componente que recebeu foco | EXECUÇÃO → parcialmente estático | `sticky top-0`, `fixed top-0`, `fixed bottom-0` no cabeçalho, na barra de filtros ou na faixa de estado, **sem** `scroll-mt-*`/`scroll-pt-*` nos contêineres roláveis das páginas | `sticky left-0` numa primeira coluna de tabela — obscurece no eixo horizontal um conteúdo que rola, não o foco vindo de rolagem vertical do documento | [SC 2.4.11](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum), AA | baixo |
| A16 | acessibilidade | Não existe `tabIndex` com valor positivo | LOCAL | `tabIndex={1}`, `tabIndex={2}`, `tabindex="1"` | `tabIndex={-1}` no contêiner do `role="alertdialog"` para receber foco programático na abertura — negativo é legítimo e esperado | [SC 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), A (falha F44) | baixo |
| A17 | acessibilidade | Toda informação de estado sobrevive a `forced-colors: active` | EXECUÇÃO → parcialmente estático | Estado codificado apenas em `bg-*` (fundo é substituído pelo UA), apenas em `shadow-*` (forçado a `none`), ou em `border-transparent`; qualquer `forced-color-adjust: none` | Estado codificado em texto + `border-2` que muda de estilo (`border-dashed` vs `border-solid`): o UA substitui a **cor** da borda, não a espessura nem o estilo, e o texto sempre sobrevive | [MDN `@media (forced-colors)`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors) + [CSS Color Adjust L1](https://www.w3.org/TR/css-color-adjust-1/) (CR Snapshot 16/12/2025). Relevante porque o alvo é Windows | médio |

### Eixo CONSISTÊNCIA

| ID | EIXO | PREDICADO | BALDE | SINAL NO CÓDIGO | CONTRAEXEMPLO | FONTE | CUSTO |
|---|---|---|---|---|---|---|---|
| C01 | consistência | Não existe utilitário de passo de paleta bruta em arquivo `.tsx`; toda cor referencia um token semântico declarado em `@theme` | COMPOSICIONAL | Regex sobre `.tsx`: `\b(bg\|text\|border\|ring\|divide\|from\|via\|to\|fill\|stroke\|shadow\|accent\|caret\|outline\|decoration)-(amber\|blue\|cyan\|emerald\|fuchsia\|gray\|green\|indigo\|lime\|mauve\|mist\|neutral\|olive\|orange\|pink\|purple\|red\|rose\|sky\|slate\|stone\|taupe\|teal\|violet\|yellow\|zinc)-(50\|[1-9]50\|[1-9]00)\b` — famílias e passos conferidos em `theme.css` da 4.3.3 (F15). Estado medido: **40 classes de cor distintas, 0 tokens** | `bg-white`, `text-black`, `bg-transparent`, `border-transparent`, `text-current`, `text-inherit` — não são passos de paleta e não carregam semântica de estado; não são achado | [Tailwind v4 — Theme variables](https://tailwindcss.com/docs/theme): `@theme { --color-*: … }` emite custom properties em `:root` | alto |
| C02 | consistência | Não existe valor arbitrário de cor | LOCAL | `bg-[#…]`, `text-[#…]`, `border-[rgb(…)]`, `ring-[hsl(…)]`, `[color:…]`, `[background-color:…]` | `bg-(--color-surface-raised)` — sintaxe v4 documentada de referência a variável de tema (atalho de `bg-[var(--color-surface-raised)]`), não é literal | [Tailwind v4 — Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles) (arbitrary values / CSS variables) | baixo |
| C03 | consistência | Nenhum `style={{…}}` define cor, espaçamento, raio ou sombra | LOCAL | `style={{ backgroundColor:`, `style={{ color:`, `style={{ padding:`, `style={{ margin:`, `style={{ borderRadius:`, `style={{ boxShadow:` | `style={{ width: \`${pct}%\` }}` numa barra de progresso, ou `style={{ ["--row-height"]: h }}` — valores genuinamente dinâmicos, impossíveis como utilitário estático | [React DOM — common components](https://react.dev/reference/react-dom/components/common) (prop `style`) + F11 | baixo |
| C04 | consistência | Um mesmo papel de UI usa a mesma combinação `rounded-* / border-* / shadow-*` nas sete páginas | COMPOSICIONAL | Extrair, de cada página, a tripla de utilitários do contêiner de primeiro nível de cada card/painel/seção; qualquer divergência entre páginas para o mesmo papel é achado | Card de alerta com `border-2` deliberado enquanto os demais têm `border`: a diferença **codifica estado** e vem acompanhada de rótulo textual — é 1.4.1 satisfeito, não inconsistência | [SC 3.2.4](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html), AA — **condicionado** a §1.3 (só incide se houver URIs distintas) | médio |
| C05 | consistência | O mesmo controle funcional tem o mesmo nome acessível nas sete páginas | COMPOSICIONAL | Coletar os 27 `aria-label` mais o texto visível de todos os `<button>`/`<a>`; agrupar por ação disparada (mesma função/rota); strings divergentes no mesmo grupo = achado. Ex.: "Atualizar" numa página e "Recarregar" noutra para o mesmo `refetch` | "Exportar CSV" numa página e "Exportar seleção" noutra, quando os escopos exportados realmente diferem — funções distintas admitem nomes distintos | [SC 3.2.4](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html) (AA, falha F31) — **condicionado** a §1.3 | baixo |
| C06 | consistência | A ordem relativa dos itens da navegação por abas é a mesma em todas as páginas | COMPOSICIONAL | O array/JSX que gera as abas deve estar definido uma única vez na casca; qualquer página que redefina, reordene ou injete item fora dessa fonte é achado | Aba ocultada condicionalmente (`{hasAlerts && <Tab …/>}`): remover um item **não altera a ordem relativa** dos demais — a definição de *same relative order* é "same position relative to other items", tolerante a inserção e remoção | [SC 3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), AA — **condicionado** a §1.3 | baixo |
| C07 | consistência | Não existe valor arbitrário de espaçamento ou dimensão na escala de `--spacing` | LOCAL | `p-[13px]`, `gap-[7px]`, `mt-[22px]`, `w-[347px]`, `h-[38px]`, `space-x-[9px]`. A escala base é `--spacing: 0.25rem` (F15), logo todo múltiplo de 4px já tem utilitário | `max-w-[72ch]` para medida de linha, ou `min-h-[calc(100dvh-4rem)]` — unidades tipográficas e cálculos de viewport não pertencem à escala de spacing e não têm utilitário equivalente | [Tailwind v4 — Theme variables](https://tailwindcss.com/docs/theme) (`--spacing-*`) + F12 | baixo |
| C08 | consistência | Cada página tem exatamente um `<h1>` e nenhum salto de nível de título | COMPOSICIONAL | Percorrer `h1`…`h6` de cada página mais a casca; dois `h1` na mesma vista, ou `h2` seguido de `h4`, é achado. Também: `<div className="text-2xl font-bold">` funcionando como título sem elemento de heading | Um `h1` na casca (nome do painel) e `h2` como título de cada página — hierarquia válida, desde que só um `h1` exista na árvore renderizada | [SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html), A (falhas F2 e F43) | médio |
| C09 | consistência | Nenhuma string de `className` idêntica com 6 ou mais utilitários aparece em 3 ou mais arquivos sem extração para `@utility` ou `@layer components` | COMPOSICIONAL | Normalizar (ordenar tokens) e contar ocorrências das strings de `className` entre os ≈25 arquivos | Duas strings idênticas em componentes cujo papel semântico difere (um badge de status e uma pílula de filtro que casualmente coincidem hoje) — extrair acoplaria os dois | [Tailwind v4 — Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles): `@utility`, `@layer components`. **Limiar operacional, sem fonte normativa — ver §5** | médio |
| C10 | consistência | Um mesmo nível de severidade usa sempre o mesmo par de utilitários de cor nas sete páginas | COMPOSICIONAL | Agrupar as 40 classes de cor por semântica de severidade; se "erro" for `bg-red-50 text-red-700` numa página e `bg-red-100 text-red-800` noutra, é achado | Duas severidades diferentes com a mesma família e passos distintos (`text-amber-700` para aviso, `text-red-700` para erro) — é a distinção pretendida, não divergência | [SC 3.2.4](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html) (AA, condicionado) + [SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) (o par precisa passar em ambos os casos) | médio |

### Eixo RESPONSIVIDADE

| ID | EIXO | PREDICADO | BALDE | SINAL NO CÓDIGO | CONTRAEXEMPLO | FONTE | CUSTO |
|---|---|---|---|---|---|---|---|
| R01 | responsividade | Nenhum conteúdo fora de tabela ou gráfico exige rolagem em dois eixos a 320 CSS px de largura | EXECUÇÃO → parcialmente estático | `w-[…px]`, `min-w-[…px]`, `min-w-*` acima de `min-w-80` (320px), `whitespace-nowrap` em blocos de texto, `flex` sem `flex-wrap` numa barra com muitos filhos, `grid-cols-N` fixo sem contraparte de 1 coluna | `overflow-x-auto` num wrapper de tabela com `min-w-[900px]` na `<table>`: o SC dá exceção explícita a conteúdo que exige layout bidimensional | [SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), AA — 320 CSS px = 1280px a 400% de zoom | médio |
| R02 | responsividade | Nenhuma largura fixa maior que 320 CSS px é declarada sem `max-w-full` ou equivalente | LOCAL | `w-[400px]`, `w-96` (384px), `min-w-[480px]` em elemento que não é tabela nem gráfico | `w-96 max-w-full` — a largura fixa cede abaixo do limite; e `min-w-[480px]` **dentro** de `overflow-x-auto` numa `<table>` cai na exceção do 1.4.10 | [SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), AA | baixo |
| R03 | responsividade | Nenhum tamanho de fonte é declarado em unidade absoluta | LOCAL | `text-[14px]`, `text-[0.9rem]` não é achado (rem escala), mas `style={{ fontSize: 14 }}` é — React acrescenta `px` a números (F16); e `text-[12px]` | `text-sm` (`--text-sm: 0.875rem`, F15) e qualquer utilitário da escala padrão — todos em `rem`, escalam com o zoom e com a fonte-base do usuário | [SC 1.4.4](https://www.w3.org/TR/WCAG22/#resize-text), AA + [React DOM common](https://react.dev/reference/react-dom/components/common) (números viram px) | baixo |
| R04 | responsividade | Todo utilitário de layout com prefixo de breakpoint tem contraparte sem prefixo | LOCAL | `lg:grid-cols-3` sem `grid-cols-1`; `sm:flex-row` sem `flex-col`; `lg:block` sem `hidden`/`block`. Estado medido: 17 usos (9 `sm:`, 8 `lg:`) | `lg:sticky` sem contraparte — `position: static` é o valor inicial do CSS e é o comportamento desejado abaixo do breakpoint; declarar `static` seria ruído | [Tailwind v4 — Responsive design](https://tailwindcss.com/docs/responsive-design): *"unprefixed utilities take effect on all screen sizes, while prefixed utilities only take effect at the specified breakpoint and above"* | baixo |
| R05 | responsividade | Nenhum contêiner de texto tem altura fixa que impeça o aumento de entrelinha e espaçamento | LOCAL | `h-8`/`h-10`/`h-[40px]` em elemento cujo filho é texto, sem `min-h-*`; `truncate` combinado com `h-*` fixo; `line-clamp-*` em conteúdo essencial | `h-2` numa barra de progresso, ou `h-6 w-6` num ícone — não há texto dentro, o SC 1.4.12 não incide | [SC 1.4.12](https://www.w3.org/TR/WCAG22/#text-spacing), AA — line-height 1.5×, letter-spacing 0.12×, word-spacing 0.16× | médio |
| R06 | responsividade | Na página Histórico, cabeçalho, filtros e paginação refluem a 320px mesmo com o gráfico sob exceção | COMPOSICIONAL | Na página do Recharts: verificar se o wrapper do gráfico impõe `min-w-*` ao **irmão** que contém controles, ou se o `grid` que agrupa gráfico + filtros não tem contraparte de 1 coluna | O `<ResponsiveContainer>` e a `<table>` de dados podem exigir rolagem horizontal — a exceção 2D os cobre. O que a exceção **não** cobre é a barra de filtros ao lado | [SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), AA: *"sections of content within the two-dimensional layout… would still need to meet this success criterion"* | baixo |

### Eixo MODO ESCURO

> **Leitura de arquitetura, antes das regras.** Nenhum critério de sucesso da WCAG 2.2 exige modo escuro. O que existe é (i) um sinal de preferência do usuário, `prefers-color-scheme`, definido em CSS Media Queries Level 5 — **W3C Working Draft de 19/02/2026**, não Recommendation (F7); e (ii) a propriedade `color-scheme`, definida em CSS Color Adjustment Module Level 1 — **W3C Candidate Recommendation Snapshot de 16/12/2025** (F6), que é o que informa ao navegador quais esquemas a página suporta para que **controles nativos de formulário, a cor da tela do canvas e as barras de rolagem do viewport** acompanhem: *"On the root element, the used color scheme additionally must affect the surface color of the canvas, and the viewport's scrollbars."*
>
> **O pré-requisito estrutural é a camada de tokens semânticos**, e a fonte é a documentação do próprio ferramental: em Tailwind v4, `@theme` é o que emite `--color-*` como custom properties em `:root`, e `@custom-variant dark (…)` é o que redefine o gatilho da variante `dark:` (F10, F11). Sem essa camada, cada uma das 40 classes de cor literais espalhadas nos ≈25 arquivos precisaria ganhar um par `dark:` escrito à mão — o número de decisões de cor dobra para 80, distribuídas por todos os arquivos, sem ponto único de verificação e sem como validar contraste por token.
>
> **Conclusão honesta:** introduzir modo escuro antes da camada de tokens produz dívida maior que o benefício. O caminho correto é `@theme` primeiro (custo alto, mas pago uma vez, no CSS de entrada mais os consumidores), `dark:` depois. E o benefício real aqui é modesto — um operador, uma máquina —, o que faz do modo escuro o **último** item de qualquer fila. As regras D01–D07 abaixo são, portanto, majoritariamente condicionais: só disparam **se** a variante `dark:` for introduzida.

| ID | EIXO | PREDICADO | BALDE | SINAL NO CÓDIGO | CONTRAEXEMPLO | FONTE | CUSTO |
|---|---|---|---|---|---|---|---|
| D01 | modo escuro | Não existe ocorrência de `dark:` em arquivo `.tsx` enquanto o CSS de entrada não declarar um bloco `@theme` com tokens semânticos | COMPOSICIONAL | `dark:` em qualquer `.tsx` **e** CSS de entrada contendo apenas `@import "tailwindcss";` (estado medido: 1 linha, 0 blocos `@theme`, 0 ocorrências de `dark:`) | Um `dark:` isolado num componente de sandbox que não é montado por nenhuma das 7 páginas — não entra na superfície de manutenção | [Tailwind v4 — Theme variables](https://tailwindcss.com/docs/theme) + [Dark mode](https://tailwindcss.com/docs/dark-mode) | alto |
| D02 | modo escuro | O elemento raiz declara `color-scheme` | LOCAL | Ausência simultânea de: utilitário `scheme-light` / `scheme-dark` / `scheme-light-dark` no `<html>`/`<body>` **e** de `color-scheme:` no CSS de entrada. Estado medido: 0 ocorrências | `:root { color-scheme: light; }` escrito em CSS puro no arquivo de entrada — cumpre a especificação sem usar o utilitário do Tailwind | [CSS Color Adjust L1](https://www.w3.org/TR/css-color-adjust-1/) §`color-scheme` (CR Snapshot 16/12/2025) + [Tailwind `color-scheme`](https://tailwindcss.com/docs/color-scheme) (`scheme-normal\|light\|dark\|light-dark\|only-dark\|only-light`) | baixo |
| D03 | modo escuro | Todo elemento que declara variante `dark:` para uma das propriedades de um par cor-de-texto/cor-de-fundo declara também para a outra | LOCAL | `dark:bg-*` presente e `dark:text-*` ausente (ou o inverso) num elemento que define ambos na base | Elemento que define só `bg-*` e herda `color` do ancestral, cujo ancestral já tem o par `dark:` completo — o par existe, apenas não neste nó | [SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum), AA — aplicado ao esquema efetivamente renderizado | alto |
| D04 | modo escuro | Se houver alternância manual de tema, o CSS de entrada declara `@custom-variant dark` | LOCAL | `document.documentElement.classList.add("dark")`, `setAttribute("data-theme", "dark")` ou `<html className="dark">`, sem `@custom-variant dark (…)` no CSS | Uso apenas da media query padrão, sem alternância: em v4 a variante `dark:` já resolve para `@media (prefers-color-scheme: dark)` sem nenhuma declaração | [Tailwind v4 — Dark mode](https://tailwindcss.com/docs/dark-mode): `@custom-variant dark (&:where(.dark, .dark *));` ou `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` | baixo |
| D05 | modo escuro | Todo token de tema cujo **valor** muda entre esquemas é declarado de forma que o override na raiz alternada tenha efeito | LOCAL | `@theme { --color-surface: … }` combinado com `.dark { --color-surface: … }` sem `inline` — a variante lê a variável de tema, não o override | Tokens que **não** mudam por esquema (`--radius-*`, `--spacing`, `--text-*`) declarados em `@theme` normal — não há override a resolver | [Tailwind v4 — Theme variables](https://tailwindcss.com/docs/theme): *"Using the `inline` option, the utility class will use the theme variable value instead of referencing the actual theme variable"* | médio |
| D06 | modo escuro | Nenhum passo de paleta é reaproveitado entre os dois esquemas sem par próprio | LOCAL | `text-red-600 dark:text-red-600`, `text-gray-400` sem contraparte `dark:`, ou qualquer `dark:text-*-600`/`dark:text-*-700` sobre fundo escuro | `text-red-600 dark:text-red-400` — passo trocado, que é exatamente o comportamento correto. Evidência calculada em §3.2: `gray-400` sobre branco = **2.60** (reprova) e sobre `gray-900` = **6.82** (aprova) | [SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) (AA) + valores de `theme.css` 4.3.3 (F15), cálculo em §3.2 | médio |
| D07 | modo escuro | Toda separação de camada feita por `shadow-*` tem contraparte de borda ou de fundo no esquema escuro | LOCAL | `shadow-sm` / `shadow-md` / `shadow-lg` como único separador visual, sem `dark:border-*` nem `dark:bg-*` distinto do fundo da página | `shadow-*` decorativo num card que já tem `border` com contraste ≥ 3:1 em ambos os esquemas — a separação não depende da sombra | [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), AA (limites de componente quando necessários para identificá-lo) | médio |

### Distribuição declarada

| Eixo | Regras | IDs |
|---|---|---|
| Acessibilidade | **17** | A01–A17 |
| Consistência | **10** | C01–C10 |
| Responsividade | **6** | R01–R06 |
| Modo escuro | **7** | D01–D07 |
| **Total** | **40** | dentro da faixa 30–45 |

Por balde: **LOCAL 23** · **COMPOSICIONAL 12** · **DE EXECUÇÃO 5** (dos quais A01, A02 e R01 viram estáticos pela cadeia de §3.2; A15 e A17 viram parcialmente estáticos).
Por custo: **baixo 17** · **médio 17** · **alto 6**.

---

## TABELA SEPARADA — PRÁTICA NÃO NORMATIVA

Nada aqui foi promovido ao corpus principal. Fonte de nível 4 a 6, explicitada em cada linha.

| ID | EIXO | PREDICADO | BALDE | SINAL NO CÓDIGO | CONTRAEXEMPLO | FONTE (nível) | CUSTO |
|---|---|---|---|---|---|---|---|
| N01 | consistência | A paleta usada é um conjunto fechado e nomeado, não uma seleção livre do espectro | COMPOSICIONAL | Contagem de famílias/passos distintos em uso (medido: 40 classes) contra a lista de tokens declarados | Uma cor fora do conjunto usada uma única vez, num gráfico, para uma série adicional documentada | [USWDS — Design tokens](https://designsystem.digital.gov/design-tokens/) (**nível 4**): *"the discrete palettes of values from which we base all our visual design"*; analogia dos presets de rádio | alto |
| N02 | acessibilidade | O indicador de foco é autoral e de alto contraste, não o anel padrão do navegador | LOCAL | Ausência de `focus-visible:ring-*`/`focus-visible:outline-*` em qualquer controle, deixando o `outline` do UA como único indicador | Anel padrão do Chrome no Windows já satisfaz SC 2.4.7 (AA); trocá-lo é melhoria de qualidade, **não conformidade** | [GOV.UK Design System — Focus states](https://design-system.service.gov.uk/get-started/focus-states/) (**nível 4**): combinação amarelo + preto com borda inferior espessa, justificada em SC 1.4.11 | médio |
| N03 | consistência | O espaçamento vem de um subconjunto de presets, não da escala completa | COMPOSICIONAL | Contagem de degraus de `p-*`/`m-*`/`gap-*` distintos em uso; acima de ~8 degraus, a escala virou espectro | Página Histórico com um degrau extra por causa da altura do gráfico | [USWDS — Design tokens](https://designsystem.digital.gov/design-tokens/) (**nível 4**) | médio |
| N04 | consistência | Tokens gravados em arquivo no formato DTCG (`$value`, `$type`) | — | Ausência de `tokens.json` | — | [Design Tokens Format Module 2025.10](https://www.designtokens.org/TR/drafts/format/) (**nível 5** — *Draft Community Group Report*, "not a W3C Standard nor is it on the W3C Standards Track", "do not implement anything in this document"). **Recomendação: não adotar aqui** — `@theme` (F11) já resolve, e adotar o formato traria tooling de transformação sem consumidor | alto |
| N05 | acessibilidade | Contraste avaliado por APCA com alvo `Lc ≥ 60` | — | Qualquer referência a `Lc` ou APCA no repositório ou em revisão | — | Exploratório, **removido do WD da WCAG 3 em jul/2023**; o [WD atual de 03/03/2026](https://www.w3.org/TR/wcag-3.0/) não menciona APCA e traz marcadores de posição para contraste (**nível 5/6**). **PROIBIDO como critério de aprovação ou reprovação** | — |
| N06 | responsividade | Blocos de texto corrido têm medida de linha limitada (~45–90 caracteres) | LOCAL | Parágrafos sem `max-w-*`/`max-w-[…ch]` dentro de contêiner largo | Célula de tabela e rótulo de formulário — não são texto corrido | [USWDS — measure tokens](https://designsystem.digital.gov/design-tokens/) (**nível 4**): sete tokens de medida, de `44ex` a `88ex` | baixo |
| N07 | responsividade | O aplicativo usa um conjunto declarado e fechado de breakpoints (hoje `sm` e `lg`) | COMPOSICIONAL | Aparecimento de `md:`, `xl:` ou `2xl:` (hoje: 0 ocorrências) sem justificativa registrada | Um `xl:` introduzido na página Histórico para o gráfico, com o motivo registrado no PR | **Sem fonte** — convenção interna derivada da contagem do repositório (9 `sm:`, 8 `lg:`). Registrada aqui exatamente por não ter respaldo normativo | baixo |
| N08 | acessibilidade | Gráficos são um único ponto de tabulação, com navegação por setas entre pontos de dados | LOCAL | Data points individuais com `tabIndex={0}` | Recharts 3.10.1 já entrega isso via `accessibilityLayer` padrão | [Recharts wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility) (**nível 3/4**): *"It should not use the TAB key… This practice of tabbing to a container, and arrowing between items in the container, is very common"* | baixo |

---

## 5. AUTOVERIFICAÇÃO

**1 — Substância, e quantas cortei.** Percorri as 40 linhas. Cada uma tem sinal sintático deste stack (nome de utilitário Tailwind v4 conferido em `theme.css` da 4.3.3, atributo JSX, prop do Recharts 3.x, diretiva CSS da v4) e fonte aberta nesta sessão. **Cortei 7 regras** por serem paráfrase de design que serviria a qualquer site:

1. "Largura máxima e padding do contêiner de página idênticos entre telas" — sem âncora normativa; sobrevive parcialmente em N06.
2. "Usar no máximo dois breakpoints" — sem fonte de qualquer nível; rebaixada para N07 com a ausência de fonte declarada.
3. "Hierarquia tipográfica harmônica entre páginas" — predicado não mensurável ("harmônica"); **reescrita** como C08, com predicado contável (um `h1`, sem salto de nível) e âncora em SC 1.3.1.
4. "Paleta com no máximo N cores" — o número seria arbitrário; cortada, e o que sobrou virou N01, que fala de conjunto fechado sem fixar N.
5. "Contraste APCA `Lc ≥ 60`" — não normativo; cortada e convertida em **proibição** (N05).
6. "Suportar modo escuro" como item de checklist — não há SC que exija; convertida na leitura de arquitetura + D01–D07 condicionais.
7. "Otimizar alvos para toque (44×44)" — SC 2.5.5 é AAA e o ponteiro alvo é mouse; cortada na Fase 2, com o piso AA de 24×24 mantido em A05.

**2 — Contraexemplos.** Todas as 23 regras LOCAL e todas as 12 COMPOSICIONAL têm contraexemplo. As 5 de EXECUÇÃO também receberam, ainda que não fosse obrigatório.

**3 — A Fase 2 corta de verdade.** Nove famílias inteiras foram excluídas com fonte: breakpoints de telefone como meta de design, alvos de toque de 44px, desempenho móvel, i18n/RTL, conformidade legal de site público, SC 1.2.x, os AAA de contraste e de foco, o formato DTCG e o APCA. E a exclusão foi assimétrica de propósito: **nenhum critério de nível A ou AA de acessibilidade foi dispensado**, porque o beneficiário é o operador, não o público.

**4 — Nada escrito de memória.** Todo número de SC, nome de propriedade CSS, nome de variante Tailwind, valor de paleta e prop de biblioteca foi lido na fonte hoje. Os valores `oklch()` vieram do `theme.css` baixado, e a conversão foi validada contra os hexadecimais publicados antes de qualquer razão ser calculada. Status de rascunho está marcado onde existe: WCAG 3.0 (WD), Media Queries L5 (WD), CSS Color 5 (WD), CSS Color 4 (CR Draft), CSS Color Adjust 1 (CR Snapshot), DTCG (Draft CG Report).

**5 — A regra mais frágil do corpus: C09.**
É a única cujo **limiar eu inventei**. "6 ou mais utilitários repetidos em 3 ou mais arquivos" não sai de fonte nenhuma — a documentação do Tailwind (F12) fornece o **mecanismo** (`@utility`, `@layer components`), não a **obrigação** nem o ponto de corte. Um limiar diferente muda o conjunto de achados, e em ambas as direções o erro é real: baixo demais, o agente vira gerador de refatoração inútil e o operador o desliga; alto demais, ela nunca dispara e ocupa espaço à toa. Além disso, seu contraexemplo — coincidência acidental entre papéis semânticos distintos — é o caso mais difícil de julgar por leitura, o que a torna a regra com maior chance de falso positivo do corpus.
Vice-líder em fragilidade: **A10**, porque a obrigação de honrar `prefers-reduced-motion` só existe em SC 2.3.3, que é **AAA** — o que a Fase 2 declarou dispensável —, e porque a media feature vive numa especificação em estado de Working Draft. Mantive-a porque o sinal sintático é limpo e o custo é baixo, mas ela é recomendação, não requisito, e o agente deve dizê-lo ao reportar.
