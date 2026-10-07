---
paths:
  - "docs/**/*.md"
  - "*.md"
---

# Números afirmados na documentação

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> `Read`, `Edit` ou `Write` tocam arquivo do `paths:` — nunca pelo shell, e,
> medido (ADR-0007), nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** número em região, índice do backlog, matriz e requisito revogado são
> impostos por `tests/repo/contagens.test.ts` e `tests/repo/documentacao.test.ts`.
> Número fora de região é avisado no diff pelo `--nuas`, sem reprovar. A semântica
> é do `revisor-docs`, sob demanda.

## Duas classes, dois tratamentos

**Contagem sobre o repositório** — achados, histórias, premissas, riscos,
indicadores. Diga o **recorte** e **onde o conjunto vive**:

> os <!-- conta:achados -->65<!-- /conta --> achados (`A-NN`, em `docs/01-auditoria-especificacao.md`)
> os <!-- conta:indicadores-ativos -->18<!-- /conta --> indicadores **ativos** — <!-- conta:indicadores-definidos -->27<!-- /conta --> definidos, `IND-21` bloqueado e <!-- conta:indicadores-aposentados -->8<!-- /conta --> aposentados

Sem o recorte a frase não é reconferível, e o erro é invisível: `IND-NN` tem <!-- conta:indicadores-definidos -->27<!-- /conta -->
entradas e a afirmação correta é <!-- conta:indicadores-ativos -->18<!-- /conta -->. Contar a família daria <!-- conta:indicadores-definidos -->27<!-- /conta --> e estaria errado.

**Se é estado atual, prenda à fonte.** O número vai numa região
`<!-- conta:NOME -->N<!-- /conta -->`, nunca no início da linha, e
`node tools/contar-documentacao.mjs --write` o preenche; `tests/repo/contagens.test.ts`
reprova a região que divergir. Os nomes e a regra de cada contador estão em
`COUNTERS`, no próprio arquivo — contador novo entra lá, com teste. Versão também é
estado atual: `versao[pacote]` lê o `package.json`, e `versao[node]`, o `.nvmrc`.
Registro datado não vira região: o número dele está certo na data.

**Skill não usa região: calcula na invocação**, com `` !`comando` `` depois de espaço
e sem `$0`, `$1`… no comando, que o harness troca pelos argumentos. **E só com
`grep`, e com `tr`, `cut`, `sort` e `grep -c` lendo o pipe:** fora do modo
automático, `awk`, `sed` lendo arquivo e qualquer `$(…)` ou `${…}` abortam a skill
inteira. Lógica maior vai para script em `tools/`, liberado na skill por
`allowed-tools`, como `tools/abrir-historia.mjs`. **Todo caminho injetado leva
`${CLAUDE_PROJECT_DIR}/`**: o relativo resolve contra o diretório da sessão, e com
ela fora da raiz a skill inteira aborta.

**O número que escapou da região é apontado no diff, não no portão.**
`node tools/contar-documentacao.mjs --nuas` lista o número com unidade — algarismo
ou por extenso — escrito fora de região nas linhas que o diff contra a `main`
acrescentou. A `/sugerir-commits` o roda antes do aceite dos commits, quando corrigir
custa uma edição, e a `/sugerir-prs` o repete sobre o PR inteiro. **Só avisa:** a
taxa de falso positivo medida está no cabeçalho da ferramenta. Não há marcação de
isenção: o que fica de fora é estrutura — título, data ou "medido" na linha, matriz
`✅ **Concluída`, índice fechado, história e épico fechados, e os arquivos de
registro.

**Medição sobre a planilha** — 649 linhas, <!-- conta:chaves-de-cor -->9<!-- /conta --> chaves de cor, 20,7% de
`DOCS ENVIADOS`. Teste nenhum confere: a regra inviolável 7 proíbe a suíte de
tocar o arquivo real. Cite **fonte e data**:

> 649 linhas de dados (medido em `H-01`, 03/08/2026)

## Ao editar uma linha que afirma número

Reconferir é obrigação de quem edita, não de quem lê depois. **Se não der para
reconferir em um comando, a frase está mal escrita** — conserte a frase, não
só o número.

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
