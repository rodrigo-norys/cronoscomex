# Uso — o que a primeira operação real mediu

> **Origem do épico E10.** Levantado em 31/08/2026, depois de o operador usar o
> painel contra a planilha real de 2026. Não é auditoria de documento: é o que
> apareceu ao olhar a tela com a intenção de trabalhar. Doze observações, das
> quais **quatro eram perguntas** — respondidas na seção 1, sem escrever código —
> e as outras oito viraram as **sete histórias** da seção 7.
>
> **Nenhum nome próprio aqui.** Cliente, importador e pessoa da equipe são
> referidos por contagem e por papel. Os nomes vivem em `config/client-map.json`
> e `config/team-map.json`, que o `.gitignore` cobre — ver `H-48`.

Todos os números são medidos sobre a aba `2026`, **649 processos**, em
31/08/2026, pela via de `tools/carregar-planilha.mjs`.

---

## 1. As quatro perguntas, respondidas sem código

| Pergunta do operador | Resposta medida |
|---|---|
| O que o sistema entende como atrasado? | `ETA2 < hoje` **E** categoria ≠ `desembaracado` — `src/domain/indicators.ts`, `isOverdue`. Processo sem `ETA2` nunca satisfaz (A-20). Em 31/08/2026: **87** processos, sendo 77 `em_andamento` e 10 `em_desembaraco` |
| "Em desembaraço" conta pela célula branca? | **Não.** Vem de STATUS (coluna L) vazio — TD-01, regra 4 —, e são **32** processos. A planilha tem **1** linha branca, e ela está em `em_andamento`. A cor é lida só da coluna A (P-05), então célula vizinha branca não interfere |
| Qual é a métrica da Página Performance? | `registrationDate − docsSentDate`, em dias (IND-22, A-02). Média **12,5 d** sobre **101** processos; **547** excluídos por faltar uma das duas datas e **1** por intervalo negativo (A-30) |
| Dá para filtrar a Performance por importador e cliente? | **Já dá** — os onze filtros globais valem para toda rota marcada [F] (RF-18). O que falta é a tela dizer isso: `H-53` |

**Nenhuma das quatro virou história de cálculo.** Três eram o comportamento
correto mal comunicado, e a quarta era funcionalidade existente e invisível.

---

## 2. O campo CLT conta processo, não cliente

**Medido: 649 processos produzem 509 valores distintos em CLT.** A célula
guarda a referência do processo *daquele* cliente — o mesmo cliente aparece com
sufixo numérico crescente —, e por isso o ranking de clientes (IND-10) e a
quebra de tempo documental por cliente (IND-22) respondem a pergunta errada:
contam processos e chamam o resultado de cliente.

Agrupando pelo prefixo alfabético da chave, **os 509 grupos caem para 37**. A
distribuição:

| Faixa | Grupos | Processos |
|---|---:|---:|
| Grupos com 10 ou mais processos | 9 | 546 |
| Grupos com 2 a 9 processos | 12 | 50 |
| Grupos de 1 processo | 15 | 15 |
| Chave vazia | 1 | 38 |
| **Total** | **37** | **649** |

O maior grupo isolado tem **304** processos — 47% da base num único cliente.

**A regra de unificação é do negócio, não derivável do dado.** Dois grupos com
prefixos distintos podem ser o mesmo cliente, e um mesmo prefixo pode ser vários
clientes — medido: o prefixo de 62 processos corresponde a **três** clientes
diferentes, distinguíveis apenas pelo importador. Por isso o mapa é
configuração, e não heurística: `H-48` e `H-49`.

**Cobertura da regra fornecida pelo operador em 31/08/2026**, medida com o mapa
real em `H-48`: **11 clientes declarados**, cobrindo **466 dos 649 processos**.
As 509 chaves caem para **124** — 11 consolidadas e 113 intactas. Dois grupos
entraram por levarem o nome do cliente dentro do próprio texto, sob a mesma
regra que o operador já declarara para um terceiro prefixo.

