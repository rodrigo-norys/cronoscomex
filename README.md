# 🚢 CronosComex

Painel operacional de desembaraço aduaneiro. Lê uma planilha `.xlsx` local,
calcula indicadores e grava de volta no arquivo **sob comando explícito**.

Sem banco de dados, sem nuvem, sem autenticação — a planilha **é** o banco.

---

## 🎯 Por que assim

A operação já roda sobre uma planilha compartilhada, editada por fora o dia
inteiro e sincronizada por uma pasta de nuvem. Substituí-la por um sistema
exigiria migrar o processo e treinar as pessoas; lê-la não exige nada. A decisão
está em [ADR-0001](docs/adr/0001-planilha-como-fonte-da-verdade.md) e
[ADR-0002](docs/adr/0002-aplicacao-local-sem-banco.md).

Três restrições moldam todo o resto:

- 📑 **A planilha é a referência prioritária.** Quando a especificação e o arquivo
  divergem, o arquivo vence — e a divergência vira achado documentado, nunca
  correção silenciosa.
- 🔍 **Nada é adivinhado.** Cor não reconhecida não vira a cor mais próxima; data
  sem ano não recebe ano inventado. Buraco visível é melhor que valor errado
  invisível.
- 🧾 **Nada é descartado em silêncio.** Toda linha não interpretada vai para um
  relatório de quarentena com motivo estruturado.

## 🧰 Stack

Node 22 · TypeScript · Fastify · fflate (leitura e escrita cirúrgica no zip) ·
chokidar · React · Vite · Tailwind · Recharts · Vitest · Biome

---

## 📦 Instalação

