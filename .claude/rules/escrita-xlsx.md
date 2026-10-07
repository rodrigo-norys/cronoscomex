---
paths:
  - "src/io/xlsx-surgeon.ts"
  - "src/app/write-guard.ts"
  - "tests/io/**/*.ts"
  - "tests/app/write-guard*.ts"
---

# Escrita cirúrgica no `.xlsx`

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> `Read`, `Edit` ou `Write` tocam arquivo do `paths:` — nunca pelo shell, e,
> medido (ADR-0007), nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** a correção da cirurgia é imposta pelos testes de `tests/io/` e
> `tests/app/write-guard.test.ts`. A invocação do `revisor-xml` antes de commitar
> está no `CLAUDE.md`, que carrega sempre.

**É o ponto onde errar custa a planilha da empresa.**

## Invoque o `revisor-xml` antes de commitar

Vale para qualquer mudança em `src/io/xlsx-surgeon.ts`, em
`src/app/write-guard.ts` ou em código que reescreva bytes do `.xlsx`.

- **Reinvoque depois de corrigir**, e não só antes de commitar: da segunda passagem
  em diante, quase todo achado dele nasceu da correção do achado anterior.
- **Mande o módulo inteiro**, e não só o trecho novo: ele já achou defeito em código
  commitado havia várias histórias.
- **Mande a tela junto** quando a mudança altera o que a aplicação **diz** ao
  operador sobre a escrita: parte dos defeitos dele estava em mensagem que afirmava
  o que o código não sabia.

Ele não tem `Edit` nem `Write`, e é invocado **sem** o raciocínio de quem escreveu
o código: começar cego é o mecanismo, não efeito colateral.

**Onde ele acha os casos-limite.** A criação de linha é **`H-78`**, a fonte
primária; os arquivos abaixo complementam, porque parte da enumeração vive fora do
backlog. Sem os quatro, a revisão reenumera do zero e a lista muda entre
invocações.

| Arquivo | O que enumera |
|---|---|
| `docs/06-backlog.md` §`H-78` | **a fonte primária** — os cinco casos-limite da cirurgia |
| `tests/io/xlsx-surgeon-append.test.ts` | a cirurgia — `appendRow` e as recusas dela |
| `tests/app/write-guard.test.ts` | quem a chama — piso de `firstDataRow`, duas inserções, `refExists`, REF aparada, `TABELA_CHEIA`, linhas vazias no fim da aba |
| `docs/05-contratos-api.md §3` | o contrato de `POST /api/edits/row` e do desvio em `POST /api/edits` |

## Reinvoque o revisor CERTO, e não sempre o mesmo

"Reinvocar depois de corrigir" diz *quando*, e não *quem*. Uma passagem do
`revisor-xml` custa cerca de 200 mil tokens, e ele não cobre número nem frase em
comentário — essa família é do `revisor-docs`.

| Se a rodada de correção tocou… | reinvoque |
|---|---|
| código que reescreve bytes do `.xlsx` — a cirurgia, o guard, a ordem das defesas | **`revisor-xml`**, como manda a seção acima |
| só comentário, número, documento ou asserção de teste | **ofereça o `revisor-docs`** ao dono, e siga |

**"Ofereça", e não "invoque":** o `revisor-docs` **não tem gatilho, por decisão do
usuário**, tomada depois de o custo dele ser medido. **O erro a evitar é tratar esta
rule como configuração, e não como julgamento.**

## Ao consertar uma CHAMADA, procure as outras

`consolidated` é lida em dois lugares — `applyPendingEdits`, aqui, e `getState`, em
`src/app/process-store.ts`. Dois consertos seguidos (`D-63` e `D-66`) declararam a
invariante restaurada alcançando um chamador só; o segundo deixava a fila ilegível
derrubar o painel inteiro.

```bash
grep -rn "consolidated(\|<outra funcao>(" src/ --include='*.ts' | grep -v "export function"
```

**Consertar um chamador e declarar a invariante restaurada é o defeito, e não o
conserto.** Vale para qualquer invariante que um cabeçalho de módulo afirme. Não
acrescente `src/app/process-store.ts` aos globs: ele não reescreve bytes, e carregar
esta régua em toda sessão do store é o trade errado.

## A cadeia de cálculo

O Excel repete o índice da aba (`i`) em **toda** entrada de `xl/calcChain.xml`, e a
conferência de `removeFromCalcChain` — só injetar o índice quando a entrada seguinte
não tem o seu — é o que evita `i` duplicado. A medição que refutou a premissa
contrária, e o porquê da fixture `formulas.xlsx`, estão na ADR-0004 (`PD-05`).
