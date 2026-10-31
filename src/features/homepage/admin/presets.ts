import {
  homepageSchema,
  newCategorySection,
  SECTION_INFO,
  type HomepageSection,
  type HomepageSectionKey,
  type HomepageSettings,
} from '@/features/site/homepage-settings'

type PresetBlock = Pick<HomepageSection, 'key'> & Partial<HomepageSection>

interface LayoutPreset {
  label: string
  description: string
  hero: HomepageSettings['hero']
  heading_style: HomepageSettings['heading_style']
  /** Theo đúng thứ tự trên trang. category_news lần lượt lấy các chuyên mục đang có. */
  blocks: PresetBlock[]
}

export const LAYOUT_PRESETS = {
  news: {
    label: 'Báo điện tử',
    description:
      'Slide kèm dải tin và cột Tiêu điểm / Xem nhiều, nhiều tin ở cột chính, hai chuyên mục song song',
    hero: 'portal',
    heading_style: 'bar',
    blocks: [
      { key: 'topic_banner', zone: 'top' },
      { key: 'shortcuts', zone: 'top', enabled: true },
      { key: 'featured_news', zone: 'main', variant: 'magazine', limit: 5 },
      { key: 'latest_news', zone: 'main', variant: 'grid', columns: 3, limit: 6 },
      { key: 'category_news', zone: 'main', half: true, variant: 'spotlight', limit: 4 },
      { key: 'category_news', zone: 'main', half: true, variant: 'spotlight', limit: 4 },
      { key: 'announcements', zone: 'sidebar', limit: 5 },
      { key: 'documents', zone: 'sidebar', limit: 5 },
      { key: 'visit_counter', zone: 'sidebar' },
      { key: 'plan_month', zone: 'sidebar', enabled: true },
      { key: 'latest_video', zone: 'sidebar', enabled: true },
      { key: 'web_links', zone: 'sidebar', enabled: true },
      { key: 'albums', zone: 'bottom', columns: 4, limit: 4 },
    ],
  },
  school: {
    label: 'Trường học gọn',
    description: 'Slide toàn rộng, lối tắt, tin dạng danh sách ngắn gọn',
    hero: 'full',
    heading_style: 'underline',
    blocks: [
      { key: 'topic_banner', zone: 'top' },
      { key: 'shortcuts', zone: 'top', enabled: true },
      { key: 'featured_news', zone: 'main', variant: 'spotlight', limit: 4 },
      { key: 'latest_news', zone: 'main', variant: 'image_list', limit: 6 },
      { key: 'category_news', zone: 'main', half: true, variant: 'compact', limit: 5 },
      { key: 'category_news', zone: 'main', half: true, variant: 'compact', limit: 5 },
      { key: 'albums', zone: 'main', columns: 3, limit: 3 },
      { key: 'announcements', zone: 'sidebar', limit: 5 },
      { key: 'documents', zone: 'sidebar', limit: 5 },
      { key: 'visit_counter', zone: 'sidebar' },
      { key: 'plan_month', zone: 'sidebar', enabled: true },
      { key: 'latest_video', zone: 'sidebar', enabled: true },
      { key: 'web_links', zone: 'sidebar', enabled: true },
    ],
  },
  photo: {
    label: 'Nhiều ảnh',
    description: 'Không có cột phải, ảnh lớn, thẻ tin dạng lưới, thông báo và văn bản ở cuối trang',
    hero: 'full',
    heading_style: 'bar',
    blocks: [
      { key: 'shortcuts', zone: 'top', enabled: false },
      { key: 'topic_banner', zone: 'top' },
      { key: 'featured_news', zone: 'top', variant: 'magazine', limit: 5 },
      { key: 'latest_news', zone: 'main', variant: 'grid', columns: 4, limit: 8 },
      { key: 'category_news', zone: 'main', half: true, variant: 'grid', columns: 2, limit: 4 },
      { key: 'category_news', zone: 'main', half: true, variant: 'grid', columns: 2, limit: 4 },
      { key: 'albums', zone: 'bottom', columns: 4, limit: 8 },
      { key: 'announcements', zone: 'bottom', half: true, limit: 5 },
      { key: 'documents', zone: 'bottom', half: true, limit: 5 },
      { key: 'visit_counter', zone: 'bottom', enabled: false },
    ],
  },
} as const satisfies Record<string, LayoutPreset>

