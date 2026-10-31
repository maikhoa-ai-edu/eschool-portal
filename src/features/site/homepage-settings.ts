import { z } from 'zod'
import type { ModuleKey } from './settings'

/**
 * Các loại khối của trang chủ; thứ tự trong mảng sections là thứ tự hiển thị trong từng vùng.
 * Riêng category_news có thể xuất hiện nhiều lần, mỗi chuyên mục một khối.
 */
export const HOMEPAGE_SECTION_KEYS = [
  'featured_news',
  'latest_news',
  'category_news',
  'albums',
  'topic_banner',
  'shortcuts',
  'announcements',
  'documents',
  'visit_counter',
] as const
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number]

/** Bốn vùng cố định của trang: đầu trang và cuối trang toàn chiều rộng, giữa là cột chính + cột phải. */
export const HOMEPAGE_ZONES = ['top', 'main', 'sidebar', 'bottom'] as const
export type HomepageZone = (typeof HOMEPAGE_ZONES)[number]

export const ZONE_LABELS: Record<HomepageZone, string> = {
  top: 'Đầu trang',
  main: 'Cột chính',
  sidebar: 'Cột phải',
  bottom: 'Cuối trang',
}

export const NEWS_VARIANTS = ['spotlight', 'magazine', 'grid', 'image_list', 'compact'] as const
export type NewsVariant = (typeof NEWS_VARIANTS)[number]

export const VARIANT_LABELS: Record<NewsVariant, string> = {
  spotlight: 'Tiêu điểm',
  magazine: 'Tạp chí',
  grid: 'Lưới',
  image_list: 'Danh sách ảnh',
  compact: 'Danh sách gọn',
}

const SIDEBAR_VARIANTS: NewsVariant[] = ['image_list', 'compact']

export interface SectionInfo {
  label: string
  /** Vùng khi cấu hình chưa ghi vùng (cấu hình cũ chỉ có hai cột) */
  zone: HomepageZone
  defaultTitle: string
  defaultLimit: number
  /** Số mục tối đa (0 = khối không có số lượng) */
  maxLimit: number
  /** Ẩn khi module này tắt */
  module: ModuleKey | null
  /** Khối mới thêm vào cấu hình cũ có bật sẵn không (mặc định có) */
  defaultOff?: boolean
  /** Khối tin: chọn được kiểu hiển thị */
  newsVariants?: boolean
  /** Chọn được số cột mà không cần chọn kiểu (Thư viện ảnh) */
  columns?: boolean
  /** Quá rộng so với cột phải */
  noSidebar?: boolean
}

export const SECTION_INFO: Record<HomepageSectionKey, SectionInfo> = {
  featured_news: {
    label: 'Tin nổi bật',
    zone: 'main',
    defaultTitle: 'Tin nổi bật',
    defaultLimit: 5,
    maxLimit: 12,
    module: 'news',
    newsVariants: true,
  },
  latest_news: {
    label: 'Tin mới nhất',
    zone: 'main',
    defaultTitle: 'Tin mới nhất',
    defaultLimit: 6,
    maxLimit: 12,
    module: 'news',
    newsVariants: true,
  },
  category_news: {
    label: 'Tin theo chuyên mục',
    zone: 'main',
    defaultTitle: '',
    defaultLimit: 4,
    maxLimit: 8,
    module: 'news',
    newsVariants: true,
  },
  albums: {
    label: 'Thư viện ảnh',
    zone: 'main',
    defaultTitle: 'Thư viện ảnh',
    defaultLimit: 4,
    maxLimit: 8,
    // Không gắn module: tắt Thư viện ảnh mà còn video, tài nguyên thì khối vẫn hiện các tab đó
    module: null,
    columns: true,
    noSidebar: true,
  },
  topic_banner: {
    label: 'Banner chuyên đề',
    zone: 'main',
    defaultTitle: '',
    defaultLimit: 0,
    maxLimit: 0,
    module: null,
    defaultOff: true,
    noSidebar: true,
  },
  shortcuts: {
    label: 'Lối tắt',
    zone: 'top',
    defaultTitle: '',
    defaultLimit: 6,
    maxLimit: 6,
    module: null,
    defaultOff: true,
    noSidebar: true,
  },
  announcements: {
    label: 'Thông báo',
    zone: 'sidebar',
    defaultTitle: 'Thông báo',
    defaultLimit: 5,
    maxLimit: 10,
    module: 'announcements',
  },
  documents: {
    label: 'Văn bản mới',
    zone: 'sidebar',
    defaultTitle: 'Văn bản mới',
    defaultLimit: 5,
    maxLimit: 10,
    module: 'documents',
  },
  visit_counter: {
    label: 'Thống kê truy cập',
    zone: 'sidebar',
    defaultTitle: 'Thống kê truy cập',
    defaultLimit: 0,
    maxLimit: 0,
    module: null,
  },
}

