import { describe, expect, it } from 'vitest'
import { buildToc } from './toc'

describe('buildToc', () => {
  it('gắn id không trùng cho h2, h3 và bỏ tiêu đề rỗng', () => {
    const { html, headings } = buildToc('<h2>Mục tiêu</h2><p>x</p><h3>Mục tiêu</h3><h2> </h2><h4>Bỏ</h4>')
    expect(headings).toEqual([
      { id: 'muc-muc-tieu', text: 'Mục tiêu', level: 2 },
      { id: 'muc-muc-tieu-2', text: 'Mục tiêu', level: 3 },
    ])
    expect(html).toContain('id="muc-muc-tieu-2"')
  })

  it('bài không có tiêu đề giữ nguyên nội dung', () => {
    expect(buildToc('<p>Chỉ có đoạn văn</p>')).toEqual({ html: '<p>Chỉ có đoạn văn</p>', headings: [] })
  })
})
