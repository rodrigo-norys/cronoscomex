# CronosComex

Painel operacional de desembaraço aduaneiro. Aplicação **local**: lê a planilha
`.xlsx` do operador, calcula indicadores, e grava de volta no arquivo sob
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
   classificador não lê cor (A-54). Os cartões de IND-24, IND-26 e IND-27 da
   Página Início contam por cor, por ordem do usuário (`D-49`, `D-54`); o filtro
   Categoria, a coluna da Página Operacional e a conferência de A-12 seguem vindo
   do STATUS, e as duas leituras divergem de propósito.
5. **`src/domain/` não importa `src/io/`, `src/app/`, `src/http/` nem `web/`.**
   O lint verifica e quebra a build.
6. **Nenhuma regra de negócio no cliente ou nas rotas.** Só em `src/domain/`.
7. **Nenhum teste toca estado real** — nem a planilha, nem `data/`, nem
   `config/app.json`. A suíte roda sobre `tests/fixtures/*.xlsx`, versionadas, e
   sobre diretório temporário para tudo que a aplicação grava. Todo caminho que a
   aplicação escreve é ponto de injeção, e **dois recusam o padrão sob
   `NODE_ENV=test`** — `history-store` (`H-28`) e `saveWorkbookPath` (`H-34`); o
   porquê está no cabeçalho de cada um.
8. **Nenhum dado pessoal em log.** Processos são referenciados por `ref` e
   `sourceRow` — nunca por nome de cliente, importador ou mercadoria.
9. **Nunca use `workbook.xlsx.writeFile()` do ExcelJS.** Ele perde formatação
   condicional e validações silenciosamente, e pode corromper o arquivo. A
   escrita é cirúrgica no XML — ver ADR-0004.
10. **Nunca processe, indexe, exponha nem registre dados das abas fora de
    escopo.** Só a aba `2026`. A leitura usa fluxo e **pula** as demais abas
    sem consumir suas linhas; nenhuma célula delas vira `RawRow`, chega à API,
    à interface ou ao log. A aba `CNPJ` contém credenciais de terceiros.
    O porquê da redação, e o que se provou sobre o isolamento, está na ADR-0004.

## Antes de escrever código

Leia, nesta ordem:

1. `docs/README.md` — índice e estado atual
2. `docs/perfilamento/RESULTADO.md` — os fatos **medidos** sobre a planilha real
3. `docs/06-backlog.md` — a história que você vai implementar (H-NN)
4. `docs/03-modelo-dados.md` — as tabelas de decisão TD-01 a TD-06 e TD-05.1

Para regra de negócio, consulte `docs/01-auditoria-especificacao.md`: os <!-- conta:achados -->65<!-- /conta -->
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

## Stack

Node e Fastify, com fflate e chokidar, no servidor; React, Vite, Tailwind e
Recharts na interface; Vitest, Testing Library e jsdom nos testes; Biome no lint.
**As versões exatas vivem no `package.json` e no `.nvmrc`.** Não troque versão nem
acrescente dependência sem registrar o motivo — a régua, e a armadilha do
`npm install`, estão em `.claude/rules/dependencias.md`, que carrega ao abrir o
`package.json`.

## Estrutura

`src/domain/` funções puras, sem I/O · `src/io/` o `.xlsx`, o watcher, o
histórico e a fila · `src/app/` process-store, write-guard e config · `src/http/`
rotas que só serializam · `web/` SPA que só apresenta · `tools/` e `scripts/`, o
cabeçalho de cada arquivo diz o que faz · `docs/` o plano. Em `config/`,
`color-map.json` e `status-aliases.json` são versionados; `app.json`,
`client-map.json` e `team-map.json` **não**, cada um com `.exemplo` ao lado. A
suíte tem dois projetos em `vitest.config.ts`: `servidor` (`node`, `tests/`) e
`interface` (`jsdom`, `web/tests/`).

## Estado

**<!-- conta:historias-concluidas -->113<!-- /conta --> das <!-- conta:historias -->114<!-- /conta --> histórias estão concluídas**, e o único épico aberto é `E16`:
resta `H-101`, o autoajuste de largura de coluna, **escrita e não executada por
escolha do usuário**. A crônica está em `docs/README.md`, e o que cada história
aprendeu, no bloco `✅ CONCLUÍDA` dela em `docs/06-backlog.md` — procure lá antes
de reabrir decisão. **Este bloco diz só o que está aberto.**

**Código sem história não é, por si, defeito aqui** — `E13` por omissão (`D-26`),
`E17` e `E18` por método (`D-69`); o levantamento sai de
`node tools/levantar-retroativo.mjs --desde H-NN`. O git cita a numeração anterior
a 19/08/2026: a branch e os commits de `H-35` dizem `H-44`.

### Pendências abertas

**Abertas: <!-- conta:pendencias-abertas -->0<!-- /conta -->.** Pendência nova entra aqui como linha da
tabela `| **PD-NN** | o que falta |`, com o detalhe e o gatilho em
`docs/README.md`; ao fechar, sai daqui e fica marcada fechada lá.

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
- **De onde veio cada épico posterior ao plano, e a ordem entre eles:**
  `docs/README.md` e o cabeçalho de cada épico — **não** `docs/07-plano-entrega.md`,
  que só alcança o plano original.

