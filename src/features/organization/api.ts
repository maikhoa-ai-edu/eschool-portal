import { getSupabase } from '@/lib/supabase'

export const ORGANIZATION_KEY = ['organization'] as const

const MEMBER_COLUMNS =
  'id, unit_id, full_name, position, start_year, qualification, subjects, avatar_path, is_visible, sort_order'

export interface OrgMember {
  id: string
  unit_id: string
  full_name: string
  position: string | null
  start_year: number | null
  qualification: string | null
  subjects: string | null
  avatar_path: string | null
  is_visible: boolean
  sort_order: number
}

export interface OrgUnit {
  id: string
  name: string
  description: string | null
  sort_order: number
  org_members: OrgMember[]
}

/** Bộ phận kèm thành viên. Trang công khai lọc rõ người đang hiện vì RLS cho quản trị viên đọc cả người bị ẩn. */
export async function fetchOrganization(publicOnly: boolean): Promise<OrgUnit[]> {
  let query = getSupabase()
    .from('org_units')
    .select(`id, name, description, sort_order, org_members (${MEMBER_COLUMNS})`)
    .order('sort_order')
    .order('name')
    .order('sort_order', { referencedTable: 'org_members' })
    .order('full_name', { referencedTable: 'org_members' })
  if (publicOnly) query = query.eq('org_members.is_visible', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export interface OrgUnitInput {
  name: string
  description: string | null
  sort_order: number
}

export async function saveUnit(input: OrgUnitInput, id?: string): Promise<void> {
  const table = getSupabase().from('org_units')
  const { error } = id ? await table.update(input).eq('id', id) : await table.insert(input)
  if (error) throw error
}

export async function deleteUnit(id: string): Promise<void> {
  const { error } = await getSupabase().from('org_units').delete().eq('id', id)
  if (error) throw error
}

export type OrgMemberInput = Omit<OrgMember, 'id'>

export async function saveMember(input: OrgMemberInput, id?: string): Promise<void> {
  const table = getSupabase().from('org_members')
  const { error } = id ? await table.update(input).eq('id', id) : await table.insert(input)
  if (error) throw error
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await getSupabase().from('org_members').delete().eq('id', id)
  if (error) throw error
}

/** Ghi lại thứ tự theo danh sách đã sắp xếp; dòng nào không đổi thì bỏ qua. */
export async function reorder(
  table: 'org_units' | 'org_members',
  items: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  for (const [index, item] of items.entries()) {
    if (item.sort_order === index) continue
    const { error } = await getSupabase().from(table).update({ sort_order: index }).eq('id', item.id)
    if (error) throw error
  }
}

/** Chữ cái đầu của tên (tên riêng tiếng Việt nằm cuối), dùng khi chưa có ảnh đại diện. */
export function memberInitial(fullName: string): string {
  return (fullName.trim().split(/\s+/).at(-1)?.charAt(0) ?? '').toUpperCase()
}
