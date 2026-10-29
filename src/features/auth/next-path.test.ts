import { describe, expect, it } from 'vitest'
import { safeNextPath } from './next-path'

describe('safeNextPath', () => {
  it('giữ đường dẫn nội bộ', () => {
    expect(safeNextPath('/admin/tin-tuc?page=2')).toBe('/admin/tin-tuc?page=2')
  })

  it('chặn chuyển hướng ra ngoài site', () => {
    expect(safeNextPath('https://lua-dao.example')).toBe('/admin')
    expect(safeNextPath('//lua-dao.example')).toBe('/admin')
    expect(safeNextPath('/\\lua-dao.example')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
  })
})
