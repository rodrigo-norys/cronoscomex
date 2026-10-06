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
4. **A cor nunca infere a CATEGORIA.** São campos independentes em TD-01, e o
   classificador não lê cor. Medido: 66 linhas com STATUS vazio, 1 linha branca.
   **`D-49` emendou a redação — que era "nunca infere o status" — e o alcance, e
   `D-54` o estendeu:** três cartões da Página Início contam por cor (IND-24,
   IND-26 e IND-27), por ordem do usuário. O que não mudou é o que a regra sempre
   protegeu: o filtro Categoria, a coluna da Página Operacional e a conferência
   de A-12 continuam vindo do STATUS, e as duas leituras divergem de propósito —
   medido em `D-54`, "Desembaraçados" dá 480 pela categoria e 482 pela cor.
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
    > escopo. Gravar data em célula **sem formato** altera também `xl/styles.xml`,
    > de forma estritamente aditiva (TD-05.1, passo 5b) — mas **essa condição não
    > ocorre no arquivo real**: medido em 17/09/2026 (`E-24`), escrever numa
    > célula de data **ausente** deixa `styles.xml` idêntico, porque o surgeon
    > reusa o `xf` que a coluna já tem. As três abas fora de escopo seguem
    > idênticas em qualquer caso.

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
- **<!-- conta:chaves-de-cor -->9<!-- /conta --> chaves de cor**, cobrindo 100% das linhas — em `config/color-map.json`
- Zero REF duplicada, zero REF vazia
- `DOCS ENVIADOS` preenchida em apenas **20,7%** das linhas
- Uma mesma cor vem de **vários `styleId`** — por isso a escrita de cor troca
  `fillId`, nunca `styleId` (ver A-49 e TD-05.1)

## Stack — versões fixadas, verificadas em 03/08/2026

| Camada | Versão |
|---|---|
| Node | **<!-- conta:versao[node] -->22.23.2<!-- /conta -->** LTS em `.nvmrc`; `engines` aceita `>=22.12.0 <23` |
| TypeScript | <!-- conta:versao[typescript] -->7.0.2<!-- /conta --> (fallback declarado: 5.9.3, se a build falhar) |
| Fastify | <!-- conta:versao[fastify] -->5.12.1<!-- /conta --> |
| fflate | <!-- conta:versao[fflate] -->0.8.3<!-- /conta --> — leitura e escrita cirúrgica no zip |
| chokidar | <!-- conta:versao[chokidar] -->5.0.0<!-- /conta --> |
| React · Vite | <!-- conta:versao[react] -->19.2.8<!-- /conta --> · <!-- conta:versao[vite] -->8.2.0<!-- /conta --> |
| Tailwind | <!-- conta:versao[tailwindcss] -->4.3.3<!-- /conta --> |
| Recharts | <!-- conta:versao[recharts] -->3.10.1<!-- /conta --> |
| Vitest | <!-- conta:versao[vitest] -->4.1.11<!-- /conta --> — patch de segurança, `D-52` |
| Testing Library · jsdom | <!-- conta:versao[@testing-library/react] -->16.3.2<!-- /conta --> · <!-- conta:versao[jsdom] -->30.0.1<!-- /conta --> — **só teste**, ver D-17 |
| Biome (lint + format) | <!-- conta:versao[@biomejs/biome] -->2.5.6<!-- /conta --> |

Não troque versão sem registrar o motivo. Não acrescente dependência que o
plano não prevê.

## Estrutura

```
src/domain/    funções puras — indicadores, alertas, classificação. Sem I/O
src/io/        leitura e escrita de .xlsx, watcher, histórico, fila de edições
src/app/       process-store, write-guard, config
src/http/      rotas Fastify (só serializam; não calculam)
web/           SPA React (só apresenta; não calcula)
tools/         apoio — perfilador da planilha (virada de ano), verificador
               de strip-types, gerador de fixtures, conferência de portas do
               portão, carga da planilha real e medição de tela num Chrome.
               Sem lista fechada: o cabeçalho de cada arquivo diz o que faz,
               e esta linha já esteve incompleta
config/        color-map.json e status-aliases.json, versionados; app.json e os
               dois mapas de negócio de H-48 — client-map.json e team-map.json —
               NÃO versionados, cada um com `.exemplo` versionado ao lado
tests/         domain/, io/, app/, http/, repo/, tools/, fixtures/ — ambiente `node`
web/tests/     componentes e casca — ambiente `jsdom`
scripts/       a partida em Windows (iniciar.cmd), o dev, a sincronização da
               branch `distribuicao`, e os apoios de porta e diagnóstico.
               Sem lista fechada, como tools/
docs/          o plano — os 11 numerados, mais adr/, e as auditorias que
               geraram os épicos posteriores
```

