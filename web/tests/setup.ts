import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetLoadedPages } from '../src/hooks/useFirstLoad.ts'

/**
 * Desmonta o que ficou na tela entre um teste e outro.
 *
 * Sem isto, o `jsdom` acumula todas as arvores renderizadas no mesmo
 * `document`, e uma consulta por texto passa a encontrar o elemento de um teste
 * anterior — falha intermitente, e que aponta para o lugar errado.
 *
 * **`resetLoadedPages` tem a mesma natureza e outra origem** (`H-85`): o
 * registro de paginas ja carregadas vive num MODULO, e nao num componente,
 * porque e a unica forma de sobreviver ao `key={dataVersion}` que remonta a
 * pagina. Modulo persiste entre testes: sem o reset, a segunda montagem de uma
 * pagina em qualquer arquivo ja a encontraria marcada, o esqueleto nao
 * apareceria, e a assercao passaria a depender da ORDEM dos casos.
 */
afterEach(() => {
  cleanup()
  resetLoadedPages()
})
