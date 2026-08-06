import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
    /**
     * MITIGACAO TEMPORARIA — remover quando H-33 trocar o leitor por fflate.
     *
     * `readWorkbook` retorna antes de o ExcelJS terminar: medido, deixa 5
     * operacoes de FS pendentes e 4 temporarios em /tmp. Quando o worker do
     * Vitest encerra, o listener de `exit` do pacote `tmp` apaga os arquivos e
     * as operacoes pendentes falham com ENOENT — um erro nao tratado que
     * derruba o exit code sem reprovar teste nenhum.
     *
     * Medido: com paralelismo entre arquivos, 1 reprovacao em 8 execucoes;
     * sem paralelismo, 0 em 6. Custo: a suite vai de ~5,3 s para ~11,1 s.
     * Um portao que reprova por motivo alheio ao codigo ensina a ignorar
     * reprovacao, e ele e a ultima defesa antes do PR.
     */
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // RNF-35: dominio >= 90%. RNF-36: io >= 80%.
      // Os limiares sobem conforme as historias entregam codigo real.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
})
