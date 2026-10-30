import { describe, expect, it } from 'vitest'
import {
  describeSectionProblem,
  isDarkColor,
  newTopicSection,
  parseTopicSections,
  TOPIC_SECTION_TYPES,
  youtubeId,
} from './sections'

describe('khối nội dung chuyên đề', () => {
  it('bỏ khối sai cấu trúc hoặc loại chưa biết, giữ khối đúng', () => {
    const list = parseTopicSections([
      { id: 'a', type: 'quote', text: 'Câu', author: 'Tác giả' },
      { id: 'b', type: 'loai-moi' },
      { type: 'quote' },
      'rác',
    ])
    expect(list.map((s) => s.id)).toEqual(['a'])
    expect(list[0]).toMatchObject({ area: 'main', enabled: true, title: '' })
  })

  it('không phải mảng thì trả về rỗng', () => {
    expect(parseTopicSections(null)).toEqual([])
    expect(parseTopicSections({})).toEqual([])
  })

  it('liên kết nguy hiểm trong thẻ bị bỏ', () => {
    const [cards] = parseTopicSections([
      {
        id: 'c',
        type: 'cards',
        items: [
          { title: 'x', url: 'javascript:alert(1)' },
          { title: 'y', url: '/tin-tuc' },
        ],
      },
    ])
    expect(cards!.type === 'cards' && cards!.items.map((i) => i.url)).toEqual([null, '/tin-tuc'])
  })

  it('khối mới của mọi loại đều đọc lại được', () => {
    for (const type of TOPIC_SECTION_TYPES) {
      const section = newTopicSection(type)
      expect(parseTopicSections([JSON.parse(JSON.stringify(section))])).toEqual([section])
    }
  })

  it('nhận ra các dạng liên kết YouTube', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('báo lỗi video sai liên kết; để trống thì được', () => {
    const video = newTopicSection('video')
    expect(describeSectionProblem(video, 0)).toBeNull()
    expect(describeSectionProblem({ ...video, url: 'https://x.vn' } as typeof video, 1)).toContain('Khối 2')
  })

  it('chọn màu chữ theo nền', () => {
    expect(isDarkColor('#a80000')).toBe(true)
    expect(isDarkColor('#002b66')).toBe(true)
    expect(isDarkColor('#fde68a')).toBe(false)
  })
})
