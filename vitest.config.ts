import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Dois ambientes, um por camada.
 *
 * O servidor roda em Node e nao tem DOM; os componentes precisam de um. Um
 * ambiente unico obrigaria a escolher entre carregar `jsdom` para as centenas
 * de testes de servidor que nao o usam, ou deixar a interface sem teste.
 * `projects` resolve sem pagar nenhum dos dois precos.
 *
 * O comentario que vivia aqui sobre o paralelismo saiu com a correcao de
 * `H-32`: a corrida que o motivava foi resolvida na origem, fechando o
 * descritor da aba fora de escopo em `xlsx-reader.ts`.
 *
 * **Nao desligue o paralelismo aqui.** Nunca foi o caminho: foi tentado, dava
 * 0 falhas em 6 rodadas localmente e mesmo assim reprovou no runner do GitHub.
 * Reduzir probabilidade nao e corrigir causa, e o paralelismo fica ligado de
 * proposito.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'web/src/**/*.{ts,tsx}'],
      // RNF-35: dominio >= 90%. RNF-36: io >= 80%.
      // Os limiares sobem conforme as historias entregam codigo real.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
    projects: [
      {
        test: {
          name: 'servidor',
          globals: true,
          environment: 'node',
          env: { NODE_ENV: 'test' },
          include: ['tests/**/*.test.ts'],
          setupFiles: ['tests/setup.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'interface',
          globals: true,
          environment: 'jsdom',
          env: { NODE_ENV: 'test' },
          include: ['web/tests/**/*.test.{ts,tsx}'],
          setupFiles: ['web/tests/setup.ts'],
        },
      },
    ],
  },
})