/** Mỗi chuyên mục tốn một truy vấn khi mở trang chủ nên giới hạn số khối. */
export const MAX_CATEGORY_BLOCKS = 6

// Kiểu (type) chứ không phải interface để ghi thẳng vào cột jsonb (kiểu Json)
export type HomepageSection = {
  /** Trùng key, riêng khối chuyên mục là category:<id> */
  id: string
  key: HomepageSectionKey
  enabled: boolean
  /** Rỗng = dùng tiêu đề mặc định */
  title: string
  limit: number
  zone: HomepageZone
  /** Nửa chiều rộng vùng: hai khối nửa liền nhau xếp song song */
  half: boolean
  /** null = kiểu gốc của khối (giữ giao diện trường chưa chọn kiểu mới) */
  variant: NewsVariant | null
  columns: 2 | 3 | 4 | null
  icon: string | null
  category_id: string | null
  /** Cấu hình cũ: tiêu đề chung của các chuyên mục, hiện thành "<prefix>: <tên chuyên mục>" */
  prefix: string
}

export function allowedZones(key: HomepageSectionKey): HomepageZone[] {
  return HOMEPAGE_ZONES.filter((z) => z !== 'sidebar' || !SECTION_INFO[key].noSidebar)
}

export function allowedVariants(zone: HomepageZone): NewsVariant[] {
  return zone === 'sidebar' ? SIDEBAR_VARIANTS : [...NEWS_VARIANTS]
}

/** Số cột lưới tối đa theo độ rộng khối. */
export function maxColumns(zone: HomepageZone, half: boolean): 2 | 3 | 4 {
  if (half) return 2
  return zone === 'main' ? 3 : 4
}

/** Đưa khối về trạng thái hợp lệ với vùng đang ở (kiểu, số cột, nửa trang). */
function fitToZone(section: HomepageSection): HomepageSection {
  const info = SECTION_INFO[section.key]
  const zone = allowedZones(section.key).includes(section.zone) ? section.zone : 'main'
  const half = zone !== 'sidebar' && section.half
  const variant =
    info.newsVariants && section.variant && allowedVariants(zone).includes(section.variant)
      ? section.variant
      : null
  const columns =
    section.columns && (info.columns || info.newsVariants)
      ? (Math.min(section.columns, maxColumns(zone, half)) as 2 | 3 | 4)
      : null
  return { ...section, zone, half, variant, columns }
}

const rawSectionSchema = z.object({
  key: z.enum(HOMEPAGE_SECTION_KEYS),
  enabled: z.boolean().catch(true),
  title: z.string().trim().max(80).catch(''),
  limit: z.number().int().catch(-1),
  zone: z.enum(HOMEPAGE_ZONES).nullable().catch(null),
  half: z.boolean().catch(false),
  variant: z.enum(NEWS_VARIANTS).nullable().catch(null),
  columns: z
    .union([z.literal(2), z.literal(3), z.literal(4)])
    .nullable()
    .catch(null),
  icon: z.string().trim().max(40).nullable().catch(null),
  // z.guid chứ không phải z.uuid: Zod 4 từ chối UUID không đúng chuẩn RFC (như id trong dữ liệu mẫu)
  category_id: z.guid().nullable().catch(null),
  prefix: z.string().trim().max(80).catch(''),
})

export function newCategorySection(
  categoryId: string,
  patch: Partial<HomepageSection> = {},
): HomepageSection {
  return {
    id: `category:${categoryId}`,
    key: 'category_news',
    enabled: true,
    title: '',
    limit: SECTION_INFO.category_news.defaultLimit,
    zone: 'main',
    half: false,
    variant: null,
    columns: null,
    icon: null,
    category_id: categoryId,
    prefix: '',
    ...patch,
  }
}

