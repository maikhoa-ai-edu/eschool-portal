import { describe, expect, it } from 'vitest'
import { resolveMediaUrl } from '@/features/media/api'
import { initSupabase } from '@/lib/supabase'
import { applyDefaultLayout, applyPreset, LAYOUT_PRESETS } from '@/features/homepage/admin/presets'
import { blockWidth, newsImageSizes } from '@/features/homepage/layout'
import {
  groupRows,
  homepageSchema,
  moveSection,
  moveToZone,
  newCategorySection,
  normalizeSections,
  patchSection,
  resolveVariant,
  visibleSections,
} from './homepage-settings'
import { marqueeSchema } from './settings'

describe('cấu hình trang chủ', () => {
  it('thiếu cấu hình thì có đủ các khối mặc định; banner tắt sẵn', () => {
    const s = homepageSchema.parse({})
    expect(s.sections.map((x) => x.key)).toEqual([
      'featured_news',
      'latest_news',
      'albums',
      'topic_banner',
      'shortcuts',
      'announcements',
      'documents',
      'visit_counter',
      'plan_month',
      'latest_video',
      'web_links',
    ])
    expect(s.sections.filter((x) => !x.enabled).map((x) => x.key)).toEqual([
      'topic_banner',
      'shortcuts',
      'plan_month',
      'latest_video',
      'web_links',
    ])
    expect(s.hero).toBe('full')
    expect(s.heading_style).toBe('underline')
    expect(s.news_list).toBe('list')
    expect(s.banner.placement).toBe('column')
    expect(s.show_slides).toBe(true)
    expect(s.slide_interval).toBe(6)
  })

  it('giữ thứ tự đã lưu, bỏ khối lạ/trùng, kẹp số lượng, thêm khối còn thiếu', () => {
    const sections = normalizeSections([
      { key: 'albums', enabled: false, title: 'Ảnh đẹp', limit: 99 },
      { key: 'khong-co', enabled: true },
      { key: 'albums', enabled: true },
      { key: 'latest_news', limit: 0 },
    ])
    expect(sections[0]).toMatchObject({
      key: 'albums',
      enabled: false,
      title: 'Ảnh đẹp',
      limit: 8,
      zone: 'main',
    })
    expect(sections[1]).toMatchObject({
      key: 'latest_news',
      enabled: true,
      title: '',
      limit: 6,
      variant: null,
    })
    expect(sections).toHaveLength(11)
  })

  it('số liệu sai kiểu dùng giá trị an toàn', () => {
    const s = homepageSchema.parse({ slide_interval: 1, visit_counter_offset: -5, category_ids: ['x'] })
    expect(s.slide_interval).toBe(6)
    expect(s.visit_counter_offset).toBe(0)
    expect(s.sections.some((x) => x.key === 'category_news')).toBe(false)
  })

  it('chỉ hiện khối đang bật và thuộc module đang bật, đúng cột', () => {
    const s = homepageSchema.parse({
      sections: [
        { key: 'documents', enabled: true },
        { key: 'announcements', enabled: false },
      ],
    })
    const sidebar = visibleSections(s, 'sidebar', (m) => m !== 'documents')
    expect(sidebar.map((x) => x.key)).toEqual(['visit_counter'])
    expect(visibleSections(s, 'main', () => true).map((x) => x.key)).toContain('featured_news')
  })

  it('đổi chỗ khối trong cùng một cột (bỏ qua khối của cột kia)', () => {
    const sections = normalizeSections([
      { key: 'featured_news' },
      { key: 'announcements' },
      { key: 'latest_news' },
    ])
    const moved = moveSection(sections, 'latest_news', -1)
    expect(moved.map((x) => x.key).slice(0, 3)).toEqual(['latest_news', 'announcements', 'featured_news'])
    expect(moveSection(sections, 'featured_news', -1)).toBe(sections)
  })
})

const C1 = '00000000-0000-0000-0000-0000000000c2'
const C2 = '3f2b8c1e-9a4d-4e6f-8b21-7c5d9e0a1b2c'

