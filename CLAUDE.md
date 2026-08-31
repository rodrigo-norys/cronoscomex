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
tools/         perfilador (virada de ano), verificador de strip-types, e
               carregar-planilha.mjs para conferência contra o arquivo real
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

**Todas as fases do plano estão concluídas.** Fases 0 e 1 fecharam primeiro;
na Fase 2, **`H-09` a `H-14`** — o épico E3 (indicadores e alertas) inteiro —,
**mais `H-32`, antecipada**
porque era dependência declarada de `H-15` e não existia, **`H-15`, que abriu o
épico E4, `H-16`, a primeira página de dado, `H-17`, que entrega também
`GET /api/processes`, `H-18`, os três rankings, `H-19`, que fecha as duas
últimas regras sem tela, `H-20`, a fila de trabalho, e `H-22`, o detalhe.**
**A Fase 3 fechou inteira** — `H-23`, a fila de edições, `H-24`, a escrita
cirúrgica no `.xlsx`, `H-25`, as seis defesas de integridade, e `H-26`, o
comando de aplicação —, **e a Fase 4 também, com `H-27`, sua única história: os
campos codificados em cor, que fecha o caminho crítico.** **`H-28` fechou o
histórico**, destravando as duas que faltavam, **`H-21` fechou a Página
Histórico — a última de interface: as sete páginas estão montadas** — e
**`H-29` fechou ALE-06, o alerta de processos parados.** **`H-30` fechou a
Fase 2 e, com ela, o plano original** — entrega o atalho de execução e serve
`GET /*`, a última rota documentada sem dono. **Ela é a única história fechada
com verificação pendente:** o `iniciar.cmd` só é exercível na máquina Windows do
operador, e `PD-06` guarda a lista do que falta conferir lá.

**`H-33` trocou o leitor de `.xlsx` para `fflate`**, e com ele o `exceljs` saiu
do projeto; **`H-34` fechou o caminho da planilha configurável pela tela**, e
**`H-35` fechou a primeira execução numa máquina limpa** — o atalho deixou de
barrar por configuração ausente, e o inventário da configuração passou a dizer
de onde vem cada valor. As três foram acrescentadas depois do plano e não têm
fase atribuída. **O plano original e tudo que veio depois dele estão fechados.**

**O épico E8 nasceu e fechou no mesmo dia, e veio de uso, não de auditoria:**
`H-37` entrega o seletor de arquivos do sistema — o servidor abre o diálogo,
porque o navegador não expõe caminho —, e `H-38` fecha o link ausente que deixava
a tela de configuração inalcançável desde `H-34`.

**A numeração foi refeita para acompanhar a ordem do backlog**, em 19/08/2026:
as duas de operação assumiram `H-35` e `H-36`, o épico da configuração assumiu
`E8` com `H-37` e `H-38`, e o de estilização passou a `E9`, com `H-39`–`H-47`.
**O histórico do git continua citando os números antigos** — a branch e os
commits de `H-35` dizem `H-44` —, e não há como alinhá-lo: a `main` protegida
proíbe reescrever histórico.

**`H-36` fechou o épico E7, e com ele tudo que não é estilização:** o painel diz
em que etapa a partida está e reconfere sem reexecutar o atalho.

**`H-39` abriu o épico E9, de estilização** — `H-39` a `H-47`, nascidas da
auditoria de `docs/estilizacao/RESULTADO.md`. Ela vinha primeiro por
dependência: é a única que decide vocabulário de tema, e **agora que ele está
fixado em `web/src/index.css`, as oito seguintes são substituição mecânica.**
**`H-40` a `H-42` migraram tudo que consome cor, e a guarda
`tests/repo/estilo.test.ts` impede o passo bruto de voltar — a onda 2 fechou.**
**`H-42` corrigiu também um defeito de `H-30`** que a verificação dela encontrou:
`GET /*` servia os assets como `text/html`, e a tela ficava branca sem erro.
**E9 está parada em `H-43`**, e as ondas dela estão no cabeçalho do épico, em
`docs/06-backlog.md` — `docs/07-plano-entrega.md` cobre as fases do plano
original, e não alcança E9 nem E10.

**O épico E10 nasceu do uso, não de auditoria**, em 31/08/2026: sete histórias
levantadas por `docs/uso/RESULTADO.md`, com o operador usando o painel para
trabalhar. **`H-48` abriu o épico** — os dois mapas de negócio fora do
repositório, porque nome real de cliente e de pessoa da equipe são configuração e
não código. **A próxima é `H-49`**, e ela e `H-50` consomem os mapas; as quatro
seguintes são independentes entre si. E9 e E10 estão abertos ao mesmo tempo, e
não se bloqueiam.

