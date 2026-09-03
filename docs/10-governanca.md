# 10 — Governança

Documento curto e acionável. Um desenvolvedor, um usuário final, sem comitê —
processo pesado aqui morreria na segunda história.

Ele existe por um motivo concreto: **o escopo deste projeto mudou cinco vezes
antes da primeira linha de código**, e cada mudança custou retrabalho de
documentação que ninguém registrou. As seções abaixo cobrem exatamente isso.

---

## 1. Quem decide o quê

| Decisão | Quem decide | Registro |
|---|---|---|
| Escopo funcional — o que o produto faz | **Usuário** | §5 deste documento |
| Prioridade e ordem de entrega | **Usuário** | `07-plano-entrega.md` |
| Prazo, orçamento, quem mantém depois | **Usuário** | — |
| Arquitetura, stack, modelo de dados | **Implementação** | ADR em `docs/adr/` |
| Como uma regra da especificação é resolvida | **Implementação** | Achado A-NN em `01-auditoria-especificacao.md` |
| O que fazer quando o dado real contradiz a spec | **Regra fixa:** o dado vence | `00-visao-escopo.md §6.1` |
| Valor de limiar sem base declarada (ex.: 15 dias de "parado") | **Implementação**, como premissa marcada | `00-visao-escopo.md §4` |

**A fronteira em uma frase:** o usuário decide *o que* o sistema faz; a
implementação decide *como* e assume o ônus de registrar por quê.

---

## 2. Protocolo de mudança de escopo

Disparado quando o usuário pede algo que contradiz o plano vigente.

1. **Não implementar em silêncio.** Uma mudança de escopo acomodada sem
   registro produz documentação que mente sobre o sistema.
2. **Declarar o custo antes de aceitar**, em duas ou três frases: o que sai do
   escopo, o que entra, quais histórias mudam, qual ADR é afetado.
3. **Se a mudança contradiz uma resposta anterior do próprio usuário, apontar
   a contradição e pedir desempate.** Aconteceu com "planilha somente-leitura"
   × "dashboard somente-leitura", que juntas congelariam a base.
4. **Aplicar em cascata, na ordem:** ADR afetado → `00-visao-escopo.md` →
   `06-backlog.md` → `09-rastreabilidade.md` → `07-plano-entrega.md`.
5. **Registrar no log da §5**, com data.

**Regra de reafirmação:** se uma preocupação é levantada e o usuário mantém a
decisão, a decisão é dele. Registre a ressalva uma vez, no documento
apropriado, e siga — sem repetir a objeção a cada oportunidade.

---

## 3. Ciclo de vida de um ADR

| Estado | Significado |
|---|---|
| **Aceito** | Em vigor. É a decisão a seguir |
| **Substituído por ADR-NNNN** | Continua no repositório, com o link para o sucessor. **Nunca apagar** — o raciocínio descartado é o que impede redecidir errado |
| **Revogado** | A decisão deixou de valer e nada a substitui |

Um ADR é reaberto quando **seu gatilho declarado dispara**. Os gatilhos vivos:

| ADR | Gatilho de reabertura | Fonte |
|---|---|---|
| 0006 · indicadores em memória | Parse > 10 s (RNF-13) ou processo > 512 MB (RNF-16) | R-10 |
| 0002 · aplicação local sem banco | Um **segundo usuário** simultâneo passar a existir | ADR-0002, "Negativas" |
| 0002 · candidato Power BI eliminado | Colunas `RESPONSÁVEL` e `CANAL` em texto passarem a existir | ADR-0002, K4 |
| 0004 · escrita cirúrgica | Nenhum — é decisão de segurança, não de conveniência | — |
| 0003 · chave de estilo literal | Alteração da **definição** de um estilo no Excel, causando pico de `COR_NAO_MAPEADA` | ADR-0003 |
| 0005 · histórico JSONL | Nenhum previsto | — |

**Alterar um ADR aceito exige um ADR novo**, não edição do antigo. Exceção:
acrescentar seção de validação empírica quando uma medição confirma ou refuta
a decisão — foi o que `H-01` fez no ADR-0003.

---

## 4. Definition of done