**A suíte tem dois projetos**, declarados em `vitest.config.ts`: `servidor` roda
em `node` e cobre `tests/`; `interface` roda em `jsdom` com o plugin do React e
cobre `web/tests/`. Ambiente único obrigaria a carregar `jsdom` para centenas de
testes que não o usam, ou a deixar a interface sem teste.

## Estado

**<!-- conta:historias-concluidas -->113<!-- /conta --> das <!-- conta:historias -->114<!-- /conta --> histórias estão concluídas**, e o único épico aberto é `E16`:
resta `H-101`, o autoajuste de largura de coluna, **escrita e não executada por
escolha do usuário**. O plano original e os épicos posteriores fecharam — a
crônica está em `docs/README.md`, e o que cada história aprendeu, no bloco
`✅ CONCLUÍDA` dela em `docs/06-backlog.md`: procure lá antes de reabrir decisão.

**Código sem história não é, por si, defeito aqui.** `E13` foi escrito depois do
código por omissão (`D-26`); `E17` e `E18`, por método, escolha do usuário
(`D-69`) — escrever depois dá o agrupamento e a rastreabilidade, e abre mão do
checklist antes do código. O levantamento sai de
`node tools/levantar-retroativo.mjs --desde H-NN`.

> O histórico do git cita a numeração anterior a 19/08/2026 — a branch e os
> commits de `H-35` dizem `H-44` —, e a `main` protegida não deixa reescrevê-lo.

Ao concluir uma história, marque-a em `docs/06-backlog.md` e verifique se algum
status de `docs/09-rastreabilidade.md` mudou. **Este bloco diz só o que está
aberto**: não transcreva para cá o que a história já registrou lá.

### Pendências abertas

Nenhuma bloqueia implementação; fecham antes da entrega ao operador. O detalhe e
o gatilho de cada uma estão em `docs/README.md` — ao fechar uma, remova a linha
aqui e lá.

| # | O que falta |
|---|---|
| **PD-09** | decidir se a frase de `StatusBanner.tsx` recua — `P-15` não é medível nesta instalação |

## Onde a regra já aprendida foi parar

Este arquivo é carregado em **toda** sessão; os destinos abaixo, só no momento
do uso. Nada aqui repete o que está lá — abra quando a linha disser.

- **O que se aprendeu ao fechar cada história** — número medido, defeito
  encontrado, decisão tomada — está no bloco `✅ CONCLUÍDA` da história em
  `docs/06-backlog.md`. Abra antes de reabrir decisão que pareça em aberto.
- **Regra de tela:** `/nova-pagina`. **Regra de indicador ou alerta:**
  `/novo-indicador`. A `/abrir-historia` despacha para a certa por teste textual
  na lista de arquivos.
- **Invariante de um módulo:** cabeçalho do próprio arquivo em `src/`.
- **Por que uma guarda existe:** cabeçalho do próprio script, hook, workflow ou
  teste.
- **Medição num Chrome real:** `tools/medir-navegador.mjs` — o cabeçalho diz como
  rodar, e `medirCenarios` sobe, espera e fecha a aplicação para N cenários.
- **Fases, grafo, caminho crítico e riscos:** `docs/07-plano-entrega.md`.
- **Cobertura por indicador e alerta, e histórias órfãs:**
  `docs/09-rastreabilidade.md` §4.
- **Contratos de rota e códigos de erro:** `docs/05-contratos-api.md`.
- **Testes, ingestão, observabilidade, LGPD e a régua de comentários:**
  `docs/08-qualidade-operacao.md`.