describe('đọc cấu hình cũ (trước Giai đoạn 8.5)', () => {
  const legacy = {
    show_slides: true,
    sections: [
      { key: 'featured_news', enabled: true, title: '', limit: 5 },
      { key: 'category_news', enabled: true, title: 'Góc nhìn', limit: 3 },
      { key: 'latest_news', enabled: true, title: '', limit: 6 },
      { key: 'topic_banner', enabled: true, title: '', limit: 0 },
      { key: 'announcements', enabled: true, title: '', limit: 5 },
    ],
    category_ids: [C1, C2],
    banner: { title: 'x', placement: 'top' },
  }

  it('tách category_ids thành từng khối ngay tại vị trí cũ, kể cả UUID dữ liệu mẫu không theo RFC', () => {
    const s = homepageSchema.parse(legacy)
    expect(s.sections.map((x) => x.id).slice(0, 4)).toEqual([
      'featured_news',
      `category:${C1}`,
      `category:${C2}`,
      'latest_news',
    ])
    expect(s.sections[1]).toMatchObject({
      limit: 3,
      prefix: 'Góc nhìn',
      variant: null,
      zone: 'main',
      half: false,
    })
  })

  it('giữ trường đang chạy ở kiểu gốc: không có kiểu, cột phải đúng vùng, khối mới tắt sẵn', () => {
    const s = homepageSchema.parse(legacy)
    expect(s.hero).toBe('full')
    expect(s.sections.every((x) => x.variant === null && x.columns === null && !x.half)).toBe(true)
    expect(s.sections.find((x) => x.key === 'announcements')!.zone).toBe('sidebar')
    expect(s.sections.find((x) => x.key === 'shortcuts')!.enabled).toBe(false)
  })

  it('banner placement top nằm ở vùng đầu trang, placement column ở cột chính', () => {
    expect(homepageSchema.parse(legacy).sections.find((x) => x.key === 'topic_banner')!.zone).toBe('top')
    const column = homepageSchema.parse({ ...legacy, banner: { title: 'x', placement: 'column' } })
    expect(column.sections.find((x) => x.key === 'topic_banner')!.zone).toBe('main')
  })

  it('thiếu khối category_news nhưng có category_ids thì vẫn hiện các chuyên mục', () => {
    const s = homepageSchema.parse({ sections: [{ key: 'albums' }], category_ids: [C2] })
    expect(s.sections.some((x) => x.category_id === C2)).toBe(true)
  })

  it('lưu rồi đọc lại không đổi, bỏ hết khối chuyên mục thì không tự thêm lại', () => {
    const once = homepageSchema.parse(legacy)
    const saved = JSON.parse(JSON.stringify(once)) as unknown
    expect(homepageSchema.parse(saved)).toEqual(once)
    const removed = { ...once, sections: once.sections.filter((x) => x.key !== 'category_news') }
    expect(homepageSchema.parse(removed).sections.some((x) => x.key === 'category_news')).toBe(false)
  })
})

describe('vùng, kiểu và độ rộng khối', () => {
  it('cột phải chỉ nhận kiểu danh sách; kiểu khác về danh sách gọn', () => {
    const [s] = normalizeSections([{ key: 'latest_news', zone: 'sidebar', variant: 'magazine', half: true }])
    expect(s).toMatchObject({ zone: 'sidebar', variant: null, half: false })
    expect(resolveVariant(s!)).toBe('compact')
    const [list] = normalizeSections([{ key: 'latest_news', zone: 'sidebar', variant: 'image_list' }])
    expect(list!.variant).toBe('image_list')
  })

  it('khối quá rộng không vào được cột phải; giá trị lạ bị bỏ', () => {
    const [album] = normalizeSections([{ key: 'albums', zone: 'sidebar' }])
    expect(album!.zone).toBe('main')
    const [odd] = normalizeSections([{ key: 'latest_news', zone: 'ngoai', variant: 'la', columns: 9 }])
    expect(odd).toMatchObject({ zone: 'main', variant: null, columns: null })
  })

  it('kẹp số cột theo độ rộng khối', () => {
    const [main, half, full] = normalizeSections([
      { key: 'latest_news', zone: 'main', columns: 4 },
      { key: 'featured_news', zone: 'main', half: true, columns: 4 },
      { key: 'albums', zone: 'bottom', columns: 4 },
    ])
    expect([main!.columns, half!.columns, full!.columns]).toEqual([3, 2, 4])
  })

  it('giới hạn số khối chuyên mục, bỏ khối trùng', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7].map((n) => `00000000-0000-0000-0000-00000000000${n}`)
    const sections = normalizeSections([
      ...ids.map((category_id) => ({ key: 'category_news', category_id })),
      { key: 'category_news', category_id: ids[0] },
    ])
    expect(sections.filter((x) => x.key === 'category_news')).toHaveLength(6)
  })

  it('hai khối nửa liền nhau thành một hàng; khối lẻ đứng riêng', () => {
    const rows = groupRows(
      normalizeSections([
        { key: 'featured_news', half: true },
        { key: 'latest_news', half: true },
        { key: 'albums', half: true },
        { key: 'topic_banner', zone: 'main' },
        { key: 'shortcuts', zone: 'main', half: true },
      ]).filter((x) => x.zone === 'main'),
    )
    expect(rows.map((r) => r.map((x) => x.key))).toEqual([
      ['featured_news', 'latest_news'],
      ['albums'],
      ['topic_banner'],
      ['shortcuts'],
    ])
  })

  it('đổi vùng: xếp cuối vùng mới và đưa kiểu về hợp lệ', () => {
    const sections = normalizeSections([{ key: 'latest_news', variant: 'magazine' }, { key: 'documents' }])
    const moved = moveToZone(sections, 'latest_news', 'sidebar')
    expect(moved.at(-1)).toMatchObject({ id: 'latest_news', zone: 'sidebar', variant: null })
    expect(patchSection(moved, 'latest_news', { half: true }).at(-1)!.half).toBe(false)
  })
})

