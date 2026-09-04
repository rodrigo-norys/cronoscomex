# CronosComex

Painel operacional de desembaraço aduaneiro. Aplicação **local**: lê a planilha
`.xlsx` do OneDrive, calcula indicadores, e grava de volta no arquivo sob
comando explícito. Sem banco, sem nuvem, sem autenticação.

**O plano está completo em `docs/`. Nenhuma decisão de arquitetura está em
aberto — a implementação é execução, não escolha.** Se você se pegar
escolhendo entre alternativas, a resposta já existe em algum documento; procure
antes de decidir.

## Regras invioláveis

1. **A planilha é a referência prioritária**, acima da especificação. Quando o
   documento e o arquivo divergirem, o arquivo vence, e a divergência vira
   achado documentado — nunca correção silenciosa.
2. **Nada é descartado em silêncio.** Toda linha não interpretada vai para o
   relatório de quarentena com motivo estruturado.
3. **Nada é adivinhado.** Cor não reconhecida não vira a cor mais próxima; data
   sem ano não recebe ano inventado. Buraco visível é melhor que valor errado
   invisível.
4. **A cor nunca infere o status.** São campos independentes. Medido: 66 linhas
   com STATUS vazio, 1 linha branca.
5. **`src/domain/` não importa `src/io/`, `src/app/`, `src/http/` nem `web/`.**
   O lint verifica e quebra a build.
6. **Nenhuma regra de negócio no cliente ou nas rotas.** Só em `src/domain/`.
7. **Nenhum teste toca estado real** — nem a planilha, nem `data/`, nem
   `config/app.json`. A suíte roda sobre `tests/fixtures/*.xlsx`, versionadas, e
   sobre diretório temporário para tudo que a aplicação grava. Todo caminho que a
   aplicação escreve é ponto de injeção, e **dois recusam o padrão sob
   `NODE_ENV=test`**: `history-store`, medido em `H-28` — sem a recusa, a suíte
   gravou 649 eventos no arquivo do operador, e um teste passou a reprovar pelo
   estado da máquina —, e `saveWorkbookPath`, medido em `H-34`: um ponto de
   injeção que a assinatura de `buildServer` ainda não tinha fez o teste
   sobrescrever a configuração do operador **em silêncio**, porque a gravação
   preserva os demais campos.
8. **Nenhum dado pessoal em log.** Processos são referenciados por `ref` e
   `sourceRow` — nunca por nome de cliente, importador ou mercadoria.
9. **Nunca use `workbook.xlsx.writeFile()` do ExcelJS.** Ele perde formatação
   condicional e validações silenciosamente, e pode corromper o arquivo. A
   escrita é cirúrgica no XML — ver ADR-0004.
10. **Nunca processe, indexe, exponha nem registre dados das abas fora de
    escopo.** Só a aba `2026`. A leitura usa fluxo e **pula** as demais abas
    sem consumir suas linhas; nenhuma célula delas vira `RawRow`, chega à API,
    à interface ou ao log. A aba `CNPJ` contém credenciais de terceiros.

    > Redação anterior — "nunca leia as abas" — era tecnicamente inatingível:
    > a aba `CNPJ` tem 250 células que referenciam o pool **global**
    > `xl/sharedStrings.xml`, então nenhuma leitura de texto do arquivo é
    > possível sem carregá-lo inteiro. Limitação do formato OOXML, não da
    > biblioteca. O isolamento real está no processamento e na escrita —
    > **provado**: editar uma célula de **texto** da aba `2026` deixa 28 das 30
    > entradas do zip byte a byte idênticas, incluindo as três abas fora de
    > escopo. Gravar data em célula sem formato altera também `xl/styles.xml`,
    > de forma estritamente aditiva (TD-05.1, passo 5b) — as três abas fora de
    > escopo seguem idênticas em qualquer caso.

## Antes de escrever código

Leia, nesta ordem:

1. `docs/README.md` — índice e estado atual
2. `docs/perfilamento/RESULTADO.md` — os fatos **medidos** sobre a planilha real
3. `docs/06-backlog.md` — a história que você vai implementar (H-NN)
4. `docs/03-modelo-dados.md` — as tabelas de decisão TD-01 a TD-06 e TD-05.1

Para regra de negócio, consulte `docs/01-auditoria-especificacao.md`: os 65
achados (A-NN) explicam **por que** cada regra é como é, cada um citando o
trecho de origem. A especificação original é documento do cliente e **não é
versionada** — a auditoria é autossuficiente, e é ela que vale.

## Fatos medidos sobre a planilha (H-01, 03/08/2026)

Não re-derive isto; está medido.

- Aba em escopo: **`2026`**, 649 linhas de dados, colunas A–P
- **Todas as datas são seriais reais do Excel.** Zero texto sem ano
- Coluna E = `AGENTE` · Coluna P = `Coluna1`, 99,9% vazia
- **9 chaves de cor**, cobrindo 100% das linhas — em `config/color-map.json`
- Zero REF duplicada, zero REF vazia
- `DOCS ENVIADOS` preenchida em apenas **20,7%** das linhas
- Uma mesma cor vem de **vários `styleId`** — por isso a escrita de cor troca
  `fillId`, nunca `styleId` (ver A-49 e TD-05.1)

