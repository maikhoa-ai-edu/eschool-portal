import { getSupabase } from '@/lib/supabase'

export const VISIT_STATS_KEY = ['visit-stats'] as const

export interface VisitStats {
  /** Đã cộng số khởi điểm (cấu hình ở trang quản trị Trang chủ) */
  total: number
  today: number
  yesterday: number
  month: number
}

export async function fetchVisitStats(): Promise<VisitStats> {
  const { data, error } = await getSupabase().rpc('get_visit_stats')
  if (error) throw error
  const stats = (data ?? {}) as Partial<Record<keyof VisitStats, number>>
  return {
    total: Number(stats.total ?? 0),
    today: Number(stats.today ?? 0),
    yesterday: Number(stats.yesterday ?? 0),
    month: Number(stats.month ?? 0),
  }
}
