---
paths:
  - "docs/**/*.md"
  - "*.md"
---

# O contrato da documentação

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> `Read`, `Edit` ou `Write` tocam arquivo do `paths:` — nunca pelo shell, e,
> medido (ADR-0007), nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** região, espelho de estado, tabela solta e o piso de cada um são impostos
> por `node tools/contar-documentacao.mjs`, que `tests/repo/contagens.test.ts` leva ao
> portão; o índice, o resumo e o tamanho das histórias do backlog, por
> `tests/repo/documentacao.test.ts`. O número fora de região, o bloco que cita um ID
> cuja definição mudou e o ID sem definição são apontados pelo `--nuas`, pelo
> `--pares` e pelo `--definicoes`, sem reprovar. A semântica é do `revisor-docs`, sob
> demanda.

## As regras

O mecanismo diz quem cobra: **guarda** reprova o portão, **aviso** aponta sem
reprovar, e **revisão** é de quem edita — ou do `revisor-docs`. O que é do projeto —
contadores, espelhos, registro, pisos — está em `tools/contar-documentacao.config.mjs`.

**R1 — Fato de estado vive num lugar só, e os outros apontam.** A cópia de estado só
existe como espelho declarado em `ids.mirrors`, e o espelho é conferido. *Guarda:* o
espelho reprova o ID cujo estado difere entre os lados. *Aviso:* o `--pares` lista os
blocos que citam o ID cuja definição o diff mudou.

**R2 — Número de estado atual só em região gerada.** A região é
`<!-- conta:NOME -->N<!-- /conta -->`, nunca no início da linha, e o `--write` a
preenche; contador novo entra em `counters`, com teste. Diga o recorte e onde o
conjunto vive — os <!-- conta:indicadores-ativos -->18<!-- /conta --> indicadores **ativos**, e não
os <!-- conta:indicadores-definidos -->27<!-- /conta --> `IND-NN`. Versão também é estado: `versao[pacote]`
lê o `package.json`, e `versao[node]`, o `.nvmrc`. Número sobre código não se escreve em
prosa: aponte o arquivo ou o comando. Número que nenhuma fonte do repositório calcula
leva fonte e data — a planilha, que a regra inviolável 7 tira da suíte:
"649 linhas de dados (medido em `H-01`, 03/08/2026)". Quem edita a linha reconfere o
número; se não der em um comando, a frase está mal escrita. *Guarda:* a região. *Aviso:* o `--nuas`
aponta número com unidade fora de região nas linhas que o diff acrescentou — a
`/sugerir-commits` o roda antes do aceite, e a `/sugerir-prs` sobre o PR inteiro.

**O que o `--nuas` reconhece:** o número em algarismo ou por extenso, com negrito em
volta de qualquer parte, em `N linhas` — no máximo uma palavra no meio, e a unidade
pode vir entre crases, como `IND-NN` —, `N concluídas`, com o estado colado ao número,
`N das M histórias`, que aponta os dois, `Pendências abertas: N` e `Total: N`,
`Por custo: **baixo N** · **médio N**`, `os **N**` com a unidade na frase anterior,
`N` no fim da linha com a unidade no começo da seguinte, e a versão exata depois do
nome, `Vite X.Y.Z`. O vocabulário — unidades, estados, rótulos, nomes com versão —
está em `language`, na configuração.

**Fica de fora, por limite declarado** — medido sobre 104 frases de estado injetadas
no corpus, das quais aponta 99, e sobre as regiões desembrulhadas no lugar (70 de
85). A faixa de ID (`X-NN` a `X-MM`), o percentual, a versão só maior (`React N`), a
célula de tabela com a unidade no cabeçalho e o número em negrito sem artigo custavam,
no `--nuas --tudo`, mais falso positivo que acerto; o valor composto (`N · N · N`) não
é número com unidade; e a linha com data é o registro da medição. O que fica de fora
é da revisão.

**Skill não usa região: calcula na invocação**, com `` !`comando` `` depois de espaço
e sem `$0`, `$1`… no comando, que o harness troca pelos argumentos. **E só com
`grep`, e com `tr`, `cut`, `sort` e `grep -c` lendo o pipe:** fora do modo
automático, `awk`, `sed` lendo arquivo e qualquer `$(…)` ou `${…}` abortam a skill
inteira. Lógica maior vai para script em `tools/`, liberado na skill por
`allowed-tools`, como `tools/abrir-historia.mjs`. **Todo caminho injetado leva
`${CLAUDE_PROJECT_DIR}/`**: o relativo resolve contra o diretório da sessão, e com
ela fora da raiz a skill inteira aborta.

**R3 — Afirmação de regra cita o ID que a define.** Sem o ID não há vínculo, e o
`--pares` não acha a frase quando a definição muda. *Revisão.*

**R4 — Todo ID tem uma definição, e o estado muda nela.** Definição é a linha de
tabela que abre com o ID, ou o título. Ela não se apaga: o indicador aposentado leva
⏹️, e a pendência fechada fica marcada `✅ Fechada em DD/MM/AAAA`. *Aviso:* o
`--definicoes` lista o ID citado sem definição, e o definido em mais de um lugar fora
de espelho.

