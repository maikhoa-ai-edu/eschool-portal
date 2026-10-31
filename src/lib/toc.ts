import { slugify } from '@/lib/slug'

export interface TocHeading {
  id: string
  text: string
  level: 2 | 3
}

/** Bài ít tiêu đề hơn số này thì mục lục chỉ thêm rối. */
export const TOC_MIN_HEADINGS = 3

/** Gắn id cho h2, h3 trong HTML ĐÃ làm sạch và trả về danh sách tiêu đề; id có tiền tố để không đụng id của trang. */
export function buildToc(cleanHtml: string): { html: string; headings: TocHeading[] } {
  const doc = new DOMParser().parseFromString(cleanHtml, 'text/html')
  const seen = new Map<string, number>()
  const headings: TocHeading[] = []
  doc.body.querySelectorAll('h2, h3').forEach((el) => {
    const text = el.textContent?.trim() ?? ''
    if (!text) return
    const base = `muc-${slugify(text) || 'tieu-de'}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`
    el.id = id
    headings.push({ id, text, level: el.tagName === 'H2' ? 2 : 3 })
  })
  return { html: doc.body.innerHTML, headings }
}
