// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstallSql, buildUpgrades, listMigrations } from './build-install-sql.ts'

describe('buildUpgrades', () => {
  it('các bước nối liền nhau, mỗi bước kiểm tra phiên bản trước khi chạy và nằm trong giao dịch', () => {
    const upgrades = buildUpgrades()
    expect(upgrades.length).toBeGreaterThan(0)
    upgrades.forEach((u, i) => {
      if (i > 0) expect(u.from).toBe(upgrades[i - 1]!.version)
      expect(u.sql).toContain(`public.get_schema_version() <> '${u.from}'`)
      expect(u.sql.indexOf('begin;')).toBeLessThan(u.sql.indexOf('====='))
      expect(u.sql.trimEnd().endsWith('commit;')).toBe(true)
    })
  })

  it('đủ mọi migration sau bản cài đầu tiên', () => {
    const all = buildUpgrades()
      .map((u) => u.sql)
      .join('\n')
    for (const file of listMigrations().slice(-3)) expect(all).toContain(`===== ${file} =====`)
  })
})

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