**R5 — Lista de itens com estado é gerada, ou vira ponteiro.** A lista escrita à mão
é a que esquece o item novo, e guarda nenhuma vê o que falta. Conjunto computável vai
em região `conta` ou `confere`; o resto aponta para onde o conjunto é definido.
*Revisão.*

**R6 — Registro se marca pela estrutura, e não conta como estado.** Registro diz o
que era verdade na data, e a data mora nele — a decisão `| D-NN`, a história fechada
no backlog, o arquivo de `docs/adr/`. Não há marcação de isenção: o que é registro
está em `record`, na configuração. *Aviso:* o `--nuas` e o `--pares` não o apontam.

**R7 — O documento renderiza.** Linha em branco dentro de tabela a encerra — também
dentro de citação, onde o `>` sozinho é a linha em branco —, e o resto sai como texto; `conta` no início da linha abre bloco HTML. *Guarda:* a tabela solta e
o marcador quebrado.

**O que o contrato não alcança:** fato sem ID e sem número, que fica com a revisão;
a lista que devia ganhar um item e não ganhou; o código e a tela; e o dado externo,
como a planilha.

## Ler `docs/06-backlog.md` pela estrutura, não pela linha

O arquivo é muito maior que as 2.000 linhas que o `Read` lê de uma vez. Não leia
por janela fixa em volta de um `grep -n`: ela traz várias vezes mais texto do que a
história. Os títulos são estáveis — `###` abre história, `##` abre épico —, e os
três recortes abaixo seguem por eles.

Em que história um termo aparece, com a contagem, sem abrir nenhuma:

```bash
awk -v t='TERMO' '/^##/{h=$0} index($0,t){c[h]++; if(!(h in f)) f[h]=NR}
  END{for(k in c) printf "%5d %2dx %s\n", f[k], c[k], k}' docs/06-backlog.md | sort -n
```

A história inteira — até `^##`, e não `^### H-`, para a última de um épico não
levar junto a abertura do seguinte:

```bash
sed -n '/^### H-NN /,/^##/p' docs/06-backlog.md | head -n -1
```

Só uma seção dela — `Casos-limite`, `Critérios de aceite`, `Contrato`,
`Arquivos`:

```bash
sed -n '/^### H-NN /,/^##/p' docs/06-backlog.md \
  | sed -n '/^\*\*Casos-limite/,/^\*\*[A-Z][^*]*:\*\*/p' | head -n -1
```

O bloco `✅ CONCLUÍDA` vem **antes** do contrato, e pode ser a maior parte da
história: para os casos-limite, use o terceiro recorte.

## O `revisor-docs` existe, e quem o invoca é o dono

**Não há gatilho, por decisão do dono.** Nenhuma skill o chama, nenhum hook o
dispara, e esta rule **não** manda invocá-lo — ela diz o que ele faz, para a decisão
ser informada.

O que ele pega, e o portão não: as guardas cobram o que é computável. O defeito que
sobra não é o ID que sumiu — medido, nenhuma citação de ID em prosa apontava para
identificador inexistente —, é o ID que existe e **diz outra coisa**. Isso é
semântica, e nenhuma asserção a alcança.

**Quando ele se paga**, para quem for decidir:

- o retorno cresce com o **tamanho** e com a **densidade de citação cruzada** do
  diff; emenda de três linhas não tem o que ele ache;
- ele custa **cerca de 200 mil tokens e 20 minutos** por invocação, e acha **cerca
  de 30%** das divergências conhecidas;
- **não é reprodutível**: três execuções sobre o mesmo diff concordaram em 23% dos
  achados, e alguns itens receberam veredictos **opostos**. Uma execução limpa
  **não** é prova de que não há defeito.

## Registro não fica em `docs/`

**Documento datado que descreve um evento passado** — relatório de sessão,
auditoria executada, medição — nunca fica obsoleto por construção, então nenhum
critério de obsolescência o alcança e ele acumula para sempre. O histórico do
git é o arquivo dele. Remova, e deixe uma linha no log da §5 de
`docs/10-governanca.md` com o comando que recupera — `D-46` é o exemplo.

**Fica o que é referência ou explicação do estado atual**, com consumidor.
**`docs/06-backlog.md` é o sumidouro, e não é candidato a limpeza:** é lá que o
conteúdo dos outros sobrevive, e esvaziá-lo destrói o destino das extrações.

**Extraia antes de remover**, e o destino depende do tipo:

| O que é | Vai para |
|---|---|
| decisão tomada, e decisão **recusada** | `docs/10-governanca.md` §5, ou um ADR |
| medição de que o código depende | o cabeçalho do módulo em `src/` |
| fato de configuração do repositório | `CLAUDE.md` |
| achado ainda aberto | `docs/06-backlog.md` |

- **Densidade baixa extrai para linhas; densidade alta pede documento**, e o
  destino de um consolidado é `adr/`, não a raiz de `docs/`.
- **Exaurido não é redundante:** o arquivo que se declara "percorrido inteiro" é o
  que mais precisa ser aberto antes de sair.
- **Ponteiro para arquivo não versionado é ponteiro morto para quem clona.**

A ferramenta que mede é a skill global `desinchar-docs`; as passadas já feitas estão
em `D-46`, `D-47` e `D-59`.
