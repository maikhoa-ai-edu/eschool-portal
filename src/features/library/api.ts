import { getSupabase, requireUserId } from '@/lib/supabase'

export const VIDEOS_KEY = ['videos'] as const
export const RESOURCES_KEY = ['resources'] as const

/** Lấy mã video; trả null nếu link không phải YouTube hoặc Google Drive. */
function parseVideo(url: string): { provider: 'youtube' | 'drive'; id: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  const valid = (id: string | null | undefined) => (id && /^[\w-]+$/.test(id) ? id : null)
  if (host === 'youtu.be') {
    const id = valid(parsed.pathname.split('/')[1])
    return id ? { provider: 'youtube', id } : null
  }
  if (host === 'youtube.com') {
    const [, kind, rest] = parsed.pathname.split('/')
    const id = valid(
      kind === 'watch'
        ? parsed.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(kind ?? '')
          ? rest
          : null,
    )
    return id ? { provider: 'youtube', id } : null
  }
  if (host === 'drive.google.com') {
    const match = /^\/file\/d\/([\w-]+)/.exec(parsed.pathname)
    const id = valid(match?.[1] ?? parsed.searchParams.get('id'))
    return id ? { provider: 'drive', id } : null
  }
  return null
}

export function isValidVideoUrl(url: string): boolean {
  return parseVideo(url) !== null
}

/** Địa chỉ cho iframe, chỉ dựng từ mã đã kiểm tra nên không nhúng được trang lạ. */
export function videoEmbedUrl(url: string): string | null {
  const video = parseVideo(url)
  if (!video) return null
  return video.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.id}`
    : `https://drive.google.com/file/d/${video.id}/preview`
}

/** Drive không có ảnh xem trước công khai nên trả null, giao diện hiện biểu tượng. */
export function videoThumbnail(url: string): string | null {
  const video = parseVideo(url)
  return video?.provider === 'youtube' ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null
}

export interface Video {
  id: string
  title: string
  url: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export async function fetchVideos(activeOnly: boolean, limit?: number): Promise<Video[]> {
  let query = getSupabase()
    .from('videos')
    .select('id, title, url, description, sort_order, is_active')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (activeOnly) query = query.eq('is_active', true)
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data
}

export interface VideoInput {
  title: string
  url: string
  description: string
  is_active: boolean
}

export async function saveVideo(input: VideoInput, id: string | null, nextOrder: number): Promise<void> {
  const supabase = getSupabase()
  const row = { ...input, description: input.description || null }
  const { error } = id
    ? await supabase.from('videos').update(row).eq('id', id)
    : await supabase
        .from('videos')
        .insert({ ...row, sort_order: nextOrder, created_by: await requireUserId() })
  if (error) throw error
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await getSupabase().from('videos').delete().eq('id', id)
  if (error) throw error
}

export const RESOURCE_KINDS = ['phan_mem', 'giao_an', 'bieu_mau', 'khac'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  phan_mem: 'Phần mềm',
  giao_an: 'Giáo án',
  bieu_mau: 'Biểu mẫu',
  khac: 'Khác',
}

export function resourceKindLabel(kind: string): string {
  return RESOURCE_KIND_LABELS[kind as ResourceKind] ?? kind
}

export interface Resource {
  id: string
  title: string
  url: string
  kind: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export async function fetchResources(activeOnly: boolean, limit?: number): Promise<Resource[]> {
  let query = getSupabase()
    .from('resources')
    .select('id, title, url, kind, description, sort_order, is_active')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (activeOnly) query = query.eq('is_active', true)
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data
}

export interface ResourceInput {
  title: string
  url: string
  kind: ResourceKind
  description: string
  is_active: boolean
}

export async function saveResource(
  input: ResourceInput,
  id: string | null,
  nextOrder: number,
): Promise<void> {
  const supabase = getSupabase()
  const row = { ...input, description: input.description || null }
  const { error } = id
    ? await supabase.from('resources').update(row).eq('id', id)
    : await supabase
        .from('resources')
        .insert({ ...row, sort_order: nextOrder, created_by: await requireUserId() })
  if (error) throw error
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await getSupabase().from('resources').delete().eq('id', id)
  if (error) throw error
}
