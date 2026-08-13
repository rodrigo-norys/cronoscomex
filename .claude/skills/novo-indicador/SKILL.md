---
name: novo-indicador
description: Abre um indicador IND-NN do CronosComex com o ciclo completo já montado — função pura no domínio, teste com os valores da tabela de decisão, campo no contrato de GET /api/indicators e a conferência contra a planilha real. Carrega as armadilhas medidas em H-09 a H-13, para que não sejam redescobertas. Use ao implementar qualquer indicador novo.
when_to_use: Quando o usuário disser "implementa o IND-14", "falta o indicador de X", "acrescenta o campo na rota de indicadores" ou invocar /novo-indicador IND-NN. Dentro de uma história, use DEPOIS de /fatia H-NN — a fatia abre a história, esta skill conduz cada indicador dela.
argument-hint: '[IND-NN]'
---

## Por que esta skill existe

**Uma omissão que se repetiu cinco vezes.** `src/http/routes/indicators.ts` ficou
de fora da lista de arquivos de `H-09` a `H-13`, sempre — indicador calculado e
não servido não existe para o usuário. A skill fixa os quatro passos e carrega as
armadilhas já medidas, para que não sejam redescobertas.

## O indicador, direto da matriz de rastreabilidade

A regra formalizada é esta. **Não a reescreva**: se ela parecer errada, é
divergência e para a implementação.

!`grep -F "| $ARGUMENTS |" docs/09-rastreabilidade.md`

## O requisito de origem

!`grep -F "| $ARGUMENTS |" docs/02-requisitos.md`

## Onde ele aparece no contrato da API

O campo e o bloco já estão fixados em `docs/05-contratos-api.md`. O nome, o
tipo e a posição vêm de lá — não invente nem renomeie.

!`grep -n -- "$ARGUMENTS" docs/05-contratos-api.md`

## Casos-limite obrigatórios que o citam

!`grep -F -- "$ARGUMENTS" docs/08-qualidade-operacao.md`

## O que a rota já serve hoje

!`sed -n '/export interface IndicatorsCounts/,/^}/p' src/http/routes/indicators.ts`

---

## O ciclo — quatro passos, nesta ordem

Foi o mesmo em `H-09`, `H-10`, `H-11`, `H-12` e `H-13`. O passo 3 é o que
some.

**1. Função pura em `src/domain/indicators.ts`.** Recebe
`readonly Process[]` e, quando a regra tem calendário, um `today: Date` **já
ancorado em UTC**. Nunca lê arquivo, nunca consulta relógio, nunca conhece HTTP.
Se precisar de aritmética de data, use `addDays`, `diffDays`, `isWithin` e
`isoWeekEnd` de `date-window.ts` — não reimplemente.

**2. Teste em `tests/domain/indicators-<bloco>.test.ts`**, com os **valores
concretos** da tabela de decisão e dos casos-limite acima. Sempre inclua o teste
de **conjunto vazio** — ele é o que separa "zero medido" de "campo não
calculado".

**3. Campo em `src/http/routes/indicators.ts` E no teste dela.**
`GET /api/indicators` **está completo desde `H-13`** — os 21 indicadores em
escopo. Ele nasceu parcial em `H-09` e cresceu bloco a bloco, nunca preenchendo
com zero o que ainda não calculava. O teste que assegurava a ausência dos últimos
dois campos virou o inverso: **fixa a lista completa das chaves**, e campo que
entre sem passar pelo contrato quebra a suíte.
**Este passo foi omitido da lista de arquivos do backlog em `H-09`, `H-10`,
`H-11`, `H-12` e `H-13` — cinco vezes seguidas.** A omissão é sistemática, não
acidente. Um indicador calculado e não servido não existe para o usuário.
Confira as duas pontas: o campo no `interface` e a chamada na montagem do corpo.

**4. Conferência contra a planilha real**, antes de fechar. Rode a cadeia de
ingestão e imprima o valor. Um indicador que devolve `0` precisa ser **provado**
zero medido — foi assim que `IND-16` se confirmou: o RG mais recente do arquivo
era de seis dias antes, e passando esse dia como `today` a função devolvia `3`.

O cartão na interface **não** é deste ciclo: vive na história de UI
correspondente (`H-16` a `H-21`), listada na coluna "Histórias" da matriz acima.

**Ao acrescentar indicador ou alerta, confira quem o exibe.** Servir não é
entregar: a cadeia é domínio → rota → **tela**, e o plano erra no último elo
com regularidade — quatro vezes até aqui. `IND-13`, `IND-17` e `IND-20` eram
servidos em `rankings.goods`, `.agents` e `.responsible` e **nenhuma página os
consumia**; com eles se perdiam duas correções de auditoria inteiras, o
`bazarShare` de A-34 e o `overdueCount` de A-27. `IND-21` segue sem tela **de
propósito** — bloqueado por ausência de dado na origem (A-65).

---

## Armadilhas medidas — todas custaram caro uma vez

