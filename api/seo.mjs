/**
 * Vercel Function: thẻ OG từng bài, /sitemap.xml, /robots.txt (đường dẫn ở phần rewrites của vercel.json).
 * Cấu hình đọc từ biến môi trường VITE_*, không có thì đọc /config.json của chính website.
 */
import { renderPage, renderRobots, renderSitemap } from '../public/seo-core.mjs'

async function readConfig(origin) {
  const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey } = process.env
  if (supabaseUrl && supabaseAnonKey) return { supabaseUrl, supabaseAnonKey }
  try {
    const res = await fetch(`${origin}/config.json`)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const origin = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers['x-forwarded-host'] ?? req.headers.host}`
  const path = String(new URL(req.url, origin).searchParams.get('path') ?? '/')

  if (path === '/robots.txt') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(renderRobots(origin))
    return
  }
  const config = await readConfig(origin)
  if (path === '/sitemap.xml') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(await renderSitemap({ origin, config }))
    return
  }
  // index.html là file tĩnh của cùng website nên luôn khớp bản build đang chạy
  const shell = await (await fetch(`${origin}/index.html`)).text()
  const page = await renderPage({ path, origin, config, shell })
  res.statusCode = page.status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.end(page.html)
}