- **Decisões do usuário, já tomadas e não re-litigáveis:**
  `docs/10-governanca.md` §5.
- **De onde veio cada épico posterior ao plano** — `E9` de
  a revisão de estilo de 18/08/2026 (`D-48`), `E10` de `docs/uso/RESULTADO.md`, `E11` de
  a proposta do mockup Cronos Console, 31/08/2026 (`D-48`). A ordem entre eles vive no cabeçalho de cada
  épico, e **não** em `docs/07-plano-entrega.md`, que só alcança o plano
  original.

## Infraestrutura de agente

O que vigora está aqui; o **porquê** de cada peça está no cabeçalho dela, e a
história da configuração, em `docs/adr/0007-governanca-da-configuracao-do-agente.md`.

**Git.** Remote **público** em `origin`. Nunca commite na `main`: branch
`H-NN/<tipo>-<descrição>` por história, ou `<tipo>/<escopo>-<descrição>` fora
dela. Escopos: `domain`, `io`, `app`, `http`, `web`, `tools`, `config`, `docs`,
`claude`, `repo`. Mensagem em pt-br, sem o tipo `test`. **O merge é no GitHub**:
`branch → commits → push → PR → merge lá` — mesclar na `main` antes do push mata o
PR. `delete_branch_on_merge` está ligado, e PR empilhado se reaponta sozinho.
**Um commit por ponto verde** — a preocupação fecha **e** o portão passa; ofereça o
commit quando uma camada da cadeia fechar, sem esperar o fim da história.

> Portão reprovado: **rode de novo antes de agir**. Há um teste intermitente em
> `src/io/` que devolve `exit=1` com zero testes falhando (`H-12`).

**A branch `distribuicao`** é a árvore da máquina do operador: não recebe PR, e
só se sincroniza a partir da `main` mesclada, com
`node --experimental-strip-types scripts/sincronizar-distribuicao.ts`. O que
entra, e os mapas de negócio que não vão, estão em `.claude/rules/distribuicao.md`.

**Skills** (`.claude/skills/`) — o corpo só carrega na invocação.

| Skill | Conduz |
|---|---|
| `/abrir-historia H-NN` | abre a história com contrato e casos-limite, e despacha para a skill certa |
| `/nova-pagina` · `/novo-indicador IND-NN` | uma página; um indicador pelas quatro camadas |
| `/fechar-historia H-NN` | o portão, a *definition of done*, os três documentos e a prova |
| `/sugerir-commits` · `/sugerir-prs` | os commits e os PRs, com **um aceite só** |
| `/avaliar-claude` | capacidade faltando em `.claude/`; só o usuário a invoca |

**Subagentes** (`.claude/agents/`), todos sem `Edit` nem `Write` e com
`model: opus` fixado. `revisor-xml`: **obrigatório antes de commitar** mudança em
`src/io/xlsx-surgeon.ts`, `src/app/write-guard.ts` ou código que reescreva bytes
do `.xlsx`, invocado sem o raciocínio de quem escreveu. `revisor-estilo`: a casca
mais as páginas de uma vez, contra `docs/estilizacao/corpus-estilo.md`.
`revisor-docs`: mudança em `docs/`, `.claude/` e nos `.md` da raiz, **só sob
demanda do usuário**.

**Rules** (`.claude/rules/`) — entram em contexto quando se **lê** arquivo que casa
o `paths:`; criar arquivo novo não as carrega. Regra inviolável não vai para lá.
São <!-- conta:rules -->6<!-- /conta -->: `comentarios.md` (`src/`, `web/`, `tests/`),
`documentacao.md` (`docs/` e `.md` da raiz), `escrita-xlsx.md` (o surgeon e o
write-guard), `microcopia.md` (`web/src/**/*.tsx`), `operacao-windows.md`
(`scripts/`) e `distribuicao.md` (o script de sincronização e os `.exemplo`).

