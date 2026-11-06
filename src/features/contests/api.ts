import { slugify } from '@/lib/slug'
import { getSupabase } from '@/lib/supabase'
import { toContestEntry, type ContestEntry } from './ranking'

export const CONTESTS_KEY = ['contests'] as const

export async function fetchContests() {
  const { data, error } = await getSupabase()
    .from('contests')
    .select('id, title, vote_ends_at, tag:news_tags(id, name, slug)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export type ContestRow = Awaited<ReturnType<typeof fetchContests>>[number]

/** Tìm thẻ theo tên (không phân biệt dấu cách, hoa thường), chưa có thì tạo. */
async function ensureTag(name: string): Promise<string> {
  const supabase = getSupabase()
  const slug = slugify(name)
  if (!slug) throw new Error('Vui lòng nhập tên thẻ của bài dự thi.')
  const found = await supabase.from('news_tags').select('id').eq('slug', slug).maybeSingle()
  if (found.error) throw found.error
  if (found.data) return found.data.id
  const created = await supabase.from('news_tags').insert({ name: name.trim(), slug }).select('id').single()
  if (created.error) throw created.error
  return created.data.id
}

export interface ContestInput {
  title: string
  tag_name: string
  vote_ends_at: string | null
}

export async function saveContest(input: ContestInput, id?: string): Promise<void> {
  const row = {
    title: input.title.trim(),
    tag_id: await ensureTag(input.tag_name),
    vote_ends_at: input.vote_ends_at,
  }
  const { error } = id
    ? await getSupabase().from('contests').update(row).eq('id', id)
    : await getSupabase().from('contests').insert(row)
  if (error) throw error
}

export async function deleteContest(id: string): Promise<void> {
  const { error } = await getSupabase().from('contests').delete().eq('id', id)
  if (error) throw error
}

export async function fetchContestEntries(contestId: string): Promise<ContestEntry[]> {
  const { data, error } = await getSupabase().rpc('contest_entries', { p_contest: contestId })
  if (error) throw error
  return data.map(toContestEntry)
}

/** Danh sách để chọn trong khối "Bài dự thi" của trang chuyên đề. */
export async function fetchContestOptions() {
  const { data, error } = await getSupabase()
    .from('contests')
    .select('id, title')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
