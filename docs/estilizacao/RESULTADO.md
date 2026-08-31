Inventário completo. Emitindo a revisão.

---

# REVISÃO DE ESTILIZAÇÃO — CronosComex (casca + 7 páginas)

Corpus: `docs/estilizacao/corpus-estilo.md`
Conjunto lido: casca (`App.tsx`, `index.css`, `router.ts`, 5 componentes de casca) + 7 páginas + 10 componentes filhos + `index.html` + `node_modules/tailwindcss/theme.css` + `node_modules/recharts/` (3.10.1, verificado no código instalado). **Conjunto completo — nenhum arquivo faltando.**

---

## PASSO ZERO

**Z1: URIs distintas** — evidência: `web/src/router.ts:30-37` (`NAV_PAGES` com `path: '/'`, `/operacional`, `/clientes`, `/performance`, `/alertas`, `/historico`) e `:40-45` (`PROCESS_DETAIL_PAGE.path = '/processo'`). Roteamento próprio sobre History API (`pushState`/`popstate`, `router.ts:82-104`), não `react-router`. As sete telas têm URIs distintas.
→ **Há "set of web pages": SC 3.2.3 e SC 3.2.4 incidem. C04, C05, C06 e C10 ficam ATIVAS como normativas.**

**Z2: 0 blocos `@theme`, 0 `@custom-variant`, `color-scheme` ausente** — `web/src/index.css` tem **uma linha**: `@import "tailwindcss";`.
→ **C01 e D01 incidem por construção; todas as regras de cor herdam custo alto.** (D01 tem desfecho próprio abaixo — o predicado dele exige `dark:` presente, e há 0.)

---

## PASSO 4 — VALIDAÇÃO DA CADEIA DE CONTRASTE (§4.8)

Conversão oklch→sRGB implementada por CSS Color 4 §10.10/§10.11 com clipping, sobre os valores lidos de `node_modules/tailwindcss/theme.css` (bloco `@theme default`, 19.586 bytes).

```
red-500   oklch(63.7% 0.237 25.331)  → (251, 44, 54)  #fb2c36   ✓ confere
blue-600  oklch(54.6% 0.245 262.881) → (21, 93, 252)  #155dfc   ✓ confere
```
Cadeia validada. Razões abaixo são emitidas com a conta à mostra.

---

# ACHADOS

## ONDA 1 — CAMADA DE TEMA

```
ACHADO 1
REGRA:    C01 — Não existe utilitário de passo de paleta bruta em .tsx; toda cor
          referencia um token semântico declarado em @theme.
ARQUIVO:  web/src/index.css:1 (ausência da camada) — composicional, 24 arquivos consumidores.
          Padrão majoritário: NÃO HÁ padrão — 100% das cores são passo bruto.
          Desviante: o conjunto inteiro. Medido: 40 classes de cor distintas, 0 tokens.
          Concentração: text-slate-600 (42×), border-slate-200 (36×), text-slate-500 (34×),
          border-slate-300 (31×), text-slate-700 (30×), text-amber-900 (16×), text-red-900 (15×).
          Arquivos: App.tsx · components/{AlertRow,ApplyChangesButton,ArrivalCalendar,
          ColorFieldsForm,ConflictDialog,EditProcessForm,FilterBar,IngestionHealth,MultiSelect,
          PendingEditsPanel,ProcessTable,RankingBar,RefreshButton,StatCard,StatusBanner}.tsx ·
          pages/{Alerts,Clients,History,Home,Operational,Performance,Placeholders,ProcessDetail}.tsx
TRECHO:   @import "tailwindcss";
BALDE:    COMPOSICIONAL
FONTE:    Tailwind v4 — Theme variables — https://tailwindcss.com/docs/theme
CORREÇÃO: Declarar em index.css um bloco @theme com --color-surface-{base,raised,sunken},
          --color-text-{primary,secondary,muted}, --color-border-{subtle,strong,control} e
          --color-state-{error,warning,info,accent}-{bg,border,fg}.
```

```
ACHADO 2
REGRA:    D02 — O elemento raiz declara color-scheme.
ARQUIVO:  web/src/index.css:1 (ausente) · web/index.html:2 (<html lang="pt-BR"> sem
          utilitário scheme-*) · web/src/App.tsx:55 (raiz React, sem scheme-*)
TRECHO:   @import "tailwindcss";
BALDE:    LOCAL
FONTE:    CSS Color Adjustment Module Level 1, §color-scheme (CR Snapshot 16/12/2025) —
          https://www.w3.org/TR/css-color-adjust-1/
CORREÇÃO: Acrescentar `:root { color-scheme: light; }` em index.css (ou `scheme-light` no
          <html> de index.html) — sem isso, barras de rolagem e controles nativos de
          formulário (os 4 <input type="date"> e 3 <select> do conjunto) não recebem o
          esquema declarado.
```

---

## ONDA 2 — SUBSTITUIÇÃO DAS CORES LITERAIS E CONTRASTE

```
ACHADO 3
REGRA:    A01 — Não existe par texto/fundo resolvido com razão < 4.5:1 (texto normal).
ARQUIVO:  web/src/components/AlertRow.tsx:53 · web/src/components/MultiSelect.tsx:124 ·
          web/src/pages/ProcessDetail.tsx:298
TRECHO:   <span className="text-xs text-slate-400">linha {group.sourceRow}</span>
          <span className="shrink-0 text-xs text-slate-400">{option.count}</span>
          <dd className={`text-sm ... ${value === '' ? 'text-slate-400' : ''}`}>
BALDE:    DE EXECUÇÃO → estático (§3.2)
FONTE:    WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA) —
          https://www.w3.org/TR/WCAG22/#contrast-minimum
CORREÇÃO: Trocar text-slate-400 por text-slate-500 (4.76:1) nas três ocorrências.

  CONTA:  fg text-slate-400  oklch(70.4% 0.04 256.788)  → #90a1b9
          bg bg-white (ancestral: seção do cartão em bg-white — AlertRow herda de
             Alerts.tsx:79; MultiSelect do painel em MultiSelect.tsx:93; ProcessDetail
             das seções em ProcessDetail.tsx:141/163/194)      → #ffffff
          razão = 2.63 : 1     piso aplicado 4.5:1 (text-xs = 0.75rem = 12px;
                               text-sm = 0.875rem = 14px — texto normal)   FALHA
```

```
ACHADO 4
REGRA:    A01 — Não existe par texto/fundo resolvido com razão < 3:1 (texto grande).
ARQUIVO:  web/src/components/StatCard.tsx:43 · web/src/pages/Alerts.tsx:145
TRECHO:   <p className="mt-1 text-3xl font-semibold text-slate-300">—</p>
          <p className="mt-1 text-2xl font-semibold text-slate-300" title="...">—</p>
BALDE:    DE EXECUÇÃO → estático (§3.2)
FONTE:    WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA) —
          https://www.w3.org/TR/WCAG22/#contrast-minimum
CORREÇÃO: Trocar text-slate-300 por text-slate-500 (4.76:1) — o traço distingue
          "sem leitura" de "zero medido" e é justamente o que precisa ser legível.

  CONTA:  fg text-slate-300  oklch(86.9% 0.022 252.894) → #cad5e2
          bg bg-white (StatCard variante volume, StatCard.tsx:21; article em Alerts.tsx:138)
                                                        → #ffffff
          razão = 1.49 : 1
          piso aplicado 3:1 — text-3xl = 1.875rem = 30px e text-2xl = 1.5rem = 24px,
          ambos ≥ 24px, logo texto grande (valores de --text-3xl/--text-2xl lidos em
          theme.css)                                                          FALHA
```

```
ACHADO 5
REGRA:    A01 — Não existe par texto/fundo resolvido com razão < 4.5:1.
ARQUIVO:  web/src/pages/Operational.tsx:123 · web/src/pages/Operational.tsx:134
TRECHO:   <p className="text-xs text-slate-500">{total} {total === 1 ? 'processo' : 'processos'}</p>
          <span className="text-xs text-slate-500 tabular-nums">{first}–{last} de {total}</span>
BALDE:    DE EXECUÇÃO → estático (§3.2)
FONTE:    WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA) —
          https://www.w3.org/TR/WCAG22/#contrast-minimum
CORREÇÃO: Trocar text-slate-500 por text-slate-600 (7.56:1) nas duas ocorrências, ou
          envolver a paginação num contêiner bg-white como os demais blocos da página.

  CONTA:  fg text-slate-500  oklch(55.4% 0.046 257.417) → #62748e
          bg RESOLVIDO POR ANCESTRAL, e declaro que resolvi: nem <nav>/<p>, nem
             div.flex.flex-col.gap-3, nem div.grid, nem <main className="px-6 py-6">
             (App.tsx:93) declaram bg-*; o primeiro ancestral com fundo é a casca,
             App.tsx:55 `bg-slate-100`  oklch(96.8% 0.007 247.896) → #f1f5f9
          razão = 4.35 : 1     piso 4.5:1 (text-xs = 12px, normal)             FALHA
  NOTA:   o mesmo utilitário APROVA sobre bg-white (4.76) e sobre bg-slate-50 (4.55) —
          é o par resolvido que reprova, não o utilitário. As outras 32 ocorrências de
          text-slate-500 do conjunto caem dentro de cartões bg-white e passam.
```

