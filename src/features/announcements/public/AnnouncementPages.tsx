import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, CalendarDays, Pin } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
  WithSidebar,
} from '@/components/content/PublicPage'
import { RichContent } from '@/components/content/RichContent'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { CONTENT_GROUPS_KEY, fetchContentGroups } from '@/features/content-groups/api'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { htmlToText } from '@/lib/sanitize'
import { usePageTitle } from '@/lib/use-page-title'
import {
  ANNOUNCEMENT_PAGE_SIZE,
  ANNOUNCEMENTS_KEY,
  asPriority,
  fetchPublicAnnouncement,
  fetchPublicAnnouncements,
  isExpired,
  PRIORITY_LABELS,
  PRIORITY_TONES,
} from '../api'

function PriorityBadge({ priority }: { priority: string }) {
  const p = asPriority(priority)
  if (p === 'normal') return null
  return <Badge tone={PRIORITY_TONES[p]}>{PRIORITY_LABELS[p]}</Badge>
}

const GROUP_PARAM = 'phan-loai'

function AnnouncementSidebar({ current, excludeId }: { current?: string | null; excludeId?: string }) {
  const { data: groups = [] } = useQuery({
    queryKey: [...CONTENT_GROUPS_KEY, 'announcement'],
    queryFn: () => fetchContentGroups('announcement'),
  })
  const { data: latest } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'sidebar-latest'],
    queryFn: () => fetchPublicAnnouncements(1, 6),
  })
  const others = (latest?.items ?? []).filter((a) => a.id !== excludeId).slice(0, 5)
  const row = (active: boolean) =>
    cn('block rounded px-2 py-1.5 text-sm hover:bg-bg', active && 'bg-primary/10 font-semibold text-primary')
  return (
    <>
      {groups.length > 0 && (
        <SidebarBox title="Phân loại">
          <ul>
            <li>
              <Link to="/thong-bao" className={row(!current)} aria-current={!current ? 'true' : undefined}>
                Tất cả thông báo
              </Link>
            </li>
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/thong-bao?${GROUP_PARAM}=${g.id}`}
                  className={row(current === g.id)}
                  aria-current={current === g.id ? 'true' : undefined}
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </SidebarBox>
      )}
      {others.length > 0 && (
        <SidebarBox title="Thông báo mới">
          <ul className="space-y-2.5">
            {others.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/thong-bao/${a.id}`}
                  className="line-clamp-2 text-sm font-medium hover:text-primary"
                >
                  {a.title}
                </Link>
                <span className="text-xs text-muted">{formatDate(a.published_at)}</span>
              </li>
            ))}
          </ul>
        </SidebarBox>
      )}
    </>
  )
}

export function AnnouncementListPage() {
  const [params] = useSearchParams()
  const { chrome } = useSite()
  const page = readPage(params)
  const group = chrome.content_sidebar ? params.get(GROUP_PARAM) : null
  usePageTitle('Thông báo')
  const { data, isPending, error } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'public', page, group],
    queryFn: () => fetchPublicAnnouncements(page, ANNOUNCEMENT_PAGE_SIZE, group),
  })

  const body = (
    <>
      <PublicPageHeader title="Thông báo" crumbs={[{ label: 'Thông báo' }]} />
      <PublicQueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState icon={Bell} title="Hiện chưa có thông báo nào" />}
      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-border bg-surface p-4 transition hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {a.is_pinned && (
                    <Badge tone="info">
                      <Pin className="h-3 w-3" aria-hidden /> Ghim
                    </Badge>
                  )}
                  <PriorityBadge priority={a.priority} />
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatDate(a.published_at)}
                  </span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold">
                  <Link to={`/thong-bao/${a.id}`} className="hover:text-primary">
                    {a.title}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{htmlToText(a.content)}</p>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(data.total / ANNOUNCEMENT_PAGE_SIZE)} />
        </>
      )}
    </>
  )
  return chrome.content_sidebar ? (
    <WithSidebar sidebar={<AnnouncementSidebar current={group} />}>{body}</WithSidebar>
  ) : (
    <div className="mx-auto max-w-4xl">{body}</div>
  )
}

export function AnnouncementDetailPage() {
  const { id = '' } = useParams()
  const { chrome } = useSite()
  const isUuid = /^[0-9a-f-]{36}$/i.test(id)
  const { data, isPending, error } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'public', 'detail', id],
    queryFn: () => fetchPublicAnnouncement(id),
    enabled: isUuid,
  })
  usePageTitle(data?.title)

  if (!isUuid) return <NotFound />
  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!data) return <NotFound />
  const visible = data.status === 'published' && !isExpired(data)

  const body = (
    <>
      {!visible && <DraftPreviewNotice />}
      <article className="rounded-xl bg-surface p-4 shadow-sm sm:p-6">
        <PublicPageHeader title={data.title} crumbs={[{ label: 'Thông báo', to: '/thong-bao' }]}>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <PriorityBadge priority={data.priority} />
            {data.published_at && <span>Ngày đăng: {formatDate(data.published_at)}</span>}
            {data.expires_at && <span>· Hiệu lực đến: {formatDateTime(data.expires_at)}</span>}
          </div>
        </PublicPageHeader>
        <RichContent html={data.content} />
      </article>
    </>
  )
  return chrome.content_sidebar ? (
    <WithSidebar sidebar={<AnnouncementSidebar current={data.group_id} excludeId={data.id} />}>
      {body}
    </WithSidebar>
  ) : (
    <div className="mx-auto max-w-4xl">{body}</div>
  )
}
