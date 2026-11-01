import { describe, expect, it } from 'vitest'
import { mapEmbedUrl, parseAboutLanding } from './landing'

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
