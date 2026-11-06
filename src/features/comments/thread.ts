/** Ghép bình luận thành luồng: bình luận gốc theo thứ tự thời gian, trả lời nằm dưới bình luận gốc. */
export function threadComments<T extends { id: string; parent_id: string | null }>(
  comments: T[],
): Array<{ comment: T; replies: T[] }> {
  // Trả lời mà bình luận gốc không đọc được (bị ẩn) thì không gắn vào đâu nên không hiện
  return comments
    .filter((c) => c.parent_id === null)
    .map((comment) => ({ comment, replies: comments.filter((c) => c.parent_id === comment.id) }))
}

/** Hai chữ cái đầu của họ tên Việt: "Nguyễn Văn An" -> "VA" (tên đệm + tên). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const picked = words.length === 1 ? words : words.slice(-2)
  return picked.map((w) => w[0]!.toUpperCase()).join('')
}

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#9333ea', '#ea580c', '#0891b2', '#b45309', '#4f46e5']

/** Màu nền ảnh đại diện cố định theo tên (cùng người luôn cùng màu). */
export function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) | 0
  return COLORS[Math.abs(hash) % COLORS.length]!
}
