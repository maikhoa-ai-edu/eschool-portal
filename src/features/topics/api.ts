import type { Json } from '@/lib/database.types'
import { withRandomSuffix } from '@/lib/slug'
import { getSupabase, requireUserId } from '@/lib/supabase'
import { parseTopicSections, type TopicSection } from './sections'

export const TOPICS_KEY = ['topics'] as const

const COLUMNS =
  'id, title, slug, badge, summary, hero_image, hero_color, quote_text, quote_author, sections, status, sort_order, meta_title, meta_description, no_index, updated_at'

export async function fetchAdminTopics() {
  const { data, error } = await getSupabase()
    .from('topics')
    .select('id, title, slug, status, sort_order, updated_at')
    .order('sort_order')
    .order('title')
  if (error) throw error
  return data
}

async function fetchTopicBy(column: 'id' | 'slug', value: string) {
  const { data, error } = await getSupabase().from('topics').select(COLUMNS).eq(column, value).maybeSingle()
  if (error) throw error
  return data && { ...data, sections: parseTopicSections(data.sections) }
}

export const fetchTopic = (id: string) => fetchTopicBy('id', id)
/** Không lọc trạng thái: nhân sự xem trước bản nháp (RLS chặn khách), trang hiện dải "Bản xem trước". */
export const fetchPublicTopic = (slug: string) => fetchTopicBy('slug', slug)

export type Topic = NonNullable<Awaited<ReturnType<typeof fetchTopic>>>

/** Chuyên đề đã đăng (lọc tường minh vì nhân sự đọc được cả bản nháp). */
export async function fetchPublishedTopics() {
  const { data, error } = await getSupabase()
    .from('topics')
    .select('id, title, slug, badge, summary, hero_image')
    .eq('status', 'published')
    .order('sort_order')
    .order('title')
  if (error) throw error
  return data
}

export interface TopicInput {
  title: string
  slug: string
  badge: string
  summary: string
  hero_image: string | null
  hero_color: string
  quote_text: string
  quote_author: string
  sections: TopicSection[]
  status: string
  sort_order: number
  meta_title: string
  meta_description: string
  no_index: boolean
}

export async function saveTopic(input: TopicInput, id?: string): Promise<string> {
  const supabase = getSupabase()
  const row = {
    ...input,
    badge: input.badge || null,
    summary: input.summary || null,
    hero_color: input.hero_color || null,
    quote_text: input.quote_text || null,
    quote_author: input.quote_author || null,
    meta_title: input.meta_title || null,
    meta_description: input.meta_description || null,
    sections: input.sections as unknown as Json,
  }
  if (id) {
    const { error } = await supabase.from('topics').update(row).eq('id', id)
    if (error) throw error
    return id
  }
  const created_by = await requireUserId()
  let result = await supabase
    .from('topics')
    .insert({ ...row, created_by })
    .select('id')
    .single()
  if (result.error?.code === '23505') {
    result = await supabase
      .from('topics')
      .insert({ ...row, slug: withRandomSuffix(row.slug), created_by })
      .select('id')
      .single()
  }
  if (result.error) throw result.error
  return result.data.id
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await getSupabase().from('topics').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Dữ liệu của các khối lấy từ module khác (chỉ nội dung đã đăng)
// ---------------------------------------------------------------------------

export async function fetchNewsByTag(tagSlug: string, limit: number) {
  const { data, error } = await getSupabase()
    .from('news')
    .select(
      'id, title, slug, excerpt, thumbnail_url, published_at, category:news_categories(name), news_tag_map!inner(news_tags!inner(slug))',
    )
    .eq('news_tag_map.news_tags.slug', tagSlug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/** Giữ đúng thứ tự người soạn đã chọn. */
export async function fetchDocumentsByIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title, document_type, issue_date, file_name')
    .in('id', ids)
    .eq('status', 'published')
  if (error) throw error
  return ids.flatMap((id) => data.filter((d) => d.id === id))
}

/** Danh sách để chọn trong trang soạn (nhân sự). */
export async function fetchDocumentOptions() {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title')
    .eq('status', 'published')
    .order('issue_date', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) throw error
  return data
}

export async function fetchAlbumOptions() {
  const { data, error } = await getSupabase()
    .from('albums')
    .select('slug, title')
    .eq('status', 'published')
    .order('event_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data
}
