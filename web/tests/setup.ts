import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Desmonta o que ficou na tela entre um teste e outro.
 *
 * Sem isto, o `jsdom` acumula todas as arvores renderizadas no mesmo
 * `document`, e uma consulta por texto passa a encontrar o elemento de um teste
 * anterior — falha intermitente, e que aponta para o lugar errado.
 */
afterEach(cleanup)
