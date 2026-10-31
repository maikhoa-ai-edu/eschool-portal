import { getSupabase } from '@/lib/supabase'
import { fetchCategories } from '@/features/news/api'
import { fetchPublishedPageLinks } from '@/features/pages/api'
import { fetchPublishedTopics } from '@/features/topics/api'
import type { ModuleKey } from '@/features/site/settings'

export const MENUS_ADMIN_KEY = ['menus-admin'] as const
/** Tiền tố khóa truy vấn của menu công khai (MainNav, SiteFooter) */
export const PUBLIC_MENU_KEY = ['menu'] as const

export const MENU_URL_PATTERN = /^(\/|https?:\/\/)\S*$/

export interface AdminMenuItem {
  id: string
  menu_id: string
  parent_id: string | null
  title: string
  url: string
  open_in_new_tab: boolean
  icon: string | null
  is_active: boolean
  sort_order: number
}

/** Thứ tự tab: menu đầu trang trước, rồi lối tắt, chân trang, liên kết nhanh */
const LOCATION_ORDER = ['header', 'mobile_bar', 'shortcuts', 'footer', 'quick_links']

export async function fetchMenus() {
  const { data, error } = await getSupabase().from('menus').select('id, code, name, location').order('name')
  if (error) throw error
  return data.sort((a, b) => LOCATION_ORDER.indexOf(a.location) - LOCATION_ORDER.indexOf(b.location))
}

export async function fetchMenuItems(menuId: string): Promise<AdminMenuItem[]> {
  const { data, error } = await getSupabase()
    .from('menu_items')
    .select('id, menu_id, parent_id, title, url, open_in_new_tab, icon, is_active, sort_order')
    .eq('menu_id', menuId)
    .order('sort_order')
  if (error) throw error
  return data
}

export interface MenuItemInput {
  title: string
  url: string
  parent_id: string | null
  open_in_new_tab: boolean
  icon: string | null
  is_active: boolean
}

export async function saveMenuItem(
  menuId: string,
  input: MenuItemInput,
  existing: AdminMenuItem | null,
  siblings: AdminMenuItem[],
): Promise<void> {
  const supabase = getSupabase()
  if (existing) {
    const moved = existing.parent_id !== input.parent_id
    const { error } = await supabase
      .from('menu_items')
      .update({ ...input, ...(moved ? { sort_order: nextOrder(siblings) } : {}) })
      .eq('id', existing.id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('menu_items')
    .insert({ ...input, menu_id: menuId, sort_order: nextOrder(siblings) })
  if (error) throw error
}

function nextOrder(siblings: AdminMenuItem[]): number {
  return siblings.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1
}

export async function setMenuItemActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabase().from('menu_items').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** Xóa mục menu (mục con tự xóa theo, ràng buộc on delete cascade). */
export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('menu_items').delete().eq('id', id)
  if (error) throw error
}

/** Lưu thứ tự mới của các mục cùng cấp: chỉ cập nhật mục đổi vị trí. */
export async function saveSiblingOrder(ordered: AdminMenuItem[]): Promise<void> {
  const supabase = getSupabase()
  for (const [index, item] of ordered.entries()) {
    if (item.sort_order === index) continue
    const { error } = await supabase.from('menu_items').update({ sort_order: index }).eq('id', item.id)
    if (error) throw error
  }
}

export interface LinkSuggestion {
  group: string
  title: string
  url: string
}

const MODULE_LINKS: Array<{ module: ModuleKey | null; title: string; url: string }> = [
  { module: null, title: 'Trang chủ', url: '/' },
  { module: 'news', title: 'Tin tức', url: '/tin-tuc' },
  { module: 'announcements', title: 'Thông báo', url: '/thong-bao' },
  { module: 'documents', title: 'Văn bản', url: '/van-ban' },
  { module: 'albums', title: 'Thư viện ảnh', url: '/thu-vien-anh' },
  { module: 'topics', title: 'Chuyên đề', url: '/chuyen-de' },
]

/** Gợi ý liên kết khi thêm mục menu: trang chức năng, chuyên mục tin, trang tĩnh đã đăng. */
export async function fetchLinkSuggestions(
  isModuleEnabled: (key: ModuleKey) => boolean,
): Promise<LinkSuggestion[]> {
  const [categories, pages, topics] = await Promise.all([
    isModuleEnabled('news') ? fetchCategories() : Promise.resolve([]),
    isModuleEnabled('pages') ? fetchPublishedPageLinks() : Promise.resolve([]),
    isModuleEnabled('topics') ? fetchPublishedTopics() : Promise.resolve([]),
  ])
  return [
    ...MODULE_LINKS.filter((l) => !l.module || isModuleEnabled(l.module)).map((l) => ({
      group: 'Chức năng',
      title: l.title,
      url: l.url,
    })),
    ...categories
      .filter((c) => c.is_active)
      .map((c) => ({ group: 'Chuyên mục tin', title: c.name, url: `/tin-tuc/chuyen-muc/${c.slug}` })),
    ...pages.map((p) => ({ group: 'Trang tĩnh', title: p.title, url: `/trang/${p.slug}` })),
    ...topics.map((t) => ({ group: 'Chuyên đề', title: t.title, url: `/chuyen-de/${t.slug}` })),
  ]
}