> **A escrita é o ponto onde errar custa a planilha da empresa.** O subagent
> `revisor-xml` existe desde 11/08/2026 — invoque-o antes de commitar qualquer
> mudança em `src/io/xlsx-surgeon.ts`, em `src/app/write-guard.ts` ou em código
> que reescreva bytes do `.xlsx`. Em `H-24` ele reprovou na primeira invocação;
> em `H-25`, **três das quatro**; em `H-26`, **seis das sete**; em `H-27`, **três
> das quatro**. Vários defeitos foram introduzidos pelas correções dos
> anteriores. **Reinvoque-o depois de corrigir**, não só antes de commitar.
>
> **Ele acha defeito em código já commitado.** Em `H-27` pegou uma leitura de
> atributo que varria o elemento inteiro em vez da tag de abertura — defeito
> silencioso em `writeCell` desde `H-24`. Mande o módulo inteiro, não só o
> trecho novo.
>
> **Ele revisa a interface também.** Quatro dos seis defeitos de `H-26` estavam
> na tela: mensagens que afirmavam o que o código não sabia. Ao mudar o que a
> aplicação **diz** ao operador sobre a escrita, mande junto.

Ao concluir uma história, marque-a em `docs/06-backlog.md` e verifique se algum
status de `docs/09-rastreabilidade.md` mudou.

### Pendências abertas

Não bloqueiam a implementação. Fechar antes da entrega ao operador.

> **`H-30` fechou sem elas, e o gatilho passou a ser a instalação — evento, não
> história.** Nenhuma história futura as carrega: `H-33` e `H-34` não tocam
> Windows nem o Excel real. Deixá-las apontando para uma história fechada
> repetiria o que aconteceu com `PD-05` entre 14 e 17/08/2026, quando ficou sem
> dono por `H-26` ter fechado sem o arquivo. **A primeira instalação na máquina
> do operador é o momento em que as três linhas abaixo se resolvem juntas** —
> incluindo a verificação do `iniciar.cmd`, que `H-30` não pôde exercer.

| # | Pendência | Quando fechar |
|---|---|---|
| **PD-06** | `scripts/iniciar.cmd` foi entregue por `H-30` e reescrito por `H-35`. **A primeira execução real, em 19/08/2026, fechou o essencial:** duplo clique, primeira execução sem `config/app.json` — que agora só informa e a partida segue — e a compilação sob demanda aceita. Com ela caíram também as **três correções que estavam sem reexecução**: o disparo de `main()` por `pathToFileURL`, a espera pela porta em `scripts/esperar-porta.mjs`, e o abridor com `/min` em vez de `start /b`. **Sobram sete itens**, e um deles tem falha conhecida: **o diálogo de escolha de arquivo de `H-37` não abriu** — o cursor girou sem janela nenhuma, e a correção (o `Form` dono passou a ser exibido e a opção `windowsHide` saiu) **ainda não foi testada**; `scripts/diagnostico-seletor.mjs` isola as quatro causas possíveis em quatro passos. Os outros seis nunca foram exercidos: Node ausente · Node abaixo da 22 · janela fechada sem processo órfão · porta ocupada · segunda execução com a aplicação no ar · caminho com espaços e acentos · e os três caminhos infelizes da compilação (recusar, máquina sem internet, `node_modules` ausente). **A lição desta pendência já se pagou:** a aplicação NUNCA subiu em Windows desde `H-30`, porque o disparo de `main()` comparava `import.meta.url` com `file://` concatenado a `process.argv[1]` — verdadeiro em Linux por acidente da barra inicial, falso em todo caminho `C:\...`. O processo carregava os módulos e saía com código **zero**, sem erro e sem escutar. Modo de falha mudo, num trecho que nenhum teste alcança: **o único ambiente onde a aplicação roda de verdade é o único que a suíte não cobre.** Guardado desde então por `tests/http/partida.test.ts`. Suspeitas ainda abertas, cada uma virando correção no `.cmd`: a detecção de "já está no ar" depende do espaçamento de colunas do `netstat`; o `PATH` de uma janela aberta antes de instalar o Node não enxerga o executável novo; e o caminho do projeto com acento aparece em algumas mensagens, em code page 850 | **Próxima sessão na máquina do operador.** Comece pelo diálogo de arquivo, que é o único com defeito conhecido; depois percorra os seis restantes. Cada falha é correção no `.cmd`, não história nova |
| **PD-01** | `config/app.json` aponta para `CONTROLE DOS EMBARQUE.xlsx` na **raiz do projeto**, usado para validar a partida em `H-02`. Na máquina Windows precisa do caminho real da pasta sincronizada (`C:\Users\...\OneDrive - <org>\...`). O arquivo está no `.gitignore`, então o caminho de desenvolvimento não vaza. **`H-34` deu a saída, em 18/08/2026**, e **`H-35` tirou o último passo manual, em 19/08/2026**: o arquivo de configuração não precisa mais existir antes — ele nasce ao salvar o caminho na tela | **Primeira instalação na máquina do operador.** Não exige copiar nem editar arquivo nenhum: o passo 4 do `README.md` é apontar a planilha na tela, e continua existindo porque alguém precisa apontá-la uma vez |
| **PD-05** | Falta confirmar **uma premissa de formato**: que o Excel emite o atributo `i` apenas na PRIMEIRA entrada de `xl/calcChain.xml`, com as seguintes herdando a aba. É o que a especificação OOXML descreve e o que `removeFromCalcChain` pressupõe ao repassar o índice, mas nunca foi observado num arquivo que o Excel tenha gerado sozinho — as três entradas de `tests/fixtures/formulas.xlsx` foram escolhidas por nós. **O resto já está coberto**, e a redação anterior desta linha descrevia como lacuna algo que deixou de ser: a fixture leva `l="1"` na segunda entrada desde 14/08/2026 — a forma com atributo além de `r`, que era exatamente o que escondia o defeito de repasse do `i` —, os outros 18 componentes do zip vêm do Excel real, e `removeFromCalcChain` **não enumera atributos**: preserva o bloco inteiro, então `s`, `t` e `a` viajam junto sem tratamento. A saída foi **aberta no Excel real em 13/08/2026**, sem aviso de reparo e com o recálculo produzindo as datas dependentes. **Risco baixo, e medido:** em 17/08/2026 a planilha real não tem `xl/calcChain.xml` — o Excel só emite a parte quando há fórmula, e nenhuma das quatro abas tem uma. O código é hoje inalcançável em produção, e passa a ser alcançável no dia em que alguém escrever uma fórmula na aba `2026` | **Qualquer Excel à mão**, e leva dois minutos: planilha nova, uma fórmula, salvar, copiar para `tests/fixtures/`. Não depende da máquina do operador — foi por isso que ela ficou passiva entre 14 e 18/08/2026. Se a via for o Excel Online, **confira a forma da cadeia** antes de tratar o arquivo como representativo: supor representatividade é o que produziu o defeito anterior |

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