### História (H-NN)

- [ ] O protocolo de fatia (`CLAUDE.md`) foi apresentado e aprovado
- [ ] Todos os critérios de aceite passam
- [ ] Todos os casos-limite da história têm teste com **valor concreto**
- [ ] `npm run verify` passa — os sete passos: `test:hooks`, `test:dados`, `test:strip`, lint, typecheck, testes, build
- [ ] Nenhuma regra de negócio fora de `src/domain/`
- [ ] Nenhum teste aponta para a planilha real
- [ ] História marcada em `06-backlog.md`
- [ ] `09-rastreabilidade.md` conferido, se algum status mudou
- [ ] Comentário novo diz o que o código não diz, e todo fato medido nele cita a
      fonte (`A-NN`, `TD-NN`, `H-NN`) — régua em `.claude/rules/comentarios.md`

### Fase

- [ ] Todas as histórias da fase concluídas
- [ ] O **critério de saída** declarado em `07-plano-entrega.md` foi verificado
      com número, não com impressão
- [ ] Riscos da fase reavaliados: algum encerrou, algum surgiu?
- [ ] O usuário conseguiu usar o entregável para uma tarefa real

### Projeto

- [ ] Todos os itens de `09-rastreabilidade.md` implementados ou explicitamente
      bloqueados com motivo
- [ ] `README.md` da raiz permite instalar e operar sem consultar mais nada
- [ ] Restauração de backup testada na máquina alvo, não só no teste automático
- [ ] `formatado.xlsx` aberto no **Excel real** sem aviso de reparo

---

## 5. Log de decisões do usuário

Registro do que foi decidido, para não ser re-litigado. Data no formato
AAAA-MM-DD.