> [!NOTE]
> Quem vai **usar** a aplicação recebe a branch `distribuicao`, e o passo a passo
> de instalação — escrito para quem não é técnico — está no `README.md` dela.
> Este arquivo é para quem desenvolve: o ambiente está em
> [Desenvolvimento](#desenvolvimento).

---

## 🎨 As cores da planilha

A aplicação lê o preenchimento de cada linha e deriva dele três campos — a cor
de responsável, o canal aduaneiro e o importador fora do RJ. O mapa está em
[`config/color-map.json`](config/color-map.json), com **<!-- conta:chaves-de-cor -->9<!-- /conta --> chaves de cor**
medidas sobre o arquivo real em 03/08/2026 (`H-01`), cobrindo 100% das linhas.
O **responsável** não vem da cor desde `H-93` (`D-40`): vem do mapa de equipe,
pelo importador.

> [!IMPORTANT]
> **Cor nunca infere a categoria:** a coluna STATUS e a cor são campos
> independentes. Três cartões da Página Início contam pela cor, de propósito
> (`D-49` e `D-54`), e por isso podem divergir da contagem por categoria. E cor
> desconhecida não vira a mais próxima — a linha vai para a quarentena com o
> motivo, visível em `GET /api/quarantine`.

🔁 Refaça o mapa quando:

- **a planilha ganhar a aba do ano seguinte** — o esquema muda entre anos, e as
  abas `2025` e `2024` são a prova;
- **aparecerem linhas na quarentena por cor não reconhecida**.

O procedimento está em [`docs/perfilamento/RESULTADO.md`](docs/perfilamento/RESULTADO.md),
seção 5.

> [!WARNING]
> A saída bruta do perfilador traz amostras de célula das quatro abas —
> **grave em pasta temporária e sanitize antes de mover para o projeto**.

---

## 💾 Backup e restauração

Antes de **cada** escrita na planilha, a aplicação copia o arquivo inteiro para
`data/backups/`, com o nome `planilha-AAAAMMDD-HHMMSS.xlsx` — carimbo no
horário local da máquina, que é o relógio de quem vai escolher a cópia.

Ficam guardados os **30 mais recentes** ou os dos **últimos 90 dias**: uma cópia
sobrevive se passar em **qualquer um** dos dois critérios (RNF-21).

✅ **Restauração automática.** Se a validação posterior à escrita falhar, a
aplicação restaura o backup sozinha e informa o caminho na resposta e no log.
Não é presumido: `H-25` testa a falha e a restauração no mesmo caso.

🖐️ **Restauração manual** — para desfazer uma escrita correta, mas indesejada:

> [!WARNING]
> **Pause a sincronização do OneDrive** antes de trocar o arquivo. Substituí-lo
> com a sincronização ativa pode gerar cópia de conflito no meio da operação.

1. Feche o Excel, se a planilha estiver aberta.
2. **Pause a sincronização do OneDrive.**
3. Em `data/backups/`, escolha o arquivo pelo carimbo — o mais recente **antes**
   da escrita indesejada.
4. Copie-o por cima da planilha, mantendo o nome original dela.
5. Retome a sincronização e abra a planilha para conferir.

Se a aplicação estiver no ar, ela detecta a troca do arquivo e relê sozinha.

---

<a id="desenvolvimento"></a>

## 🛠️ Desenvolvimento

```bash
nvm use                                       # Node 22, conforme .nvmrc
npm ci
npm run dev                                   # servidor em 5173, interface em 5174
```

O caminho da planilha se aponta pela tela, em `/configuracao`, que cria o
`config/app.json`; os demais campos estão documentados em `config/app.json.exemplo`.

> [!IMPORTANT]
> `npm run verify` é o portão obrigatório. Os passos e a ordem dele estão em
> `scripts.verify`, no `package.json`, e só lá.

## 🏗️ Arquitetura

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

🔒 O servidor escuta **exclusivamente** em `127.0.0.1` (RNF-29). Nenhuma outra
máquina da rede alcança o painel, e é isso que torna a ausência de senha uma
decisão e não um esquecimento.

## ✍️ Escrita no arquivo

> [!CAUTION]
> Reserializar a planilha com uma biblioteca de `.xlsx` perde formatação
> condicional e validações de dados silenciosamente. Por isso a escrita é
> **cirúrgica no XML**, entrada por entrada do zip — ver
> [ADR-0004](docs/adr/0004-escrita-cirurgica-xlsx.md).

📏 Medido no ensaio de 17/09/2026 sobre a planilha real (`E-10`, em
[`docs/ensaio-planilha/RESULTADO.md`](docs/ensaio-planilha/RESULTADO.md)): editar
uma célula de texto deixa **28 das 30 entradas do arquivo byte a byte idênticas**,
incluindo as abas fora de escopo.

## 📊 Estado

**<!-- conta:historias-concluidas -->113<!-- /conta --> das <!-- conta:historias -->114<!-- /conta --> histórias** de [`docs/06-backlog.md`](docs/06-backlog.md) estão
concluídas — o bloco `✅ CONCLUÍDA` de cada uma é a fonte, e é lá que o número
se reconfere, com `grep -c '✅ \*\*CONCLUÍDA' docs/06-backlog.md`. A única
aberta é `H-101`, o autoajuste de largura de coluna, escrita e **não executada**
por escolha do usuário.

O plano original tinha 34 histórias; as demais nasceram do uso, e cada épico
posterior explica no próprio cabeçalho de onde veio.

Todos os indicadores e alertas em escopo estão entregues, com uma exceção
declarada: `IND-21` depende de uma coluna que a planilha não tem (decisão D-04).

A primeira validação da cadeia de ingestão contra o arquivo real, em 03/08/2026
(`H-01`), leu 649 linhas e aceitou as 649 — **quarentena 0%** —, com parse em
111–144 ms.

## 📚 Documentação

O plano completo está em [`docs/`](docs/) — requisitos, modelo de dados com as
tabelas de decisão, contratos de API, backlog executável, matriz de
rastreabilidade e <!-- conta:adrs -->7<!-- /conta --> ADRs. Comece por [`docs/README.md`](docs/README.md).

A auditoria da especificação original ([`docs/01`](docs/01-auditoria-especificacao.md))
registra os defeitos encontrados nela e como cada um foi resolvido — é o
documento que explica por que várias regras são como são.