export type LayoutPresetKey = keyof typeof LAYOUT_PRESETS

/**
 * Áp một mẫu vào bản nháp: đổi vùng, thứ tự, kiểu, số mục; giữ tiêu đề, icon, nội dung banner và slide.
 * Banner giữ trạng thái bật/tắt vì chỉ trường đã soạn nội dung mới nên bật. Trường chưa chọn đủ chuyên mục
 * thì lấy thêm từ các chuyên mục đang hoạt động; chuyên mục thừa được giữ nhưng tắt.
 */
export function applyPreset(
  key: LayoutPresetKey,
  settings: HomepageSettings,
  activeCategoryIds: string[],
): HomepageSettings {
  const preset: LayoutPreset = LAYOUT_PRESETS[key]
  const current = (k: HomepageSectionKey) => settings.sections.find((s) => s.key === k)
  const existingCategories = settings.sections.filter((s) => s.key === 'category_news')
  const usable = existingCategories.filter((s) => s.category_id && activeCategoryIds.includes(s.category_id))
  const pool = [
    ...usable,
    ...activeCategoryIds
      .filter((id) => !usable.some((s) => s.category_id === id))
      .map((id) => newCategorySection(id)),
  ]

  const used = new Set<string>()
  const blocks: HomepageSection[] = []
  for (const block of preset.blocks) {
    const base = block.key === 'category_news' ? pool.shift() : current(block.key)
    if (!base) continue
    used.add(base.id)
    blocks.push({
      ...base,
      half: false,
      variant: null,
      columns: null,
      ...block,
      // Banner: trường chưa soạn nội dung thì bật lên cũng không có gì để hiện, giữ nguyên lựa chọn
      enabled: block.enabled ?? (block.key === 'topic_banner' ? base.enabled : true),
      limit: block.limit ?? base.limit,
    })
  }
  const leftovers = settings.sections
    .filter((s) => !used.has(s.id))
    .map((s) => ({ ...s, enabled: false, zone: SECTION_INFO[s.key].zone, half: false }))
  return reparse({
    ...settings,
    hero: preset.hero,
    heading_style: preset.heading_style,
    sections: [...blocks, ...leftovers],
  })
}

/** Về bố cục như lúc mới cài: giữ nội dung banner, bỏ mọi kiểu đã chọn, chuyên mục đang có giữ thứ tự. */
export function applyDefaultLayout(settings: HomepageSettings): HomepageSettings {
  const categories = settings.sections.filter((s) => s.key === 'category_news')
  return reparse({
    ...settings,
    hero: 'full',
    heading_style: 'underline',
    sections: [
      ...settings.sections
        .filter((s) => s.key !== 'category_news')
        .map((s) => ({
          ...s,
          zone: SECTION_INFO[s.key].zone,
          half: false,
          variant: null,
          columns: null,
          limit: SECTION_INFO[s.key].defaultLimit,
          enabled: s.key === 'topic_banner' ? s.enabled : !SECTION_INFO[s.key].defaultOff,
        })),
      ...categories.map((s) => ({
        ...s,
        zone: 'main' as const,
        half: false,
        variant: null,
        columns: null,
        limit: SECTION_INFO.category_news.defaultLimit,
      })),
    ].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)),
  })
}

const ORDER: HomepageSectionKey[] = [
  'topic_banner',
  'featured_news',
  'latest_news',
  'category_news',
  'albums',
  'shortcuts',
  'announcements',
  'documents',
  'visit_counter',
  'plan_month',
  'latest_video',
  'web_links',
]

/** Qua bộ chuẩn hóa để kiểu, số cột luôn hợp lệ với vùng (mẫu viết tay cũng không lọt giá trị sai). */
function reparse(settings: HomepageSettings): HomepageSettings {
  return homepageSchema.parse(settings)
}
