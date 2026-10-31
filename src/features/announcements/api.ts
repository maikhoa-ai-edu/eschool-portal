import type { BadgeTone } from '@/components/ui/Badge'
import { pageRange } from '@/components/ui/page-utils'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const ANNOUNCEMENTS_KEY = ['announcements'] as const
export const ANNOUNCEMENT_PAGE_SIZE = 15

export const PRIORITIES = ['normal', 'important', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Thông thường',
  important: 'Quan trọng',
  urgent: 'Khẩn',
}

export const PRIORITY_TONES: Record<Priority, BadgeTone> = {
  normal: 'info',
  important: 'warning',
  urgent: 'danger',
}

export function asPriority(value: string): Priority {
  return (PRIORITIES as readonly string[]).includes(value) ? (value as Priority) : 'normal'
}

export function isPast(iso: string, now = new Date()): boolean {
  return new Date(iso) <= now
}

/** Thông báo đã đăng nhưng quá hạn hiển thị */
export function isExpired(a: { status: string; expires_at: string | null }, now = new Date()): boolean {
  return a.status === 'published' && a.expires_at !== null && new Date(a.expires_at) <= now
}

export async function fetchAdminAnnouncements(page: number) {
  const { data, error, count } = await getSupabase()
    .from('announcements')
    .select('id, title, priority, is_pinned, status, published_at, expires_at, updated_at', {
      count: 'exact',
    })
    .order('updated_at', { ascending: false })
    .range(...pageRange(page, ANNOUNCEMENT_PAGE_SIZE))
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export async function fetchAnnouncement(id: string) {
  const { data, error } = await getSupabase()
    .from('announcements')
    .select('id, title, content, priority, is_pinned, group_id, status, published_at, expires_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export type EditableAnnouncement = NonNullable<Awaited<ReturnType<typeof fetchAnnouncement>>>

export interface AnnouncementInput {
  title: string
  content: string
  priority: Priority
  is_pinned: boolean
  group_id: string | null
  status: 'draft' | 'published'
  expires_at: string | null
}

export async function saveAnnouncement(input: AnnouncementInput, id?: string): Promise<string> {
  const supabase = getSupabase()
  if (id) {
    const { error } = await supabase.from('announcements').update(input).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase
    .from('announcements')
    .insert({ ...input, created_by: await requireUserId() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await getSupabase().from('announcements').delete().eq('id', id)
  if (error) throw error
}

/** Thông báo đang hiệu lực; lọc tường minh vì nhân sự đăng nhập đọc được cả bản nháp. */
export async function fetchPublicAnnouncements(
  page: number,
  pageSize = ANNOUNCEMENT_PAGE_SIZE,
  groupId: string | null = null,
) {
  const now = new Date().toISOString()
  let query = getSupabase()
    .from('announcements')
    .select('id, title, content, priority, is_pinned, published_at', { count: 'exact' })
    .eq('status', 'published')
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range(...pageRange(page, pageSize))
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error, count } = await query
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export async function fetchPublicAnnouncement(id: string) {
  const { data, error } = await getSupabase()
    .from('announcements')
    .select('id, title, content, priority, is_pinned, group_id, status, published_at, expires_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