## Stack — versões fixadas, verificadas em 03/08/2026

| Camada | Versão |
|---|---|
| Node | **22.23.2** LTS — fixado em `.nvmrc` e `engines` |
| TypeScript | 7.0.2 (fallback declarado: 5.9.3, se a build falhar) |
| Fastify | 5.11.2 |
| fflate | 0.8.3 — leitura e escrita cirúrgica no zip |
| chokidar | 5.0.0 |
| React · Vite | 19.2.8 · 8.2.0 |
| Tailwind | 4.3.3 |
| Recharts | 3.10.1 |
| Vitest | 4.1.10 |
| Testing Library · jsdom | 16.3.2 · 30.0.1 — **só teste**, ver D-17 |
| Biome (lint + format) | 2.5.6 |

Não troque versão sem registrar o motivo. Não acrescente dependência que o
plano não prevê.

## Estrutura

```
src/domain/    funções puras — indicadores, alertas, classificação. Sem I/O
src/io/        leitura e escrita de .xlsx, watcher, histórico, fila de edições
src/app/       process-store, write-guard, config
src/http/      rotas Fastify (só serializam; não calculam)
web/           SPA React (só apresenta; não calcula)
tools/         perfilador (virada de ano), verificador de strip-types,
               carregar-planilha.mjs para conferência contra o arquivo real, e
               medir-navegador.mjs para medição de tela num Chrome real
config/        app.json, color-map.json, status-aliases.json, e os dois mapas
               de negocio de H-48 — client-map.json e team-map.json, nao
               versionados, com `.exemplo` versionado ao lado
tests/         domain/, io/, app/, http/, fixtures/ — ambiente `node`
web/tests/     componentes e casca — ambiente `jsdom`
```

**A suíte tem dois projetos**, declarados em `vitest.config.ts`: `servidor` roda
em `node` e cobre `tests/`; `interface` roda em `jsdom` com o plugin do React e
cobre `web/tests/`. Ambiente único obrigaria a carregar `jsdom` para centenas de
testes que não o usam, ou a deixar a interface sem teste.

## Estado

**O plano original está fechado, e tudo que veio depois dele também** — as
quatro fases, mais `H-33` a `H-38`, acrescentadas por uso e não por plano.
**81 das 88 histórias estão concluídas**, e as sete abertas são `E14`. O que cada uma aprendeu — número medido,
defeito encontrado, decisão tomada — está no bloco `✅ CONCLUÍDA` dela em
`docs/06-backlog.md`, e é lá que se procura antes de reabrir decisão que pareça
em aberto. **Este bloco diz só o que está aberto.**

**`E9` a `E12` fecharam em 01/09/2026, e `E13` em 03/09/2026.** O que está aberto
é **`E14`** — `H-82` a `H-87`, decididas em 03/09/2026 e **numeradas na ordem de
execução**: os filtros num painel sobreposto (`D-30`), que substitui a barra de
chips de `H-60`; a busca por atalho; o quadro que rola com o cabeçalho fixo e o
tamanho de página escolhível (`D-31`); o carregamento sem salto; o ícone por
destino; e a contagem que segue o recorte (`D-29`). A sétima, `H-88`, não vem da revisão de interação: ela nasce de `PD-08` e tira o mapa de clientes da cópia manual (`D-32`). **Nenhuma toca contrato de rota** — medido:
`GET /api/processes` já serve `total` com `activeOnly`, e `GET /api/alerts` já
respeita os filtros. A ordem entre elas está no cabeçalho do épico. Restam também as **pendências abertas** abaixo — três delas esperam a
máquina do operador, e **uma não**: o `ConflictDialog` de `PD-07` precisa de
fixture que produza o conflito, e nenhuma das nove produz.

> **`E13` é retroativo, e é o único do backlog que é.** O código entrou em
> 02/09/2026 pelo PR #111 — edição na tabela, ordenação, criação de linha e a
> gravação do mapa de clientes — **sem história**, e a cascata de documentos foi
> percorrida só em parte. As cinco histórias, os cinco RF novos e a linha da
> Página Configuração na matriz foram escritos em 03/09 (`D-26`). **A lição não é
> sobre documento:** o protocolo de fatia existe para o defeito de plano aparecer
> antes do código, e escrever depois recupera a rastreabilidade, nunca o
> anteparo.

Os dois documentos que geraram trabalho depois do plano estão exauridos:
`docs/redesign/VERIFICACAO.md` — os seis procedimentos de navegador nos dois
esquemas, com três limitações declaradas — e `docs/redesign/REVISAO-ESTILO.md`,
cujos 14 achados foram todos resolvidos ou declarados não normativos.