```
ACHADO 6
REGRA:    A02 — Toda borda que identifica um componente tem razão ≥ 3:1 contra a cor adjacente.
ARQUIVO:  web/src/components/FilterBar.tsx:88, :98, :112 · web/src/pages/Operational.tsx:92,
          :142, :150 · web/src/components/EditProcessForm.tsx:93, :110 ·
          web/src/components/ColorFieldsForm.tsx:141 · web/src/components/MultiSelect.tsx:81, :102 ·
          web/src/components/RefreshButton.tsx:17 · web/src/pages/History.tsx:156
TRECHO:   className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 ..."
BALDE:    DE EXECUÇÃO → estático (§3.2)
FONTE:    WCAG 2.2 SC 1.4.11 Non-text Contrast (AA) —
          https://www.w3.org/TR/WCAG22/#non-text-contrast
CORREÇÃO: Trocar border-slate-300 por border-slate-500 (4.76:1 sobre branco) nos 13
          controles — é a borda que informa onde o campo começa e termina.

  CONTA:  border-slate-300  oklch(86.9% 0.022 252.894) → #cad5e2
          adjacente interna  bg-white              #ffffff  → razão 1.49 : 1   FALHA
          adjacente externa  bg-slate-50 (FilterBar.tsx:43)  #f8fafc → 1.42 : 1   FALHA
          adjacente externa  bg-slate-100 (casca, Operational.tsx:142/150) #f1f5f9
                                                            → razão 1.36 : 1   FALHA
          piso aplicado 3:1
  FORA:   estados desabilitados (disabled:opacity-40/60, disabled:bg-slate-300) NÃO entram —
          SC 1.4.3 e SC 1.4.11 isentam componente de interface inativo.
```

```
ACHADO 7
REGRA:    A02 — Todo ícone/objeto gráfico que identifica informação tem razão ≥ 3:1
          contra a cor adjacente.
ARQUIVO:  web/src/components/RankingBar.tsx:93-95 (montado em web/src/pages/Clients.tsx:107
          e web/src/pages/Performance.tsx:100 e :108 — 5 rankings nas duas páginas)
TRECHO:   <span className="h-4 grow rounded-sm bg-slate-100">
            <span className="block h-full rounded-sm bg-slate-400 group-hover:bg-slate-600"
BALDE:    DE EXECUÇÃO → estático (§3.2)
FONTE:    WCAG 2.2 SC 1.4.11 Non-text Contrast (AA), item "Graphical Objects" —
          https://www.w3.org/TR/WCAG22/#non-text-contrast
CORREÇÃO: Trocar o preenchimento bg-slate-400 por bg-slate-600 (6.90:1 contra o trilho).

  CONTA:  preenchimento bg-slate-400  oklch(70.4% 0.04 256.788)  → #90a1b9
          trilho        bg-slate-100  oklch(96.8% 0.007 247.896) → #f1f5f9
          razão = 2.40 : 1     piso 3:1                                        FALHA
  NOTA:   a barra é o único canal visual da proporção do ranking (a contagem numérica ao
          lado, RankingBar.tsx:99, carrega o valor — mas não a comparação entre linhas,
          que é o que a barra codifica).
```

```
ACHADO 8
REGRA:    C02 — Não existe valor arbitrário de cor.
ARQUIVO:  web/src/pages/History.tsx:46-48 · :179 · :183 · :185 · :189 · :191
TRECHO:   { key: 'total', label: 'Volume', color: '#4f46e5' },
          <CartesianGrid stroke="#e2e8f0" ... />
          <XAxis ... tick={{ fill: '#64748b', fontSize: 12 }} stroke="#cbd5e1" />
BALDE:    LOCAL
FONTE:    Tailwind v4 — Adding custom styles —
          https://tailwindcss.com/docs/adding-custom-styles
CORREÇÃO: Substituir os seis literais por leitura dos tokens da onda 1
          (`var(--color-chart-series-1)` etc.), declarados em @theme.
  PROVA DE DERIVA (mede por que o literal é o defeito, não só o estilo):
          #cbd5e1 é slate-300 da v3; slate-300 da 4.3.3 é oklch(86.9% 0.022 252.894) = #cad5e2.
          #64748b é slate-500 da v3; slate-500 da 4.3.3 é oklch(55.4% 0.046 257.417) = #62748e.
          #e2e8f0 coincide com slate-200 da 4.3.3. Dois de três literais já divergem da
          paleta que o resto do conjunto usa.
  CONTRASTE DOS LITERAIS (estáticos, sem alfa e sem gradiente — computáveis):
          #64748b / #ffffff = 4.76  (rótulos de eixo, texto)              passa 4.5:1
          #4f46e5 / #ffffff = 6.29  (série Volume)                        passa 3:1
          #0d9488 / #ffffff = 3.74  (série Desembaraçados)                passa 3:1
          #dc2626 / #ffffff = 4.83  (série Canal Vermelho)                passa 3:1
          #cbd5e1 / #ffffff = 1.48  (linha de eixo) e #e2e8f0 / #ffffff = 1.23 (grade)
          ficam abaixo de 3:1, mas NÃO são achado de A02: os valores são lidos nos
          rótulos (4.76) e a tabela irmã (History.tsx:212-240) carrega todos os números —
          a linha de eixo não é "parte do gráfico exigida para entender o conteúdo".
```

```
ACHADO 9
REGRA:    C10 — Um mesmo nível de severidade usa sempre o mesmo par de utilitários de cor.
ARQUIVO:  PADRÃO MAJORITÁRIO — severidade "erro" = `border-red-300 bg-red-50 text-red-900`
          (11 locais): App.tsx:87 · Home.tsx:61 · Operational.tsx:43 · Clients.tsx:72 ·
          Performance.tsx:56 · Alerts.tsx:35 · History.tsx:62 · ProcessDetail.tsx:49 ·
          EditProcessForm.tsx:126 · ColorFieldsForm.tsx:174 · StatusBanner.tsx:77
          DESVIANTES (3): ConflictDialog.tsx:97 (`border-red-400`) ·
          IngestionHealth.tsx:54 (sem borda) · FilterBar.tsx:63 e
          IngestionHealth.tsx:87 (`text-red-800` solto, sem contêiner)
TRECHO:   className="mt-3 rounded border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-900"
          className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-900"
          <p role="alert" className="mb-2 text-sm text-red-800">
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 3.2.4 Consistent Identification (AA) —
          https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
          (incide: Z1 = URIs distintas) + SC 1.4.3 —
          https://www.w3.org/TR/WCAG22/#contrast-minimum
CORREÇÃO: Unificar os 3 desviantes no token --color-state-error-* da onda 1.
  NOTA DE CONTRASTE (nenhum dos pares reprova — a divergência é de identificação, não de
  legibilidade): text-red-900 #82181a / bg-red-50 #fef2f2 = 9.16 ; text-red-800 #9f0712 /
  bg-white #ffffff = 8.36 ; text-red-800 #9f0712 / bg-slate-50 #f8fafc = 8.10.
```

```
ACHADO 10
REGRA:    C10 — Um mesmo nível de severidade usa sempre o mesmo par de utilitários de cor.
ARQUIVO:  PADRÃO MAJORITÁRIO — severidade "aviso" = `border-amber-300 bg-amber-50` +
          `text-amber-900` (7 locais): StatusBanner.tsx:78 · StatCard.tsx:22 e :27 ·
          Clients.tsx:135 · History.tsx:288 · ConflictDialog.tsx:87 ·
          PendingEditsPanel.tsx:75 · ProcessDetail.tsx:225
          DESVIANTES (4): AlertRow.tsx:78 (`bg-amber-100`) · ProcessTable.tsx:92
          (`bg-amber-200`) · Performance.tsx:221 (`text-amber-800`) ·
          ConflictDialog.tsx:137 (`text-amber-800`)
TRECHO:   urgent ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
          <span className="ml-1 rounded bg-amber-200 px-1 text-xs text-amber-900">
          <span className={overdue > 0 ? 'font-semibold text-amber-800' : 'text-slate-500'}>
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 3.2.4 Consistent Identification (AA) —
          https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
CORREÇÃO: Unificar os 4 desviantes no token --color-state-warning-* da onda 1.
  NOTA DE CONTRASTE (nenhum reprova): text-amber-900 #7b3306 / bg-amber-50 #fffbeb = 8.73 ;
  / bg-amber-100 #fef3c6 = 8.13 ; / bg-amber-200 #fee685 = 7.28 ;
  text-amber-800 #973c00 / bg-white #ffffff = 7.09.
```

---

## ONDA 3 — CORREÇÕES LOCAIS INDEPENDENTES DE TEMA

