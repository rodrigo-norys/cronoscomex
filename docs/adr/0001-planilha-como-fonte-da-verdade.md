# ADR-0001 — A planilha `.xlsx` é a única fonte da verdade

**Status:** Aceito · 03/08/2026

## Contexto

O briefing inicial deste trabalho determinava uma virada de escopo: a planilha
seria carga inicial de uma migração one-shot, e o sistema passaria a ser o
registro autoritativo, com CRUD, identidade e trilha de auditoria em
persistência própria.

Na rodada de perguntas bloqueantes, o usuário reverteu essa premissa. As
respostas, em sequência:

1. o arquivo vive em `.xlsx` numa pasta do OneDrive sincronizada localmente;
2. um único usuário opera o sistema;
3. o dashboard "reproduz somente os campos e colunas que existem na planilha",
   sem colunas novas;
4. o usuário deve "conseguir também fazer edições que salvem de forma
   automática nessa planilha que fica no OneDrive";
5. sem banco de dados e sem nuvem.

O que resulta disso é que a planilha não é um artefato a ser aposentado. Ela
continua sendo editada diretamente pelo Excel, continua sendo sincronizada com
o SharePoint e continua sendo o documento que a organização reconhece.

A pergunta arquitetural, então, não é "para onde migrar o dado", e sim **quem
detém a verdade quando o arquivo e a aplicação divergirem**.

## Decisão

**O arquivo `.xlsx` é a única fonte autoritativa. Todo estado da aplicação é
projeção derivada dele.**

Consequências operacionais desta decisão, todas obrigatórias:

1. A aplicação **nunca** mantém dado de negócio que não exista no arquivo.
2. Toda escrita vai para o arquivo; a projeção em memória só é atualizada pela
   **releitura** do arquivo, nunca por atualização otimista da própria escrita.
3. Divergência entre arquivo e memória é sempre resolvida a favor do arquivo.
4. Os artefatos locais (`history.jsonl`, `pending-edits.jsonl`,
   `quarantine.json`, `backups/`) são **descartáveis**: apagar qualquer um
   degrada função, mas não perde dado de negócio.
5. Reconstruir o estado inteiro custa um parse. Não há migração, não há
   sincronização e não há reconciliação a manter.

## Consequências

### Positivas

- **Elimina a classe de bug "duas verdades".** Não existe cenário em que o
  Excel mostre um valor e o painel mostre outro de forma persistente: no pior
  caso o painel está desatualizado por segundos, e o horário da última leitura
  é exibido.
- **Editar pelo Excel continua sendo um caminho plenamente suportado.** Se o
  operador nunca adotar a edição pelo painel, nada quebra. Isso reduz o risco
  de adoção a score 8 (R-07), o menor entre os riscos relevantes.
- **RPO = 0 e RTO imediato** (RNF-22, RNF-23), sem nenhuma infraestrutura de
  backup: o backup do dado de negócio é o próprio arquivo, que a organização
  já versiona pelo SharePoint.
- **Nenhuma migração a executar**, logo nenhum risco de migração: não há
  janela de corte, não há conciliação de carga, não há operação em paralelo.
- Torna a aplicação **descartável sem prejuízo**: desinstalar não perde nada.

### Negativas

- **A chave de escrita é frágil.** As edições endereçam `sourceRow`, o número
  da linha. Se alguém inserir ou remover linhas no Excel entre a leitura e a
  gravação, o alvo se desloca. Mitigado pela verificação de hash em `H-25`, que
  recusa a escrita em vez de gravar no lugar errado.
- **Sem integridade referencial.** Não há como impedir REF duplicada, texto
  inconsistente em CLT ou data inválida — a origem não tem restrições. A
  aplicação detecta e relata (TD-06, quarentena), mas não previne.
- **A concorrência é resolvida por recusa, não por mesclagem.** Se o arquivo
  mudou, a escrita é recusada e o operador decide. Não há mesclagem automática,
  e isso é intencional: mesclar dado de negócio sem supervisão é como se perde
  informação silenciosamente.
- **Todo indicador depende da qualidade da planilha.** Sujeira na origem vira
  limitação do painel, não defeito corrigível em código (R-04).
- **Cada leitura reprocessa tudo.** Aceitável enquanto o volume couber em
  memória; o gatilho de reavaliação está em R-10.

## Alternativas descartadas

### A1 — Banco autoritativo com migração one-shot (o briefing original)

**Descartada por decisão do usuário.** Tecnicamente era a opção mais robusta:
integridade referencial, chave estável, trilha de auditoria nativa,
concorrência resolvida por transação.

O custo que a tornou inviável não é técnico: exigiria que a equipe abandonasse
a planilha, e a planilha é o documento que a organização compartilha via
SharePoint. Manter os dois em paralelo criaria exatamente o problema das duas
verdades — o risco que este ADR existe para eliminar.

### A2 — Banco autoritativo com exportação para `.xlsx`

O sistema seria a verdade e geraria a planilha para consumo externo.
Descartada porque a planilha continuaria sendo editada diretamente por hábito e
por necessidade (o SharePoint é compartilhado), e a exportação sobrescreveria
essas edições.

### A3 — Cópia de trabalho local, promovida manualmente

Oferecida ao usuário e por ele descartada. A aplicação editaria uma cópia
própria, promovida à produção sob comando. Descartada porque uma alteração
feita no arquivo do OneDrive durante o período de trabalho faria as duas
versões divergirem, exigindo reconciliação manual — de novo, duas verdades.

### A4 — Espelho em banco somente-leitura, com escrita direta no arquivo

Um banco manteria cópia indexada para consultas rápidas, mas o arquivo
continuaria autoritativo. Descartada por decisão do usuário ("esqueça banco de
dados") e porque, no volume esperado de uma planilha mantida à mão, o ganho de
desempenho não paga a complexidade — ver ADR-0006.

## Referências

- `01-auditoria-especificacao.md` — os 45 achados que derivam da qualidade da
  origem
- `03-modelo-dados.md` — projeção em memória e artefatos locais
- ADR-0004 — como a escrita preserva o arquivo
- ADR-0005 — o histórico que a planilha não guarda
- R-01, R-04, R-07 em `07-plano-entrega.md`
