/**
 * Kiểm thử public/install.php bằng máy chủ PHP thật.
 *
 *   npm run test:php                  (cần lệnh `php` trong PATH)
 *   PHP_DOCKER=1 npm run test:php     (máy không cài PHP: chạy bằng image php:8.3-cli)
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 8765
const BASE = `http://127.0.0.1:${PORT}`
const CONTAINER = 'eschool-install-php-test'

function jwt(payload: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.signature-signature`
}

const ANON_KEY = jwt({ iss: 'supabase', role: 'anon' })
const SERVICE_KEY = jwt({ iss: 'supabase', role: 'service_role' })

function startServer(dir: string): ChildProcess {
  const args = process.env.PHP_DOCKER
    ? [
        'docker',
        [
          'run',
          '--rm',
          '--name',
          CONTAINER,
          '-p',
          `${PORT}:8000`,
          '-v',
          `${dir}:/srv`,
          'php:8.3-cli',
          'php',
          '-S',
          '0.0.0.0:8000',
          '-t',
          '/srv',
        ],
      ]
    : ['php', ['-S', `127.0.0.1:${PORT}`, '-t', dir]]
  return spawn(args[0] as string, args[1] as string[], {
    stdio: process.env.PHP_DOCKER ? 'inherit' : 'ignore',
  })
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${BASE}/install.php`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('Máy chủ PHP không khởi động được')
}

async function post(body: unknown) {
  const res = await fetch(`${BASE}/install.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const dir = mkdtempSync(join(tmpdir(), 'eschool-php-'))
const script = join(dir, 'install.php')
copyFileSync(join(ROOT, 'public', 'install.php'), script)
const server = startServer(dir)

try {
  await waitForServer()

  const status = (await (await fetch(`${BASE}/install.php`)).json()) as Record<string, unknown>
  assert.equal(status.eschool, 'install.php')
  assert.equal(status.locked, false, 'chưa có config.json thì chưa khóa')
  assert.equal(status.writable, true)

  const url = 'https://abcdefgh.supabase.co'
  assert.equal(
    (await post({ supabaseUrl: url, supabaseAnonKey: SERVICE_KEY })).status,
    422,
    'từ chối service_role',
  )
  assert.equal((await post({ supabaseUrl: url, supabaseAnonKey: 'sb_secret_abcdefghijklmnop' })).status, 422)
  assert.equal(
    (await post({ supabaseUrl: 'http://abc.supabase.co', supabaseAnonKey: ANON_KEY })).status,
    422,
    'bắt buộc https',
  )
  assert.equal((await post({ supabaseUrl: `${url}/rest/v1?x=1`, supabaseAnonKey: ANON_KEY })).status, 422)
  assert.equal((await post('rác')).status, 400)
  assert.equal(existsSync(join(dir, 'config.json')), false, 'yêu cầu sai không được ghi file')

  const ok = await post({ supabaseUrl: `${url}/`, supabaseAnonKey: ` ${ANON_KEY} ` })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.ok, true)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')), {
    supabaseUrl: url,
    supabaseAnonKey: ANON_KEY,
  })
  assert.equal(ok.body.selfDeleted, true)
  assert.equal(existsSync(script), false, 'install.php tự xóa sau khi dùng')
  assert.equal(existsSync(join(dir, '.eschool-install.lock')), true)

  // Có người tải lại install.php lên: vẫn bị khóa, không ghi đè được cấu hình
  copyFileSync(join(ROOT, 'public', 'install.php'), script)
  const again = (await (await fetch(`${BASE}/install.php`)).json()) as Record<string, unknown>
  assert.equal(again.locked, true)
  const overwrite = await post({ supabaseUrl: 'https://attacker.supabase.co', supabaseAnonKey: ANON_KEY })
  assert.equal(overwrite.status, 409)
  assert.equal(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).supabaseUrl, url)

  console.log('install.php: tất cả kiểm thử đạt')
} finally {
  server.kill()
  // Dừng tiến trình docker CLI không dừng container, phải xóa container theo tên
  if (process.env.PHP_DOCKER) spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
  rmSync(dir, { recursive: true, force: true })
}
