import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
    /*
     * O paralelismo entre arquivos permanece LIGADO. A corrida que derrubava o
     * exit code de forma nao deterministica e tratada onde ela existe — em
     * `tests/support/exceljs-cleanup.ts` —, e nao desligando o paralelismo:
     * aquilo reduzia a probabilidade sem remover a causa, e ainda assim
     * reprovou no runner do GitHub.
     */
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // RNF-35: dominio >= 90%. RNF-36: io >= 80%.
      // Os limiares sobem conforme as historias entregam codigo real.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
})
