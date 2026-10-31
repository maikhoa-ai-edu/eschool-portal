/**
 * Kiểm thử thẻ OG, sitemap, robots trên cả máy chủ Node (public/server.mjs) lẫn PHP (public/seo.php),
 * dùng cùng một Supabase giả để bảo đảm hai bản cho kết quả như nhau.
 *
 *   npm run test:seo                  (cần lệnh `php`)
 *   PHP_DOCKER=1 npm run test:seo     (máy không cài PHP)
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STUB_PORT = 8771
const NODE_PORT = 8772
const PHP_PORT = 8773
const CONTAINER = 'eschool-seo-php-test'
const UUID = '00000000-0000-0000-0000-0000000000f1'

const SHELL = `<!doctype html><html lang="vi"><head>
<meta name="description" content="Mặc định" />
<title>eSchool Portal</title>
</head><body><div id="root"></div></body></html>`

const modules = { albums: true }
let down = false

/** Giả Supabase REST: lọc đủ để phát hiện máy chủ quên status=published hoặc gửi sai khóa. */
const stub = createServer((req, res) => {
  const url = new URL(req.url!, 'http://x')
  const table = url.pathname.replace('/rest/v1/', '')
  const q = url.searchParams
  const json = (data: unknown) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
  }
  if (down || req.headers.apikey !== 'anon-key') {
    res.statusCode = 500
    return res.end('{}')
  }
  if (table === 'site_settings') {
    return json([
      { key: 'school_identity', value: { school_name: 'Trường "Thử" & Mẫu', slogan: 'Dạy tốt' } },
      { key: 'branding', value: { logo_url: 'seed/logo.jpg', banner_url: null } },
    ])
  }
  if (table === 'homepage_slides') return json([{ image_path: 'seed/a-rsw.jpg' }])
  if (table === 'module_settings') {
    return json([
      { module_key: 'news', is_enabled: true },
      { module_key: 'albums', is_enabled: modules.albums },
      { module_key: 'announcements', is_enabled: true },
      { module_key: 'documents', is_enabled: true },
      { module_key: 'pages', is_enabled: true },
      { module_key: 'topics', is_enabled: true },
    ])
  }
  if (q.get('status') !== 'eq.published')
    return json([{ title: 'LỘ BẢN NHÁP', slug: 'lo', id: 'lo', updated_at: '' }])
  const rows: Record<string, Array<Record<string, unknown>>> = {
    news: [
      {
        slug: 'bai-mot',
        title: 'Bài <một> & "hai"',
        excerpt: 'Tóm tắt bài một',
        thumbnail_url: 'seed/ảnh 1.jpg',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ],
    announcements: [
      {
        id: UUID,
        title: 'Thông báo A',
        content: '<p>Nội&nbsp;dung <b>A</b></p>',
        updated_at: '2026-10-02T00:00:00Z',
      },
    ],
    documents: [],
    albums: [
      {
        slug: 'album-a',
        title: 'Album A',
        description: 'Mô tả',
        cover: { file_path: 'seed/bia.jpg' },
        updated_at: '2026-10-03T00:00:00Z',
      },
    ],
    pages: [
      {
        slug: 'an',
        title: 'Trang ẩn',
        meta_title: 'SEO ẩn',
        meta_description: 'Mô tả SEO',
        no_index: true,
        updated_at: '2026-10-04T00:00:00Z',
      },
    ],
    topics: [],
  }
  let list = rows[table] ?? []
  for (const key of ['slug', 'id']) {
    const f = q.get(key)
    if (f) list = list.filter((r) => `eq.${String(r[key])}` === f)
  }
  if (q.get('no_index') === 'eq.false') list = list.filter((r) => r.no_index !== true)
  json(list)
})

async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`Không kết nối được ${url}`)
}

/** Giải mã phần tử HTML trong giá trị thuộc tính/tiêu đề, để so sánh được giữa hai bản. */
function decode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
}
const og = (html: string, name: string) => {
  const m = new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)
  return m ? decode(m[1]!) : null
}

