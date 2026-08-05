# ADR-0002 — Aplicação local em Node, servida no navegador, sem banco de dados

**Status:** Aceito · 03/08/2026

## Contexto

Definida a planilha como fonte da verdade (ADR-0001), resta decidir **onde a
aplicação roda** e **qual tecnologia sustenta a leitura, o cálculo e a
escrita**.

O contexto tem duas restrições dadas pelo usuário, que mudaram durante a
elaboração deste plano e cuja trajetória fica registrada aqui por honestidade
de processo:

1. o usuário pediu inicialmente que **Supabase free tier** fosse considerado
   como stack do projeto;
2. depois, ao ver o desenho tomando forma, determinou: *"Esqueça Supabase e
   banco de dados. A ideia é essa aplicação rodar numa máquina local e ler esse
   arquivo do OneDrive local."*

A segunda instrução prevalece. A matriz abaixo foi montada de qualquer forma,
porque a decisão precisa registrar **o que se perdeu** ao descartar as
alternativas — e porque um ADR que apenas ratifica a instrução recebida não
serve para nada quando alguém reabrir o assunto daqui a um ano.

---

## Critérios e pesos

**Escritos antes de qualquer candidato ser listado**, para que a matriz não
seja racionalização de escolha já feita.

| ID | Critério | Peso | Por que este peso |
|---|---|---|---|
| **C0** | **Ler o preenchimento de célula do `.xlsx`** | **ELIMINATÓRIO** | Responsável, canal e localização do importador **só existem como cor** (§3 da especificação). Sem isso, três campos e cinco itens do catálogo desaparecem. Não é um critério a pontuar; é uma condição de existência |
| C1 | Acessar o arquivo na pasta local do OneDrive | 5 | O arquivo é a fonte da verdade e vive num caminho local. Sem acesso, não há produto |
| C2 | Escrever no `.xlsx` preservando formatação | 5 | Reserializar destruiria a planilha de trabalho da empresa. É o risco de maior impacto do projeto (R-08) |
| C3 | Esforço de manutenção pelo time real | 4 | Um operador não técnico, sem equipe de TI dedicada. Cada peça a manter é uma peça que vai quebrar sem ninguém para consertar |
| C4 | Custo mensal | 4 | Projeto interno de uma equipe pequena, sem orçamento declarado de infraestrutura |
| C5 | Atualização em até 5 s após o Excel salvar (RNF-14) | 3 | É a definição operacional de "tempo real" que a especificação usa sem definir (§1) |
| C6 | Suporte a edição e trilha de mudanças | 3 | Requisito explícito do usuário: editar pelo painel e gravar de volta |
| C7 | Dado não sai da máquina | 3 | Dados de clientes e importadores reais; minimizar superfície é minimizar obrigação (LGPD) |

**Soma dos pesos pontuáveis: 27.**

---

## Candidatos

Listados **após** os critérios acima estarem fechados.

| ID | Candidato |
|---|---|
| **K1** | Aplicação local em Node servindo SPA no navegador — servidor Fastify em `127.0.0.1`, interface React carregada no Edge |
| **K2** | Supabase free tier + SPA hospedada + agente local de sincronização — Postgres gerenciado como índice, agente Node na máquina para ler e escrever o arquivo |
| **K3** | Aplicação desktop empacotada (Electron) — mesmo núcleo de K1, distribuído como executável Windows |
| **K4** | Power BI / Power Query sobre a planilha — ferramenta de BI, sem código de aplicação |

---

## Critério eliminatório

**C0 — ler o preenchimento de célula do `.xlsx`.**

