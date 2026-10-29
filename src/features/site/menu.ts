import { getSupabase } from '@/lib/supabase'

export interface MenuItem {
  id: string
  parent_id: string | null
  title: string
  url: string
  open_in_new_tab: boolean
  sort_order: number
}

export interface MenuNode extends MenuItem {
  children: MenuNode[]
}

/** Dựng cây menu từ danh sách phẳng; mục có cha không tồn tại được đưa lên cấp gốc. */
export function buildMenuTree(items: MenuItem[]): MenuNode[] {
  const nodes = new Map<string, MenuNode>(items.map((i) => [i.id, { ...i, children: [] }]))
  const roots: MenuNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: MenuNode[]) => {
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
    .select('id, parent_id, title, url, open_in_new_tab, sort_order, menus!inner(code)')
    .eq('menus.code', code)
    .eq('is_active', true)
  if (error) throw error
  return buildMenuTree(data)
}
