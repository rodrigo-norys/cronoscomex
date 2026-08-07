---
name: avaliar-claude
description: Interrompe o trabalho em curso e avalia a própria sessão do CronosComex atrás de capacidade faltando ou mal resolvida em .claude/ — varre oito sinais com citação obrigatória, aplica limiar de duas ocorrências, e prefere ajustar peça existente a criar peça nova. Não escreve arquivo nenhum, a entrega é uma resposta no chat. O resultado esperado na maioria das execuções é "nada a propor".
when_to_use: Quando o usuário invocar /avaliar-claude. Não a acione por conta própria — a pausa é decisão do usuário.
disable-model-invocation: true
---

PAUSA DE AUTO-AVALIAÇÃO — infraestrutura .claude/

PAPEL E LIMITES
Interrompa o trabalho em curso e faça uma avaliação da sua própria sessão para
identificar se falta — ou está mal resolvida — alguma capacidade que deveria
viver em .claude/. Ao terminar, devolva o controle e retome o que estava
fazendo, se houver algo em andamento.
- NÃO escreva nem edite arquivo nenhum. A entrega é uma resposta no chat.
- NÃO execute comando que altere estado (git, instalação, build, escrita).
- NÃO altere o trabalho em andamento nem tome decisão sobre ele.

ORÇAMENTO — esta sessão já está carregada; a análise não pode competir com ela
- Evidência primária: esta conversa. Ela já está no contexto e é gratuita.
- Leitura de arquivo: no máximo UMA listagem de .claude/ e CINCO leituras de
  arquivo, escolhidas entre os que a análise citar. Proibido varrer o
  repositório, usar busca recursiva ampla ou ler diretórios de código em massa.
- Documentação: consulte APENAS as páginas dos mecanismos que você for de fato
  propor. No máximo TRÊS páginas. Não faça levantamento exaustivo do produto.
- Se o orçamento acabar antes da conclusão, entregue o resultado parcial e diga
  o que ficou de fora. Estourar o orçamento é pior que responder menos.

HONESTIDADE SOBRE O QUE VOCÊ ENXERGA
Sessões longas perdem detalhe: parte do histórico pode ter sido resumida ou não
estar mais acessível com fidelidade.
REGRA: se você não consegue CITAR o trecho ou a ação concreta, o sinal não
existe. Não reconstitua de memória o que "provavelmente aconteceu".
Comece declarando, em uma linha, que parte da sessão você consegue examinar com
citação e o que está fora de alcance.
Se esta auto-avaliação já rodou nesta sessão, não reproponha o que foi
descartado — considere apenas sinais surgidos desde então.

PASSO 1 — VARREDURA DE SINAIS
Percorra a conversa procurando estes oito sinais. Para cada ocorrência,
registre a citação concreta (o que foi pedido, dito ou feito) e conte quantas
vezes ocorreu.
 S1 REPETIÇÃO — o usuário explicou a mesma coisa mais de uma vez.
 S2 CORREÇÃO — você errou e foi redirecionado. Qual informação faltava?
 S3 ATRITO DE AUTORIZAÇÃO — pedido de permissão para operação segura e
    rotineira, que se repete.
 S4 PROCEDIMENTO IMPROVISADO — sequência de passos reconstruída no momento,
    que já havia sido executada antes com a mesma forma.
 S5 REDESCOBERTA — releitura dos mesmos arquivos para reconstruir contexto que
    a sessão já tivera.
 S6 EXPLORAÇÃO CARA — muitas leituras cujo produto útil foi um resumo curto.
 S7 REGRA TÁCITA — convenção, restrição ou preferência que só existiu na
    conversa e não está em nenhum lugar persistente.
 S8 VERIFICAÇÃO MANUAL — o usuário conferiu resultado à mão porque não há laço
    que você mesmo pudesse rodar.
Sinal sem citação não entra. Impressão não é sinal.

PASSO 2 — LIMIAR DE AÇÃO
Um sinal só vira proposta se: ocorreu DUAS ou mais vezes com citação; OU
ocorreu uma vez com custo alto ou consequência irreversível.
Abaixo do limiar, registre como "em observação" e siga — sem propor nada.
A RESPOSTA ESPERADA NA MAIORIA DAS EXECUÇÕES É "NADA A PROPOR". Isso é
sucesso, não omissão. Infraestrutura criada a partir de ocorrência única vira
manutenção sem retorno, e este prompt será rodado muitas vezes.