**A medição no navegador é `tools/medir-navegador.mjs`**, versionada em
01/09/2026 depois de ser reconstruída do zero em duas sessões. Ela sobe a
aplicação sobre uma fixture, com os três caminhos de escrita num diretório
temporário, e mede num Chrome real por CDP — largura, contraste com `oklch`
resolvido pelo navegador, paradas de tabulação, `forced-colors`,
`prefers-color-scheme`, `prefers-reduced-motion`, o apontador com cursor e a
fonte-base do cenário "Muito grande". Rode com
`LOG_LEVEL=silent` e depois de `npm run build`.

> **A numeração foi refeita em 19/08/2026** para acompanhar a ordem do backlog, e
> **o histórico do git continua citando os números antigos** — a branch e os
> commits de `H-35` dizem `H-44`. Não há como alinhá-lo: a `main` protegida
> proíbe reescrever histórico.

> **Este bloco é curto por decisão.** Ele diz onde o projeto está e o que vem a
> seguir — nada mais. Ele chegou a 310 linhas antes de 11/08/2026 e a 125 antes
> de 31/08/2026, das quais quatro quintos eram narrativa de épicos já fechados.
> O `CLAUDE.md` é carregado em **toda** sessão; o backlog, só quando alguém o
> abre. **Não transcreva para cá o que a história já registrou lá.**

Ao concluir uma história, marque-a em `docs/06-backlog.md` e verifique se algum
status de `docs/09-rastreabilidade.md` mudou.

### Pendências abertas

Não bloqueiam a implementação. Fechar antes da entrega ao operador.

> **`PD-06` fechou em 03/09/2026**, na terceira visita à máquina: os três itens
> que restavam foram exercidos por SSH, inclusive o da janela — `schtasks /it`
> abre com janela na sessão gráfica, e `taskkill` sem `/F` é o `WM_CLOSE` do
> clique no X. O que virou regra está na rule de operação em Windows.
>
> **A instalação aconteceu em 04/09/2026, e com ela `PD-01` fechou.** A árvore de
> `distribuicao` foi baixada na máquina do operador, os dois mapas de negócio
> copiados para `config\`, e a planilha apontada **pela tela**, sem `app.json`
> prévio: `/api/health` respondeu `state: "pronto"`, 649 linhas lidas, zero em
> quarentena. Era exatamente o que `PD-01` esperava.
>
> **Duas lições da instalação, que não estão em nenhuma história.** A pasta lá
> **não é um repositório git** — foi baixada como árvore, não clonada —, então
> não há `git pull` para atualizar nem `git status` para detectar arquivo
> sobrescrito; e foi precisamente o `git status` que diagnosticou a tela preta da
> primeira tentativa, quando 101 arquivos de `src/` e `web/src/` apareceram numa
> versão anterior a `H-52` sobre um `.git` correto. O sintoma no navegador era
> mudo: `Uncaught TypeError` ao desestruturar `meta.period`, `#root` vazio, fundo
> escuro. **Cliente novo com servidor velho falha assim, e sem git não há o que
> comparar.**