```
ACHADO 11
REGRA:    A06 — Todo role="alert"/role="status" está montado no DOM antes de receber a mensagem.
ARQUIVO:  role="alert" (13): App.tsx:86 · FilterBar.tsx:63 · IngestionHealth.tsx:54 ·
          EditProcessForm.tsx:125 · ColorFieldsForm.tsx:119 e :173 · StatusBanner.tsx:93 ·
          Home.tsx:61 e :114 · Operational.tsx:42 · Clients.tsx:72 · Performance.tsx:56 ·
          Alerts.tsx:35 · History.tsx:62 · ProcessDetail.tsx:49
          role="status" (10): App.tsx:117 · ApplyChangesButton.tsx:89 · Home.tsx:73 ·
          Operational.tsx:34 · Clients.tsx:81 · Performance.tsx:65 · Alerts.tsx:48 ·
          History.tsx:71 e :287 · ProcessDetail.tsx:74
TRECHO:   {healthError && (<p role="alert" className="...">...)}
          {state.status === 'semLeitura' && (<p role="status" ...>)}
          if (state.status === 'erro') { return (<p role="alert" ...>) }
BALDE:    LOCAL
FONTE:    WCAG 2.2 SC 4.1.3 Status Messages (AA) —
          https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
          + MDN role="alert": "Do not try to dynamically add/generate an element with
          role='alert' that is already populated" —
          https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
CORREÇÃO: Montar a região vazia sempre e escrever a string dentro — trocar
          `{erro && <p role="alert">{erro}</p>}` por `<p role="alert">{erro ?? ''}</p>`;
          nas páginas que fazem `return` antecipado (Home:59, Operational:40, Clients:70,
          Performance:54, Alerts:33, History:60, ProcessDetail:47), extrair a região para
          a casca ou para um contêiner que sobrevive à troca de estado.
  NOTA:   é uma causa raiz só, em 23 pontos — um achado, lista de locais, conforme a regra
          de emissão. Home.tsx:114 é a variante do mesmo defeito: o <p> existe, mas o
          `role: 'alert'` é acrescentado por spread condicional ao nó já populado.
```

```
ACHADO 12
REGRA:    A12 — Nenhum gráfico do Recharts desliga accessibilityLayer, e todo gráfico tem
          nome acessível.
ARQUIVO:  web/src/pages/History.tsx:176-210
TRECHO:   <div aria-hidden="true" className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
BALDE:    LOCAL
FONTE:    Recharts — wiki oficial de acessibilidade —
          https://github.com/recharts/recharts/wiki/Recharts-and-accessibility
          + WAI-ARIA 1.2, aria-hidden — https://www.w3.org/TR/wai-aria-1.2/
CORREÇÃO: Passar `accessibilityLayer={false}` ao <LineChart> — o gráfico já é
          deliberadamente aria-hidden e a tabela irmã (History.tsx:212-240) carrega os
          mesmos números; desligar a camada remove a parada de tabulação órfã.
  PROVA (lida no código instalado, não de memória):
          node_modules/recharts/types/chart/CartesianChart.d.ts:7 → `readonly
          accessibilityLayer: true` (LineChart é CartesianChart, logo o padrão é true).
          node_modules/recharts/es6/container/RootSurface.js:45 e :50 →
            tabIndex = hasAccessibilityLayer ? 0 : undefined
            role     = hasAccessibilityLayer ? 'application' : undefined
          Resultado: o <svg> raiz recebe tabIndex={0} e role="application" DENTRO de um
          subárvore aria-hidden="true". O operador tabula para um elemento que a árvore de
          acessibilidade não expõe e que não tem nome acessível.
```

