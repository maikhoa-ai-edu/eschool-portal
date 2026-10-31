import { getSupabase, requireUserId } from '@/lib/supabase'
import { slugify, withRandomSuffix } from '@/lib/slug'
import { pageRange } from '@/components/ui/page-utils'
import type { NewsStatus } from './workflow'

export const NEWS_PAGE_SIZE = 12
export const ADMIN_PAGE_SIZE = 20

/** Mọi truy vấn tin tức dùng chung tiền tố này để lưu/xóa là trang nào cũng tải lại */
export const NEWS_KEY = ['news'] as const

const isUniqueViolation = (error: { code?: string } | null) => error?.code === '23505'

// ---------------------------------------------------------------------------
// Chuyên mục & thẻ
// ---------------------------------------------------------------------------

export interface NewsCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export async function fetchCategories(): Promise<NewsCategory[]> {
  const { data, error } = await getSupabase()
    .from('news_categories')
    .select('id, name, slug, description, sort_order, is_active')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data
}

export interface CategoryInput {
  name: string
  slug: string
  description: string
  sort_order: number
  is_active: boolean
}

export async function saveCategory(input: CategoryInput, id?: string): Promise<void> {
  const row = { ...input, description: input.description || null }
  const supabase = getSupabase()
  const { error } = id
    ? await supabase.from('news_categories').update(row).eq('id', id)
    : await supabase.from('news_categories').insert(row)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await getSupabase().from('news_categories').delete().eq('id', id)
  if (error) throw error
}

export interface NewsTagWithCount {
  id: string
  name: string
  slug: string
  usage: number
}

export async function fetchTagsWithUsage(): Promise<NewsTagWithCount[]> {
  const { data, error } = await getSupabase()
    .from('news_tags')
    .select('id, name, slug, news_tag_map(count)')
    .order('name')
  if (error) throw error
  return data.map((t) => ({ id: t.id, name: t.name, slug: t.slug, usage: t.news_tag_map[0]?.count ?? 0 }))
}

export async function fetchTagName(slug: string): Promise<string | null> {
  const { data, error } = await getSupabase().from('news_tags').select('name').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data?.name ?? null
}

export async function renameTag(id: string, name: string): Promise<void> {
  const { error } = await getSupabase()
    .from('news_tags')
    .update({ name, slug: slugify(name) })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await getSupabase().from('news_tags').delete().eq('id', id)
  if (error) throw error
}

