/** Đường dẫn "?next=" chỉ được trỏ vào trong site (chống chuyển hướng mở). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/admin'
  return next
}
