import type { ModuleKey } from './settings'
import { getSupabase } from '@/lib/supabase'

export interface MenuItem {
  id: string
  parent_id: string | null
  title: string
  url: string
  open_in_new_tab: boolean
  icon: string | null
  image_path?: string | null
  sort_order: number
}

export type TreeNode<T> = T & { children: Array<TreeNode<T>> }
export type MenuNode = TreeNode<MenuItem>

/** Dựng cây menu từ danh sách phẳng; mục có cha không tồn tại được đưa lên cấp gốc. */
export function buildMenuTree<T extends MenuItem>(items: T[]): Array<TreeNode<T>> {
  const nodes = new Map<string, TreeNode<T>>(items.map((i) => [i.id, { ...i, children: [] }]))
  const roots: Array<TreeNode<T>> = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: Array<TreeNode<T>>) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'vi'))
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

export async function fetchMenu(code: string): Promise<MenuNode[]> {
  const { data, error } = await getSupabase()
    .from('menu_items')
    .select('id, parent_id, title, url, open_in_new_tab, icon, image_path, sort_order, menus!inner(code)')
    .eq('menus.code', code)
    .eq('is_active', true)
  if (error) throw error
  return buildMenuTree(data)
}

/** Đường dẫn công khai của từng module (khớp với router). */
const MODULE_PATHS: Array<[ModuleKey, string]> = [
  ['news', '/tin-tuc'],
  ['announcements', '/thong-bao'],
  ['documents', '/van-ban'],
  ['albums', '/thu-vien-anh'],
  ['pages', '/trang'],
  ['topics', '/chuyen-de'],
  ['videos', '/video'],
  ['resources', '/tai-nguyen'],
  ['plans', '/ke-hoach'],
]

export function moduleOfUrl(url: string): ModuleKey | null {
  const path = url.split(/[?#]/)[0]!
  const hit = MODULE_PATHS.find(([, prefix]) => path === prefix || path.startsWith(prefix + '/'))
  return hit?.[0] ?? null
}

/** Ẩn mục menu (kèm menu con) trỏ tới module đang tắt. */
export function hideDisabledModules(
  nodes: MenuNode[],
  isModuleEnabled: (key: ModuleKey) => boolean,
): MenuNode[] {
  return nodes
    .filter((n) => {
      const key = isExternalUrl(n.url) ? null : moduleOfUrl(n.url)
      return !key || isModuleEnabled(key)
    })
    .map((n) => ({ ...n, children: hideDisabledModules(n.children, isModuleEnabled) }))
}
