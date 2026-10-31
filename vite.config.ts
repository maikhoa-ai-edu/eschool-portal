/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }
import { buildInstallSql, buildUpgrades, upgradesIndex } from './scripts/build-install-sql.ts'

/** /install.sql và /upgrades/* luôn khớp migrations: dev thì sinh khi được gọi, build thì đưa vào dist/. */
function installSql(): Plugin {
  return {
    name: 'eschool-install-sql',
    configureServer(server) {
      server.middlewares.use('/install.sql', (_req, res) => {
        res.setHeader('Content-Type', 'application/sql; charset=utf-8')
        res.end(buildInstallSql())
      })
      server.middlewares.use('/upgrades/', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]!.slice(1)
        const upgrades = buildUpgrades()
        const body =
          name === 'index.json' ? upgradesIndex(upgrades) : upgrades.find((u) => u.file === name)?.sql
        if (body === undefined) return next()
        res.setHeader(
          'Content-Type',
          name.endsWith('.json') ? 'application/json' : 'application/sql; charset=utf-8',
        )
        res.end(body)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'install.sql', source: buildInstallSql() })
      const upgrades = buildUpgrades()
      this.emitFile({ type: 'asset', fileName: 'upgrades/index.json', source: upgradesIndex(upgrades) })
      for (const u of upgrades)
        this.emitFile({ type: 'asset', fileName: `upgrades/${u.file}`, source: u.sql })
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
  build: {
    rolldownOptions: {
      output: {
        // Gộp thư viện mọi trang đều cần và icon: tránh hàng chục file nhỏ phải chờ nhau trên hosting chỉ có HTTP/1.1.
        // Liệt kê tường minh để thư viện của trang quản trị (TipTap, biểu mẫu...) không lọt vào gói chung.
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler|cookie|set-cookie-parser|@tanstack|@supabase|zod|clsx|tailwind-merge)[\\/]/,
            },
            { name: 'icons', test: /node_modules[\\/]lucide-react/ },
            { name: 'shared', test: /src[\\/](lib|components[\\/]ui|features[\\/](site|media|auth))[\\/]/ },
          ],
        },
      },
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
