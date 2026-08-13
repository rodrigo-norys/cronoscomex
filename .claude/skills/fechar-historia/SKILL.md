---
name: fechar-historia
description: Fecha uma história do CronosComex (H-NN) — roda o portão de qualidade, percorre a definition of done, atualiza backlog, rastreabilidade e o bloco Estado do CLAUDE.md, e imprime a prova de que os três ficaram consistentes. Use quando a implementação de uma história terminar.
when_to_use: Quando o usuário disser "fechar H-12", "história concluída", "marque como pronta" ou invocar /fechar-historia H-NN.
argument-hint: '[H-NN]'
---

## Estado atual dos três arquivos, antes de mexer

!`grep -m1 -A 4 "^### $ARGUMENTS " docs/06-backlog.md`
!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`
!`grep -m1 -A 6 "^## Estado" CLAUDE.md`

## Passos

1. **Portão.** Rode `npm run verify`. Se `node --version` não devolver
   `v22.23.2`, prefixe `nvm use &&`. Se o portão reprovar, **pare aqui** e
   conserte — não marque nada.

2. **Definition of done** (`docs/10-governanca.md`). Percorra os 9 itens e diga,
   para cada um, se passou e **com base em quê**:
   - [ ] O protocolo de fatia foi apresentado e aprovado
   - [ ] Todos os critérios de aceite passam
   - [ ] Todos os casos-limite têm teste com **valor concreto**
   - [ ] `npm run verify` passa
   - [ ] Nenhuma regra de negócio fora de `src/domain/`
   - [ ] Nenhum teste aponta para a planilha real
   - [ ] História marcada em `docs/06-backlog.md`
   - [ ] `docs/09-rastreabilidade.md` conferido, se algum status mudou
   - [ ] Comentário novo diz o que o código não diz, e todo fato medido cita a
         fonte — régua em `.claude/rules/comentarios.md`

3. **Backlog.** Acrescente o bloco `> ✅ **CONCLUÍDA em DD/MM/AAAA.** …` logo
   abaixo do título da história, no mesmo formato dos já existentes: número de
   testes próprios, total da suíte, divergências resolvidas. Ver `H-06` para o
   modo de falha que este passo evita.

   **O total da suíte se copia do relatório do Vitest**, nunca se estima nem se
   conta à mão: contagem estática por `grep` não enxerga casos gerados em tempo
   de execução — `grep` devolveu 273 onde o Vitest reportava 279. É aqui que o
   número mora, e só aqui.

4. **Rastreabilidade.** Atualize o `Status` de cada linha de
   `docs/09-rastreabilidade.md` que cite a história.

5. **`CLAUDE.md`, bloco `## Estado`.** **Releia o arquivo do disco antes de
   editar** — a cópia em contexto é o retrato do início da sessão e pode estar
   defasada. Atualize a fase e a próxima história.

   **O bloco é curto por decisão, e continua curto.** Ele diz onde a fase está
   e qual é a próxima história — nada mais. Todo aprendizado técnico da história
   (número medido, defeito encontrado, decisão tomada) vai no bloco
   `✅ CONCLUÍDA` do passo 3, que é o lar dele. O `CLAUDE.md` é carregado em
   **toda** sessão; o backlog, só quando alguém o abre. Acrescentar parágrafo
   aqui cobra de cada sessão futura o custo de um fato que interessa a uma
   história — foi assim que este bloco chegou a 310 linhas antes de 11/08/2026.
   **Não transcreva número medido para o `CLAUDE.md`.**

6. **Cobertura de apresentação.** Rode:

   ```bash
   python3 - <<'PY'
   import re
   s = open('docs/09-rastreabilidade.md', encoding='utf-8').read()
   orfaos = []
   for linha in s.splitlines():
       if not re.match(r'\| (IND|ALE)-\d+ \|', linha):
           continue
       c = [x.strip() for x in linha.split('|')]
       if not [h for h in re.findall(r'H-\d+', c[5]) if 16 <= int(h[2:]) <= 22]:
           orfaos.append(f"{c[1]} — {c[2][:40]}")
   print('\n'.join(orfaos) if orfaos else 'todos com história de interface')
   PY
   ```

   **`IND-21` é a única saída legítima** — bloqueado por ausência de coluna na
   origem (D-04). Qualquer outro nome é regra calculada que o operador nunca
   verá: **pare e reporte**, não feche a história em silêncio. Ver A-65.

7. **Marcos de tooling.** Se esta história for `H-13`, `H-20` ou a última antes
   de `H-24`, avise que o gatilho de tooling foi atingido.

## Prova — imprima isto no final, sem editar

O fechamento só está concluído quando as três saídas abaixo forem consistentes
entre si. É o critério de aceite desta skill: o usuário lê três linhas em vez de
reabrir três documentos.

```bash
grep -m1 -A 2 "^### $ARGUMENTS " docs/06-backlog.md
grep -c "$ARGUMENTS" docs/09-rastreabilidade.md
grep -m1 -A 6 "^## Estado" CLAUDE.md
```

Se a próxima história citada no `CLAUDE.md` não for a sucessora declarada em
`docs/07-plano-entrega.md`, **diga isso em vez de corrigir por conta própria**.
