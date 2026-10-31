import { getSupabase } from '@/lib/supabase'

export const CONTENT_GROUPS_KEY = ['content-groups'] as const

export type GroupScope = 'announcement' | 'document'

export interface ContentGroup {
  id: string
  parent_id: string | null
  name: string
  sort_order: number
}

export async function fetchContentGroups(scope: GroupScope): Promise<ContentGroup[]> {
  const { data, error } = await getSupabase()
    .from('content_groups')
    .select('id, parent_id, name, sort_order')
    .eq('scope', scope)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data
}

export async function saveContentGroup(
  scope: GroupScope,
  input: { name: string; parent_id: string | null },
  id: string | null,
  nextOrder: number,
): Promise<void> {
  const supabase = getSupabase()
  const { error } = id
    ? await supabase.from('content_groups').update(input).eq('id', id)
    : await supabase.from('content_groups').insert({ ...input, scope, sort_order: nextOrder })
  if (error) throw error
}

export async function deleteContentGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from('content_groups').delete().eq('id', id)
  if (error) throw error
}

/** Id của nhóm và các nhóm con: chọn thư mục cha thì thấy cả văn bản trong thư mục con. */
export function groupWithChildren(groups: ContentGroup[], id: string): string[] {
  return [id, ...groups.filter((g) => g.parent_id === id).map((g) => g.id)]
}

/** Danh sách cho ô chọn, mục con thụt vào sau mục cha. */
export function groupOptions(groups: ContentGroup[]): Array<{ value: string; label: string }> {
  return groups
    .filter((g) => !g.parent_id)
    .flatMap((root) => [
      { value: root.id, label: root.name },
      ...groups.filter((g) => g.parent_id === root.id).map((g) => ({ value: g.id, label: `— ${g.name}` })),
    ])
}
