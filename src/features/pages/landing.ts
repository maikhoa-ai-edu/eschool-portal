import { z } from 'zod'

const text = z.string().catch('')

/** Nội dung từng mục của trang bố cục Giới thiệu; dữ liệu thiếu hoặc sai thì mục đó để trống và tự ẩn. */
const aboutLandingSchema = z.object({
  tagline: text,
  history: text,
  mission: text,
  vision: text,
  core_values: z.array(z.object({ title: text, text })).catch([]),
  campus_text: text,
  campus_images: z.array(z.string()).catch([]),
  map_url: text,
})

export type AboutLanding = z.infer<typeof aboutLandingSchema>

export function parseAboutLanding(value: unknown): AboutLanding {
  return aboutLandingSchema.parse(value ?? {})
}

/** Phần riêng của trang bố cục Liên hệ, lưu ở `landing.contact` để không lẫn với trang Giới thiệu. */
const contactLandingSchema = z.object({
  departments: z
    .array(z.object({ name: text, phone: text, email: text, note: text, zalo: z.boolean().catch(false) }))
    .catch([]),
  hours: z.array(z.object({ label: text, value: text })).catch([]),
  show_social: z.boolean().catch(false),
  map_url: text,
})

export type ContactLanding = z.infer<typeof contactLandingSchema>
export type ContactDepartment = ContactLanding['departments'][number]

export function parseContactLanding(landing: unknown): ContactLanding {
  const value = landing && typeof landing === 'object' ? (landing as { contact?: unknown }).contact : null
  return contactLandingSchema.parse(value ?? {})
}

/** Số điện thoại cho liên kết `tel:`; rỗng nếu không có chữ số nào. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '')
  return /\d{3,}/.test(digits) ? `tel:${digits}` : null
}

/** Liên kết nhắn Zalo theo số điện thoại Việt Nam (zalo.me/0xxxxxxxxx). */
export function zaloHref(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('84')) digits = `0${digits.slice(2)}`
  return /^0\d{9,10}$/.test(digits) ? `https://zalo.me/${digits}` : null
}

/**
 * Link nhúng bản đồ để đưa vào iframe. Chỉ nhận Google Maps; dán nguyên thẻ iframe cũng được.
 * Trả về null nếu không hợp lệ, nên iframe không bao giờ trỏ tới trang khác.
 */
export function mapEmbedUrl(input: string): string | null {
  const value = input.match(/src=["']([^"']+)["']/)?.[1] ?? input.trim()
  let url: URL
  try {
    url = new URL(value.replaceAll('&amp;', '&'))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.google.com') return null
  const embed = url.pathname === '/maps/embed'
  const output = url.pathname === '/maps' && url.searchParams.get('output') === 'embed'
  return embed || output ? url.href : null
}
