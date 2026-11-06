import { describe, expect, it } from 'vitest'
import { rankEntries, rankingCsv, sortEntries, toContestEntry, type ContestEntry } from './ranking'

function entry(
  id: string,
  total: number,
  published_at: string,
  extra: Partial<ContestEntry> = {},
): ContestEntry {
  return {
    id,
    title: `Bài ${id}`,
    slug: `bai-${id}`,
    excerpt: null,
    thumbnail_url: null,
    author_name: 'Học sinh',
    author_class: '9A1',
    published_at,
    reactions: { like: total },
    total_reactions: total,
    comment_count: 0,
    ...extra,
  }
}

describe('bảng xếp hạng cuộc thi', () => {
  const list = [
    entry('a', 3, '2026-11-10T00:00:00Z'),
    entry('b', 5, '2026-11-11T00:00:00Z'),
    entry('c', 3, '2026-11-12T00:00:00Z'),
    entry('d', 1, '2026-11-13T00:00:00Z'),
  ]

  it('đọc dòng từ CSDL (số dạng chuỗi)', () => {
    const e = toContestEntry({
      ...list[0]!,
      reactions: { love: '2' },
      total_reactions: '2',
      comment_count: '1',
    })
    expect(e).toMatchObject({ reactions: { love: 2 }, total_reactions: 2, comment_count: 1 })
  })

  it('sắp xếp mới nhất hoặc nhiều cảm xúc nhất', () => {
    expect(sortEntries(list, 'newest').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(sortEntries(list, 'top').map((e) => e.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('bằng điểm thì cùng hạng', () => {
    expect(rankEntries(list).map((e) => [e.id, e.rank])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 2],
      ['d', 4],
    ])
  })

  it('CSV có BOM, tiêu đề tiếng Việt và thoát dấu phẩy, ngoặc kép', () => {
    const csv = rankingCsv(
      [entry('x', 2, '2026-11-10T08:00:00Z', { title: 'Thầy, cô và "em"' })],
      'https://truong.edu.vn',
    )
    expect(csv.startsWith('﻿Hạng,Tên bài,Học sinh,Lớp,Thích,Yêu thích,Tuyệt vời,Biết ơn,Tổng cảm xúc')).toBe(
      true,
    )
    expect(csv).toContain(
      '1,"Thầy, cô và ""em""",Học sinh,9A1,2,0,0,0,2,0,2026-11-10,https://truong.edu.vn/tin-tuc/bai-x',
    )
  })
})
