export const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Thích' },
  { key: 'love', emoji: '❤️', label: 'Yêu thích' },
  { key: 'clap', emoji: '👏', label: 'Tuyệt vời' },
  { key: 'grateful', emoji: '🥰', label: 'Biết ơn' },
] as const

export type ReactionKey = (typeof REACTIONS)[number]['key']
export type ReactionCounts = Partial<Record<ReactionKey, number>>

export function isReactionKey(value: unknown): value is ReactionKey {
  return REACTIONS.some((r) => r.key === value)
}

/** Đọc jsonb `{ like: 3, love: 1 }`; bỏ qua loại lạ và số âm. */
export function parseReactionCounts(value: unknown): ReactionCounts {
  if (!value || typeof value !== 'object') return {}
  const counts: ReactionCounts = {}
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw)
    if (isReactionKey(key) && Number.isFinite(n) && n > 0) counts[key] = n
  }
  return counts
}

export function totalReactions(counts: ReactionCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
}

/** Các loại được chọn nhiều nhất trước (giống dải biểu tượng của Facebook). */
export function topReactions(counts: ReactionCounts, limit = 3) {
  // sort trên mảng mới do filter tạo ra; toSorted chưa có trên điện thoại cũ
  return REACTIONS.filter((r) => (counts[r.key] ?? 0) > 0)
    .sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0))
    .slice(0, limit)
}

/** Số đếm sau khi đổi cảm xúc của chính mình (cập nhật ngay trên màn hình trước khi tải lại). */
export function applyMyReaction(
  counts: ReactionCounts,
  before: ReactionKey | null,
  after: ReactionKey | null,
): ReactionCounts {
  const next = { ...counts }
  if (before) next[before] = Math.max(0, (next[before] ?? 0) - 1)
  if (after) next[after] = (next[after] ?? 0) + 1
  return next
}

/** Hạn bình chọn đã qua chưa (CSDL vẫn là nơi chặn thật). */
export function isVotingClosed(endsAt: string | null | undefined, now = new Date()): boolean {
  return Boolean(endsAt) && new Date(endsAt!).getTime() <= now.getTime()
}
