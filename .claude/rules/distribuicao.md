---
paths:
  - "scripts/sincronizar-distribuicao.ts"
  - "tests/repo/distribuicao.test.ts"
  - "config/*.exemplo"
  - "config/*.exemplo.json"
  - "config/*.json.exemplo"
---

# A árvore que vai para a máquina do operador

A branch `distribuicao` é o artefato: 108 arquivos, sem `docs/`, `tests/`,
`tools/` nem `.claude/`, que são 3 de cada 4 arquivos versionados e não servem
para nada em produção. Ela **não recebe PR** — é artefato, não revisão.

Sincronize com `node --experimental-strip-types scripts/sincronizar-distribuicao.ts`:
sem argumento ele confere e sai `1` se divergir; com `--aplicar` prepara os
arquivos no índice e **para**, deixando commit e push para você.

**Sincronize apenas a partir da `main` mesclada**, para o operador nunca receber
código que o CI e a revisão do PR ainda não aceitaram. Decidido em 31/08/2026,
depois de `H-48` ter ido para a distribuição antes do merge.

**O que entra não é lista escrita à mão:** é o fecho transitivo dos imports a
partir de `src/http/server.ts` e `web/src/main.tsx`, mais os arquivos de suporte
que nenhum import alcança. `README.md` e `iniciar.cmd` da raiz são **exclusivos
da branch** e nunca são sobrescritos — o primeiro é o guia do operador, o segundo
é o lançador que põe o ponto de partida na primeira pasta que ele abre.

Guardado por `tests/repo/distribuicao.test.ts`, que existe porque arquivo
faltando ali não quebra teste nem build: **quebra a partida na máquina do
operador, longe de quem poderia consertar.**

## Os dois mapas de negócio não vão junto — `PD-08`

`config/client-map.json` e `config/team-map.json` estão no `.gitignore` porque
carregam nome real de cliente e de pessoa da equipe. O script leva só os dois
`.exemplo`, com nomes fictícios — então **a máquina do operador chega sem eles**.

**O efeito já é visível:** `H-49` está fechada e consome o de clientes, então o
campo Cliente lá mostra a grafia da célula em vez do nome consolidado. `H-50`
fará o mesmo com o Responsável (`D-23`).

**Redigitar não é opção.** Os dois são lidos na partida em `src/http/server.ts`,
e JSON malformado cai em `STARTUP_ERRORS` e mata o processo antes de existir
tela: o operador ficaria sem painel por uma vírgula.

**Decisão de 31/08/2026: fica como está, com envio manual** —
`scp config/client-map.json config/team-map.json` para `config\` na máquina do
operador. A solução (tela de edição, como `H-34` e `H-37` fizeram para o caminho
da planilha, ou o envio virando passo do procedimento) é reexaminada em momento
oportuno. **Enquanto o envio for manual, repita a cópia toda vez que a regra de
consolidação ou a equipe mudar** — nenhum aviso existe para lembrar.

**Duas coisas mentem hoje sobre isso**, e caem junto na primeira instalação: o
`README.md` da branch afirma em negrito "você não precisa editar arquivo nenhum"
e descreve `config\` como só cores e apelidos de status; e o bloco "Como refazer
esta branch", no fim dele, lista os arquivos a copiar **sem** os dois `.exemplo`,
divergindo do script, que é quem vale.
