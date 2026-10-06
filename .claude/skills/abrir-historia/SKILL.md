---
name: abrir-historia
description: Abre uma história do backlog do CronosComex montando o checklist do protocolo de fatia, com o contrato fixado, os critérios de aceite e os casos-limite obrigatórios já embutidos. Use ao iniciar qualquer história H-NN, antes de escrever a primeira linha de código.
when_to_use: Quando o usuário disser "vamos para a H-12", "iniciar H-13", "próxima história" ou invocar /abrir-historia H-NN.
argument-hint: '[H-NN]'
allowed-tools: Bash(node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs *)
---

*(As seções vêm de `tools/abrir-historia.mjs`, o único comando que esta skill
pré-aprova: fora do modo automático, o Claude Code recusa injeção com expansão de
shell, `awk` ou `sed` lendo arquivo, e a skill abortava — medido em 01/10/2026.)*

## A história, direto do backlog

!`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs historia "$ARGUMENTS"`

## Casos-limite obrigatórios atribuídos a esta história

Extraídos de `docs/08-qualidade-operacao.md` §1.3 — os !`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs total-casos` casos obrigatórios do
projeto. Cada linha abaixo precisa virar um teste com o **valor concreto** que
aparece nela.

!`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs casos "$ARGUMENTS"`

## Linhas da matriz de rastreabilidade que citam esta história

!`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs matriz "$ARGUMENTS"`

## Confira a lista de arquivos ANTES de aceitá-la

**A lista de arquivos do backlog está incompleta em 7 das histórias já
fechadas** — `H-09` a `H-13`, `H-14` e `H-32`, as sete listadas abaixo.
**O 6 vinha da contagem original**, e sobreviveu ao sétimo caso. Não é acidente: quem escreveu o plano pensou na regra, não na
fiação. Responda às quatro perguntas abaixo **contra a lista da história**, e
tudo que faltar entra como divergência.

| Se a história… | …então a lista precisa de |
|---|---|
| cria ou altera **rota** | `src/http/routes/<nome>.ts` · `src/http/server.ts` (registro) · `tests/http/<nome>.test.ts` |
| acrescenta campo a **rota existente** | a própria rota **e** o teste dela — o teste costuma fixar a lista de chaves |
| altera **tipo exportado** de `src/domain/` | todo consumidor **e** as fábricas de estado dos testes que o constroem |
| acrescenta **dependência ou script** | `package.json` · o log da §5 de `docs/10-governanca.md` (`.claude/rules/dependencias.md`) · `CLAUDE.md`, bloco de infraestrutura, se for script do portão |

Casos reais que essas perguntas teriam pego:

- `H-09` a `H-13`: `src/http/routes/indicators.ts` omitido **cinco vezes**. Em
  `H-13`, `tests/http/indicators.test.ts` continha uma asserção que reprovaria
- `H-14`: faltavam `src/http/server.ts` e `tests/http/alerts.test.ts` — rota que
  ninguém registra não existe
- `H-32`: faltava `tests/http/health.test.ts`, e três fábricas de estado
  quebraram no `typecheck` ao ganhar campo obrigatório

**A lista completa não basta quando a história serve rota.** Estas perguntas
conferem os *arquivos*; a conferência do *contrato* — cada campo da resposta
contra a fonte que a história cria — está duas seções abaixo, e é ela que pega
o campo que nenhum arquivo da lista sabe produzir.

## Identificadores que o contrato cita e o código ainda não tem

!`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs identificadores "$ARGUMENTS"`

Cada nome acima é **uma de duas coisas**, e a diferença decide a fatia:

- **coisa a criar** — a história existe para trazê-lo. Siga.
- **divergência** — o contrato supõe que já existe, e não existe. **Pare e
  reporte**, como manda o protocolo.

Em `H-27` a lista teria trazido `responsible`, `customsChannel` e
`importerOutsideRj`: o contrato mandava enfileirá-los, e `EDITABLE_FIELDS` não
os tinha — o `write-guard` recusaria a fila **inteira**, inclusive as edições de
texto do operador. Quem pegou foi o usuário, à mão, na abertura. É a divergência
mais cara que uma fatia já encontrou, e o custo de perdê-la seria descobri-la
com a implementação pronta.

**A lista tem ruído, e isso é aceitável:** ela existe para você julgar item a
item, não para reprovar nada. Nome em prosa que passe pelo filtro custa uma
linha de leitura; identificador ausente que passe despercebido custa a fatia.

## O contrato da ROTA que esta história serve

!`node ${CLAUDE_PROJECT_DIR}/tools/abrir-historia.mjs contrato "$ARGUMENTS"`

