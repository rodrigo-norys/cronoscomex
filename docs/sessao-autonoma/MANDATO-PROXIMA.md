# Mandato — próxima sessão autônoma

> Cole isto numa sessão limpa. O `CLAUDE.md` carrega sozinho; **este documento
> não**, então ele repete só o que a sessão precisa e que o `CLAUDE.md` não diz.

Sessão autônoma. Você trabalha sozinho: não haverá ninguém para responder
perguntas, aprovar plano ou desempatar decisão.

---

## Ponto de partida, medido em 01/09/2026

**`main` em `6f02ac0`**, com os PRs #89 a #94 já mesclados. **1698 testes** em 74
arquivos, portão verde.

**Cinco PRs abertos, e a ordem entre eles importa** — mescle **apenas o que
mostrar `base: main`**, conferindo a cada passo com

```bash
gh pr list --state open --json number,baseRefName \
  --jq '.[] | "#\(.number) base=\(.baseRefName)"'
```

| Ordem | PR | Base | O quê |
|---|---|---|---|
| — | **#95** | `main` | renomeação dos relatórios de sessão + errata. **Independente**, mescla quando quiser |
| 1 | **#96** | `main` | `H-58` — IBM Plex servida do repositório |
| 2 | **#97** | #96 | `H-61` — forma, densidade e número nos componentes de dado |
| 3 | **#98** | #97 | `H-62` — forma e número na edição e no detalhe |
| 4 | **#99** | #98 | `H-63` — a forma nas sete páginas, e a guarda |

`delete_branch_on_merge` está ligado: a cascata se corrige a cada merge, **mas
propaga a base do PR mesclado**. Mesclar fora de ordem põe o seguinte na branch
errada.

---

## A ordem de trabalho

**`E11` tem duas histórias abertas, e elas são sequenciais.**

| # | História | Tamanho | Nota |
|---|---|---|---|
| 1 | `H-64` — Movimento, com redução | P | duas durações e uma curva, tudo sob `prefers-reduced-motion`. Os tokens `speed-fast`, `speed-base` e `--ease-brand` **já existem** desde `H-57` |
| 2 | `H-65` — Os procedimentos de navegador nos dois esquemas | M | **fecha `E11` e o backlog inteiro** |

**Sobre `H-65`, e isto muda o que o backlog supõe:** ela **não** é inalcançável.
`tools/medir-navegador.mjs` emula `prefers-color-scheme` e `forced-colors` por
CDP, e os seis procedimentos foram exercidos nesta sessão. Execute os dois
esquemas por emulação e registre. Declare aberto **apenas** o caso-limite que
exige alternar o tema do sistema operacional com a aplicação aberta — esse
precisa de máquina real.

---

## Uma pendência sua já está esperando

**A revisão do `revisor-estilo` não chegou.** Ele foi invocado ao fechar `H-63`,
que é onde as sete páginas convergem, e a sessão terminou antes do resultado.
**Reinvoque-o**: ele recebe a casca (`App.tsx`, `AppSidebar.tsx`, `TopBar.tsx`,
`FilterBar.tsx`, `FilterChip.tsx`) **mais** as sete páginas de uma vez, porque
12 das 40 regras são composicionais — a violação delas não existe dentro de um
arquivo, é a diferença entre arquivos. Faça isso **antes** de `H-64`: achado de
forma encontrado depois do movimento custa animar o que vai mudar.

---

## O que já está medido — não re-meça

| Fato | Valor |
|---|---|
| Raios distintos no conjunto | **`6px` e `12px`**, medidos por `getComputedStyle` nas sete rotas |
| Sombras | **zero** |
| Estouros horizontais | **zero**, em 320 · 360 · 768 · 1024 · 1280 · 1440 px |
| Contraste | **74 pares × 2 esquemas, zero reprovações** (`H-57`) |
| Altura de linha das seis tabelas | **40 px**, todas dentro do invólucro de `R01` |
| Diálogo sem sombra, borda contra o véu | **4,12:1** claro · **5,66:1** escuro |
| Fontes | zero requisições externas, `Content-Type: font/woff2` |

---

## O protocolo, com a mesma adaptação

`/fatia H-NN` antes de escrever código, e ele manda **parar em divergência**. Sem
ninguém para decidir:

- **Divergência de fiação** — arquivo que falta na lista, consumidor que o
  `typecheck` obriga, teste que precisa mudar de forma, número em prosa que sua
  mudança envelheceu: **resolva e registre** no bloco `✅ CONCLUÍDA`, com o que
  você decidiu e a alternativa descartada.
- **Divergência que muda o que a tela afirma ao operador, ou que redefine um
  indicador**: **PARE a história**, deixe-a aberta, escreva a pendência no
  relatório com as opções e os números, e siga para a próxima.

Ao terminar cada uma: `/fechar-historia H-NN`, `/sugerir-commits`,
`/sugerir-prs`. **Você tem autorização para commit, push e abertura de PR.**
`gh pr merge` continua negado — o merge é do dono.

**Não pare por número de PRs abertos.** O teto de 6 foi levantado em 01/09/2026:
pare por trava, por contexto, ou por fim da ordem.

---

## O que esta sessão aprendeu do jeito difícil

1. **Nunca silencie a saída de um comando que pode falhar.**
   `npm run build >/dev/null 2>&1` escondeu um erro de sintaxe, e três medições
   seguiram na build anterior — o sintoma era `h-10` no código e 29 px na tela.
2. **Guarda que nasce vermelha é desligada, não obedecida** (`H-45`). A de "dois
   raios" foi escrita em `H-61` e só entrou em `H-63`, onde podia passar.
3. **`grep` de critério casa a prosa junto com o defeito** — aconteceu duas
   vezes: `fonts.googleapis.com` num comentário de `H-58`, e `font-bold` noutro.
   Guarda boa exige contexto de utilitário (`className=`, `@apply`).
4. **A prova por mutação pega falha na própria guarda.** Em `H-58` ela reprovou
   *pelo teste errado*, e foi assim que descobri que `interfaceFiles()` não
   cobre `.css` — onde o `@font-face` mora.
5. **Desconfie do resultado absurdo.** Três morreram na conferência: `body`
   branco no escuro (artefato de compor transparente sobre branco), o 200 em
   `/fonts/NaoExiste.woff2` (catch-all deliberado, com controle rodado) e alturas
   de barra oscilando (esperava o seletor errado).
6. **Reproduza o "antes" antes de corrigir.** Foi o que provou que o estouro da
   Página Operacional era preexistente, e não criado por `H-59`.

---

## O que não fazer

- **Não mesclar na `main`.** Merge local mata o PR.
- **Não tocar a planilha real, `data/` ou `config/app.json`.** Nem para teste.
  `abrirAplicacao` já sobe sobre fixture com os três caminhos isolados — use-o.
- **Não instalar dependência** que o plano não prevê. `curl` e `wget` seguem
  negados; se precisar de arquivo da rede, **peça ao dono** em vez de contornar.
- **Não marcar procedimento de navegador como feito por raciocínio.**
- **Não reduzir a fonte-base**, e não acrescentar token de cor sem os dois
  esquemas — `tests/repo/estilo.test.ts` reprova.

---

## O relatório

Escreva em `docs/sessao-autonoma/RELATORIO-<data>[-N].md`, no formato dos
existentes: plano, feito por história com os números medidos, pendências para o
dono com opções e recomendação, não feito com o motivo exato, ordem de merge, e
as decisões que você tomou sozinho — uma linha cada.

**Comece reinvocando o `revisor-estilo`**, e depois `/fatia H-64`.
