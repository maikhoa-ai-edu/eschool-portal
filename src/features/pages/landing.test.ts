import { describe, expect, it } from 'vitest'
import { mapEmbedUrl, parseAboutLanding, parseContactLanding, telHref, zaloHref } from './landing'

describe('mapEmbedUrl', () => {
  it('nhận link nhúng Google Maps', () => {
    const url = 'https://www.google.com/maps/embed?pb=abc'
    expect(mapEmbedUrl(url)).toBe(url)
    expect(mapEmbedUrl('https://www.google.com/maps?q=An+Giang&output=embed')).toContain('output=embed')
  })

  it('dán nguyên thẻ iframe vẫn lấy được link', () => {
    expect(
      mapEmbedUrl('<iframe src="https://www.google.com/maps/embed?pb=a&amp;b=1" width="600"></iframe>'),
    ).toBe('https://www.google.com/maps/embed?pb=a&b=1')
  })

  it.each([
    '',
    'https://evil.example/maps/embed?pb=abc',
    'https://www.google.com.evil.example/maps/embed',
    'http://www.google.com/maps/embed?pb=abc',
    'https://www.google.com/search?q=x',
    'https://www.google.com/maps?q=An+Giang',
    'javascript:alert(1)',
  ])('từ chối %s', (value) => {
    expect(mapEmbedUrl(value)).toBeNull()
  })
})

describe('parseAboutLanding', () => {
  it('dữ liệu trống hoặc sai kiểu thì về giá trị rỗng', () => {
    expect(parseAboutLanding({}).core_values).toEqual([])
    expect(parseAboutLanding(null).history).toBe('')
    expect(parseAboutLanding({ history: 1, campus_images: 'x' })).toMatchObject({
      history: '',
      campus_images: [],
    })
  })
})

describe('parseContactLanding', () => {
  it('đọc từ landing.contact, thiếu thì về giá trị rỗng', () => {
    expect(parseContactLanding({})).toEqual({ departments: [], hours: [], show_social: false, map_url: '' })
    expect(parseContactLanding(null).departments).toEqual([])
    expect(parseContactLanding({ history: 'x', map_url: 'y' }).map_url).toBe('')
    expect(
      parseContactLanding({ contact: { departments: [{ name: 'Văn phòng', phone: 1 }], show_social: 'x' } }),
    ).toMatchObject({
      departments: [{ name: 'Văn phòng', phone: '', email: '', note: '', zalo: false }],
      show_social: false,
    })
  })
})

describe('telHref và zaloHref', () => {
  it('bỏ ký tự thừa trong số điện thoại', () => {
    expect(telHref('0296 3000 001')).toBe('tel:02963000001')
    expect(telHref('(+84) 912.345.678')).toBe('tel:+84912345678')
    expect(telHref('chưa có')).toBeNull()
  })

  it('Zalo chỉ nhận số di động Việt Nam', () => {
    expect(zaloHref('0912 345 678')).toBe('https://zalo.me/0912345678')
    expect(zaloHref('+84 912 345 678')).toBe('https://zalo.me/0912345678')
    expect(zaloHref('113')).toBeNull()
    expect(zaloHref('')).toBeNull()
  })
})
