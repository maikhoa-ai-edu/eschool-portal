import { z } from 'zod'

/** Khối nội dung của trang chuyên đề, lưu trong cột jsonb topics.sections theo đúng thứ tự hiển thị. */
export const TOPIC_SECTION_TYPES = [
  'rich_text',
  'quote',
  'list',
  'cards',
  'news',
  'documents',
  'album',
  'video',
] as const
export type TopicSectionType = (typeof TOPIC_SECTION_TYPES)[number]

export const TOPIC_SECTION_LABELS: Record<TopicSectionType, string> = {
  rich_text: 'Bài viết tự soạn',
  quote: 'Trích dẫn',
  list: 'Danh sách đánh số',
  cards: 'Thẻ giới thiệu (ảnh + chữ)',
  news: 'Tin tức theo thẻ',
  documents: 'Tài liệu từ mục Văn bản',
  album: 'Ảnh từ Thư viện ảnh',
  video: 'Video YouTube',
}

const LINK_PATTERN = /^(\/|https?:\/\/)\S*$/
const text = z.string().catch('')

const base = {
  id: z.string().min(1),
  /** Cột phải chỉ có trên máy tính; điện thoại xếp sau cột chính */
  area: z.enum(['main', 'side']).catch('main'),
  enabled: z.boolean().catch(true),
  title: text,
}

const cardSchema = z.object({
  image_path: z.string().nullable().catch(null),
  title: text,
  text,
  url: z
    .string()
    .nullable()
    .catch(null)
    .transform((v) => (v && LINK_PATTERN.test(v) ? v : null)),
})
export type TopicCard = z.infer<typeof cardSchema>

const sectionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('rich_text'), html: text }),
  z.object({ ...base, type: z.literal('quote'), text, author: text }),
  z.object({ ...base, type: z.literal('list'), items: z.array(z.string()).catch([]) }),
  z.object({ ...base, type: z.literal('cards'), items: z.array(cardSchema).catch([]) }),
  z.object({
    ...base,
    type: z.literal('news'),
    tag_slug: text,
    limit: z.number().int().min(1).max(12).catch(6),
  }),
  z.object({ ...base, type: z.literal('documents'), document_ids: z.array(z.string()).catch([]) }),
  z.object({
    ...base,
    type: z.literal('album'),
    album_slug: text,
    limit: z.number().int().min(1).max(24).catch(8),
  }),
  z.object({ ...base, type: z.literal('video'), url: text, caption: text }),
])

export type TopicSection = z.infer<typeof sectionSchema>

/** Đọc dữ liệu jsonb: khối sai cấu trúc hoặc loại chưa biết (bản mới hơn) thì bỏ qua, không làm hỏng cả trang. */
export function parseTopicSections(input: unknown): TopicSection[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((raw) => {
    const parsed = sectionSchema.safeParse(raw)
    return parsed.success ? [parsed.data] : []
  })
}

/** Id cục bộ của khối; không dùng crypto.randomUUID vì hàm đó không có trên website chạy http. */
function newSectionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function newTopicSection(type: TopicSectionType): TopicSection {
  const common = { id: newSectionId(), area: 'main' as const, enabled: true, title: '' }
  switch (type) {
    case 'rich_text':
      return { ...common, type, html: '' }
    case 'quote':
      return { ...common, type, text: '', author: '' }
    case 'list':
      return { ...common, type, items: [] }
    case 'cards':
      return { ...common, type, items: [] }
    case 'news':
      return { ...common, type, tag_slug: '', limit: 6 }
    case 'documents':
      return { ...common, type, document_ids: [] }
    case 'album':
      return { ...common, type, album_slug: '', limit: 8 }
    case 'video':
      return { ...common, type, url: '', caption: '' }
  }
}

/** Mã video từ các dạng liên kết YouTube thường gặp; không nhận ra thì trả về null. */
export function youtubeId(url: string): string | null {
  const match =
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/.exec(
      url.trim(),
    )
  return match?.[1] ?? null
}

/** Lỗi nội dung cần sửa trước khi lưu (thông báo cho người soạn). */
export function describeSectionProblem(section: TopicSection, index: number): string | null {
  const where = `Khối ${index + 1} (${TOPIC_SECTION_LABELS[section.type]})`
  if (section.type === 'video' && section.url.trim() && !youtubeId(section.url))
    return `${where}: liên kết không phải video YouTube.`
  if (section.type === 'cards') {
    const bad = section.items.find((c) => c.url && !LINK_PATTERN.test(c.url))
    if (bad) return `${where}: liên kết của thẻ "${bad.title}" phải bắt đầu bằng / hoặc https://.`
  }
  return null
}

/** Chữ trắng hay chữ tối đọc rõ hơn trên nền màu này (độ tương phản WCAG). */
export function isDarkColor(hex: string): boolean {
  const channel = (start: number) => {
    const v = parseInt(hex.slice(start, start + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
}
