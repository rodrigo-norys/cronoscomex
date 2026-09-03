import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  arvoreEsperada,
  ENTRYPOINTS,
  EXCLUSIVOS,
  SUPORTE,
} from '../../scripts/sincronizar-distribuicao.ts'

/**
 * Guarda da arvore que vai para a maquina do operador.
 *
 * **O que ela protege e um modo de falha que so aparece longe daqui.** A branch
 * `distribuicao` e um recorte do repositorio, e arquivo que fica de fora nao
 * quebra nenhum teste, nenhum lint e nenhuma build — quebra a partida na
 * maquina do operador, com uma mensagem de modulo nao encontrado. Foi o que
 * quase aconteceu em `H-48`, quando `server.ts` passou a importar dois modulos
 * que a arvore nao tinha.
 *
 * **Ela NAO compara com a branch `distribuicao`,** e a omissao e deliberada: o
 * `actions/checkout` do CI traz apenas a ref do PR, entao uma assercao sobre a
 * branch passaria na maquina de quem a tem e reprovaria no CI por ausencia — o
 * pior dos dois mundos. Quem compara e
 * `scripts/sincronizar-distribuicao.ts`, rodado a mao a partir da `main`
 * mesclada. O que se guarda aqui e o CALCULO: se ele estiver certo, a
 * sincronizacao esta certa.
 */

const { esperada, quebrados, alcancados } = arvoreEsperada()

describe('a arvore de distribuicao e calculavel', () => {
  it('nao tem import que deixou de resolver', () => {
    // Import quebrado no fecho vira arquivo faltando na maquina do operador.
    expect(quebrados).toEqual([])
  })

  it('alcanca os modulos a partir dos dois pontos de entrada', () => {
    // Ancora: se o extrator de imports parar de casar, isto reprova antes de a
    // arvore silenciosamente encolher para os arquivos de suporte.
    expect(alcancados).toBeGreaterThan(80)
    expect(esperada.length).toBeGreaterThan(100)
  })

  it('inclui a pagina carregada por import DINAMICO', () => {
    // Medido em 31/08/2026: a primeira versao do extrator exigia espaco depois
    // de `import` e nao casava `lazy(() => import('./pages/History.tsx'))` de
    // `web/src/App.tsx`. O script marcava os dois arquivos como sobrando, e
    // `--aplicar` os teria REMOVIDO — a Pagina Historico quebraria so la.
    expect(esperada).toContain('web/src/pages/History.tsx')
    expect(esperada).toContain('web/src/hooks/useHistory.ts')
  })

  it('inclui o CSS, que so o import de main.tsx alcanca', () => {
    expect(esperada).toContain('web/src/index.css')
  })

  it('inclui TODO asset que o CSS cita por url("/..."), e a licenca deles', () => {
    // Medido em 03/09/2026: o fecho tratava `.css` como folha, e os seis
    // `.woff2` de `H-58` nunca entraram na `distribuicao`. Fonte faltando nao
    // quebra nada — o navegador cai no fallback —, entao o script imprimia
    // "sincronizada com HEAD" e o operador via outra tipografia desde sempre.
    const css = readFileSync('web/src/index.css', 'utf-8')
    const citados = [...css.matchAll(/url\(\s*["']?(\/[^"')]+)["']?\s*\)/g)].map(
      (achado) => `web/public${achado[1] as string}`,
    )

    expect(citados.length).toBeGreaterThan(0)
    for (const asset of citados) {
      expect(existsSync(asset)).toBe(true)
      expect(esperada).toContain(asset)
    }
    // A OFL 1.1 exige a licenca junto dos binarios, e nenhum `url()` a cita.
    expect(esperada).toContain('web/public/fonts/LICENSE.txt')
  })

  it('inclui os dois mapas de negocio de H-48, que server.ts passou a importar', () => {
    expect(esperada).toContain('src/app/client-map-loader.ts')
    expect(esperada).toContain('src/domain/team-mapper.ts')
  })
})

describe('as listas declaradas nao apontam para arquivo que sumiu', () => {
  // Caminho morto nestas listas nao reprova nada na `main` — some um arquivo na
  // maquina do operador. Renomear `scripts/porta.mjs` sem tocar aqui e o caso.
  it.each(SUPORTE)('suporte: %s existe', (arquivo) => {
    expect(existsSync(arquivo)).toBe(true)
  })

  it.each(ENTRYPOINTS)('ponto de entrada: %s existe', (arquivo) => {
    expect(existsSync(arquivo)).toBe(true)
  })

  it('os exclusivos da branch existem tambem na main, com outro conteudo', () => {
    // `README.md` existe nas duas e diverge de proposito; `iniciar.cmd` da raiz
    // so existe na `distribuicao`, e por isso NAO se afirma nada sobre ele aqui.
    expect(EXCLUSIVOS).toContain('README.md')
    expect(existsSync('README.md')).toBe(true)
  })
})

describe('o recorte exclui o que o operador nao recebe', () => {
  it.each(['docs/', 'tests/', 'tools/', '.claude/', '.github/'])(
    'nenhum arquivo de %s entra na arvore',
    (prefixo) => {
      // O recorte e a razao de a branch existir: sem ele, entregar a aplicacao
      // entregaria tambem a auditoria, os testes e a planilha de fixture.
      expect(esperada.filter((arquivo) => arquivo.startsWith(prefixo))).toEqual([])
    },
  )

  it('nenhum arquivo de configuracao REAL entra — so os .exemplo', () => {
    // `app.json` tem o caminho local; os dois mapas tem nome de cliente e de
    // pessoa (regra inviolavel 8). Os tres estao no `.gitignore`, e esta
    // assercao impede que uma linha nova de SUPORTE os traga de volta.
    const reais = ['config/app.json', 'config/client-map.json', 'config/team-map.json']
    expect(esperada.filter((arquivo) => reais.includes(arquivo))).toEqual([])
  })
})