async function check(label: string, base: string, supabase: string) {
  console.log(`--- ${label}`)
  let res = await fetch(`${base}/tin-tuc/bai-mot`)
  let html = await res.text()
  assert.equal(res.status, 200)
  assert.equal(og(html, 'og:title'), 'Bài <một> & "hai"')
  assert.ok(!html.includes('<một>'), 'tiêu đề phải được thoát HTML')
  assert.equal(og(html, 'og:description'), 'Tóm tắt bài một')
  assert.equal(og(html, 'og:image'), `${supabase}/storage/v1/object/public/media/seed/%E1%BA%A3nh%201.jpg`)
  assert.equal(og(html, 'og:type'), 'article')
  assert.equal(og(html, 'og:url'), `${base}/tin-tuc/bai-mot`)
  assert.equal(og(html, 'description'), 'Tóm tắt bài một')
  assert.equal(html.match(/name="description"/g)?.length, 1, 'chỉ có một thẻ description')
  assert.equal(decode(/<title>(.*?)<\/title>/.exec(html)![1]!), 'Bài <một> & "hai" | Trường "Thử" & Mẫu')
  assert.ok(html.includes('id="root"'))

  html = await (await fetch(`${base}/thong-bao/${UUID}`)).text()
  assert.equal(og(html, 'og:description'), 'Nội dung A', 'bỏ thẻ HTML khỏi mô tả')
  assert.equal(
    og(html, 'og:image'),
    `${supabase}/storage/v1/object/public/media/seed/logo.jpg`,
    'không ảnh thì dùng logo',
  )

  html = await (await fetch(`${base}/thu-vien-anh/album-a`)).text()
  assert.equal(og(html, 'og:image'), `${supabase}/storage/v1/object/public/media/seed/bia.jpg`)

  html = await (await fetch(`${base}/trang/an`)).text()
  assert.equal(og(html, 'og:title'), 'SEO ẩn')
  assert.equal(og(html, 'robots'), 'noindex')

  res = await fetch(`${base}/tin-tuc/khong-co`)
  html = await res.text()
  assert.equal(res.status, 404)
  assert.equal(og(html, 'robots'), 'noindex')
  assert.ok(html.includes('id="root"'), '404 vẫn chạy ứng dụng để nhân sự xem trước bản nháp')

  html = await (await fetch(`${base}/`)).text()
  assert.equal(og(html, 'og:title'), 'Trường "Thử" & Mẫu')
  assert.ok(html.includes(`<link rel="preconnect" href="${supabase}" crossorigin />`))
  assert.ok(
    html.includes(`imagesrcset="${supabase}/storage/v1/object/public/media/seed/a-rsw.w480.webp 480w,`),
  )

  modules.albums = false
  res = await fetch(`${base}/thu-vien-anh/album-a`)
  assert.equal(res.status, 404, 'module tắt')
  let xml = await (await fetch(`${base}/sitemap.xml`)).text()
  assert.ok(!xml.includes('thu-vien-anh'), 'sitemap bỏ module tắt')
  modules.albums = true

  res = await fetch(`${base}/sitemap.xml`)
  xml = await res.text()
  assert.match(res.headers.get('content-type')!, /xml/)
  assert.ok(xml.includes(`<loc>${base}/tin-tuc/bai-mot</loc><lastmod>2026-10-01</lastmod>`))
  assert.ok(xml.includes(`<loc>${base}/thong-bao/${UUID}</loc>`))
  assert.ok(xml.includes(`<loc>${base}/thu-vien-anh/album-a</loc>`))
  assert.ok(!xml.includes('/trang/an'), 'sitemap bỏ trang no_index')
  assert.ok(!xml.includes('LỘ BẢN NHÁP'))

  const robots = await (await fetch(`${base}/robots.txt`)).text()
  assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`))
  assert.ok(robots.includes('Disallow: /admin'))

  // CSDL lỗi: website vẫn chạy
  down = true
  res = await fetch(`${base}/tin-tuc/bai-mot`)
  html = await res.text()
  assert.equal(res.status, 200)
  assert.ok(html.includes('<title>eSchool Portal</title>'))
  res = await fetch(`${base}/sitemap.xml`)
  assert.equal(res.status, 200)
  down = false
  console.log('    đạt')
}

const NODE_SUPABASE = `http://127.0.0.1:${STUB_PORT}`
const PHP_SUPABASE = process.env.PHP_DOCKER ? `http://host.docker.internal:${STUB_PORT}` : NODE_SUPABASE

function site(supabaseUrl: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'eschool-seo-'))
  for (const f of ['server.mjs', 'seo-core.mjs', 'seo.php'])
    copyFileSync(join(ROOT, 'public', f), join(dir, f))
  writeFileSync(join(dir, 'index.html'), SHELL)
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ supabaseUrl, supabaseAnonKey: 'anon-key' }))
  // Máy chủ PHP có sẵn không đọc .htaccess: file định tuyến đưa mọi đường dẫn về seo.php
  writeFileSync(join(dir, 'router.php'), '<?php require __DIR__ . "/seo.php";')
  return dir
}

