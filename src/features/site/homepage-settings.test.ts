import { describe, expect, it } from 'vitest'
import { resolveMediaUrl } from '@/features/media/api'
import { initSupabase } from '@/lib/supabase'
import { homepageSchema, moveSection, normalizeSections, visibleSections } from './homepage-settings'
import { marqueeSchema } from './settings'

describe('cấu hình trang chủ', () => {
  it('thiếu cấu hình thì có đủ 7 khối mặc định, bật sẵn', () => {
    const s = homepageSchema.parse({})
    expect(s.sections.map((x) => x.key)).toEqual([
      'featured_news',
      'latest_news',
      'category_news',
      'albums',
      'announcements',
      'documents',
      'visit_counter',
    ])
    expect(s.sections.every((x) => x.enabled)).toBe(true)
    expect(s.show_slides).toBe(true)
    expect(s.slide_interval).toBe(6)
  })

  it('giữ thứ tự đã lưu, bỏ khối lạ/trùng, kẹp số lượng, thêm khối còn thiếu', () => {
    const sections = normalizeSections([
      { key: 'albums', enabled: false, title: 'Ảnh đẹp', limit: 99 },
      { key: 'khong-co', enabled: true },
      { key: 'albums', enabled: true },
      { key: 'latest_news', limit: 0 },
    ])
    expect(sections[0]).toEqual({ key: 'albums', enabled: false, title: 'Ảnh đẹp', limit: 8 })
    expect(sections[1]).toEqual({ key: 'latest_news', enabled: true, title: '', limit: 6 })
    expect(sections).toHaveLength(7)
  })

  it('số liệu sai kiểu dùng giá trị an toàn', () => {
    const s = homepageSchema.parse({ slide_interval: 1, visit_counter_offset: -5, category_ids: ['x'] })
    expect(s.slide_interval).toBe(6)
    expect(s.visit_counter_offset).toBe(0)
    expect(s.category_ids).toEqual([])
  })

  it('chỉ hiện khối đang bật và thuộc module đang bật, đúng cột', () => {
    const s = homepageSchema.parse({
      sections: [
        { key: 'documents', enabled: true },
        { key: 'announcements', enabled: false },
      ],
    })
    const sidebar = visibleSections(s, 'sidebar', (m) => m !== 'documents')
    expect(sidebar.map((x) => x.key)).toEqual(['visit_counter'])
    expect(visibleSections(s, 'main', () => true).map((x) => x.key)).toContain('featured_news')
  })

  it('đổi chỗ khối trong cùng một cột (bỏ qua khối của cột kia)', () => {
    const sections = normalizeSections([
      { key: 'featured_news' },
      { key: 'announcements' },
      { key: 'latest_news' },
    ])
    const moved = moveSection(sections, 'latest_news', -1)
    expect(moved.map((x) => x.key).slice(0, 3)).toEqual(['latest_news', 'announcements', 'featured_news'])
    expect(moveSection(sections, 'featured_news', -1)).toBe(sections)
  })
})

describe('dòng chữ chạy', () => {
  it('đọc được cả kiểu cũ (mảng chuỗi) lẫn kiểu mới có liên kết', () => {
    const m = marqueeSchema.parse({
      enabled: true,
      items: ['Chào năm học mới', { text: 'Xem thông báo', url: '/thong-bao' }, { text: '  ' }],
    })
    expect(m.items).toEqual([
      { text: 'Chào năm học mới', url: null },
      { text: 'Xem thông báo', url: '/thong-bao' },
    ])
  })

  it('bỏ liên kết nguy hiểm', () => {
    const m = marqueeSchema.parse({ items: [{ text: 'x', url: 'javascript:alert(1)' }] })
    expect(m.items[0]!.url).toBeNull()
  })
})

describe('resolveMediaUrl', () => {
  it('đường dẫn trong bucket thành địa chỉ công khai; địa chỉ đầy đủ giữ nguyên', () => {
    initSupabase({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'khoa-gia-lap' })
    expect(resolveMediaUrl('seed/logo.jpg')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/media/seed/logo.jpg',
    )
    expect(resolveMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(resolveMediaUrl('/logo.png')).toBe('/logo.png')
    expect(resolveMediaUrl(null)).toBeNull()
  })
})
