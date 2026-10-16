import { defineConfig } from 'vitest/config'

// Testes de integração: serviços reais + supabase-js real + PostgREST + Postgres (com RLS).
// Veja supabase/tests/run-integration.sh
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/integration/**/*.int.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
