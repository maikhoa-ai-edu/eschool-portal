import { DOCUMENTS_BUCKET, publicFileUrl } from '@/features/media/api'
import { getSupabase, requireUserId } from '@/lib/supabase'
import { daysInMonth, isoDate, type PlanEvent, type YearMonth } from './calendar'
import type { PlanRow } from './docx'

export const PLANS_KEY = ['plans'] as const

export const PLAN_PDF_MAX_BYTES = 20 * 1024 * 1024

export interface WorkPlan {
  id: string
  year: number
  month: number
  title: string
  note: string | null
  status: string
  file_path: string | null
  file_name: string | null
}

const COLUMNS = 'id, year, month, title, note, status, file_path, file_name'

export async function fetchPlans(publishedOnly: boolean): Promise<WorkPlan[]> {
  let query = getSupabase()
    .from('work_plans')
    .select(COLUMNS)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (publishedOnly) query = query.eq('status', 'published')
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Một hàng kế hoạch; hàng được đánh dấu quan trọng luôn có ngày để hiện trên lịch. */
export interface PlanItem extends PlanRow {
  is_important: boolean
  event_date: string | null
  event_end_date: string | null
}

export async function fetchPlanItems(planId: string): Promise<PlanItem[]> {
  const { data, error } = await getSupabase()
    .from('work_plan_items')
    .select('time_text, content, assignee, is_important, event_date, event_end_date')
    .eq('plan_id', planId)
    .order('sort_order')
  if (error) throw error
  return data
}

/** Sự kiện quan trọng có ngày rơi vào tháng. Lọc rõ kế hoạch đã đăng vì RLS cho nhân viên đọc cả bản nháp. */
export async function fetchMonthEvents(target: YearMonth): Promise<PlanEvent[]> {
  const start = isoDate(target.year, target.month, 1)
  const end = isoDate(target.year, target.month, daysInMonth(target))
  const { data, error } = await getSupabase()
    .from('work_plan_items')
    .select('content, event_date, event_end_date, work_plans!inner(status)')
    .eq('is_important', true)
    .eq('work_plans.status', 'published')
    .lte('event_date', end)
    .or(`event_end_date.gte.${start},and(event_end_date.is.null,event_date.gte.${start})`)
    .order('event_date')
  if (error) throw error
  return data.flatMap(({ content, event_date, event_end_date }) =>
    event_date ? [{ content, event_date, event_end_date }] : [],
  )
}

export async function fetchPlan(id: string): Promise<WorkPlan | null> {
  const { data, error } = await getSupabase().from('work_plans').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export function planFileUrl(plan: { file_path: string; file_name: string | null }): string {
  return publicFileUrl(DOCUMENTS_BUCKET, plan.file_path, plan.file_name ?? undefined)
}

export function planFileViewUrl(plan: { file_path: string }): string {
  return publicFileUrl(DOCUMENTS_BUCKET, plan.file_path)
}

export interface PlanInput {
  year: number
  month: number
  title: string
  note: string
  status: 'draft' | 'published'
  rows: PlanItem[]
  /** null = giữ file đang có */
  pdf: File | null
  removePdf: boolean
}

/** Lưu kế hoạch và thay toàn bộ các hàng; file cũ chỉ bị xóa sau khi lưu xong. */
export async function savePlan(input: PlanInput, existing: WorkPlan | null): Promise<string> {
  const supabase = getSupabase()
  const storage = supabase.storage.from(DOCUMENTS_BUCKET)
  let uploaded: { file_path: string; file_name: string } | null = null
  if (input.pdf) {
    if (input.pdf.type !== 'application/pdf') throw new Error('Chỉ đính kèm file PDF.')
    if (input.pdf.size > PLAN_PDF_MAX_BYTES) throw new Error('File PDF quá lớn (tối đa 20 MB).')
    const path = `plans/${input.year}-${input.month}-${crypto.randomUUID()}.pdf`
    const { error } = await storage.upload(path, input.pdf, { contentType: 'application/pdf', upsert: false })
    if (error) throw error
    uploaded = { file_path: path, file_name: input.pdf.name }
  }
  const row = {
    year: input.year,
    month: input.month,
    title: input.title,
    note: input.note || null,
    status: input.status,
    ...(uploaded ?? (input.removePdf ? { file_path: null, file_name: null } : {})),
  }
  try {
    let id = existing?.id
    if (id) {
      const { error } = await supabase.from('work_plans').update(row).eq('id', id)
      if (error) throw error
      const removed = await supabase.from('work_plan_items').delete().eq('plan_id', id)
      if (removed.error) throw removed.error
    } else {
      const { data, error } = await supabase
        .from('work_plans')
        .insert({ ...row, created_by: await requireUserId() })
        .select('id')
        .single()
      if (error) throw error
      id = data.id
    }
    if (input.rows.length > 0) {
      const planId = id
      const { error } = await supabase
        .from('work_plan_items')
        .insert(input.rows.map((r, i) => ({ ...r, plan_id: planId, sort_order: i })))
      if (error) throw error
    }
    if (existing?.file_path && (uploaded || input.removePdf)) await storage.remove([existing.file_path])
    return id
  } catch (err) {
    if (uploaded) await storage.remove([uploaded.file_path])
    throw err
  }
}

export async function deletePlan(plan: WorkPlan): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('work_plans').delete().eq('id', plan.id)
  if (error) throw error
  if (plan.file_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([plan.file_path])
}

/** Kế hoạch đã đăng của tháng hiện tại; chưa có thì lấy kế hoạch mới nhất. Kèm các hàng để hiện ở trang chủ. */
export async function fetchCurrentPlan(limit: number) {
  const plans = await fetchPlans(true)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const plan = plans.find((p) => p.year === now.getFullYear() && p.month === now.getMonth() + 1) ?? plans[0]
  if (!plan) return null
  const items = await fetchPlanItems(plan.id)
  return { plan, items: items.slice(0, limit) }
}