/** Gắn đúng danh sách thẻ cho bài: tạo thẻ còn thiếu (theo slug), bỏ thẻ không còn dùng. */
async function syncTags(newsId: string, names: string[]): Promise<void> {
  const supabase = getSupabase()
  const wanted = new Map<string, string>()
  for (const name of names) {
    const slug = slugify(name)
    if (slug && !wanted.has(slug)) wanted.set(slug, name)
  }
  const slugs = [...wanted.keys()]

  const tagIds: string[] = []
  if (slugs.length > 0) {
    const existing = await supabase.from('news_tags').select('id, slug').in('slug', slugs)
    if (existing.error) throw existing.error
    const found = new Map(existing.data.map((t) => [t.slug, t.id]))
    const missing = slugs.filter((s) => !found.has(s))
    if (missing.length > 0) {
      const created = await supabase
        .from('news_tags')
        .insert(missing.map((slug) => ({ slug, name: wanted.get(slug)! })))
        .select('id, slug')
      // Người khác vừa tạo cùng thẻ: đọc lại là đủ
      if (created.error && !isUniqueViolation(created.error)) throw created.error
      if (created.error) {
        const again = await supabase.from('news_tags').select('id, slug').in('slug', missing)
        if (again.error) throw again.error
        again.data.forEach((t) => found.set(t.slug, t.id))
      } else {
        created.data.forEach((t) => found.set(t.slug, t.id))
      }
    }
    slugs.forEach((s) => {
      const id = found.get(s)
      if (id) tagIds.push(id)
    })
  }

  const current = await supabase.from('news_tag_map').select('tag_id').eq('news_id', newsId)
  if (current.error) throw current.error
  const currentIds = new Set(current.data.map((r) => r.tag_id))
  const removed = [...currentIds].filter((id) => !tagIds.includes(id))
  const added = tagIds.filter((id) => !currentIds.has(id))

  if (removed.length > 0) {
    const { error } = await supabase.from('news_tag_map').delete().eq('news_id', newsId).in('tag_id', removed)
    if (error) throw error
  }
  if (added.length > 0) {
    const { error } = await supabase
      .from('news_tag_map')
      .insert(added.map((tag_id) => ({ news_id: newsId, tag_id })))
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Quản trị tin
// ---------------------------------------------------------------------------

export interface AdminNewsFilter {
  status: NewsStatus | null
  query: string
  page: number
}

const ADMIN_LIST_COLUMNS =
  'id, title, slug, status, is_featured, updated_at, published_at, view_count, author_id, category:news_categories(name), author:profiles!news_author_id_fkey(full_name)'

export async function fetchAdminNews(filter: AdminNewsFilter) {
  let query = getSupabase()
    .from('news')
    .select(ADMIN_LIST_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(...pageRange(filter.page, ADMIN_PAGE_SIZE))
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.query.trim()) query = query.ilike('title', `%${filter.query.trim()}%`)
  const { data, error, count } = await query
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export type AdminNewsItem = Awaited<ReturnType<typeof fetchAdminNews>>['items'][number]

export async function fetchNewsForEdit(id: string) {
  const { data, error } = await getSupabase()
    .from('news')
    .select(
      'id, title, slug, excerpt, content, thumbnail_url, category_id, author_id, author_name, source_name, source_url, status, is_featured, review_note, published_at, author:profiles!news_author_id_fkey(full_name), news_tag_map(news_tags(name))',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    status: data.status as NewsStatus,
    tags: data.news_tag_map.map((m) => m.news_tags?.name).filter((n): n is string => Boolean(n)),
  }
}

export type EditableNews = NonNullable<Awaited<ReturnType<typeof fetchNewsForEdit>>>

export interface NewsInput {
  title: string
  slug: string
  excerpt: string
  content: string
  thumbnail_url: string | null
  category_id: string
  author_name: string
  source_name: string
  source_url: string
  tags: string[]
  status: NewsStatus
  review_note: string | null
  /** Chỉ gửi khi người dùng có quyền duyệt (CSDL chặn người khác đổi) */
  is_featured?: boolean
}

/** Tạo hoặc cập nhật bài; trả về id. Đường dẫn trùng thì tự thêm hậu tố ngắn. */
export async function saveNews(input: NewsInput, id?: string): Promise<string> {
  const supabase = getSupabase()
  const { tags, ...fields } = input
  const row = {
    ...fields,
    excerpt: fields.excerpt.trim() || null,
    author_name: fields.author_name.trim() || null,
    source_name: fields.source_name.trim() || null,
    source_url: fields.source_url.trim() || null,
  }
  let newsId = id

  if (id) {
    const { error } = await supabase.from('news').update(row).eq('id', id)
    if (error) throw error
  } else {
    const author_id = await requireUserId()
    let result = await supabase
      .from('news')
      .insert({ ...row, author_id })
      .select('id')
      .single()
    if (isUniqueViolation(result.error)) {
      result = await supabase
        .from('news')
        .insert({ ...row, slug: withRandomSuffix(row.slug), author_id })
        .select('id')
        .single()
    }
    if (result.error) throw result.error
    newsId = result.data.id
  }

  await syncTags(newsId!, tags)
  return newsId!
}

export async function deleteNews(id: string): Promise<void> {
  const { error } = await getSupabase().from('news').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Trang công khai
// ---------------------------------------------------------------------------

const PUBLIC_CARD_COLUMNS = 'id, title, slug, excerpt, thumbnail_url, published_at, view_count'

export interface PublicNewsFilter {
  page: number
  categorySlug?: string
  tagSlug?: string
}

/**
 * Chỉ lấy bài đã đăng. Phải lọc tường minh vì nhân sự đăng nhập xem trang công khai
 * vẫn đọc được bài nháp qua RLS.
 */
export async function fetchPublicNews(filter: PublicNewsFilter) {
  const supabase = getSupabase()
  const now = new Date().toISOString()
  const range = pageRange(filter.page, NEWS_PAGE_SIZE)

  if (filter.tagSlug) {
    const { data, error, count } = await supabase
      .from('news')
      .select(
        `${PUBLIC_CARD_COLUMNS}, category:news_categories(name, slug), news_tag_map!inner(news_tags!inner(slug))`,
        { count: 'exact' },
      )
      .eq('status', 'published')
      .lte('published_at', now)
      .eq('news_tag_map.news_tags.slug', filter.tagSlug)
      .order('published_at', { ascending: false })
      .range(...range)
    if (error) throw error
    return { items: data, total: count ?? 0 }
  }

  if (filter.categorySlug) {
    const { data, error, count } = await supabase
      .from('news')
      .select(`${PUBLIC_CARD_COLUMNS}, category:news_categories!inner(name, slug)`, { count: 'exact' })
      .eq('status', 'published')
      .lte('published_at', now)
      .eq('category.slug', filter.categorySlug)
      .order('published_at', { ascending: false })
      .range(...range)
    if (error) throw error
    return { items: data, total: count ?? 0 }
  }

  const { data, error, count } = await supabase
    .from('news')
    .select(`${PUBLIC_CARD_COLUMNS}, category:news_categories(name, slug)`, { count: 'exact' })
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .range(...range)
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export type PublicNewsCard = Awaited<ReturnType<typeof fetchPublicNews>>['items'][number]

/** Tìm không dấu (hàm search_news trong CSDL), tối đa 50 kết quả. */
export async function searchPublicNews(query: string): Promise<PublicNewsCard[]> {
  const { data, error } = await getSupabase()
    .rpc('search_news', { p_query: query, p_limit: 50 })
    .select(`${PUBLIC_CARD_COLUMNS}, category:news_categories(name, slug)`)
  if (error) throw error
  return data
}

export async function fetchPublicNewsBySlug(slug: string) {
  const { data, error } = await getSupabase()
    .from('news')
    .select(
      'id, title, slug, excerpt, content, thumbnail_url, published_at, view_count, status, category_id, author_name, source_name, source_url, category:news_categories(name, slug), author:profiles!news_author_id_fkey(full_name), news_tag_map(news_tags(name, slug))',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    tags: data.news_tag_map
      .map((m) => m.news_tags)
      .filter((t): t is { name: string; slug: string } => Boolean(t)),
  }
}

/** Bài cùng thẻ, mới nhất trước; bài gắn nhiều thẻ trùng chỉ lấy một lần. */
export async function fetchNewsByTags(tagSlugs: string[], excludeId: string, limit: number) {
  if (tagSlugs.length === 0) return []
  const { data, error } = await getSupabase()
    .from('news')
    .select('id, title, slug, thumbnail_url, published_at, news_tag_map!inner(news_tags!inner(slug))')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .in('news_tag_map.news_tags.slug', tagSlugs)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit * 2)
  if (error) throw error
  return data.filter((n, i) => data.findIndex((x) => x.id === n.id) === i).slice(0, limit)
}

export async function fetchRelatedNews(categoryId: string, excludeId: string, limit = 4) {
  const { data, error } = await getSupabase()
    .from('news')
    .select('id, title, slug, thumbnail_url, published_at')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .eq('category_id', categoryId)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

const VIEWED_KEY = 'eschool:viewed-news'

/** Tăng lượt xem một lần cho mỗi bài trong một phiên trình duyệt. */
export async function recordNewsView(id: string): Promise<void> {
  try {
    const viewed = new Set<string>(JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? '[]') as string[])
    if (viewed.has(id)) return
    viewed.add(id)
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed]))
  } catch {
    // Trình duyệt chặn sessionStorage: vẫn đếm
  }
  await getSupabase().rpc('increment_news_view', { p_news_id: id })
}
