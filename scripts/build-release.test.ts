import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { changelogSection, findPackageProblems } from './build-release.ts'

const REQUIRED = [
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

describe('findPackageProblems', () => {
  let dir: string
  const write = (name: string, text = '') => {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  const setup = () => {
    dir = mkdtempSync(join(tmpdir(), 'eschool-package-'))
    REQUIRED.forEach((name) => write(name))
  }

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('gói đủ file và sạch thì không có lỗi', () => {
    setup()
    // Mã kiểm tra khóa và chữ gợi ý trong ô nhập không phải khóa thật
    write('assets/a.js', "key.startsWith('sb_secret_'); role === 'service_role'; placeholder='eyJhbGciOi...'")
    expect(findPackageProblems(dir)).toEqual([])
  })

  it('báo thiếu file', () => {
    setup()
    rmSync(join(dir, '.htaccess'))
    expect(findPackageProblems(dir)).toEqual(['Thiếu file .htaccess'])
  })

  it.each(['.env.local', 'config.json', 'assets/a.js.map'])('từ chối file %s', (name) => {
    setup()
    write(name)
    expect(findPackageProblems(dir)).toEqual([`Không được đóng gói file ${name}`])
  })

  it.each([
    ['khóa JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijklmnop'],
    ['khóa Supabase', 'sb_secret_abcdefghijklmnop'],
    ['địa chỉ Supabase cục bộ', 'http://127.0.0.1:54321'],
    ['tài khoản mẫu', 'superadmin@demo.local'],
    ['tên trường trong dữ liệu mẫu', 'Trường Vĩnh Phong'],
  ])('từ chối nội dung có %s', (label, text) => {
    setup()
    write('assets/a.js', text)
    expect(findPackageProblems(dir)).toEqual([`assets/a.js chứa ${label}`])
  })
})

describe('changelogSection', () => {
  const log = '# Lịch sử\n\n## 0.12.0 (2026-12-01)\n\n- Mới\n\n## 0.11.0\n\n- Cũ\n'

  it('lấy đúng một mục', () => {
    expect(changelogSection(log, '0.12.0')).toBe('- Mới')
    expect(changelogSection(log, '0.11.0')).toBe('- Cũ')
  })

  it('trả null khi chưa có mục', () => {
    expect(changelogSection(log, '1.0.0')).toBeNull()
  })
})
