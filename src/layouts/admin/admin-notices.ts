import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import {
  fetchLatestRelease,
  fetchSchemaVersion,
  LATEST_RELEASE_QUERY_KEY,
  RELEASE_CHECK_STALE_MS,
  SCHEMA_VERSION_QUERY_KEY,
} from '@/features/system/versions'
import { compareVersions } from '@/lib/semver'
import { getSupabase, requireUserId } from '@/lib/supabase'
import { APP_VERSION, REQUIRED_SCHEMA_VERSION } from '@/lib/version'

/** Một việc đang chờ người dùng, hiện thành chấm đỏ ở menu và trong chuông. */
export interface AdminNotice {
  key: 'pending-news' | 'returned-news' | 'pending-comments' | 'update'
  /** Trang xử lý việc này */
  to: string
  /** Mục menu mang chấm đỏ */
  navTo: string
  count: number
  text: string
}

export const ADMIN_NOTICES_QUERY_KEY = ['admin-notices'] as const
const REFRESH_MS = 60_000

interface NoticeCounts {
  pendingNews: number
  returnedNews: number
  pendingComments: number
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: unknown }> | null,
): Promise<number> {
  if (!query) return 0
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function fetchNoticeCounts(flags: {
  pendingNews: boolean
  returnedNews: boolean
  pendingComments: boolean
}): Promise<NoticeCounts> {
  const supabase = getSupabase()
  const head = { count: 'exact', head: true } as const
  const [pendingNews, returnedNews, pendingComments] = await Promise.all([
    countRows(flags.pendingNews ? supabase.from('news').select('id', head).eq('status', 'pending') : null),
    // Bài bị trả lại: nháp của chính mình còn góp ý của người duyệt (giống Việc cần làm ở Bảng điều khiển)
    countRows(
      flags.returnedNews
        ? supabase
            .from('news')
            .select('id', head)
            .eq('status', 'draft')
            .eq('author_id', await requireUserId())
            .not('review_note', 'is', null)
        : null,
    ),
    countRows(
      flags.pendingComments
        ? supabase.from('news_comments').select('id', head).eq('status', 'pending')
        : null,
    ),
  ])
  return { pendingNews, returnedNews, pendingComments }
}

/**
 * Việc đang chờ: bài chờ duyệt, bài bị trả lại, bình luận chờ duyệt, bản mới. Mỗi việc chỉ hỏi CSDL khi người dùng
 * có quyền xử lý. Tự làm mới mỗi phút, khi quay lại tab và khi chuyển trang.
 */
export function useAdminNotices(): { notices: AdminNotice[]; byNav: Map<string, number>; total: number } {
  const { can } = useAuth()
  const { isModuleEnabled } = useSite()
  const { pathname } = useLocation()
  const newsOn = isModuleEnabled('news')
  const flags = {
    pendingNews: newsOn && can('news.publish'),
    returnedNews: newsOn && can('news.create'),
    pendingComments: isModuleEnabled('comments') && can('comments.manage'),
  }
  const canUpdate = can('backup.manage')

  const counts = useQuery({
    queryKey: [...ADMIN_NOTICES_QUERY_KEY, flags],
    queryFn: () => fetchNoticeCounts(flags),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
  const schema = useQuery({
    queryKey: SCHEMA_VERSION_QUERY_KEY,
    queryFn: fetchSchemaVersion,
    enabled: canUpdate,
  })
  const release = useQuery({
    queryKey: LATEST_RELEASE_QUERY_KEY,
    queryFn: fetchLatestRelease,
    enabled: canUpdate,
    staleTime: RELEASE_CHECK_STALE_MS,
    retry: false,
  })

  // Vừa duyệt bài xong chuyển trang thì số trên chấm đổi ngay, không đợi tới lượt làm mới.
  // Lần đầu bỏ qua vì truy vấn vừa tự chạy.
  const { refetch } = counts
  const firstPath = useRef(pathname)
  useEffect(() => {
    if (pathname === firstPath.current) return
    firstPath.current = ''
    void refetch()
  }, [pathname, refetch])

  const notices: AdminNotice[] = []
  const c = counts.data
  if (c?.pendingNews) {
    notices.push({
      key: 'pending-news',
      to: '/admin/tin-tuc?trang-thai=pending',
      navTo: '/admin/tin-tuc',
      count: c.pendingNews,
      text: `${c.pendingNews} bài đang chờ duyệt`,
    })
  }
  if (c?.returnedNews) {
    notices.push({
      key: 'returned-news',
      to: '/admin/tin-tuc?trang-thai=draft',
      navTo: '/admin/tin-tuc',
      count: c.returnedNews,
      text: `${c.returnedNews} bài của bạn bị trả lại cần sửa`,
    })
  }
  if (c?.pendingComments) {
    notices.push({
      key: 'pending-comments',
      to: '/admin/binh-luan',
      navTo: '/admin/binh-luan',
      count: c.pendingComments,
      text: `${c.pendingComments} bình luận đang chờ duyệt`,
    })
  }
  if (canUpdate) {
    const newRelease =
      release.data && compareVersions(release.data.version, APP_VERSION) > 0 ? release.data.version : null
    const schemaBehind = schema.data ? compareVersions(schema.data, REQUIRED_SCHEMA_VERSION) < 0 : false
    if (newRelease || schemaBehind) {
      notices.push({
        key: 'update',
        to: '/admin/cap-nhat',
        navTo: '/admin/cap-nhat',
        count: 1,
        text: schemaBehind ? `CSDL cần nâng cấp lên ${REQUIRED_SCHEMA_VERSION}` : `Có bản mới ${newRelease}`,
      })
    }
  }

  const byNav = new Map<string, number>()
  for (const notice of notices) byNav.set(notice.navTo, (byNav.get(notice.navTo) ?? 0) + notice.count)
  return { notices, byNav, total: notices.reduce((sum, n) => sum + n.count, 0) }
}
