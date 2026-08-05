import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // RNF-35: dominio >= 90%. RNF-36: io >= 80%.
      // Os limiares sobem conforme as historias entregam codigo real.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
})
