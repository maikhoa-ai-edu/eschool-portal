/** Bỏ dấu tiếng Việt (gần giống private.vi_unaccent trong CSDL), vd "Đội Thiếu niên" -> "Doi Thieu nien". */
export function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_SLUG_LENGTH = 80

/** Tạo đường dẫn (khớp ràng buộc slug của CSDL) từ tiêu đề tiếng Việt. */
export function slugify(text: string): string {
  const slug = removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  // Cắt ở ranh giới từ cho gọn
  const cut = slug.slice(0, MAX_SLUG_LENGTH)
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : MAX_SLUG_LENGTH).replace(/-+$/, '')
}

/** Thêm hậu tố ngắn khi đường dẫn đã có người dùng (có thể là bài nháp mình không xem được). */
export function withRandomSuffix(slug: string): string {
  const suffix = crypto.randomUUID().slice(0, 6)
  return `${slug.slice(0, MAX_SLUG_LENGTH - 7)}-${suffix}`
}
