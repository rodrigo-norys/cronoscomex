---
name: nova-pagina
description: Conduz uma página do CronosComex pelo padrão que `H-16` a `H-20` estabeleceram — hook com os quatro estados, filtros globais anexados, estado vazio afirmativo, nada calculado no cliente, montagem na casca e o stub estendido. Carrega as seis omissões medidas, cada uma com a história em que mordeu. Use ao implementar qualquer página nova, DEPOIS de `/fatia H-NN`.
when_to_use: Quando o usuário disser "implementa a Página Histórico", "falta a tela de X", "cria a página do detalhe" ou invocar /nova-pagina. Dentro de uma história, use depois de /fatia H-NN — a fatia abre a história, esta skill conduz a página dela.
argument-hint: '[H-NN]'
---

## Por que esta skill existe

**Saiu do gatilho declarado, ao fechar `H-20`** — cinco páginas com o mesmo
desenho, e as mesmas coisas fora do plano **toda vez**. Não é descuido de
execução: a lista de arquivos do backlog descreve a tela, e a tela precisa de
fiação que ninguém lembra de listar.

O que a repetição mostrou, com a história em que mordeu:

| Omissão | Onde mordeu |
|---|---|
| `web/src/App.tsx` — página que ninguém monta não existe | `H-18`, `H-19`, `H-20` |
| A asserção da casca que usava a rota como exemplo de marcador pendente | `H-18`, `H-19`, `H-20` — **três seguidas** |
| `web/tests/support/api-stub.ts` — ele **rejeita** rota não prevista | `H-20` |
| `api-client.ts` e o hook, quando a rota ainda não tinha cliente | `H-20` |
| A fixture do stub, que quebra no `typecheck` ao contrato ganhar campo | `H-19` |
| Nenhum arquivo de teste na lista | `H-18`, `H-19`, `H-20` |

As três primeiras linhas já são cobertas mecanicamente pela guarda de
`tests/repo/contratos.test.ts` e `web/tests/paginas-montadas.test.tsx`. Esta
skill cobre o resto — e existe para que a atenção da fatia vá para a regra, não
para a fiação.

## Os seis passos

### 1. Confira o que já existe antes de escrever

```bash
grep -n "export async function get" web/src/api-client.ts
ls web/src/hooks/
grep -n "path === '/api/" web/tests/support/api-stub.ts
```

Se a rota da página **não** aparecer nos três, o trabalho começa antes da tela:
`getX` no cliente, `useX` no hook, e a rota no stub. Em `H-20` os três faltavam,
e o stub rejeitando rota não prevista fez toda renderização de `/alertas` falhar
até ser estendido — **de propósito**: stub que devolve vazio para endereço errado
esconde o erro três passos adiante.

### 2. O hook, com os quatro estados

Nunca três, nunca cinco. Copie a forma de `useIndicators`:

```ts
export type XState =
  | { status: 'carregando' }
  | { status: 'pronto'; x: XResponse }
  | { status: 'semLeitura' }
  | { status: 'erro'; message: string }
```

**`semLeitura` não é lista vazia, e essa é a regra inteira.** A rota responde
`503 ARQUIVO_INDISPONIVEL` enquanto `lastReadAt` é `null`, e tratá-lo como falha
— ou pior, como conjunto vazio — afirmaria que a planilha tem zero linhas,
indistinguível do caso em que ela realmente tem (regra inviolável 3).

**Página de dado não trata `503` como falha.** Vira estado próprio, com traços e
a frase de que traço não é zero. Painel de zeros ali afirmaria que a planilha tem
zero processos. `H-17` a `H-22` herdam o padrão de `useIndicators` — copie de lá,
não redesenhe.

Duas obrigações mecânicas:

- `dataVersion` entra nas dependências do `useEffect` como **gatilho**, com o
  `biome-ignore` explicando. Removê-lo congela a tela na primeira leitura, e a
  virada do dia (A-62) deixa de mexer no que depende de calendário.
- `AbortController` no retorno, e `AbortError` ignorado no `catch`.

### 3. A página

Ordem dos ramos, sempre: `erro` → `semLeitura` → `carregando` → conteúdo. Sair
cedo em cada um evita o `?.` encadeado que esconde estado.

- **Não calcule.** Nem soma, nem ordenação, nem corte, nem tradução de chave
  fechada. Se faltar um número, ele vem do servidor — e se o servidor não o tem,
  isso é divergência para a fatia, não conta no cliente. A exceção medida é
  **geometria de apresentação**: largura de barra proporcional, e a soma de
  conferência de A-12, que evidencia invariante em vez de derivar indicador.
- **Estado vazio é afirmativo.** "Nenhum X no recorte atual" — e quando a
  distinção importar, diga que a leitura terminou. É o que separa "não há" de
  "ainda não se sabe".
- **Chave vazia vira `(sem valor)`**, nunca linha invisível. Medido: é o maior
  grupo de clientes (38) e o segundo de mercadorias (57).

  **A chave vazia é valor nos seis filtros de domínio aberto, e a query precisa
  carregá-la** — `asKeyList` em `src/domain/filters.ts`, separada de `asList` por
  `H-18`. A distinção é a presença do parâmetro, não o conteúdo: `?goods=` é
  "mercadoria em branco", parâmetro ausente não filtra. Antes disso `optionsOf` a
  oferecia de propósito e `applyFilters` a casava, mas ela morria em
  `parseFilters`, no meio: marcar "(em branco)" devolvia a base inteira, sem erro
  nem aviso, nos nove filtros da barra. Nos demais — categoria, canal,
  responsável, datas — vazio segue sendo ausência, porque lá não existe chave em
  branco. Medido: o recorte devolve 57 processos sem mercadoria e 38 sem cliente,
  onde antes devolvia 649.