PASSO 3 — MELHORAR ANTES DE CRIAR
Liste o que já existe em .claude/ (uma listagem, dentro do orçamento). Para
cada sinal acima do limiar, verifique NESTA ORDEM:
 1. Alguma peça existente já deveria cobrir isso e falhou? Então o problema é
    a peça, não a ausência dela — proponha o ajuste, citando o trecho.
 2. Alguma peça existente cobre parcialmente? Proponha estender, não duplicar.
 3. Só então proponha peça nova.
REGRA ANTI-PROLIFERAÇÃO: duas peças que compartilham gatilho ou domínio são uma
peça. Se sua proposta se sobrepõe a algo existente, funda em vez de somar.

PASSO 4 — ESCOLHA DO MECANISMO. Cite qual ramo justificou cada proposta:
 - determinístico, obrigatório, não pode depender de você lembrar → hook;
 - procedimento longo e condicional, acionado pelo tipo de tarefa → skill;
 - ação que o usuário dispara com frequência, com parâmetro → comando;
 - trabalho exploratório de muitas leituras cujo produto é resultado
   condensado → subagent com saída estruturada;
 - fato invariante que muda decisão em quase toda sessão → CLAUDE.md. Custo
   fixo, o mais caro de todos: use por exceção, e prefira mover para
   carregamento sob demanda o que for condicional;
 - atrito de autorização em operação segura e de escopo estreito → regra de
   permissão específica, nunca curinga amplo.
PROIBIDO: propor ampliação de permissão sobre versionamento, dados sensíveis ou
instalação de dependências para reduzir atrito. Se o atrito é real, proponha
escopo estreito para a operação exata.

PASSO 5 — DESTINO: projeto ou global
Para cada proposta, decida onde deve morar e justifique em uma linha:
 - .claude/ DO PROJETO — depende do domínio, da stack, das convenções, dos
   caminhos ou dos dados deste repositório.
 - ~/.claude GLOBAL — capacidade que você usaria igual em qualquer projeto,
   sem referência a nada específico deste.
Na dúvida, projeto. Peça global mal generalizada polui todas as sessões
futuras; peça de projeto, no máximo, uma.

PASSO 6 — VERIFICAÇÃO DOCUMENTAL (só do que você vai propor)
Antes de escrever qualquer artefato, confirme o mecanismo na documentação
oficial: Claude Code em https://code.claude.com/docs e a documentação e o
material de engenharia da Anthropic. Confirme: o mecanismo existe com esse
nome; onde o arquivo deve ficar; quais campos são obrigatórios; quando é
carregado. Registre URL e data de consulta.
SEM ACESSO À WEB: entregue a análise de sinais normalmente, mas marque cada
artefato como NÃO VERIFICADO e não invente campo, nome de diretório nem formato
de cabeçalho. Escreva "confirmar formato antes de aplicar".

FORMATO DA RESPOSTA — no chat, nada em disco
A) Cobertura: uma linha sobre o que você conseguiu examinar com citação.
B) Sinais: tabela — sinal | ocorrências | citação mais representativa | acima
   do limiar? Máximo uma linha por sinal observado.
C) Em observação: os que ficaram abaixo do limiar, em uma linha cada. Sem
   proposta.
D) Propostas — apenas para os que passaram do limiar, e apenas se houver.
   Para cada uma, nesta ordem:
     · é AJUSTE de peça existente, EXTENSÃO ou peça NOVA;
     · sinal e citação que a originou;
     · mecanismo e ramo do Passo 4;
     · destino (projeto ou global) e por quê;
     · conteúdo completo do artefato, pronto para colar, com o caminho;
     · critério de aceite: o sinal observável de que resolveu;
     · custo de manutenção em uma linha.
E) Verificação: URL e data por mecanismo proposto, ou a marca de não verificado.
F) Retomada: uma linha dizendo onde o trabalho parou e que você vai continuar.
Se nada passou do limiar, entregue apenas A, B, C e F — em no máximo 12 linhas
— e volte ao trabalho. Não preencha espaço com sugestão genérica.

AUTOAVALIAÇÃO ANTES DE RESPONDER
1. Toda proposta tem citação literal da conversa que a originou? A que não
   tiver, remova — é intuição vestida de diagnóstico.
2. Você verificou se uma peça existente já cobria o caso, antes de propor nova?
3. Alguma proposta nasceu de ocorrência única sem custo alto? Rebaixe para
   observação.
4. Você propôs algo porque o mecanismo existe, e não porque um sinal o exigiu?
   Corte.
5. Estourou o orçamento de leituras ou de páginas de documentação?
6. Se a resposta honesta é "nada a propor", você a deu — ou inventou algo para
   parecer útil?