/**
 * Bỏ khối sai/trùng, kẹp số lượng, đưa kiểu về hợp lệ, thêm khối còn thiếu vào cuối.
 * Cấu hình cũ: khối category_news chung + categoryIds được tách thành từng khối ngay tại vị trí cũ;
 * banner có placement top nằm ở vùng đầu trang.
 */
export function normalizeSections(
  input: unknown,
  categoryIds: string[] = [],
  bannerPlacement: 'top' | 'column' = 'column',
): HomepageSection[] {
  const list = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const seenKeys = new Set<HomepageSectionKey>()
  const result: HomepageSection[] = []
  let categoryBlocks = 0

  const push = (section: HomepageSection) => {
    if (seen.has(section.id)) return
    if (section.key === 'category_news') {
      if (categoryBlocks >= MAX_CATEGORY_BLOCKS) return
      categoryBlocks++
    }
    seen.add(section.id)
    result.push(fitToZone(section))
  }
  const limitOf = (key: HomepageSectionKey, limit: number) => {
    const info = SECTION_INFO[key]
    if (info.maxLimit === 0) return 0
    return limit < 1 ? info.defaultLimit : Math.min(limit, info.maxLimit)
  }
  const expandLegacyCategories = (enabled: boolean, title: string, limit: number) => {
    for (const id of categoryIds) {
      push(newCategorySection(id, { enabled, prefix: title, limit: limitOf('category_news', limit) }))
    }
  }
  const defaultZone = (key: HomepageSectionKey) =>
    key === 'topic_banner' && bannerPlacement === 'top' ? 'top' : SECTION_INFO[key].zone

  for (const item of list) {
    const parsed = rawSectionSchema.safeParse(item)
    if (!parsed.success) continue
    const { key, zone, ...raw } = parsed.data
    seenKeys.add(key)
    if (key === 'category_news') {
      if (raw.category_id) {
        push({
          ...raw,
          id: `category:${raw.category_id}`,
          key,
          zone: zone ?? 'main',
          limit: limitOf(key, raw.limit),
        })
      } else {
        expandLegacyCategories(raw.enabled, raw.title, raw.limit)
      }
      continue
    }
    push({
      ...raw,
      id: key,
      key,
      zone: zone ?? defaultZone(key),
      limit: limitOf(key, raw.limit),
      category_id: null,
      prefix: '',
    })
  }

  for (const key of HOMEPAGE_SECTION_KEYS) {
    if (seenKeys.has(key)) continue
    if (key === 'category_news') {
      expandLegacyCategories(true, '', SECTION_INFO.category_news.defaultLimit)
      continue
    }
    push({
      id: key,
      key,
      enabled: !SECTION_INFO[key].defaultOff,
      title: '',
      limit: SECTION_INFO[key].defaultLimit,
      zone: defaultZone(key),
      half: false,
      variant: null,
      columns: null,
      icon: null,
      category_id: null,
      prefix: '',
    })
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
    /** Chỉ còn để đọc cấu hình cũ (khối chưa ghi vùng): top = vùng đầu trang, column = cột chính */
    placement: z.enum(['top', 'column']).catch('column'),
  })
  .catch({ ...DEFAULT_BANNER })

export type HomepageBanner = z.infer<typeof bannerSchema>

export const homepageSchema = z
  .object({
    show_slides: z.boolean().catch(true),
    /** Giây giữa hai slide */
    slide_interval: z.number().int().min(3).max(30).catch(6),
    /**
     * full: slide toàn chiều rộng; split: slide 2/3 + cột Tiêu điểm 1/3;
     * portal: như split, thêm dải tin trượt dưới slide và tab Xem nhiều ở cột phải
     */
    hero: z.enum(['full', 'split', 'portal']).catch('full'),
    /** Làm nổi thông báo đăng gần nhất ở khối Thông báo */
    highlight_latest_announcement: z.boolean().catch(false),
    /** Khối Văn bản chạy lên thay vì đứng yên */
    documents_ticker: z.boolean().catch(false),
    /** Kiểu tiêu đề khối cho toàn trang */
    heading_style: z.enum(['underline', 'bar']).catch('underline'),
    /** Kiểu trang danh sách tin (/tin-tuc, chuyên mục, thẻ, tìm kiếm) */
    news_list: z.enum(['list', 'grid']).catch('list'),
    sections: z.unknown().optional(),
    // Chỉ còn để đọc cấu hình cũ; khi lưu, mỗi chuyên mục đã là một khối trong sections
    category_ids: z.array(z.guid()).max(MAX_CATEGORY_BLOCKS).catch([]),
    banner: bannerSchema,
    visit_counter_offset: z.number().int().min(0).catch(0),
  })
  .transform(({ sections, category_ids, ...rest }) => ({
    ...rest,
    sections: normalizeSections(sections, category_ids, rest.banner.placement),
  }))