| # | Pendência | Quando fechar |
|---|---|---|
| **PD-07** | **O resto de `VN-5` (forced colors), e sobrou pouco.** A pendência nasceu supondo que o procedimento exigia Windows, e **isso foi medido como falso em 31/08/2026**: o Chrome emula `forced-colors: active` no Linux, e o que o procedimento pergunta não é que cor o tema pinta, e sim se o desenho sobrevive quando as cores do autor são descartadas. **`H-65` fechou o item 4 por medição**: sob o modo forçado os dois esquemas são paletas de sistema **realmente distintas** — branco com `rgb(0, 0, 159)` e preto com `rgb(255, 255, 0)` —, e a lateral distingue o item corrente nas duas. **E o item 3(e) tinha o diagnóstico errado**, corrigido em `H-64`: `:hover` **casa** no headless, e o que faltava era o apontador **declarado** — o Tailwind v4 envolve todo `hover:` em `@media (hover: hover)`, e o headless responde `hover: none`. Resolvido pela flag `--blink-settings`, exposta como `apontadorFino`. **Sobram dois:** (1) a paleta **nominal** do Windows — Aquático e as demais —, que é confirmação de segunda ordem; (2) o `ConflictDialog` do item 3(d), que só abre com a planilha alterada durante a sessão | **O item (1) na próxima visita à máquina.** A instalação de 04/09/2026 fechou `PD-01` e não o exerceu — ele é confirmação de segunda ordem, e ficou para trás sem custo. O item (2) **não exige Windows** — exige uma fixture que produza o conflito, e nenhuma das nove produz; fecha junto da gestão de foco do diálogo, que está no mesmo bloqueio |
| **PD-08** | **Os dois mapas de negócio de `H-48` viajam à parte, e o `README.md` da distribuição ainda nega isso.** Eles estão no `.gitignore` e a árvore leva só os `.exemplo`. **A cópia manual foi feita em 04/09/2026 e funcionou** — `client-map.json` `d4b8b5dd…` e `team-map.json` `2054fe7b…` conferidos byte a byte nas duas pontas, e o campo Cliente passou a mostrar o nome consolidado. **O que sobra é documental:** o `README.md` da branch afirma em negrito "você não precisa editar arquivo nenhum" e descreve `config\` como só cores e apelidos de status; e o bloco "Como refazer esta branch" lista os arquivos a copiar **sem** os dois `.exemplo`, divergindo do script, que é quem vale. Os detalhes estão em `.claude/rules/distribuicao.md` | **Na próxima vez que a branch `distribuicao` for sincronizada**, já que `README.md` é exclusivo dela e não se corrige a partir da `main`. **A JANELA de 03/09 fechou:** a instalação do operador agora tem `E13` e grava no mapa, então **as duas pontas escrevem** e a cópia cega deixou de ser segura — daqui em diante, reconciliar antes de copiar. **Repita a cópia toda vez que a regra de consolidação ou a equipe mudar**: nenhum aviso existe para lembrar |

| **PD-09** | **A premissa `P-15` ficou sem dono, e há uma frase da tela apoiada nela.** `P-15` — o OneDrive sincroniza o arquivo de lock `~$<nome>.xlsx` entre máquinas — está "não afirmada" desde o plano, e `docs/00-visao-escopo.md` e `A-58` mandavam medi-la em `H-30`, que **fechou em 18/08/2026 sem medir**. Mesmo padrão de `PD-05` entre 14 e 17/08/2026. A medição direta pede **duas máquinas com a mesma pasta sincronizada**, e nada indica que exista uma segunda conta com acesso à pasta da organização; o **proxy de uma máquina só** — abrir a planilha no Excel e observar se o `~$` sobe, pelo ícone do OneDrive ou pela visão web do SharePoint — responde a mesma pergunta. O que não pode ficar como está: `web/src/components/StatusBanner.tsx` afirma "Alguém está com a planilha aberta no Excel", que é a leitura **forte** da premissa. Ou ela é medida e a frase se justifica, ou a frase recua para o que é sabidamente verdadeiro — o arquivo está aberto **nesta** máquina — com o motivo no cabeçalho do componente | **Medido em 03/09/2026, e o proxy não é executável nesta instalação:** a planilha real do operador está em `Downloads`, **fora do OneDrive** — a pasta sincronizada existe e não a contém. `P-15` supõe o `~$` viajando entre máquinas por pasta compartilhada; sem isso, não há o que observar. **A leitura forte da frase é falsa por construção aqui**, e não por falta de medição: o `~$` só pode ser de quem abriu o arquivo NESTA máquina. Resta decidir entre recuar a frase de `StatusBanner.tsx` — o caminho que os fatos apoiam — ou medir `P-15` num cenário que o operador não usa |

| **PD-10** | **A suíte reprova sob contenção por prazo, e o defeito não é de produto.** Quatro casos estouram o teto quando a máquina está carregada: `paginacao > avanca e volta a pagina`, `mostra a faixa e o total` e `desabilita Anterior`, em `web/tests/Operational.test.tsx`, mais `Histórico (/historico) — H-21`, em `web/tests/paginas-montadas.test.tsx`. **Foi ele que escondeu o defeito da grade** corrigido em 03/09/2026: os dois apareciam juntos sob carga, e a família de prazo é a que a carga reproduz — o que me levou a diagnosticar "timing" quando a causa da grade era uma atualização de estado perdida. **A consulta já foi escopada**, em 02/09/2026, e o comentário do próprio teste registra os 5 s medidos; o que sobra é o custo de **montar** 200 linhas com 6 células editáveis cada. O `Histórico` é outra causa: ele espera o fallback do `Suspense` **sumir**, com o teto próprio de 1.000 ms de `asyncUtilTimeout`. **Não subir `testTimeout` nem `asyncUtilTimeout`**: medido em 03/09/2026 que isso zera o sintoma e esconde o resto, que é como este defeito mascarou o da grade | **Quando `H-84` chegar**, e o vínculo é técnico: hoje o teste monta 200 itens porque `PAGE_SIZE` é constante fixa no cliente, e `H-84` torna o `limit` estado de URL — os casos passam a pedir páginas pequenas e continuam exercitando a paginação. **Antes de abrir a fatia, meça:** rode os quatro com `--testTimeout` alto sob contenção e registre o tempo de cada um, para separar montagem cara de espera mal formulada. A troca da espera do `Histórico` por uma asserção **positiva** (`findBy*` do conteúdo, em vez de esperar o fallback sumir) não depende de `H-84` e pode ir antes |

Ao fechar uma pendência, remova a linha.

## Onde a regra já aprendida foi parar

Este arquivo é carregado em **toda** sessão; os destinos abaixo, só no momento
do uso. Nada aqui repete o que está lá — abra quando a linha disser.

- **O que se aprendeu ao fechar cada história** — número medido, defeito
  encontrado, decisão tomada — está no bloco `✅ CONCLUÍDA` da história em
  `docs/06-backlog.md`. Abra antes de reabrir decisão que pareça em aberto.
- **Regra de tela:** `/nova-pagina`. **Regra de indicador ou alerta:**
  `/novo-indicador`. A `/fatia` despacha para a certa por teste textual na lista
  de arquivos.
- **Invariante de um módulo:** cabeçalho do próprio arquivo em `src/`.
- **Por que uma guarda existe:** cabeçalho do próprio script, hook, workflow ou
  teste.
- **Fases, grafo, caminho crítico e riscos:** `docs/07-plano-entrega.md`.
- **Cobertura por indicador e alerta, e histórias órfãs:**
  `docs/09-rastreabilidade.md` §4.
- **Contratos de rota e códigos de erro:** `docs/05-contratos-api.md`.
- **Testes, ingestão, observabilidade, LGPD e a régua de comentários:**
  `docs/08-qualidade-operacao.md`.
- **Decisões do usuário, já tomadas e não re-litigáveis:**
  `docs/10-governanca.md` §5.
- **De onde veio cada épico posterior ao plano** — `E9` de
  `docs/estilizacao/RESULTADO.md`, `E10` de `docs/uso/RESULTADO.md`, `E11` de
  `docs/redesign/PROPOSTA.md`. A ordem entre eles vive no cabeçalho de cada
  épico, e **não** em `docs/07-plano-entrega.md`, que só alcança o plano
  original.

## Infraestrutura de agente

**Versionamento.** Há repositório git, com remote **privado** em `origin`.
Nunca commite direto na `main`: branch por história (`H-NN/<tipo>-<descrição>`)
ou, fora de história, `<tipo>/<escopo>-<descrição>`. Escopos: `domain`, `io`,
`app`, `http`, `web`, `tools`, `config`, `docs`, `claude`, `repo`. Mensagem em
pt-br, sem o tipo `test`.

**O merge acontece no GitHub, não localmente.** `branch → commits → push da
branch → PR → merge por lá`. Mesclar na `main` antes do push **mata o PR**.

**A branch `distribuicao` é a árvore que vai para a máquina do operador** — **124
arquivos, sincronizada com a `main`**, conferido em 04/09/2026. `D-28` fechou: as
seis fontes de `H-58` e a licença delas entraram na sincronização de 03/09, e a
instalação do operador renderiza com a tipografia certa desde então. Sem `docs/`,
`tests/`, `tools/` nem `.claude/`. Ela **não recebe PR**:
é artefato, não revisão. Confira com
`node --experimental-strip-types scripts/sincronizar-distribuicao.ts`, e
**sincronize apenas a partir da `main` mesclada**. O resto —  o que entra e por
quê, os dois arquivos exclusivos da branch, e os mapas de negócio de `PD-08` que
não vão junto — está em `.claude/rules/distribuicao.md`, que carrega ao abrir o
script ou os `.exemplo`.

**Um commit por ponto verde.** O corte não é tempo nem tamanho: é o momento em
que uma preocupação fecha **e** o portão passa. Todo commit verde mantém o
`git bisect` utilizável, que é o que faz o commit atômico pagar — commit
vermelho no meio quebra a busca binária. Ofereça o commit **quando uma camada da
cadeia fechar e o portão passar**, sem esperar o fim da história. Lembrete, não
garantia: é instrução, e instrução falha. Se falhar seguido, o gatilho vira hook
`PostToolUse` — ver a tabela de marcos.

> Ao concluir que o portão reprovou, **rode de novo antes de agir**: há um teste
> intermitente conhecido em `src/io/`, que devolve `exit=1` com **zero testes
> falhando**. Medido em `H-12`: 1 falha em 4 a 8 execuções.

**Skills** (`.claude/skills/`). O corpo de cada uma **só carrega quando é
invocada** — é lá que mora o porquê de cada regra, sem custar contexto aqui.

| Skill | Conduz |
|---|---|
| `/fatia H-NN` | abre a história com contrato e casos-limite; confere a lista de arquivos e **despacha** para a skill certa |
| `/nova-pagina` | uma página, pelo padrão de `H-16` a `H-20` |
| `/novo-indicador IND-NN` | um indicador pelas quatro camadas: domínio → teste → rota → planilha real |
| `/fechar-historia H-NN` | o portão, a *definition of done*, os três documentos e a prova |
| `/sugerir-commits` · `/sugerir-prs` | os commits e os PRs, com **um aceite só** |
| `/avaliar-claude` | varre a própria sessão atrás de capacidade faltando em `.claude/`; só o usuário a invoca |

**Subagentes** (`.claude/agents/`). `revisor-xml` é o revisor adversarial da
escrita cirúrgica: invocado **antes de commitar** qualquer mudança em
`src/io/xlsx-surgeon.ts`, `src/app/write-guard.ts` ou em código que reescreva
bytes do `.xlsx` — `H-24`, `H-25` e `H-27`. Não tem `Edit` nem `Write`, e é
invocado **sem** o raciocínio de quem escreveu o código: começar cego é o
mecanismo, não um efeito colateral. Enumera os casos-limite do backlog a cada
invocação, em vez de carregar cópia deles. **`model: opus` fixado, não
herdado** — herdar faria a revisão de maior consequência do projeto cair de
nível em silêncio quando a sessão que a invoca estiver em outro modelo.

`revisor-estilo` revisa a estilização das sete páginas contra o corpus
verificável de `docs/estilizacao/corpus-estilo.md` — 40 regras com identificador
de norma, sinal sintático e contraexemplo. **Recebe a casca MAIS as sete páginas
de uma vez**, porque 12 das 40 regras são composicionais: a violação delas não
existe dentro de um arquivo, é a diferença entre arquivos. Também não tem `Edit`
nem `Write`, e `model: opus` pelo mesmo motivo do anterior — o eixo de contraste
exige converter `oklch()` para sRGB e calcular a razão da WCAG com a conta à
mostra. Devolve achados em formato fixo e um plano de **ondas por dependência
técnica**, cada uma declarando quantos arquivos toca.

**Rules** (`.claude/rules/`). Instrução com `paths:` no frontmatter, que entra em
contexto **só quando o Claude lê arquivo que casa o glob** — e por isso não custa
token nas sessões que não tocam o assunto. São cinco:

| Rule | Carrega ao tocar |
|---|---|
| `comentarios.md` | `src/`, `web/`, `tests/` — a régua de comentários |
| `documentacao.md` | `docs/` e `.md` da raiz — números afirmados em prosa. Carrega em quase toda sessão, porque o protocolo de fatia lê `docs/`, e por isso é curta |
| `escrita-xlsx.md` | `xlsx-surgeon.ts`, `write-guard.ts` — o procedimento do `revisor-xml` e a forma medida do `calcChain` |
| `operacao-windows.md` | `scripts/` — os sete itens de `PD-06` e a lição que já se pagou |
| `distribuicao.md` | o script de sincronização e os `.exemplo` — o que entra na branch, e `PD-08` |

**As três últimas nasceram em 31/08/2026, do `CLAUDE.md`**, que era carregado em
toda sessão e pagava ~1750 palavras por três assuntos que só interessam a quem
abre aqueles arquivos. **Não é garantia**: rule é contexto, não
configuração aplicada. **Ela sobrevive ao `/compact`** — a documentação é
explícita: rules com `paths:` recarregam quando o Claude volta a ler arquivo que
casa o glob, e o hook `InstructionsLoaded` chega a expor `load_reason: compact`.
O que não sobrevive é o disparo sem leitura. **O gatilho é `Read`, não `Write`**,
e isso é limitação medida, não escolha: criar arquivo novo em `scripts/` não
carrega `operacao-windows.md` (issue #23478 do `claude-code`). Editar carrega,
porque o harness exige `Read` antes de `Edit`. Quem garante é a asserção em `tests/repo/`. Regra
inviolável não vai para cá.

**Hooks** (`.claude/hooks/`). `guard-dados-sensiveis.sh` (`PreToolUse`) bloqueia
o que pode publicar dado de cliente e falha **fechado**.
`conferir-distribuicao.sh` (`PostToolUse`) avisa, depois de `git pull` ou
`git merge` **com a `main` em HEAD**, que a branch `distribuicao` ficou para
trás — mede e reporta, nunca sincroniza sozinho. Falha **aberto**, e é barato:
filtra o comando por regex antes de olhar a árvore.
`conferir-alinhamento.sh` (`ConfigChange`) avisa quando existe skill, subagente
ou hook que este arquivo não menciona, **e quando uma peça já criada continua
com o gatilho em aberto na tabela de marcos** — mencionar e marcar são coisas
diferentes. Falha **aberto**.
`registrar-instrucoes.sh` (`InstructionsLoaded`) escreve uma linha por arquivo de
instrução que entra em contexto — quando, **por que** (`load_reason`) e qual —,
em `data/instrucoes-carregadas.log`, que é gitignored. Não imprime nada: o log é
para leitura agregada, não para a sessão. **Falha aberto, e aqui isso é mais
grave que nos outros:** neste evento `exit 2` **bloqueia o arquivo de instrução
de carregar**, e uma sessão rodaria sem as regras invioláveis em silêncio. `test-guard.sh` é a regressão do guard e roda
**primeiro** no `npm run verify` — exige `bash` e `jq`.

**`verifica-dados-sensiveis.sh` roda logo depois dele, desde 02/09/2026**, e
até então só existia no CI: o portão local passava e o workflow reprovava, que
é a ordem errada de descobrir. Foi assim que a guarda das fixtures chegou ao
`dados-sensiveis.yml` com a âncora reprovando o check de caminho absoluto.

> Ele tem **uma** isenção estrutural, e ela nasceu no mesmo dia: quando a conta
> do GitHub tem o nome do usuário do sistema, a URL do próprio repositório passa
> a conter o nome. Só `github.com/<dono>/` é isento — o nome nu continua
> reprovando, inclusive na mesma linha. Sem isso o check reprovava na máquina do
> dono e aprovava no runner, onde `$USER` é `runner`.

**Permissões** (`.claude/settings.json`). `npm install` e `npm ci` pedem
confirmação. `curl`, `wget`, force-push e leitura ou escrita de `*.xlsx` e
`*.jpeg` da raiz estão negados. O modo bypass está desabilitado.
**`mcp__*` está negado — todo MCP, de todo servidor** (D-19 e D-20 em
`docs/10-governanca.md`).

**O git é permitido até o PR, e negado do PR em diante.** `git add`, `commit`,
`push`, `switch` e `gh pr create` rodam sem confirmação; **`gh pr merge` está
negado**, e o merge continua sendo do dono, no GitHub. Negados também os
comandos que **perdem trabalho ou reescrevem história**: `reset --hard`,
`clean`, `checkout --`, `switch -f`, `rebase`, `commit --amend`,
`commit --no-verify`, `branch -D` e `gh repo delete`.

> **A confirmação em `git add` e `git push` saiu em 31/08/2026**, ao abrir a
> sessão sem supervisão. Quem protege deixou de ser o prompt e passou a ser o
> par: **o portão antes do commit** e a **`main` protegida** depois dele — nada
> chega à `main` sem PR, `verify` e `dados-sensiveis`. As negações acima
> entraram no mesmo commit, e são o outro lado da troca: sem prompt, o que não
> pode acontecer precisa ser impossível, e não apenas desaconselhado.
>
> `git switch -f` e `--discard-changes` negados têm par no repositório:
> `scripts/sincronizar-distribuicao.ts` recusa árvore suja antes do seu próprio
> `git switch`. Os dois defendem a mesma coisa — mudança não commitada não
> atravessa troca de branch — por caminhos diferentes.

**Gates no GitHub** (`.github/workflows/`), em `pull_request` e em `push` na
`main`. `verify.yml` roda o portão inteiro com o Node de `.nvmrc`;
`dados-sensiveis.yml` roda `verifica-dados-sensiveis.sh`. **É a única camada que
roda sempre** — o hook é `PreToolUse` e não vê commit feito fora do Claude Code.

**Guarda de contrato:** `tests/repo/contratos.test.ts` e
`web/tests/paginas-montadas.test.tsx`, no `verify` e no CI. Sete asserções,
nenhuma com lista fixa: rota sem teste, contrato de `GET /api/indicators`
divergindo do documento, história `✅ CONCLUÍDA` sem página montada, peça de
`.claude/` que o `CLAUDE.md` não menciona, **âncora morta em comentário** — ID
do plano, caminho de arquivo ou identificador em camelCase — e **gatilho de
reavaliação de `D-16` atingido sem registro** reprovam a suíte. **Rota
documentada e não servida NÃO é coberta** — esta linha afirmou que era até
17/08/2026, enquanto o cabeçalho do próprio teste dizia o contrário. **A guarda não substitui a fatia;
libera a atenção dela.**

**`npm run test:strip`** importa os módulos de `src/` sob
`--experimental-strip-types`, que é como a aplicação roda de verdade. **Nada de
`parameter property`, `enum`, `namespace` ou decorator em `src/`.**

**A `main` está protegida** pelo ruleset `main protegida`, ativo e com
`bypass_actors` **vazio** — nem o dono do repositório escapa. Quatro regras:
`pull_request`, `required_status_checks` (`verify` e `dados-sensiveis`),
`non_fast_forward` e `deletion`. É configuração do GitHub, não arquivo
versionado; leia o estado real com
`gh api repos/<owner>/<repo>/rulesets/<id>` em vez de confiar nesta linha.

> `non_fast_forward` **proíbe reescrever histórico**, e não há como contornar
> por PR: commits reescritos têm SHA novo, e um PR os somaria em vez de
> substituir. Reescrita exige desativar o ruleset, empurrar e reativar — e o
> `PUT` da API **precisa reenviar o objeto inteiro**, porque mandar só
> `enforcement` zera as regras e deixa a proteção vazia parecendo ativa. Medido
> em 18/08/2026, ao limpar 12 mensagens de commit.

**Ao acrescentar skill, rule, hook, workflow ou regra de permissão, atualize
este bloco.** O hook de alinhamento avisa **e a suíte reprova**; quem escreve é
você.

## Marcos de tooling — o que criar, e quando

A estrutura `.claude/` foi deliberadamente mantida mínima. Skill e subagent
escritos antes de existir repetição observada viram adivinhação do próprio
processo e são abandonados. Os gatilhos abaixo são objetivos.

| Gatilho | O que criar | Por quê agora e não antes |
|---|---|---|
| ~~**Ao concluir `H-13`**~~ | ~~Skill `novo-indicador`~~ | ✅ **Criada em 06/08/2026**, ao fechar `H-13`. Saiu da repetição real de `H-09` a `H-13`, com o formato já estabilizado — e com a omissão sistemática da rota como motivo principal |
| ~~**Antes de iniciar a Fase 3** (`H-24`)~~ | ~~Subagent de review para manipulação de XML~~ | ✅ **Criado em 11/08/2026** como `revisor-xml`, antes da primeira linha de `H-24`. `H-24` tem **11** casos-limite — 8 no plano original, mais 3 que a própria revisão acrescentou (linha auto-fechada, célula ausente recebendo data, fórmula compartilhada) — e o custo de errar é a planilha da empresa. **Pagou-se na primeira invocação**: reprovou por dois defeitos reais, um deles gerando XML malformado, o outro reproduzindo A-56 no caso mais provável |
| ~~**Ao concluir `H-20`**~~ | ~~Skill `nova-pagina`~~ | ✅ **Criada em 07/08/2026**, ao fechar `H-20`. Cinco páginas de `H-16` a `H-20` com o mesmo padrão — consumir rota → respeitar filtros globais → estado vazio explícito → nunca calcular no cliente —, e as mesmas coisas fora do plano toda vez. `H-22` foi a primeira história conduzida por ela |
| **Ao acumular 20 `session_id` distintos** em `data/instrucoes-carregadas.log` | Conferir se cada rule dispara | As três de 31/08/2026 levaram ~1750 palavras do `CLAUDE.md` e **nada prova que carregam**. Rule que nunca apareça com `path_glob_match` ou volta para cá, ou tem o glob consertado — rule que não dispara não economizou contexto, escondeu a instrução. Se as cinco dispararem, o hook vira só observabilidade e esta linha sai. **Não virou asserção em `tests/repo/`** de propósito: dependeria de arquivo em `data/`, que é gitignored, e foi assim que o CI reprovou em `H-49` |
| **Se aparecer a aba `2027`** | Reexecutar `H-01` | `python3 tools/profile_workbook.py`, depois `tools/build_fixtures.py`. As abas `2025` e `2024` provam que **o esquema muda entre anos**. Risco R-14 |
| **Nunca** | Subagents para paralelizar o backlog | O caminho crítico é uma cadeia sequencial de 18 sessões (`docs/07-plano-entrega.md §3`). Fan-out não encurta |

## Convenções

- Identificadores em **inglês**; textos de interface e mensagens de erro em
  **pt-br** (o usuário final é brasileiro e não é técnico).
- **Comentários:** a régua está em `.claude/rules/comentarios.md` e carrega
  sozinha ao tocar `src/`, `web/` ou `tests/`. Não repita nada dela aqui.
- Toda regra classificatória precisa de teste com os valores concretos das
  tabelas de decisão. Os 43 casos obrigatórios estão em
  `docs/08-qualidade-operacao.md §1.3`.

## Comandos

```bash
nvm use             # Node 22.23.2, conforme .nvmrc
npm run verify      # guard + dados-sensiveis + strip-types + lint + typecheck + test + build
npm test            # Vitest
npm run dev         # servidor (5173) + interface (5174), no mesmo terminal
npm run dev:server  # só a API, em 5173
npm run dev:web     # só a interface, em 5174
python3 tools/profile_workbook.py "<caminho.xlsx>" /tmp/saida.json   # reperfilar
```

> `node: bad option` **não é erro de código**: o shell herdou um Node abaixo de
> `engines`. Prefixe `nvm use &&` — o `nvm use` não persiste entre chamadas.

> **Depois de `git switch` com o `dev` no ar, reinicie o `npm run dev`.**
> Medido duas vezes em 07/08/2026: o `node --watch` continuou servindo o código
> da branch anterior — primeiro `GET /api/health` sem o campo `today`, depois
> `GET /api/processes` respondendo `404` com a rota já em disco. O git troca os
> arquivos de uma vez, e o observador não vê o que precisa. **`touch` resolveu
> no primeiro caso e não no segundo**; só derrubar e subir o processo é
> confiável. Como aqui é branch por história, trocar de branch com o `dev`
> rodando é rotina, e o sintoma — interface quebrando contra um contrato que o
> código já cumpre — aponta para o lugar errado.

**Para conferir uma história contra a planilha real** — passo obrigatório antes
de fechar —, monte o script no scratchpad e use `tools/carregar-planilha.mjs`,
em vez de repetir o preâmbulo de `initStore`. O exemplo de uso está no cabeçalho
do próprio arquivo. Rode da raiz do projeto, com `node --experimental-strip-types`.

## Protocolo de fatia — obrigatório ao iniciar qualquer história

**Antes de escrever a primeira linha de código de uma história, apresente ao
usuário o checklist abaixo e aguarde.** Não é formalidade: é o momento em que
um defeito do plano ainda custa uma conversa em vez de um retrabalho. Foi
assim que o erro de `H-27` (trocar `styleId` em vez de `fillId`) apareceu antes
de virar código.

Use **`/fatia H-NN`**: a skill monta o gabarito já com o contrato da história,
os casos-limite obrigatórios e as linhas da rastreabilidade.

Regras do protocolo:

1. **Todos os itens vêm do plano**, copiados, não inventados. Se algo não
   estiver lá, é divergência — reporte na última seção.
2. **A seção "Divergências" nunca é omitida.** Se não houver, escreva
   "nenhuma". Se houver, **pare e aguarde decisão** — não implemente contornando.
3. **"Fora desta fatia" é obrigatório.** Impede que a história cresça e vire G.
4. Use `TodoWrite` em paralelo, para o acompanhamento durante a execução.
5. Ao concluir, invoque **`/fechar-historia H-NN`** — ele roda o portão, percorre
   a *definition of done*, atualiza os três documentos e imprime a prova.