**`null` não é `0`, e `0` não é "não calculado".** Média ou fração de conjunto
vazio é `null` (A-42). `documentaryLeadTime.averageDays` é `null` com amostra
vazia porque zero dias afirmaria documento enviado no mesmo dia do registro;
`bazarShare` é `null` sem mercadoria preenchida. E campo ainda não implementado
**não entra na resposta zerado** — some do JSON até existir.

**Exclusão se conta, nunca se silencia** (A-30). Se a regra descarta linhas,
o número de descartadas faz parte do resultado. `IND-22` devolve
`excludedNegative` e `excludedIncomplete` ao lado de `sampleSize` porque a média
veio de 15,6% da base — sem isso, o número mente por omissão. Medido na planilha
real: **1 intervalo negativo e 547 pares incompletos, para 101 válidos**.

**Quebra de tempo ordena por amostra; ranking de volume ordena por volume.** As
duas perguntas divergem, e a diferença é medida: dos 509 grupos de cliente, 425
não têm nenhum par completo de datas, então ordenar a quebra de IND-22 por
volume encheria o topo de traços e empurraria a média para fora do corte. Por
isso `leadTimeByGroup` ordena por `sampleSize` desc, desempatando por `count` e
pela chave. **E ela não corta:** quem corta não pode ser quem conta — a rota
precisa do total para anunciar quantos grupos ficaram de fora, e um teto no
domínio apagaria esse número antes de alguém exibi-lo.

**`diffDays` não arredonda, e isso é deliberado.** Toda data do domínio é
meia-noite UTC — `serialToDate` trunca o serial do Excel com `Math.floor`, e
`today` monta a âncora a partir do dia civil —, então a diferença é inteira
**por construção**. Um `Math.round` ali mascararia o dia em que a invariante
quebrasse. A média de IND-22 é que leva uma casa decimal.

**`eta2 = null` nunca satisfaz condição de calendário** (A-20). Data ausente não
é data vencida nem data no intervalo.

**Nem toda janela é um intervalo fechado.** `isWithin` existe e é o reflexo
natural — e está **errado** em `IND-14`, cuja condição é `eta2 <= hoje+10`, sem
piso, nunca `hoje <= eta2 <= hoje+10`. Um intervalo fechado excluiria a carga que
já chegou sem documento, o caso mais grave. Pergunte se a janela tem piso antes
de usar `isWithin`. Há teste com `eta2 = 2025-01-01` fixando isso.

**A cor nunca infere o status, e o status nunca infere a cor.** São campos
independentes (regra inviolável 4). `IND-06` conta apenas `customsChannel`
vermelho; texto "CANAL VERMELHO" em `STATUS` vira anomalia, não canal (A-06).
E `indefinido` não conta: não saber a cor não é saber que ela não é vermelha.

**Regra que já existe não se reimplementa.** `isOverdue(process, today)` é a
regra única de atraso, em `src/domain/indicators.ts`; `IND-15`, `ALE-01` e o
`overdueCount` do ranking de agentes são apresentações dela. Duas implementações
divergem no primeiro ajuste. **`hasPendingDocs` é o par equivalente para A-08**,
extraído em `H-14` pelo mesmo motivo: IND-14 e ALE-02 são a mesma condição, e
ALE-02 precisa da lista, não da contagem.

**O fuso entra em um único ponto.** `today(tz)`, em `src/domain/date-window.ts`,
é chamado **na rota**: converte o instante corrente para o dia civil no fuso e o
devolve **ancorado em UTC**, igual às datas da planilha. Daí para baixo nada mais
sabe de fuso — por isso `isoWeekEnd` e `arrivingThisWeek` **não** recebem `tz`.
Converter para `America/Sao_Paulo` empurraria toda data para o dia anterior.
Aceitar fuso no domínio abriria a conversão que TD-03 proíbe.

**Cruzamento com a categoria costuma ser necessário na prática.** `IND-16`
ganhou `∧ category = 'desembaracado'` por causa de **uma** linha da foto 2
(A-29); o arquivo real tem **três**. Se a regra fala de conclusão, confira se
ela realmente exige o status, ou só a data.

---

## O que fazer agora

Apresente o plano abaixo e **aguarde**, se este indicador abre trabalho novo.
Dentro de uma história já fatiada, siga direto — o protocolo já foi cumprido.

```markdown
## $ARGUMENTS — <nome do indicador>

**Regra:** <copiada da matriz, não reescrita>
**Bloco no contrato:** `counts.<campo>` | primeiro nível | ranking

### A fazer
- [ ] `src/domain/indicators.ts` — `<assinatura>`
- [ ] `tests/domain/indicators-<bloco>.test.ts` — <casos>
- [ ] `src/http/routes/indicators.ts` — campo no schema e na montagem
- [ ] `tests/http/indicators.test.ts` — o campo na resposta

### Casos-limite a cobrir com valor concreto
- [ ] conjunto vazio → <o que devolve, e por quê não é zero>
- [ ] <caso da tabela> → <resultado>

### Divergências
- <nenhuma | descrição + o que proponho>
```

Ao terminar: `npm run verify`, conferência contra a planilha real, e
`/fechar-historia H-NN` quando o indicador fechar a história.
