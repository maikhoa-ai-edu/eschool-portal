import type { BadgeTone } from '@/components/ui/Badge'
import { withRandomSuffix } from '@/lib/slug'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const PAGES_KEY = ['pages'] as const

export const PAGE_TEMPLATES = ['default', 'fullwidth', 'contact'] as const
export type PageTemplate = (typeof PAGE_TEMPLATES)[number]
export const PAGE_TEMPLATE_LABELS: Record<PageTemplate, string> = {
  default: 'Mặc định',
  fullwidth: 'Toàn chiều rộng',
  contact: 'Liên hệ (kèm thông tin trường)',
}
export function asPageTemplate(value: string): PageTemplate {
  return (PAGE_TEMPLATES as readonly string[]).includes(value) ? (value as PageTemplate) : 'default'
}

export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const
export type PageStatus = (typeof PAGE_STATUSES)[number]
export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Nháp',
  published: 'Đã đăng',
  archived: 'Đã ẩn',
}
export const PAGE_STATUS_TONES: Record<PageStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
}
export function asPageStatus(value: string): PageStatus {
  return (PAGE_STATUSES as readonly string[]).includes(value) ? (value as PageStatus) : 'draft'
}

export async function fetchAdminPages() {
  const { data, error } = await getSupabase()
    .from('pages')
    .select('id, title, slug, status, template, sort_order, updated_at')
    .order('sort_order')
    .order('title')
  if (error) throw error
  return data
}

export async function fetchPage(id: string) {
  const { data, error } = await getSupabase()
    .from('pages')
    .select(
      'id, title, slug, content, excerpt, featured_image_url, template, status, sort_order, meta_title, meta_description, no_index',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export type EditablePage = NonNullable<Awaited<ReturnType<typeof fetchPage>>>

export interface PageInput {
  title: string
  slug: string
  content: string
  excerpt: string
  featured_image_url: string | null
  template: PageTemplate
  status: PageStatus
  sort_order: number
  meta_title: string
  meta_description: string
  no_index: boolean
}

export async function savePage(input: PageInput, id?: string): Promise<string> {
  const supabase = getSupabase()
  const row = {
    ...input,
    excerpt: input.excerpt || null,
    meta_title: input.meta_title || null,
    meta_description: input.meta_description || null,
  }
  if (id) {
    const { error } = await supabase.from('pages').update(row).eq('id', id)
    if (error) throw error
    return id
  }
  const created_by = await requireUserId()
  let result = await supabase
    .from('pages')
    .insert({ ...row, created_by })
    .select('id')
    .single()
  if (result.error?.code === '23505') {
    result = await supabase
      .from('pages')
      .insert({ ...row, slug: withRandomSuffix(row.slug), created_by })
      .select('id')
      .single()
  }
  if (result.error) throw result.error
  return result.data.id
}

export async function deletePage(id: string): Promise<void> {
  const { error } = await getSupabase().from('pages').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPublicPage(slug: string) {
  const { data, error } = await getSupabase()
    .from('pages')
    .select('id, title, slug, content, excerpt, featured_image_url, template, status, meta_title, updated_at')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Trang đã đăng, dùng cho gợi ý liên kết khi soạn menu. */
export async function fetchPublishedPageLinks() {
  const { data, error } = await getSupabase()
    .from('pages')
    .select('title, slug')
    .eq('status', 'published')
    .order('sort_order')
    .order('title')
  if (error) throw error
  return data
}
