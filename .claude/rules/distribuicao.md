---
paths:
  - "scripts/sincronizar-distribuicao.ts"
  - "tests/repo/distribuicao.test.ts"
  - "config/*.exemplo"
  - "config/*.exemplo.json"
  - "config/*.json.exemplo"
---

# A árvore que vai para a máquina do operador

A branch `distribuicao` é o artefato: sem `docs/`, `tests/`, `tools/` nem
`.claude/`, que não servem para nada em produção. **Sem contagem aqui de
propósito** — o próprio `sincronizar-distribuicao.ts` mede e imprime os dois
lados a cada execução, e os números que estavam escritos (108 arquivos, "3 de
cada 4") nunca bateram: hoje a branch tem 117 e o script calcula **124**, porque
as sete de `D-28` ainda não entraram. Ela **não recebe PR** — é artefato, não
revisão.

Sincronize com `node --experimental-strip-types scripts/sincronizar-distribuicao.ts`:
sem argumento ele confere e sai `1` se divergir; com `--aplicar` ele **troca
para a branch `distribuicao`** — recusando antes se a árvore estiver suja —,
prepara os arquivos no índice e **para**, deixando você nela. Commit, push e o
`git switch` de volta são seus.

**Sincronize apenas a partir da `main` mesclada**, para o operador nunca receber
código que o CI e a revisão do PR ainda não aceitaram. Decidido em 31/08/2026,
depois de `H-48` ter ido para a distribuição antes do merge.

**O que entra não é lista escrita à mão:** é o fecho transitivo dos imports a
partir de `src/http/server.ts` e `web/src/main.tsx`, mais os arquivos de suporte
que nenhum import alcança.

`README.md` e `iniciar.cmd` da raiz são **exclusivos da branch** e nunca são
sobrescritos — o primeiro é o guia do operador, o segundo é o lançador que põe o
ponto de partida na primeira pasta que ele abre.

**O fecho lê também os `url("/...")` das folhas de estilo**, desde 03/09/2026.
Tratar `.css` como folha custou os seis `.woff2` de `H-58` e a licença OFL: eles
nunca entraram na branch, e como fonte ausente **não produz erro** — o navegador
cai no fallback — o script imprimia "sincronizada com HEAD" enquanto o operador
via outra tipografia. Corrigido na causa, com regressão em
`tests/repo/distribuicao.test.ts`, que reprova se um asset citado no CSS ficar
fora da árvore (`D-28`).

Guardado por `tests/repo/distribuicao.test.ts`, que existe porque arquivo
faltando ali não quebra teste nem build: **quebra a partida na máquina do
operador, longe de quem poderia consertar.**

## Os dois mapas de negócio não vão junto — `PD-08`

`config/client-map.json` e `config/team-map.json` estão no `.gitignore` porque
carregam nome real de cliente e de pessoa da equipe. O script leva só os dois
`.exemplo`, com nomes fictícios — então **a máquina do operador chega sem eles**.

**O efeito já é visível, e para os dois mapas:** `H-49` e `H-50` estão fechadas
— a segunda em 01/09/2026 —, então na máquina do operador o campo Cliente mostra
a grafia da célula em vez do nome consolidado, e o Responsável faz o mesmo
(`D-23`).

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
