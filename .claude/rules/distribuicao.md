---
paths:
  - "scripts/sincronizar-distribuicao.ts"
  - "tests/repo/distribuicao.test.ts"
  - "config/*.exemplo"
  - "config/*.exemplo.json"
  - "config/*.json.exemplo"
---

# A árvore que vai para a máquina do operador

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> o agente lê arquivo do `paths:` com `Read` e, conforme a versão do Claude Code,
> também quando o escreve, o edita ou o lê pelo shell (ADR-0007) — mas, medido,
> nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** a árvore que resolve todo import — inclusive o que `server.ts` importa
> — é imposta por `tests/repo/distribuicao.test.ts`, que cita esta rule ao
> reprovar.

A branch `distribuicao` é o artefato: sem `docs/`, `tests/`, `tools/` nem
`.claude/`, que não servem para nada em produção. Ela **não recebe PR** — é
artefato, não revisão. **Sem contagem aqui de propósito:** o script mede e imprime
os dois lados a cada execução, e todo número escrito aqui envelheceu.

## Sincronizar

Com `node --experimental-strip-types scripts/sincronizar-distribuicao.ts`: sem
argumento ele confere e sai `1` se divergir; com `--aplicar` ele **troca para a
branch `distribuicao`** — recusando antes se a árvore estiver suja —, prepara os
arquivos no índice e **para**, deixando você nela. Commit, push e o `git switch` de
volta são seus.

- **Sincronize apenas a partir da `main` mesclada**, para o operador nunca receber
  código que o CI e a revisão do PR ainda não aceitaram.
- **O script mede a branch LOCAL.** Ele diz "sincronizada com HEAD" com o commit
  ainda não empurrado. A conferência que não mente é
  `git rev-list --count origin/distribuicao..distribuicao`.

## O que entra

**Não é lista escrita à mão:** é o fecho transitivo dos imports a partir de
`src/http/server.ts` e `web/src/main.tsx`, mais os arquivos de suporte que nenhum
import alcança. **O fecho lê também os `url("/...")` das folhas de estilo**: fonte
ausente não produz erro — o navegador cai no fallback —, e foi assim que as fontes
da interface ficaram fora da branch enquanto o script dizia "sincronizada".

`README.md` e `iniciar.cmd` da raiz são **exclusivos da branch** e nunca são
sobrescritos — o primeiro é o guia do operador, o segundo é o lançador que põe o
ponto de partida na primeira pasta que ele abre.

## Na máquina do operador

**Baixar a árvore não é o mesmo que cloná-la.** A instalação feita por download, sem
`.git`, funciona, e custa duas coisas: não há `git pull` para atualizar, e não há
`git status` para flagrar arquivo sobrescrito por versão velha. **Cliente compilado
novo com servidor velho falha mudo:** o navegador só mostra `Uncaught TypeError`,
com `#root` vazio.

**Os dois mapas de negócio não vão na branch.** `config/client-map.json` e
`config/team-map.json` estão no `.gitignore` porque carregam nome real de cliente e
de pessoa da equipe; a branch leva só os `.exemplo`. Desde `H-88`, a instalação do
operador os edita pela tela, então **as duas pontas escrevem**: nunca copie um mapa
por cima do outro sem reconciliar. E JSON malformado cai em `STARTUP_ERRORS` e mata
a partida antes de existir tela — o operador ficaria sem painel por uma vírgula.