**Confira campo a campo: cada um é derivável do que esta história cria?**

O bloco do backlog traz o contrato da **função**; este traz o da **resposta**.
Eles divergem, e é no segundo que mora o campo que ninguém sabe de onde tirar.

Em `H-28` isto teria trazido `canalVermelho`. O contrato da rota servia três
medidas por mês; o evento que o backlog mandava gravar tinha `from` e `to`,
ambos `StatusCategory`. O canal vem da **cor** (IND-06), campo independente do
status (regra inviolável 4) — nenhuma agregação daqueles dois o produz. A
divergência apareceu **depois** do checklist, por leitura manual, e o custo de
perdê-la não seria retrabalho: o histórico é append-only e sem retroatividade,
então mês não gravado não se recupera.

O casamento é por prefixo `/api/<primeiro-segmento>`, vindo do texto da história
e do nome do arquivo de rota. Traz seções vizinhas — `H-27` recebe também
`GET /api/processes`, que ela não altera. Mesmo ruído aceitável da lista acima.
**Erra para menos quando o arquivo não é nomeado pelo caminho**: `filter-options.ts`
serve `/api/filters/options`, e só aparece se a própria história citar a rota.

## Despacho — qual skill conduz esta história

Teste textual, não julgamento. Responda olhando a lista de arquivos e o
contrato que a fatia acabou de imprimir:

| Se a lista de arquivos contém… | …invoque, depois deste checklist |
|---|---|
| `web/src/pages/*.tsx` | **`/nova-pagina H-NN`** |
| `src/http/routes/indicators.ts`, ou o contrato acrescenta campo a `GET /api/indicators` | **`/novo-indicador IND-NN`** |
| nenhum dos dois | nenhuma; siga direto |

**Ao despachar, imprima os caminhos** que a skill obriga — os arquivos, não só
o nome dela. Skill invocada em silêncio não informa ninguém.

Isto existe porque o julgamento falhou: `H-19` acrescentou campo a
`GET /api/indicators` — gatilho declarado da `/novo-indicador` — e a skill não
foi invocada, porque "indicador novo" foi lido como "IND-NN novo". O teste
acima não depende de leitura: ou o caminho está na lista, ou não está.

## O que fazer agora

Monte o checklist abaixo e **aguarde**. Não escreva código antes da resposta.

Todos os itens vêm do material acima, copiados — não inventados. O que não
estiver lá é divergência, e divergência **para** a implementação.

```markdown
## H-NN — <título>

**Objetivo:** <a frase do backlog>
**Tamanho:** P/M/G · **Depende de:** H-XX ✅ · **Fase:** N

### Contrato (já fixado — não redefinir)
<assinatura, rota ou schema, copiado do backlog>

### A fazer
- [ ] `caminho/do/arquivo.ts` — o que muda
- [ ] `caminho/do/teste.test.ts` — o que cobre
- [ ] <marque com *(divergência N)* todo arquivo que a conferência acrescentou>

### Critérios de aceite
- [ ] Dado ... Quando ... Então ...

### Casos-limite a cobrir com teste
- [ ] `<valor concreto>` → `<resultado esperado>`

### Fora desta fatia
- <o que NÃO fazer aqui, e em qual história vai>

### Divergências encontradas no plano
- <nenhuma | descrição + o que proponho>
```

## Regras que valem durante toda a fatia

- **Confira a decisão `D-NN` que originou a história.** Elas envelhecem: em
  08/09/2026 as três determinações de `D-29` estavam erradas, e uma delas teria
  produzido o defeito que ela existia para evitar — a lateral dizendo 170 com a
  tabela em 650. Decisão citada pelo backlog é material da fatia, não pano de
  fundo.
- Use `TodoWrite` em paralelo, para acompanhamento.
- Confira `node --version`. Se não devolver a versão de `.nvmrc`, prefixe `nvm use &&` em
  todo comando que execute Node — o shell reinicia a cada chamada.
- Nenhuma regra de negócio fora de `src/domain/`. O Biome quebra a build se a
  fronteira for violada.
- **Nada de `parameter property`, `enum`, `namespace` ou decorator em `src/`.**
  A aplicação roda com `--experimental-strip-types`, que só REMOVE tipos. O
  passo `npm run test:strip` do portão pega, mas custa menos não escrever.
- Ao conferir contra a planilha real — passo obrigatório antes de fechar —, use
  `tools/carregar-planilha.mjs` em vez de repetir o preâmbulo de `initStore`.
- Ao terminar, invoque `/fechar-historia H-NN`.