| # | Data | Decisão | Custo / consequência |
|---|---|---|---|
| D-01 | 2026-08-03 | O arquivo é `.xlsx` local sincronizado por OneDrive, não Google Sheets | Fixou a estratégia de leitura |
| D-02 | 2026-08-03 | **Amarelo forte = importador fora do RJ**, não Canal Amarelo | Canal Amarelo fica sem representação estruturada (A-38) |
| D-03 | 2026-08-03 | **Um único usuário** | Dispensou autenticação e RLS |
| D-04 | 2026-08-03 | **Sem colunas novas** | IND-21 permanece bloqueado; custo de cada coluna adiada em `03-modelo-dados.md §5` |
| D-05 | 2026-08-03 | **Sem Supabase, sem banco, sem nuvem** — aplicação 100% local | Reverteu a virada de escopo do briefing. Eliminou 3 ADRs (persistência, autenticação, hospedagem) e o épico de sincronização. Custo: sem acesso remoto |
| D-06 | 2026-08-03 | O painel **também edita**, gravando de volta no `.xlsx` | Acrescentou o épico E5 (5 histórias) |
| D-07 | 2026-08-03 | **Não escrever direto na planilha de produção** — fila local, aplicação sob comando explícito | Acrescentou `pending-edits.jsonl` e as 6 defesas de `H-25`. Reverteu parcialmente D-06 |
| D-08 | 2026-08-03 | Histórico em **arquivo local JSONL** | Destravou ALE-06 e a Página Histórico (ADR-0005) |
| D-09 | 2026-08-03 | Entrega como **app no navegador servido por Node local** | Descartou Electron e SPA hospedada |
| D-10 | 2026-08-03 | **Apenas a aba `2026`** | Abas `2025` e `2024` fora; `CNPJ` excluída por conter credenciais |
| D-11 | 2026-08-03 | Os dois tons de verde e os dois de roxo são **o mesmo significado** | 4 entradas no `color-map.json` para 2 significados |
| D-12 | 2026-08-03 | **A planilha é a referência prioritária**, acima da especificação | Virou princípio: `00-visao-escopo.md §6.1` |
| D-13 | 2026-08-03 | **Biome 2.5.6** como lint e formatação | O plano exigia `npm run lint` sem escolher a ferramenta — lacuna encontrada pelo protocolo de fatia em `H-02`. Uma dependência em vez de três; regra de fronteira via `overrides` + `noRestrictedImports`, confirmada na documentação oficial |
| D-15 | 2026-08-03 | Regra 10 reformulada: de "nunca leia as abas fora de escopo" para **"nunca processe, indexe, exponha nem registre"** | A redação original era inatingível — o pool `sharedStrings` é global ao arquivo. A nova é verificável por teste. Lacuna encontrada pelo protocolo de fatia em `H-03` |
| D-14 | 2026-08-03 | **Node 22.x LTS** nas duas máquinas | Alinha desenvolvimento e produção. Fixado em `.nvmrc` e em `engines` do `package.json` |
| D-17 | 2026-08-06 | **Testing Library 16.3.2 + jsdom 30.0.1** como quarta camada de teste, preparada **antes** da primeira história de interface | O plano não previa teste de frontend em lugar nenhum: `08-qualidade-operacao.md §1` define três camadas — domínio, I/O e ponta a ponta — e as histórias `H-16` a `H-22` listam só arquivos `.tsx`. Lacuna encontrada pelo protocolo de fatia em `H-15`. **Não contradiz D-16:** são `devDependencies`, não entram no bundle nem chegam à máquina do operador — o `react-router` era runtime. `jsdom` e não `happy-dom` porque o mais rápido é incompleto justamente em `history.pushState`, `popstate` e `visibilitychange`, que são o que a casca precisa testar. Ficaram de fora `user-event` e `jest-dom`: o `fireEvent` e o `expect` do Vitest cobrem, e acrescentam-se quando doer. Custo: duas dependências de desenvolvimento e dois projetos no `vitest.config.ts` |
| D-16 | 2026-08-06 | **Roteamento à mão**, com `History API` e `URLSearchParams`. **`react-router` fica registrado como reavaliação futura**, não como recusa definitiva | São **sete páginas planas**, sem rotas aninhadas nem carregamento por rota, numa aplicação local — e o plano proíbe dependência não prevista. O benefício mais concreto do `react-router` seria `useSearchParams`, que é camada fina sobre o `URLSearchParams` nativo. Custo do caminho escolhido: ~40–60 linhas próprias, e a obrigação de tratar `popstate` para o botão "voltar" do navegador funcionar — que vira teste, não risco. **Reavaliar se:** as páginas passarem de ~10, aparecerem rotas aninhadas ou parâmetros de rota além de `/processo/:ref`, surgir necessidade de carregamento por rota, ou o roteamento próprio ultrapassar ~100 **linhas de código**. Qualquer um desses gatilhos torna a dependência mais barata que a manutenção. O gatilho de tamanho contava o arquivo inteiro até 17/08/2026, e media a coisa errada: comentário de porquê é 24% de `router.ts` por política, então um arquivo bem documentado disparava antes de um mal documentado com o dobro de fluxo. **Gatilhos observados em 17/08/2026, um atingido e a decisão mantida:** `web/src/router.ts` tem **132 linhas** no total, mas **79 de código** — sob o limiar, e o `react-router` não removeria as outras 53, que são comentário e espaço; e **passou a haver carregamento por rota**, com a Página Histórico sob demanda, resolvido pelo `lazy` do próprio React em 3 linhas de `App.tsx`, sem dependência nova. Os outros três seguem abertos, e **um deles encostou no limiar em 31/08/2026**: `H-70` levou `router.ts` de 79 a **97 linhas de código** de ~100, ao pôr ali o sinal de foco pendente que a casca consome — três linhas de folga, e a próxima fatia que tocar o arquivo provavelmente dispara a reavaliação. Continuam sete páginas de ~10, e nenhuma rota aninhada. `tests/repo/contratos.test.ts` mede os quatro a cada execução e **reprova** se um for atingido sem estar registrado aqui — o de 132 linhas passou despercebido por dias, e foi o que motivou a asserção. **`H-59` redesenhou a navegação em 01/09/2026 e o arquivo continuou em 97 linhas de código**, porque a separação entre destino de dado e rodapé ficou em `web/src/components/AppSidebar.tsx`: ela é apresentação, e pô-la no roteador teria disparado o gatilho por um dado que não é de roteamento. As sete páginas e a ausência de rota aninhada seguem iguais |
| D-18 | 2026-08-07 | `web/` importa os tipos de resposta **das próprias rotas**, com `import type` — nunca valor, nunca função | O esqueleto de `H-02` redeclarava `HealthResponse` no cliente com **metade** dos campos, e nada obrigava as duas declarações a concordar: é assim que um contrato diverge em silêncio. Com `verbatimModuleSyntax`, o import é apagado na compilação — **medido** ao fechar `H-15 ②`: `grep 'fastify\|process-store\|exceljs'` no bundle de produção devolve **0**, e o `vite build` transforma 22 módulos. **O limite é estrito e a razão dele é a regra inviolável 6:** só `import type`, e só de `src/http/routes/`. Importar valor traria `fastify` e o `process-store` para o navegador; importar de `src/domain/` traria regra de negócio para o cliente, que é exatamente o que a regra proíbe. **Não afrouxa a regra 5**, que é sobre `src/domain/` não importar para fora — a direção aqui é a oposta, e o `noRestrictedImports` do Biome continua guardando aquela |
| D-19 | 2026-08-04 | **Permissões do agente em `.claude/settings.json`:** `git add`, `git push`, `npm install` e `npm ci` pedem confirmação; `curl`, `wget`, force-push e leitura ou escrita de `*.xlsx` e `*.jpeg` da raiz estão negados; o modo bypass fica desabilitado | Custo: uma confirmação por operação de staging e de rede. Ganho: nenhuma via de saída de dado passa sem portão |
| D-20 | 2026-08-04 | **`mcp__*` negado — todo MCP, de todo servidor** | Conector é caminho de saída que **não passa** pelas regras de `Bash` nem de arquivo: negar `curl` e deixar `sharepoint_upload_file` aberto seria o inverso do modelo de ameaça. O glob no nome da ferramenta cobre conector que ainda nem foi criado, e o cliente remove as ferramentas negadas do contexto. `deny` vence `allow`, então **não há exceção parcial**: para usar um conector, remova a linha deliberadamente |
| D-21 | 2026-08-31 | **O modo escuro entra no plano.** A interface passa a ter dois esquemas de cor, escolhidos por `prefers-color-scheme`, **sem alternância manual** | Reverte a determinação do cabeçalho de `E9`, que dizia "funcionalidade nova, fora deste épico e fora do plano" — a frase segue verdadeira sobre `E9` e deixa de valer como recusa. Consequências: `D03`–`D07` do corpus de estilo saem da condicionalidade e passam a incidir; a superfície de contraste a verificar dobra, e por isso `H-65` reexecuta os seis procedimentos de navegador nos dois esquemas; **toda história posterior a `H-57` que acrescentar token de cor declara os dois esquemas**, sem o que `H-51` e as fatias seguintes nasceriam com metade da paleta. `D04` **não** incide: sem alternância manual, a variante `dark:` da v4 resolve para a media query sem `@custom-variant`. As outras 23 dispensas de `E9` continuam de pé |
| D-22 | 2026-08-31 | **A casca é redesenhada** conforme `docs/redesign/PROPOSTA.md` — navegação lateral, topo de uma linha, filtros como chips, dois raios, densidade de 40 px, movimento com redução, e o acento deixando de ser neutro | Acrescenta o épico `E11`, nove histórias sobre 25 arquivos de `web/src/`. **Nenhum indicador muda de valor e nenhuma rota muda de contrato.** `E9` e `E10` passam a precedê-lo: `H-45` e `H-46` tocam os mesmos arquivos, e `H-47` é a linha de base da verificação. **A medição já reprovou seis pares da paleta proposta**, três deles reintroduzindo defeitos que `H-39` e `H-40` haviam removido — `H-57` nasce com as correções calculadas em `PROPOSTA.md §2.2`. Duas peças do mockup ficam declaradas em aberto e **não** viram história: a busca `⌘K` e o detalhe em painel lado a lado |
| D-23 | 2026-08-31 | **Sem `config/team-map.json`, `responsible` recebe a chave de cor** — o campo segue mostrando o que a cor diz, e a resolução declara `source: 'cor'` | Fecha a Pendência 1 de `docs/sessao-autonoma/RELATORIO-31-08-2026.md`, que travava `H-50`. O quinto critério de aceite afirmava um mecanismo que não existe: com o mapa vazio, o desempate por cor procura um **membro** cuja lista de cores case, e sem membro nenhum `resolveTeam` devolve `UNASSIGNED` nas 649 — nem "cai no desempate", nem "o comportamento é o de hoje", que tem 165 preenchidos. **O estado sem mapa é o inicial garantido:** o arquivo está no `.gitignore` e `scripts/sincronizar-distribuicao.ts` leva só o `.exemplo`, então o operador chega sem ele — é o cenário de `PD-01`. Alternativa recusada: o campo ficar vazio até o mapa existir, com a cor visível só em `colorResponsible`; ela é mais limpa no domínio e entrega ao operador, na primeira execução, três telas piores que as de hoje. Custo do caminho escolhido: o domínio de `Responsible` vira união — chave de membro **ou** chave de cor —, habitada **só** enquanto o mapa estiver vazio; e nesse estado o filtro Responsável perde a agregação de A-18, que migra para `colorResponsible`. Precedente no próprio repositório: `resolveClient` cai para a grafia da célula e expõe `mapped: false`. **Executada em `H-50`, 01/09/2026, com uma correção de número:** esta linha dizia "157 preenchidos", copiado de `docs/uso/RESULTADO.md §3`, e o valor medido é **165** — o erro era do documento de origem, não da decisão, que não depende do número |
| D-24 | 2026-08-31 | **`H-50` é cortada, e a metade que sobra é declarada G** — a primeira do backlog. O resto de tela vira `H-66` | Fecha a Pendência 2 de `docs/sessao-autonoma/RELATORIO-31-08-2026.md`. `H-50` declarava `M (15 arquivos, contrato de três rotas alterado)` desde que nasceu, e a régua do topo de `06-backlog.md` diz `M = até 8 arquivos ou 1 contrato novo` — era G rotulada como M. **O corte a leva a 12 arquivos, e 12 ainda é G:** as divisões que a fariam caber em `M` foram tentadas e custam mais do que economizam — separar o campo do indicador é impossível, porque IND-20 e IND-22 leem `process.responsible` e mudam junto; e fatiar o domínio antes das rotas deixaria um intervalo com o Responsável fora da tela, entre dois PRs, ou com o campo duplicado no contrato. **Nenhuma G existia em 65 histórias** — o rótulo sempre foi o sinal de cortar antes de executar —, e a decisão é que aqui ele passa a ser o que a régua também serve para fazer: avisar que a fatia é longa. `H-66` fecha o quinto critério de `H-53`, que estava não-incidente. **A numeração é `H-66`, e não `H-50b`, por impedimento medido:** `tests/repo/contratos.test.ts` casa `H-\d+` e `h-\d+` estritos em três asserções — o sufixo de letra faria duas seções colidirem no mesmo id e deixaria âncora e índice fora do conjunto comparado. Manter `H-50` viva também preserva as quatro âncoras dela em `src/`, `tests/` e no `.exemplo` |
| D-25 | 2026-09-02 | **A criação de linha nova entra no escopo.** A Página Operacional passa a inserir processo, e a cirurgia ganha `appendRow` | Reverte `docs/00-visao-escopo.md §3.2`, a negativa do ADR-0004 e a frase de `05-contratos-api.md §3` — os três foram emendados no mesmo dia. **A medição no arquivo real é o que tornou a extensão barata:** a aba `2026` não tem formatação condicional, validação nem autofiltro próprios, e `Tabela1` cobre `A1:P997` contra 745 linhas escritas — enquanto houver folga, a linha nova cabe sem estender intervalo nenhum, e quando não houver a cirurgia **recusa**. Consequências: a linha nasce com o estilo da COLUNA (`xf 162`, sem preenchimento), porque o da linha de cima carrega `fillId 8` = Colaborador 1; e `resolveColor` passou a distinguir **ausência de cor** de **cor desconhecida**, senão toda linha criada iria para a quarentena. O `revisor-xml` reprovou **duas vezes**: seis achados em `appendRow` e quatro em código já commitado na primeira, e mais cinco na segunda — dois deles **introduzidos pelas correções da primeira**, que é o motivo de a régua mandar reinvocá-lo depois de corrigir. Um dos quatro descartava `<si/>` do pool GLOBAL de strings — defeito presente desde `H-24`, alcançável por `applyCellEdits`. A remoção de linha **continua fora de escopo**, e desde 03/09/2026 está escrita como tal em `docs/00-visao-escopo.md §3.2`. **Emenda de 03/09/2026:** a negativa que esta decisão diz ter revertido **nunca esteve em §3.2** — o que havia era §3.1 sem a criação de linha na linha de Edição. Os dois lados foram corrigidos com `E13`, em `D-26` |