## Infraestrutura de agente

O que vigora está aqui; o **porquê** de cada peça está no cabeçalho dela, e a
história, em `docs/adr/0007-governanca-da-configuracao-do-agente.md`.

**Git.** Remote **público**. Nunca commite na `main`; o merge é no GitHub, por PR
— mesclar na `main` antes do push mata o PR. **Um commit por ponto verde**: a
preocupação fecha **e** o portão passa — ofereça o commit quando uma camada da
cadeia fechar, sem esperar o fim da história. Commit e PR saem sempre por
`/sugerir-commits` e `/sugerir-prs`, que trazem a nomenclatura de branch e os
escopos. Portão reprovado: **rode de novo antes de agir** — há um teste
intermitente em `src/io/` que devolve `exit=1` com zero testes falhando (`H-12`).
A branch `distribuicao` não recebe PR e só se sincroniza a partir da `main`
mesclada (`.claude/rules/distribuicao.md`).

**Peças.** Skills: `/abrir-historia`, `/nova-pagina`, `/novo-indicador`,
`/fechar-historia`, `/sugerir-commits`, `/sugerir-prs` e `/avaliar-claude` — esta,
só o usuário invoca. Subagentes, sem `Edit` nem `Write` e com `model: opus`:
`revisor-xml`, **obrigatório antes de commitar** mudança em
`src/io/xlsx-surgeon.ts`, `src/app/write-guard.ts` ou código que reescreva bytes do
`.xlsx`; `revisor-estilo`; e `revisor-docs`, **só sob demanda do usuário**.
As <!-- conta:rules -->7<!-- /conta --> rules são **orientação, e podem não carregar** — `comentarios.md`,
`dependencias.md`, `documentacao.md`, `escrita-xlsx.md`, `microcopia.md`,
`operacao-windows.md` e `distribuicao.md`. O que nelas não pode falhar tem guarda,
cuja reprovação cita a rule; regra inviolável não vai para lá (`D-71`). Hooks: `guard-dados-sensiveis.sh`, que falha **fechado**, com a
regressão em `test-guard.sh`; `conferir-distribuicao.sh`,
`conferir-alinhamento.sh` e `registrar-instrucoes.sh`, que falham aberto.

**Permissões e gates.** O que é negado está em `.claude/settings.json` e no guard;
**mudar permissão ou ruleset é do dono** — entregue o JSON ou o comando literal.
Na `main`, `verify` e `dados-sensiveis` são obrigatórios, sem bypass e com branch
atualizada (`docs/08-qualidade-operacao.md` §5.2). Quatro guardas reprovam a
suíte, cada uma com o alcance no cabeçalho: `tests/repo/contratos.test.ts`,
`web/tests/paginas-montadas.test.tsx`, `tests/repo/documentacao.test.ts` e
`tests/repo/contagens.test.ts`. **A guarda não substitui a fatia; libera a atenção
dela.** Nada de `parameter property`, `enum`, `namespace` ou decorator em `src/`:
`npm run test:strip` o importa como a aplicação roda.

**Ao acrescentar skill, rule, hook, workflow ou regra de permissão, atualize
este bloco.** O hook de alinhamento avisa **e a suíte reprova**.

## Marcos de tooling — o que criar, e quando

Peça de `.claude/` só nasce de repetição observada, por gatilho objetivo. Os
gatilhos já atingidos estão na ADR-0007, com o que cada um ensinou.

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
  tabelas de decisão. Os <!-- conta:casos-obrigatorios -->41<!-- /conta --> casos obrigatórios estão em
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

> `node: bad option` **não é erro de código**: o shell herdou um Node abaixo de
> `engines`. Prefixe `nvm use &&` — o `nvm use` não persiste entre chamadas.

> **Para consultar a aplicação no ar, `node -e` com `fetch`** — `curl` e `wget`
> são negados. O mesmo vale para esperar: `sleep` em foreground é bloqueado.

> **Depois de `git switch` com o `dev` no ar, derrube e suba o `npm run dev`.** O
> `node --watch` segue servindo a branch anterior, e `touch` não basta.

> **O portão recusa rodar com o `dev` no ar** (`test:portas`): o build apagaria o
> cache do Vite que o `dev` usa. Derrube-o antes do `npm run verify`.

**Para conferir uma história contra a planilha real** — passo obrigatório antes
de fechar —, monte o script no scratchpad e use `tools/carregar-planilha.mjs`,
em vez de repetir o preâmbulo de `initStore`. O exemplo de uso está no cabeçalho
do próprio arquivo. Rode da raiz do projeto, com `node --experimental-strip-types`.

## Protocolo de fatia — obrigatório ao iniciar qualquer história

**Antes da primeira linha de código de uma história, invoque
`/abrir-historia H-NN`, apresente o checklist e aguarde** — é quando um defeito do
plano ainda custa uma conversa, e não um retrabalho. A skill traz as regras do
protocolo: itens copiados do plano, "Divergências" e "Fora desta fatia" nunca
omitidas, e parar diante de divergência. Ao concluir, `/fechar-historia H-NN`.
