import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Pin, Plus } from 'lucide-react'
import { AdminPageHeader, QueryState, TableCard } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { formatDateTime } from '@/lib/format'
import {
  ANNOUNCEMENT_PAGE_SIZE,
  ANNOUNCEMENTS_KEY,
  asPriority,
  fetchAdminAnnouncements,
  isExpired,
  PRIORITY_LABELS,
  PRIORITY_TONES,
} from '../api'

export function AnnouncementStatusBadge({ item }: { item: { status: string; expires_at: string | null } }) {
  if (item.status !== 'published') return <Badge>Nháp</Badge>
  if (isExpired(item)) return <Badge tone="danger">Hết hạn</Badge>
  return <Badge tone="success">Đang hiển thị</Badge>
}

export function AnnouncementListPage() {
  const [params] = useSearchParams()
  const page = readPage(params)
  const { data, isPending, error } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'admin', page],
    queryFn: () => fetchAdminAnnouncements(page),
  })

  return (
    <div>
      <AdminPageHeader
        title="Thông báo"
        description="Thông báo điều hành gửi phụ huynh, học sinh. Thông báo ghim luôn nằm đầu danh sách."
        actions={
          <>
            <Link to="/admin/thong-bao/phan-loai" className={buttonClasses('outline')}>
              Phân loại
            </Link>
            <Link to="/admin/thong-bao/moi" className={buttonClasses('primary')}>
              <Plus className="h-4 w-4" aria-hidden /> Thêm thông báo
            </Link>
          </>
        }
      />
      <QueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState title="Chưa có thông báo nào" />}
      {data && data.items.length > 0 && (
        <>
          <TableCard>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Mức độ</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th>Hết hạn</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const priority = asPriority(item.priority)
                return (
                  <tr key={item.id}>
                    <td className="max-w-md">
                      {item.is_pinned && (
                        <Pin className="mr-1.5 inline h-3.5 w-3.5 text-accent" aria-label="Đã ghim" />
                      )}
                      <Link
                        to={`/admin/thong-bao/${item.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={PRIORITY_TONES[priority]}>{PRIORITY_LABELS[priority]}</Badge>
                    </td>
                    <td>
                      <AnnouncementStatusBadge item={item} />
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(item.published_at)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(item.expires_at) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </TableCard>
          <Pagination page={page} totalPages={Math.ceil(data.total / ANNOUNCEMENT_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}