Os **183 processos restantes permanecem como estão**, por duas decisões
distintas do operador — e a diferença entre elas importa:

| Motivo | Processos | Decisão |
|---|---:|---|
| Prefixo que cobre três clientes, separáveis só pelo importador | 62 | Não consolidar: nenhum dos três foi nomeado |
| Grupo sem regra declarada | 121 | Levar ao cliente antes de consolidar |

Os 121 estão em `CronosComex-clientes-a-confirmar.md`, gerado fora do
repositório em 31/08/2026 — 17 grupos, apresentados em 10 linhas porque oito
deles são códigos de um mesmo importador. Consolidar qualquer um por conta
própria seria adivinhar (regra inviolável 3).

---

## 3. A cor e o importador concordam sobre o responsável

O achado de maior consequência do levantamento, e o que dispensou uma decisão
que parecia arbitrária.

O responsável vinha **só** da cor da linha (TD-05, A-17): das 649, apenas
**165** carregam cor de responsável e **484** ficam em `indefinido`. O operador
descreveu uma regra paralela, por importador, que atribui **559** processos a
duas pessoas e deixa 90 sem regra — 55 num importador que não está em nenhuma
das duas listas, e 35 com o campo em branco.

> **Este parágrafo dizia `157` e `492` até 01/09/2026, e os dois estavam
> errados** — erro de aritmética, não de medição. A tabela logo abaixo, escrita
> na mesma sessão, sempre somou 36 + 72 + 9 + 13 + 35 = **165**, e TD-05 conta
> as mesmas 165 por chave de estilo desde `H-01` (120 azul + 31 + 5 roxo + 9
> bege). Conferido contra a planilha real em 01/09/2026, ao implementar `H-50`:
> `colaborador1` 120 · `colaborador2` 36 · `colaborador1_outros_clientes` 9 ·
> `indefinido` 484. **Nenhuma conclusão desta seção muda** — os 559, 48 e 42 são
> medidos por outro caminho e foram reconferidos com o mesmo valor. O número
> errado sobreviveu porque nenhuma frase dizia o que ele contava (rule
> `documentacao.md`), e `D-23` o repetiu de segunda mão.

**As duas fontes não se contradizem em nenhuma das 649 linhas:**

| Recorte | Processos | Cores de responsável presentes |
|---|---:|---|
| Importadores da lista A | 202 | Roxo 36 · **zero azul, zero bege** |
| Importadores da lista B | 357 | Azul 72 · Bege 9 · **zero roxo** |
| Importador sem regra declarada | 55 | Azul 13 · **zero roxo** |
| Importador em branco | 35 | Azul 35 · **zero roxo** |

Roxo ocorre **exclusivamente** em importador da lista A; azul e bege,
**exclusivamente** em importador da lista B. As demais linhas de cada recorte
são verdes, vermelhas, amarela ou branca — cores que não codificam responsável.

**Consequência:** a cor resolve os 90 casos que a lista de importadores não
alcança, sem adivinhação — os 48 com cor de responsável recebem a atribuição
que a cor já afirma, e os 42 restantes ficam sem responsável, visíveis. É o
desempate de `H-50`, e ele é derivado, não escolhido.

> **A regra inviolável 4 continua valendo.** A cor desempata o **responsável**,
> que ela já codifica desde TD-05. Ela não passa a inferir status em lugar
> nenhum.

---

## 4. O canal só existe para 482 das 649 linhas

O operador pediu canal verde e amarelo, além do vermelho já existente, com o
percentual dos três. A medição mostra por que os três não são simétricos:

