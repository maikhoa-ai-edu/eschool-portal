// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstallSql, listMigrations } from './build-install-sql.ts'

describe('buildInstallSql', () => {
  it('ghép đủ migration theo thứ tự, bọc trong giao dịch và in mã cài đặt ở cuối', () => {
    const sql = buildInstallSql()
    const files = listMigrations()
    expect(files.length).toBeGreaterThan(0)

    const positions = files.map((f) => sql.indexOf(`-- ===== ${f} =====`))
    expect(positions.every((p) => p > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)

    expect(sql.indexOf('begin;')).toBeLessThan(positions[0]!)
    expect(sql.lastIndexOf('commit;')).toBeGreaterThan(positions.at(-1)!)
    expect(sql.trimEnd().split('\n').at(-1)).toBe(
      'select install_code as "Mã cài đặt" from private.install_state;',
    )
  })

  it('chặn chạy lại trên CSDL đã cài', () => {
    expect(buildInstallSql()).toMatch(/to_regclass\('public\.app_meta'\) is not null/)
  })

  it('báo lỗi khi thư mục không có migration', () => {
    const empty = mkdtempSync(join(tmpdir(), 'eschool-'))
    writeFileSync(join(empty, 'README.md'), '')
    expect(() => buildInstallSql(empty)).toThrow(/Không có migration/)
  })
})
