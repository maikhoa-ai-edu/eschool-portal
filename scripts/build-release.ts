/**
 * Tạo gói phát hành trong thư mục release/ (bản build sạch, không dùng cấu hình kết nối của máy đang chạy).
 *
 *   npm run release:build                  thử trên máy hoặc CI
 *   RELEASE_TAG=v1.2.3 npm run release:build   workflow phát hành: tag phải khớp package.json, phải có mục trong CHANGELOG.md
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const RELEASE = join(ROOT, 'release')

const REQUIRED_FILES = [
  '.htaccess',
  'index.html',
  'install.php',
  'install.sql',
  'seo-core.mjs',
  'seo.php',
  'server.mjs',
  'sw.js',
  'upgrades/index.json',
]
const FORBIDDEN_NAME = /(^|\/)(\.env[^/]*|config\.json|\.eschool-install\.lock)$|\.(map|pem|key)$/
const FORBIDDEN_TEXT: Array<[RegExp, string]> = [
  [/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/, 'khóa JWT'],
  [/sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/, 'khóa Supabase'],
  [/(127\.0\.0\.1|localhost):54321/, 'địa chỉ Supabase cục bộ'],
  [/demo1234|@demo\.local/, 'tài khoản mẫu'],
  [/V(ĩ|i)nh Phong|c23vinhphong/i, 'tên trường trong dữ liệu mẫu'],
]
const TEXT_FILE = /\.(html|js|mjs|css|json|php|sql|txt|xml|webmanifest|svg)$|\.htaccess$/

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

/** Trả về danh sách lỗi của thư mục sẽ đóng gói; rỗng là an toàn để phát hành. */
export function findPackageProblems(dir: string): string[] {
  const files = listFiles(dir).map((path) => ({ path, name: relative(dir, path).replaceAll('\\', '/') }))
  const problems = REQUIRED_FILES.filter((name) => !files.some((f) => f.name === name)).map(
    (name) => `Thiếu file ${name}`,
  )
  for (const { path, name } of files) {
    if (FORBIDDEN_NAME.test(name)) problems.push(`Không được đóng gói file ${name}`)
    if (!TEXT_FILE.test(name)) continue
    const text = readFileSync(path, 'utf8')
    for (const [pattern, label] of FORBIDDEN_TEXT)
      if (pattern.test(text)) problems.push(`${name} chứa ${label}`)
  }
  return problems
}

/** Lấy nội dung mục "## <phiên bản>" trong CHANGELOG.md. */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith(`## ${version}`))
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim()
}

function zipDirectory(dir: string): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const path of listFiles(dir)) entries[relative(dir, path).replaceAll('\\', '/')] = readFileSync(path)
  return zipSync(entries, { level: 6 })
}

function fail(message: string): never {
  console.error(`LỖI: ${message}`)
  process.exit(1)
}

function requiredSchemaVersion(): string {
  const source = readFileSync(join(ROOT, 'src/lib/version.ts'), 'utf8')
  const match = /REQUIRED_SCHEMA_VERSION = '([\d.]+)'/.exec(source)
  if (!match) fail('Không đọc được REQUIRED_SCHEMA_VERSION')
  return match[1]!
}

function main() {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
  const tag = process.env.RELEASE_TAG
  if (tag && tag !== `v${version}`) fail(`Tag ${tag} không khớp phiên bản package.json (${version})`)

  const changelog = existsSync(join(ROOT, 'CHANGELOG.md'))
    ? readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')
    : ''
  const section = changelogSection(changelog, version)
  if (tag && !section) fail(`CHANGELOG.md chưa có mục ## ${version}`)

  // Biến tiến trình được ưu tiên hơn .env.local, nên gói không mang theo kết nối của máy đang build
  const build = spawnSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  })
  if (build.status !== 0) fail('vite build không thành công')

  const problems = findPackageProblems(DIST)
  const schema = requiredSchemaVersion()
  const steps = JSON.parse(readFileSync(join(DIST, 'upgrades/index.json'), 'utf8')) as Array<{
    version: string
  }>
  if (steps.at(-1)?.version !== schema)
    problems.push(`Bước nâng cấp cuối (${steps.at(-1)?.version}) khác REQUIRED_SCHEMA_VERSION (${schema})`)
  if (problems.length > 0) fail(`Gói không an toàn để phát hành:\n- ${problems.join('\n- ')}`)

  rmSync(RELEASE, { recursive: true, force: true })
  mkdirSync(RELEASE, { recursive: true })

  const guide = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts/build-guide.ts'), join(RELEASE, 'HUONG-DAN-CAI-DAT.pdf')],
    {
      cwd: ROOT,
      stdio: 'inherit',
    },
  )
  if (guide.status !== 0) fail('Không tạo được file hướng dẫn')

  const distZip = zipDirectory(DIST)
  writeFileSync(join(RELEASE, 'dist.zip'), distZip)
  copyFileSync(join(DIST, 'install.sql'), join(RELEASE, 'install.sql'))
  const readme = [
    `eSchool Portal ${version} (cơ sở dữ liệu ${schema})`,
    '',
    'HUONG-DAN-CAI-DAT.pdf : đọc file này trước, làm theo từng bước.',
    'dist.zip              : website. cPanel, VibeHost: giải nén vào thư mục gốc của website.',
    'install.sql           : tạo cơ sở dữ liệu. Trình cài đặt trên website cũng có sẵn nội dung này.',
    '',
  ].join('\n')
  writeFileSync(
    join(RELEASE, `eschool-portal-${version}.zip`),
    zipSync(
      {
        'DOC-TOI-TRUOC.txt': strToU8(readme),
        'HUONG-DAN-CAI-DAT.pdf': readFileSync(join(RELEASE, 'HUONG-DAN-CAI-DAT.pdf')),
        'dist.zip': distZip,
        'install.sql': readFileSync(join(RELEASE, 'install.sql')),
      },
      { level: 6 },
    ),
  )
  writeFileSync(
    join(RELEASE, 'RELEASE_NOTES.md'),
    `${section ?? '(Bản thử, chưa có ghi chú)'}\n\n**Phiên bản cơ sở dữ liệu cần dùng:** ${schema}\n\nNgười mới cài: tải \`eschool-portal-${version}.zip\`. Cập nhật trên cPanel, VibeHost: tải \`dist.zip\`.\n`,
  )
  console.log(`Đã tạo gói ${version} trong release/`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
