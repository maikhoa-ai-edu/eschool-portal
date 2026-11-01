import { describe, expect, it } from 'vitest'
import type { MenuNode } from '@/features/site/menu'
import { otherLinks } from './sitemap'

const node = (url: string, children: MenuNode[] = []): MenuNode => ({
  id: url,
  parent_id: null,
  title: url,
  url,
  open_in_new_tab: false,
  icon: null,
  sort_order: 0,
  children,
})

describe('otherLinks', () => {
  const pages = [
    { title: 'Giới thiệu', slug: 'gioi-thieu' },
    { title: 'Nội quy', slug: 'noi-quy' },
  ]

  it('bỏ mục đã có trong menu, kể cả menu con', () => {
    const urls = otherLinks(
      [node('/', [node('/tin-tuc'), node('/trang/gioi-thieu')])],
      pages,
      () => true,
    ).map((l) => l.url)
    expect(urls).not.toContain('/tin-tuc')
    expect(urls).not.toContain('/trang/gioi-thieu')
    expect(urls).toContain('/trang/noi-quy')
    expect(urls).toContain('/tim-kiem')
  })

  it('menu trỏ tới một chuyên đề thì không lặp mục Chuyên đề', () => {
    const urls = otherLinks([node('/chuyen-de/hoc-tap')], [], () => true).map((l) => l.url)
    expect(urls).not.toContain('/chuyen-de')
  })

  it('bỏ mục thuộc module đang tắt', () => {
    const urls = otherLinks([], pages, (key) => key !== 'plans' && key !== 'pages').map((l) => l.url)
    expect(urls).not.toContain('/ke-hoach')
    expect(urls).not.toContain('/trang/noi-quy')
    expect(urls).toContain('/tin-tuc')
  })
})
