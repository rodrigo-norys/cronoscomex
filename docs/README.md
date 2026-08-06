# CronosComex — Documentação de Arquitetura

Plano de implementação do painel operacional de desembaraço aduaneiro.

Este conjunto de documentos existe para ser **executado por um agente de
codificação** com acesso apenas ao repositório e a estes arquivos. Toda decisão
de arquitetura já foi tomada; a implementação é execução, não escolha.

---

## O que este produto é

Uma aplicação **local**, que roda na máquina do operador, lê a planilha `.xlsx`
sincronizada pelo OneDrive, calcula os indicadores e alertas da especificação
funcional, e grava alterações de volta no próprio arquivo — sob comando
explícito.

**A planilha continua sendo a fonte da verdade.** A aplicação não a substitui;
ela a interpreta e a edita.

```
   .xlsx (OneDrive)  ──leitura──►  servidor Node local  ──►  painel no navegador
        ▲                                  │
        └──── escrita sob comando ─────────┘
```

Sem banco de dados. Sem nuvem. Sem autenticação. Nada sai da máquina.

---

## Ordem de leitura

### Para implementar

Leia nesta ordem. Cada documento pressupõe o anterior.

| # | Documento | O que traz | Leitura obrigatória antes de |
|---|---|---|---|
| 1 | [00-visao-escopo.md](00-visao-escopo.md) | Escopo, fora de escopo, 14 premissas (P-NN), o princípio da planilha-referência e o glossário | Tudo |
| 2 | [01-auditoria-especificacao.md](01-auditoria-especificacao.md) | Os **55 defeitos** da especificação e a resolução de cada um | Qualquer regra de negócio |
| 3 | [02-requisitos.md](02-requisitos.md) | Requisitos funcionais e os RNF quantificados, com origem declarada | Qualquer decisão de desempenho |
| 4 | [03-modelo-dados.md](03-modelo-dados.md) | Modelo em memória, arquivos locais e **as 7 tabelas de decisão** (TD-01 a TD-06 + TD-05.1) | H-04, H-05, H-06, H-07, H-27 |
| 5 | [04-arquitetura.md](04-arquitetura.md) | Diagramas de contexto, containers e componentes; estrutura de diretórios | H-02 |
| 6 | [05-contratos-api.md](05-contratos-api.md) | Rotas, schemas, códigos de erro e campos editáveis | Qualquer rota |
| 7 | [06-backlog.md](06-backlog.md) | **32 histórias executáveis**, com contrato, aceite e casos-limite | — |
| 8 | [07-plano-entrega.md](07-plano-entrega.md) | 5 fases, grafo de dependências, caminho crítico e **15 riscos** | Planejar a ordem |
| 9 | [08-qualidade-operacao.md](08-qualidade-operacao.md) | Testes, ingestão, observabilidade, LGPD e build | Escrever testes |
| 10 | [09-rastreabilidade.md](09-rastreabilidade.md) | Matriz de 28 linhas: indicador/alerta → história → teste → status | Verificar cobertura |
| 11 | [10-governanca.md](10-governanca.md) | Quem decide o quê, protocolo de mudança de escopo, ciclo de vida de ADR, *definition of done* e o log de decisões | Mudar escopo ou reabrir um ADR |

### Para entender por quê

| ADR | Decisão |
|---|---|
| [0001](adr/0001-planilha-como-fonte-da-verdade.md) | A planilha `.xlsx` é a única fonte da verdade |
| [0002](adr/0002-aplicacao-local-sem-banco.md) | Aplicação local em Node, sem banco — **com a matriz de decisão de plataforma** |
| [0003](adr/0003-leitura-xlsx-e-extracao-de-cor.md) | A cor é lida como chave de estilo literal, sem resolver RGB |
| [0004](adr/0004-escrita-ciruragica-xlsx.md) | Escrita cirúrgica no XML, nunca reserialização |
| [0005](adr/0005-historico-jsonl-append-only.md) | Histórico em JSONL append-only |
| [0006](adr/0006-indicadores-em-memoria.md) | Indicadores como funções puras em memória |

### Regras de processo

O `CLAUDE.md` da raiz traz o **protocolo de fatia**: antes de iniciar qualquer
história, apresentar o checklist do que será feito e aguardar. Divergências
encontradas no plano param a implementação em vez de serem contornadas.

### Recursos

- [perfilamento/RESULTADO.md](perfilamento/RESULTADO.md) — **resultado de `H-01`**, os fatos medidos
- [perfilamento/perfilamento-20260803.json](perfilamento/perfilamento-20260803.json) — relatório completo, sanitizado
- `../tools/profile_workbook.py` — o perfilador, para reexecutar na virada de ano
- `../tools/build_fixtures.py` — gerador das fixtures, derivando do arquivo real
- `../tests/fixtures/` — **7 fixtures `.xlsx`** já geradas e validadas
- `../config/color-map.json` — **mapa real**, 9 chaves, cobertura 100%
- `../config/status-aliases.json` — **dicionário real** de grafias de STATUS
- [assets/color-map.exemplo.json](assets/color-map.exemplo.json) — esqueleto comentado, mantido como referência de estrutura