| Cor | Linhas | O que codifica hoje |
|---|---:|---|
| Verde (dois tons) | 477 | Nada estruturado — o mapa registra "processo desembaraçado" na prosa e **não deriva campo** |
| Vermelho | 5 | `customsChannel: vermelho` (IND-06, A-06) |
| Amarelo | 1 | `importerOutsideRj: true` (A-38, D-02) |
| Azul · Roxo · Bege · Branco | 166 | Responsável, e nada de canal |

**A cor é um canal de informação único, disputado por três significados.** Uma
linha azul não pode ser simultaneamente verde: 166 processos não têm canal
conhecido, e afirmar `nenhum` para eles — como o mapa faz hoje — é dizer que se
sabe que não houve canal, quando não se sabe nada.

**Decisão do operador em 31/08/2026:** verde passa a valer canal verde; o
amarelo **mantém** o significado de D-02 e não vira canal amarelo. Logo o
percentual sai sobre as **482** linhas com canal conhecido — 477 verdes e 5
vermelhas —, e as outras 167 aparecem como não informado, contadas. É `H-51`.

---

## 5. Os cartões não dizem o que estão contando

A Página Inicial exibe doze números sem nenhuma janela temporal à vista. O
período existe — é o filtro global sobre `ETA2` (RF-17) —, mas vive na barra de
filtros, e um cartão zerado por recorte é indistinguível de um cartão zerado por
ausência de dado.

Faixas reais medidas em 31/08/2026:

| Campo | Primeira data | Última data | Preenchimento |
|---|---|---|---:|
| `ETA2` | 30/12/2025 | 09/09/2026 | 585 de 649 |
| `registrationDate` (RG) | 05/01/2026 | 31/07/2026 | 483 de 649 |
| `docsSentDate` | — | — | 134 de 649 |

**Duas datas diferentes respondem a duas perguntas diferentes.** "Quantos
chegaram desde fevereiro" é `ETA2`; "quantos desembaraçamos desde fevereiro" é
`registrationDate`. O cartão de desembaraçados hoje responde a primeira e é lido
como a segunda. `H-52` põe a janela em cada cartão e acrescenta a contagem por
RG, sem quebrar a conferência de A-12 — a soma das quatro categorias continua
fechando com o total, porque o cartão novo é adicional, não substituto.

---

## 6. O histórico tem um ponto e um rótulo ambíguo

Dois defeitos independentes, que se somaram numa leitura errada:

1. **`formatMonth` produz `ago/26` para `2026-08`** — `web/src/pages/History.tsx`.
   Em pt-br `26/08` é dia, e o operador leu o rótulo como uma data de agosto.
2. **A série tem um ponto só**, porque ela é reconstituída dos eventos gravados
   em `data/history.jsonl`, que começam na primeira execução da aplicação. É o
   comportamento que ADR-0005 e A-43 fixam, e a tela já o declara.

**A planilha, porém, tem passado datado.** `registrationDate` cobre sete meses
de 2026 e `ETA2` cobre dez meses a partir de dez/2025 — dado suficiente para uma
série reconstruída, distinta da observada e rotulada como tal. `H-54`.

> A reconstrução **não** revoga A-43. Ela não inventa o estado de cada mês: usa
> as datas que a planilha carrega, e diz na tela que é derivação, não registro.
> O que A-43 proíbe é apresentar reconstrução como histórico observado.

---

## 7. As sete histórias

| # | História | Origem nesta página |
|---|---|---|
| `H-48` | Os dois mapas fora do repositório | §2, §3 |
| `H-49` | Cliente consolidado, separado do processo do cliente | §2 |
| `H-50` | Responsável pelo importador, com a cor desempatando | §3 |
| `H-51` | Canal verde, e a distribuição à vista | §4 |
| `H-52` | Os cartões declaram o período, e ele é editável ali | §5 |
| `H-53` | A Página Performance diz a métrica e mostra o recorte | §1 |
| `H-54` | O histórico reconstrói os meses da planilha | §6 |

`H-48` precede `H-49` e `H-50`, que consomem os mapas. As demais são
independentes entre si.
