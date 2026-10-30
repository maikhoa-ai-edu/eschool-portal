import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Newspaper,
  UserPlus,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { useAuth } from '@/features/auth/auth-context'
import { AuditActionBadge } from '@/features/audit/AuditLogPage'
import { AUDIT_KEY, auditActorName, auditTarget, fetchRecentAudit } from '@/features/audit/api'
import { useSite } from '@/features/site/site-context'
import { formatDateTime, formatNumber } from '@/lib/format'
import { getSupabase, requireUserId } from '@/lib/supabase'
import { addDays, fillVisitDays, vietnamToday } from './visits'
import { VisitsChart } from './VisitsChart'

const CHART_DAYS = 30
const EXPIRING_SOON_DAYS = 7

interface DashboardStats {
  publishedNews: number
  pendingNews: number
  activeAnnouncements: number
  visits: { today: number; yesterday: number; month: number; total: number }
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
  const v = visits.data as Partial<DashboardStats['visits']> | null
  return {
    publishedNews: published.count ?? 0,
    pendingNews: pending.count ?? 0,
    activeAnnouncements: announcements.count ?? 0,
    visits: {
      today: Number(v?.today ?? 0),
      yesterday: Number(v?.yesterday ?? 0),
      month: Number(v?.month ?? 0),
      total: Number(v?.total ?? 0),
    },
  }
}

async function fetchVisitDays() {
  const today = vietnamToday()
  const { data, error } = await getSupabase()
    .from('site_visits_daily')
    .select('day, visits')
    .gte('day', addDays(today, 1 - CHART_DAYS))
  if (error) throw error
  return fillVisitDays(data, today, CHART_DAYS)
}

interface TodoCounts {
  returnedNews: number
  expiringAnnouncements: number
  expiredInvitations: number
}

/** Mỗi việc chỉ truy vấn khi người dùng có quyền xử lý; việc không có quyền tính là 0. */
async function fetchTodos(canManageAnnouncements: boolean, canManageUsers: boolean): Promise<TodoCounts> {
  const supabase = getSupabase()
  const now = new Date()
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
  const [returned, expiring, invitations] = await Promise.all([
    // Bài bị trả lại: nháp của chính mình còn góp ý của người duyệt
    supabase
      .from('news')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
      .eq('author_id', await requireUserId())
      .not('review_note', 'is', null),
    canManageAnnouncements
      ? supabase
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')
          .gt('expires_at', now.toISOString())
          .lte('expires_at', soon.toISOString())
      : null,
    canManageUsers
      ? supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .is('accepted_at', null)
          .lte('expires_at', now.toISOString())
      : null,
  ])
  for (const res of [returned, expiring, invitations]) if (res?.error) throw res.error
  return {
    returnedNews: returned.count ?? 0,
    expiringAnnouncements: expiring?.count ?? 0,
    expiredInvitations: invitations?.count ?? 0,
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
        <span className="block text-2xl font-bold">{value === undefined ? '…' : formatNumber(value)}</span>
        <span className="block text-sm text-muted">{label}</span>
      </span>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function TodoRow({ icon: Icon, text, to }: { icon: LucideIcon; text: string; to: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-bg">
        <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">{text}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  )
}

function RecentActivity() {
  const { data } = useQuery({ queryKey: [...AUDIT_KEY, 'recent'], queryFn: () => fetchRecentAudit(6) })
  return (
    <Panel title="Hoạt động gần đây">
      <ul className="divide-y divide-border text-sm">
        {data?.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
            <AuditActionBadge action={entry.action} />
            <span className="min-w-0 flex-1 basis-56">
              <strong className="font-semibold">{auditActorName(entry)}</strong> · {auditTarget(entry)}
            </span>
            <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(entry.occurred_at)}</span>
          </li>
        ))}
      </ul>
      <Link to="/admin/nhat-ky" className="block text-sm text-primary hover:underline">
        Xem toàn bộ nhật ký
      </Link>
    </Panel>
  )
}

export function DashboardPage() {
  const { profile, can } = useAuth()
  const { isModuleEnabled } = useSite()
  const canPublish = can('news.publish')
  const canManageAnnouncements = can('announcements.manage')
  const canManageUsers = can('users.manage')

  const { data, isError } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchStats })
  const visitDays = useQuery({ queryKey: ['dashboard-visits'], queryFn: fetchVisitDays })
  const todos = useQuery({
    queryKey: ['dashboard-todos', canManageAnnouncements, canManageUsers],
    queryFn: () => fetchTodos(canManageAnnouncements, canManageUsers),
  })

  const newsOn = isModuleEnabled('news')
  const pending = canPublish && newsOn ? (data?.pendingNews ?? 0) : 0
  const returned = newsOn ? (todos.data?.returnedNews ?? 0) : 0
  const expiring = isModuleEnabled('announcements') ? (todos.data?.expiringAnnouncements ?? 0) : 0
  const expiredInvites = todos.data?.expiredInvitations ?? 0
  const noTodos = pending + returned + expiring + expiredInvites === 0

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
          label={canPublish ? 'Tin chờ duyệt' : 'Tin của bạn đang chờ duyệt'}
          value={data?.pendingNews}
          to="/admin/tin-tuc?trang-thai=pending"
        />
        <StatCard icon={Bell} label="Thông báo đang hiển thị" value={data?.activeAnnouncements} />
        <StatCard icon={Eye} label="Lượt truy cập hôm nay" value={data?.visits.today} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel title={`Lượt truy cập ${CHART_DAYS} ngày gần nhất`}>
            {data && (
              <p className="text-sm text-muted">
                Hôm qua <strong className="text-text">{formatNumber(data.visits.yesterday)}</strong> · Tháng
                này <strong className="text-text">{formatNumber(data.visits.month)}</strong> · Tổng{' '}
                <strong className="text-text">{formatNumber(data.visits.total)}</strong>
              </p>
            )}
            {visitDays.isError && <p className="text-sm text-danger">Không tải được biểu đồ.</p>}
            {visitDays.data && <VisitsChart days={visitDays.data} />}
          </Panel>
        </div>

        <Panel title="Việc cần làm">
          {todos.isSuccess && data && noTodos && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Không có việc nào đang chờ bạn.
            </p>
          )}
          <ul className="space-y-1">
            {pending > 0 && (
              <TodoRow
                icon={Clock}
                text={`${formatNumber(pending)} bài đang đợi bạn duyệt`}
                to="/admin/tin-tuc?trang-thai=pending"
              />
            )}
            {returned > 0 && (
              <TodoRow
                icon={Undo2}
                text={`${formatNumber(returned)} bài bị trả lại cần sửa`}
                to="/admin/tin-tuc?trang-thai=draft"
              />
            )}
            {expiring > 0 && (
              <TodoRow
                icon={Bell}
                text={`${formatNumber(expiring)} thông báo sắp hết hạn (trong ${EXPIRING_SOON_DAYS} ngày)`}
                to="/admin/thong-bao"
              />
            )}
            {expiredInvites > 0 && (
              <TodoRow
                icon={UserPlus}
                text={`${formatNumber(expiredInvites)} lời mời đã hết hạn`}
                to="/admin/tai-khoan"
              />
            )}
          </ul>
        </Panel>
      </div>

      {can('audit.view') && <RecentActivity />}
    </div>
  )
}