**Hooks** (`.claude/hooks/`). `guard-dados-sensiveis.sh` (`PreToolUse`) barra o
que publicaria dado de cliente e as formas de git negadas, e falha **fechado**;
`test-guard.sh` é a regressão dele, no `verify`. `conferir-distribuicao.sh` avisa
que a `distribuicao` ficou para trás; `conferir-alinhamento.sh`, que este arquivo
não cita uma peça; `registrar-instrucoes.sh` registra em `data/` cada instrução
carregada. Os três falham **aberto**.

**Permissões** (`.claude/settings.json`). Negados: `curl`, `wget`, todo
`mcp__*`, leitura ou escrita de `*.xlsx` e `*.jpeg` da raiz, `gh pr merge`, e o
git que perde trabalho ou reescreve história — force-push, `reset --hard`,
`clean`, `checkout --`, `switch -f`, `rebase`, `commit --amend`,
`commit --no-verify`, `branch -D`, `gh repo delete`. `npm install` e `npm ci`
pedem confirmação; `gh pr create` também, nesta máquina, pelo settings global. O
resto do git roda sem prompt — quem protege é o portão antes do commit e a `main`
protegida depois. **Mudar permissão ou ruleset é do dono:** entregue o JSON ou o
comando literal. Skill libera comando só por `allowed-tools`, e a régua da
injeção está em `.claude/rules/documentacao.md`.

**Gates.** No GitHub, `verify.yml` e `dados-sensiveis.yml` são obrigatórios na
`main` — ruleset `main protegida`, sem bypass, com branch atualizada exigida;
`verify-windows.yml` roda e **não** é obrigatório. Os detalhes, e por que não é
matriz, estão em `docs/08-qualidade-operacao.md` §5.2. No repositório, quatro
guardas reprovam a suíte, cada uma com o alcance no cabeçalho:
`tests/repo/contratos.test.ts` e `web/tests/paginas-montadas.test.tsx`
(documento↔código, inclusive peça de `.claude/` que este arquivo não cita),
`tests/repo/documentacao.test.ts` (documento contra documento) e
`tests/repo/contagens.test.ts` (número em região contra a fonte; o número fora de
região é avisado no diff por `--nuas`). **A guarda não substitui a fatia; libera
a atenção dela.** `npm run test:strip` importa `src/` como a aplicação roda:
**nada de `parameter property`, `enum`, `namespace` ou decorator em `src/`.**

**Ao acrescentar skill, rule, hook, workflow ou regra de permissão, atualize
este bloco.** O hook de alinhamento avisa **e a suíte reprova**; quem escreve é
você.

## Marcos de tooling — o que criar, e quando

A estrutura `.claude/` foi deliberadamente mantida mínima. Skill e subagent
escritos antes de existir repetição observada viram adivinhação do próprio
processo e são abandonados. Os gatilhos abaixo são objetivos. Os cinco já
atingidos — de `novo-indicador` ao par `documentacao.test.ts`/`revisor-docs` —
estão na ADR-0007, com o que cada um ensinou.

| Gatilho | O que criar | Por que agora e não antes |
|---|---|---|
| **Se aparecer a aba `2027`** | Reexecutar `H-01` | `python3 tools/profile_workbook.py`, depois `tools/build_fixtures.py`. As abas `2025` e `2024` provam que **o esquema muda entre anos**. Risco R-14 |
| **Nunca** | Subagents para paralelizar o backlog | O caminho crítico é uma cadeia sequencial de 18 sessões (`docs/07-plano-entrega.md §3`). Fan-out não encurta |

## Convenções

- Identificadores em **inglês**; textos de interface e mensagens de erro em
  **pt-br** (o usuário final é brasileiro e não é técnico).
- **Comentários:** a régua está em `.claude/rules/comentarios.md` e carrega
  sozinha ao tocar `src/`, `web/` ou `tests/`. Não repita nada dela aqui.
- **Texto que o operador lê:** a régua está em `.claude/rules/microcopia.md` e
  carrega ao tocar `web/src/`. Pelo mesmo motivo, não repita nada dela aqui.
- Toda regra classificatória precisa de teste com os valores concretos das
  tabelas de decisão. Os <!-- conta:casos-obrigatorios -->44<!-- /conta --> casos obrigatórios estão em
  `docs/08-qualidade-operacao.md §1.3`.