| D-26 | 2026-09-03 | **O trabalho de 02/09/2026 ganha épico retroativo — `E13`, com `H-77` a `H-81`** —, e a cascata de documentos que ele não percorreu é percorrida agora | O PR #111 entrou com cinco commits de produto e 49 arquivos **sem história no backlog**, e o commit de documentação do mesmo dia (`603a62f`) alcançou `05-contratos-api.md`, este documento e o `ADR-0004` — deixando de fora `00-visao-escopo.md`, `02-requisitos.md`, `06-backlog.md` e `09-rastreabilidade.md`. Achado pela auditoria de alinhamento de 03/09/2026. **Alternativa recusada:** deixar como está e registrar a lacuna, que foi o que aconteceu com `PD-05` entre 14 e 17/08/2026 e com `P-15` (`PD-09`) desde `H-30` — nas duas vezes o item ficou sem dono. **O que a escrita retroativa recupera é a rastreabilidade, e o que ela não recupera é o protocolo de fatia**, cujo valor é o defeito de plano aparecer antes do código; por isso cada bloco de `E13` cita o commit que a entregou, em vez de fingir que planejou. Consequências medidas: o backlog vai de 76 para **81** histórias, com duas G novas — `H-79` (29 arquivos, 2 rotas) e `H-80` (15 arquivos) —, e nasceram **cinco RF**: RF-32 a RF-35 de `E13`, e **RF-31 para a Página Configuração**, entregue entre `H-34` e `H-38` e sem requisito desde agosto. `docs/00-visao-escopo.md §3.1` passa a listar a criação de linha e a Página Configuração, e §3.2 passa a declarar a **remoção** de linha como fora de escopo, que `D-25` decidiu e nenhum documento registrava |
| D-27 | 2026-09-03 | **A cobertura de teste continua desligada, e os documentos param de afirmar que ela é portão** | `vitest.config.ts` declara `coverage.thresholds` nos quatro eixos em `0` e `npm test` é `vitest run` **sem** `--coverage` — então nem o percentual é medido —, enquanto `02-requisitos.md` afirmava RNF-35 ≥ 90% e RNF-36 ≥ 80% sem ressalva e `08-qualidade-operacao.md §5.2` dizia que `npm test` roda "com os limiares de cobertura de RNF-35 e RNF-36". **Alternativa recusada: ligar os limiares.** O que a lacuna real pede é `PR-10` — os 43 casos-limite obrigatórios de `08-qualidade-operacao.md §1.3` virando teste —, e percentual de linha não verifica isso; ligar limiar por camada é mudança de código com o backlog fechado, e o número que ele reprovaria não é o número que interessa. Os dois RNF ficam como **alvo declarado**, com a ressalva escrita em §1.1, no comentário do próprio `vitest.config.ts` e na linha de cada requisito. Quem quiser o número roda `npx vitest run --coverage` |
| D-28 | 2026-09-03 | **As fontes passam a chegar na máquina do operador; a linha de teste na planilha de desenvolvimento fica** | Dois achados da mesma auditoria, com desfechos opostos de propósito. **As fontes:** os seis `.woff2` de `H-58` e a licença OFL nunca entraram na branch `distribuicao`, porque o fecho transitivo de `scripts/sincronizar-distribuicao.ts` tratava `.css` como folha e não alcançava o `url("/fonts/...")` — e como fonte ausente não produz erro, o navegador caía no fallback e o script imprimia "sincronizada com HEAD". Corrigido na **causa**, e não com lista manual: o fecho passa a ler os `url()` absolutos do CSS, e `tests/repo/distribuicao.test.ts` reprova se um asset citado ficar fora. **A linha de teste:** `CONTROLE DOS EMBARQUE.xlsx` na raiz do projeto ficou com 746 linhas — `A746 = FT5555.28` —, escrita em 02/09/2026 pelo caminho novo de criação de linha. É a **cópia local** de desenvolvimento, e a do OneDrive não foi tocada; apagá-la pela aplicação exigiria a remoção de linha, que `D-25` manteve fora de escopo, e editar o arquivo à mão contraria a regra de que ele é a referência e não um artefato de teste. **Fica como está, com o registro aqui** — a planilha de desenvolvimento não é fonte de nenhum número afirmado nos documentos, que vêm de `H-01` e das fixtures |