- **Rótulo é a grafia de origem** (A-26), nunca a chave normalizada.

### 4. Clique que filtra e navega

Quando a página levar ao recorte:

```ts
if (!filters.selection.multi[key].includes(value)) filters.toggle(key, value)
navigate('/operacional')
```

**Aplicar, não alternar** — `toggle` puro desmarcaria o valor já selecionado e
levaria à outra tela com o filtro que o clique acabou de tirar. E **o filtro
antes da navegação**: `replaceState` é síncrono, então `navigate` já lê a query
nova; invertido, a página troca antes de o filtro existir.

**Nem toda linha pode ser clicável.** O ranking por responsável não é: A-18 faz
o filtro `colaborador1` selecionar **junto** `colaborador1_outros_clientes`,
enquanto o ranking os exibe separados. Clicar numa linha de 120 e cair numa tela
de 129 faz o operador desconfiar do número certo. **Antes de tornar clicável,
pergunte se o filtro casa exatamente com o que a linha conta.**

### 5. A fiação que o plano esquece

- `web/src/App.tsx` — o ramo em `PageOutlet`, e atualizar o comentário que lista
  as páginas restantes.
- `web/tests/App.test.tsx` — **procure a rota desta página** nas asserções de
  marcador pendente e migre-as para a próxima história ainda aberta. Aconteceu
  em `H-18`, `H-19` e `H-20`.
- `web/tests/support/api-stub.ts` — a rota, a fixture com **valores medidos**, e
  os controles `serveX` / `xWithoutRead` / `failX`.

### 6. O teste

Um arquivo em `web/tests/<Pagina>.test.tsx`, cobrindo:

- cada critério de aceite da história;
- cada caso-limite do backlog, com **valor concreto**;
- os dois estados que não são zero: `503` → `semLeitura`, e falha → `alert`;
- que a `queryString` dos filtros é anexada à requisição.

**Auxiliar de seção é assíncrono.** `getByRole('region', …)` síncrono dispara
antes de a requisição resolver e falha em toda página; use `findByRole`. E
`<article>`/`<section>` **não herdam nome acessível** do `h2`/`h3` dentro deles —
ponha `aria-label` no elemento, o que também melhora o leitor de tela.

## O que a casca já resolve — não refaça

**A casca hospeda as sete páginas, e `H-16` a `H-22` encaixam sem tocá-la.**
`PageOutlet` passa `dataVersion` como `key` — quando o dia vira ou a planilha é
relida, a página remonta e refaz as próprias requisições, sem assinar nada. O
que a página precisa consumir é `useFilters().queryString`, anexado às suas
requisições. Cada página pendente é um marcador explícito dizendo qual história
a entrega: buraco visível, nunca `TODO` escondido.

**A URL é o único estado dos filtros**, sem cópia em `useState` — duas fontes
divergiriam no primeiro `popstate`, e recarregar precisa preservar o recorte. A
escrita usa `replaceState`, não `pushState`: filtro é visualização, não
navegação, e marcar cinco clientes empilharia cinco entradas com "voltar"
virando "desmarcar o último". `navigate` preserva a query, então trocar de
página nunca limpa o recorte.

**O poll de 5 s do health é o que estende RNF-14 até a tela.** RNF-14 mede
2092 ms entre o Excel salvar e o **servidor** refletir; sem o intervalo o número
fica verdadeiro no servidor e velho no navegador. Ele pausa com a aba oculta, e
é também o que faz a faixa de estado aparecer e sumir sozinha.

## Armadilhas já medidas

- **`503` não é falha.** É estado próprio, com frase dizendo que traço não é zero.
- **Zero medido ≠ zero não mensurável.** `chegadas_hoje: 0` é medido;
  `processos_parados: 0` é ausência de instrumento até `H-28`, e aparece como
  **traço** com a razão dita. Dois números iguais, sentidos opostos. Mesma
  família da nota de `IND-21` e do estado `semLeitura`; é a regra inviolável 3
  aplicada a um número que já existe no contrato.
- **Ordem vinda do servidor não se refaz no cliente.** Ao agrupar, preserve a
  **primeira aparição**: a lista já chega ordenada, e o primeiro item de um grupo
  é o mais prioritário dele, então a posição de primeira aparição já é a correta.
  A ordenação do servidor é herdada inteira — inclusive nulos por último e o
  desempate por `sourceRow`. Verificado no arquivo real: 40 linhas de alerta
  viram 25 grupos sem quebrar a sequência de severidade em ponto nenhum.
- **Recorte que não se anuncia é descarte silencioso.** Exibindo `topN` de um
  conjunto maior, diga de quantos — regra inviolável 2.
- **Resposta de rede não é verificada pelo tipo.** Campo ausente vira traço,
  nunca exceção: um servidor de versão anterior derrubou a casca inteira com
  `undefined.split`. `HealthResponse` diz `today: string`, mas descreve o
  **contrato**, não o corpo que chegou. Tela branca é o pior dos buracos
  invisíveis (regra 3), e há teste de regressão.

## Ao terminar

`npm run verify`, a conferência contra a planilha real por
`tools/carregar-planilha.mjs`, e `/fechar-historia H-NN`.
