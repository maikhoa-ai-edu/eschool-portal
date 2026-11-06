import { describe, expect, it } from 'vitest'
import {
  applyMyReaction,
  isVotingClosed,
  parseReactionCounts,
  topReactions,
  totalReactions,
} from './reactions'

describe('cảm xúc', () => {
  it('đọc số đếm từ CSDL, bỏ loại lạ và số không hợp lệ', () => {
    expect(parseReactionCounts({ like: 2, love: '3', haha: 5, clap: -1, grateful: 'x' })).toEqual({
      like: 2,
      love: 3,
    })
    expect(parseReactionCounts(null)).toEqual({})
  })

  it('tổng và các loại nhiều nhất', () => {
    const counts = { like: 1, love: 4, grateful: 2 }
    expect(totalReactions(counts)).toBe(7)
    expect(topReactions(counts, 2).map((r) => r.key)).toEqual(['love', 'grateful'])
  })

  it('đổi cảm xúc của mình cập nhật số đếm ngay', () => {
    expect(applyMyReaction({ like: 1 }, null, 'love')).toEqual({ like: 1, love: 1 })
    expect(applyMyReaction({ like: 1, love: 1 }, 'like', 'love')).toEqual({ like: 0, love: 2 })
    expect(applyMyReaction({ like: 1 }, 'like', null)).toEqual({ like: 0 })
  })

  it('hạn bình chọn', () => {
    const now = new Date('2026-11-19T17:00:00Z')
    expect(isVotingClosed(null, now)).toBe(false)
    expect(isVotingClosed('2026-11-19T16:59:00Z', now)).toBe(true)
    expect(isVotingClosed('2026-11-20T00:00:00Z', now)).toBe(false)
  })
})
