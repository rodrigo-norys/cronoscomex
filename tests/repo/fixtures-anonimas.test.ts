import { readdirSync, readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

/**
 * Guarda de dado pessoal DENTRO das nove fixtures `.xlsx` versionadas.
 *
 * **Ela existe porque nenhuma camada olhava para dentro delas, e um vazamento
 * sobreviveu meses por isso.** Medido em 01/09/2026: as nove carregavam, em
 * `xl/threadedComments/threadedComment1.xml`, comentario copiado da planilha do
 * operador, com nome de duas pessoas e uma instrucao de pagamento — e
 * `xl/workbook.xml` trazia a pasta de onde o arquivo foi salvo.
 *
 * **Nao foi ausencia de intencao.** `tools/build_fixtures.py` ja listava a
 * parte encadeada entre as que anonimiza; a regex mirava `<t>`, a tag do
 * comentario LEGADO, e comentario encadeado usa `<text>`. Anonimizacao pela
 * metade, invisivel porque nada conferia o artefato.
 *
 * **As tres camadas de dado sensivel isentam `tests/fixtures/*.xlsx` inteiro** —
 * `verifica-dados-sensiveis.sh` no check 1, o hook `guard-dados-sensiveis.sh`
 * no `git add`, e o check 6 pula binario por construcao (`grep -Iq .`). A
 * isencao e correta: versionar as fixtures e exigencia da regra inviolavel 7. O
 * que faltava era alguem olhar DENTRO, e e o que este arquivo faz.
 *
 * **O criterio nao e lista de termos proibidos.** Lista so pega o que ja se
 * sabe; aqui se cobra a FORMA que a anonimizacao produz — todo texto de
 * comentario e `comentario de teste`, todo nome exibido e `Usuario Teste`, e
 * assim por diante. Termo que ninguem previu reprova junto.
 */

const DIRETORIO = 'tests/fixtures'

/** Cada fixture, descompactada, com o texto de cada parte do zip. */
function partesDe(fixture: string): Map<string, string> {
  const bruto = unzipSync(readFileSync(`${DIRETORIO}/${fixture}`))
  const partes = new Map<string, string>()

  for (const [nome, conteudo] of Object.entries(bruto)) {
    // `theme1.xml` e `vmlDrawing1.vml` sao texto; nenhuma parte e binaria hoje,
    // e se passar a ser, `strFromU8` devolve algo que as regexes nao casam —
    // silencio, e nao falso positivo. E por isso que a ancora abaixo existe.
    partes.set(nome, strFromU8(conteudo))
  }
  return partes
}

const FIXTURES = readdirSync(DIRETORIO).filter((nome) => nome.endsWith('.xlsx'))

/**
 * As tres formas do check 6 de `.github/scripts/verifica-dados-sensiveis.sh`,
 * verbatim. A regra e uma so; o que muda e o alcance — la, arquivo de texto;
 * aqui, parte de dentro do zip, que aquele check nunca ve.
 */
const CAMINHO_DE_USUARIO =
  /\/home\/[a-z0-9][a-z0-9._-]*\/|\/Users\/[A-Za-z0-9][A-Za-z0-9._-]*\/|[A-Za-z]:.Users./

/** Endereco de e-mail. O unico admitido e o marcador que `sanitize` escreve. */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g

/** Conteudo textual de comentario, nas DUAS formas — legada e encadeada. */
const TEXTO_DE_COMENTARIO = /<t(?:\s[^>]*)?>([^<]*)<\/t>|<text(?:\s[^>]*)?>([^<]*)<\/text>/g

const PARTES_DE_COMENTARIO = /^xl\/(comments\d+\.xml|threadedComments\/)/

interface Ocorrencia {
  readonly fixture: string
  readonly parte: string
  readonly trecho: string
}

function varrer(
  aplicavel: (parte: string) => boolean,
  achar: (texto: string) => string[],
): Ocorrencia[] {
  const achados: Ocorrencia[] = []

  for (const fixture of FIXTURES) {
    for (const [parte, texto] of partesDe(fixture)) {
      if (!aplicavel(parte)) continue
      for (const trecho of achar(texto)) achados.push({ fixture, parte, trecho })
    }
  }
  return achados
}

const descrever = (achados: Ocorrencia[]): string[] =>
  achados.map((uma) => `${uma.fixture}:${uma.parte} — ${uma.trecho}`)

describe('as fixtures versionadas não carregam dado pessoal', () => {
  /**
   * Ancora contra guarda verde por vacuidade, e ela e o coracao deste arquivo:
   * se a descompactacao quebrar, TODAS as assercoes abaixo passam sem verificar
   * nada. Foi assim que o vazamento durou — ninguem olhava.
   */
  it('encontra as nove fixtures, e todas as partes de cada uma', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(9)

    for (const fixture of FIXTURES) {
      const partes = partesDe(fixture)
      expect(partes.size, `${fixture} descompactou vazia`).toBeGreaterThan(20)
      expect(partes.has('xl/workbook.xml'), `${fixture} sem workbook.xml`).toBe(true)
    }
  })

  it('as regexes reconhecem o defeito e ignoram o marcador', () => {
    expect(CAMINHO_DE_USUARIO.test('url="C:\\Users\\User\\Desktop\\"')).toBe(true)
    expect(CAMINHO_DE_USUARIO.test('url="C:\\Exemplo\\"')).toBe(false)
    expect(CAMINHO_DE_USUARIO.test('/home/fulano/x')).toBe(true)
    // A barra final separa diretorio de usuario de um caminho qualquer sob /home.
    expect(CAMINHO_DE_USUARIO.test('/home/vazamento.txt')).toBe(false)
    expect([...'<text>valor real</text>'.matchAll(TEXTO_DE_COMENTARIO)][0]?.[2]).toBe('valor real')
    expect([...'<t xml:space="preserve">outro</t>'.matchAll(TEXTO_DE_COMENTARIO)][0]?.[1]).toBe(
      'outro',
    )
  })

  /**
   * O texto de comentario e onde o vazamento estava, e as duas formas contam:
   * `<t>` na parte legada e `<text>` na encadeada. Vazio nao e violacao — a
   * `sanitize` deixa passar de proposito, porque em `xl/comments1.xml` o
   * `<text>` e um `CT_Rst`, de conteudo so-elemento.
   */
  it('todo comentário foi substituído pelo marcador', () => {
    const fora = varrer(
      (parte) => PARTES_DE_COMENTARIO.test(parte),
      (texto) =>
        [...texto.matchAll(TEXTO_DE_COMENTARIO)]
          .map((achado) => (achado[1] ?? achado[2] ?? '').trim())
          .filter((conteudo) => conteudo !== '' && conteudo !== 'comentario de teste'),
    )

    expect(descrever(fora)).toEqual([])
  })

  it('nenhuma parte carrega caminho de diretório de usuário', () => {
    const fora = varrer(
      () => true,
      (texto) => {
        const achado = CAMINHO_DE_USUARIO.exec(texto)
        return achado === null ? [] : [achado[0]]
      },
    )

    expect(descrever(fora)).toEqual([])
  })

  it('o único endereço de e-mail é o marcador', () => {
    const fora = varrer(
      () => true,
      (texto) => [...texto.matchAll(EMAIL)].map((achado) => achado[0]),
    ).filter((uma) => uma.trecho !== 'exemplo@exemplo.com')

    expect(descrever(fora)).toEqual([])
  })

  it('todo nome de pessoa é o marcador', () => {
    const nomes = varrer(
      () => true,
      (texto) =>
        [
          ...[...texto.matchAll(/displayName="([^"]*)"/g)].map((uma) => uma[1] ?? ''),
          ...[...texto.matchAll(/<dc:creator>([^<]*)<\/dc:creator>/g)].map((uma) => uma[1] ?? ''),
          ...[...texto.matchAll(/<cp:lastModifiedBy>([^<]*)<\/cp:lastModifiedBy>/g)].map(
            (uma) => uma[1] ?? '',
          ),
        ].filter((nome) => nome !== '' && nome !== 'Usuario Teste' && nome !== 'Teste'),
    )

    expect(descrever(nomes)).toEqual([])
  })
})
