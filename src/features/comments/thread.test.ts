import { describe, expect, it } from 'vitest'
import { avatarColor, initials, threadComments } from './thread'

describe('luồng bình luận', () => {
  it('trả lời nằm dưới bình luận gốc, trả lời mồ côi không hiện', () => {
    const list = [
      { id: 'a', parent_id: null },
      { id: 'b', parent_id: null },
      { id: 'a1', parent_id: 'a' },
      { id: 'x1', parent_id: 'x' },
      { id: 'a2', parent_id: 'a' },
    ]
    expect(threadComments(list).map((t) => [t.comment.id, t.replies.map((r) => r.id)])).toEqual([
      ['a', ['a1', 'a2']],
      ['b', []],
    ])
  })

  it('chữ cái đại diện và màu cố định theo tên', () => {
    expect(initials('Nguyễn Văn An')).toBe('VA')
    expect(initials('  hoa ')).toBe('H')
    expect(initials('')).toBe('?')
    expect(avatarColor('Lê Thị Hoa')).toBe(avatarColor('Lê Thị Hoa'))
  })
})
