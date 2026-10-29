import { describe, expect, it } from 'vitest'
import { visibleAdminNav } from './admin-nav'

const labels = (groups: ReturnType<typeof visibleAdminNav>) =>
  groups.flatMap((g) => g.items.map((i) => i.label))

describe('visibleAdminNav', () => {
  it('Editor chỉ thấy mục soạn tin, thư viện ảnh và mục không cần quyền', () => {
    const editorPerms = new Set(['news.create', 'news.edit_own', 'media.upload'])
    const groups = visibleAdminNav(
      (p) => editorPerms.has(p),
      () => true,
    )
    expect(labels(groups)).toEqual(['Bảng điều khiển', 'Tin tức', 'Thư viện ảnh', 'Trạng thái hệ thống'])
    expect(groups.map((g) => g.label)).not.toContain('Giao diện')
  })

  it('Ẩn mục của module đang tắt', () => {
    const groups = visibleAdminNav(
      () => true,
      (key) => key !== 'albums',
    )
    expect(labels(groups)).not.toContain('Thư viện ảnh')
    expect(labels(groups)).toContain('Tài khoản')
  })
})