## Comandos

```bash
nvm use             # o Node de .nvmrc
npm run verify      # o portão inteiro — a ORDEM está em scripts.verify, no package.json
npm test            # Vitest
npm run dev         # servidor (5173) + interface (5174), no mesmo terminal
npm run dev:server  # só a API, em 5173
npm run dev:web     # só a interface, em 5174
python3 tools/profile_workbook.py "<caminho.xlsx>" /tmp/saida.json   # reperfilar
```

> **A ORDEM dos passos do portão vive em `scripts.verify`, no `package.json`,
> e só lá.** Este arquivo já a afirmou em três lugares, e acrescentar um passo
> em 17/09/2026 tornou dois deles falsos de uma vez — achados por raciocínio, e
> não por teste: a guarda de documentação cobrava o total de histórias em prosa,
> não a composição do portão.

> **`npm install` reprova com `Cannot read properties of null (reading 'edgesOut')`,
> e não é o `package.json`.** É o **npm 10.9.8**, o que vem com o Node de
> `.nvmrc`, resolvendo o conjunto de pares de `vitest` neste grafo — `vite@8`
> traz `@vitejs/devtools-vitest`, que declara `vitest` como par, e o ciclo o
> derruba. **Medido em 18/09/2026, e independe da versão do Vitest:** falha
> igual com 4.1.10 e 4.1.11, e só quando o par precisa ser resolvido do zero —
> por isso o erro aparece ao TROCAR uma versão, e não no dia a dia. Use
> `npx --yes npm@11 install`, que resolve sem contorno nenhum. **`--legacy-peer-deps`
> também passa e NÃO deve ser usado**: ele monta outra árvore. O CI não é
> afetado, porque `npm ci` instala o que o lock diz sem resolver par nenhum.

> `node: bad option` **não é erro de código**: o shell herdou um Node abaixo de
> `engines`. Prefixe `nvm use &&` — o `nvm use` não persiste entre chamadas.

> **Para consultar a aplicação no ar, `node -e` com `fetch`** — `curl` e `wget`
> são negados. O mesmo vale para esperar: `sleep` em foreground é bloqueado.

> **Depois de `git switch` com o `dev` no ar, reinicie o `npm run dev`.**
> Medido duas vezes em 07/08/2026: o `node --watch` continuou servindo o código
> da branch anterior — primeiro `GET /api/health` sem o campo `today`, depois
> `GET /api/processes` respondendo `404` com a rota já em disco. O git troca os
> arquivos de uma vez, e o observador não vê o que precisa. **`touch` resolveu
> no primeiro caso e não no segundo**; só derrubar e subir o processo é
> confiável. Como aqui é branch por história, trocar de branch com o `dev`
> rodando é rotina, e o sintoma — interface quebrando contra um contrato que o
> código já cumpre — aponta para o lugar errado.

> **Não rode `npm run build` nem `npm run verify` com o `dev` no ar.** O
> `vite build` compartilha o `cacheDir` com o servidor de desenvolvimento e
> apaga `node_modules/.vite/deps`: o cliente passa a receber `504` nos módulos
> otimizados, `#root` fica vazio e **nada é registrado em log nenhum**. Medido
> em 08/09/2026, ao validar `H-87`. Derrube o `dev` antes do portão, ou reinicie
> depois dele.

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

Use **`/abrir-historia H-NN`**: a skill monta o gabarito já com o contrato da
história, os casos-limite obrigatórios e as linhas da rastreabilidade.

Regras do protocolo:

1. **Todos os itens vêm do plano**, copiados, não inventados. Se algo não
   estiver lá, é divergência — reporte na última seção.
2. **A seção "Divergências" nunca é omitida.** Se não houver, escreva
   "nenhuma". Se houver, **pare e aguarde decisão** — não implemente contornando.
3. **"Fora desta fatia" é obrigatório.** Impede que a história cresça e vire G.
4. Use `TodoWrite` em paralelo, para o acompanhamento durante a execução.
5. Ao concluir, invoque **`/fechar-historia H-NN`** — ele roda o portão, percorre
   a *definition of done*, atualiza os três documentos e imprime a prova.