---

## Estado atual: Fase 0 concluída

**`H-01` (perfilamento) foi executada em 03/08/2026** sobre o arquivo real
`CONTROLE DOS EMBARQUE.xlsx`. Leia
[perfilamento/RESULTADO.md](perfilamento/RESULTADO.md) **antes de tudo** — ele
converteu sete premissas em fato medido e mudou cinco documentos.

| Premissa | Resultado |
|---|---|
| P-01 · coluna E é AGENTE | ✅ confirmada — 576 valores, 35 distintos |
| P-02 · coluna P | ✅ `Coluna1`, 1 valor em 649 linhas |
| P-03 · datas têm ano | ✅ **confirmada** — 1.201 datas reais, zero texto sem ano |
| P-04 · uma aba | ❌ **refutada** — 4 abas; escopo fixado na `2026` |
| P-06 · cores | ⚠️ 9 chaves reais, não 7; cobertura 100% |
| P-07 · volume | ✅ 649 linhas, 293 KB |

**Consequências:** R-03 (o risco de maior impacto) encerrado; 16 itens da
matriz saíram de "Condicionado" para "Implementável"; `config/color-map.json` e
`config/status-aliases.json` existem com valores medidos; e **`H-27` foi
corrigida** — trocava o `styleId` inteiro, o que destruiria bordas.

## Por onde começar a implementar

**Comece pela Fase 1** — `H-02` (esqueleto) e a cadeia de leitura. Siga as
fases de [07-plano-entrega.md](07-plano-entrega.md): leitura confiável → painel
completo → edição → edição de cor.

O critério de saída da Fase 1 tem alvo medido: as **649 linhas** da aba `2026`
devem ser aceitas com **0% de quarentena**, já que o mapa de cores cobre as 9
chaves e não há REF duplicada nem vazia.

---

## Regras que valem para todo o projeto

1. **Nada é descartado em silêncio.** Toda linha não interpretada vai para o
   relatório de quarentena, com motivo estruturado.
2. **Nada é adivinhado.** Cor não reconhecida não vira a cor mais próxima; data
   sem ano não recebe um ano inventado. Buraco visível é melhor que valor
   errado invisível. O arquivo real provou a regra: tem dois verdes quase
   idênticos que um limiar teria unificado sozinho (A-48).
3. **A cor nunca infere o status.** Medido: há **66 linhas com STATUS vazio** e
   apenas **1 linha branca** — a coerência que a especificação afirma não existe
   no dado (A-04, A-54).
8. **A planilha é a referência prioritária**, acima da especificação. Quando o
   documento e o arquivo divergem, o arquivo vence, e a divergência vira achado
   registrado (`00-visao-escopo.md §6.1`).
4. **Nenhum teste toca a planilha real.** A suíte roda sobre fixtures
   versionadas.
5. **`src/domain/` não importa I/O.** A regra é verificada pelo lint e quebra a
   build.
6. **Nenhum dado pessoal em log.** Processos são referenciados por `ref` e
   número de linha.
7. **Nenhum número sem origem declarada.** Todo valor nos documentos está
   marcado como medido, informado, premissa, derivado ou verificado com fonte.

---

## Estado das premissas

Os números de volumetria desta documentação vêm de **execução real de código**
sobre o arquivo real (`H-01`, 03/08/2026) e estão marcados com origem `medido`.
As fotos da planilha (`planilha1.jpeg`, `planilha2.jpeg`) serviram para
**confirmar ou contestar** a especificação — nunca para contar.

**Uma única premissa de dado continua aberta:** P-14, o crescimento mensal de
linhas, que depende de informação do usuário e **não bloqueia implementação
alguma**.

---

## Fonte original

**Nenhum dos artefatos abaixo é versionado.** Todos são material do cliente:
ficam apenas na máquina de desenvolvimento. O que este repositório guarda é o
que foi **derivado** deles — a auditoria, as tabelas de decisão e o esquema
medido —, nunca o original.

- **Especificação funcional** — documento do cliente. Tratada como fonte da
  verdade para regras de negócio e catálogo de indicadores, e como **superada**
  no que diz respeito a arquitetura de fonte de dados. Auditada integralmente em
  [01-auditoria-especificacao.md](01-auditoria-especificacao.md), com os 55
  achados citando o trecho de origem — quem lê a auditoria não precisa dela
- **Fotos das linhas 475–484** da planilha real (colunas A–K e K–R). Evidência
  secundária, usada para confirmar ou contestar a especificação
- **A planilha real**, perfilada por `H-01`. Contém dado de cliente e, na aba
  `CNPJ`, dado sensível — ver a decisão de escopo D-10 em
  [10-governanca.md](10-governanca.md)
