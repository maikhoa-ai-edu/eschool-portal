import { pageRange } from '@/components/ui/page-utils'
import { getSupabase } from '@/lib/supabase'

export const AUDIT_KEY = ['audit-logs'] as const
export const AUDIT_PAGE_SIZE = 25

/** Giá trị bộ lọc "người thực hiện" cho thao tác không gắn với tài khoản nào (đăng ký, SQL trực tiếp) */
export const SYSTEM_ACTOR = 'he-thong'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: 'Thêm',
  UPDATE: 'Sửa',
  DELETE: 'Xóa',
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  profiles: 'Tài khoản',
  invitations: 'Lời mời',
  site_settings: 'Cấu hình',
  module_settings: 'Module',
  news: 'Tin tức',
  news_categories: 'Chuyên mục',
  announcements: 'Thông báo',
  documents: 'Văn bản',
  pages: 'Trang tĩnh',
  menus: 'Menu',
  menu_items: 'Mục menu',
  media: 'Ảnh',
  albums: 'Album',
  homepage_slides: 'Slide trang chủ',
}

/** Dòng cấu hình và module được nhận diện bằng khóa nội bộ, không có tiêu đề */
const SUMMARY_LABELS: Record<string, string> = {
  school_identity: 'Thông tin trường',
  branding: 'Nhận diện',
  seo: 'SEO',
  marquee: 'Dòng chữ chạy',
  footer: 'Chân trang',
  homepage: 'Trang chủ',
  news: 'Tin tức',
  announcements: 'Thông báo',
  documents: 'Văn bản',
  albums: 'Thư viện ảnh',
  pages: 'Trang tĩnh',
}

const FIELD_LABELS: Record<string, string> = {
  role: 'vai trò',
  is_active: 'trạng thái hoạt động',
  is_enabled: 'bật/tắt',
  status: 'trạng thái',
  title: 'tiêu đề',
  content: 'nội dung',
  excerpt: 'tóm tắt',
  value: 'giá trị',
  is_featured: 'nổi bật',
  is_pinned: 'ghim',
  published_at: 'ngày đăng',
  published_by: 'người duyệt',
  expires_at: 'hạn dùng',
  accepted_at: 'ngày nhận',
  invited_by: 'người mời',
  full_name: 'họ tên',
  review_note: 'góp ý',
  sort_order: 'thứ tự',
  slug: 'đường dẫn',
  category_id: 'chuyên mục',
  thumbnail_url: 'ảnh đại diện',
}

export function auditFieldLabels(fields: readonly string[] | null): string {
  return (fields ?? []).map((f) => FIELD_LABELS[f] ?? f).join(', ')
}

export interface AuditFilters {
  actor: string
  table: string
  from: string
  to: string
}

/** Khoảng thời gian theo giờ Việt Nam; `to` tính hết ngày đó (trả về mốc đầu ngày hôm sau). */
export function auditTimeRange(from: string, to: string): { gte?: string; lt?: string } {
  const range: { gte?: string; lt?: string } = {}
  if (from) range.gte = new Date(`${from}T00:00:00+07:00`).toISOString()
  if (to) {
    const end = new Date(`${to}T00:00:00+07:00`)
    end.setUTCDate(end.getUTCDate() + 1)
    range.lt = end.toISOString()
  }
  return range
}

export interface AuditEntry {
  id: number
  occurred_at: string
  actor_id: string | null
  actor_role: string | null
  action: string
  table_name: string
  record_id: string | null
  changed_fields: string[] | null
  summary: string | null
  actor: { full_name: string } | null
}

export function auditActorName(entry: Pick<AuditEntry, 'actor' | 'actor_id'>): string {
  return entry.actor?.full_name ?? (entry.actor_id ? 'Tài khoản đã xóa' : 'Hệ thống')
}

export function auditTarget(entry: Pick<AuditEntry, 'table_name' | 'summary'>): string {
  const table = AUDIT_TABLE_LABELS[entry.table_name] ?? entry.table_name
  if (!entry.summary) return table
  const isKey = entry.table_name === 'site_settings' || entry.table_name === 'module_settings'
  return `${table}: ${(isKey && SUMMARY_LABELS[entry.summary]) || entry.summary}`
}

const AUDIT_COLUMNS =
  'id, occurred_at, actor_id, actor_role, action, table_name, record_id, changed_fields, summary, actor:profiles!audit_logs_actor_id_fkey(full_name)'

export async function fetchAuditLogs(
  filters: AuditFilters,
  page: number,
): Promise<{ items: AuditEntry[]; total: number }> {
  const [start, end] = pageRange(page, AUDIT_PAGE_SIZE)
  let query = getSupabase().from('audit_logs').select(AUDIT_COLUMNS, { count: 'exact' })
  if (filters.actor === SYSTEM_ACTOR) query = query.is('actor_id', null)
  else if (filters.actor) query = query.eq('actor_id', filters.actor)
  if (filters.table) query = query.eq('table_name', filters.table)
  const { gte, lt } = auditTimeRange(filters.from, filters.to)
  if (gte) query = query.gte('occurred_at', gte)
  if (lt) query = query.lt('occurred_at', lt)
  const { data, count, error } = await query
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, end)
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export async function fetchRecentAudit(limit: number): Promise<AuditEntry[]> {
  const { data, error } = await getSupabase()
    .from('audit_logs')
    .select(AUDIT_COLUMNS)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function fetchAuditActors(): Promise<Array<{ id: string; full_name: string }>> {
  const { data, error } = await getSupabase().from('profiles').select('id, full_name').order('full_name')
  if (error) throw error
  return data
}
