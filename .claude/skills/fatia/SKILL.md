---
name: fatia
description: Abre uma história do backlog do CronosComex montando o checklist do protocolo de fatia, com o contrato fixado, os critérios de aceite e os casos-limite obrigatórios já embutidos. Use ao iniciar qualquer história H-NN, antes de escrever a primeira linha de código.
when_to_use: Quando o usuário disser "vamos para a H-12", "iniciar H-13", "próxima história" ou invocar /fatia H-NN.
argument-hint: [H-NN]
---

## A história, direto do backlog

!`sed -n "/^### $ARGUMENTS /,/^### H-/p" docs/06-backlog.md | head -n -1`

## Casos-limite obrigatórios atribuídos a esta história

Extraídos de `docs/08-qualidade-operacao.md` §1.3 — os 43 casos obrigatórios do
projeto. Cada linha abaixo precisa virar um teste com o **valor concreto** que
aparece nela.

!`grep -F "| $ARGUMENTS |" docs/08-qualidade-operacao.md`

## Linhas da matriz de rastreabilidade que citam esta história

!`grep -F "$ARGUMENTS" docs/09-rastreabilidade.md`

## O que fazer agora

Monte o checklist abaixo e **aguarde**. Não escreva código antes da resposta.

Todos os itens vêm do material acima, copiados — não inventados. O que não
estiver lá é divergência, e divergência **para** a implementação.

```markdown
## H-NN — <título>

**Objetivo:** <a frase do backlog>
**Tamanho:** P/M/G · **Depende de:** H-XX ✅ · **Fase:** N

### Contrato (já fixado — não redefinir)
<assinatura, rota ou schema, copiado do backlog>

### A fazer
- [ ] `caminho/do/arquivo.ts` — o que muda
- [ ] `caminho/do/teste.test.ts` — o que cobre

### Critérios de aceite
- [ ] Dado ... Quando ... Então ...

### Casos-limite a cobrir com teste
- [ ] `<valor concreto>` → `<resultado esperado>`

### Fora desta fatia
- <o que NÃO fazer aqui, e em qual história vai>

### Divergências encontradas no plano
- <nenhuma | descrição + o que proponho>
```

## Regras que valem durante toda a fatia

- Use `TodoWrite` em paralelo, para acompanhamento.
- Confira `node --version`. Se não devolver `v22.23.2`, prefixe `nvm use &&` em
  todo comando que execute Node — o shell reinicia a cada chamada.
- Nenhuma regra de negócio fora de `src/domain/`. O Biome quebra a build se a
  fronteira for violada.
- Ao terminar, invoque `/fechar-historia H-NN`.
