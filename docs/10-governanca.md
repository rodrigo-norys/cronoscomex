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
- [ ] `npm run verify` passa — lint, typecheck, testes, build
- [ ] Nenhuma regra de negócio fora de `src/domain/`
- [ ] Nenhum teste aponta para a planilha real
- [ ] História marcada em `06-backlog.md`
- [ ] `09-rastreabilidade.md` conferido, se algum status mudou

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
| D-16 | 2026-08-06 | **Roteamento à mão**, com `History API` e `URLSearchParams`. **`react-router` fica registrado como reavaliação futura**, não como recusa definitiva | São **sete páginas planas**, sem rotas aninhadas nem carregamento por rota, numa aplicação local — e o plano proíbe dependência não prevista. O benefício mais concreto do `react-router` seria `useSearchParams`, que é camada fina sobre o `URLSearchParams` nativo. Custo do caminho escolhido: ~40–60 linhas próprias, e a obrigação de tratar `popstate` para o botão "voltar" do navegador funcionar — que vira teste, não risco. **Reavaliar se:** as páginas passarem de ~10, aparecerem rotas aninhadas ou parâmetros de rota além de `/processo/:ref`, surgir necessidade de carregamento por rota, ou o roteamento próprio ultrapassar ~100 linhas. Qualquer um desses gatilhos torna a dependência mais barata que a manutenção |

**D-13 e D-15 nasceram do protocolo de fatia** (`CLAUDE.md`): as duas lacunas
apareceram ao montar o checklist de `H-02` e `H-03`, antes de qualquer código.

**Padrão observável:** D-05, D-06 e D-07 são o mesmo tema — persistência e
escrita — decidido em três rodadas. O protocolo da §2 existe para que a próxima
oscilação custe uma conversa, e não um plano refeito.

---

## 6. Commits

Conventional Commits, em pt-br, com escopo por área.

```
<tipo>(<escopo>): <descrição em pt-br>

- detalhe técnico do que mudou
- o "porquê", se for crítico
```

Tipos: `feat` · `fix` · `chore` · `refactor` · `docs` · `style` · `perf`
Escopos: `(domain)` · `(io)` · `(http)` · `(web)` · `(docs)` · `(tools)` ·
`(config)` · `(tests)`

Regras:

- **Um commit por história**, quando possível. `feat(domain): classifica STATUS
  nas 4 categorias canônicas (H-06)` — o ID da história no final.
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
