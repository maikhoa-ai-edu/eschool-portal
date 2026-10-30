import { describe, expect, it } from 'vitest'
import { parseSiteSettings, safeExternalUrl } from './settings'
import { applyBranding, schoolInitials } from './theme'

describe('parseSiteSettings', () => {
  it('dùng giá trị mặc định khi thiếu hoặc sai kiểu', () => {
    const s = parseSiteSettings([], [])
    expect(s.identity.school_name).toBe('Tên trường')
    expect(s.branding.primary_color).toBe('#002B66')
    expect(s.marquee).toEqual({ enabled: false, include_latest_news: false, items: [] })
    expect(s.homepage.sections).toHaveLength(7)
  })

  it('từ chối màu không phải mã hex (chống chèn CSS)', () => {
    const s = parseSiteSettings(
      [{ key: 'branding', value: { primary_color: 'red; background:url(x)', accent_color: '#123456' } }],
      [],
    )
    expect(s.branding.primary_color).toBe('#002B66')
    expect(s.branding.accent_color).toBe('#123456')
  })

  it('đọc trạng thái module', () => {
    const s = parseSiteSettings(
      [],
      [
        { module_key: 'news', is_enabled: true },
        { module_key: 'albums', is_enabled: false },
      ],
    )
    expect(s.modules).toEqual({ news: true, albums: false })
  })
})

describe('safeExternalUrl', () => {
  it('chỉ nhận http(s)', () => {
    expect(safeExternalUrl('https://facebook.com/truong')).toBe('https://facebook.com/truong')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
  })
})

describe('theme', () => {
  it('ghi biến CSS màu thương hiệu', () => {
    const el = document.createElement('div')
    applyBranding(
      {
        primary_color: '#111111',
        primary_light_color: '#222222',
        accent_color: '#333333',
        logo_url: null,
        favicon_url: null,
        banner_url: null,
      },
      el,
    )
    expect(el.style.getPropertyValue('--brand-primary')).toBe('#111111')
    expect(el.style.getPropertyValue('--brand-accent')).toBe('#333333')
  })

  it('tạo chữ viết tắt từ tên trường', () => {
    expect(schoolInitials('Trường THCS & THPT Vĩnh Phong')).toBe('VP')
    expect(schoolInitials('Tên trường')).toBe('TT')
  })
})