```
ACHADO 13
REGRA:    A17 — Toda informação de estado sobrevive a forced-colors: active.
ARQUIVO:  web/src/pages/History.tsx:150-158 (WindowPicker: 12/24/60 meses)
TRECHO:   className={`rounded border px-3 py-1 text-sm font-medium ${
            option === months ? 'border-slate-800 bg-slate-800 text-white'
                              : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
BALDE:    DE EXECUÇÃO → parcialmente estático
FONTE:    MDN @media (forced-colors) —
          https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
          + CSS Color Adjustment Module Level 1 (CR Snapshot 16/12/2025) —
          https://www.w3.org/TR/css-color-adjust-1/
CORREÇÃO: Acrescentar um canal não-cromático ao estado selecionado — `border-2` no botão
          ativo contra `border` nos demais (o UA substitui a cor da borda, não a
          espessura). O `aria-pressed` já presente (History.tsx:151) resolve o eixo
          programático, não o visual.
  NOTA:   o MultiSelect (MultiSelect.tsx:78-88) usa o mesmo par bg-slate-800/branco para o
          estado selecionado, mas o sobrevive: MultiSelect.tsx:86 troca o caractere "▾" pelo
          número de itens marcados — canal textual. É o contraexemplo de A17 satisfeito e
          é o padrão A PRESERVAR.
  Comportamento de `border-transparent` na navegação por abas (App.tsx:143-147) sob
  forced-colors NÃO foi determinado estaticamente — vai para [VN-5].
```

```
ACHADO 14
REGRA:    [NÃO NORMATIVO] N02 — O indicador de foco é autoral e de alto contraste, não o
          anel padrão do navegador.
ARQUIVO:  Conjunto inteiro — 0 ocorrências de `focus-visible:ring-*`, `focus-visible:outline-*`,
          `focus:ring-*` ou `focus:outline-*` nos 25 arquivos. Controles afetados, entre
          outros: App.tsx:131 (6 abas) · RefreshButton.tsx:13 · ApplyChangesButton.tsx:96 ·
          MultiSelect.tsx:73 e :96 · FilterBar.tsx:51, :84, :96, :107 · ProcessTable.tsx:77
          e :143 · AlertRow.tsx:45 · RankingBar.tsx:111 · History.tsx:148 ·
          PendingEditsPanel.tsx:93 e :113 · ConflictDialog.tsx:162
TRECHO:   className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 ..."
BALDE:    LOCAL
FONTE:    GOV.UK Design System — Focus states (nível 4, design system institucional) —
          https://design-system.service.gov.uk/get-started/focus-states/
CORREÇÃO: Nenhuma exigida. **Isto NÃO é reprovação:** A03 está satisfeita (0 `outline-none`
          no conjunto), e o anel padrão do Chrome no Windows atende SC 2.4.7. Se um anel
          autoral for adotado, ele vira obrigação de A03 e passa a exigir substituto em
          todo controle.
```

---

## ONDA 4 — CONSISTÊNCIA COMPOSICIONAL

```
ACHADO 15
REGRA:    C04 — Um mesmo papel de UI usa a mesma combinação rounded-*/border-*/shadow-*
          nas sete páginas.
ARQUIVO:  PAPEL: "seção de conteúdo sobre fundo branco, com título e prosa".
          PADRÃO MAJORITÁRIO (14 locais) — `rounded border border-slate-200 bg-white`:
          ArrivalCalendar.tsx:19 · IngestionHealth.tsx:29 · RankingBar.tsx:45 ·
          EditProcessForm.tsx:76 · ColorFieldsForm.tsx:105 · ProcessTable.tsx:54 ·
          Alerts.tsx:79 e :138 · Performance.tsx:126 e :171 · History.tsx:144 e :173 ·
          ProcessDetail.tsx:122, :141, :163, :213, :260
          DESVIANTES (4) — `border-slate-300`: History.tsx:119 (EmptyHistory, p-6) ·
          ProcessDetail.tsx:61 (processo não encontrado, p-8) · Placeholders.tsx:33
          (NotFoundPage, p-8) · ProcessTable.tsx:45 (tabela vazia, p-6)
TRECHO:   <section aria-label="Evolução mensal" className="rounded border border-slate-300 bg-white p-6 text-sm">
          <section aria-label="Processo não encontrado" className="rounded border border-slate-300 bg-white p-8">
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 3.2.4 Consistent Identification (AA) —
          https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
          (incide: Z1 = URIs distintas)
CORREÇÃO: Alinhar os 4 desviantes em `border-slate-200` (ou no token
          --color-border-subtle da onda 1) — nenhum dos quatro codifica estado, então o
          contraexemplo de C04 ("a diferença codifica estado e vem com rótulo textual")
          não os cobre.
  NOTA:   os 3 painéis `border-dashed border-slate-300 bg-slate-50` (Alerts.tsx:181,
          Performance.tsx:248, ProcessDetail.tsx:195) são papel DISTINTO — "ressalva/fora
          de escopo" — e são consistentes entre si: não são achado. Placeholders.tsx:19
          usa a mesma tripla com p-8 em vez de p-4, mas C04 fala de raio/borda/sombra,
          não de padding.
```

```
ACHADO 16
REGRA:    C05 — O mesmo controle funcional tem o mesmo nome acessível nas sete páginas.
ARQUIVO:  FUNÇÃO: abrir o detalhe de um processo (navegar para /processo/<REF>).
          PADRÃO (link, coerente com a navegação da casca em App.tsx:131):
          web/src/components/ProcessTable.tsx:77-87 — página Operacional
          DESVIANTE (botão): web/src/components/AlertRow.tsx:45-66 — página Alertas
TRECHO:   <a href={`/processo/${encodeURIComponent(item.ref)}`} onClick={...}
             className="text-slate-800 underline hover:text-slate-950">{item.ref}</a>
          <button type="button" onClick={() => navigate(`/processo/${...}`)}
             title={`Abrir o detalhe de ${group.ref}`} className="flex w-full flex-col ...">
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 3.2.4 Consistent Identification (AA, falha F31) —
          https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
          (incide: Z1 = URIs distintas); role divergente também alcançado por
          SC 4.1.2 Name, Role, Value (A) — https://www.w3.org/TR/WCAG22/#name-role-value
CORREÇÃO: Trocar o <button> de AlertRow.tsx:45 por <a href={`/processo/${ref}`}> com o
          mesmo interceptador de clique de ProcessTable.tsx:79-83, e dar-lhe nome
          acessível explícito com aria-label={`Abrir o processo ${group.ref}`}.
  MEDIDA: nome acessível hoje — ProcessTable: "NBSC260" (conteúdo). AlertRow: conteúdo
          concatenado do bloco inteiro (REF + "linha N" + "ETA2 dd/mm/aaaa" + rótulos dos
          badges + mensagem do alerta mais severo). Mesma ação, dois nomes e dois papéis.
  NÃO É ACHADO: "Enfileirar" em EditProcessForm.tsx:119 e ColorFieldsForm.tsx:157 —
          mesma ação, mesmo nome. "Descartar" (PendingEditsPanel.tsx:99) vs "Esvaziar a
          fila inteira" (:119) — escopos realmente distintos, coberto pelo contraexemplo.
```

```
ACHADO 17
REGRA:    C09 — Nenhuma string de className idêntica com 6+ utilitários aparece em 3+
          arquivos sem extração para @utility ou @layer components.
ARQUIVO:  Três strings, cada uma em 7 arquivos distintos (normalizadas por ordenação de tokens):
          (a) `rounded border border-slate-200 bg-white p-6 text-sm text-slate-500` — papel
              "carregando": App.tsx:118 · Alerts.tsx:57 · Clients.tsx:90 · History.tsx:80 ·
              Operational.tsx:69 · Performance.tsx:74 · ProcessDetail.tsx:83
          (b) `rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900` — papel
              "erro de carga": Alerts.tsx:35 · Clients.tsx:72 · History.tsx:62 · Home.tsx:61 ·
              Operational.tsx:43 · Performance.tsx:56 · ProcessDetail.tsx:49
          (c) `rounded border border-slate-300 bg-white p-4 text-sm` — papel "sem leitura":
              Alerts.tsx:48 · Clients.tsx:81 · History.tsx:71 · Home.tsx:73 ·
              Operational.tsx:34 · Performance.tsx:65 · ProcessDetail.tsx:74
TRECHO:   <p className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
BALDE:    COMPOSICIONAL
FONTE:    Tailwind v4 — Adding custom styles (@utility, @layer components) —
          https://tailwindcss.com/docs/adding-custom-styles
          **Limiar operacional, sem fonte normativa** — o próprio corpus declara C09 a
          regra mais frágil dele (§5), com o ponto de corte inventado.
CORREÇÃO: Extrair três `@utility` em index.css — `panel-loading`, `panel-error`,
          `panel-no-read` — depois da onda 2, para que o corpo delas já saia tokenizado.
  NÃO É O CONTRAEXEMPLO: os três grupos têm papel semântico idêntico dentro de cada grupo
  (as 7 ocorrências de (b) são todas a mensagem de falha de carga da página), então
  extrair não acopla papéis distintos.
```

```
ACHADO 18
REGRA:    A11 — Nenhuma informação é transmitida apenas por cor.
ARQUIVO:  INFORMAÇÃO: o nível de urgência.
          (a) web/src/components/StatCard.tsx:20-28 + web/src/pages/Home.tsx:37-38 — a
              variante 'urgencia' (Atrasados, Documentos pendentes) difere de 'volume'
              apenas por border-amber-300/bg-amber-50/text-amber-900. Nenhum texto,
              ícone ou forma marca a distinção. O comentário em StatCard.tsx:4-7 declara
              que a distinção é critério de aceite (A-40).
          (b) web/src/components/AlertRow.tsx:72-79 — badges "pede ação" (severidade ≤ 3)
              vs "aviso" diferem apenas por bg-amber-100/text-amber-900 contra
              bg-slate-100/text-slate-700; `data-severity` não é exposto ao usuário.
TRECHO:   const VARIANT_STYLE: Record<StatVariant, string> = {
            volume: 'border-slate-200 bg-white', urgencia: 'border-amber-300 bg-amber-50' }
          urgent ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 1.4.1 Use of Color (A) —
          https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
          (o mesmo defeito também cai em A17 sob forced-colors — âncora normativa mais
          forte é 1.4.1, nível A)
CORREÇÃO: (a) passar a prop `hint` já existente do StatCard (StatCard.tsx:17, :49) com o
          texto "exige ação" nos dois cartões de urgência de Home.tsx:37-38;
          (b) prefixar o rótulo do badge urgente com "Ação: " em AlertRow.tsx:81.
  PRESERVAR, NÃO CORRIGIR: o padrão majoritário do conjunto É a conversão do dado
  codificado por cor em rótulo textual, e ele está correto em todas as sete telas —
  ProcessDetail.tsx:24-42 (CATEGORY/CHANNEL/RESPONSIBLE_LABELS), ProcessTable.tsx:28-33 e
  :105-110 ("Canal Vermelho" como texto), ColorFieldsForm.tsx:41-48 (describe()),
  AlertRow.tsx:27-34 (ALERT_LABELS), Performance.tsx:232-241 (a ressalva de que o
  responsável vem da cor da linha). Isto é SC 1.4.1 satisfeito e não deve ser tocado.
```

---

## ONDA 5 — RESPONSIVIDADE E REFLOW

```
ACHADO 19
REGRA:    R01 — Nenhum conteúdo fora de tabela ou gráfico exige rolagem em dois eixos a
          320 CSS px de largura (parte estática). Cobre também R06 na página Histórico.
ARQUIVO:  PADRÃO DE REFERÊNCIA (intenção registrada em comentário, 1 local):
          web/src/components/ProcessTable.tsx:52-55 — <div className="overflow-x-auto ...">
          DESVIANTES (3 tabelas w-full sem contenção de rolagem):
          web/src/pages/History.tsx:212 (tabela de 4 colunas, irmã do gráfico) ·
          web/src/pages/Performance.tsx:178 (4 tabelas, uma por quebra) ·
          web/src/components/ConflictDialog.tsx:105 (tabela de 5 colunas)
TRECHO:   // A tabela e larga; o scroll fica NELA, para a pagina nunca rolar na
          // horizontal e levar o cabecalho junto.
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          — contra —
          <table className="mt-4 w-full text-sm">
BALDE:    COMPOSICIONAL
FONTE:    WCAG 2.2 SC 1.4.10 Reflow (AA) —
          https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
          + SC 1.4.10 aplicado a R06: "sections of content within the two-dimensional
          layout… would still need to meet this success criterion"
CORREÇÃO: Envolver as três tabelas no mesmo `<div className="overflow-x-auto">` de
          ProcessTable.tsx:54 — sem isso, a exceção 2D da tabela deixa de estar contida
          e arrasta as notas irmãs (History.tsx:250, :271, :288, :307) e a barra de
          filtros da casca para a rolagem horizontal.
  "MAJORITÁRIO" AQUI É POR INTENÇÃO, NÃO POR CONTAGEM: 1 local aplica o padrão e 3 não.
  O padrão é nomeado pelo comentário que o documenta em ProcessTable.tsx:52-53.
  A largura resolvida a 320px CSS não é computável estaticamente — ver [VN-1].
  MEDIDA em 31/08/2026 (H-47): a contenção resolve, e a página não rola aqui.
```

```
ACHADO 20
REGRA:    R04 — Todo utilitário de layout com prefixo de breakpoint tem contraparte sem prefixo.
ARQUIVO:  web/src/pages/Clients.tsx:105 · web/src/pages/Performance.tsx:86 e :99 ·
          web/src/pages/Operational.tsx:50 · web/src/pages/ProcessDetail.tsx:143, :166, :201
TRECHO:   <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
BALDE:    LOCAL
FONTE:    Tailwind v4 — Responsive design: "unprefixed utilities take effect on all screen
          sizes, while prefixed utilities only take effect at the specified breakpoint and
          above" — https://tailwindcss.com/docs/responsive-design
CORREÇÃO: Acrescentar `grid-cols-1` sem prefixo nas 7 ocorrências.
  ALCANCE DECLARADO: os 3 `sm:max-w-md`/`sm:max-w-sm` (Operational.tsx:85,
  EditProcessForm.tsx:103, ColorFieldsForm.tsx:133) NÃO entram — não constam da lista de
  sinais de R04, e `max-width: none` é o valor inicial do CSS, mesma forma do
  contraexemplo `lg:sticky`. Os 4 usos com base explícita (FilterBar.tsx:68,
  Alerts.tsx:130, Home.tsx:79, IngestionHealth.tsx:33) já cumprem a regra.
  Estado medido: 17 usos de breakpoint no conjunto — 9 `sm:`, 8 `lg:`, 0 `md:`/`xl:`/`2xl:`.
```

```
ACHADO 21
REGRA:    R03 — Nenhum tamanho de fonte é declarado em unidade absoluta.
ARQUIVO:  web/src/pages/History.tsx:183 · web/src/pages/History.tsx:189
TRECHO:   tick={{ fill: '#64748b', fontSize: 12 }}
BALDE:    LOCAL
FONTE:    WCAG 2.2 SC 1.4.4 Resize Text (AA) — https://www.w3.org/TR/WCAG22/#resize-text
          + React DOM — common components (números na prop de estilo viram px) —
          https://react.dev/reference/react-dom/components/common
CORREÇÃO: Trocar por `fontSize: '0.75rem'` nas duas ocorrências — os rótulos dos eixos
          são o único texto do gráfico e hoje não acompanham a fonte-base do usuário.
  NOTA:   `width={48}` (History.tsx:188) e `margin={{...}}` (:178) são geometria do
          Recharts, não tipografia, e ficam fora de R03.
```

---

## ONDA 6 — MODO ESCURO

**Nenhum achado.** `D03–D07: não aplicáveis — 0 ocorrências de `dark:` no conjunto` (verificado em `web/src/**/*.tsx` e `web/src/index.css`).

> **Superada em 31/08/2026, e a medição acima continua correta.** `D-21` decidiu
> que o modo escuro entra, e com ele a condição que este resultado nomeia passa a
> ser satisfeita: `D03`–`D07` deixam de ser inaplicáveis. Esta auditoria é
> registro datado de 18/08/2026 e não é reescrita — quem executa o modo escuro é
> o épico `E11`, a partir de `docs/redesign/PROPOSTA.md`, e não esta onda.

---

# PROCEDIMENTOS "VERIFICAR NO NAVEGADOR"

```
[VN-1] REFLOW
BALDE:    DE EXECUÇÃO
FONTE:    WCAG 2.2 SC 1.4.10 Reflow (AA) — https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. Abrir a aplicação (npm run dev, http://localhost:5174) numa janela de 1280 px CSS de largura.
  2. Ctrl + "+" até 400% (a barra de zoom do Chrome deve marcar 400%) → 320 px CSS efetivos.
  3. Percorrer as sete URIs: / · /operacional · /clientes · /performance · /alertas ·
     /historico · /processo/<uma REF real da tabela>.
  4. Registrar toda rolagem horizontal que NÃO seja da <table> dentro de
     ProcessTable.tsx:54 nem do <ResponsiveContainer> de History.tsx:177.
  5. Pontos a olhar primeiro, por já terem sinal estático: (a) a barra de filtros —
     FilterBar.tsx:68 mantém `grid-cols-2` a 320 px com dois <input type="date"> e um
     <select>, cuja largura mínima é imposta pelo UA e não pelo CSS; (b) as três tabelas
     do ACHADO 19; (c) App.tsx:93 `px-6` no <main> mais App.tsx:57 `px-6` no cabeçalho
     consomem 48 px dos 320.
```

```
[VN-1] DESFECHO — executado em 31/08/2026 (H-47) · 2 ACHADOS
MÉTODO:   Chrome 151 headless via CDP, viewport de 320 px CSS — equivalente de layout
          a 1280 px com zoom 400%. Sete URIs, uma REF real da aba 2026. Servido por
          dist/web em :5173 (o caso-limite da história declara os dois equivalentes).
          Critério: scrollWidth da raiz > clientWidth, e o elemento culpado é o mais
          externo que ultrapassa SEM ancestral que contenha a rolagem.
APROVADAS: / · /operacional · /clientes · /alertas · /historico — scrollWidth 320 = 320.
          Em /operacional 1368 elementos e em /historico 47 ultrapassam a borda, e
          NENHUM faz a página rolar: estão dentro de overflow-x-auto. É a exceção
          bidimensional de SC 1.4.10, e não é achado.
          O suspeito 5(a) — FilterBar com grid-cols-2, dois <input type="date"> e um
          <select> — NÃO reprovou em nenhuma das sete. O endereço do item 5(a) mudou:
          FilterBar.tsx:68 → :87 (o grid); os date estão em :111 e :121, o select em :133.

ACHADO VN-1/A — /performance rola 385 px num viewport de 320.
  Elemento: <span class="w-24 shrink-0 text-right text-xs"> em RankingBar.tsx:138,
  o slot `secondary`. 10 ocorrências, uma por linha do ranking; todas com right=385.
  Causa: as larguras fixas da linha somam mais que 320 — w-40 do rótulo (160) +
  w-12 da contagem (48) + w-24 do secundário (96) + 3 gaps de 12 = 340, antes da
  barra. O `shrink-0` impede o colapso.
  Por que só aqui: Performance.tsx:127 é a ÚNICA que passa `secondary`
  (<OverdueBadge>). As demais páginas usam o mesmo componente e passam.

ACHADO VN-1/B — /processo/<ref> rola 572 px num viewport de 320, quase o dobro.
  Elemento: <label class="flex grow flex-col gap-1 text-xs ... sm:max-w-sm"> em
  ColorFieldsForm.tsx:133, com 531 px de largura.
  Causa: o <select> filho é dimensionado pela maior <option> — "Verde (tom A) — sem
  responsável · Canal Verde" —, e essa largura é imposta pelo UA, não pelo CSS. O
  limite `sm:max-w-sm` só incide a partir de 640 px, então abaixo do breakpoint não
  há limite nenhum. É o modo de falha que o item 5(a) previa, no <select> da Página
  Detalhe e não nos <input type="date"> da barra.
  Prova visual capturada: o controle rompe a borda direita do próprio cartão.
```

```
[VN-2] RESIZE TEXT
BALDE:    DE EXECUÇÃO
FONTE:    WCAG 2.2 SC 1.4.4 Resize Text (AA) — https://www.w3.org/TR/WCAG22/#resize-text
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. Janela em 1280 px CSS, Ctrl + "+" até 200%.
  2. Percorrer as sete páginas.
  3. Registrar texto cortado, sobreposto ou controle fora da tela. Olhar primeiro:
     `truncate` em RankingBar.tsx:90 (dentro de `w-40` fixo), ArrivalCalendar.tsx:42,
     MultiSelect.tsx:84 e :121, e `max-w-0 truncate` em Performance.tsx:190; e o painel
     `max-h-72` de MultiSelect.tsx:93.
  4. Repetir com o tamanho de fonte padrão do Chrome em "Muito grande"
     (chrome://settings/appearance) em vez de zoom — é onde o `fontSize: 12` do
     ACHADO 21 deixa de escalar.
```

```
[VN-2] DESFECHO — executado em 31/08/2026 (H-47) · 1 ACHADO + confirmação de H-46
MÉTODO:   viewport 640 px (equivalente a 1280 a 200%) e, na segunda passada,
          Page.setFontSizes {standard: 24} — o mesmo mecanismo por trás de
          chrome://settings/appearance em "Muito grande". Sete URIs em cada.

CONFIRMA H-46 — a correção do ACHADO 21 funciona em campo.
  O tick do eixo mede 12px com fonte-base 16 e 18px com fonte-base 24: o
  `fontSize: '0.75rem'` de History.tsx:356 e :362 escala. Com o `fontSize: 12`
  numérico anterior mediria 12px nas duas — é exatamente esta medição que separa
  as duas formas, e ela não era computável estaticamente.

APROVADO a 200% com fonte padrão: nenhuma das sete páginas rola horizontalmente.
  Alvos nomeados no procedimento, todos medidos e conformes nos três cenários
  (200%/16, 200%/24, 400%/16): o painel `max-h-72` de MultiSelect.tsx:141 nunca sai
  da tela e nunca precisa rolar (scrollHeight = clientHeight); o ArrivalCalendar
  cabe sempre (592 · 568 · 272 px de largura, sempre dentro do viewport).

COM FONTE 24 px, /processo/<ref> volta a rolar — 846 px num viewport de 640.
  É o MESMO elemento de VN-1/B (ColorFieldsForm.tsx:133), agora com 785 px. Aqui o
  `sm:max-w-sm` ESTÁ ativo e ainda assim não protege: `max-w-sm` é 24rem, e rem
  acompanha a fonte-base — 24 × 24 = 576 px. Não é achado novo; é o mesmo, e a
  medição mostra que o limite escolhido não resolve o caso que ele parecia cobrir.

ACHADO VN-2/A — o truncamento de Performance.tsx cresce com a ampliação.
  Elemento: as células `.max-w-0.truncate` da tabela de tempo documental.
  Medido, de 34 células: 7 truncadas a 100% (1280/16) · 8 a 200% (640/16) ·
  14 com fonte "Muito grande". NENHUMA tem atributo `title`, então o texto
  completo não tem caminho — os valores mais longos da coluna
  aparecem cortados sem recurso.
  SC 1.4.4 pede que ampliar até 200% não custe conteúdo; aqui o conteúdo perdido
  dobra. O truncamento a 100% é design da tabela; o crescimento é o achado.
  Não é o mesmo caso de Clients.tsx: lá o `.w-40.truncate` corta 1 de 33 células
  nos três cenários — constante, não degrada, e não é achado.
```

```
[VN-3] FOCO VISÍVEL
BALDE:    DE EXECUÇÃO
FONTE:    WCAG 2.2 SC 2.4.7 Focus Visible (AA) — https://www.w3.org/TR/WCAG22/#focus-visible
          e SC 2.4.11 Focus Not Obscured (Minimum) (AA) —
          https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. Em cada uma das sete páginas, Tab do primeiro ao último controle, sem mouse.
  2. Capturar tela de cada parada.
  3. Registrar parada sem indicador visível. O conjunto tem 0 anel autoral (ACHADO 14):
     o que se verifica é o anel padrão do UA sobrevivendo à cascata, em especial sobre os
     botões `bg-slate-800` (ApplyChangesButton.tsx:100, ConflictDialog.tsx:165,
     MultiSelect.tsx:80, History.tsx:155) e dentro de `overflow-x-auto` (ProcessTable.tsx:54)
     e `overflow-auto` (MultiSelect.tsx:93, ConflictDialog.tsx:78).
  4. Confirmar a parada de tabulação órfã do ACHADO 12: em /historico, tabular até o <svg>
     do gráfico e observar que o foco pousa num elemento aria-hidden.
  5. Rolar cada página até o fim e retabular: o cabeçalho de App.tsx:56 NÃO é sticky
     (0 ocorrências de `sticky` no conjunto), então SC 2.4.11 só pode falhar por
     `overflow` recortando o anel — é isso que se procura.
  6. Abrir o ConflictDialog (aplicar com a planilha alterada) e verificar se o Tab escapa
     do <div role="alertdialog"> de ConflictDialog.tsx:75 — não há focus trap no código.
```

```
[VN-3] DESFECHO — executado em 31/08/2026 (H-47) · APROVADO · 1 item não exercido
MÉTODO:   Tab real por Input.dispatchKeyEvent nas sete páginas, do primeiro
          controle até dar a volta. 467 paradas percorridas — / 24 · /operacional 196 ·
          /clientes 54 · /performance 31 · /alertas 126 · /historico 24 · /processo 12.
          Nota de método: o <input type="date"> do Chrome consome vários Tab entre
          os subcampos internos sem trocar activeElement; a primeira execução leu
          isso como fim do ciclo e parou em 19 paradas por página.

APROVADO — indicador visível em 467 de 467 paradas.
  Forma única em todas: outline `auto 1px rgb(16, 16, 16)`, o anel padrão do UA.
  Zero anel autoral (confirma ACHADO 14) e zero parada sem anel: a cascata do
  conjunto não remove o indicador em lugar nenhum, inclusive sobre os fundos
  escuros e dentro dos contêineres com overflow que o procedimento nomeia.
APROVADO SC 2.4.11 — zero paradas com o anel recortado por ancestral com overflow
  (folga < 2 px em relação à caixa do contêiner em nenhuma delas). O cabeçalho
  não é sticky, e nada mais obscurece o foco.

CONFIRMA H-44 — a parada de tabulação órfã do ACHADO 12 não existe mais.
  Zero paradas dentro de [aria-hidden="true"] nas sete páginas, e zero paradas em
  <svg> em /historico. O item 4 deste procedimento pedia observar o foco pousando
  no gráfico; ele não pousa mais.

NÃO EXERCIDO — item 6, o escape de Tab do ConflictDialog.
  Abrir o diálogo exige aplicar edições com a planilha real alterada, e nada nesta
  história pode gravar na planilha do operador. O que se pode afirmar sem executar
  já estava no próprio procedimento: não há focus trap no código de
  ConflictDialog.tsx. O comportamento em execução fica DEVENDO, e não é declarado
  aprovado — silêncio aqui seria a falha que o corpus chama de grave.
```

```
[VN-4] ORDEM DE LEITURA
BALDE:    DE EXECUÇÃO
FONTE:    WCAG 2.2 SC 1.3.2 Meaningful Sequence (A) e SC 2.4.3 Focus Order (A) —
          https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. Percorrer com Tab e comparar a sequência com a ordem visual, nas sete páginas.
  2. Inventário estático: 0 `order-*`, 0 `flex-*-reverse`, 0 `grid-flow-*`, 0 `tabIndex`
     positivo no conjunto — então a ordem do DOM é a ordem de tabulação por construção.
  3. Verificar mesmo assim os dois pontos onde a ordem VISUAL pode divergir do DOM por
     grid: Operational.tsx:50 (`lg:grid-cols-[1fr_20rem]` — o calendário aparece à direita
     mas vem depois no DOM, o que está correto) e Home.tsx:79 (`lg:grid-cols-4` com 12
     cartões — conferir que a leitura por linha corresponde à ordem de CARDS,
     Home.tsx:24-39).
  4. Registrar a posição do foco depois de clicar numa linha de RankingBar
     (Clients.tsx:112 → navigate('/operacional')) — a navegação programática não move o
     foco, e a página troca sob o cursor de teclado.
```

```
[VN-4] DESFECHO — executado em 31/08/2026 (H-47) · 1 ACHADO
MÉTODO:   a mesma tabulação de VN-3, com a posição de cada parada em coordenada de
          DOCUMENTO (left+scrollX, top+scrollY). Nota de método: a primeira análise
          usou coordenada de viewport e acusou 35 inversões nas sete páginas — todas
          artefato da rolagem que o próprio Tab provoca. Nenhuma era real.

APROVADO — a ordem de tabulação é a ordem do DOM nas sete páginas, sem exceção,
  o que confirma em execução o inventário estático (0 order-*, 0 flex-*-reverse,
  0 grid-flow-*, 0 tabIndex positivo).
APROVADO o item 3 — uma única transição não-monotônica, e ela é correta:
  em /clientes, a parada #33 (x=41, y=778) salta para #34 (x=665, y=430). É o
  `lg:grid-cols-2` de Clients.tsx:109: a tabulação percorre a coluna esquerda
  inteira antes da direita. São duas listas independentes lado a lado, e lê-las uma
  de cada vez preserva o significado — mesmo caso que o procedimento já declarava
  correto para Operational.tsx. Não é achado.

ACHADO VN-4/A — o foco é perdido na navegação programática.
  Medido em /clientes: com o foco numa linha do ranking (<button>, rótulo do
  cliente), o clique dispara navigate('/operacional'); a rota troca e
  document.activeElement passa a ser o <body>.
  Efeito: quem navega por teclado perde a posição e recomeça a tabulação do início
  da página nova — 196 paradas, em /operacional. É SC 2.4.3, e é exatamente o que
  o item 4 deste procedimento mandava registrar.
```

```
[VN-5] FORCED COLORS
BALDE:    DE EXECUÇÃO
FONTE:    MDN @media (forced-colors) —
          https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
          + CSS Color Adjustment Module Level 1 (CR Snapshot 16/12/2025) —
          https://www.w3.org/TR/css-color-adjust-1/
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. Windows → Configurações → Acessibilidade → Temas de Contraste → ativar "Aquático".
  2. Percorrer as sete páginas.
  3. Registrar todo estado que deixou de ser distinguível. Alvos nomeados, por ordem de risco:
     (a) App.tsx:143-147 — a aba corrente usa `border-slate-800` contra `border-transparent`.
         **Determinar aqui se o UA preserva `transparent`**: se preservar, o estado
         sobrevive; se substituir, as seis abas ficam idênticas e só o `aria-current`
         (App.tsx:134) resta. Não determinei isto estaticamente e não afirmo o resultado.
     (b) History.tsx:153-157 — o botão de janela selecionado (ACHADO 13, já reportado).
     (c) StatCard.tsx:20-28 e AlertRow.tsx:78 — urgência só por cor (ACHADO 18).
     (d) ConflictDialog.tsx:78 `shadow-xl` e MultiSelect.tsx:93 `shadow-lg` — box-shadow é
         forçado a none; verificar se a borda que resta separa o painel do fundo.
     (e) ProcessTable.tsx:74 `hover:bg-slate-50` e MultiSelect.tsx:112 `hover:bg-slate-100` —
         realce de linha só por fundo.
  4. Repetir com um tema de alto contraste claro e um escuro.
```

```
[VN-5] DESFECHO — NÃO EXECUTADO, por decisão do backlog · vira PD-07
Exige Windows → Configurações → Acessibilidade → Temas de Contraste, e o
desenvolvimento é em Linux. H-47 o declara fora da fatia desde que nasceu, e ele
fecha na primeira instalação na máquina do operador, junto de PD-01, PD-05 e PD-06.
Os cinco alvos nomeados acima continuam válidos e nenhum foi verificado.
```

```
[VN-6] CONTRASTE COM ALFA
BALDE:    DE EXECUÇÃO
FONTE:    WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA) —
          https://www.w3.org/TR/WCAG22/#contrast-minimum
VEREDITO: VERIFICAR NO NAVEGADOR — procedimento:
  1. DevTools → Elements → conta-gotas sobre o pixel do texto e sobre o pixel do fundo
     imediatamente atrás; calcular (L1+0.05)/(L2+0.05) com os dois valores lidos.
  2. Ocorrências com alfa que NÃO computei (a cor efetiva depende do que está pintado atrás):
     · ConflictDialog.tsx:73  `bg-slate-900/40` — o backdrop do diálogo sobre cada uma das
       sete páginas; amostrar com o diálogo aberto sobre /operacional (tabela) e sobre
       /historico (gráfico), que são os fundos mais claros e mais escuros.
     · MultiSelect.tsx:85     `text-xs opacity-80` — o contador/caret dentro do gatilho, nos
       DOIS estados (sobre bg-slate-800 quando selecionado, sobre bg-white quando não).
     · PendingEditsPanel.tsx:90 `line-through opacity-60` — o valor anterior sobre bg-amber-50.
  3. Não há gradiente no conjunto (0 ocorrências de from-*/via-*/to-*), então o passo de
     amostrar início/meio/fim não se aplica.
  4. As três séries do Recharts (History.tsx:46-48) NÃO precisam de amostragem: são
     literais estáticos sem alfa e já foram computados no ACHADO 8 — 6.29, 3.74 e 4.83
     sobre #ffffff, todos ≥ 3:1.
  5. FORA DO ESCOPO desta verificação, por isenção normativa: `disabled:opacity-40`
     (Operational.tsx:142/150, EditProcessForm.tsx:117, ColorFieldsForm.tsx:155,
     PendingEditsPanel.tsx:97/117), `disabled:opacity-60` (RefreshButton.tsx:17) e
     `disabled:bg-slate-300` (ApplyChangesButton.tsx:100) — SC 1.4.3 e SC 1.4.11 isentam
     componente de interface inativo.
```

```
[VN-6] DESFECHO — executado em 31/08/2026 (H-47) · 1 REPROVAÇÃO em 3 alvos
MÉTODO:   amostragem do pixel RENDERIZADO, que é o conta-gotas do procedimento.
          Screenshot PNG do Chrome, e em cada caixa de texto: fundo = cor mais
          frequente da região, glifo = pixel mais distante dela em luminância.
          Razão pela fórmula da WCAG sobre os dois valores lidos. Nenhum número
          abaixo foi computado por composição algébrica.
          Nota de método: a primeira leitura usou "pixel mais escuro da caixa", o
          que devolve o FUNDO quando o texto é claro sobre escuro — deu 1.00:1 no
          MultiSelect selecionado, que é impossível, e foi refeita.
ENDEREÇOS REANCORADOS: MultiSelect.tsx:85 → :133 · PendingEditsPanel.tsx:90 → :92 ·
          ConflictDialog.tsx:73 permanece, e a cor literal `bg-slate-900/40` virou o
          token `bg-overlay-scrim`, oklch(20.8% 0.042 265.755 / 0.4) em index.css:85 —
          o alfa 0.4 foi preservado na migração de H-40.

APROVADO  MultiSelect.tsx:133 `text-xs opacity-80`, nos dois estados que o
          procedimento pede:
          · selecionado, sobre o gatilho escuro — glifo RGB(197,201,177) sobre
            RGB(29,41,61) = 8.60:1
          · não selecionado, o caret sobre fundo claro — glifo RGB(106,118,137)
            sobre RGB(255,255,255) = 4.60:1
          Os dois passam AA para texto normal (4.5:1). O segundo passa por margem
          de 0.10, e é o candidato a quebrar em qualquer ajuste de tom.

REPROVA   PendingEditsPanel.tsx:92 `line-through opacity-60` — 3.27:1.
          Glifo RGB(175,130,97) sobre o painel RGB(255,251,235). O texto é `text-sm`
          (14 px), então o limiar é 4.5:1 e falta 1.23. É o valor ANTERIOR de uma
          edição enfileirada — informação que o operador usa para conferir o que
          vai gravar na planilha.
          O número é conservador: a amostra foi feita com o glifo ampliado, que
          reduz antialiasing; a 14 px reais a razão medida seria igual ou pior.

MEDIDO    ConflictDialog.tsx:73 `bg-overlay-scrim` sobre os dois fundos pedidos,
          com o scrim aplicado e o conteúdo por baixo:
          · sobre /operacional (tabela), uma celula de texto da tabela: 17.83:1 → 7.04:1
          · sobre /historico (gráfico), rótulo "fev/2026": 4.76:1 → 3.29:1
          O texto sob o scrim em /historico cai abaixo de 4.5:1. Conteúdo obscurecido
          por diálogo modal é convencionalmente inativo, e SC 1.4.3 trata de texto
          ativo — por isso fica registrado como MEDIDO e não como reprovação. O
          número existe para a decisão, que não é desta fatia.
          O painel do diálogo é opaco: o texto dele não passa por alfa.
```

---

# CRITÉRIO DE PARADA — DESFECHO DAS 40 REGRAS

| ID | Desfecho |
|---|---|
| **A01** | ACHADOS 3, 4, 5 |
| **A02** | ACHADOS 6, 7 |
| **A03** | sem achado — 0 ocorrências de `outline-none`/`focus:outline-none` no conjunto |
| **A04** | sem achado — 0 `onClick` em `<div>`/`<span>`/`<li>`/`<td>`/`<p>`/`<section>`/`<article>` |
| **A05** | sem achado — 2 alvos abaixo de 24 px, ambos satisfazendo a exceção *Spacing*. Conta, com `--text-xs--line-height: calc(1/0.75)` = 16 px e `--text-sm--line-height: calc(1.25/0.875)` = 20 px lidos em theme.css: **PendingEditsPanel.tsx:97** "Descartar" = 16 + 2×2 (py-0.5) + 2×1 (border) = **22 px**; vizinho vertical a `gap-2` (8 px) → centros a 30 px > 24 px, círculos não se intersectam. **ProcessTable.tsx:143** botão de ordenação = **20 px** (sem padding); vizinhos horizontais separados por `px-3`+`px-3` = 24 px de calha, e o link da 1ª linha do corpo a 17 px abaixo → centros a 37 px > 24 px. Demais alvos ≥ 24 px (`px-3 py-1.5` = 34 px, `px-2 py-1` = 30 px, `px-1 py-1` = 28 px, `px-2 py-1 text-xs` = 26 px) |
| **A06** | ACHADO 11 |
| **A07** | não aplicável — 0 ocorrências de `aria-live` explícito no conjunto; nenhum `role` pode ser contradito |
| **A08** | sem achado — dos 27 `aria-label`, 26 estão em `<section>`/`<nav>`/`<article>` (não são controles) e 1 (`MultiSelect.tsx:101`) está num `<input type="search">` sem rótulo visível, coberto pelo contraexemplo |
| **A09** | não aplicável — 0 `animate-spin`/`animate-pulse`/`animate-bounce` no conjunto |
| **A10** | não aplicável — 0 `animate-*`, 0 `transition-*`, 0 `translate-*`, 0 `duration-*`. (Ainda que houvesse, o corpus §5 registra que a obrigação correspondente é SC 2.3.3, **[AAA — opcional]**) |
| **A11** | ACHADO 18 |
| **A12** | ACHADO 12 |
| **A13** | sem achado — `web/index.html:2` declara `<html lang="pt-BR">` |
| **A14** | sem achado — `App.tsx:127-153` é `<nav aria-label="Páginas">` + `<a href aria-current="page">`; 0 `role="tab"`, 0 `role="tablist"`, 0 `role="tabpanel"` no conjunto. É o contraexemplo literal de A14: navegação de links, não híbrido. O APG Tabs não incide |
| **A15** | sem achado — 0 `sticky` no conjunto; o único `fixed` é `ConflictDialog.tsx:73` `fixed inset-0`, que é o overlay do diálogo modal e cobre a tela por definição. Nenhum elemento da casca é sticky/fixed, logo não há o que obscurecer foco por rolagem |
| **A16** | sem achado — 0 ocorrências de `tabIndex` de qualquer sinal escritas no conjunto (o `tabIndex={0}` do ACHADO 12 é injetado pelo Recharts, e está reportado ali) |
| **A17** | ACHADO 13; parte não determinada estaticamente em **[VN-5]** item 3(a) — **continua em aberto**, agora como `PD-07`: exige Windows |
| **C01** | ACHADO 1 |
| **C02** | ACHADO 8 |
| **C03** | sem achado — 1 único `style={{}}` no conjunto, `RankingBar.tsx:96` `style={{ width: \`${share}%\` }}`, que é o contraexemplo literal de C03 (barra de progresso com valor genuinamente dinâmico) |
| **C04** | ACHADO 15 |
| **C05** | ACHADO 16 |
| **C06** | sem achado — `NAV_PAGES` é definido uma única vez (`router.ts:30-37`) e consumido uma única vez (`App.tsx:128`); nenhuma das sete páginas redefine, reordena ou injeta item de navegação |
| **C07** | sem achado — 2 valores arbitrários no conjunto, ambos cobertos pelo contraexemplo: `ConflictDialog.tsx:78` `max-h-[80vh]` (unidade de viewport, fora da escala `--spacing`) e `Operational.tsx:50` `grid-cols-[1fr_20rem]` (trilha de grid, sem utilitário equivalente) |
| **C08** | sem achado — exatamente **um** `<h1>` na árvore renderizada (`App.tsx:59`), em todas as sete páginas. Sequências: Início `h1 → h2(Filtros) → h3×12(StatCard) → h2(IngestionHealth)`; Alertas `h1 → h2 → h3×6 → h2`; Operacional/Clientes/Desempenho/Histórico `h1 → h2 → h2…`; Detalhe do Processo `h1 → h2…` (a barra de filtros é ocultada em `App.tsx:52`, e a página não tem `h3`). Nenhum salto de nível. 0 `h4`/`h5`/`h6`. Nenhum `<div>` tipografado funcionando como título — os valores grandes (`StatCard.tsx:45`, `Alerts.tsx:142`, `Performance.tsx:130`) são dado, não título. **Acoplamento a registrar sem ser achado:** os `h3` de Início e Alertas dependem do `h2` "Filtros" da casca (`FilterBar.tsx:45`) para a sequência não saltar; se a barra de filtros passar a ser ocultada nessas duas páginas, C08 quebra |
| **C09** | ACHADO 17 |
| **C10** | ACHADOS 9, 10 |
| **R01** | ACHADO 19 (parte estática) + **[VN-1]** (parte de execução, **executada em 31/08/2026**: as três tabelas contidas por `H-46` não fazem página nenhuma rolar; os dois achados de reflow são outros — `RankingBar.tsx:138` em /performance e `ColorFieldsForm.tsx:133` em /processo) |
| **R02** | sem achado — nenhuma largura fixa acima de 320 px sem contenção: `MultiSelect.tsx:93` `w-64` = 256 px; `RankingBar.tsx:90` `w-40` = 160 px; `ConflictDialog.tsx:78` `w-full max-w-3xl` já cede; `Operational.tsx:50` `20rem` = 320 px só a partir de `lg:` |
| **R03** | ACHADO 21 |
| **R04** | ACHADO 20 |
| **R05** | sem achado — nenhum `h-*` fixo contém texto: `RankingBar.tsx:93` `h-4` é o trilho da barra e `History.tsx:176` `h-72` é o invólucro do SVG, ambos cobertos pelo contraexemplo; os dois contêineres com altura limitada usam `max-h-*` + `overflow-auto` (`MultiSelect.tsx:93`, `ConflictDialog.tsx:78`), que cedem ao aumento de entrelinha; nenhum `truncate` está combinado com `h-*` fixo; 0 `line-clamp-*` |
| **R06** | coberto pelo ACHADO 19 na parte estática (a tabela de `History.tsx:212` é irmã do gráfico dentro da mesma `<section>`, sem contenção de rolagem). Na parte que R06 nomeia diretamente: o `WindowPicker` (`History.tsx:144`) e as quatro notas (`:250`, `:271`, `:288`, `:307`) são **irmãos** do gráfico num `flex flex-col`, não colunas de um grid — nenhum `min-w-*` lhes é imposto. Parte de execução em **[VN-1]** |
| **D01** | sem achado — o predicado exige `dark:` presente **e** CSS de entrada sem `@theme`; há 0 ocorrências de `dark:` no conjunto. A ausência de `@theme` está cobrada em C01 (ACHADO 1) |
| **D02** | ACHADO 2 |
| **D03–D07** | **não aplicáveis — 0 ocorrências de `dark:` no conjunto** |

**(P1)** ✓ Z1 e Z2 declarados. **(P2)** ✓ 40 regras com desfecho registrado. **(P3)** ✓ VN-1 a VN-6 emitidos. **(P4)** ✓ os 7 achados composicionais (1, 9, 10, 15, 16, 17, 18, 19) citam 2+ locais com majoritário e desviante nomeados. **(P5)** ✓ os 5 achados de contraste (3, 4, 5, 6, 7) mostram oklch, hex e razão. **(P6)** ✓ plano abaixo.

---

> **Reconferência de 19/08/2026, ao abrir `H-39`.** As oito razões usadas como
> critério de aceite da história foram recalculadas contra a paleta 4.3.3 de
> `node_modules/tailwindcss/theme.css`. Seis reproduzem o que está acima —
> 2.63, 4.35, 1.36, 2.40, 4.76 e 9.16. As duas que envolvem `slate-600`
> divergiam e foram corrigidas no texto: `ACHADO 5` dizia **6.92:1** sobre
> branco (é **7.56:1**) e `ACHADO 7` dizia **4.53:1** contra o trilho (é
> **6.90:1**). Nenhuma decisão muda — os dois pares passavam e passam, com
> folga maior que a declarada.
>
> A mesma reconferência encontrou **um par que a auditoria não varreu**:
> `StatusBanner.tsx:111`, o botão *Conferir a planilha configurada*, tem
> `border-amber-400` sobre `bg-amber-50` = **1.66:1**, contra o piso de 3:1 de
> `SC 1.4.11` — é botão, e a borda é o que o delimita. O `ACHADO 6` não o pegou
> porque procurava `border-slate-300`. Corrigido em `H-39` para o token
> `--color-state-warning-fg`, que mede 8.77:1 ali.

---

# PLANO DE ONDAS

```
ONDA 1 — CAMADA DE TEMA
DEPENDE DE: nada
ARQUIVOS TOCADOS: 1 (web/src/index.css)
ACHADOS: 1 (C01, criação da camada) · 2 (D02)
PORQUE VEM AQUI: os tokens de destino da substituição da onda 2 não existem — trocar
  cor antes disto exigiria refazer a troca depois, nos mesmos 24 arquivos.

ONDA 2 — SUBSTITUIÇÃO DAS CORES LITERAIS
DEPENDE DE: onda 1
ARQUIVOS TOCADOS: 24
  web/src/App.tsx
  web/src/components/AlertRow.tsx · ApplyChangesButton.tsx · ArrivalCalendar.tsx ·
    ColorFieldsForm.tsx · ConflictDialog.tsx · EditProcessForm.tsx · FilterBar.tsx ·
    IngestionHealth.tsx · MultiSelect.tsx · PendingEditsPanel.tsx · ProcessTable.tsx ·
    RankingBar.tsx · RefreshButton.tsx · StatCard.tsx · StatusBanner.tsx
  web/src/pages/Alerts.tsx · Clients.tsx · History.tsx · Home.tsx · Operational.tsx ·
    Performance.tsx · Placeholders.tsx · ProcessDetail.tsx
ACHADOS: 1 (consumidores) · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10
PORQUE VEM AQUI: cada arquivo é aberto uma vez só — a troca do passo bruto pelo token e
  a correção do par que reprovou em contraste são a mesma edição na mesma linha.

ONDA 3 — CORREÇÕES LOCAIS INDEPENDENTES DE TEMA
DEPENDE DE: nada — executável em paralelo à onda 1
ARQUIVOS TOCADOS: 14
  web/src/App.tsx · components/{ApplyChangesButton,ColorFieldsForm,EditProcessForm,
  FilterBar,IngestionHealth,StatusBanner}.tsx · pages/{Alerts,Clients,History,Home,
  Operational,Performance,ProcessDetail}.tsx
ACHADOS: 11 (A06) · 12 (A12) · 13 (A17) · 14 ([NÃO NORMATIVO] N02, sem ação)
PORQUE VEM AQUI: live region, prop do Recharts e canal não-cromático de estado não
  referenciam token de cor nenhum — nada nesta onda muda se a onda 1 mudar.

ONDA 4 — CONSISTÊNCIA COMPOSICIONAL
DEPENDE DE: onda 2
ARQUIVOS TOCADOS: 13
  web/src/index.css · App.tsx · components/{AlertRow,ProcessTable,StatCard}.tsx ·
  pages/{Alerts,Clients,History,Home,Operational,Performance,Placeholders,ProcessDetail}.tsx
ACHADOS: 15 (C04) · 16 (C05) · 17 (C09) · 18 (A11)
PORQUE VEM AQUI: unificar antes de tokenizar unificaria sobre literais, e as três
  @utility do ACHADO 17 nasceriam com passo bruto no corpo.

ONDA 5 — RESPONSIVIDADE E REFLOW
DEPENDE DE: onda 4
ARQUIVOS TOCADOS: 6
  web/src/components/ConflictDialog.tsx · pages/{Clients,History,Operational,Performance,
  ProcessDetail}.tsx
ACHADOS: 19 (R01/R06) · 20 (R04) · 21 (R03)
PORQUE VEM AQUI: o invólucro de rolagem do ACHADO 19 e a contraparte de grid do
  ACHADO 20 se aplicam aos contêineres que a onda 4 acabou de unificar; o ACHADO 21 não
  depende de onda alguma e vem junto para não abrir History.tsx numa sétima vez.

ONDA 6 — MODO ESCURO
DEPENDE DE: ondas 1 e 2
ARQUIVOS TOCADOS: 0
ACHADOS: nenhum — D03–D07 não aplicáveis, 0 ocorrências de `dark:` no conjunto
PORQUE VEM AQUI: a onda existe e fica vazia porque o corpus (§ leitura de arquitetura do
  eixo modo escuro) condiciona D03–D07 à introdução da variante, que não aconteceu.
SUPERADA EM 31/08/2026: a introdução da variante passou a acontecer, por D-21. A onda
  segue vazia AQUI — quem a executa é o épico E11, fora deste plano.

ONDA 7 — VERIFICAÇÃO MANUAL
DEPENDE DE: ondas 1 a 6
ARQUIVOS TOCADOS: 0
ACHADOS: [VN-1] · [VN-2] · [VN-3] · [VN-4] · [VN-5] · [VN-6]
EXECUTADA EM 31/08/2026 por H-47: cinco dos seis percorridos, com desfecho escrito em
  cada bloco. VN-5 fica com PD-07, por exigir Windows. Cinco achados novos —
  VN-1/A, VN-1/B, VN-2/A, VN-4/A e a reprovação de contraste de VN-6 —, e duas
  correções confirmadas em campo: H-44 (a parada órfã sumiu) e H-46 (o eixo escala).
  Um item não exercido e declarado: o escape de foco do ConflictDialog.
PORQUE VEM AQUI: as ondas 2, 4 e 5 mudam cor resolvida, contêiner e rolagem — verificar
  antes verificaria um estado que vai deixar de existir.
```

Total: 22 achados em 7 ondas, 25 arquivos distintos tocados.