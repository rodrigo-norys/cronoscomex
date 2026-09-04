# CronosComex

Painel operacional de desembaraço aduaneiro. Lê a planilha `.xlsx` do OneDrive,
calcula os indicadores e grava de volta no arquivo **sob comando explícito**.

Roda na sua máquina. Sem nuvem, sem senha, sem banco de dados.

---

## Instalação, em 4 passos

### 1. Escolha a pasta — e não é dentro do OneDrive

Extraia esta pasta em um lugar **fora** de qualquer pasta sincronizada com a
nuvem. Por exemplo, `C:\CronosComex`.

Isto não é preferência. A aplicação guarda, em `data\backups\`, uma cópia
inteira da planilha antes de cada gravação. Com o projeto dentro do OneDrive,
cada cópia de segurança vira um upload da planilha inteira — e a pasta que
existe para proteger o arquivo passaria a replicá-lo na nuvem.

**A planilha continua no OneDrive.** O que fica de fora é esta pasta.

### 2. Instale o Node.js 22

Baixe em [nodejs.org](https://nodejs.org) o instalador do **Windows (.msi)** da
versão **22 LTS** e vá clicando em Avançar até o fim. Não há opção a marcar.

Se você pular este passo, o atalho do passo 3 avisa e ensina o caminho — não
quebra nada.

### 3. Dê duplo clique em `iniciar.cmd`

Está aqui mesmo, nesta pasta.

Na **primeira vez** ele oferece compilar a interface, o que leva alguns minutos
e precisa de internet. Responda `S` e aguarde: vão aparecer muitas linhas de
texto técnico, e isso é normal. Nas vezes seguintes ele abre direto.

**Fechar a janela preta encerra a aplicação.** É assim que se desliga.

### 4. Aponte para a planilha, na tela

O navegador abre sozinho. Na primeira execução ele mostra a tela de
configuração: cole ali o caminho completo do arquivo `.xlsx` no OneDrive e
clique em **Carregar esta planilha**.

Isso é pedido **uma vez**. O caminho fica salvo, e nas próximas aberturas a
leitura acontece sozinha. Para trocar de arquivo depois — na virada de ano, por
exemplo — a mesma tela fica em *Configuração*, no menu.

**Você não edita arquivo nenhum**, em nenhum momento.

Dois arquivos de configuração — os mapas de **cliente** e de **equipe** — são
copiados por quem instala, e não por você. Sem eles a aplicação sobe e funciona:
o que muda é o campo Cliente, que passa a mostrar a grafia da célula em vez do
nome consolidado, e o Responsável, que faz o mesmo. Se for isso que você está
vendo, avise quem instalou.

---

## Quando algo der errado

O atalho confere **três coisas, e só três**: Node instalado, Node 22 ou maior, e
a interface compilada. As três acontecem antes de existir tela, e por isso são
as únicas que ele reporta. Cada uma traz a receita completa — o que baixar, de
onde, e o que fazer depois.

Todo o resto — a planilha não encontrada, a leitura falhando, a aba ausente — é
reportado **dentro do painel**, na tela de configuração, com o estado de cada
item.

Se a janela preta fechar sozinha ou mostrar erro que não se resolve com a
receita na tela, chame quem instalou a aplicação e mostre as linhas da janela.

---

## O que esta pasta contém

Só o necessário para executar. Esta é a distribuição do CronosComex, não o
código de desenvolvimento: não há testes, ferramentas, documentação de projeto
nem configuração de lint aqui.

| Pasta | O que é |
|---|---|
| `src\` | a aplicação — leitura da planilha, indicadores, servidor |
| `web\` | a interface, compilada no primeiro uso |
| `config\` | as cores e os apelidos de status reconhecidos |
| `scripts\` | a partida |

`config\app.json` **não vem junto** e não precisa: ele nasce quando você salva o
caminho da planilha na tela.

> **Para quem mantém:** esta branch é gerada a partir da `main` e não recebe
> commits próprios. O histórico de desenvolvimento, a documentação e os testes
> vivem lá. Ao publicar uma versão nova, refaça esta branch a partir da `main`
> em vez de editá-la — o processo está no fim deste arquivo.

<details>
<summary>Como refazer esta branch a partir da main</summary>

Os arquivos vêm da `main`; só `iniciar.cmd` (na raiz) e este `README.md` são
próprios daqui, e nunca são sobrescritos.

**A lista não se escreve à mão.** Quem a calcula é
`scripts/sincronizar-distribuicao.ts`, que vive na `main`: ele parte de
`src/http/server.ts` e `web/src/main.tsx`, segue o fecho transitivo dos imports
— inclusive os `url()` das folhas de estilo, que é como as fontes entram —
e soma os arquivos de suporte que nenhum import alcança.

```bash
# a partir da main, com a arvore limpa
node --experimental-strip-types scripts/sincronizar-distribuicao.ts
node --experimental-strip-types scripts/sincronizar-distribuicao.ts --aplicar
```

Sem argumento ele confere e sai `1` se divergir. Com `--aplicar` ele troca para
esta branch, prepara o índice e **para** — o commit e o push continuam sendo de
quem está olhando.

Uma lista escrita à mão já custou as seis fontes da interface, que nunca
entraram na branch: como fonte ausente não produz erro, o operador via outra
tipografia sem que nada reprovasse.

Confira que a árvore executa:

```bash
npm ci && npm run build && npm start
```

**`package.json` e `package-lock.json` vão inteiros, sem enxugar.** Duas razões
medidas: `react`, `vite`, `tailwind` e `recharts` estão em `devDependencies` e
são necessários para compilar a interface — então `npm ci --omit=dev` não
serve —, e `tsconfig.json` declara `"types": ["node", "vitest/globals"]`, o que
faz o `tsc` do build falhar se o `vitest` não estiver instalado.

</details>
