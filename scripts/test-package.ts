/**
 * Kiểm thử gói đã đóng (release/dist.zip) như lúc một trường tải về, không chạy từ mã nguồn:
 * - Apache + PHP thật (Docker, giống cPanel): .htaccess, install.php ghi một lần, giải nén đè khi cập nhật.
 * - Node (server.mjs): chạy toàn bộ luồng trình cài đặt bằng e2e/install.spec.ts.
 *
 *   npm run release:build && npm run test:package     (cần Docker, Supabase cục bộ đã seed)
 *   SKIP_INSTALL_E2E=1 npm run test:package           chỉ kiểm tra Apache và đường dẫn
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ZIP = join(ROOT, 'release/dist.zip')
const APACHE_PORT = 8766
const NODE_PORT = 3003
const CONTAINER = 'eschool-package-test'
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const ANON_KEY = `${part({ alg: 'HS256' })}.${part({ role: 'anon' })}.signature-signature`

function extract(dir: string) {
  for (const [name, data] of Object.entries(unzipSync(readFileSync(ZIP)))) {
    const path = join(dir, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, data)
  }
}

async function waitFor(url: string) {
  for (let i = 0; i < 90; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(`Máy chủ không khởi động: ${url}`)
}

const postConfig = (base: string) =>
  fetch(`${base}/install.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supabaseUrl: 'https://abcdefgh.supabase.co', supabaseAnonKey: ANON_KEY }),
  })

async function expectShell(base: string, path: string) {
  const res = await fetch(`${base}${path}`)
  assert.equal(res.status, 200, `${path} phải trả 200`)
  assert.match(await res.text(), /id="root"/, `${path} phải trả trang ứng dụng`)
}

async function testApache(dir: string) {
  const base = `http://127.0.0.1:${APACHE_PORT}`
  chmodSync(dir, 0o777)
  spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
  const script =
    'a2enmod rewrite headers deflate >/dev/null && chmod -R a+rwX /var/www/html && exec apache2-foreground'
  const run = spawnSync(
    'docker',
    [
      'run',
      '-d',
      '--name',
      CONTAINER,
      '-p',
      `${APACHE_PORT}:80`,
      '-v',
      `${dir}:/var/www/html`,
      'php:8.3-apache',
      'sh',
      '-c',
      script,
    ],
    { stdio: 'inherit' },
  )
  assert.equal(run.status, 0, 'Không chạy được Docker Apache')
  try {
    await waitFor(base)

    // Chưa cài: mọi đường dẫn của ứng dụng trả trang, file có thật được phục vụ trực tiếp
    await expectShell(base, '/')
    await expectShell(base, '/admin')
    await expectShell(base, '/so-do-trang')
    await expectShell(base, '/tin-tuc/bai-viet-thu')
    assert.match((await fetch(`${base}/install.sql`)).status.toString(), /^200$/)
    assert.equal(((await (await fetch(`${base}/upgrades/index.json`)).json()) as unknown[]).length > 0, true)
    const robots = await fetch(`${base}/robots.txt`)
    assert.match(await robots.text(), /Sitemap:/)
    assert.equal((await fetch(`${base}/.htaccess`)).status, 403)

    // install.php nhận diện PHP, chặn khóa bí mật, ghi đúng một lần
    const info = (await (await fetch(`${base}/install.php`)).json()) as { php?: string; writable: boolean }
    assert.ok(info.php, 'install.php phải chạy bằng PHP, không trả mã nguồn')
    assert.equal(info.writable, true)
    const bad = await fetch(`${base}/install.php`, {
      method: 'POST',
      body: JSON.stringify({
        supabaseUrl: 'https://abcdefgh.supabase.co',
        supabaseAnonKey: `${part({ alg: 'HS256' })}.${part({ role: 'service_role' })}.signature-signature`,
      }),
    })
    assert.equal(bad.status, 422)
    assert.equal((await postConfig(base)).status, 200)
    const saved = (await (await fetch(`${base}/config.json`)).json()) as { supabaseAnonKey: string }
    assert.equal(saved.supabaseAnonKey, ANON_KEY)
    assert.equal((await fetch(`${base}/.eschool-install.lock`)).status, 403)
    assert.equal(existsSync(join(dir, 'install.php')), false, 'install.php phải tự xóa sau khi ghi')

    // Cập nhật: giải nén đè bản mới, cấu hình còn nguyên, install.php quay lại vẫn bị khóa
    extract(dir)
    assert.equal(existsSync(join(dir, 'config.json')), true, 'giải nén đè không được xóa config.json')
    const again = await postConfig(base)
    assert.equal(again.status, 409, 'install.php đưa lại khi cập nhật phải bị khóa')
    assert.equal(
      ((await (await fetch(`${base}/config.json`)).json()) as { supabaseAnonKey: string }).supabaseAnonKey,
      ANON_KEY,
    )
    console.log('Apache + PHP: đạt')
  } catch (error) {
    spawnSync('docker', ['logs', '--tail', '30', CONTAINER], { stdio: 'inherit' })
    throw error
  } finally {
    spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
  }
}

async function testNode(dir: string) {
  const base = `http://localhost:${NODE_PORT}`
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: dir,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(NODE_PORT), VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  })
  try {
    await waitFor(base)
    await expectShell(base, '/admin')
    assert.notEqual((await fetch(`${base}/install.php`)).headers.get('content-type'), 'application/json')
    console.log('Node: đường dẫn đạt')
    if (process.env.SKIP_INSTALL_E2E) return
    const e2e = spawnSync(
      process.execPath,
      [join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test', '--project=install'],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, FRESH_URL: base } },
    )
    assert.equal(e2e.status, 0, 'Luồng cài đặt từ gói không đạt')
  } finally {
    server.kill()
  }
}

async function main() {
  assert.ok(existsSync(ZIP), 'Chưa có release/dist.zip, hãy chạy npm run release:build')
  const apacheDir = mkdtempSync(join(tmpdir(), 'eschool-apache-'))
  const nodeDir = mkdtempSync(join(tmpdir(), 'eschool-node-'))
  try {
    extract(apacheDir)
    extract(nodeDir)
    await testApache(apacheDir)
    await testNode(nodeDir)
  } finally {
    rmSync(apacheDir, { recursive: true, force: true })
    rmSync(nodeDir, { recursive: true, force: true })
  }
}

await main()
