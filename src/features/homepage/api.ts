import type { Json } from '@/lib/database.types'
import { getSupabase, requireUserId } from '@/lib/supabase'
import { resolveMediaUrl } from '@/features/media/api'

/** Tiền tố khóa truy vấn của trang chủ (slide + các khối) */
export const HOMEPAGE_KEY = ['homepage'] as const

// ---------------------------------------------------------------------------
// Slide
// ---------------------------------------------------------------------------

export interface Slide {
  id: string
  title: string
  subtitle: string | null
  image_path: string
  link_url: string | null
  sort_order: number
  is_active: boolean
  /** Có khi slide được tạo từ bài viết */
  news_id?: string
}

export async function fetchSlides(activeOnly: boolean): Promise<Slide[]> {
  let query = getSupabase()
    .from('homepage_slides')
    .select('id, title, subtitle, image_path, link_url, sort_order, is_active')
    .order('sort_order')
    .order('created_at')
  // Nhân sự đọc được cả slide đang ẩn; trang công khai phải lọc tường minh
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export function slideImageUrl(slide: Pick<Slide, 'image_path'>): string {
  return resolveMediaUrl(slide.image_path) ?? ''
}

export interface SlideInput {
  title: string
  subtitle: string
  image_path: string
  link_url: string
  is_active: boolean
}

export async function saveSlide(input: SlideInput, id: string | null, nextOrder: number): Promise<void> {
  const supabase = getSupabase()
  const row = { ...input, subtitle: input.subtitle || null, link_url: input.link_url || null }
  const { error } = id
    ? await supabase.from('homepage_slides').update(row).eq('id', id)
    : await supabase
        .from('homepage_slides')
        .insert({ ...row, sort_order: nextOrder, created_by: await requireUserId() })
  if (error) throw error
}

export async function setSlideActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabase().from('homepage_slides').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteSlide(id: string): Promise<void> {
  const { error } = await getSupabase().from('homepage_slides').delete().eq('id', id)
  if (error) throw error
}

export async function saveSlideOrder(ordered: Slide[]): Promise<void> {
  const supabase = getSupabase()
  for (const [index, slide] of ordered.entries()) {
    if (slide.sort_order === index) continue
    const { error } = await supabase.from('homepage_slides').update({ sort_order: index }).eq('id', slide.id)
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Lưu cấu hình (bố cục trang chủ, dòng chữ chạy)
// ---------------------------------------------------------------------------

/** Ghi đè toàn bộ giá trị một khóa cấu hình; RLS chặn thì báo lỗi thay vì im lặng. */
export async function saveSetting(key: 'homepage' | 'marquee' | 'site_chrome', value: Json): Promise<void> {
  const { data, error } = await getSupabase()
    .from('site_settings')
    .update({ value })
    .eq('key', key)
    .select('key')
  if (error) throw error
  if (data.length === 0) throw new Error('Bạn không có quyền thực hiện thao tác này.')
}

// ---------------------------------------------------------------------------
// Dữ liệu các khối trang chủ (chỉ nội dung đã đăng)
// ---------------------------------------------------------------------------

const NEWS_CARD =
  'id, title, slug, excerpt, thumbnail_url, published_at, category:news_categories(name, slug)'

function publishedNews() {
  return getSupabase()
    .from('news')
    .select(NEWS_CARD)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
}

/** Tin nổi bật trước, thiếu thì lấy thêm tin mới nhất cho đủ số lượng. */
export async function fetchFeaturedNews(limit: number) {
  const { data, error } = await publishedNews()
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export type HomeNews = Awaited<ReturnType<typeof fetchFeaturedNews>>[number]

export async function fetchLatestNews(limit: number) {
  const { data, error } = await publishedNews().order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

/** Tin mới có ảnh cho dải tin trượt dưới slide. */
export async function fetchLatestNewsWithImage(limit: number) {
  const { data, error } = await publishedNews()
    .not('thumbnail_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/** Bài được tick "Hiển thị trên slide"; thiếu ảnh thì bỏ qua vì slide phải có ảnh. */
async function fetchSliderNews(limit: number) {
  const { data, error } = await publishedNews()
    .eq('show_on_slider', true)
    .not('thumbnail_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

function newsToSlide(news: HomeNews): Slide {
  return {
    id: `news-${news.id}`,
    news_id: news.id,
    title: news.title,
    subtitle: news.excerpt,
    image_path: news.thumbnail_url ?? '',
    link_url: `/tin-tuc/${news.slug}`,
    sort_order: 0,
    is_active: true,
  }
}

/**
 * Slide trang chủ: slide tạo tay trước, rồi tới bài được tick mới nhất.
 * Không có cả hai thì lấy tin mới nhất có ảnh nếu trường bật `autoLatest`.
 */
export async function fetchHeroSlides(newsLimit: number, autoLatest: boolean): Promise<Slide[]> {
  const [manual, ticked] = await Promise.all([fetchSlides(true), fetchSliderNews(newsLimit)])
  const news =
    manual.length === 0 && ticked.length === 0 && autoLatest
      ? await fetchLatestNewsWithImage(newsLimit)
      : ticked
  return [...manual, ...news.map(newsToSlide)]
}

/** Chỉ lưu tổng lượt xem của từng bài, nên giới hạn bài đăng gần đây để bài cũ không đứng đầu mãi. */
export const MOST_VIEWED_DAYS = 90

export async function fetchMostViewedNews(limit: number) {
  const since = new Date(Date.now() - MOST_VIEWED_DAYS * 86_400_000).toISOString()
  const { data, error } = await publishedNews()
    .gte('published_at', since)
    .order('view_count', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function fetchCategoryNews(categoryId: string, limit: number) {
  const { data, error } = await publishedNews()
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function fetchLatestDocuments(limit: number) {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title, document_number, document_type, issue_date, file_name')
    .eq('status', 'published')
    .order('issue_date', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export type LatestDocument = Awaited<ReturnType<typeof fetchLatestDocuments>>[number]
