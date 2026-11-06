import { parseReactionCounts, REACTIONS, type ReactionCounts } from '@/features/reactions/reactions'

export interface ContestEntry {
  id: string
  title: string
  slug: string
  excerpt: string | null
  thumbnail_url: string | null
  author_name: string | null
  author_class: string | null
  published_at: string | null
  reactions: ReactionCounts
  total_reactions: number
  comment_count: number
}

/** Dòng trả về từ hàm contest_entries của CSDL. */
export function toContestEntry(row: {
  id: string
  title: string
  slug: string
  excerpt: string | null
  thumbnail_url: string | null
  author_name: string | null
  author_class: string | null
  published_at: string | null
  reactions: unknown
  total_reactions: number | string
  comment_count: number | string
}): ContestEntry {
  return {
    ...row,
    reactions: parseReactionCounts(row.reactions),
    total_reactions: Number(row.total_reactions) || 0,
    comment_count: Number(row.comment_count) || 0,
  }
}

export type ContestSort = 'newest' | 'top'

export function sortEntries(entries: ContestEntry[], sort: ContestSort): ContestEntry[] {
  return [...entries].sort((a, b) =>
    sort === 'top'
      ? b.total_reactions - a.total_reactions || (b.published_at ?? '').localeCompare(a.published_at ?? '')
      : (b.published_at ?? '').localeCompare(a.published_at ?? ''),
  )
}

/** Hạng theo tổng cảm xúc; bằng điểm thì cùng hạng (1, 2, 2, 4). */
export function rankEntries(entries: ContestEntry[]): Array<ContestEntry & { rank: number }> {
  const sorted = sortEntries(entries, 'top')
  return sorted.map((entry, i) => ({
    ...entry,
    rank: sorted.findIndex((e) => e.total_reactions === entry.total_reactions) + 1 || i + 1,
  }))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Bảng xếp hạng dạng CSV (có BOM để Excel đọc đúng tiếng Việt). */
export function rankingCsv(entries: ContestEntry[], origin: string): string {
  const header = [
    'Hạng',
    'Tên bài',
    'Học sinh',
    'Lớp',
    ...REACTIONS.map((r) => r.label),
    'Tổng cảm xúc',
    'Bình luận',
    'Ngày đăng',
    'Liên kết',
  ]
  const rows = rankEntries(entries).map((e) => [
    e.rank,
    e.title,
    e.author_name ?? '',
    e.author_class ?? '',
    ...REACTIONS.map((r) => e.reactions[r.key] ?? 0),
    e.total_reactions,
    e.comment_count,
    e.published_at ? e.published_at.slice(0, 10) : '',
    `${origin}/tin-tuc/${e.slug}`,
  ])
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}
