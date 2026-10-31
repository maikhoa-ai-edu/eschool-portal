import { describe, expect, it } from 'vitest'
import { isValidVideoUrl, videoEmbedUrl, videoThumbnail } from './api'

describe('videoEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc_DEF-1', 'https://www.youtube-nocookie.com/embed/abc_DEF-1'],
    ['https://youtu.be/abc123?t=5', 'https://www.youtube-nocookie.com/embed/abc123'],
    ['https://m.youtube.com/shorts/xyz', 'https://www.youtube-nocookie.com/embed/xyz'],
    ['https://drive.google.com/file/d/1AbC/view?usp=sharing', 'https://drive.google.com/file/d/1AbC/preview'],
    ['https://drive.google.com/open?id=1AbC', 'https://drive.google.com/file/d/1AbC/preview'],
  ])('%s', (input, expected) => {
    expect(videoEmbedUrl(input)).toBe(expected)
  })

  it.each([
    'http://www.youtube.com/watch?v=abc',
    'https://evil.example/watch?v=abc',
    'https://youtube.com.evil.example/embed/abc',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=a"><script>',
    'javascript:alert(1)',
    'không phải link',
  ])('từ chối %s', (input) => {
    expect(isValidVideoUrl(input)).toBe(false)
    expect(videoEmbedUrl(input)).toBeNull()
  })

  it('chỉ YouTube có ảnh xem trước', () => {
    expect(videoThumbnail('https://youtu.be/abc')).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg')
    expect(videoThumbnail('https://drive.google.com/file/d/1AbC/view')).toBeNull()
  })
})
