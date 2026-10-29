import { describe, expect, it } from 'vitest'
import { buildMenuTree, type MenuItem } from './menu'

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
