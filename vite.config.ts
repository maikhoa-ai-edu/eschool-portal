/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }
import { buildInstallSql } from './scripts/build-install-sql.ts'

/** /install.sql luôn khớp migrations: dev thì sinh khi được gọi, build thì đưa vào dist/. */
function installSql(): Plugin {
  return {
    name: 'eschool-install-sql',
    configureServer(server) {
      server.middlewares.use('/install.sql', (_req, res) => {
        res.setHeader('Content-Type', 'application/sql; charset=utf-8')
        res.end(buildInstallSql())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'install.sql', source: buildInstallSql() })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), installSql()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Cổng 3000 khớp với auth.site_url trong supabase/config.toml
  server: { port: 3000, strictPort: true },
  preview: { port: 3000 },
  test: {
    // e2e/ là kiểm thử Playwright, chạy riêng bằng npm run test:e2e
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
