/**
 * Máy chủ cho hosting có Node.js (không cần cài thêm gói):  node server.mjs
 * Cổng đọc từ biến PORT (mặc định 3000). Chạy trong thư mục chứa index.html.
 * Phục vụ file tĩnh có nén, trả index.html cho route của ứng dụng, thêm thẻ OG từng bài, /sitemap.xml, /robots.txt.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants, createBrotliCompress, createGzip } from 'node:zlib'
import { renderPage, renderRobots, renderSitemap } from './seo-core.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.sql': 'application/sql; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json|sql|xml)|image\/svg)/
/** Mã máy chủ và file nội bộ không phục vụ ra ngoài */
const HIDDEN = new Set(['/server.mjs', '/seo-core.mjs', '/seo.php', '/install.php'])

function readConfig() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'))
  } catch {
    const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey } = process.env
    return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null
  }
}

function baseHeaders(type, cache) {
  return {
    'Content-Type': type,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Accept-Encoding',
  }
}

function encoder(req, type) {
  if (!COMPRESSIBLE.test(type)) return null
  const accept = String(req.headers['accept-encoding'] ?? '')
  if (/\bbr\b/.test(accept)) {
    return {
      name: 'br',
      stream: createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }),
    }
  }
  return /\bgzip\b/.test(accept) ? { name: 'gzip', stream: createGzip() } : null
}

function send(req, res, status, type, cache, source) {
  const headers = baseHeaders(type, cache)
  const encoding = encoder(req, type)
  if (encoding) headers['Content-Encoding'] = encoding.name
  res.writeHead(status, headers)
  if (req.method === 'HEAD') return res.end()
  const input = typeof source === 'string' ? null : source
  const out = encoding ? encoding.stream : res
  if (encoding) encoding.stream.pipe(res)
  if (input) input.pipe(out)
  else out.end(source)
}

function staticCache(path) {
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  // config.json, sw.js, install.sql phải luôn lấy bản mới
  return 'no-cache'
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${PORT}`
    const proto = req.headers['x-forwarded-proto'] ?? 'http'
    const origin = `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`
    let path
    try {
      path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    } catch {
      res.writeHead(400).end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end()
      return
    }

    if (path === '/sitemap.xml') {
      const xml = await renderSitemap({ origin, config: readConfig() })
      return send(req, res, 200, TYPES['.xml'], 'public, max-age=3600', xml)
    }
    if (path === '/robots.txt') {
      return send(req, res, 200, TYPES['.txt'], 'public, max-age=3600', renderRobots(origin))
    }

    const file = resolve(ROOT, `.${path}`)
    const inside = file === ROOT || file.startsWith(ROOT + sep)
    const dotted = path.split('/').some((part) => part.startsWith('.'))
    if (inside && !dotted && !HIDDEN.has(path) && path !== '/' && path !== '/index.html') {
      if (existsSync(file) && statSync(file).isFile()) {
        const type = TYPES[extname(file)] ?? 'application/octet-stream'
        return send(req, res, 200, type, staticCache(path), createReadStream(file))
      }
    }
    // File tĩnh thiếu (vd phiên bản cũ của mã) không được trả về trang HTML
    if (path.startsWith('/assets/') || HIDDEN.has(path) || dotted) {
      res.writeHead(404).end()
      return
    }

    const shell = readFileSync(join(ROOT, 'index.html'), 'utf8')
    const page = await renderPage({ path, origin, config: readConfig(), shell })
    send(req, res, page.status, TYPES['.html'], 'no-cache', page.html)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  }
})

server.listen(PORT, () => console.log(`eSchool Portal: http://localhost:${PORT}`))
