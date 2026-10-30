import { z } from 'zod'
import type { ModuleKey } from './settings'

/** Các khối của trang chủ; thứ tự trong mảng sections là thứ tự hiển thị trong từng cột. */
export const HOMEPAGE_SECTION_KEYS = [
  'featured_news',
  'latest_news',
  'category_news',
  'albums',
  'topic_banner',
  'announcements',
  'documents',
  'visit_counter',
] as const
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number]

export interface SectionInfo {
  label: string
  area: 'main' | 'sidebar'
  defaultTitle: string
  defaultLimit: number
  /** Số mục tối đa (0 = khối không có số lượng) */
  maxLimit: number
  /** Ẩn khi module này tắt */
  module: ModuleKey | null
  /** Khối mới thêm vào cấu hình cũ có bật sẵn không (mặc định có) */
  defaultOff?: boolean
}

export const SECTION_INFO: Record<HomepageSectionKey, SectionInfo> = {
  featured_news: {
    label: 'Tin nổi bật',
    area: 'main',
    defaultTitle: 'Tin nổi bật',
    defaultLimit: 5,
    maxLimit: 7,
    module: 'news',
  },
  latest_news: {
    label: 'Tin mới nhất',
    area: 'main',
    defaultTitle: 'Tin mới nhất',
    defaultLimit: 6,
    maxLimit: 12,
    module: 'news',
  },
  category_news: {
    label: 'Tin theo chuyên mục',
    area: 'main',
    defaultTitle: '',
    defaultLimit: 4,
    maxLimit: 8,
    module: 'news',
  },
  albums: {
    label: 'Thư viện ảnh',
    area: 'main',
    defaultTitle: 'Thư viện ảnh',
    defaultLimit: 4,
    maxLimit: 8,
    module: 'albums',
  },
  topic_banner: {
    label: 'Banner chuyên đề',
    area: 'main',
    defaultTitle: '',
    defaultLimit: 0,
    maxLimit: 0,
    module: null,
    defaultOff: true,
  },
  announcements: {
    label: 'Thông báo',
    area: 'sidebar',
    defaultTitle: 'Thông báo',
    defaultLimit: 5,
    maxLimit: 10,
    module: 'announcements',
  },
  documents: {
    label: 'Văn bản mới',
    area: 'sidebar',
    defaultTitle: 'Văn bản mới',
    defaultLimit: 5,
    maxLimit: 10,
    module: 'documents',
  },
  visit_counter: {
    label: 'Thống kê truy cập',
    area: 'sidebar',
    defaultTitle: 'Thống kê truy cập',
    defaultLimit: 0,
    maxLimit: 0,
    module: null,
  },
}

// Kiểu (type) chứ không phải interface để ghi thẳng vào cột jsonb (kiểu Json)
export type HomepageSection = {
  key: HomepageSectionKey
  enabled: boolean
  /** Rỗng = dùng tiêu đề mặc định */
  title: string
  limit: number
}

const rawSectionSchema = z.object({
  key: z.enum(HOMEPAGE_SECTION_KEYS),
  enabled: z.boolean().catch(true),
  title: z.string().trim().max(80).catch(''),
  limit: z.number().int().catch(-1),
})

/** Bỏ khối sai/trùng, kẹp số lượng trong giới hạn, thêm khối còn thiếu (bật sẵn) vào cuối. */
export function normalizeSections(input: unknown): HomepageSection[] {
  const list = Array.isArray(input) ? input : []
  const seen = new Set<HomepageSectionKey>()
  const result: HomepageSection[] = []
  for (const item of list) {
    const parsed = rawSectionSchema.safeParse(item)
    if (!parsed.success || seen.has(parsed.data.key)) continue
    const info = SECTION_INFO[parsed.data.key]
    seen.add(parsed.data.key)
    result.push({
      ...parsed.data,
      limit:
        info.maxLimit === 0
          ? 0
          : parsed.data.limit < 1
            ? info.defaultLimit
            : Math.min(parsed.data.limit, info.maxLimit),
    })
  }
  for (const key of HOMEPAGE_SECTION_KEYS) {
    if (!seen.has(key)) {
      result.push({
        key,
        enabled: !SECTION_INFO[key].defaultOff,
        title: '',
        limit: SECTION_INFO[key].defaultLimit,
      })
    }
  }
  return result
}

const LINK_PATTERN = /^(\/|https?:\/\/)\S*$/
const bannerText = z.string().trim().catch('')

export const DEFAULT_BANNER = {
  image_path: null,
  alt: '',
  badge: '',
  title: '',
  subtitle: '',
  link_url: '',
  cta_label: '',
  color: '',
  placement: 'column',
} as const

/** Nội dung khối banner. Có tiêu đề: chữ trên nền màu kèm ảnh mờ. Không tiêu đề: chỉ hiện ảnh (ảnh đã có chữ). */
const bannerSchema = z
  .object({
    image_path: z.string().trim().min(1).nullable().catch(null),
    alt: bannerText,
    badge: bannerText,
    title: bannerText,
    subtitle: bannerText,
    link_url: bannerText.transform((v) => (LINK_PATTERN.test(v) ? v : '')),
    cta_label: bannerText,
    color: bannerText.transform((v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : '')),
    /** top: toàn chiều rộng ngay dưới slide; column: trong cột chính, theo thứ tự các khối */
    placement: z.enum(['top', 'column']).catch('column'),
  })
  .catch({ ...DEFAULT_BANNER })

export type HomepageBanner = z.infer<typeof bannerSchema>

export const homepageSchema = z.object({
  show_slides: z.boolean().catch(true),
  /** Giây giữa hai slide */
  slide_interval: z.number().int().min(3).max(30).catch(6),
  sections: z.unknown().optional().transform(normalizeSections),
  category_ids: z.array(z.string().uuid()).max(6).catch([]),
  banner: bannerSchema,
  visit_counter_offset: z.number().int().min(0).catch(0),
})

export type HomepageSettings = z.infer<typeof homepageSchema>

export function sectionTitle(section: HomepageSection): string {
  return section.title || SECTION_INFO[section.key].defaultTitle
}

/** Các khối của một cột, đúng thứ tự, đã bỏ khối tắt hoặc thuộc module đang tắt. */
export function visibleSections(
  settings: HomepageSettings,
  area: 'main' | 'sidebar',
  isModuleEnabled: (key: ModuleKey) => boolean,
): HomepageSection[] {
  return settings.sections.filter((s) => {
    const info = SECTION_INFO[s.key]
    return s.enabled && info.area === area && (!info.module || isModuleEnabled(info.module))
  })
}

/** Đổi chỗ một khối với khối liền kề CÙNG CỘT (mảng sections chứa cả hai cột). */
export function moveSection(
  sections: HomepageSection[],
  key: HomepageSectionKey,
  delta: -1 | 1,
): HomepageSection[] {
  const area = SECTION_INFO[key].area
  const indexes = sections.map((s, i) => (SECTION_INFO[s.key].area === area ? i : -1)).filter((i) => i >= 0)
  const pos = indexes.findIndex((i) => sections[i]!.key === key)
  const target = indexes[pos + delta]
  if (pos < 0 || target === undefined) return sections
  const next = [...sections]
  const from = indexes[pos]!
  ;[next[from], next[target]] = [next[target]!, next[from]!]
  return next
}
