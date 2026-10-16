import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Para GitHub Pages em subpasta (https://usuario.github.io/repositorio/), defina
// VITE_BASE_PATH=/repositorio/ no build. Em Vercel/Netlify/domínio próprio, deixe em branco.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    build: { sourcemap: false, chunkSizeWarningLimit: 600 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.test.{ts,tsx}'],
      // testes de integração exigem Postgres + PostgREST: rodam com `npm run test:integration`
      exclude: ['node_modules/**', 'src/integration/**'],
    },
  }
})