**D-13 e D-15 nasceram do protocolo de fatia** (`CLAUDE.md`): as duas lacunas
apareceram ao montar o checklist de `H-02` e `H-03`, antes de qualquer código.

**Padrão observável:** D-05, D-06 e D-07 são o mesmo tema — persistência e
escrita — decidido em três rodadas. O protocolo da §2 existe para que a próxima
oscilação custe uma conversa, e não um plano refeito.

**D-21 é a primeira reversão de uma determinação escrita pelo próprio plano**, e
não de uma resposta anterior do usuário: quem havia decidido que o modo escuro
ficava de fora era o cabeçalho de `E9`, com o argumento de que o benefício era
modesto — um operador, uma máquina. O argumento continua correto e deixou de ser
decisivo. O registro existe para que a determinação de `E9` não seja citada
depois como recusa vigente.

---

## 6. Commits

Conventional Commits, em pt-br, com escopo por área.

```
<tipo>(<escopo>): <descrição em pt-br>

- detalhe técnico do que mudou
- o "porquê", se for crítico
```

Tipos: `feat` · `fix` · `chore` · `refactor` · `docs` · `style` · `perf`
Escopos: `(domain)` · `(io)` · `(app)` · `(http)` · `(web)` · `(tools)` ·
`(config)` · `(docs)` · `(claude)` · `(repo)` — a mesma lista do `CLAUDE.md` e da
skill `/sugerir-commits`. `(tests)` nunca foi usado e saiu: a *definition of done*
exige teste dentro da própria fatia, então commit só de teste é raro por
construção — e o tipo `test` não existe aqui pelo mesmo motivo.

