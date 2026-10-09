---
paths:
  - "package.json"
  - "package-lock.json"
  - ".nvmrc"
---

# Dependências e versões

> **Esta rule é orientação, e pode não carregar.** Ela entra em contexto quando
> `Read`, `Edit` ou `Write` tocam arquivo do `paths:` — nunca pelo shell, e,
> medido (ADR-0007), nem sempre nesses casos. **O que nela não pode falhar tem
> guarda:** a versão citada em documento é imposta por
> `tests/repo/contagens.test.ts`, pela região `versao[...]`. "Não troque versão
> sem registrar o motivo" está no `CLAUDE.md`, que carrega sempre.

**A versão exata vive no `package.json` e no `.nvmrc`, e só lá.** O `engines` aceita
Node `>=22.12.0 <23`. Documento que cita versão usa a região `versao[pacote]` — ou
`versao[node]` —, e depois de trocar uma versão `node tools/contar-documentacao.mjs
--write` atualiza todas as cópias; `tests/repo/contagens.test.ts` reprova a que ficar
para trás.

**Trocar versão ou acrescentar dependência é decisão registrada** no log da §5 de
`docs/10-governanca.md`, e não em ADR — foi assim em `D-13` (Biome), `D-17` (Testing
Library e jsdom, **só de teste**) e `D-52` (o patch de segurança do Vitest). O
TypeScript tem fallback declarado, `5.9.3`, se a build falhar (`R-12`). O Dependabot
tem alertas ligados e updates automáticos desligados, pelo mesmo motivo
(`docs/08-qualidade-operacao.md` §5.2).

## `npm install` reprova com `Cannot read properties of null (reading 'edgesOut')`

**Não é o `package.json`.** É o **npm** que vem com o Node de `.nvmrc`,
resolvendo o conjunto de pares de `vitest` neste grafo — `vite@8` traz
`@vitejs/devtools-vitest`, que declara `vitest` como par, e o ciclo o derruba.
**Independe da versão do Vitest (`D-52`):** o erro aparece ao
**trocar** uma versão, quando o par precisa ser resolvido do zero, e não no dia a dia.

Use `npx --yes npm@11 install`, que resolve sem contorno nenhum. **`--legacy-peer-deps`
também passa e NÃO deve ser usado**: ele monta outra árvore. O CI não é afetado, porque
`npm ci` instala o que o lock diz sem resolver par nenhum.