describe('sizes ảnh theo bố cục', () => {
  const section = (patch: Parameters<typeof newCategorySection>[1]) => newCategorySection(C1, patch)

  it('độ rộng vùng khớp khung trang', () => {
    expect(blockWidth('top', false)).toBe(1248)
    expect(blockWidth('main', false)).toBe(896)
    expect(blockWidth('main', true)).toBe(432)
    expect(blockWidth('bottom', true)).toBe(608)
  })

  it('lưới: ảnh theo số cột; điện thoại 2 cột', () => {
    expect(newsImageSizes(section({ variant: 'grid', columns: 3, zone: 'main' })).small).toBe(
      '(min-width: 1024px) 299px, (min-width: 768px) 33vw, 50vw',
    )
    expect(newsImageSizes(section({ variant: 'grid', columns: 4, zone: 'top' })).small).toContain('312px')
  })

  it('tạp chí: rộng thì chia đôi, nửa trang thì xếp chồng', () => {
    const wide = newsImageSizes(section({ variant: 'magazine', zone: 'main' }))
    expect(wide.big).toContain('448px')
    expect(wide.small).toContain('224px')
    const half = newsImageSizes(section({ variant: 'magazine', zone: 'main', half: true }))
    expect(half.big).toContain('432px')
    expect(half.small).toContain('216px')
  })

  it('tiêu điểm: nửa trang trong cột chính xếp chồng; kiểu gọn không có ảnh', () => {
    expect(newsImageSizes(section({ variant: 'spotlight', zone: 'main' })).big).toContain('538px')
    expect(newsImageSizes(section({ variant: 'spotlight', zone: 'main', half: true })).big).toContain('432px')
    expect(newsImageSizes(section({ variant: 'compact' })).big).toBe('')
  })
})

describe('mẫu bố cục', () => {
  const base = homepageSchema.parse({
    sections: [
      { key: 'latest_news', title: 'Tin của trường', icon: 'star' },
      { key: 'topic_banner', enabled: false },
    ],
    banner: { title: 'Giữ nguyên' },
    visit_counter_offset: 7,
  })

  it.each(Object.keys(LAYOUT_PRESETS) as Array<keyof typeof LAYOUT_PRESETS>)(
    'mẫu %s giữ tiêu đề, icon, banner; không bật banner chưa bật; mọi khối hợp lệ',
    (key) => {
      const s = applyPreset(key, base, [C1, C2])
      const latest = s.sections.find((x) => x.key === 'latest_news')!
      expect(latest).toMatchObject({ title: 'Tin của trường', icon: 'star' })
      expect(s.banner.title).toBe('Giữ nguyên')
      expect(s.visit_counter_offset).toBe(7)
      expect(s.sections.find((x) => x.key === 'topic_banner')!.enabled).toBe(false)
      expect(s.sections.filter((x) => x.key === 'category_news' && x.enabled)).toHaveLength(2)
      expect(homepageSchema.parse(JSON.parse(JSON.stringify(s)))).toEqual(s)
    },
  )

  it('thiếu chuyên mục thì bỏ qua chỗ trống; chuyên mục thừa được giữ nhưng tắt', () => {
    expect(applyPreset('news', base, []).sections.some((x) => x.key === 'category_news')).toBe(false)
    const ids = [C1, C2, '00000000-0000-0000-0000-0000000000c3']
    const three = applyPreset('news', base, ids)
    const again = applyPreset('school', three, ids)
    expect(again.sections.filter((x) => x.key === 'category_news').map((x) => x.enabled)).toEqual([
      true,
      true,
    ])
  })

  it('về bố cục mặc định: bỏ kiểu đã chọn, giữ chuyên mục', () => {
    const s = applyDefaultLayout(applyPreset('photo', base, [C1]))
    expect(s.hero).toBe('full')
    expect(s.heading_style).toBe('underline')
    expect(s.sections.every((x) => x.variant === null && !x.half)).toBe(true)
    expect(s.sections.find((x) => x.key === 'announcements')!.zone).toBe('sidebar')
    expect(s.sections.some((x) => x.category_id === C1)).toBe(true)
  })
})

describe('dòng chữ chạy', () => {
  it('đọc được cả kiểu cũ (mảng chuỗi) lẫn kiểu mới có liên kết', () => {
    const m = marqueeSchema.parse({
      enabled: true,
      items: ['Chào năm học mới', { text: 'Xem thông báo', url: '/thong-bao' }, { text: '  ' }],
    })
    expect(m.items).toEqual([
      { text: 'Chào năm học mới', url: null },
      { text: 'Xem thông báo', url: '/thong-bao' },
    ])
  })

  it('bỏ liên kết nguy hiểm', () => {
    const m = marqueeSchema.parse({ items: [{ text: 'x', url: 'javascript:alert(1)' }] })
    expect(m.items[0]!.url).toBeNull()
  })
})

describe('resolveMediaUrl', () => {
  it('đường dẫn trong bucket thành địa chỉ công khai; địa chỉ đầy đủ giữ nguyên', () => {
    initSupabase({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'khoa-gia-lap' })
    expect(resolveMediaUrl('seed/logo.jpg')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/media/seed/logo.jpg',
    )
    expect(resolveMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(resolveMediaUrl('/logo.png')).toBe('/logo.png')
    expect(resolveMediaUrl(null)).toBeNull()
  })
})
