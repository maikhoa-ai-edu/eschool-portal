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