const children: ChildProcess[] = []
const dirs: string[] = []
let failed = false
try {
  await new Promise<void>((r) => stub.listen(STUB_PORT, '0.0.0.0', r))

  const nodeDir = site(NODE_SUPABASE)
  dirs.push(nodeDir)
  children.push(
    spawn(process.execPath, ['server.mjs'], {
      cwd: nodeDir,
      env: { ...process.env, PORT: String(NODE_PORT) },
      stdio: 'inherit',
    }),
  )
  await waitFor(`http://127.0.0.1:${NODE_PORT}/robots.txt`)
  await check('Node (server.mjs)', `http://127.0.0.1:${NODE_PORT}`, NODE_SUPABASE)

  // Máy chủ Node không để lộ mã nguồn và file cấu hình ẩn
  for (const p of ['/server.mjs', '/seo-core.mjs', '/seo.php', '/.htaccess', '/../package.json']) {
    const res = await fetch(`http://127.0.0.1:${NODE_PORT}${p}`)
    assert.ok(!(await res.text()).includes('createServer'), p)
  }

  // Vercel Function: gọi trực tiếp hàm, website và config.json lấy từ máy chủ Node ở trên
  console.log('--- Vercel (api/seo.mjs)')
  // @ts-expect-error file JS thuần, không có khai báo kiểu
  const { default: handler } = await import('../api/seo.mjs')
  // Trên Vercel index.html là file tĩnh nguyên bản; máy chủ Node thì đã chèn thẻ nên phải giả lập
  const realFetch = globalThis.fetch
  globalThis.fetch = (input, init) =>
    String(input).endsWith('/index.html') ? Promise.resolve(new Response(SHELL)) : realFetch(input, init)
  const call = async (path: string) => {
    const result = { status: 200, type: '', body: '' }
    await handler(
      {
        url: `/api/seo?path=${encodeURIComponent(path)}`,
        headers: { 'x-forwarded-proto': 'http', 'x-forwarded-host': `127.0.0.1:${NODE_PORT}` },
      },
      {
        set statusCode(v: number) {
          result.status = v
        },
        setHeader(name: string, value: string) {
          if (name === 'Content-Type') result.type = value
        },
        end(body: string) {
          result.body = body
        },
      },
    )
    return result
  }
  const article = await call('/tin-tuc/bai-mot')
  assert.equal(og(article.body, 'og:title'), 'Bài <một> & "hai"')
  assert.ok(article.body.includes('id="root"'))
  assert.equal((await call('/tin-tuc/khong-co')).status, 404)
  assert.ok((await call('/sitemap.xml')).body.includes('/tin-tuc/bai-mot</loc>'))
  assert.ok((await call('/robots.txt')).body.includes('Disallow: /admin'))
  globalThis.fetch = realFetch
  console.log('    đạt')

  const phpDir = site(PHP_SUPABASE)
  dirs.push(phpDir)
  children.push(
    process.env.PHP_DOCKER
      ? spawn(
          'docker',
          [
            'run',
            '--rm',
            '--name',
            CONTAINER,
            '--add-host',
            'host.docker.internal:host-gateway',
            '-p',
            `${PHP_PORT}:8000`,
            '-v',
            `${phpDir}:/srv`,
            'php:8.3-cli',
            'php',
            '-S',
            '0.0.0.0:8000',
            '-t',
            '/srv',
            '/srv/router.php',
          ],
          { stdio: 'inherit' },
        )
      : spawn('php', ['-S', `127.0.0.1:${PHP_PORT}`, '-t', phpDir, join(phpDir, 'router.php')], {
          stdio: 'ignore',
        }),
  )
  await waitFor(`http://127.0.0.1:${PHP_PORT}/robots.txt`)
  await check('PHP (seo.php)', `http://127.0.0.1:${PHP_PORT}`, PHP_SUPABASE)
} catch (err) {
  failed = true
  console.error(err)
} finally {
  for (const c of children) c.kill()
  if (process.env.PHP_DOCKER) spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
  stub.close()
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
