import { describe, expect, it } from 'vitest'
import { buildMenuTree, hideDisabledModules, type MenuItem } from './menu'

const item = (id: string, parent_id: string | null, sort_order: number): MenuItem => ({
  id,
  parent_id,
  title: id,
  url: '/' + id,
  open_in_new_tab: false,
  sort_order,
})

describe('buildMenuTree', () => {
  it('lồng mục con và sắp xếp theo thứ tự', () => {
    const tree = buildMenuTree([
      item('b', null, 2),
      item('a', null, 1),
      item('a2', 'a', 2),
      item('a1', 'a', 1),
    ])
    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
    expect(tree[0]?.children.map((n) => n.id)).toEqual(['a1', 'a2'])
  })

  it('đưa mục mồ côi lên cấp gốc', () => {
    const tree = buildMenuTree([item('x', 'khong-ton-tai', 0)])
    expect(tree.map((n) => n.id)).toEqual(['x'])
  })
})

describe('hideDisabledModules', () => {
  const link = (id: string, url: string, parent_id: string | null = null): MenuItem => ({
    id,
    parent_id,
    title: id,
    url,
    open_in_new_tab: false,
    sort_order: 0,
  })

  it('ẩn mục trỏ tới module đã tắt, kể cả trong menu con', () => {
    const tree = buildMenuTree([
      link('home', '/'),
      link('albums', '/thu-vien-anh'),
      link('about', '/trang/gioi-thieu'),
      link('more', '/lien-he'),
      link('albums-child', '/thu-vien-anh/le-khai-giang?x=1', 'more'),
      link('ext', 'https://example.com/thu-vien-anh', 'more'),
      link('similar', '/thu-vien-anh-cu', 'more'),
    ])
    const visible = hideDisabledModules(tree, (key) => key !== 'albums')
    expect(visible.map((n) => n.id).sort()).toEqual(['about', 'home', 'more'])
    expect(
      visible
        .find((n) => n.id === 'more')!
        .children.map((n) => n.id)
        .sort(),
    ).toEqual(['ext', 'similar'])
  })
})
