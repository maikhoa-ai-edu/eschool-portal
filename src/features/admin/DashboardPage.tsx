import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bell, Clock, Eye, Newspaper, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { getSupabase } from '@/lib/supabase'

interface DashboardStats {
  publishedNews: number
  pendingNews: number
  activeAnnouncements: number
  visitsToday: number
}

async function fetchStats(): Promise<DashboardStats> {
  const supabase = getSupabase()
  // RLS tự giới hạn: editor chỉ đếm được bài của mình ở trạng thái chờ duyệt
  const [published, pending, announcements, visits] = await Promise.all([
    supabase.from('news').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('news').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    supabase.rpc('get_visit_stats'),
  ])
  for (const res of [published, pending, announcements, visits]) if (res.error) throw res.error
  const visitStats = visits.data as { today?: number } | null
  return {
    publishedNews: published.count ?? 0,
    pendingNews: pending.count ?? 0,
    activeAnnouncements: announcements.count ?? 0,
    visitsToday: Number(visitStats?.today ?? 0),
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: LucideIcon
  label: string
  value?: number
  to?: string
}) {
  const body = (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block text-2xl font-bold">{value ?? '…'}</span>
        <span className="block text-sm text-muted">{label}</span>
      </span>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function DashboardPage() {
  const { profile, can } = useAuth()
  const { data, isError } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchStats })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-primary">Xin chào, {profile?.full_name}</h1>
        <p className="text-sm text-muted">Tổng quan hoạt động của cổng thông tin.</p>
      </div>
      {isError && <p className="text-sm text-danger">Không tải được số liệu.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Newspaper}
          label="Tin đã đăng"
          value={data?.publishedNews}
          to="/admin/tin-tuc?trang-thai=published"
        />
        <StatCard
          icon={Clock}
          label={can('news.publish') ? 'Tin chờ duyệt' : 'Tin của bạn đang chờ duyệt'}
          value={data?.pendingNews}
          to="/admin/tin-tuc?trang-thai=pending"
        />
        <StatCard icon={Bell} label="Thông báo đang hiển thị" value={data?.activeAnnouncements} />
        <StatCard icon={Eye} label="Lượt truy cập hôm nay" value={data?.visitsToday} />
      </div>
    </div>
  )
}