Regras:

- **Um commit por ponto verde**, e não por história — a regra vigente está no
  `CLAUDE.md`: o corte é o momento em que uma preocupação fecha **e** o portão
  passa, porque é isso que mantém o `git bisect` utilizável. Dentro de uma
  história os pontos verdes caem sozinhos na cadeia canônica: contrato fechado,
  domínio verde, rota verde, interface verde.
- **Nunca commitar automaticamente.** Sugerir mensagem só quando pedido, e
  trazer o `git add` correspondente junto.
- **Nunca commitar** `*.xlsx` fora de `tests/fixtures/`, `config/app.json` ou
  `data/` — o `.gitignore` protege, mas confira.

---

## 7. O que deliberadamente **não** está aqui

Registrado para que a ausência seja escolha, não esquecimento.

| Ausente | Por quê |
|---|---|
| Política de branch | Um desenvolvedor. Branch por história seria cerimônia sem revisor |
| Processo de code review | Não há segundo revisor humano. O substituto é o subagent de review antes da Fase 3 (`CLAUDE.md`) |
| SLA de resposta, RACI, matriz de aprovação | Duas pessoas |
| Versionamento semântico do produto | Aplicação local sem distribuição pública |
| Processo de release | O "release" é `git pull` + `npm run build` na máquina alvo |
| Política de dependências | A stack está fixada em `CLAUDE.md`; acrescentar dependência é decisão de arquitetura e exige ADR |

Se alguma dessas passar a fazer falta, o gatilho é o mesmo dos ADRs: quando a
ausência causar um problema concreto, e não antes.
