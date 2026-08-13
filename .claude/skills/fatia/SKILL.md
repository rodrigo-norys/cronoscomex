---
name: fatia
description: Abre uma história do backlog do CronosComex montando o checklist do protocolo de fatia, com o contrato fixado, os critérios de aceite e os casos-limite obrigatórios já embutidos. Use ao iniciar qualquer história H-NN, antes de escrever a primeira linha de código.
when_to_use: Quando o usuário disser "vamos para a H-12", "iniciar H-13", "próxima história" ou invocar /fatia H-NN.
argument-hint: '[H-NN]'
---

## A história, direto do backlog

!`sed -n "/^### $ARGUMENTS /,/^### H-/p" docs/06-backlog.md | head -n -1`

## Casos-limite obrigatórios atribuídos a esta história

Extraídos de `docs/08-qualidade-operacao.md` §1.3 — os 43 casos obrigatórios do
projeto. Cada linha abaixo precisa virar um teste com o **valor concreto** que
aparece nela.

!`grep -F "| $ARGUMENTS |" docs/08-qualidade-operacao.md || echo "NENHUM caso obrigatório atribuído a esta história em §1.3 — os 43 casos cobrem 11 das 33 histórias, e a ausência aqui é esperada, não defeito. Os casos-limite do backlog continuam obrigatórios."`

## Linhas da matriz de rastreabilidade que citam esta história

!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`

## Confira a lista de arquivos ANTES de aceitá-la

**A lista de arquivos do backlog está incompleta em 6 das histórias já
fechadas.** Não é acidente: quem escreveu o plano pensou na regra, não na
fiação. Responda às quatro perguntas abaixo **contra a lista da história**, e
tudo que faltar entra como divergência.

| Se a história… | …então a lista precisa de |
|---|---|
| cria ou altera **rota** | `src/http/routes/<nome>.ts` · `src/http/server.ts` (registro) · `tests/http/<nome>.test.ts` |
| acrescenta campo a **rota existente** | a própria rota **e** o teste dela — o teste costuma fixar a lista de chaves |
| altera **tipo exportado** de `src/domain/` | todo consumidor **e** as fábricas de estado dos testes que o constroem |
| acrescenta **dependência ou script** | `package.json` · `CLAUDE.md` (tabela de stack ou bloco de infraestrutura) |

Casos reais que essas perguntas teriam pego:

- `H-09` a `H-13`: `src/http/routes/indicators.ts` omitido **cinco vezes**. Em
  `H-13`, `tests/http/indicators.test.ts` continha uma asserção que reprovaria
- `H-14`: faltavam `src/http/server.ts` e `tests/http/alerts.test.ts` — rota que
  ninguém registra não existe
- `H-32`: faltava `tests/http/health.test.ts`, e três fábricas de estado
  quebraram no `typecheck` ao ganhar campo obrigatório

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

- Use `TodoWrite` em paralelo, para acompanhamento.
- Confira `node --version`. Se não devolver `v22.23.2`, prefixe `nvm use &&` em
  todo comando que execute Node — o shell reinicia a cada chamada.
- Nenhuma regra de negócio fora de `src/domain/`. O Biome quebra a build se a
  fronteira for violada.
- **Nada de `parameter property`, `enum`, `namespace` ou decorator em `src/`.**
  A aplicação roda com `--experimental-strip-types`, que só REMOVE tipos. O
  passo `npm run test:strip` do portão pega, mas custa menos não escrever.
- Ao conferir contra a planilha real — passo obrigatório antes de fechar —, use
  `tools/carregar-planilha.mjs` em vez de repetir o preâmbulo de `initStore`.
- Ao terminar, invoque `/fechar-historia H-NN`.
