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
**67 das 72 histórias concluídas.** O que cada uma aprendeu — número medido,
defeito encontrado, decisão tomada — está no bloco `✅ CONCLUÍDA` dela em
`docs/06-backlog.md`, e é lá que se procura antes de reabrir decisão que pareça
em aberto. **Este bloco diz só o que está aberto.**

**`E9` e `E10` fecharam em 01/09/2026.** Resta **um épico**:

- **`E11` — Casca redesenhada.** A onda 1 e a onda 2 fecharam — `H-57`, `H-58`,
  `H-59` e `H-60` —, e restam `H-61` a `H-65`, **nenhuma bloqueada**. `H-61` e
  `H-62` podem sair em paralelo. A paleta está entregue e medida: as seis
  correções de `docs/redesign/PROPOSTA.md §2.2` entraram em `H-57`, e o risco
  `R-16` fechou. As duas famílias vivem em `web/public/fonts/` desde `H-58` —
  **nenhuma requisição externa**, e o `LICENSE.txt` da OFL acompanha.

**A medição no navegador é `tools/medir-navegador.mjs`**, versionada em
01/09/2026 depois de ser reconstruída do zero em duas sessões. Ela sobe a
aplicação sobre uma fixture, com os três caminhos de escrita num diretório
temporário, e mede num Chrome real por CDP — largura, contraste com `oklch`
resolvido pelo navegador, paradas de tabulação, `forced-colors`,
`prefers-color-scheme` e a fonte-base do cenário "Muito grande". Rode com
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

> **`H-30` fechou sem elas, e o gatilho passou a ser a instalação — evento, não
> história.** Nenhuma história futura as carrega: `H-33` e `H-34` não tocam
> Windows nem o Excel real. Deixá-las apontando para uma história fechada
> repetiria o que aconteceu com `PD-05` entre 14 e 17/08/2026, quando ficou sem
> dono por `H-26` ter fechado sem o arquivo. **A primeira instalação na máquina
> do operador é o momento em que as três linhas abaixo se resolvem juntas** —
> incluindo a verificação do `iniciar.cmd`, que `H-30` não pôde exercer.

| # | Pendência | Quando fechar |
|---|---|---|
| **PD-06** | **A partida na máquina Windows, e ela já sobe.** Em 31/08/2026 a distribuição foi refeita do zero na máquina do operador e **sete itens fecharam**, incluindo o único que tinha defeito conhecido: **o diálogo de arquivo de `H-37` abre**, verificado pelo operador na sessão gráfica dele. Fecharam também a partida em si, Node ausente, Node abaixo da 22, segunda execução com a aplicação no ar, e a leitura da planilha real — 649 aceitas, 0 em quarentena, hash idêntico ao daqui. **Sobram três**, e um deles precisa de janela: janela fechada sem processo órfão · caminho com espaços e acentos · os três caminhos infelizes da compilação. Os detalhes, as suspeitas que restam e **por que teste de tela por SSH não vale** — a Sessão 0 não tem desktop — estão em `.claude/rules/operacao-windows.md` | **Próxima sessão na máquina do operador.** Os três restantes são de menor consequência que os sete já fechados; o `.cmd` está exercido no caminho que o operador usa todo dia |
| **PD-07** | **O resto de `VN-5` (forced colors), depois que a maior parte dele foi executada por emulação.** A pendência nasceu supondo que o procedimento exigia Windows, e **isso foi medido como falso em 31/08/2026**: o Chrome emula `forced-colors: active` no Linux, a media query casa e o UA substitui a paleta do autor do mesmo jeito — o que o procedimento pergunta não é que cor o tema pinta, e sim se o desenho sobrevive quando as cores do autor são descartadas. Quatro dos cinco alvos foram medidos: um reprovou e virou `H-72` — as sete abas ficam com a mesma borda, porque o UA pinta `border-transparent` —, e três passaram, dois deles **confirmando `H-44` e `H-45` em campo**. **Sobram três coisas, e cada uma por um motivo diferente:** (1) a paleta **nominal** do Windows — Aquático e os demais — e o par de temas claro e escuro do item 4, que é confirmação de segunda ordem; (2) o `ConflictDialog` do item 3(d), que só abre com a planilha real alterada, e é o **mesmo** item que `VN-3` deixou devendo; (3) o realce de linha do item 3(e), que precisa de **cursor real**: o Chrome headless não aplica `:hover` ao estilo computado nem ao render, e isso foi provado com um controle — um `<button>` com `hover:bg-*` também não muda, então não é defeito da aplicação | **Primeira instalação na máquina do operador**, junto de `PD-01`, `PD-05`, `PD-06` e `PD-08`. Os itens (2) e (3) não exigem Windows — exigem, respectivamente, uma planilha de teste alterada e um navegador com cursor; podem cair antes, em qualquer máquina com tela |
| **PD-08** | **Os dois mapas de negócio de `H-48` precisam ser enviados à parte, e nada no procedimento de instalação diz isso.** Eles estão no `.gitignore` e a distribuição leva só os `.exemplo`, então a máquina do operador chega sem eles — o campo Cliente já mostra a grafia da célula em vez do nome consolidado. Decidido em 31/08/2026: fica com envio manual, e a solução é reexaminada em momento oportuno. Os detalhes, e as duas afirmações do `README.md` da distribuição que mentem sobre isso, estão em `.claude/rules/distribuicao.md` | **Junto com a primeira instalação:** `scp config/client-map.json config/team-map.json` para `config\` na máquina do operador, e corrija o `README.md` da distribuição. **Repita a cópia toda vez que a regra de consolidação ou a equipe mudar** — nenhum aviso existe para lembrar |
| **PD-01** | `config/app.json` aponta para `CONTROLE DOS EMBARQUE.xlsx` na **raiz do projeto**, usado para validar a partida em `H-02`. Na máquina Windows precisa do caminho real da pasta sincronizada (`C:\Users\...\OneDrive - <org>\...`). O arquivo está no `.gitignore`, então o caminho de desenvolvimento não vaza. **`H-34` deu a saída, em 18/08/2026**, e **`H-35` tirou o último passo manual, em 19/08/2026**: o arquivo de configuração não precisa mais existir antes — ele nasce ao salvar o caminho na tela | **Primeira instalação na máquina do operador.** Não exige copiar nem editar arquivo nenhum: o passo 4 do `README.md` é apontar a planilha na tela, e continua existindo porque alguém precisa apontá-la uma vez |
| **PD-05** | **Falta confirmar uma premissa de formato:** que o Excel emite o atributo `i` apenas na PRIMEIRA entrada de `xl/calcChain.xml`. É o que a especificação OOXML descreve e o que `removeFromCalcChain` pressupõe, mas nunca foi observado num arquivo que o Excel tenha gerado sozinho. **Risco baixo, e medido:** a planilha real não tem `xl/calcChain.xml`, então o código é hoje inalcançável em produção. O que já está coberto, e por que, está em `.claude/rules/escrita-xlsx.md` | **Qualquer Excel à mão**, e leva dois minutos: planilha nova, uma fórmula, salvar, copiar para `tests/fixtures/`. Não depende da máquina do operador. Se a via for o Excel Online, **confira a forma da cadeia** antes de tratar o arquivo como representativo |

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

**A branch `distribuicao` é a árvore que vai para a máquina do operador** — 108
arquivos, sem `docs/`, `tests/`, `tools/` nem `.claude/`. Ela **não recebe PR**:
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
| `escrita-xlsx.md` | `xlsx-surgeon.ts`, `write-guard.ts` — o procedimento do `revisor-xml` e `PD-05` |
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
