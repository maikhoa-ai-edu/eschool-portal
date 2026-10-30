import { describe, expect, it } from 'vitest'
import { pageRange, pageWindow, readPage } from '@/components/ui/page-utils'
import { formatDate, formatFileSize, fromDateTimeLocal, toDateTimeLocal } from './format'
import { htmlToText, sanitizeHtml } from './sanitize'
import { removeDiacritics, slugify, SLUG_PATTERN, withRandomSuffix } from './slug'

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, kể cả chữ đ', () => {
    expect(slugify('Đội Thiếu niên Tiền phong Hồ Chí Minh')).toBe('doi-thieu-nien-tien-phong-ho-chi-minh')
    expect(slugify('Khai giảng năm học 2026 - 2027')).toBe('khai-giang-nam-hoc-2026-2027')
  })
  it('bỏ ký tự đặc biệt và dấu gạch thừa ở hai đầu', () => {
    expect(slugify('  "Thi HSG" & Olympic!!  ')).toBe('thi-hsg-olympic')
  })
  it('luôn khớp ràng buộc slug của CSDL', () => {
    for (const title of ['Tin nhà trường', 'Lớp 10A1 – kết quả', 'Ảnh: Hội trại 26/3']) {
      expect(slugify(title)).toMatch(SLUG_PATTERN)
    }
  })
  it('cắt bớt tiêu đề quá dài ở ranh giới từ', () => {
    const slug = slugify('Thông báo '.repeat(20))
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug).toMatch(SLUG_PATTERN)
  })
  it('hậu tố ngẫu nhiên vẫn hợp lệ', () => {
    expect(withRandomSuffix('tin-moi')).toMatch(/^tin-moi-[0-9a-f]{6}$/)
  })
  it('removeDiacritics giữ nguyên hoa thường', () => {
    expect(removeDiacritics('Học sinh Giỏi')).toBe('Hoc sinh Gioi')
  })
})

describe('định dạng', () => {
  it('ngày theo giờ Việt Nam', () => {
    expect(formatDate('2026-09-04T18:30:00Z')).toBe('05/09/2026')
    expect(formatDate('2026-09-05')).toBe('05/09/2026')
    expect(formatDate(null)).toBe('')
  })
  it('dung lượng file', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe('3,5 MB')
  })
  it('chuyển qua lại với ô datetime-local theo giờ Việt Nam', () => {
    expect(toDateTimeLocal('2026-09-05T00:30:00Z')).toBe('2026-09-05T07:30')
    expect(fromDateTimeLocal('2026-09-05T07:30')).toBe('2026-09-05T00:30:00.000Z')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})

describe('sanitizeHtml', () => {
  it('bỏ script và thuộc tính sự kiện', () => {
    const html = sanitizeHtml(
      '<p onclick="alert(1)">Xin chào</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    )
    expect(html).not.toMatch(/script|onclick|onerror/)
    expect(html).toContain('<p>Xin chào</p>')
  })
  it('bỏ liên kết javascript:', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript')
  })
  it('liên kết ra ngoài mở tab mới an toàn, liên kết nội bộ thì không', () => {
    expect(sanitizeHtml('<a href="https://moet.gov.vn">Bộ</a>')).toContain('rel="noopener noreferrer"')
    expect(sanitizeHtml('<a href="/tin-tuc" target="_blank">Tin</a>')).not.toContain('target')
  })
  it('giữ định dạng của trình soạn thảo (căn lề, ảnh)', () => {
    const html = sanitizeHtml('<p style="text-align: center">Giữa</p><img src="https://x/a.jpg" alt="a">')
    expect(html).toContain('text-align: center')
    expect(html).toContain('loading="lazy"')
  })
  it('bỏ iframe, form, style', () => {
    expect(sanitizeHtml('<iframe src="https://x"></iframe><form><input></form><style>*{}</style>ok')).toBe(
      'ok',
    )
  })
  it('htmlToText lấy chữ thuần', () => {
    expect(htmlToText('<h2>Tiêu đề</h2><p>Nội   dung</p>')).toBe('Tiêu đềNội dung')
  })
})

describe('phân trang', () => {
  it('cửa sổ số trang có dấu …', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })
  it('đọc ?trang= an toàn', () => {
    expect(readPage(new URLSearchParams('trang=3'))).toBe(3)
    expect(readPage(new URLSearchParams('trang=-1'))).toBe(1)
    expect(readPage(new URLSearchParams('trang=abc'))).toBe(1)
  })
  it('khoảng bản ghi', () => {
    expect(pageRange(1, 20)).toEqual([0, 19])
    expect(pageRange(3, 12)).toEqual([24, 35])
  })
})
