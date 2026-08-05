# CronosComex

Painel operacional de desembaraço aduaneiro. Lê uma planilha `.xlsx` local,
calcula indicadores e grava de volta no arquivo **sob comando explícito**.

Sem banco de dados, sem nuvem, sem autenticação — a planilha **é** o banco.

---

## Por que assim

A operação já roda sobre uma planilha compartilhada, editada por fora o dia
inteiro e sincronizada por uma pasta de nuvem. Substituí-la por um sistema
exigiria migrar o processo e treinar as pessoas; lê-la não exige nada. A decisão
está em [ADR-0001](docs/adr/0001-planilha-como-fonte-da-verdade.md) e
[ADR-0002](docs/adr/0002-aplicacao-local-sem-banco.md).

Três restrições moldam todo o resto:

- **A planilha é a referência prioritária.** Quando a especificação e o arquivo
  divergem, o arquivo vence — e a divergência vira achado documentado, nunca
  correção silenciosa.
- **Nada é adivinhado.** Cor não reconhecida não vira a cor mais próxima; data
  sem ano não recebe ano inventado. Buraco visível é melhor que valor errado
  invisível.
- **Nada é descartado em silêncio.** Toda linha não interpretada vai para um
  relatório de quarentena com motivo estruturado.

## Stack

Node 22 · TypeScript · Fastify · ExcelJS (somente leitura) · fflate (escrita
cirúrgica no zip) · chokidar · React · Vite · Tailwind · Recharts · Vitest ·
Biome

## Como rodar

```bash
nvm use                                       # Node 22, conforme .nvmrc
npm ci
cp config/app.json.exemplo config/app.json    # aponte para a sua planilha
npm run dev
```

`npm run verify` é o portão obrigatório: lint + typecheck + testes + build.

## Arquitetura

```
src/domain/    funções puras — indicadores, alertas, classificação. Sem I/O
src/io/        leitura e escrita de .xlsx, watcher, quarentena, histórico
src/app/       process-store, write-guard, configuração, log estruturado
src/http/      rotas Fastify — só serializam, não calculam
web/           SPA React — só apresenta, não calcula
```

`src/domain/` não importa `io`, `app`, `http` nem `web`. **Isso não é
convenção:** o Biome tem uma regra de fronteira que quebra a build se a
dependência for introduzida. O resultado é um núcleo de regra de negócio
testável sem servidor e sem arquivo.

## Escrita no arquivo

`workbook.xlsx.writeFile()` do ExcelJS perde formatação condicional e validações
de dados silenciosamente. Por isso a escrita é **cirúrgica no XML**, entrada por
entrada do zip — ver [ADR-0004](docs/adr/0004-escrita-ciruragica-xlsx.md).

Medido: alterar uma célula deixa **28 das 30 entradas do arquivo byte a byte
idênticas**, incluindo as abas fora de escopo.

## Estado

**12 de 32 histórias concluídas** · **279 testes** · cadeia de ingestão validada
contra o arquivo real: 649 linhas, 649 aceitas, **quarentena 0%**, parse em
111–144 ms.

## Documentação

O plano completo está em [`docs/`](docs/) — requisitos, modelo de dados com as
tabelas de decisão, contratos de API, backlog executável, matriz de
rastreabilidade e seis ADRs. Comece por [`docs/README.md`](docs/README.md).

A auditoria da especificação original ([`docs/01`](docs/01-auditoria-especificacao.md))
registra os defeitos encontrados nela e como cada um foi resolvido — é o
documento que explica por que várias regras são como são.