| Candidato | Atende C0? | Evidência |
|---|---|---|
| K1 | **Sim** | ExcelJS expõe `cell.fill` com `type: 'pattern'` e `fgColor` ([README oficial](https://github.com/exceljs/exceljs/blob/master/README.md)) |
| K2 | **Sim** | O agente local usaria a mesma biblioteca |
| K3 | **Sim** | Idem |
| K4 | **Não — ELIMINADO** | Power Query lê apenas valores, não formatação. Confirmado por funcionário da Microsoft na comunidade oficial: *"the data connect only read the metadata and raw, it can't get the cell background color and the color can't be imported into query editor"* ([Fabric Community](https://community.fabric.microsoft.com/t5/Desktop/How-to-translate-read-color-blank-cell-from-excel-in-power-bi/td-p/1697976), consultado 03/08/2026) |

K4 é eliminado independentemente de pontuação. Os contornos citados na
comunidade — coluna auxiliar, macro VBA ou `GET.CELL` — exigiriam **criar
colunas na planilha**, o que o usuário vetou explicitamente.

> Registro para revisão futura: se um dia as colunas `RESPONSÁVEL` e `CANAL`
> forem criadas, como §8 da especificação sugere, K4 deixa de ser eliminado e
> passa a ser um candidato sério, com custo de desenvolvimento próximo de zero.

---

## Matriz de pontuação

Nota de 1 a 5 por critério, multiplicada pelo peso. Uma frase de justificativa
por célula.

| Critério (peso) | K1 — Node local | K2 — Supabase + agente | K3 — Electron |
|---|---|---|---|
| **C1 · Acesso ao arquivo local (5)** | **5** — o processo Node lê o caminho diretamente, sem intermediário | **5** — o agente local faz o mesmo; o Supabase em si não acessa o arquivo | **5** — idem, com acesso nativo |
| **C2 · Escrita preservando formatação (5)** | **5** — cirurgia no XML com `fflate`, no mesmo processo que leu | **5** — mesma técnica, no agente | **5** — mesma técnica |
| **C3 · Esforço de manutenção (4)** | **4** — um processo, um arquivo de configuração, nenhum serviço externo. Exige instalar o Node uma vez | **1** — três peças a manter (agente local, projeto Supabase, SPA hospedada), duas chaves de API, uma fila de escrita entre elas, e um projeto que **pausa após 1 semana de inatividade** no plano gratuito | **3** — peça única, mas o empacotamento precisa de pipeline de build Windows e o instalador é regerado a cada versão |
| **C4 · Custo mensal (4)** | **5** — zero. Nenhum serviço | **3** — zero no plano gratuito, mas com tetos: 500 MB de banco, 5 GB de egresso, sem backup, retenção de log de 1 hora ([pricing oficial](https://supabase.com/pricing), consultado 03/08/2026). Ultrapassar qualquer teto vira custo | **5** — zero |
| **C5 · Atualização ≤ 5 s (3)** | **5** — `chokidar` observa o arquivo; parse e recálculo no mesmo processo, sem rede | **3** — depende do agente sincronizar com o Postgres e da SPA receber a notificação; duas travessias de rede | **5** — idêntico a K1 |
| **C6 · Edição e trilha (3)** | **4** — fila em JSONL local e histórico append-only atendem plenamente ao caso de um usuário | **5** — transações, integridade referencial e trilha nativa; superior em capacidade | **4** — idêntico a K1 |
| **C7 · Dado não sai da máquina (3)** | **5** — nenhuma requisição externa | **1** — dados de clientes e importadores replicados para infraestrutura de terceiro | **5** — idêntico a K1 |
| **Total ponderado** | **132** | **93** | **123** |

**Detalhamento das somas:**
- K1: 25 + 25 + 16 + 20 + 15 + 12 + 15 = **132**
- K2: 25 + 25 + 4 + 12 + 9 + 15 + 3 = **93**
- K3: 25 + 25 + 12 + 20 + 15 + 12 + 15 = **123**

---

## Decisão

**K1 — aplicação local em Node servindo a SPA no navegador.**

O vencedor da soma **é** o recomendado. Nenhum peso foi ajustado depois de ver
o resultado: a distância entre K1 (132) e K3 (123) vem de um único critério
(C3, esforço de manutenção), e a distância para K2 (93) vem de C3, C7 e C5 —
exatamente os critérios que a arquitetura local favorece por construção.

Registro de honestidade: **K2 teria vencido C6** (edição e trilha), onde é
objetivamente superior. Não venceu no conjunto porque a capacidade extra não é
exercida — há um único usuário, sem concorrência a arbitrar.

### Nota de método — a matriz foi honesta?

O critério a que este ADR precisa responder é: **os pesos foram escritos antes
dos candidatos, ou ajustados depois para justificar uma escolha já feita?**

Resposta franca: **os critérios e pesos foram escritos antes dos candidatos, e
não foram alterados depois de somar** — mas quem os escreveu já conhecia a
instrução do usuário de rodar localmente. Essa contaminação é inevitável quando
a restrição é dada, e escondê-la seria pior que declará-la.

O que se pode verificar objetivamente:

- **A ordem de peso não favorece a escolha por conveniência.** Os dois maiores
  pesos (C1 e C2, ambos 5) são satisfeitos igualmente pelos três candidatos não
  eliminados — não separam nada. A decisão se resolve em C3, C4, C5 e C7, que
  somam 14 dos 27 pontos.
- **Nenhum critério foi criado para eliminar um candidato.** C0 elimina K4, mas
  C0 é a razão de existir do produto (§3 da especificação), não um filtro
  conveniente.
- **A matriz registra onde a escolha perde.** K2 vence C6 e isso está escrito.
  Se o objetivo fosse justificar K1, C6 teria peso menor ou não existiria.
- **Um teste de robustez:** para que K2 superasse K1, seria preciso que C7
  (dado não sai da máquina) valesse 0 **e** C3 (esforço de manutenção) caísse
  de 4 para 1. Ou seja, seria preciso deixar de se importar com privacidade e
  com quem mantém o sistema. Nenhuma das duas é defensável neste contexto.

### Stack fixada

Versões verificadas no registro npm em 03/08/2026.

| Camada | Escolha | Versão |
|---|---|---|
| Runtime | Node LTS | 22.23.2 |
| Linguagem | TypeScript | 7.0.2 · fallback declarado 5.9.3 |
| Servidor HTTP | Fastify | 5.11.2 |
| Leitura `.xlsx` | ExcelJS | 4.4.0 |
| Escrita `.xlsx` | fflate | 0.8.3 |
| Observação de arquivo | chokidar | 5.0.0 |
| Interface | React · Vite | 19.2.8 · 8.2.0 |
| Estilo | Tailwind CSS | 4.3.3 |
| Gráficos | Recharts | 3.10.1 |
| Testes | Vitest | 4.1.10 |
| Lint e formatação | Biome | 2.5.6 (decisão D-13) |

### Por que SPA no navegador, e não renderização no servidor

Next.js foi considerado e descartado por dois motivos independentes:

1. **Não há o que renderizar no servidor.** Um painel de usuário único, com
   dado já em memória no mesmo processo, não se beneficia de SSR.
2. **O host natural do Next.js está indisponível.** O plano Hobby da Vercel
   restringe-se a uso pessoal não comercial, e a definição inclui *"Receiving
   payment to create, update, or host the site"* ([fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines),
   consultado 03/08/2026) — um projeto interno de empresa qualificaria como uso
   comercial. Isso é irrelevante para K1, que não hospeda nada, mas era
   decisivo para K2, e fica registrado caso a hospedagem volte à mesa.

---

## Consequências

### Positivas

- **Nada a hospedar, nada a pagar, nada a renovar.** Não há conta, plano,
  cota, chave de API nem certificado.
- **Nenhum segredo a gerenciar** (`08-qualidade-operacao.md §5.3`): sem banco,
  sem nuvem, sem autenticação, não existe credencial.
- **Superfície de ataque nula:** o servidor escuta apenas em `127.0.0.1`
  (RNF-29), o que dispensa autenticação (RNF-32) sem criar exposição.
- **Latência mínima:** leitura, cálculo e resposta acontecem no mesmo processo,
  sem travessia de rede.
- **Escopo LGPD reduzido ao mínimo:** nenhum dado pessoal sai da máquina
  (RNF-31), nenhuma transferência a documentar, nenhum operador terceiro.
- **Nenhuma peça pausa por inatividade**, ao contrário do plano gratuito do
  Supabase.

### Negativas

- **Sem acesso remoto.** O painel só existe na máquina onde roda. Consultar do
  celular ou de outro computador é impossível sem mudar esta decisão.
- **Disponibilidade atada à máquina** (RNF-18). Máquina desligada, painel
  inexistente.
- **Exige Node instalado** na máquina do operador. Mitigado pelo atalho de
  `H-30`, que detecta a ausência e orienta.
- **Sem integridade referencial e sem transação.** A fila de edições em JSONL
  não tem as garantias de um banco; aceitável para um usuário, insuficiente
  para vários.
- **Um segundo usuário exige rever esta decisão.** Não há caminho incremental:
  dois operadores simultâneos reabrem C6 e C7, e provavelmente levam a K2.
- **A janela do terminal precisa continuar aberta** enquanto o painel estiver
  em uso.

---

## Alternativas descartadas

### K2 — Supabase free tier + agente local

Descartada por instrução explícita do usuário e, independentemente disso,
perdedora na matriz (93 contra 132).

O que se perde ao descartá-la: acesso remoto, backup gerenciado, integridade
referencial e trilha de auditoria nativa.

O que se evita: três peças a manter em vez de uma; dados de clientes
replicados para terceiro; um projeto que, no plano gratuito, **é pausado após
1 semana de inatividade** e não inclui backup nem recuperação a ponto no tempo,
com retenção de log de 1 hora ([pricing oficial](https://supabase.com/pricing),
consultado 03/08/2026). Para uma ferramenta que pode ficar semanas sem uso em
período de baixa operação, a pausa automática é um defeito operacional
concreto, não teórico.

Registra-se ainda que, no plano gratuito, o serviço de e-mail embutido do
Supabase Auth permite **2 e-mails por hora**, alterável apenas com SMTP próprio
([docs de rate limits](https://supabase.com/docs/guides/auth/rate-limits),
consultado 03/08/2026) — o que teria inviabilizado convite e recuperação de
senha por e-mail, exigindo provisionamento manual de credenciais.

### K3 — Electron

Perdeu por C3 (esforço de manutenção): gerar o instalador Windows a partir de
uma máquina Linux exige pipeline de build com runner Windows, e cada versão
nova exige regerar e redistribuir o instalador. Para um único usuário, o ganho
de experiência (ícone e duplo clique) não paga essa cadeia.

**A porta fica aberta:** K3 compartilha o núcleo inteiro de K1. Se a
experiência de inicialização se mostrar um atrito real na operação, empacotar
depois é um acréscimo, não uma reescrita — nenhuma linha de `src/domain/`,
`src/io/` ou `web/` muda.

### K4 — Power BI / Power Query

**Eliminado por C0.** Power Query não lê preenchimento de célula, e os
contornos disponíveis exigiriam criar colunas na planilha, o que o usuário
vetou. Se as colunas `RESPONSÁVEL` e `CANAL` de §8 forem criadas no futuro,
este candidato volta à mesa com custo de desenvolvimento muito menor que
qualquer outro — e essa reavaliação deve acontecer, e não ser esquecida.

## Referências

- ADR-0001 — a planilha como fonte da verdade
- ADR-0006 — por que os indicadores são calculados em memória
- `02-requisitos.md §3` — todos os fatos externos verificados, com fonte e data
- R-10, R-12 em `07-plano-entrega.md`