export type HomepageSettings = z.infer<typeof homepageSchema>

export function sectionTitle(section: HomepageSection): string {
  return section.title || SECTION_INFO[section.key].defaultTitle
}

/** Tiêu đề khối chuyên mục: đã đặt riêng > tiền tố của cấu hình cũ + tên > tên chuyên mục. */
export function categoryTitle(section: HomepageSection, name: string): string {
  return section.title || (section.prefix ? `${section.prefix}: ${name}` : name)
}

/** Các khối của một vùng, đúng thứ tự, đã bỏ khối tắt hoặc thuộc module đang tắt. */
export function visibleSections(
  settings: Pick<HomepageSettings, 'sections'>,
  zone: HomepageZone,
  isModuleEnabled: (key: ModuleKey) => boolean,
): HomepageSection[] {
  return settings.sections.filter((s) => {
    const info = SECTION_INFO[s.key]
    return s.enabled && s.zone === zone && (!info.module || isModuleEnabled(info.module))
  })
}

/** Kiểu thực tế của khối tin khi chưa chọn: cột phải dùng danh sách gọn, còn lại theo kiểu gốc. */
export function resolveVariant(section: HomepageSection): NewsVariant {
  if (section.variant) return section.variant
  if (section.zone === 'sidebar') return 'compact'
  return section.key === 'latest_news' ? 'grid' : 'spotlight'
}

export function resolveColumns(section: HomepageSection): 2 | 3 | 4 {
  return section.columns ?? (Math.min(3, maxColumns(section.zone, section.half)) as 2 | 3 | 4)
}

/** Hai khối nửa liền nhau thành một hàng; khối nửa lẻ đứng một mình thì chiếm cả hàng. */
export function groupRows(sections: HomepageSection[]): HomepageSection[][] {
  const rows: HomepageSection[][] = []
  for (const section of sections) {
    const last = rows.at(-1)
    if (section.half && last?.length === 1 && last[0]!.half) last.push(section)
    else rows.push([section])
  }
  return rows
}

/** Đổi chỗ một khối với khối liền kề CÙNG VÙNG (mảng sections chứa mọi vùng). */
export function moveSection(sections: HomepageSection[], id: string, delta: -1 | 1): HomepageSection[] {
  const zone = sections.find((s) => s.id === id)?.zone
  const indexes = sections.map((s, i) => (s.zone === zone ? i : -1)).filter((i) => i >= 0)
  const pos = indexes.findIndex((i) => sections[i]!.id === id)
  const target = indexes[pos + delta]
  if (pos < 0 || target === undefined) return sections
  const next = [...sections]
  const from = indexes[pos]!
  ;[next[from], next[target]] = [next[target]!, next[from]!]
  return next
}

/** Chuyển khối sang vùng khác (xếp cuối vùng đó), tự đổi kiểu nếu vùng mới không hỗ trợ. */
export function moveToZone(sections: HomepageSection[], id: string, zone: HomepageZone): HomepageSection[] {
  const section = sections.find((s) => s.id === id)
  if (!section) return sections
  return [...sections.filter((s) => s.id !== id), fitToZone({ ...section, zone })]
}

/** Sửa thuộc tính một khối, giữ khối luôn hợp lệ. */
export function patchSection(
  sections: HomepageSection[],
  id: string,
  patch: Partial<HomepageSection>,
): HomepageSection[] {
  return sections.map((s) => (s.id === id ? fitToZone({ ...s, ...patch }) : s))
}