## Infraestrutura de agente

**Versionamento.** Há repositório git, com remote **privado** em `origin`.
Nunca commite direto na `main`: branch por história (`H-NN/<tipo>-<descrição>`)
ou, fora de história, `<tipo>/<escopo>-<descrição>`. Escopos: `domain`, `io`,
`app`, `http`, `web`, `tools`, `config`, `docs`, `claude`, `repo`. Mensagem em
pt-br, sem o tipo `test`.

**O merge acontece no GitHub, não localmente.** `branch → commits → push da
branch → PR → merge por lá`. Mesclar na `main` antes do push **mata o PR**.

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
token nas sessões que não tocam o assunto. `comentarios.md` carrega a régua de
comentários em `src/`, `web/` e `tests/`; `documentacao.md` carrega a de números
afirmados em prosa, ao tocar `docs/` ou um `.md` da raiz — essa segunda carrega
em quase toda sessão, porque o protocolo de fatia lê `docs/`, e por isso é
curta. **Não é garantia**: rule é contexto,
não configuração aplicada, não é reinjetada depois do `/compact`, e o gatilho é
leitura, não escrita. Quem garante é a asserção em `tests/repo/`. Regra
inviolável não vai para cá.

**Hooks** (`.claude/hooks/`). `guard-dados-sensiveis.sh` (`PreToolUse`) bloqueia
o que pode publicar dado de cliente e falha **fechado**.
`conferir-alinhamento.sh` (`ConfigChange`) avisa quando existe skill, subagente
ou hook que este arquivo não menciona, **e quando uma peça já criada continua
com o gatilho em aberto na tabela de marcos** — mencionar e marcar são coisas
diferentes. Falha **aberto**. `test-guard.sh` é a regressão do guard e roda
**primeiro** no `npm run verify` — exige `bash` e `jq`.

**Permissões** (`.claude/settings.json`). `git add`, `git push`, `npm install` e
`npm ci` pedem confirmação. `curl`, `wget`, force-push e leitura ou escrita de
`*.xlsx` e `*.jpeg` da raiz estão negados. O modo bypass está desabilitado.
**`mcp__*` está negado — todo MCP, de todo servidor** (D-19 e D-20 em
`docs/10-governanca.md`).

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
npm run verify      # guard + strip-types + lint + typecheck + test + build
npm test            # Vitest
npm run dev         # servidor (5173) + interface (5174), no mesmo terminal
npm run dev:server  # só a API, em 5173
npm run dev:web     # só a interface, em 5174
python3 tools/profile_workbook.py "<caminho.xlsx>" saida.json   # reperfilar
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
