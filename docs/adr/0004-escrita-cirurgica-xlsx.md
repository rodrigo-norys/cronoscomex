# ADR-0004 — Escrita cirúrgica no XML, nunca reserialização do workbook

**Status:** Aceito · 03/08/2026

## Contexto

O usuário exige editar processos pelo painel e gravar de volta no `.xlsx` que
vive na pasta sincronizada do OneDrive. Esse arquivo é a planilha de trabalho
da empresa: contém cores que carregam regra de negócio (ADR-0003), autofiltro,
colunas ocultas, larguras ajustadas, comentários, e possivelmente validações de
dados e formatação condicional.

O caminho óbvio seria ler com ExcelJS, alterar o objeto e chamar
`workbook.xlsx.writeFile()`. Esse caminho é uma armadilha documentada:

| Defeito | Efeito | Fonte |
|---|---|---|
| Formatação condicional perdida em ida e volta | Regras somem do arquivo gravado | [issue #1024](https://github.com/exceljs/exceljs/issues/1024) |
| Validação de dados de template perdida | Listas suspensas somem | [issue #1184](https://github.com/exceljs/exceljs/issues/1184) |
| Validação + formatação condicional na mesma aba | **Workbook corrompido**, sem erro em tempo de execução | [issue #1118](https://github.com/exceljs/exceljs/issues/1118) |
| Erro ao abrir arquivo gravado com formatação condicional | Excel exibe aviso de reparo | [issue #1305](https://github.com/exceljs/exceljs/issues/1305) |

Some-se a isso que o projeto está sem release relevante desde outubro de 2023.

Um `.xlsx` é um arquivo zip contendo XML. Reserializar significa **reconstruir
o arquivo inteiro** a partir do modelo em memória da biblioteca — e tudo que a
biblioteca não modelou, ela não reconstrói. O que ela não modela não gera erro:
simplesmente desaparece.

Perder a planilha de trabalho da empresa é o risco de maior impacto do projeto
(R-08, impacto 5).

## Decisão

**A escrita altera apenas os nós XML das células modificadas, dentro do zip,
preservando todas as demais entradas byte a byte.**

`workbook.xlsx.writeFile()` **não é usado em nenhuma circunstância.** À época
desta decisão isso restringia o ExcelJS à leitura; desde `H-33` ele não está
mais no projeto, e a proibição vale para qualquer biblioteca que reserialize a
planilha inteira.

### Procedimento

1. Ler o `.xlsx` como buffer binário.
2. Descompactar com `fflate@0.8.3`, obtendo o dicionário de entradas do zip.
3. Localizar `xl/worksheets/<sheet>.xml` e alterar **somente** os nós `<c>` das
   células alvo:
   - texto → entrada em `xl/sharedStrings.xml` (reutilizando o índice se a
     string já existir) e `t="s"` na célula;
   - data → serial numérico do Excel, sem `t`;
   - vazio → nó sem `<v>`;
   - o atributo `s=` (estilo) é **preservado** — mudar valor nunca muda cor;
   - se a célula continha `<f>` (fórmula), o nó é removido junto com a
     substituição, para não deixar fórmula órfã apontando para valor fixo.
4. Célula ausente do XML → inserir `<c>` novo na posição correta pela ordem de
   coluna.
5. Recompactar mantendo **todas** as outras entradas exatamente como estavam.
6. Gravar em arquivo temporário no mesmo volume e renomear sobre o original
   (gravação atômica).
7. Reabrir o resultado e conferir que as células alteradas contêm o valor
   esperado; se falhar, restaurar o backup automaticamente.

A troca de cor de uma linha (`H-27`) usa a mesma técnica, alterando apenas o
atributo `s=` das colunas A a L para um `styleId` **já existente** no arquivo —
registrado em `color-map.json`. `xl/styles.xml` nunca é modificado.

### Critério de aceite verificável

O teste de `H-24` compara, **entrada a entrada por hash**, o zip original e o
resultante: todas as entradas exceto a planilha alvo e `sharedStrings.xml`
devem ser idênticas. Isso não é uma inspeção visual; é uma asserção automática.

A fixture `tests/fixtures/formatado.xlsx` contém deliberadamente cores,
autofiltro, comentário, validação de dados, formatação condicional, coluna
oculta e larguras ajustadas — os elementos exatos que os defeitos citados
destroem.

## Consequências

### Positivas

- **A planilha sobrevive intacta.** Tudo que a aplicação não entende, ela não
  toca — que é a única postura defensável diante de um arquivo que ela não
  criou.
- **Neutraliza os quatro defeitos citados**, sem depender de correção upstream
  de um projeto inativo.
- **Reduziu a superfície de risco do ExcelJS à leitura** (R-09), e essa
  superfície acabou indo a zero: `H-33` substituiu o leitor por leitura direta
  do XML, e a troca ficou confinada a `src/io/xlsx-reader.ts`, como previsto.
- **A verificação é objetiva.** "Preservou o arquivo" vira uma comparação de
  hashes, não uma opinião.
- **A gravação é atômica**: falha no meio deixa o original intacto, porque a
  renomeação nunca ocorreu.

### Negativas

- **Manipulação de XML é código delicado.** Escapes (`&`, `<`, `"`), namespaces,
  `xml:space="preserve"` para texto com espaços significativos, ordem dos nós
  `<c>` dentro de `<row>`, atualização de `count` e `uniqueCount` em
  `sharedStrings.xml` — cada um é um caso-limite com teste próprio em `H-24`.
- **Só funciona para o que se implementou.** Alterar mesclagem de células ou
  criar estilos novos exigiria estender a cirurgia.

  > **Emenda de 02/09/2026 — a criação de linha entrou** (`D-25`). A cirurgia
  > foi estendida com `appendRow`, e a medição no arquivo real é o que a tornou
  > barata: a aba `2026` **não tem** formatação condicional, validação de dados
  > nem autofiltro próprios — o autofiltro vive dentro de `Tabela1`, cujo `ref`
  > é `A1:P997` contra 745 linhas escritas. Enquanto houver folga, a linha nova
  > cabe **sem estender intervalo nenhum**; só `<dimension>` cresce. Quando a
  > folga acabar, `appendRow` **recusa** em vez de gravar fora da Tabela.
  >
  > A linha nasce com o estilo que a **coluna** declara — `xf 162`, sem
  > preenchimento —, e não com o da linha de cima: `xf 181` carrega `fillId 8`,
  > que o `color-map.json` traduz como Colaborador 1, e todo processo novo
  > nasceria atribuído a quem ninguém escolheu (regra inviolável 3).
  >
  > **A remoção de linha continua fora de escopo.**
- **Acoplamento ao formato OOXML.** Uma variação estrutural inesperada do
  arquivo (produzido por outra ferramenta que não o Excel) poderia quebrar a
  localização dos nós. A validação pós-escrita detecta antes que o dano
  persista.
- **Datas dependem do formato já existente na coluna.** O valor é gravado como
  serial; a exibição usa o formato da célula. Se a coluna não tiver formato de
  data, o Excel exibirá o número. `H-01` revela isso antes.

## Alternativas descartadas

### A1 — `workbook.xlsx.writeFile()` do ExcelJS

O caminho natural, descartado pelos quatro defeitos documentados acima. O que
pesa não é a probabilidade de cada um, mas o modo de falha: **silencioso**. A
formatação condicional some sem erro, e ninguém percebe até precisar dela.

### A2 — Automação do Excel via COM/OLE no Windows

Instruir o próprio Excel a fazer a edição garantiria preservação perfeita, já
que é a ferramenta que criou o arquivo. Descartada porque exige o Excel
instalado e **não aberto no arquivo**, torna a aplicação dependente de uma
tecnologia específica de plataforma, é lenta, e falha de formas difíceis de
diagnosticar quando há uma caixa de diálogo aberta na sessão do usuário.

### A3 — Uma biblioteca que preserve tudo automaticamente

Não existe, no ecossistema JavaScript, biblioteca que garanta ida e volta
completa de `.xlsx`. Os forks do ExcelJS que anunciam preservação cobrem casos
específicos (tabelas dinâmicas, gráficos) e adicionam uma dependência não
oficial ao caminho mais crítico do sistema. Descartada em favor de controlar
exatamente o que é alterado.

### A4 — Não escrever: exportar arquivo novo e o operador substitui

Oferecida ao usuário e por ele descartada em favor da fila com aplicação sob
comando. Teria risco de corrupção praticamente nulo, ao custo de trabalho
manual a cada rodada de edição e do risco de esquecer de substituir.

### A5 — Gravar direto e na hora, a cada edição

Era o pedido inicial do usuário. Ele mesmo o revisou ao avaliar o risco: *"não
queremos editar direto a planilha de produção"*. A decisão final — fila local e
aplicação sob comando explícito — está em ADR-0001 e nas histórias `H-23` a
`H-26`. Esta alternativa multiplicaria por N o número de gravações, e cada
gravação é uma chance de conflito com o OneDrive ou com o Excel aberto.

## Emenda de 06/08/2026 — `xl/styles.xml` pode ser modificado, aditivamente

Três trechos acima foram superados por A-49, A-56 e TD-05.1. Ficam **registrados
aqui em vez de reescritos** (regra inviolável 1): a decisão de 03/08/2026 é
histórico, e apagá-la esconderia por que a regra mudou.

| Trecho superado | Onde | O que vale agora |
|---|---|---|
| "alterando apenas o atributo `s=` […] para um `styleId` **já existente** […] `xl/styles.xml` nunca é modificado" | §Procedimento | **Falso desde TD-05.1.** Medido em A-49: uma mesma cor vem de vários `styleId`, que diferem em borda e fonte — trocar o `styleId` inteiro destrói o que não estava em questão. Troca-se **um campo da tupla**; se a tupla resultante não existir, o passo 5b **acrescenta** um `xf`, de forma estritamente aditiva |
| "todas as entradas exceto a planilha alvo e `sharedStrings.xml` devem ser idênticas" | §Critério de aceite verificável | Ganha `xl/styles.xml` como **terceira exceção, condicional** ao passo 5b. Nenhum `xf` existente é alterado, então nenhuma célula fora da edição muda de aparência |
| "Se a coluna não tiver formato de data, o Excel exibirá o número" | §Consequências negativas | **Deixa de ser consequência aceita e vira defeito a corrigir** (A-56). A célula recebe `numFmt` de data pelo algoritmo de TD-05.1 — o sintoma proibido é o Excel exibir `46263` no lugar de `29/ago` |

O que **não** mudou: `workbook.xlsx.writeFile()` segue proibido em qualquer
circunstância, e toda entrada do zip fora das três citadas segue byte a byte
idêntica — inclusive as três abas fora de escopo.

## Referências

- `06-backlog.md` H-24 (cirurgia), H-25 (defesas), H-26 (comando), H-27 (cor)
- `04-arquitetura.md §3.2` — a sequência completa de aplicação
- R-06, R-08, R-09 em `07-plano-entrega.md`
- `08-qualidade-operacao.md §1.2` — as fixtures obrigatórias
