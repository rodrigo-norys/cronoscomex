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

---

## Instalação

O destinatário desta seção é quem vai **usar** a aplicação, não desenvolvê-la.

### 1. Escolha a pasta — e não é dentro do OneDrive

Extraia o projeto em uma pasta **fora** de qualquer pasta sincronizada com a
nuvem. Por exemplo, `C:\CronosComex`.

Isto não é preferência. A aplicação grava em `data/`, **relativo à pasta do
projeto**: histórico de leituras, relatório de quarentena e — o que importa
aqui — uma cópia integral do `.xlsx` antes de cada escrita, em `data/backups/`.
Com o projeto dentro do OneDrive, cada backup vira um upload da planilha
inteira, e a pasta de segurança local passa a replicar na nuvem exatamente o
dado que ela existe para proteger.

**A planilha continua no OneDrive** — é o ponto da aplicação. O que fica fora é
o projeto.

### 2. Instale o Node 22

Baixe o **Node.js 22 LTS** em [nodejs.org](https://nodejs.org) e instale.

A aplicação executa TypeScript diretamente, com `--experimental-strip-types`,
que só existe a partir do Node 22. Versão anterior falha com `bad option`, que
não diz o que fazer.

### 3. Instale as dependências e compile a interface

Na pasta do projeto, uma vez:

```bash
npm ci
npm run build
```

### 4. Aponte para a planilha

```bash
copy config\app.json.exemplo config\app.json
```

Abra `config/app.json` e ajuste **`workbookPath`** para o caminho completo da
planilha na pasta sincronizada — algo como
`C:\Users\<usuário>\OneDrive - <organização>\<pasta>\<arquivo>.xlsx`. As barras
invertidas precisam ser dobradas, como no arquivo de exemplo.

O arquivo está no `.gitignore`: o caminho revela a estrutura de pastas e o nome
da organização.

Os demais campos têm padrão utilizável, e cada um traz um comentário `_comentario`
explicando o que é. Dois merecem atenção:

| Campo | O que muda |
|---|---|
| `port` | A porta do painel. Altere se a `5173` já estiver em uso na máquina |
| `stalledDaysThreshold` | Dias sem mudança de categoria para o alerta *Processos parados*. O valor `15` é **premissa**, não regra da especificação (achado A-32) |

### 5. Inicie

Duplo clique em **`scripts\iniciar.cmd`**.

Ele confere o Node, a configuração e a interface compilada, sobe o servidor e
abre o navegador em `http://127.0.0.1:5173`. **Fechar a janela encerra a
aplicação** — é assim que se desliga.

O servidor escuta **exclusivamente** em `127.0.0.1` (RNF-29). Nenhuma outra
máquina da rede alcança o painel, e é isso que torna a ausência de senha uma
decisão e não um esquecimento.

---

## As cores da planilha

A aplicação lê o preenchimento de cada linha e deriva dele três campos —
responsável, canal aduaneiro e importador fora do RJ. O mapa está em
[`config/color-map.json`](config/color-map.json), com **9 chaves de cor**
medidas sobre o arquivo real em 03/08/2026 (`H-01`), cobrindo 100% das linhas.

**Cor nunca infere status:** são campos independentes. E cor desconhecida não
vira a mais próxima — a linha vai para a quarentena com o motivo, visível em
`GET /api/quarantine`.

Refaça o mapa quando:

- **a planilha ganhar a aba do ano seguinte** — o esquema muda entre anos, e as
  abas `2025` e `2024` são a prova;
- **aparecerem linhas na quarentena por cor não reconhecida**.

O procedimento está em [`docs/perfilamento/RESULTADO.md`](docs/perfilamento/RESULTADO.md),
seção 5. A saída bruta do perfilador traz amostras de célula das quatro abas —
**grave em pasta temporária e sanitize antes de mover para o projeto**.

---

## Backup e restauração

Antes de **cada** escrita na planilha, a aplicação copia o arquivo inteiro para
`data/backups/`, com o nome `planilha-AAAAMMDD-HHMMSS.xlsx` — carimbo no
horário local da máquina, que é o relógio de quem vai escolher a cópia.

Ficam guardados os **30 mais recentes** ou os dos **últimos 90 dias**: uma cópia
sobrevive se passar em **qualquer um** dos dois critérios (RNF-21).

**Restauração automática.** Se a validação posterior à escrita falhar, a
aplicação restaura o backup sozinha e informa o caminho na resposta e no log.
Não é presumido: `H-25` testa a falha e a restauração no mesmo caso.

**Restauração manual** — para desfazer uma escrita correta, mas indesejada:

1. Feche o Excel, se a planilha estiver aberta.
2. **Pause a sincronização do OneDrive.** Substituir o arquivo com a
   sincronização ativa pode gerar cópia de conflito no meio da operação.
3. Em `data/backups/`, escolha o arquivo pelo carimbo — o mais recente **antes**
   da escrita indesejada.
4. Copie-o por cima da planilha, mantendo o nome original dela.
5. Retome a sincronização e abra a planilha para conferir.

Se a aplicação estiver no ar, ela detecta a troca do arquivo e relê sozinha.

---

## Desenvolvimento

```bash
nvm use                                       # Node 22, conforme .nvmrc
npm ci
cp config/app.json.exemplo config/app.json    # aponte para a sua planilha
npm run dev                                   # servidor em 5173, interface em 5174
```

`npm run verify` é o portão obrigatório: guarda de dados sensíveis +
`--experimental-strip-types` + lint + typecheck + testes + build.

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
entrada do zip — ver [ADR-0004](docs/adr/0004-escrita-cirurgica-xlsx.md).

Medido: alterar uma célula deixa **28 das 30 entradas do arquivo byte a byte
idênticas**, incluindo as abas fora de escopo.

## Estado

**32 das 34 histórias** de [`docs/06-backlog.md`](docs/06-backlog.md) estão
concluídas — o bloco `✅ CONCLUÍDA` de cada uma é a fonte, e o backlog é onde o
número se reconfere. Restam `H-33` e `H-34`.

Todos os indicadores e alertas em escopo estão entregues, com uma exceção
declarada: `IND-21` depende de uma coluna que a planilha não tem (decisão D-04).

Cadeia de ingestão validada contra o arquivo real em 03/08/2026: 649 linhas,
649 aceitas, **quarentena 0%**, parse em 111–144 ms.

## Documentação

O plano completo está em [`docs/`](docs/) — requisitos, modelo de dados com as
tabelas de decisão, contratos de API, backlog executável, matriz de
rastreabilidade e seis ADRs. Comece por [`docs/README.md`](docs/README.md).

A auditoria da especificação original ([`docs/01`](docs/01-auditoria-especificacao.md))
registra os defeitos encontrados nela e como cada um foi resolvido — é o
documento que explica por que várias regras são como são.
